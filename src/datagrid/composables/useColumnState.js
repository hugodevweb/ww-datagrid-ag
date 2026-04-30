import { ref, computed } from 'vue';
import { themeQuartz } from 'ag-grid-community';

// Column state: owns the `columnOrder` and `hiddenColumns` WeWeb component
// variables, the `isVirtualColumn` helper, the user-resize/reorder event
// handlers (`onColumnMoved`, `onColumnResized`), and the simple Options-API
// computeds that don't depend on cell-editing methods (defaultColDef,
// dataTypeDefinitions, rowSelection, style, cssVars, theme, rowStyle).
//
// Also owns the validation tracking refs (`_pendingValidationError`,
// `_validationFiredForCurrentEdit`) — they're written by `columnDefs` (still
// in Options API until Session 6) and read by cell-editing event handlers
// (also in Options API until Session 6). Exposing them from this composable
// lets the Options API access them via `this._pendingValidationError`
// (auto-unwraps to the ref's value, auto-sets via assignment).
//
// `columnDefs` itself is NOT extracted in this session — it depends on
// `this.onActionTrigger` and `this.onCustomCellEdit` (still in `methods:`)
// and the validation refs above. It will move alongside cell-editing in
// Session 6, when all its dependencies become composable-resident.
export function useColumnState(cfg, props, ctx, resolveMappingFormula, {
  gridApi, debugLog,
  // Thunks: useFiltersAndSort/useViewConfig/useColumnChooser are created at
  // various positions relative to useColumnState. Wrapping deps that may not
  // exist yet at construction in lazy thunks keeps the call site flexible.
  getUpdateCurrentConfig,
  getShowColumnChooser,
  getChooserColumnOrder,
}) {
  // WeWeb component variables: persist column order + hidden state
  const { value: columnOrder, setValue: setColumnOrder } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: "columnOrder",
      type: "array",
      defaultValue: [],
      readonly: true,
    });
  const { value: hiddenColumns, setValue: setHiddenColumns } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: "hiddenColumns",
      type: "array",
      defaultValue: [],
      readonly: true,
    });

  // Helper to check if a column is a virtual (sort/filter-only) column.
  // Virtual columns are injected by columnDefs for fields referenced in
  // sorting/filters but absent from the user's column list — they must
  // stay hidden, must not appear in chooser, and must be skipped from
  // user-visible width/order snapshots.
  const isVirtualColumn = (col) => {
    const colDef = col.getColDef?.();
    return colDef?.__virtualColumn === true;
  };

  // Validation tracking. Written inside columnDefs's getValidationErrors
  // closure (currently still in Options API), read in onCellEditingStarted/
  // Stopped (also Options API). Underscore prefix preserved for backwards
  // compatibility with existing Options-API access patterns.
  const _pendingValidationError = ref(null);
  const _validationFiredForCurrentEdit = ref(false);

  // Simple Options-API computeds, ported to Composition API. Each was a
  // pure cfg-derivation; behavior preserved verbatim.
  const defaultColDef = computed(() => ({
    editable: false,
    resizable: cfg.value.resizableColumns,
    autoHeaderHeight: cfg.value.headerHeightMode === "auto",
    wrapHeaderText: cfg.value.headerHeightMode === "auto",
    singleClickEdit: cfg.value.cellEditMode !== "doubleClick",
    cellClass:
      cfg.value.cellAlignmentMode === "custom"
        ? `-${cfg.value.cellAlignment || "left"} ||`
        : null,
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true,
    },
    // Note: cellEditorParams with getValidationErrors is added per-column,
    // not in defaultColDef, to allow column-specific validation rules
  }));

  const dataTypeDefinitions = computed(() => {
    // Return undefined to use AG Grid's default data type handling
    // Custom formatting is handled via valueFormatter/valueParser on individual columns
    // This avoids "data type definition undefined does not exist" errors
    return undefined;
  });

  const rowSelection = computed(() => {
    if (cfg.value.rowSelection === "multiple") {
      return {
        mode: "multiRow",
        checkboxes: !cfg.value.disableCheckboxes,
        headerCheckbox: !cfg.value.disableCheckboxes,
        selectAll: cfg.value.selectAll || "all",
        enableClickSelection: cfg.value.enableClickSelection,
      };
    } else if (cfg.value.rowSelection === "single") {
      return {
        mode: "singleRow",
        checkboxes: !cfg.value.disableCheckboxes,
        enableClickSelection: cfg.value.enableClickSelection,
      };
    } else {
      return {
        mode: "singleRow",
        checkboxes: false,
        isRowSelectable: () => false,
        enableClickSelection: cfg.value.enableClickSelection,
      };
    }
  });

  const style = computed(() => {
    if (cfg.value.layout === "auto") return {};
    return {
      height: cfg.value.height || "500px",
      minHeight: "200px",
    };
  });

  const cssVars = computed(() => {
    const columnChooserBackground =
      cfg.value.columnChooserBackground ||
      cfg.value.menuBackgroundColor ||
      cfg.value.headerBackgroundColor ||
      cfg.value.rowBackgroundColor;
    const columnChooserBorderColor =
      cfg.value.columnChooserBorderColor ||
      cfg.value.borderColor ||
      cfg.value.outerBorderColor;
    const columnChooserTextColor =
      cfg.value.columnChooserTextColor ||
      cfg.value.menuTextColor ||
      cfg.value.textColor ||
      cfg.value.cellColor ||
      cfg.value.headerTextColor;
    const columnChooserAccentColor =
      cfg.value.columnChooserAccentColor ||
      cfg.value.selectionCheckboxColor ||
      cfg.value.userFocusColor ||
      cfg.value.cellSelectionBorderColor;

    return {
      "--ww-data-grid_cc-background": columnChooserBackground,
      "--ww-data-grid_cc-border-color": columnChooserBorderColor,
      "--ww-data-grid_cc-border-radius": cfg.value.columnChooserBorderRadius || "8px",
      "--ww-data-grid_cc-text-color": columnChooserTextColor,
      "--ww-data-grid_cc-accent-color": columnChooserAccentColor,
      "--ww-data-grid_cc-width": cfg.value.columnChooserWidth || "260px",
      "--ww-data-grid_action-backgroundColor":
        cfg.value.actionBackgroundColor,
      "--ww-data-grid_action-color": cfg.value.actionColor,
      "--ww-data-grid_action-padding": cfg.value.actionPadding,
      "--ww-data-grid_action-border": cfg.value.actionBorder,
      "--ww-data-grid_action-borderRadius": cfg.value.actionBorderRadius,
      ...(cfg.value.actionFont
        ? { "--ww-data-grid_action-font": cfg.value.actionFont }
        : {
            "--ww-data-grid_action-fontSize": cfg.value.actionFontSize,
            "--ww-data-grid_action-fontFamily": cfg.value.actionFontFamily,
            "--ww-data-grid_action-fontWeight": cfg.value.actionFontWeight,
            "--ww-data-grid_action-fontStyle": cfg.value.actionFontStyle,
            "--ww-data-grid_action-lineHeight": cfg.value.actionLineHeight,
          }),
      "--ww-data-grid_record-pill-accent-color": cfg.value.recordPillAccentColor,
      "--ww-data-grid_record-pill-background": cfg.value.recordPillBackgroundColor,
      "--ww-data-grid_record-pill-border-color": cfg.value.recordPillBorderColor,
      "--ww-data-grid_record-pill-text-primary":
        cfg.value.recordPillTextPrimaryColor,
      "--ww-data-grid_record-pill-text-secondary":
        cfg.value.recordPillTextSecondaryColor,
      "--ww-data-grid_record-pill-accent-width":
        cfg.value.recordPillAccentWidth,
      "--ww-data-grid_record-pill-hover-shadow":
        cfg.value.recordPillHoverShadow,
    };
  });

  const theme = computed(() => themeQuartz.withParams({
    headerBackgroundColor: cfg.value.headerBackgroundColor,
    headerTextColor: cfg.value.headerTextColor,
    headerFontSize: cfg.value.headerFontSize,
    headerFontFamily: cfg.value.headerFontFamily,
    headerFontWeight: cfg.value.headerFontWeight,
    headerHeight:
      cfg.value.headerHeightMode !== "auto"
        ? cfg.value.headerHeight
        : undefined,
    borderColor: cfg.value.borderColor,
    wrapperBorder: cfg.value.outerBorderColor
      ? { style: "solid", width: 1, color: cfg.value.outerBorderColor }
      : undefined,
    cellTextColor: cfg.value.cellColor,
    cellFontFamily: cfg.value.cellFontFamily,
    dataFontSize: cfg.value.cellFontSize,
    oddRowBackgroundColor: cfg.value.rowAlternateColor,
    backgroundColor: cfg.value.rowBackgroundColor,
    rowHoverColor: cfg.value.rowHoverColor,
    selectedRowBackgroundColor: cfg.value.selectedRowBackgroundColor,
    rowVerticalPaddingScale: cfg.value.rowVerticalPaddingScale || 1,
    menuBackgroundColor: cfg.value.menuBackgroundColor,
    menuTextColor: cfg.value.menuTextColor,
    columnHoverColor: cfg.value.columnHoverColor,
    foregroundColor: cfg.value.textColor,
    checkboxCheckedBackgroundColor: cfg.value.selectionCheckboxColor,
    rangeSelectionBorderColor: cfg.value.cellSelectionBorderColor,
    checkboxUncheckedBorderColor: cfg.value.checkboxUncheckedBorderColor,
    focusShadow: cfg.value.focusShadow?.length
      ? cfg.value.focusShadow
      : undefined,
    wrapperBorderRadius: cfg.value.wrapperBorderRadius,
  }));

  const rowStyle = computed(() => {
    // Return a function that AG Grid will call for each row
    // This function evaluates conditional styling rules and focused row styling
    // IMPORTANT: Focused row styling is applied LAST to override conditional styles
    //
    // PERFORMANCE: We only use conditionalRowStyles as a reactive dependency here.
    // focusedRowId is read at call time (inside the returned function) so that
    // changing the focused row does NOT cause this computed to re-evaluate and
    // return a new function reference — which would force AG Grid to re-render
    // all rows. Instead, the focusedRowId watcher handles targeted redraws of
    // only the affected rows.
    const conditionalRowStyles = props.content?.conditionalRowStyles;

    const hasConditionalStyles = conditionalRowStyles && Array.isArray(conditionalRowStyles) && conditionalRowStyles.length > 0;

    // We always return a function now (instead of null) so that the function
    // reference stays stable. Returning null vs function on focusedRowId toggle
    // would also cause AG Grid to detect a prop change.

    // Return a stable function that reads focusedRowId at call time
    return (params) => {
      // params.data contains the row data
      const rowData = params.data;

      // If no row data, return null
      if (!rowData) {
        return null;
      }

      // Read focusedRowId at call time (not at computed evaluation time)
      // This prevents the computed from re-evaluating when focusedRowId changes
      const focusedRowId = cfg.value?.focusedRowId;
      const hasFocusedRow = focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '';

      // If no conditional styles and no focused row, return null early
      if (!hasConditionalStyles && !hasFocusedRow) {
        return null;
      }

      // Accumulate styles from all matching rules
      // Later rules override earlier ones for conflicting properties
      let mergedStyle = {};

      // Check if this row is the focused row (we'll apply styling at the end)
      let isFocusedRow = false;
      if (hasFocusedRow) {
        // Get the row's ID using the idFormula
        let baseId = resolveMappingFormula
          ? resolveMappingFormula(cfg.value.idFormula, rowData)
          : null;

        // Fallback to common ID fields if formula doesn't return a valid ID
        if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
          baseId = rowData.id || rowData._id || rowData.uuid || rowData.ID || rowData.Id;
        }

        // Compare with focusedRowId (convert both to strings for comparison)
        const baseIdStr = baseId != null ? String(baseId) : '';
        const focusedIdStr = String(focusedRowId);

        isFocusedRow = (baseIdStr === focusedIdStr);
      }

      // Apply conditional row styles FIRST
      if (hasConditionalStyles) {
        for (const rule of conditionalRowStyles) {
          // Skip rules without a condition formula
          if (!rule?.conditionFormula) {
            continue;
          }

          // Evaluate the condition formula with the row data as context
          let conditionResult = false;
          try {
            conditionResult = resolveMappingFormula
              ? resolveMappingFormula(rule.conditionFormula, rowData)
              : false;
          } catch (error) {
            // Log error in debug mode and skip this rule
            debugLog('[Conditional Row Style] Error evaluating condition:', error);
            continue;
          }

          // If condition is true, apply the styles from this rule
          if (conditionResult) {
            // Apply backgroundColor
            if (rule.backgroundColor) {
              mergedStyle.backgroundColor = rule.backgroundColor;
            }

            // Apply textColor (maps to color CSS property)
            if (rule.textColor) {
              mergedStyle.color = rule.textColor;
            }

            // Apply fontWeight
            if (rule.fontWeight) {
              mergedStyle.fontWeight = rule.fontWeight;
            }

            // Apply fontStyle
            if (rule.fontStyle) {
              mergedStyle.fontStyle = rule.fontStyle;
            }

            // Apply border properties
            if (rule.borderLeft) {
              mergedStyle.borderLeft = rule.borderLeft;
            }
            if (rule.borderRight) {
              mergedStyle.borderRight = rule.borderRight;
            }
            if (rule.borderTop) {
              mergedStyle.borderTop = rule.borderTop;
            }
            if (rule.borderBottom) {
              mergedStyle.borderBottom = rule.borderBottom;
            }
          }
        }
      }

      // Apply focused row styling LAST to override conditional styles
      if (isFocusedRow) {
        // Using box-shadow for a left border effect that doesn't affect layout
        mergedStyle.boxShadow = 'inset 4px 0 0 0 var(--ag-range-selection-border-color, #2196F3)';
        // Add a subtle background tint (overrides any conditional backgroundColor)
        mergedStyle.backgroundColor = 'var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1))';
      }

      // Return the merged style object, or null if no styles were applied
      return Object.keys(mergedStyle).length > 0 ? mergedStyle : null;
    };
  });

  // User-initiated column move/resize event handlers (single-grid mode).
  // Group-mode equivalents live in useGrouping and delegate back to these.
  const onColumnMoved = (event) => {
    if (!event.finished || event.source !== "uiColumnMoved") return;
    const columns = event.api.getAllGridColumns().filter(col => !isVirtualColumn(col));
    const newOrder = columns.map((col) => col.getColId());
    setColumnOrder(newOrder);

    // Keep chooser panel in sync so it doesn't show a stale order if open
    const showChooserRef = getShowColumnChooser?.();
    if (showChooserRef?.value) {
      const chooserOrderRef = getChooserColumnOrder?.();
      if (chooserOrderRef) chooserOrderRef.value = newOrder.filter(Boolean);
    }

    // Update currentConfig to reflect the new column order
    const updateCurrentConfig = getUpdateCurrentConfig?.();
    if (updateCurrentConfig) updateCurrentConfig();

    ctx.emit("trigger-event", {
      name: "columnMoved",
      event: {
        toIndex: event.toIndex,
        columnId: event.column.getColId(),
        columnsOrder: columns.map((col) => col.getColId()),
      },
    });
  };

  const onColumnResized = (event) => {
    // Only emit on user-initiated resize that is finished
    if (!event.finished || event.source !== "uiColumnResized") return;

    const columns = event.api.getAllGridColumns();
    const columnsWidths = {};

    // Build an object of all column widths
    columns.forEach((col) => {
      const colId = col.getColId();
      const actualWidth = col.getActualWidth();
      if (colId && actualWidth) {
        columnsWidths[colId] = actualWidth;
      }
    });

    // Update currentConfig to reflect the new column widths
    const updateCurrentConfig = getUpdateCurrentConfig?.();
    if (updateCurrentConfig) updateCurrentConfig();

    // Get the resized column info
    const resizedColumn = event.column;
    const columnId = resizedColumn?.getColId();
    const width = resizedColumn?.getActualWidth();

    ctx.emit("trigger-event", {
      name: "columnResized",
      event: {
        columnId: columnId,
        width: width,
        columnsWidths: columnsWidths,
      },
    });
  };

  return {
    // WeWeb variables
    columnOrder, setColumnOrder,
    hiddenColumns, setHiddenColumns,
    // Helpers
    isVirtualColumn,
    // Computeds
    defaultColDef,
    dataTypeDefinitions,
    rowSelection,
    style,
    cssVars,
    theme,
    rowStyle,
    // Validation tracking refs (consumed by columnDefs + cell-editing in S6)
    _pendingValidationError,
    _validationFiredForCurrentEdit,
    // Event handlers
    onColumnMoved,
    onColumnResized,
  };
}
