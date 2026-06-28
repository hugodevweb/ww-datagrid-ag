<template>
    <div class="record-filter">
        <div class="record-filter-search">
            <input
                ref="searchInput"
                v-model="searchQuery"
                type="text"
                class="record-filter-search-input"
                placeholder="Search..."
            />
        </div>
        <div v-if="isLoadingRecords" class="record-filter-empty">
            Loading records...
        </div>
        <div v-else-if="orderedRecords.length || !searchQuery.trim()" class="record-filter-options">
            <!-- Placeholders — insert a runtime token (e.g. %CURRENT_USER%) -->
            <template v-if="placeholderNames.length && !searchQuery.trim()">
                <button
                    v-for="name in placeholderNames"
                    :key="'ph-' + name"
                    type="button"
                    class="record-filter-option record-ph-option"
                    :class="{ selected: isPlaceholderSelected(name) }"
                    @click="togglePlaceholder(name)"
                >
                    <span class="option-content">
                        <span class="checkbox" :class="{ checked: isPlaceholderSelected(name) }">
                            <span class="checkbox-icon">&#10003;</span>
                        </span>
                        <span class="record-ph-glyph" v-html="glyphHtml(name)"></span>
                        <span class="record-pill-name">{{ displayName(name) }}</span>
                    </span>
                </button>
                <div class="record-ph-divider"></div>
            </template>
            <button
                v-if="!searchQuery.trim()"
                type="button"
                class="record-filter-option record-filter-empty-option"
                :class="{ selected: isEmptySelected }"
                @click="toggleEmpty"
            >
                <span class="option-content">
                    <span class="checkbox" :class="{ checked: isEmptySelected }">
                        <span class="checkbox-icon">&#10003;</span>
                    </span>
                    <span class="record-empty-icon-placeholder" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                    </span>
                    <span class="record-pill-name">{{ emptyLabel }}</span>
                </span>
            </button>
            <button
                v-for="(record, index) in orderedRecords"
                :key="record[valueField] ?? index"
                type="button"
                class="record-filter-option"
                :class="{ selected: pendingSelection.has(record[valueField]) }"
                @click="toggleOption(record[valueField])"
            >
                <span class="option-content">
                    <span class="checkbox" :class="{ checked: pendingSelection.has(record[valueField]) }">
                        <span class="checkbox-icon">&#10003;</span>
                    </span>
                    <span class="record-pill-accent" aria-hidden="true"></span>
                    <div class="record-pill-content">
                        <span class="record-pill-name">{{ getRecordLabel(record) }}</span>
                        <span v-if="getRecordContext(record)" class="record-pill-subtitle">{{ getRecordContext(record) }}</span>
                    </div>
                </span>
            </button>
        </div>
        <div v-else class="record-filter-empty">
            No records available
        </div>
        <div class="record-filter-actions">
            <button
                type="button"
                class="filter-btn reset"
                :disabled="!canReset"
                @click="onReset"
            >
                {{ translations.reset }}
            </button>
            <button
                type="button"
                class="filter-btn apply"
                :disabled="!canApply"
                @click="onApply"
            >
                {{ translations.apply }}
            </button>
        </div>
    </div>
</template>

<script>
// Module-level record cache (independent from RecordCellRenderer cache)
const recordCache = new Map();
const CACHE_TTL_MS = 30_000;
const pendingFetches = new Map();

function getCachedRecords(cacheKey) {
    const entry = recordCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
        recordCache.delete(cacheKey);
        return null;
    }
    return entry.records;
}

function setCachedRecords(cacheKey, records) {
    recordCache.set(cacheKey, { records, fetchedAt: Date.now() });
}

import { getPlaceholderNamesForKind, makeToken, resolveValues, placeholderDisplayName, placeholderGlyphHtml } from '../../shared/utils/placeholders.js';

