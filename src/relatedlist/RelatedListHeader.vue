<template>
  <div class="ww-related-header">
    <div class="ww-related-header__title-block">
      <span v-if="title" class="ww-related-header__title">{{ title }}</span>
      <span
        v-if="showCount && count !== null && count !== undefined"
        class="ww-related-header__count"
        >{{ count }}</span
      >
    </div>
    <button
      v-if="showAddButton"
      type="button"
      class="ww-related-header__add"
      @click="$emit('add')"
    >
      <svg
        class="ww-related-header__add-icon"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7 2.5v9M2.5 7h9"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <span v-if="addButtonLabel">{{ addButtonLabel }}</span>
    </button>
  </div>
</template>

<script>
// Presentational header bar for the "related list" view. It owns no data and no
// WeWeb component variables — wwElement.vue feeds it the title/count and turns
// its `add` event into the component's `onAddNew` trigger event.
export default {
  name: "RelatedListHeader",
  props: {
    title: { type: String, default: "" },
    // null/undefined hides the count even when showCount is true (e.g. before the
    // first fetch resolves).
    count: { type: [Number, String], default: null },
    showCount: { type: Boolean, default: true },
    showAddButton: { type: Boolean, default: true },
    addButtonLabel: { type: String, default: "Add" },
  },
  emits: ["add"],
};
</script>

<style scoped>
.ww-related-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 4px;
  font-family: inherit;
}

.ww-related-header__title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ww-related-header__title {
  font-size: 15px;
  font-weight: 600;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ww-related-header__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--ww-related-header_count-bg, rgba(100, 116, 139, 0.16));
  color: var(--ww-related-header_count-color, #475569);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.ww-related-header__add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--ww-related-header_add-border, #e2e8f0);
  border-radius: 8px;
  background: var(--ww-related-header_add-bg, #2563eb);
  color: var(--ww-related-header_add-color, #ffffff);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.12s ease, background 0.12s ease;
}

.ww-related-header__add:hover {
  filter: brightness(0.95);
}

.ww-related-header__add:active {
  filter: brightness(0.9);
}

.ww-related-header__add-icon {
  flex: 0 0 auto;
}
</style>
