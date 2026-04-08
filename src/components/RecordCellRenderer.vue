<template>
    <div ref="cellElement" class="record-cell">
        <div class="record-display" :class="{ 'is-editing': isEditMode }">
            <div
                v-if="currentRecord"
                class="record-pill"
                :class="{ 'is-editing': isEditMode, 'has-subtitle': !!contextValue }"
                @mouseenter="!isEditMode && onChipMouseEnter($event)"
                @mouseleave="!isEditMode && onChipMouseLeave()"
            >
                <span class="record-pill-accent" aria-hidden="true"></span>
                <div class="record-pill-content">
                    <span class="record-pill-name" :title="displayValue">{{ displayValue }}</span>
                    <span v-if="contextValue" class="record-pill-subtitle" :title="contextValue">{{ contextValue }}</span>
                </div>
                <button
                    v-if="!isEditMode"
                    class="record-nav-btn"
                    title="Ouvrir la fiche"
                    aria-label="Ouvrir la fiche"
                    @click.stop="onNavigate"
                    type="button"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                </button>
            </div>
            <div v-else class="record-empty" :class="{ 'is-editing': isEditMode }">
                <span class="record-empty-icon" aria-hidden="true">
                    <span class="record-empty-line record-empty-line-horizontal"></span>
                    <span class="record-empty-line record-empty-line-vertical"></span>
                </span>
                <span class="record-empty-text">Ajouter</span>
            </div>
        </div>

        <!-- Hover preview popup (Teleported) -->
        <Teleport :to="teleportTarget" v-if="showPreview && currentRecord && teleportTarget">
            <div
                ref="previewElement"
                class="record-preview"
                :style="previewStyle"
                @mouseenter="onPreviewMouseEnter"
                @mouseleave="onPreviewMouseLeave"
            >
                <div class="record-preview-header">
                    <div class="record-preview-header-accent" aria-hidden="true"></div>
                    <div class="record-preview-header-content">
                        <span class="record-preview-title" :title="displayValue">{{ displayValue }}</span>
                        <span
                            v-if="contextValue"
                            class="record-preview-subtitle"
                            :title="contextValue"
                        >
                            {{ contextValue }}
                        </span>
                    </div>
                </div>
                <div class="record-preview-fields">
                    <div
                        v-for="pf in previewFieldDefs"
                        :key="pf.field"
                        class="record-preview-row"
                    >
                        <span class="record-preview-label">{{ pf.label || pf.field }}</span>
                        <span class="record-preview-value">{{ resolveNestedValue(currentRecord, pf.field) ?? '—' }}</span>
                    </div>
                    <div v-if="previewFieldDefs.length === 0" class="record-preview-row">
                        <span class="record-preview-value">{{ displayValue }}</span>
                    </div>
                </div>
                <div class="record-preview-actions">
                    <button class="record-preview-btn record-preview-view-btn" @click.stop="onNavigate" type="button">Voir</button>
                    <button class="record-preview-btn record-preview-unlink-btn" @click.stop="unlinkRecord" type="button">Dissocier</button>
                </div>
            </div>
        </Teleport>

        <!-- Edit mode dropdown (Teleported) -->
        <Teleport :to="teleportTarget" v-if="isEditMode && teleportTarget">
            <div
                class="record-dropdown-wrapper"
                :class="{ 'is-create-mode': showCreateForm }"
                :style="dropdownStyle"
            >
                <!-- Search -->
                <div v-if="!showCreateForm" class="record-search-container">
                    <input
                        ref="searchInput"
                        v-model="searchQuery"
                        type="text"
                        class="record-search-input"
                        placeholder="Rechercher..."
                        @keydown.escape="cancelEditing"
                        @keydown.arrow-down.prevent="highlightNext"
                        @keydown.arrow-up.prevent="highlightPrev"
                        @keydown.enter.prevent="selectHighlighted"
                    />
                </div>

                <!-- Unlink option — outside scrollable list so it's always visible -->
                <div
                    v-if="currentValue != null && !showCreateForm"
                    class="record-dropdown-item record-unlink-item"
                    :class="{ highlighted: highlightedIndex === -1 }"
                    @click="unlinkRecord"
                    @mouseenter="highlightedIndex = -1"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/>
                        <path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/>
                        <line x1="8" y1="2" x2="8" y2="5"/>
                        <line x1="2" y1="8" x2="5" y2="8"/>
                        <line x1="16" y1="19" x2="16" y2="22"/>
                        <line x1="19" y1="16" x2="22" y2="16"/>
                    </svg>
                    Dissocier la fiche
                </div>

                <div
                    v-if="!showCreateForm"
                    ref="dropdownList"
                    class="record-dropdown-list"
                >
                    <!-- Record list -->
                    <div
                        v-for="(record, index) in filteredRecords"
                        :key="record[valueField]"
                        class="record-dropdown-item"
                        :class="{
                            'selected': record[valueField] === currentValue,
                            'highlighted': index === highlightedIndex
                        }"
                        @click="selectRecord(record)"
                        @mouseenter="highlightedIndex = index"
                    >
                        <div class="record-dropdown-item-content">
                            <span class="record-dropdown-item-title">{{ getRecordLabel(record) }}</span>
                            <span
                                v-if="getRecordContext(record)"
                                class="record-dropdown-item-subtitle"
                            >
                                {{ getRecordContext(record) }}
                            </span>
                        </div>
                    </div>

                    <!-- Empty state -->
                    <div v-if="filteredRecords.length === 0 && !isLoadingRecords" class="record-dropdown-empty">
                        Aucune fiche trouvee
                    </div>
                    <div v-if="isLoadingRecords" class="record-dropdown-empty">
                        Chargement...
                    </div>
                </div>

                <!-- Create button — outside scrollable list so it's always visible -->
                <div
                    v-if="allowCreate && !showCreateForm"
                    class="record-dropdown-item record-create-item"
                    :class="{ highlighted: highlightedIndex === filteredRecords.length }"
                    @click="toggleCreateForm"
                    @mouseenter="highlightedIndex = filteredRecords.length"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Creer une fiche
                </div>

                <!-- Inline create form -->
                <div v-if="showCreateForm" class="record-create-form">
                    <div class="record-create-form-title">Nouvelle fiche</div>
                    <div
                        v-for="cf in createFieldDefs"
                        :key="cf.field"
                        class="record-create-field"
                    >
                        <label class="record-create-label">{{ cf.label || cf.field }}</label>
                        <input
                            v-if="cf.type !== 'boolean'"
                            :type="cf.type === 'number' ? 'number' : 'text'"
                            class="record-create-input"
                            v-model="createFormData[cf.field]"
                        />
                        <input
                            v-else
                            type="checkbox"
                            class="record-create-checkbox"
                            v-model="createFormData[cf.field]"
                        />
                    </div>
                    <div class="record-create-form-actions">
                        <button class="record-create-cancel-btn" @click.stop="showCreateForm = false" type="button">Annuler</button>
                        <button class="record-create-submit-btn" @click.stop="submitCreate" :disabled="isCreating" type="button">
                            {{ isCreating ? 'Creation...' : 'Creer' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
// Module-level record cache: Map<cacheKey, { records: [], fetchedAt: number }>
// cacheKey = tableName + '::' + selectString so different select shapes don't collide.
const recordCache = new Map();
const CACHE_TTL_MS = 30_000;

// Deduplicates concurrent fetches: Map<cacheKey, Promise<Array>>
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

function invalidateCache(cacheKey) {
    recordCache.delete(cacheKey);
}

export default {
    name: "RecordCellRenderer",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            currentValue: null,
            originalValue: null,
            allRecords: [],
            isLoadingRecords: false,
            searchQuery: "",
            highlightedIndex: 0,
            // Hover preview
            showPreview: false,
            previewPosition: { top: 0, left: 0 },
            _previewShowTimer: null,
            _previewHideTimer: null,
            // Edit dropdown position
            dropdownPosition: { top: 100, left: 100, width: 200 },
            teleportTarget: null,
            // Create form
            showCreateForm: false,
            createFormData: {},
            isCreating: false,
            // Params cache (ag-grid doesn't update prop after refresh)
            _refreshedParams: null,
        };
    },
    computed: {
        activeParams() {
            return this._refreshedParams || this.params;
        },
        isEditMode() {
            return !!(this.params?.api && this.params?.stopEditing);
        },
        tableName() {
            return this.activeParams?.tableName || this.activeParams?.colDef?.cellRendererParams?.tableName || '';
        },
        valueField() {
            return this.activeParams?.valueField || this.activeParams?.colDef?.cellRendererParams?.valueField || 'id';
        },
        displayField() {
            return this.activeParams?.displayField || this.activeParams?.colDef?.cellRendererParams?.displayField || 'name';
        },
        contextField() {
            return this.activeParams?.contextField || this.activeParams?.colDef?.cellRendererParams?.contextField || '';
        },
        cacheKey() {
            return `${this.tableName}::${this.buildSelectString()}`;
        },
        previewFieldDefs() {
            const pf = this.activeParams?.previewFields || this.activeParams?.colDef?.cellRendererParams?.previewFields || [];
            return Array.isArray(pf) ? pf.filter(Boolean) : [];
        },
        allowCreate() {
            return !!(this.activeParams?.allowCreate || this.activeParams?.colDef?.cellRendererParams?.allowCreate);
        },
        createFieldDefs() {
            const cf = this.activeParams?.createFields || this.activeParams?.colDef?.cellRendererParams?.createFields || [];
            return Array.isArray(cf) ? cf : [];
        },
        currentRecord() {
            if (this.currentValue == null) return null;
            return this.allRecords.find(r => r[this.valueField] === this.currentValue) || null;
        },
        displayValue() {
            if (!this.currentRecord) return this.currentValue != null ? String(this.currentValue) : '';
            return this.resolveNestedValue(this.currentRecord, this.displayField) ?? String(this.currentValue);
        },
        contextValue() {
            if (!this.currentRecord) return '';
            if (!this.contextField) return '';

            const fieldValue = this.contextField
                ? this.resolveNestedValue(this.currentRecord, this.contextField)
                : null;
            return this.normalizeRecordMeta(fieldValue);
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
        dropdownStyle() {
            const style = {
                position: 'fixed',
                left: `${this.dropdownPosition.left}px`,
                minWidth: `${Math.max(220, this.dropdownPosition.width)}px`,
                zIndex: 2000,
            };
            if (this.dropdownPosition.openAbove) {
                style.bottom = `${this.dropdownPosition.bottom + 8}px`;
            } else {
                style.top = `${this.dropdownPosition.top + 8}px`;
            }
            return style;
        },
        previewStyle() {
            return {
                position: 'fixed',
                top: `${this.previewPosition.top}px`,
                left: `${this.previewPosition.left}px`,
                zIndex: 1900,
            };
        },
    },
    mounted() {
        const field = this.params?.colDef?.field;
        const actualValue = this.params?.data?.[field] ?? this.params?.value;
        this.currentValue = actualValue;
        this.originalValue = actualValue;

        this.teleportTarget = this.getCorrectBody();

        // Pre-populate from cache if available, otherwise fetch
        const cached = this.tableName ? getCachedRecords(this.cacheKey) : null;
        if (cached) {
            this.allRecords = cached;
        } else if (this.currentValue != null) {
            this.fetchRecords();
        }

        if (this.isEditMode) {
            this.clearTextSelection();
            this.updateDropdownPosition();
            requestAnimationFrame(() => this.updateDropdownPosition());
            this.$nextTick(() => {
                this.updateDropdownPosition();
                this.$refs.searchInput?.focus();
            });
            setTimeout(() => this.updateDropdownPosition(), 50);
            setTimeout(() => this.addClickOutsideListener(), 100);
            this.fetchRecords();
        }
    },
    beforeUnmount() {
        this.removeClickOutsideListener();
        clearTimeout(this._previewShowTimer);
        clearTimeout(this._previewHideTimer);
    },
    methods: {
        debugLog(...args) {
            const enabled = this.activeParams?.enableDebugLogs || this.activeParams?.colDef?.cellRendererParams?.enableDebugLogs;
            if (enabled) console.log('[Record]', ...args);
        },

        // ─── AG Grid interface ────────────────────────────────────────────────
        refresh(params) {
            this._refreshedParams = params;
            if (!this.isEditMode) {
                const field = params?.colDef?.field;
                const actualValue = params?.data?.[field] ?? params?.value;
                this.currentValue = actualValue;
                this.originalValue = actualValue;
            }
            const cached = this.tableName ? getCachedRecords(this.cacheKey) : null;
            if (cached) {
                this.allRecords = cached;
            } else if (this.currentValue != null && this.allRecords.length === 0) {
                this.fetchRecords();
            }
            return true;
        },
        getValue() {
            return this.currentValue;
        },

        // ─── Record fetching ─────────────────────────────────────────────────
        async fetchRecords() {
            if (!this.tableName) return;

            const cached = getCachedRecords(this.cacheKey);
            if (cached) {
                this.allRecords = cached;
                return;
            }

            // Deduplicate: if another instance is already fetching
            // this table+select combination, piggy-back on that promise instead.
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

            const supabase = this.activeParams?.getSupabaseInstance?.();
            if (!supabase) return;

            this.isLoadingRecords = true;
            const fetchPromise = (async () => {
                try {
                    const selectStr = this.buildSelectString();
                    this.debugLog('Fetch records', { table: this.tableName, select: selectStr });
                    const { data, error } = await supabase
                        .from(this.tableName)
                        .select(selectStr)
                        .limit(100);

                    if (error) {
                        this.debugLog('Fetch records failed', { table: this.tableName, error });
                    }
                    if (!error && data) {
                        this.debugLog('Fetch records success', { table: this.tableName, count: data.length });
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
                if (records) this.allRecords = records;
            } finally {
                this.isLoadingRecords = false;
            }
        },

        buildSelectString() {
            // Parse dot-notation from displayField, contextField, and previewFields.
            // The part before the first '.' is the Supabase resource path and may
            // include a FK hint using '!' (e.g. "app!default_app_id.name").
            // That resource path is used verbatim in the select fragment so Supabase
            // can resolve the correct FK, while resolveNestedValue strips the hint
            // part when traversing the returned data object.
            const allFields = [
                this.displayField,
                this.contextField,
                ...this.previewFieldDefs.map(pf => typeof pf === 'string' ? pf : pf?.field).filter(Boolean),
            ].filter(Boolean);

            const relMap = {}; // resource (with optional !hint) -> Set<subfield>
            for (const f of allFields) {
                const dotIdx = f.indexOf('.');
                if (dotIdx !== -1) {
                    const resource = f.slice(0, dotIdx); // e.g. "app!default_app_id" or "profile"
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
                // Strip FK hint (e.g. "app!default_app_id" → "app") —
                // Supabase keys the returned data by the table/alias name only.
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

        formatTableName(tableName) {
            if (!tableName) return '';

            return String(tableName)
                .replace(/[_-]+/g, ' ')
                .trim()
                .replace(/\b\w/g, char => char.toUpperCase());
        },

        getRecordLabel(record) {
            return this.resolveNestedValue(record, this.displayField) ?? record[this.valueField] ?? '';
        },

        getRecordContext(record) {
            if (!record || !this.contextField) return '';
            return this.normalizeRecordMeta(this.resolveNestedValue(record, this.contextField));
        },

        // ─── Selection ───────────────────────────────────────────────────────
        selectRecord(record) {
            this.debugLog('Select record', { field: this.params?.colDef?.field, value: record[this.valueField], label: this.resolveNestedValue(record, this.displayField) });
            this.currentValue = record[this.valueField];
            this.stopEditing();
        },

        unlinkRecord() {
            this.debugLog('Unlink record', { field: this.params?.colDef?.field, previousValue: this.currentValue });
            this.currentValue = null;
            if (this.isEditMode) {
                this.stopEditing();
            } else {
                // Called from preview popup — use setDataValue to properly trigger onCellValueChanged
                const field = this.params?.colDef?.field;
                if (this.params?.node && field) {
                    this.params.node.setDataValue(field, null);
                }
                this.showPreview = false;
            }
        },

        selectHighlighted() {
            if (this.highlightedIndex === -1 && this.currentValue != null) {
                this.unlinkRecord();
                return;
            }
            if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredRecords.length) {
                this.selectRecord(this.filteredRecords[this.highlightedIndex]);
            } else if (this.allowCreate && this.highlightedIndex === this.filteredRecords.length) {
                this.toggleCreateForm();
            }
        },

        highlightNext() {
            const max = this.filteredRecords.length + (this.allowCreate ? 0 : -1);
            if (this.highlightedIndex < max) this.highlightedIndex++;
        },

        highlightPrev() {
            const min = this.currentValue != null ? -1 : 0;
            if (this.highlightedIndex > min) this.highlightedIndex--;
        },

        // ─── Navigation trigger ──────────────────────────────────────────────
        onNavigate() {
            const onRecordNavigate = this.activeParams?.onRecordNavigate;
            if (onRecordNavigate) {
                onRecordNavigate({
                    record: this.currentRecord,
                    row: this.params?.data,
                    columnId: this.params?.colDef?.field,
                });
            }
            this.showPreview = false;
        },

        // ─── Hover preview ───────────────────────────────────────────────────
        onChipMouseEnter(event) {
            clearTimeout(this._previewHideTimer);
            this._previewShowTimer = setTimeout(() => {
                this.updatePreviewPosition(event);
                this.showPreview = true;
            }, 300);
        },

        onChipMouseLeave() {
            clearTimeout(this._previewShowTimer);
            this._previewHideTimer = setTimeout(() => {
                this.showPreview = false;
            }, 200);
        },

        onPreviewMouseEnter() {
            clearTimeout(this._previewHideTimer);
        },

        onPreviewMouseLeave() {
            this._previewHideTimer = setTimeout(() => {
                this.showPreview = false;
            }, 200);
        },

        updatePreviewPosition(event) {
            if (this.$refs.cellElement) {
                const rect = this.$refs.cellElement.getBoundingClientRect();
                const frontWindow = wwLib?.getFrontWindow?.() || window;
                const viewportWidth = frontWindow.innerWidth;
                const previewWidth = 280;
                let left = rect.left;
                if (left + previewWidth > viewportWidth - 8) {
                    left = Math.max(8, viewportWidth - previewWidth - 8);
                }
                this.previewPosition = {
                    top: rect.bottom + 6,
                    left,
                };
            }
        },

        // ─── Create form ─────────────────────────────────────────────────────
        toggleCreateForm() {
            this.showCreateForm = !this.showCreateForm;
            if (this.showCreateForm) {
                this.createFormData = {};
                for (const cf of this.createFieldDefs) {
                    this.createFormData[cf.field] = cf.type === 'boolean' ? false : '';
                }
            }
        },

        async submitCreate() {
            if (!this.tableName) return;
            const supabase = this.activeParams?.getSupabaseInstance?.();
            if (!supabase) return;

            this.isCreating = true;
            try {
                const payload = { ...this.createFormData };
                this.debugLog('Create record', { table: this.tableName, payload });
                const { data, error } = await supabase
                    .from(this.tableName)
                    .insert(payload)
                    .select()
                    .single();

                if (error) {
                    this.debugLog('Create record failed', { table: this.tableName, error });
                }
                if (!error && data) {
                    this.debugLog('Create record success', { table: this.tableName, data });
                    invalidateCache(this.cacheKey);
                    this.allRecords = [...this.allRecords, data];
                    setCachedRecords(this.cacheKey, this.allRecords);
                    this.showCreateForm = false;
                    this.selectRecord(data);
                }
            } catch (e) {
                // silent
            } finally {
                this.isCreating = false;
            }
        },

        // ─── Edit mode lifecycle ─────────────────────────────────────────────
        stopEditing() {
            this.removeClickOutsideListener();
            if (this.params?.stopEditing) this.params.stopEditing();
        },

        cancelEditing() {
            this.currentValue = this.originalValue;
            this.removeClickOutsideListener();
            if (this.params?.stopEditing) this.params.stopEditing(true);
        },

        // ─── Position helpers ─────────────────────────────────────────────────
        updateDropdownPosition() {
            if (this.$refs.cellElement) {
                const rect = this.$refs.cellElement.getBoundingClientRect();
                const frontWindow = wwLib?.getFrontWindow?.() || window;
                const viewportWidth = frontWindow.innerWidth;
                const viewportHeight = frontWindow.innerHeight;
                const dropdownEstimatedHeight = 350;
                const dropdownWidth = Math.max(220, rect.width);
                const spaceBelow = viewportHeight - rect.bottom;
                const openAbove = spaceBelow < dropdownEstimatedHeight && rect.top > spaceBelow;

                // Clamp left so the dropdown doesn't overflow the right edge
                let left = rect.left >= 0 ? rect.left : 0;
                if (left + dropdownWidth > viewportWidth - 8) {
                    left = Math.max(8, viewportWidth - dropdownWidth - 8);
                }

                this.dropdownPosition = {
                    top: rect.bottom > 0 ? rect.bottom : rect.top + 30,
                    bottom: viewportHeight - rect.top,
                    left,
                    width: rect.width > 0 ? rect.width : 220,
                    openAbove,
                };
            }
        },

        getCorrectBody() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            return frontDocument.body;
        },

        clearTextSelection() {
            const frontWindow = wwLib?.getFrontWindow?.() || window;
            const sel = frontWindow.getSelection?.();
            if (sel) {
                if (sel.removeAllRanges) sel.removeAllRanges();
                else if (sel.empty) sel.empty();
            }
        },

        handleClickOutside(event) {
            const wrapper = this.$refs.dropdownList?.closest?.('.record-dropdown-wrapper');
            if (wrapper && !wrapper.contains(event.target)) {
                this.stopEditing();
            }
        },

        addClickOutsideListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.addEventListener('mousedown', this.handleClickOutside);
        },

        removeClickOutsideListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.removeEventListener('mousedown', this.handleClickOutside);
        },
    },
};
</script>

<style scoped lang="scss">
.record-cell {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    padding: 4px 8px;
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    contain: layout style;
}

.record-cell:hover {
    cursor: pointer;
}

.record-cell:has(.record-display.is-editing):hover {
    cursor: default;
}

.record-display {
    width: 100%;
    display: flex;
    align-items: center;
    min-width: 0;
}

.record-display.is-editing {
    opacity: 0.85;
}

.record-pill {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: auto;
    background: var(--ww-data-grid_record-pill-background, #f8fafc);
    border: 1px solid var(--ww-data-grid_record-pill-border-color, #e2e8f0);
    border-radius: 6px;
    padding: 4px 6px 4px calc(var(--ww-data-grid_record-pill-accent-width, 4px) + 10px);
    font-family: inherit;
    overflow: hidden;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.record-pill:not(.has-subtitle) {
    min-height: 1.75rem;
    padding-top: 3px;
    padding-bottom: 3px;
}

.record-pill.has-subtitle {
    min-height: 1.875rem;
}

.record-pill.is-editing {
    pointer-events: none;
    cursor: default;
}

.record-pill:hover {
    transform: translateX(2px);
    box-shadow: var(
        --ww-data-grid_record-pill-hover-shadow,
        0 10px 24px rgba(15, 23, 42, 0.12),
        0 2px 6px rgba(15, 23, 42, 0.08)
    );
    border-color: color-mix(
        in srgb,
        var(--ww-data-grid_record-pill-accent-color, #2563eb) 30%,
        var(--ww-data-grid_record-pill-border-color, #e2e8f0)
    );
}

.record-pill:focus-within {
    border-color: color-mix(
        in srgb,
        var(--ww-data-grid_record-pill-accent-color, #2563eb) 30%,
        var(--ww-data-grid_record-pill-border-color, #e2e8f0)
    );
}

.record-pill:hover .record-nav-btn,
.record-pill:focus-within .record-nav-btn {
    opacity: 1;
    transform: translateX(0);
}

.record-pill-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--ww-data-grid_record-pill-accent-width, 4px);
    background: var(--ww-data-grid_record-pill-accent-color, #2563eb);
    flex-shrink: 0;
}

.record-pill-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    flex: 1;
    min-width: 0;
}

.record-pill-name {
    color: var(--ww-data-grid_record-pill-text-primary, #0f172a);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    width: 100%;
}

.record-pill-subtitle {
    color: var(--ww-data-grid_record-pill-text-secondary, #94a3b8);
    font-size: 11px;
    font-weight: 400;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    width: 100%;
}

.record-nav-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    width: 20px;
    height: 20px;
    padding: 0;
    margin-left: 6px;
    cursor: pointer;
    color: var(--ww-data-grid_record-pill-text-secondary, #64748b);
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out, color 0.2s ease-in-out;

    &:hover {
        color: var(--ww-data-grid_record-pill-text-primary, #0f172a);
    }
}

.record-empty {
    display: inline-flex;
    align-items: center;
    gap: 0;
    min-width: 0;
    color: var(--ww-data-grid_record-pill-text-secondary, #94a3b8);
    transition: color 0.2s ease-in-out;
}

.record-empty.is-editing {
    opacity: 0.85;
}

.record-empty-icon {
    position: relative;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
}

.record-empty-line {
    position: absolute;
    left: 50%;
    top: 50%;
    background: currentColor;
    border-radius: 999px;
    transform-origin: center;
    transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
}

.record-empty-line-horizontal {
    width: 12px;
    height: 1.5px;
    transform: translate(-50%, -50%);
}

.record-empty-line-vertical {
    width: 1.5px;
    height: 12px;
    transform: translate(-50%, -50%) scaleY(0);
    opacity: 0;
}

.record-empty-text {
    max-width: 0;
    margin-left: 0;
    overflow: hidden;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    opacity: 0;
    transform: translateX(-4px);
    transition:
        max-width 0.2s ease-in-out,
        margin-left 0.2s ease-in-out,
        opacity 0.2s ease-in-out,
        transform 0.2s ease-in-out;
}

.record-display:not(.is-editing):hover .record-empty {
    color: var(--ww-data-grid_record-pill-accent-color, #2563eb);
}

.record-display:not(.is-editing):hover .record-empty-line-vertical {
    transform: translate(-50%, -50%) scaleY(1);
    opacity: 1;
}

.record-display:not(.is-editing):hover .record-empty-text {
    max-width: 80px;
    margin-left: 8px;
    opacity: 1;
    transform: translateX(0);
}

// ─── Hover Preview ───────────────────────────────────────────────────────────

.record-preview {
    background: white;
    border-radius: 12px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
    border: 1px solid #e5e7eb;
    min-width: 240px;
    max-width: 360px;
    padding: 12px;
    font-family: inherit;
    font-size: 13px;
}

.record-preview-header {
    display: flex;
    align-items: stretch;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eef2f7;
}

.record-preview-header-accent {
    width: 3px;
    align-self: stretch;
    border-radius: 999px;
    background: var(--ww-data-grid_record-pill-accent-color, #2563eb);
    flex-shrink: 0;
}

.record-preview-header-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.record-preview-title {
    color: #0f172a;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.record-preview-subtitle {
    color: #64748b;
    font-size: 11px;
    font-weight: 400;
    line-height: 1.2;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.record-preview-fields {
    margin-bottom: 12px;
}

.record-preview-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid #f3f4f6;

    &:last-child {
        border-bottom: none;
    }
}

.record-preview-label {
    color: #6b7280;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
}

.record-preview-value {
    color: #111827;
    font-size: 13px;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.record-preview-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.record-preview-btn {
    padding: 5px 12px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    transition: background 0.15s;
}

.record-preview-view-btn {
    background: var(--ww-data-grid_record-pill-accent-color, #2563eb);
    color: white;

    &:hover {
        background: color-mix(in srgb, var(--ww-data-grid_record-pill-accent-color, #2563eb) 85%, black);
    }
}

.record-preview-unlink-btn {
    background: #f3f4f6;
    color: #374151;

    &:hover {
        background: #fee2e2;
        color: #dc2626;
    }
}

// ─── Edit Dropdown ───────────────────────────────────────────────────────────

.record-dropdown-wrapper {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    border: none;
    font-family: inherit;
    font-size: 14px;
    overflow: hidden;
    padding-top: 8px;
    position: relative;
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
}

.record-search-container {
    padding: 8px 8px 4px;
}

.record-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    font-size: 13px;
    font-family: inherit;
    outline: none;

    &:focus {
        border-color: #1a56db;
        box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.15);
    }
}

.record-dropdown-list {
    max-height: 260px;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
    padding: 4px 8px 8px;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
    }
}

.record-dropdown-item {
    padding: 8px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 13px;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 6px;

    &:hover,
    &.highlighted {
        background: #f3f4f6;
    }

    &.selected {
        background: #e8f0fe;
        color: #1a56db;
        font-weight: 500;
    }
}

.record-dropdown-item-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
}

.record-dropdown-item-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.record-dropdown-item-subtitle {
    color: #94a3b8;
    font-size: 11px;
    font-weight: 400;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.record-unlink-item {
    color: #dc2626;
    border-bottom: 1px solid #f3f4f6;
    margin: 0 8px;
    padding: 8px 8px 10px;
    flex-shrink: 0;

    &:hover,
    &.highlighted {
        background: #fee2e2;
    }
}

.record-create-item {
    color: #1a56db;
    border-top: 1px solid #f3f4f6;
    margin: 0 8px;
    padding: 10px 8px 8px;
    flex-shrink: 0;

    &:hover,
    &.highlighted {
        background: #e8f0fe;
    }
}

.record-dropdown-empty {
    padding: 10px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
}

// ─── Create Form ─────────────────────────────────────────────────────────────

.record-create-form {
    padding: 12px;
}

.record-create-form-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 10px;
}

.record-create-field {
    margin-bottom: 8px;
}

.record-create-label {
    display: block;
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 3px;
}

.record-create-input {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    outline: none;

    &:focus {
        border-color: #1a56db;
        box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.12);
    }
}

.record-create-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin: 0;
    border-radius: 4px;
    border: 2px solid #cbd5e1;
    background: white;
    cursor: pointer;
    position: relative;
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &:checked {
        border-color: #1a56db;
        background: #1a56db;
    }

    &:checked::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }

    &:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.12);
    }
}

.record-create-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
}

.record-create-cancel-btn {
    padding: 5px 12px;
    border-radius: 5px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;

    &:hover {
        background: #f3f4f6;
    }
}

.record-create-submit-btn {
    padding: 5px 12px;
    border-radius: 5px;
    border: none;
    background: #1a56db;
    color: white;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: #1648c0;
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}
</style>