export default {
    name: "RecordFilterComponent",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    expose: ['getGui', 'isFilterActive', 'doesFilterPass', 'getModel', 'setModel', 'onParentModelChanged', 'refresh'],
    data() {
        return {
            allRecords: [],
            isLoadingRecords: false,
            searchQuery: '',
            pendingSelection: new Set(),
            appliedSelection: new Set(),
            refreshTimer: null,
            recordOptions: {},
        };
    },
    mounted() {
        if (this.params) {
            const filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};
            this.recordOptions = filterParams.recordOptions || {};
            this.syncSelectionsFromModel(null, { updateApplied: true });
            this.fetchRecords();
        }

        // Periodic check for config changes
        this.refreshTimer = setInterval(() => {
            if (!this.params) return;
            const filterParams = this.getLatestFilterParams();
            const newOptions = filterParams.recordOptions || {};
            if (newOptions.tableName && newOptions.tableName !== this.recordOptions.tableName) {
                this.recordOptions = newOptions;
                this.fetchRecords();
            }
        }, 500);
    },
    beforeUnmount() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },
    computed: {
        tableName() {
            return this.recordOptions?.tableName || '';
        },
        valueField() {
            return this.recordOptions?.valueField || 'id';
        },
        displayField() {
            return this.recordOptions?.displayField || 'name';
        },
        contextField() {
            return this.recordOptions?.contextField || '';
        },
        previewFieldDefs() {
            const pf = this.recordOptions?.previewFields || [];
            return Array.isArray(pf) ? pf.filter(Boolean) : [];
        },
        cacheKey() {
            return `${this.tableName}::${this.buildSelectString()}`;
        },
        filteredRecords() {
            const q = (this.searchQuery || '').toLowerCase().trim();
            if (!q) return this.allRecords;
            return this.allRecords.filter(r => {
                const label = this.getRecordLabel(r);
                const context = this.getRecordContext(r);
                return String(label).toLowerCase().includes(q) || String(context).toLowerCase().includes(q);
            });
        },
        orderedRecords() {
            if (!this.filteredRecords?.length) return [];
            const selected = [];
            const unselected = [];
            for (const record of this.filteredRecords) {
                if (this.pendingSelection.has(record[this.valueField])) {
                    selected.push(record);
                } else {
                    unselected.push(record);
                }
            }
            return [...selected, ...unselected];
        },
        isEmptySelected() {
            return this.pendingSelection.has('__empty__');
        },
        emptyLabel() {
            const lang = (this.params?.colDef?.filterParams?.lang
                || this.params?.filterParams?.lang
                || navigator.language || 'en').split('-')[0].toLowerCase();
            const translations = {
                en: 'No linked record',
                fr: 'Aucune fiche liée',
                es: 'Sin registro vinculado',
                de: 'Kein verknüpfter Datensatz',
                pt: 'Sem registo associado',
            };
            return translations[lang] || translations.en;
        },
        translations() {
            const filterParams = this.params?.colDef?.filterParams || this.params?.filterParams || {};
            const defaultTranslations = { reset: 'Reset', apply: 'Apply' };
            return filterParams.translations || defaultTranslations;
        },
        canApply() {
            if (!this.pendingSelection.size && !this.appliedSelection.size) return false;
            return !this.areSetsEqual(this.pendingSelection, this.appliedSelection);
        },
        canReset() {
            return this.pendingSelection.size > 0 || this.appliedSelection.size > 0;
        },
        placeholderNames() {
            return getPlaceholderNamesForKind('record');
        },
    },
    methods: {
        placeholderToken(name) {
            return makeToken(name);
        },
        isPlaceholderSelected(name) {
            return this.pendingSelection.has(makeToken(name));
        },
        togglePlaceholder(name) {
            this.toggleOption(makeToken(name));
        },
        displayName(value) {
            return placeholderDisplayName(value);
        },
        glyphHtml(value) {
            return placeholderGlyphHtml(value);
        },
        // ─── AG Grid filter interface ────────────────────────────────────────
        getGui() {
            return this.$el;
        },
        isFilterActive() {
            return this.appliedSelection.size > 0;
        },
        doesFilterPass(params) {
            if (!this.isFilterActive()) return true;
            // Resolve placeholder tokens (e.g. %CURRENT_USER%) to real ids before matching.
            const selection = resolveValues(Array.from(this.appliedSelection));
            const rowValue = this.getRowValue(params);
            if (rowValue == null || rowValue === '') {
                return selection.includes('__empty__');
            }
            const rowStr = String(rowValue);
            for (const selected of selection) {
                if (selected === '__empty__') continue;
                if (String(selected) === rowStr) return true;
            }
            return false;
        },
        getModel() {
            if (!this.isFilterActive()) return null;
            return {
                type: "recordFilter",
                values: Array.from(this.appliedSelection),
            };
        },
        setModel(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        onParentModelChanged(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        refresh(newParams) {
            if (this.params) {
                const filterParams = this.getLatestFilterParams();
                const newOptions = filterParams.recordOptions || {};
                if (newOptions.tableName) {
                    this.recordOptions = newOptions;
                    this.fetchRecords();
                }
            }
            return true;
        },

        // ─── Helpers ─────────────────────────────────────────────────────────
        getLatestFilterParams() {
            let filterParams = this.params?.colDef?.filterParams || this.params?.filterParams || {};
            if (this.params?.api && this.params?.column) {
                try {
                    const colId = this.params.column.getColId();
                    const freshColDef = this.params.api.getColumnDef(colId);
                    if (freshColDef?.filterParams) {
                        filterParams = freshColDef.filterParams;
                    }
                } catch (e) {
                    // Fallback to original filterParams
                }
            }
            return filterParams;
        },
        getRowValue(filterParams) {
            if (filterParams && "value" in filterParams) {
                return filterParams.value;
            }
            const field = this.params?.colDef?.field;
            if (field && filterParams?.data && Object.prototype.hasOwnProperty.call(filterParams.data, field)) {
                return filterParams.data[field];
            }
            return undefined;
        },
        syncSelectionsFromModel(model, { updateApplied } = { updateApplied: true }) {
            if (!model || !Array.isArray(model.values) || model.values.length === 0) {
                if (updateApplied) this.appliedSelection = new Set();
                this.pendingSelection = updateApplied ? new Set(this.appliedSelection) : new Set();
                return;
            }
            const next = new Set(model.values);
            if (updateApplied) this.appliedSelection = new Set(next);
            this.pendingSelection = new Set(next);
        },
        areSetsEqual(a, b) {
            if (a.size !== b.size) return false;
            for (const value of a) {
                if (!b.has(value)) return false;
            }
            return true;
        },

        // ─── UI interaction ──────────────────────────────────────────────────
        toggleEmpty() {
            const nextSelection = new Set(this.pendingSelection);
            if (nextSelection.has('__empty__')) {
                nextSelection.delete('__empty__');
            } else {
                nextSelection.add('__empty__');
            }
            this.pendingSelection = nextSelection;
        },
        toggleOption(value) {
            const nextSelection = new Set(this.pendingSelection);
            if (nextSelection.has(value)) {
                nextSelection.delete(value);
            } else {
                nextSelection.add(value);
            }
            this.pendingSelection = nextSelection;
        },
        onApply() {
            this.appliedSelection = new Set(this.pendingSelection);
            this.params?.filterChangedCallback();
            if (this.params?.filterParams?.closeOnApply && this.params?.api?.hidePopupMenu) {
                this.params.api.hidePopupMenu();
            }
        },
        onReset() {
            if (!this.canReset) return;
            this.pendingSelection = new Set();
            this.appliedSelection = new Set();
            this.params?.filterChangedCallback();
        },

        // ─── Record fetching (from RecordCellRenderer pattern) ──────────────
        async fetchRecords() {
            if (!this.tableName) return;

            const cached = getCachedRecords(this.cacheKey);
            if (cached) {
                this.allRecords = cached;
                return;
            }

            if (pendingFetches.has(this.cacheKey)) {
                this.isLoadingRecords = true;
                try {
                    const records = await pendingFetches.get(this.cacheKey);
                    if (records) this.allRecords = records;
                } finally {
                    this.isLoadingRecords = false;
                }
                return;
            }

            const supabase = this.recordOptions?.getSupabaseInstance?.();
            if (!supabase) return;

            this.isLoadingRecords = true;
            const fetchPromise = (async () => {
                try {
                    const selectStr = this.buildSelectString();
                    const { data, error } = await supabase
                        .from(this.tableName)
                        .select(selectStr)
                        .limit(100);

                    if (!error && data) {
                        setCachedRecords(this.cacheKey, data);
                        return data;
                    }
                    return null;
                } catch (e) {
                    return null;
                } finally {
                    pendingFetches.delete(this.cacheKey);
                }
            })();

            pendingFetches.set(this.cacheKey, fetchPromise);

            try {
                const records = await fetchPromise;
                if (records) {
                    this.allRecords = records;
                    // If we have an active filter, re-apply now that records are loaded
                    if (this.isFilterActive()) {
                        this.$nextTick(() => {
                            this.params?.filterChangedCallback?.();
                        });
                    }
                }
            } finally {
                this.isLoadingRecords = false;
            }
        },
        buildSelectString() {
            const allFields = [
                this.displayField,
                this.contextField,
                ...this.previewFieldDefs.map(pf => typeof pf === 'string' ? pf : pf?.field).filter(Boolean),
            ].filter(Boolean);

            const relMap = {};
            for (const f of allFields) {
                const dotIdx = f.indexOf('.');
                if (dotIdx !== -1) {
                    const resource = f.slice(0, dotIdx);
                    const sub = f.slice(dotIdx + 1);
                    if (!relMap[resource]) relMap[resource] = new Set();
                    relMap[resource].add(sub);
                }
            }

            const parts = ['*'];
            for (const [resource, subs] of Object.entries(relMap)) {
                parts.push(`${resource}(${[...subs].join(', ')})`);
            }
            return parts.join(', ');
        },
        resolveNestedValue(obj, path) {
            if (!obj || !path) return undefined;
            const parts = path.split('.');
            let cur = obj;
            for (const part of parts) {
                if (cur == null) return undefined;
                const key = part.includes('!') ? part.slice(0, part.indexOf('!')) : part;
                cur = cur[key];
            }
            return cur;
        },
        normalizeRecordMeta(value) {
            if (value == null) return '';
            if (Array.isArray(value)) {
                return value
                    .filter(item => item != null && typeof item !== 'object')
                    .map(item => String(item))
                    .filter(Boolean)
                    .join(', ');
            }
            if (typeof value === 'object') return '';
            return String(value);
        },
        getRecordLabel(record) {
            return this.resolveNestedValue(record, this.displayField) ?? record[this.valueField] ?? '';
        },
        getRecordContext(record) {
            if (!record || !this.contextField) return '';
            return this.normalizeRecordMeta(this.resolveNestedValue(record, this.contextField));
        },
    },
};
</script>

<style scoped lang="scss">
$accent: var(--ww-data-grid_record-pill-accent-color, #6366f1);

.record-filter {
    display: flex;
    flex-direction: column;
    min-width: 240px;
    max-width: 320px;
    max-height: 360px;
    font-family: inherit;
    color: inherit;
}

.record-filter-search {
    padding: 8px 8px 4px;
}

.record-filter-search-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 5px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;

    &:focus {
        border-color: $accent;
    }

    &::placeholder {
        color: rgba(0, 0, 0, 0.35);
    }
}

.record-filter-options {
    padding: 4px 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.record-ph-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
    padding: 4px 12px 2px;
}
.record-ph-divider {
    height: 1px;
    background: #e0e0e0;
    margin: 4px 8px;
}
.record-ph-glyph {
    font-weight: 700;
    letter-spacing: -1px;
    color: #6b7280;
    margin-right: 4px;
    display: inline-flex;
    align-items: center;
}
.record-ph-glyph :deep(svg) { width: 16px; height: 16px; }

.record-filter-option {
    border: none;
    border-radius: 0;
    padding: 7px 12px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.4;
    cursor: pointer;
    transition: background-color 0.12s ease;
    user-select: none;
    width: 100%;
    text-align: left;
    background: transparent;
    color: #333;

    &:hover {
        background-color: rgba(0, 0, 0, 0.04);
    }

    &.selected {
        background-color: color-mix(in srgb, $accent 8%, transparent);
    }

    &.selected:hover {
        background-color: color-mix(in srgb, $accent 12%, transparent);
    }
}

.option-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
}

