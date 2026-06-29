<template>
    <div ref="cellElement" class="select-cell">
        <!-- Loading skeleton -->
        <div v-if="isLoadingState" class="select-skeleton">
            <div class="skeleton-shimmer"></div>
        </div>
        <!-- Normal display -->
        <span v-else class="select-label" :style="cellStyle">{{ displayLabel }}</span>
        
        <Teleport :to="teleportTarget" v-if="isEditMode && teleportTarget">
            <div
                ref="dropdownWrapper"
                class="select-dropdown-wrapper"
                :class="{ 'placement-above': dropdownPlacement === 'above' }"
                :style="dropdownStyle"
            >
                <div
                    ref="selectElement"
                    class="select-dropdown"
                    tabindex="0"
                    @keydown.escape="cancelEditing"
                    @keydown.enter.prevent="selectHighlightedOption"
                    @keydown.arrow-down.prevent="highlightNextOption"
                    @keydown.arrow-up.prevent="highlightPreviousOption"
                >
                    <div 
                        v-for="(option, index) in processedOptions" 
                        :key="option.value"
                        class="select-option"
                        :class="{
                            'selected': option.value === selectedValue,
                            'highlighted': index === highlightedIndex
                        }"
                        :style="getOptionStyle(option)"
                        @click="selectOption(option)"
                        @mouseenter="highlightedIndex = index"
                    >
                        {{ option.label }}
                        <svg v-if="option.value === selectedValue" class="select-option-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
// Module-level WeakMap cache for processed options.
// Keyed by the raw options array reference — avoids re-running formula mapping
// for every SelectCellRenderer instance that shares the same column options.
const processedOptionsCache = new WeakMap();

// Returns a cache key string for formula-mapped options (plain object key for Map).
function buildFormulaOptionsKey(valueFormula, labelFormula, colorFormula) {
    return `${valueFormula?.code || ''}|${labelFormula?.code || ''}|${colorFormula?.code || ''}`;
}

// A simple Map used as a second-level cache when options is the same reference
// and formula codes match (covers the case where options is recreated each render).
const formulaOptionsCache = new Map();
// Limit the formula cache size to avoid unbounded growth.
const FORMULA_CACHE_MAX = 50;

// Stable style constant for cells with no matching option.
// Returning the same frozen reference means Vue's :style binding sees no change
// on re-render, avoiding unnecessary DOM updates for cells without a colour.
const STYLE_TRANSPARENT = Object.freeze({ backgroundColor: 'transparent', color: 'inherit' });

