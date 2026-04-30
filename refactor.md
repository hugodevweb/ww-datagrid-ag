# Datagrid.vue refactor — status

Tracking the incremental refactor of `src/datagrid/Datagrid.vue` (8,730 lines → ~700-900 lines) into composables. Full design spec lives at `~/.claude/plans/i-would-like-to-zazzy-dahl.md`.

## Current state

- **Datagrid.vue:** 3,509 lines (was 8,730 — total removed: 5,221, ~60% reduction; Session 6 removed 1,940).
- **Composables created:** 11 of 11 (useGridApi, useSelection, useDataFetch, useFiltersAndSort, useInfiniteScroll, useGrouping, useViewConfig, useColumnState, useColumnChooser, useCellEditing, useGridActions).
- **New utils created:** 2 of 2 (convertFilterToSupabase, supabaseFieldMappings).
- **Build status:** `npm run serve` passes cleanly.
- **Branch:** `create-groups` (uncommitted).

## Composable inventory

| # | File | Source lines | Lines (est.) | Status |
|---|---|---|---|---|
| 1 | `composables/useGridApi.js` | setup 1000-1010, 1635-1793 | 122 actual | **DONE (S1)** |
| 2 | `composables/useDataFetch.js` | setup 770-1208, 1611-1648, 1654-1702, 3022 | 416 actual | **DONE (S2)** — also owns `isInfiniteScrollEnabled` and inline filter helpers |
| 3 | `composables/useViewConfig.js` | setup 845-870, 887-893, 923-1074, 1183-1191, 1208-1618 | 661 actual | **DONE (S4)** |
| 4 | `composables/useColumnState.js` | setup 726-741, 885-888, 1087-1145; computed 1972-1996, 2714-2969 (defaultColDef, dataTypeDefinitions, rowSelection, style, cssVars, theme, rowStyle) | 438 actual | **DONE (S5)** — `columnDefs` computed deferred to S6 alongside cell-editing |
| 5 | `composables/useColumnChooser.js` | setup 747-826; computed 1997-2051; methods 3013-3144 | 329 actual | **DONE (S5)** |
| 6 | `composables/useFiltersAndSort.js` | setup 1002-1017, 1660-1661, 2233-2354 | 173 actual | **DONE (S2)** |
| 7 | `composables/useSelection.js` | setup 1469-1492, 2780-2818; computed 5474-5497 | 69 actual | **DONE (S1)** — `rowSelection` computed deferred to S4 |
| 8 | `composables/useGrouping.js` | setup 1220-1469, 2577-3550, 3142-3430, 3486-3541; methods 5781-5786 | 890 actual | **DONE (S3)** — `formatItemCount` (in `methods:`) deferred to S5 |
| 9 | `composables/useInfiniteScroll.js` | setup 3021-3398 | 380 actual | **DONE (S2)** |
| 10 | `composables/useCellEditing.js` | computed 1908-2569 (columnDefs); methods 2659-2993 (getRowId, onActionTrigger, onCellEdit*, onRowEditing*, onCellValueChanged, onRowClicked, onCustomCellEdit) | 1,074 actual | **DONE (S6)** |
| 11 | `composables/useGridActions.js` | methods 3001-4022 (setCellValue, triggerCellValueChanged, refreshRow, stopCellEditing, createRecord, closeCreateRecordForm, resetFilters, resetSort, deselectAll, selectAll, selectRow, deselectRow, removeRow, applyFocusedRow) | 1,109 actual | **DONE (S6)** |
| u1 | `utils/convertFilterToSupabase.js` | setup 770-1208 | 324 actual | **DONE (S1)** |
| u2 | `utils/supabaseFieldMappings.js` | setup 634-722 | 84 actual | **DONE (S1)** |

## Session plan

