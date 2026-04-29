# Datagrid.vue refactor — status

Tracking the incremental refactor of `src/datagrid/Datagrid.vue` (8,730 lines → ~700-900 lines) into composables. Full design spec lives at `~/.claude/plans/i-would-like-to-zazzy-dahl.md`.

## Current state

- **Datagrid.vue:** 6,537 lines (was 8,730 — total removed: 2,193; Session 3 removed 692).
- **Composables created:** 6 of 11 (useGridApi, useSelection, useDataFetch, useFiltersAndSort, useInfiniteScroll, useGrouping).
- **New utils created:** 2 of 2 (convertFilterToSupabase, supabaseFieldMappings).
- **Build status:** `npm run serve` passes cleanly.
- **Branch:** `create-groups` (uncommitted).

## Composable inventory

| # | File | Source lines | Lines (est.) | Status |
|---|---|---|---|---|
| 1 | `composables/useGridApi.js` | setup 1000-1010, 1635-1793 | 122 actual | **DONE (S1)** |
| 2 | `composables/useDataFetch.js` | setup 770-1208, 1611-1648, 1654-1702, 3022 | 416 actual | **DONE (S2)** — also owns `isInfiniteScrollEnabled` and inline filter helpers |
| 3 | `composables/useViewConfig.js` | setup 577-609, 1471-1631, 1911-2280 | ~500 | not started |
| 4 | `composables/useColumnState.js` | setup 1011-1051, 1471-1523; computed 4732-5729 (columnDefs, defaultColDef, theme, rowStyle, cssVars, style, dataTypeDefinitions) | ~1,000 | not started |
| 5 | `composables/useColumnChooser.js` | setup 1051-1065, 1523-1593; computed 4757-4811; methods 5773-5903 | ~400 | not started |
| 6 | `composables/useFiltersAndSort.js` | setup 1002-1017, 1660-1661, 2233-2354 | 173 actual | **DONE (S2)** |
| 7 | `composables/useSelection.js` | setup 1469-1492, 2780-2818; computed 5474-5497 | 69 actual | **DONE (S1)** — `rowSelection` computed deferred to S4 |
| 8 | `composables/useGrouping.js` | setup 1220-1469, 2577-3550, 3142-3430, 3486-3541; methods 5781-5786 | 890 actual | **DONE (S3)** — `formatItemCount` (in `methods:`) deferred to S5 |
| 9 | `composables/useInfiniteScroll.js` | setup 3021-3398 | 380 actual | **DONE (S2)** |
| 10 | `composables/useCellEditing.js` | methods 5940-6273 (onCellValueChanged, getRowId, onCellEditing*, onRowEditing*, onActionTrigger, onCustomCellEdit, onRowClicked) | ~700 | not started |
| 11 | `composables/useGridActions.js` | methods 6275-7449 (setCellValue, triggerCellValueChanged, refreshRow, refreshAllRows, programmatic actions) | ~1,200 | not started |
| u1 | `utils/convertFilterToSupabase.js` | setup 770-1208 | 324 actual | **DONE (S1)** |
| u2 | `utils/supabaseFieldMappings.js` | setup 634-722 | 84 actual | **DONE (S1)** |

## Session plan

| # | Composables | Verifiable by | Status |
|---|---|---|---|
| 1 | useGridApi + useSelection + 2 utils wired in (useFiltersAndSort deferred — too coupled to data-fetch) | `npm run serve` | **DONE** — build passes |
| 2 | useDataFetch + useInfiniteScroll + useFiltersAndSort | `npm run serve` | **DONE** — build passes |
| 3 | useGrouping (useViewConfig moved to S4 — cycle deps proved too tangled to do both at once) | `npm run serve` + WeWeb smoke test grouping | **DONE** — build passes |
| 4 | useViewConfig + useColumnState + useColumnChooser (converts most of `computed:` block) | `npm run serve` | pending |
| 5 | useCellEditing + useGridActions (converts most of `methods:` block) | `npm run serve` + cell edit smoke test | pending |
| 6 | Inline editor watch, finalize orchestrator, delete remaining Options API blocks | `npm run serve` + full WeWeb smoke test | pending |