export default {
    name: "SelectCellRenderer",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    data() {
        // Pre-check if options are already available at creation time.
        // This prevents showing a skeleton flash when the component is recreated
        // (e.g., due to columnDefs recomputation) but the options data is already loaded.
        const editorParams = this.params?.colDef?.cellEditorParams || {};
        const rendererParams = this.params?.colDef?.cellRendererParams || {};
        const rawOptions = this.params?.options || editorParams?.options || rendererParams?.options || [];
        const optionsAlreadyAvailable = Array.isArray(rawOptions) && rawOptions.length > 0;
        
        return {
            selectedValue: null,
            originalValue: null,
            dropdownPosition: { top: 100, cellTop: 100, left: 100, width: 200 }, // Better initial values
            dropdownLeftAdjustment: 0, // Pixel shift applied after viewport clamping
            dropdownPlacement: 'below', // 'below' or 'above' depending on viewport room
            dropdownMaxHeight: null, // Set when neither side fits the full panel
            teleportTarget: null,
            highlightedIndex: -1,
            hasEverRendered: optionsAlreadyAvailable, // Skip skeleton if options already loaded
            optionsTimedOut: false, // true after fallback timer — only then do we give up on skeleton
            _skeletonFallbackTimer: null, // timeout to stop skeleton when options never arrive
            _refreshedParams: null, // ag-grid-vue3 does not update the params prop after refresh(); cache manually
            _cancelled: false, // set by cancelEditing so isCancelAfterEnd() discards the value
        };
    },
    computed: {
        // Detect if we're in edit mode - AG Grid creates a new instance when editing
        isEditMode() {
            // When AG Grid uses this as an editor, it's in edit mode
            // We detect this by checking if we're being used as a cell editor
            return this.params?.api && this.params?.stopEditing;
        },
        // Detect loading state from params
        isLoadingState() {
            // Check both editor and renderer params for isLoading
            const editorParams = this.params?.colDef?.cellEditorParams || {};
            const rendererParams = this.params?.colDef?.cellRendererParams || {};

            // Check if explicitly loading (from parent component)
            if (this.params?.isLoading || editorParams?.isLoading || rendererParams?.isLoading) {
                return true;
            }

            const hasValue = this.selectedValue != null && this.selectedValue !== '';
            const optionsNotLoaded = this.processedOptions.length === 0;

            // Always show skeleton when we have a value but options haven't loaded yet.
            // This prevents showing raw UUIDs while options are being fetched.
            // Only give up after the fallback timer sets optionsTimedOut.
            if (hasValue && optionsNotLoaded && !this.optionsTimedOut) {
                return true;
            }

            // On initial load, also show skeleton if options loaded but no match found
            if (!this.hasEverRendered) {
                const hasNoMatchingOption = hasValue && this.processedOptions.length > 0 && !this.currentOption;
                if (hasNoMatchingOption) {
                    return true;
                }
            }

            return false;
        },
        processedOptions() {
            // ag-grid-vue3 does not update the params prop after calling refresh().
            // We cache the latest params received in refresh() into _refreshedParams and prefer it here.
            const activeParams = this._refreshedParams || this.params;

            // AG Grid editor params are nested - try both locations
            const editorParams = activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = activeParams?.colDef?.cellRendererParams || {};

            // Get options from either editor params or renderer params
            const options = activeParams?.options ||
                           editorParams?.options ||
                           rendererParams?.options ||
                           [];

            const resolveMappingFormula = activeParams?.resolveMappingFormula ||
                                         editorParams?.resolveMappingFormula ||
                                         rendererParams?.resolveMappingFormula;
            
            if (!Array.isArray(options) || options.length === 0) {
                return [];
            }

            // Check if we need to use formula mapping (for dynamically bound options)
            const valueFormula = activeParams?.optionsValueFormula || editorParams?.optionsValueFormula;
            const labelFormula = activeParams?.optionsLabelFormula || editorParams?.optionsLabelFormula;
            const colorFormula = activeParams?.optionsColorFormula || editorParams?.optionsColorFormula;
            const hasFormulas = valueFormula || labelFormula || colorFormula;

            // Static options path — keyed by the options array reference via WeakMap.
            // All rows sharing the same column will share the same computed result
            // without redundant .map() calls on every new renderer instance.
            if (!hasFormulas || !resolveMappingFormula) {
                if (processedOptionsCache.has(options)) {
                    return processedOptionsCache.get(options);
                }
                const result = options.map(option => ({
                    value: option?.value ?? '',
                    label: option?.label ?? option?.value ?? '',
                    color: option?.color ?? '#f0f0f0',
                }));
                processedOptionsCache.set(options, result);
                return result;
            }

            // Formula-mapped options — use a composite cache key (options ref + formula codes).
            // We use the options array reference plus formula identifiers to avoid running
            // resolveMappingFormula for every renderer instance on the same column.
            const formulaKey = buildFormulaOptionsKey(valueFormula, labelFormula, colorFormula);
            
            if (processedOptionsCache.has(options)) {
                const cached = processedOptionsCache.get(options);
                if (cached.__formulaKey === formulaKey) {
                    return cached.result;
                }
            }

            // Also check the flat Map cache (handles new array instances with identical formula codes)
            const flatCacheKey = `${formulaKey}::${JSON.stringify(options).slice(0, 200)}`;
            if (formulaOptionsCache.has(flatCacheKey)) {
                return formulaOptionsCache.get(flatCacheKey);
            }

            const result = options.map(option => {
                const value = resolveMappingFormula(valueFormula, option) ?? option.value;
                const label = resolveMappingFormula(labelFormula, option) ?? option.label;
                const color = resolveMappingFormula(colorFormula, option) ?? option.color;
                return {
                    value: value ?? '',
                    label: label ?? value ?? '',
                    color: color ?? '#f0f0f0',
                };
            });

            // Store in both caches
            processedOptionsCache.set(options, { __formulaKey: formulaKey, result });
            if (formulaOptionsCache.size >= FORMULA_CACHE_MAX) {
                // Evict the oldest entry to keep memory bounded
                formulaOptionsCache.delete(formulaOptionsCache.keys().next().value);
            }
            formulaOptionsCache.set(flatCacheKey, result);

            return result;
        },
        currentOption() {
            // Always use selectedValue which is kept up-to-date by both the
            // watcher (on mount) and refresh() (on data changes).
            // Previously this read from this.params.data in display mode, but
            // ag-grid-vue3 does not update the params prop after refresh(),
            // so the old value would persist on screen.
            return this.processedOptions.find(opt => opt.value === this.selectedValue) || null;
        },
        displayLabel() {
            // Only show the label if we have a matching option
            // This prevents showing raw values with gray backgrounds
            if (this.currentOption) {
                return this.currentOption.label;
            }
            
            // If we have options available but no match, show empty
            // This prevents showing raw values while options are being processed
            if (this.processedOptions.length > 0) {
                return '';
            }
            
            // If no options are available yet and we're in loading state, show empty
            if (this.isLoadingState) {
                return '';
            }
            
            // Only show the raw value if we explicitly have no options configured
            // (static case where col.options is undefined/empty)
            return this.params?.value || '';
        },
        cellStyle() {
            // Only apply colored background if we have a matching option.
            if (this.currentOption) {
                const bgColor = this.currentOption.color || '#f0f0f0';
                // Cache the style object by (value, color) key so that repeat
                // renders of the same selection return the same reference.
                // Vue's :style binding skips the DOM update when the reference
                // hasn't changed, which matters across thousands of scroll cells.
                const key = `${this.currentOption.value}|${bgColor}`;
                if (this._cellStyleKey === key) return this._cellStyleObj;
                this._cellStyleKey = key;
                this._cellStyleObj = { backgroundColor: bgColor, color: '#ffffff' };
                return this._cellStyleObj;
            }

            // For cells without a matching option return the shared frozen constant.
            // This prevents the gray flash while options are loading/processing
            // and always yields the same object reference → no DOM diffing churn.
            return STYLE_TRANSPARENT;
        },
        dropdownColumns() {
            // Calculate columns: 1 column per 6 options
            const optionsCount = this.processedOptions.length;
            return Math.ceil(optionsCount / 6);
        },
        dropdownStyle() {
            const columns = this.dropdownColumns;
            const minWidth = Math.max(200, columns * 200); // 200px per column minimum
            const maxWidth = columns * 300; // 300px per column maximum

            const centerLeft = this.dropdownPosition.left + this.dropdownLeftAdjustment;
            const isAbove = this.dropdownPlacement === 'above';
            const top = isAbove
                ? this.dropdownPosition.cellTop - 8
                : this.dropdownPosition.top + 8;
            const transform = isAbove
                ? 'translate(-50%, -100%)'
                : 'translateX(-50%)';

            const style = {
                position: 'fixed',
                top: `${top}px`,
                left: `${centerLeft}px`,
                transform,
                minWidth: `${minWidth}px`,
                maxWidth: `${maxWidth}px`,
                zIndex: 2000, // Above filter menus (1000) but reasonable
                '--dropdown-columns': columns,
            };
            if (this.dropdownMaxHeight != null) {
                style.maxHeight = `${this.dropdownMaxHeight}px`;
                style.overflowY = 'auto';
            }
            return style;
        },
    },
    mounted() {
        // Get the actual value from data field, not params.value (which might be the label)
        const actualValue = this.params?.data?.[this.params?.colDef?.field] ?? this.params?.value;
        this.selectedValue = actualValue;
        this.originalValue = actualValue;

        // Set the correct teleport target (iframe's body or parent body)
        this.teleportTarget = this.getCorrectBody();

        // Set initial highlighted index to current selection
        this.highlightedIndex = this.processedOptions.findIndex(opt => opt.value === this.selectedValue);
        if (this.highlightedIndex === -1 && this.processedOptions.length > 0) {
            this.highlightedIndex = 0;
        }

        // Mark as rendered once we have options available and properly matched
        this.$nextTick(() => {
            if (this.processedOptions.length > 0) {
                const hasValue = this.selectedValue != null && this.selectedValue !== '';
                const hasMatchingOption = this.processedOptions.find(opt => opt.value === this.selectedValue);
                
                // Mark as rendered if we don't have a value or we found a matching option
                if (!hasValue || hasMatchingOption) {
                    this.hasEverRendered = true;
                }
            } else if (!this.isEditMode) {
                // Options not loaded: stop showing skeleton after a short delay so we don't stay stuck
                // when col.options is undefined (e.g. dynamic binding never populated)
                this._skeletonFallbackTimer = setTimeout(() => {
                    this._skeletonFallbackTimer = null;
                    if (this.processedOptions.length === 0) {
                        this.optionsTimedOut = true;
                        this.hasEverRendered = true;
                    }
                }, 5000);
            }
        });
        
        // If in edit mode, calculate position and focus the dropdown immediately
        if (this.isEditMode) {
            // Clear any text selection from the double-click
            this.clearTextSelection();
            
            // Use multiple approaches to ensure positioning works
            this.updateDropdownPosition();
            
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => {
                this.updateDropdownPosition();
            });
            
            // Also after next tick
            this.$nextTick(() => {
                this.updateDropdownPosition();
                
                if (this.$refs.selectElement) {
                    this.$refs.selectElement.focus();
                }
            });
            
            // One more update after a small delay as final fallback
            setTimeout(() => {
                this.updateDropdownPosition();
            }, 50);

            // Catch Enter/Escape at the document level (capture phase) so they work
            // regardless of where focus lands. The dropdown is teleported to the body
            // and focus sits on a <div>, which loses focus easily — without this, the
            // template's @keydown handlers silently miss and both keys appear dead.
            this.addKeyboardListener();

            // Add click outside listener to close dropdown
            setTimeout(() => {
                this.addClickOutsideListener();
            }, 100);
        }
    },
    beforeUnmount() {
        if (this._skeletonFallbackTimer) {
            clearTimeout(this._skeletonFallbackTimer);
            this._skeletonFallbackTimer = null;
        }
        // Clean up click outside listener
        this.removeClickOutsideListener();
        this.removeKeyboardListener();
    },
    watch: {
        isEditMode(newVal) {
            if (newVal) {
                // Recalculate position when entering edit mode
                this.$nextTick(() => {
                    this.updateDropdownPosition();
                });
            }
        },
        // Mark as rendered when options become available and we have a matching option
        processedOptions: {
            handler(newOptions) {
                if (newOptions.length > 0) {
                    // Options arrived — clear the fallback timer and reset timeout flag
                    if (this._skeletonFallbackTimer) {
                        clearTimeout(this._skeletonFallbackTimer);
                        this._skeletonFallbackTimer = null;
                    }
                    this.optionsTimedOut = false;

                    if (!this.hasEverRendered) {
                        // Only mark as rendered if:
                        // 1. We don't have a value (empty cell), OR
                        // 2. We have a value and found a matching option
                        const hasValue = this.selectedValue != null && this.selectedValue !== '';
                        const hasMatchingOption = newOptions.find(opt => opt.value === this.selectedValue);

                        if (!hasValue || hasMatchingOption) {
                            this.hasEverRendered = true;
                        }
                    }
                }
            },
            immediate: true,
        },
    },
    methods: {
        // AG Grid interface: called when the cell needs to update without full recreate.
        // Returning true keeps the existing component instance alive and lets Vue's
        // reactivity handle any param/value changes via the params prop.
        refresh(params) {
            // ag-grid-vue3 does not update the params prop reactively after refresh().
            // Cache the latest params here so processedOptions and other computeds pick up new options.
            this._refreshedParams = params;
            if (!this.isEditMode) {
                const actualValue = params?.data?.[params?.colDef?.field] ?? params?.value;
                this.selectedValue = actualValue;
                this.originalValue = actualValue;
            }
            return true;
        },
        handleClickOutside(event) {
            // Close dropdown if clicking outside
            const dropdown = this.$refs.selectElement?.parentElement;
            if (dropdown && !dropdown.contains(event.target)) {
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
        // Document-level Enter/Escape handling (capture phase) so the keys work
        // even when the teleported dropdown <div> doesn't hold focus. Mirrors the
        // pattern used by WewebCellRenderer. Only Enter/Escape are intercepted —
        // arrow keys still reach the dropdown's @keydown handlers for navigation.
        handleEditorKeydown(event) {
            if (!this.isEditMode) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.cancelEditing();
            } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                this.selectHighlightedOption();
            }
        },
        addKeyboardListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.addEventListener('keydown', this.handleEditorKeydown, true);
        },
        removeKeyboardListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.removeEventListener('keydown', this.handleEditorKeydown, true);
        },
        clearTextSelection() {
            // Clear any text selection that might have occurred from double-click
            const frontWindow = wwLib?.getFrontWindow?.() || window;
            const selection = frontWindow.getSelection?.();
            if (selection) {
                if (selection.removeAllRanges) {
                    selection.removeAllRanges();
                } else if (selection.empty) {
                    selection.empty();
                }
            }
        },
        getCorrectBody() {
            // Use wwLib to get the correct document (handles iframe vs parent)
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            return frontDocument.body;
        },
        updateDropdownPosition() {
            if (this.$refs.cellElement) {
                const rect = this.$refs.cellElement.getBoundingClientRect();

                // Ensure we have valid dimensions
                const width = rect.width > 0 ? rect.width : 200; // fallback to 200px
                const top = rect.bottom > 0 ? rect.bottom : rect.top + 30;
                const cellTop = rect.top;
                // Center the dropdown on the cell column
                const center = rect.left + rect.width / 2;

                this.dropdownLeftAdjustment = 0;
                this.dropdownPlacement = 'below';
                this.dropdownMaxHeight = null;
                this.dropdownPosition = { top, cellTop, left: center, width };

                // After the dropdown renders at the centered position, clamp to viewport
                this.$nextTick(() => this.clampDropdownToViewport());
            }
        },
        clampDropdownToViewport() {
            const wrapper = this.$refs.dropdownWrapper;
            if (!wrapper) return;

            const frontWindow = wwLib?.getFrontWindow?.() || window;
            const rect = wrapper.getBoundingClientRect();
            const viewportWidth = frontWindow.innerWidth
                || document.documentElement.clientWidth;
            const viewportHeight = frontWindow.innerHeight
                || document.documentElement.clientHeight;
            const margin = 8;

            let adjustment = 0;
            if (rect.right > viewportWidth - margin) {
                adjustment -= rect.right - (viewportWidth - margin);
            }
            if (rect.left < margin) {
                adjustment += margin - rect.left;
            }
            if (adjustment !== 0) {
                this.dropdownLeftAdjustment = adjustment;
            }

            // Vertical clamping: flip above the cell when there isn't room below.
            if (!this.$refs.cellElement) return;
            const cellRect = this.$refs.cellElement.getBoundingClientRect();
            const dropdownHeight = rect.height;
            const spaceBelow = viewportHeight - cellRect.bottom - margin;
            const spaceAbove = cellRect.top - margin;

            if (dropdownHeight <= spaceBelow) {
                // Fits below — leave default placement
                return;
            }
            if (dropdownHeight <= spaceAbove) {
                this.dropdownPlacement = 'above';
                return;
            }
            // Neither side fits the full panel — pick the larger side and clamp height.
            if (spaceAbove > spaceBelow) {
                this.dropdownPlacement = 'above';
                this.dropdownMaxHeight = Math.max(0, spaceAbove);
            } else {
                this.dropdownPlacement = 'below';
                this.dropdownMaxHeight = Math.max(0, spaceBelow);
            }
        },
        // AG Grid editor interface method
        // Returns the actual value (ID), not the label
        getValue() {
            return this.selectedValue;
        },
        // AG Grid cancel hook. params.stopEditing(true) does not cancel (its arg is
        // suppressNavigateAfterEdit), so returning true here is what makes AG Grid
        // actually discard the edit when Escape is pressed.
        isCancelAfterEnd() {
            return this._cancelled === true;
        },
        // AG Grid editor interface method
        // Called by AG Grid before completing the edit to validate the current value
        getValidationErrors() {
            const cb = this.params?.getValidationErrors;
            if (typeof cb !== 'function') return null;
            return cb({ value: this.getValue(), data: this.params?.data });
        },
        stopEditing() {
            // Remove listeners
            this.removeClickOutsideListener();
            this.removeKeyboardListener();
            // Call AG Grid's stopEditing if available
            if (this.params?.stopEditing) {
                this.params.stopEditing();
            }
        },
        cancelEditing() {
            this._cancelled = true;
            this.selectedValue = this.originalValue;
            // Remove listeners
            this.removeClickOutsideListener();
            this.removeKeyboardListener();
            // Stop editing; isCancelAfterEnd() (returning _cancelled) makes AG Grid
            // discard the value. The stopEditing arg is suppressNavigateAfterEdit,
            // NOT a cancel flag, so it can't be relied on to cancel.
            if (this.params?.stopEditing) {
                this.params.stopEditing(true);
            }
        },
        selectOption(option) {
            // Update the selected value (stores the ID/value, not the label) and close dropdown
            this.selectedValue = option.value; // Store the actual ID/value
            this.stopEditing();
        },
        selectHighlightedOption() {
            // Select the currently highlighted option
            if (this.highlightedIndex >= 0 && this.highlightedIndex < this.processedOptions.length) {
                const option = this.processedOptions[this.highlightedIndex];
                this.selectOption(option);
            }
        },
        highlightNextOption() {
            // Move highlight down
            if (this.highlightedIndex < this.processedOptions.length - 1) {
                this.highlightedIndex++;
                this.scrollToHighlighted();
            }
        },
        highlightPreviousOption() {
            // Move highlight up
            if (this.highlightedIndex > 0) {
                this.highlightedIndex--;
                this.scrollToHighlighted();
            }
        },
        scrollToHighlighted() {
            // Scroll the highlighted option into view
            this.$nextTick(() => {
                const dropdown = this.$refs.selectElement;
                if (!dropdown) return;
                
                const highlightedElement = dropdown.querySelector('.select-option.highlighted');
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({
                        block: 'nearest',
                        behavior: 'smooth',
                    });
                }
            });
        },
        getOptionStyle(option) {
            // Color code the options in the dropdown with !important to override browser defaults
            const bgColor = option.color || '#ffffff';
            // Always use white for text color
            const textColor = '#ffffff';
            
            return {
                'background-color': `${bgColor} !important`,
                'color': `${textColor} !important`,
            };
        },
    },
};
</script>

