<template>
    <div class="select-filter">
        <div v-if="isLoadingOptions" class="select-filter-empty">
            Loading options...
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
                Reset
            </button>
            <button
                type="button"
                class="filter-btn apply"
                :disabled="!canApply"
                @click="onApply"
            >
                Apply
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: "SelectFilterComponent",
    data() {
        return {
            params: null,
            selectParams: {},
            rawOptions: [],
            pendingSelection: new Set(),
            appliedSelection: new Set(),
        };
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
            return !!this.selectParams?.isLoading;
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
        'params.colDef': {
            handler() {
                if (this.params) {
                    this.setSelectParams(this.params.filterParams);
                }
            },
            deep: true,
            immediate: false,
        },
        'params.filterParams': {
            handler(newParams) {
                if (newParams) {
                    this.setSelectParams(newParams);
                }
            },
            deep: true,
            immediate: false,
        },
    },
    methods: {
        agInit(params) {
            this.params = params;
            this.setSelectParams(params.filterParams);
            this.syncSelectionsFromModel(null, { updateApplied: true });
        },
        refresh(params) {
            if (params) {
                this.params = params;
                this.setSelectParams(params.filterParams);
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
                if (Array.isArray(selectOptions.options) && selectOptions.options.length > 0) {
                    options = selectOptions.options;
                }
                resolveMappingFormula = selectOptions.resolveMappingFormula;
                optionsValueFormula = selectOptions.optionsValueFormula;
                optionsLabelFormula = selectOptions.optionsLabelFormula;
                optionsColorFormula = selectOptions.optionsColorFormula;
                isLoading = selectOptions.isLoading;
            }
            
            // Fallback to editor params
            if ((!options || options.length === 0) && Array.isArray(editorParams.options) && editorParams.options.length > 0) {
                options = editorParams.options;
                if (!resolveMappingFormula) resolveMappingFormula = editorParams.resolveMappingFormula;
                if (!optionsValueFormula) optionsValueFormula = editorParams.optionsValueFormula;
                if (!optionsLabelFormula) optionsLabelFormula = editorParams.optionsLabelFormula;
                if (!optionsColorFormula) optionsColorFormula = editorParams.optionsColorFormula;
                if (isLoading === null || isLoading === undefined) isLoading = editorParams.isLoading;
            }
            
            // Fallback to renderer params
            if ((!options || options.length === 0) && Array.isArray(rendererParams.options) && rendererParams.options.length > 0) {
                options = rendererParams.options;
                if (!resolveMappingFormula) resolveMappingFormula = rendererParams.resolveMappingFormula;
                if (!optionsValueFormula) optionsValueFormula = rendererParams.optionsValueFormula;
                if (!optionsLabelFormula) optionsLabelFormula = rendererParams.optionsLabelFormula;
                if (!optionsColorFormula) optionsColorFormula = rendererParams.optionsColorFormula;
                if (isLoading === null || isLoading === undefined) isLoading = rendererParams.isLoading;
            }
            
            // Last resort: extract unique values from row data if options aren't available
            if ((!options || options.length === 0) && this.params?.api) {
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
                    }
                }
            }
            
            // Build merged params - ensure we always have an array, even if empty
            const mergedParams = {
                options: Array.isArray(options) ? options : [],
                resolveMappingFormula: resolveMappingFormula,
                optionsValueFormula: optionsValueFormula,
                optionsLabelFormula: optionsLabelFormula,
                optionsColorFormula: optionsColorFormula,
                isLoading: isLoading || false,
            };
            
            this.selectParams = mergedParams;
            this.rawOptions = Array.isArray(mergedParams.options) ? [...mergedParams.options] : [];
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
</style>
