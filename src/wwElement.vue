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
      :rowModelType="rowModelType"
      :datasource="datasource"
      :cacheBlockSize="cacheBlockSize"
      :pagination="paginationEnabled"
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
      @pagination-changed="onPaginationChanged"
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

    // Debug logging helper
    const debugLog = (...args) => {
      if (props.content?.enableDebugLogs) {
        console.log(...args);
      }
    };

    // Helper function to get the Supabase field path for filtering a column
    // Only used when dataSource is 'supabase'
    const getSupabaseFilterField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseFilterField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseFilterField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Helper function to get the Supabase field path for sorting a column
    // Only used when dataSource is 'supabase'
    const getSupabaseSortField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseSortField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseSortField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Convert AG Grid filter model to Supabase filter chain
    const convertFilterToSupabase = (filterModel, query) => {
      if (!filterModel || Object.keys(filterModel).length === 0) {
        return query;
      }

      let currentQuery = query;

      // Process each column filter
      for (const [columnId, filter] of Object.entries(filterModel)) {
        if (!filter) continue;

        // Get the Supabase field path for this column (supports nested relationships)
        // This will return the supabaseFilterField if set, otherwise columnId
        // For non-Supabase data sources, it just returns columnId
        const supabaseField = getSupabaseFilterField(columnId);

        // Handle user filters (custom filter type)
        if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // User filter stores user names in filter.values
          // We need to convert names to IDs for Supabase filtering
          // Find the column definition to get the users array
          const column = props.content?.columns?.find(col => {
            const colId = col?.actionName || col?.field;
            return colId === columnId || col?.field === columnId;
          });
          
          if (column && column.cellDataType === 'user' && Array.isArray(column.users)) {
            // Helper function to get user name (same logic as in renderer)
            const getUserName = (user) => {
              if (user.name) return user.name;
              if (user.firstname || user.lastname) {
                return [user.firstname, user.lastname].filter(Boolean).join(' ');
              }
              return user.email || user.id || '';
            };
            
            // Map selected user names to user IDs
            const selectedUserIds = filter.values
              .map(selectedName => {
                const user = column.users.find(u => {
                  const userName = getUserName(u);
                  return userName === selectedName || u.id === selectedName || u.email === selectedName;
                });
                return user?.id;
              })
              .filter(id => id != null); // Remove any null/undefined IDs
            
              if (selectedUserIds.length > 0) {
              // CRITICAL FIX: Check if column stores single user (UUID) or multiple users (UUID[])
              // When maxNumberOfUsers === 1, the database column is a single UUID
              // When maxNumberOfUsers > 1, the database column might be UUID[] (array) or still UUID
              // Since we can't know the actual column type, we'll use .in() which works for both
              // For UUID columns: .in() filters where column value is IN the provided array
              // For UUID[] columns: We'll need a different approach, but .in() won't work for arrays
              
              const isMultiple = (column.maxNumberOfUsers ?? 4) > 1;
              
              // For single UUID columns (maxNumberOfUsers === 1), always use .in() or .eq()
              // This works because the column is a single UUID value, not an array
              if (!isMultiple) {
                // Single user: column is UUID type, use .in() for multiple values or .eq() for single
                if (selectedUserIds.length === 1) {
                  currentQuery = currentQuery.eq(supabaseField, selectedUserIds[0]);
                } else {
                  currentQuery = currentQuery.in(supabaseField, selectedUserIds);
                }
              } else {
                // Multiple users: column might be UUID[] (array) or still UUID
                // If it's UUID[] (Postgres array type), we can use .overlaps()
                // If it's UUID (single value), we need to use .in() or .eq()
                // Since we can't reliably detect the column type, we'll try a safer approach:
                // For UUID[] columns: use .overlaps() to check if arrays have any common elements
                // However, if the column is actually UUID (not UUID[]), this will fail
                // So we'll use .in() for now, which works for UUID columns
                // TODO: If you have UUID[] columns, you may need to use a different approach
                // such as using Postgres array functions or casting
                
                // For now, use .in() which is safe for UUID columns
                // If you have UUID[] columns and want to filter by "contains any of these IDs",
                // you might need to use Postgres array operators, but that requires knowing the column type
                if (selectedUserIds.length === 1) {
                  // Even for "multiple" mode, if only one ID selected, use .eq()
                  currentQuery = currentQuery.eq(supabaseField, selectedUserIds[0]);
                } else {
                  // Use .in() which works for UUID columns
                  // Note: This assumes the column stores a single UUID value
                  // If you have UUID[] columns, you'll need array-specific filtering
                  currentQuery = currentQuery.in(supabaseField, selectedUserIds);
                }
                
                // Alternative for UUID[] arrays (uncomment if your columns are UUID[] type):
                // if (selectedUserIds.length === 1) {
                //   currentQuery = currentQuery.contains(supabaseField, [selectedUserIds[0]]);
                // } else {
                //   currentQuery = currentQuery.overlaps(supabaseField, selectedUserIds);
                // }
              }
              
              debugLog('[Supabase Filter] User filter applied:', {
                columnId,
                supabaseField,
                selectedNames: filter.values,
                selectedIds: selectedUserIds,
                isMultiple,
                filterMethod: selectedUserIds.length === 1 ? 'eq' : 'in',
                note: isMultiple ? 'Assuming UUID column (not UUID[]). If column is UUID[], use array operators.' : 'UUID column (single user)',
              });
            } else {
              debugLog('[Supabase Filter] Warning: No valid user IDs found for names:', filter.values);
            }
          } else {
            debugLog('[Supabase Filter] Warning: Could not find user column or users array for:', columnId);
          }
          continue;
        }

        // Handle different filter types
        if (filter.filterType === 'text') {
          // Text filters
          if (filter.type === 'equals') {
            currentQuery = currentQuery.eq(supabaseField, filter.filter);
          } else if (filter.type === 'notEqual') {
            currentQuery = currentQuery.neq(supabaseField, filter.filter);
          } else if (filter.type === 'contains') {
            currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}%`);
          } else if (filter.type === 'notContains') {
            currentQuery = currentQuery.not('ilike', supabaseField, `%${filter.filter}%`);
          } else if (filter.type === 'startsWith') {
            currentQuery = currentQuery.ilike(supabaseField, `${filter.filter}%`);
          } else if (filter.type === 'endsWith') {
            currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}`);
          }
        } else if (filter.filterType === 'number') {
          // Number filters
          if (filter.type === 'equals') {
            currentQuery = currentQuery.eq(supabaseField, Number(filter.filter));
          } else if (filter.type === 'notEqual') {
            currentQuery = currentQuery.neq(supabaseField, Number(filter.filter));
          } else if (filter.type === 'greaterThan') {
            currentQuery = currentQuery.gt(supabaseField, Number(filter.filter));
          } else if (filter.type === 'greaterThanOrEqual') {
            currentQuery = currentQuery.gte(supabaseField, Number(filter.filter));
          } else if (filter.type === 'lessThan') {
            currentQuery = currentQuery.lt(supabaseField, Number(filter.filter));
          } else if (filter.type === 'lessThanOrEqual') {
            currentQuery = currentQuery.lte(supabaseField, Number(filter.filter));
          } else if (filter.type === 'inRange') {
            currentQuery = currentQuery.gte(supabaseField, Number(filter.filter))
              .lte(supabaseField, Number(filter.filterTo));
          }
        } else if (filter.filterType === 'date') {
          // Date filters
          const filterDate = filter.dateFrom || filter.filter;
          const filterToDate = filter.dateTo || filter.filterTo;
          
          if (filter.type === 'equals') {
            // For date equals, we need to check the entire day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            currentQuery = currentQuery.gte(supabaseField, startOfDay.toISOString())
              .lte(supabaseField, endOfDay.toISOString());
          } else if (filter.type === 'notEqual') {
            // Not equal for dates: filter out the specific day
            // We'll use a workaround: filter for dates less than start of day OR greater than end of day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            // Use .or() with proper Supabase syntax
            currentQuery = currentQuery.or(`and(${supabaseField}.lt.${startOfDay.toISOString()},${supabaseField}.gt.${endOfDay.toISOString()})`);
          } else if (filter.type === 'greaterThan') {
            currentQuery = currentQuery.gt(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'greaterThanOrEqual') {
            currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'lessThan') {
            currentQuery = currentQuery.lt(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'lessThanOrEqual') {
            currentQuery = currentQuery.lte(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'inRange') {
            currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString())
              .lte(supabaseField, new Date(filterToDate).toISOString());
          }
        } else if (filter.filterType === 'set') {
          // Set filters (for select columns)
          if (filter.values && filter.values.length > 0) {
            if (filter.values.length === 1) {
              currentQuery = currentQuery.eq(supabaseField, filter.values[0]);
            } else {
              currentQuery = currentQuery.in(supabaseField, filter.values);
            }
          }
        }
      }

      return currentQuery;
    };

    // Apply search filter to Supabase query
    const applySearchToSupabase = (query, searchValue, searchableColumns) => {
      if (!searchValue || !searchValue.trim() || !searchableColumns || !Array.isArray(searchableColumns) || searchableColumns.length === 0) {
        return query;
      }

      const searchTerm = searchValue.trim();
      const validColumns = searchableColumns.filter(col => col && typeof col === 'string' && col.trim().length > 0);

      if (validColumns.length === 0) {
        return query;
      }

      // Map searchable columns to their Supabase field paths
      // This allows searchableColumns to contain either column IDs or direct Supabase paths
      const supabaseSearchFields = validColumns.map(col => {
        // Check if this is a column ID that has a supabaseFilterField
        const column = props.content?.columns?.find(c => {
          const colId = c?.actionName || c?.field;
          return colId === col || c?.field === col;
        });
        // Use supabaseFilterField if provided and not empty, otherwise use the column ID as-is
        // This allows searchableColumns to contain either column IDs or direct Supabase paths
        const supabaseField = column?.supabaseFilterField?.trim();
        return (supabaseField && supabaseField.length > 0) ? supabaseField : col;
      });

      // Build OR condition for all searchable columns
      // For Supabase, we need to use .or() with proper syntax
      // Format: or('col1.ilike.%term%,col2.ilike.%term%,...')
      if (supabaseSearchFields.length === 1) {
        // Single column: just use ilike
        return query.ilike(supabaseSearchFields[0], `%${searchTerm}%`);
      } else {
        // Multiple columns: use OR condition
        // Supabase OR syntax: or('col1.ilike.%term%,col2.ilike.%term%')
        // Note: The pattern needs to be properly escaped for special characters
        const escapedTerm = searchTerm.replace(/'/g, "''"); // Escape single quotes
        const orConditions = supabaseSearchFields
          .map(col => `${col}.ilike.%${escapedTerm}%`)
          .join(',');
        return query.or(orConditions);
      }
    };

    // Fetch data from Supabase for infinite scrolling (returns data directly)
    const fetchSupabaseDataForInfinite = async (startRow, endRow, filterModel = null, sortModel = null, searchValue = null) => {
      if (props.content?.dataSource !== 'supabase') {
        return { data: [], totalCount: 0 };
      }

      debugLog('[Supabase Infinite] Fetching data for infinite scroll:', { startRow, endRow, blockSize: endRow - startRow });

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        return { data: [], totalCount: 0 };
      }

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        const supabase = wwLib.wwPlugins.supabase.instance;
        if (!supabase) {
          throw new Error('Supabase instance not available');
        }

        // Start building the query
        let query = supabase.from(tableName).select(queryString, { count: 'exact' });

        // Apply search filter (before other filters)
        if (props.content?.enableSearch && searchValue && searchValue.trim()) {
          const searchableColumns = props.content?.searchableColumns || [];
          query = applySearchToSupabase(query, searchValue, searchableColumns);
        }

        // Apply filters
        if (filterModel && Object.keys(filterModel).length > 0) {
          query = convertFilterToSupabase(filterModel, query);
        }

        // Apply sorting
        if (sortModel && Array.isArray(sortModel) && sortModel.length > 0) {
          for (const sort of sortModel) {
            const columnId = sort.colId;
            // Get the Supabase field path for this column (supports nested relationships)
            const supabaseField = getSupabaseSortField(columnId);
            const order = sort.sort === 'asc' ? true : false;
            query = query.order(supabaseField, { ascending: order });
          }
        }

        // Apply range for infinite scrolling
        // Note: AG Grid's endRow is exclusive (e.g., if endRow=50, it wants rows 0-49)
        // Supabase range is inclusive, so we use endRow - 1
        const supabaseFrom = startRow;
        const supabaseTo = endRow - 1;
        query = query.range(supabaseFrom, supabaseTo);

        debugLog('[Supabase Infinite] Executing query with range:', {
          tableName,
          queryString,
          agGridStartRow: startRow,
          agGridEndRow: endRow,
          agGridBlockSize: endRow - startRow,
          supabaseFrom,
          supabaseTo,
          supabaseRange: `${supabaseFrom}-${supabaseTo}`,
          hasFilters: filterModel && Object.keys(filterModel).length > 0,
          hasSort: sortModel && Array.isArray(sortModel) && sortModel.length > 0,
          hasSearch: !!(searchValue && searchValue.trim()),
        });

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        const resultData = Array.isArray(data) ? data : [];
        const totalCount = count || 0;

        debugLog('[Supabase Infinite] Data fetched:', { count: resultData.length, total: totalCount });

        return { data: resultData, totalCount };
      } catch (error) {
        console.error('[Supabase Infinite] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        return { data: [], totalCount: 0 };
      } finally {
        supabaseLoading.value = false;
      }
    };

    // Fetch data from Supabase
    const fetchSupabaseData = async (page = 1, pageSize = 10, filterModel = null, sortModel = null, searchValue = null) => {
      // Log the call stack and flag state to trace where fetch is triggered from
      const callStack = new Error().stack;
      const isUpdatingLocally = isUpdatingDataLocally.value;
      debugLog('[Supabase Fetch] ========== FETCH CALLED ==========');
      debugLog('[Supabase Fetch] Call stack:', callStack?.split('\n').slice(0, 10).join('\n'));
      debugLog('[Supabase Fetch] Flag state:', { isUpdatingDataLocally: isUpdatingLocally });
      debugLog('[Supabase Fetch] Params:', { page, pageSize, hasFilterModel: !!filterModel, hasSortModel: !!sortModel, searchValue });
      
      // Skip fetch if we're updating data locally
      if (isUpdatingLocally) {
        debugLog('[Supabase Fetch] ⚠️ SKIPPING FETCH - local data update in progress');
        return;
      }
      
      if (props.content?.dataSource !== 'supabase') {
        debugLog('[Supabase Fetch] Not using Supabase data source, skipping');
        return;
      }

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        debugLog('[Supabase Fetch] No table name, skipping');
        return;
      }

      // Create a unique key for this fetch request
      const fetchKey = JSON.stringify({ page, pageSize, filterModel, sortModel, searchValue, tableName, queryString });
      
      // Prevent duplicate/recursive calls
      if (isFetchingData.value) {
        debugLog('[Supabase Fetch] Already fetching, skipping duplicate call');
        return;
      }
      
      // Check if this is the same request as the last one
      if (lastFetchParams.value === fetchKey) {
        debugLog('[Supabase Fetch] Same request as last fetch, skipping');
        return;
      }

      // Set fetching flag and store params
      isFetchingData.value = true;
      lastFetchParams.value = fetchKey;

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        const supabase = wwLib.wwPlugins.supabase.instance;
        if (!supabase) {
          throw new Error('Supabase instance not available');
        }

        // Start building the query
        let query = supabase.from(tableName).select(queryString, { count: 'exact' });

        // Apply search filter (before other filters)
        if (props.content?.enableSearch && searchValue && searchValue.trim()) {
          const searchableColumns = props.content?.searchableColumns || [];
          query = applySearchToSupabase(query, searchValue, searchableColumns);
        }

        // Apply filters
        if (filterModel && Object.keys(filterModel).length > 0) {
          query = convertFilterToSupabase(filterModel, query);
        }

        // Apply sorting
        if (sortModel && Array.isArray(sortModel) && sortModel.length > 0) {
          for (const sort of sortModel) {
            const columnId = sort.colId;
            // Get the Supabase field path for this column (supports nested relationships)
            const supabaseField = getSupabaseSortField(columnId);
            const order = sort.sort === 'asc' ? true : false;
            query = query.order(supabaseField, { ascending: order });
          }
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        debugLog('[Supabase] Fetching data:', { tableName, queryString, page, pageSize, filterModel, sortModel, searchValue, from, to });

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        supabaseData.value = Array.isArray(data) ? data : [];
        supabaseTotalCount.value = count || 0;

        // Update grid row count if available
        if (gridApi.value && supabaseTotalCount.value > 0) {
          // Note: AG Grid client-side model doesn't support setting total count directly
          // The pagination will work with the data provided, but total count display may be limited
        }

        debugLog('[Supabase] Data fetched:', { count: supabaseData.value.length, total: supabaseTotalCount.value });
        
        // Update records after data is fetched (records will also be updated via rowData watch, but this ensures it's immediate)
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      } catch (error) {
        console.error('[Supabase] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        supabaseData.value = [];
        supabaseTotalCount.value = 0;
        setRecords([]);
      } finally {
        supabaseLoading.value = false;
        // Clear fetching flag after a short delay to allow grid to update
        setTimeout(() => {
          isFetchingData.value = false;
        }, 100);
      }
    };

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
    const { value: records, setValue: setRecords } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "records",
        type: "array",
        defaultValue: [],
        readonly: true,
      });

    // Function to update records variable from grid API (gets displayed rows)
    // Defined early so it can be used in onGridReady and other handlers
    const updateRecordsFromGrid = () => {
      if (!gridApi.value) {
        setRecords([]);
        return;
      }

      try {
        const displayedRows = [];
        // Get all displayed row nodes from the grid
        gridApi.value.forEachNode((node) => {
          if (node.data) {
            displayedRows.push(node.data);
          }
        });
        setRecords(displayedRows);
        debugLog('[Records] Updated records from grid:', { count: displayedRows.length });
      } catch (error) {
        console.error('[Records] Error updating records from grid:', error);
        setRecords([]);
      }
    };

    const gridReady = ref(false);
    const dataRendered = ref(false);
    const dataLoadingTimeout = ref(null);
    const gridContainerRef = ref(null);
    
    // Supabase data state
    const supabaseData = ref([]);
    const supabaseTotalCount = ref(0);
    const supabaseLoading = ref(false);
    const supabaseError = ref(null);
    const filterDebounceTimer = ref(null);
    const searchDebounceTimer = ref(null);
    
    // Guard to prevent duplicate/recursive fetches
    const isFetchingData = ref(false);
    const lastFetchParams = ref(null);
    
    // Flag to prevent data fetching when we're updating data locally (e.g., fake junction records)
    const isUpdatingDataLocally = ref(false);
    
    // Helper functions to set/get the flag from methods
    const setUpdatingDataLocally = (value) => {
      isUpdatingDataLocally.value = value;
    };
    const getUpdatingDataLocally = () => {
      return isUpdatingDataLocally.value;
    };

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
      
      // Update records from grid after grid is ready
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
        }, 200);
      });
      
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

    // CRITICAL FIX: Track if initial filters/sorts have been applied
    // They should only be applied ONCE on mount, not continuously
    const initialFiltersApplied = ref(false);
    const initialSortApplied = ref(false);
    const initialColumnsOrderApplied = ref(false);

    // Watch for grid ready to apply initial filters/sorts ONCE
    watch(
      () => gridReady.value,
      (ready) => {
        if (!ready || !gridApi.value) return;
        
        // Apply initial filters only once
        if (props.content.initialFilters && !initialFiltersApplied.value) {
          gridApi.value.setFilterModel(props.content.initialFilters);
          initialFiltersApplied.value = true;
        }
        
        // Apply initial sort only once
        if (props.content.initialSort && !initialSortApplied.value) {
          gridApi.value.applyColumnState({
            state: props.content.initialSort || [],
            defaultState: { sort: null },
          });
          initialSortApplied.value = true;
        }
        
        // Apply initial column order only once
        if (
          props.content.initialColumnsOrder &&
          Array.isArray(props.content.initialColumnsOrder) &&
          !initialColumnsOrderApplied.value
        ) {
          gridApi.value.applyColumnState({
            state: props.content.initialColumnsOrder.map((colId) => ({ colId })),
            applyOrder: true,
          });
          setColumnOrder([...props.content.initialColumnsOrder]);
          initialColumnsOrderApplied.value = true;
        }
      },
      { immediate: true }
    );

    // CRITICAL FIX: initialState should only be set once on mount, not reactive
    // If it's reactive, it will reset filters/sorting whenever props change
    // We use a ref to ensure it's set only once and never changes
    const initialState = ref(null);
    
    // Set initial state only once when component mounts
    // After the grid is ready and applies this state, we don't use it again
    // This prevents overriding user-applied filters and sorts
    if (!initialState.value) {
      const state = {
        partialColumnState: true,
      };
      // NOTE: Initial filters and sorts are applied via watcher (lines 541-575)
      // We don't include them in initialState to avoid AG Grid re-applying them
      // when the component updates. Instead, they're applied once via API calls.
      if (props.content.initialColumnsOrder && Array.isArray(props.content.initialColumnsOrder)) {
        state.columnOrder = {
          orderedColIds: props.content.initialColumnsOrder,
        };
      }
      initialState.value = state;
    }

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
        
        // If using Supabase, debounce filter changes to avoid excessive API calls
        if (props.content?.dataSource === 'supabase') {
          // Clear existing debounce timer
          if (filterDebounceTimer.value) {
            clearTimeout(filterDebounceTimer.value);
          }
          
          // Debounce filter changes (300ms)
          filterDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, refresh the datasource
              // CRITICAL FIX: Preserve current filter and sort state when refreshing datasource
              if (gridApi.value) {
                const currentFilters = gridApi.value.getFilterModel();
                const currentSort = gridApi.value.getState()?.sort?.sortModel;
                gridApi.value.setGridOption('datasource', datasource.value);
                // AG Grid should preserve filters, but ensure they're still there
                nextTick(() => {
                  const newFilters = gridApi.value.getFilterModel();
                  if (JSON.stringify(newFilters) !== JSON.stringify(currentFilters)) {
                    gridApi.value.setFilterModel(currentFilters);
                  }
                  if (currentSort && currentSort.length > 0) {
                    const newSort = gridApi.value.getState()?.sort?.sortModel;
                    if (JSON.stringify(newSort) !== JSON.stringify(currentSort)) {
                      gridApi.value.applyColumnState({
                        state: currentSort,
                        defaultState: { sort: null },
                      });
                    }
                  }
                  // Update records after datasource refresh
                  setTimeout(() => {
                    updateRecordsFromGrid();
                  }, 200);
                });
              }
            } else {
              // For pagination mode, fetch data
              debugLog('[onFilterChanged] Calling fetchSupabaseData from filter change handler (pagination mode)', {
                isUpdatingDataLocally: isUpdatingDataLocally.value,
              });
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
              // Records will be updated when rowData changes (via watch)
            }
          }, 300);
        } else {
          // For non-Supabase, update records after filter change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
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
        
        // If using Supabase, refetch data with new sort
        if (props.content?.dataSource === 'supabase') {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, refresh the datasource
            // CRITICAL FIX: Preserve current filter and sort state when refreshing datasource
            if (gridApi.value) {
              const currentFilters = gridApi.value.getFilterModel();
              const currentSort = gridApi.value.getState()?.sort?.sortModel;
              gridApi.value.setGridOption('datasource', datasource.value);
              // AG Grid should preserve filters and sorts, but ensure they're still there
              nextTick(() => {
                const newFilters = gridApi.value.getFilterModel();
                if (JSON.stringify(newFilters) !== JSON.stringify(currentFilters)) {
                  gridApi.value.setFilterModel(currentFilters);
                }
                if (currentSort && currentSort.length > 0) {
                  const newSort = gridApi.value.getState()?.sort?.sortModel;
                  if (JSON.stringify(newSort) !== JSON.stringify(currentSort)) {
                    gridApi.value.applyColumnState({
                      state: currentSort,
                      defaultState: { sort: null },
                    });
                  }
                  // Update records after datasource refresh
                  setTimeout(() => {
                    updateRecordsFromGrid();
                  }, 200);
                }
              });
            }
          } else {
            // For pagination mode, fetch data
            debugLog('[onSortChanged] Calling fetchSupabaseData from sort change handler (pagination mode)', {
              isUpdatingDataLocally: isUpdatingDataLocally.value,
            });
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = state.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            // Records will be updated when rowData changes (via watch)
          }
        } else {
          // For non-Supabase, update records after sort change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
      }
    };

    const onPaginationChanged = (event) => {
      if (!gridApi.value) return;
      
      // Skip pagination changes if infinite scrolling is enabled
      if (isInfiniteScrollEnabled.value) {
        return;
      }
      
      // Skip if we're updating data locally (e.g., fake junction records)
      // This prevents refreshCells from triggering unnecessary fetches
      if (isUpdatingDataLocally.value) {
        debugLog('[onPaginationChanged] ⚠️ SKIPPING - local data update in progress');
        return;
      }
      
      // If using Supabase, refetch data for new page
      if (props.content?.dataSource === 'supabase') {
        debugLog('[onPaginationChanged] Calling fetchSupabaseData from pagination change handler', {
          isUpdatingDataLocally: isUpdatingDataLocally.value,
        });
        const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
        const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
        const filterModel = gridApi.value.getFilterModel();
        const state = gridApi.value.getState();
        const sortModel = state?.sort?.sortModel || [];
        const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
        fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
        // Records will be updated when rowData changes (via watch)
      } else {
        // For non-Supabase, update records after pagination change
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
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
      if (filterDebounceTimer.value) {
        clearTimeout(filterDebounceTimer.value);
      }
      if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value);
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

      // Debug logging for infinite scroll
      if (isInfiniteScrollEnabled.value) {
        debugLog('[Infinite Scroll] Scroll event:', {
          scrollTop: scrollTopPos,
          scrollHeight,
          clientHeight,
          distanceFromBottom,
          isNearBottom,
          isAtBottom,
        });
      }
      
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

    // Determine if infinite scrolling is enabled
    const isInfiniteScrollEnabled = computed(() => {
      return props.content?.dataSource === 'supabase' && props.content?.enableInfiniteScroll === true;
    });

    // Row model type - 'infinite' if enabled, otherwise undefined (defaults to client-side)
    const rowModelType = computed(() => {
      return isInfiniteScrollEnabled.value ? 'infinite' : undefined;
    });

    // Pagination should be disabled when infinite scrolling is enabled
    const paginationEnabled = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return false;
      }
      return props.content?.pagination;
    });

    // Cache block size for infinite scrolling
    const cacheBlockSize = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return props.content?.infiniteBlockSize || 100;
      }
      return undefined;
    });

    // Create datasource for infinite scrolling
    const datasource = computed(() => {
      if (!isInfiniteScrollEnabled.value) {
        return undefined;
      }

      debugLog('[Infinite Scroll] Creating datasource, blockSize:', props.content?.infiniteBlockSize || 100);

      return {
        rowCount: undefined, // Will be determined dynamically
        getRows: async (params) => {
          const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;
          const requestedBlockSize = endRow - startRow;

          debugLog('[Infinite Scroll] ========== BLOCK REQUEST ==========');
          debugLog('[Infinite Scroll] getRows called with params:', {
            startRow,
            endRow,
            requestedBlockSize,
            sortModel: JSON.stringify(sortModel),
            filterModel: Object.keys(filterModel || {}),
            hasFilters: Object.keys(filterModel || {}).length > 0,
          });

          try {
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            debugLog('[Infinite Scroll] Fetching data from Supabase...');
            
            const fetchStartTime = Date.now();
            const { data, totalCount } = await fetchSupabaseDataForInfinite(
              startRow,
              endRow,
              filterModel,
              sortModel,
              searchValue
            );
            const fetchDuration = Date.now() - fetchStartTime;

            // Determine if this is the last row
            // If we got fewer rows than requested, or if we've reached the total count, we're done
            const rowCount = data.length;
            
            // CRITICAL FIX: Handle 0 rows case
            // If totalCount is 0, we're definitely done (no rows to show)
            // If we got fewer rows than requested, we're done (last block)
            // If we've reached or exceeded totalCount, we're done
            const isLastBlock = totalCount === 0 || 
                                rowCount < requestedBlockSize || 
                                (totalCount > 0 && endRow >= totalCount);
            
            // CRITICAL FIX: Set lastRow to 0 when totalCount is 0 (no rows)
            // This tells AG Grid to stop fetching and show "no rows" message
            const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

            debugLog('[Infinite Scroll] Data fetched:', {
              fetchedRows: rowCount,
              requestedRows: requestedBlockSize,
              totalCount,
              isLastBlock,
              lastRow,
              fetchDuration: `${fetchDuration}ms`,
            });

            debugLog('[Infinite Scroll] Calling successCallback with:', {
              dataLength: data.length,
              lastRow,
            });

            // Call success callback with the data
            successCallback(data, lastRow);

            // Update supabaseData for records variable
            // Note: In infinite scroll mode, supabaseData will only contain the current block
            // The grid manages the full dataset internally
            supabaseData.value = data;
            supabaseTotalCount.value = totalCount;

            // Update records from grid after data is loaded
            nextTick(() => {
              setTimeout(() => {
                updateRecordsFromGrid();
              }, 100);
            });

            debugLog('[Infinite Scroll] ========== BLOCK COMPLETE ==========');
          } catch (error) {
            console.error('[Infinite Scroll] Error in getRows:', error);
            debugLog('[Infinite Scroll] Calling failCallback due to error');
            failCallback();
          }
        },
      };
    });

    const rowData = computed(() => {
      // If using infinite scrolling, rowData should be undefined (grid uses datasource)
      if (isInfiniteScrollEnabled.value) {
        return undefined;
      }
      // If using Supabase with pagination, return Supabase data
      if (props.content?.dataSource === 'supabase') {
        return supabaseData.value;
      }
      
      // Otherwise, use local data (existing behavior)
      const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
      return Array.isArray(data) ? data ?? [] : [];
    });

    // Track if we've ever rendered data (for initial load detection)
    const hasEverRendered = ref(false);

    // Watch for data changes to detect loading state and update records variable
    watch(() => rowData.value, (newData, oldData) => {
      // Skip processing if we're updating data locally (e.g., fake junction records)
      // This prevents triggering loading states or unnecessary updates during local modifications
      if (isUpdatingDataLocally.value) {
        debugLog('[RowData Watch] Skipping watch handler - local data update in progress');
        return;
      }
      
      // For non-infinite scroll modes, update records from rowData
      // For infinite scroll, records will be updated via grid API watchers
      if (!isInfiniteScrollEnabled.value) {
        setRecords(Array.isArray(newData) ? [...newData] : []);
      } else {
        // For infinite scroll, update from grid API after a short delay to let grid update
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }
      
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
      
      // If using Supabase, check Supabase loading state
      if (props.content?.dataSource === 'supabase') {
        return supabaseLoading.value;
      }
      
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

    // Watch for dataSource changes and fetch initial data
    watch(
      () => props.content?.dataSource,
      (newSource, oldSource) => {
        debugLog('[dataSource Watch] Triggered', {
          newSource,
          oldSource,
          isUpdatingDataLocally: isUpdatingDataLocally.value,
        });
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          debugLog('[dataSource Watch] ⚠️ SKIPPING - local data update in progress');
          return;
        }
        
        // Only fetch if source actually changed to supabase
        if (newSource === 'supabase' && newSource !== oldSource && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource
            // CRITICAL FIX: Preserve filters and sorts when switching to server-side mode
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            gridApi.value.setGridOption('datasource', datasource.value);
            nextTick(() => {
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          } else {
            // Reset last fetch params to allow new fetch
            debugLog('[dataSource Watch] Calling fetchSupabaseData from dataSource watch handler (pagination mode)', {
              isUpdatingDataLocally: isUpdatingDataLocally.value,
            });
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      },
      { immediate: false }
    );

    // Watch for Supabase configuration changes
    watch(
      () => [props.content?.supabaseTable, props.content?.supabaseQuery],
      (newValues, oldValues) => {
        debugLog('[supabaseTable/Query Watch] Triggered', {
          newValues,
          oldValues,
          isUpdatingDataLocally: isUpdatingDataLocally.value,
        });
        
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          debugLog('[supabaseTable/Query Watch] Values unchanged, skipping');
          return;
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          debugLog('[supabaseTable/Query Watch] ⚠️ SKIPPING - local data update in progress');
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, refresh the datasource
            // CRITICAL FIX: Preserve filters and sorts when table/query changes
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            gridApi.value.setGridOption('datasource', datasource.value);
            nextTick(() => {
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          } else {
            // Reset last fetch params to allow new fetch
            debugLog('[supabaseTable/Query Watch] Calling fetchSupabaseData from table/query watch handler (pagination mode)', {
              isUpdatingDataLocally: isUpdatingDataLocally.value,
            });
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      }
    );

    // Initial data fetch when grid is ready and using Supabase
    const initialFetchDone = ref(false);
    watch(
      () => [gridReady.value, props.content?.dataSource, props.content?.supabaseTable],
      ([ready, source, table], oldValues) => {
        debugLog('[Initial Fetch Watch] Triggered', {
          ready,
          source,
          table,
          oldValues,
          initialFetchDone: initialFetchDone.value,
          isUpdatingDataLocally: isUpdatingDataLocally.value,
        });
        
        // Handle undefined oldValues on first run
        if (oldValues) {
          const [oldReady, oldSource, oldTable] = oldValues;
          // Only fetch if values actually changed and we haven't done initial fetch yet
          if (ready === oldReady && source === oldSource && table === oldTable) {
            debugLog('[Initial Fetch Watch] Values unchanged, skipping');
            return;
          }
          
          // Reset initial fetch flag if dataSource changes away from supabase
          if (source !== 'supabase' && oldSource === 'supabase') {
            initialFetchDone.value = false;
          }
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          debugLog('[Initial Fetch Watch] ⚠️ SKIPPING - local data update in progress');
          return;
        }
        
        // Handle initial setup
        if (ready && source === 'supabase' && table && gridApi.value && !initialFetchDone.value) {
          debugLog('[Initial Fetch Watch] Conditions met, setting initialFetchDone and proceeding');
          initialFetchDone.value = true;
          
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource and cacheBlockSize
            debugLog('[Infinite Scroll] ========== INITIALIZING INFINITE SCROLL ==========');
            debugLog('[Infinite Scroll] Grid ready, setting up infinite scroll:', {
              blockSize: cacheBlockSize.value,
              tableName: props.content?.supabaseTable,
              queryString: props.content?.supabaseQuery,
              enableSearch: props.content?.enableSearch,
            });
            
            // Check current grid state
            const currentRowModel = gridApi.value.getState()?.rowModel?.type;
            debugLog('[Infinite Scroll] Current row model type:', currentRowModel);
            
            // CRITICAL FIX: Preserve filters and sorts when initializing infinite scroll
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            
            gridApi.value.setGridOption('rowModelType', 'infinite');
            gridApi.value.setGridOption('cacheBlockSize', cacheBlockSize.value);
            debugLog('[Infinite Scroll] Set rowModelType to infinite, cacheBlockSize to', cacheBlockSize.value);
            
            // Verify datasource object
            const ds = datasource.value;
            debugLog('[Infinite Scroll] Datasource object:', {
              hasGetRows: typeof ds?.getRows === 'function',
              rowCount: ds?.rowCount,
              datasourceType: typeof ds,
            });
            
            gridApi.value.setGridOption('datasource', datasource.value);
            
            // Restore filters and sorts after setting datasource
            nextTick(() => {
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
              
              const state = gridApi.value?.getState();
              debugLog('[Infinite Scroll] Grid state after setting datasource:', {
                rowModelType: state?.rowModel?.type,
                hasDatasource: !!gridApi.value?.getGridOption('datasource'),
                filters: gridApi.value.getFilterModel(),
                sorts: state?.sort?.sortModel,
              });
            });
            
            debugLog('[Infinite Scroll] Datasource set, waiting for AG Grid to request first block...');
            debugLog('[Infinite Scroll] ================================================');
          } else {
            // For pagination mode, fetch initial data
            debugLog('[Initial Fetch Watch] Calling fetchSupabaseData from initial fetch watch handler (pagination mode)', {
              isUpdatingDataLocally: isUpdatingDataLocally.value,
            });
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, null, null, searchValue);
          }
        }
      },
      { immediate: true       }
    );

    // Watch for infinite scrolling configuration changes
    watch(
      () => [props.content?.enableInfiniteScroll, props.content?.infiniteBlockSize],
      (newValues, oldValues) => {
        // Only update if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && props.content?.enableInfiniteScroll && gridApi.value) {
          // Refresh the datasource and cacheBlockSize when infinite scrolling settings change
          debugLog('[Infinite Scroll] ========== REFRESHING INFINITE SCROLL ==========');
          debugLog('[Infinite Scroll] Configuration changed, refreshing datasource:', {
            oldBlockSize: oldValues?.[1],
            newBlockSize: cacheBlockSize.value,
            enableInfiniteScroll: newValues[0],
          });
          
          // CRITICAL FIX: Preserve filters and sorts when refreshing infinite scroll
          const currentFilters = gridApi.value.getFilterModel();
          const currentSort = gridApi.value.getState()?.sort?.sortModel;
          
          gridApi.value.setGridOption('cacheBlockSize', cacheBlockSize.value);
          gridApi.value.setGridOption('datasource', datasource.value);
          
          nextTick(() => {
            if (currentFilters && Object.keys(currentFilters).length > 0) {
              gridApi.value.setFilterModel(currentFilters);
            }
            if (currentSort && currentSort.length > 0) {
              gridApi.value.applyColumnState({
                state: currentSort,
                defaultState: { sort: null },
              });
            }
          });
          
          debugLog('[Infinite Scroll] Datasource refreshed');
          debugLog('[Infinite Scroll] ================================================');
        }
      }
    );

    // Watch for search value changes (with debounce for Supabase)
    watch(
      () => [props.content?.enableSearch, props.content?.searchValue, props.content?.searchableColumns],
      (newValues, oldValues) => {
        debugLog('[Search Watch] Triggered', {
          newValues,
          oldValues,
          isUpdatingDataLocally: isUpdatingDataLocally.value,
        });
        
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          debugLog('[Search Watch] Values unchanged, skipping');
          return;
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          debugLog('[Search Watch] ⚠️ SKIPPING - local data update in progress');
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && props.content?.enableSearch && gridApi.value) {
          // Clear existing debounce timer
          if (searchDebounceTimer.value) {
            clearTimeout(searchDebounceTimer.value);
          }
          
          // Debounce search changes (300ms)
          searchDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, refresh the datasource
              // CRITICAL FIX: Preserve filters and sorts when search changes
              if (gridApi.value) {
                const currentFilters = gridApi.value.getFilterModel();
                const currentSort = gridApi.value.getState()?.sort?.sortModel;
                gridApi.value.setGridOption('datasource', datasource.value);
                nextTick(() => {
                  if (currentFilters && Object.keys(currentFilters).length > 0) {
                    gridApi.value.setFilterModel(currentFilters);
                  }
                  if (currentSort && currentSort.length > 0) {
                    gridApi.value.applyColumnState({
                      state: currentSort,
                      defaultState: { sort: null },
                    });
                  }
                });
              }
            } else {
              // For pagination mode, fetch data
              debugLog('[Search Watch] Calling fetchSupabaseData from search watch handler (pagination mode)', {
                isUpdatingDataLocally: isUpdatingDataLocally.value,
              });
              lastFetchParams.value = null;
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const filterModel = gridApi.value.getFilterModel();
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            }
          }, 300);
        }
      }
    );

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
      debugLog,
      onGridReady,
      onRowSelected,
      onSelectionChanged,
      gridApi,
      onFilterChanged,
      onSortChanged,
      setUpdatingDataLocally, // Expose setter so methods can update the flag
      getUpdatingDataLocally, // Expose getter so methods can check the flag
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
      onPaginationChanged,
      onBodyScroll,
      gridContainerRef,
      initialState,
      refreshData,
      rowData,
      rowModelType,
      datasource,
      cacheBlockSize,
      paginationEnabled,
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
        singleClickEdit: this.content.cellEditMode !== "doubleClick",
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

      this.debugLog('[Validation Debug] Data type definitions:', definitions);

      return definitions;
    },
    columnDefs() {
      // First, map all columns to their definitions
      const columnsMap = new Map();

      this.debugLog('[Validation Debug] Column definitions being built', {
        columns: this.content.columns,
        validationMode: this.content.invalidEditValueMode,
      });

      // Helper to get validation errors for a value
      const getValidationErrors = (col, newValue, rowData) => {
        this.debugLog('[Validation Debug] getValidationErrors called', {
          column: col?.field || col?.headerName,
          newValue,
          rowData,
          validationRules: col?.validation,
          hasValidation: !!col?.validation,
          isArray: Array.isArray(col?.validation),
        });

        if (!col?.validation || !Array.isArray(col.validation)) {
          this.debugLog('[Validation Debug] No validation rules found or not an array');
          return null;
        }

        const errors = [];

        for (const rule of col.validation) {
          if (!rule?.type) {
            this.debugLog('[Validation Debug] Skipping rule without type:', rule);
            continue;
          }

          this.debugLog('[Validation Debug] Checking rule:', {
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
              this.debugLog('[Validation Debug] Required check:', {
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
                this.debugLog('[Validation Debug] MinLength check:', {
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
                this.debugLog('[Validation Debug] MaxLength check:', {
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
                this.debugLog('[Validation Debug] Min check:', {
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
                this.debugLog('[Validation Debug] Max check:', {
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
                  this.debugLog('[Validation Debug] Pattern check:', {
                    newValue,
                    pattern: rule.value,
                    matches,
                    isValid: matches,
                  });
                } catch (e) {
                  if (this.content?.enableDebugLogs) {
                    console.warn('[Validation Debug] Invalid regex pattern:', rule.value, e);
                  }
                  // If pattern is invalid, don't fail validation
                }
              }
              break;

            case 'custom':
              if (rule.custom) {
                // Create context with new value for the field
                const validationContext = { ...rowData, ...(col?.field ? { [col.field]: newValue } : {}) };
                this.debugLog('[Validation Debug] Custom validation context:', validationContext);
                const result = this.resolveMappingFormula(rule.custom, validationContext);
                this.debugLog('[Validation Debug] Custom validation result:', result);
                // Formula should return true for valid, false for invalid
                isValid = Boolean(result);
                errorMessage = rule.message || 'Custom validation failed.';
                this.debugLog('[Validation Debug] Custom check:', {
                  formula: rule.custom,
                  result,
                  isValid,
                });
              }
              break;
          }

          if (!isValid && errorMessage) {
            this.debugLog('[Validation Debug] Validation failed for rule:', {
              type: rule.type,
              errorMessage,
            });
            errors.push(errorMessage);
          } else {
            this.debugLog('[Validation Debug] Validation passed for rule:', rule.type);
          }
        }

        const finalResult = errors.length > 0 ? errors : null;
        this.debugLog('[Validation Debug] Final validation result:', {
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
          if (newValue !== oldValue && col?.field) {
             data[col.field] = newValue;
             return true;
          }
          return false;
        };
      };
      const allColumnDefs = this.content.columns
        .filter((col) => col != null && (col.field || col.actionName)) // Filter out null/undefined columns and columns without field/actionName
        .map((col, index) => {
        this.debugLog('[Validation Debug] Processing column', {
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
        this.debugLog('[Validation Debug] Column cellDataType:', {
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
            this.debugLog('[Validation Debug] Building custom column', {
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
                  this.debugLog('[Validation Debug] Custom column getValidationErrors called', {
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

            this.debugLog('[Validation Debug] Custom column built', {
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
            this.debugLog('[Validation Debug] Building date column', {
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
                  this.debugLog('[Validation Debug] Date column getValidationErrors called', {
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

            this.debugLog('[Validation Debug] Date column built', {
              field: dateColumn.field,
              editable: dateColumn.editable,
              hasCellEditorParams: !!dateColumn.cellEditorParams,
              hasGetValidationErrors: !!dateColumn.cellEditorParams?.getValidationErrors,
            });

            return dateColumn;
          }
          case "currency": {
            this.debugLog('[Validation Debug] Building currency column', {
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
                  this.debugLog('[Validation Debug] Currency column getValidationErrors called', {
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
            const rawOptions = col?.options;
            const selectParams = {
              options: Array.isArray(rawOptions) ? rawOptions : [],
              optionsValueFormula: col?.optionsValueFormula,
              optionsLabelFormula: col?.optionsLabelFormula,
              optionsColorFormula: col?.optionsColorFormula,
              resolveMappingFormula: this.resolveMappingFormula,
              isLoading: this.isLoading,
            };
            
            // Helper function to get label from value
            const getLabelFromValue = (value) => {
              const rawOptions = col?.options;
              const options = Array.isArray(rawOptions) ? rawOptions : [];
              
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
                  this.debugLog('[Validation Debug] Select column getValidationErrors called', {
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
            const rawUsers = col?.users;
            const userIdFormula = col?.userIdFormula || { type: 'f', code: 'context.mapping' };
            const userParams = {
              users: Array.isArray(rawUsers) ? rawUsers : [],
              maxNumberOfUsers: col?.maxNumberOfUsers ?? 4,
              userFocusColor: this.content.userFocusColor,
              cellFontFamily: this.content.cellFontFamily,
              resolveMappingFormula: this.resolveMappingFormula,
              userIdFormula: userIdFormula,
              isLoading: this.isLoading,
            };
            
            // Helper function to extract user ID(s) from raw cell value using userIdFormula
            const extractUserIds = (rawValue, rowData) => {
              if (!rawValue) return null;
              
              // Apply userIdFormula to extract user ID(s) from potentially nested structures
              const extractedValue = this.resolveMappingFormula(userIdFormula, rawValue);
              
              // Return the extracted value, or fallback to raw value if formula returns null/undefined
              return extractedValue ?? rawValue;
            };
            
            // Helper function to get user name from ID
            const getUserNameFromId = (userId) => {
              if (!userId) return '';
              const rawUsers = col?.users;
              const users = Array.isArray(rawUsers) ? rawUsers : [];
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
                  this.debugLog('[Validation Debug] User column getValidationErrors called', {
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
                      userIdFormula: userParams.userIdFormula,
                      isLoading: userParams.isLoading,
                      closeOnApply: true,
                    },
                  }
                : {}),
              // Use user name for filtering and sorting instead of ID
              // Apply userIdFormula first to extract user IDs from the raw cell value
              valueGetter: (params) => {
                const rawValue = params.data?.[col?.field];
                const extractedValue = extractUserIds(rawValue, params.data);
                if (!extractedValue) return '';
                
                if (isMultiple) {
                  // Multiple users: return comma-separated names
                  const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
                  return userIds.map(id => getUserNameFromId(id)).filter(Boolean).join(', ');
                } else {
                  // Single user: return name
                  return getUserNameFromId(extractedValue);
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
                const rawValue = params.data?.[col?.field];
                const extractedValue = extractUserIds(rawValue, params.data);
                if (!extractedValue) return '';
                
                if (isMultiple) {
                  const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
                  return userIds.map(id => getUserNameFromId(id)).filter(Boolean).join(', ');
                } else {
                  return getUserNameFromId(extractedValue);
                }
              },
            };
          }
          default: {
            this.debugLog('[Validation Debug] Building default column', {
              field: col?.field,
              editable: col?.editable,
              validation: col?.validation,
              cellDataType: col?.cellDataType,
            });

            // Determine the correct filter type based on cellDataType
            let filterType = false;
            if (col?.filter) {
              if (col?.cellDataType === 'number') {
                filterType = 'agNumberColumnFilter';
              } else if (col?.cellDataType === 'boolean') {
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

            // Add cellEditor and cellEditorParams for editable columns to ensure validation works
            if (col?.editable) {
              // Create the validation function
              const validationFn = (params) => {
                this.debugLog('[Validation Debug] Default column getValidationErrors called - FUNCTION EXECUTED', {
                  params,
                  columnField: col?.field,
                  columnValidation: col?.validation,
                  value: params?.value,
                  data: params?.data,
                  paramsKeys: params ? Object.keys(params) : 'params is null',
                });
                const errors = getValidationErrors(col, params?.value, params?.data);
                this.debugLog('[Validation Debug] Validation result:', errors);
                return errors;
              };

              // Explicitly set cellEditor to ensure validation is triggered
              // AG Grid's default editor might not call getValidationErrors consistently
              result.cellEditor = 'agTextCellEditor';
              
              this.debugLog('[Validation Debug] Setting cellEditorParams for default column', {
                field: col?.field,
                cellEditor: result.cellEditor,
                hasValidationFn: !!validationFn,
                validationFnType: typeof validationFn,
              });

              result.cellEditorParams = {
                getValidationErrors: validationFn,
              };

              this.debugLog('[Validation Debug] cellEditorParams created', {
                field: col?.field,
                cellEditorParams: result.cellEditorParams,
                hasGetValidationErrors: !!result.cellEditorParams?.getValidationErrors,
                getValidationErrorsType: typeof result.cellEditorParams?.getValidationErrors,
              });
            }

            this.debugLog('[Validation Debug] Default column built', {
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
        if (this.content?.enableDebugLogs) {
          console.warn('[Validation Debug] Column did not match any case', {
            field: col?.field,
            cellDataType: cellDataType,
          });
        }
        return result;
      });

      this.debugLog('[Validation Debug] All column definitions created', {
        count: allColumnDefs.length,
        columns: allColumnDefs.map(col => ({
          field: col?.field,
          cellDataType: col?.cellDataType,
          editable: col?.editable,
          cellEditor: col?.cellEditor,
          hasCellEditorParams: !!col?.cellEditorParams,
          hasGetValidationErrors: !!col?.cellEditorParams?.getValidationErrors,
          validation: this.content.columns.find(c => (c?.field === col?.field || c?.actionName === col?.field))?.validation,
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
      this.debugLog('[Validation Debug] invalidEditValueMode computed:', mode);
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
    /* wwEditor:start */
    checkIfColumnsStructureChanged(newDefs, oldDefs) {
      // If no old defs, structure changed (initial load)
      if (!oldDefs || !Array.isArray(oldDefs)) return false;
      
      // If no new defs or not an array, no structure change
      if (!newDefs || !Array.isArray(newDefs)) return false;
      
      // If number of columns changed, structure changed
      if (newDefs.length !== oldDefs.length) return true;
      
      // Check if column IDs or key properties changed
      for (let i = 0; i < newDefs.length; i++) {
        const newCol = newDefs[i];
        const oldCol = oldDefs[i];
        
        // If either column is undefined/null, consider it a change
        if (!newCol || !oldCol) return true;
        
        // Check if column ID changed
        const newColId = newCol.colId || newCol.field;
        const oldColId = oldCol.colId || oldCol.field;
        if (newColId !== oldColId) return true;
        
        // Check if filter/sortable flags changed
        if (newCol.filter !== oldCol.filter) return true;
        if (newCol.sortable !== oldCol.sortable) return true;
        
        // Check if header name changed
        if (newCol.headerName !== oldCol.headerName) return true;
      }
      
      // No structural changes detected
      return false;
    },
    /* wwEditor:end */
    getRowId(params) {
      // Get ID from formula
      let rowId = this.resolveMappingFormula(this.content.idFormula, params.data);
      
      // Ensure we always return a unique ID
      // If formula returns undefined/null/empty, generate a unique ID based on data
      if (rowId === null || rowId === undefined || rowId === '') {
        // Create a unique ID from the data object
        const dataStr = JSON.stringify(params.data || {});
        let hash = 0;
        for (let i = 0; i < dataStr.length; i++) {
          const char = dataStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        // Use hash + timestamp + random to ensure uniqueness
        rowId = `row-${Math.abs(hash)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else {
        // Convert to string
        rowId = String(rowId);
        
        // Append a hash of the data to ensure uniqueness even if formula returns duplicates
        // This prevents duplicate ID errors when the formula returns the same value for multiple rows
        const dataStr = JSON.stringify(params.data || {});
        let hash = 0;
        for (let i = 0; i < dataStr.length; i++) {
          const char = dataStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        rowId = `${rowId}-${Math.abs(hash)}`;
      }
      
      return String(rowId);
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
      this.debugLog('[Validation Debug] Cell edit requested', {
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
        this.debugLog('[Validation Debug] Attempting manual validation call');
        try {
          const manualResult = cellEditorParams.getValidationErrors({
            value: event.newValue,
            data: event.data,
          });
          this.debugLog('[Validation Debug] Manual validation result:', manualResult);
        } catch (e) {
          console.error('[Validation Debug] Error calling validation manually:', e);
        }
      }
    },
    onCellValueChanged(event) {
      this.debugLog('[Validation Debug] Cell value changed', {
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
      
      // Check if this is a user column (all user columns need safeguard to prevent data fetching)
      const isUserColumn = columnConfig?.cellDataType === 'user';
      const defaultUserIdFormula = { type: 'f', code: 'context.mapping' };
      const userIdFormula = columnConfig?.userIdFormula || defaultUserIdFormula;
      const isForeignKeyColumn = isUserColumn && 
        JSON.stringify(userIdFormula) !== JSON.stringify(defaultUserIdFormula);
      
      // Set flag to prevent data fetching during ANY user column update
      // This prevents watchers from triggering Supabase fetches when we modify user data
      if (isUserColumn) {
        this.debugLog('[User Column Update] Setting isUpdatingDataLocally flag to TRUE');
        this.setUpdatingDataLocally(true);
        this.debugLog('[User Column Update] Flag set, about to process update');
      }
      
      // If it's a foreign key user column, simulate creating a fake junction record
      if (isForeignKeyColumn && newValue) {
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        const userIds = isMultiple && Array.isArray(newValue) ? newValue : (isMultiple ? [newValue] : newValue);
        
        // Helper function to create fake junction record structure based on userIdFormula
        const createFakeJunctionRecord = (userId, formula) => {
          // Parse the formula code to understand the nested structure
          const formulaCode = formula?.code || '';
          
          // Extract path from formula (e.g., "profile.id" from "context.mapping?.profile?.id")
          // Pattern: mapping?.profile?.id or mapping?.['profile']?.['id'] or mapping?.profile?.['id']
          const pathMatch = formulaCode.match(/mapping\?\.?\[?['"]?(\w+)['"]?\]?\?\.?\[?['"]?(\w+)['"]?\]?/);
          
          if (pathMatch && pathMatch.length >= 3) {
            const [, ...pathParts] = pathMatch;
            const path = pathParts.filter(Boolean);
            
            if (path.length > 0) {
              // Create nested structure: { [path[0]]: { [path[1]]: userId } }
              const result = {};
              let current = result;
              for (let i = 0; i < path.length - 1; i++) {
                current[path[i]] = {};
                current = current[path[i]];
              }
              current[path[path.length - 1]] = userId;
              return result;
            }
          }
          
          // Fallback: try common patterns
          if (formulaCode.includes('profile') && formulaCode.includes('id')) {
            return { profile: { id: userId } };
          }
          
          // Default: return simple structure with id
          return { id: userId };
        };
        
        // Create fake junction records
        let fakeJunctionRecord;
        if (isMultiple && Array.isArray(userIds)) {
          fakeJunctionRecord = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormula));
        } else {
          fakeJunctionRecord = createFakeJunctionRecord(userIds, userIdFormula);
        }
        
        try {
          // Update the row data with the fake junction record
          event.data[columnId] = fakeJunctionRecord;
          
          // Refresh the cell to show the updated value
          if (this.gridApi && event.node) {
            this.gridApi.refreshCells({
              rowNodes: [event.node],
              columns: [columnId],
              force: true,
            });
          }
          
          this.debugLog('[Foreign Key] Created fake junction record:', {
            columnId,
            userIdFormula: userIdFormula,
            fakeRecord: fakeJunctionRecord,
          });
        } catch (error) {
          console.error('[Foreign Key] Error creating fake junction record:', error);
        }
      }
      
      // Clear flag after a short delay for ALL user column updates
      // This ensures watchers don't trigger fetches during the update
      if (isUserColumn) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.debugLog('[User Column Update] Clearing isUpdatingDataLocally flag');
            this.setUpdatingDataLocally(false);
            this.debugLog('[User Column Update] Flag cleared');
          }, 200); // Delay to ensure all watchers have processed
        });
      }
      
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: isForeignKeyColumn && event.data?.[columnId] ? event.data[columnId] : newValue, // Use fake junction record if created
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
      // Use setTimeout to avoid calling grid API during render phase
      setTimeout(() => {
        this.gridApi.refreshCells({
          rowNodes: [rowNode],
          columns: [columnId],
          force: true,
        });
      }, 0);
      
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
        columnId: data[0]?.field,
        columnsOrder: data.map((col) => col?.field).filter(Boolean),
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
      async handler(newDefs, oldDefs) {
        if (this.wwEditorState?.boundProps?.columns) return;
        
        // Skip if grid is not ready yet
        if (!this.gridApi) return;
        
        // CRITICAL FIX: Only reset column state if columns structure actually changed
        // Don't reset if only data or other reactive dependencies changed
        // This preserves user-applied filters and sorting
        const shouldResetState = this.checkIfColumnsStructureChanged(newDefs, oldDefs);
        if (shouldResetState && this.gridApi) {
          // Save current filters and sorting before reset
          const currentFilters = this.gridApi.getFilterModel();
          const currentSort = this.gridApi.getState()?.sort?.sortModel;
          
          this.gridApi.resetColumnState();
          
          // Restore filters and sorting after reset if they exist
          if (currentFilters && Object.keys(currentFilters).length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.setFilterModel(currentFilters);
              }
            });
          }
          if (currentSort && currentSort.length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          }
        }

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
