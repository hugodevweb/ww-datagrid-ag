import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import {
  fetchSupabaseDataAll,
  createFetchKey,
} from '../../shared/utils/supabaseUtils.js';
import { convertFilterToSupabase as _convertFilterToSupabase } from '../utils/convertFilterToSupabase.js';
import { getSupabaseSortField as _getSupabaseSortField } from '../utils/supabaseFieldMappings.js';

// Owns Supabase data fetching for the datagrid. The grid now uses AG Grid's
// client-side row model exclusively — on mount (and whenever a server-side
// input like supabaseFilters / searchValue changes) we burst-fetch the entire
// table via fetchSupabaseDataAll and hand the full array to AG Grid as
// rowData. AG Grid handles all subsequent filtering/sorting/scrolling in
// memory, which is what gives the datagrid its Monday.com-like feel (no blank
// rows during scroll).
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

  // True while the *first* burst is in flight and supabaseData is still empty.
  // Drives the AG Grid loading overlay so users see a clear "loading…" state
  // for the multi-second initial fetch. Subsequent re-fetches (caused by
  // searchValue / supabaseFilters changes) flip isFetching only; the grid
  // keeps its existing rows visible while the new data loads.
  const isInitialLoading = ref(false);

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

  // AbortController for the most recent burst. Toggling supabaseFilters or
  // searchValue rapidly cancels any in-flight chunks before kicking off a
  // fresh burst — prevents stale data from clobbering the grid.
  let currentAbortController = null;

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

  // Single bulk fetch that loads the entire dataset into supabaseData. Called
  // on mount and whenever a server-side input changes (manual filters, search,
  // searchable columns, table/query). AG Grid filter & sort changes do NOT
  // trigger this — they're handled in-memory by the client-side row model.
  const fetchAllSupabaseData = async (searchValue) => {
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

    // Dedupe: if the same set of inputs is already in flight or just resolved,
    // skip. AG Grid filter/sort intentionally excluded — those are client-side.
    const fetchKey = createFetchKey({
      tableName,
      queryString,
      searchValue: searchValue ?? null,
      manualFilters: props.content?.supabaseFilters || null,
      searchableColumns: props.content?.searchableColumns || null,
    });

    if (isFetchingData.value && lastFetchParams.value === fetchKey) {
      return;
    }
    if (lastFetchParams.value === fetchKey && supabaseData.value.length > 0) {
      return;
    }

    // Cancel any prior burst still in flight (rapid filter/search changes).
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const abortSignal = currentAbortController.signal;

    isFetchingData.value = true;
    lastFetchParams.value = fetchKey;
    setIsFetching(true);

    // Only show the full overlay on the very first load (empty grid). Re-fetches
    // caused by filter/search changes keep the grid populated while updating.
    const isFirstLoad = supabaseData.value.length === 0;
    if (isFirstLoad) {
      isInitialLoading.value = true;
    }

    try {
      supabaseLoading.value = true;
      supabaseError.value = null;

      const supabase = await waitForSupabaseInstance(10000, 100);
      if (!supabase) {
        throw new Error('Supabase instance not available after waiting');
      }

      const result = await fetchSupabaseDataAll({
        supabaseInstance: supabase,
        tableName,
        queryString,
        manualFilters: props.content?.supabaseFilters,
        searchValue: props.content?.enableSearch ? searchValue : null,
        searchableColumns: props.content?.searchableColumns || [],
        // No AG Grid filter/sort here — client-side handles them.
        filterModel: null,
        sortModel: null,
        applyManualFilters,
        applySearchToSupabase,
        convertFilterToSupabase,
        getSupabaseSortField,
        formatFiltersForLog,
        abortSignal,
        onProgress: ({ loaded, total, chunkIndex, totalChunks }) => {
          debugLog(`[LoadAll] Loaded ${loaded}/${total} rows (chunk ${chunkIndex}/${totalChunks - 1})`);
        },
      });

      if (abortSignal.aborted) {
        return; // Newer burst started; let it own the result.
      }

      supabaseData.value = result.data;
      supabaseTotalCount.value = result.totalCount;

      if (result.truncated) {
        supabaseError.value = `Dataset exceeds the ${result.totalCount}-row cap. Reduce your filter scope to load all rows.`;
      }

      // Defer records refresh — matches the pattern used in the old paginated
      // path so AG Grid finishes its render cycle before we walk its nodes.
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
        }, 100);
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        // Expected — user changed inputs before this burst finished.
        return;
      }
      console.error('[Supabase LoadAll] Error fetching data:', error);
      supabaseError.value = error.message || 'Failed to fetch data from Supabase';
      supabaseData.value = [];
      supabaseTotalCount.value = 0;
      setRecords([]);
    } finally {
      supabaseLoading.value = false;
      isInitialLoading.value = false;
      setIsFetching(false);
      // Brief delay matches the legacy guard's behavior, lets AG Grid settle.
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

  // Reactive watcher: fire the initial burst on mount and re-burst whenever
  // server-side inputs change. Debounced 250ms so search-bar typing collapses
  // into a single fetch.
  let watcherDebounceTimer = null;
  const triggerFetchDebounced = (searchValue) => {
    if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = setTimeout(() => {
      watcherDebounceTimer = null;
      fetchAllSupabaseData(searchValue);
    }, 250);
  };

  watch(
    () => [
      props.content?.dataSource,
      props.content?.supabaseTable,
      props.content?.supabaseQuery,
      props.content?.searchValue,
      // JSON.stringify so deep config changes are detected without a deep watcher.
      JSON.stringify(props.content?.supabaseFilters || null),
      JSON.stringify(props.content?.searchableColumns || null),
    ],
    () => {
      if (props.content?.dataSource !== 'supabase') {
        // Clear any leftover Supabase state when switching to manual mode.
        supabaseData.value = [];
        supabaseTotalCount.value = 0;
        return;
      }
      triggerFetchDebounced(props.content?.searchValue);
    },
    { immediate: true }
  );

  // Cancel any in-flight burst when the component unmounts.
  onBeforeUnmount(() => {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
  });

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
    isInitialLoading,
    // Helper setters/getters
    setUpdatingDataLocally,
    getUpdatingDataLocally,
    // Filter helpers (still used by useFiltersAndSort/etc.)
    formatFiltersForLog,
    applySearchToSupabase,
    applyManualFilters,
    convertFilterToSupabase,
    getSupabaseSortField,
    // Async fetch operations
    waitForSupabaseInstance,
    fetchAllSupabaseData,
    updateRecordsFromGrid,
  };
}
