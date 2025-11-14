<template>
  <div class="ww-datagrid" :class="{ editing: isEditing, loading: isLoading }" :style="cssVars">
    <ag-grid-vue
      :rowData="rowData"
      :columnDefs="columnDefs"
      :initial-state="initialState"
      :defaultColDef="defaultColDef"
      :domLayout="content.layout === 'auto' ? 'autoHeight' : 'normal'"
      :style="style"
      :rowSelection="rowSelection"
      :selection-column-def="{ pinned: true }"
      :theme="theme"
      :getRowId="getRowId"
      :pagination="content.pagination"
      :paginationPageSize="
        forcedPaginationPageSize
          ? 0
          : paginationPageSizeSelector
          ? paginationPageSizeSelector[0]
          : content.paginationPageSize
      "
      :paginationPageSizeSelector="paginationPageSizeSelector"
      :suppressMovableColumns="!content.movableColumns"
      :columnHoverHighlight="content.columnHoverHighlight"
      :locale-text="localeText"
      enableCellTextSelection
      ensureDomOrder
      :row-drag-managed="true"
      @grid-ready="onGridReady"
      @row-selected="onRowSelected"
      @selection-changed="onSelectionChanged"
      @cell-value-changed="onCellValueChanged"
      @filter-changed="onFilterChanged"
      @sort-changed="onSortChanged"
      @row-clicked="onRowClicked"
      @row-drag-end="onRowDragged"
      @row-drag-enter="onRowDragEnter"
      @column-moved="onColumnMoved"
    >
    </ag-grid-vue>
    
    <!-- Loading Skeleton Overlay -->
    <div v-if="isLoading && columnDefs && columnDefs.length > 0" class="loading-skeleton">
      <div class="skeleton-header">
        <div 
          v-for="(col, index) in columnDefs" 
          :key="index"
          class="skeleton-header-cell"
          :style="getSkeletonCellStyle(col)"
        >
          <div class="skeleton-shimmer"></div>
        </div>
      </div>
      <div class="skeleton-body">
        <div 
          v-for="rowIndex in skeletonRowCount" 
          :key="rowIndex"
          class="skeleton-row"
        >
          <div 
            v-for="(col, colIndex) in columnDefs" 
            :key="colIndex"
            class="skeleton-cell"
            :style="getSkeletonCellStyle(col)"
          >
            <div class="skeleton-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  shallowRef,
  watchEffect,
  computed,
  inject,
  watch,
  nextTick,
  ref,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import {
  AG_GRID_LOCALE_EN,
  AG_GRID_LOCALE_FR,
  AG_GRID_LOCALE_DE,
  AG_GRID_LOCALE_ES,
  AG_GRID_LOCALE_PT,
} from "@ag-grid-community/locale";
import ActionCellRenderer from "./components/ActionCellRenderer.vue";
import ImageCellRenderer from "./components/ImageCellRenderer.vue";
import WewebCellRenderer from "./components/WewebCellRenderer.vue";
import SelectCellRenderer from "./components/SelectCellRenderer.vue";

// TODO: maybe register less modules
// TODO: maybe register modules per grid instead of globally
ModuleRegistry.registerModules([AllCommunityModule]);

