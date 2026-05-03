import { ref, computed, nextTick } from 'vue';
import {
  createValidationFunction,
  createActionColumnDef,
  createCustomColumnDef,
  createDateColumnDef,
  createCurrencyColumnDef,
  createImageColumnDef,
  createValueSetter,
  createSelectLabelGetter,
  createUserNameGetter,
  createUserIdsExtractor,
} from '../utils/columnFactories.js';
import SelectFilterWrapper from '../components/SelectFilterWrapper.js';
import UserFilterWrapper from '../components/UserFilterWrapper.js';
import RecordFilterWrapper from '../components/RecordFilterWrapper.js';
import {
  extractUserIds,
  findUserIdByName,
  createFakeJunctionRecord,
  valuesEqual,
} from '../../shared/utils/sharedHelpers.js';

// Cell editing: owns the `columnDefs` computed (the giant per-column
// definition builder), all cell/row edit lifecycle handlers
// (onCellEditingStarted/Stopped, onRowEditingStarted/Stopped,
// onCellValueChanged), action triggering (onActionTrigger,
// onCustomCellEdit, onRowClicked), `getRowId`, and the in-flight edit
// tracking ref `_lastActiveCellEdit` (consumed by `useGridActions`'s
// refreshRow logging).
//
// Validation tracking refs (`_pendingValidationError`,
// `_validationFiredForCurrentEdit`) live in useColumnState — they were
// created there in S5 so cell-editing methods (still Options-API at
// the time) could write to them via `this._pendingValidationError = X`.
// We receive them here as deps so columnDefs's getValidationErrors
// closure and onCellEditingStarted/Stopped can write through to the
// same refs.
export function useCellEditing(cfg, props, ctx, resolveMappingFormula, {
  gridApi, debugLog, isGridRendering,
  // From useColumnState (S5):
  _pendingValidationError, _validationFiredForCurrentEdit,
  // From useGrouping (S3):
  isGroupingActive, groupingState, groupGridApis,
  // From useDataFetch (S2):
  isInfiniteScrollEnabled, setUpdatingDataLocally,
  // Inline refs in setup() (record column's onCreateClick writes these):
  activeCreateColumnField, activeCreateRow, activeCreateRowId,
  // Records a pending grouping-column move so the per-group infinite
  // datasource can drop the row from the source group on the next
  // refetch, regardless of whether Supabase has caught up. From useGrouping.
  setPendingGroupingMove,
  // Thunk — useInfiniteScroll runs AFTER this composable, so we resolve
  // scheduleRefreshGroupCounts lazily.
  getScheduleRefreshGroupCounts,
}) {
  // Tracks the currently active cell edit (set in onCellEditingStarted,
  // cleared in onCellEditingStopped). Consumed by useGridActions.refreshRow
  // for diagnostic logging.
  const _lastActiveCellEdit = ref(null);

  const onActionTrigger = (event) => {
    ctx.emit('trigger-event', {
      name: 'action',
      event,
    });
  };

  const onCustomCellEdit = (event) => {
    ctx.emit('trigger-event', {
      name: event.type,
      event: {
        columnId: event.columnId,
        field: event.field,
        value: event.value,
        row: event.row,
        id: event.id,
        index: event.index,
        displayIndex: event.displayIndex,
        isCancel: event.isCancel || false,
      },
    });
  };

  const onRowClicked = (event) => {
    ctx.emit('trigger-event', {
      name: 'rowClicked',
      event: {
        row: event.data,
        id: event.node.id,
        index: event.node.sourceRowIndex,
        displayIndex: event.rowIndex,
      },
    });
  };

  const getRowId = (params) => {
    // Get ID from formula
    let rowId = resolveMappingFormula(cfg.value.idFormula, params.data);

    // If formula returns a valid ID, use it directly (stable across re-renders)
    // IMPORTANT: Do NOT append data hashes - that causes row IDs to change whenever
    // any field in the row data changes, which forces AG Grid to destroy and recreate
    // all cell renderers (causing visible flickering on custom/user columns).
    if (rowId !== null && rowId !== undefined && rowId !== '') {
      return String(rowId);
    }

    // Fallback: generate a deterministic ID from the row index when no idFormula is set.
    // Using the row index from params ensures stability across re-renders as long as
    // the data order doesn't change. This is a reasonable fallback when no ID is configured.
    if (params.node?.rowIndex != null) {
      return `row-idx-${params.node.rowIndex}`;
    }

    // Last resort: hash-based ID from data content (deterministic but may change if data mutates)
    const dataStr = JSON.stringify(params.data || {});
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `row-${Math.abs(hash)}`;
  };

  const onCellEditRequest = (event) => {
    // Method kept for potential future use
  };

  const onCellEditingStarted = (event) => {
    _pendingValidationError.value = null;
    _validationFiredForCurrentEdit.value = false;
    _lastActiveCellEdit.value = {
      rowIndex: event?.rowIndex,
      rowPinned: event?.node?.rowPinned ?? null,
      rowId: event?.node?.id,
      field: event?.colDef?.field,
      colId: event?.column?.getColId?.(),
      dataId: event?.data?.id,
      startedAt: Date.now(),
    };
    console.log('[Datagrid edit] cell editing started', _lastActiveCellEdit.value);
  };

  const onCellEditingStopped = (event) => {
    console.log('[Datagrid edit] cell editing stopped', {
      rowIndex: event?.rowIndex,
      rowId: event?.node?.id,
      field: event?.colDef?.field,
      colId: event?.column?.getColId?.(),
      dataId: event?.data?.id,
      lastActiveCellEdit: _lastActiveCellEdit.value,
    });
    _pendingValidationError.value = null;
    _validationFiredForCurrentEdit.value = false;
    _lastActiveCellEdit.value = null;
  };

  const onRowEditingStarted = (event) => {
    console.log('[validation] >>> onRowEditingStarted', event?.rowIndex);
  };

  const onRowEditingStopped = (event) => {
    console.log('[validation] >>> onRowEditingStopped', event?.rowIndex);
  };

  const onCellValueChanged = (event) => {
    // Find the column configuration to get isDirectUpdate
    const columnId = event.column.getColId();
    const columnConfig = cfg.value.columns.find(
      (col) => col?.field === columnId || col?.actionName === columnId
    );

    // Cross-group refresh in infinite-scroll + grouping mode.
    // When the user edits the grouping column itself, the row needs to move
    // from its old group grid to the new group grid. Since each group owns
    // its own infinite cache, we purge the cache of both the old and new
    // group APIs so AG Grid refetches the visible block on each side.
    //
    // Two-phase timing for a smooth move:
    //   1. Immediately redraw the source row. Its data was just mutated to
    //      the new group value, so the per-grid `rowClassRules` lookup —
    //      which compares row.data[groupingColumnId] against the grid's
    //      `context.groupValue` — flips on .ww-row-leaving and the row
    //      fades out in place.
    //   2. Wait long enough for the parent's Supabase update to round-trip
    //      (the previous 50ms fired before the write landed, so the
    //      refetch returned stale rows and the move appeared not to take).
    //      Then purge both source & destination caches; AG Grid's
    //      animateRows fades the row in on the destination side.
    if (
      isGroupingActive.value &&
      isInfiniteScrollEnabled.value &&
      groupingState.value?.columnId === columnId &&
      groupGridApis.value &&
      groupGridApis.value.size > 0
    ) {
      const normalize = (v) => (v === null || v === undefined || v === '' ? null : String(v));
      const oldGroupVal = normalize(event.oldValue);
      const newGroupVal = normalize(event.data?.[columnId]);
      if (oldGroupVal !== newGroupVal) {
        // Map null/'' to the Unassigned-group sentinel (matches the
        // UNASSIGNED_GROUP constant used by groupGridApis Map keys).
        const UNASSIGNED = '__unassigned__';
        const sourceKey = oldGroupVal ?? UNASSIGNED;
        const destKey = newGroupVal ?? UNASSIGNED;

        // Record the pending move BEFORE the source-side purge fires so
        // the per-group datasource's filter drops this row on the next
        // refetch — even if Supabase still has the old grouping value.
        // Without this, the refetch returns the row unchanged and it
        // pops back into the source group.
        const rowId = event.node?.id ?? event.data?.id ?? null;
        try { setPendingGroupingMove?.(rowId, newGroupVal); }
        catch (_) { /* noop */ }

        // Phase 1: immediate visual feedback — the source row's data already
        // reflects the new group, so a redraw lets rowClassRules apply
        // .ww-row-leaving and the CSS fade kicks in.
        const sourceApi = groupGridApis.value.get(sourceKey);
        if (sourceApi && event.node) {
          try { sourceApi.redrawRows({ rowNodes: [event.node] }); }
          catch (_) { /* noop */ }
        }

        // Phase 2: refetch once Supabase has had time to land the write.
        setTimeout(() => {
          [sourceKey, destKey].forEach((gv) => {
            const api = groupGridApis.value.get(gv);
            if (!api) return;
            try { api.purgeInfiniteCache(); }
            catch (e) { debugLog?.(`[Group Infinite] purge failed for "${gv}":`, e?.message); }
          });
          // Refresh upfront counts so the badge on a collapsed destination
          // group (whose grid isn't mounted to update its own count via
          // its datasource) reflects the move.
          try { getScheduleRefreshGroupCounts?.()?.(); }
          catch (_) { /* noop */ }
        }, 800);
      }
    }

    // For select columns: read the value directly from the data to ensure we get the ID, not the label
    // The valueSetter ensures the actual value (ID) is stored in the data field
    const newValue = event.data?.[columnId];

    // Check if this is a user column (all user columns need safeguard to prevent data fetching)
    const isUserColumn = columnConfig?.cellDataType === 'user';
    // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
    const isForeignKeyColumn = isUserColumn && columnConfig?.isManyToMany === true;
    const defaultUserIdFormula = { type: 'f', code: 'context.mapping' };
    const userIdFormula = columnConfig?.userIdFormula || defaultUserIdFormula;

    // For user columns, get oldValue as raw user IDs (not display names)
    // AG Grid's event.oldValue might be the display value (names) due to valueGetter
    let oldValue = event.oldValue;

    if (isUserColumn && event.node) {
      // Get users array from column config
      const users = columnConfig?.users || [];
      const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;

      // Try to get raw value from node's data (before it was changed)
      // Check if oldValue looks like a display value (names) or if it's already IDs
      const isDisplayValue = typeof oldValue === 'string' &&
        (oldValue.includes(',') || (oldValue.includes(' ') && !oldValue.match(/^[a-f0-9-]{36}$/i)));

      let normalizedOldValue;

      if (isDisplayValue) {
        // oldValue appears to be display names - convert to IDs
        if (oldValue.includes(',')) {
          // Multiple users: comma-separated names
          const names = oldValue.split(',').map(n => n.trim()).filter(Boolean);
          const ids = names.map(name => findUserIdByName(name, users)).filter(id => id != null);
          normalizedOldValue = ids.length > 0 ? ids : null;
        } else {
          // Single user: name
          normalizedOldValue = findUserIdByName(oldValue, users);
        }
      } else {
        // oldValue might already be IDs - extract using formula if needed
        normalizedOldValue = extractUserIds(oldValue, event.node.data, resolveMappingFormula, userIdFormula);

        // If extraction returned the same value and it's a string, check if it's a name
        if (normalizedOldValue === oldValue && typeof oldValue === 'string' && users.length > 0) {
          // Check if it's already a valid ID
          const isValidId = users.some(u => u.id === oldValue);
          if (!isValidId) {
            // Might be a name - try to find ID
            const foundId = findUserIdByName(oldValue, users);
            if (foundId) {
              normalizedOldValue = foundId;
            }
          }
        }
      }

      // Ensure format matches setCellValue expectations:
      // - Single user: string ID
      // - Multiple users: array of string IDs
      if (isMultiple) {
        // Ensure it's an array
        if (Array.isArray(normalizedOldValue)) {
          oldValue = normalizedOldValue;
        } else if (normalizedOldValue != null) {
          oldValue = [normalizedOldValue];
        } else {
          oldValue = [];
        }
      } else {
        // Ensure it's a single value (not array)
        if (Array.isArray(normalizedOldValue) && normalizedOldValue.length > 0) {
          oldValue = normalizedOldValue[0];
        } else {
          oldValue = normalizedOldValue;
        }
      }
    } else {
      // For non-user columns, use oldValue as-is
      oldValue = event.oldValue;
    }

    // Don't emit event if values are the same (e.g., when edit was cancelled with Escape)
    if (valuesEqual(oldValue, newValue)) {
      return; // Skip emitting event when values are the same (cancelled edit)
    }
    // For select columns, oldValue should already be the option value (not label)
    // AG Grid's oldValue should match what's stored in data, which is the option value

    // Set flag to prevent data fetching during ANY user column update
    // This prevents watchers from triggering Supabase fetches when we modify user data
    if (isUserColumn) {
      debugLog('[User Column Update] Setting isUpdatingDataLocally flag to TRUE');
      setUpdatingDataLocally(true);
      debugLog('[User Column Update] Flag set, about to process update');
    }

    // If it's a many-to-many user column (junction table), simulate creating a fake junction record
    // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
    // maxNumberOfUsers only affects whether the result is stored as an array or single object
    if (isForeignKeyColumn && newValue) {
      // Normalize newValue to array format for processing
      const userIds = Array.isArray(newValue) ? newValue : [newValue];
      const userIdFormulaForJunction = columnConfig?.userIdFormula || defaultUserIdFormula;

      // Create fake junction records using shared utility
      const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
      let fakeJunctionRecord;
      if (isMultiple) {
        // Multiple users: array of nested structures
        fakeJunctionRecord = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormulaForJunction));
      } else {
        // Single user: single nested structure (not array)
        fakeJunctionRecord = createFakeJunctionRecord(userIds[0], userIdFormulaForJunction);
      }

      try {
        // Update the row data with the fake junction record
        event.data[columnId] = fakeJunctionRecord;

        // Refresh the cell to show the updated value
        // CRITICAL FIX: Wrap in setTimeout to prevent error #252
        if (gridApi.value && event.node) {
          const rowNode = event.node;
          setTimeout(() => {
            if (gridApi.value) {
              gridApi.value.refreshCells({
                rowNodes: [rowNode],
                columns: [columnId],
                force: true,
              });
            }
          }, 0);
        }

        debugLog('[Foreign Key] Created fake junction record:', {
          columnId,
          userIdFormula: userIdFormulaForJunction,
          fakeRecord: fakeJunctionRecord,
        });
      } catch (error) {
        console.error('[Foreign Key] Error creating fake junction record:', error);
      }
    }

    // Clear flag after a short delay for ALL user column updates
    // This ensures watchers don't trigger fetches during the update
    if (isUserColumn) {
      nextTick(() => {
        setTimeout(() => {
          debugLog('[User Column Update] Clearing isUpdatingDataLocally flag');
          setUpdatingDataLocally(false);
          debugLog('[User Column Update] Flag cleared');
        }, 200); // Delay to ensure all watchers have processed
      });
    }

    // Redraw the row to re-evaluate conditional row styles
    // This is needed because getRowStyle is only called when rows are rendered
    // Only do this if conditional styles are defined (avoid unnecessary redraws)
    if (gridApi.value && event.node && props.content?.conditionalRowStyles?.length > 0) {
      // Use a slightly longer timeout to batch with any other updates
      setTimeout(() => {
        if (gridApi.value && !isGridRendering.value) {
          const hasActiveEditor = typeof gridApi.value.getEditingCells === 'function' &&
            gridApi.value.getEditingCells().length > 0;
          if (hasActiveEditor) {
            console.log('[Datagrid edit] skipped conditional row redraw while editor active', {
              rowIndex: event?.rowIndex,
              rowId: event?.node?.id,
              columnId,
            });
            gridApi.value.refreshCells({
              rowNodes: [event.node],
              force: true,
            });
            return;
          }
          gridApi.value.redrawRows({ rowNodes: [event.node] });
        }
      }, 50);
    }

    ctx.emit('trigger-event', {
      name: 'cellValueChanged',
      event: {
        oldValue: oldValue,
        newValue: isForeignKeyColumn && event.data?.[columnId] ? event.data[columnId] : newValue, // Use fake junction record if created
        columnId: columnId,
        row: event.data,
        isDirectUpdate: columnConfig?.isDirectUpdate || false,
      },
    });
  };

  // ===== columnDefs =====
  // The big computed that builds AG Grid column definitions per cellDataType.
  // Reactive deps: cfg.columns, cfg.viewConfiguration, cfg.lang,
  // cfg.userFocusColor, cfg.cellFontFamily, isGroupingActive, groupingState,
  // isInfiniteScrollEnabled. Writes to validation tracking refs as a side
  // effect (one-shot per edit session, deduped via the
  // `_validationFiredForCurrentEdit` flag).
  const columnDefs = computed(() => {
    // First, map all columns to their definitions
    const columnsMap = new Map();

    // Run validation rules for a column and, on failure, emit the
    // `validationFailed` trigger event so WeWeb workflows can react.
    // ag-Grid v34 uses this return value (string[] | null) to drive
    // `invalidEditValueMode` (revert/block) and tooltip display natively.
    // AG Grid calls getValidationErrors on submission attempts, so we fire
    // the workflow + toast here directly — deduped per edit session via
    // `_validationFiredForCurrentEdit` (reset in onCellEditingStarted).
    const getValidationErrors = (col, newValue, rowData, params) => {
      const validationFn = createValidationFunction(col, resolveMappingFormula);
      const errors = validationFn(newValue, rowData);
      if (errors && errors.length > 0) {
        _pendingValidationError.value = { col, newValue, rowData, params, errors };
        if (!_validationFiredForCurrentEdit.value) {
          _validationFiredForCurrentEdit.value = true;
          const rowId = rowData?.[cfg.value?.idKey] ?? params?.node?.id ?? null;
          ctx.emit('trigger-event', {
            name: 'validationFailed',
            event: {
              field: col?.field,
              value: newValue,
              oldValue: rowData?.[col?.field],
              errors,
              rowId,
              data: rowData,
            },
          });
          try {
            wwLib.wwWorkflow.executeGlobal('1d11d250-421f-4cc5-bb8b-7bb3ad71c34d', {
              body: errors.join('\n'),
              title: `Champ invalide : ${col?.headerName || col?.field || ''}`,
              type: 'error',
            });
          } catch (e) {
            console.warn('[validation] toast workflow failed', e);
          }
        }
      } else {
        _pendingValidationError.value = null;
        _validationFiredForCurrentEdit.value = false;
      }
      return errors;
    };

    const getValueSetter = (col, customSetter) => {
      return createValueSetter(col, customSetter);
    };
    // Get column widths from viewConfiguration (for restoring user-resized widths)
    // Note: When sizes key is present but empty ({}), default column widths from column config will be used
    // When sizes key is absent (undefined), the current user-resized widths are preserved
    const viewConfig = cfg.value.viewConfiguration;
    const hasSizesKey = viewConfig && typeof viewConfig === 'object' && 'sizes' in viewConfig;
    const viewColumnSizes = hasSizesKey ? viewConfig.sizes : null;

    // Get hidden columns from viewConfiguration for setting hide property in column defs
    const hasHiddenColumnsKey = viewConfig && typeof viewConfig === 'object' && 'hiddenColumns' in viewConfig;
    const viewHiddenColumns = hasHiddenColumnsKey && Array.isArray(viewConfig.hiddenColumns)
      ? new Set(viewConfig.hiddenColumns)
      : null;

    const allColumnDefs = cfg.value.columns
      .filter((col) => col != null && (col.field || col.actionName)) // Filter out null/undefined columns and columns without field/actionName
      .map((col, index) => {

      const minWidth =
        !col?.minWidth || col?.minWidth === "auto"
          ? null
          : wwLib.wwUtils.getLengthUnit(col?.minWidth)?.[0];
      const maxWidth =
        !col?.maxWidth || col?.maxWidth === "auto"
          ? null
          : wwLib.wwUtils.getLengthUnit(col?.maxWidth)?.[0];

      // Get column identifier (actionName for action columns, field for others)
      const colId = col?.actionName || col?.field;

      // Check if view width is provided for this column (overrides column config width)
      const viewWidth = viewColumnSizes && colId && typeof viewColumnSizes[colId] === 'number'
        ? viewColumnSizes[colId]
        : null;

      // Use viewConfiguration.sizes if provided, otherwise use column config width
      // Note: When viewConfiguration.sizes is provided for a column, it overrides flex as well
      const width = viewWidth !== null
        ? viewWidth
        : (!col?.width || col?.width === "auto" || col?.widthAlgo === "flex"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.width)?.[0]);

      // Only use flex if no viewWidth is provided for this column
      const flex = viewWidth !== null
        ? null
        : (col?.widthAlgo === "flex" ? col?.flex ?? 1 : null);

      // Build cellClass array for column-specific styling
      const cellClasses = [];
      if (cfg.value.cellAlignmentMode !== "custom" && col?.cellAlignment) {
        cellClasses.push(`-${col?.cellAlignment}`);
      }
      if (col?.suppressRowInteraction) {
        cellClasses.push("-suppress-row-interaction");
      }

      const commonProperties = {
        minWidth,
        maxWidth,
        pinned: col?.pinned === "none" ? false : col?.pinned,
        width,
        flex,
        hide: !!col?.hide
          || (viewHiddenColumns !== null && viewHiddenColumns.has(colId)),
        headerClass: col?.headerAlignment ? `-${col?.headerAlignment}` : null,
        ...(cellClasses.length > 0 ? { cellClass: cellClasses } : {}),
        valueSetter: getValueSetter(col),
      };

      const cellDataType = col?.cellDataType;

      // Route cellEditorParams.getValidationErrors through the tracking helper
      // so _pendingValidationError is populated and onCellEditingStopped fires
      // the `validationFailed` trigger event + toast.
      const attachValidationTracking = (def) => {
        if (def?.cellEditorParams) {
          def.cellEditorParams.getValidationErrors = (params) => {
            return getValidationErrors(col, params?.value, params?.data, params);
          };
        }
        return def;
      };

      switch (cellDataType) {
        case "action": {
          return createActionColumnDef(col, commonProperties, onActionTrigger, props.content);
        }
        case "custom": {
          return attachValidationTracking(
            createCustomColumnDef(col, commonProperties, onCustomCellEdit, resolveMappingFormula)
          );
        }
        case "dateString":
        case "dateTime": {
          return attachValidationTracking(
            createDateColumnDef(col, commonProperties, resolveMappingFormula)
          );
        }
        case "currency": {
          return attachValidationTracking(
            createCurrencyColumnDef(col, commonProperties, resolveMappingFormula)
          );
        }
        case "image": {
          return createImageColumnDef(col, commonProperties);
        }
        case "select": {
          const rawOptions = col?.options;
          const selectParams = {
            options: Array.isArray(rawOptions) ? rawOptions : [],
            optionsValueFormula: col?.optionsValueFormula,
            optionsLabelFormula: col?.optionsLabelFormula,
            optionsColorFormula: col?.optionsColorFormula,
            resolveMappingFormula: resolveMappingFormula,
            // Use a getter to avoid isLoading being a reactive dependency of columnDefs.
            // This prevents columnDefs from recomputing when loading state changes,
            // which would cause AG Grid to recreate all cell renderers (flickering).
            get isLoading() { return false; },
          };

          // Memoized label getter: O(n_options) only on first call per unique
          // options array reference, O(1) for all subsequent calls.
          const getLabelFromValue = createSelectLabelGetter(col, resolveMappingFormula);

          return {
            ...commonProperties,
            headerName: col?.headerName,
            field: col?.field,
            cellRenderer: "SelectCellRenderer",
            cellRendererParams: selectParams,
            cellEditor: "SelectCellRenderer",
            cellEditorParams: {
              ...selectParams,
              getValidationErrors: (params) => {
                return getValidationErrors(col, params.value, params.data, params);
              },
            },
            editable: col?.editable !== false,
            sortable: col?.sortable,
            filter: col?.filter ? SelectFilterWrapper : false,
            ...(col?.filter
              ? {
                  filterParams: {
                    selectOptions: selectParams,
                    closeOnApply: true,
                    translations: (() => {
                      const lang = cfg.value?.lang || 'en';
                      const translations = {
                        en: { reset: 'Reset', apply: 'Apply' },
                        fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                        es: { reset: 'Restablecer', apply: 'Aplicar' },
                        de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                        pt: { reset: 'Redefinir', apply: 'Aplicar' },
                      };
                      return translations[lang] || translations.en;
                    })(),
                  },
                }
              : {}),
            // Use label for filtering and sorting instead of raw value.
            // Pass the options array so the getter can cache by array reference.
            valueGetter: (params) => {
              const rawOptions2 = col?.options;
              const options = Array.isArray(rawOptions2) ? rawOptions2 : [];
              return getLabelFromValue(params.data?.[col?.field], options);
            },
            // Ensure the raw value (ID) is stored, not the label
            valueSetter: getValueSetter(col, (params) => {
              if (params.newValue !== params.oldValue) {
                params.data[col?.field] = params.newValue;
                return true;
              }
              return false;
            }),
            // Return raw value (ID) for filtering - filter model stores IDs
            filterValueGetter: (params) => {
              return params.data?.[col?.field];
            },
          };
        }
        case "user": {
          const rawUsers = col?.users;
          const userIdFormula = col?.userIdFormula || { type: 'f', code: 'context.mapping' };
          const userParams = {
            users: Array.isArray(rawUsers) ? rawUsers : [],
            maxNumberOfUsers: col?.maxNumberOfUsers ?? 4,
            userFocusColor: cfg.value.userFocusColor,
            cellFontFamily: cfg.value.cellFontFamily,
            resolveMappingFormula: resolveMappingFormula,
            userIdFormula: userIdFormula,
            get isLoading() { return false; },
          };

          // Memoized closures — created once per unique (field, formula) config,
          // not recreated on every columnDefs recompute.
          const extractUserIdsFn = createUserIdsExtractor(col, resolveMappingFormula);
          const getUserNameFromId = createUserNameGetter(col);

          const isMultiple = (col?.maxNumberOfUsers ?? 4) > 1;

          return {
            ...commonProperties,
            headerName: col?.headerName,
            field: col?.field,
            cellRenderer: "UserCellRenderer",
            cellRendererParams: userParams,
            cellEditor: "UserCellRenderer",
            cellEditorParams: {
              ...userParams,
              getValidationErrors: (params) => {
                return getValidationErrors(col, params.value, params.data, params);
              },
            },
            editable: col?.editable !== false,
            sortable: col?.sortable,
            filter: col?.filter ? UserFilterWrapper : false,
            ...(col?.filter
              ? {
                  filterParams: {
                    users: userParams.users,
                    maxNumberOfUsers: userParams.maxNumberOfUsers,
                    userFocusColor: userParams.userFocusColor,
                    cellFontFamily: userParams.cellFontFamily,
                    resolveMappingFormula: userParams.resolveMappingFormula,
                    userIdFormula: userParams.userIdFormula,
                    isLoading: userParams.isLoading,
                    closeOnApply: true,
                    translations: (() => {
                      const lang = cfg.value?.lang || 'en';
                      const translations = {
                        en: { reset: 'Reset', apply: 'Apply' },
                        fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                        es: { reset: 'Restablecer', apply: 'Aplicar' },
                        de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                        pt: { reset: 'Redefinir', apply: 'Aplicar' },
                      };
                      return translations[lang] || translations.en;
                    })(),
                  },
                }
              : {}),
            // Use user name for filtering and sorting instead of raw ID.
            // Pass the users array so the getter can cache by array reference.
            valueGetter: (params) => {
              const rawValue = params.data?.[col?.field];
              const extractedValue = extractUserIdsFn(rawValue);
              if (!extractedValue) return '';

              const rawUsers2 = col?.users;
              const users = Array.isArray(rawUsers2) ? rawUsers2 : [];

              if (isMultiple) {
                // Multiple users: return comma-separated names
                const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
                return userIds.map(id => getUserNameFromId(id, users)).filter(Boolean).join(', ');
              } else {
                // Single user: return name
                return getUserNameFromId(extractedValue, users);
              }
            },
            // Ensure the raw value (ID or array of IDs) is stored
            valueSetter: getValueSetter(col, (params) => {
              if (params.newValue !== params.oldValue) {
                params.data[col?.field] = params.newValue;
                return true;
              }
              return false;
            }),
            // Return user ID(s) for filtering — filter model stores IDs
            filterValueGetter: (params) => {
              const rawValue = params.data?.[col?.field];
              return extractUserIdsFn(rawValue) ?? null;
            },
          };
        }
        case "record": {
          const recordParams = {
            tableName: col?.recordTable,
            valueField: col?.recordValueField || 'id',
            displayField: col?.recordDisplayField || 'name',
            contextField: col?.recordContextField || '',
            previewFields: col?.recordPreviewFields || [],
            allowCreate: col?.allowCreateRecord || false,
            enableDebugLogs: !!cfg.value?.enableDebugLogs,
            getSupabaseInstance: () => wwLib.wwPlugins.supabase?.instance,
            onCreateClick: (createCtx) => {
              const payload = typeof createCtx === 'string' ? { columnField: createCtx } : (createCtx || {});
              activeCreateColumnField.value = payload.columnField || null;
              activeCreateRow.value = payload.row ?? null;
              activeCreateRowId.value = payload.rowId ?? null;
            },
            onRecordNavigate: (eventData) => {
              ctx.emit('trigger-event', {
                name: 'onRecordNavigation',
                event: eventData,
              });
            },
            get isLoading() { return false; },
          };

          return {
            ...commonProperties,
            headerName: col?.headerName,
            field: col?.field,
            cellRenderer: "RecordCellRenderer",
            cellRendererParams: recordParams,
            cellEditor: "RecordCellRenderer",
            cellEditorParams: {
              ...recordParams,
              getValidationErrors: (params) => {
                return getValidationErrors(col, params.value, params.data, params);
              },
            },
            editable: col?.editable !== false,
            sortable: col?.sortable,
            filter: col?.filter ? RecordFilterWrapper : false,
            ...(col?.filter
              ? {
                  filterParams: {
                    recordOptions: recordParams,
                    closeOnApply: true,
                    translations: (() => {
                      const lang = cfg.value?.lang || 'en';
                      const translations = {
                        en: { reset: 'Reset', apply: 'Apply' },
                        fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                        es: { reset: 'Restablecer', apply: 'Aplicar' },
                        de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                        pt: { reset: 'Redefinir', apply: 'Aplicar' },
                      };
                      return translations[lang] || translations.en;
                    })(),
                  },
                }
              : {}),
            valueGetter: (params) => {
              return params.data?.[col?.field];
            },
            valueSetter: (params) => {
              // Read old value directly from data (not from AG Grid's oldValue
              // which may be stale when a valueGetter is defined)
              const oldVal = params.data?.[col?.field];
              params.data[col.field] = params.newValue;
              return oldVal !== params.newValue;
            },
          };
        }
        default: {
          // Determine the correct filter type based on cellDataType
          let filterType = false;
          if (col?.filter) {
            if (col?.cellDataType === 'number') {
              filterType = 'agNumberColumnFilter';
            } else if (col?.cellDataType === 'boolean') {
              // Use Set Filter for boolean columns to show True/False options
              filterType = 'agSetColumnFilter';
            } else {
              // Default to text filter for text, undefined, or other types
              filterType = 'agTextColumnFilter';
            }
          }

          const result = {
            ...commonProperties,
            headerName: col?.headerName,
            field: col?.field,
            sortable: col?.sortable,
            filter: filterType,
            editable: col?.editable,
          };

          // Add boolean-specific handling
          if (col?.cellDataType === 'boolean') {
            // Set cellDataType so AG Grid can automatically configure other features
            // Note: We explicitly set filter type above to ensure Set Filter is used
            result.cellDataType = 'boolean';

            // Explicitly ensure Set Filter is used (override AG Grid's default Text Filter for boolean)
            if (col?.filter) {
              result.filter = 'agSetColumnFilter';
            }

            // Use checkbox cell renderer for boolean display
            result.cellRenderer = 'agCheckboxCellRenderer';

            // Normalize boolean values for the checkbox renderer
            result.valueGetter = (params) => {
              const value = params.data?.[col?.field];
              // Handle various boolean representations and convert to actual boolean
              if (value === true || value === 'true' || value === 1 || value === '1') {
                return true;
              } else if (value === false || value === 'false' || value === 0 || value === '0') {
                return false;
              }
              return value;
            };

            // Ensure the checkbox updates the data correctly
            result.valueSetter = (params) => {
              const newValue = params.newValue === true || params.newValue === 'true' || params.newValue === 1 || params.newValue === '1';
              params.data[col?.field] = newValue;
              return true;
            };

            // For editable boolean columns, use checkbox as both renderer and editor
            if (col?.editable) {
              result.cellEditor = 'agCheckboxCellEditor';
              // Create the validation function
              const validationFn = (params) => {
                return getValidationErrors(col, params?.value, params?.data, params);
              };
              result.cellEditorParams = {
                getValidationErrors: validationFn,
              };
            }

            // Configure filter params for boolean set filter
            // Explicitly configure to ensure Set Filter shows True/False options
            if (col?.filter && filterType === 'agSetColumnFilter') {
              // Merge with default filter params (buttons, closeOnApply, etc.)
              result.filterParams = {
                ...(result.filterParams || {}),
                values: (params) => {
                  // Return boolean values for the set filter
                  return [true, false];
                },
                valueFormatter: (params) => {
                  // Format boolean values as True/False (AG Grid will handle localization)
                  if (params.value === true || params.value === 'true' || params.value === 1 || params.value === '1') {
                    return 'True';
                  } else if (params.value === false || params.value === 'false' || params.value === 0 || params.value === '0') {
                    return 'False';
                  }
                  return String(params.value);
                },
                // Ensure filter uses actual boolean values, not strings
                filterValueGetter: (params) => {
                  const value = params.data?.[col?.field];
                  // Convert to actual boolean for filtering
                  if (value === true || value === 'true' || value === 1 || value === '1') {
                    return true;
                  } else if (value === false || value === 'false' || value === 0 || value === '0') {
                    return false;
                  }
                  return value;
                }
              };
            }
          } else if (col?.editable) {
            // Add cellEditor and cellEditorParams for editable non-boolean columns to ensure validation works
            // Create the validation function
            const validationFn = (params) => {
              return getValidationErrors(col, params?.value, params?.data, params);
            };

            // Explicitly set cellEditor to ensure validation is triggered
            // AG Grid's default editor might not call getValidationErrors consistently
            result.cellEditor = 'agTextCellEditor';

            result.cellEditorParams = {
              getValidationErrors: validationFn,
            };
          }

          if (col?.useCustomLabel) {
            result.valueFormatter = (params) => {
              return resolveMappingFormula(
                col?.displayLabelFormula,
                params.value
              );
            };

            // Use display value for filtering and sorting if enabled
            if (col?.useDisplayValueForFilterSort) {
              // Helper function to get display value from raw value
              const getDisplayValue = (rawValue) => {
                return resolveMappingFormula(
                  col?.displayLabelFormula,
                  rawValue
                );
              };

              // Use display value for filtering
              result.filterValueGetter = (params) => {
                const rawValue = params.data?.[col?.field];
                return getDisplayValue(rawValue);
              };

              // Use display value for sorting with custom comparator
              if (col?.sortable) {
                result.comparator = (valueA, valueB, nodeA, nodeB) => {
                  const rawValueA = nodeA?.data?.[col?.field];
                  const rawValueB = nodeB?.data?.[col?.field];
                  const displayValueA = getDisplayValue(rawValueA);
                  const displayValueB = getDisplayValue(rawValueB);

                  // Handle null/undefined values
                  if (displayValueA == null && displayValueB == null) return 0;
                  if (displayValueA == null) return 1;
                  if (displayValueB == null) return -1;

                  // Compare as numbers if both are numbers, otherwise as strings
                  const numA = Number(displayValueA);
                  const numB = Number(displayValueB);
                  if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                  }

                  // String comparison
                  return String(displayValueA).localeCompare(String(displayValueB));
                };
              }
            }
          }
          return result;
        }
      }
    });

    // Build a map of column definitions by their colId/field for reordering
    allColumnDefs.forEach((colDef) => {
      const colId = colDef.colId || colDef.field;
      if (colId) {
        columnsMap.set(colId, colDef);
      }
    });

    // Reorder columns based on viewConfiguration.columnsOrder if provided with values
    // Empty array [] or absent key means use default column order from definitions
    // The distinction between "key absent" vs "key present but empty" is handled
    // by applyViewConfiguration at runtime for resetting column order
    let columns;
    const viewColumnsOrder = cfg.value.viewConfiguration?.columnsOrder;
    const hasValidColumnsOrder = viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0;
    if (hasValidColumnsOrder) {
      const orderedColumns = [];
      const usedColIds = new Set();

      // First, add columns in the order specified by viewConfiguration.columnsOrder
      for (const colId of viewColumnsOrder) {
        if (columnsMap.has(colId)) {
          orderedColumns.push(columnsMap.get(colId));
          usedColIds.add(colId);
        }
      }

      // Then, add any remaining columns that weren't in viewConfiguration.columnsOrder
      // (to handle cases where new columns were added to config but not to viewConfiguration.columnsOrder)
      for (const colDef of allColumnDefs) {
        const colId = colDef.colId || colDef.field;
        if (colId && !usedColIds.has(colId)) {
          orderedColumns.push(colDef);
        }
      }

      columns = orderedColumns;
    } else {
      columns = allColumnDefs;
    }

    // Inject hidden virtual columns for fields referenced in sorting/filters
    // but not present in column definitions (e.g., sort by created_at without showing it)
    const existingColIds = new Set(columns.map(c => c.colId || c.field));
    const virtualColIds = new Set();

    // Collect colIds from sorting config
    const sortingConfig = cfg.value.viewConfiguration?.sorting;
    if (Array.isArray(sortingConfig)) {
      for (const s of sortingConfig) {
        if (s?.colId && !existingColIds.has(s.colId)) {
          virtualColIds.add(s.colId);
        }
      }
    }

    // Collect colIds from filters config
    const filtersConfig = cfg.value.viewConfiguration?.filters;
    if (filtersConfig && typeof filtersConfig === 'object') {
      for (const colId of Object.keys(filtersConfig)) {
        if (!existingColIds.has(colId)) {
          virtualColIds.add(colId);
        }
      }
    }

    // Add hidden column defs for virtual columns so ag-grid can sort/filter by them
    for (const colId of virtualColIds) {
      columns.push({
        colId,
        field: colId,
        hide: true,
        suppressHeaderMenuButton: true,
        lockVisible: true,
        __virtualColumn: true,
      });
    }

    // Enable row drag only if rowReorder is enabled AND infinite scroll is NOT enabled
    // (row dragging is not supported with infinite row model)
    if (cfg.value.rowReorder && columns[0] && !isInfiniteScrollEnabled.value) {
      columns[0].rowDrag = true;
    }

    return columns;
  });

  return {
    columnDefs,
    _lastActiveCellEdit,
    getRowId,
    onActionTrigger,
    onCellEditRequest,
    onCellEditingStarted,
    onCellEditingStopped,
    onRowEditingStarted,
    onRowEditingStopped,
    onCellValueChanged,
    onRowClicked,
    onCustomCellEdit,
  };
}
