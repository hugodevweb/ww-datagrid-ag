<template>
  <div class="fvp">
    <!-- Selected placeholder tokens (they match no list row, so surface them here) -->
    <div v-if="selectedPlaceholders.length" class="fvp-ph-chips">
      <span v-for="tok in selectedPlaceholders" :key="tok" class="fvp-ph-chip">
        <span class="fvp-ph-chip-glyph" v-html="glyphHtml(tok)"></span>
        <span class="fvp-ph-chip-label">{{ displayName(tok) }}</span>
        <button type="button" class="fvp-ph-chip-x" @click.stop="toggle(tok)" aria-label="Remove">×</button>
      </span>
    </div>

    <!-- Placeholders — insert a runtime token (e.g. %CURRENT_USER%) -->
    <div v-if="placeholderNames.length" class="fvp-ph-section">
      <button
        v-for="name in placeholderNames"
        :key="name"
        type="button"
        class="fvp-ph-row"
        :class="{ selected: isChecked(placeholderToken(name)) }"
        @click.stop="toggle(placeholderToken(name))"
      >
        <span class="fvp-ph-row-glyph" v-html="glyphHtml(name)"></span>
        <span class="fvp-ph-row-label">{{ displayName(name) }}</span>
        <span v-if="isChecked(placeholderToken(name))" class="fvp-tick">✓</span>
      </button>
    </div>

    <!-- Search (user / record) -->
    <div v-if="kind === 'user' || kind === 'record'" class="fvp-search">
      <input
        v-model="searchQuery"
        type="text"
        class="fvp-search-input"
        :placeholder="kind === 'user' ? 'Rechercher des utilisateurs…' : 'Rechercher…'"
        @click.stop
      />
    </div>

    <div v-if="loading" class="fvp-empty">Chargement…</div>

    <!-- SELECT — color pills with checkbox -->
    <div v-else-if="kind === 'select'" class="fvp-list fvp-list--select">
      <button
        v-for="opt in selectOptions"
        :key="opt.value"
        type="button"
        class="fvp-pill"
        :class="{ selected: isChecked(opt.value) }"
        :style="{ backgroundColor: opt.color }"
        @click.stop="toggle(opt.value)"
      >
        <span class="fvp-checkbox" :class="{ checked: isChecked(opt.value) }"><span class="fvp-check">✓</span></span>
        <span class="fvp-pill-label">{{ opt.label }}</span>
      </button>
      <div v-if="selectOptions.length === 0" class="fvp-empty">Aucune option</div>
    </div>

    <!-- USER — avatar rows -->
    <div v-else-if="kind === 'user'" class="fvp-list">
      <div
        v-for="user in filteredUsers"
        :key="user.id"
        class="fvp-user"
        :class="{ selected: isChecked(user.id) }"
        @click.stop="toggle(user.id)"
      >
        <img :src="avatarFor(user)" :alt="nameFor(user)" class="fvp-avatar" />
        <span class="fvp-user-name">{{ nameFor(user) }}</span>
        <span v-if="isChecked(user.id)" class="fvp-tick">✓</span>
      </div>
      <div v-if="filteredUsers.length === 0" class="fvp-empty">Aucun utilisateur</div>
    </div>

    <!-- RECORD — fetched rows -->
    <div v-else-if="kind === 'record'" class="fvp-list">
      <div
        v-for="rec in filteredRecords"
        :key="rec[recordValueField]"
        class="fvp-record"
        :class="{ selected: isChecked(rec[recordValueField]) }"
        @click.stop="toggle(rec[recordValueField])"
      >
        <span class="fvp-checkbox" :class="{ checked: isChecked(rec[recordValueField]) }"><span class="fvp-check">✓</span></span>
        <span class="fvp-record-accent" aria-hidden="true"></span>
        <div class="fvp-record-text">
          <span class="fvp-record-name">{{ recordLabel(rec) }}</span>
          <span v-if="recordContext(rec)" class="fvp-record-sub">{{ recordContext(rec) }}</span>
        </div>
        <span v-if="isChecked(rec[recordValueField])" class="fvp-tick">✓</span>
      </div>
      <div v-if="filteredRecords.length === 0" class="fvp-empty">Aucun enregistrement</div>
    </div>
  </div>
</template>

<script>
import { normalizeFilterType } from '../utils/convertConditionsToSupabase.js';
import { getUserName, getDefaultAvatar } from '../utils/avatarUtils.js';
import { getPlaceholderNamesForKind, makeToken, isPlaceholderToken, placeholderDisplayName, placeholderGlyphHtml } from '../utils/placeholders.js';

// Resolve a possibly dot-pathed field (e.g. "profile.name") from a record.
const getByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
};