| # | Composables | Verifiable by | Status |
|---|---|---|---|
| 1 | useGridApi + useSelection + 2 utils wired in (useFiltersAndSort deferred — too coupled to data-fetch) | `npm run serve` | **DONE** — build passes |
| 2 | useDataFetch + useInfiniteScroll + useFiltersAndSort | `npm run serve` | **DONE** — build passes |
| 3 | useGrouping (useViewConfig moved to S4 — cycle deps proved too tangled to do both at once) | `npm run serve` + WeWeb smoke test grouping | **DONE** — build passes |
| 4 | useViewConfig (split off — useColumnState/useColumnChooser deferred to S5) | `npm run serve` + WeWeb smoke test view-config restore | **DONE** — build passes |
| 5 | useColumnState (no columnDefs) + useColumnChooser | `npm run serve` + WeWeb smoke test column chooser + theme/rowStyle | **DONE** — build passes |
| 6 | useCellEditing + useGridActions (incl. `columnDefs` computed) | `npm run serve` + cell edit smoke test + WeWeb workflow action smoke test | **DONE** — build passes |
| 7 | Inline editor watch, finalize orchestrator, delete remaining Options API blocks (cfg duplicate, formatItemCount, reportPerformance, resetPerformance, isEditing/invalidEditValueMode/paginationPageSizeSelector, generateColumns + test event stubs) | `npm run serve` + full WeWeb smoke test | pending |

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

