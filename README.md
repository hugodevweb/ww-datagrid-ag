# AG Grid Table Component

A powerful data grid component using ag-grid-vue3 that provides enterprise-grade table functionality.

## Simplified mode

The element has a per-instance **View Mode** switch (`viewMode`):

- **Standard (full config)** — the default; exposes the complete configuration.
- **Simplified** — renders the same grid with all features intact at runtime, but the editor hides advanced/long-tail settings (grouping, kanban/calendar, infinite scroll, column chooser, advanced filter builder, view-state variables, editing/performance/localization knobs, and most styling sections). The panel is reduced to the essentials: **Mode → Data Source → Search → Columns → Pagination → Selection**, plus a small Style section.

Use Simplified for a cleaner, easier-to-configure grid without losing any runtime capability. It changes only the editor panel, not behavior — switching back to Standard restores every knob (the values still apply while hidden).
