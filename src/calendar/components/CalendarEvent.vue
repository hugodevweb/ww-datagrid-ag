<template>
  <div
    class="cal-event"
    :class="{ 'cal-event--compact': compact }"
    :style="color ? { '--event-color': color } : null"
    @click="$emit('chip-click')"
  >
    <!-- Compact (month / year cells): a coloured dot, optional time, title only. -->
    <template v-if="compact">
      <span v-if="color" class="cal-event__dot"></span>
      <span v-if="timeLabel" class="cal-event__time">{{ timeLabel }}</span>
      <span class="cal-event__compact-title" :title="titleText">{{ titleText }}</span>
    </template>

    <!-- Full (day / week / agenda): every selected field, first = title. -->
    <template v-else>
      <span v-if="timeLabel" class="cal-event__time cal-event__time--block">{{ timeLabel }}</span>
      <KanbanField
        v-for="(field, idx) in fields"
        :key="field.field"
        :column="field"
        :row="row"
        :resolve-mapping-formula="resolveMappingFormula"
        :is-title="idx === 0"
        :cell-font-family="cellFontFamily"
        :user-focus-color="userFocusColor"
      />
    </template>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import KanbanField from '../../kanban/components/KanbanField.vue';
import { createDateFormatter } from '../../datagrid/utils/columnFactories.js';

export default {
  name: 'CalendarEvent',
  components: { KanbanField: markRaw(KanbanField) },
  props: {
    // Ordered list of column configs. First entry is the title.
    fields: { type: Array, required: true },
    row: { type: Object, required: true },
    resolveMappingFormula: { type: Function, required: true },
    compact: { type: Boolean, default: false },
    color: { type: String, default: '' },
    timeLabel: { type: String, default: '' },
    cellFontFamily: { type: String, default: '' },
    userFocusColor: { type: String, default: '' },
  },
  
  emits: ['chip-click'],
  computed: {
    titleColumn() {
      return this.fields?.[0] || null;
    },
    // Plain-text rendering of the title field for the compact chip (where we
    // can't afford the full KanbanField renderer).
    titleText() {
      const col = this.titleColumn;
      if (!col?.field) return '';
      const v = this.row?.[col.field];
      if (v == null || v === '') return '';
      const type = col.cellDataType || 'text';
      if (type === 'dateString' || type === 'dateTime') {
        try { return createDateFormatter(col)(v); } catch (_) { return String(v); }
      }
      if (typeof v === 'object') {
        // select/user/record objects — fall back to a readable label if present.
        return v.label || v.name || v.title || '';
      }
      return String(v);
    },
  },
};
</script>

<style scoped>
.cal-event {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--ag-background-color, #ffffff);
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  border-left: 3px solid var(--event-color, var(--ww-data-grid_cc-accent-color, #3b82f6));
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  min-width: 0;
}
.cal-event:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Compact chip for month / year day cells: single line. */
.cal-event--compact {
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  box-shadow: none;
  background: color-mix(in srgb, var(--event-color, var(--ww-data-grid_cc-accent-color, #3b82f6)) 12%, transparent);
  font-size: 11px;
  line-height: 1.3;
}
.cal-event--compact:hover {
  box-shadow: none;
  background: color-mix(in srgb, var(--event-color, var(--ww-data-grid_cc-accent-color, #3b82f6)) 20%, transparent);
}

.cal-event__dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--event-color, var(--ww-data-grid_cc-accent-color, #3b82f6));
}

.cal-event__compact-title {
  flex: 1 1 auto;
  /* Without min-width:0 the flex item's automatic minimum is its content size,
     so a long title pushes the chip wider than its cell and the ellipsis never
     engages. Allow it to shrink. */
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ag-foreground-color, #1f2937);
  font-weight: 500;
}

.cal-event__time {
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 75%, transparent);
  flex: 0 0 auto;
}
.cal-event__time--block {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Mobile: slightly larger compact chips for touch legibility. The
   `.ww-calendar.is-mobile` ancestor lives on the host calendar root (outside
   this component) — under Vue's scoped CSS only the rightmost selector gets the
   scope attribute, so this still matches our chips. */
.ww-calendar.is-mobile .cal-event--compact {
  padding: 3px 7px;
  gap: 6px;
  font-size: 12px;
}
.ww-calendar.is-mobile .cal-event__time { font-size: 12px; }
/* No colour dot on mobile compact chips — the title carries the event. */
.ww-calendar.is-mobile .cal-event__dot { display: none; }
</style>
