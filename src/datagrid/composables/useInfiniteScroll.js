import { ref, shallowRef, computed, watch } from 'vue';
import { fetchSupabaseDataCount } from '../../shared/utils/supabaseUtils.js';

// Paged-append composable. Despite the filename, this is no longer the AG Grid
// `infinite` row-model integration — the grid now runs in plain client-side mode
// and this module owns the segmented fetch + scroll-triggered append behavior
// that mimics infinite scroll while keeping filter and sort resolution on the
// server.
//
// Modes managed here:
//   • Single grid: pagedRowData is bound as :rowData. loadInitial seeds the
//     first block, loadMore appends the next block, refetchAll resets on
//     filter/sort change.
//   • Per-group grids: a Map<groupValue, { rowData, total, offset, loadingMore,
//     loaded }> mirrors the same lifecycle for each visible group grid.
//
// Filter/sort changes are picked up by useFiltersAndSort and dispatched to
// refetchAll / refetchAllForGroup. Group badges still use upfront count
// requests via fetchSupabaseGroupCount + scheduleRefreshGroupCounts so a
// collapsed group's count is accurate without mounting its grid.
//
// Inputs:
//   cfg                              — computed merged config ref
//   props
//   resolveMappingFormula            — for row-id extraction (unused here today
//                                      but kept for future ID-aware reconciliation)
//   gridApi                          — shallowRef from useGridApi (single-grid api)
//   gridReady                        — ref from useGridApi
//   isInfiniteScrollEnabled          — computed ref from useDataFetch (semantics
//                                      now: paged-append + server filter/sort)
//   supabaseTotalCount               — ref from useDataFetch (mirrored for the
//                                      single-grid totalCount path)
//   fetchSupabaseDataForInfinite     — paged fetch primitive from useDataFetch
//   waitForSupabaseInstance, applyManualFilters, applySearchToSupabase,
//     convertFilterToSupabase, formatFiltersForLog
//                                    — used for group-count requests
//   UNASSIGNED_GROUP                  — sentinel string from useGrouping
//   isGroupingActive, groupingColumnId, orderedGroups, groupGridApis,
//     groupInfiniteCounts             — refs from useGrouping (count map name
//                                      kept as `groupInfiniteCounts` for
//                                      compatibility — meaning is unchanged:
//                                      total matching rows per group)
export function useInfiniteScroll(
  cfg,
  props,
  resolveMappingFormula,
  {
    gridApi,
    gridReady,
    isInfiniteScrollEnabled,
    supabaseTotalCount,
    fetchSupabaseDataForInfinite,
    waitForSupabaseInstance,
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
  // ========== SINGLE-GRID PAGED-APPEND STATE ==========
  // pagedRowData is bound as the grid's :rowData prop. AG Grid diffs by
  // getRowId on prop changes — appending preserves existing rendered rows
  // and only mounts the new ones.
  const pagedRowData = ref([]);
  const loadedOffset = ref(0);
  const isLoadingMore = ref(false);
  const totalCount = ref(0);
  const hasInitialLoaded = ref(false);

  const blockSize = computed(() => Number(cfg.value?.infiniteBlockSize) || 200);

  // No row model: client-side default. Drag is always managed (the prior
  // false-when-infinite branch is gone). Pagination stays disabled in
  // paged-append mode — scrolling drives fetches instead.
  const rowModelType = computed(() => undefined);
  const rowDragManaged = computed(() => true);
  const paginationEnabled = computed(() => {
    if (isInfiniteScrollEnabled.value) return false;
    return props.content?.pagination;
  });

  const allLoaded = computed(() => {
    if (!hasInitialLoaded.value) return false;
    return loadedOffset.value >= totalCount.value && totalCount.value >= 0;
  });

  const readSearchValue = () =>
    props.content?.enableSearch ? props.content?.searchValue : null;

  const loadInitial = async (filterModel = null, sortModel = null, searchValue = readSearchValue()) => {
    if (!isInfiniteScrollEnabled.value) return;
    // In grouped mode the single grid is unmounted (v-if="!isGroupingActive")
    // and the per-group composables drive their own loads — skip the wasted
    // server round-trip that would only write to an unbound pagedRowData.
    if (isGroupingActive.value) return;
    const size = blockSize.value;
    const { data, totalCount: total } = await fetchSupabaseDataForInfinite(
      0,
      size,
      filterModel,
      sortModel,
      searchValue
    );
    pagedRowData.value = Array.isArray(data) ? data : [];
    loadedOffset.value = pagedRowData.value.length;
    totalCount.value = typeof total === 'number' ? total : pagedRowData.value.length;
    supabaseTotalCount.value = totalCount.value;
    hasInitialLoaded.value = true;
  };

  // Append next block via api.applyTransaction so the existing rendered
  // viewport isn't reset. We also push to pagedRowData so the prop and
  // grid stay in sync (AG Grid's diff is a no-op in this case because
  // every existing rowId is preserved).
  const loadMore = async (api, filterModel = null, sortModel = null, searchValue = readSearchValue()) => {
    if (!isInfiniteScrollEnabled.value) return;
    if (isGroupingActive.value) return; // Per-group grids use loadMoreForGroup instead.
    if (isLoadingMore.value) return;
    if (allLoaded.value) return;
    isLoadingMore.value = true;
    try {
      const start = loadedOffset.value;
      const end = start + blockSize.value;
      const { data, totalCount: total } = await fetchSupabaseDataForInfinite(
        start,
        end,
        filterModel,
        sortModel,
        searchValue
      );
      const batch = Array.isArray(data) ? data : [];
      if (batch.length > 0 && api) {
        try { api.applyTransaction({ add: batch }); }
        catch (e) { console.warn('[PagedAppend] applyTransaction add failed:', e?.message); }
      }
      pagedRowData.value = [...pagedRowData.value, ...batch];
      loadedOffset.value = pagedRowData.value.length;
      if (typeof total === 'number') {
        totalCount.value = total;
        supabaseTotalCount.value = total;
      }
    } finally {
      isLoadingMore.value = false;
    }
  };

  // Filter/sort changes call this to discard loaded rows and refetch from
  // offset 0. AG Grid's prop diff resets the viewport when pagedRowData is
  // reassigned to a fresh array.
  const refetchAll = async (filterModel = null, sortModel = null, searchValue = readSearchValue()) => {
    if (!isInfiniteScrollEnabled.value) return;
    // In grouped mode the orchestrator routes to refetchAllVisibleGroups —
    // the single-grid path is dormant. Skip so we don't double-fetch.
    if (isGroupingActive.value) return;
    pagedRowData.value = [];
    loadedOffset.value = 0;
    hasInitialLoaded.value = false;
    await loadInitial(filterModel, sortModel, searchValue);
  };

  // ========== PER-GROUP PAGED-APPEND STATE ==========
  // Map<groupValue, { rowData: row[], total: number, offset: number,
  //                    loadingMore: boolean, loaded: boolean }>
  const groupPagedState = shallowRef(new Map());

  const getGroupEntry = (groupValue) => {
    const map = groupPagedState.value;
    let entry = map.get(groupValue);
    if (!entry) {
      entry = { rowData: [], total: 0, offset: 0, loadingMore: false, loaded: false };
      const next = new Map(map);
      next.set(groupValue, entry);
      groupPagedState.value = next;
    }
    return entry;
  };

  // Reactive accessor for a group's rowData — used by the template binding.
  const groupPagedRowData = (groupValue) => {
    return groupPagedState.value.get(groupValue)?.rowData || [];
  };

  // Inject the grouping-column filter into every per-group fetch so the
  // server only returns rows belonging to that group. UNASSIGNED maps to the
  // `__empty__` sentinel that convertFilterToSupabase translates to IS NULL.
  const buildGroupFilterModel = (baseFilterModel, groupValue) => {
    const colId = groupingColumnId.value;
    if (!colId) return baseFilterModel || {};
    const merged = { ...(baseFilterModel || {}) };
    const values = groupValue === UNASSIGNED_GROUP ? ['__empty__'] : [groupValue];
    merged[colId] = { type: 'selectFilter', values };
    return merged;
  };

  const writeGroupEntry = (groupValue, partial) => {
    const map = groupPagedState.value;
    const prev = map.get(groupValue) || { rowData: [], total: 0, offset: 0, loadingMore: false, loaded: false };
    const next = new Map(map);
    next.set(groupValue, { ...prev, ...partial });
    groupPagedState.value = next;
  };

  const loadInitialForGroup = async (
    groupValue,
    filterModel = null,
    sortModel = null,
    searchValue = readSearchValue()
  ) => {
    if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
    // Idempotent: if state is already populated (initial fetch already
    // resolved earlier, OR a cross-group cell edit just optimistically
    // injected a row), do not overwrite. This is critical for the
    // empty-group → first-row case: the group's count flipped 0→1, its
    // grid mounted (v-if), grid-ready fired, and the staggered call to
    // this function would otherwise refetch from Supabase before the
    // user-side workflow's write has landed — getting stale rows back
    // and clobbering the optimistic injection. Explicit refetch paths
    // (refetchAllForGroup / refetchAllVisibleGroups) reset `loaded` to
    // false before calling this, so they bypass the guard cleanly.
    const existing = groupPagedState.value.get(groupValue);
    if (existing?.loaded) return;
    // Fast path for known-empty groups: the upfront count request
    // (refreshGroupCounts) has already established the group has zero
    // matching rows. Skip the no-op data fetch and write an empty entry
    // so AG Grid's noRowsOverlay can render immediately.
    const knownCount = groupInfiniteCounts.value.get(groupValue);
    if (knownCount === 0) {
      writeGroupEntry(groupValue, {
        rowData: [],
        total: 0,
        offset: 0,
        loadingMore: false,
        loaded: true,
      });
      return;
    }
    const merged = buildGroupFilterModel(filterModel, groupValue);
    const size = blockSize.value;
    const { data, totalCount: total } = await fetchSupabaseDataForInfinite(
      0,
      size,
      merged,
      sortModel,
      searchValue
    );
    const rows = Array.isArray(data) ? data : [];
    writeGroupEntry(groupValue, {
      rowData: rows,
      total: typeof total === 'number' ? total : rows.length,
      offset: rows.length,
      loadingMore: false,
      loaded: true,
    });
    if (typeof total === 'number') {
      const counts = new Map(groupInfiniteCounts.value);
      counts.set(groupValue, total);
      groupInfiniteCounts.value = counts;
    }
  };

  const loadMoreForGroup = async (
    groupValue,
    api,
    filterModel = null,
    sortModel = null,
    searchValue = readSearchValue()
  ) => {
    if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
    const entry = getGroupEntry(groupValue);
    if (entry.loadingMore) return;
    if (entry.loaded && entry.offset >= entry.total) return;
    writeGroupEntry(groupValue, { loadingMore: true });
    try {
      const merged = buildGroupFilterModel(filterModel, groupValue);
      const start = entry.offset;
      const end = start + blockSize.value;
      const { data, totalCount: total } = await fetchSupabaseDataForInfinite(
        start,
        end,
        merged,
        sortModel,
        searchValue
      );
      const batch = Array.isArray(data) ? data : [];
      if (batch.length > 0 && api) {
        try { api.applyTransaction({ add: batch }); }
        catch (e) { console.warn(`[PagedAppend group="${groupValue}"] applyTransaction add failed:`, e?.message); }
      }
      const refreshed = getGroupEntry(groupValue);
      writeGroupEntry(groupValue, {
        rowData: [...refreshed.rowData, ...batch],
        offset: refreshed.offset + batch.length,
        total: typeof total === 'number' ? total : refreshed.total,
        loadingMore: false,
      });
      if (typeof total === 'number') {
        const counts = new Map(groupInfiniteCounts.value);
        counts.set(groupValue, total);
        groupInfiniteCounts.value = counts;
      }
    } catch (e) {
      writeGroupEntry(groupValue, { loadingMore: false });
      throw e;
    }
  };

  const refetchAllForGroup = async (
    groupValue,
    filterModel = null,
    sortModel = null,
    searchValue = readSearchValue()
  ) => {
    if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
    writeGroupEntry(groupValue, { rowData: [], offset: 0, loaded: false, loadingMore: false });
    await loadInitialForGroup(groupValue, filterModel, sortModel, searchValue);
  };

  // Filter/sort/search/table changes in grouped mode dispatch through here.
  // Strategy: clear state for unmounted groups (so their next expand fetches
  // fresh), then refetch every currently-mounted group in parallel. Badge
  // counts are refreshed separately via scheduleRefreshGroupCounts so the
  // collapsed groups' badges stay accurate without mounting their grids.
  const refetchAllVisibleGroups = async (
    filterModel = null,
    sortModel = null,
    searchValue = readSearchValue()
  ) => {
    if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
    const mountedKeys = new Set(groupGridApis.value.keys());
    // Drop stale state for collapsed groups so when they expand again their
    // grid-ready triggers a fresh loadInitialForGroup with the new model.
    const next = new Map();
    groupPagedState.value.forEach((entry, key) => {
      if (mountedKeys.has(key)) next.set(key, entry);
    });
    groupPagedState.value = next;
    await Promise.all(
      Array.from(mountedKeys).map(gv =>
        refetchAllForGroup(gv, filterModel, sortModel, searchValue)
          .catch(e => console.warn(`[PagedAppend] refetch group="${gv}" failed:`, e?.message))
      )
    );
  };

  // Stable row-id extractor for state lookups. We MUST NOT use object
  // reference equality to find rows in groupPagedState.rowData: the user's
  // WeWeb workflow (and Supabase realtime) frequently call rowNode.setData
  // with a fresh object after a write, so `event.data` from a later drag
  // event is not === to the object originally fetched and stored in state.
  // That broke the cross-group drop's removeRowFromGroupState (removed: 0)
  // and let the count climb monotonically on back-and-forth drags. Resolve
  // the configured id formula so we always compare by stable identity.
  const getRowKey = (data) => {
    if (data == null) return null;
    try {
      const k = resolveMappingFormula?.(cfg.value?.idFormula, data);
      if (k != null && k !== '') return String(k);
    } catch (_) { /* fall through */ }
    return null;
  };

  // Per-group last-local-mutation timestamp. Used by refreshGroupCounts to
  // avoid clobbering optimistic counts with a stale server value: the
  // user's WeWeb workflow may take >1.5 s to land the Supabase write, and
  // during rapid back-and-forth drags the post-drop server refresh
  // otherwise reports counts from BEFORE the optimistic move (e.g.
  // displays "2 éléments" right after the user moved a row out, because
  // the server hasn't seen the move yet).
  const groupCountLocalMutationAt = new Map();
  // Window during which a server-fetched count is suppressed in favour of
  // the local optimistic count. Long enough to cover slow Supabase writes
  // + a couple of follow-up drags without the badges jumping back.
  const LOCAL_MUTATION_GRACE_MS = 4000;
  const stampGroupMutation = (groupValue) => {
    groupCountLocalMutationAt.set(groupValue, Date.now());
  };
  const isGroupRecentlyMutated = (groupValue) => {
    const t = groupCountLocalMutationAt.get(groupValue);
    return typeof t === 'number' && (Date.now() - t) < LOCAL_MUTATION_GRACE_MS;
  };

  // Cross-group cell edits & drags drive these directly so the source/dest
  // grids reflect the move without waiting for the server.
  // `target` may be a row reference (matched by ===) or a predicate function.
  // Reference equality is preferred — the rows held in groupPagedState are
  // the same Supabase result objects that AG Grid passes back as event.data,
  // so the caller can hand us the data object directly without worrying
  // about id-formula resolution.
  const removeRowFromGroupState = (groupValue, target) => {
    const entry = groupPagedState.value.get(groupValue);
    if (!entry) return false;
    let predicate;
    if (typeof target === 'function') {
      predicate = target;
    } else {
      // Match by stable row-id. Reference equality was the original
      // implementation but it silently no-ops after a setData() refresh
      // replaces the row's data object — see getRowKey() comment.
      const targetKey = getRowKey(target);
      predicate = targetKey != null
        ? (row) => getRowKey(row) === targetKey
        : (row) => row === target;
    }
    const filtered = entry.rowData.filter(row => !predicate(row));
    const removed = entry.rowData.length - filtered.length;
    if (removed === 0) return false;
    const newTotal = Math.max(0, entry.total - removed);
    writeGroupEntry(groupValue, {
      rowData: filtered,
      offset: Math.max(0, entry.offset - removed),
      total: newTotal,
    });
    if (typeof entry.total === 'number') {
      const counts = new Map(groupInfiniteCounts.value);
      counts.set(groupValue, newTotal);
      groupInfiniteCounts.value = counts;
    }
    stampGroupMutation(groupValue);
    return true;
  };

  const addRowToGroupState = (groupValue, row) => {
    const entry = getGroupEntry(groupValue);
    // Dedup by stable row-id (NOT reference equality — see getRowKey()
    // comment: rowNode.setData refreshes break === between drags). Without
    // id-based dedup, dragging a row out and back into the same group
    // after the workflow's setData would prepend a "different" object
    // with the same id, double-counting and showing 2 instead of 1.
    const rowKey = getRowKey(row);
    if (Array.isArray(entry.rowData)) {
      if (rowKey != null) {
        if (entry.rowData.some((r) => getRowKey(r) === rowKey)) return;
      } else if (entry.rowData.includes(row)) {
        // Fallback: no idFormula configured → reference dedup as before.
        return;
      }
    }
    const newTotal = entry.total + 1;
    writeGroupEntry(groupValue, {
      rowData: [row, ...entry.rowData],
      offset: entry.offset + 1,
      total: newTotal,
      loaded: true,
    });
    const counts = new Map(groupInfiniteCounts.value);
    counts.set(groupValue, newTotal);
    groupInfiniteCounts.value = counts;
    stampGroupMutation(groupValue);
  };

  // Reset all per-group state when grouping toggles or column changes — the
  // previous group keys no longer apply.
  watch(
    () => [groupingColumnId.value, isInfiniteScrollEnabled.value],
    () => {
      groupPagedState.value = new Map();
      groupInfiniteCounts.value = new Map();
    }
  );

  // ========== UPFRONT GROUP COUNTS ==========
  // Count-only Supabase requests so badges show correct totals even for
  // collapsed groups whose grids are unmounted.

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

  // All group grids share the same column-filter state (synced by
  // onGroupFilterChanged), so any one's filterModel works for the count
  // requests. Falls back to viewConfiguration.filters when no grid is mounted.
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

  // Generation counter so a stale set of in-flight requests doesn't stomp on
  // a newer one (e.g. user changes filter while previous counts are still
  // resolving).
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

    if (myGen !== groupCountsGeneration) return;

    const next = new Map(groupInfiniteCounts.value);
    for (const [gv, count] of results) {
      // Skip groups that were locally mutated within the grace window —
      // the optimistic count is more accurate than the server response,
      // which lags behind the user's WeWeb persistence workflow. Without
      // this, a rapid A→B→A drag sequence flickers wrong totals (e.g.
      // "2 éléments" right after the row was moved out, because Supabase
      // still has the row in its old group when we asked).
      if (isGroupRecentlyMutated(gv)) continue;
      if (typeof count === 'number') next.set(gv, count);
    }
    groupInfiniteCounts.value = next;
  };

  // Debounce so bursts of triggers (e.g. grouping + filter applied in the
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
    // Grid options (kept for compatibility — single source of truth lives here)
    rowModelType,
    rowDragManaged,
    paginationEnabled,
    // Single-grid paged-append API
    pagedRowData,
    loadedOffset,
    totalCount,
    isLoadingMore,
    hasInitialLoaded,
    allLoaded,
    blockSize,
    loadInitial,
    loadMore,
    refetchAll,
    // Per-group paged-append API
    groupPagedState,
    groupPagedRowData,
    loadInitialForGroup,
    loadMoreForGroup,
    refetchAllForGroup,
    refetchAllVisibleGroups,
    addRowToGroupState,
    removeRowFromGroupState,
    // Mutation stamping for the count-refresh race guard. Drag/drop paths
    // outside this composable that bump groupInfiniteCounts directly
    // (e.g. the collapsed-dest fast path in useGrouping.handleCrossGroupDrop)
    // call this so refreshGroupCounts won't clobber their optimistic write
    // with a stale server value.
    stampGroupMutation,
    // Group counts
    fetchSupabaseGroupCount,
    refreshGroupCounts,
    scheduleRefreshGroupCounts,
  };
}
