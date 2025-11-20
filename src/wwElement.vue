<template>
  <div class="ww-datagrid" :class="{ editing: isEditing }" :style="cssVars" ref="gridContainerRef">
    <ag-grid-vue
      :components="gridComponents"
      :rowData="rowData"
      :columnDefs="columnDefs"
      :initial-state="initialState"
      :defaultColDef="defaultColDef"
      :dataTypeDefinitions="dataTypeDefinitions"
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
      :invalidEditValueMode="invalidEditValueMode"
      enableCellTextSelection
      ensureDomOrder
      :row-drag-managed="true"
      @grid-ready="onGridReady"
      @row-selected="onRowSelected"
      @selection-changed="onSelectionChanged"
      @cell-value-changed="onCellValueChanged"
      @cell-edit-request="onCellEditRequest"
      @filter-changed="onFilterChanged"
      @sort-changed="onSortChanged"
      @row-clicked="onRowClicked"
      @row-drag-end="onRowDragged"
      @row-drag-enter="onRowDragEnter"
      @column-moved="onColumnMoved"
      @body-scroll="onBodyScroll"
    >
    </ag-grid-vue>
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
  onBeforeUnmount,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  ValidationModule,
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
import SelectFilterComponent from "./components/SelectFilterComponent.vue";
import SelectFilterWrapper from "./components/SelectFilterWrapper.js";
import DateCellEditor from "./components/DateCellEditor.vue";
import UserCellRenderer from "./components/UserCellRenderer.vue";
import UserFilterComponent from "./components/UserFilterComponent.vue";
import UserFilterWrapper from "./components/UserFilterWrapper.js";

// TODO: maybe register less modules
// TODO: maybe register modules per grid instead of globally
// ValidationModule is REQUIRED for getValidationErrors to work
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

