# Kanban view — implementation status

Tracking the implementation of `src/kanban/Kanban.vue`. The kanban shares `props.content` (columns + rowData + viewConfiguration + supabase config) with the datagrid and is selected by the `viewType` switch in `wwElement.vue` when the WeWeb view variable's `type` is `'kanban'`.

## Status: COMPLETE ✅

All decisions locked in chat are implemented and the build passes.

## Decisions implemented

- **Persistence** — kanban settings live in `viewConfiguration.kanban = { groupBy, cardFields, order, showUnassigned }`. The kanban writes through to the same `currentConfig` exposed component variable as the datagrid, under a `kanban` sub-key. Reads from `viewConfiguration` on mount and reapplies on prop change. The `viewEditedVariableId` is updated when local state diverges from the baseline.
- **Card drag** between columns:
  - Optimistic local update of the row.
  - When `dataSource === 'supabase'`: writes to `supabase.from(supabaseTable).update({ [groupBy]: newValue }).eq(supabaseIdField || 'id', rowId)`. Reverts on error and logs a console warning. No toast (kept v1 simple as agreed).
  - Always emits `cardMoved` with `{ row, id, columnId, oldValue, newValue, oldGroup, newGroup }`.
  - Also emits `cellValueChanged` (same shape as the datagrid) so existing handlers keep working.
- **Card click** → emits `rowClicked` with `{ row, id, index, displayIndex }`.
- **Group order, collapse, show-unassigned** — same patterns as the datagrid grouped view. Collapse state is persisted in the same per-view-id WeWeb variable (`48f1f1e8-79c5-4adc-8b9f-909c5c75e605`).
- **First card field = title** — rendered larger/bolder; subsequent fields render below as label-value rows. A "Title" badge marks it in the field-picker.
- **All `cellDataType`s render faithfully on the card.** The renderer dispatcher (`KanbanField.vue`) mounts the existing AG-Grid renderers (`SelectCellRenderer`, `UserCellRenderer`, `RecordCellRenderer`, `WewebCellRenderer`) directly with a constructed minimal AG-Grid params object. `dateString` / `dateTime` / `currency` go through the existing `createDateFormatter` / `createCurrencyFormatter` factories. `image` uses a plain `<img>` with bounded height. `action` is excluded from the field-picker.

## Pivots from the original plan

### Field-display helpers (originally a separate `fieldDisplay.js`)

The plan called for extracted pure display helpers shared between AG-Grid renderers and the kanban card. **Replaced** by directly mounting the existing AG-Grid renderer components from `KanbanField.vue` with a fake `params` object. Same end result (single source of truth for display, no drift) with zero new code in the renderers themselves. Renderers stay in display-only mode because we omit `params.api` / `params.stopEditing`.

### Config menu trigger

The plan called for a cog button anchored top-right of the component. **Replaced** with the same external-variable pattern the datagrid uses for its column chooser. The kanban reads/writes `cfg.columnChooserVariableId` bidirectionally:
- External writes to the variable open / close the panel.
- Click-outside on the panel closes it and writes `false` back to the variable.
- The user supplies their own trigger on the page (a button, a keyboard shortcut, whatever).

The empty state still displays an instructional message, but no longer points at an in-component button.

### Infinite scroll fallback

The plan deferred infinite scroll to v2 with a fallback "fetch one paginated page". **Implemented** as a single large infinite-mode fetch (default 1000 rows, configurable via `cfg.kanbanMaxRows`). Refetched on `dataSource` / `supabaseTable` / `supabaseQuery` / `supabaseFilters` / `kanbanMaxRows` changes.

## Files

| File | Purpose |
|---|---|
| [src/kanban/Kanban.vue](src/kanban/Kanban.vue) | Main view — board layout, group columns, drag handlers, config panel, supabase fetch, persistence. |
| [src/kanban/components/KanbanField.vue](src/kanban/components/KanbanField.vue) | Field dispatcher — picks the right renderer per `cellDataType`. |
| [src/wwElement.vue](src/wwElement.vue) | View switch (datagrid vs kanban) driven by the WeWeb view variable. Forwards `trigger-event`. |
| [ww-config.js](ww-config.js) | Adds `cardMoved` to `triggerEvents`. Documents the new `viewConfiguration.kanban` sub-key. |
| [src/shared/utils/sharedHelpers.js](src/shared/utils/sharedHelpers.js) | Adds `kanban*` translation keys for en/fr/es/de/pt. |

## Card-field rendering matrix

| `cellDataType` | Implementation |
|---|---|
| `select` | Mounts `SelectCellRenderer` with `options` / `optionsValueFormula` / `optionsLabelFormula` / `optionsColorFormula`. |
| `user` | Mounts `UserCellRenderer` with `users` / `userIdFormula` / `maxNumberOfUsers`. |
| `record` | Mounts `RecordCellRenderer` (read-only, edit/create UI hidden via CSS). Reuses module-level record cache so cards don't trigger N+1 fetches. |
| `dateString` | `createDateFormatter(col)` from `columnFactories.js`. |
| `dateTime` | `createDateFormatter(col)` (handles `dateFormat` + `timeFormat`). |
| `currency` | `createCurrencyFormatter(col)` (per-row currency, locale, EUR fallback). |
| `image` | `<img>` with `max-height: 36px`, `object-fit: contain`. |
| `text` / default | Plain text, single-line ellipsis (or 2-line clamp for the title). |
| `custom` | Mounts `WewebCellRenderer` with `containerId` (only when configured). |
| `action` | **Excluded** from the field-picker (no `field`, not data). |

## Component contract

### Inputs (`props.content`)
- All existing datagrid keys (columns, rowData, dataSource, supabaseTable, supabaseQuery, supabaseFilters, idFormula, baseConfig, lang, etc.) — reused as-is.
- `viewConfiguration.kanban`: `{ groupBy: string|null, cardFields: string[], order: string[], showUnassigned: boolean }`.
- `columnChooserVariableId`: same option as the datagrid; kanban uses it for its config panel.
- `supabaseIdField` (optional, defaults `'id'`): the column to filter on for `UPDATE`.
- `kanbanMaxRows` (optional, defaults `1000`): max rows fetched in supabase mode.

### Component variables (exposed)
- `currentConfig.kanban` (read-only): live snapshot of local kanban state — store this and bind back to `viewConfiguration` to persist.

### Events (`trigger-event`)
- `rowClicked` — on card click. Same payload shape as datagrid.
- `cardMoved` — on drag-between-columns. Payload: `{ row, id, columnId, oldValue, newValue, oldGroup, newGroup }`.
- `cellValueChanged` — also emitted on drag-between-columns. Payload matches the datagrid shape.

### Translations
All visible strings flow through `getTranslations(cfg.lang || 'en')`. Supported langs: en, fr, es, de, pt.

## Verification

- `node --check` on extracted `<script>` blocks: passes.
- `npm run build` (via `weweb build -- name=ag-grid-table type=wwobject`): passes — kanban classes, `cardMoved` event, `MAX_CARD_FIELDS`, and translation keys all bundled into `dist/manager.js`.

## Out of scope (future work)

- Per-group infinite-scroll cursor pagination (the kanban currently fetches one big slice up to `kanbanMaxRows`).
- Card edit-in-place (use the `rowClicked` event to wire your own editor).
- Multi-select / bulk move.
- WIP limits per group.
- Per-card conditional row styles.
- "Add card" button per column (use the existing `createRecord` action).
