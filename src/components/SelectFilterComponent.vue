<template>
    <div class="select-filter">
        <div v-if="isLoadingOptions || isLoadingOptionsState" class="select-filter-empty">
            <div class="loading-with-refresh">
                <span>Loading options...</span>
                <button 
                    type="button" 
                    class="refresh-btn" 
                    @click="refreshOptions"
                    title="Refresh options list"
                >
                    <span class="refresh-icon">↻</span>
                </button>
            </div>
        </div>
        <div v-else-if="orderedOptions.length" class="select-filter-options">
            <button
                v-for="(option, index) in orderedOptions"
                :key="option.value ?? option.label ?? index"
                type="button"
                class="select-filter-option"
                :class="{ selected: pendingSelection.has(option.label) }"
                :style="getOptionStyle(option)"
                @click="toggleOption(option.value)"
            >
                    <span class="option-content">
                        <span class="checkbox" :class="{ checked: pendingSelection.has(option.label) }">
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
            pendingSelection: new Set(),
            appliedSelection: new Set(),
            refreshTimer: null,
            loadingStartTime: null, // Track when loading started
        };
    },
    created() {
        // Try to load options immediately when component is created
        // This helps in production where reactive properties might not be immediately available
        if (this.params) {
            const colDef = this.params.colDef || {};
            const filterParams = colDef.filterParams || this.params.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Try filterParams first
            if (filterParams && Object.keys(filterParams).length > 0) {
                this.setSelectParams(filterParams);
            }
            
            // If still no options, try editor params
            if (this.rawOptions.length === 0 && editorParams && Object.keys(editorParams).length > 0) {
                this.setSelectParams(editorParams);
            }
            
            // If still no options, try renderer params
            if (this.rawOptions.length === 0 && rendererParams && Object.keys(rendererParams).length > 0) {
                this.setSelectParams(rendererParams);
            }
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
                // Compare by label since we store labels in the selection
                if (this.pendingSelection.has(option.label)) {
                    selected.push(option);
                } else {
                    unselected.push(option);
                }
            }
            return [...selected, ...unselected];
        },
        isLoadingOptions() {
            // Priority: Show data if available, regardless of isLoading flag
            const hasOptions = Array.isArray(this.processedOptions) && this.processedOptions.length > 0;
            const isLoading = !!this.selectParams?.isLoading;
            
            // If we have options, never show loading
            if (hasOptions) {
                this.loadingStartTime = null; // Reset loading timer
                return false;
            }
            
            // Only show loading if flag is true AND we don't have options
            // Add timeout: if loading > 3s, show refresh button instead
            if (isLoading && !hasOptions) {
                // Track when loading started
                if (!this.loadingStartTime) {
                    this.loadingStartTime = Date.now();
                }
                
                // Check if we've been loading too long (> 3 seconds)
                const loadingDuration = Date.now() - this.loadingStartTime;
                if (loadingDuration > 3000) {
                    // Stop showing loading, show refresh button instead
                    return false;
                }
                return true;
            }
            
            // Reset loading timer if not loading
            this.loadingStartTime = null;
            return false;
        },
        isLoadingOptionsState() {
            // Check if we should show refresh button (loading > 3s with no options)
            const hasOptions = Array.isArray(this.processedOptions) && this.processedOptions.length > 0;
            const isLoading = !!this.selectParams?.isLoading;
            
            if (hasOptions) return false;
            if (!isLoading) return false;
            
            if (this.loadingStartTime) {
                const loadingDuration = Date.now() - this.loadingStartTime;
                return loadingDuration > 3000;
            }
            
            return false;
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
            immediate: true, // Run immediately for production
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
            immediate: true, // Run immediately for production
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
            immediate: true, // Run immediately for production
        },
        'params.colDef.cellEditorParams.options': {
            handler(newOptions, oldOptions) {
                if (newOptions !== oldOptions && Array.isArray(newOptions)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setSelectParams(filterParams);
                }
            },
            deep: true,
            immediate: true, // Run immediately for production
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

            const colDef = this.params.colDef || {};
            const filterParams = this.params.filterParams || {};
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
                const filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};
                this.setSelectParams(filterParams);
            }

            return true;
        },
        setSelectParams(filterParams = {}) {
            const colDef = this.params?.colDef || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
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
            }
            
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
        },
        getModel() {
            if (!this.isFilterActive()) {
                return null;
            }
            // Store labels in the model (matching what filterValueGetter returns)
            return {
                type: "selectFilter",
                values: Array.from(this.appliedSelection), // These are labels, not values
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
            const rowValue = this.getRowValue(params);
            return this.appliedSelection.has(rowValue);
        },
        toggleOption(value) {
            // Store labels in the selection, not values
            // This matches what filterValueGetter returns
            const option = this.processedOptions.find(opt => opt.value === value);
            const label = option ? option.label : value;
            
            const nextSelection = new Set(this.pendingSelection);
            if (nextSelection.has(label)) {
                nextSelection.delete(label);
            } else {
                nextSelection.add(label);
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
            if (!model || !Array.isArray(model.values) || model.values.length === 0) {
                if (updateApplied) {
                    this.appliedSelection = new Set();
                }
                this.pendingSelection = updateApplied ? new Set(this.appliedSelection) : new Set();
                return;
            }
            const next = new Set(model.values);
            if (updateApplied) {
                this.appliedSelection = new Set(next);
            }
            this.pendingSelection = new Set(next);
        },
        getRowValue(filterParams) {
            // AG Grid passes the result of filterValueGetter as params.value
            // For select columns, this is the label, not the raw value
            if (filterParams && "value" in filterParams) {
                return filterParams.value;
            }
            // Fallback: try to get from data field directly
            const field = this.params?.colDef?.field;
            if (field && filterParams?.data && Object.prototype.hasOwnProperty.call(filterParams.data, field)) {
                // If filterValueGetter is defined, we shouldn't reach here
                // But if we do, we need to convert value to label
                const rawValue = filterParams.data[field];
                return this.getValueLabel(rawValue);
            }
            return undefined;
        },
        getValueLabel(value) {
            // Convert a value to its label using the processed options
            const option = this.processedOptions.find(opt => opt.value === value);
            return option ? option.label : value;
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
        refreshOptions() {
            // Force refresh by re-checking all sources
            this.loadingStartTime = Date.now(); // Reset loading timer
            
            // Try multiple sources
            const colDef = this.params?.colDef || {};
            const filterParams = colDef.filterParams || this.params?.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Try filterParams first
            if (filterParams && Object.keys(filterParams).length > 0) {
                this.setSelectParams(filterParams);
            }
            
            // If still no options, try editor params
            if (this.rawOptions.length === 0 && editorParams && Object.keys(editorParams).length > 0) {
                this.setSelectParams(editorParams);
            }
            
            // If still no options, try renderer params
            if (this.rawOptions.length === 0 && rendererParams && Object.keys(rendererParams).length > 0) {
                this.setSelectParams(rendererParams);
            }
            
            // Also try to extract from grid data as fallback
            if (this.params?.api) {
                this.params.api.refreshCells();
            }
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

.loading-with-refresh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.refresh-btn {
    background: none;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
        background-color: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.3);
    }
    
    &:active {
        transform: scale(0.95);
    }
}

.refresh-icon {
    font-size: 16px;
    line-height: 1;
    display: inline-block;
    transition: transform 0.3s ease;
}

.refresh-btn:hover .refresh-icon {
    transform: rotate(180deg);
}
</style>
