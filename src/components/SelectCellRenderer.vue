<template>
    <div ref="cellElement" class="select-cell">
        <span class="select-label" :style="cellStyle">{{ displayLabel }}</span>
        
        <Teleport :to="teleportTarget" v-if="isEditMode && teleportTarget">
            <div 
                class="select-dropdown-wrapper" 
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
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
export default {
    name: "SelectCellRenderer",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            selectedValue: null,
            originalValue: null,
            dropdownPosition: { top: 100, left: 100, width: 200 }, // Better initial values
            teleportTarget: null,
            highlightedIndex: -1,
        };
    },
    computed: {
        // Detect if we're in edit mode - AG Grid creates a new instance when editing
        isEditMode() {
            // When AG Grid uses this as an editor, it's in edit mode
            // We detect this by checking if we're being used as a cell editor
            return this.params?.api && this.params?.stopEditing;
        },
        processedOptions() {
            // AG Grid editor params are nested - try both locations
            const editorParams = this.params?.colDef?.cellEditorParams || {};
            const rendererParams = this.params?.colDef?.cellRendererParams || {};
            
            // Get options from either editor params or renderer params
            const options = this.params?.options || 
                           editorParams?.options || 
                           rendererParams?.options || 
                           [];
            
            const resolveMappingFormula = this.params?.resolveMappingFormula || 
                                         editorParams?.resolveMappingFormula || 
                                         rendererParams?.resolveMappingFormula;
            
            if (!Array.isArray(options) || options.length === 0) {
                return [];
            }

            // Check if we need to use formula mapping (for dynamically bound options)
            const hasFormulas = (this.params?.optionsValueFormula || editorParams?.optionsValueFormula) || 
                               (this.params?.optionsLabelFormula || editorParams?.optionsLabelFormula) || 
                               (this.params?.optionsColorFormula || editorParams?.optionsColorFormula);

            // If no formulas, return options as-is (static options)
            if (!hasFormulas || !resolveMappingFormula) {
                return options.map(option => ({
                    value: option?.value || '',
                    label: option?.label || option?.value || '',
                    color: option?.color || '#f0f0f0',
                }));
            }

            // Map options using formulas for dynamically bound data
            const valueFormula = this.params?.optionsValueFormula || editorParams?.optionsValueFormula;
            const labelFormula = this.params?.optionsLabelFormula || editorParams?.optionsLabelFormula;
            const colorFormula = this.params?.optionsColorFormula || editorParams?.optionsColorFormula;
            
            return options.map(option => {
                const value = resolveMappingFormula(valueFormula, option) ?? option.value;
                const label = resolveMappingFormula(labelFormula, option) ?? option.label;
                const color = resolveMappingFormula(colorFormula, option) ?? option.color;
                
                return {
                    value: value || '',
                    label: label || value || '',
                    color: color || '#f0f0f0',
                };
            });
        },
        currentOption() {
            // Get the actual value from the data, not from params.value 
            // (params.value might be the label if valueGetter is used)
            const value = this.isEditMode 
                ? this.selectedValue 
                : (this.params?.data?.[this.params?.colDef?.field] ?? this.params?.value);
            return this.processedOptions.find(opt => opt.value === value) || null;
        },
        displayLabel() {
            return this.currentOption?.label || this.params?.value || '';
        },
        cellStyle() {
            const bgColor = this.currentOption?.color || '#f0f0f0';
            const textColor = this.getContrastColor(bgColor);
            
            return {
                backgroundColor: bgColor,
                color: textColor,
            };
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
            
            return {
                position: 'fixed',
                top: `${this.dropdownPosition.top + 8}px`, // Add gap for the arrow
                left: `${this.dropdownPosition.left}px`,
                minWidth: `${minWidth}px`,
                maxWidth: `${maxWidth}px`,
                zIndex: 2000, // Above filter menus (1000) but reasonable
                '--dropdown-columns': columns,
            };
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
            
            // Add click outside listener to close dropdown
            setTimeout(() => {
                this.addClickOutsideListener();
            }, 100);
        }
    },
    beforeUnmount() {
        // Clean up click outside listener
        this.removeClickOutsideListener();
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
    },
    methods: {
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
                const left = rect.left >= 0 ? rect.left : 0;
                
                this.dropdownPosition = {
                    top: top,
                    left: left,
                    width: width,
                };
            }
        },
        // AG Grid editor interface method
        // Returns the actual value (ID), not the label
        getValue() {
            return this.selectedValue;
        },
        stopEditing() {
            // Remove click outside listener
            this.removeClickOutsideListener();
            // Call AG Grid's stopEditing if available
            if (this.params?.stopEditing) {
                this.params.stopEditing();
            }
        },
        cancelEditing() {
            this.selectedValue = this.originalValue;
            // Remove click outside listener
            this.removeClickOutsideListener();
            // Call AG Grid's stopEditing with cancel flag
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
            const textColor = this.getContrastColor(bgColor);
            
            return {
                'background-color': `${bgColor} !important`,
                'color': `${textColor} !important`,
            };
        },
        getContrastColor(hexColor) {
            // Convert hex to RGB
            if (!hexColor) return '#000000';
            
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            // Calculate relative luminance
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            
            // Return black for light backgrounds, white for dark backgrounds
            return luminance > 0.5 ? '#000000' : '#ffffff';
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
    transition: all 0.2s ease;
    user-select: none; // Prevent text selection on double-click
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    position: relative;
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
    transition: all 0.15s ease;
    
    &:hover {
        filter: brightness(0.95);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
        &::after {
            content: '✓';
            position: absolute;
            right: 10px;
            font-weight: bold;
            font-size: 16px;
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

