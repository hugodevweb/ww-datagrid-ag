<template>
  <div v-if="names.length" class="ph-menu">
    <button
      type="button"
      class="ph-menu-btn"
      :class="{ 'ph-menu-btn--open': open }"
      :title="title"
      @click.stop="toggle"
    >
      <span class="ph-menu-glyph">{ }</span>
      <svg width="8" height="5" viewBox="0 0 10 6" fill="none" class="ph-menu-caret">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div v-if="open" class="ph-menu-list" @click.stop>
      <button
        v-for="name in names"
        :key="name"
        type="button"
        class="ph-menu-item"
        @click="pick(name)"
      >
        <span class="ph-menu-item-glyph" v-html="glyphHtml(name)"></span>
        <span class="ph-menu-item-label">{{ displayName(name) }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { getPlaceholderNamesForKind, makeToken, placeholderDisplayName, placeholderGlyphHtml } from '../utils/placeholders.js';

// Small "{ } ▾" affordance dropped next to any filter/style value input. Lists
// the available placeholder names (live, from the bound variable) and emits the
// chosen token via `select`. Renders nothing when no placeholders are defined.
export default {
  name: 'PlaceholderMenu',
  props: {
    title: { type: String, default: 'Valeur dynamique' },
    // Restrict offered placeholders to a column kind (text/number/date/user/…).
    kind: { type: String, default: '' },
  },
  emits: ['select'],
  data() {
    return { open: false, tick: 0 };
  },
  computed: {
    names() {
      // `tick` forces a re-read when the menu opens, in case the variable's keys
      // changed since mount (reactivity through wwVariable can be coarse).
      void this.tick;
      return getPlaceholderNamesForKind(this.kind);
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
      this.tick++;
      this.open = true;
      // Defer so the click that opened us doesn't immediately close it.
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
    pick(name) {
      this.$emit('select', makeToken(name));
      this.close();
    },
    displayName(name) {
      return placeholderDisplayName(name);
    },
    glyphHtml(name) {
      return placeholderGlyphHtml(name);
    },
  },
};
</script>

<style scoped lang="scss">
.ph-menu {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.ph-menu-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: #fff;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  padding: 5px 6px;
  font-size: 12px;
  line-height: 1;
  &:hover { background: #f5f5f5; color: rgba(0, 0, 0, 0.8); }
  &--open {
    border-color: var(--ww-data-grid_filter-accent-color, #2563eb);
    color: var(--ww-data-grid_filter-accent-color, #2563eb);
  }
}
.ph-menu-glyph { font-weight: 700; letter-spacing: -1px; }
.ph-menu-caret { opacity: 0.7; flex-shrink: 0; }

.ph-menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 160px;
  max-height: 220px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 4px;
}
.ph-menu-header {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.5;
  padding: 4px 8px;
}
.ph-menu-item {
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
.ph-menu-item-glyph {
  font-weight: 700;
  letter-spacing: -1px;
  font-size: 11px;
  color: #6b7280;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  :deep(svg) { width: 16px; height: 16px; }
}
.ph-menu-item-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