Each session is committable independently. Run `npm run serve` and at least a quick WeWeb smoke test before committing.

## Mechanical conversion rules (applied across all sessions)

- `this.x` (Options API) where `x` is a setup-returned ref → `x.value`.
- `this.cfg` → `cfg.value`. **Delete the duplicate `cfg` computed at lines 4710-4731 of Datagrid.vue** (only setup version survives).
- `this.$emit(...)` → `ctx.emit(...)`.
- `this.$nextTick` → `nextTick`.
- `computed: { foo() { return this.x } }` → `const foo = computed(() => x.value)`.
- `methods: { foo() { ... } }` → `const foo = () => { ... }`.
- Verify `getRowId` — imported at line 557 vs. method at line 5940. Source of truth is the imported version; remove the duplicate method.
- No renaming of exposed keys (template references them by name).
- No signature changes on emits, props, defineExpose.
- No new abstractions, no premature optimization, no comments beyond what exists.

## History

### 2026-04-30 — Session 0: planning + abandoned worktree attempt
- Wrote design spec (`~/.claude/plans/i-would-like-to-zazzy-dahl.md`).
- First attempt: spawned a single agent in a git worktree (`.claude/worktrees/agent-a04e989e70ae3a9b7`, branch `worktree-agent-a04e989e70ae3a9b7`) to do the full Path B refactor in one shot.
- Agent completed only 2 of 13 files (the two pure-function utils) before stopping. Correctly judged that producing 5,500 lines of mechanical conversion in one pass would yield broken non-compiling output. Recommended splitting into 6 sessions.
- Worktree abandoned. Util drafts copied into main checkout in Session 1 instead of cherry-picked.

### 2026-04-30 — Session 1: foundation composables + pure-function utils
**Shipped:**
- `utils/supabaseFieldMappings.js` (84 lines) — `getSupabaseFilterField`, `getSupabaseSortField`, `findColumnByField`, `findUserColumn` as pure functions taking `content` as first arg.
- `utils/convertFilterToSupabase.js` (324 lines) — pure function. Takes `(filterModel, query, content, debugLog)`.
- `composables/useGridApi.js` (122 lines) — owns `gridApi`, `gridApiQueue`, `gridApiUtils`, `gridReady`, `dataRendered`, `dataLoadingTimeout`, `isGridRendering`, `safeGridApiCall`, `waitForGridReady`, `waitForRowInGridLocal`, `debugLog`, `gridMonitor`. Cleanup `onBeforeUnmount` for queue lives inside.
- `composables/useSelection.js` (69 lines) — owns the `selectedRows` WeWeb component variable + `onRowSelected`, `onRowDragged`, `onRowDragEnter`, `onSelectionChanged`. The `rowSelection` Options API computed is NOT extracted (deferred to Session 4 with the rest of `computed:`).

**Wired into Datagrid.vue:**
- Imports added for new composables/utils.
- Inline `debugLog` + `gridMonitor` (orig setup ~614-621) replaced with `useGridApi(...)` destructure.
- Inline field-mapping helpers (orig ~634-722, ~89 lines) replaced with 4 single-line bound wrappers around the pure functions — keeps existing call sites unchanged inside setup() (they still call `getSupabaseFilterField(columnId)`).
- Inline `convertFilterToSupabase` (orig ~770-1164, ~395 lines) replaced with 4-line bound wrapper.
- Inline `gridApi`/queue/cleanup block (orig ~1458-1467) deleted (now from useGridApi).
- Inline `selectedRows` variable (orig ~1469-1476) deleted (now from useSelection).
- Inline `gridReady`/`isGridRendering`/`safeGridApiCall`/`waitForGridReady`/`waitForRowInGridLocal` block (orig ~1656-1731) deleted (now from useGridApi). `gridContainerRef` kept inline — it's a template DOM ref, not API plumbing.
- Inline `onRowSelected`/`onRowDragged`/`onRowDragEnter`/`onSelectionChanged` (orig ~2780-2818) deleted (now from useSelection).
- Dead imports removed: `waitForRowInGrid` from rowLookup, `GridApiQueue/GridApiUtils/globalGridApiQueue/globalGridApiUtils` from gridApiQueue, `fetchSupabaseDataUnified` from supabaseUtils, `createGridMonitor` from performanceMonitor.

