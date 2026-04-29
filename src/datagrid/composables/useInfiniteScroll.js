import { ref, computed, watch, nextTick } from 'vue';
import { fetchSupabaseDataCount } from '../../shared/utils/supabaseUtils.js';

// Owns the AG Grid infinite-scroll datasource (single-grid mode), the per-group
// memoized datasource cache (multi-grid grouping mode), and the upfront-count
// machinery that populates group badges before each group's grid is opened.
//
// Inputs:
//   cfg                              — computed merged config ref
//   props
//   resolveMappingFormula            — for row-id extraction
//   gridApi (from useGridApi)
//   gridReady, isGridRendering       — refs from useGridApi
//   isInfiniteScrollEnabled          — computed ref from useDataFetch
//   isUpdatingDataLocally            — ref from useDataFetch
//   supabaseData, supabaseTotalCount — refs from useDataFetch (datasource reads/writes)
//   removedRowIds                    — ref<Set> from useDataFetch
//   fetchSupabaseDataForInfinite     — function from useDataFetch
//   waitForSupabaseInstance          — function from useDataFetch
//   updateRecordsFromGrid            — function from useDataFetch
//   formatFiltersForLog,
//     applySearchToSupabase,
//     applyManualFilters,
//     convertFilterToSupabase        — helpers from useDataFetch (count requests)
//   grouping deps (still inline in setup until useGrouping in S3):
//     UNASSIGNED_GROUP                — constant string sentinel
//     isGroupingActive                — computed ref
//     groupingColumnId                — computed ref
//     orderedGroups                   — computed ref
//     groupGridApis                   — shallowRef<Map<groupValue, GridApi>>
//     groupInfiniteCounts             — ref<Map<groupValue, number>>
export function useInfiniteScroll(
  cfg,
  props,
  resolveMappingFormula,
  {
    gridApi,
    gridReady,
    isGridRendering,
    isInfiniteScrollEnabled,
    isUpdatingDataLocally,
    supabaseData,
    supabaseTotalCount,
    removedRowIds,
    fetchSupabaseDataForInfinite,
    waitForSupabaseInstance,
    updateRecordsFromGrid,
    formatFiltersForLog,
    applySearchToSupabase,
    applyManualFilters,
    convertFilterToSupabase,
    UNASSIGNED_GROUP,
    isGroupingActive,
    groupingColumnId,
    orderedGroups,
    groupGridApis,
    groupInfiniteCounts,
  }
) {
  // Row model type - 'infinite' if enabled, otherwise undefined (defaults to client-side)
  const rowModelType = computed(() => {
    return isInfiniteScrollEnabled.value ? 'infinite' : undefined;
  });

  // Row drag managed - disabled for infinite row model (not supported by AG Grid)
  const rowDragManaged = computed(() => {
    return !isInfiniteScrollEnabled.value;
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
      return cfg.value?.infiniteBlockSize || 200;
    }
    return undefined;
  });

  // Create datasource for infinite scrolling
  const datasource = computed(() => {
    if (!isInfiniteScrollEnabled.value) {
      return undefined;
    }

    return {
      rowCount: undefined, // Will be determined dynamically
      getRows: async (params) => {
        const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;

        // Skip fetching if we're updating data locally (e.g., removing a row)
        // This prevents unnecessary re-fetches when we're making local modifications.
        // For infinite scroll, AG Grid will automatically try to refetch when rows are removed.
        // We prevent this by checking the flag and using the current supabaseData cache.
        if (isUpdatingDataLocally.value) {
          // Return filtered cached data — if cached data is empty or we filtered everything
          // out, return empty with adjusted total. This tells AG Grid there's no data for
          // this block, which will hide empty rows.
          let cachedData = Array.isArray(supabaseData.value) ? [...supabaseData.value] : [];
          let cachedTotal = supabaseTotalCount.value || 0;

          // CRITICAL: Filter out any removed rows (tracked in removedRowIds ref)
          if (removedRowIds.value && removedRowIds.value.size > 0) {
            const beforeFilter = cachedData.length;
            cachedData = cachedData.filter(row => {
              if (!row) return false;
              const rowId = resolveMappingFormula(props.content?.idFormula, row);
              const rowIdStr = rowId != null ? String(rowId) : '';
              return !removedRowIds.value.has(rowIdStr);
            });
            const afterFilter = cachedData.length;
            if (beforeFilter > afterFilter && cachedTotal > 0) {
              cachedTotal = Math.max(0, cachedTotal - (beforeFilter - afterFilter));
            }
          }

          const finalTotal = cachedData.length > 0 ? cachedTotal : (cachedTotal > 0 ? cachedTotal : 0);
          // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
          isGridRendering.value = true;
          setTimeout(() => {
            try {
              successCallback(cachedData, finalTotal > 0 ? finalTotal : (cachedData.length > 0 ? undefined : 0));
            } finally {
              setTimeout(() => {
                isGridRendering.value = false;
              }, 50);
            }
          }, 0);
          return;
        }
        const requestedBlockSize = endRow - startRow;

        try {
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;

          const { data, totalCount } = await fetchSupabaseDataForInfinite(
            startRow,
            endRow,
            filterModel,
            sortModel,
            searchValue
          );

          const rowCount = data.length;

          // CRITICAL FIX: Handle 0 rows case
          // If totalCount is 0, we're definitely done (no rows to show)
          // If we got fewer rows than requested, we're done (last block)
          // If we've reached or exceeded totalCount, we're done
          const isLastBlock = totalCount === 0 ||
                              rowCount < requestedBlockSize ||
                              (totalCount > 0 && endRow >= totalCount);

          // CRITICAL FIX: Set lastRow to 0 when totalCount is 0 (no rows)
          const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

          // Update supabaseData for records variable first (before callback)
          // Note: In infinite scroll mode, supabaseData will only contain the current block;
          // the grid manages the full dataset internally.
          supabaseData.value = data;
          supabaseTotalCount.value = totalCount;

          // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
          isGridRendering.value = true;
          setTimeout(() => {
            try {
              successCallback(data, lastRow);
            } catch (error) {
              console.error('[Infinite Scroll] Error in successCallback:', error);
            } finally {
              setTimeout(() => {
                isGridRendering.value = false;
                nextTick(() => {
                  setTimeout(() => {
                    updateRecordsFromGrid();
                  }, 50);
                });
              }, 50);
            }
          }, 0);
        } catch (error) {
          console.error('[Infinite Scroll] Error in getRows:', error);
          isGridRendering.value = false;
          setTimeout(() => {
            failCallback();
          }, 0);
        }
      },
    };
  });

  // CRITICAL FIX: Delay datasource initialization to prevent error #252
  // AG Grid can call getRows during its initial render cycle, causing conflicts.
  // We use a ref that's set after grid is ready, not a computed, to have better control.
  const delayedDatasource = ref(undefined);

  // Watch for grid ready to set the datasource after a delay
  watch(
    () => [gridReady.value, isInfiniteScrollEnabled.value, datasource.value],
    ([ready, infiniteEnabled, ds]) => {
      if (ready && infiniteEnabled && ds && !delayedDatasource.value) {
        setTimeout(() => {
          delayedDatasource.value = ds;
        }, 100);
      } else if (!infiniteEnabled) {
        delayedDatasource.value = undefined;
      }
    },
    { immediate: true }
  );

  // ========== PER-GROUP INFINITE-SCROLL DATASOURCES ==========
  // Each group grid gets its own IDatasource whose getRows injects a filter
  // for its group value. Datasources are memoized by groupValue so the prop
  // identity is stable across renders — AG Grid only resets its cache when
  // the datasource reference itself changes.

  const groupDatasourceCache = new Map();

  // Build a filter model that forces the grouping column to match `groupValue`.
  // For UNASSIGNED_GROUP we use the `__empty__` sentinel which convertFilterToSupabase
  // translates to `IS NULL`.
  const buildGroupFilterModel = (baseFilterModel, groupValue) => {
    const colId = groupingColumnId.value;
    if (!colId) return baseFilterModel || {};
    const merged = { ...(baseFilterModel || {}) };
    const values = groupValue === UNASSIGNED_GROUP ? ['__empty__'] : [groupValue];
    merged[colId] = { type: 'selectFilter', values };
    return merged;
  };

  // Returns a memoized IDatasource for the given group value.
  // Returns undefined when not in grouping + infinite-scroll mode.
  const groupDatasourceFor = (groupValue) => {
    if (!isGroupingActive.value || !isInfiniteScrollEnabled.value) return undefined;
    const key = String(groupValue);
    const existing = groupDatasourceCache.get(key);
    if (existing) return existing;

    const ds = {
      rowCount: undefined,
      getRows: async (params) => {
        const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;
        const mergedFilter = buildGroupFilterModel(filterModel, groupValue);
        const requestedBlockSize = endRow - startRow;

        try {
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          const { data, totalCount } = await fetchSupabaseDataForInfinite(
            startRow,
            endRow,
            mergedFilter,
            sortModel,
            searchValue
          );

          // Cache per-group total so badge counts stay accurate.
          if (typeof totalCount === 'number' && totalCount >= 0) {
            const next = new Map(groupInfiniteCounts.value);
            next.set(groupValue, totalCount);
            groupInfiniteCounts.value = next;
          }

          const rowCount = data.length;
          const isLastBlock =
            totalCount === 0 ||
            rowCount < requestedBlockSize ||
            (totalCount > 0 && endRow >= totalCount);
          const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

          // Defer to avoid AG Grid error #252 (callback during render cycle).
          setTimeout(() => {
            try { successCallback(data, lastRow); }
            catch (e) { console.error(`[Group Infinite] successCallback error for "${groupValue}":`, e); }
          }, 0);
        } catch (error) {
          console.error(`[Group Infinite] getRows error for "${groupValue}":`, error);
          setTimeout(() => { try { failCallback(); } catch (_) { /* noop */ } }, 0);
        }
      },
    };
    groupDatasourceCache.set(key, ds);
    return ds;
  };

  // Invalidate the datasource cache (and counts) when grouping column changes
  // or infinite-scroll toggles. A new cache entry produces a new reference,
  // which causes AG Grid to rebuild its infinite cache for each group.
  watch(
    () => [groupingColumnId.value, isInfiniteScrollEnabled.value],
    () => {
      groupDatasourceCache.clear();
      groupInfiniteCounts.value = new Map();
    }
  );

  // Refresh a specific group's infinite cache (e.g. after a cross-group cell edit).
  const refreshGroupInfiniteCache = (groupValue) => {
    if (!isInfiniteScrollEnabled.value) return;
    const api = groupGridApis.value.get(groupValue);
    if (!api) return;
    try { api.purgeInfiniteCache(); }
    catch (e) { console.warn(`[Group Infinite] purge failed for "${groupValue}":`, e?.message); }
  };

  // ========== UPFRONT GROUP COUNTS ==========
  // Without this, group badges only display once a group's grid is opened
  // (the count is a side-effect of the rows fetch in groupDatasourceFor).
  // Here we fire a count-only Supabase request per group up front so badges
  // are populated even while groups are collapsed.

  const fetchSupabaseGroupCount = async (filterModel) => {
    if (props.content?.dataSource !== 'supabase') return null;
    const tableName = props.content?.supabaseTable;
    if (!tableName) return null;
    try {
      const supabase = await waitForSupabaseInstance(10000, 100);
      if (!supabase) return null;
      return await fetchSupabaseDataCount({
        supabaseInstance: supabase,
        tableName,
        manualFilters: props.content?.supabaseFilters,
        searchValue: props.content?.enableSearch ? props.content?.searchValue : null,
        searchableColumns: props.content?.searchableColumns || [],
        filterModel,
        applyManualFilters,
        applySearchToSupabase,
        convertFilterToSupabase,
        formatFiltersForLog,
      });
    } catch (error) {
      console.error('[Group Count] fetch error:', error);
      return null;
    }
  };

  // Pull the AG Grid filter model that's currently active. In multi-grid mode
  // all group grids share the same filter (synced by onGroupFilterChanged), so
  // any one will do. Falls back to viewConfiguration.filters if grids aren't
  // mounted yet (initial load).
  const getCurrentFilterModelForCount = () => {
    for (const api of groupGridApis.value.values()) {
      try {
        const m = api.getFilterModel();
        if (m) return m;
      } catch (_) { /* noop */ }
    }
    const vc = cfg.value?.viewConfiguration;
    if (vc && vc.filters && typeof vc.filters === 'object') return vc.filters;
    return null;
  };

  // Generation counter so a stale set of in-flight requests can't stomp on a
  // newer one (e.g. user changes filter while previous counts are still loading).
  let groupCountsGeneration = 0;
  let groupCountsTimer = null;

  const refreshGroupCounts = async () => {
    if (!isGroupingActive.value || !isInfiniteScrollEnabled.value) return;
    const myGen = ++groupCountsGeneration;
    const baseFilter = getCurrentFilterModelForCount();
    const groups = orderedGroups.value.map(g => g.value);
    if (groups.length === 0) return;

    const results = await Promise.all(
      groups.map(async (groupValue) => {
        const filter = buildGroupFilterModel(baseFilter, groupValue);
        const count = await fetchSupabaseGroupCount(filter);
        return [groupValue, count];
      })
    );

    // Bail if a newer refresh started while this one was in flight.
    if (myGen !== groupCountsGeneration) return;

    const next = new Map(groupInfiniteCounts.value);
    for (const [gv, count] of results) {
      if (typeof count === 'number') next.set(gv, count);
    }
    groupInfiniteCounts.value = next;
  };

  // Debounce so that bursts of triggers (e.g. grouping + filter applied in the
  // same tick from view configuration) collapse into a single request batch.
  const scheduleRefreshGroupCounts = () => {
    if (groupCountsTimer) clearTimeout(groupCountsTimer);
    groupCountsTimer = setTimeout(() => {
      groupCountsTimer = null;
      refreshGroupCounts();
    }, 50);
  };

  // Re-fetch on any input that affects the count: grouping toggle, grouping
  // column, search value, manual filters. AG Grid filter changes are picked
  // up by onGroupFilterChanged in useGrouping (which calls scheduleRefreshGroupCounts).
  watch(
    () => [
      isGroupingActive.value,
      isInfiniteScrollEnabled.value,
      groupingColumnId.value,
      props.content?.searchValue,
      props.content?.supabaseFilters,
    ],
    () => { scheduleRefreshGroupCounts(); },
    { immediate: true, deep: true }
  );

  return {
    rowModelType,
    rowDragManaged,
    paginationEnabled,
    cacheBlockSize,
    datasource,
    delayedDatasource,
    groupDatasourceFor,
    refreshGroupInfiniteCache,
    fetchSupabaseGroupCount,
    scheduleRefreshGroupCounts,
  };
}
