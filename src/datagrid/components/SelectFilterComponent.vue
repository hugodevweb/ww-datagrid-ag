<template>
    <div class="select-filter">
        <!-- Placeholders — insert a runtime token (e.g. %CURRENT_USER%) -->
        <div v-if="placeholderNames.length" class="select-filter-ph">
            <button
                v-for="name in placeholderNames"
                :key="'ph-' + name"
                type="button"
                class="select-filter-option select-ph-option"
                :class="{ selected: isPlaceholderSelected(name) }"
                @click="togglePlaceholder(name)"
            >
                <span class="option-content">
                    <span class="checkbox" :class="{ checked: isPlaceholderSelected(name) }">
                        <span class="checkbox-icon">&#10003;</span>
                    </span>
                    <span class="select-ph-glyph" v-html="glyphHtml(name)"></span>
                    <span class="label">{{ displayName(name) }}</span>
                </span>
            </button>
        </div>
        <div v-if="isLoadingOptions" class="select-filter-empty">
            Loading options...
        </div>
        <div v-else-if="orderedOptions.length" class="select-filter-options">
            <button
                v-for="(option, index) in orderedOptions"
                :key="option.value ?? option.label ?? index"
                type="button"
                class="select-filter-option"
                :class="{ selected: pendingSelection.has(option.value) }"
                :style="getOptionStyle(option)"
                @click="toggleOption(option.value)"
            >
                    <span class="option-content">
                        <span class="checkbox" :class="{ checked: pendingSelection.has(option.value) }">
                            <span class="checkbox-icon">&#10003;</span>
                        </span>
                        <span class="label">{{ option.label }}</span>
                    </span>
            </button>
        </div>
        <div v-else class="select-filter-empty">
            No options available
        </div>
        <div class="select-filter-actions">
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
import { getPlaceholderNamesForKind, makeToken, resolveValues, placeholderDisplayName, placeholderGlyphHtml } from '../../shared/utils/placeholders.js';