**Datagrid.vue:** 8,730 → 8,140 (590 lines removed).
**Build:** `npm run serve` compiles cleanly. Only warning is pre-existing webpack-dev-server `https` deprecation, unrelated.
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- Kept tiny inline wrapper functions in setup() that bind `props.content` to the pure-util signatures, instead of changing every call site to pass `props.content` explicitly. Cheaper diff, identical behavior. Wrappers will be deleted in later sessions when their consumers (filter/sort handlers etc.) move into composables that have `props` in scope.
- Deferred `useFiltersAndSort` from Session 1 — its handlers (`onFilterChanged`, `onSortChanged`) call `fetchSupabaseData` which is still inline. Splitting them across sessions would require ugly forward-reference plumbing. Will pair with `useDataFetch` in Session 2.
- Deferred extracting `formatFiltersForLog`, `applySearchToSupabase`, `applyManualFilters` to utils. They're closure-bound to `props.content`/`debugLog`. Will fold into `useFiltersAndSort` in Session 2.

### 2026-04-30 — Session 2: data-fetch + infinite-scroll + filters/sort
**Shipped:**
- `composables/useDataFetch.js` (416 lines) — owns Supabase paginated/infinite fetch, `waitForSupabaseInstance`, fetch guards (`isFetchingData`, `lastFetchParams`), the local-update flag (`isUpdatingDataLocally` + setter/getter), removed-row tracking (`removedRowIds`, `cleanupRemovedIds`, `clearRemovedIds`), the `records` and `isFetching` WeWeb component variables, and `updateRecordsFromGrid`. Also owns `isInfiniteScrollEnabled` (computed) and the three filter/search helper closures (`formatFiltersForLog`, `applySearchToSupabase`, `applyManualFilters`) plus the `convertFilterToSupabase` and `getSupabaseSortField` bound wrappers — these stay closures because they need `props.content` access.
- `composables/useInfiniteScroll.js` (380 lines) — owns the AG Grid infinite-scroll datasource computed (single-grid mode), the per-group memoized datasource cache (`groupDatasourceFor`, `buildGroupFilterModel`), the upfront group-count machinery (`fetchSupabaseGroupCount`, `getCurrentFilterModelForCount`, `refreshGroupCounts`, `scheduleRefreshGroupCounts`), and the `rowModelType` / `rowDragManaged` / `paginationEnabled` / `cacheBlockSize` / `delayedDatasource` derivations. Three watchers move with it: gridReady→delayedDatasource, groupingColumnId→cache invalidation, and the count-trigger watch.
- `composables/useFiltersAndSort.js` (173 lines) — owns the `filters` and `sort` WeWeb component variables, debounce timers (with `onBeforeUnmount` cleanup), and the `onFilterChanged` / `onSortChanged` event handlers (single-grid mode).

**Wired into Datagrid.vue:** Three composable destructure blocks at:
- `useDataFetch` — right after `useSelection` (line 660, currently).
- `useInfiniteScroll` — right after the `========== /GROUPING FEATURE ==========` marker (currently line 1097), since it consumes inline grouping refs (`isGroupingActive`, `groupingColumnId`, `orderedGroups`, `groupGridApis`, `groupInfiniteCounts`, `UNASSIGNED_GROUP`).
- `useFiltersAndSort` — right after `applyViewConfigGeneration` (currently line 1397), so `isApplyingViewConfig` and `updateCurrentConfig` are in scope.

**Surgery details:** 17 contiguous skip-ranges deleted via a single PowerShell pass (962 lines of inline code removed). Two boundary issues fixed manually post-pass: the closing `}, 100); } };` tail of `fetchSupabaseData` survived past the skip range, and the closing `} };` of `updateViewEditedVariable` got eaten by the `updateRecordsFromGrid` skip range. Both healed with one Edit each.

