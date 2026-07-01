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
  components: { Datagrid, Kanban, Calendar },
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['trigger-event', 'update:content', 'update:content:effect'],
  computed: {
    viewType() {
      try {
        const v = getVarByName(VIEW_VARIABLE_NAME);
        return v?.type ?? 'grid';
      } catch (_) {
        return 'grid';
      }
    },
  },
  methods: Object.fromEntries(
    FORWARDED_METHODS.map((name) => [
      name,
      function (...args) {
        return this.$refs.view?.[name]?.(...args);
      },
    ])
  ),
};
</script>
