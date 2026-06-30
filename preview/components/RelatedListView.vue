<template>
  <div class="rel-view">
    <!-- Simulates the parent record context: in the real app `relatedParentId`
         is bound to the current page's record id. Switching parent re-filters
         the child list (the preview analog of the Supabase parent `eq` filter
         + the refetch-on-filter-change wired in Datagrid.vue). -->
    <div class="rel-parentbar">
      <span class="rel-parentbar__label">Parent record</span>
      <select v-model="parentId" class="rel-parentbar__select" aria-label="Parent company">
        <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <input
        type="search"
        class="rel-parentbar__search"
        placeholder="Search…"
        aria-label="Search related records"
        @input="onSearch"
      />
    </div>

    <!-- The REAL component under test. -->
    <RelatedListHeader
      :title="headerTitle"
      :count="recordCount"
      :show-count="true"
      :show-add-button="true"
      add-button-label="Add project"
      @add="onAddNew"
    />

    <div ref="gridEl" class="rel-view__grid"></div>

    <p class="rel-log" aria-live="polite">{{ log }}</p>
  </div>
</template>

<script>
// Related-list preview. Mirrors the production preview's choice to drive AG Grid
// through the vanilla createGrid API (the ag-grid-vue3 wrapper + wwLib-coupled
// Datagrid don't run standalone here — see GridView.vue). What this verifies for
// real: the RelatedListHeader component (title, count badge, Add button + event),
// parent-filter-driven row list + count, row click, and search. The full
// wwElement → normalizedContent → Datagrid path is validated by the WeWeb editor.
import { createGrid, themeQuartz } from 'ag-grid-community';
import RelatedListHeader from '@/relatedlist/RelatedListHeader.vue';
import { COMPANIES, statusOption, priorityOption } from '../mockData.js';
import { dataStore } from '../store.js';

export default {
  name: 'RelatedListView',
  components: { RelatedListHeader },
  data() {
    return {
      companies: COMPANIES,
      parentId: COMPANIES[0].id,
      recordCount: null,
      log: '',
    };
  },
  computed: {
    company() {
      return this.companies.find((c) => c.id === this.parentId);
    },
    headerTitle() {
      return this.company ? `${this.company.name} · Projects` : 'Projects';
    },
    // The preview analog of the related-list parent filter:
    // WHERE company_id = relatedParentId.
    relatedRows() {
      return dataStore.rows.filter((r) => r.company_id === this.parentId);
    },
  },
  watch: {
    // Parent change → re-filter + refresh count (the preview analog of the
    // refetch-on-parent-id-change behaviour now wired into Datagrid.vue).
    parentId() {
      this.applyRows();
    },
  },
  mounted() {
    this.build();
  },
  beforeUnmount() {
    this.gridApi?.destroy();
  },
  methods: {
    build() {
      this.gridApi = createGrid(this.$refs.gridEl, {
        theme: themeQuartz.withParams({
          accentColor: '#2563eb',
          headerBackgroundColor: '#fafafb',
          headerTextColor: '#374151',
          headerFontWeight: 600,
          borderColor: '#ececec',
          wrapperBorderRadius: 10,
          rowHoverColor: '#f7f8fa',
          fontSize: 14,
        }),
        rowData: this.relatedRows.map((r) => ({ ...r })),
        getRowId: (p) => String(p.data.id),
        rowHeight: 44,
        animateRows: true,
        rowSelection: { mode: 'singleRow', checkboxes: false },
        defaultColDef: { sortable: true, filter: true, resizable: true, cellDataType: false },
        onModelUpdated: this.updateCount,
        onRowClicked: (e) => {
          this.log = `Row clicked → open record: "${e.data.project}" (id ${e.data.id})`;
        },
        columnDefs: [
          { field: 'project', headerName: 'Project', flex: 1.6, minWidth: 180 },
          { field: 'status', headerName: 'Status', width: 130,
            valueFormatter: (p) => statusOption(p.value)?.label ?? p.value },
          { field: 'priority', headerName: 'Priority', width: 120,
            valueFormatter: (p) => priorityOption(p.value)?.label ?? p.value },
          { field: 'progress', headerName: 'Progress', width: 120, filter: 'agNumberColumnFilter',
            valueFormatter: (p) => (p.value == null ? '' : `${p.value}%`) },
          { field: 'budget', headerName: 'Budget', width: 130, filter: 'agNumberColumnFilter',
            valueFormatter: (p) => (p.value == null ? '' : '$' + Number(p.value).toLocaleString()) },
          { field: 'due', headerName: 'Due date', width: 130, filter: 'agDateColumnFilter' },
        ],
      });
    },
    applyRows() {
      this.gridApi?.setGridOption('rowData', this.relatedRows.map((r) => ({ ...r })));
      this.updateCount();
    },
    updateCount() {
      this.recordCount = this.gridApi ? this.gridApi.getDisplayedRowCount() : null;
    },
    onSearch(e) {
      this.gridApi?.setGridOption('quickFilterText', e.target.value);
    },
    onAddNew() {
      // In the real component this fires the `onAddNew` trigger event carrying
      // { parentId, relatedForeignKey } so a workflow can open a scoped create form.
      this.log = `Add New → onAddNew event { relatedForeignKey: "company_id", parentId: "${this.parentId}" }`;
    },
  },
};
</script>

<style scoped>
.rel-view { display: flex; flex-direction: column; height: 100%; }

.rel-parentbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}
.rel-parentbar__label { font-size: 12px; font-weight: 600; color: #6b7280; }
.rel-parentbar__select {
  padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 7px;
  font-size: 13px; background: #fff; color: #1f2430; cursor: pointer;
}
.rel-parentbar__search {
  margin-left: auto; flex: 0 1 220px;
  padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 7px;
  font-size: 13px; outline: none; background: #fff;
}
.rel-parentbar__search:focus { border-color: #2563eb; }

.rel-view__grid { width: 100%; flex: 1 1 auto; min-height: 360px; }

.rel-log { margin: 10px 2px 0; min-height: 18px; color: #2563eb; font-size: 12.5px; font-weight: 600; }
</style>
