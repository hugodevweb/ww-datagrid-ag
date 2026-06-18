<template>
  <div class="kanban-field" :class="['kanban-field--' + (column.cellDataType || 'text'), { 'kanban-field--title': isTitle }]">
    <span v-if="!isTitle && !isCustom && !isImage" class="kanban-field__label">{{ column.headerName || column.field }}</span>
    <div class="kanban-field__value">
      <SelectCellRenderer v-if="isSelect" :params="agParams" />
      <UserCellRenderer v-else-if="isUser" :params="agParams" />
      <RecordCellRenderer v-else-if="isRecord" :params="agParams" />
      <WewebCellRenderer v-else-if="isCustom && column.containerId" :params="agParams" />
      <img
        v-else-if="isImage && imageUrl"
        :src="imageUrl"
        class="kanban-field__image"
        :alt="column.headerName || ''"
      />
      <span v-else class="kanban-field__text" :title="formattedText">{{ formattedText }}</span>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import SelectCellRenderer from '../../datagrid/components/SelectCellRenderer.vue';
import UserCellRenderer from '../../datagrid/components/UserCellRenderer.vue';
import RecordCellRenderer from '../../datagrid/components/RecordCellRenderer.vue';
import WewebCellRenderer from '../../datagrid/components/WewebCellRenderer.vue';
import {
  createDateFormatter,
  createCurrencyFormatter,
} from '../../datagrid/utils/columnFactories.js';

export default {
  name: 'KanbanField',
  components: {
    SelectCellRenderer: markRaw(SelectCellRenderer),
    UserCellRenderer: markRaw(UserCellRenderer),
    RecordCellRenderer: markRaw(RecordCellRenderer),
    WewebCellRenderer: markRaw(WewebCellRenderer),
  },
  props: {
    column: { type: Object, required: true },
    row: { type: Object, required: true },
    resolveMappingFormula: { type: Function, required: true },
    isTitle: { type: Boolean, default: false },
    cellFontFamily: { type: String, default: '' },
    userFocusColor: { type: String, default: '' },
  },
  computed: {
    cellDataType() {
      return this.column?.cellDataType || 'text';
    },
    isSelect() { return this.cellDataType === 'select'; },
    isUser() { return this.cellDataType === 'user'; },
    isRecord() { return this.cellDataType === 'record'; },
    isImage() { return this.cellDataType === 'image'; },
    isCustom() { return this.cellDataType === 'custom'; },
    rawValue() {
      if (!this.column?.field) return null;
      return this.row?.[this.column.field];
    },
    imageUrl() {
      const v = this.rawValue;
      return typeof v === 'string' && v.length > 0 ? v : null;
    },
    formattedText() {
      const v = this.rawValue;
      if (v == null || v === '') return '';
      if (this.cellDataType === 'dateString' || this.cellDataType === 'dateTime') {
        try {
          return createDateFormatter(this.column)(v);
        } catch (_) { return String(v); }
      }
      if (this.cellDataType === 'currency') {
        try {
          const formatter = createCurrencyFormatter(this.column);
          return formatter({ data: this.row, value: v }, this.resolveMappingFormula) || '';
        } catch (_) { return String(v); }
      }
      if (typeof v === 'object') return '';
      return String(v);
    },
    // Minimal AG Grid params object for the existing renderers.
    // Display mode is detected via `params.api && params.stopEditing` — we omit
    // both so renderers stay in read-only mode.
    agParams() {
      const col = this.column;
      const baseRendererParams = {
        // SelectCellRenderer
        options: col.options,
        optionsValueFormula: col.optionsValueFormula,
        optionsLabelFormula: col.optionsLabelFormula,
        optionsColorFormula: col.optionsColorFormula,
        // UserCellRenderer
        users: col.users,
        maxNumberOfUsers: col.maxNumberOfUsers ?? 4,
        userFocusColor: this.userFocusColor,
        cellFontFamily: this.cellFontFamily,
        userIdFormula: col.userIdFormula,
        // RecordCellRenderer
        tableName: col.recordTable,
        valueField: col.recordValueField || 'id',
        displayField: col.recordDisplayField || 'name',
        contextField: col.recordContextField || '',
        previewFields: col.recordPreviewFields || [],
        allowCreate: false,
        getSupabaseInstance: () => (typeof wwLib !== 'undefined' ? wwLib?.wwPlugins?.supabase?.instance : null),
        onCreateClick: () => {},
        onRecordNavigate: () => {},
        // WewebCellRenderer
        containerId: col.containerId,
        trigger: () => {},
        suppressRowInteraction: true,
        // shared
        resolveMappingFormula: this.resolveMappingFormula,
        isLoading: false,
      };
      return {
        data: this.row,
        value: this.rawValue,
        node: { id: this.row?.id, data: this.row, rowIndex: 0 },
        column: { getColId: () => col.field },
        colDef: {
          field: col.field,
          headerName: col.headerName,
          cellRendererParams: baseRendererParams,
          cellEditorParams: baseRendererParams,
        },
      };
    },
  },
};
</script>

<style scoped>
.kanban-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.kanban-field--title .kanban-field__value {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ag-foreground-color, #1f2937);
}

.kanban-field__label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 55%, transparent);
  line-height: 1.2;
}

.kanban-field__value {
  font-size: 12px;
  color: var(--ag-foreground-color, #374151);
  line-height: 1.35;
  min-width: 0;
  overflow: hidden;
}

.kanban-field__text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kanban-field--title .kanban-field__text {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.kanban-field__image {
  display: block;
  max-height: 36px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 4px;
}

/* Tighten the embedded renderers so they fit naturally on a card */
.kanban-field :deep(.select-cell) {
  height: auto;
}
.kanban-field :deep(.select-cell .select-label) {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.kanban-field :deep(.user-cell),
.kanban-field :deep(.record-cell) {
  height: auto;
  min-height: 0;
}
/* On cards (kanban / calendar) the user avatars align to the left edge instead
   of the grid's centered layout. */
.kanban-field :deep(.user-cell) {
  justify-content: flex-start;
}
.kanban-field :deep(.user-display) {
  justify-content: flex-start;
  width: auto;
}
.kanban-field :deep(.record-pill) {
  padding: 2px 6px;
}
.kanban-field :deep(.record-nav-btn) {
  display: none;
}
</style>
