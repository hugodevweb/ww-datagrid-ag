<template>
  <div class="fb">
    <!-- Combinator -->
    <div class="fb-combinator" v-if="conditions.length > 1">
      <span class="fb-combinator-label">Correspond à</span>
      <div class="fb-segmented">
        <button
          type="button"
          class="fb-seg"
          :class="{ 'fb-seg--active': combinator === 'and' }"
          @click="setCombinator('and')"
        >Tous</button>
        <button
          type="button"
          class="fb-seg"
          :class="{ 'fb-seg--active': combinator === 'or' }"
          @click="setCombinator('or')"
        >Au moins un</button>
      </div>
      <span class="fb-combinator-hint">des filtres</span>
    </div>

    <!-- Conditions -->
    <div class="fb-list">
      <div v-for="(cond, i) in conditions" :key="i" class="fb-condition">
      <div class="fb-row">
        <!-- Field -->
        <select class="fb-input fb-field" :value="cond.field" @change="onFieldChange(i, $event.target.value)">
          <option v-for="opt in fieldOptions" :key="opt.field" :value="opt.field">{{ opt.headerName }}</option>
        </select>

        <!-- Operator -->
        <select class="fb-input fb-operator" :value="cond.operator" @change="onOperatorChange(i, $event.target.value)">
          <option v-for="op in operatorsFor(cond.type)" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>

        <!-- Value -->
        <template v-if="inputKind(cond) === 'text'">
          <input v-if="!isPlaceholderToken(cond.value)" class="fb-input fb-value" type="text" :value="cond.value" placeholder="Valeur"
            @input="updateValue(i, $event.target.value)" />
          <span v-else class="fb-input fb-value fb-token">
            <span class="fb-token-glyph" v-html="glyphHtml(cond.value)"></span>{{ displayName(cond.value) }}
            <button type="button" class="fb-token-x" @click="updateValue(i, '')" aria-label="Clear">×</button>
          </span>
          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateValue(i, $event)" />
        </template>

        <template v-else-if="inputKind(cond) === 'number'">
          <input v-if="!isPlaceholderToken(cond.value)" class="fb-input fb-value" type="number" :value="cond.value" placeholder="Valeur"
            @input="updateValue(i, $event.target.value)" />
          <span v-else class="fb-input fb-value fb-token">
            <span class="fb-token-glyph" v-html="glyphHtml(cond.value)"></span>{{ displayName(cond.value) }}
            <button type="button" class="fb-token-x" @click="updateValue(i, '')" aria-label="Clear">×</button>
          </span>
          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateValue(i, $event)" />
        </template>

        <template v-else-if="inputKind(cond) === 'range-number'">
          <input class="fb-input fb-value-half" type="number" :value="cond.value" placeholder="De"
            @input="updateValue(i, $event.target.value)" />
          <input class="fb-input fb-value-half" type="number" :value="cond.valueTo" placeholder="À"
            @input="updateValueTo(i, $event.target.value)" />
        </template>

        <template v-else-if="inputKind(cond) === 'date'">
          <input v-if="!isPlaceholderToken(cond.value)" class="fb-input fb-value" type="date" :value="cond.value"
            @input="updateValue(i, $event.target.value)" />
          <span v-else class="fb-input fb-value fb-token">
            <span class="fb-token-glyph" v-html="glyphHtml(cond.value)"></span>{{ displayName(cond.value) }}
            <button type="button" class="fb-token-x" @click="updateValue(i, '')" aria-label="Clear">×</button>
          </span>
          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateValue(i, $event)" />
          <DatePlaceholderMenu @select="updateValue(i, $event)" />
        </template>

        <template v-else-if="inputKind(cond) === 'range-date'">
          <input v-if="!isPlaceholderToken(cond.value)" class="fb-input fb-value-half" type="date" :value="cond.value"
            @input="updateValue(i, $event.target.value)" />
          <span v-else class="fb-input fb-value-half fb-token">
            <span class="fb-token-glyph" v-html="glyphHtml(cond.value)"></span>{{ displayName(cond.value) }}
            <button type="button" class="fb-token-x" @click="updateValue(i, '')" aria-label="Clear">×</button>
          </span>
          <DatePlaceholderMenu @select="updateValue(i, $event)" />
          <input v-if="!isPlaceholderToken(cond.valueTo)" class="fb-input fb-value-half" type="date" :value="cond.valueTo"
            @input="updateValueTo(i, $event.target.value)" />
          <span v-else class="fb-input fb-value-half fb-token">
            <span class="fb-token-glyph" v-html="glyphHtml(cond.valueTo)"></span>{{ displayName(cond.valueTo) }}
            <button type="button" class="fb-token-x" @click="updateValueTo(i, '')" aria-label="Clear">×</button>
          </span>
          <DatePlaceholderMenu @select="updateValueTo(i, $event)" />
        </template>

        <!-- Select / User / Record — toggle opens the inline picker below the row -->
        <template v-else-if="isMultiInput(cond)">
          <button type="button" class="fb-input fb-value fb-multi-toggle" :class="{ 'fb-multi-toggle--open': openRow === i }" @click="toggleDropdown(i)">
            <span class="fb-multi-summary">{{ multiSummary(cond) }}</span>
            <span class="fb-caret">▾</span>
          </button>
        </template>

        <!-- no value input (blank / notBlank / boolean) -->
        <span v-else class="fb-value-spacer"></span>

        <!-- Remove -->
        <button type="button" class="fb-remove" @click="removeCondition(i)" aria-label="Supprimer la condition">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- Inline picker (in normal flow so it scrolls with the panel, never clipped) -->
      <div v-if="isMultiInput(cond) && openRow === i" class="fb-multi-inline">
        <FilterValuePicker
          :column="columnByField(cond.field)"
          :model-value="Array.isArray(cond.value) ? cond.value : []"
          @update:model-value="updateValue(i, $event)"
        />
      </div>
      </div>

      <div v-if="conditions.length === 0" class="fb-empty">Aucun filtre pour le moment.</div>
    </div>

    <!-- Footer actions -->
    <div class="fb-actions">
      <button type="button" class="fb-btn fb-btn--add" :disabled="fieldOptions.length === 0" @click="addCondition">
        + Ajouter une condition
      </button>
      <button type="button" class="fb-btn fb-btn--clear" :disabled="conditions.length === 0" @click="clearAll">
        Tout effacer
      </button>
    </div>
  </div>
