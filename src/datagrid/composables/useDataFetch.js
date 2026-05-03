import { ref, computed, nextTick } from 'vue';
import {
  fetchSupabaseDataPaginated,
  fetchSupabaseDataInfinite,
  createFetchKey,
} from '../../shared/utils/supabaseUtils.js';
import { convertFilterToSupabase as _convertFilterToSupabase } from '../utils/convertFilterToSupabase.js';
import { getSupabaseSortField as _getSupabaseSortField } from '../utils/supabaseFieldMappings.js';

// Owns Supabase data fetching: paginated + infinite, fetch guards, the
// `records` / `isFetching` WeWeb component variables, removed-row tracking,
// and the local-update flag. Also owns the inline filter/search helpers
// (formatFiltersForLog, applySearchToSupabase, applyManualFilters) since
// they're called only by the fetch functions and need props.content access.
//
// Inputs:
//   cfg              — computed merged config ref
//   props            — component props (uses props.content, props.uid)
//   gridApi          — shallowRef from useGridApi
//   debugLog         — from useGridApi
//   isGridRendering  — ref from useGridApi
export function useDataFetch(cfg, props, { gridApi, debugLog, isGridRendering }) {
  // WeWeb component variables
  const { value: records, setValue: setRecords } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'records',
      type: 'array',
      defaultValue: [],
      readonly: true,
    });
  const { value: isFetching, setValue: setIsFetching } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'isFetching',
      type: 'boolean',
      defaultValue: false,
      readonly: true,
    });

  // Supabase data state
  const supabaseData = ref([]);
  const supabaseTotalCount = ref(0);
  const supabaseLoading = ref(false);
  const supabaseError = ref(null);

  // Guard to prevent duplicate/recursive fetches
  const isFetchingData = ref(false);
  const lastFetchParams = ref(null);

  // Flag to prevent data fetching when we're updating data locally (e.g., fake junction records)
  const isUpdatingDataLocally = ref(false);

  // Track removed row IDs for infinite scroll mode (so datasource can filter them out)
  const removedRowIds = ref(new Set());
  const MAX_REMOVED_IDS = 1000; // Prevent unbounded memory growth

  // Cleanup mechanism for removedRowIds Set
  const cleanupRemovedIds = () => {
    const currentSize = removedRowIds.value.size;
    if (currentSize > MAX_REMOVED_IDS) {
      const idsArray = Array.from(removedRowIds.value);
      const keepCount = Math.floor(MAX_REMOVED_IDS * 0.7);
      const idsToKeep = idsArray.slice(-keepCount);
      removedRowIds.value = new Set(idsToKeep);
      debugLog(`[Cleanup] Reduced removedRowIds from ${currentSize} to ${idsToKeep.length} entries`);
    }
  };

  // Clear removed IDs when data source changes or major refresh occurs
  const clearRemovedIds = () => {
    const size = removedRowIds.value.size;
    if (size > 0) {
      removedRowIds.value.clear();
      debugLog(`[Cleanup] Cleared ${size} removed row IDs`);
    }
  };

  // Helper functions to set/get the flag from methods
  const setUpdatingDataLocally = (value) => {
    isUpdatingDataLocally.value = value;
  };
  const getUpdatingDataLocally = () => {
    return isUpdatingDataLocally.value;
  };

  // Determine if infinite scrolling is enabled
  const isInfiniteScrollEnabled = computed(() => {
    return cfg.value?.dataSource === 'supabase' && cfg.value?.enableInfiniteScroll === true;
  });

  // Bound wrappers around pure utils
  const convertFilterToSupabase = (filterModel, query) =>
    _convertFilterToSupabase(filterModel, query, props.content, debugLog);
  const getSupabaseSortField = (columnId) => _getSupabaseSortField(props.content, columnId);

  // Format filters for logging
  const formatFiltersForLog = (filterModel) => {
    if (!filterModel || Object.keys(filterModel).length === 0) {
      return 'none';
    }

    const filterStrings = [];
    for (const [columnId, filter] of Object.entries(filterModel)) {
      if (!filter) continue;

      let filterDesc = `${columnId}: `;

      if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
        filterDesc += `in [${filter.values.join(', ')}]`;
      } else if (filter.filterType === 'text') {
        filterDesc += `${filter.type} "${filter.filter}"`;
      } else if (filter.filterType === 'number') {
        if (filter.type === 'inRange') {
          filterDesc += `${filter.filter} to ${filter.filterTo}`;
        } else {
          filterDesc += `${filter.type} ${filter.filter}`;
        }
      } else if (filter.filterType === 'date') {
        if (filter.type === 'inRange') {
          filterDesc += `${filter.dateFrom} to ${filter.dateTo}`;
        } else {
          filterDesc += `${filter.type} ${filter.dateFrom || filter.filter}`;
        }
      } else if (filter.type === 'selectFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
        filterDesc += `in [${filter.values.join(', ')}]`;
      } else if (filter.filterType === 'set' && filter.values) {
        filterDesc += `in [${filter.values.join(', ')}]`;
      } else {
        filterDesc += `${filter.type || filter.filterType || 'unknown'}`;
      }

      filterStrings.push(filterDesc);
    }

    return filterStrings.length > 0 ? filterStrings.join(' | ') : 'none';
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
    const supabaseSearchFields = validColumns.map(col => {
      const column = props.content?.columns?.find(c => {
        const colId = c?.actionName || c?.field;
        return colId === col || c?.field === col;
      });
      const supabaseField = column?.supabaseFilterField?.trim();
      return (supabaseField && supabaseField.length > 0) ? supabaseField : col;
    });

    // Build OR condition for all searchable columns
    if (supabaseSearchFields.length === 1) {
      return query.ilike(supabaseSearchFields[0], `%${searchTerm}%`);
    } else {
      // Escape single quotes for special characters
      const escapedTerm = searchTerm.replace(/'/g, "''");
      const orConditions = supabaseSearchFields
        .map(col => `${col}.ilike.%${escapedTerm}%`)
        .join(',');
      return query.or(orConditions);
    }
  };

  // Apply manual filters to Supabase query
  const applyManualFilters = (query, manualFilters) => {
    if (!manualFilters || !Array.isArray(manualFilters) || manualFilters.length === 0) {
      return query;
    }

    let currentQuery = query;

    for (const filter of manualFilters) {
      if (!filter?.field || !filter?.operator) {
        continue;
      }

      const field = filter.field;
      const operator = filter.operator;
      const value = filter.value;

      switch (operator) {
        case 'eq':
          currentQuery = currentQuery.eq(field, value);
          break;
        case 'neq':
          currentQuery = currentQuery.neq(field, value);
          break;
        case 'gt':
          currentQuery = currentQuery.gt(field, value);
          break;
        case 'gte':
          currentQuery = currentQuery.gte(field, value);
          break;
        case 'lt':
          currentQuery = currentQuery.lt(field, value);
          break;
        case 'lte':
          currentQuery = currentQuery.lte(field, value);
          break;
        case 'like':
          currentQuery = currentQuery.like(field, value);
          break;
        case 'ilike':
          currentQuery = currentQuery.ilike(field, value);
          break;
        case 'is':
          if (value === 'null' || value === null) {
            currentQuery = currentQuery.is(field, null);
          } else if (value === 'true') {
            currentQuery = currentQuery.is(field, true);
          } else if (value === 'false') {
            currentQuery = currentQuery.is(field, false);
          }
          break;
        case 'in':
          if (Array.isArray(value)) {
            currentQuery = currentQuery.in(field, value);
          } else if (typeof value === 'string' && value.includes(',')) {
            const values = value.split(',').map(v => v.trim());
            currentQuery = currentQuery.in(field, values);
          } else if (value) {
            currentQuery = currentQuery.in(field, [value]);
          }
          break;
        case 'contains':
          currentQuery = currentQuery.contains(field, value);
          break;
        case 'containedBy':
          currentQuery = currentQuery.containedBy(field, value);
          break;
        default:
          currentQuery = currentQuery.eq(field, value);
      }
    }

    return currentQuery;
  };

  // Wait for Supabase instance to become available with exponential backoff
  const waitForSupabaseInstance = async (maxWaitTime = 10000, initialDelay = 100) => {
    const startTime = Date.now();
    let delay = initialDelay;
    const maxDelay = 2000;

    while (Date.now() - startTime < maxWaitTime) {
      const supabase = wwLib.wwPlugins.supabase.instance;
      if (supabase) {
        return supabase;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, maxDelay);
    }

    return null;
  };

  // Fetch data from Supabase for infinite scrolling (returns data directly)
  const fetchSupabaseDataForInfinite = async (startRow, endRow, filterModel = null, sortModel = null, searchValue = null) => {
    if (props.content?.dataSource !== 'supabase') {
      return { data: [], totalCount: 0 };
    }

    const tableName = props.content?.supabaseTable;
    const queryString = props.content?.supabaseQuery || '*';

    if (!tableName) {
      supabaseError.value = 'Supabase table name is required';
      return { data: [], totalCount: 0 };
    }

    try {
      supabaseLoading.value = true;
      supabaseError.value = null;

      const supabase = await waitForSupabaseInstance(10000, 100);
      if (!supabase) {
        throw new Error('Supabase instance not available after waiting');
      }

      return await fetchSupabaseDataInfinite({
        supabaseInstance: supabase,
        tableName,
        queryString,
        manualFilters: props.content?.supabaseFilters,
        searchValue: props.content?.enableSearch ? searchValue : null,
        searchableColumns: props.content?.searchableColumns || [],
        filterModel,
        sortModel,
        startRow,
        endRow,
        applyManualFilters,
        applySearchToSupabase,
        convertFilterToSupabase,
        getSupabaseSortField,
        formatFiltersForLog,
      });
    } catch (error) {
      console.error('[Supabase Infinite] Error fetching data:', error);
      supabaseError.value = error.message || 'Failed to fetch data from Supabase';
      return { data: [], totalCount: 0 };
    } finally {
      supabaseLoading.value = false;
    }
  };

  // Fetch data from Supabase (paginated)
  const fetchSupabaseData = async (page = 1, pageSize = 10, filterModel = null, sortModel = null, searchValue = null) => {
    if (isUpdatingDataLocally.value) {
      return;
    }

    if (props.content?.dataSource !== 'supabase') {
      return;
    }

    const tableName = props.content?.supabaseTable;
    const queryString = props.content?.supabaseQuery || '*';

    if (!tableName) {
      supabaseError.value = 'Supabase table name is required';
      return;
    }

    const fetchKey = createFetchKey({ page, pageSize, filterModel, sortModel, searchValue, tableName, queryString });

    if (isFetchingData.value) {
      return;
    }

    if (lastFetchParams.value === fetchKey) {
      return;
    }

    isFetchingData.value = true;
    lastFetchParams.value = fetchKey;

    try {
      supabaseLoading.value = true;
      supabaseError.value = null;

      const supabase = await waitForSupabaseInstance(10000, 100);
      if (!supabase) {
        throw new Error('Supabase instance not available after waiting');
      }

      const result = await fetchSupabaseDataPaginated({
        supabaseInstance: supabase,
        tableName,
        queryString,
        manualFilters: props.content?.supabaseFilters,
        searchValue: props.content?.enableSearch ? searchValue : null,
        searchableColumns: props.content?.searchableColumns || [],
        filterModel,
        sortModel,
        page,
        pageSize,
        applyManualFilters,
        applySearchToSupabase,
        convertFilterToSupabase,
        getSupabaseSortField,
        formatFiltersForLog,
      });

      supabaseData.value = result.data;
      supabaseTotalCount.value = result.totalCount;

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

  // Update records variable from grid API (gets displayed rows)
  // CRITICAL FIX: This function can trigger error #252 if called during render
  const updateRecordsFromGrid = () => {
    if (!gridApi.value) {
      setRecords([]);
      return;
    }

    if (isGridRendering.value) {
      return;
    }

    try {
      const displayedRows = [];
      gridApi.value.forEachNode((node) => {
        if (node.data) {
          displayedRows.push(node.data);
        }
      });
      setRecords(displayedRows);
    } catch (error) {
      // Check if this is the #252 error and silently retry later
      if (error.message && error.message.includes('#252')) {
        setTimeout(() => updateRecordsFromGrid(), 100);
      } else {
        console.error('[Records] Error updating records from grid:', error);
        setRecords([]);
      }
    }
  };

  return {
    // State
    records,
    setRecords,
    isFetching,
    setIsFetching,
    supabaseData,
    supabaseTotalCount,
    supabaseLoading,
    supabaseError,
    isFetchingData,
    lastFetchParams,
    isUpdatingDataLocally,
    removedRowIds,
    isInfiniteScrollEnabled,
    // Helper setters/getters
    setUpdatingDataLocally,
    getUpdatingDataLocally,
    cleanupRemovedIds,
    clearRemovedIds,
    // Filter helpers (also consumed by useInfiniteScroll for group counts)
    formatFiltersForLog,
    applySearchToSupabase,
    applyManualFilters,
    convertFilterToSupabase,
    getSupabaseSortField,
    // Async fetch operations
    waitForSupabaseInstance,
    fetchSupabaseDataForInfinite,
    fetchSupabaseData,
    updateRecordsFromGrid,
  };
}
