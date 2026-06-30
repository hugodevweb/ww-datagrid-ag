<template>
  <Kanban
    v-if="viewType === 'kanban'"
    ref="view"
    :content="content"
    :uid="uid"
    :wwEditorState="wwEditorState"
    @trigger-event="(e) => $emit('trigger-event', e)"
  />
  <Calendar
    v-else-if="viewType === 'calendar'"
    ref="view"
    :content="content"
    :uid="uid"
    :wwEditorState="wwEditorState"
    @trigger-event="(e) => $emit('trigger-event', e)"
  />
  <!-- Related list: a lighter, per-instance, standalone view. It reuses the full
       Datagrid engine (all features intact) fed a normalized content (parent
       filter injected, shared saved-view neutralised) plus a thin header bar.
       Selected per instance via content.viewMode === 'related', independent of
       the global tablesSettings.type toggle the other views use. -->
  <div v-else-if="viewType === 'related'" class="ww-related-list">
    <RelatedListHeader
      v-if="content.showHeader !== false"
      :title="content.headerTitle || ''"
      :count="recordCount"
      :show-count="content.showRecordCount !== false"
      :show-add-button="content.showAddButton !== false"
      :add-button-label="content.addButtonLabel || 'Add'"
      @add="onAddNew"
    />
    <Datagrid
      ref="view"
      :content="normalizedContent"
      :uid="uid"
      :wwEditorState="wwEditorState"
      @trigger-event="onGridTriggerEvent"
      @update:content="(e) => $emit('update:content', e)"
      @update:content:effect="(e) => $emit('update:content:effect', e)"
    />
  </div>
  <Datagrid
    v-else
    ref="view"
    :content="content"
    :uid="uid"
    :wwEditorState="wwEditorState"
    @trigger-event="(e) => $emit('trigger-event', e)"
    @update:content="(e) => $emit('update:content', e)"
    @update:content:effect="(e) => $emit('update:content:effect', e)"
  />
</template>

<script>
import Datagrid from './datagrid/Datagrid.vue';
import Kanban from './kanban/Kanban.vue';
import Calendar from './calendar/Calendar.vue';
import RelatedListHeader from './relatedlist/RelatedListHeader.vue';
import { getVarByName } from './shared/utils/wwVariables.js';

const VIEW_VARIABLE_NAME = 'tablesSettings';

// Methods exposed to the WeWeb runtime. Must stay in sync with ww-config.js
// (every entry in actions[] plus every triggerEvents[].testEvent getter).
const FORWARDED_METHODS = [
  // actions
  'resetFilters',
  'createRecord',
  'closeCreateRecordForm',
  'resetSort',
  'openColumnChooser',
  'selectAll',
  'deselectAll',
  'selectRow',
  'deselectRow',
  'refreshData',
  'setCellValue',
  'triggerCellValueChanged',
  'stopCellEditing',
  'refreshRow',
  'removeRow',
  'generateColumns',
  // editor-time test-event getters
  'getOnActionTestEvent',
  'getOnCellValueChangedTestEvent',
  'getSelectionTestEvent',
  'getRowClickedTestEvent',
  'getRowDraggedTestEvent',
  'getRowDragStartTestEvent',
  'getColumnMovedTestEvent',
  'getColumnResizedTestEvent',
  'getCellEditStartTestEvent',
  'getCellEditEndTestEvent',
  'getScrollTestEvent',
];

export default {
  components: { Datagrid, Kanban, Calendar, RelatedListHeader },
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['trigger-event', 'update:content', 'update:content:effect'],
  data() {
    return {
      // Loaded/total record count shown in the related-list header. null hides
      // the count badge until the first data resolves.
      recordCount: null,
    };
  },
  computed: {
    viewType() {
      // A per-instance "related list" wins over the global view toggle so that
      // multiple related lists can coexist on a page (each bound to its own
      // parent record) regardless of the shared tablesSettings.type.
      if (this.content?.viewMode === 'related') return 'related';
      try {
        const v = getVarByName(VIEW_VARIABLE_NAME);
        return v?.type ?? 'grid';
      } catch (_) {
        return 'grid';
      }
    },
    // Content handed to the inner Datagrid in related mode. Only diverges from the
    // raw content for related lists; every other view passes content through.
    normalizedContent() {
      const c = this.content;
      if (!c || c.viewMode !== 'related') return c;
      // Parent filter → a Supabase `eq` manual filter, appended so any user
      // manual filters still compose. Datagrid reads content.supabaseFilters →
      // applyManualFilters (useDataFetch.js). Empty when not configured.
      const hasParent =
        c.relatedForeignKey && c.relatedParentId != null && c.relatedParentId !== '';
      const parentFilter = hasParent
        ? [{ field: c.relatedForeignKey, operator: 'eq', value: c.relatedParentId }]
        : [];
      return {
        ...c, // keep columns / containerId / dropzones intact
        supabaseFilters: [
          ...(Array.isArray(c.supabaseFilters) ? c.supabaseFilters : []),
          ...parentFilter,
        ],
        // Standalone: never write the page-shared saved-view "edited" flag.
        viewEditedVariableId: undefined,
      };
    },
  },
  watch: {
    // Refresh the header count whenever the data context changes (parent id,
    // table, query, filters, local rowData…).
    normalizedContent: {
      handler() {
        this.scheduleRecordCountRefresh();
      },
      deep: true,
    },
  },
  mounted() {
    if (this.viewType === 'related') this.scheduleRecordCountRefresh();
  },
  methods: {
    ...Object.fromEntries(
      FORWARDED_METHODS.map((name) => [
        name,
        function (...args) {
          return this.$refs.view?.[name]?.(...args);
        },
      ])
    ),
    // Header "Add" → component trigger event, carrying the parent context so the
    // workflow can scope the create form to the parent record.
    onAddNew() {
      this.$emit('trigger-event', {
        name: 'onAddNew',
        event: {
          parentId: this.content?.relatedParentId ?? '',
          relatedForeignKey: this.content?.relatedForeignKey ?? '',
        },
      });
    },
    // Re-emit the grid's events unchanged, and opportunistically refresh the
    // header count (the grid emits no dedicated "data loaded" event upstream).
    onGridTriggerEvent(e) {
      this.$emit('trigger-event', e);
      this.refreshRecordCount();
    },
    refreshRecordCount() {
      const g = this.$refs.view;
      if (!g) return;
      // Prefer the Supabase server-side total when available, else the rendered
      // row count (also covers local 'mapping' mode).
      const total = g.supabaseTotalCountRef;
      if (typeof total === 'number' && total > 0) {
        this.recordCount = total;
        return;
      }
      const rows = g.rowData;
      this.recordCount = Array.isArray(rows) ? rows.length : null;
    },
    // The grid loads Supabase data asynchronously after mount with no upstream
    // "loaded" event, so sample a few times after a change to catch the first
    // paint. Bounded (4 timers), not a polling loop.
    scheduleRecordCountRefresh() {
      [0, 150, 400, 900].forEach((ms) =>
        setTimeout(() => this.refreshRecordCount(), ms)
      );
    },
  },
};
</script>

<style scoped>
.ww-related-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