</template>

<script>
import {
  getOperatorsForType,
  getInputKind,
  normalizeFilterType,
} from '../utils/convertConditionsToSupabase.js';
import { isPlaceholderToken, placeholderDisplayName, placeholderGlyphHtml } from '../utils/placeholders.js';
import FilterValuePicker from './FilterValuePicker.vue';
import PlaceholderMenu from './PlaceholderMenu.vue';
import DatePlaceholderMenu from './DatePlaceholderMenu.vue';

// cellDataTypes we never offer in the builder (no meaningful filter):
// image/action are presentational, and navigation columns are link-only cells
// (the navigation column type is defined on the client-side-paged branch).
const NON_FILTERABLE = ['image', 'action', 'navigation'];

export default {
  name: 'FilterBuilder',
  components: { FilterValuePicker, PlaceholderMenu, DatePlaceholderMenu },
  props: {
    // content.columns — column metadata
    columns: { type: Array, default: () => [] },
    // { combinator, conditions }
    modelValue: { type: Object, default: () => ({ combinator: 'and', conditions: [] }) },
    dataSource: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return { openRow: -1 };
  },
  computed: {
    combinator() {
      return this.modelValue?.combinator === 'or' ? 'or' : 'and';
    },
    conditions() {
      return Array.isArray(this.modelValue?.conditions) ? this.modelValue.conditions : [];
    },
    fieldOptions() {
      return (this.columns || [])
        .filter((col) => {
          const field = col?.field;
          if (!field) return false;
          const t = String(col?.cellDataType || '').toLowerCase();
          return !NON_FILTERABLE.includes(t);
        })
        .map((col) => ({
          field: col.field,
          headerName: col.headerName || col.field,
          type: col.cellDataType || 'text',
        }));
    },
  },
  methods: {
    columnByField(field) {
      return (this.columns || []).find((c) => c?.field === field) || null;
    },
    operatorsFor(type) {
      return getOperatorsForType(type);
    },
    inputKind(cond) {
      return getInputKind(cond.type, cond.operator);
    },
    isMultiKind(type) {
      return ['select', 'user', 'record'].includes(normalizeFilterType(type));
    },
    isMultiInput(cond) {
      return ['multi-select', 'multi-user', 'multi-record'].includes(this.inputKind(cond));
    },
    // --- emit helpers -----------------------------------------------------
    emitConditions(next) {
      this.$emit('update:modelValue', { combinator: this.combinator, conditions: next });
    },
    patchCondition(i, patch) {
      const next = this.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
      this.emitConditions(next);
    },
    setCombinator(c) {
      this.$emit('update:modelValue', { combinator: c === 'or' ? 'or' : 'and', conditions: this.conditions });
    },
    buildDefaultCondition(field) {
      const col = field ? this.columnByField(field) : null;
      const first = col || this.fieldOptions[0];
      if (!first) return { field: '', type: 'text', operator: 'contains', value: '' };
      const f = first.field;
      const type = (col ? col.cellDataType : first.type) || 'text';
      const ops = getOperatorsForType(type);
      return {
        field: f,
        type,
        operator: ops[0]?.value || 'contains',
        value: this.isMultiKind(type) ? [] : '',
      };
    },
    addCondition() {
      this.emitConditions([...this.conditions, this.buildDefaultCondition()]);
    },
    removeCondition(i) {
      if (this.openRow === i) this.openRow = -1;
      this.emitConditions(this.conditions.filter((_, idx) => idx !== i));
    },
    clearAll() {
      this.openRow = -1;
      this.emitConditions([]);
    },
    onFieldChange(i, field) {
      const fresh = this.buildDefaultCondition(field);
      this.patchCondition(i, fresh);
    },
    onOperatorChange(i, operator) {
      const cond = this.conditions[i];
      const prevKind = getInputKind(cond.type, cond.operator);
      const nextKind = getInputKind(cond.type, operator);
      // Reset the value when the input shape changes (e.g. switching to/from inRange/blank).
      const patch = { operator };
      if (prevKind !== nextKind) {
        patch.value = this.isMultiKind(cond.type) ? [] : '';
        patch.valueTo = '';
      }
      this.patchCondition(i, patch);
    },
    updateValue(i, value) {
      this.patchCondition(i, { value });
    },
    updateValueTo(i, valueTo) {
      this.patchCondition(i, { valueTo });
    },
    // --- select / user / record picker -----------------------------------
    toggleDropdown(i) {
      this.openRow = this.openRow === i ? -1 : i;
    },
    // Labels for the toggle summary (select/user have a static list; record is
    // fetched inside the picker, so it falls back to a count).
    choicesFor(cond) {
      const col = this.columnByField(cond.field);
      const kind = normalizeFilterType(cond.type);
      if (kind === 'select') {
        return (col?.options || []).map((o, idx) => ({
          value: o?.value ?? o?.label ?? idx,
          label: o?.label ?? String(o?.value ?? ''),
        }));
      }
      if (kind === 'user') {
        return (col?.users || []).map((u, idx) => ({
          value: u?.id ?? idx,
          label: [u?.firstname, u?.lastname].filter(Boolean).join(' ').trim() || u?.name || u?.email || String(u?.id ?? ''),
        }));
      }
      return [];
    },
    multiSummary(cond) {
      const vals = Array.isArray(cond.value) ? cond.value : [];
      if (vals.length === 0) return 'Sélectionner…';
      if (vals.length === 1) {
        if (isPlaceholderToken(vals[0])) return placeholderDisplayName(vals[0]);
        const match = this.choicesFor(cond).find((c) => c.value === vals[0]);
        if (match) return match.label;
      }
      return `${vals.length} sélectionné(s)`;
    },
    isPlaceholderToken(value) {
      return isPlaceholderToken(value);
    },
    displayName(value) {
      return placeholderDisplayName(value);
    },
    glyphHtml(value) {
      return placeholderGlyphHtml(value);
    },
    placeholderKind(cond) {
      return normalizeFilterType(cond.type);
    },
  },
};
</script>

