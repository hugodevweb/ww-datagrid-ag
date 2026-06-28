// Shared reactive state for the standalone preview.
//
// `viewStore` mirrors the WeWeb `tablesSettings` variable that drives the real
// component: in production `wwElement.vue` reads
//   wwLib.wwVariable.getValue('23742aed-…').type   →  'grid' | 'kanban' | 'calendar'
// Here that same shape is just a local reactive object the ViewTabs writes to.
//
// `dataStore.rows` is a single shared working copy of the mock rows. All three
// views read and mutate it, so an edit in the grid, a card dragged on the
// kanban or an event moved on the calendar are all visible when you switch tabs.
import { reactive } from 'vue';
import { ROWS } from './mockData.js';

const clone = () => ROWS.map((r) => ({ ...r }));

export const viewStore = reactive({ type: 'grid' });

export const dataStore = reactive({ rows: clone() });

export function setView(type) {
  viewStore.type = type;
}

export function resetRows() {
  dataStore.rows = clone();
}

// Patch one row (by id) in place — used by every view's edit/drag handlers.
export function patchRow(id, patch) {
  const row = dataStore.rows.find((r) => String(r.id) === String(id));
  if (row) Object.assign(row, patch);
}