**Datagrid.vue:** 8,140 → 7,233 (907 lines removed, ~11% of starting size).
**Build:** `npm run serve` compiles cleanly (only pre-existing webpack-dev-server `https` deprecation warning).
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- Helper closures (`formatFiltersForLog`, `applySearchToSupabase`, `applyManualFilters`, plus the `convertFilterToSupabase` and `getSupabaseSortField` bound wrappers) live INSIDE `useDataFetch`, not in a separate util file. They need `props.content` access and are passed as named parameters into `fetchSupabaseDataPaginated/Infinite/Count` from `supabaseUtils.js` — keeping them as closures inside the composable is simpler than threading `content` through every call site.
- `useDataFetch` owns `isInfiniteScrollEnabled` (a tiny `computed` based on `cfg`) instead of `useInfiniteScroll`. This breaks an otherwise-circular dep where `useInfiniteScroll` would need to define it but `useDataFetch` (called earlier) would need to consume it. Logically `isInfiniteScrollEnabled` is a data-fetch concern (it picks the fetch shape), so this is also conceptually clean.
- `useInfiniteScroll` takes the inline grouping refs (`isGroupingActive`, etc.) as deps. They're still owned by setup() until Session 3 extracts `useGrouping`. `groupInfiniteCounts` is also injected — it's WRITTEN by useInfiniteScroll's `groupDatasourceFor.getRows`, READ by inline `orderedGroups`. Will move to `useGrouping` ownership in Session 3.

**Pre-existing bugs noticed (not fixed):**
- `methods.removeRow` calls bare `cleanupRemovedIds()` instead of `this.cleanupRemovedIds()` (~line 5612 currently). Throws `ReferenceError` at runtime if the cleanup branch is hit. Not introduced by the refactor — same behavior pre-Session-1.

### 2026-04-30 — Session 3: useGrouping (useViewConfig deferred to S4)
**Shipped:**
- `composables/useGrouping.js` (890 lines) — owns the entire grouping feature: `UNASSIGNED_GROUP` constant, `VIEW_VARIABLE_ID`/`GROUP_COLLAPSED_VARIABLE_ID` for per-view persisted collapsed state (`getCurrentViewId`, `getStoredCollapsedForView`, `persistCollapsedForView`); state refs (`groupingState`, `pendingGroupingColumnId`, `isGroupingTransitionLoading`, `groupGridApis`, `groupSelections`, `groupInfiniteCounts`, sync-guard refs, drag refs, scroll-sync refs); computeds (`groupingColumnId`, `isGroupingActive`, `groupingSourceRows`, `groupedRowData`, `orderedGroups`, `hasGroupHorizontalOverflow`, `selectableGroupingColumns`); helpers (`isSelectColumn`, `isValidGroupColumn`, `getGroupColor`, `getGroupLabel`, `rowGroupKey`, `groupRowData`, `alignedGridApisForGroup`, `findGroupForRowId`); horizontal-scrollbar sync (`updateGroupHorizontalScrollbarMetrics`, `syncGroupHorizontalScrollLeft`, `onGroupHorizontalScrollbarScroll`, `onGroupBodyScroll`, resize-listener mount/unmount); per-grid event handlers (`onGroupGridReady`, `onGroupGridUnmounted`, `onGroupFilterChanged`, `onGroupSortChanged`, `onGroupColumnResized`, `onGroupColumnMoved`, `onGroupSelectionChanged`, `onGroupRowSelected`, `withFiringGrid`); drag-reorder (`onGroupDragStart`/`Over`/`Drop`/`End`); collapse/expand (`toggleGroupCollapsed`, `collapseAllGroups`, `expandAllGroups`); the grouping-change loading-overlay transition (`startGroupingTransition`, `finishGroupingTransition`, `applyGroupingWithLoading`, `afterNextPaint`); collapsed-state hydration watcher (cross-view re-sync); setters (`setGroupingColumn`, `setShowUnassigned`, `writeGroupingToViewConfig`); plus the local `onBeforeUnmount` cleanup for `groupingTransitionTimer` and the resize listener.