export default {
    name: "SelectFilterComponent",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    // Expose methods for AG Grid filter interface
    expose: ['getGui', 'isFilterActive', 'doesFilterPass', 'getModel', 'setModel', 'onParentModelChanged', 'refresh'],
    data() {
        return {
            selectParams: {},
            rawOptions: [],
            pendingSelection: new Set(), // Store values (IDs), not labels
            appliedSelection: new Set(), // Store values (IDs), not labels
            refreshTimer: null,
        };
    },
    created() {
        console.log('[SelectFilterComponent] created() called with params:', this.params);
        if (!this.params) {
            console.error('[SelectFilterComponent] ERROR: params is null/undefined in created()!');
        } else {
            console.log('[SelectFilterComponent] params.filterParams:', this.params.filterParams);
            console.log('[SelectFilterComponent] params.colDef:', this.params.colDef);
        }
    },
    mounted() {
        console.log('[SelectFilterComponent] mounted() called');
        console.log('[SelectFilterComponent] mounted - params:', this.params);

        // Initialize options after mounting
        if (this.params) {
            // Filter params are in colDef.filterParams, not directly on params
            const filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};
            console.log('[SelectFilterComponent] Using filterParams:', filterParams);

            this.setSelectParams(filterParams);
            this.syncSelectionsFromModel(null, { updateApplied: true });

            console.log('[SelectFilterComponent] After setSelectParams - rawOptions:', this.rawOptions);
            console.log('[SelectFilterComponent] After setSelectParams - processedOptions:', this.processedOptions);
        } else {
            console.error('[SelectFilterComponent] ERROR: Cannot initialize - params is null/undefined!');
        }

        // Set up a periodic check for options (in case they load asynchronously)
        // This is a fallback for cases where watchers don't catch the change
        // Keeps running to detect option changes at any time
        this.refreshTimer = setInterval(() => {
            if (!this.params) return;

            const currentOptions = this.getCurrentOptions();

            // Check if options have changed by comparing stringified versions
            const currentOptionsStr = JSON.stringify(currentOptions || []);
            const rawOptionsStr = JSON.stringify(this.rawOptions || []);

            if (currentOptionsStr !== rawOptionsStr) {
                // Options have changed, refresh
                this.setSelectParams(this.params.filterParams);
            }
        }, 500); // Check every 500ms for option changes
    },
    beforeUnmount() {
        // Clean up the interval
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },
    computed: {
        processedOptions() {
            return this.normalizeOptions(this.rawOptions, this.selectParams);
        },
        orderedOptions() {
            if (!this.processedOptions?.length) {
                return [];
            }
            const selected = [];
            const unselected = [];
            for (const option of this.processedOptions) {
                // Compare by value (ID) since we store values in the selection
                if (this.pendingSelection.has(option.value)) {
                    selected.push(option);
                } else {
                    unselected.push(option);
                }
            }
            return [...selected, ...unselected];
        },
        isLoadingOptions() {
            // Show loading only if isLoading is true AND options array is empty or not available
            // If options are available, don't show loading even if isLoading flag is true
            const isLoading = !!this.selectParams?.isLoading;
            const hasOptions = Array.isArray(this.rawOptions) && this.rawOptions.length > 0;
            return isLoading && !hasOptions;
        },
        translations() {
            const filterParams = this.params?.colDef?.filterParams || this.params?.filterParams || {};
            const defaultTranslations = { reset: 'Reset', apply: 'Apply' };
            return filterParams.translations || defaultTranslations;
        },
        canApply() {
            if (!this.pendingSelection.size && !this.appliedSelection.size) {
                return false;
            }
            return !this.areSetsEqual(this.pendingSelection, this.appliedSelection);
        },
        canReset() {
            return this.pendingSelection.size > 0 || this.appliedSelection.size > 0;
        },
        placeholderNames() {
            return getPlaceholderNamesForKind('select');
        },
    },
    watch: {
        // Watch for changes in params to refresh options
        'params.colDef.filterParams': {
            handler(newParams) {
                if (newParams) {
                    this.setSelectParams(newParams);
                }
            },
            deep: true,
            immediate: false,
        },
        // Specifically watch for options changes in selectOptions
        'params.colDef.filterParams.selectOptions.options': {
            handler(newOptions, oldOptions) {
                // Only refresh if options actually changed
                if (newOptions !== oldOptions && Array.isArray(newOptions)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setSelectParams(filterParams);
                }
            },
            deep: true,
            immediate: false,
        },
        // Watch for changes in cellRendererParams and cellEditorParams options
        'params.colDef.cellRendererParams.options': {
            handler(newOptions, oldOptions) {
                if (newOptions !== oldOptions && Array.isArray(newOptions)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setSelectParams(filterParams);
                }
            },
            deep: true,
            immediate: false,
        },
        'params.colDef.cellEditorParams.options': {
            handler(newOptions, oldOptions) {
                if (newOptions !== oldOptions && Array.isArray(newOptions)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setSelectParams(filterParams);
                }
            },
            deep: true,
            immediate: false,
        },
    },
    methods: {
        // AG Grid filter interface methods
        getGui() {
            return this.$el;
        },
        getCurrentOptions() {
            // Helper method to get current options from params
            if (!this.params) return null;

            // CRITICAL FIX: Use grid API to get the LATEST column definition
            // The original params.colDef may be stale if column definitions were updated
            // after the filter was created (e.g., when async data loads)
            let colDef = this.params.colDef || {};

            // Try to get fresh column definition from grid API
            if (this.params.api && this.params.column) {
                try {
                    const colId = this.params.column.getColId();
                    const freshColDef = this.params.api.getColumnDef(colId);
                    if (freshColDef) {
                        colDef = freshColDef;
                    }
                } catch (e) {
                    // Fallback to original colDef if API call fails
                }
            }

            const filterParams = colDef.filterParams || this.params.filterParams || {};
            const selectOptions = filterParams.selectOptions || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};

            // Check in priority order
            if (Array.isArray(selectOptions.options)) {
                return selectOptions.options;
            }
            if (Array.isArray(editorParams.options)) {
                return editorParams.options;
            }
            if (Array.isArray(rendererParams.options)) {
                return rendererParams.options;
            }

            return null;
        },
        refresh(newParams) {
            console.log('[SelectFilterComponent] refresh() called with:', newParams);

            // Refresh options when called
            if (this.params) {
                // Try to get fresh column definition from grid API
                let filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};

                if (this.params.api && this.params.column) {
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

                this.setSelectParams(filterParams);
            }

            return true;
        },
        setSelectParams(filterParams = {}) {
            let colDef = this.params?.colDef || {};
            let rendererParams = colDef.cellRendererParams || {};
            let editorParams = colDef.cellEditorParams || {};

            // CRITICAL FIX: Try to get fresh column definition from grid API
            // This ensures we get the latest data even if the original params are stale
            if (this.params?.api && this.params?.column) {
                try {
                    const colId = this.params.column.getColId();
                    const freshColDef = this.params.api.getColumnDef(colId);
                    if (freshColDef) {
                        colDef = freshColDef;
                        rendererParams = freshColDef.cellRendererParams || {};
                        editorParams = freshColDef.cellEditorParams || {};
                        // Also update filterParams if fresh one has options
                        if (freshColDef.filterParams?.selectOptions?.options?.length > 0) {
                            filterParams = freshColDef.filterParams;
                        }
                    }
                } catch (e) {
                    // Fallback to original params
                }
            }
            
            // Extract selectOptions from filterParams (passed via filterParams.selectOptions)
            const selectOptions = filterParams?.selectOptions || filterParams || {};
            
            // Priority order: filterParams.selectOptions > editorParams > rendererParams
            // This ensures filter gets the same options as the cell renderer/editor
            let options = null;
            let resolveMappingFormula = null;
            let optionsValueFormula = null;
            let optionsLabelFormula = null;
            let optionsColorFormula = null;
            let isLoading = null;
            
            // Try to get from filterParams.selectOptions first (this is the primary source)
            if (selectOptions && typeof selectOptions === 'object') {
                // Check if options is an array (even if empty, we want to use it)
                if (Array.isArray(selectOptions.options)) {
                    options = selectOptions.options;
                }
                resolveMappingFormula = selectOptions.resolveMappingFormula;
                optionsValueFormula = selectOptions.optionsValueFormula;
                optionsLabelFormula = selectOptions.optionsLabelFormula;
                optionsColorFormula = selectOptions.optionsColorFormula;
                isLoading = selectOptions.isLoading;
            }
            
            // Fallback to editor params (check if it's an array, even if empty)
            if (options === null && Array.isArray(editorParams.options)) {
                options = editorParams.options;
                if (!resolveMappingFormula) resolveMappingFormula = editorParams.resolveMappingFormula;
                if (!optionsValueFormula) optionsValueFormula = editorParams.optionsValueFormula;
                if (!optionsLabelFormula) optionsLabelFormula = editorParams.optionsLabelFormula;
                if (!optionsColorFormula) optionsColorFormula = editorParams.optionsColorFormula;
                if (isLoading === null || isLoading === undefined) isLoading = editorParams.isLoading;
            }
            
            // Fallback to renderer params (check if it's an array, even if empty)
            if (options === null && Array.isArray(rendererParams.options)) {
                options = rendererParams.options;
                if (!resolveMappingFormula) resolveMappingFormula = rendererParams.resolveMappingFormula;
                if (!optionsValueFormula) optionsValueFormula = rendererParams.optionsValueFormula;
                if (!optionsLabelFormula) optionsLabelFormula = rendererParams.optionsLabelFormula;
                if (!optionsColorFormula) optionsColorFormula = rendererParams.optionsColorFormula;
                if (isLoading === null || isLoading === undefined) isLoading = rendererParams.isLoading;
            }
            
            // Last resort: extract unique values from row data if options aren't available
            // Only do this if we don't have options yet (not even an empty array)
            if (options === null && this.params?.api) {
                const field = colDef?.field;
                if (field) {
                    const uniqueValues = new Set();
                    this.params.api.forEachNode((node) => {
                        if (node.data && field in node.data) {
                            const value = node.data[field];
                            if (value != null && value !== '') {
                                uniqueValues.add(value);
                            }
                        }
                    });
                    if (uniqueValues.size > 0) {
                        // Convert Set to array of option objects
                        options = Array.from(uniqueValues).map((value) => ({
                            value: value,
                            label: String(value),
                            color: '#f2f2f2',
                        }));
                    } else {
                        // Set to empty array if no unique values found
                        options = [];
                    }
                } else {
                    // No field, set to empty array
                    options = [];
                }
            }
            
            // Ensure options is always an array (default to empty array)
            if (!Array.isArray(options)) {
                options = [];
            }
            
            // If we have options, set isLoading to false (options are available)
            if (options.length > 0) {
                isLoading = false;
                console.log('[SelectFilterComponent] Options loaded:', options.length, 'options', options);
            }
            
            // Check if options just became available (transition from 0 to >0)
            const previousOptionsCount = this.rawOptions?.length || 0;
            const optionsJustLoaded = previousOptionsCount === 0 && options.length > 0;

            // Build merged params - ensure we always have an array, even if empty
            const mergedParams = {
                options: options,
                resolveMappingFormula: resolveMappingFormula,
                optionsValueFormula: optionsValueFormula,
                optionsLabelFormula: optionsLabelFormula,
                optionsColorFormula: optionsColorFormula,
                isLoading: isLoading || false,
            };

            this.selectParams = mergedParams;
            this.rawOptions = [...options]; // Always use a copy to ensure reactivity

            // Log when options are set (including empty arrays)
            if (options.length === 0) {
                console.log('[SelectFilterComponent] No options available yet, isLoading:', isLoading);
            }

            // CRITICAL FIX: If options just loaded and we have an active filter,
            // notify AG Grid to re-apply filtering. This fixes the issue where
            // filters don't work on page refresh because options weren't loaded
            // when the initial filter model was applied.
            if (optionsJustLoaded && this.isFilterActive()) {
                console.log('[SelectFilterComponent] Options loaded with active filter, triggering re-filter');
                // Use nextTick to ensure the component state is fully updated
                this.$nextTick(() => {
                    this.params?.filterChangedCallback?.();
                });
            }
        },
        getModel() {
            if (!this.isFilterActive()) {
                return null;
            }
            // Store values (IDs) in the model for proper filtering by ID
            return {
                type: "selectFilter",
                values: Array.from(this.appliedSelection), // These are values (IDs)
            };
        },
        setModel(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        onParentModelChanged(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        isFilterActive() {
            return this.appliedSelection.size > 0;
        },
        doesFilterPass(params) {
            if (!this.isFilterActive()) {
                return true;
            }
            // Resolve placeholder tokens (e.g. %CURRENT_USER%) to real values before matching.
            const selection = new Set(resolveValues(Array.from(this.appliedSelection)));
            // Get the row value (ID) and check if it's in the applied selection (which contains IDs)
            const rowValue = this.getRowValue(params);
            if (rowValue == null || rowValue === undefined) {
                return false; // Null/undefined values don't match any filter
            }
            return selection.has(rowValue);
        },
        toggleOption(value) {
            // Store values (IDs) in the selection
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
        syncSelectionsFromModel(model, { updateApplied } = { updateApplied: true }) {
            // Model values are expected to be IDs (values), not labels
            if (!model || !Array.isArray(model.values) || model.values.length === 0) {
                if (updateApplied) {
                    this.appliedSelection = new Set();
                }
                this.pendingSelection = updateApplied ? new Set(this.appliedSelection) : new Set();
                return;
            }
            // Create Set from model values (which should be IDs)
            const next = new Set(model.values);
            if (updateApplied) {
                this.appliedSelection = new Set(next);
            }
            this.pendingSelection = new Set(next);
        },
        getRowValue(filterParams) {
            // AG Grid passes the result of filterValueGetter as params.value
            // For select columns, this is the raw value (ID), not the label
            if (filterParams && "value" in filterParams) {
                return filterParams.value;
            }
            // Fallback: try to get from data field directly
            const field = this.params?.colDef?.field;
            if (field && filterParams?.data && Object.prototype.hasOwnProperty.call(filterParams.data, field)) {
                // Return the raw value (ID) directly
                return filterParams.data[field];
            }
            return undefined;
        },
        normalizeOptions(rawOptions, selectParams) {
            const options = Array.isArray(rawOptions) ? rawOptions : [];
            if (!options.length) {
                return [];
            }
            const resolve = typeof selectParams?.resolveMappingFormula === "function"
                ? selectParams.resolveMappingFormula
                : null;
            const hasFormulas = !!(
                resolve &&
                (selectParams?.optionsValueFormula ||
                    selectParams?.optionsLabelFormula ||
                    selectParams?.optionsColorFormula)
            );
            return options.map((option, index) => {
                if (hasFormulas) {
                    const value =
                        resolve(selectParams.optionsValueFormula, option) ??
                        option?.value ??
                        option?.label ??
                        `option-${index}`;
                    const label =
                        resolve(selectParams.optionsLabelFormula, option) ??
                        option?.label ??
                        value;
                    const color =
                        resolve(selectParams.optionsColorFormula, option) ??
                        option?.color ??
                        "#f2f2f2";
                    return { value, label, color };
                }
                const value = option?.value ?? option?.label ?? `option-${index}`;
                const label = option?.label ?? option?.value ?? "";
                const color = option?.color ?? "#f2f2f2";
                return { value, label, color };
            });
        },
        areSetsEqual(a, b) {
            if (a.size !== b.size) return false;
            for (const value of a) {
                if (!b.has(value)) return false;
            }
            return true;
        },
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
        getOptionStyle(option) {
            const backgroundColor = option.color || "#ffffff";
            // Always use white for accent/text color
            const textColor = "#ffffff";
            return {
                backgroundColor,
                color: textColor,
                "--select-filter-border": textColor,
            };
        },
    },
};
</script>

<style scoped lang="scss">
.select-filter {
    display: flex;
    flex-direction: column;
    min-width: 240px;
    max-width: 320px;
    max-height: 360px;
    font-family: inherit;
    color: inherit;
}

.select-filter-options {
    padding: 8px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.select-filter-ph {
    padding: 8px 8px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 4px;
}
.select-ph-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
    padding: 0 4px;
}
.select-ph-option {
    background: color-mix(in srgb, var(--ww-data-grid_filter-accent-color, #2563eb) 8%, #fff);
}
.select-ph-option.selected {
    border-color: var(--ww-data-grid_filter-accent-color, #2563eb) !important;
}
.select-ph-glyph {
    font-weight: 700;
    letter-spacing: -1px;
    color: #6b7280;
    margin-right: 2px;
    display: inline-flex;
    align-items: center;
}
.select-ph-glyph :deep(svg) { width: 16px; height: 16px; }

.select-filter-option {
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 8px 12px;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.4;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    width: 100%;
    text-align: left;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

    &:hover {
        filter: brightness(0.95);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &.selected {
        border-color: var(--select-filter-border, rgba(0, 0, 0, 0.35));
        box-shadow:
            0 0 0 2px rgba(0, 0, 0, 0.08),
            0 6px 18px rgba(0, 0, 0, 0.2);
    }
}

.option-content {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
}

.checkbox {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;

    &-icon {
        font-size: 12px;
        line-height: 1;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.15s ease;
        color: #ffffff;
    }

    &.checked {
        border-color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.3);

        .checkbox-icon {
            opacity: 1;
            transform: scale(1);
        }
    }
}

.label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    color: #ffffff;
}

.select-filter-actions {
    padding: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.filter-btn {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    color: #333333;
    cursor: pointer;
    font-weight: 400;
    padding: 6px 16px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;

    &.reset {
        background-color: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: #333333;
    }

    &.apply {
        background-color: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: #333333;
    }

    &:hover {
        background-color: #f5f5f5;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: #ffffff;
    }
}

.select-filter-empty {
    padding: 16px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.6);
}
</style>