export default {
  name: 'FilterValuePicker',
  props: {
    column: { type: Object, default: () => ({}) },
    modelValue: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      searchQuery: '',
      records: [],
      loading: false,
    };
  },
  computed: {
    kind() {
      return normalizeFilterType(this.column?.cellDataType);
    },
    selected() {
      return Array.isArray(this.modelValue) ? this.modelValue : [];
    },
    placeholderNames() {
      return getPlaceholderNamesForKind(this.kind);
    },
    selectedPlaceholders() {
      return this.selected.filter((v) => isPlaceholderToken(v));
    },
    selectOptions() {
      return (this.column?.options || []).map((o, i) => ({
        value: o?.value ?? o?.label ?? i,
        label: o?.label ?? String(o?.value ?? ''),
        color: o?.color || '#9CA3AF',
      }));
    },
    users() {
      return Array.isArray(this.column?.users) ? this.column.users : [];
    },
    filteredUsers() {
      const q = this.searchQuery.trim().toLowerCase();
      if (!q) return this.users;
      return this.users.filter((u) => {
        const name = this.nameFor(u).toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    },
    recordValueField() {
      return this.column?.recordValueField || 'id';
    },
    recordDisplayField() {
      return this.column?.recordDisplayField || 'name';
    },
    recordContextField() {
      return this.column?.recordContextField || '';
    },
    filteredRecords() {
      const q = this.searchQuery.trim().toLowerCase();
      if (!q) return this.records;
      return this.records.filter((r) => {
        const label = String(this.recordLabel(r)).toLowerCase();
        const ctx = String(this.recordContext(r) || '').toLowerCase();
        return label.includes(q) || ctx.includes(q);
      });
    },
  },
  watch: {
    'column.recordTable': {
      handler() {
        if (this.kind === 'record') this.fetchRecords();
      },
    },
  },
  mounted() {
    if (this.kind === 'record') this.fetchRecords();
  },
  methods: {
    isChecked(value) {
      return this.selected.includes(value);
    },
    placeholderToken(name) {
      return makeToken(name);
    },
    displayName(value) {
      return placeholderDisplayName(value);
    },
    glyphHtml(value) {
      return placeholderGlyphHtml(value);
    },
    toggle(value) {
      const next = this.selected.includes(value)
        ? this.selected.filter((v) => v !== value)
        : [...this.selected, value];
      this.$emit('update:modelValue', next);
    },
    nameFor(user) {
      return getUserName(user);
    },
    avatarFor(user) {
      return user?.avatar_variants?.md || user?.avatar_url || getDefaultAvatar(user);
    },
    recordLabel(rec) {
      return getByPath(rec, this.recordDisplayField) ?? rec?.[this.recordValueField] ?? '';
    },
    recordContext(rec) {
      return this.recordContextField ? getByPath(rec, this.recordContextField) : '';
    },
    async fetchRecords() {
      const table = this.column?.recordTable;
      if (!table) return;
      const supabase = wwLib?.wwPlugins?.supabase?.instance;
      if (!supabase) return;
      this.loading = true;
      try {
        const { data, error } = await supabase.from(table).select('*').limit(100);
        this.records = !error && Array.isArray(data) ? data : [];
      } catch (e) {
        this.records = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.fvp {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  font-family: inherit;
  color: inherit;
}

.fvp-search {
  padding: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.fvp-search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  &:focus { border-color: var(--ww-data-grid_filter-accent-color, #2563eb); }
}

.fvp-list {
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Select — color pills (mirrors the datagrid select filter) */
.fvp-pill {
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 7px 10px;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  transition: filter 0.15s ease, box-shadow 0.15s ease;
  &:hover { filter: brightness(0.96); }
  &.selected { border-color: rgba(255, 255, 255, 0.85); box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08); }
}
.fvp-pill-label {
  flex: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fvp-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .fvp-check { font-size: 11px; color: #fff; opacity: 0; transform: scale(0.5); transition: all 0.15s ease; }
  &.checked .fvp-check { opacity: 1; transform: scale(1); }
}

/* User rows */
.fvp-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: rgba(0, 0, 0, 0.05); }
  &.selected { background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 10%, transparent); }
}
.fvp-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.fvp-user-name { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fvp-tick { color: var(--ww-data-grid_filter-accent-color, #2563eb); font-weight: 700; flex-shrink: 0; }

/* Record rows */
.fvp-record {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #333;
  &:hover { background: rgba(0, 0, 0, 0.05); }
  &.selected { background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 10%, transparent); }
  .fvp-checkbox { border-color: rgba(0, 0, 0, 0.3); background: rgba(0, 0, 0, 0.04); }
  .fvp-checkbox .fvp-check { color: var(--ww-data-grid_filter-accent-color, #2563eb); }
}
.fvp-record-accent { width: 4px; align-self: stretch; border-radius: 2px; background: var(--ww-data-grid_filter-accent-color, #2563eb); opacity: 0.5; }
.fvp-record-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fvp-record-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fvp-record-sub { font-size: 11px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.fvp-empty { padding: 12px; font-size: 12px; opacity: 0.6; }

/* Placeholder chips + insert section */
.fvp-ph-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.fvp-ph-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 12%, transparent);
  color: var(--ww-data-grid_filter-accent-color, #2563eb);
  border-radius: 6px;
  padding: 2px 4px 2px 6px;
  font-size: 12px;
  font-weight: 500;
}
.fvp-ph-chip-glyph {
  font-weight: 700;
  letter-spacing: -1px;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  :deep(svg) { width: 14px; height: 14px; }
}
.fvp-ph-chip-label { white-space: nowrap; }
.fvp-ph-chip-x {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
  &:hover { opacity: 1; }
}

.fvp-ph-section {
  padding: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fvp-ph-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.5;
  padding: 2px 4px;
}
.fvp-ph-row {
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
  &:hover { background: rgba(0, 0, 0, 0.05); }
  &.selected { background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 10%, transparent); }
}
.fvp-ph-row-glyph {
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
.fvp-ph-row-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