### 2026-04-30 — Session 4: useViewConfig
**Shipped:**
- `composables/useViewConfig.js` (661 lines) — owns `currentConfig`/`columnDefs` WeWeb component variables and the `props.content?.columns → setColumnDefsVar` watcher; `getCurrentColumnWidths`, `updateCurrentConfig`, `isViewConfigEdited` (internal); `suppressEditedUntil`/`updateViewEditedVariable` for the edited-flag suppression machinery; `lastAppliedViewConfig`/`isApplyingViewConfig`/`applyViewConfigGeneration` (internal); the big `applyViewConfiguration` function (~250 lines that pushes a saved viewConfiguration into the grid — filters, sorting, columnsOrder, sizes, hiddenColumns, grouping, deselection, chooser sync, retry-on-#252); the `gridReady`-triggered initial-apply watcher; the external `cfg.viewConfiguration` change watcher (with optimized comparison + multi-stage edited-variable reset); and the one-time `initialState` ref + seeding (incl. `groupingState` bootstrap when `viewConfiguration.grouping` is pre-set).

**Wired into Datagrid.vue:** Single composable destructure block inserted right after `isVirtualColumn` definition (currently line ~890), with one direct dep block (gridApi/gridReady/debugLog/groupingState/groupGridApis/groupSelections/getStoredCollapsedForView/isValidGroupColumn/setSelectedRows/columnOrder+setter/hiddenColumns+setter/chooserColumnOrder/chooserHiddenState/isVirtualColumn/isEmptyConfigValue) and two thunks (`getFilterValue`, `getSortValue`) — useFiltersAndSort is created AFTER useViewConfig because useFiltersAndSort consumes `isApplyingViewConfig` and `updateCurrentConfig` from useViewConfig, but useViewConfig needs to read `filterValue`/`sortValue` snapshots inside `updateCurrentConfig`. Lazy thunks resolve at call time, breaking the cycle.

**Surgery details:** Single PowerShell pass deleted 12 contiguous code regions: currentConfig + columnDefsVar variables (845-870), watch on props.content?.columns (887-893), getCurrentColumnWidths (923-939), updateCurrentConfig (941-966), isViewConfigEdited (968-1035), suppressEditedUntil block (1037-1043), updateViewEditedVariable (1045-1074), lastAppliedViewConfig+isApplyingViewConfig+applyViewConfigGeneration block (1183-1191), applyViewConfiguration body (1208-1459), gridReady watcher (1461-1483), viewConfiguration change watcher (1485-1576), and the initialState ref + seeding block (1578-1618). No boundary issues this round — surgery applied cleanly on first try (build green immediately).

**Datagrid.vue:** 6,538 → 5,970 (568 lines removed; cumulative reduction since start: 8,730 → 5,970 = 32%).
**Build:** `npm run serve` compiles cleanly. Only the pre-existing webpack-dev-server `https` deprecation warning.
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- **Cycle resolved by reordering, not by mutating shared deps.** useViewConfig needs `filterValue`/`sortValue` to build the currentConfig snapshot; useFiltersAndSort needs `isApplyingViewConfig`/`updateCurrentConfig` to gate event emission and refresh the config after each filter/sort change. Solution: useViewConfig is created BEFORE useFiltersAndSort (so its return values are in scope at the useFiltersAndSort call), and the two reads inside `updateCurrentConfig` go through `getFilterValue()` / `getSortValue()` thunks that resolve at call time — by which point useFiltersAndSort has been created and its returns are bound. Cleaner than threading a setter callback.
- **Inline column-state deps still passed as parameters.** `columnOrder`/`hiddenColumns`/`chooserColumnOrder`/`chooserHiddenState`/`isVirtualColumn`/`isEmptyConfigValue` are read by `applyViewConfiguration` and `updateCurrentConfig`. They'll move into `useColumnState`/`useColumnChooser` in S5; for now they're passed as deps to keep the contract stable. After S5, useViewConfig's deps object can drop them in favor of direct destructuring (or thunks if ordering forces it).
- **`useGrouping`'s `getCurrentConfig`/`getUpdateCurrentConfig` thunks are still needed.** useGrouping is created BEFORE useViewConfig (because useViewConfig consumes grouping state from useGrouping). So `currentConfig`/`updateCurrentConfig` aren't in scope at useGrouping's call site — the thunks remain mandatory. Audit deferred until S5 when more refs settle into known positions.
- **`initialState` seeding stays single-shot, runs at composable creation.** The original code uses an `if (!initialState.value)` guard wrapped around the seeding, even though the ref was just created with `null`. Kept that guard verbatim for behavior parity, even though it's effectively always-true on first run. Removing it would be a stylistic change unrelated to this session's scope.

**Pre-existing bugs noticed (not fixed):** Same as previous sessions — `methods.removeRow` calls bare `cleanupRemovedIds()` without `this.`.

### 2026-04-30 — Session 5: useColumnState + useColumnChooser
**Shipped:**
- `composables/useColumnState.js` (438 lines) — owns `columnOrder`/`hiddenColumns` WeWeb component variables, the `isVirtualColumn` helper, the simple visual computeds (`defaultColDef`, `dataTypeDefinitions`, `rowSelection`, `style`, `cssVars`, `theme`, `rowStyle`), the validation tracking refs (`_pendingValidationError`, `_validationFiredForCurrentEdit`), and the `onColumnMoved`/`onColumnResized` event handlers (single-grid mode). The `columnDefs` computed itself is **NOT** extracted in S5 — it depends on `this.onActionTrigger` and `this.onCustomCellEdit` (still in `methods:`) and on the validation refs above. It moves alongside cell-editing in S6.
- `composables/useColumnChooser.js` (329 lines) — owns the chooser-panel UI state (`showColumnChooser`, `columnChooserRef`, `columnChooserSearch`, `chooserColumnOrder`, `chooserHiddenState`, `chooserDragColId`, `chooserDragOverColId`, `activeChooserTab`), the click-outside handler with bidirectional `cfg.columnChooserVariableId` sync (incl. its asynchronous attach + cleanup `onBeforeUnmount`), the column-list computeds (`allColumnsList`, `filteredColumnsList`, `allColumnsVisible`, `visibleColumnCount`, `someColumnsHidden`), and the chooser methods (`openColumnChooser`, `hideColumn`, `showColumn`, `toggleColumnVisibility`, `toggleAllColumns`, `onChooserDragStart`/`Over`/`Drop`/`End`).

**Wired into Datagrid.vue:** Two consecutive composable destructure blocks inserted right after `useGrouping` (line ~728), with deps that match what each composable consumes. useColumnState uses lazy thunks for `getUpdateCurrentConfig` (resolves to useViewConfig's `updateCurrentConfig`, created later) and for `getShowColumnChooser`/`getChooserColumnOrder` (from useColumnChooser, also created later — needed by `onColumnMoved` to keep the chooser panel in sync). useColumnChooser uses a thunk for `getUpdateCurrentConfig` only. Setup return statement extended with 21 new entries (defaultColDef/dataTypeDefinitions/rowSelection/style/cssVars/theme/rowStyle/_pendingValidationError/_validationFiredForCurrentEdit + the 13 chooser-related list computeds and methods).

**Surgery details:** Single PowerShell pass deleted 11 contiguous code regions: the inline columnOrder + hiddenColumns variables (728-743), the inline chooser state (749-757), the click-outside handler + showColumnChooser watcher + external-variable watcher + onBeforeUnmount cleanup (759-828), the inline `isVirtualColumn` definition (887-890), `onColumnMoved` (1089-1111), `onColumnResized` (1113-1145), `defaultColDef` + `dataTypeDefinitions` from computed: (1974-1998), the 5 chooser list computeds (1999-2053), `rowSelection` through `rowStyle` from computed: (2716-2971), `openColumnChooser` from methods: (3015-3017), and `hideColumn` through `onChooserDragEnd` from methods: (3029-3146). No boundary issues this round — surgery applied cleanly on first try (build green immediately after a follow-up Edit that added the new return entries).

**Datagrid.vue:** 5,970 → 5,449 (521 lines removed; cumulative reduction since start: 8,730 → 5,449 = 38%).
**Build:** `npm run serve` compiles cleanly. Only the pre-existing webpack-dev-server `https` deprecation warning.
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- **`columnDefs` deferred to S6.** The original plan had `columnDefs` going into useColumnState. On closer inspection, `columnDefs` calls `this.onActionTrigger` and `this.onCustomCellEdit` (Options-API methods) and writes `this._pendingValidationError`/`this._validationFiredForCurrentEdit`. Once S6 moves the cell-editing methods into a composable, those dependencies become composable-local — at which point columnDefs can be safely converted to a Composition-API `computed()` without resorting to `getCurrentInstance()` proxy hacks. The validation-tracking refs are exposed from useColumnState now so that S6 can consume them, and the still-in-Options-API `columnDefs` continues to write to them via `self._pendingValidationError = X` (the setup-returned ref auto-unwraps on assignment via `this`).
- **Chooser state still spread into setup return.** The chooser state refs (`showColumnChooser` etc.) and methods (`hideColumn` etc.) are returned from setup so that the template (which references them by name) and Options-API methods that haven't moved yet can access them via `this.x`. No template changes needed.
- **`_pendingValidationError` keeps its underscore prefix.** The Options-API code currently treats it as an ad-hoc instance property (`this._pendingValidationError = X`). Exposing it from setup return as a setup-returned ref means `this._pendingValidationError` now auto-unwraps on read and writes to `ref.value` on assignment — preserving the same call-site semantics without any Options-API code changes. The underscore name was kept verbatim to avoid touching cell-editing call sites until S6 absorbs them.
- **Cycle deps via thunks.** `useColumnState`'s `onColumnMoved` reads from `chooserColumnOrder` (in useColumnChooser, created AFTER), and writes via `updateCurrentConfig` (from useViewConfig, created AFTER). useColumnChooser writes via `updateCurrentConfig` too. All three are thunks so the lookup happens at event-call time, after every composable is wired.
- **`formatItemCount`, `reportPerformance`, `resetPerformance` stay in `methods:` for now.** All three are tiny single-line wrappers over already-exposed setup values (`this.gridMonitor`, `this.cfg`, `this.getTranslations`). The plan had them moving in S5; deferring to S7 cleanup keeps S5's diff focused on column state. They'll be inlined into setup as one-line lambdas in S7.
- **Did not deduplicate the `cfg` Options-API computed.** It mirrors the setup `cfg` computed but is separately needed for `this.cfg` access from Options-API computeds/methods. Will collapse in S7 by adding `cfg` to the setup return (so `this.cfg` resolves to the setup version).

**Pre-existing bugs noticed (not fixed):** Same as previous sessions.

### 2026-04-30 — Session 6: useCellEditing + useGridActions
**Shipped:**
- `composables/useCellEditing.js` (1,074 lines) — owns the giant `columnDefs` computed (the per-column AG Grid definition builder, ~660 lines), the `_lastActiveCellEdit` ref, all cell/row edit lifecycle handlers (`onCellEditingStarted`, `onCellEditingStopped`, `onRowEditingStarted`, `onRowEditingStopped`, `onCellValueChanged`, `onCellEditRequest`), action triggering (`onActionTrigger`, `onCustomCellEdit`, `onRowClicked`), and `getRowId`. Reads validation tracking refs from useColumnState (S5) — `_pendingValidationError`/`_validationFiredForCurrentEdit` were exposed there with that lookahead in mind.
- `composables/useGridActions.js` (1,109 lines) — owns the entire programmatic-action surface exposed to WeWeb workflows: `setCellValue`, `triggerCellValueChanged`, `refreshRow` (with grouped-mode + active-editor preservation + DB-fetch-and-add for not-found rows + infinite-cache purge), `stopCellEditing`, `createRecord`, `closeCreateRecordForm`, `resetFilters`, `resetSort`, `deselectAll`, `selectAll`, `selectRow`, `deselectRow`, `removeRow` (with infinite-scroll DOM-hide + cache-purge ceremony), `applyFocusedRow`. Method bindings declared as `let` first then assigned — preserves the recursive call semantics (e.g. `setCellValue(...)` calling itself on render-collision retry, `selectRow` calling itself on rendering-deferral) and the cross-method calls (`createRecord` → `setCellValue`).

**Wired into Datagrid.vue:** Two consecutive composable destructure blocks inserted right after `createPopupTeleportTarget` (line ~796), with deps that match each composable's reads. `useCellEditing` runs FIRST so its `_lastActiveCellEdit` ref is in scope when `useGridActions` is constructed (consumed by refreshRow's diagnostic logging). Setup return statement extended with 26 new entries: 12 from useCellEditing (incl. `columnDefs` and `_lastActiveCellEdit`) and 14 from useGridActions.

**Surgery details:** Single PowerShell pass deleted 8 contiguous code regions from the Options-API blocks: the entire `columnDefs` computed (1910-2571, 662 lines), the cell-editing methods cluster (2661-2995, 335 lines: getRowId / onActionTrigger / onCellEditRequest / onCellEditingStarted / onCellEditingStopped / onRowEditingStarted / onRowEditingStopped / onCellValueChanged / onRowClicked / onCustomCellEdit), the JSDoc + body for setCellValue (2996-3187, 192 lines), the JSDoc + body for refreshRow + stopCellEditing through removeRow (3188-3951, 764 lines), the JSDoc + body for applyFocusedRow (3952-4024, 73 lines). Total raw delete: ~2,026 lines, replaced with ~57 lines of composable wiring → net **-1,970 lines** before adding 28 lines to the setup return → final net **-1,940 lines**.

**Datagrid.vue:** 5,449 → 3,509 (1,940 lines removed; cumulative reduction since start: 8,730 → 3,509 = **60%**).
**Build:** `npm run serve` compiles cleanly. Only the pre-existing webpack-dev-server `https` deprecation warning.
**Not committed yet** — user to review and commit when ready.

**Judgment calls:**
- **`columnDefs` extracted into useCellEditing, not useColumnState.** The S5 plan considered putting columnDefs in useColumnState; deferring to S6 paid off — once the cell-editing methods (`onActionTrigger`, `onCustomCellEdit`) become composable-local, columnDefs's two `this.X` references to them resolve to ordinary closure references with no `getCurrentInstance()` proxy hack needed. Validation tracking refs continue to live in useColumnState (S5) and are passed in as deps; conceptually they belong with editing more than with columnDefs, but moving them now would mean re-touching useColumnState — leaving them there is cheaper.
- **Forward-declared `let` bindings inside useGridActions for inter-method calls.** `setCellValue` calls itself on render-collision retry, `selectRow`/`deselectRow`/`removeRow` likewise self-recurse, and `createRecord` calls `setCellValue`. Declaring `let setCellValue; ... ; setCellValue = async (...) => {...}` lets the closures see the bound function at call time — same shape as the original Options-API behavior where `this.setCellValue` resolved through the proxy. Cleaner than passing them through deps or restructuring as a single Object.assign.
- **Pre-existing `cleanupRemovedIds()` bug naturally fixed.** The original Options-API `removeRow` called bare `cleanupRemovedIds()` instead of `this.cleanupRemovedIds()` — a `ReferenceError` waiting to fire. After conversion to composable, `cleanupRemovedIds` is a passed-in dep and resolves correctly. Bug noted in earlier sessions, fixed incidentally here.
- **`_lastActiveCellEdit` lives in useCellEditing.** It's set/cleared in onCellEditingStarted/Stopped (cell-editing concern) and only read by useGridActions.refreshRow (for diagnostic logging — not behavior). Useless to put it in useGridActions; useCellEditing owns it and exposes via the composable return.
- **`activeCreateColumnField`/`Row`/`RowId` still inline in setup.** Both composables receive them as deps. They're consumed in two unrelated ways: useCellEditing's record column `onCreateClick` writes them, useGridActions's `createRecord` and `closeCreateRecordForm` write them. They could move into useCellEditing in a future cleanup, but they're refs not state with logic, and currently they're also used by the create-record popup template and `<style>` selectors — leaving inline.
- **`onRowDragged`/`onRowDragEnter` left in useSelection.** Already there from S1 — not touched.

**What remains in Options API** (S7 work):
- `cfg` computed (duplicate of setup `cfg` — easy collapse via setup return spread)
- `isEditing`, `invalidEditValueMode`, `paginationPageSizeSelector` (3 small computeds)
- `reportPerformance`, `resetPerformance`, `formatItemCount`, `checkIfColumnsStructureChanged`
- `generateColumns` + 9 `getOnXTestEvent` editor-only stubs (~150 lines)
- `watch.columnDefs` editor-only block (60 lines)

**Pre-existing bugs noticed (not fixed):** None new — the `cleanupRemovedIds` bare-call bug was incidentally fixed by the composable conversion (now a passed dep that resolves correctly).

## Next action

Start Session 7: final cleanup pass. Move the remaining 3 small Options-API computeds (isEditing, invalidEditValueMode, paginationPageSizeSelector) and the 4 wrapper methods (reportPerformance, resetPerformance, formatItemCount, checkIfColumnsStructureChanged) into the setup() body as inline `const`s/lambdas. Add `cfg` to the setup return so the duplicate Options-API `cfg` computed can be deleted. Move `generateColumns` + the test-event-stub methods into a small `editor-only` block of the setup or keep them in a tiny editor-only `methods:` block. Convert `watch.columnDefs` to a Composition-API `watch()` inside setup (still wwEditor-gated). Consider deleting the entire `computed:`, `methods:`, `watch:` Options-API blocks. Estimated reduction: ~250 lines, ending at ~3,250 lines (a bit higher than the original ~700-900 target because the `<style>` block is 1,200 lines and the `<template>` is ~457 lines, both untouched). The original target presumed the `<style>` would shrink — it didn't, so the realistic floor is ~3,000 lines without further template/style consolidation.


