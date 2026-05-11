import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { findRowNode } from '../utils/rowLookup.js';
import { getTranslations } from '../../shared/utils/sharedHelpers.js';
import { createValidationFunction } from '../utils/columnFactories.js';

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
//     getLoadInitialForGroup             — from useInfiniteScroll (paged-append)
//     getGroupPagedRowData               — from useInfiniteScroll (paged-append)
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
    getLoadInitialForGroup,
    getLoadMoreForGroup,
    getRefetchAllVisibleGroups,
    getGroupPagedRowData,
    getAddRowToGroupState,
    getRemoveRowFromGroupState,
    getStampGroupMutation,
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

  // Bumped whenever a row's grouping-column value is mutated in place (no
  // array-reference change), so `groupedRowData` re-partitions and each
  // per-group grid receives the corrected `rowData`. Without this, the row
  // stays in its source group until something else invalidates the array.
  // Used only in non-paged-append modes (full / paginated client-side).
  const groupingDataVersion = ref(0);
  const bumpGroupingDataVersion = () => { groupingDataVersion.value++; };

  // Reentry guards for cross-grid synchronization.
  const isSyncingLayout = ref(false);
  const isSyncingFilters = ref(false);
  const isSyncingSort = ref(false);

  // Bumped every time a per-group grid's api is registered or replaced
  // (collapse → expand cycle, or any remount). The redundant filter / sort
  // sync watcher uses this to fire even when the set of grouping keys is
  // unchanged but the api at a given key was swapped — without it, an
  // expand of a previously-collapsed group wouldn't trigger re-application
  // of the global filter to the freshly-mounted grid.
  const groupGridApiVersion = ref(0);
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

  // Session-only set of groups that have been observed with rows at any
  // point during this session. Once a group has had items, it transitions
  // from "default-collapsed-when-empty" to "follows the user's collapse
  // choice (collapsedSet)" — even if its server-reported count later drops
  // to 0 (last row moved out, optimistic write pending, filter excluding
  // its rows). Without this, momentary count==0 transitions cause groups
  // to auto-collapse, then auto-expand when the count returns, producing
  // the "random close/expand" behaviour. Cleared when the grouping column
  // changes (the seen state no longer applies to a different group set).
  const groupsSeenWithItems = ref(new Set());

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
  // Paged-append: empty — each group grid's rows are owned by useInfiniteScroll's
  // per-group state map and accessed via getGroupPagedRowData(groupValue).
  // Counts come from groupInfiniteCounts instead.
  const groupingSourceRows = computed(() => {
    if (!isGroupingActive.value) return [];
    if (isInfiniteScrollEnabled.value) return [];
    if (cfg.value?.dataSource === 'supabase') {
      return Array.isArray(supabaseData.value) ? supabaseData.value : [];
    }
    const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
    return Array.isArray(data) ? data : [];
  });

  // Map<groupValue, row[]> — used in non-paged-append modes only.
  const groupedRowData = computed(() => {
    // Track in-place row mutations of the grouping column.
    void groupingDataVersion.value;
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

  const groupRowData = (groupValue) => {
    if (isInfiniteScrollEnabled.value) {
      const accessor = getGroupPagedRowData?.();
      return accessor ? accessor(groupValue) : [];
    }
    return groupedRowData.value.get(groupValue) || [];
  };

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

    // Collapse policy:
    //  - count == null (still loading) → collapsed (avoids flicker on init).
    //  - count === 0 AND group has never had items in this session → empty
    //    by default → collapsed unless the user manually expanded it
    //    (session-only manualExpand). Keeps empty groups out of the way on
    //    initial load.
    //  - count === 0 BUT group was previously seen with items this session
    //    → respect collapsedSet only. Prevents transient 0-counts (last row
    //    moved out, optimistic write pending, filter excluding all rows)
    //    from collapsing a group the user is actively looking at, then
    //    re-expanding it when the count returns.
    //  - count > 0 → respect the persisted collapsedSet (open by default
    //    unless the user explicitly collapsed it).
    const manualExpand = manuallyExpandedEmptyGroups.value;
    const seenWithItems = groupsSeenWithItems.value;
    const computeCollapsed = (value, count) => {
      if (count == null) return true;
      if (count === 0) {
        if (seenWithItems.has(value)) return collapsedSet.has(value);
        return !manualExpand.has(value);
      }
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

    // If the user is filtering on the grouping column itself (select filter
    // with a `values` array), narrow the rendered group list to just the
    // selected option values — the others can never contain matching rows so
    // there's no point rendering an empty per-group grid for each. The
    // SelectFilter's `doesFilterPass` rejects null row values, so the
    // unassigned group is dropped here too.
    let groupColFilterModel = null;
    try { groupColFilterModel = getFilterValue?.()?.value?.[colId] ?? null; }
    catch (_) { groupColFilterModel = null; }
    const rawValues = Array.isArray(groupColFilterModel?.values) ? groupColFilterModel.values : null;
    let visibleBase = base;
    if (rawValues && rawValues.length > 0) {
      const allowed = new Set(rawValues.map(v => String(v)));
      visibleBase = base.filter(g => allowed.has(g.value));
    }

    // Apply custom order (listed first), then append any unlisted groups at the end.
    if (orderArr.length === 0) return visibleBase;
    const byValue = new Map(visibleBase.map(g => [g.value, g]));
    const ordered = [];
    for (const v of orderArr) {
      if (byValue.has(v)) { ordered.push(byValue.get(v)); byValue.delete(v); }
    }
    byValue.forEach(g => ordered.push(g));
    return ordered;
  });

  // Mark groups as seen-with-items as soon as they're observed with count>0.
  // Drives the "stick to collapsedSet on transient 0-counts" branch in
  // computeCollapsed. Cleared when the grouping column or active state
  // changes (different group set entirely) so a session can start fresh.
  watch(
    () => orderedGroups.value.map(g => `${g.value}:${g.count ?? 'null'}`).join('|'),
    () => {
      const groups = orderedGroups.value;
      let changed = false;
      const next = new Set(groupsSeenWithItems.value);
      for (const g of groups) {
        if (typeof g.count === 'number' && g.count > 0 && !next.has(g.value)) {
          next.add(g.value);
          changed = true;
        }
      }
      if (changed) groupsSeenWithItems.value = next;
    },
    { flush: 'post' }
  );

  watch(
    () => [groupingColumnId.value, isGroupingActive.value],
    () => { groupsSeenWithItems.value = new Set(); }
  );

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

  // ========== PAGED-APPEND LOAD-MORE OBSERVER ==========
  //
  // Per-group grids run with domLayout="autoHeight" — their bodies don't
  // scroll; the outer .ww-datagrid container does. AG Grid's `body-scroll`
  // event therefore never fires past the initial paint, which means the
  // existing `onGroupBodyScrollWrapper` loadMore trigger is dead in grouped
  // mode and only the first block ever loads (e.g., 100 of 3000 rows).
  //
  // Fix: observe a tiny invisible sentinel rendered after each expanded
  // group's grid (`.ww-group__load-more-sentinel`) with an IntersectionObserver.
  // When the sentinel enters a viewport-bottom margin (i.e., the user has
  // scrolled to near the bottom of the group's loaded rows), call
  // loadMoreForGroup. The loadMore function is idempotent — it returns
  // early when offset >= total or when a fetch is already in flight.
  let loadMoreObserver = null;
  // Map<groupValue, sentinelEl> so we know which element to unobserve on
  // collapse/unmount even though the el may already have been removed by
  // Vue's v-if teardown by then.
  const observedSentinels = new Map();

  const dispatchLoadMoreForGroup = (groupValue) => {
    if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
    const api = groupGridApis.value.get(groupValue);
    if (!api) return;
    const loadMoreForGroup = getLoadMoreForGroup?.();
    if (!loadMoreForGroup) return;
    try {
      const filterModel = api.getFilterModel?.() || null;
      const sortModel = api.getState?.()?.sort?.sortModel || [];
      const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
      loadMoreForGroup(groupValue, api, filterModel, sortModel, searchValue);
    } catch (e) {
      debugLog?.(`[PagedAppend] dispatchLoadMoreForGroup("${groupValue}") failed:`, e?.message);
    }
  };

  const observeGroupLoadMoreSentinel = (groupValue) => {
    if (!loadMoreObserver) return;
    const container = findGroupContainerByValue(groupValue);
    const safe = String(groupValue).replace(/"/g, '\\"');
    const sentinel = container?.querySelector(`.ww-group__load-more-sentinel[data-group-value="${safe}"]`);
    if (!sentinel) return;
    // If we were already observing a previous sentinel for this group
    // (e.g. re-mount after collapse), drop it first.
    const prev = observedSentinels.get(groupValue);
    if (prev && prev !== sentinel) {
      try { loadMoreObserver.unobserve(prev); } catch (_) { /* noop */ }
    }
    observedSentinels.set(groupValue, sentinel);
    loadMoreObserver.observe(sentinel);
  };

  const unobserveGroupLoadMoreSentinel = (groupValue) => {
    if (!loadMoreObserver) return;
    const sentinel = observedSentinels.get(groupValue);
    if (!sentinel) return;
    try { loadMoreObserver.unobserve(sentinel); } catch (_) { /* noop */ }
    observedSentinels.delete(groupValue);
  };

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
    if (typeof IntersectionObserver !== 'undefined') {
      // rootMargin extends the viewport-bottom by 400px so we trigger a
      // fetch slightly before the footer is visible — gives the next block
      // a head start on scrolling, avoiding a visible "stop at the end of
      // loaded rows" pause.
      loadMoreObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const groupValue = entry.target?.dataset?.groupValue;
            if (!groupValue) continue;
            dispatchLoadMoreForGroup(groupValue);
          }
        },
        { root: null, rootMargin: '0px 0px 400px 0px', threshold: 0 }
      );
    }
    updateGroupHorizontalScrollbarMetrics();
  });

  // ========== CROSS-GROUP DRAG & DROP ==========

  // AG Grid's `addRowDropZone` lets one grid accept rows dragged from another
  // grid. We register zones bidirectionally between every pair of mounted
  // group grids so the user can drag a row from any group to any other to
  // change its grouping-column value. Per-group `rowDragManaged` is false so
  // the drop never auto-reorders within the source — we own the move entirely
  // via applyTransaction + per-group state mutations + a synthesised
  // cellValueChanged emit (mirrors what the cross-group cell edit path does).
  //
  // Tracking map shape: Map<sourceGroupValue, Map<destGroupValue, params>>
  // The params object is the same one we passed to addRowDropZone — AG Grid
  // requires it (by reference) for removeRowDropZone.
  const dropZoneRegistry = new Map();

  const findGroupContainerByValue = (destGroupValue) => {
    if (!gridContainerRef.value) return null;
    const safe = String(destGroupValue).replace(/"/g, '\\"');
    return gridContainerRef.value.querySelector(`.ww-group[data-group-value="${safe}"]`);
  };

  // Drag-hover preview: while the cursor is over a destination group during
  // a row drag, we insert the dragged row at the top of that group's grid
  // via applyTransaction({ add }). AG Grid's animateRows then slides the
  // existing rows down to make room — the user gets the same visual feedback
  // they'd get from intra-grid managed drag, only across grids. Removed on
  // dragLeave; on drop the row is already in dest and the drop handler
  // skips the add.
  const dragPreview = { destGroupValue: null, data: null };

  // Toggle a `ww-row-drag-preview` CSS class on the dest grid's row DOM
  // element so the preview row reads as "ghost" (grayed-out, semi-transparent)
  // until the user actually drops. Walks the DOM via the row-id attribute
  // because AG Grid's row class rules only re-evaluate on transactions —
  // direct DOM toggling is more reliable and one-shot.
  const togglePreviewClass = (groupValue, data, add) => {
    const container = findGroupContainerByValue(groupValue);
    if (!container) return;
    let rowId = '';
    try { rowId = String(resolveMappingFormula(cfg.value?.idFormula, data) ?? ''); }
    catch (_) { rowId = ''; }
    if (!rowId) return;
    const apply = () => {
      const rowEl = container.querySelector(`.ag-row[row-id="${rowId.replace(/"/g, '\\"')}"]`);
      if (!rowEl) return;
      if (add) rowEl.classList.add('ww-row-drag-preview');
      else rowEl.classList.remove('ww-row-drag-preview');
    };
    if (add && typeof requestAnimationFrame === 'function') {
      // Wait for AG Grid to render the newly-added row's DOM.
      requestAnimationFrame(() => requestAnimationFrame(apply));
    } else {
      apply();
    }
  };

  const clearDragPreview = () => {
    if (!dragPreview.destGroupValue || !dragPreview.data) return;
    const api = groupGridApis.value.get(dragPreview.destGroupValue);
    if (api) {
      try { api.applyTransaction({ remove: [dragPreview.data] }); }
      catch (_) { /* noop */ }
    }
    dragPreview.destGroupValue = null;
    dragPreview.data = null;
  };

  const handleCrossGroupDragEnter = (sourceGroupValue, destGroupValue, dragParams) => {
    if (sourceGroupValue === destGroupValue) return;
    const data = dragParams?.node?.data;
    if (!data) return;
    // Already previewing this exact row in this dest → no-op (rapid
    // enter/leave bouncing on the boundary shouldn't replay the animation).
    if (dragPreview.destGroupValue === destGroupValue && dragPreview.data === data) return;
    // Move the preview from a previous dest to this one.
    if (dragPreview.destGroupValue && dragPreview.destGroupValue !== destGroupValue) {
      clearDragPreview();
    }
    const destApi = groupGridApis.value.get(destGroupValue);
    if (!destApi) return; // collapsed dest — no grid to preview into
    try {
      destApi.applyTransaction({ add: [data], addIndex: 0 });
      dragPreview.destGroupValue = destGroupValue;
      dragPreview.data = data;
      togglePreviewClass(destGroupValue, data, true);
    } catch (e) {
      debugLog?.(`[GroupDrag] preview add failed for "${destGroupValue}":`, e?.message);
    }
  };

  const handleCrossGroupDragLeave = (sourceGroupValue, destGroupValue, dragParams) => {
    if (dragPreview.destGroupValue === destGroupValue) {
      clearDragPreview();
    }
  };

  const handleCrossGroupDrop = (sourceGroupValue, destGroupValue, dragParams) => {
    if (sourceGroupValue === destGroupValue) return;
    const node = dragParams?.node;
    const data = node?.data;
    if (!data) return;

    const colId = groupingColumnId.value;
    if (!colId) return;

    const oldValue = data[colId];
    const newValue = destGroupValue === UNASSIGNED_GROUP ? null : destGroupValue;
    const normalizedOld = (oldValue === null || oldValue === undefined || oldValue === '')
      ? null
      : oldValue;
    if (normalizedOld === newValue) return;

    // Validation pre-check: run the same validation rules the cell editor
    // would have, BEFORE applying any optimistic state. If the new value
    // fails validation, cancel the move outright (no DOM mutations, no
    // event), fire `validationFailed` so the user's WeWeb workflow can
    // react, and trigger the global toast workflow with the same payload
    // useCellEditing.getValidationErrors uses (so the user sees the same
    // error UI for drag and direct-edit alike).
    const groupingColumnConfig = (cfg.value?.columns || []).find(
      (c) => c?.field === colId
    );
    if (groupingColumnConfig?.validation && Array.isArray(groupingColumnConfig.validation) && groupingColumnConfig.validation.length > 0) {
      let validationErrors = null;
      try {
        const validationFn = createValidationFunction(groupingColumnConfig, resolveMappingFormula);
        validationErrors = validationFn(newValue, data);
      } catch (e) {
        debugLog?.('[GroupDrag] validation function threw — allowing move:', e?.message);
      }
      if (validationErrors && validationErrors.length > 0) {
        // Validation failed → the move is cancelled. Remove any preview row
        // we inserted into the dest during dragEnter so the dest's grid
        // returns to its pre-drag state.
        clearDragPreview();
        const rowId = data?.[cfg.value?.idKey] ?? node?.id ?? null;
        ctx.emit('trigger-event', {
          name: 'validationFailed',
          event: {
            field: colId,
            value: newValue,
            oldValue: normalizedOld,
            errors: validationErrors,
            rowId,
            data,
          },
        });
        try {
          wwLib.wwWorkflow.executeGlobal('1d11d250-421f-4cc5-bb8b-7bb3ad71c34d', {
            body: validationErrors.join('\n'),
            title: `Champ invalide : ${groupingColumnConfig?.headerName || colId}`,
            type: 'error',
          });
        } catch (e) {
          console.warn('[GroupDrag] toast workflow failed:', e?.message);
        }
        return;
      }
    }

    // Validation passed (or none configured) — apply the move optimistically.
    // Mutate the row's grouping value (mirrors the cell-editor valueSetter)
    // and move it across grids. Persistence is owned by the user's WeWeb
    // workflow listening to `cellValueChanged` — same path the cell editor
    // uses for the grouping column.
    data[colId] = newValue;

    const sourceApi = groupGridApis.value.get(sourceGroupValue);
    if (sourceApi) {
      try { sourceApi.applyTransaction({ remove: [data] }); }
      catch (e) { debugLog?.(`[GroupDrag] source remove failed for "${sourceGroupValue}":`, e?.message); }
    }

    const destApi = groupGridApis.value.get(destGroupValue);

    // The drop may follow a hover preview that already inserted the row at
    // the top of dest via dragEnter. If so, skip the add below — re-adding
    // the same row would either duplicate or fail. Capture this BEFORE
    // resetting the preview state so we know whether to add at the bottom
    // of this handler.
    const previewWasInDest = (
      dragPreview.destGroupValue === destGroupValue &&
      dragPreview.data === data
    );
    dragPreview.destGroupValue = null;
    dragPreview.data = null;

    if (isInfiniteScrollEnabled.value) {
      try { getRemoveRowFromGroupState?.()?.(sourceGroupValue, data); }
      catch (_) { /* noop */ }

      if (destApi) {
        // Dest grid is mounted — add to its per-group state so the row is
        // immediately visible.
        try { getAddRowToGroupState?.()?.(destGroupValue, data); }
        catch (_) { /* noop */ }
      } else {
        // Dest is collapsed — DON'T addRowToGroupState (it sets loaded:true
        // which would make loadInitialForGroup skip the server fetch on
        // expand and the user would see only this one optimistic row in a
        // group that may have many more on the server). Just bump the
        // badge count optimistically; the next expand fetches fresh from
        // the server (which by then includes the dropped row, assuming the
        // user's workflow has persisted it).
        const counts = new Map(groupInfiniteCounts.value);
        const cur = counts.get(destGroupValue);
        counts.set(destGroupValue, (typeof cur === 'number' ? cur : 0) + 1);
        groupInfiniteCounts.value = counts;
        // Mark this group as locally mutated so the deferred
        // refreshGroupCounts safety-net below doesn't overwrite our +1
        // with a stale server count (the user's persistence workflow may
        // not have landed yet, so the server still reports the pre-drop
        // total).
        try { getStampGroupMutation?.()?.(destGroupValue); } catch (_) { /* noop */ }
      }
    } else {
      try { bumpGroupingDataVersion?.(); } catch (_) { /* noop */ }
    }

    if (destApi && destApi !== sourceApi && !previewWasInDest) {
      try { destApi.applyTransaction({ add: [data], addIndex: 0 }); }
      catch (e) { debugLog?.(`[GroupDrag] dest add failed for "${destGroupValue}":`, e?.message); }
    } else if (previewWasInDest) {
      // Preview row was already inserted during dragEnter — promote it from
      // ghost to real by stripping the preview class.
      togglePreviewClass(destGroupValue, data, false);
    }

    // Carry over the grouping column's `isDirectUpdate` flag so the user's
    // workflow handles the drag identically to a direct cell edit on that
    // same column. Column config was looked up above for validation.
    ctx.emit('trigger-event', {
      name: 'cellValueChanged',
      event: {
        oldValue: normalizedOld,
        newValue,
        columnId: colId,
        row: data,
        isDirectUpdate: groupingColumnConfig?.isDirectUpdate || false,
      },
    });

    // Cascade the collapse state to follow the move:
    //  - Dest: if persisted as collapsed (or auto-collapsed because it was
    //    empty), open it so the user immediately sees where the dropped
    //    row landed.
    //  - Source: if the move emptied it, collapse it. The user just moved
    //    its last row out, so keeping it open eats vertical space for no
    //    content.
    // Both writes go through writeGroupingToViewConfig so they persist via
    // the same WeWeb variable the chevron toggles use.
    const collapsedList = Array.isArray(groupingState.value?.collapsed)
      ? [...groupingState.value.collapsed]
      : [];
    let collapsedListChanged = false;

    const destIdx = collapsedList.indexOf(destGroupValue);
    if (destIdx >= 0) {
      collapsedList.splice(destIdx, 1);
      collapsedListChanged = true;
    }
    // If the dest was empty + manually expanded (session-only set), nothing
    // to clear there — count is now > 0 so manualExpand is irrelevant for
    // this group going forward.

    const sourceCountAfter = isInfiniteScrollEnabled.value
      ? (() => {
          const c = groupInfiniteCounts.value.get(sourceGroupValue);
          return typeof c === 'number' ? c : null;
        })()
      : (groupedRowData.value.get(sourceGroupValue)?.length ?? null);

    if (sourceCountAfter === 0 && !collapsedList.includes(sourceGroupValue)) {
      collapsedList.push(sourceGroupValue);
      collapsedListChanged = true;
    }

    if (collapsedListChanged) {
      writeGroupingToViewConfig({ collapsed: collapsedList });
      updateGroupHorizontalScrollbarMetrics();
    }

    // Defer count refresh — match the 1.5 s delay the cell-editor cross-group
    // path uses so the user-side write workflow has a window to land.
    if (isInfiniteScrollEnabled.value) {
      setTimeout(() => {
        try { getScheduleRefreshGroupCounts?.()?.(); }
        catch (_) { /* noop */ }
      }, 1500);
    }
  };

  const setDropTargetHighlight = (destValue, on) => {
    const el = findGroupContainerByValue(destValue);
    if (!el) return;
    el.classList.toggle('ww-group--drop-target', !!on);
  };

  const clearAllDropTargetHighlights = () => {
    if (!gridContainerRef.value) return;
    gridContainerRef.value
      .querySelectorAll('.ww-group.ww-group--drop-target')
      .forEach((el) => el.classList.remove('ww-group--drop-target'));
  };

  const registerDropZone = (sourceValue, sourceApi, destValue) => {
    if (!sourceApi || sourceValue === destValue) return;
    if (typeof sourceApi.addRowDropZone !== 'function') return;
    let bucket = dropZoneRegistry.get(sourceValue);
    if (!bucket) { bucket = new Map(); dropZoneRegistry.set(sourceValue, bucket); }
    if (bucket.has(destValue)) return;
    const zoneParams = {
      getContainer: () => findGroupContainerByValue(destValue),
      onDragEnter: (dragParams) => {
        setDropTargetHighlight(destValue, true);
        handleCrossGroupDragEnter(sourceValue, destValue, dragParams);
      },
      onDragLeave: (dragParams) => {
        setDropTargetHighlight(destValue, false);
        handleCrossGroupDragLeave(sourceValue, destValue, dragParams);
      },
      onDragStop: (dragParams) => {
        // Always clear the highlight, even if the drop is a no-op (same
        // group, dropped outside any meaningful area, etc).
        clearAllDropTargetHighlights();
        handleCrossGroupDrop(sourceValue, destValue, dragParams);
      },
    };
    try {
      sourceApi.addRowDropZone(zoneParams);
      bucket.set(destValue, zoneParams);
    } catch (e) {
      debugLog?.(`[GroupDrag] addRowDropZone failed (${sourceValue} -> ${destValue}):`, e?.message);
    }
  };

  // Register drop zones from every mounted source grid into every group in
  // orderedGroups — including collapsed ones. Collapsed groups have no grid
  // api but their `.ww-group` container is still in the DOM, and AG Grid's
  // drop zone only needs the container element + an onDragStop callback.
  // Idempotent: existing entries are skipped via the bucket check.
  const refreshAllDropZones = () => {
    if (!isGroupingActive.value) return;
    const allGroupValues = orderedGroups.value.map(g => g.value);
    groupGridApis.value.forEach((sourceApi, sourceValue) => {
      if (!sourceApi) return;
      for (const destValue of allGroupValues) {
        if (destValue === sourceValue) continue;
        registerDropZone(sourceValue, sourceApi, destValue);
      }
    });
  };

  const setupCrossGroupDropZones = (newGroupValue, newApi) => {
    if (!isGroupingActive.value || !newApi) return;
    // Register zones FROM the newly-mounted grid TO every other group
    // (collapsed or not).
    for (const group of orderedGroups.value) {
      if (group.value === newGroupValue) continue;
      registerDropZone(newGroupValue, newApi, group.value);
    }
    // …and ensure every existing source has a zone targeting this newly
    // mounted group too (no-op if it was already registered when the source
    // first set up its zones against the full group list).
    groupGridApis.value.forEach((existingApi, existingValue) => {
      if (existingApi === newApi || existingValue === newGroupValue) return;
      registerDropZone(existingValue, existingApi, newGroupValue);
    });
  };

  // Remove every registered zone associated with `groupValue` — both inbound
  // (other sources targeting it) and outbound (zones owned by its api are
  // torn down by AG Grid when the grid destroys, but we still need to drop
  // our registry entry for it).
  const tearDownDropZonesForGroup = (groupValue) => {
    dropZoneRegistry.forEach((bucket, sourceValue) => {
      if (sourceValue === groupValue) return;
      const zoneParams = bucket.get(groupValue);
      if (!zoneParams) return;
      const sourceApi = groupGridApis.value.get(sourceValue);
      if (sourceApi && typeof sourceApi.removeRowDropZone === 'function') {
        try { sourceApi.removeRowDropZone(zoneParams); }
        catch (_) { /* noop */ }
      }
      bucket.delete(groupValue);
    });
    dropZoneRegistry.delete(groupValue);
  };

  // Rerun zone setup when the set of groups changes (e.g., a new option is
  // added to the grouping select column, or the user toggles showUnassigned).
  // Watching just the values keeps the watcher quiet on count updates.
  watch(
    () => orderedGroups.value.map(g => g.value).join('|'),
    () => { refreshAllDropZones(); },
    { flush: 'post' }
  );

  // ========== PER-GRID EVENT HANDLERS ==========

  // Called when each group grid fires grid-ready. Registers the api and
  // applies current shared state (filter / sort / widths) so a newly-expanded
  // group picks up the live view.
  const onGroupGridReady = (groupValue, params) => {
    // Detect remount: same groupValue, different api object. AG Grid may
    // recreate a grid (data refetch, view-config remount, paged-append
    // refresh) without firing a Vue unmount, so onGroupGridUnmounted never
    // ran for the old api. The dropZoneRegistry then still holds entries
    // referring to the destroyed api, and setupCrossGroupDropZones below
    // would short-circuit on `bucket.has(destValue)` and skip re-registering
    // — leaving the new api with NO drop zones (drag-into shows the
    // not-allowed cursor) and peers still pointing at the dead api. Tear
    // down the stale entries so registration starts clean.
    const prevApi = groupGridApis.value.get(groupValue);
    if (prevApi && prevApi !== params.api) {
      try { tearDownDropZonesForGroup(groupValue); }
      catch (_) { /* noop */ }
    }
    groupGridApis.value.set(groupValue, params.api);
    // Trigger reactivity
    groupGridApis.value = new Map(groupGridApis.value);
    groupGridApiVersion.value++;

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

    // Wire bidirectional cross-group drop zones with every other mounted
    // group grid so the user can drag a row between groups to change its
    // grouping value. Safe to call before / after any other group's
    // grid-ready — the registry dedupes pairs.
    try { setupCrossGroupDropZones(groupValue, params.api); }
    catch (e) { debugLog?.('[GroupDrag] setupCrossGroupDropZones failed:', e?.message); }

    // Hook this group's load-more sentinel into the IntersectionObserver
    // so further blocks fetch as the user scrolls down. Wait one tick —
    // the sentinel is rendered by the same v-if as the grid, but we want
    // to query for it after Vue has flushed the DOM update.
    nextTick(() => observeGroupLoadMoreSentinel(groupValue));

    // Paged-append mode: kick off this group's first-block fetch. Stagger
    // across groups so N grids don't fire identical requests in the same
    // tick when several open simultaneously after a grouping-column change.
    if (isInfiniteScrollEnabled.value && isGroupingActive.value) {
      // Show the loading overlay if we know the group has rows but state
      // hasn't fetched them yet, to suppress the noRowsOverlay flash that
      // would otherwise appear during the staggered delay + fetch round-
      // trip. Skipped when state is already loaded (re-expand of a group
      // we previously fetched) or when count is known to be 0 (the fast
      // path in loadInitialForGroup writes an empty entry immediately and
      // noRowsOverlay is the correct display).
      const initialState = getGroupPagedRowData ? null : null;
      const stateEntry = (() => {
        try { return getGroupPagedRowData?.() ? null : null; }
        catch (_) { return null; }
      })();
      const hasLoadedData = (() => {
        const accessor = getGroupPagedRowData?.();
        if (!accessor) return false;
        const arr = accessor(groupValue);
        return Array.isArray(arr) && arr.length > 0;
      })();
      const knownCount = groupInfiniteCounts.value?.get(groupValue);
      const shouldShowLoading = !hasLoadedData && (knownCount == null || knownCount > 0);
      if (shouldShowLoading) {
        try { params.api.showLoadingOverlay?.(); }
        catch (_) { /* noop */ }
      }

      const idx = orderedGroups.value.findIndex(g => g.value === groupValue);
      const delay = 100 + Math.max(0, idx) * 50;
      setTimeout(() => {
        const stillMounted = groupGridApis.value.get(groupValue) === params.api;
        if (!stillMounted || !isInfiniteScrollEnabled.value || !isGroupingActive.value) {
          if (shouldShowLoading) {
            try { params.api.hideOverlay?.(); } catch (_) {}
          }
          return;
        }
        const loadInitialForGroup = getLoadInitialForGroup?.();
        if (!loadInitialForGroup) {
          if (shouldShowLoading) {
            try { params.api.hideOverlay?.(); } catch (_) {}
          }
          return;
        }
        try {
          const filterValue2 = getFilterValue?.();
          const filterModel = filterValue2?.value || null;
          const sortValue2 = getSortValue?.();
          const sortModel = Array.isArray(sortValue2?.value) ? sortValue2.value : [];
          loadInitialForGroup(groupValue, filterModel, sortModel)
            .catch(e => debugLog?.(`[PagedAppend] loadInitialForGroup("${groupValue}") failed:`, e?.message))
            .finally(() => {
              if (!shouldShowLoading) return;
              const stillSameApi = groupGridApis.value.get(groupValue) === params.api;
              if (!stillSameApi) return;
              try { params.api.hideOverlay?.(); } catch (_) {}
            });
          debugLog(`[PagedAppend] Triggered initial load for "${groupValue}" after ${delay}ms`);
        } catch (e) {
          console.warn(`[PagedAppend] Failed to start initial load for "${groupValue}":`, e?.message);
          if (shouldShowLoading) {
            try { params.api.hideOverlay?.(); } catch (_) {}
          }
        }
      }, delay);
    }
  };

  const onGroupGridUnmounted = (groupValue) => {
    // Tear down inbound drop zones BEFORE removing the api from the registry
    // — tearDownDropZonesForGroup looks up source apis by groupValue.
    try { tearDownDropZonesForGroup(groupValue); }
    catch (_) { /* noop */ }
    try { unobserveGroupLoadMoreSentinel(groupValue); }
    catch (_) { /* noop */ }
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

    // Paged-append: AG Grid only filters loaded blocks client-side, which
    // hides anything past the loaded window. Dispatch a server-side refetch
    // per mounted group so the visible blocks reflect the new filter.
    if (isInfiniteScrollEnabled.value) {
      const refetchAllVisibleGroups = getRefetchAllVisibleGroups?.();
      if (refetchAllVisibleGroups) {
        try {
          const filterModel = event.api.getFilterModel();
          const sortModel = event.api.getState()?.sort?.sortModel || [];
          refetchAllVisibleGroups(filterModel, sortModel)
            .catch(e => debugLog?.('[PagedAppend] group filter refetch failed:', e?.message));
        } catch (e) {
          debugLog?.('[PagedAppend] could not dispatch group filter refetch:', e?.message);
        }
      }
    }

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

    // Paged-append: same problem as filter — sort applied client-side only
    // sorts the loaded subset. Refetch each mounted group so the server
    // returns the full sorted first block.
    if (isInfiniteScrollEnabled.value) {
      const refetchAllVisibleGroups = getRefetchAllVisibleGroups?.();
      if (refetchAllVisibleGroups) {
        try {
          const filterModel = event.api.getFilterModel();
          const sortModel = event.api.getState()?.sort?.sortModel || [];
          refetchAllVisibleGroups(filterModel, sortModel)
            .catch(e => debugLog?.('[PagedAppend] group sort refetch failed:', e?.message));
        } catch (e) {
          debugLog?.('[PagedAppend] could not dispatch group sort refetch:', e?.message);
        }
      }
    }
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
  // Empty groups (count === 0) flip the session-only manualExpand set so
  // that "I expanded this empty group to look at it" doesn't get persisted
  // as a permanent open-on-load choice — on next reload it returns to the
  // default-closed state. Non-empty groups write to the persisted
  // collapsedSet.
  const toggleGroupCollapsed = (groupValue) => {
    const group = orderedGroups.value.find(g => g.value === groupValue);
    // Empty AND not yet seen with items in this session → flip the
    // session-only manualExpand set (peeking at an empty group shouldn't
    // persist as a permanent "expanded" choice).
    // Once a group has been seen with items, fall through to the
    // collapsedSet path so its collapse state is sticky and doesn't get
    // overridden by transient 0-counts.
    if (group && group.count === 0 && !groupsSeenWithItems.value.has(groupValue)) {
      const next = new Set(manuallyExpandedEmptyGroups.value);
      if (next.has(groupValue)) next.delete(groupValue);
      else next.add(groupValue);
      manuallyExpandedEmptyGroups.value = next;
      updateGroupHorizontalScrollbarMetrics();
      return;
    }
    // Drive the persisted state from what the user *sees* (group.collapsed),
    // not from raw collapsedSet membership. With the loading-state policy
    // (count==null → closed), a group can be visually closed while persisted
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

  // ========== FILTER / SORT REDUNDANT SYNC ==========

  // Defensive sync: when the global filterValue / sortValue changes, OR when
  // the set of mounted group grids changes (e.g. after expand/collapse, view
  // switch, paged-append refetch remounting a grid), re-apply the latest
  // filter & sort models to every mounted grid. The per-event handler in
  // `onGroupFilterChanged` already covers the firing grid → peers fan-out,
  // but it relies on `groupGridApis` being stable at the moment the event
  // fires. Empty-group grids have a known race where `setFilterModel` lands
  // before the column filter instances are created, leaving their header
  // indicators stale. Awaiting `setFilterModel`'s promise guarantees the
  // filter manager has materialised before we move on, so the active-filter
  // chip on the column header reflects the model.
  watch(
    () => {
      // The source runs once at watch() registration to collect deps. At
      // that moment `filterValue` / `sortValue` from useFiltersAndSort may
      // still be in the TDZ — useGrouping is constructed before
      // useFiltersAndSort. The thunks close over those bindings, so
      // calling them too early throws ReferenceError. Swallow the throw
      // and let subsequent runs (after both composables are initialised)
      // pick up the real values.
      let filterModel = {};
      let sortModel = [];
      try {
        const fv = getFilterValue?.();
        filterModel = fv?.value || {};
      } catch (_) { /* TDZ during initial setup */ }
      try {
        const sv = getSortValue?.();
        sortModel = Array.isArray(sv?.value) ? sv.value : [];
      } catch (_) { /* TDZ during initial setup */ }
      return {
        filterModel,
        sortModel,
        // Track api set so a new mount triggers re-sync. Using map size +
        // sorted keys keeps the watcher cheap; the apis themselves are
        // shallow refs.
        apiKeys: Array.from(groupGridApis.value.keys()).sort().join('|'),
        // Bumps on every register / re-register so collapse → expand of an
        // existing group key (same key, fresh api) triggers re-sync too.
        apiVersion: groupGridApiVersion.value,
      };
    },
    ({ filterModel, sortModel, apiKeys }) => {
      if (!apiKeys) return;
      // No early return on isSyncingFilters/isSyncingSort: this watcher MUST
      // run after `onGroupFilterChanged` (which sets those flags to suppress
      // its own re-entry) so empty-group grids get their filter wrappers
      // materialised via getColumnFilterInstance + the per-instance setModel
      // fallback below + refreshHeader. Re-entry safety still holds:
      // onGroupFilterChanged checks the flag itself, and we re-assert it
      // here for the duration of our work.
      isSyncingFilters.value = true;
      isSyncingSort.value = true;
      const apiEntries = Array.from(groupGridApis.value.entries());
      const filterColIds = filterModel ? Object.keys(filterModel) : [];
      // Unwrap Vue Proxy → plain object so AG Grid's internal structural
      // checks see a vanilla object.
      const plainModel = filterModel ? JSON.parse(JSON.stringify(filterModel)) : filterModel;
      Promise.all(
        apiEntries.map(async ([, api]) => {
          if (!api) return;
          // Force-instantiate filter wrappers for every column in the model
          // so AG Grid's lazy-init doesn't leave them in a half-built state
          // (custom Vue wrappers only create their `vueInstance` inside
          // init(), which AG Grid invokes lazily).
          try {
            await Promise.all(
              filterColIds.map((colId) => {
                try { return api.getColumnFilterInstance?.(colId); }
                catch (_) { return null; }
              })
            );
          } catch (_) { /* noop */ }
          try {
            const result = api.setFilterModel(plainModel);
            if (result && typeof result.then === 'function') {
              await result.catch(() => { /* noop */ });
            }
            // Per-instance fallback: on empty grids AG Grid's api-level
            // setFilterModel sometimes silently drops the model
            // (`getModel()` returns null, `isFilterActive()` returns false).
            // Apply the model directly to the instance and notify.
            for (const colId of filterColIds) {
              try {
                const inst = await api.getColumnFilterInstance?.(colId);
                const wantedModel = plainModel?.[colId] ?? null;
                const active = typeof inst?.isFilterActive === 'function'
                  ? inst.isFilterActive()
                  : false;
                if (inst && typeof inst.setModel === 'function' && wantedModel != null && !active) {
                  const r = inst.setModel(wantedModel);
                  if (r && typeof r.then === 'function') await r.catch(() => { /* noop */ });
                  try { api.onFilterChanged?.(); } catch (_) { /* noop */ }
                }
              } catch (_) { /* noop */ }
            }
          } catch (_) { /* noop */ }
          try {
            api.applyColumnState({ state: sortModel, defaultState: { sort: null } });
          } catch (_) { /* noop */ }
          // Force header re-render so the active-filter indicator on each
          // column updates immediately.
          try { api.refreshHeader?.(); } catch (_) { /* noop */ }
        })
      ).finally(() => {
        nextTick(() => {
          isSyncingFilters.value = false;
          isSyncingSort.value = false;
        });
      });
    },
    { deep: true, flush: 'post' }
  );

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
    const frontWindow = wwLib?.getFrontWindow?.() || window;
    frontWindow.removeEventListener('resize', handleGroupHorizontalResize);
    if (groupHorizontalResizeObserver) {
      groupHorizontalResizeObserver.disconnect();
      groupHorizontalResizeObserver = null;
    }
    if (loadMoreObserver) {
      loadMoreObserver.disconnect();
      loadMoreObserver = null;
    }
    observedSentinels.clear();
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
    bumpGroupingDataVersion,
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
