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
      // Mirrors `:rowHeight="cfg.rowHeight ?? 40"` so CSS rules that need
      // the row height (e.g. empty-group min-height) follow the configured
      // value rather than relying on AG Grid's --ag-row-height being set.
      "--ww-data-grid_row-height": `${Number(cfg.value.rowHeight) || 40}px`,
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
    // Returns a function AG Grid calls per row to compute its style.
    //
    // PERFORMANCE: We only use conditionalRowStyles as a reactive dependency.
    // focusedRowId is read at call time (inside the returned function) so
    // changing the focused row does NOT re-evaluate this computed and return
    // a new function reference — which would force AG Grid to re-render all
    // rows. The focusedRowId watcher handles targeted redraws.
    const conditionalRowStyles = props.content?.conditionalRowStyles;
    const hasConditionalStyles = Array.isArray(conditionalRowStyles) && conditionalRowStyles.length > 0;

    // Pre-compile conditional rules once per conditionalRowStyles change into
    // a flat array of (rowData) => mergedStyleObject|null closures. This
    // hoists the per-rule field lookups out of the per-row hot path.
    const compiledRules = hasConditionalStyles
      ? conditionalRowStyles
          .filter(r => r && r.conditionFormula)
          .map(rule => {
            // Pre-extract the style object that gets applied if condition matches
            const styleToApply = {};
            if (rule.backgroundColor) styleToApply.backgroundColor = rule.backgroundColor;
            if (rule.textColor) styleToApply.color = rule.textColor;
            if (rule.fontWeight) styleToApply.fontWeight = rule.fontWeight;
            if (rule.fontStyle) styleToApply.fontStyle = rule.fontStyle;
            if (rule.borderLeft) styleToApply.borderLeft = rule.borderLeft;
            if (rule.borderRight) styleToApply.borderRight = rule.borderRight;
            if (rule.borderTop) styleToApply.borderTop = rule.borderTop;
            if (rule.borderBottom) styleToApply.borderBottom = rule.borderBottom;
            const formula = rule.conditionFormula;
            return (rowData) => {
              try {
                return resolveMappingFormula && resolveMappingFormula(formula, rowData)
                  ? styleToApply
                  : null;
              } catch (error) {
                debugLog('[Conditional Row Style] Error evaluating condition:', error);
                return null;
              }
            };
          })
      : null;

    return (params) => {
      const rowData = params.data;
      if (!rowData) return null;

      const focusedRowId = cfg.value?.focusedRowId;
      const hasFocusedRow = focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '';

      if (!compiledRules && !hasFocusedRow) return null;

      let isFocusedRow = false;
      if (hasFocusedRow) {
        // Cache the resolved baseId on the node so repeated style evaluations
        // for the same row data don't re-run the (potentially expensive)
        // idFormula. Invalidate when node.data identity changes.
        const node = params.node;
        let baseId;
        if (node && node.__cachedBaseIdSrc === rowData) {
          baseId = node.__cachedBaseId;
        } else {
          baseId = resolveMappingFormula
            ? resolveMappingFormula(cfg.value.idFormula, rowData)
            : null;
          if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
            baseId = rowData.id || rowData._id || rowData.uuid || rowData.ID || rowData.Id;
          }
          if (node) {
            node.__cachedBaseIdSrc = rowData;
            node.__cachedBaseId = baseId;
          }
        }
        const baseIdStr = baseId != null ? String(baseId) : '';
        isFocusedRow = (baseIdStr === String(focusedRowId));
      }

      let mergedStyle = null;
      if (compiledRules) {
        for (let i = 0; i < compiledRules.length; i++) {
          const ruleStyle = compiledRules[i](rowData);
          if (ruleStyle) {
            if (!mergedStyle) mergedStyle = {};
            Object.assign(mergedStyle, ruleStyle);
          }
        }
      }

      if (isFocusedRow) {
        if (!mergedStyle) mergedStyle = {};
        mergedStyle.boxShadow = 'inset 4px 0 0 0 var(--ag-range-selection-border-color, #2196F3)';
        mergedStyle.backgroundColor = 'var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1))';
      }

      return mergedStyle;
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
