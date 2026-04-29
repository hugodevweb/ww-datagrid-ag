<template>
    <div
        class="ww-cell-renderer"
        :class="{ 'edit-mode': isEditMode }"
        @click="handleClick"
        @mousedown="handleMouseDown"
    >
        <wwLayoutItemContext
            is-repeat
            :index="activeParams.node.sourceRowIndex"
            :data="{ value: activeParams.value, row: activeParams.data, columnId: columnId }"
        >
            <wwElement v-bind="activeParams.containerId" class="ww-cell-renderer-flexbox"></wwElement>
        </wwLayoutItemContext>
    </div>
</template>

<script>
export default {
    name: "WewebCellRenderer",
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
            wasCancelled: false,
            // ag-grid-vue3 does not update the params prop reactively after refresh().
            // We cache the latest params received in refresh() here so the template
            // and computeds pick up new cell values without needing the full
            // destroy/recreate cycle (refresh() now returns true).
            _refreshedParams: null,
        };
    },
    computed: {
        // Prefer params received via refresh() over the initial prop, since
        // ag-grid-vue3 doesn't propagate prop changes after refresh.
        activeParams() {
            return this._refreshedParams || this.params;
        },
        // Detect if we're in edit mode - AG Grid creates a new instance when editing
        isEditMode() {
            // When AG Grid uses this as an editor, it's in edit mode
            // We detect this by checking if we're being used as a cell editor
            return this.activeParams?.api && this.activeParams?.stopEditing;
        },
        // Get the column ID for mappable data
        columnId() {
            // Try multiple ways to get the column ID
            return this.activeParams?.column?.getColId() ||
                   this.activeParams?.colDef?.colId ||
                   this.activeParams?.colDef?.field ||
                   null;
        },
    },
    mounted() {
        // Get the actual value from data field
        const actualValue = this.params?.data?.[this.params?.colDef?.field] ?? this.params?.value;
        this.currentValue = actualValue;
        this.originalValue = actualValue;
        
        // If in edit mode, emit the cellEditStart event
        if (this.isEditMode && this.params?.trigger) {
            this.params.trigger({
                type: 'cellEditStart',
                columnId: this.params?.column?.getColId(),
                field: this.params?.colDef?.field,
                value: actualValue,
                row: this.params?.data,
                id: this.params?.node?.id,
                index: this.params?.node?.sourceRowIndex,
                displayIndex: this.params?.node?.rowIndex,
            });
            
            // Add Enter key listener to validate and exit edit mode
            this.addKeyboardListener();
        }
    },
    beforeUnmount() {
        // Remove keyboard listener if in edit mode
        if (this.isEditMode) {
            this.removeKeyboardListener();
        }
        
        // If in edit mode, emit the cellEditEnd event
        if (this.isEditMode && this.params?.trigger) {
            this.params.trigger({
                type: 'cellEditEnd',
                columnId: this.params?.column?.getColId(),
                field: this.params?.colDef?.field,
                value: this.currentValue,
                row: this.params?.data,
                id: this.params?.node?.id,
                index: this.params?.node?.sourceRowIndex,
                displayIndex: this.params?.node?.rowIndex,
                isCancel: this.wasCancelled,
            });
        }
    },
    methods: {
        // AG Grid interface: called when the cell needs to update without full recreate.
        // We cache the latest params (ag-grid-vue3 doesn't update the prop after
        // refresh) and return true so AG Grid keeps this instance alive — much
        // cheaper than tearing down and recreating the wwElement-wrapped tree
        // every time a cell value changes.
        refresh(params) {
            this._refreshedParams = params;
            // Do not overwrite editor-mode state during a live edit
            if (!this.isEditMode) {
                const actualValue = params?.data?.[params?.colDef?.field] ?? params?.value;
                this.currentValue = actualValue;
                this.originalValue = actualValue;
            }
            return true;
        },
        // AG Grid editor interface method
        // Returns the current cell value
        getValue() {
            return this.currentValue;
        },
        // AG Grid editor interface method
        // Called by AG Grid before completing the edit to validate the current value
        getValidationErrors() {
            const cb = this.params?.getValidationErrors;
            if (typeof cb !== 'function') return null;
            return cb({ value: this.getValue(), data: this.params?.data });
        },
        // Prevent click from propagating to row when suppressRowInteraction is enabled
        handleClick(event) {
            if (this.params?.suppressRowInteraction) {
                event.stopPropagation();
            }
        },
        // Prevent mousedown from triggering row focus when suppressRowInteraction is enabled
        handleMouseDown(event) {
            if (this.params?.suppressRowInteraction) {
                event.stopPropagation();
            }
        },
        handleKeyDown(event) {
            // Enter key validates and exits edit mode
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                if (this.params?.stopEditing) {
                    this.params.stopEditing();
                }
            }
            // Escape key cancels editing
            else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.wasCancelled = true; // Mark as cancelled
                if (this.params?.stopEditing) {
                    this.params.stopEditing(true); // true = cancel
                }
            }
        },
        addKeyboardListener() {
            // Get the correct document (handles iframe vs parent)
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.addEventListener('keydown', this.handleKeyDown, true);
        },
        removeKeyboardListener() {
            // Get the correct document (handles iframe vs parent)
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.removeEventListener('keydown', this.handleKeyDown, true);
        },
    },
};
</script>

<style scoped lang="scss">
.ww-cell-renderer {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    line-height: normal;

    &.edit-mode {
        outline: 2px solid rgba(0, 122, 255, 0.3);
        outline-offset: -2px;
    }
}
:deep(.ww-cell-renderer-flexbox) {
    height: 100%;
    flex: 1;
}
</style>
