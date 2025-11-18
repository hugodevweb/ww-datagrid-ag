<template>
    <input
        ref="inputElement"
        :type="inputType"
        :value="inputValue"
        @input="onInput"
        @keydown.enter="stopEditing"
        @keydown.escape="cancelEditing"
        class="date-cell-editor"
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
                const date = new Date(this.value);
                if (isNaN(date.getTime())) return '';

                if (this.isDateTimeMode) {
                    // Format for datetime-local input: YYYY-MM-DDTHH:mm
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                } else {
                    // Format for date input: YYYY-MM-DD
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
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

        // Required by AG Grid - check if editing should be cancelled before start
        isCancelBeforeStart() {
            return false;
        },

        // Required by AG Grid - check if editing should be cancelled after end
        isCancelAfterEnd() {
            return false;
        },

        onInput(event) {
            const inputValue = event.target.value;
            if (!inputValue) {
                this.value = null;
                return;
            }

            // Convert input value to ISO string for storage
            if (this.isDateTimeMode) {
                // datetime-local gives us YYYY-MM-DDTHH:mm
                this.value = new Date(inputValue).toISOString();
            } else {
                // date input gives us YYYY-MM-DD
                // Store as ISO string at midnight UTC
                this.value = new Date(inputValue + 'T00:00:00').toISOString();
            }
        },

        stopEditing() {
            if (this.params?.stopEditing) {
                this.params.stopEditing();
            }
        },

        cancelEditing() {
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
    border: none;
    outline: none;
    padding: 0 8px;
    font-size: inherit;
    font-family: inherit;
    box-sizing: border-box;
    min-width: 150px;
}

/* Ensure datetime-local input shows time picker */
.date-cell-editor[type="datetime-local"] {
    min-width: 200px;
}
</style>