**Wired into Datagrid.vue:** Single composable destructure block inserted right after `useDataFetch` (currently line ~675), with one direct dep block (gridApi/gridReady/debugLog/gridContainerRef/findColumnByField/setSelectedRows/isInfiniteScrollEnabled/supabaseData) and a separate thunks block (12 `getX: () => x` lambdas) for cross-composable cycle-deps that resolve at event-call time.

**Surgery details:** Single PowerShell pass deleted 3 contiguous code regions: the entire `// ========== GROUPING FEATURE ==========` block (lines 845-1094, 250 lines — state + computeds + scrollbar-related), the entire `// ========== GROUPING EVENT HANDLERS ==========` block (lines 1913-2397, 485 lines — handlers + scrollbar sync + selectableGroupingColumns + transitions), and the grouping-related cleanup lines inside the inline `onBeforeUnmount` (lines 2407-2412, 6 lines — clearTimeout for groupingTransitionTimer + removeEventListener for resize). Also moved `gridContainerRef` declaration from line 1274 to line 674 (above `useGrouping` call) since useGrouping reads it for the multi-grid scrollbar metrics.

No boundary issues this round — the surgery applied cleanly on first try.

**Datagrid.vue:** 7,233 → 6,537 (692 lines removed, ~10% of starting size; cumulative reduction since start: 8,730 → 6,537 = 25%).
**Build:** `npm run serve` compiles cleanly. No new warnings.
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- **Cycle deps via thunks, not late-bind setters.** useGrouping needs many things from composables created LATER (`updateCurrentConfig` from useViewConfig, `scheduleRefreshGroupCounts`/`groupDatasourceFor` from useInfiniteScroll, `onFilterChanged`/`onSortChanged` from useFiltersAndSort, plus refs `filterValue`/`sortValue`/`columnOrder`/`currentConfig`). Passed each as a `getX: () => x` lambda. The lambda captures the setup() lexical scope; the actual lookup happens at event-call time, by which point all `const` declarations are initialized. Cleaner than mutating a shared deps object after creation.
- **`useViewConfig` deferred to Session 4.** Original plan was to do useViewConfig + useGrouping together as a "cycle pair" — on closer inspection, the cycle has 7+ entanglement points (applyViewConfiguration writes grouping state directly, writeGroupingToViewConfig calls updateCurrentConfig, group event handlers read 4 different refs from view-config space, etc.). Doing both at once would require resolving all cycles in a single un-verifiable pass. Better to land useGrouping cleanly with thunks, verify, then do useViewConfig in S4.
- **`isVirtualColumn` thunked rather than moved.** `onGroupColumnMoved` filters out virtual columns. `isVirtualColumn` is still inline (used elsewhere too). Thunked it for now; will move into useColumnState in Session 4.
- **`hoisted gridContainerRef` declaration.** Originally declared after the grouping section; moved to right after `useDataFetch` so useGrouping (which reads it via a destructured parameter) sees the ref object at composable-creation time. Single line move, no semantic change.

**Pre-existing bugs noticed (not fixed):** Same as S2 — `methods.removeRow` calls bare `cleanupRemovedIds()` without `this.`.

## Next action

Start Session 4: extract `useViewConfig`. Owns `applyViewConfiguration` (~370 lines), `currentConfig`/`columnDefsVar` WeWeb variables (note: `columnOrder`/`hiddenColumns` may stay inline or move to `useColumnState` instead — TBD when planning S4), `updateCurrentConfig`, `getCurrentColumnWidths`, `isViewConfigEdited`, `updateViewEditedVariable`, `suppressEditedUntil`, `lastAppliedViewConfig`, `isApplyingViewConfig`, `applyViewConfigGeneration`, the `gridReady`-triggered initial-config watcher, the `viewConfiguration` change watcher, and `initialState` (the AG Grid initial-state ref). After useViewConfig lands, all the `getUpdateCurrentConfig`/`getCurrentConfig` thunks in `useGrouping` will resolve cleanly and we can audit whether to drop the thunk pattern in favor of direct refs (depends on ordering). Estimated ~600-800 line reduction. Will pair with `useColumnState` if scope permits, or do columnState in S5 along with `useColumnChooser`.
