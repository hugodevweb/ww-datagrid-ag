<template>
    <div class="ww-cell-renderer" :class="{ 'edit-mode': isEditMode }">
        <wwLayoutItemContext
            is-repeat
            :index="params.node.sourceRowIndex"
            :data="{ value: params.value, row: params.data }"
        >
            <wwElement v-bind="params.containerId" class="ww-cell-renderer-flexbox"></wwElement>
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
        };
    },
    computed: {
        // Detect if we're in edit mode - AG Grid creates a new instance when editing
        isEditMode() {
            // When AG Grid uses this as an editor, it's in edit mode
            // We detect this by checking if we're being used as a cell editor
            return this.params?.api && this.params?.stopEditing;
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
            });
        }
    },
    methods: {
        // AG Grid editor interface method
        // Returns the current cell value
        getValue() {
            return this.currentValue;
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
