<template>
  <div class="dph-menu">
    <button
      type="button"
      class="dph-menu-btn"
      :class="{ 'dph-menu-btn--open': open }"
      title="Date dynamique"
      @click.stop="toggle"
    >
      <span class="dph-menu-glyph" v-html="calendarIcon"></span>
      <svg width="8" height="5" viewBox="0 0 10 6" fill="none" class="dph-menu-caret">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div v-if="open" class="dph-menu-list" @click.stop>
      <button
        v-for="preset in presets"
        :key="preset.spec"
        type="button"
        class="dph-menu-item"
        @click="pickSpec(preset.spec)"
      >
        <span class="dph-menu-item-glyph" v-html="calendarIcon"></span>
        <span class="dph-menu-item-label">{{ preset.label }}</span>
      </button>

      <div class="dph-menu-divider"></div>

      <!-- Relative: "Il y a / Dans  N  jours/semaines/mois/ans" -->
      <div class="dph-relative">
        <select v-model="direction" class="dph-rel-input dph-rel-dir">
          <option value="-">Il y a</option>
          <option value="+">Dans</option>
        </select>
        <input v-model.number="amount" type="number" min="1" class="dph-rel-input dph-rel-num" />
        <select v-model="unit" class="dph-rel-input dph-rel-unit">
          <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
        </select>
        <button type="button" class="dph-rel-add" :disabled="!amount || amount < 1" @click="pickRelative">Ajouter</button>
      </div>
    </div>
  </div>
</template>

<script>
import { DATE_PRESETS, DATE_UNITS, DATE_ICON, makeDateToken, placeholderDisplayName } from '../utils/placeholders.js';

// Inserts a dynamic date token (e.g. %DATE:today%, %DATE:-4d%) — independent of
// the placeholder variable. Emits the token via `select`.
export default {
  name: 'DatePlaceholderMenu',
  emits: ['select'],
  data() {
    return {
      open: false,
      direction: '-',
      amount: 1,
      unit: 'd',
      units: DATE_UNITS,
    };
  },
  computed: {
    calendarIcon() {
      return DATE_ICON;
    },
    presets() {
      return DATE_PRESETS.map((spec) => ({ spec, label: placeholderDisplayName(makeDateToken(spec)) }));
    },
  },
  beforeUnmount() {
    this.unbindOutside();
  },
  methods: {
    toggle() {
      this.open ? this.close() : this.openMenu();
    },
    openMenu() {
      this.open = true;
      setTimeout(() => document.addEventListener('click', this.onOutside), 0);
    },
    close() {
      this.open = false;
      this.unbindOutside();
    },
    unbindOutside() {
      document.removeEventListener('click', this.onOutside);
    },
    onOutside() {
      this.close();
    },
    pickSpec(spec) {
      this.$emit('select', makeDateToken(spec));
      this.close();
    },
    pickRelative() {
      const n = Math.max(1, parseInt(this.amount, 10) || 1);
      this.$emit('select', makeDateToken(`${this.direction}${n}${this.unit}`));
      this.close();
    },
  },
};
</script>

<style scoped lang="scss">
.dph-menu {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.dph-menu-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  padding: 5px 6px;
  line-height: 1;
  &:hover { background: #f5f5f5; color: rgba(0, 0, 0, 0.8); }
  &--open { border-color: var(--ww-data-grid_filter-accent-color, #2563eb); }
}
.dph-menu-glyph { display: inline-flex; align-items: center; :deep(svg) { width: 15px; height: 15px; } }
.dph-menu-caret { opacity: 0.7; flex-shrink: 0; }

.dph-menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 200px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 4px;
}
.dph-menu-item {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: #333;
  &:hover { background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 10%, transparent); }
}
.dph-menu-item-glyph {
  color: #6b7280;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  :deep(svg) { width: 16px; height: 16px; }
}
.dph-menu-item-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.dph-menu-divider { height: 1px; background: rgba(0, 0, 0, 0.08); margin: 4px 2px; }

.dph-relative {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
}
.dph-rel-input {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 12px;
  font-family: inherit;
  padding: 5px 6px;
  outline: none;
  min-width: 0;
  &:focus { border-color: var(--ww-data-grid_filter-accent-color, #2563eb); }
}
.dph-rel-dir { flex: 0 0 auto; }
.dph-rel-num { width: 48px; flex: 0 0 auto; }
.dph-rel-unit { flex: 1; }
.dph-rel-add {
  appearance: none;
  border: 1px solid var(--ww-data-grid_filter-accent-color, #2563eb);
  border-radius: 6px;
  background: #fff;
  color: var(--ww-data-grid_filter-accent-color, #2563eb);
  font-size: 12px;
  padding: 5px 8px;
  cursor: pointer;
  flex-shrink: 0;
  &:hover:not(:disabled) { background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 10%, transparent); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
