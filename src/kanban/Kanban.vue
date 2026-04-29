<template>
  <div class="kanban-placeholder">Kanban view (TODO)</div>
</template>

<script>
export default {
  name: 'Kanban',
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
};
</script>

<style scoped>
.kanban-placeholder {
  padding: 24px;
  opacity: 0.6;
}
</style>