export default {
  components: {
    AgGridVue,
    ActionCellRenderer,
    ImageCellRenderer,
    WewebCellRenderer,
    SelectCellRenderer,
  },
  props: {
    content: {
      type: Object,
      required: true,
    },
    uid: {
      type: String,
      required: true,
    },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ["trigger-event", "update:content:effect"],
  setup(props, ctx) {
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    const gridApi = shallowRef(null);
    const { value: selectedRows, setValue: setSelectedRows } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "selectedRows",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: filterValue, setValue: setFilters } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "filters",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: sortValue, setValue: setSort } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "sort",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: columnOrder, setValue: setColumnOrder } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "columnOrder",
        type: "array",
        defaultValue: [],
        readonly: true,
      });

    const gridReady = ref(false);
    
    const onGridReady = (params) => {
      gridApi.value = params.api;
      gridReady.value = true;
      const columns = params.api.getAllGridColumns();
      setColumnOrder(columns.map((col) => col.getColId()));
    };

    let initialFilter = "";
    let initialSort = "";

    watchEffect(() => {
      // Both initial filters and sort should be set here to avoid conflicts with column state application
      // We keep track of previous values to avoid reinitializing one when only the other changes
      if (!gridApi.value) return;
      if (
        props.content.initialFilters &&
        initialFilter !== JSON.stringify(props.content.initialFilters)
      ) {
        gridApi.value.setFilterModel(props.content.initialFilters);
        initialFilter = JSON.stringify(props.content.initialFilters);
      }
      if (
        props.content.initialSort &&
        initialSort !== JSON.stringify(props.content.initialSort)
      ) {
        gridApi.value.applyColumnState({
          state: props.content.initialSort || [],
          defaultState: { sort: null },
        });
        initialSort = JSON.stringify(props.content.initialSort);
      }
    });

    watchEffect(() => {
      if (!gridApi.value) return;
      if (props.content.initialColumnsOrder) {
        gridApi.value.applyColumnState({
          state: props.content.initialColumnsOrder.map((colId) => ({ colId })),
          applyOrder: true,
        });
      }
    });

    const initialState = computed(() => {
      const state = {
        partialColumnState: true,
      };
      if (props.content.initialFilters) {
        state.filter = { filterModel: props.content.initialFilters };
      }
      if (props.content.initialSort) {
        state.sort = { sortModel: props.content.initialSort };
      }
      if (props.content.initialColumnsOrder) {
        state.columnOrder = {
          orderedColIds: props.content.initialColumnsOrder,
        };
      }
      return state;
    });

    const onRowSelected = (event) => {
      const name = event.node.isSelected() ? "rowSelected" : "rowDeselected";
      ctx.emit("trigger-event", {
        name,
        event: { row: event.data },
      });
    };

    const onRowDragged = (event) => {
      const rows = [];
      event.api.forEachNode((node) => {
        rows.push(node.data);
      });
      ctx.emit("trigger-event", {
        name: "rowDragged",
        event: {
          row: event.node.data,
          id: event.node.id,
          targetIndex: event.overIndex,
          rows,
        },
      });
    };

    const onRowDragEnter = (event) => {
      ctx.emit("trigger-event", {
        name: "rowDragStart",
        event: {
          row: event.node.data,
          id: event.node.id,
        },
      });
    };

    const onSelectionChanged = (event) => {
      if (!gridApi.value) return;
      const selected = gridApi.value.getSelectedRows() || [];
      setSelectedRows(selected);
    };

    const onFilterChanged = (event) => {
      if (!gridApi.value) return;
      const filterModel = gridApi.value.getFilterModel();
      if (
        JSON.stringify(filterModel || {}) !==
        JSON.stringify(filterValue.value || {})
      ) {
        setFilters(filterModel);
        ctx.emit("trigger-event", {
          name: "filterChanged",
          event: filterModel,
        });
      }
    };

    const onSortChanged = (event) => {
      if (!gridApi.value) return;
      const state = gridApi.value.getState();
      if (
        JSON.stringify(state.sort?.sortModel || []) !==
        JSON.stringify(sortValue.value || [])
      ) {
        setSort(state.sort?.sortModel || []);
        ctx.emit("trigger-event", {
          name: "sortChanged",
          event: state.sort?.sortModel || [],
        });
      }
    };

    const onColumnMoved = (event) => {
      if (!event.finished || event.source !== "uiColumnMoved") return;
      const columns = event.api.getAllGridColumns();
      setColumnOrder(columns.map((col) => col.getColId()));
      ctx.emit("trigger-event", {
        name: "columnMoved",
        event: {
          toIndex: event.toIndex,
          columnId: event.column.getColId(),
          columnsOrder: columns.map((col) => col.getColId()),
        },
      });
    };

    /* wwEditor:start */
    const { createElement } = wwLib.useCreateElement();
    /* wwEditor:end */

    // Hack to force pagination page size update when changing pagination selector mode
    const forcedPaginationPageSize = ref(false);
    watch(
      () => props.content.hasPaginationSelector,
      (newVal, oldVal) => {
        if (oldVal === "multiple" && newVal !== "multiple") {
          forcedPaginationPageSize.value = true;
          nextTick().then(() => {
            forcedPaginationPageSize.value = false;
          });
        }
      }
    );

    const rowData = computed(() => {
      const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
      return Array.isArray(data) ? data ?? [] : [];
    });
    
    // Detect loading state - show skeleton when grid is not ready or data is not yet available
    const isLoading = computed(() => {
      // Check if grid API is ready
      if (!gridReady.value) return true;
      
      // Check if rowData source is undefined/null (not loaded yet)
      // This handles the case where data is bound but not yet available
      const rawData = props.content?.rowData;
      if (rawData === undefined || rawData === null) {
        return true;
      }
      
      // If we have columns but no data yet, and the data source suggests it's loading
      // (empty array might mean loaded but empty, so we only show skeleton if undefined/null)
      return false;
    });
    
    // Number of skeleton rows to show
    const skeletonRowCount = computed(() => {
      return props.content?.pagination 
        ? (props.content?.paginationPageSize || 10)
        : 8; // Default to 8 rows if no pagination
    });

    function refreshData() {
      nextTick(() => {
        gridApi.value?.refreshCells()
      });
    }

    return {
      resolveMappingFormula,
      onGridReady,
      onRowSelected,
      onSelectionChanged,
      gridApi,
      onFilterChanged,
      onSortChanged,
      localeText: computed(() => {
        switch (props.content.lang) {
          case "fr":
            return AG_GRID_LOCALE_FR;
          case "de":
            return AG_GRID_LOCALE_DE;
          case "es":
            return AG_GRID_LOCALE_ES;
          case "pt":
            return AG_GRID_LOCALE_PT;
          case "custom":
            return {
              ...AG_GRID_LOCALE_EN,
              ...(props.content.localeText || {}),
            };
          default:
            AG_GRID_LOCALE_EN;
        }
      }),
      forcedPaginationPageSize,
      onRowDragged,
      onRowDragEnter,
      onColumnMoved,
      initialState,
      refreshData,
      rowData,
      isLoading,
      skeletonRowCount,
      /* wwEditor:start */
      createElement,
      rawContent: inject("componentRawContent", {}),
      /* wwEditor:end */
    };
  },
  computed: {
    defaultColDef() {
      return {
        editable: false,
        resizable: this.content.resizableColumns,
        autoHeaderHeight: this.content.headerHeightMode === "auto",
        wrapHeaderText: this.content.headerHeightMode === "auto",
        singleClickEdit: true,
        cellClass:
          this.content.cellAlignmentMode === "custom"
            ? `-${this.content.cellAlignment || "left"} ||`
            : null,
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
        },
      };
    },
    columnDefs() {
      const columns = this.content.columns.map((col, index) => {
        const minWidth =
          !col?.minWidth || col?.minWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.minWidth)?.[0];
        const maxWidth =
          !col?.maxWidth || col?.maxWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.maxWidth)?.[0];
        const width =
          !col?.width || col?.width === "auto" || col?.widthAlgo === "flex"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.width)?.[0];
        const flex = col?.widthAlgo === "flex" ? col?.flex ?? 1 : null;
        const commonProperties = {
          minWidth,
          maxWidth,
          pinned: col?.pinned === "none" ? false : col?.pinned,
          width,
          flex,
          hide: !!col?.hide,
          headerClass: col?.headerAlignment ? `-${col?.headerAlignment}` : null,
          ...(this.content.cellAlignmentMode !== "custom"
            ? { cellClass: col?.cellAlignment ? `-${col?.cellAlignment}` : null }
            : {}),
        };
        switch (col?.cellDataType) {
          case "action": {
            return {
              ...commonProperties,
              headerName: col?.headerName,
              cellRenderer: "ActionCellRenderer",
              cellRendererParams: {
                name: col?.actionName,
                label: col?.actionLabel,
                trigger: this.onActionTrigger,
                withFont: !!this.content.actionFont,
              },
              sortable: false,
              filter: false,
              colId: col?.actionName,
            };
          }
          case "custom": {
            const customColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "WewebCellRenderer",
              cellRendererParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
              },
              cellEditor: "WewebCellRenderer",
              cellEditorParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? col?.customFilterType || "agTextColumnFilter" : false,
            };
            
            // Add custom comparator based on filter type for proper sorting
            if (col?.sortable && col?.customFilterType) {
              if (col.customFilterType === "agDateColumnFilter") {
                customColumn.comparator = (valueA, valueB) => {
                  const dateA = valueA ? new Date(valueA).getTime() : 0;
                  const dateB = valueB ? new Date(valueB).getTime() : 0;
                  return dateA - dateB;
                };
              } else if (col.customFilterType === "agNumberColumnFilter") {
                customColumn.comparator = (valueA, valueB) => {
                  const numA = valueA != null ? parseFloat(valueA) : 0;
                  const numB = valueB != null ? parseFloat(valueB) : 0;
                  if (isNaN(numA) && isNaN(numB)) return 0;
                  if (isNaN(numA)) return 1;
                  if (isNaN(numB)) return -1;
                  return numA - numB;
                };
              }
            }
            
            return customColumn;
          }
          case "image": {
            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "ImageCellRenderer",
              cellRendererParams: {
                width: col?.imageWidth,
                height: col?.imageHeight,
              },
            };
          }
          case "select": {
            const selectParams = {
              options: col?.options || [],
              optionsValueFormula: col?.optionsValueFormula,
              optionsLabelFormula: col?.optionsLabelFormula,
              optionsColorFormula: col?.optionsColorFormula,
              resolveMappingFormula: this.resolveMappingFormula,
            };
            
            // Helper function to get label from value
            const getLabelFromValue = (value) => {
              const options = col?.options || [];
              
              // Process options with formula mapping if needed
              const processedOptions = options.map(option => {
                const optionValue = this.resolveMappingFormula(col?.optionsValueFormula, option) ?? option.value;
                const optionLabel = this.resolveMappingFormula(col?.optionsLabelFormula, option) ?? option.label;
                return {
                  value: optionValue || '',
                  label: optionLabel || optionValue || '',
                };
              });
              
              const foundOption = processedOptions.find(opt => opt.value === value);
              return foundOption?.label || value || '';
            };
            
            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "SelectCellRenderer",
              cellRendererParams: selectParams,
              cellEditor: "SelectCellRenderer",
              cellEditorParams: selectParams, // IMPORTANT: Editor needs params too!
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter,
              // Use label for filtering and sorting instead of value
              valueGetter: (params) => {
                return getLabelFromValue(params.data?.[col?.field]);
              },
              // Ensure the raw value (ID) is stored, not the label
              valueSetter: (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              },
              filterValueGetter: (params) => {
                return getLabelFromValue(params.data?.[col?.field]);
              },
            };
          }
          default: {
            const result = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: col?.filter,
              editable: col?.editable,
            };
            if (col?.useCustomLabel) {
              result.valueFormatter = (params) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  params.value
                );
              };
            }
            return result;
          }
        }
      });

      if (this.content.rowReorder && columns[0]) {
        columns[0].rowDrag = true;
      }

      return columns;
    },
    rowSelection() {
      if (this.content.rowSelection === "multiple") {
        return {
          mode: "multiRow",
          checkboxes: !this.content.disableCheckboxes,
          headerCheckbox: !this.content.disableCheckboxes,
          selectAll: this.content.selectAll || "all",
          enableClickSelection: this.content.enableClickSelection,
        };
      } else if (this.content.rowSelection === "single") {
        return {
          mode: "singleRow",
          checkboxes: !this.content.disableCheckboxes,
          enableClickSelection: this.content.enableClickSelection,
        };
      } else {
        return {
          mode: "singleRow",
          checkboxes: false,
          isRowSelectable: () => false,
          enableClickSelection: this.content.enableClickSelection,
        };
      }
    },
    style() {
      if (this.content.layout === "auto") return {};
      return {
        height: this.content.height || "400px",
      };
    },
    cssVars() {
      return {
        "--ww-data-grid_action-backgroundColor":
          this.content.actionBackgroundColor,
        "--ww-data-grid_action-color": this.content.actionColor,
        "--ww-data-grid_action-padding": this.content.actionPadding,
        "--ww-data-grid_action-border": this.content.actionBorder,
        "--ww-data-grid_action-borderRadius": this.content.actionBorderRadius,
        ...(this.content.actionFont
          ? { "--ww-data-grid_action-font": this.content.actionFont }
          : {
              "--ww-data-grid_action-fontSize": this.content.actionFontSize,
              "--ww-data-grid_action-fontFamily": this.content.actionFontFamily,
              "--ww-data-grid_action-fontWeight": this.content.actionFontWeight,
              "--ww-data-grid_action-fontStyle": this.content.actionFontStyle,
              "--ww-data-grid_action-lineHeight": this.content.actionLineHeight,
            }),
      };
    },
    theme() {
      return themeQuartz.withParams({
        headerBackgroundColor: this.content.headerBackgroundColor,
        headerTextColor: this.content.headerTextColor,
        headerFontSize: this.content.headerFontSize,
        headerFontFamily: this.content.headerFontFamily,
        headerFontWeight: this.content.headerFontWeight,
        headerHeight:
          this.content.headerHeightMode !== "auto"
            ? this.content.headerHeight
            : undefined,
        borderColor: this.content.borderColor,
        cellTextColor: this.content.cellColor,
        cellFontFamily: this.content.cellFontFamily,
        dataFontSize: this.content.cellFontSize,
        oddRowBackgroundColor: this.content.rowAlternateColor,
        backgroundColor: this.content.rowBackgroundColor,
        rowHoverColor: this.content.rowHoverColor,
        selectedRowBackgroundColor: this.content.selectedRowBackgroundColor,
        rowVerticalPaddingScale: this.content.rowVerticalPaddingScale || 1,
        menuBackgroundColor: this.content.menuBackgroundColor,
        menuTextColor: this.content.menuTextColor,
        columnHoverColor: this.content.columnHoverColor,
        foregroundColor: this.content.textColor,
        checkboxCheckedBackgroundColor: this.content.selectionCheckboxColor,
        rangeSelectionBorderColor: this.content.cellSelectionBorderColor,
        checkboxUncheckedBorderColor: this.content.checkboxUncheckedBorderColor,
        focusShadow: this.content.focusShadow?.length
          ? this.content.focusShadow
          : undefined,
        wrapperBorderRadius: this.content.wrapperBorderRadius,
      });
    },
    isEditing() {
      /* wwEditor:start */
      return (
        this.wwEditorState.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION
      );
      /* wwEditor:end */
      // eslint-disable-next-line no-unreachable
      return false;
    },
    paginationPageSizeSelector() {
      if (
        !this.content.pagination ||
        this.content.hasPaginationSelector !== "multiple"
      ) {
        return false;
      }
      if (
        !Array.isArray(this.content.paginationPageSizeSelector) ||
        this.content.paginationPageSizeSelector.length === 0
      ) {
        return false;
      }
      return this.content.paginationPageSizeSelector;
    },
  },
  methods: {
    getRowId(params) {
      return this.resolveMappingFormula(this.content.idFormula, params.data);
    },
    getSkeletonCellStyle(col) {
      const style = {};
      if (col.flex) {
        style.flex = col.flex;
        style.minWidth = col.minWidth || '100px';
        if (col.maxWidth) {
          style.maxWidth = col.maxWidth;
        }
      } else if (col.width) {
        style.width = col.width;
      } else {
        style.width = '150px';
      }
      return style;
    },
    onActionTrigger(event) {
      this.$emit("trigger-event", {
        name: "action",
        event,
      });
    },
    onCellValueChanged(event) {
      // Find the column configuration to get isDirectUpdate
      const columnId = event.column.getColId();
      const columnConfig = this.content.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      // For select columns: read the value directly from the data to ensure we get the ID, not the label
      // The valueSetter ensures the actual value (ID) is stored in the data field
      const newValue = event.data?.[columnId];
      const oldValue = event.oldValue;
      
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: newValue, // Actual ID/value from the data field
          columnId: columnId,
          row: event.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    onRowClicked(event) {
      this.$emit("trigger-event", {
        name: "rowClicked",
        event: {
          row: event.data,
          id: event.node.id,
          index: event.node.sourceRowIndex,
          displayIndex: event.rowIndex,
        },
      });
    },
    onCustomCellEdit(event) {
      this.$emit("trigger-event", {
        name: event.type,
        event: {
          columnId: event.columnId,
          field: event.field,
          value: event.value,
          row: event.row,
          id: event.id,
          index: event.index,
          displayIndex: event.displayIndex,
        },
      });
    },
    triggerCellValueChanged(rowId, columnId, newValue) {
      if (!this.gridApi) {
        console.log("Grid API is not initialized yet");
        return;
      }
      
      // Try to get the row node
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found and rowId is a number, try converting to string and vice versa
      if (!rowNode) {
        const alternativeId = typeof rowId === 'number' ? String(rowId) : Number(rowId);
        if (!isNaN(alternativeId)) {
          rowNode = this.gridApi.getRowNode(alternativeId);
        }
      }
      
      // If still not found, search through all rows by matching the ID formula
      if (!rowNode) {
        this.gridApi.forEachNode((node) => {
          if (!rowNode) {
            // Get the ID using the same formula as getRowId
            const nodeId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // Try exact match first
            if (nodeId === rowId) {
              rowNode = node;
            }
            // Try string comparison
            else if (String(nodeId) === String(rowId)) {
              rowNode = node;
            }
          }
        });
      }
      
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
      const columnConfig = this.content.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      if (!columnConfig) {
        console.log(`Column "${columnId}" not found in column configuration`);
      }
      
      // Update the data directly
      rowNode.data[columnId] = newValue;
      
      // Refresh the cells to show the updated value
      this.gridApi.refreshCells({
        rowNodes: [rowNode],
        columns: [columnId],
        force: true,
      });
      
      // Manually trigger the event (bypassing AG Grid's event)
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: newValue,
          columnId: columnId,
          row: rowNode.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    stopCellEditing(cancel = false) {
      if (!this.gridApi) return;
      this.gridApi.stopEditing(cancel);
    },
    resetFilters() {
      if (!this.gridApi) return;
      this.gridApi.setFilterModel(null);
    },
    resetSort() {
      if (!this.gridApi) return;
      this.gridApi.applyColumnState({
        state: [],
        defaultState: { sort: null },
      });
    },
    deselectAll() {
      if (!this.gridApi) return;
      this.gridApi.deselectAll();
    },
    selectAll(mode) {
      if (!this.gridApi) return;
      if (this.content.rowSelection !== "multiple") {
        wwLib.logStore.warning(
          "Select all will have no effect, as row selection is not set to multiple"
        );
        return;
      }
      this.gridApi.selectAll(mode || this.content.selectAll || "all");
    },
    selectRow(rowId) {
      if (!this.gridApi) return;
      const rowNode = this.gridApi.getRowNode(rowId);
      if (rowNode) {
        rowNode.setSelected(true);
      }
    },
    deselectRow(rowId) {
      if (!this.gridApi) return;
      const rowNode = this.gridApi.getRowNode(rowId);
      if (rowNode) {
        rowNode.setSelected(false);
      }
    },
    /* wwEditor:start */
    generateColumns() {
      this.$emit("update:content", {
        columns: this.rowData?.[0]
          ? Object.keys(this.rowData[0]).map((key) => ({
              field: key,
              sortable: true,
              filter: true,
            }))
          : [],
      });
    },
    getOnActionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        actionName: "actionName",
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getOnCellValueChangedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.content.columns || [];
      const firstEditableColumn = columns.find(
        (col) => col?.editable && (col?.cellDataType !== "action" && col?.cellDataType !== "image")
      );
      return {
        oldValue: "oldValue",
        newValue: "newValue",
        columnId: firstEditableColumn?.field || "columnId",
        row: data[0],
        isDirectUpdate: firstEditableColumn?.isDirectUpdate || false,
      };
    },
    getSelectionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
      };
    },
    getRowClickedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getRowDraggedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        targetIndex: 1,
        rows: data,
      };
    },
    getRowDragStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
      };
    },
    getColumnMovedTestEvent() {
      const data = this.columnDefs;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        toIndex: 1,
        columnId: data[0].field,
        columnsOrder: data.map((col) => col.field),
      };
    },
    getCellEditStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getCellEditEndTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    /* wwEditor:end */
  },
  /* wwEditor:start */
  watch: {
    columnDefs: {
      async handler() {
        if (this.wwEditorState?.boundProps?.columns) return;
        this.gridApi?.resetColumnState();

        if (this.wwEditorState.isACopy) return;

        // We assume there will only be one custom column each time
        const columnIndex = (this.rawContent.columns || []).findIndex(
          (col) => col?.cellDataType === "custom" && !col?.containerId
        );
        if (columnIndex === -1) return;
        const newColumns = [...this.rawContent.columns];
        let column = { ...newColumns[columnIndex] };
        column.containerId = await this.createElement("ww-flexbox", {
          _state: { name: `Cell ${column.headerName || column.field}` },
        });
        newColumns[columnIndex] = column;
        this.$emit("update:content:effect", { columns: newColumns });
      },
      deep: true,
    },
  },
  /* wwEditor:end */
};
</script>

