<template>
  <div class="grid-view">
    <div class="grid-toolbar">
      <input
        type="search"
        class="grid-search"
        placeholder="Quick search…"
        aria-label="Quick search"
        @input="onSearch"
      />
      <span class="grid-count">{{ countLabel }}</span>
    </div>

    <div ref="gridEl" class="grid-view__grid"></div>
  </div>
</template>

<script>
// NOTE ON RENDERERS
// The production datagrid uses Vue SFC cell renderers (UserCellRenderer,
// SelectCellRenderer, RecordCellRenderer) mounted through ag-grid-vue3. That
// framework wrapper does not instantiate custom components when the grid runs
// standalone in this Vite preview (the renderers silently produce empty cells,
// with no error — core text rendering still works). Rather than fight that
// integration, the preview drives AG Grid through its vanilla `createGrid` API
// with plain JS renderers that reproduce the SAME column-type visuals (avatars,
// status/priority pills, linked-record chips, image, boolean). Same look, fully
// offline, and robust against the component-wrapping issue.
import { createGrid, themeQuartz } from 'ag-grid-community';
import { getDefaultAvatarFor, getUserName } from '@/shared/utils/avatarUtils.js';
import {
  USERS, STATUS_OPTIONS, PRIORITY_OPTIONS,
  statusOption, priorityOption, userById, companyById,
} from '../mockData.js';
import { dataStore, patchRow } from '../store.js';

const userName = (id) => getUserName(userById(id));

// --- JS cell renderers (the "custom column types") ---------------------------
// AG Grid v34 ignores plain-function cellRenderers — a renderer must be a
// COMPONENT CLASS with init(params)/getGui(). Each class below builds the same
// visuals the production SFC renderers show (avatars, pills, record chips…).
// Mock data is trusted, so innerHTML interpolation is safe here.
function makeRenderer(html) {
  return class {
    init(p) { this.e = document.createElement('div'); this.e.style.height = '100%'; this.e.innerHTML = html(p); }
    getGui() { return this.e; }
    refresh() { return false; }
  };
}

const ImageRenderer = makeRenderer((p) => `<img class="gv-cover" alt="" src="${p.value || ''}" />`);

const UsersRenderer = makeRenderer((p) => {
  const ids = Array.isArray(p.value) ? p.value : [];
  const avatars = ids.slice(0, 4).map((id) => {
    const n = userName(id);
    return `<img class="gv-avatar" alt="" title="${n}" src="${getDefaultAvatarFor(n)}" />`;
  }).join('');
  const more = ids.length > 4 ? `<span class="gv-more">+${ids.length - 4}</span>` : '';
  return `<div class="gv-users">${avatars}${more}</div>`;
});

// Pill renderer reads its option lookup from cellRendererParams.lookup.
const PillRenderer = makeRenderer((p) => {
  const opt = p.lookup ? p.lookup(p.value) : null;
  if (!opt) return '';
  return `<span class="gv-pill" style="background:${opt.color}1f;color:${opt.color}">${opt.label}</span>`;
});

const RecordRenderer = makeRenderer((p) => {
  const c = companyById(p.value);
  if (!c) return '';
  return `<span class="gv-record"><span class="gv-record__name">${c.name}</span>` +
    `<span class="gv-record__ctx">${c.industry}</span></span>`;
});

const BooleanRenderer = makeRenderer((p) =>
  `<span class="gv-bool ${p.value ? 'gv-bool--yes' : 'gv-bool--no'}">` +
  `${p.value ? '✓ Billable' : '— Internal'}</span>`);

const ProgressRenderer = makeRenderer((p) => {
  const v = Math.max(0, Math.min(100, Number(p.value) || 0));
  return `<div class="gv-progress"><span class="gv-progress__track">` +
    `<span class="gv-progress__bar" style="width:${v}%"></span></span>` +
    `<span class="gv-progress__label">${v}%</span></div>`;
});