<style scoped lang="scss">
.fb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  font-family: inherit;
  color: inherit;
  font-size: 13px;
}

.fb-combinator {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fb-combinator-label,
.fb-combinator-hint {
  font-size: 12px;
  opacity: 0.7;
}

.fb-segmented {
  display: inline-flex;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  overflow: hidden;
}
.fb-seg {
  appearance: none;
  border: none;
  background: transparent;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: inherit;
  &--active {
    background: var(--ww-data-grid_filter-accent-color, #2563eb);
    color: #fff;
  }
}

.fb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fb-condition {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fb-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fb-input {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 13px;
  font-family: inherit;
  padding: 6px 8px;
  min-width: 0;
  &:focus {
    outline: none;
    border-color: var(--ww-data-grid_filter-accent-color, #2563eb);
  }
}

.fb-field { flex: 1.2; }
.fb-operator { flex: 1; }
.fb-value { flex: 1.3; }

/* Inline placeholder token shown in place of a value input */
.fb-token {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ww-data-grid_filter-accent-color, #2563eb);
  background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 8%, #fff);
  border-color: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 35%, transparent);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fb-token-glyph {
  font-weight: 700;
  letter-spacing: -1px;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  :deep(svg) { width: 15px; height: 15px; }
}
.fb-token-x {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  margin-left: auto;
  padding: 0 2px;
  opacity: 0.7;
  &:hover { opacity: 1; }
}
.fb-value-half { flex: 0.65; }
.fb-value-spacer { flex: 1.3; }

.fb-multi-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}
.fb-multi-toggle--open {
  border-color: var(--ww-data-grid_filter-accent-color, #2563eb);
}
.fb-multi-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fb-caret { opacity: 0.6; font-size: 10px; flex-shrink: 0; }

// Inline picker — sits in normal flow under the row, so it scrolls with the
// panel instead of being clipped by its overflow.
.fb-multi-inline {
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}

.fb-remove {
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  &:hover { background: rgba(0, 0, 0, 0.08); color: rgba(0, 0, 0, 0.8); }
}

.fb-empty {
  padding: 12px 4px;
  opacity: 0.6;
  font-size: 12px;
}

.fb-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
}
.fb-btn {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f5f5f5; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &--add { color: var(--ww-data-grid_filter-accent-color, #2563eb); border-color: var(--ww-data-grid_filter-accent-color, #2563eb); }
}
</style>
