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
  // From useDataFetch (S2):
  removedRowIds, cleanupRemovedIds, setUpdatingDataLocally,
  supabaseData, supabaseTotalCount,
  waitForSupabaseInstance,
  // From useInfiniteScroll (S2):
  datasource,
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

  /**
   * Component action: Refresh a specific row from Supabase
   * @param {string|number} rowId - The ID of the row to refresh
   * @returns {Promise<boolean>} - Returns true if successful, false otherwise
   */
  refreshRow = async (rowId) => {
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
          const result = await refreshRow(rowId);
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

      if (rowNode) {
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
        // Row not found in grid but was fetched from DB - add it to the grid
        debugLog(`[Datagrid] Row with id "${rowId}" not found in grid, adding it from database`);

        const isInfiniteScroll = cfg.value?.enableInfiniteScroll === true;

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
          if (isInfiniteScroll) {
            // For infinite scroll mode when ADDING a new row:
            // CRITICAL FIX: We cannot use the cached data approach because supabaseData
            // only contains the current block, not all rows. If we return cached data,
            // AG Grid will think that's all the data and replace existing rows.
            //
            // Instead, we need to:
            // 1. Clear the isUpdatingDataLocally flag so getRows fetches fresh data
            // 2. Purge the cache and refresh - this will trigger a fresh fetch from Supabase
            //    which will include the newly added row
            // 3. Wait for the row to appear in the grid before returning

            debugLog('[Datagrid] Infinite scroll mode: clearing flag to fetch fresh data with new row');

            // Clear the flag BEFORE refreshing so getRows will fetch from Supabase
            setUpdatingDataLocally(false);

            // Purge and refresh the infinite cache
            // With flag cleared, this will fetch fresh data from Supabase including the new row
            return new Promise((resolve) => {
              setTimeout(async () => {
                if (gridApi.value) {
                  gridApi.value.purgeInfiniteCache();
                  debugLog('[Datagrid] Purged infinite cache to reload data with new row');

                  // Refresh the datasource to trigger fresh data fetch
                  const currentDatasource = datasource.value;
                  if (currentDatasource) {
                    gridApi.value.setGridOption('datasource', currentDatasource);
                    debugLog('[Datagrid] Refreshed datasource - will fetch fresh data from Supabase');
                  }

                  // CRITICAL: Wait for the row to appear in the grid before resolving
                  // This ensures subsequent actions can find the row
                  try {
                    await waitForRowInGridLocal(rowId, 10000);
                    debugLog(`[Datagrid] Row ${rowId} is now present in the grid`);
                    resolve(true);
                  } catch (error) {
                    console.warn(`[Datagrid] Row ${rowId} may not have appeared in grid:`, error.message);
                    // Still resolve true as the row was fetched and cache was refreshed
                    resolve(true);
                  }
                } else {
                  resolve(false);
                }
              }, 0);
            });
          } else {
            // For regular mode (non-infinite scroll), use applyTransaction to add the row
            // This is the most efficient way as it only updates the affected rows in the grid
            gridApi.value.applyTransaction({ add: [data], addIndex: 0 });
            debugLog(`[Datagrid] Row ${rowId} added to grid using applyTransaction`);

            // Update the cached data to keep it in sync
            // The isUpdatingDataLocally flag prevents the rowData watch from causing a re-render
            const supabaseDataRefValue = supabaseData;
            if (supabaseDataRefValue) {
              const currentDataValue = getRefValue(supabaseDataRefValue);
              if (Array.isArray(currentDataValue)) {
                const newData = [...currentDataValue];
                newData.unshift(data);
                if (!setRefValue(supabaseDataRefValue, newData)) {
                  // If we couldn't set through ref, try to modify array in place
                  if (Array.isArray(supabaseDataRefValue)) {
                    supabaseDataRefValue.unshift(data);
                  }
                }
                debugLog(`[Datagrid] Updated cached data, now ${newData.length} rows`);
              }
            }

            // Increment total count if available
            if (supabaseTotalCount) {
              const currentCount = getRefValue(supabaseTotalCount) || 0;
              setRefValue(supabaseTotalCount, currentCount + 1);
              debugLog(`[Datagrid] Incremented total count to ${currentCount + 1}`);
            }
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
      const isInfiniteScroll = cfg.value?.dataSource === 'supabase' && cfg.value?.enableInfiniteScroll === true;

      if (isInfiniteScroll) {
        // For infinite scroll mode, applyTransaction doesn't work properly
        // We need to:
        // 1. Store the rowId to filter out when datasource returns cached data
        // 2. Remove from cached supabaseData
        // 3. Decrement total count
        // 4. Purge cache and refresh datasource
        // 5. The datasource's getRows will filter out the removed row when returning cached data

        // Store the removed row ID so datasource can filter it out
        // Access the removedRowIds ref from setup
        if (removedRowIds) {
          removedRowIds.add(String(rowId));
          debugLog(`[Remove Row] Added row ${rowId} to removedRowIds set (size: ${removedRowIds.size})`);

          // Periodic cleanup to prevent unbounded growth
          cleanupRemovedIds();
        } else {
          debugLog(`[Remove Row] Warning: removedRowIds not available`);
        }

        // Remove from cached data
        if (supabaseData && Array.isArray(supabaseData.value)) {
          const currentData = [...supabaseData.value];
          const filteredData = currentData.filter(row => {
            const rowIdFromData = resolveMappingFormula(cfg.value.idFormula, row);
            return String(rowIdFromData) !== String(rowId);
          });

          // Update cached data
          supabaseData.value = filteredData;
          debugLog(`[Remove Row] Removed from cached data, ${filteredData.length} rows remaining`);
        }

        // Decrement total count
        if (supabaseTotalCount && supabaseTotalCount.value > 0) {
          supabaseTotalCount.value = supabaseTotalCount.value - 1;
          debugLog(`[Remove Row] Decremented total count to ${supabaseTotalCount.value}`);
        }

        // For infinite scroll mode, we need to remove the row from the view
        // Since applyTransaction doesn't work reliably, we'll:
        // 1. Try to hide/remove the node directly from the DOM
        // 2. Purge and refresh the cache to rebuild without the row

        // First, try to remove the row node from the DOM directly
        try {
          // Get the row element from the DOM
          const rowElement = gridContainerRef.value?.querySelector(`[row-id="${rowNode.id}"]`);
          if (rowElement) {
            // Hide the row by setting display to none
            rowElement.style.display = 'none';
            debugLog('[Remove Row] Hid row element from DOM');
          } else {
            // Try alternative selector patterns
            const allRows = gridContainerRef.value?.querySelectorAll('.ag-row');
            if (allRows) {
              allRows.forEach((rowEl, index) => {
                const rowNodeFromGrid = gridApi.value.getDisplayedRowAtIndex(index);
                if (rowNodeFromGrid && rowNodeFromGrid.id === rowNode.id) {
                  rowEl.style.display = 'none';
                  debugLog('[Remove Row] Hid row element using index lookup');
                }
              });
            }
          }
        } catch (e) {
          debugLog('[Remove Row] Could not hide row from DOM:', e.message);
        }

        // Purge the entire infinite cache - this clears all cached blocks
        gridApi.value.purgeInfiniteCache();
        debugLog('[Remove Row] Purged infinite cache');

        // Refresh the datasource - this will trigger getRows calls for visible blocks
        // Our flag prevents actual fetching, and getRows will return filtered cached data
        const currentDatasource = datasource.value;
        if (currentDatasource) {
          // Reset the datasource to force AG Grid to re-fetch visible blocks
          gridApi.value.setGridOption('datasource', currentDatasource);
          debugLog('[Remove Row] Refreshed datasource (getRows will return filtered data)');

          // After a short delay, refresh the infinite cache to rebuild the view
          setTimeout(() => {
            try {
              // refreshInfiniteCache will rebuild the view from the datasource
              // Since our flag is set, getRows will return filtered cached data
              gridApi.value.refreshInfiniteCache();
              debugLog('[Remove Row] Refreshed infinite cache - view should update with filtered data');
            } catch (e) {
              debugLog('[Remove Row] refreshInfiniteCache not available, trying alternative:', e.message);
              // Fallback: try to refresh cells
              try {
                gridApi.value.refreshCells({ force: true });
                debugLog('[Remove Row] Fallback: refreshed cells');
              } catch (e2) {
                debugLog('[Remove Row] Could not refresh cells either');
              }
            }
          }, 200);
        } else {
          debugLog('[Remove Row] Datasource not available, skipping refresh');
        }

        debugLog(`[Datagrid] Row ${rowId} removed successfully from infinite scroll grid`);
      } else {
        // For regular mode, use standard applyTransaction
        gridApi.value.applyTransaction({ remove: [rowNode.data] });
        debugLog(`[Datagrid] Row ${rowId} removed successfully`);
      }

      // Clear the flag after a delay to allow transaction to complete
      // and prevent any watchers from triggering re-fetches
      // Use a longer delay for infinite scroll mode to ensure datasource doesn't refresh
      const delay = isInfiniteScroll ? 500 : 200;
      setTimeout(() => {
        setUpdatingDataLocally(false);
        // For infinite scroll, keep removedRowIds for a bit longer to ensure all datasource calls are filtered
        // Then clear it after an additional delay
        if (isInfiniteScroll && removedRowIds) {
          setTimeout(() => {
            // Don't clear removedRowIds - we want to keep filtering this row out permanently
            // until the next real data fetch (which will naturally exclude it if it's deleted from DB)
            debugLog(`[Remove Row] Keeping removedRowIds (size: ${removedRowIds.size}) for future filtering`);
          }, 100);
        }
        debugLog('[Remove Row] Clearing isUpdatingDataLocally flag');
      }, delay);

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

    // Use unified row lookup utility
    let rowNode = findRowNode(gridApi.value, focusedRowId, resolveMappingFormula, props.content);

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
        gridApi.value.ensureIndexVisible(rowIndex, 'middle');

        // Set focus on the first column
        nextTick(() => {
          if (!gridApi.value) return;

          const allColumns = gridApi.value.getAllGridColumns();
          if (allColumns && allColumns.length > 0) {
            const firstColumnId = allColumns[0].getColId();

            setTimeout(() => {
              if (gridApi.value) {
                gridApi.value.setFocusedCell(rowIndex, firstColumnId);

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
      gridApi.value.redrawRows({ rowNodes: [rowNode] });
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