<style scoped lang="scss">
.ww-datagrid {
  position: relative;
  isolation: isolate; // Create a new stacking context to contain AG Grid elements
  
  :deep(.ag-cell-wrapper),
  :deep(.ag-cell-value) {
    height: 100%;
  }
  
  :deep(.ag-header-cell) {
    &.-center .ag-header-cell-label {
      justify-content: center;
    }
    &.-right {
      .ag-header-cell-label {
        justify-content: flex-end;
      }
      .ag-header-cell-filter-button {
        margin-left: 4px;
      }
    }
    &.-left .ag-header-cell-label {
      justify-content: flex-start;
    }
  }
  
  // Control z-index of filter menus and floating panels only
  // These are the elements that appear above the grid
  :deep(.ag-popup) {
    z-index: 1000 !important; // Reasonable z-index for filter menus
  }
  
  :deep(.ag-filter-wrapper) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-column-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-filter) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-cell) {
    .ag-cell-value {
      display: flex;
    }

    &.-right {
      .ag-cell-value {
        justify-content: flex-end;
      }
    }
    &.-center {
      .ag-cell-value {
        justify-content: center;
      }
    }
    &.-left {
      .ag-cell-value {
        justify-content: flex-start;
      }
    }
    
    // Remove default padding for select column cells
    &:has(.select-cell) {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  }
  
  /* wwEditor:start */
  &.editing {
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: initial;
      z-index: 10;
    }
  }
  /* wwEditor:end */
  
  // Hide grid content when loading
  &.loading {
    :deep(.ag-root-wrapper) {
      opacity: 0;
      pointer-events: none;
    }
  }
  
  // Loading skeleton overlay
  .loading-skeleton {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    background: var(--ag-background-color, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    
    .skeleton-header {
      display: flex;
      border-bottom: 1px solid var(--ag-border-color, #e2e8f0);
      background: var(--ag-header-background-color, #f8fafc);
      min-height: var(--ag-header-height, 48px);
      width: 100%;
      
      .skeleton-header-cell {
        padding: 12px 16px;
        border-right: 1px solid var(--ag-border-color, #e2e8f0);
        display: flex;
        align-items: center;
        flex-shrink: 0;
        
        &:last-child {
          border-right: none;
        }
        
        .skeleton-shimmer {
          width: 60%;
          height: 16px;
          background: linear-gradient(
            90deg,
            var(--ag-header-background-color, #f8fafc) 0%,
            #e2e8f0 50%,
            var(--ag-header-background-color, #f8fafc) 100%
          );
          background-size: 200% 100%;
          border-radius: 4px;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      }
    }
    
    .skeleton-body {
      flex: 1;
      overflow-y: auto;
      
      .skeleton-row {
        display: flex;
        border-bottom: 1px solid var(--ag-border-color, #e2e8f0);
        min-height: calc(var(--ag-row-height, 42px) * var(--ag-row-vertical-padding-scale, 1));
        background: var(--ag-background-color, #ffffff);
        width: 100%;
        
        &:nth-child(even) {
          background: var(--ag-odd-row-background-color, var(--ag-background-color, #ffffff));
        }
        
        .skeleton-cell {
          padding: 12px 16px;
          border-right: 1px solid var(--ag-border-color, #e2e8f0);
          display: flex;
          align-items: center;
          flex-shrink: 0;
          
          &:last-child {
            border-right: none;
          }
          
          .skeleton-shimmer {
            height: 14px;
            background: linear-gradient(
              90deg,
              var(--ag-background-color, #ffffff) 0%,
              #e2e8f0 50%,
              var(--ag-background-color, #ffffff) 100%
            );
            background-size: 200% 100%;
            border-radius: 4px;
            animation: shimmer 1.5s ease-in-out infinite;
          }
          
          // Vary the width for visual interest
          &:nth-child(1) .skeleton-shimmer { width: 80%; }
          &:nth-child(2) .skeleton-shimmer { width: 60%; }
          &:nth-child(3) .skeleton-shimmer { width: 90%; }
          &:nth-child(4) .skeleton-shimmer { width: 50%; }
          &:nth-child(5) .skeleton-shimmer { width: 75%; }
          &:nth-child(n+6) .skeleton-shimmer { width: 70%; }
        }
      }
    }
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
