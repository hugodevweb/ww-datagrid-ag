import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { findRowNode } from '../utils/rowLookup.js';
import { getTranslations } from '../../shared/utils/sharedHelpers.js';

// The grouping feature: state, computed views (orderedGroups, groupedRowData),
// the per-view persisted collapsed-state machinery, all group-grid event handlers
// (grid-ready / filter / sort / column / selection / row-drag), drag-reorder of
// group headers, the multi-grid horizontal scrollbar sync, and the show/hide
// loading transition.
//
// Cross-composable dependencies that are defined LATER in setup() (data-fetch
// helpers from useInfiniteScroll, view-config writeback from useViewConfig,
// single-grid event handlers from useFiltersAndSort) are passed as thunks
// (`getX: () => x`). Thunks resolve at event-call time, by which point the
// downstream composables have been created and the values exist.
//
// Args:
//   cfg, props, ctx, resolveMappingFormula
//   deps: {
//     gridApi, gridReady, debugLog       — from useGridApi
//     gridContainerRef                   — DOM ref from setup()
//     findColumnByField                  — bound wrapper from setup()
//     setSelectedRows                    — from useSelection
//     isInfiniteScrollEnabled, supabaseData — from useDataFetch
//
//     // Thunks (late-bound — return values become valid after the orchestrator
//     // has finished wiring all composables together):
//     getIsVirtualColumn                 — function still inline in setup()
//     getUpdateCurrentConfig             — from useViewConfig (S4)
//     getScheduleRefreshGroupCounts      — from useInfiniteScroll
//     getGroupDatasourceFor              — from useInfiniteScroll
//     getOnFilterChanged, getOnSortChanged          — from useFiltersAndSort
//     getOnColumnMoved, getOnColumnResized          — still inline in setup()
//     getFilterValue, getSortValue       — refs from useFiltersAndSort
//     getColumnOrder, getCurrentConfig   — refs from setup() / useViewConfig (S4)
//   }
export function useGrouping(
  cfg,
  props,
  ctx,
  resolveMappingFormula,
  {
    gridApi,
    gridReady,
    debugLog,
    gridContainerRef,
    findColumnByField,
    setSelectedRows,
    isInfiniteScrollEnabled,
    supabaseData,
    getIsVirtualColumn,
    getUpdateCurrentConfig,
    getScheduleRefreshGroupCounts,
    getGroupDatasourceFor,
    getOnFilterChanged,
    getOnSortChanged,
    getOnColumnMoved,
    getOnColumnResized,
    getFilterValue,
    getSortValue,
    getColumnOrder,
    getCurrentConfig,
  }
) {
  // Sentinel used as the key for rows whose grouping column value is null/empty.
  const UNASSIGNED_GROUP = '__unassigned__';

  // Group collapsed state lives outside viewConfiguration in a dedicated WeWeb
  // object variable keyed by view id: { [viewId]: [groupValue, ...] }. The view
  // id comes from a separate WeWeb variable that exposes the current view.
  const VIEW_VARIABLE_ID = '23742aed-c957-4a20-b9ac-df6642c96015';
  const GROUP_COLLAPSED_VARIABLE_ID = '48f1f1e8-79c5-4adc-8b9f-909c5c75e605';

  const getCurrentViewId = () => {
    try {
      const view = wwLib.wwVariable.getValue(VIEW_VARIABLE_ID);
      return view?.id ?? null;
    } catch (e) {
      return null;
    }
  };

  const getStoredCollapsedForView = () => {
    const viewId = getCurrentViewId();
    if (!viewId) return [];
    try {
      const map = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
      if (!map || typeof map !== 'object') return [];
      const arr = map[viewId];
      return Array.isArray(arr) ? [...arr] : [];
    } catch (e) {
      return [];
    }
  };

  const persistCollapsedForView = (collapsed) => {
    const viewId = getCurrentViewId();
    if (!viewId) return;
    try {
      const current = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
      const next = current && typeof current === 'object' ? { ...current } : {};
      next[viewId] = Array.isArray(collapsed) ? [...collapsed] : [];
      wwLib.wwVariable.updateValue(GROUP_COLLAPSED_VARIABLE_ID, next);
    } catch (e) {
      debugLog('[GroupCollapsed] Could not persist collapsed state:', e);
    }
  };

  // Grouping state — source of truth for grouping. columnId/order/showUnassigned
  // are mirrored into viewConfiguration.grouping; collapsed is persisted in the
  // dedicated WeWeb variable above (keyed by view id) instead.
  const groupingState = ref({ columnId: null, order: [], collapsed: [], showUnassigned: true });
  const pendingGroupingColumnId = ref(null);
  const isGroupingTransitionLoading = ref(false);
  const groupingTransitionStartedAt = ref(0);
  let groupingTransitionTimer = null;

  // Map<groupValue, GridApi> — populated from each group grid's grid-ready event.
  const groupGridApis = shallowRef(new Map());

  // AG Grid `alignedGrids` feed — returns every currently-mounted group grid
  // so all siblings auto-sync column widths, column order, visibility, pinning,
  // and horizontal scroll natively (v34 feature). Passed as a function so it
  // re-reads the live Map on every call. Self-inclusion is harmless (AG Grid's
  // `consuming` flag and doHorizontalScroll early-return short-circuit recursion).
  const alignedGridApisForGroup = () => {
    if (!isGroupingActive.value) return [];
    return Array.from(groupGridApis.value.values()).filter(Boolean);
  };

  // Map<groupValue, row[]> — aggregated selection across group grids.
  const groupSelections = ref(new Map());

  // Map<rowId, { newGroupValue }> — rows whose grouping-column value was just
  // edited in the current grid. The per-group infinite datasource consults
  // this Map and filters out any row whose pending move targets a different
  // group, so the row disappears from its old group immediately on the next
  // refetch — regardless of whether the parent workflow has finished writing
  // to Supabase. Without this, the post-edit refetch returns the row with
  // its old (pre-write) grouping value and the row pops back into the
  // source group.
  // Entries auto-expire after PENDING_MOVE_TTL_MS so a missing/failed write
  // doesn't permanently hide rows.
  const pendingGroupingMoves = shallowRef(new Map());
  const PENDING_MOVE_TTL_MS = 10000;
  const pendingMoveTimers = new Map();

  const setPendingGroupingMove = (rowId, newGroupValue) => {
    if (rowId == null || rowId === '') return;
    const key = String(rowId);
    const next = new Map(pendingGroupingMoves.value);
    next.set(key, { newGroupValue });
    pendingGroupingMoves.value = next;
    // Reset the expiry timer if this row is moved again before the previous
    // pending entry expired.
    const prevTimer = pendingMoveTimers.get(key);
    if (prevTimer) clearTimeout(prevTimer);
    const t = setTimeout(() => {
      pendingMoveTimers.delete(key);
      const cur = new Map(pendingGroupingMoves.value);
      if (cur.has(key)) {
        cur.delete(key);
        pendingGroupingMoves.value = cur;
      }
    }, PENDING_MOVE_TTL_MS);
    pendingMoveTimers.set(key, t);
  };

  const clearPendingGroupingMove = (rowId) => {
    if (rowId == null || rowId === '') return;
    const key = String(rowId);
    const t = pendingMoveTimers.get(key);
    if (t) { clearTimeout(t); pendingMoveTimers.delete(key); }
    if (!pendingGroupingMoves.value.has(key)) return;
    const cur = new Map(pendingGroupingMoves.value);
    cur.delete(key);
    pendingGroupingMoves.value = cur;
  };

  // Reentry guards for cross-grid synchronization.
  const isSyncingLayout = ref(false);
  const isSyncingFilters = ref(false);
  const isSyncingSort = ref(false);
  const isSyncingGroupHorizontalScroll = ref(false);
  const groupHorizontalScrollRef = ref(null);
  const groupHorizontalScrollWidth = ref(0);
  const groupHorizontalViewportWidth = ref(0);
  const groupHorizontalScrollLeft = ref(0);

  // Drag-reorder state for group headers.
  const groupDragValue = ref(null);
  const groupDragOverValue = ref(null);

  // Runtime-only override: empty groups are collapsed by default (regardless
  // of the persisted state), but the user can manually expand one by clicking
  // its chevron. Tracked here per-session — not persisted, so reload returns
  // empty groups to the default collapsed display while preserving the
  // stored "expanded when populated" intent.
  const manuallyExpandedEmptyGroups = ref(new Set());

  // Track which invalid-columnId warning has already been logged (avoid log spam).
  const warnedInvalidGroupingColumn = ref(null);

  const isSelectColumn = (colId) => {
    const col = findColumnByField(colId);
    return !!col && col.cellDataType === 'select';
  };

  const isValidGroupColumn = (colId) => {
    if (!colId) return false;
    return isSelectColumn(colId);
  };

  const groupingColumnId = computed(() => groupingState.value?.columnId || null);

  // Grouping is active only when a valid select column is configured.
  // Works across local, Supabase paginated, and Supabase infinite-scroll modes.
  const isGroupingActive = computed(() => {
    const colId = groupingColumnId.value;
    if (!colId) return false;
    if (!isValidGroupColumn(colId)) {
      if (warnedInvalidGroupingColumn.value !== colId) {
        warnedInvalidGroupingColumn.value = colId;
        console.warn(`[Datagrid] viewConfiguration.grouping.columnId="${colId}" is invalid or not a select column — grouping disabled.`);
      }
      return false;
    }
    if (warnedInvalidGroupingColumn.value === colId) {
      warnedInvalidGroupingColumn.value = null;
    }
    return true;
  });

  // Extract an option's color for a given group value from the select column's options.
  const getGroupColor = (colId, groupValue) => {
    if (groupValue === UNASSIGNED_GROUP) return '#9ca3af';
    const col = findColumnByField(colId);
    const options = Array.isArray(col?.options) ? col.options : [];
    const match = options.find(o => String(o?.value) === String(groupValue));
    return match?.color || '#e5e7eb';
  };

  const getGroupLabel = (colId, groupValue) => {
    if (groupValue === UNASSIGNED_GROUP) return getTranslations(cfg.value?.lang || 'en').kanbanUnassigned;
    const col = findColumnByField(colId);
    const options = Array.isArray(col?.options) ? col.options : [];
    const match = options.find(o => String(o?.value) === String(groupValue));
    return match?.label ?? String(groupValue);
  };

  // Normalize a raw cell value to a group key string.
  const rowGroupKey = (row, colId) => {
    const raw = row?.[colId];
    if (raw === null || raw === undefined || raw === '') return UNASSIGNED_GROUP;
    return String(raw);
  };

  // Source data for grouping — unified across data sources.
  // Local: rowData. Supabase paginated: supabaseData.
  // Infinite scroll: empty — each group grid owns its own IDatasource via
  // groupDatasourceFor(). Counts come from groupInfiniteCounts instead.
  const groupingSourceRows = computed(() => {
    if (!isGroupingActive.value) return [];
    if (isInfiniteScrollEnabled.value) return [];
    if (cfg.value?.dataSource === 'supabase') {
      return Array.isArray(supabaseData.value) ? supabaseData.value : [];
    }
    const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
    return Array.isArray(data) ? data : [];
  });

  // Map<groupValue, row[]>
  const groupedRowData = computed(() => {
    if (!isGroupingActive.value) return new Map();
    const colId = groupingColumnId.value;
    const out = new Map();
    for (const row of groupingSourceRows.value) {
      const key = rowGroupKey(row, colId);
      let arr = out.get(key);
      if (!arr) { arr = []; out.set(key, arr); }
      arr.push(row);
    }
    return out;
  });

  const groupRowData = (groupValue) => groupedRowData.value.get(groupValue) || [];

  // Row counts for badge display in infinite-scroll mode — populated by each
  // per-group datasource's getRows on successful fetch. Map<groupValue, totalCount>
  const groupInfiniteCounts = ref(new Map());

  // Compute the ordered list of groups to render.
  const orderedGroups = computed(() => {
    if (!isGroupingActive.value) return [];
    const colId = groupingColumnId.value;
    const col = findColumnByField(colId);
    const options = Array.isArray(col?.options) ? col.options : [];
    const orderArr = Array.isArray(groupingState.value?.order) ? groupingState.value.order : [];
    const collapsedSet = new Set(Array.isArray(groupingState.value?.collapsed) ? groupingState.value.collapsed : []);
    const dataMap = groupedRowData.value;
    const infiniteCounts = isInfiniteScrollEnabled.value ? groupInfiniteCounts.value : null;

    // Count resolution:
    //  - Infinite-scroll: use totalCount reported by each group's datasource (null if unknown yet).
    //  - Local / paginated: partition the in-memory dataset.
    const countFor = (value) => {
      if (infiniteCounts) {
        return infiniteCounts.has(value) ? infiniteCounts.get(value) : null;
      }
      return dataMap.get(value)?.length || 0;
    };

    const manualExpand = manuallyExpandedEmptyGroups.value;
    // Default-closed policy: a group is only opened once we know it has rows
    // AND the persisted cache says it should be expanded (i.e. not in
    // collapsedSet). While the count is still unknown (infinite-scroll
    // pre-fetch, count === null) the group stays closed — the previous
    // policy opened it from the cache and then collapsed it on a 0 count,
    // which produced a visible flicker on load.
    // Empty groups (confirmed count === 0) remain closed unless the user
    // manually expanded them this session.
    const computeCollapsed = (value, count) => {
      if (count === 0) return !manualExpand.has(value);
      if (count == null) return true;
      return collapsedSet.has(value);
    };
    const base = options.map((o) => {
      const value = String(o.value);
      const count = countFor(value);
      return {
        value,
        label: o.label ?? value,
        color: o.color || '#e5e7eb',
        count,
        collapsed: computeCollapsed(value, count),
      };
    });

    // Unassigned group:
    //  - User-toggleable via groupingState.showUnassigned (default true).
    //  - Local / paginated: only show when it has rows (we know the full set).
    //  - Infinite-scroll: always show — we can't cheaply know upfront if null
    //    rows exist, and the group's datasource will report 0 if not.
    const unassignedCount = countFor(UNASSIGNED_GROUP);
    const userShowUnassigned = groupingState.value?.showUnassigned !== false;
    const showUnassigned = userShowUnassigned && (
      infiniteCounts
        ? true
        : (unassignedCount || 0) > 0
    );
    if (showUnassigned) {
      base.push({
        value: UNASSIGNED_GROUP,
        label: getTranslations(cfg.value?.lang || 'en').kanbanUnassigned,
        color: '#9ca3af',
        count: unassignedCount,
        collapsed: computeCollapsed(UNASSIGNED_GROUP, unassignedCount),
      });
    }

    // Apply custom order (listed first), then append any unlisted groups at the end.
    if (orderArr.length === 0) return base;
    const byValue = new Map(base.map(g => [g.value, g]));
    const ordered = [];
    for (const v of orderArr) {
      if (byValue.has(v)) { ordered.push(byValue.get(v)); byValue.delete(v); }
    }
    byValue.forEach(g => ordered.push(g));
    return ordered;
  });

  const hasGroupHorizontalOverflow = computed(() => (
    isGroupingActive.value &&
    groupHorizontalScrollWidth.value > groupHorizontalViewportWidth.value + 1
  ));

  // Columns that qualify as a grouping target (cellDataType === 'select').
  // Drives the dropdown inside the chooser panel's Grouping tab.
  const selectableGroupingColumns = computed(() => {
    const cols = Array.isArray(props.content?.columns) ? props.content.columns : [];
    return cols
      .filter(c => c?.field && c?.cellDataType === 'select')
      .map(c => ({
        field: c.field,
        displayName: c.headerName || c.displayName || c.field,
      }));
  });

  // ========== HORIZONTAL SCROLLBAR SYNC ==========

  // Read scroll geometry from .ag-center-cols-viewport (visible width via
  // clientWidth) and its .ag-center-cols-container child (content width via
  // scrollWidth). We previously read from .ag-body-horizontal-scroll-viewport,
  // but per-group CSS forces that element to height:0/overflow:hidden, which
  // makes scrollWidth unreliable in autoHeight mode and causes the shared
  // sticky bar to never appear.
  const getGroupHorizontalScrollViewports = () => {
    if (!gridContainerRef.value) return [];
    return Array.from(
      gridContainerRef.value.querySelectorAll('.ww-group__grid .ag-center-cols-viewport')
    );
  };

  const runAfterGroupLayout = (callback) => {
    nextTick(() => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
      } else {
        setTimeout(callback, 0);
      }
    });
  };

  const updateGroupHorizontalScrollbarMetrics = () => {
    runAfterGroupLayout(() => {
      const viewport = getGroupHorizontalScrollViewports().find(el => el.clientWidth > 0);
      const container = viewport?.querySelector('.ag-center-cols-container');
      const contentWidth = container?.scrollWidth || viewport?.scrollWidth || 0;
      groupHorizontalScrollWidth.value = contentWidth;
      groupHorizontalViewportWidth.value = viewport?.clientWidth || 0;
      if (viewport && gridContainerRef.value) {
        const containerRect = gridContainerRef.value.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        groupHorizontalScrollLeft.value = Math.max(0, viewportRect.left - containerRect.left);
      } else {
        groupHorizontalScrollLeft.value = 0;
      }

      if (viewport && groupHorizontalScrollRef.value) {
        groupHorizontalScrollRef.value.scrollLeft = viewport.scrollLeft || 0;
      }
    });
  };

  const syncGroupHorizontalScrollLeft = (left) => {
    if (isSyncingGroupHorizontalScroll.value) return;
    isSyncingGroupHorizontalScroll.value = true;

    const nextLeft = Number.isFinite(left) ? left : 0;
    getGroupHorizontalScrollViewports().forEach((viewport) => {
      if (Math.abs((viewport.scrollLeft || 0) - nextLeft) > 1) {
        viewport.scrollLeft = nextLeft;
      }
    });

    if (groupHorizontalScrollRef.value && Math.abs(groupHorizontalScrollRef.value.scrollLeft - nextLeft) > 1) {
      groupHorizontalScrollRef.value.scrollLeft = nextLeft;
    }

    const releaseSync = () => {
      isSyncingGroupHorizontalScroll.value = false;
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(releaseSync);
    } else {
      setTimeout(releaseSync, 0);
    }
  };

  const onGroupHorizontalScrollbarScroll = (event) => {
    syncGroupHorizontalScrollLeft(event?.target?.scrollLeft || 0);
  };

  const onGroupBodyScroll = (event) => {
    if (isSyncingGroupHorizontalScroll.value) return;
    const left = typeof event?.left === 'number'
      ? event.left
      : (getGroupHorizontalScrollViewports()[0]?.scrollLeft || 0);
    if (groupHorizontalScrollRef.value && Math.abs(groupHorizontalScrollRef.value.scrollLeft - left) > 1) {
      groupHorizontalScrollRef.value.scrollLeft = left;
    }
  };

  const handleGroupHorizontalResize = () => {
    if (isGroupingActive.value) {
      updateGroupHorizontalScrollbarMetrics();
    }
  };

  watch(
    () => [isGroupingActive.value, orderedGroups.value.length],
    ([active]) => {
      if (active) {
        updateGroupHorizontalScrollbarMetrics();
      } else {
        groupHorizontalScrollWidth.value = 0;
        groupHorizontalViewportWidth.value = 0;
        groupHorizontalScrollLeft.value = 0;
      }
    },
    { flush: 'post' }
  );

  let groupHorizontalResizeObserver = null;

  onMounted(() => {
    const frontWindow = wwLib?.getFrontWindow?.() || window;
    frontWindow.addEventListener('resize', handleGroupHorizontalResize);
    // Container-level RO catches column resizes / layout shifts that don't
    // fire window.resize, keeping the shared bar's spacer width fresh.
    if (typeof ResizeObserver !== 'undefined' && gridContainerRef.value) {
      groupHorizontalResizeObserver = new ResizeObserver(() => {
        if (isGroupingActive.value) updateGroupHorizontalScrollbarMetrics();
      });
      groupHorizontalResizeObserver.observe(gridContainerRef.value);
    }
    updateGroupHorizontalScrollbarMetrics();
  });

  // ========== PER-GRID EVENT HANDLERS ==========

  // Called when each group grid fires grid-ready. Registers the api and
  // applies current shared state (filter / sort / widths) so a newly-expanded
  // group picks up the live view.
  const onGroupGridReady = (groupValue, params) => {
    groupGridApis.value.set(groupValue, params.api);
    // Trigger reactivity
    groupGridApis.value = new Map(groupGridApis.value);

    // Promote the first group's api to the primary `gridApi` so existing
    // code paths that reference gridApi.value keep working.
    if (!gridApi.value || !Array.from(groupGridApis.value.values()).includes(gridApi.value)) {
      gridApi.value = params.api;
      gridReady.value = true;
    }

    // Apply any already-active filter / sort / widths to this new grid
    try {
      const filterValue = getFilterValue?.();
      const filterModel = filterValue?.value || {};
      if (filterModel && Object.keys(filterModel).length > 0) {
        params.api.setFilterModel(filterModel);
      }
      const sortValue = getSortValue?.();
      const sortModel = Array.isArray(sortValue?.value) ? sortValue.value : [];
      if (sortModel.length > 0) {
        params.api.applyColumnState({ state: sortModel, defaultState: { sort: null } });
      }
      // Apply widths from currentConfig.sizes if available
      const currentConfig = getCurrentConfig?.();
      const sizes = currentConfig?.value?.sizes;
      if (sizes && typeof sizes === 'object' && Object.keys(sizes).length > 0) {
        const state = Object.entries(sizes).map(([colId, width]) => ({ colId, width }));
        params.api.applyColumnState({ state });
      }
      // Apply column order if available
      const columnOrder = getColumnOrder?.();
      const order = Array.isArray(columnOrder?.value) ? columnOrder.value : [];
      if (order.length > 0) {
        params.api.applyColumnState({
          state: order.map(colId => ({ colId })),
          applyOrder: true,
        });
      }
    } catch (e) {
      debugLog('[Grouping] Error applying initial state to new group grid:', e);
    }

    updateGroupHorizontalScrollbarMetrics();

    // In infinite-scroll mode, assign this group's datasource — but stagger
    // the assignment across groups so N grids don't fire getRows in the same
    // tick (which can trigger AG Grid error #252 on initial mount and also
    // hammer Supabase with N parallel requests). Stagger = 100ms + 50ms × index.
    if (isInfiniteScrollEnabled.value && isGroupingActive.value) {
      const idx = orderedGroups.value.findIndex(g => g.value === groupValue);
      const delay = 100 + Math.max(0, idx) * 50;
      setTimeout(() => {
        // Guard: grid might have been unmounted (collapsed) or grouping disabled
        // before the timer fires.
        const stillMounted = groupGridApis.value.get(groupValue) === params.api;
        if (!stillMounted || !isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
        const groupDatasourceFor = getGroupDatasourceFor?.();
        const ds = groupDatasourceFor?.(groupValue);
        if (!ds) return;
        try {
          params.api.setGridOption('datasource', ds);
          debugLog(`[Group Infinite] Assigned datasource for "${groupValue}" after ${delay}ms`);
        } catch (e) {
          console.warn(`[Group Infinite] Failed to set datasource for "${groupValue}":`, e?.message);
        }
      }, delay);
    }
  };

  const onGroupGridUnmounted = (groupValue) => {
    groupGridApis.value.delete(groupValue);
    groupGridApis.value = new Map(groupGridApis.value);
    groupSelections.value.delete(groupValue);
    updateGroupHorizontalScrollbarMetrics();
  };

  // Route a single-grid event to every group grid, then run the legacy handler
  // with the firing grid set as `gridApi.value`.
  const withFiringGrid = (event, handler) => {
    const prev = gridApi.value;
    try {
      if (event?.api) gridApi.value = event.api;
      return handler(event);
    } finally {
      gridApi.value = prev;
    }
  };

  const onGroupFilterChanged = (groupValue, event) => {
    if (isSyncingFilters.value) return;
    if (!event?.api) return;
    isSyncingFilters.value = true;
    try {
      const model = event.api.getFilterModel();
      groupGridApis.value.forEach((api, gv) => {
        if (gv === groupValue) return;
        try { api.setFilterModel(model); } catch (_) { /* noop */ }
      });
    } finally {
      nextTick(() => { isSyncingFilters.value = false; });
    }
    const onFilterChanged = getOnFilterChanged?.();
    if (onFilterChanged) withFiringGrid(event, onFilterChanged);
    // Refresh the per-group badge counts to reflect the new filter — counts
    // would otherwise stay stale until each group's grid is opened.
    const scheduleRefreshGroupCounts = getScheduleRefreshGroupCounts?.();
    scheduleRefreshGroupCounts?.();
  };

  const onGroupSortChanged = (groupValue, event) => {
    if (isSyncingSort.value) return;
    if (!event?.api) return;
    isSyncingSort.value = true;
    try {
      const sortModel = event.api.getState()?.sort?.sortModel || [];
      groupGridApis.value.forEach((api, gv) => {
        if (gv === groupValue) return;
        try { api.applyColumnState({ state: sortModel, defaultState: { sort: null } }); } catch (_) { /* noop */ }
      });
    } finally {
      nextTick(() => { isSyncingSort.value = false; });
    }
    const onSortChanged = getOnSortChanged?.();
    if (onSortChanged) withFiringGrid(event, onSortChanged);
  };

  const onGroupColumnResized = (groupValue, event) => {
    if (!event?.finished || event.source !== 'uiColumnResized') return;
    if (isSyncingLayout.value) return;
    isSyncingLayout.value = true;
    try {
      const columns = event.api.getAllGridColumns() || [];
      const state = columns.map(col => ({ colId: col.getColId(), width: col.getActualWidth() }));
      groupGridApis.value.forEach((api, gv) => {
        if (gv === groupValue) return;
        try { api.applyColumnState({ state }); } catch (_) { /* noop */ }
      });
    } finally {
      nextTick(() => {
        isSyncingLayout.value = false;
        updateGroupHorizontalScrollbarMetrics();
      });
    }
    const onColumnResized = getOnColumnResized?.();
    if (onColumnResized) withFiringGrid(event, onColumnResized);
  };

  const onGroupColumnMoved = (groupValue, event) => {
    if (!event?.finished || event.source !== 'uiColumnMoved') return;
    if (isSyncingLayout.value) return;
    isSyncingLayout.value = true;
    try {
      const isVirtualColumn = getIsVirtualColumn?.();
      const columns = event.api.getAllGridColumns().filter(col => isVirtualColumn ? !isVirtualColumn(col) : true);
      const newOrder = columns.map(col => col.getColId());
      groupGridApis.value.forEach((api, gv) => {
        if (gv === groupValue) return;
        try { api.applyColumnState({ state: newOrder.map(colId => ({ colId })), applyOrder: true }); } catch (_) { /* noop */ }
      });
    } finally {
      nextTick(() => {
        isSyncingLayout.value = false;
        updateGroupHorizontalScrollbarMetrics();
      });
    }
    const onColumnMoved = getOnColumnMoved?.();
    if (onColumnMoved) withFiringGrid(event, onColumnMoved);
  };

  const onGroupSelectionChanged = (groupValue, event) => {
    if (!event?.api) return;
    const selected = event.api.getSelectedRows() || [];
    groupSelections.value.set(groupValue, selected);
    const all = [];
    groupSelections.value.forEach(rows => { all.push(...rows); });
    setSelectedRows(all);
  };

  // Per-group selection event emits (rowSelected/rowDeselected)
  const onGroupRowSelected = (groupValue, event) => {
    const name = event.node.isSelected() ? 'rowSelected' : 'rowDeselected';
    ctx.emit('trigger-event', {
      name,
      event: { row: event.data },
    });
  };

  // ========== DRAG-REORDER OF GROUP HEADERS ==========

  const resetGroupDrag = () => {
    groupDragValue.value = null;
    groupDragOverValue.value = null;
  };

  const onGroupDragStart = (groupValue) => {
    groupDragValue.value = groupValue;
  };

  const onGroupDragOver = (groupValue) => {
    if (groupDragValue.value && groupValue !== groupDragValue.value) {
      groupDragOverValue.value = groupValue;
    }
  };

  const onGroupDrop = (targetValue) => {
    const from = groupDragValue.value;
    if (!from || from === targetValue) { resetGroupDrag(); return; }
    const currentOrder = orderedGroups.value.map(g => g.value);
    const fi = currentOrder.indexOf(from);
    const ti = currentOrder.indexOf(targetValue);
    if (fi === -1 || ti === -1) { resetGroupDrag(); return; }
    const next = [...currentOrder];
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    writeGroupingToViewConfig({ order: next });
    resetGroupDrag();
  };

  const onGroupDragEnd = () => {
    resetGroupDrag();
  };

  // ========== COLLAPSE / EXPAND ==========

  // Toggle a single group's collapsed state and persist.
  // Empty groups (count === 0) flip the session-only override instead of the
  // persisted state, so the stored "expanded when populated" intent is kept.
  const toggleGroupCollapsed = (groupValue) => {
    const group = orderedGroups.value.find(g => g.value === groupValue);
    if (group && group.count === 0) {
      const next = new Set(manuallyExpandedEmptyGroups.value);
      if (next.has(groupValue)) next.delete(groupValue);
      else next.add(groupValue);
      manuallyExpandedEmptyGroups.value = next;
      updateGroupHorizontalScrollbarMetrics();
      return;
    }
    // Drive the persisted state from what the user *sees* (group.collapsed),
    // not from the raw collapsedSet membership. With the default-closed
    // policy, an unknown-count group can be visually closed while persisted
    // as expanded; clicking it should open it (remove from collapsedSet),
    // not flip it to "persisted closed".
    const wasCollapsed = group?.collapsed ?? false;
    const collapsedList = Array.isArray(groupingState.value?.collapsed) ? [...groupingState.value.collapsed] : [];
    const idx = collapsedList.indexOf(groupValue);
    if (wasCollapsed) {
      if (idx >= 0) collapsedList.splice(idx, 1);
    } else {
      if (idx < 0) collapsedList.push(groupValue);
    }
    writeGroupingToViewConfig({ collapsed: collapsedList });
    updateGroupHorizontalScrollbarMetrics();
  };

  const collapseAllGroups = () => {
    const all = orderedGroups.value.map(g => g.value);
    writeGroupingToViewConfig({ collapsed: all });
    updateGroupHorizontalScrollbarMetrics();
  };

  const expandAllGroups = () => {
    writeGroupingToViewConfig({ collapsed: [] });
    updateGroupHorizontalScrollbarMetrics();
  };

  // Merge a partial grouping update into groupingState and refresh currentConfig.
  // When `collapsed` is part of the update, persist it to the dedicated WeWeb
  // variable (keyed by view id) — collapsed state is no longer part of
  // viewConfiguration. Collapsed-only updates never refresh currentConfig or
  // touch the view-edited variable, so toggling groups never marks the view
  // as edited.
  const writeGroupingToViewConfig = (partial) => {
    const prev = groupingState.value || {};
    const next = {
      columnId: prev.columnId ?? null,
      order: Array.isArray(prev.order) ? [...prev.order] : [],
      collapsed: Array.isArray(prev.collapsed) ? [...prev.collapsed] : [],
      showUnassigned: prev.showUnassigned !== false,
      ...partial,
    };
    groupingState.value = next;

    const partialKeys = Object.keys(partial || {});
    const onlyCollapsed = partialKeys.length === 1 && partialKeys[0] === 'collapsed';

    if ('collapsed' in partial) {
      persistCollapsedForView(next.collapsed);
    }

    if (onlyCollapsed) return;
    const updateCurrentConfig = getUpdateCurrentConfig?.();
    updateCurrentConfig?.();
  };

  // ========== TRANSITION (loading overlay during grouping change) ==========

  const afterNextPaint = (callback) => {
    const schedule = () => setTimeout(callback, 0);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(schedule);
    } else {
      schedule();
    }
  };

  const startGroupingTransition = () => {
    if (groupingTransitionTimer) {
      clearTimeout(groupingTransitionTimer);
      groupingTransitionTimer = null;
    }
    groupingTransitionStartedAt.value = Date.now();
    isGroupingTransitionLoading.value = true;
  };

  const finishGroupingTransition = () => {
    if (groupingTransitionTimer) {
      clearTimeout(groupingTransitionTimer);
    }
    const elapsed = Date.now() - groupingTransitionStartedAt.value;
    const delay = Math.max(180 - elapsed, 0);
    groupingTransitionTimer = setTimeout(() => {
      isGroupingTransitionLoading.value = false;
      pendingGroupingColumnId.value = null;
      groupingTransitionTimer = null;
    }, delay);
  };

  const applyGroupingWithLoading = (partial) => {
    startGroupingTransition();
    afterNextPaint(() => {
      try {
        writeGroupingToViewConfig(partial);
      } finally {
        nextTick(() => afterNextPaint(finishGroupingTransition));
      }
    });
  };

  // ========== COLLAPSED-STATE HYDRATION (cross-view) ==========

  // Re-hydrate collapsed state when the active view changes (e.g. user switches
  // views) or when the external collapsed-state variable is mutated elsewhere.
  // Reading both inside the watch source ensures Vue tracks them as deps.
  watch(
    () => {
      let viewId = null;
      let mapEntry;
      try { viewId = wwLib.wwVariable.getValue(VIEW_VARIABLE_ID)?.id ?? null; } catch (e) { viewId = null; }
      try {
        const map = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
        mapEntry = map && typeof map === 'object' && viewId ? map[viewId] : undefined;
      } catch (e) { mapEntry = undefined; }
      return { viewId, mapEntry };
    },
    () => {
      const stored = getStoredCollapsedForView();
      const cur = Array.isArray(groupingState.value?.collapsed) ? groupingState.value.collapsed : [];
      const sameLength = cur.length === stored.length;
      const sameSet = sameLength && cur.every(v => stored.includes(v));
      if (sameSet) return;
      groupingState.value = { ...groupingState.value, collapsed: stored };
      updateGroupHorizontalScrollbarMetrics();
    },
    { deep: true }
  );

  // ========== SETTERS ==========

  // Switch (or clear) the grouping column. Clearing also resets order/collapsed.
  const setGroupingColumn = (colId) => {
    const next = colId || null;
    pendingGroupingColumnId.value = next || '';
    if (!next) {
      applyGroupingWithLoading({ columnId: null, order: [], collapsed: [] });
      return;
    }
    // Changing to a different column — wipe order/collapsed since they referenced
    // the previous column's option values.
    const prev = groupingState.value?.columnId;
    if (prev !== next) {
      applyGroupingWithLoading({ columnId: next, order: [], collapsed: [] });
    } else {
      applyGroupingWithLoading({ columnId: next });
    }
  };

  // Toggle visibility of the Unassigned group (rows whose grouping value is null/empty).
  const setShowUnassigned = (show) => {
    writeGroupingToViewConfig({ showUnassigned: !!show });
  };

  // Locate the group grid that contains a given rowId.
  const findGroupForRowId = (rowId) => {
    if (!isGroupingActive.value) return null;
    for (const [gv, api] of groupGridApis.value.entries()) {
      try {
        const node = findRowNode(api, rowId, resolveMappingFormula, props.content);
        if (node) return { groupValue: gv, api, node };
      } catch (_) { /* continue */ }
    }
    return null;
  };

  // ========== CLEANUP ==========

  onBeforeUnmount(() => {
    if (groupingTransitionTimer) {
      clearTimeout(groupingTransitionTimer);
      groupingTransitionTimer = null;
    }
    pendingMoveTimers.forEach((t) => clearTimeout(t));
    pendingMoveTimers.clear();
    const frontWindow = wwLib?.getFrontWindow?.() || window;
    frontWindow.removeEventListener('resize', handleGroupHorizontalResize);
    if (groupHorizontalResizeObserver) {
      groupHorizontalResizeObserver.disconnect();
      groupHorizontalResizeObserver = null;
    }
  });

  return {
    // Constants
    UNASSIGNED_GROUP,
    // State
    groupingState,
    pendingGroupingColumnId,
    isGroupingTransitionLoading,
    groupGridApis,
    groupSelections,
    groupInfiniteCounts,
    pendingGroupingMoves,
    setPendingGroupingMove,
    clearPendingGroupingMove,
    groupHorizontalScrollRef,
    groupHorizontalScrollWidth,
    groupHorizontalViewportWidth,
    groupHorizontalScrollLeft,
    groupDragValue,
    groupDragOverValue,
    // Computeds
    groupingColumnId,
    isGroupingActive,
    groupingSourceRows,
    groupedRowData,
    orderedGroups,
    hasGroupHorizontalOverflow,
    selectableGroupingColumns,
    // Helpers / lookups
    isSelectColumn,
    isValidGroupColumn,
    getGroupColor,
    getGroupLabel,
    rowGroupKey,
    groupRowData,
    alignedGridApisForGroup,
    findGroupForRowId,
    getStoredCollapsedForView,
    persistCollapsedForView,
    // Scrollbar sync
    getGroupHorizontalScrollViewports,
    updateGroupHorizontalScrollbarMetrics,
    onGroupHorizontalScrollbarScroll,
    onGroupBodyScroll,
    // Per-grid event handlers
    onGroupGridReady,
    onGroupGridUnmounted,
    onGroupFilterChanged,
    onGroupSortChanged,
    onGroupColumnResized,
    onGroupColumnMoved,
    onGroupSelectionChanged,
    onGroupRowSelected,
    // Drag-reorder
    onGroupDragStart,
    onGroupDragOver,
    onGroupDrop,
    onGroupDragEnd,
    // Collapse / expand
    toggleGroupCollapsed,
    collapseAllGroups,
    expandAllGroups,
    // Transition + setters
    applyGroupingWithLoading,
    setGroupingColumn,
    setShowUnassigned,
    writeGroupingToViewConfig,
  };
}
