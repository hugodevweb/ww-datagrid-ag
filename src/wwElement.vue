<template>
  <Datagrid
    v-if="viewType !== 'kanban'"
    ref="view"
    :content="content"
    :uid="uid"
    :wwEditorState="wwEditorState"
    @trigger-event="(e) => $emit('trigger-event', e)"
    @update:content="(e) => $emit('update:content', e)"
    @update:content:effect="(e) => $emit('update:content:effect', e)"
  />
  <Kanban
    v-else
    ref="view"
    :content="content"
    :uid="uid"
    :wwEditorState="wwEditorState"
    @trigger-event="(e) => $emit('trigger-event', e)"
  />
</template>

<script>
import Datagrid from './datagrid/Datagrid.vue';
import Kanban from './kanban/Kanban.vue';

const VIEW_VARIABLE_ID = '23742aed-c957-4a20-b9ac-df6642c96015';

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
  components: { Datagrid, Kanban },
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
        const v = wwLib.wwVariable.getValue(VIEW_VARIABLE_ID);
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