<style scoped lang="scss">
.select-cell {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    cursor: pointer;
    // No base transition — avoids triggering an animation on every scroll-in.
    // Transitions are declared only on :hover states so they fire on interaction, not mount.
    user-select: none; // Prevent text selection on double-click
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    position: relative;
    contain: layout style; // Isolate layout/style recalculations to within this cell
}

.select-label {
    font-size: 14px;
    font-family: inherit;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 8px 12px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    // No base transition — declaring transitions only on :hover prevents them
    // from firing when new rows enter the viewport during scrolling.
    
    &:hover {
        filter: brightness(0.95);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        transition: filter 0.15s ease, box-shadow 0.15s ease;
    }
}

.select-skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    
    .skeleton-shimmer {
        width: 80%;
        height: 20px;
        background: linear-gradient(
            90deg,
            #e2e8f0 0%,
            #f1f5f9 50%,
            #e2e8f0 100%
        );
        background-size: 200% 100%;
        border-radius: 6px;
        animation: shimmer 1.5s ease-in-out infinite;
    }
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

.select-dropdown-wrapper {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    overflow: visible;
    border: none;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    font-size: inherit;
    font-family: inherit;
    font-weight: inherit;
    line-height: inherit;
    position: relative;
    padding-top: 8px;

    // Arrow pointing to the cell
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid white;
        transform: translateX(-50%) translateY(-100%);
    }

    // When the dropdown opens above the cell, point the arrow downward
    // and move it to the bottom edge of the panel.
    &.placement-above {
        padding-top: 0;
        padding-bottom: 8px;

        &::before {
            top: auto;
            bottom: 0;
            border-bottom: none;
            border-top: 8px solid white;
            transform: translateX(-50%) translateY(100%);
        }
    }
}

.select-dropdown {
    width: 100%;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
    border: none;
    font-size: inherit;
    font-family: inherit;
    font-weight: inherit;
    line-height: inherit;
    background-color: white;
    outline: none;
    padding: 8px;
    border-radius: 8px;
    
    // Dynamic column layout based on number of options
    display: grid;
    grid-template-columns: repeat(var(--dropdown-columns, 2), 1fr);
    gap: 8px;
    
    &:focus {
        outline: none;
    }
    
    // Custom scrollbar styling
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
        
        &:hover {
            background: rgba(0, 0, 0, 0.3);
        }
    }
}

.select-option {
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.4;
    border-radius: 6px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    &.highlighted {
        filter: brightness(0.9);
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
    
    &.selected {
        .select-option-check {
            position: absolute;
            right: 8px;
            flex-shrink: 0;
        }
    }
    
    &:hover {
        filter: brightness(0.95);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    
    &:active {
        filter: brightness(0.88);
    }
}
</style>

