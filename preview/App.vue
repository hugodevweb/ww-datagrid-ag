<template>
  <div class="preview-wrap">
    <header class="preview-head">
      <div class="preview-head__row">
        <div>
          <h1>Grid Engine — Live Preview</h1>
          <p>
            One dataset, three views. Switch tabs to explore the
            <strong>Grid</strong>, <strong>Kanban</strong> and <strong>Calendar</strong>.
            Everything is interactive and runs in your browser — no backend.
          </p>
        </div>
        <!-- Same role as the WeWeb "View Option" switcher: writes the view type
             that the wrapper below reads (mirrors tablesSettings.type). -->
        <ViewTabs :active="view" @change="setView" />
      </div>
    </header>

    <div class="preview-stage">
      <!-- Mirrors wwElement.vue: pick the view component from the view type. -->
      <KanbanView v-if="view === 'kanban'" />
      <CalendarView v-else-if="view === 'calendar'" />
      <RelatedListView v-else-if="view === 'related'" />
      <GridView v-else />
    </div>

    <footer class="preview-foot">
      <span>
        Real cell renderers (<code>UserCellRenderer</code>, <code>SelectCellRenderer</code>,
        <code>RecordCellRenderer</code>) on the grid · mock data · no backend.
      </span>
      <button type="button" class="preview-reset" @click="onReset">Reset data</button>
    </footer>
  </div>
</template>

<script>
import ViewTabs from './components/ViewTabs.vue';
import GridView from './components/GridView.vue';
import KanbanView from './components/KanbanView.vue';
import CalendarView from './components/CalendarView.vue';
import RelatedListView from './components/RelatedListView.vue';
import { viewStore, setView, resetRows } from './store.js';

export default {
  name: 'App',
  components: { ViewTabs, GridView, KanbanView, CalendarView, RelatedListView },
  computed: {
    view() {
      return viewStore.type;
    },
  },
  methods: {
    setView,
    onReset() {
      resetRows();
      // Force the active view to remount so it re-reads the fresh rows.
      const current = viewStore.type;
      viewStore.type = '__reset__';
      this.$nextTick(() => { viewStore.type = current; });
    },
  },
};
</script>

<style>
.preview-wrap { max-width: 1180px; margin: 0 auto; padding: 24px; }
.preview-head__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.preview-head h1 { font-size: 20px; margin: 0 0 4px; }
.preview-head p { margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.5; max-width: 620px; }
.preview-stage { min-height: 560px; }
.preview-foot {
  margin-top: 14px; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; color: #6b7280; font-size: 12.5px; flex-wrap: wrap;
}
.preview-reset {
  border: 1px solid #ececec; background: #fff; color: #374151;
  padding: 6px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.preview-reset:hover { border-color: #4f46e5; color: #4f46e5; }
code { background: #eef0f3; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
</style>