export default {
  name: 'GridView',
  data() {
    return { countLabel: '' };
  },
  mounted() {
    this.build();
  },
  beforeUnmount() {
    this.gridApi?.destroy();
  },
  methods: {
    build() {
    const statusValues = STATUS_OPTIONS.map((o) => o.value);
    const priorityValues = PRIORITY_OPTIONS.map((o) => o.value);

    this.gridApi = createGrid(this.$refs.gridEl, {
      theme: themeQuartz.withParams({
        accentColor: '#4f46e5',
        headerBackgroundColor: '#fafafb',
        headerTextColor: '#374151',
        headerFontWeight: 600,
        borderColor: '#ececec',
        wrapperBorderRadius: 10,
        rowHoverColor: '#f7f8fa',
        fontSize: 14,
      }),
      rowData: dataStore.rows.map((r) => ({ ...r })),
      getRowId: (p) => String(p.data.id),
      rowHeight: 48,
      animateRows: true,
      rowSelection: { mode: 'multiRow', checkboxes: true, headerCheckbox: true },
      defaultColDef: { sortable: true, filter: true, resizable: true, cellDataType: false },
      components: { ImageRenderer, UsersRenderer, PillRenderer, RecordRenderer, BooleanRenderer, ProgressRenderer },
      onModelUpdated: this.updateCount,
      onSelectionChanged: this.updateCount,
      onCellValueChanged: (e) => patchRow(e.data.id, { [e.colDef.field]: e.data[e.colDef.field] }),
      columnDefs: [
        { field: 'cover', headerName: '', width: 64, cellRenderer: 'ImageRenderer', sortable: false, filter: false, resizable: false },
        { field: 'project', headerName: 'Project', flex: 1.6, minWidth: 170, editable: true },
        { field: 'assignees', headerName: 'Assignees', width: 150, cellRenderer: 'UsersRenderer', sortable: false, filter: false,
          valueFormatter: (p) => (p.value || []).map(userName).join(', ') },
        { field: 'status', headerName: 'Status', width: 150, editable: true,
          cellRenderer: 'PillRenderer', cellRendererParams: { lookup: statusOption },
          cellEditor: 'agSelectCellEditor', cellEditorParams: { values: statusValues },
          valueFormatter: (p) => statusOption(p.value)?.label ?? '' },
        { field: 'priority', headerName: 'Priority', width: 140, editable: true,
          cellRenderer: 'PillRenderer', cellRendererParams: { lookup: priorityOption },
          cellEditor: 'agSelectCellEditor', cellEditorParams: { values: priorityValues },
          valueFormatter: (p) => priorityOption(p.value)?.label ?? '' },
        { field: 'company_id', headerName: 'Company', flex: 1.2, minWidth: 180, cellRenderer: 'RecordRenderer', filter: false, sortable: false },
        { field: 'progress', headerName: 'Progress', width: 150, editable: true, filter: 'agNumberColumnFilter',
          cellRenderer: 'ProgressRenderer',
          valueParser: (p) => Math.max(0, Math.min(100, Number(p.newValue) || 0)) },
        { field: 'budget', headerName: 'Budget', width: 130, editable: true, filter: 'agNumberColumnFilter',
          valueParser: (p) => Number(String(p.newValue).replace(/[^0-9.]/g, '')) || 0,
          valueFormatter: (p) => (p.value == null ? '' : '$' + Number(p.value).toLocaleString()) },
        { field: 'billable', headerName: 'Billable', width: 130, editable: true, cellRenderer: 'BooleanRenderer',
          cellEditor: 'agSelectCellEditor', cellEditorParams: { values: [true, false] } },
        { field: 'due', headerName: 'Due date', width: 130, editable: true, filter: 'agDateColumnFilter' },
      ],
    });
    },
    onSearch(e) {
      this.gridApi?.setGridOption('quickFilterText', e.target.value);
    },
    updateCount() {
      if (!this.gridApi) return;
      const total = this.gridApi.getDisplayedRowCount();
      const selected = this.gridApi.getSelectedRows().length;
      this.countLabel = selected > 0 ? `${selected} selected · ${total} shown` : `${total} rows`;
    },
  },
};
</script>

<style>
.grid-view { display: flex; flex-direction: column; height: 100%; }
.grid-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.grid-search {
  flex: 1 1 240px; max-width: 320px;
  padding: 8px 12px; border: 1px solid #ececec; border-radius: 8px;
  font-size: 14px; outline: none; background: #fff;
}
.grid-search:focus { border-color: #4f46e5; }
.grid-count { margin-left: auto; color: #6b7280; font-size: 13px; }
.grid-view__grid { width: 100%; flex: 1 1 auto; min-height: 480px; }

/* Cell-type visuals (match the real renderers' look) */
.gv-cover { width: 28px; height: 28px; border-radius: 7px; display: block; margin-top: 10px; }

.gv-users { display: flex; align-items: center; height: 100%; }
.gv-avatar { width: 26px; height: 26px; border-radius: 50%; margin-left: -7px; border: 2px solid #fff; }
.gv-avatar:first-child { margin-left: 0; }
.gv-more { margin-left: 4px; font-size: 12px; font-weight: 600; color: #6b7280; }

.gv-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }

.gv-record { display: inline-flex; flex-direction: column; line-height: 1.25; }
.gv-record__name { font-size: 13.5px; font-weight: 600; color: #1f2430; }
.gv-record__ctx { font-size: 11.5px; color: #9ca3af; }

.gv-bool { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.gv-bool--yes { background: #ecfdf5; color: #047857; }
.gv-bool--no  { background: #f3f4f6; color: #6b7280; }

.gv-progress { display: flex; align-items: center; gap: 8px; height: 100%; }
.gv-progress__track { flex: 1 1 auto; height: 6px; background: #eef0f3; border-radius: 999px; overflow: hidden; }
.gv-progress__bar { display: block; height: 100%; background: #4f46e5; border-radius: 999px; }
.gv-progress__label { font-size: 12px; color: #6b7280; font-variant-numeric: tabular-nums; }
</style>