export default {
  components: {
    AgGridVue,
    ActionCellRenderer,
    ImageCellRenderer,
    WewebCellRenderer,
    SelectCellRenderer,
    SelectFilterComponent,
    UserCellRenderer,
    UserFilterComponent,
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
    const dataRendered = ref(false);
    const dataLoadingTimeout = ref(null);
    const gridContainerRef = ref(null);

    const onGridReady = (params) => {
      gridApi.value = params.api;
      gridReady.value = true;
      const columns = params.api.getAllGridColumns();
      
      // Only set column order from grid if initialColumnsOrder is not provided
      // Otherwise, use the initialColumnsOrder from props
      if (props.content.initialColumnsOrder && Array.isArray(props.content.initialColumnsOrder)) {
        setColumnOrder([...props.content.initialColumnsOrder]);
      } else {
        setColumnOrder(columns.map((col) => col.getColId()));
      }
      
      // If data is already present when grid is ready, mark as rendered after a short delay
      nextTick(() => {
        if (rowData.value && rowData.value.length > 0) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              dataRendered.value = true;
            }, 200);
          });
        } else {
          // Empty data means it's loaded
          dataRendered.value = true;
        }
      });
    };

    let initialFilter = "";
    let initialSort = "";
    let initialColumnsOrder = "";

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
      if (
        props.content.initialColumnsOrder &&
        Array.isArray(props.content.initialColumnsOrder) &&
        initialColumnsOrder !== JSON.stringify(props.content.initialColumnsOrder)
      ) {
        gridApi.value.applyColumnState({
          state: props.content.initialColumnsOrder.map((colId) => ({ colId })),
          applyOrder: true,
        });
        // Update the column order variable to match
        setColumnOrder([...props.content.initialColumnsOrder]);
        initialColumnsOrder = JSON.stringify(props.content.initialColumnsOrder);
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
      if (props.content.initialColumnsOrder && Array.isArray(props.content.initialColumnsOrder)) {
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

    // Track scroll debounce timer
    const scrollDebounceTimer = ref(null);

    // Cleanup on unmount
    onBeforeUnmount(() => {
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
    });

    const onBodyScroll = (event) => {
      if (!gridApi.value) return;
      
      const api = event?.api || gridApi.value;
      
      // Get scroll container dimensions from the grid container ref
      if (!gridContainerRef.value) return;
      
      const scrollContainer = gridContainerRef.value.querySelector('.ag-body-viewport');
      if (!scrollContainer) return;
      
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const scrollTopPos = scrollContainer.scrollTop || event?.top || 0;
      const scrollLeftPos = scrollContainer.scrollLeft || event?.left || 0;
      
      // Calculate if near bottom (within 100px of bottom)
      const distanceFromBottom = scrollHeight - (scrollTopPos + clientHeight);
      const isNearBottom = distanceFromBottom <= 100;
      const isAtBottom = distanceFromBottom <= 5;
      
      // Debounce to avoid too many events
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      
      scrollDebounceTimer.value = setTimeout(() => {
        // Emit scroll event with useful information for pagination management
        ctx.emit("trigger-event", {
          name: "scroll",
          event: {
            scrollTop: scrollTopPos,
            scrollLeft: scrollLeftPos,
            scrollHeight: scrollHeight,
            clientHeight: clientHeight,
            distanceFromBottom: distanceFromBottom,
            isNearBottom: isNearBottom,
            isAtBottom: isAtBottom,
            totalRows: api.getDisplayedRowCount() || 0,
          },
        });
      }, 100); // 100ms debounce to reduce event frequency
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

    // Track if we've ever rendered data (for initial load detection)
    const hasEverRendered = ref(false);

    // Watch for data changes to detect loading state
    watch(() => rowData.value, (newData, oldData) => {
      // If we've already rendered data once, don't show loading skeleton for updates
      // This prevents select cells from flickering when bound data is updated
      if (hasEverRendered.value) {
        // Data is being updated, not initially loaded - keep rendered state
        if (Array.isArray(newData) && newData.length > 0) {
          dataRendered.value = true;
        } else if (Array.isArray(newData) && newData.length === 0) {
          dataRendered.value = true;
        }
        return;
      }

      // Initial load: show loading skeleton until rendered
      if (newData !== oldData && Array.isArray(newData) && newData.length > 0) {
        dataRendered.value = false;
        // Clear any existing timeout
        if (dataLoadingTimeout.value) {
          clearTimeout(dataLoadingTimeout.value);
        }
        // Wait for AG Grid to render, then mark as rendered
        nextTick(() => {
          if (gridApi.value) {
            // Use requestAnimationFrame to wait for render cycle
            requestAnimationFrame(() => {
              setTimeout(() => {
                dataRendered.value = true;
                hasEverRendered.value = true;
              }, 200); // Give time for all cells (especially select cells) to render
            });
          }
        });
      } else if (Array.isArray(newData) && newData.length === 0) {
        // Empty data means it's loaded (just empty)
        dataRendered.value = true;
        hasEverRendered.value = true;
      }
    }, { deep: true, immediate: true });

    // Detect loading state - show skeleton when grid is not ready or data is not yet rendered
    const isLoading = computed(() => {
      // Check if grid API is ready
      if (!gridReady.value) return true;
      
      // Check if rowData source is undefined/null (not loaded yet)
      const rawData = props.content?.rowData;
      if (rawData === undefined || rawData === null) {
        return true;
      }
      
      // If we have data but it hasn't been rendered yet, show skeleton
      const data = rowData.value;
      if (Array.isArray(data) && data.length > 0 && !dataRendered.value) {
        return true;
      }
      
      return false;
    });

    function refreshData() {
      nextTick(() => {
        gridApi.value?.refreshCells()
      });
    }

    const gridComponents = {
      ActionCellRenderer,
      ImageCellRenderer,
      WewebCellRenderer,
      SelectCellRenderer,
      SelectFilterComponent,
      DateCellEditor,
      UserCellRenderer,
      UserFilterComponent,
    };

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
      onBodyScroll,
      gridContainerRef,
      initialState,
      refreshData,
      rowData,
      isLoading,
      gridComponents,
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
        // Note: cellEditorParams with getValidationErrors is added per-column,
        // not in defaultColDef, to allow column-specific validation rules
      };
    },
    dataTypeDefinitions() {
      const definitions = {
        dateString: {
          baseDataType: 'dateString',
          valueParser: (params) => {
            if (params.newValue == null || params.newValue === '') {
              return null;
            }
            return params.newValue;
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            return params.value;
          },
          dataTypeMatcher: (value) => typeof value === 'string' && !isNaN(Date.parse(value)),
        },
      };

      console.log('[Validation Debug] Data type definitions:', definitions);

      return definitions;
    },
    columnDefs() {
      // First, map all columns to their definitions
      const columnsMap = new Map();

      console.log('[Validation Debug] Column definitions being built', {
        columns: this.content.columns,
        validationMode: this.content.invalidEditValueMode,
      });

      // Helper to get validation errors for a value
      const getValidationErrors = (col, newValue, rowData) => {
        console.log('[Validation Debug] getValidationErrors called', {
          column: col?.field || col?.headerName,
          newValue,
          rowData,
          validationRules: col?.validation,
          hasValidation: !!col?.validation,
          isArray: Array.isArray(col?.validation),
        });

        if (!col?.validation || !Array.isArray(col.validation)) {
          console.log('[Validation Debug] No validation rules found or not an array');
          return null;
        }

        const errors = [];

        for (const rule of col.validation) {
          if (!rule?.type) {
            console.log('[Validation Debug] Skipping rule without type:', rule);
            continue;
          }

          console.log('[Validation Debug] Checking rule:', {
            type: rule.type,
            value: rule.value,
            message: rule.message,
            custom: rule.custom,
          });

          let isValid = true;
          let errorMessage = null;

          switch (rule.type) {
            case 'required':
              isValid = newValue !== null && newValue !== undefined && newValue !== '';
              errorMessage = rule.message || 'This field is required.';
              console.log('[Validation Debug] Required check:', {
                newValue,
                isValid,
                result: newValue !== null && newValue !== undefined && newValue !== '',
              });
              break;

            case 'minLength':
              if (newValue !== null && newValue !== undefined && newValue !== '') {
                const minLength = parseInt(rule.value);
                if (!isNaN(minLength) && String(newValue).length < minLength) {
                  isValid = false;
                  errorMessage = rule.message || `Value must be at least ${minLength} characters long.`;
                }
                console.log('[Validation Debug] MinLength check:', {
                  newValue,
                  valueLength: String(newValue).length,
                  minLength,
                  isValid: String(newValue).length >= minLength,
                });
              }
              break;

            case 'maxLength':
              if (newValue !== null && newValue !== undefined && newValue !== '') {
                const maxLength = parseInt(rule.value);
                if (!isNaN(maxLength) && String(newValue).length > maxLength) {
                  isValid = false;
                  errorMessage = rule.message || `Value must be at most ${maxLength} characters long.`;
                }
                console.log('[Validation Debug] MaxLength check:', {
                  newValue,
                  valueLength: String(newValue).length,
                  maxLength,
                  isValid: String(newValue).length <= maxLength,
                });
              }
              break;

            case 'min':
              if (newValue !== null && newValue !== undefined && newValue !== '') {
                const min = Number(rule.value);
                const numValue = Number(newValue);
                if (!isNaN(min) && !isNaN(numValue) && numValue < min) {
                  isValid = false;
                  errorMessage = rule.message || `Value must be at least ${min}.`;
                }
                console.log('[Validation Debug] Min check:', {
                  newValue,
                  numValue,
                  min,
                  isValid: numValue >= min,
                });
              }
              break;

            case 'max':
              if (newValue !== null && newValue !== undefined && newValue !== '') {
                const max = Number(rule.value);
                const numValue = Number(newValue);
                if (!isNaN(max) && !isNaN(numValue) && numValue > max) {
                  isValid = false;
                  errorMessage = rule.message || `Value must be at most ${max}.`;
                }
                console.log('[Validation Debug] Max check:', {
                  newValue,
                  numValue,
                  max,
                  isValid: numValue <= max,
                });
              }
              break;

            case 'pattern':
              if (newValue !== null && newValue !== undefined && newValue !== '' && rule.value) {
                try {
                  const regex = new RegExp(rule.value);
                  const matches = regex.test(String(newValue));
                  if (!matches) {
                    isValid = false;
                    errorMessage = rule.message || 'Value does not match the required pattern.';
                  }
                  console.log('[Validation Debug] Pattern check:', {
                    newValue,
                    pattern: rule.value,
                    matches,
                    isValid: matches,
                  });
                } catch (e) {
                  console.warn('[Validation Debug] Invalid regex pattern:', rule.value, e);
                  // If pattern is invalid, don't fail validation
                }
              }
              break;

            case 'custom':
              if (rule.custom) {
                // Create context with new value for the field
                const validationContext = { ...rowData, [col.field]: newValue };
                console.log('[Validation Debug] Custom validation context:', validationContext);
                const result = this.resolveMappingFormula(rule.custom, validationContext);
                console.log('[Validation Debug] Custom validation result:', result);
                // Formula should return true for valid, false for invalid
                isValid = Boolean(result);
                errorMessage = rule.message || 'Custom validation failed.';
                console.log('[Validation Debug] Custom check:', {
                  formula: rule.custom,
                  result,
                  isValid,
                });
              }
              break;
          }

          if (!isValid && errorMessage) {
            console.log('[Validation Debug] Validation failed for rule:', {
              type: rule.type,
              errorMessage,
            });
            errors.push(errorMessage);
          } else {
            console.log('[Validation Debug] Validation passed for rule:', rule.type);
          }
        }

        const finalResult = errors.length > 0 ? errors : null;
        console.log('[Validation Debug] Final validation result:', {
          errorsCount: errors.length,
          errors,
          finalResult,
        });

        return finalResult;
      };

      // Helper to create value setter (validation is handled separately via getValidationErrors)
      const getValueSetter = (col, customSetter) => {
        return (params) => {
          const { newValue, oldValue, data } = params;

          // If custom setter provided, use it
          if (customSetter) {
            return customSetter(params);
          }
          
          // Default behavior
          if (newValue !== oldValue) {
             data[col.field] = newValue;
             return true;
          }
          return false;
        };
      };
      const allColumnDefs = this.content.columns.map((col, index) => {
        console.log('[Validation Debug] Processing column', {
          index,
          field: col?.field,
          headerName: col?.headerName,
          cellDataType: col?.cellDataType,
          editable: col?.editable,
          validation: col?.validation,
        });

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

        // Build cellClass array for column-specific styling
        const cellClasses = [];
        if (this.content.cellAlignmentMode !== "custom" && col?.cellAlignment) {
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
          hide: !!col?.hide,
          headerClass: col?.headerAlignment ? `-${col?.headerAlignment}` : null,
          ...(cellClasses.length > 0 ? { cellClass: cellClasses } : {}),
          valueSetter: getValueSetter(col),
        };

        const cellDataType = col?.cellDataType;
        console.log('[Validation Debug] Column cellDataType:', {
          field: col?.field,
          cellDataType,
          typeof: typeof cellDataType,
          isUndefined: cellDataType === undefined,
        });

        switch (cellDataType) {
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
            console.log('[Validation Debug] Building custom column', {
              field: col?.field,
              editable: col?.editable,
              validation: col?.validation,
            });

            const customColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "WewebCellRenderer",
              cellRendererParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
                suppressRowInteraction: col?.suppressRowInteraction,
              },
              cellEditor: "WewebCellRenderer",
              cellEditorParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
                suppressRowInteraction: col?.suppressRowInteraction,
                getValidationErrors: (params) => {
                  console.log('[Validation Debug] Custom column getValidationErrors called', {
                    params,
                    columnField: col?.field,
                    columnValidation: col?.validation,
                  });
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? col?.customFilterType || "agTextColumnFilter" : false,
            };

            console.log('[Validation Debug] Custom column built', {
              field: customColumn.field,
              editable: customColumn.editable,
              hasCellEditorParams: !!customColumn.cellEditorParams,
              hasGetValidationErrors: !!customColumn.cellEditorParams?.getValidationErrors,
            });
            
            // Use display value for filtering and sorting if enabled
            if (col?.useDisplayValueForFilterSort && col?.displayLabelFormula) {
              // Helper function to get display value from raw value
              const getDisplayValue = (rawValue) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  rawValue
                );
              };
              
              // Use display value for filtering
              customColumn.filterValueGetter = (params) => {
                const rawValue = params.data?.[col?.field];
                return getDisplayValue(rawValue);
              };
              
              // Use display value for sorting with custom comparator
              if (col?.sortable) {
                customColumn.comparator = (valueA, valueB, nodeA, nodeB) => {
                  const rawValueA = nodeA?.data?.[col?.field];
                  const rawValueB = nodeB?.data?.[col?.field];
                  const displayValueA = getDisplayValue(rawValueA);
                  const displayValueB = getDisplayValue(rawValueB);
                  
                  // Handle null/undefined values
                  if (displayValueA == null && displayValueB == null) return 0;
                  if (displayValueA == null) return 1;
                  if (displayValueB == null) return -1;
                  
                  // Use filter type to determine comparison method
                  if (col?.customFilterType === "agDateColumnFilter") {
                    const dateA = displayValueA ? new Date(displayValueA).getTime() : 0;
                    const dateB = displayValueB ? new Date(displayValueB).getTime() : 0;
                    return dateA - dateB;
                  } else if (col?.customFilterType === "agNumberColumnFilter") {
                    const numA = displayValueA != null ? parseFloat(displayValueA) : 0;
                    const numB = displayValueB != null ? parseFloat(displayValueB) : 0;
                    if (isNaN(numA) && isNaN(numB)) return 0;
                    if (isNaN(numA)) return 1;
                    if (isNaN(numB)) return -1;
                    return numA - numB;
                  } else {
                    // Text comparison
                    return String(displayValueA).localeCompare(String(displayValueB));
                  }
                };
              }
            } else {
              // Add custom comparator based on filter type for proper sorting (when not using display value)
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
            }
            
            return customColumn;
          }
          case "dateString":
          case "dateTime": {
            console.log('[Validation Debug] Building date column', {
              field: col?.field,
              editable: col?.editable,
              validation: col?.validation,
            });

            // Helper function to format date based on configuration
            const formatDateValue = (value) => {
              if (!value) return '';
              const date = new Date(value);
              if (isNaN(date.getTime())) return value;

              const dateFormat = col?.dateFormat || 'auto';
              const timeFormat = col?.timeFormat || 'HH:mm';

              // Format date part
              let formattedDate;
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const year = date.getFullYear();
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const monthName = monthNames[date.getMonth()];

              switch (dateFormat) {
                case 'DD/MM/YYYY':
                  formattedDate = `${day}/${month}/${year}`;
                  break;
                case 'MM/DD/YYYY':
                  formattedDate = `${month}/${day}/${year}`;
                  break;
                case 'YYYY-MM-DD':
                  formattedDate = `${year}-${month}-${day}`;
                  break;
                case 'DD MMM YYYY':
                  formattedDate = `${day} ${monthName} ${year}`;
                  break;
                case 'auto':
                default:
                  formattedDate = date.toLocaleDateString();
                  break;
              }

              // Add time part for dateTime type
              if (col?.cellDataType === 'dateTime') {
                const hours24 = date.getHours();
                const hours12 = hours24 % 12 || 12;
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                const ampm = hours24 >= 12 ? 'PM' : 'AM';
                const hours24Str = String(hours24).padStart(2, '0');
                const hours12Str = String(hours12).padStart(2, '0');

                let formattedTime;
                switch (timeFormat) {
                  case 'HH:mm:ss':
                    formattedTime = `${hours24Str}:${minutes}:${seconds}`;
                    break;
                  case 'hh:mm A':
                    formattedTime = `${hours12Str}:${minutes} ${ampm}`;
                    break;
                  case 'HH:mm':
                  default:
                    formattedTime = `${hours24Str}:${minutes}`;
                    break;
                }

                return `${formattedDate} ${formattedTime}`;
              }

              return formattedDate;
            };

            const dateColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: col?.filter ? 'agDateColumnFilter' : false,
              editable: col?.editable,
              cellEditor: 'DateCellEditor',
              cellEditorParams: {
                isDateTime: col?.cellDataType === 'dateTime',
                getValidationErrors: (params) => {
                  console.log('[Validation Debug] Date column getValidationErrors called', {
                    params,
                    columnField: col?.field,
                    columnValidation: col?.validation,
                  });
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              valueFormatter: (params) => formatDateValue(params.value),
              // Date comparator for proper sorting
              comparator: (valueA, valueB) => {
                const dateA = valueA ? new Date(valueA).getTime() : 0;
                const dateB = valueB ? new Date(valueB).getTime() : 0;
                return dateA - dateB;
              },
            };

            console.log('[Validation Debug] Date column built', {
              field: dateColumn.field,
              editable: dateColumn.editable,
              hasCellEditorParams: !!dateColumn.cellEditorParams,
              hasGetValidationErrors: !!dateColumn.cellEditorParams?.getValidationErrors,
            });

            return dateColumn;
          }
          case "currency": {
            console.log('[Validation Debug] Building currency column', {
              field: col?.field,
              editable: col?.editable,
              validation: col?.validation,
            });

            // Helper function to get currency code from row data or column config
            const getCurrencyCode = (rowData, col) => {
              if (col?.currencyMode === 'perRow' && col?.currencyCodeField) {
                return this.resolveMappingFormula(col.currencyCodeField, rowData) || 'EUR';
              }
              return col?.currencyCode || 'EUR';
            };

            // Helper function to format currency value (cents to formatted string)
            const formatCurrency = (value, currencyCode) => {
              if (value == null || value === '') return '';
              
              // Convert cents to currency units
              const currencyValue = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
              if (isNaN(currencyValue)) return '';

              // Use Intl.NumberFormat for proper currency formatting
              try {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode || 'EUR',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(currencyValue);
              } catch (e) {
                // Fallback formatting if currency code is invalid
                return `${currencyValue.toFixed(2)} ${currencyCode || 'EUR'}`;
              }
            };

            // Helper function to parse user input to cents
            const parseCurrencyInput = (input) => {
              if (input == null || input === '') return null;
              
              // Remove currency symbols and whitespace
              const cleaned = String(input).replace(/[€$£¥,\s]/g, '');
              const parsed = parseFloat(cleaned);
              
              if (isNaN(parsed)) return null;
              
              // Convert to cents (multiply by 100)
              return Math.round(parsed * 100);
            };

            // Helper function to get display value (cents / 100) for filtering and sorting
            const getDisplayValue = (value) => {
              if (value == null || value === '') return null;
              const currencyValue = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
              return isNaN(currencyValue) ? null : currencyValue;
            };

            const currencyColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: col?.filter ? 'agNumberColumnFilter' : false,
              editable: col?.editable,
              cellEditorParams: {
                getValidationErrors: (params) => {
                  console.log('[Validation Debug] Currency column getValidationErrors called', {
                    params,
                    columnField: col?.field,
                    columnValidation: col?.validation,
                  });
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              // Format display: convert cents to formatted currency
              // Use raw field value from params.data, not params.value (which comes from valueGetter)
              valueFormatter: (params) => {
                const rawValue = params.data?.[col?.field];
                const currencyCode = getCurrencyCode(params.data, col);
                return formatCurrency(rawValue, currencyCode);
              },
              // Get display value for sorting (cents / 100)
              valueGetter: (params) => {
                return getDisplayValue(params.data?.[col?.field]);
              },
              // Get display value for filtering (user types 12, not 1200)
              filterValueGetter: (params) => {
                return getDisplayValue(params.data?.[col?.field]);
              },
              // Parse user input: convert display value (e.g., "12") back to cents (1200)
              valueParser: (params) => {
                return parseCurrencyInput(params.newValue);
              },
              // Custom comparator for proper numeric sorting using display values
              comparator: (valueA, valueB, nodeA, nodeB) => {
                const rawValueA = nodeA?.data?.[col?.field];
                const rawValueB = nodeB?.data?.[col?.field];
                const displayValueA = getDisplayValue(rawValueA);
                const displayValueB = getDisplayValue(rawValueB);
                
                // Handle null/undefined values
                if (displayValueA == null && displayValueB == null) return 0;
                if (displayValueA == null) return 1;
                if (displayValueB == null) return -1;
                
                // Numeric comparison
                return displayValueA - displayValueB;
              },
            };

            return currencyColumn;
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
              isLoading: this.isLoading,
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
              cellEditorParams: {
                ...selectParams,
                getValidationErrors: (params) => {
                  console.log('[Validation Debug] Select column getValidationErrors called', {
                    params,
                    columnField: col?.field,
                    columnValidation: col?.validation,
                  });
                  return getValidationErrors(col, params.value, params.data);
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
                    },
                  }
                : {}),
              // Use label for filtering and sorting instead of value
              valueGetter: (params) => {
                return getLabelFromValue(params.data?.[col?.field]);
              },
              // Ensure the raw value (ID) is stored, not the label
              valueSetter: getValueSetter(col, (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              }),
              filterValueGetter: (params) => {
                return getLabelFromValue(params.data?.[col?.field]);
              },
            };
          }
          case "user": {
            const userParams = {
              users: col?.users || [],
              maxNumberOfUsers: col?.maxNumberOfUsers ?? 4,
              userFocusColor: this.content.userFocusColor,
              cellFontFamily: this.content.cellFontFamily,
              resolveMappingFormula: this.resolveMappingFormula,
              isLoading: this.isLoading,
            };
            
            // Helper function to get user name from ID
            const getUserNameFromId = (userId) => {
              if (!userId) return '';
              const users = col?.users || [];
              const user = users.find(u => u.id === userId);
              if (user) {
                if (user.name) return user.name;
                if (user.firstname || user.lastname) {
                  return [user.firstname, user.lastname].filter(Boolean).join(' ');
                }
                return user.email || userId;
              }
              return userId;
            };
            
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
                  console.log('[Validation Debug] User column getValidationErrors called', {
                    params,
                    columnField: col?.field,
                    columnValidation: col?.validation,
                  });
                  return getValidationErrors(col, params.value, params.data);
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
                      isLoading: userParams.isLoading,
                      closeOnApply: true,
                    },
                  }
                : {}),
              // Use user name for filtering and sorting instead of ID
              valueGetter: (params) => {
                const value = params.data?.[col?.field];
                if (!value) return '';
                if (isMultiple) {
                  // Multiple users: return comma-separated names
                  const userIds = Array.isArray(value) ? value : [value];
                  return userIds.map(id => getUserNameFromId(id)).filter(Boolean).join(', ');
                } else {
                  // Single user: return name
                  return getUserNameFromId(value);
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
              filterValueGetter: (params) => {
                const value = params.data?.[col?.field];
                if (!value) return '';
                if (isMultiple) {
                  const userIds = Array.isArray(value) ? value : [value];
                  return userIds.map(id => getUserNameFromId(id)).filter(Boolean).join(', ');
                } else {
                  return getUserNameFromId(value);
                }
              },
            };
          }
          default: {
            console.log('[Validation Debug] Building default column', {
              field: col?.field,
              editable: col?.editable,
              validation: col?.validation,
              cellDataType: col?.cellDataType,
            });

            const result = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: col?.filter,
              editable: col?.editable,
            };

            // Add cellEditor and cellEditorParams for editable columns to ensure validation works
            if (col?.editable) {
              // Create the validation function
              const validationFn = (params) => {
                console.log('[Validation Debug] Default column getValidationErrors called - FUNCTION EXECUTED', {
                  params,
                  columnField: col?.field,
                  columnValidation: col?.validation,
                  value: params?.value,
                  data: params?.data,
                  paramsKeys: params ? Object.keys(params) : 'params is null',
                });
                const errors = getValidationErrors(col, params?.value, params?.data);
                console.log('[Validation Debug] Validation result:', errors);
                return errors;
              };

              // Explicitly set cellEditor to ensure validation is triggered
              // AG Grid's default editor might not call getValidationErrors consistently
              result.cellEditor = 'agTextCellEditor';
              
              console.log('[Validation Debug] Setting cellEditorParams for default column', {
                field: col?.field,
                cellEditor: result.cellEditor,
                hasValidationFn: !!validationFn,
                validationFnType: typeof validationFn,
              });

              result.cellEditorParams = {
                getValidationErrors: validationFn,
              };

              console.log('[Validation Debug] cellEditorParams created', {
                field: col?.field,
                cellEditorParams: result.cellEditorParams,
                hasGetValidationErrors: !!result.cellEditorParams?.getValidationErrors,
                getValidationErrorsType: typeof result.cellEditorParams?.getValidationErrors,
              });
            }

            console.log('[Validation Debug] Default column built', {
              field: result.field,
              editable: result.editable,
              cellEditor: result.cellEditor,
              hasCellEditorParams: !!result.cellEditorParams,
              hasGetValidationErrors: !!result.cellEditorParams?.getValidationErrors,
              cellEditorParams: result.cellEditorParams,
              validation: col?.validation,
            });

            if (col?.useCustomLabel) {
              result.valueFormatter = (params) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  params.value
                );
              };
              
              // Use display value for filtering and sorting if enabled
              if (col?.useDisplayValueForFilterSort) {
                // Helper function to get display value from raw value
                const getDisplayValue = (rawValue) => {
                  return this.resolveMappingFormula(
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

        // This should never be reached, but just in case
        console.warn('[Validation Debug] Column did not match any case', {
          field: col?.field,
          cellDataType: cellDataType,
        });
        return result;
      });

      console.log('[Validation Debug] All column definitions created', {
        count: allColumnDefs.length,
        columns: allColumnDefs.map(col => ({
          field: col.field,
          cellDataType: col.cellDataType,
          editable: col.editable,
          cellEditor: col.cellEditor,
          hasCellEditorParams: !!col.cellEditorParams,
          hasGetValidationErrors: !!col.cellEditorParams?.getValidationErrors,
          validation: this.content.columns.find(c => c.field === col.field || c.actionName === col.field)?.validation,
        })),
      });

      // Build a map of column definitions by their colId/field for reordering
      allColumnDefs.forEach((colDef) => {
        const colId = colDef.colId || colDef.field;
        if (colId) {
          columnsMap.set(colId, colDef);
        }
      });

      // Reorder columns based on initialColumnsOrder if provided
      let columns;
      if (this.content.initialColumnsOrder && Array.isArray(this.content.initialColumnsOrder)) {
        const orderedColumns = [];
        const usedColIds = new Set();

        // First, add columns in the order specified by initialColumnsOrder
        for (const colId of this.content.initialColumnsOrder) {
          if (columnsMap.has(colId)) {
            orderedColumns.push(columnsMap.get(colId));
            usedColIds.add(colId);
          }
        }

        // Then, add any remaining columns that weren't in initialColumnsOrder
        // (to handle cases where new columns were added to config but not to initialColumnsOrder)
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
    invalidEditValueMode() {
      const mode = this.content?.invalidEditValueMode || "revert";
      console.log('[Validation Debug] invalidEditValueMode computed:', mode);
      return mode;
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
    onActionTrigger(event) {
      this.$emit("trigger-event", {
        name: "action",
        event,
      });
    },
    onCellEditRequest(event) {
      const colDef = event.column?.getColDef();
      const cellEditorParams = colDef?.cellEditorParams;
      console.log('[Validation Debug] Cell edit requested', {
        column: event.column?.getColId(),
        newValue: event.newValue,
        oldValue: event.oldValue,
        data: event.data,
        columnDef: colDef,
        cellEditor: colDef?.cellEditor,
        hasCellEditorParams: !!cellEditorParams,
        cellEditorParams: cellEditorParams,
        hasGetValidationErrors: !!cellEditorParams?.getValidationErrors,
        getValidationErrorsType: typeof cellEditorParams?.getValidationErrors,
        allCellEditorParamsKeys: cellEditorParams ? Object.keys(cellEditorParams) : [],
      });

      // Try to manually check if validation would be called
      if (cellEditorParams?.getValidationErrors && typeof cellEditorParams.getValidationErrors === 'function') {
        console.log('[Validation Debug] Attempting manual validation call');
        try {
          const manualResult = cellEditorParams.getValidationErrors({
            value: event.newValue,
            data: event.data,
          });
          console.log('[Validation Debug] Manual validation result:', manualResult);
        } catch (e) {
          console.error('[Validation Debug] Error calling validation manually:', e);
        }
      }
    },
    onCellValueChanged(event) {
      console.log('[Validation Debug] Cell value changed', {
        column: event.column?.getColId(),
        newValue: event.data?.[event.column.getColId()],
        oldValue: event.oldValue,
        data: event.data,
      });

      // Find the column configuration to get isDirectUpdate
      const columnId = event.column.getColId();
      const columnConfig = this.content.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      // For select columns: read the value directly from the data to ensure we get the ID, not the label
      // The valueSetter ensures the actual value (ID) is stored in the data field
      const newValue = event.data?.[columnId];
      const oldValue = event.oldValue;
      
      // Don't emit event if values are the same (e.g., when edit was cancelled with Escape)
      // This handles both primitive values and arrays
      const valuesEqual = (() => {
        if (oldValue === newValue) return true;
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
          if (oldValue.length !== newValue.length) return false;
          return oldValue.every((val, idx) => val === newValue[idx]);
        }
        return false;
      })();
      
      if (valuesEqual) {
        return; // Skip emitting event when values are the same (cancelled edit)
      }
      
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
          isCancel: event.isCancel || false,
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
        isCancel: false,
      };
    },
    getScrollTestEvent() {
      if (!this.gridApi) throw new Error("Grid API is not initialized");
      return {
        scrollTop: 500,
        scrollLeft: 0,
        scrollHeight: 1000,
        clientHeight: 400,
        distanceFromBottom: 100,
        isNearBottom: true,
        isAtBottom: false,
        totalRows: this.gridApi.getDisplayedRowCount() || 0,
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
  
  // Fix horizontal scroll alignment between header and body
  // Optimize scroll containers for better synchronization
  :deep(.ag-header-viewport),
  :deep(.ag-body-viewport) {
    // Use hardware acceleration for smooth scrolling and proper synchronization
    transform: translateZ(0);
    backface-visibility: hidden;
    // Force GPU acceleration for better scroll performance
    -webkit-transform: translateZ(0);
  }
  
  // Ensure header and body rows stay aligned during horizontal scroll
  :deep(.ag-header-row),
  :deep(.ag-row) {
    // Use hardware acceleration for better scroll performance
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  
  // Disable transitions on header and body cells during scroll to prevent lag
  // This ensures columns stay aligned during horizontal scrolling
  :deep(.ag-header-cell),
  :deep(.ag-cell) {
    // Only disable transitions on transform/position properties that affect scroll alignment
    // Keep other transitions (like hover effects) intact
    transition-property: background-color, color, border-color, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }
  
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

    // Suppress focus border effects for cells with suppressRowInteraction (keep background)
    &.-suppress-row-interaction {
      // Override focus and range selection border/outline styling only
      &.ag-cell-focus,
      &.ag-cell-range-selected,
      &:focus,
      &:focus-within {
        outline: none !important;
        box-shadow: none !important;
        border-color: transparent !important;
      }
    }
  }

  // Suppress cell focus border styling for suppress-row-interaction cells (stronger selectors)
  :deep(.ag-cell-focus.-suppress-row-interaction),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-focus),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-range-selected) {
    outline: none !important;
    box-shadow: none !important;
    border: 1px solid transparent !important;
  }

  // Override AG Grid's range selection border for suppress-row-interaction cells
  :deep(.ag-cell.-suppress-row-interaction) {
    &.ag-cell-range-single-cell,
    &.ag-cell-range-selected-1,
    &.ag-cell-range-selected-2,
    &.ag-cell-range-selected-3,
    &.ag-cell-range-selected-4 {
      border-color: transparent !important;
    }
  }

  // Make editable inputs take full cell width
  :deep(.ag-cell-inline-editing) {
    padding: 0 !important;
    
    .ag-cell-wrapper {
      width: 100%;
      height: 100%;
      padding: 0;
    }
    
    // Default AG Grid text input
    .ag-input-field-input {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Custom cell editors (DateCellEditor, etc.)
    input,
    textarea,
    select {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Cell editor wrapper
    > * {
      width: 100%;
      height: 100%;
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
}
</style>
