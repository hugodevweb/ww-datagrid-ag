# AG Grid Table Component

A powerful data grid component using ag-grid-vue3 that provides enterprise-grade table functionality.

## Related List mode

The same element can render as a lighter **related list** — a compact, standalone list of child records (Salesforce-style) shown on a record page, e.g. "Contacts where `account_id` = the current account".

It is the *same grid engine* (all features stay available at runtime); only the editor configuration is simplified.

- Set **View Mode → Related List (simplified)** on the element. This is a per-instance switch (property `viewMode: 'related'`), independent of the global Grid/Kanban/Calendar view toggle, so multiple related lists can live on one page, each bound to a different parent record.
- **Data source:**
  - *Supabase* — set **Parent Foreign Key** (`relatedForeignKey`, the FK column on the child table) and bind **Parent Id** (`relatedParentId`, usually the current page's record id). Internally this is applied as a Supabase filter `WHERE <relatedForeignKey> = <relatedParentId>` (appended to any manual filters), and the list refetches when the parent id changes.
  - *Local* — bind a pre-filtered array to **Data** (`rowData`) as usual.
- **Header bar** — optional `showHeader` with `headerTitle`, a record count (`showRecordCount`), and an Add button (`showAddButton` / `addButtonLabel`) that fires the **On Add New** (`onAddNew`) event with `{ parentId, relatedForeignKey }`.
- **Open a record** — wire the existing **On Row Clicked** (`rowClicked`) or **On Navigate** (`navigate`) event.

In related mode the editor hides advanced/long-tail settings (grouping, kanban/calendar, infinite scroll, column chooser, advanced filter builder, view-state variables, and most styling sections), leaving a curated panel: **Mode → Related List → Data Source → Search → Columns → Pagination → Selection** (plus a small Style section). Standalone view state: related lists do not inherit the page's shared saved-view configuration.

### Local preview

`preview/` is a standalone Vite harness (port 5180) of the views. The **Related** tab demonstrates the related-list header + a parent-filtered child list. Run it with `npx vite --config preview/vite.config.js` (requires `npm install` first).
