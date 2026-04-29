# Datagrid.vue refactor — status

Tracking the incremental refactor of `src/datagrid/Datagrid.vue` (8,730 lines → ~700-900 lines) into composables. Full design spec lives at `~/.claude/plans/i-would-like-to-zazzy-dahl.md`.

## Current state

- **Datagrid.vue:** 8,140 lines (was 8,730 — Session 1 removed 590).
- **Composables created:** 2 of 11 (useGridApi, useSelection).
- **New utils created:** 2 of 2 (convertFilterToSupabase, supabaseFieldMappings).
- **Build status:** `npm run serve` passes cleanly (only pre-existing webpack-dev-server deprecation warning).
- **Branch:** `create-groups` (uncommitted).

## Composable inventory

| # | File | Source lines | Lines (est.) | Status |
|---|---|---|---|---|
| 1 | `composables/useGridApi.js` | setup 1000-1010, 1635-1793 | 122 actual | **DONE (S1)** |
| 2 | `composables/useDataFetch.js` | setup 859-1000, 1745-1793, 3609-4100 | ~400 | not started |
| 3 | `composables/useViewConfig.js` | setup 577-609, 1471-1631, 1911-2280 | ~500 | not started |
| 4 | `composables/useColumnState.js` | setup 1011-1051, 1471-1523; computed 4732-5729 (columnDefs, defaultColDef, theme, rowStyle, cssVars, style, dataTypeDefinitions) | ~1,000 | not started |
| 5 | `composables/useColumnChooser.js` | setup 1051-1065, 1523-1593; computed 4757-4811; methods 5773-5903 | ~400 | not started |
| 6 | `composables/useFiltersAndSort.js` | setup 634-768, 770-1208, 2362-2484 | ~700 | not started (deferred from S1 — coupled to fetchSupabaseData, will pair with useDataFetch in S2) |
| 7 | `composables/useSelection.js` | setup 1469-1492, 2780-2818; computed 5474-5497 | 69 actual | **DONE (S1)** — `rowSelection` computed deferred to S4 |
| 8 | `composables/useGrouping.js` | setup 1220-1469, 2577-3550, 3142-3430, 3486-3541; methods 5781-5786 | ~1,200 | not started |
| 9 | `composables/useInfiniteScroll.js` | setup 3609-3885, 3890-4100 | ~500 | not started |
| 10 | `composables/useCellEditing.js` | methods 5940-6273 (onCellValueChanged, getRowId, onCellEditing*, onRowEditing*, onActionTrigger, onCustomCellEdit, onRowClicked) | ~700 | not started |
| 11 | `composables/useGridActions.js` | methods 6275-7449 (setCellValue, triggerCellValueChanged, refreshRow, refreshAllRows, programmatic actions) | ~1,200 | not started |
| u1 | `utils/convertFilterToSupabase.js` | setup 770-1208 | 324 actual | **DONE (S1)** |
| u2 | `utils/supabaseFieldMappings.js` | setup 634-722 | 84 actual | **DONE (S1)** |

## Session plan

| # | Composables | Verifiable by | Status |
|---|---|---|---|
| 1 | useGridApi + useSelection + 2 utils wired in (useFiltersAndSort deferred — too coupled to data-fetch) | `npm run serve` | **DONE** — build passes |
| 2 | useDataFetch + useInfiniteScroll + useFiltersAndSort | `npm run serve` | pending |
| 3 | useViewConfig + useGrouping (cycle pair) | `npm run serve` + WeWeb smoke test grouping | pending |
| 4 | useColumnState + useColumnChooser (converts most of `computed:` block) | `npm run serve` | pending |
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

## Next action

Start Session 2: extract `useDataFetch` + `useInfiniteScroll` + `useFiltersAndSort`. This will let us delete the inline `fetchSupabaseData`/`fetchSupabaseDataForInfinite` (~150 lines), the infinite-scroll datasource block (~280 lines), the per-group datasource cache (~70 lines), the upfront group counts logic (~110 lines), and the filter/sort event handlers + helpers (~400 lines). Estimated ~1,000+ line reduction.
