import { isRef, nextTick } from 'vue';
import {
  findRowNode,
  getAvailableRowIds,
} from '../utils/rowLookup.js';
import { createFakeJunctionRecord } from '../../shared/utils/sharedHelpers.js';

// Grid actions: the programmatic-action surface exposed to WeWeb workflows
// (and a couple of internal callers like createRecord → setCellValue).
//
// Includes: setCellValue, triggerCellValueChanged, refreshRow, stopCellEditing,
// createRecord, closeCreateRecordForm, resetFilters, resetSort, deselectAll,
// selectAll, selectRow, deselectRow, removeRow, applyFocusedRow. Each was
// previously an Options-API method accessed via `this.x()`. The mechanical
// conversion pulls `this.X` references through to composable-local deps and
// makes recursive calls (`this.setCellValue(...)` → `setCellValue(...)`) by
// declaring `let` bindings before assigning the methods so they can refer
// to one another.
export function useGridActions(cfg, props, ctx, resolveMappingFormula, {
  gridApi, debugLog, isGridRendering,
  waitForGridReady, waitForRowInGridLocal,
  // From useGrouping (S3):
  isGroupingActive, groupGridApis, findGroupForRowId,
  // Cross-group move for refreshRow: when an external update changes a row's
  // grouping-column value, refreshRow must physically move the row between the
  // per-group grids (mirrors useCellEditing.onCellValueChanged /
  // useGrouping.handleCrossGroupDrop). UNASSIGNED_GROUP/groupingState identify
  // the destination group; the paged-append helpers keep per-group state +
  // badge counts in sync; expandGroup reveals a collapsed destination.
  UNASSIGNED_GROUP, groupingState, groupInfiniteCounts,
  bumpGroupingDataVersion, expandGroup, isInfiniteScrollEnabled,
  getAddRowToGroupState, getRemoveRowFromGroupState,
  getScheduleRefreshGroupCounts, getStampGroupMutation,
  // From useDataFetch (S2):
  removedRowIds, cleanupRemovedIds, setUpdatingDataLocally,
  supabaseData, supabaseTotalCount,
  waitForSupabaseInstance,
  // From useInfiniteScroll (S2) — passed as a thunk because useInfiniteScroll
  // is created AFTER useGridActions in the orchestrator (it needs grouping
  // refs from useGrouping which it consumes inline). Resolved at call time.
  getDatasource,
  // Inline refs in setup() — DOM container + record-create-popup state:
  gridContainerRef,
  activeCreateColumnField, activeCreateRow, activeCreateRowId,
  // From useCellEditing (S6):
  _lastActiveCellEdit,
}) {
  // Forward declarations so recursive references (setCellValue calling itself,
  // selectRow calling itself, etc.) and inter-method references (createRecord
  // calling setCellValue) all see the bound functions at call time.
  let setCellValue;
  let triggerCellValueChanged;
  let refreshRow;
  let stopCellEditing;
  let createRecord;
  let closeCreateRecordForm;
  let resetFilters;
  let resetSort;
  let deselectAll;
  let selectAll;
  let selectRow;
  let deselectRow;
  let removeRow;
  let applyFocusedRow;

  /**
   * Component action: Set a cell value for a specific row and column
   * @param {string|number} rowId - The ID of the row (must match the idFormula output)
   * @param {string} columnId - The column ID (field name or actionName)
   * @param {any} newValue - The new value to set for the cell
   * @returns {boolean} - Returns true if successful, false otherwise
   */
  setCellValue = async (rowId, columnId, newValue) => {
    // CRITICAL FIX: Wait for grid to be fully ready before performing cell value operations
    // This prevents error #252 when setCellValue is called before grid is ready
    try {
      await waitForGridReady(5000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for setCellValue:", error.message);
      return false;
    }

    if (!gridApi.value) {
      console.warn("[Datagrid] Grid API is not initialized yet");
      return false;
    }

    // Additional check: if grid is currently rendering, defer the call
    if (isGridRendering.value) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await setCellValue(rowId, columnId, newValue);
          resolve(result);
        }, 100);
      });
    }

    if (!rowId || columnId === undefined || columnId === null) {
      console.warn("[Datagrid] setCellValue requires rowId and columnId parameters");
      return false;
    }

    // In grouped mode, locate the row in whichever group grid contains it.
    // Fall back to the primary gridApi for single-grid mode.
    let targetApi = gridApi.value;
    let rowNode = null;
    if (isGroupingActive.value) {
      const found = findGroupForRowId(rowId);
      if (found) {
        targetApi = found.api;
        rowNode = found.node;
      }
    }
    if (!rowNode) {
      rowNode = findRowNode(targetApi, rowId, resolveMappingFormula, props.content);
    }

    if (!rowNode) {
      console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
      // Debug: log available row IDs to help troubleshoot
      if (cfg.value?.enableDebugLogs) {
        const availableIds = getAvailableRowIds(targetApi, resolveMappingFormula, props.content);
        console.log('[Datagrid] Available row IDs:', availableIds);
      }
      return false;
    }

    if (!rowNode.data) {
      console.warn(`[Datagrid] Row node found but has no data`);
      return false;
    }

    // Find the column configuration
    const columnConfig = cfg.value.columns?.find(
      (col) => col?.field === columnId || col?.actionName === columnId
    );

    if (!columnConfig) {
      console.warn(`[Datagrid] Column "${columnId}" not found in column configuration`);
    }

    // Handle user columns - convert user ID(s) to nested structure if many-to-many
    // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
    let valueToSet = newValue;
    const isUserColumn = columnConfig?.cellDataType === 'user';
    if (isUserColumn) {
      const isManyToMany = columnConfig?.isManyToMany === true;
      const userIdFormula = columnConfig?.userIdFormula || { type: 'f', code: 'context.mapping' };
      const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;

      if (isManyToMany && newValue) {
        // Normalize newValue to array for processing
        const userIds = Array.isArray(newValue) ? newValue : [newValue];

        // Convert user ID(s) to nested structure using shared utility
        if (isMultiple) {
          // Multiple users: array of nested structures
          valueToSet = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormula));
        } else {
          // Single user: single nested structure (not array)
          valueToSet = createFakeJunctionRecord(userIds[0], userIdFormula);
        }
      }
      // For non-many-to-many user columns, valueToSet remains as newValue (user ID or array of IDs)
    }

    // Update the data directly
    rowNode.data[columnId] = valueToSet;

    // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
    // Use setTimeout to avoid calling grid API during render phase
    setTimeout(() => {
      if (gridApi.value && !isGridRendering.value) {
        if (props.content?.conditionalRowStyles?.length > 0) {
          // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
          gridApi.value.redrawRows({ rowNodes: [rowNode] });
        } else {
          // Just refresh the specific cell if no conditional styles
          gridApi.value.refreshCells({
            rowNodes: [rowNode],
            columns: [columnId],
            force: true,
          });
        }
      }
    }, 0);

    // Note: We don't trigger the cellValueChanged event here because this is a programmatic
    // update via component action. The event should only fire for user-initiated edits.

    return true;
  };

  triggerCellValueChanged = (rowId, columnId, newValue) => {
    if (!gridApi.value) {
      console.log("Grid API is not initialized yet");
      return;
    }

    // Use unified row lookup utility
    let rowNode = findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);

    if (!rowNode) {
      console.log(`Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
      return;
    }

    if (!rowNode.data) {
      console.log(`Row node found but has no data`);
      return;
    }

    const oldValue = rowNode.data?.[columnId];

    // Find the column configuration to get isDirectUpdate
    const columnConfig = cfg.value.columns.find(
      (col) => col?.field === columnId || col?.actionName === columnId
    );

    if (!columnConfig) {
      console.log(`Column "${columnId}" not found in column configuration`);
    }

    // Update the data directly
    rowNode.data[columnId] = newValue;

    // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
    // Use setTimeout to avoid calling grid API during render phase
    setTimeout(() => {
      if (gridApi.value && !isGridRendering.value) {
        if (props.content?.conditionalRowStyles?.length > 0) {
          // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
          gridApi.value.redrawRows({ rowNodes: [rowNode] });
        } else {
          // Just refresh the specific cell if no conditional styles
          gridApi.value.refreshCells({
            rowNodes: [rowNode],
            columns: [columnId],
            force: true,
          });
        }
      }
    }, 0);

    // Manually trigger the event (bypassing AG Grid's event)
    ctx.emit("trigger-event", {
      name: "cellValueChanged",
      event: {
        oldValue: oldValue,
        newValue: newValue,
        columnId: columnId,
        row: rowNode.data,
        isDirectUpdate: columnConfig?.isDirectUpdate || false,
      },
    });
  };

  // Reconcile the cached supabaseData entry (the object `groupedRowData`
  // partitions on) with a freshly-fetched row, in place. refreshRow's `data`
  // is a NEW object, but the per-group grids render the objects held in
  // supabaseData; without updating that reference a `bumpGroupingDataVersion`
  // re-partition would drop the row back into its old group with stale values.
  // Mirrors setData semantics: remove keys the fresh row no longer has, then
  // copy every fresh field over. Returns the canonical cached object, or null
  // when it isn't found (non-supabase / paged-append modes don't use it).
  const reconcileCachedRow = (rowId, data) => {
    if (!supabaseData || !Array.isArray(supabaseData.value)) return null;
    const canonical = supabaseData.value.find(
      (row) => String(resolveMappingFormula(cfg.value.idFormula, row)) === String(rowId)
    );
    if (!canonical) return null;
    Object.keys(canonical).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(data, key)) delete canonical[key];
    });
    Object.assign(canonical, data);
    return canonical;
  };

  // Move a row between per-group grids after an external update changed its
  // grouping-column value. Called from refreshRow. Mirrors the cross-group
  // logic in useCellEditing.onCellValueChanged (mounted-dest) and
  // useGrouping.handleCrossGroupDrop (collapsed-dest), adapted for a
  // freshly-fetched row object.
  const moveRowBetweenGroups = (rowId, data, sourceKey, destKey, sourceApi) => {
    const destApi = groupGridApis.value?.get(destKey);

    if (isInfiniteScrollEnabled?.value) {
      // Paged-append: per-group state (matched by stable row id) is the source
      // of truth. Remove from source, add to a mounted dest, and keep badge
      // counts optimistically correct for a collapsed dest.
      try { sourceApi.applyTransaction({ remove: [data] }); }
      catch (e) { debugLog(`[Datagrid] refreshRow source remove failed for "${sourceKey}":`, e?.message); }
      try { getRemoveRowFromGroupState?.()?.(sourceKey, data); } catch (_) { /* noop */ }

      if (destApi && destApi !== sourceApi) {
        try { getAddRowToGroupState?.()?.(destKey, data); } catch (_) { /* noop */ }
        try { destApi.applyTransaction({ add: [data], addIndex: 0 }); }
        catch (e) { debugLog(`[Datagrid] refreshRow dest add failed for "${destKey}":`, e?.message); }
      } else if (!destApi) {
        // Dest collapsed — DON'T addRowToGroupState (it sets loaded:true, which
        // would make the next expand skip the server fetch and show only this
        // one optimistic row). Bump the badge count; the expand below mounts
        // the grid and fetches fresh from the server (already includes the
        // externally-updated row).
        const counts = new Map(groupInfiniteCounts.value);
        const cur = counts.get(destKey);
        counts.set(destKey, (typeof cur === 'number' ? cur : 0) + 1);
        groupInfiniteCounts.value = counts;
        try { getStampGroupMutation?.()?.(destKey); } catch (_) { /* noop */ }
      }

      // Refresh counts from the server once the caller's write has had time to
      // land (matches the 1.5s delay the cell-edit / drag paths use).
      setTimeout(() => {
        try { getScheduleRefreshGroupCounts?.()?.(); } catch (_) { /* noop */ }
      }, 1500);
    } else {
      // Non-paged (supabase client-side): reconcile the cached object the grids
      // partition on, re-partition, then push the row into a mounted dest grid.
      const canonical = reconcileCachedRow(rowId, data) || data;
      try { sourceApi.applyTransaction({ remove: [canonical] }); }
      catch (e) { debugLog(`[Datagrid] refreshRow source remove failed for "${sourceKey}":`, e?.message); }
      try { bumpGroupingDataVersion?.(); } catch (_) { /* noop */ }

      if (destApi && destApi !== sourceApi) {
        try { destApi.applyTransaction({ add: [canonical], addIndex: 0 }); }
        catch (e) { debugLog(`[Datagrid] refreshRow dest add failed for "${destKey}":`, e?.message); }
        try {
          const destNode = destApi.getRowNode(String(rowId));
          if (destNode) destApi.refreshCells({ rowNodes: [destNode], force: true });
        } catch (_) { /* noop */ }
      }
      // Collapsed dest (no destApi): the re-partition already put the row in
      // its data; expandGroup below mounts the grid, which renders it.
    }

    // Reveal the destination if it was collapsed so the user sees where the
    // row landed (no-op when already expanded).
    try { expandGroup?.(destKey); } catch (_) { /* noop */ }
  };

  /**
   * Component action: Refresh a specific row from Supabase
   * @param {string|number} rowId - The ID of the row to refresh
   * @param {Object} [options]
   * @param {boolean} [options.addIfMissing=true] - When the row isn't in this
   *   grid: if true, fetch it from the DB and insert it (default, per-instance
   *   "Refresh row" action behaviour); if false, skip this grid entirely
   *   (used by the page-wide row-refresh bus so a broadcast only refreshes
   *   grids that already hold the row and never inserts it into unrelated grids).
   * @returns {Promise<boolean>} - Returns true if successful, false otherwise
   */
  refreshRow = async (rowId, options = {}) => {
    const { addIfMissing = true } = options;
    // CRITICAL FIX: Wait for grid to be fully ready before performing refresh operations
    // This prevents error #252 when refreshRow is called before grid is ready
    try {
      await waitForGridReady(5000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for refreshRow:", error.message);
      return false;
    }

    if (!gridApi.value) {
      console.warn("[Datagrid] Grid API is not initialized yet");
      return false;
    }

    // Additional check: if grid is currently rendering, defer the call
    if (isGridRendering.value) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await refreshRow(rowId, options);
          resolve(result);
        }, 100);
      });
    }

    if (props.content?.dataSource !== 'supabase') {
      console.warn("[Datagrid] refreshRow only works with Supabase data source");
      return false;
    }

    if (rowId === null || rowId === undefined) {
      console.warn("[Datagrid] refreshRow requires a rowId parameter");
      return false;
    }

    // Broadcast row-refresh (addIfMissing=false): bail before any Supabase fetch
    // unless this grid already contains the row, so grids that don't own it
    // neither query for it nor get it inserted.
    if (!addIfMissing) {
      let exists = false;
      if (isGroupingActive.value) {
        exists = !!findGroupForRowId(rowId);
      }
      if (!exists) {
        exists = !!findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);
      }
      if (!exists) {
        debugLog(`[Datagrid] Row ${rowId} not in this grid; skipping refresh (addIfMissing=false)`);
        return false;
      }
    }

    // Extract primary key field from idFormula
    // Formula format: "context.mapping?.['id']" or "context.mapping?.id"
    const idFormula = props.content?.idFormula;
    let primaryKeyField = 'id'; // default

    if (idFormula?.code) {
      // Match patterns like: mapping?.['fieldName'] or mapping?.fieldName or mapping.fieldName
      const match = idFormula.code.match(/mapping\??\.\[?['"]?(\w+)['"]?\]?/);
      if (match && match[1]) {
        primaryKeyField = match[1];
      }
    }

    try {
      // Wait for Supabase instance to become available (with retry logic)
      const supabase = await waitForSupabaseInstance(10000, 100);
      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!supabase) {
        console.warn("[Datagrid] Supabase instance not available after waiting");
        return false;
      }

      if (!tableName) {
        console.warn("[Datagrid] Supabase table name is required");
        return false;
      }

      // Fetch the single row
      const { data, error } = await supabase
        .from(tableName)
        .select(queryString)
        .eq(primaryKeyField, rowId)
        .single();

      if (error) throw error;
      if (!data) {
        console.warn(`[Datagrid] Row with ${primaryKeyField}="${rowId}" not found`);
        return false;
      }

      // In grouped mode, locate the row in whichever group grid contains it.
      // Fall back to the primary gridApi for single-grid mode.
      let targetApi = gridApi.value;
      let rowNode = null;
      // Hoisted so the cross-group-move check below can read found.groupValue
      // (the source group key) after the row has been located.
      let found = null;
      if (isGroupingActive.value) {
        found = findGroupForRowId(rowId);
        if (found) {
          targetApi = found.api;
          rowNode = found.node;
        }
      }
      if (!rowNode) {
        rowNode = findRowNode(targetApi, rowId, resolveMappingFormula, props.content);
      }

      if (rowNode) {
        // Cross-group move: in grouped mode each group is a separate grid. If
        // the externally-updated row now belongs to a different group than the
        // one it currently sits in, refreshing its data in place would leave it
        // stranded in the old group (values update, but the row never moves).
        // Physically move it between the per-group grids instead. Guarded on
        // `found` (row located via findGroupForRowId) so we know the source key.
        if (isGroupingActive.value && found) {
          const groupColId = groupingState.value?.columnId;
          if (groupColId) {
            const normalizeGroupKey = (v) =>
              (v === null || v === undefined || v === '' ? UNASSIGNED_GROUP : String(v));
            const sourceKey = found.groupValue;
            const destKey = normalizeGroupKey(data?.[groupColId]);
            if (String(destKey) !== String(sourceKey)) {
              moveRowBetweenGroups(rowId, data, sourceKey, destKey, targetApi);
              debugLog(`[Datagrid] Row ${rowId} refreshed and moved from group "${sourceKey}" to "${destKey}"`);
              return true;
            }
          }
        }

        const getColumnId = (column) => {
          if (!column) return null;
          if (typeof column.getColId === 'function') return column.getColId();
          return column.colId || column.field || null;
        };
        const editingCells = typeof targetApi?.getEditingCells === 'function'
          ? targetApi.getEditingCells()
          : [];
        const hasActiveEditor = editingCells.length > 0;
        const rowPinned = rowNode.rowPinned ?? null;
        const editingColumnIds = new Set(
          editingCells
            .filter((cell) => (
              cell?.rowIndex === rowNode.rowIndex &&
              (cell?.rowPinned ?? null) === rowPinned
            ))
            .map((cell) => getColumnId(cell?.column))
            .filter(Boolean)
        );
        const isRowBeingEdited = editingColumnIds.size > 0;
        const formatEditingCells = (cells) => cells.map((cell) => ({
          rowIndex: cell?.rowIndex,
          rowPinned: cell?.rowPinned ?? null,
          colId: getColumnId(cell?.column),
        }));
        const shouldPreserveEditState = hasActiveEditor;

        console.log('[Datagrid refreshRow] row found', {
          rowId,
          rowNodeId: rowNode.id,
          rowIndex: rowNode.rowIndex,
          rowPinned,
          hasGetEditingCells: typeof targetApi?.getEditingCells === 'function',
          editingCells: formatEditingCells(editingCells),
          hasActiveEditor,
          isRowBeingEdited,
          editingColumnIds: Array.from(editingColumnIds),
          lastActiveCellEdit: _lastActiveCellEdit?.value,
          willUseInPlaceUpdate: shouldPreserveEditState && !!rowNode.data,
        });

        if (shouldPreserveEditState && rowNode.data) {
          // Preserve active editors by avoiding row replacement while any
          // edit is open. If this row is edited, leave that column untouched.
          Object.keys(rowNode.data).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(data, key) && !editingColumnIds.has(key)) {
              delete rowNode.data[key];
            }
          });
          Object.keys(data).forEach((key) => {
            if (!editingColumnIds.has(key)) {
              rowNode.data[key] = data[key];
            }
          });
        } else {
          // Update the row data
          console.log('[Datagrid refreshRow] using rowNode.setData', {
            rowId,
            reason: shouldPreserveEditState ? 'missing rowNode.data' : 'no active editor',
          });
          rowNode.setData(data);
        }

        // CRITICAL FIX: Wrap refresh in setTimeout to prevent error #252
        // This ensures the API call happens outside the current render cycle
        setTimeout(() => {
          if (targetApi && !isGridRendering.value) {
            const editingCellsNow = typeof targetApi?.getEditingCells === 'function'
              ? targetApi.getEditingCells()
              : [];
            console.log('[Datagrid refreshRow] deferred refresh', {
              rowId,
              editingCellsAtRefresh: formatEditingCells(editingCellsNow),
              initialHasActiveEditor: hasActiveEditor,
              initialIsRowBeingEdited: isRowBeingEdited,
              hasConditionalRowStyles: props.content?.conditionalRowStyles?.length > 0,
            });
            if (shouldPreserveEditState) {
              const refreshColumns = Object.keys(data).filter((key) => !editingColumnIds.has(key));
              console.log('[Datagrid refreshRow] refreshCells while preserving edit state', {
                rowId,
                refreshColumns,
                skippedEditingColumns: Array.from(editingColumnIds),
              });
              if (refreshColumns.length > 0) {
                targetApi.refreshCells({
                  rowNodes: [rowNode],
                  columns: refreshColumns,
                  force: true,
                });
              }
            } else if (props.content?.conditionalRowStyles?.length > 0) {
              // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
              console.log('[Datagrid refreshRow] redrawRows with no active editor', { rowId });
              targetApi.redrawRows({ rowNodes: [rowNode] });
            } else {
              // Just refresh cells if no conditional styles
              console.log('[Datagrid refreshRow] refreshCells with no active editor', { rowId });
              targetApi.refreshCells({
                rowNodes: [rowNode],
                force: true,
              });
            }
          }
        }, 0);

        debugLog(`[Datagrid] Row ${rowId} refreshed successfully`);
        return true;
      } else {
        if (!addIfMissing) {
          debugLog(`[Datagrid] Row ${rowId} no longer in this grid; skipping add (addIfMissing=false)`);
          return false;
        }
        // Row not found in grid but was fetched from DB - add it to the grid
        debugLog(`[Datagrid] Row with id "${rowId}" not found in grid, adding it from database`);

        // CRITICAL: Set flag to prevent watchers from triggering a full grid re-render
        // When we update supabaseDataRef, the rowData computed will change, which would
        // normally cause AG Grid to see a new array reference and re-render everything.
        // By setting this flag, the watch on rowData.value will skip processing.
        setUpdatingDataLocally(true);
        debugLog('[Datagrid refreshRow] Setting isUpdatingDataLocally flag to TRUE');

        // Helper to safely check if something is a ref object (has .value property as object)
        const isRefObject = (val) => {
          return val !== null && typeof val === 'object' && 'value' in val;
        };

        // Helper to safely get ref values (handles both ref objects and unwrapped values)
        const getRefValue = (refOrValue) => {
          if (isRef(refOrValue)) return refOrValue.value;
          if (isRefObject(refOrValue)) return refOrValue.value;
          return refOrValue;
        };

        // Helper to safely set ref values
        const setRefValue = (refOrValue, newValue) => {
          if (isRef(refOrValue)) {
            refOrValue.value = newValue;
            return true;
          }
          if (isRefObject(refOrValue)) {
            refOrValue.value = newValue;
            return true;
          }
          // If it's already unwrapped (primitive), we can't set it directly
          return false;
        };

        try {
          // Unified path for paged-append and full client-side: insert via
          // applyTransaction. With paged-append, the row stays in the grid
          // even though it's outside the loaded window; supabaseTotalCount
          // is incremented so the load-more gate still works correctly.
          gridApi.value.applyTransaction({ add: [data], addIndex: 0 });
          debugLog(`[Datagrid] Row ${rowId} added to grid using applyTransaction`);

          // Update the cached data to keep it in sync (used by non-infinite
          // mode's rowData computed; harmless to update in paged-append mode).
          // The isUpdatingDataLocally flag prevents the rowData watch from
          // causing a re-render.
          const supabaseDataRefValue = supabaseData;
          if (supabaseDataRefValue) {
            const currentDataValue = getRefValue(supabaseDataRefValue);
            if (Array.isArray(currentDataValue)) {
              const newData = [...currentDataValue];
              newData.unshift(data);
              if (!setRefValue(supabaseDataRefValue, newData)) {
                if (Array.isArray(supabaseDataRefValue)) {
                  supabaseDataRefValue.unshift(data);
                }
              }
              debugLog(`[Datagrid] Updated cached data, now ${newData.length} rows`);
            }
          }

          if (supabaseTotalCount) {
            const currentCount = getRefValue(supabaseTotalCount) || 0;
            setRefValue(supabaseTotalCount, currentCount + 1);
            debugLog(`[Datagrid] Incremented total count to ${currentCount + 1}`);
          }

          // Wait for the row to appear in the grid before returning so
          // subsequent actions can find it (parity with the previous
          // infinite-mode behavior).
          try {
            await waitForRowInGridLocal(rowId, 5000);
            debugLog(`[Datagrid] Row ${rowId} is now present in the grid`);
          } catch (error) {
            console.warn(`[Datagrid] Row ${rowId} may not have appeared in grid:`, error.message);
          }

          debugLog(`[Datagrid] Row ${rowId} added successfully from database`);
          return true;
        } finally {
          // Clear the flag after a delay to allow any pending watchers to be skipped
          // Use nextTick + setTimeout to ensure all Vue reactivity has settled
          nextTick(() => {
            setTimeout(() => {
              setUpdatingDataLocally(false);
              debugLog('[Datagrid refreshRow] Clearing isUpdatingDataLocally flag');
            }, 200);
          });
        }
      }
    } catch (error) {
      console.error('[Datagrid] Error refreshing row:', error);
      return false;
    }
  };

  stopCellEditing = async (cancel = false) => {
    // Wait for grid to be ready
    try {
      await waitForGridReady(2000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for stopCellEditing");
      return;
    }
    if (!gridApi.value) return;
    // Defer to avoid error #252
    setTimeout(() => {
      if (gridApi.value) gridApi.value.stopEditing(cancel);
    }, 0);
  };

  createRecord = async (columnId, rowId, data) => {
    const col = cfg.value?.columns?.find(c => c.field === columnId);
    if (!col || col.cellDataType !== 'record') {
      console.warn(`[Datagrid] createRecord: column "${columnId}" not found or not a record column`);
      return;
    }
    if (!col.recordTable) {
      console.warn(`[Datagrid] createRecord: column "${columnId}" has no recordTable configured`);
      return;
    }

    const supabase = wwLib.wwPlugins?.supabase?.instance;
    if (!supabase) {
      console.warn('[Datagrid] createRecord: Supabase plugin is not available');
      return;
    }

    const { data: newRecord, error } = await supabase
      .from(col.recordTable)
      .insert(data)
      .select()
      .single();

    if (error || !newRecord) {
      console.warn('[Datagrid] createRecord: insert failed', error);
      return;
    }

    const valueField = col.recordValueField || 'id';
    await setCellValue(rowId, columnId, newRecord[valueField]);

    if (activeCreateColumnField.value === columnId) {
      activeCreateColumnField.value = null;
      activeCreateRow.value = null;
      activeCreateRowId.value = null;
    }

    ctx.emit('trigger-event', {
      name: 'onRecordCreated',
      event: { record: newRecord, columnId, rowId: String(rowId) },
    });
  };

  closeCreateRecordForm = () => {
    activeCreateColumnField.value = null;
    activeCreateRow.value = null;
    activeCreateRowId.value = null;
  };

  resetFilters = async () => {
    // Wait for grid to be ready
    try {
      await waitForGridReady(2000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for resetFilters");
      return;
    }
    if (!gridApi.value) return;
    // Defer to avoid error #252
    setTimeout(() => {
      if (isGroupingActive.value && groupGridApis.value && groupGridApis.value.size > 0) {
        groupGridApis.value.forEach((api) => {
          try { api.setFilterModel(null); } catch (e) { /* noop */ }
        });
      } else if (gridApi.value) {
        gridApi.value.setFilterModel(null);
      }
    }, 0);
  };

  resetSort = async () => {
    // Wait for grid to be ready
    try {
      await waitForGridReady(2000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for resetSort");
      return;
    }
    if (!gridApi.value) return;
    // Defer to avoid error #252
    setTimeout(() => {
      const applyReset = (api) => {
        try {
          api.applyColumnState({
            state: [],
            defaultState: { sort: null },
          });
        } catch (e) { /* noop */ }
      };
      if (isGroupingActive.value && groupGridApis.value && groupGridApis.value.size > 0) {
        groupGridApis.value.forEach(applyReset);
      } else if (gridApi.value) {
        applyReset(gridApi.value);
      }
    }, 0);
  };

  deselectAll = async () => {
    // Wait for grid to be ready
    try {
      await waitForGridReady(2000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for deselectAll");
      return;
    }
    if (!gridApi.value) return;
    // Defer to avoid error #252
    setTimeout(() => {
      if (isGroupingActive.value && groupGridApis.value && groupGridApis.value.size > 0) {
        groupGridApis.value.forEach((api) => {
          try { api.deselectAll(); } catch (e) { /* noop */ }
        });
      } else if (gridApi.value) {
        gridApi.value.deselectAll();
      }
    }, 0);
  };

  selectAll = async (mode) => {
    // Wait for grid to be ready
    try {
      await waitForGridReady(2000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for selectAll");
      return;
    }
    if (!gridApi.value) return;
    if (cfg.value.rowSelection !== "multiple") {
      wwLib.logStore.warning(
        "Select all will have no effect, as row selection is not set to multiple"
      );
      return;
    }
    const selectMode = mode || cfg.value.selectAll || "all";
    // Defer to avoid error #252
    setTimeout(() => {
      if (isGroupingActive.value && groupGridApis.value && groupGridApis.value.size > 0) {
        groupGridApis.value.forEach((api) => {
          try { api.selectAll(selectMode); } catch (e) { /* noop */ }
        });
      } else if (gridApi.value) {
        gridApi.value.selectAll(selectMode);
      }
    }, 0);
  };

  selectRow = async (rowId) => {
    // CRITICAL FIX: Wait for grid to be fully ready before performing selection
    try {
      await waitForGridReady(5000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for selectRow:", error.message);
      return;
    }

    if (!gridApi.value) return;

    // Additional check: if grid is currently rendering, defer the call
    if (isGridRendering.value) {
      setTimeout(() => selectRow(rowId), 100);
      return;
    }

    // In grouped mode, locate the row in whichever group grid contains it.
    let rowNode = null;
    if (isGroupingActive.value) {
      const found = findGroupForRowId(rowId);
      if (found) {
        rowNode = found.node;
      }
    }
    if (!rowNode) {
      rowNode = findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);
    }

    if (rowNode) {
      rowNode.setSelected(true);
    }
  };

  deselectRow = async (rowId) => {
    // CRITICAL FIX: Wait for grid to be fully ready before performing deselection
    try {
      await waitForGridReady(5000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for deselectRow:", error.message);
      return;
    }

    if (!gridApi.value) return;

    // Additional check: if grid is currently rendering, defer the call
    if (isGridRendering.value) {
      setTimeout(() => deselectRow(rowId), 100);
      return;
    }

    // In grouped mode, locate the row in whichever group grid contains it.
    let rowNode = null;
    if (isGroupingActive.value) {
      const found = findGroupForRowId(rowId);
      if (found) {
        rowNode = found.node;
      }
    }
    if (!rowNode) {
      rowNode = findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);
    }

    if (rowNode) {
      rowNode.setSelected(false);
    }
  };

  removeRow = async (rowId) => {
    // CRITICAL FIX: Wait for grid to be fully ready before performing remove operations
    // This prevents error #252 when removeRow is called before grid is ready
    try {
      await waitForGridReady(5000);
    } catch (error) {
      console.warn("[Datagrid] Grid not ready for removeRow:", error.message);
      return false;
    }

    if (!gridApi.value) {
      console.warn("[Datagrid] Grid API is not initialized yet");
      return false;
    }

    // Additional check: if grid is currently rendering, defer the call
    if (isGridRendering.value) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await removeRow(rowId);
          resolve(result);
        }, 100);
      });
    }

    if (rowId === null || rowId === undefined) {
      console.warn("[Datagrid] removeRow requires a rowId parameter");
      return false;
    }

    // In grouped mode, locate the row in whichever group grid contains it.
    // Fall back to the primary gridApi for single-grid mode.
    let targetApi = gridApi.value;
    let rowNode = null;
    if (isGroupingActive.value) {
      const found = findGroupForRowId(rowId);
      if (found) {
        targetApi = found.api;
        rowNode = found.node;
      }
    }
    if (!rowNode) {
      rowNode = findRowNode(targetApi, rowId, resolveMappingFormula, props.content);
    }

    if (!rowNode) {
      console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid`);
      return false;
    }

    // Set flag to prevent re-fetching during local update
    // This prevents watchers from triggering data fetches when we remove a row
    // CRITICAL: Set flag BEFORE any operations to prevent any watchers from firing
    setUpdatingDataLocally(true);
    debugLog('[Remove Row] Setting isUpdatingDataLocally flag to TRUE');

    // Remove the row from the grid
    try {
      // Unified path for paged-append and full client-side: applyTransaction
      // removes the row immediately. We also keep supabaseData / totalCount
      // in sync so the load-more gate and pagination footer stay accurate.
      gridApi.value.applyTransaction({ remove: [rowNode.data] });
      debugLog(`[Datagrid] Row ${rowId} removed successfully`);

      if (supabaseData && Array.isArray(supabaseData.value)) {
        const filtered = supabaseData.value.filter(row => {
          const rowIdFromData = resolveMappingFormula(cfg.value.idFormula, row);
          return String(rowIdFromData) !== String(rowId);
        });
        if (filtered.length !== supabaseData.value.length) {
          supabaseData.value = filtered;
        }
      }
      if (supabaseTotalCount && supabaseTotalCount.value > 0) {
        supabaseTotalCount.value = supabaseTotalCount.value - 1;
      }

      setTimeout(() => {
        setUpdatingDataLocally(false);
        debugLog('[Remove Row] Clearing isUpdatingDataLocally flag');
      }, 200);

      return true;
    } catch (error) {
      console.error('[Datagrid] Error removing row:', error);
      // Clear flag on error immediately
      setUpdatingDataLocally(false);
      debugLog('[Remove Row] Error occurred, clearing isUpdatingDataLocally flag');
      return false;
    }
  };

  /**
   * Apply focus to the row specified by focusedRowId property.
   * This method is called when the grid renders data to ensure the focused row
   * is always visible and styled correctly.
   * @param {boolean} scrollToRow - Whether to scroll the row into view (default: false for re-renders)
   */
  applyFocusedRow = async (scrollToRow = false) => {
    const focusedRowId = cfg.value?.focusedRowId;

    // If no focused row ID is set, clear any existing focus styling
    if (focusedRowId === null || focusedRowId === undefined || focusedRowId === '') {
      // Clear any custom action focus class from all cells
      if (gridContainerRef.value) {
        const focusedCells = gridContainerRef.value.querySelectorAll('.ag-cell-action-focus');
        focusedCells.forEach(cell => cell.classList.remove('ag-cell-action-focus'));
      }
      return;
    }

    // Ensure grid is ready
    if (!gridApi.value || isGridRendering.value) {
      return;
    }

    // Resolve the row AND the grid api that owns it. In grouped mode each group
    // is a separate ag-grid with its own row model; the focused row may live in
    // any of them, so scroll / focus / redraw must run against that grid's api
    // — not the primary `gridApi` (which only holds one group's rows). Using
    // the primary api is why focus styling landed on the wrong grid or not at
    // all when grouping was active.
    let targetApi = gridApi.value;
    let rowNode = null;
    if (isGroupingActive.value) {
      const found = findGroupForRowId(focusedRowId);
      if (found) {
        targetApi = found.api;
        rowNode = found.node;
      }
    } else {
      rowNode = findRowNode(gridApi.value, focusedRowId, resolveMappingFormula, props.content);
    }

    // If row not found, it might be filtered out or not loaded yet (infinite scroll)
    if (!rowNode || !rowNode.data) {
      debugLog('[applyFocusedRow] Row not found:', focusedRowId);
      return;
    }

    // If scrollToRow is true, scroll the row into view and set cell focus
    if (scrollToRow) {
      const rowIndex = rowNode.rowIndex;
      if (rowIndex !== null && rowIndex !== undefined) {
        // Scroll to center the row
        targetApi.ensureIndexVisible(rowIndex, 'middle');

        // Set focus on the first column
        nextTick(() => {
          if (!targetApi) return;

          const allColumns = targetApi.getAllGridColumns();
          if (allColumns && allColumns.length > 0) {
            const firstColumnId = allColumns[0].getColId();

            setTimeout(() => {
              if (targetApi) {
                targetApi.setFocusedCell(rowIndex, firstColumnId);

                // Add custom action focus class
                nextTick(() => {
                  if (gridContainerRef.value) {
                    const focusedCell = gridContainerRef.value.querySelector('.ag-cell-focus');
                    if (focusedCell) {
                      focusedCell.classList.add('ag-cell-action-focus');
                    }
                  }
                });
              }
            }, 100);
          }
        });
      }
    }

    // Redraw the row to ensure styles are applied (rowStyle will check focusedRowId)
    if (rowNode) {
      targetApi.redrawRows({ rowNodes: [rowNode] });
    }
  };

  return {
    setCellValue,
    triggerCellValueChanged,
    refreshRow,
    stopCellEditing,
    createRecord,
    closeCreateRecordForm,
    resetFilters,
    resetSort,
    deselectAll,
    selectAll,
    selectRow,
    deselectRow,
    removeRow,
    applyFocusedRow,
  };
}
