<template>
  <!-- Presentational month calendar mirroring Calendar.vue: events placed by
       their date column (here `due`), draggable to another day. -->
  <div class="cal">
    <div class="cal__toolbar">
      <div class="cal__nav">
        <button type="button" class="cal__btn cal__btn--icon" @click="shiftMonth(-1)" aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="cal__btn cal__btn--today" @click="goToData">Jump to data</button>
        <button type="button" class="cal__btn cal__btn--icon" @click="shiftMonth(1)" aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div class="cal__title">{{ periodTitle }}</div>
      <div class="cal__legend">
        <span v-for="o in STATUS_OPTIONS" :key="o.value" class="cal__legend-item">
          <span class="cal__legend-dot" :style="{ background: o.color }" />{{ o.label }}
        </span>
      </div>
    </div>

    <div class="cal__weekdays">
      <div v-for="wd in weekdayLabels" :key="wd" class="cal__weekday">{{ wd }}</div>
    </div>

    <div class="cal__grid">
      <div
        v-for="(day, di) in monthDays"
        :key="di"
        class="cal__cell"
        :class="{
          'cal__cell--out': day.getMonth() !== anchor.getMonth(),
          'cal__cell--drop': dragOverKey === keyOf(day),
        }"
        @dragover.prevent="dragOverKey = keyOf(day)"
        @dragleave="dragOverKey === keyOf(day) && (dragOverKey = null)"
        @drop.prevent="onDrop(day)"
      >
        <div class="cal__date">{{ day.getDate() }}</div>
        <div class="cal__events">
          <div
            v-for="ev in eventsFor(day)"
            :key="ev.id"
            class="cal__event"
            :style="{ '--ev-color': statusOption(ev.status)?.color }"
            draggable="true"
            @dragstart="dragId = ev.id"
            @dragend="dragId = null"
            :title="ev.project"
          >
            <span class="cal__event-dot" />
            <span class="cal__event-label">{{ ev.project }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { STATUS_OPTIONS, statusOption } from '../mockData.js';
import { dataStore, patchRow } from '../store.js';

// Build a YYYY-MM-DD key in local time (avoids UTC off-by-one from toISOString).
function dayKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default {
  name: 'CalendarView',
  data() {
    return {
      STATUS_OPTIONS,
      weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      anchor: this.initialAnchor(),
      dragId: null,
      dragOverKey: null,
    };
  },
  computed: {
    periodTitle() {
      return this.anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    },
    // 6 weeks (42 cells) starting on the Monday on/before the 1st of the month.
    monthDays() {
      const first = new Date(this.anchor.getFullYear(), this.anchor.getMonth(), 1);
      const offset = (first.getDay() + 6) % 7; // Mon-first
      const start = new Date(first);
      start.setDate(first.getDate() - offset);
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    },
  },
  methods: {
    statusOption,
    keyOf: dayKey,
    initialAnchor() {
      // Anchor on the month holding the most events, so the demo opens full.
      const counts = {};
      for (const r of dataStore.rows) {
        const k = r.due.slice(0, 7);
        counts[k] = (counts[k] || 0) + 1;
      }
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const [y, m] = (top || '2026-07').split('-').map(Number);
      return new Date(y, m - 1, 1);
    },
    eventsFor(day) {
      const k = dayKey(day);
      return dataStore.rows.filter((r) => r.due === k);
    },
    shiftMonth(delta) {
      this.anchor = new Date(this.anchor.getFullYear(), this.anchor.getMonth() + delta, 1);
    },
    goToData() {
      this.anchor = this.initialAnchor();
    },
    onDrop(day) {
      this.dragOverKey = null;
      if (this.dragId == null) return;
      patchRow(this.dragId, { due: dayKey(day) });
      this.dragId = null;
    },
  },
};
</script>

<style scoped>
.cal { display: flex; flex-direction: column; height: 100%; }
.cal__toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.cal__nav { display: flex; align-items: center; gap: 6px; }
.cal__btn {
  border: 1px solid #ececec; background: #fff; color: #374151;
  border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;
}
.cal__btn--icon { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
.cal__btn--today { padding: 7px 12px; }
.cal__btn:hover { border-color: #4f46e5; color: #4f46e5; }
.cal__title { font-size: 16px; font-weight: 700; color: #1f2430; }
.cal__legend { margin-left: auto; display: flex; gap: 12px; flex-wrap: wrap; }
.cal__legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #6b7280; }
.cal__legend-dot { width: 8px; height: 8px; border-radius: 50%; }

.cal__weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 6px; }
.cal__weekday { font-size: 11.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; padding-left: 4px; }

.cal__grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 1fr; gap: 6px; flex: 1 1 auto; min-height: 460px; }
.cal__cell {
  background: #fff; border: 1px solid #ececec; border-radius: 9px; padding: 6px;
  display: flex; flex-direction: column; gap: 4px; overflow: hidden; transition: background .12s, border-color .12s;
}
.cal__cell--out { background: #fafafb; }
.cal__cell--out .cal__date { color: #c5cad3; }
.cal__cell--drop { background: #eef2ff; border-color: #c7d2fe; }
.cal__date { font-size: 12.5px; font-weight: 600; color: #6b7280; }
.cal__events { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.cal__event {
  display: flex; align-items: center; gap: 5px; cursor: grab;
  background: color-mix(in srgb, var(--ev-color) 12%, white);
  border-left: 3px solid var(--ev-color); border-radius: 5px;
  padding: 3px 6px; font-size: 11.5px; color: #374151;
}
.cal__event-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ev-color); flex: 0 0 auto; }
.cal__event-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