.checkbox {
    width: 15px;
    height: 15px;
    min-width: 15px;
    border-radius: 3px;
    border: 1.5px solid rgba(0, 0, 0, 0.2);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;

    &-icon {
        font-size: 10px;
        line-height: 1;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.12s ease;
        color: #fff;
    }

    &.checked {
        border-color: $accent;
        background: $accent;

        .checkbox-icon {
            opacity: 1;
            transform: scale(1);
        }
    }
}

.record-filter-empty-option {
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 2px;
}

.record-empty-icon-placeholder {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #9ca3af;
}

.record-filter-empty-option.selected .record-empty-icon-placeholder {
    color: $accent;
}

.record-pill-accent {
    width: 3px;
    min-width: 3px;
    height: 22px;
    border-radius: 1.5px;
    background: $accent;
    flex-shrink: 0;
}

.record-pill-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.record-pill-name {
    font-size: 13px;
    font-weight: 500;
    color: #1e1e1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.record-pill-subtitle {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.record-filter-actions {
    padding: 6px 8px;
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.filter-btn {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    padding: 5px 14px;
    transition: all 0.15s ease;

    &.reset {
        background: transparent;
        border: 1px solid rgba(0, 0, 0, 0.12);
        color: #555;

        &:hover {
            background: rgba(0, 0, 0, 0.04);
        }
    }

    &.apply {
        background: $accent;
        border: 1px solid transparent;
        color: #fff;

        &:hover {
            filter: brightness(0.92);
        }
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        filter: none;
    }
}

.record-filter-empty {
    padding: 16px 12px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.45);
    text-align: center;
}
</style>
