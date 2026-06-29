<template>
    <input
        ref="inputElement"
        :type="inputType"
        :value="inputValue"
        @input="onInput"
        @keydown.enter="stopEditing"
        @keydown.escape="cancelEditing"
        class="ag-input-field-input date-cell-editor"
    />
</template>

<script>
export default {
    name: "DateCellEditor",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            value: null,
            _cancelled: false, // set by cancelEditing so isCancelAfterEnd() discards the value
        };
    },
    computed: {
        inputType() {
            // Use datetime-local for dateTime type, date for dateString
            // Check both direct params and cellEditorParams
            const isDateTime = this.params?.isDateTime ||
                              this.params?.colDef?.cellEditorParams?.isDateTime;
            return isDateTime ? 'datetime-local' : 'date';
        },
        isDateTimeMode() {
            return this.params?.isDateTime ||
                   this.params?.colDef?.cellEditorParams?.isDateTime;
        },
        inputValue() {
            if (!this.value) return '';

            try {
                if (this.isDateTimeMode) {
                    // For datetime, parse ISO string and format for datetime-local input
                    const date = new Date(this.value);
                    if (isNaN(date.getTime())) return '';
                    
                    // Format for datetime-local input: YYYY-MM-DDTHH:mm (use local time)
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                } else {
                    // For date-only, value is already in YYYY-MM-DD format
                    // If it's an ISO string, extract just the date part
                    if (typeof this.value === 'string' && this.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        // Already in YYYY-MM-DD format
                        return this.value;
                    } else {
                        // Might be an ISO string, extract date part
                        const date = new Date(this.value);
                        if (isNaN(date.getTime())) return '';
                        
                        // Use UTC methods to avoid timezone issues
                        const year = date.getUTCFullYear();
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }
                }
            } catch (e) {
                return '';
            }
        },
    },
    mounted() {
        // Initialize with current cell value
        this.value = this.params?.value || null;

        // Focus the input
        this.$nextTick(() => {
            if (this.$refs.inputElement) {
                this.$refs.inputElement.focus();
                this.$refs.inputElement.select();
            }
        });
    },
    methods: {
        // Required by AG Grid - returns the final value
        getValue() {
            return this.value;
        },

        // Required by AG Grid - returns validation errors for the current in-progress value
        // Delegates to the callback passed via cellEditorParams.getValidationErrors
        getValidationErrors() {
            const cb = this.params?.getValidationErrors;
            if (typeof cb !== 'function') return null;
            return cb({ value: this.getValue(), data: this.params?.data });
        },

        // Required by AG Grid - check if editing should be cancelled before start
        isCancelBeforeStart() {
            return false;
        },

        // Required by AG Grid - check if editing should be cancelled after end.
        // params.stopEditing(true) does NOT cancel (its arg is suppressNavigateAfterEdit),
        // so this hook is what actually makes AG Grid discard the value on Escape.
        isCancelAfterEnd() {
            return this._cancelled === true;
        },

        onInput(event) {
            const inputValue = event.target.value;
            if (!inputValue) {
                this.value = null;
                return;
            }

            // Convert input value for storage
            if (this.isDateTimeMode) {
                // datetime-local gives us YYYY-MM-DDTHH:mm (in local time)
                // Create date from local time string, then convert to ISO
                const date = new Date(inputValue);
                this.value = date.toISOString();
            } else {
                // date input gives us YYYY-MM-DD
                // Store as simple date string (YYYY-MM-DD) to avoid timezone issues
                this.value = inputValue;
            }
        },

        stopEditing() {
            if (this.params?.stopEditing) {
                this.params.stopEditing();
            }
        },

        cancelEditing() {
            this._cancelled = true;
            this.value = this.params?.value || null;
            if (this.params?.stopEditing) {
                this.params.stopEditing(true);
            }
        },
    },
};
</script>

<style scoped>
.date-cell-editor {
    width: 100%;
    height: 100%;
    min-width: 0; /* Override browser default min-width for date inputs */
    /* Let AG Grid theme handle border, padding, margin, background, etc. */
    /* Only override what's necessary for cell editor functionality */
    outline: none;
    box-sizing: border-box;
    display: block; /* Ensure input takes full width */
}

/* Ensure datetime-local input shows time picker */
.date-cell-editor[type="datetime-local"] {
    min-width: 0; /* Override browser default min-width */
}

/* Ensure all date inputs inside ag-cell-wrapper take full width */
:deep(.ag-cell-wrapper input[type="date"]),
:deep(.ag-cell-wrapper input[type="datetime-local"]) {
    display: block !important;
}
</style>

<style>
/* Global style to ensure date inputs inside ag-cell-wrapper take full width */
.ag-cell-wrapper input[type="date"],
.ag-cell-wrapper input[type="datetime-local"] {
    display: block !important;
}
</style>
