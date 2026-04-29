<template>
  <div class="ww-datagrid" :class="{ editing: isEditing, grouped: isGroupingActive }" :style="[cssVars, style]" ref="gridContainerRef">
    <!-- Single-grid mode: unchanged behavior -->
    <ag-grid-vue
      v-if="!isGroupingActive"
      :components="gridComponents"
      :rowData="rowData"
      :columnDefs="columnDefs"
      :initial-state="initialState"
      :defaultColDef="defaultColDef"
      :dataTypeDefinitions="dataTypeDefinitions"
      :domLayout="cfg.layout === 'auto' ? 'autoHeight' : 'normal'"
      :style="cfg.layout !== 'auto' ? { height: '100%' } : {}"
      :rowSelection="rowSelection"
      :selection-column-def="{ pinned: true }"
      :theme="theme"
      :getRowId="getRowId"
      :rowModelType="rowModelType"
      :datasource="delayedDatasource"
      :cacheBlockSize="cacheBlockSize"
      :maxBlocksInCache="cfg.maxBlocksInCache ?? 10"
      :cacheOverflowSize="cfg.cacheOverflowSize ?? 2"
      :maxConcurrentDatasourceRequests="cfg.maxConcurrentRequests ?? 2"
      :blockLoadDebounceMillis="cfg.blockLoadDebounce ?? 100"
      :pagination="paginationEnabled"
      :paginationPageSize="
        forcedPaginationPageSize
          ? 0
          : paginationPageSizeSelector
          ? paginationPageSizeSelector[0]
          : cfg.paginationPageSize
      "
      :paginationPageSizeSelector="paginationPageSizeSelector"
      :suppressMovableColumns="!cfg.movableColumns"
      :columnHoverHighlight="cfg.columnHoverHighlight"
      :locale-text="localeText"
      :invalidEditValueMode="invalidEditValueMode"
      :getRowStyle="rowStyle"
      enableCellTextSelection
      ensureDomOrder
      :row-drag-managed="rowDragManaged"
      :rowBuffer="cfg.rowBuffer ?? 10"
      :suppressRowVirtualisation="false"
      :animateRows="false"
      :debounceVerticalScrollbar="true"
      :suppressScrollOnNewData="true"
      :suppressAnimationFrame="cfg.suppressAnimationFrame ?? false"
      @grid-ready="onGridReady"
      @row-selected="onRowSelected"
      @selection-changed="onSelectionChanged"
      @cell-value-changed="onCellValueChanged"
      @cell-edit-request="onCellEditRequest"
      @cell-editing-started="onCellEditingStarted"
      @cell-editing-stopped="onCellEditingStopped"
      @row-editing-started="onRowEditingStarted"
      @row-editing-stopped="onRowEditingStopped"
      @filter-changed="onFilterChanged"
      @sort-changed="onSortChanged"
      @pagination-changed="onPaginationChanged"
      @row-clicked="onRowClicked"
      @row-drag-end="onRowDragged"
      @row-drag-enter="onRowDragEnter"
      @column-moved="onColumnMoved"
      @column-resized="onColumnResized"
      @body-scroll="onBodyScroll"
      @first-data-rendered="onFirstDataRendered"
      @model-updated="onModelUpdated"
    >
    </ag-grid-vue>

    <!-- Multi-grid mode: one grid per group, collapsible, drag-reorderable.
         Group-wide actions (collapse all / expand all / reorder) now live in
         the column-chooser panel's Grouping tab. -->
    <template v-else>
      <div
        v-for="group in orderedGroups"
        :key="group.value"
        class="ww-group"
        :style="{ '--group-color': group.color }"
        :class="{
          'ww-group--dragging': groupDragValue === group.value,
          'ww-group--drag-over': groupDragOverValue === group.value && groupDragValue !== group.value,
          'ww-group--collapsed': group.collapsed,
        }"
      >
        <div
          class="ww-group__header"
          :style="{ '--group-color': group.color }"
          :draggable="true"
          @dragstart="onGroupDragStart(group.value)"
          @dragover.prevent="onGroupDragOver(group.value)"
          @drop.prevent="onGroupDrop(group.value)"
          @dragend="onGroupDragEnd"
          @click.self="toggleGroupCollapsed(group.value)"
        >
          <button
            type="button"
            class="ww-group__chevron"
            :class="{ 'ww-group__chevron--open': !group.collapsed }"
            @click.stop="toggleGroupCollapsed(group.value)"
            :aria-expanded="!group.collapsed"
            :aria-label="group.collapsed ? 'Expand group' : 'Collapse group'"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="ww-group__title-block" @click.stop="toggleGroupCollapsed(group.value)">
            <span class="ww-group__label">{{ group.label }}</span>
            <span
              v-if="group.count !== null && group.count !== undefined"
              class="ww-group__items"
            >{{ formatItemCount(group.count) }}</span>
          </div>
          <span class="ww-group__drag-handle" aria-hidden="true">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="2.5" cy="3" r="1"/><circle cx="7.5" cy="3" r="1"/>
              <circle cx="2.5" cy="7" r="1"/><circle cx="7.5" cy="7" r="1"/>
              <circle cx="2.5" cy="11" r="1"/><circle cx="7.5" cy="11" r="1"/>
            </svg>
          </span>
        </div>

        <ag-grid-vue
          v-if="!group.collapsed"
          :components="gridComponents"
          :rowData="isInfiniteScrollEnabled ? undefined : groupRowData(group.value)"
          :rowModelType="rowModelType"
          :cacheBlockSize="cacheBlockSize"
          :alignedGrids="alignedGridApisForGroup"
          :columnDefs="columnDefs"
          :defaultColDef="defaultColDef"
          :dataTypeDefinitions="dataTypeDefinitions"
          domLayout="autoHeight"
          class="ww-group__grid"
          :rowSelection="rowSelection"
          :selection-column-def="{ pinned: true }"
          :theme="theme"
          :getRowId="getRowId"
          :pagination="paginationEnabled"
          :paginationPageSize="
            forcedPaginationPageSize
              ? 0
              : paginationPageSizeSelector
              ? paginationPageSizeSelector[0]
              : cfg.paginationPageSize
          "
          :paginationPageSizeSelector="paginationPageSizeSelector"
          :suppressMovableColumns="!cfg.movableColumns"
          :columnHoverHighlight="cfg.columnHoverHighlight"
          :locale-text="localeText"
          :invalidEditValueMode="invalidEditValueMode"
          :getRowStyle="rowStyle"
          enableCellTextSelection
          ensureDomOrder
          :row-drag-managed="false"
          :rowBuffer="cfg.rowBuffer ?? 10"
          :suppressRowVirtualisation="false"
          :animateRows="false"
          :debounceVerticalScrollbar="true"
          :suppressScrollOnNewData="true"
          :suppressAnimationFrame="cfg.suppressAnimationFrame ?? false"
          @grid-ready="(p) => onGroupGridReady(group.value, p)"
          @row-selected="(e) => onGroupRowSelected(group.value, e)"
          @selection-changed="(e) => onGroupSelectionChanged(group.value, e)"
          @cell-value-changed="onCellValueChanged"
          @cell-edit-request="onCellEditRequest"
          @cell-editing-started="onCellEditingStarted"
          @cell-editing-stopped="onCellEditingStopped"
          @row-editing-started="onRowEditingStarted"
          @row-editing-stopped="onRowEditingStopped"
          @filter-changed="(e) => onGroupFilterChanged(group.value, e)"
          @sort-changed="(e) => onGroupSortChanged(group.value, e)"
          @pagination-changed="onPaginationChanged"
          @row-clicked="onRowClicked"
          @column-moved="(e) => onGroupColumnMoved(group.value, e)"
          @column-resized="(e) => onGroupColumnResized(group.value, e)"
          @body-scroll="onGroupBodyScroll"
          @first-data-rendered="onFirstDataRendered"
          @model-updated="onModelUpdated"
        >
        </ag-grid-vue>

        <div
          v-if="!group.collapsed"
          class="ww-group__footer"
          :style="{ '--group-color': group.color }"
        >
          <span
            v-if="group.count !== null && group.count !== undefined"
            class="ww-group__footer-count"
          >{{ formatItemCount(group.count) }}</span>
        </div>
      </div>

      <div
        v-if="hasGroupHorizontalOverflow"
        ref="groupHorizontalScrollRef"
        class="ww-group-horizontal-scroll"
        :style="{
          left: `${groupHorizontalScrollLeft}px`,
          width: `${groupHorizontalViewportWidth}px`,
        }"
        @scroll="onGroupHorizontalScrollbarScroll"
      >
        <div
          class="ww-group-horizontal-scroll__spacer"
          :style="{ width: `${groupHorizontalScrollWidth}px` }"
        ></div>
      </div>
    </template>

    <Transition name="group-loading-fade">
      <div
        v-if="isGroupingTransitionLoading"
        class="ww-group-loading-overlay"
        role="status"
        aria-live="polite"
      >
        <div class="ww-group-loading-card">
          <span class="ww-group-loading-spinner" aria-hidden="true"></span>
          <span>{{ getTranslations(cfg?.lang || 'en').loadingGroups || 'Loading groups...' }}</span>
        </div>
      </div>
    </Transition>

    <div v-if="cfg.allowColumnHiding && !isEditing" ref="columnChooserRef" class="column-chooser-container">
      <Transition name="cc-fade">
        <div v-if="showColumnChooser" class="cc-panel" @click.stop>
          <!-- Header -->
          <div class="cc-header">
            <span class="cc-title">{{ getTranslations(cfg?.lang || 'en').manageColumns }}</span>
            <button class="cc-close-btn" @click="showColumnChooser = false" aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="cc-tabs" role="tablist">
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'columns' }"
              role="tab"
              :aria-selected="activeChooserTab === 'columns'"
              @click="activeChooserTab = 'columns'"
            >
              {{ getTranslations(cfg?.lang || 'en').columnsTab }}
            </button>
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'grouping' }"
              role="tab"
              :aria-selected="activeChooserTab === 'grouping'"
              @click="activeChooserTab = 'grouping'"
            >
              {{ getTranslations(cfg?.lang || 'en').groupingTab }}
            </button>
          </div>

          <!-- Tab: Columns -->
          <template v-if="activeChooserTab === 'columns'">
            <!-- Search row with select-all -->
            <div class="cc-search-row">
              <label class="cc-checkbox-wrap" title="Tout afficher / masquer">
                <input
                  type="checkbox"
                  class="cc-checkbox"
                  :checked="allColumnsVisible"
                  :indeterminate.prop="someColumnsHidden"
                  @change="toggleAllColumns"
                />
              </label>
              <div class="cc-search-box">
                <svg class="cc-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <input
                  class="cc-search-input"
                  type="text"
                  v-model="columnChooserSearch"
                  :placeholder="getTranslations(cfg?.lang || 'en').search"
                  @click.stop
                />
              </div>
            </div>

            <!-- Column list -->
            <div class="cc-list">
              <div
                v-for="col in filteredColumnsList"
                :key="col.colId"
                class="cc-row"
                :class="{
                  'cc-row--drag-over': chooserDragOverColId === col.colId && chooserDragColId !== col.colId,
                  'cc-row--dragging': chooserDragColId === col.colId,
                  'cc-row--locked': col.isLocked,
                }"
                :draggable="!columnChooserSearch && !col.isLocked"
                @dragstart="onChooserDragStart(col.colId)"
                @dragover.prevent="onChooserDragOver(col.colId)"
                @drop.prevent="onChooserDrop(col.colId)"
                @dragend="onChooserDragEnd"
              >
                <label class="cc-checkbox-wrap" :class="{ 'cc-checkbox-wrap--locked': col.isLocked }">
                  <input
                    type="checkbox"
                    class="cc-checkbox"
                    :checked="!col.isHidden"
                    :disabled="col.isLocked"
                    @change="toggleColumnVisibility(col.colId)"
                  />
                </label>
                <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !!columnChooserSearch || col.isLocked }">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                    <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                    <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                  </svg>
                </span>
                <span class="cc-col-name">{{ col.headerName }}</span>
              </div>
              <div v-if="filteredColumnsList.length === 0" class="cc-empty">
                {{ getTranslations(cfg?.lang || 'en').noColumnsMatch.replace('{searchTerm}', columnChooserSearch) }}
              </div>
            </div>
          </template>

          <!-- Tab: Grouping -->
          <template v-else-if="activeChooserTab === 'grouping'">
            <!-- Group-by selector -->
            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ getTranslations(cfg?.lang || 'en').groupBy }}</label>
              <select
                class="cc-group-select"
                :value="pendingGroupingColumnId !== null ? pendingGroupingColumnId : (groupingState?.columnId || '')"
                :disabled="selectableGroupingColumns.length === 0 || isGroupingTransitionLoading"
                @change="setGroupingColumn($event.target.value || null)"
              >
                <option value="">{{ getTranslations(cfg?.lang || 'en').noGrouping }}</option>
                <option
                  v-for="opt in selectableGroupingColumns"
                  :key="opt.field"
                  :value="opt.field"
                >{{ opt.displayName }}</option>
              </select>
              <span v-if="isGroupingTransitionLoading" class="cc-group-loading-dot" aria-hidden="true"></span>
            </div>

            <!-- Collapse / expand all + group ordering -->
            <template v-if="isGroupingActive && orderedGroups.length > 0">
              <div class="cc-group-actions">
                <button
                  type="button"
                  class="cc-group-action-btn"
                  @click="collapseAllGroups"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ getTranslations(cfg?.lang || 'en').collapseAll }}</span>
                </button>
                <button
                  type="button"
                  class="cc-group-action-btn"
                  @click="expandAllGroups"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="transform: rotate(-90deg);">
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ getTranslations(cfg?.lang || 'en').expandAll }}</span>
                </button>
              </div>

              <label class="cc-group-toggle-row">
                <input
                  type="checkbox"
                  class="cc-checkbox"
                  :checked="groupingState?.showUnassigned !== false"
                  @change="setShowUnassigned($event.target.checked)"
                />
                <span class="cc-group-toggle-label">{{ getTranslations(cfg?.lang || 'en').showUnassigned }}</span>
              </label>

              <div class="cc-group-list-label">{{ getTranslations(cfg?.lang || 'en').groupsOrder }}</div>
              <div class="cc-group-list">
                <div
                  v-for="group in orderedGroups"
                  :key="group.value"
                  class="cc-group-row"
                  :class="{
                    'cc-group-row--drag-over': groupDragOverValue === group.value && groupDragValue !== group.value,
                    'cc-group-row--dragging': groupDragValue === group.value,
                  }"
                  draggable="true"
                  @dragstart="onGroupDragStart(group.value)"
                  @dragover.prevent="onGroupDragOver(group.value)"
                  @drop.prevent="onGroupDrop(group.value)"
                  @dragend="onGroupDragEnd"
                >
                  <span class="cc-group-row__swatch" :style="{ backgroundColor: group.color }"></span>
                  <span class="cc-drag-handle">
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                      <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                      <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                    </svg>
                  </span>
                  <span class="cc-group-row__label">{{ group.label }}</span>
                  <span v-if="group.count !== null && group.count !== undefined" class="cc-group-row__count">{{ group.count }}</span>
                </div>
              </div>
            </template>

            <!-- Empty state: no select columns -->
            <div v-else-if="selectableGroupingColumns.length === 0" class="cc-empty">
              {{ getTranslations(cfg?.lang || 'en').noSelectColumns }}
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <!-- Create record form popup — teleported to body so it covers the full page -->
    <Teleport :to="createPopupTeleportTarget" v-if="activeCreateColumnField !== null && createPopupTeleportTarget">
      <div
        class="record-create-overlay"
        @click.self="closeCreateRecordForm()"
      >
        <div class="record-create-popup">
          <div class="record-create-popup-header">
            <span class="record-create-popup-title">Créer une fiche</span>
            <button class="record-create-popup-close" @click="closeCreateRecordForm()" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="record-create-popup-body">
            <wwLayoutItemContext
              is-repeat
              :index="0"
              :item="{ row: activeCreateRow, rowId: activeCreateRowId, columnField: activeCreateColumnField }"
              :data="{ row: activeCreateRow, rowId: activeCreateRowId, columnField: activeCreateColumnField }"
            >
              <wwLayout path="createRecordDropzone" direction="column" />
            </wwLayoutItemContext>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import {
  shallowRef,
  watchEffect,
  computed,
  inject,
  watch,
  nextTick,
  ref,
  onMounted,
  onBeforeUnmount,
  isRef,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import {
  AG_GRID_LOCALE_EN,
  AG_GRID_LOCALE_FR,
  AG_GRID_LOCALE_DE,
  AG_GRID_LOCALE_ES,
  AG_GRID_LOCALE_PT,
} from "@ag-grid-community/locale";
import ActionCellRenderer from "./components/ActionCellRenderer.vue";
import ImageCellRenderer from "./components/ImageCellRenderer.vue";
import WewebCellRenderer from "./components/WewebCellRenderer.vue";
import SelectCellRenderer from "./components/SelectCellRenderer.vue";
import SelectFilterComponent from "./components/SelectFilterComponent.vue";
import SelectFilterWrapper from "./components/SelectFilterWrapper.js";
import DateCellEditor from "./components/DateCellEditor.vue";
import UserCellRenderer from "./components/UserCellRenderer.vue";
import RecordCellRenderer from "./components/RecordCellRenderer.vue";
import UserFilterComponent from "./components/UserFilterComponent.vue";
import UserFilterWrapper from "./components/UserFilterWrapper.js";
import RecordFilterWrapper from "./components/RecordFilterWrapper.js";
import {
  clearAllCaches,
  createValidationFunction,
  createActionColumnDef,
  createCustomColumnDef,
  createDateColumnDef,
  createCurrencyColumnDef,
  createImageColumnDef,
  createValueSetter,
  createSelectLabelGetter,
  createUserNameGetter,
  createUserIdsExtractor,
} from "./utils/columnFactories.js";
import {
  findRowNode,
  waitForRowInGrid,
  getAvailableRowIds
} from "./utils/rowLookup.js";
import {
  getTranslations,
  getFilterTranslations,
  extractUserIds,
  getUserName,
  findUserIdByName,
  createFakeJunctionRecord,
  normalizeUserColumnOldValue,
  valuesEqual,
  createCacheKey,
  debounce
} from "../shared/utils/sharedHelpers.js";
import {
  GridApiQueue,
  GridApiUtils,
  globalGridApiQueue,
  globalGridApiUtils
} from "./utils/gridApiQueue.js";
import {
  fetchSupabaseDataUnified,
  fetchSupabaseDataPaginated,
  fetchSupabaseDataInfinite,
  fetchSupabaseDataCount,
  createFetchKey
} from "../shared/utils/supabaseUtils.js";
import {
  applyTextFilter,
  applyNumberFilter,
  applyDateFilter,
  applyBooleanFilter,
  applySelectFilter,
  applyUserFilter,
  applySetFilter,
  convertSingleFilterToSupabase
} from "./utils/filterUtils.js";
import {
  detectColumnConfig,
  processUserColumnChange,
  shouldRedrawForStyles,
  emitCellValueChangedEvent,
  manageDataUpdateFlag,
  processValueByType,
  getRowId
} from "./utils/cellValueUtils.js";
import { createGridMonitor } from "./utils/performanceMonitor.js";

// TODO: maybe register less modules
// TODO: maybe register modules per grid instead of globally
ModuleRegistry.registerModules([AllCommunityModule]);

export default {
  components: {
    AgGridVue,
    ActionCellRenderer,
    ImageCellRenderer,
    WewebCellRenderer,
    SelectCellRenderer,
    SelectFilterComponent,
    UserCellRenderer,
    RecordCellRenderer,
    UserFilterComponent,
  },
  props: {
    content: {
      type: Object,
      required: true,
    },
    uid: {
      type: String,
      required: true,
    },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ["trigger-event", "update:content", "update:content:effect"],
  setup(props, ctx) {
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    // Merged config: baseConfig keys override per-instance content (same logic as Options API cfg)
    const cfg = computed(() => {
      const content = props.content;
      if (!content || typeof content !== 'object') return content ?? {};
      const base = content.baseConfig;
      const excludes = content.baseConfigExcludes;
      if (!base || typeof base !== 'object') return content;
      const excludeSet = new Set(Array.isArray(excludes) ? excludes : []);
      excludeSet.add('baseConfig');
      excludeSet.add('baseConfigExcludes');
      const merged = { ...content };
      for (const key of Object.keys(base)) {
        if (!excludeSet.has(key)) merged[key] = base[key];
      }
      return merged;
    });

    // Use shared translation utility

    // Debug logging helper
    const debugLog = (...args) => {
      if (cfg.value?.enableDebugLogs) {
        console.log(...args);
      }
    };

    // Performance monitor — all recording is no-ops unless enableDebugLogs is on
    const gridMonitor = createGridMonitor(() => !!cfg.value?.enableDebugLogs);

    // Helper to check if a viewConfiguration value is effectively empty
    // Returns true if value is null, undefined, empty object {}, or empty array []
    const isEmptyConfigValue = (value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    };

    // Helper function to get the Supabase field path for filtering a column
    // Only used when dataSource is 'supabase'
    const getSupabaseFilterField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseFilterField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseFilterField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Helper function to get the Supabase field path for sorting a column
    // Only used when dataSource is 'supabase'
    const getSupabaseSortField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseSortField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseSortField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Helper function to find a column by columnId (general purpose, not limited to user columns)
    const findColumnByField = (columnId) => {
      if (!columnId || !props.content?.columns) return null;
      
      // First, try standard lookup
      let column = props.content.columns.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      return column || null;
    };

    // Helper function to find a user column by columnId (improved lookup for many-to-many relationships)
    const findUserColumn = (columnId) => {
      if (!columnId || !props.content?.columns) return null;
      
      // First, try standard lookup
      let column = props.content.columns.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // If not found, try matching by supabaseFilterField (for many-to-many relationships)
      if (!column) {
        column = props.content.columns.find(col => {
          if (col?.cellDataType !== 'user') return false;
          const supabaseField = col?.supabaseFilterField?.trim();
          if (!supabaseField) return false;
          // Check if columnId matches the supabaseFilterField or its base path
          // e.g., columnId="case_owners" matches supabaseFilterField="case_owners.profile.id"
          return supabaseField === columnId || supabaseField.startsWith(columnId + '.') || columnId.startsWith(supabaseField + '.');
        });
      }
      
      // If still not found, try a more flexible match (check if columnId contains field or vice versa)
      if (!column) {
        column = props.content.columns.find(col => {
          if (col?.cellDataType !== 'user') return false;
          const field = col?.field;
          if (!field) return false;
          // Check if columnId contains field or field contains columnId (case-insensitive)
          const fieldLower = String(field).toLowerCase();
          const columnIdLower = String(columnId).toLowerCase();
          return fieldLower.includes(columnIdLower) || columnIdLower.includes(fieldLower);
        });
      }
      
      // Return column only if it's a user column with users array
      if (column && column.cellDataType === 'user' && Array.isArray(column.users)) {
        return column;
      }
      
      return null;
    };

    // Helper function to format filters for logging
    const formatFiltersForLog = (filterModel) => {
      if (!filterModel || Object.keys(filterModel).length === 0) {
        return 'none';
      }
      
      const filterStrings = [];
      for (const [columnId, filter] of Object.entries(filterModel)) {
        if (!filter) continue;
        
        let filterDesc = `${columnId}: `;
        
        if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // User filters now store user IDs directly in filter.values, not names
          // Use the IDs directly for logging
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else if (filter.filterType === 'text') {
          filterDesc += `${filter.type} "${filter.filter}"`;
        } else if (filter.filterType === 'number') {
          if (filter.type === 'inRange') {
            filterDesc += `${filter.filter} to ${filter.filterTo}`;
          } else {
            filterDesc += `${filter.type} ${filter.filter}`;
          }
        } else if (filter.filterType === 'date') {
          if (filter.type === 'inRange') {
            filterDesc += `${filter.dateFrom} to ${filter.dateTo}`;
          } else {
            filterDesc += `${filter.type} ${filter.dateFrom || filter.filter}`;
          }
        } else if (filter.type === 'selectFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // Select filters now store values (IDs) directly, not labels
          // Use the values directly for logging
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else if (filter.filterType === 'set' && filter.values) {
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else {
          filterDesc += `${filter.type || filter.filterType || 'unknown'}`;
        }
        
        filterStrings.push(filterDesc);
      }
      
      return filterStrings.length > 0 ? filterStrings.join(' | ') : 'none';
    };

    // Convert AG Grid filter model to Supabase filter chain
    const convertFilterToSupabase = (filterModel, query) => {
      if (!filterModel || Object.keys(filterModel).length === 0) {
        return query;
      }

      // Use the refactored filter utilities for better maintainability
      // TODO: Complete refactoring to use convertSingleFilterToSupabase utility
      // For now, keeping the original implementation but showing the approach
      // return convertSingleFilterToSupabase(filterModel, query, props.content?.columns, resolveMappingFormula);

      let currentQuery = query;

      // Process each column filter
      for (const [columnId, filter] of Object.entries(filterModel)) {
        if (!filter) continue;

        // Get the Supabase field path for this column (supports nested relationships)
        // This will return the supabaseFilterField if set, otherwise columnId
        // For non-Supabase data sources, it just returns columnId
        const supabaseField = getSupabaseFilterField(columnId);

        // Handle user filters (custom filter type)
        if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // User filter now stores user IDs directly in filter.values, not names
          // Use the IDs directly for Supabase filtering
          // CRITICAL FIX: Use improved column lookup for many-to-many relationships
          const column = findUserColumn(columnId);

          if (column) {
            // Separate __empty__ sentinel from real user IDs
            const wantsEmpty = filter.values.includes('__empty__');
            const selectedUserIds = filter.values.filter(id => id != null && id !== '__empty__'); // Remove null/undefined and __empty__

            if (selectedUserIds.length > 0 || wantsEmpty) {
              // Determine user column type: check userColumnType first, fall back to isManyToMany for backward compatibility
              const userColumnType = column?.userColumnType || (column?.isManyToMany === true ? 'manyToMany' : 'directFK');

              // Get the appropriate filter field
              // For many-to-many, use supabaseFilterField if provided, otherwise use supabaseField
              // For direct FK and JSONB, use supabaseField (which is the column field)
              const filterField = (userColumnType === 'manyToMany' && column?.supabaseFilterField?.trim())
                ? column.supabaseFilterField.trim()
                : supabaseField;

              // If only filtering for empty (no user), just check for null/empty
              if (wantsEmpty && selectedUserIds.length === 0) {
                if (userColumnType === 'jsonbArray') {
                  // JSONB: null or empty array — use ->0 to check first element
                  // For null columns and empty arrays [], accessing index 0 returns null
                  currentQuery = currentQuery.is(`${filterField}->0`, null);
                } else if (userColumnType === 'manyToMany') {
                  // Many-to-many: filter field is null
                  currentQuery = currentQuery.is(filterField, null);
                } else {
                  // Direct FK: field is null
                  currentQuery = currentQuery.is(filterField, null);
                }
              } else if (wantsEmpty && selectedUserIds.length > 0) {
                // Both empty and specific users selected: use OR to combine
                const orConditions = [];

                // Add null/empty condition
                if (userColumnType === 'jsonbArray') {
                  // Use ->0.is.null to match both null and empty JSONB arrays
                  orConditions.push(`${filterField}->0.is.null`);
                } else {
                  orConditions.push(`${filterField}.is.null`);
                }

                // Add user ID conditions
                if (userColumnType === 'jsonbArray') {
                  selectedUserIds.forEach(id => {
                    orConditions.push(`${filterField}.cs.{${id}}`);
                  });
                } else if (userColumnType === 'manyToMany') {
                  selectedUserIds.forEach(id => {
                    orConditions.push(`${filterField}.eq.${id}`);
                  });
                } else {
                  // Direct FK
                  if (selectedUserIds.length === 1) {
                    orConditions.push(`${filterField}.eq.${selectedUserIds[0]}`);
                  } else {
                    orConditions.push(`${filterField}.in.(${selectedUserIds.join(',')})`);
                  }
                }

                currentQuery = currentQuery.or(orConditions.join(','));
              } else {
              // Only specific users selected (no __empty__)
              // Apply filter based on user column type
              if (userColumnType === 'jsonbArray') {
                // JSONB Array: Use contains operator for Supabase JSONB arrays
                // Supabase .contains() checks if the JSONB array contains the specified value(s)
                // Note: .contains() requires ALL values to be present, so for "any of" we use OR
                if (selectedUserIds.length === 1) {
                  // Single user: check if array contains this user ID
                  // For JSONB arrays, we pass an array with the single ID
                  currentQuery = currentQuery.contains(filterField, [selectedUserIds[0]]);
                } else {
                  // Multiple users: check if array contains ANY of the selected user IDs
                  // Use OR condition with individual contains checks for each ID
                  // PostgREST syntax for JSONB containment uses curly braces for array values
                  // Format: field.cs.{value} for checking if JSONB array contains the value
                  const orConditions = selectedUserIds.map(id => {
                    // Use curly braces for PostgREST array containment syntax
                    // This checks if the JSONB column contains the specified value
                    return `${filterField}.cs.{${id}}`;
                  }).join(',');
                  currentQuery = currentQuery.or(orConditions);
                }
              } else if (userColumnType === 'manyToMany') {
                // Many-to-Many: Use eq/in with supabaseFilterField (e.g., "case_owners.profile.id")
                if (selectedUserIds.length === 1) {
                  currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
                } else {
                  currentQuery = currentQuery.in(filterField, selectedUserIds);
                }

                // For many-to-many with nested paths, exclude null values at each level
                const isNestedPath = filterField.includes('.');

                if (isNestedPath) {
                  // For nested paths in junction tables, we need to check each level of the path
                  // to ensure the entire relationship chain exists
                  // Example: for "case_owners.profile.id", check:
                  // - case_owners is not null (junction table exists)
                  // - case_owners.profile is not null (nested relationship exists)
                  // - case_owners.profile.id is not null (field exists)
                  const pathParts = filterField.split('.');

                  // Build and check each intermediate path level
                  // This ensures that if any part of the relationship chain is null, the row is excluded
                  let currentPath = '';
                  for (let i = 0; i < pathParts.length; i++) {
                    if (i === 0) {
                      currentPath = pathParts[i];
                    } else {
                      currentPath += '.' + pathParts[i];
                    }
                    // Exclude rows where this path level is null
                    // Note: If this doesn't work for junction tables, we may need to use
                    // an inner join in the select statement (e.g., 'case_owners!inner(*)')
                    currentQuery = currentQuery.not(currentPath, 'is', null);
                  }
                } else {
                  // For direct fields, just exclude null values
                  // Supabase syntax: .not(field, 'is', null)
                  currentQuery = currentQuery.not(filterField, 'is', null);
                }
              } else {
                // Direct Foreign Key (default): Use eq/in operators
                if (selectedUserIds.length === 1) {
                  currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
                } else {
                  currentQuery = currentQuery.in(filterField, selectedUserIds);
                }

                // For direct FK, exclude null values
                currentQuery = currentQuery.not(filterField, 'is', null);
              }
              }

            } else {
              debugLog('[Supabase Filter] Warning: No valid user IDs found for names:', filter.values);
            }
          } else {
            // Enhanced error logging to help diagnose the issue
            debugLog('[Supabase Filter] Warning: Could not find user column or users array for:', columnId);
            debugLog('[Supabase Filter] Available columns:', props.content?.columns?.map(col => ({
              field: col?.field,
              actionName: col?.actionName,
              cellDataType: col?.cellDataType,
              userColumnType: col?.userColumnType,
              isManyToMany: col?.isManyToMany,
              supabaseFilterField: col?.supabaseFilterField,
              hasUsers: Array.isArray(col?.users),
              usersCount: Array.isArray(col?.users) ? col.users.length : 0
            })));
            debugLog('[Supabase Filter] Searching for columnId:', columnId);
          }
          continue;
        }

        // Handle different filter types
        if (filter.filterType === 'text') {
          // Check if this is a boolean column (AG Grid uses Text Filter for boolean with True/False dropdown)
          const column = findColumnByField(columnId);
          const isBoolean = column?.cellDataType === 'boolean';
          
          // For boolean columns, handle True/False string values
          if (isBoolean) {
            // AG Grid's Text Filter for boolean uses type: "true" or type: "false" as strings
            // Also check filter.filter for the value
            let booleanValue = null;
            let isNotEqual = false;
            
            // Check if it's a notEqual operation first
            if (filter.type === 'notEqual' || filter.type === 'notEquals') {
              isNotEqual = true;
              // Get the value from filter.filter for notEqual
              const filterValue = filter.filter;
              if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
                booleanValue = true;
              } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
                booleanValue = false;
              }
            }
            // Check filter.type for direct true/false (AG Grid boolean text filter uses this)
            else if (filter.type === 'true' || filter.type === true) {
              booleanValue = true;
            } else if (filter.type === 'false' || filter.type === false) {
              booleanValue = false;
            } 
            // Also check filter.filter (fallback)
            else if (filter.filter === 'true' || filter.filter === true || filter.filter === 'True') {
              booleanValue = true;
            } else if (filter.filter === 'false' || filter.filter === false || filter.filter === 'False') {
              booleanValue = false;
            }
            // Handle equals type with string values
            else if (filter.type === 'equals') {
              const filterValue = filter.filter;
              if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
                booleanValue = true;
              } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
                booleanValue = false;
              }
            }
            
            // Apply boolean filter if we have a valid boolean value
            if (booleanValue !== null) {
              if (isNotEqual) {
                currentQuery = currentQuery.neq(supabaseField, booleanValue);
              } else {
                // For equals, true, false, or any other type, use eq
                currentQuery = currentQuery.eq(supabaseField, booleanValue);
              }
            }
          } else {
            // Regular text filters for non-boolean columns
            if (filter.type === 'equals') {
              currentQuery = currentQuery.eq(supabaseField, filter.filter);
            } else if (filter.type === 'notEqual') {
              currentQuery = currentQuery.neq(supabaseField, filter.filter);
            } else if (filter.type === 'contains') {
              currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}%`);
            } else if (filter.type === 'notContains') {
              currentQuery = currentQuery.not('ilike', supabaseField, `%${filter.filter}%`);
            } else if (filter.type === 'startsWith') {
              currentQuery = currentQuery.ilike(supabaseField, `${filter.filter}%`);
            } else if (filter.type === 'endsWith') {
              currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}`);
            }
          }
        } else if (filter.filterType === 'number') {
          // Check if this is a currency column - need to convert display value back to cents
          const column = findColumnByField(columnId);
          const isCurrency = column?.cellDataType === 'currency';
          
          // Helper to convert filter value - multiply by 100 for currency columns
          const getFilterValue = (value) => {
            const numValue = Number(value);
            return isCurrency ? Math.round(numValue * 100) : numValue;
          };
          
          // Number filters
          if (filter.type === 'equals') {
            currentQuery = currentQuery.eq(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'notEqual') {
            currentQuery = currentQuery.neq(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'greaterThan') {
            currentQuery = currentQuery.gt(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'greaterThanOrEqual') {
            currentQuery = currentQuery.gte(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'lessThan') {
            currentQuery = currentQuery.lt(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'lessThanOrEqual') {
            currentQuery = currentQuery.lte(supabaseField, getFilterValue(filter.filter));
          } else if (filter.type === 'inRange') {
            currentQuery = currentQuery.gte(supabaseField, getFilterValue(filter.filter))
              .lte(supabaseField, getFilterValue(filter.filterTo));
          }
        } else if (filter.filterType === 'date') {
          // Date filters
          const filterDate = filter.dateFrom || filter.filter;
          const filterToDate = filter.dateTo || filter.filterTo;
          
          if (filter.type === 'equals') {
            // For date equals, we need to check the entire day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            currentQuery = currentQuery.gte(supabaseField, startOfDay.toISOString())
              .lte(supabaseField, endOfDay.toISOString());
          } else if (filter.type === 'notEqual') {
            // Not equal for dates: filter out the specific day
            // We'll use a workaround: filter for dates less than start of day OR greater than end of day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            // Use .or() with proper Supabase syntax
            currentQuery = currentQuery.or(`and(${supabaseField}.lt.${startOfDay.toISOString()},${supabaseField}.gt.${endOfDay.toISOString()})`);
          } else if (filter.type === 'greaterThan') {
            currentQuery = currentQuery.gt(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'greaterThanOrEqual') {
            currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'lessThan') {
            currentQuery = currentQuery.lt(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'lessThanOrEqual') {
            currentQuery = currentQuery.lte(supabaseField, new Date(filterDate).toISOString());
          } else if (filter.type === 'inRange') {
            currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString())
              .lte(supabaseField, new Date(filterToDate).toISOString());
          }
        } else if (filter.type === 'selectFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // Select filters store values (IDs) directly in filter.values, not labels.
          // Supports the `__empty__` sentinel for null/empty matching — used by the
          // grouping feature to query the "Unassigned" group (rows with null select value).
          const wantsEmpty = filter.values.includes('__empty__');
          const optionValues = filter.values.filter(val => val != null && val !== '__empty__');

          if (wantsEmpty && optionValues.length === 0) {
            // Only null/empty match requested — use .is(null)
            currentQuery = currentQuery.is(supabaseField, null);
          } else if (wantsEmpty && optionValues.length > 0) {
            // Mixed: match null OR any of the provided values
            const orConditions = [`${supabaseField}.is.null`];
            if (optionValues.length === 1) {
              orConditions.push(`${supabaseField}.eq.${optionValues[0]}`);
            } else {
              orConditions.push(`${supabaseField}.in.(${optionValues.join(',')})`);
            }
            currentQuery = currentQuery.or(orConditions.join(','));
          } else if (optionValues.length > 0) {
            if (optionValues.length === 1) {
              currentQuery = currentQuery.eq(supabaseField, optionValues[0]);
            } else {
              currentQuery = currentQuery.in(supabaseField, optionValues);
            }
          }
        } else if (filter.type === 'recordFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          const wantsEmpty = filter.values.includes('__empty__');
          const recordValues = filter.values.filter(val => val != null && val !== '__empty__');

          if (wantsEmpty && recordValues.length === 0) {
            currentQuery = currentQuery.is(supabaseField, null);
          } else if (wantsEmpty && recordValues.length > 0) {
            const orConditions = [`${supabaseField}.is.null`];
            if (recordValues.length === 1) {
              orConditions.push(`${supabaseField}.eq.${recordValues[0]}`);
            } else {
              orConditions.push(`${supabaseField}.in.(${recordValues.join(',')})`);
            }
            currentQuery = currentQuery.or(orConditions.join(','));
          } else if (recordValues.length > 0) {
            if (recordValues.length === 1) {
              currentQuery = currentQuery.eq(supabaseField, recordValues[0]);
            } else {
              currentQuery = currentQuery.in(supabaseField, recordValues);
            }
          }
        } else if (filter.filterType === 'set') {
          // Set filters (for boolean and other column types)
          if (filter.values && filter.values.length > 0) {
            // Check if this is a boolean column
            const column = findColumnByField(columnId);
            const isBoolean = column?.cellDataType === 'boolean';
            
            // Convert values to proper types
            let convertedValues = filter.values;
            if (isBoolean) {
              // Convert string booleans to actual booleans for Supabase
              convertedValues = filter.values.map(val => {
                // Handle various boolean representations
                if (val === 'true' || val === true || val === 1 || val === '1') return true;
                if (val === 'false' || val === false || val === 0 || val === '0') return false;
                return val;
              });
            }
            
            if (convertedValues.length === 1) {
              currentQuery = currentQuery.eq(supabaseField, convertedValues[0]);
            } else {
              currentQuery = currentQuery.in(supabaseField, convertedValues);
            }
          }
        }
      }

      return currentQuery;
    };

    // Apply search filter to Supabase query
    const applySearchToSupabase = (query, searchValue, searchableColumns) => {
      if (!searchValue || !searchValue.trim() || !searchableColumns || !Array.isArray(searchableColumns) || searchableColumns.length === 0) {
        return query;
      }

      const searchTerm = searchValue.trim();
      const validColumns = searchableColumns.filter(col => col && typeof col === 'string' && col.trim().length > 0);

      if (validColumns.length === 0) {
        return query;
      }

      // Map searchable columns to their Supabase field paths
      // This allows searchableColumns to contain either column IDs or direct Supabase paths
      const supabaseSearchFields = validColumns.map(col => {
        // Check if this is a column ID that has a supabaseFilterField
        const column = props.content?.columns?.find(c => {
          const colId = c?.actionName || c?.field;
          return colId === col || c?.field === col;
        });
        // Use supabaseFilterField if provided and not empty, otherwise use the column ID as-is
        // This allows searchableColumns to contain either column IDs or direct Supabase paths
        const supabaseField = column?.supabaseFilterField?.trim();
        return (supabaseField && supabaseField.length > 0) ? supabaseField : col;
      });

      // Build OR condition for all searchable columns
      // For Supabase, we need to use .or() with proper syntax
      // Format: or('col1.ilike.%term%,col2.ilike.%term%,...')
      if (supabaseSearchFields.length === 1) {
        // Single column: just use ilike
        return query.ilike(supabaseSearchFields[0], `%${searchTerm}%`);
      } else {
        // Multiple columns: use OR condition
        // Supabase OR syntax: or('col1.ilike.%term%,col2.ilike.%term%')
        // Note: The pattern needs to be properly escaped for special characters
        const escapedTerm = searchTerm.replace(/'/g, "''"); // Escape single quotes
        const orConditions = supabaseSearchFields
          .map(col => `${col}.ilike.%${escapedTerm}%`)
          .join(',');
        return query.or(orConditions);
      }
    };

    // Apply manual filters to Supabase query
    const applyManualFilters = (query, manualFilters) => {
      if (!manualFilters || !Array.isArray(manualFilters) || manualFilters.length === 0) {
        return query;
      }

      let currentQuery = query;

      for (const filter of manualFilters) {
        if (!filter?.field || !filter?.operator) {
          continue;
        }

        const field = filter.field;
        const operator = filter.operator;
        const value = filter.value;

        // Handle different operators
        switch (operator) {
          case 'eq':
            currentQuery = currentQuery.eq(field, value);
            break;
          case 'neq':
            currentQuery = currentQuery.neq(field, value);
            break;
          case 'gt':
            currentQuery = currentQuery.gt(field, value);
            break;
          case 'gte':
            currentQuery = currentQuery.gte(field, value);
            break;
          case 'lt':
            currentQuery = currentQuery.lt(field, value);
            break;
          case 'lte':
            currentQuery = currentQuery.lte(field, value);
            break;
          case 'like':
            currentQuery = currentQuery.like(field, value);
            break;
          case 'ilike':
            currentQuery = currentQuery.ilike(field, value);
            break;
          case 'is':
            // Handle 'is' for null/boolean checks
            if (value === 'null' || value === null) {
              currentQuery = currentQuery.is(field, null);
            } else if (value === 'true') {
              currentQuery = currentQuery.is(field, true);
            } else if (value === 'false') {
              currentQuery = currentQuery.is(field, false);
            }
            break;
          case 'in':
            // Handle 'in' for arrays - value should be comma-separated or array
            if (Array.isArray(value)) {
              currentQuery = currentQuery.in(field, value);
            } else if (typeof value === 'string' && value.includes(',')) {
              const values = value.split(',').map(v => v.trim());
              currentQuery = currentQuery.in(field, values);
            } else if (value) {
              currentQuery = currentQuery.in(field, [value]);
            }
            break;
          case 'contains':
            currentQuery = currentQuery.contains(field, value);
            break;
          case 'containedBy':
            currentQuery = currentQuery.containedBy(field, value);
            break;
          default:
            // Default to eq if unknown operator
            currentQuery = currentQuery.eq(field, value);
        }
      }

      return currentQuery;
    };

    // Helper function to wait for Supabase instance to become available
    // Retries with exponential backoff up to a maximum wait time
    // This function is defined in setup scope but can be used in methods via closure
    const waitForSupabaseInstance = async (maxWaitTime = 10000, initialDelay = 100) => {
      const startTime = Date.now();
      let delay = initialDelay;
      const maxDelay = 2000; // Maximum delay between retries (2 seconds)
      
      while (Date.now() - startTime < maxWaitTime) {
        const supabase = wwLib.wwPlugins.supabase.instance;
        if (supabase) {
          return supabase;
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay); // Exponential backoff, capped at maxDelay
      }
      
      // If we've waited the maximum time, return null
      return null;
    };

    // waitForSupabaseInstance is already defined as a const function, 
    // it will be exposed from setup for methods to access

    // Fetch data from Supabase for infinite scrolling (returns data directly)
    const fetchSupabaseDataForInfinite = async (startRow, endRow, filterModel = null, sortModel = null, searchValue = null) => {
      if (props.content?.dataSource !== 'supabase') {
        return { data: [], totalCount: 0 };
      }

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        return { data: [], totalCount: 0 };
      }

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await waitForSupabaseInstance(10000, 100);
        if (!supabase) {
          throw new Error('Supabase instance not available after waiting');
        }

        // Use unified fetch function
        return await fetchSupabaseDataInfinite({
          supabaseInstance: supabase,
          tableName,
          queryString,
          manualFilters: props.content?.supabaseFilters,
          searchValue: props.content?.enableSearch ? searchValue : null,
          searchableColumns: props.content?.searchableColumns || [],
          filterModel,
          sortModel,
          startRow,
          endRow,
          applyManualFilters,
          applySearchToSupabase,
          convertFilterToSupabase,
          getSupabaseSortField,
          formatFiltersForLog
        });
      } catch (error) {
        console.error('[Supabase Infinite] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        return { data: [], totalCount: 0 };
      } finally {
        supabaseLoading.value = false;
      }
    };

    // Fetch data from Supabase
    const fetchSupabaseData = async (page = 1, pageSize = 10, filterModel = null, sortModel = null, searchValue = null) => {
      // Skip fetch if we're updating data locally
      if (isUpdatingDataLocally.value) {
        return;
      }
      
      if (props.content?.dataSource !== 'supabase') {
        return;
      }

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        return;
      }

      // Create a unique key for this fetch request
      const fetchKey = createFetchKey({ page, pageSize, filterModel, sortModel, searchValue, tableName, queryString });
      
      // Prevent duplicate/recursive calls
      if (isFetchingData.value) {
        return;
      }
      
      // Check if this is the same request as the last one
      if (lastFetchParams.value === fetchKey) {
        return;
      }

      // Set fetching flag and store params
      isFetchingData.value = true;
      lastFetchParams.value = fetchKey;

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await waitForSupabaseInstance(10000, 100);
        if (!supabase) {
          throw new Error('Supabase instance not available after waiting');
        }

        // Query building is now handled by the unified function

        // Use unified fetch function
        const result = await fetchSupabaseDataPaginated({
          supabaseInstance: supabase,
          tableName,
          queryString,
          manualFilters: props.content?.supabaseFilters,
          searchValue: props.content?.enableSearch ? searchValue : null,
          searchableColumns: props.content?.searchableColumns || [],
          filterModel,
          sortModel,
          page,
          pageSize,
          applyManualFilters,
          applySearchToSupabase,
          convertFilterToSupabase,
          getSupabaseSortField,
          formatFiltersForLog
        });

        supabaseData.value = result.data;
        supabaseTotalCount.value = result.totalCount;

        // Update records after data is fetched (records will also be updated via rowData watch, but this ensures it's immediate)
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      } catch (error) {
        console.error('[Supabase] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        supabaseData.value = [];
        supabaseTotalCount.value = 0;
        setRecords([]);
      } finally {
        supabaseLoading.value = false;
        // Clear fetching flag after a short delay to allow grid to update
        setTimeout(() => {
          isFetchingData.value = false;
        }, 100);
      }
    };

    const gridApi = shallowRef(null);
    
    // Initialize grid API queue for this component instance
    const gridApiQueue = new GridApiQueue();
    const gridApiUtils = new GridApiUtils(gridApiQueue);

    // Cleanup queue on component unmount
    onBeforeUnmount(() => {
      gridApiQueue.clear();
    });
    
    const { value: selectedRows, setValue: setSelectedRows } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "selectedRows",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: filterValue, setValue: setFilters } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "filters",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: sortValue, setValue: setSort } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "sort",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: columnOrder, setValue: setColumnOrder } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "columnOrder",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: hiddenColumns, setValue: setHiddenColumns } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "hiddenColumns",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const activeCreateColumnField = ref(null);
    const activeCreateRow = ref(null);
    const activeCreateRowId = ref(null);
    const createPopupTeleportTarget = ref(null);

    const showColumnChooser = ref(false);
    const columnChooserRef = ref(null);
    const columnChooserSearch = ref('');
    const chooserColumnOrder = ref([]); // local ordered list of colIds for the panel
    const chooserHiddenState = ref([]); // local reactive hidden-columns list for the chooser UI
    const chooserDragColId = ref(null);
    const chooserDragOverColId = ref(null);
    // Chooser panel active tab — 'columns' (default, existing UI) or 'grouping' (new UI).
    const activeChooserTab = ref('columns');

    const handleClickOutside = (event) => {
      if (columnChooserRef.value && !columnChooserRef.value.contains(event.target)) {
        showColumnChooser.value = false;
      }
    };

    let clickOutsideTimer = null;
    watch(showColumnChooser, (val) => {
      if (val) {
        // Initialize chooser order and hidden state from current grid state
        if (gridApi.value) {
          const gridCols = gridApi.value.getAllGridColumns()?.filter(c => !isVirtualColumn(c));
          chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
          chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
        }
        columnChooserSearch.value = '';
        // Delay so the current click that opened the panel doesn't immediately close it.
        // Timer is tracked so it can be cancelled if the panel closes before it fires.
        clickOutsideTimer = setTimeout(() => {
          clickOutsideTimer = null;
          wwLib.getFrontDocument().addEventListener('click', handleClickOutside);
        }, 0);
      } else {
        // Cancel pending attach if panel closed before timer fired
        if (clickOutsideTimer !== null) {
          clearTimeout(clickOutsideTimer);
          clickOutsideTimer = null;
        }
        wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
        chooserDragColId.value = null;
        chooserDragOverColId.value = null;
      }

      // Sync external variable with column chooser state
      const ccVarId = cfg.value?.columnChooserVariableId;
      if (ccVarId) {
        try {
          wwLib.wwVariable.updateValue(ccVarId, val);
          debugLog(`[ColumnChooserVariable] Set variable "${ccVarId}" →`, val);
        } catch (e) {
          debugLog('[ColumnChooserVariable] Could not update variable:', ccVarId, e);
        }
      }
    });

    // Watch external variable to control column chooser visibility
    watch(
      () => {
        const varId = cfg.value?.columnChooserVariableId;
        if (!varId) return undefined;
        try {
          return wwLib.wwVariable.getValue(varId);
        } catch (e) {
          return undefined;
        }
      },
      (newVal) => {
        if (newVal === undefined) return;
        const boolVal = !!newVal;
        if (showColumnChooser.value !== boolVal) {
          showColumnChooser.value = boolVal;
          debugLog(`[ColumnChooserVariable] External variable changed → showColumnChooser =`, boolVal);
        }
      }
    );

    onBeforeUnmount(() => {
      if (clickOutsideTimer !== null) clearTimeout(clickOutsideTimer);
      wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
    });

    // Resolve teleport target for the create record popup
    onMounted(() => {
      createPopupTeleportTarget.value = (wwLib?.getFrontDocument?.() || document).body;
    });

    const { value: activeCreateColumn, setValue: setActiveCreateColumn } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "activeCreateColumn",
        type: "string",
        defaultValue: null,
        readonly: true,
      });
    // Keep the ref and the component variable in sync
    watch(activeCreateColumnField, (val) => setActiveCreateColumn(val));

    const { value: records, setValue: setRecords } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "records",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: isFetching, setValue: setIsFetching } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "isFetching",
        type: "boolean",
        defaultValue: false,
        readonly: true,
      });
    
    // Exposed variable for current grid configuration (includes user edits)
    // This can be stored and passed back to viewConfiguration to restore state
    const { value: currentConfig, setValue: setCurrentConfig } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "currentConfig",
        type: "object",
        defaultValue: {
          sizes: {},
          filters: {},
          sorting: [],
          columnsOrder: [],
          hiddenColumns: [],
        },
        readonly: true,
      });
    
    // Exposed variable for the configured column definitions (mirrors props.content.columns)
    const { value: columnDefsVar, setValue: setColumnDefsVar } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "columnDefs",
        type: "array",
        defaultValue: [],
        readonly: true,
      });

    // Clear column caches when major dependencies change to prevent stale memoized functions
    watch(
      () => [
        cfg.value?.columns,
        cfg.value?.lang,
        props.content?.actionFont,
        props.content?.cellFontFamily,
        props.content?.userFocusColor
      ],
      () => {
        clearAllCaches();
      },
      { deep: true }
    );

    watch(
      () => props.content?.columns,
      (newCols) => {
        setColumnDefsVar(Array.isArray(newCols) ? newCols : []);
      },
      { immediate: true, deep: true }
    );

    // ========== GROUPING FEATURE ==========
    // Sentinel used as the key for rows whose grouping column value is null/empty.
    const UNASSIGNED_GROUP = '__unassigned__';

    // Group collapsed state lives outside viewConfiguration in a dedicated WeWeb
    // object variable keyed by view id: { [viewId]: [groupValue, ...] }. The view
    // id comes from a separate WeWeb variable that exposes the current view.
    const VIEW_VARIABLE_ID = '23742aed-c957-4a20-b9ac-df6642c96015';
    const GROUP_COLLAPSED_VARIABLE_ID = '48f1f1e8-79c5-4adc-8b9f-909c5c75e605';

    const getCurrentViewId = () => {
      try {
        const view = wwLib.wwVariable.getValue(VIEW_VARIABLE_ID);
        return view?.id ?? null;
      } catch (e) {
        return null;
      }
    };

    const getStoredCollapsedForView = () => {
      const viewId = getCurrentViewId();
      if (!viewId) return [];
      try {
        const map = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
        if (!map || typeof map !== 'object') return [];
        const arr = map[viewId];
        return Array.isArray(arr) ? [...arr] : [];
      } catch (e) {
        return [];
      }
    };

    const persistCollapsedForView = (collapsed) => {
      const viewId = getCurrentViewId();
      if (!viewId) return;
      try {
        const current = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
        const next = current && typeof current === 'object' ? { ...current } : {};
        next[viewId] = Array.isArray(collapsed) ? [...collapsed] : [];
        wwLib.wwVariable.updateValue(GROUP_COLLAPSED_VARIABLE_ID, next);
      } catch (e) {
        debugLog('[GroupCollapsed] Could not persist collapsed state:', e);
      }
    };

    // Grouping state — source of truth for grouping. columnId/order/showUnassigned
    // are mirrored into viewConfiguration.grouping; collapsed is persisted in the
    // dedicated WeWeb variable above (keyed by view id) instead.
    const groupingState = ref({ columnId: null, order: [], collapsed: [], showUnassigned: true });
    const pendingGroupingColumnId = ref(null);
    const isGroupingTransitionLoading = ref(false);
    const groupingTransitionStartedAt = ref(0);
    let groupingTransitionTimer = null;

    // Map<groupValue, GridApi> — populated from each group grid's grid-ready event.
    const groupGridApis = shallowRef(new Map());

    // AG Grid `alignedGrids` feed — returns every currently-mounted group grid
    // wrapped as { api } so all siblings auto-sync column widths, column order,
    // visibility, pinning, and horizontal scroll natively (v34 feature).
    // AG Grid self-excludes the calling grid, so returning all APIs is safe.
    // Passed as a function so it re-reads the live Map on every call.
    const alignedGridApisForGroup = () => {
      if (!isGroupingActive.value) return [];
      const apis = Array.from(groupGridApis.value.values()).filter(Boolean);
      return apis.map(api => ({ api }));
    };

    // Map<groupValue, row[]> — aggregated selection across group grids.
    const groupSelections = ref(new Map());

    // Reentry guards for cross-grid synchronization.
    const isSyncingLayout = ref(false);
    const isSyncingFilters = ref(false);
    const isSyncingSort = ref(false);
    const isSyncingGroupHorizontalScroll = ref(false);
    const groupHorizontalScrollRef = ref(null);
    const groupHorizontalScrollWidth = ref(0);
    const groupHorizontalViewportWidth = ref(0);
    const groupHorizontalScrollLeft = ref(0);

    // Drag-reorder state for group headers.
    const groupDragValue = ref(null);
    const groupDragOverValue = ref(null);

    // Track which invalid-columnId warning has already been logged (avoid log spam).
    const warnedInvalidGroupingColumn = ref(null);

    const isSelectColumn = (colId) => {
      const col = findColumnByField(colId);
      return !!col && col.cellDataType === 'select';
    };

    const isValidGroupColumn = (colId) => {
      if (!colId) return false;
      return isSelectColumn(colId);
    };

    const groupingColumnId = computed(() => groupingState.value?.columnId || null);

    // Grouping is active only when a valid select column is configured.
    // Works across local, Supabase paginated, and Supabase infinite-scroll modes.
    // In infinite-scroll mode each group gets its own IDatasource — see
    // groupDatasourceFor(groupValue) below.
    const isGroupingActive = computed(() => {
      const colId = groupingColumnId.value;
      if (!colId) return false;
      if (!isValidGroupColumn(colId)) {
        if (warnedInvalidGroupingColumn.value !== colId) {
          warnedInvalidGroupingColumn.value = colId;
          console.warn(`[Datagrid] viewConfiguration.grouping.columnId="${colId}" is invalid or not a select column — grouping disabled.`);
        }
        return false;
      }
      if (warnedInvalidGroupingColumn.value === colId) {
        warnedInvalidGroupingColumn.value = null;
      }
      return true;
    });

    // Extract an option's color for a given group value from the select column's options.
    const getGroupColor = (colId, groupValue) => {
      if (groupValue === UNASSIGNED_GROUP) return '#9ca3af';
      const col = findColumnByField(colId);
      const options = Array.isArray(col?.options) ? col.options : [];
      const match = options.find(o => String(o?.value) === String(groupValue));
      return match?.color || '#e5e7eb';
    };

    const getGroupLabel = (colId, groupValue) => {
      if (groupValue === UNASSIGNED_GROUP) return 'Unassigned';
      const col = findColumnByField(colId);
      const options = Array.isArray(col?.options) ? col.options : [];
      const match = options.find(o => String(o?.value) === String(groupValue));
      return match?.label ?? String(groupValue);
    };

    // Normalize a raw cell value to a group key string.
    const rowGroupKey = (row, colId) => {
      const raw = row?.[colId];
      if (raw === null || raw === undefined || raw === '') return UNASSIGNED_GROUP;
      return String(raw);
    };

    // Source data for grouping — unified across data sources.
    // Local: rowData. Supabase paginated: supabaseData.
    // Infinite scroll: empty — each group grid owns its own IDatasource via
    // groupDatasourceFor(). Counts come from groupInfiniteCounts instead.
    const groupingSourceRows = computed(() => {
      if (!isGroupingActive.value) return [];
      // In infinite-scroll mode, supabaseData only holds the last-fetched block,
      // which would produce wrong partitions. Per-group datasources handle fetching.
      if (isInfiniteScrollEnabled.value) return [];
      if (cfg.value?.dataSource === 'supabase') {
        return Array.isArray(supabaseData.value) ? supabaseData.value : [];
      }
      const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
      return Array.isArray(data) ? data : [];
    });

    // Map<groupValue, row[]>
    const groupedRowData = computed(() => {
      if (!isGroupingActive.value) return new Map();
      const colId = groupingColumnId.value;
      const out = new Map();
      for (const row of groupingSourceRows.value) {
        const key = rowGroupKey(row, colId);
        let arr = out.get(key);
        if (!arr) { arr = []; out.set(key, arr); }
        arr.push(row);
      }
      return out;
    });

    const groupRowData = (groupValue) => groupedRowData.value.get(groupValue) || [];

    // Row counts for badge display in infinite-scroll mode — populated by each
    // per-group datasource's getRows on successful fetch. Map<groupValue, totalCount>
    const groupInfiniteCounts = ref(new Map());

    // Compute the ordered list of groups to render.
    const orderedGroups = computed(() => {
      if (!isGroupingActive.value) return [];
      const colId = groupingColumnId.value;
      const col = findColumnByField(colId);
      const options = Array.isArray(col?.options) ? col.options : [];
      const orderArr = Array.isArray(groupingState.value?.order) ? groupingState.value.order : [];
      const collapsedSet = new Set(Array.isArray(groupingState.value?.collapsed) ? groupingState.value.collapsed : []);
      const dataMap = groupedRowData.value;
      const infiniteCounts = isInfiniteScrollEnabled.value ? groupInfiniteCounts.value : null;

      // Count resolution:
      //  - Infinite-scroll: use totalCount reported by each group's datasource (null if unknown yet).
      //  - Local / paginated: partition the in-memory dataset.
      const countFor = (value) => {
        if (infiniteCounts) {
          return infiniteCounts.has(value) ? infiniteCounts.get(value) : null;
        }
        return dataMap.get(value)?.length || 0;
      };

      const base = options.map((o) => {
        const value = String(o.value);
        return {
          value,
          label: o.label ?? value,
          color: o.color || '#e5e7eb',
          count: countFor(value),
          collapsed: collapsedSet.has(value),
        };
      });

      // Unassigned group:
      //  - User-toggleable via groupingState.showUnassigned (default true).
      //  - Local / paginated: only show when it has rows (we know the full set).
      //  - Infinite-scroll: always show — we can't cheaply know upfront if null
      //    rows exist, and the group's datasource will report 0 if not.
      const unassignedCount = countFor(UNASSIGNED_GROUP);
      const userShowUnassigned = groupingState.value?.showUnassigned !== false;
      const showUnassigned = userShowUnassigned && (
        infiniteCounts
          ? true
          : (unassignedCount || 0) > 0
      );
      if (showUnassigned) {
        base.push({
          value: UNASSIGNED_GROUP,
          label: 'Unassigned',
          color: '#9ca3af',
          count: unassignedCount,
          collapsed: collapsedSet.has(UNASSIGNED_GROUP),
        });
      }

      // Apply custom order (listed first), then append any unlisted groups at the end.
      if (orderArr.length === 0) return base;
      const byValue = new Map(base.map(g => [g.value, g]));
      const ordered = [];
      for (const v of orderArr) {
        if (byValue.has(v)) { ordered.push(byValue.get(v)); byValue.delete(v); }
      }
      byValue.forEach(g => ordered.push(g));
      return ordered;
    });

    const hasGroupHorizontalOverflow = computed(() => (
      isGroupingActive.value &&
      groupHorizontalScrollWidth.value > groupHorizontalViewportWidth.value + 1
    ));
    // ========== /GROUPING FEATURE ==========

    // Helper function to get current column widths from the grid
    // Helper to check if a column is a virtual (sort/filter-only) column
    const isVirtualColumn = (col) => {
      const colDef = col.getColDef?.();
      return colDef?.__virtualColumn === true;
    };

    const getCurrentColumnWidths = () => {
      if (!gridApi.value) return {};

      const columns = gridApi.value.getAllGridColumns();
      const widths = {};

      columns?.forEach((col) => {
        if (isVirtualColumn(col)) return; // Skip virtual columns
        const colId = col.getColId();
        const actualWidth = col.getActualWidth();
        if (colId && actualWidth) {
          widths[colId] = actualWidth;
        }
      });

      return widths;
    };

    // Helper function to update the currentConfig exposed variable
    const updateCurrentConfig = () => {
      if (!gridApi.value) return;

      const columns = gridApi.value.getAllGridColumns()?.filter(col => !isVirtualColumn(col));
      // collapsed is intentionally omitted — it lives in a dedicated WeWeb variable
      // keyed by view id, not in viewConfiguration.
      const grouping = groupingState?.value
        ? {
            columnId: groupingState.value.columnId ?? null,
            order: Array.isArray(groupingState.value.order) ? [...groupingState.value.order] : [],
            showUnassigned: groupingState.value.showUnassigned !== false,
          }
        : { columnId: null, order: [], showUnassigned: true };
      const config = {
        sizes: getCurrentColumnWidths(),
        filters: filterValue.value || {},
        sorting: sortValue.value || [],
        columnsOrder: columns?.map((col) => col.getColId()) || columnOrder.value || [],
        hiddenColumns: hiddenColumns.value || [],
        grouping,
      };

      setCurrentConfig(config);
      updateViewEditedVariable(config);
    };

    // Deep-equal helper restricted to the view-state keys
    const isViewConfigEdited = (current, baseline) => {
      if (!baseline || typeof baseline !== 'object') return false;

      const keysToCheck = ['sizes', 'filters', 'sorting', 'columnsOrder', 'hiddenColumns', 'grouping'];

      for (const key of keysToCheck) {
        const baseVal = baseline[key];
        const curVal = current?.[key];

        // If baseline is absent/empty, any non-empty current value means edited
        if (isEmptyConfigValue(baseVal)) {
          if (!isEmptyConfigValue(curVal)) return true;
          continue;
        }

        // Special case: grouping is a structured object { columnId, order, showUnassigned }.
        // collapsed is excluded — it's tracked in a separate WeWeb variable, not viewConfiguration.
        if (key === 'grouping') {
          if (!curVal || typeof curVal !== 'object') return true;
          if ((baseVal.columnId ?? null) !== (curVal.columnId ?? null)) return true;
          const bOrder = Array.isArray(baseVal.order) ? baseVal.order : [];
          const cOrder = Array.isArray(curVal.order) ? curVal.order : [];
          if (bOrder.length !== cOrder.length) return true;
          for (let i = 0; i < bOrder.length; i++) if (bOrder[i] !== cOrder[i]) return true;
          // showUnassigned defaults to true when absent
          if ((baseVal.showUnassigned !== false) !== (curVal.showUnassigned !== false)) return true;
          continue;
        }

        if (Array.isArray(baseVal)) {
          if (!Array.isArray(curVal)) return true;
          // For columnsOrder: live grid may have extra columns added after the config was saved.
          // Only compare the relative order of columns present in the baseline.
          const effectiveCurVal = (key === 'columnsOrder')
            ? curVal.filter(id => baseVal.includes(id))
            : curVal;
          if (baseVal.length !== effectiveCurVal.length) return true;
          for (let i = 0; i < baseVal.length; i++) {
            const b = baseVal[i];
            const c = effectiveCurVal[i];
            if (typeof b === 'object' && b !== null) {
              // For sorting: compare colId + sort directly to avoid JSON key-order sensitivity
              const sortMatch = (key === 'sorting') && typeof c === 'object' && c !== null
                && b.colId === c.colId && b.sort === c.sort;
              if (!sortMatch && JSON.stringify(b) !== JSON.stringify(c)) return true;
            } else if (b !== c) {
              return true;
            }
          }
        } else if (typeof baseVal === 'object') {
          if (typeof curVal !== 'object' || curVal === null) return true;
          // Only compare keys present in the baseline — extra columns in the live grid are ignored
          const bKeys = Object.keys(baseVal);
          for (const k of bKeys) {
            const bv = baseVal[k];
            const cv = curVal[k];
            // For sizes (numeric widths) allow ±1px rounding tolerance
            const numericMatch = (key === 'sizes') && typeof bv === 'number' && typeof cv === 'number' && Math.abs(bv - cv) <= 1;
            if (!numericMatch && bv !== cv) return true;
          }
        } else {
          if (baseVal !== curVal) return true;
        }
      }

      return false;
    };

    // Suppression window for the edited variable. Any time the viewConfiguration
    // prop changes (e.g. navigating between pages/tables), the grid and the new
    // baseline can be briefly out of sync as AG Grid rebuilds columns/data and
    // emits late events. While this window is active, we refuse to flip the
    // edited variable to `true` — we only allow `false`. Extended on each
    // viewConfiguration change.
    const suppressEditedUntil = ref(0);

    // Update external WeWeb variable when view-edited state changes
    const updateViewEditedVariable = (config) => {
      const variableId = cfg.value?.viewEditedVariableId;
      if (!variableId) return;

      // Skip during programmatic view config application — grid is mid-transition
      // The watcher resets the variable to false once the config is fully applied
      if (isApplyingViewConfig?.value) {
        debugLog(`[ViewEditedVariable] Skipping update — viewConfiguration is being applied`);
        return;
      }

      const baseline = cfg.value?.viewConfiguration;
      const edited = isViewConfigEdited(config, baseline);

      // During the suppression window after a viewConfiguration change, do not
      // let late grid events mark the view as edited. Allow `false` through so
      // state converges correctly once the grid settles.
      if (edited && Date.now() < suppressEditedUntil.value) {
        debugLog(`[ViewEditedVariable] Suppressed true → view just changed, ignoring late grid event`);
        return;
      }

      try {
        wwLib.wwVariable.updateValue(variableId, edited);
        debugLog(`[ViewEditedVariable] Set variable "${variableId}" →`, edited);
      } catch (e) {
        debugLog('[ViewEditedVariable] Could not update variable:', variableId, e);
      }
    };

    // Function to update records variable from grid API (gets displayed rows)
    // Defined early so it can be used in onGridReady and other handlers
    // CRITICAL FIX: This function can trigger error #252 if called during render
    // Always call via safeUpdateRecordsFromGrid to ensure it runs outside render cycle
    const updateRecordsFromGrid = () => {
      if (!gridApi.value) {
        setRecords([]);
        return;
      }
      
      // Don't update records if grid is in the middle of rendering
      if (isGridRendering.value) {
        return;
      }

      try {
        const displayedRows = [];
        // Get all displayed row nodes from the grid
        gridApi.value.forEachNode((node) => {
          if (node.data) {
            displayedRows.push(node.data);
          }
        });
        setRecords(displayedRows);
      } catch (error) {
        // Check if this is the #252 error and silently retry later
        if (error.message && error.message.includes('#252')) {
          // Defer the update to avoid the render conflict
          setTimeout(() => updateRecordsFromGrid(), 100);
        } else {
          console.error('[Records] Error updating records from grid:', error);
          setRecords([]);
        }
      }
    };

    const gridReady = ref(false);
    const dataRendered = ref(false);
    const dataLoadingTimeout = ref(null);
    const gridContainerRef = ref(null);
    
    // CRITICAL FIX: Track when the grid is actively rendering to prevent error #252
    // "cannot get grid to draw rows when it is in the middle of drawing rows"
    const isGridRendering = ref(false);
    
    // Helper to safely call grid API methods - defers to next tick if grid is rendering
    const safeGridApiCall = (callback, delay = 0) => {
      return new Promise((resolve) => {
        const executeCall = () => {
          if (!gridApi.value) {
            resolve(false);
            return;
          }
          
          // If grid is rendering, defer the call
          if (isGridRendering.value) {
            setTimeout(() => executeCall(), 10);
            return;
          }
          
          try {
            const result = callback();
            resolve(result);
          } catch (error) {
            // If we still get the error, retry with a longer delay
            if (error.message && error.message.includes('#252')) {
              setTimeout(() => executeCall(), 50);
            } else {
              console.error('[Datagrid] Safe API call error:', error);
              resolve(false);
            }
          }
        };
        
        if (delay > 0) {
          setTimeout(executeCall, delay);
        } else {
          executeCall();
        }
      });
    };
    
    // Helper to wait for grid to be fully ready (not just initialized, but ready for API calls)
    const waitForGridReady = (timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          // Check if grid API is available and grid is marked as ready
          if (gridApi.value && gridReady.value && !isGridRendering.value) {
            resolve(true);
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error('[Datagrid] Timeout waiting for grid to be ready'));
            return;
          }
          
          // Check again in a short interval
          setTimeout(checkReady, 50);
        };
        
        checkReady();
      });
    };
    
    // Helper to wait for a specific row to appear in the grid (using unified utility)
    const waitForRowInGridLocal = (rowId, timeout = 10000) => {
      return waitForRowInGrid(gridApi.value, rowId, resolveMappingFormula, props.content, timeout);
    };
    
    // Supabase data state
    const supabaseData = ref([]);
    const supabaseTotalCount = ref(0);
    const supabaseLoading = ref(false);
    const supabaseError = ref(null);
    const filterDebounceTimer = ref(null);
    const searchDebounceTimer = ref(null);
    
    // Guard to prevent duplicate/recursive fetches
    const isFetchingData = ref(false);
    const lastFetchParams = ref(null);
    
    // Flag to prevent data fetching when we're updating data locally (e.g., fake junction records)
    const isUpdatingDataLocally = ref(false);
    
    // Track removed row IDs for infinite scroll mode (so datasource can filter them out)
    const removedRowIds = ref(new Set());
    const MAX_REMOVED_IDS = 1000; // Prevent unbounded memory growth
    
    // Cleanup mechanism for removedRowIds Set
    const cleanupRemovedIds = () => {
      const currentSize = removedRowIds.value.size;
      if (currentSize > MAX_REMOVED_IDS) {
        // Convert to array, remove oldest entries, keep most recent
        const idsArray = Array.from(removedRowIds.value);
        const keepCount = Math.floor(MAX_REMOVED_IDS * 0.7); // Keep 70% of max
        const idsToKeep = idsArray.slice(-keepCount); // Keep most recent
        removedRowIds.value = new Set(idsToKeep);
        debugLog(`[Cleanup] Reduced removedRowIds from ${currentSize} to ${idsToKeep.length} entries`);
      }
    };
    
    // Clear removed IDs when data source changes or major refresh occurs
    const clearRemovedIds = () => {
      const size = removedRowIds.value.size;
      if (size > 0) {
        removedRowIds.value.clear();
        debugLog(`[Cleanup] Cleared ${size} removed row IDs`);
      }
    };
    
    // Helper functions to set/get the flag from methods
    const setUpdatingDataLocally = (value) => {
      isUpdatingDataLocally.value = value;
    };
    const getUpdatingDataLocally = () => {
      return isUpdatingDataLocally.value;
    };

    const onGridReady = (params) => {
      gridApi.value = params.api;
      gridReady.value = true;
      // Set rendering flag during initial setup
      isGridRendering.value = true;
      
      const columns = params.api.getAllGridColumns();
      
      // Set initial column order from viewConfiguration if provided with values
      // At grid initialization, we use viewConfiguration.columnsOrder if it has values
      // Otherwise, use the default order from grid (from column definitions)
      const viewConfig = cfg.value?.viewConfiguration;
      const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
      const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;
      
      if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
        setColumnOrder([...viewColumnsOrder]);
      } else {
        // Use default order from grid (no explicit order in viewConfiguration)
        // Filter out virtual columns (sort/filter-only) from the default order
        setColumnOrder(columns.filter(col => !isVirtualColumn(col)).map((col) => col.getColId()));
      }
      
      // Update records from grid after grid is ready
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
          // Initialize currentConfig after grid is ready
          updateCurrentConfig();
        }, 200);
      });
      
      // If data is already present when grid is ready, mark as rendered after a short delay
      nextTick(() => {
        if (rowData.value && rowData.value.length > 0) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              dataRendered.value = true;
              // Clear rendering flag after data is rendered
              isGridRendering.value = false;
            }, 200);
          });
        } else {
          // Empty data means it's loaded
          dataRendered.value = true;
          // Clear rendering flag
          setTimeout(() => {
            isGridRendering.value = false;
          }, 100);
        }
      });
    };
    
    // CRITICAL FIX: Track when grid finishes its first data render
    // This helps prevent error #252 by knowing when it's safe to call API methods
    const onFirstDataRendered = () => {
      // Clear rendering flag when first data is rendered
      setTimeout(() => {
        isGridRendering.value = false;
        dataRendered.value = true;
        
        // Apply focused row if focusedRowId is set (scroll to row on first render)
        const focusedRowId = cfg.value?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Use a longer delay to ensure grid is fully ready
          setTimeout(() => {
            if (gridApi.value && !isGridRendering.value) {
              // Find and scroll to the focused row using unified lookup
              let rowNode = findRowNode(gridApi.value, focusedRowId, resolveMappingFormula, props.content);
              
              // Scroll to and focus the row if found
              if (rowNode && rowNode.rowIndex !== null && rowNode.rowIndex !== undefined) {
                gridApi.value.ensureIndexVisible(rowNode.rowIndex, 'middle');
              }
            }
          }, 150);
        }
        if (isGroupingActive.value) {
          updateGroupHorizontalScrollbarMetrics();
        }
      }, 50);
    };
    
    // CRITICAL FIX: Track model updates to know when grid is actively rendering
    // This helps prevent error #252 during data updates
    const onModelUpdated = (event) => {
      // The model update is complete, clear rendering flag after a short delay
      // to allow any cascading renders to complete
      setTimeout(() => {
        isGridRendering.value = false;
        
        // Re-apply focused row styling after model update (e.g., after filter/sort/pagination)
        // This ensures the focused row remains visually highlighted even after data changes
        const focusedRowId = cfg.value?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Redraw rows to ensure rowStyle is re-applied with current focusedRowId
          if (gridApi.value && !isGridRendering.value) {
            // Don't scroll on model updates, just ensure styling is correct
            // The rowStyle function will handle the visual highlighting
          }
        }
        if (isGroupingActive.value) {
          updateGroupHorizontalScrollbarMetrics();
        }
      }, 50);
    };

    // Track last applied view configuration to detect changes
    const lastAppliedViewConfig = ref(null);
    
    // Flag to track when view configuration is being applied programmatically
    // This prevents filter/sort changed events from being triggered during view config changes
    const isApplyingViewConfig = ref(false);
    // Generation counter to handle concurrent applyViewConfiguration calls.
    // Only the last apply's cleanup timeout should clear the flag.
    let applyViewConfigGeneration = 0;

    // Helper function to apply view configuration to the grid
    const applyViewConfiguration = (viewConfig, isInitial = false) => {
      if (!gridApi.value) return;
      
      debugLog('[ViewConfiguration] Applying view configuration:', viewConfig, 'isInitial:', isInitial);

      // Set flag to indicate we're applying view config programmatically
      isApplyingViewConfig.value = true;
      // Increment generation so previous apply's cleanup timeout won't clear the flag
      const myGeneration = ++applyViewConfigGeneration;

      // Defer API calls to prevent error #252 during render cycle
      setTimeout(() => {
        if (!gridApi.value) {
          if (myGeneration === applyViewConfigGeneration) {
            isApplyingViewConfig.value = false;
          }
          return;
        }
        
        try {
          // 1. Apply filters if key is present (even if empty {} - which clears all filters)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'filters' in viewConfig) {
            const filters = viewConfig.filters;
            gridApi.value.setFilterModel(isEmptyConfigValue(filters) ? null : filters);
            debugLog('[ViewConfiguration] Applied filters:', filters, '(empty clears all filters)');
          } else {
            debugLog('[ViewConfiguration] Skipped filters (key not present, keeping current state)');
          }
          
          // 2. Apply sorting if key is present (even if empty [] - which clears all sorting)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'sorting' in viewConfig) {
            const sorting = viewConfig.sorting;
            if (isEmptyConfigValue(sorting)) {
              // Clear all sorting
              gridApi.value.applyColumnState({
                defaultState: { sort: null },
              });
              debugLog('[ViewConfiguration] Cleared all sorting (empty array)');
            } else {
              gridApi.value.applyColumnState({
                state: sorting,
                defaultState: { sort: null },
              });
              debugLog('[ViewConfiguration] Applied sorting:', sorting);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped sorting (key not present, keeping current state)');
          }
          
          // 3. Apply column order if key is present (even if empty [] - which resets to default order)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'columnsOrder' in viewConfig) {
            const columnsOrder = viewConfig.columnsOrder;
            if (isEmptyConfigValue(columnsOrder) || !Array.isArray(columnsOrder)) {
              // Reset to default column order (from column definitions)
              const defaultOrder = gridApi.value.getAllGridColumns()?.filter(col => !isVirtualColumn(col)).map(col => col.getColId()) || [];
              setColumnOrder([...defaultOrder]);
              debugLog('[ViewConfiguration] Reset columns order to default:', defaultOrder);
            } else {
              gridApi.value.applyColumnState({
                state: columnsOrder.map((colId) => ({ colId })),
                applyOrder: true,
              });
              setColumnOrder([...columnsOrder]);
              debugLog('[ViewConfiguration] Applied columns order:', columnsOrder);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped columns order (key not present, keeping current state)');
          }
          
          // 4. Apply column sizes if key is present (even if empty {} - which resets to default widths)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'sizes' in viewConfig) {
            const sizes = viewConfig.sizes;
            const columns = gridApi.value.getAllGridColumns();
            
            if (isEmptyConfigValue(sizes)) {
              // Reset to default column widths from column configuration
              // Build column state with default widths (or null for flex columns)
              const columnState = [];
              const contentColumns = props.content?.columns || [];
              
              for (const col of columns) {
                const colId = col.getColId();
                // Find the column config to get default width
                const colConfig = contentColumns.find(c => 
                  (c?.actionName || c?.field) === colId
                );
                
                if (colConfig) {
                  // For flex columns, clear width to let flex take over
                  // For fixed columns, use the configured width
                  if (colConfig.widthAlgo === 'flex') {
                    columnState.push({ colId, width: null, flex: colConfig.flex ?? 1 });
                  } else if (colConfig.width && colConfig.width !== 'auto') {
                    const defaultWidth = wwLib.wwUtils.getLengthUnit(colConfig.width)?.[0];
                    if (defaultWidth) {
                      columnState.push({ colId, width: defaultWidth, flex: null });
                    }
                  }
                }
              }
              
              if (columnState.length > 0) {
                gridApi.value.applyColumnState({ state: columnState });
              }
              debugLog('[ViewConfiguration] Reset column sizes to default:', columnState);
            } else if (typeof sizes === 'object') {
              // Apply specific column widths
              const columnState = columns.map(col => {
                const colId = col.getColId();
                const width = sizes[colId];
                return width !== undefined ? { colId, width } : { colId };
              }).filter(state => state.width !== undefined);
              
              if (columnState.length > 0) {
                gridApi.value.applyColumnState({
                  state: columnState,
                });
                debugLog('[ViewConfiguration] Applied column sizes:', sizes);
              }
            }
          } else {
            debugLog('[ViewConfiguration] Skipped column sizes (key not present, keeping current state)');
          }
          
          // 5. Apply hidden columns if key is present
          if (viewConfig && 'hiddenColumns' in viewConfig) {
            const hidden = viewConfig.hiddenColumns;
            if (isEmptyConfigValue(hidden)) {
              // Show all columns (clear hidden state), but keep virtual columns hidden
              setHiddenColumns([]);
              chooserHiddenState.value = [];
              const allCols = gridApi.value.getAllGridColumns();
              const colIds = allCols?.filter(c => !isVirtualColumn(c)).map(c => c.getColId()).filter(Boolean) || [];
              if (colIds.length > 0) {
                gridApi.value.setColumnsVisible(colIds, true);
              }
              debugLog('[ViewConfiguration] Cleared all hidden columns (empty array)');
            } else if (Array.isArray(hidden)) {
              setHiddenColumns([...hidden]);
              chooserHiddenState.value = [...hidden];
              const hiddenSet = new Set(hidden);
              const allCols = gridApi.value.getAllGridColumns();
              const toShow = [];
              const toHide = [];
              allCols?.forEach(col => {
                const cid = col.getColId();
                if (!cid) return;
                // Virtual columns (sort/filter-only) must always stay hidden
                if (isVirtualColumn(col)) {
                  toHide.push(cid);
                  return;
                }
                (hiddenSet.has(cid) ? toHide : toShow).push(cid);
              });
              if (toShow.length) gridApi.value.setColumnsVisible(toShow, true);
              if (toHide.length) gridApi.value.setColumnsVisible(toHide, false);
              debugLog('[ViewConfiguration] Applied hidden columns:', hidden);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped hidden columns (key not present, keeping current state)');
          }

          // 6. Apply grouping config. Unlike the other keys above, an absent
          // 'grouping' key is treated as "disable grouping" — removing the key
          // from a view configuration must clear the grouped layout.
          {
            const groupingPresent = viewConfig && 'grouping' in viewConfig;
            const g = groupingPresent ? viewConfig.grouping : null;
            if (!groupingPresent || isEmptyConfigValue(g) || !g || !g.columnId) {
              groupingState.value = { columnId: null, order: [], collapsed: [], showUnassigned: true };
              groupGridApis.value = new Map();
              groupSelections.value = new Map();
              debugLog(
                groupingPresent
                  ? '[ViewConfiguration] Disabled grouping (empty or no columnId)'
                  : '[ViewConfiguration] Disabled grouping (key not present)'
              );
            } else if (isValidGroupColumn(g.columnId)) {
              groupingState.value = {
                columnId: g.columnId,
                order: Array.isArray(g.order) ? [...g.order] : [],
                collapsed: getStoredCollapsedForView(),
                showUnassigned: g.showUnassigned !== false,
              };
              // When grouping activates, we unmount the single grid and mount per-group grids.
              // Clear any stale per-group caches so fresh grid-ready events register them.
              groupGridApis.value = new Map();
              groupSelections.value = new Map();
              debugLog('[ViewConfiguration] Applied grouping:', groupingState.value);
            } else {
              console.warn(`[Datagrid] viewConfiguration.grouping.columnId="${g.columnId}" is invalid or not a select column — grouping ignored.`);
              groupingState.value = { columnId: null, order: [], collapsed: [], showUnassigned: true };
            }
          }

          // 7. Clear row selections when view changes (not on initial load)
          if (!isInitial) {
            try { gridApi.value.deselectAll(); } catch (_) { /* noop */ }
            groupGridApis.value.forEach(api => { try { api.deselectAll(); } catch (_) { /* noop */ } });
            groupSelections.value = new Map();
            setSelectedRows([]);
            debugLog('[ViewConfiguration] Cleared row selections');
          }
          
          // Store the applied config
          lastAppliedViewConfig.value = JSON.stringify(viewConfig);
          
          // Reset flag after a short delay to allow AG Grid events to settle
          // AG Grid events are triggered asynchronously after API calls
          setTimeout(() => {
            // Only the latest applyViewConfiguration call should clear the flag.
            // If a newer call was made, let that one handle cleanup.
            if (myGeneration !== applyViewConfigGeneration) {
              debugLog('[ViewConfiguration] Skipping cleanup for superseded apply (generation', myGeneration, 'vs', applyViewConfigGeneration + ')');
              return;
            }
            // Update currentConfig while flag is still true so that
            // updateViewEditedVariable() is skipped — the grid may report
            // minor differences (e.g. pixel rounding) that don't represent
            // a real user edit.
            updateCurrentConfig();
            // Sync chooser order and hidden state so the column management menu is up to date
            if (gridApi.value) {
              const gridCols = gridApi.value.getAllGridColumns()?.filter(c => !isVirtualColumn(c));
              chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
              chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
            }
            // Re-enable events AFTER config sync so the edited variable isn't
            // falsely set to true by the post-application snapshot
            isApplyingViewConfig.value = false;
            debugLog('[ViewConfiguration] View config application complete, events re-enabled');
          }, 100);
          
        } catch (e) {
          debugLog('[ViewConfiguration] Error applying view configuration:', e);
          if (myGeneration === applyViewConfigGeneration) {
            isApplyingViewConfig.value = false;
          }
          // Retry after a short delay if it's an AG Grid timing issue
          if (e.message && e.message.includes('#252')) {
            setTimeout(() => {
              applyViewConfiguration(viewConfig, isInitial);
            }, 100);
          }
        }
      }, 0);
    };

    // Watch for grid ready to apply initial view configuration
    watch(
      () => gridReady.value,
      (ready) => {
        if (!ready || !gridApi.value) return;
        
        // Apply initial view configuration when grid is ready
        if (cfg.value?.viewConfiguration) {
          applyViewConfiguration(cfg.value.viewConfiguration, true);
          // Grid now matches the initial config — reset the edited variable
          const variableId = cfg.value?.viewEditedVariableId;
          if (variableId) {
            try {
              wwLib.wwVariable.updateValue(variableId, false);
              debugLog(`[ViewEditedVariable] Set variable "${variableId}" → false (initial config applied)`);
            } catch (e) {
              debugLog('[ViewEditedVariable] Could not reset variable on init:', variableId, e);
            }
          }
        }
      },
      { immediate: true }
    );

    // Watch for viewConfiguration changes with optimized comparison
    watch(
      () => cfg.value?.viewConfiguration,
      (newConfig, oldConfig) => {
        if (!gridApi.value || !gridReady.value) return;
        
        // Use lightweight comparison instead of full JSON.stringify
        // Check if the config reference changed or key properties changed
        const isConfigChanged = newConfig !== oldConfig;
        let hasContentChanged = false;
        
        if (isConfigChanged && newConfig && oldConfig) {
          // Quick check of key properties instead of deep stringify
          const keys = ['filters', 'sorting', 'columnsOrder', 'sizes', 'hiddenColumns', 'grouping'];
          hasContentChanged = keys.some(key => {
            const newVal = newConfig[key];
            const oldVal = oldConfig[key];
            // Simple reference and length comparison
            if (newVal !== oldVal) {
              // grouping needs a structural compare on { columnId, order, collapsed, showUnassigned }
              if (key === 'grouping') {
                const a = newVal || {}; const b = oldVal || {};
                if ((a.columnId ?? null) !== (b.columnId ?? null)) return true;
                const aOrder = Array.isArray(a.order) ? a.order : [];
                const bOrder = Array.isArray(b.order) ? b.order : [];
                if (aOrder.length !== bOrder.length || aOrder.some((v, i) => v !== bOrder[i])) return true;
                const aCol = Array.isArray(a.collapsed) ? a.collapsed : [];
                const bCol = Array.isArray(b.collapsed) ? b.collapsed : [];
                if (aCol.length !== bCol.length) return true;
                const bSet = new Set(bCol);
                if (aCol.some(v => !bSet.has(v))) return true;
                if ((a.showUnassigned !== false) !== (b.showUnassigned !== false)) return true;
                return false;
              }
              if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                return newVal.length !== oldVal.length || newVal.some((item, idx) => item !== oldVal[idx]);
              }
              if (typeof newVal === 'object' && typeof oldVal === 'object') {
                const newKeys = newVal ? Object.keys(newVal) : [];
                const oldKeys = oldVal ? Object.keys(oldVal) : [];
                return newKeys.length !== oldKeys.length || newKeys.some(k => newVal[k] !== oldVal[k]);
              }
              return true;
            }
            return false;
          });
        } else if (isConfigChanged) {
          hasContentChanged = true;
        }
        
        // Always reset the edited variable whenever viewConfiguration changes,
        // regardless of whether the grid was re-synced — the new config is the new baseline.
        // We schedule the reset AFTER applyViewConfiguration has settled so that any
        // AG Grid events fired during/after the apply (which can arrive asynchronously,
        // e.g. due to pixel-rounding on sizes) cannot flip the variable back to true.
        const resetEditedVariable = (reason) => {
          const variableId = cfg.value?.viewEditedVariableId;
          if (!variableId) return;
          try {
            wwLib.wwVariable.updateValue(variableId, false);
            debugLog(`[ViewEditedVariable] Set variable "${variableId}" → false (${reason})`);
          } catch (e) {
            debugLog('[ViewEditedVariable] Could not reset variable:', variableId, e);
          }
        };

        // Open a suppression window so late grid events (from columns/data
        // rebuilding on page/table change) can't flip the edited variable to
        // true before the grid has settled on the new baseline.
        if (isConfigChanged) {
          suppressEditedUntil.value = Date.now() + 2000;
        }

        // Only apply grid changes if the configuration content actually changed
        if (hasContentChanged) {
          debugLog('[ViewConfiguration] Configuration changed, applying new view');
          applyViewConfiguration(newConfig, false);

          // Reset once apply settles. applyViewConfiguration clears its flag at ~100ms;
          // we reset just after that, and again a bit later to catch any late grid events.
          if (isConfigChanged) {
            setTimeout(() => resetEditedVariable('viewConfiguration changed'), 150);
            setTimeout(() => resetEditedVariable('viewConfiguration changed — late settle'), 400);
            setTimeout(() => resetEditedVariable('viewConfiguration changed — final settle'), 1000);
          }
        } else if (isConfigChanged) {
          // No grid apply needed — safe to reset immediately; no events will fire.
          resetEditedVariable('viewConfiguration changed');
        }
      }
      // Removed deep: true for better performance
    );

    // CRITICAL FIX: initialState should only be set once on mount, not reactive
    // If it's reactive, it will reset filters/sorting whenever props change
    // We use a ref to ensure it's set only once and never changes
    const initialState = ref(null);
    
    // Set initial state only once when component mounts
    // After the grid is ready and applies this state, we don't use it again
    // This prevents overriding user-applied filters and sorts
    if (!initialState.value) {
      const state = {
        partialColumnState: true,
      };
      // NOTE: Filters, sorts, and sizes are applied via watcher when viewConfiguration changes
      // We only set column order in initialState for AG Grid's initial render
      // At initialization, both "key absent" and "empty array []" use default column order
      // The distinction between absent vs empty matters for runtime changes (handled by applyViewConfiguration)
      const viewConfig = cfg.value?.viewConfiguration;
      const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
      const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;
      
      // Only set initial column order if explicitly provided with values
      if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
        state.columnOrder = {
          orderedColIds: viewColumnsOrder,
        };
      }
      initialState.value = state;

      // Seed groupingState from initial viewConfiguration so the component
      // mounts directly into multi-grid mode when grouping is pre-configured.
      // collapsed is hydrated from the dedicated WeWeb variable (keyed by view id).
      const initialGrouping = viewConfig && typeof viewConfig === 'object' ? viewConfig.grouping : null;
      if (initialGrouping && typeof initialGrouping === 'object' && initialGrouping.columnId) {
        groupingState.value = {
          columnId: initialGrouping.columnId,
          order: Array.isArray(initialGrouping.order) ? [...initialGrouping.order] : [],
          collapsed: getStoredCollapsedForView(),
          showUnassigned: initialGrouping.showUnassigned !== false,
        };
      }
    }

    const onRowSelected = (event) => {
      const name = event.node.isSelected() ? "rowSelected" : "rowDeselected";
      ctx.emit("trigger-event", {
        name,
        event: { row: event.data },
      });
    };

    const onRowDragged = (event) => {
      const rows = [];
      event.api.forEachNode((node) => {
        rows.push(node.data);
      });
      ctx.emit("trigger-event", {
        name: "rowDragged",
        event: {
          row: event.node.data,
          id: event.node.id,
          targetIndex: event.overIndex,
          rows,
        },
      });
    };

    const onRowDragEnter = (event) => {
      ctx.emit("trigger-event", {
        name: "rowDragStart",
        event: {
          row: event.node.data,
          id: event.node.id,
        },
      });
    };

    const onSelectionChanged = (event) => {
      if (!gridApi.value) return;
      const selected = gridApi.value.getSelectedRows() || [];
      setSelectedRows(selected);
    };

    const onFilterChanged = (event) => {
      if (!gridApi.value) return;

      const filterModel = gridApi.value.getFilterModel();
      if (
        JSON.stringify(filterModel || {}) !==
        JSON.stringify(filterValue.value || {})
      ) {
        setFilters(filterModel);
        
        // Update currentConfig to reflect the new filter state
        updateCurrentConfig();
        
        // Only emit event if this is a user-initiated change (not from view configuration)
        if (!isApplyingViewConfig.value) {
          ctx.emit("trigger-event", {
            name: "filterChanged",
            event: filterModel,
          });
        } else {
          debugLog('[FilterChanged] Skipping event emission - change is from view configuration');
        }

        // If using Supabase, debounce filter changes to avoid excessive API calls
        if (props.content?.dataSource === 'supabase') {
          // Clear existing debounce timer
          if (filterDebounceTimer.value) {
            clearTimeout(filterDebounceTimer.value);
          }

          // Debounce filter changes (300ms)
          filterDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, AG Grid automatically handles filter changes
              // when filterChangedCallback() is called by the filter component.
              // It resets its cache and calls getRows with the new filterModel.
              // We do NOT need to manually set the datasource - that causes duplicate queries.
              // Just update records after the grid has refreshed.
              // AG Grid handles this automatically - just update records after refresh
              nextTick(() => {
                setTimeout(() => {
                  updateRecordsFromGrid();
                }, 200);
              });
            } else {
              // For pagination mode, fetch data
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
              // Records will be updated when rowData changes (via watch)
            }
          }, 300);
        } else {
          // For non-Supabase, update records after filter change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
      }
    };

    const onSortChanged = (event) => {
      if (!gridApi.value) return;

      const state = gridApi.value.getState();
      if (
        JSON.stringify(state.sort?.sortModel || []) !==
        JSON.stringify(sortValue.value || [])
      ) {
        setSort(state.sort?.sortModel || []);
        
        // Update currentConfig to reflect the new sort state
        updateCurrentConfig();
        
        // Only emit event if this is a user-initiated change (not from view configuration)
        if (!isApplyingViewConfig.value) {
          ctx.emit("trigger-event", {
            name: "sortChanged",
            event: state.sort?.sortModel || [],
          });
        } else {
          debugLog('[SortChanged] Skipping event emission - change is from view configuration');
        }

        // If using Supabase, refetch data with new sort
        if (props.content?.dataSource === 'supabase') {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, AG Grid automatically handles sort changes.
            // It resets its cache and calls getRows with the new sortModel.
            // We do NOT need to manually set the datasource - that causes duplicate queries.
            // Just update records after the grid has refreshed.
            // AG Grid handles this automatically - just update records after refresh
            nextTick(() => {
              setTimeout(() => {
                updateRecordsFromGrid();
              }, 200);
            });
          } else {
            // For pagination mode, fetch data
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = state.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            // Records will be updated when rowData changes (via watch)
          }
        } else {
          // For non-Supabase, update records after sort change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
      }
    };

    const onPaginationChanged = (event) => {
      if (!gridApi.value) return;
      
      // Skip pagination changes if infinite scrolling is enabled
      if (isInfiniteScrollEnabled.value) {
        return;
      }
      
      // Skip if we're updating data locally (e.g., fake junction records)
      // This prevents refreshCells from triggering unnecessary fetches
      if (isUpdatingDataLocally.value) {
        return;
      }
      
      // If using Supabase, refetch data for new page
      if (props.content?.dataSource === 'supabase') {
        const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
        const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
        const filterModel = gridApi.value.getFilterModel();
        const state = gridApi.value.getState();
        const sortModel = state?.sort?.sortModel || [];
        const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
        fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
        // Records will be updated when rowData changes (via watch)
      } else {
        // For non-Supabase, update records after pagination change
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }
    };

    const onColumnMoved = (event) => {
      if (!event.finished || event.source !== "uiColumnMoved") return;
      const columns = event.api.getAllGridColumns().filter(col => !isVirtualColumn(col));
      const newOrder = columns.map((col) => col.getColId());
      setColumnOrder(newOrder);

      // Keep chooser panel in sync so it doesn't show a stale order if open
      if (showColumnChooser.value) {
        chooserColumnOrder.value = newOrder.filter(Boolean);
      }

      // Update currentConfig to reflect the new column order
      updateCurrentConfig();

      ctx.emit("trigger-event", {
        name: "columnMoved",
        event: {
          toIndex: event.toIndex,
          columnId: event.column.getColId(),
          columnsOrder: columns.map((col) => col.getColId()),
        },
      });
    };

    const onColumnResized = (event) => {
      // Only emit on user-initiated resize that is finished
      if (!event.finished || event.source !== "uiColumnResized") return;
      
      const columns = event.api.getAllGridColumns();
      const columnsWidths = {};
      
      // Build an object of all column widths
      columns.forEach((col) => {
        const colId = col.getColId();
        const actualWidth = col.getActualWidth();
        if (colId && actualWidth) {
          columnsWidths[colId] = actualWidth;
        }
      });
      
      // Update currentConfig to reflect the new column widths
      updateCurrentConfig();
      
      // Get the resized column info
      const resizedColumn = event.column;
      const columnId = resizedColumn?.getColId();
      const width = resizedColumn?.getActualWidth();
      
      ctx.emit("trigger-event", {
        name: "columnResized",
        event: {
          columnId: columnId,
          width: width,
          columnsWidths: columnsWidths,
        },
      });
    };

    // ========== GROUPING EVENT HANDLERS ==========

    const getGroupHorizontalScrollViewports = () => {
      if (!gridContainerRef.value) return [];
      return Array.from(
        gridContainerRef.value.querySelectorAll('.ww-group__grid .ag-body-horizontal-scroll-viewport')
      );
    };

    const runAfterGroupLayout = (callback) => {
      nextTick(() => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(callback);
        } else {
          setTimeout(callback, 0);
        }
      });
    };

    const updateGroupHorizontalScrollbarMetrics = () => {
      runAfterGroupLayout(() => {
        const viewport = getGroupHorizontalScrollViewports().find(el => el.scrollWidth > 0);
        groupHorizontalScrollWidth.value = viewport?.scrollWidth || 0;
        groupHorizontalViewportWidth.value = viewport?.clientWidth || 0;
        if (viewport && gridContainerRef.value) {
          const containerRect = gridContainerRef.value.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          groupHorizontalScrollLeft.value = Math.max(0, viewportRect.left - containerRect.left);
        } else {
          groupHorizontalScrollLeft.value = 0;
        }

        if (viewport && groupHorizontalScrollRef.value) {
          groupHorizontalScrollRef.value.scrollLeft = viewport.scrollLeft || 0;
        }
      });
    };

    const syncGroupHorizontalScrollLeft = (left) => {
      if (isSyncingGroupHorizontalScroll.value) return;
      isSyncingGroupHorizontalScroll.value = true;

      const nextLeft = Number.isFinite(left) ? left : 0;
      getGroupHorizontalScrollViewports().forEach((viewport) => {
        if (Math.abs((viewport.scrollLeft || 0) - nextLeft) > 1) {
          viewport.scrollLeft = nextLeft;
          viewport.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
      });

      if (groupHorizontalScrollRef.value && Math.abs(groupHorizontalScrollRef.value.scrollLeft - nextLeft) > 1) {
        groupHorizontalScrollRef.value.scrollLeft = nextLeft;
      }

      const releaseSync = () => {
        isSyncingGroupHorizontalScroll.value = false;
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(releaseSync);
      } else {
        setTimeout(releaseSync, 0);
      }
    };

    const onGroupHorizontalScrollbarScroll = (event) => {
      syncGroupHorizontalScrollLeft(event?.target?.scrollLeft || 0);
    };

    const onGroupBodyScroll = (event) => {
      if (isSyncingGroupHorizontalScroll.value) return;
      const left = typeof event?.left === 'number'
        ? event.left
        : (getGroupHorizontalScrollViewports()[0]?.scrollLeft || 0);
      if (groupHorizontalScrollRef.value && Math.abs(groupHorizontalScrollRef.value.scrollLeft - left) > 1) {
        groupHorizontalScrollRef.value.scrollLeft = left;
      }
    };

    const handleGroupHorizontalResize = () => {
      if (isGroupingActive.value) {
        updateGroupHorizontalScrollbarMetrics();
      }
    };

    watch(
      () => [isGroupingActive.value, orderedGroups.value.length],
      ([active]) => {
        if (active) {
          updateGroupHorizontalScrollbarMetrics();
        } else {
          groupHorizontalScrollWidth.value = 0;
          groupHorizontalViewportWidth.value = 0;
          groupHorizontalScrollLeft.value = 0;
        }
      },
      { flush: 'post' }
    );

    onMounted(() => {
      const frontWindow = wwLib?.getFrontWindow?.() || window;
      frontWindow.addEventListener('resize', handleGroupHorizontalResize);
      updateGroupHorizontalScrollbarMetrics();
    });

    // Called when each group grid fires grid-ready. Registers the api and
    // applies current shared state (filter / sort / widths) so a newly-expanded
    // group picks up the live view.
    const onGroupGridReady = (groupValue, params) => {
      groupGridApis.value.set(groupValue, params.api);
      // Trigger reactivity
      groupGridApis.value = new Map(groupGridApis.value);

      // Promote the first group's api to the primary `gridApi` so existing
      // code paths that reference gridApi.value keep working.
      if (!gridApi.value || !Array.from(groupGridApis.value.values()).includes(gridApi.value)) {
        gridApi.value = params.api;
        gridReady.value = true;
      }

      // Apply any already-active filter / sort / widths to this new grid
      try {
        const filterModel = filterValue.value || {};
        if (filterModel && Object.keys(filterModel).length > 0) {
          params.api.setFilterModel(filterModel);
        }
        const sortModel = Array.isArray(sortValue.value) ? sortValue.value : [];
        if (sortModel.length > 0) {
          params.api.applyColumnState({ state: sortModel, defaultState: { sort: null } });
        }
        // Apply widths from currentConfig.sizes if available
        const sizes = currentConfig.value?.sizes;
        if (sizes && typeof sizes === 'object' && Object.keys(sizes).length > 0) {
          const state = Object.entries(sizes).map(([colId, width]) => ({ colId, width }));
          params.api.applyColumnState({ state });
        }
        // Apply column order if available
        const order = Array.isArray(columnOrder.value) ? columnOrder.value : [];
        if (order.length > 0) {
          params.api.applyColumnState({
            state: order.map(colId => ({ colId })),
            applyOrder: true,
          });
        }
      } catch (e) {
        debugLog('[Grouping] Error applying initial state to new group grid:', e);
      }

      updateGroupHorizontalScrollbarMetrics();

      // In infinite-scroll mode, assign this group's datasource — but stagger
      // the assignment across groups so N grids don't fire getRows in the same
      // tick (which can trigger AG Grid error #252 on initial mount and also
      // hammer Supabase with N parallel requests). Stagger = 100ms + 50ms × index.
      if (isInfiniteScrollEnabled.value && isGroupingActive.value) {
        const idx = orderedGroups.value.findIndex(g => g.value === groupValue);
        const delay = 100 + Math.max(0, idx) * 50;
        setTimeout(() => {
          // Guard: grid might have been unmounted (collapsed) or grouping disabled
          // before the timer fires.
          const stillMounted = groupGridApis.value.get(groupValue) === params.api;
          if (!stillMounted || !isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
          const ds = groupDatasourceFor(groupValue);
          if (!ds) return;
          try {
            params.api.setGridOption('datasource', ds);
            debugLog(`[Group Infinite] Assigned datasource for "${groupValue}" after ${delay}ms`);
          } catch (e) {
            console.warn(`[Group Infinite] Failed to set datasource for "${groupValue}":`, e?.message);
          }
        }, delay);
      }
    };

    const onGroupGridUnmounted = (groupValue) => {
      groupGridApis.value.delete(groupValue);
      groupGridApis.value = new Map(groupGridApis.value);
      groupSelections.value.delete(groupValue);
      updateGroupHorizontalScrollbarMetrics();
    };

    // Route a single-grid event to every group grid, then run the legacy handler
    // with the firing grid set as `gridApi.value`.
    const withFiringGrid = (event, handler) => {
      const prev = gridApi.value;
      try {
        if (event?.api) gridApi.value = event.api;
        return handler(event);
      } finally {
        gridApi.value = prev;
      }
    };

    const onGroupFilterChanged = (groupValue, event) => {
      if (isSyncingFilters.value) return;
      if (!event?.api) return;
      isSyncingFilters.value = true;
      try {
        const model = event.api.getFilterModel();
        groupGridApis.value.forEach((api, gv) => {
          if (gv === groupValue) return;
          try { api.setFilterModel(model); } catch (_) { /* noop */ }
        });
      } finally {
        nextTick(() => { isSyncingFilters.value = false; });
      }
      withFiringGrid(event, onFilterChanged);
      // Refresh the per-group badge counts to reflect the new filter — counts
      // would otherwise stay stale until each group's grid is opened.
      scheduleRefreshGroupCounts();
    };

    const onGroupSortChanged = (groupValue, event) => {
      if (isSyncingSort.value) return;
      if (!event?.api) return;
      isSyncingSort.value = true;
      try {
        const sortModel = event.api.getState()?.sort?.sortModel || [];
        groupGridApis.value.forEach((api, gv) => {
          if (gv === groupValue) return;
          try { api.applyColumnState({ state: sortModel, defaultState: { sort: null } }); } catch (_) { /* noop */ }
        });
      } finally {
        nextTick(() => { isSyncingSort.value = false; });
      }
      withFiringGrid(event, onSortChanged);
    };

    const onGroupColumnResized = (groupValue, event) => {
      if (!event?.finished || event.source !== 'uiColumnResized') return;
      if (isSyncingLayout.value) return;
      isSyncingLayout.value = true;
      try {
        const columns = event.api.getAllGridColumns() || [];
        const state = columns.map(col => ({ colId: col.getColId(), width: col.getActualWidth() }));
        groupGridApis.value.forEach((api, gv) => {
          if (gv === groupValue) return;
          try { api.applyColumnState({ state }); } catch (_) { /* noop */ }
        });
      } finally {
        nextTick(() => {
          isSyncingLayout.value = false;
          updateGroupHorizontalScrollbarMetrics();
        });
      }
      withFiringGrid(event, onColumnResized);
    };

    const onGroupColumnMoved = (groupValue, event) => {
      if (!event?.finished || event.source !== 'uiColumnMoved') return;
      if (isSyncingLayout.value) return;
      isSyncingLayout.value = true;
      try {
        const columns = event.api.getAllGridColumns().filter(col => !isVirtualColumn(col));
        const newOrder = columns.map(col => col.getColId());
        groupGridApis.value.forEach((api, gv) => {
          if (gv === groupValue) return;
          try { api.applyColumnState({ state: newOrder.map(colId => ({ colId })), applyOrder: true }); } catch (_) { /* noop */ }
        });
      } finally {
        nextTick(() => {
          isSyncingLayout.value = false;
          updateGroupHorizontalScrollbarMetrics();
        });
      }
      withFiringGrid(event, onColumnMoved);
    };

    const onGroupSelectionChanged = (groupValue, event) => {
      if (!event?.api) return;
      const selected = event.api.getSelectedRows() || [];
      groupSelections.value.set(groupValue, selected);
      const all = [];
      groupSelections.value.forEach(rows => { all.push(...rows); });
      setSelectedRows(all);
    };

    // Per-group selection event emits (rowSelected/rowDeselected)
    const onGroupRowSelected = (groupValue, event) => {
      const name = event.node.isSelected() ? 'rowSelected' : 'rowDeselected';
      ctx.emit('trigger-event', {
        name,
        event: { row: event.data },
      });
    };

    // Drag-and-drop reorder for group headers
    const resetGroupDrag = () => {
      groupDragValue.value = null;
      groupDragOverValue.value = null;
    };

    const onGroupDragStart = (groupValue) => {
      groupDragValue.value = groupValue;
    };

    const onGroupDragOver = (groupValue) => {
      if (groupDragValue.value && groupValue !== groupDragValue.value) {
        groupDragOverValue.value = groupValue;
      }
    };

    const onGroupDrop = (targetValue) => {
      const from = groupDragValue.value;
      if (!from || from === targetValue) { resetGroupDrag(); return; }
      const currentOrder = orderedGroups.value.map(g => g.value);
      const fi = currentOrder.indexOf(from);
      const ti = currentOrder.indexOf(targetValue);
      if (fi === -1 || ti === -1) { resetGroupDrag(); return; }
      const next = [...currentOrder];
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      writeGroupingToViewConfig({ order: next });
      resetGroupDrag();
    };

    const onGroupDragEnd = () => {
      resetGroupDrag();
    };

    // Toggle a single group's collapsed state and persist
    const toggleGroupCollapsed = (groupValue) => {
      const collapsed = Array.isArray(groupingState.value?.collapsed) ? [...groupingState.value.collapsed] : [];
      const idx = collapsed.indexOf(groupValue);
      if (idx >= 0) collapsed.splice(idx, 1);
      else collapsed.push(groupValue);
      writeGroupingToViewConfig({ collapsed });
      updateGroupHorizontalScrollbarMetrics();
    };

    const collapseAllGroups = () => {
      const all = orderedGroups.value.map(g => g.value);
      writeGroupingToViewConfig({ collapsed: all });
      updateGroupHorizontalScrollbarMetrics();
    };

    const expandAllGroups = () => {
      writeGroupingToViewConfig({ collapsed: [] });
      updateGroupHorizontalScrollbarMetrics();
    };

    // Merge a partial grouping update into groupingState and refresh currentConfig.
    // When `collapsed` is part of the update, persist it to the dedicated WeWeb
    // variable (keyed by view id) — collapsed state is no longer part of
    // viewConfiguration. Collapsed-only updates never refresh currentConfig or
    // touch the view-edited variable, so toggling groups never marks the view
    // as edited.
    const writeGroupingToViewConfig = (partial) => {
      const prev = groupingState.value || {};
      const next = {
        columnId: prev.columnId ?? null,
        order: Array.isArray(prev.order) ? [...prev.order] : [],
        collapsed: Array.isArray(prev.collapsed) ? [...prev.collapsed] : [],
        showUnassigned: prev.showUnassigned !== false,
        ...partial,
      };
      groupingState.value = next;

      const partialKeys = Object.keys(partial || {});
      const onlyCollapsed = partialKeys.length === 1 && partialKeys[0] === 'collapsed';

      if ('collapsed' in partial) {
        persistCollapsedForView(next.collapsed);
      }

      if (onlyCollapsed) return;
      updateCurrentConfig();
    };

    const afterNextPaint = (callback) => {
      const schedule = () => setTimeout(callback, 0);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(schedule);
      } else {
        schedule();
      }
    };

    const startGroupingTransition = () => {
      if (groupingTransitionTimer) {
        clearTimeout(groupingTransitionTimer);
        groupingTransitionTimer = null;
      }
      groupingTransitionStartedAt.value = Date.now();
      isGroupingTransitionLoading.value = true;
    };

    const finishGroupingTransition = () => {
      if (groupingTransitionTimer) {
        clearTimeout(groupingTransitionTimer);
      }
      const elapsed = Date.now() - groupingTransitionStartedAt.value;
      const delay = Math.max(180 - elapsed, 0);
      groupingTransitionTimer = setTimeout(() => {
        isGroupingTransitionLoading.value = false;
        pendingGroupingColumnId.value = null;
        groupingTransitionTimer = null;
      }, delay);
    };

    const applyGroupingWithLoading = (partial) => {
      startGroupingTransition();
      afterNextPaint(() => {
        try {
          writeGroupingToViewConfig(partial);
        } finally {
          nextTick(() => afterNextPaint(finishGroupingTransition));
        }
      });
    };

    // Re-hydrate collapsed state when the active view changes (e.g. user switches
    // views) or when the external collapsed-state variable is mutated elsewhere.
    // Reading both inside the watch source ensures Vue tracks them as deps.
    watch(
      () => {
        let viewId = null;
        let mapEntry;
        try { viewId = wwLib.wwVariable.getValue(VIEW_VARIABLE_ID)?.id ?? null; } catch (e) { viewId = null; }
        try {
          const map = wwLib.wwVariable.getValue(GROUP_COLLAPSED_VARIABLE_ID);
          mapEntry = map && typeof map === 'object' && viewId ? map[viewId] : undefined;
        } catch (e) { mapEntry = undefined; }
        return { viewId, mapEntry };
      },
      () => {
        const stored = getStoredCollapsedForView();
        const cur = Array.isArray(groupingState.value?.collapsed) ? groupingState.value.collapsed : [];
        const sameLength = cur.length === stored.length;
        const sameSet = sameLength && cur.every(v => stored.includes(v));
        if (sameSet) return;
        groupingState.value = { ...groupingState.value, collapsed: stored };
        updateGroupHorizontalScrollbarMetrics();
      },
      { deep: true }
    );

    // Columns that qualify as a grouping target (cellDataType === 'select').
    // Drives the dropdown inside the chooser panel's Grouping tab.
    // displayName prefers the user-facing label (headerName) and falls back to
    // displayName / field so it stays readable even if headerName is unset.
    const selectableGroupingColumns = computed(() => {
      const cols = Array.isArray(props.content?.columns) ? props.content.columns : [];
      return cols
        .filter(c => c?.field && c?.cellDataType === 'select')
        .map(c => ({
          field: c.field,
          displayName: c.headerName || c.displayName || c.field,
        }));
    });

    // Switch (or clear) the grouping column. Clearing also resets order/collapsed.
    const setGroupingColumn = (colId) => {
      const next = colId || null;
      pendingGroupingColumnId.value = next || '';
      if (!next) {
        applyGroupingWithLoading({ columnId: null, order: [], collapsed: [] });
        return;
      }
      // Changing to a different column — wipe order/collapsed since they referenced
      // the previous column's option values.
      const prev = groupingState.value?.columnId;
      if (prev !== next) {
        applyGroupingWithLoading({ columnId: next, order: [], collapsed: [] });
      } else {
        applyGroupingWithLoading({ columnId: next });
      }
    };

    // Toggle visibility of the Unassigned group (rows whose grouping value is null/empty).
    const setShowUnassigned = (show) => {
      writeGroupingToViewConfig({ showUnassigned: !!show });
    };

    // Locate the group grid that contains a given rowId.
    const findGroupForRowId = (rowId) => {
      if (!isGroupingActive.value) return null;
      for (const [gv, api] of groupGridApis.value.entries()) {
        try {
          const node = findRowNode(api, rowId, resolveMappingFormula, props.content);
          if (node) return { groupValue: gv, api, node };
        } catch (_) { /* continue */ }
      }
      return null;
    };
    // ========== /GROUPING EVENT HANDLERS ==========

    // Track scroll debounce timer
    const scrollDebounceTimer = ref(null);

    // Cleanup on unmount
    onBeforeUnmount(() => {
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      if (filterDebounceTimer.value) {
        clearTimeout(filterDebounceTimer.value);
      }
      if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value);
      }
      if (groupingTransitionTimer) {
        clearTimeout(groupingTransitionTimer);
        groupingTransitionTimer = null;
      }
      const frontWindow = wwLib?.getFrontWindow?.() || window;
      frontWindow.removeEventListener('resize', handleGroupHorizontalResize);
    });

    const onBodyScroll = (event) => {
      if (!gridApi.value) return;

      // Track scroll frequency for performance monitoring
      gridMonitor.trackScroll();

      const api = event?.api || gridApi.value;
      
      // Get scroll container dimensions from the grid container ref
      if (!gridContainerRef.value) return;
      
      const scrollContainer = gridContainerRef.value.querySelector('.ag-body-viewport');
      if (!scrollContainer) return;
      
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const scrollTopPos = scrollContainer.scrollTop || event?.top || 0;
      const scrollLeftPos = scrollContainer.scrollLeft || event?.left || 0;
      
      // Calculate if near bottom (within 100px of bottom)
      const distanceFromBottom = scrollHeight - (scrollTopPos + clientHeight);
      const isNearBottom = distanceFromBottom <= 100;
      const isAtBottom = distanceFromBottom <= 5;
      
      // Debounce to avoid too many events
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      
      scrollDebounceTimer.value = setTimeout(() => {
        // Emit scroll event with useful information for pagination management
        ctx.emit("trigger-event", {
          name: "scroll",
          event: {
            scrollTop: scrollTopPos,
            scrollLeft: scrollLeftPos,
            scrollHeight: scrollHeight,
            clientHeight: clientHeight,
            distanceFromBottom: distanceFromBottom,
            isNearBottom: isNearBottom,
            isAtBottom: isAtBottom,
            totalRows: api.getDisplayedRowCount() || 0,
          },
        });
      }, 100); // 100ms debounce to reduce event frequency
    };

    /* wwEditor:start */
    const { createElement } = wwLib.useCreateElement();
    /* wwEditor:end */

    // Hack to force pagination page size update when changing pagination selector mode
    const forcedPaginationPageSize = ref(false);
    watch(
      () => props.content.hasPaginationSelector,
      (newVal, oldVal) => {
        if (oldVal === "multiple" && newVal !== "multiple") {
          forcedPaginationPageSize.value = true;
          nextTick().then(() => {
            forcedPaginationPageSize.value = false;
          });
        }
      }
    );

    // Determine if infinite scrolling is enabled
    const isInfiniteScrollEnabled = computed(() => {
      return cfg.value?.dataSource === 'supabase' && cfg.value?.enableInfiniteScroll === true;
    });

    // Row model type - 'infinite' if enabled, otherwise undefined (defaults to client-side)
    const rowModelType = computed(() => {
      return isInfiniteScrollEnabled.value ? 'infinite' : undefined;
    });

    // Row drag managed - disabled for infinite row model (not supported by AG Grid)
    const rowDragManaged = computed(() => {
      return !isInfiniteScrollEnabled.value;
    });

    // Pagination should be disabled when infinite scrolling is enabled
    const paginationEnabled = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return false;
      }
      return props.content?.pagination;
    });

    // Cache block size for infinite scrolling
    const cacheBlockSize = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return cfg.value?.infiniteBlockSize || 200;
      }
      return undefined;
    });

    // Create datasource for infinite scrolling
    const datasource = computed(() => {
      if (!isInfiniteScrollEnabled.value) {
        return undefined;
      }

      return {
        rowCount: undefined, // Will be determined dynamically
        getRows: async (params) => {
          const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;

          // Skip fetching if we're updating data locally (e.g., removing a row)
          // This prevents unnecessary re-fetches when we're making local modifications
          // For infinite scroll, AG Grid will automatically try to refetch when rows are removed
          // We prevent this by checking the flag and using the current supabaseData cache
          if (isUpdatingDataLocally.value) {
            // IMPORTANT: We need to check if the requested block matches our cached block
            // If it doesn't, we should return empty data to force AG Grid to hide those rows
            // Otherwise, return filtered cached data
            
            let cachedData = Array.isArray(supabaseData.value) ? [...supabaseData.value] : [];
            let cachedTotal = supabaseTotalCount.value || 0;
            
            // CRITICAL: Filter out any removed rows (tracked in removedRowIds ref)
            // This ensures removed rows don't appear when datasource is refreshed
            if (removedRowIds.value && removedRowIds.value.size > 0) {
              const beforeFilter = cachedData.length;
              cachedData = cachedData.filter(row => {
                if (!row) return false; // Skip null/undefined rows
                // Get row ID using idFormula
                const rowId = resolveMappingFormula(props.content?.idFormula, row);
                const rowIdStr = rowId != null ? String(rowId) : '';
                // Keep row if it's not in the removed set
                return !removedRowIds.value.has(rowIdStr);
              });
              const afterFilter = cachedData.length;
              // Adjust total count if we filtered out rows
              if (beforeFilter > afterFilter && cachedTotal > 0) {
                cachedTotal = Math.max(0, cachedTotal - (beforeFilter - afterFilter));
              }
            }
            
            // Return filtered cached data
            // If cached data is empty or we filtered everything out, return empty with adjusted total
            // This tells AG Grid there's no data for this block, which will hide empty rows
            const finalTotal = cachedData.length > 0 ? cachedTotal : (cachedTotal > 0 ? cachedTotal : 0);
            // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
            // This ensures the callback is called outside the render cycle
            isGridRendering.value = true;
            setTimeout(() => {
              try {
                successCallback(cachedData, finalTotal > 0 ? finalTotal : (cachedData.length > 0 ? undefined : 0));
              } finally {
                // Clear the rendering flag after a small delay
                setTimeout(() => {
                  isGridRendering.value = false;
                }, 50);
              }
            }, 0);
            return;
          }
          const requestedBlockSize = endRow - startRow;

          try {
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            
            const { data, totalCount } = await fetchSupabaseDataForInfinite(
              startRow,
              endRow,
              filterModel,
              sortModel,
              searchValue
            );

            // Determine if this is the last row
            // If we got fewer rows than requested, or if we've reached the total count, we're done
            const rowCount = data.length;
            
            // CRITICAL FIX: Handle 0 rows case
            // If totalCount is 0, we're definitely done (no rows to show)
            // If we got fewer rows than requested, we're done (last block)
            // If we've reached or exceeded totalCount, we're done
            const isLastBlock = totalCount === 0 || 
                                rowCount < requestedBlockSize || 
                                (totalCount > 0 && endRow >= totalCount);
            
            // CRITICAL FIX: Set lastRow to 0 when totalCount is 0 (no rows)
            // This tells AG Grid to stop fetching and show "no rows" message
            const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

            // Update supabaseData for records variable first (before callback)
            // Note: In infinite scroll mode, supabaseData will only contain the current block
            // The grid manages the full dataset internally
            supabaseData.value = data;
            supabaseTotalCount.value = totalCount;

            // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
            // This ensures the callback is called outside the current render cycle
            isGridRendering.value = true;
            setTimeout(() => {
              try {
                // Call success callback with the data
                successCallback(data, lastRow);
              } catch (error) {
                console.error('[Infinite Scroll] Error in successCallback:', error);
              } finally {
                // Clear the rendering flag after a small delay to allow grid to finish
                setTimeout(() => {
                  isGridRendering.value = false;
                  // Update records from grid after rendering is complete
                  nextTick(() => {
                    setTimeout(() => {
                      updateRecordsFromGrid();
                    }, 50);
                  });
                }, 50);
              }
            }, 0);
          } catch (error) {
            console.error('[Infinite Scroll] Error in getRows:', error);
            isGridRendering.value = false;
            setTimeout(() => {
              failCallback();
            }, 0);
          }
        },
      };
    });

    // CRITICAL FIX: Delay datasource initialization to prevent error #252
    // AG Grid can call getRows during its initial render cycle, causing conflicts
    // We use a ref that's set after grid is ready, not a computed, to have better control
    const delayedDatasource = ref(undefined);
    
    // Watch for grid ready to set the datasource after a delay
    watch(
      () => [gridReady.value, isInfiniteScrollEnabled.value, datasource.value],
      ([ready, infiniteEnabled, ds]) => {
        if (ready && infiniteEnabled && ds && !delayedDatasource.value) {
          // Delay setting the datasource to allow grid to finish initial render
          setTimeout(() => {
            delayedDatasource.value = ds;
          }, 100);
        } else if (!infiniteEnabled) {
          delayedDatasource.value = undefined;
        }
      },
      { immediate: true }
    );

    // ========== PER-GROUP INFINITE-SCROLL DATASOURCES ==========
    // Each group grid gets its own IDatasource whose getRows injects a filter
    // for its group value. Datasources are memoized by groupValue so the prop
    // identity is stable across renders — AG Grid only resets its cache when
    // the datasource reference itself changes.

    // Map<groupValue, IDatasource> — memoized factory cache.
    const groupDatasourceCache = new Map();

    // Build a filter model that forces the grouping column to match `groupValue`.
    // For UNASSIGNED_GROUP we use the `__empty__` sentinel which convertFilterToSupabase
    // now translates to `IS NULL`.
    const buildGroupFilterModel = (baseFilterModel, groupValue) => {
      const colId = groupingColumnId.value;
      if (!colId) return baseFilterModel || {};
      const merged = { ...(baseFilterModel || {}) };
      const values = groupValue === UNASSIGNED_GROUP ? ['__empty__'] : [groupValue];
      merged[colId] = { type: 'selectFilter', values };
      return merged;
    };

    // Returns a memoized IDatasource for the given group value.
    // Returns undefined when not in grouping + infinite-scroll mode.
    const groupDatasourceFor = (groupValue) => {
      if (!isGroupingActive.value || !isInfiniteScrollEnabled.value) return undefined;
      const key = String(groupValue);
      const existing = groupDatasourceCache.get(key);
      if (existing) return existing;

      const ds = {
        rowCount: undefined,
        getRows: async (params) => {
          const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;
          const mergedFilter = buildGroupFilterModel(filterModel, groupValue);
          const requestedBlockSize = endRow - startRow;

          try {
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            const { data, totalCount } = await fetchSupabaseDataForInfinite(
              startRow,
              endRow,
              mergedFilter,
              sortModel,
              searchValue
            );

            // Cache per-group total so badge counts stay accurate.
            if (typeof totalCount === 'number' && totalCount >= 0) {
              const next = new Map(groupInfiniteCounts.value);
              next.set(groupValue, totalCount);
              groupInfiniteCounts.value = next;
            }

            const rowCount = data.length;
            const isLastBlock =
              totalCount === 0 ||
              rowCount < requestedBlockSize ||
              (totalCount > 0 && endRow >= totalCount);
            const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

            // Defer to avoid AG Grid error #252 (callback during render cycle).
            setTimeout(() => {
              try { successCallback(data, lastRow); }
              catch (e) { console.error(`[Group Infinite] successCallback error for "${groupValue}":`, e); }
            }, 0);
          } catch (error) {
            console.error(`[Group Infinite] getRows error for "${groupValue}":`, error);
            setTimeout(() => { try { failCallback(); } catch (_) { /* noop */ } }, 0);
          }
        },
      };
      groupDatasourceCache.set(key, ds);
      return ds;
    };

    // Invalidate the datasource cache (and counts) when grouping column changes
    // or infinite-scroll toggles. A new cache entry produces a new reference,
    // which causes AG Grid to rebuild its infinite cache for each group.
    watch(
      () => [groupingColumnId.value, isInfiniteScrollEnabled.value],
      () => {
        groupDatasourceCache.clear();
        groupInfiniteCounts.value = new Map();
      }
    );

    // Refresh a specific group's infinite cache (e.g. after a cross-group cell edit).
    const refreshGroupInfiniteCache = (groupValue) => {
      if (!isInfiniteScrollEnabled.value) return;
      const api = groupGridApis.value.get(groupValue);
      if (!api) return;
      try { api.purgeInfiniteCache(); }
      catch (e) { console.warn(`[Group Infinite] purge failed for "${groupValue}":`, e?.message); }
    };

    // ========== UPFRONT GROUP COUNTS ==========
    // Without this, group badges only display once a group's grid is opened
    // (the count is a side-effect of the rows fetch in groupDatasourceFor).
    // Here we fire a count-only Supabase request per group up front so badges
    // are populated even while groups are collapsed.

    const fetchSupabaseGroupCount = async (filterModel) => {
      if (props.content?.dataSource !== 'supabase') return null;
      const tableName = props.content?.supabaseTable;
      if (!tableName) return null;
      try {
        const supabase = await waitForSupabaseInstance(10000, 100);
        if (!supabase) return null;
        return await fetchSupabaseDataCount({
          supabaseInstance: supabase,
          tableName,
          manualFilters: props.content?.supabaseFilters,
          searchValue: props.content?.enableSearch ? props.content?.searchValue : null,
          searchableColumns: props.content?.searchableColumns || [],
          filterModel,
          applyManualFilters,
          applySearchToSupabase,
          convertFilterToSupabase,
          formatFiltersForLog,
        });
      } catch (error) {
        console.error('[Group Count] fetch error:', error);
        return null;
      }
    };

    // Pull the AG Grid filter model that's currently active. In multi-grid mode
    // all group grids share the same filter (synced by onGroupFilterChanged), so
    // any one will do. Falls back to viewConfiguration.filters if grids aren't
    // mounted yet (initial load).
    const getCurrentFilterModelForCount = () => {
      for (const api of groupGridApis.value.values()) {
        try {
          const m = api.getFilterModel();
          if (m) return m;
        } catch (_) { /* noop */ }
      }
      const vc = cfg.value?.viewConfiguration;
      if (vc && vc.filters && typeof vc.filters === 'object') return vc.filters;
      return null;
    };

    // Generation counter so a stale set of in-flight requests can't stomp on a
    // newer one (e.g. user changes filter while previous counts are still loading).
    let groupCountsGeneration = 0;
    let groupCountsTimer = null;

    const refreshGroupCounts = async () => {
      if (!isGroupingActive.value || !isInfiniteScrollEnabled.value) return;
      const myGen = ++groupCountsGeneration;
      const baseFilter = getCurrentFilterModelForCount();
      const groups = orderedGroups.value.map(g => g.value);
      if (groups.length === 0) return;

      const results = await Promise.all(
        groups.map(async (groupValue) => {
          const filter = buildGroupFilterModel(baseFilter, groupValue);
          const count = await fetchSupabaseGroupCount(filter);
          return [groupValue, count];
        })
      );

      // Bail if a newer refresh started while this one was in flight.
      if (myGen !== groupCountsGeneration) return;

      const next = new Map(groupInfiniteCounts.value);
      for (const [gv, count] of results) {
        if (typeof count === 'number') next.set(gv, count);
      }
      groupInfiniteCounts.value = next;
    };

    // Debounce so that bursts of triggers (e.g. grouping + filter applied in the
    // same tick from view configuration) collapse into a single request batch.
    const scheduleRefreshGroupCounts = () => {
      if (groupCountsTimer) clearTimeout(groupCountsTimer);
      groupCountsTimer = setTimeout(() => {
        groupCountsTimer = null;
        refreshGroupCounts();
      }, 50);
    };

    // Re-fetch on any input that affects the count: grouping toggle, grouping
    // column, search value, manual filters. AG Grid filter changes are picked
    // up by onGroupFilterChanged below.
    watch(
      () => [
        isGroupingActive.value,
        isInfiniteScrollEnabled.value,
        groupingColumnId.value,
        props.content?.searchValue,
        props.content?.supabaseFilters,
      ],
      () => { scheduleRefreshGroupCounts(); },
      { immediate: true, deep: true }
    );
    // ========== /PER-GROUP INFINITE-SCROLL DATASOURCES ==========

    const rowData = computed(() => {
      // If using infinite scrolling, rowData should be undefined (grid uses datasource)
      if (isInfiniteScrollEnabled.value) {
        return undefined;
      }
      // If using Supabase with pagination, return Supabase data
      if (props.content?.dataSource === 'supabase') {
        return supabaseData.value;
      }

      // Otherwise, use local data (existing behavior)
      const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
      return Array.isArray(data) ? data ?? [] : [];
    });

    // Track if we've ever rendered data (for initial load detection)
    const hasEverRendered = ref(false);

    // Watch for data changes with shallow comparison for better performance
    // Track array length and reference changes instead of deep comparison
    const rowDataLength = ref(0);
    const rowDataRef = ref(null);
    
    watch(() => rowData.value, (newData, oldData) => {
      // Skip processing if we're updating data locally (e.g., fake junction records)
      if (isUpdatingDataLocally.value) {
        return;
      }

      // Check if this is just a reference change or actual data change
      const newLength = Array.isArray(newData) ? newData.length : 0;
      const oldLength = rowDataLength.value;
      const isArrayChange = newData !== rowDataRef.value;
      const isLengthChange = newLength !== oldLength;
      
      // Update tracking refs
      rowDataLength.value = newLength;
      rowDataRef.value = newData;

      // For non-infinite scroll modes, update records from rowData
      // For infinite scroll, records will be updated via grid API watchers
      if (!isInfiniteScrollEnabled.value) {
        setRecords(Array.isArray(newData) ? [...newData] : []);
      } else {
        // For infinite scroll, update from grid API after a short delay to let grid update
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }

      // If we've already rendered data once, don't show loading skeleton for updates
      // This prevents select cells from flickering when bound data is updated
      if (hasEverRendered.value) {
        // Data is being updated, not initially loaded - keep rendered state
        if (Array.isArray(newData) && newData.length > 0) {
          dataRendered.value = true;
        } else if (Array.isArray(newData) && newData.length === 0) {
          dataRendered.value = true;
        }
        
        // Only apply transaction if there was an actual array or length change
        if (isArrayChange || isLengthChange) {
          nextTick(() => {
            const hasActiveEditor = typeof gridApi.value?.getEditingCells === 'function' &&
              gridApi.value.getEditingCells().length > 0;
            if (hasActiveEditor) {
              console.log('[Datagrid rowData] skipped grid data refresh while editor active');
              return;
            }

            // Use queue-based approach for grid operations
            if (Array.isArray(newData) && newData.length > 0) {
              // Apply transaction first
              gridApiQueue.enqueue(
                () => {
                  if (gridApi.value) {
                    const clonedRows = newData.map(row => ({ ...row }));
                    return gridApi.value.applyTransaction({ update: clonedRows });
                  }
                },
                { 
                  priority: 0, 
                  description: 'applyTransaction for rowData update',
                  condition: () => !!gridApi.value 
                }
              );
            }
            
            // Then refresh cells
            gridApiUtils.refreshCells(gridApi.value, { force: true }).catch(error => {
              console.warn('[Datagrid] Error during rowData refresh:', error);
            });
          });
        }
        return;
      }

      // Initial load: show loading skeleton until rendered
      if (newData !== oldData && Array.isArray(newData) && newData.length > 0) {
        dataRendered.value = false;
        // Clear any existing timeout
        if (dataLoadingTimeout.value) {
          clearTimeout(dataLoadingTimeout.value);
        }
        // Wait for AG Grid to render, then mark as rendered
        nextTick(() => {
          if (gridApi.value) {
            // Use requestAnimationFrame to wait for render cycle
            requestAnimationFrame(() => {
              setTimeout(() => {
                dataRendered.value = true;
                hasEverRendered.value = true;
              }, 200); // Give time for all cells (especially select cells) to render
            });
          }
        });
      } else if (Array.isArray(newData) && newData.length === 0) {
        // Empty data means it's loaded (just empty)
        dataRendered.value = true;
        hasEverRendered.value = true;
      }
    }, { immediate: true }); // Removed deep: true for better performance

    // Detect loading state - show skeleton when grid is not ready or data is not yet rendered
    const isLoading = computed(() => {
      // Check if grid API is ready
      if (!gridReady.value) return true;
      
      // If using Supabase, check Supabase loading state
      if (props.content?.dataSource === 'supabase') {
        return supabaseLoading.value;
      }
      
      // Check if rowData source is undefined/null (not loaded yet)
      const rawData = props.content?.rowData;
      if (rawData === undefined || rawData === null) {
        return true;
      }
      
      // If we have data but it hasn't been rendered yet, show skeleton
      const data = rowData.value;
      if (Array.isArray(data) && data.length > 0 && !dataRendered.value) {
        return true;
      }
      
      return false;
    });

    // Watch loading state and update isFetching exposed variable
    watch(
      () => isLoading.value,
      (loading) => {
        setIsFetching(loading);
      },
      { immediate: true }
    );

    // Track conditional row styles changes more efficiently
    const lastConditionalRowStylesJson = ref(null);
    
    // Watch for conditional row styles with optimized change detection
    watch(
      () => props.content?.conditionalRowStyles,
      (newStyles) => {
        // Skip if no styles defined
        if (!newStyles || !Array.isArray(newStyles) || newStyles.length === 0) {
          if (lastConditionalRowStylesJson.value !== null) {
            lastConditionalRowStylesJson.value = null;
            // Styles were removed, redraw to clear any applied styles
            if (gridApi.value && gridReady.value && !isGridRendering.value) {
              const hasActiveEditor = typeof gridApi.value.getEditingCells === 'function' &&
                gridApi.value.getEditingCells().length > 0;
              if (hasActiveEditor) {
                console.log('[Datagrid styles] skipped redraw while editor active');
                return;
              }
              // Use queue-based approach instead of setTimeout
              gridApiUtils.redrawRows(gridApi.value).catch(error => {
                console.warn('[Datagrid] Error during conditional styles redraw:', error);
              });
            }
          }
          return;
        }
        
        // Create lightweight hash instead of full JSON.stringify for performance
        const currentHash = newStyles.length > 0 ? 
          `${newStyles.length}-${JSON.stringify(newStyles[0])}-${JSON.stringify(newStyles[newStyles.length - 1])}` :
          '0';
        
        // Only redraw if styles actually changed (not just reference change)
        if (currentHash !== lastConditionalRowStylesJson.value) {
          lastConditionalRowStylesJson.value = currentHash;
          
          // Debounce the redraw to avoid multiple rapid redraws
          if (gridApi.value && gridReady.value && !isGridRendering.value) {
            const hasActiveEditor = typeof gridApi.value.getEditingCells === 'function' &&
              gridApi.value.getEditingCells().length > 0;
            if (hasActiveEditor) {
              console.log('[Datagrid styles] skipped redraw while editor active');
              return;
            }
            // Use queue-based approach instead of setTimeout
            gridApiUtils.redrawRows(gridApi.value).catch(error => {
              console.warn('[Datagrid] Error during conditional styles clear:', error);
            });
          }
        }
      }
      // Removed deep: true - shallow comparison is sufficient since we're hashing content
    );

    // Track the last applied focused row ID to avoid duplicate applications
    const lastAppliedFocusedRowId = ref(null);

    // Helper to find a row node by its ID (using unified row lookup utility)
    const findRowNodeById = (rowId) => {
      if (rowId === null || rowId === undefined || rowId === '') return null;
      return findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);
    };

    // Watch for focusedRowId changes and apply focus to the specified row
    // This provides a declarative way to keep a row in focus (persists across data changes)
    // PERFORMANCE: Only redraws the old and new focused rows, not the entire grid
    watch(
      () => cfg.value?.focusedRowId,
      async (newRowId, oldRowId) => {
        // Skip if grid is not ready or value hasn't changed
        if (!gridApi.value || !gridReady.value) return;
        
        // Normalize values for comparison (treat empty string as null)
        const normalizedNew = newRowId === '' ? null : newRowId;
        const normalizedOld = oldRowId === '' ? null : oldRowId;
        
        // Skip if the effective value hasn't changed
        if (normalizedNew === normalizedOld) return;
        
        // Update tracking variable
        lastAppliedFocusedRowId.value = normalizedNew;
        
        // Defer execution to avoid conflicts with grid rendering
        setTimeout(async () => {
          if (!gridApi.value || isGridRendering.value) return;
          
          // Collect only the affected row nodes (old focused + new focused)
          const rowNodesToRedraw = [];
          
          // Find the previously focused row node to remove its styling
          if (normalizedOld !== null && normalizedOld !== undefined) {
            const oldNode = findRowNodeById(normalizedOld);
            if (oldNode) rowNodesToRedraw.push(oldNode);
          }
          
          // Clear focus if new value is null/undefined/empty
          if (normalizedNew === null || normalizedNew === undefined) {
            // Clear any custom action focus class from all cells
            if (gridContainerRef.value) {
              const focusedCells = gridContainerRef.value.querySelectorAll('.ag-cell-action-focus');
              focusedCells.forEach(cell => cell.classList.remove('ag-cell-action-focus'));
            }
            gridApi.value.clearFocusedCell();
            // Only redraw the previously focused row to remove its styling
            if (rowNodesToRedraw.length > 0) {
              gridApi.value.redrawRows({ rowNodes: rowNodesToRedraw });
            }
            return;
          }
          
          // Find the newly focused row node to apply styling
          const newNode = findRowNodeById(normalizedNew);
          if (newNode && !rowNodesToRedraw.includes(newNode)) {
            rowNodesToRedraw.push(newNode);
          }
          
          // Only redraw the affected rows (old + new focused), not the entire grid
          if (rowNodesToRedraw.length > 0) {
            gridApi.value.redrawRows({ rowNodes: rowNodesToRedraw });
          }
        }, 100);
      },
      { immediate: false }
    );

    // Watch for dataSource changes and fetch initial data
    watch(
      () => props.content?.dataSource,
      (newSource, oldSource) => {
        // Clear removed IDs when data source changes
        if (newSource !== oldSource) {
          clearRemovedIds();
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        // Only fetch if source actually changed to supabase
        if (newSource === 'supabase' && newSource !== oldSource && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource
            // CRITICAL FIX: Preserve filters and sorts when switching to server-side mode
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            gridApi.value.setGridOption('datasource', datasource.value);
            nextTick(() => {
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          } else {
            // Reset last fetch params to allow new fetch
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      },
      { immediate: false }
    );

    // Watch for Supabase configuration changes
    watch(
      () => [props.content?.supabaseTable, props.content?.supabaseQuery],
      (newValues, oldValues) => {
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        // Clear removed IDs when table or query changes (fresh data context)
        if (oldValues) {
          clearRemovedIds();
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, refresh the datasource
            // CRITICAL FIX: Preserve filters and sorts when table/query changes
            // Use queue-based approach instead of setTimeout cascade
            gridApiUtils.refreshDatasourceWithState(
              gridApi.value, 
              datasource.value, 
              'Supabase query change refresh'
            ).catch(error => {
              console.warn('[Datagrid] Error during datasource refresh:', error);
            });
          } else {
            // Reset last fetch params to allow new fetch
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      }
    );

    // Initial data fetch when grid is ready and using Supabase
    const initialFetchDone = ref(false);
    watch(
      () => [gridReady.value, props.content?.dataSource, props.content?.supabaseTable],
      ([ready, source, table], oldValues) => {
        // Handle undefined oldValues on first run
        if (oldValues) {
          const [oldReady, oldSource, oldTable] = oldValues;
          // Only fetch if values actually changed and we haven't done initial fetch yet
          if (ready === oldReady && source === oldSource && table === oldTable) {
            return;
          }
          
          // Reset initial fetch flag if dataSource changes away from supabase
          if (source !== 'supabase' && oldSource === 'supabase') {
            initialFetchDone.value = false;
          }
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        // Handle initial setup
        if (ready && source === 'supabase' && table && gridApi.value && !initialFetchDone.value) {
          initialFetchDone.value = true;
          
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource
            // Note: rowModelType is set via computed property at grid initialization
            // and cannot be changed dynamically (AG Grid limitation)
            // CRITICAL FIX: Preserve filters and sorts when initializing infinite scroll
            // CRITICAL FIX: Wrap in setTimeout to prevent error #252
            // Use queue-based approach instead of setTimeout cascade
            gridApiUtils.refreshDatasourceWithState(
              gridApi.value, 
              datasource.value, 
              'Infinite scroll toggle refresh'
            ).catch(error => {
              console.warn('[Datagrid] Error during infinite scroll toggle refresh:', error);
            });
          } else {
            // For pagination mode, fetch initial data
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, null, null, searchValue);
          }
        }
      },
      { immediate: true       }
    );

    // Watch for infinite scrolling configuration changes
    // Note: rowModelType and cacheBlockSize are initial properties and cannot be changed after grid init
    // Users must reload the page to switch between row model types
    watch(
      () => [cfg.value?.enableInfiniteScroll, cfg.value?.infiniteBlockSize],
      (newValues, oldValues) => {
        // Only update if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }

        if (cfg.value?.dataSource === 'supabase' && cfg.value?.enableInfiniteScroll && gridApi.value) {
          // Refresh the datasource when infinite scrolling settings change
          // Note: cacheBlockSize is an initial property and cannot be changed dynamically
          // CRITICAL FIX: Preserve filters and sorts when refreshing infinite scroll
          // CRITICAL FIX: Wrap in setTimeout to prevent error #252
          // Use queue-based approach instead of setTimeout cascade
          gridApiUtils.refreshDatasourceWithState(
            gridApi.value, 
            datasource.value, 
            'Search configuration refresh'
          ).catch(error => {
            console.warn('[Datagrid] Error during search configuration refresh:', error);
          });
        }
      }
    );

    // Watch for search value changes (with debounce for Supabase)
    watch(
      () => [props.content?.enableSearch, props.content?.searchValue, props.content?.searchableColumns],
      (newValues, oldValues) => {
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && props.content?.enableSearch && gridApi.value) {
          // Clear existing debounce timer
          if (searchDebounceTimer.value) {
            clearTimeout(searchDebounceTimer.value);
          }
          
          // Debounce search changes (300ms)
          searchDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, refresh the datasource
              // CRITICAL FIX: Preserve filters and sorts when search changes
              // CRITICAL FIX: Wrap in setTimeout to prevent error #252
              if (gridApi.value) {
                // Use queue-based approach instead of setTimeout cascade
                gridApiUtils.refreshDatasourceWithState(
                  gridApi.value, 
                  datasource.value, 
                  'Searchable columns refresh'
                ).catch(error => {
                  console.warn('[Datagrid] Error during searchable columns refresh:', error);
                });
              }
            } else {
              // For pagination mode, fetch data
              lastFetchParams.value = null;
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const filterModel = gridApi.value.getFilterModel();
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            }
          }, 300);
        }
      }
    );

    // Watch for changes in select/user column options with better performance
    // Track option changes without creating new arrays on every evaluation
    const columnOptionsHash = ref('');
    
    watch(
      () => {
        // Create a stable hash of options instead of mapping arrays
        if (!props.content?.columns) return '';
        return props.content.columns
          .filter(col => col?.options || col?.users)
          .map(col => {
            const options = col?.options || [];
            const users = col?.users || [];
            // Create a simple hash based on array lengths and first/last items
            const optionsHash = options.length > 0 ? 
              `opt-${options.length}-${JSON.stringify(options[0])}-${JSON.stringify(options[options.length - 1])}` : 'opt-0';
            const usersHash = users.length > 0 ? 
              `usr-${users.length}-${users[0]?.id}-${users[users.length - 1]?.id}` : 'usr-0';
            return `${col.field}:${optionsHash}:${usersHash}`;
          })
          .join('|');
      },
      (newHash, oldHash) => {
        if (!oldHash || !gridApi.value || !gridReady.value || newHash === oldHash) return;
        
        // Update hash tracking
        columnOptionsHash.value = newHash;
        
        // Use queue-based approach instead of setTimeout
        gridApiUtils.refreshCells(gridApi.value, { force: true }).catch(error => {
          console.warn('[Datagrid] Error during column options refresh:', error);
        });
      },
      { flush: 'post' }
    ); // Removed deep: true for better performance

    function refreshData() {
      // Wait for grid to be ready and not rendering before refreshing cells
      // Use setTimeout to avoid error #252
      nextTick(() => {
        setTimeout(() => {
          const doRefresh = () => {
            if (isGroupingActive.value && groupGridApis.value.size > 0) {
              // Iterate all group grids in multi-grid mode
              groupGridApis.value.forEach((api) => {
                try {
                  if (api) api.refreshCells();
                } catch (e) {
                  console.warn('[Datagrid] refreshCells failed on group grid:', e?.message);
                }
              });
            } else if (gridApi.value) {
              gridApi.value.refreshCells();
            }
          };
          if (!isGridRendering.value) {
            doRefresh();
          } else {
            // Retry after rendering completes
            setTimeout(doRefresh, 100);
          }
        }, 0);
      });
    }

    const gridComponents = {
      ActionCellRenderer,
      ImageCellRenderer,
      WewebCellRenderer,
      SelectCellRenderer,
      SelectFilterComponent,
      DateCellEditor,
      UserCellRenderer,
      UserFilterComponent,
    };

    return {
      resolveMappingFormula,
      debugLog,
      gridMonitor,
      onGridReady,
      onFirstDataRendered,
      onModelUpdated,
      onRowSelected,
      onSelectionChanged,
      gridApi,
      onFilterChanged,
      onSortChanged,
      setUpdatingDataLocally, // Expose setter so methods can update the flag
      getUpdatingDataLocally, // Expose getter so methods can check the flag
      removedRowIds, // Expose removedRowIds so methods and datasource can access it
      cleanupRemovedIds, // Expose cleanup function for methods
      clearRemovedIds, // Expose clear function for methods
      gridApiQueue, // Expose grid API queue for methods
      gridApiUtils, // Expose grid API utilities for methods
      localeText: computed(() => {
        switch (cfg.value?.lang) {
          case "fr":
            return AG_GRID_LOCALE_FR;
          case "de":
            return AG_GRID_LOCALE_DE;
          case "es":
            return AG_GRID_LOCALE_ES;
          case "pt":
            return AG_GRID_LOCALE_PT;
          case "custom":
            return {
              ...AG_GRID_LOCALE_EN,
              ...(cfg.value?.localeText || {}),
            };
          default:
            return AG_GRID_LOCALE_EN;
        }
      }),
      forcedPaginationPageSize,
      onRowDragged,
      onRowDragEnter,
      onColumnMoved,
      onColumnResized,
      onPaginationChanged,
      onBodyScroll,
      gridContainerRef,
      initialState,
      refreshData,
      rowData,
      rowModelType,
      rowDragManaged,
      datasource,
      delayedDatasource,
      cacheBlockSize,
      paginationEnabled,
      isLoading,
      isInfiniteScrollEnabled,
      gridComponents,
      // Expose supabaseData and supabaseTotalCount for methods to access
      supabaseDataRef: supabaseData,
      supabaseTotalCountRef: supabaseTotalCount,
      // Expose grid ready state and helpers for component actions
      gridReady,
      isGridRendering,
      waitForGridReady,
      waitForRowInGrid: waitForRowInGridLocal,
      // Expose waitForSupabaseInstance for methods to use
      waitForSupabaseInstance,
      safeGridApiCall,
      hiddenColumns,
      setHiddenColumns,
      getTranslations,
      activeCreateColumnField,
      activeCreateRow,
      activeCreateRowId,
      createPopupTeleportTarget,
      showColumnChooser,
      columnChooserRef,
      activeChooserTab,
      selectableGroupingColumns,
      setGroupingColumn,
      setShowUnassigned,
      pendingGroupingColumnId,
      isGroupingTransitionLoading,
      columnChooserSearch,
      chooserColumnOrder,
      chooserHiddenState,
      chooserDragColId,
      chooserDragOverColId,
      updateCurrentConfig,
      columnDefsVar,
      // ========== GROUPING EXPORTS ==========
      isGroupingActive,
      orderedGroups,
      groupRowData,
      groupingState,
      groupDragValue,
      groupDragOverValue,
      onGroupGridReady,
      onGroupFilterChanged,
      onGroupSortChanged,
      onGroupColumnResized,
      onGroupColumnMoved,
      onGroupSelectionChanged,
      onGroupRowSelected,
      onGroupDragStart,
      onGroupDragOver,
      onGroupDrop,
      onGroupDragEnd,
      toggleGroupCollapsed,
      collapseAllGroups,
      expandAllGroups,
      findGroupForRowId,
      groupGridApis,
      alignedGridApisForGroup,
      groupHorizontalScrollRef,
      groupHorizontalScrollWidth,
      groupHorizontalViewportWidth,
      groupHorizontalScrollLeft,
      hasGroupHorizontalOverflow,
      onGroupHorizontalScrollbarScroll,
      onGroupBodyScroll,
      groupDatasourceFor,
      refreshGroupInfiniteCache,
      groupInfiniteCounts,
      // ========== /GROUPING EXPORTS ==========
      /* wwEditor:start */
      createElement,
      rawContent: inject("componentRawContent", {}),
      /* wwEditor:end */
    };
  },
  computed: {
    cfg() {
      if (!this.content || typeof this.content !== 'object') return this.content ?? {};
      const base = this.content.baseConfig;
      const excludes = this.content.baseConfigExcludes;
      if (!base || typeof base !== 'object') return this.content;

      const excludeSet = new Set(Array.isArray(excludes) ? excludes : []);
      excludeSet.add('baseConfig');
      excludeSet.add('baseConfigExcludes');

      const merged = {};
      for (const key of Object.keys(this.content)) {
        merged[key] = this.content[key];
      }
      for (const key of Object.keys(base)) {
        if (!excludeSet.has(key)) {
          merged[key] = base[key];
        }
      }
      return merged;
    },
    defaultColDef() {
      return {
        editable: false,
        resizable: this.cfg.resizableColumns,
        autoHeaderHeight: this.cfg.headerHeightMode === "auto",
        wrapHeaderText: this.cfg.headerHeightMode === "auto",
        singleClickEdit: this.cfg.cellEditMode !== "doubleClick",
        cellClass:
          this.cfg.cellAlignmentMode === "custom"
            ? `-${this.cfg.cellAlignment || "left"} ||`
            : null,
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
        },
        // Note: cellEditorParams with getValidationErrors is added per-column,
        // not in defaultColDef, to allow column-specific validation rules
      };
    },
    dataTypeDefinitions() {
      // Return undefined to use AG Grid's default data type handling
      // Custom formatting is handled via valueFormatter/valueParser on individual columns
      // This avoids "data type definition undefined does not exist" errors
      return undefined;
    },
    allColumnsList() {
      // Build a map of colId → column meta from content.columns (exclude design-time hidden)
      const colMap = new Map();
      for (const col of (this.cfg.columns || [])) {
        if (!col || (!col.field && !col.actionName) || col.hide) continue;
        const colId = col.actionName || col.field;
        colMap.set(colId, {
          colId,
          headerName: col.headerName || colId,
          isHidden: (this.chooserHiddenState || []).includes(colId),
          isLocked: !!col.lockedInChooser,
        });
      }

      // Sort by chooserColumnOrder (reflects live grid order), append any extras
      const ordered = [];
      const seen = new Set();
      for (const colId of (this.chooserColumnOrder || [])) {
        if (colMap.has(colId)) {
          ordered.push(colMap.get(colId));
          seen.add(colId);
        }
      }
      // Append columns not yet in the ordered list
      for (const [colId, meta] of colMap) {
        if (!seen.has(colId)) ordered.push(meta);
      }

      // Move locked columns to the top, preserving their relative order
      const locked = ordered.filter(c => c.isLocked);
      const unlocked = ordered.filter(c => !c.isLocked);
      return [...locked, ...unlocked];
    },
    filteredColumnsList() {
      const q = (this.columnChooserSearch || '').toLowerCase().trim();
      if (!q) return this.allColumnsList;
      return this.allColumnsList.filter(c => c.headerName.toLowerCase().includes(q));
    },
    allColumnsVisible() {
      return !this.chooserHiddenState || this.chooserHiddenState.length === 0;
    },
    // Cheap count of runtime-toggleable columns (design-time hidden are excluded).
    // Used by someColumnsHidden to avoid pulling in the heavier allColumnsList computation.
    visibleColumnCount() {
      return (this.cfg.columns || []).filter(
        col => col && (col.field || col.actionName) && !col.hide
      ).length;
    },
    someColumnsHidden() {
      return !!(
        this.chooserHiddenState &&
        this.chooserHiddenState.length > 0 &&
        this.chooserHiddenState.length < this.visibleColumnCount
      );
    },
    columnDefs() {
      // First, map all columns to their definitions
      const columnsMap = new Map();

      // Run validation rules for a column and, on failure, emit the
      // `validationFailed` trigger event so WeWeb workflows can react.
      // ag-Grid v34 uses this return value (string[] | null) to drive
      // `invalidEditValueMode` (revert/block) and tooltip display natively.
      // AG Grid calls getValidationErrors on submission attempts, so we fire
      // the workflow + toast here directly — deduped per edit session via
      // `_validationFiredForCurrentEdit` (reset in onCellEditingStarted).
      const self = this;
      const getValidationErrors = (col, newValue, rowData, params) => {
        const validationFn = createValidationFunction(col, self.resolveMappingFormula);
        const errors = validationFn(newValue, rowData);
        if (errors && errors.length > 0) {
          self._pendingValidationError = { col, newValue, rowData, params, errors };
          if (!self._validationFiredForCurrentEdit) {
            self._validationFiredForCurrentEdit = true;
            const rowId = rowData?.[self.cfg?.idKey] ?? params?.node?.id ?? null;
            self.$emit("trigger-event", {
              name: "validationFailed",
              event: {
                field: col?.field,
                value: newValue,
                oldValue: rowData?.[col?.field],
                errors,
                rowId,
                data: rowData,
              },
            });
            try {
              wwLib.wwWorkflow.executeGlobal('1d11d250-421f-4cc5-bb8b-7bb3ad71c34d', {
                body: errors.join('\n'),
                title: `Champ invalide : ${col?.headerName || col?.field || ''}`,
                type: 'error',
              });
            } catch (e) {
              console.warn('[validation] toast workflow failed', e);
            }
          }
        } else {
          self._pendingValidationError = null;
          self._validationFiredForCurrentEdit = false;
        }
        return errors;
      };

      const getValueSetter = (col, customSetter) => {
        return createValueSetter(col, customSetter);
      };
      // Get column widths from viewConfiguration (for restoring user-resized widths)
      // Note: When sizes key is present but empty ({}), default column widths from column config will be used
      // When sizes key is absent (undefined), the current user-resized widths are preserved
      const viewConfig = this.cfg.viewConfiguration;
      const hasSizesKey = viewConfig && typeof viewConfig === 'object' && 'sizes' in viewConfig;
      const viewColumnSizes = hasSizesKey ? viewConfig.sizes : null;

      // Get hidden columns from viewConfiguration for setting hide property in column defs
      const hasHiddenColumnsKey = viewConfig && typeof viewConfig === 'object' && 'hiddenColumns' in viewConfig;
      const viewHiddenColumns = hasHiddenColumnsKey && Array.isArray(viewConfig.hiddenColumns)
        ? new Set(viewConfig.hiddenColumns)
        : null;
      
      const allColumnDefs = this.cfg.columns
        .filter((col) => col != null && (col.field || col.actionName)) // Filter out null/undefined columns and columns without field/actionName
        .map((col, index) => {

        const minWidth =
          !col?.minWidth || col?.minWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.minWidth)?.[0];
        const maxWidth =
          !col?.maxWidth || col?.maxWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.maxWidth)?.[0];
        
        // Get column identifier (actionName for action columns, field for others)
        const colId = col?.actionName || col?.field;
        
        // Check if view width is provided for this column (overrides column config width)
        const viewWidth = viewColumnSizes && colId && typeof viewColumnSizes[colId] === 'number'
          ? viewColumnSizes[colId]
          : null;
        
        // Use viewConfiguration.sizes if provided, otherwise use column config width
        // Note: When viewConfiguration.sizes is provided for a column, it overrides flex as well
        const width = viewWidth !== null
          ? viewWidth
          : (!col?.width || col?.width === "auto" || col?.widthAlgo === "flex"
              ? null
              : wwLib.wwUtils.getLengthUnit(col?.width)?.[0]);
        
        // Only use flex if no viewWidth is provided for this column
        const flex = viewWidth !== null
          ? null
          : (col?.widthAlgo === "flex" ? col?.flex ?? 1 : null);

        // Build cellClass array for column-specific styling
        const cellClasses = [];
        if (this.cfg.cellAlignmentMode !== "custom" && col?.cellAlignment) {
          cellClasses.push(`-${col?.cellAlignment}`);
        }
        if (col?.suppressRowInteraction) {
          cellClasses.push("-suppress-row-interaction");
        }

        const commonProperties = {
          minWidth,
          maxWidth,
          pinned: col?.pinned === "none" ? false : col?.pinned,
          width,
          flex,
          hide: !!col?.hide
            || (viewHiddenColumns !== null && viewHiddenColumns.has(colId))
            || (this.isGroupingActive && colId === this.groupingState?.columnId),
          headerClass: col?.headerAlignment ? `-${col?.headerAlignment}` : null,
          ...(cellClasses.length > 0 ? { cellClass: cellClasses } : {}),
          valueSetter: getValueSetter(col),
        };

        const cellDataType = col?.cellDataType;

        // Route cellEditorParams.getValidationErrors through the tracking helper
        // so _pendingValidationError is populated and onCellEditingStopped fires
        // the `validationFailed` trigger event + toast.
        const attachValidationTracking = (def) => {
          if (def?.cellEditorParams) {
            def.cellEditorParams.getValidationErrors = (params) => {
              return getValidationErrors(col, params?.value, params?.data, params);
            };
          }
          return def;
        };

        switch (cellDataType) {
          case "action": {
            return createActionColumnDef(col, commonProperties, this.onActionTrigger, this.content);
          }
          case "custom": {
            return attachValidationTracking(
              createCustomColumnDef(col, commonProperties, this.onCustomCellEdit, this.resolveMappingFormula)
            );
          }
          case "dateString":
          case "dateTime": {
            return attachValidationTracking(
              createDateColumnDef(col, commonProperties, this.resolveMappingFormula)
            );
          }
          case "currency": {
            return attachValidationTracking(
              createCurrencyColumnDef(col, commonProperties, this.resolveMappingFormula)
            );
          }
          case "image": {
            return createImageColumnDef(col, commonProperties);
          }
          case "select": {
            const rawOptions = col?.options;
            const selectParams = {
              options: Array.isArray(rawOptions) ? rawOptions : [],
              optionsValueFormula: col?.optionsValueFormula,
              optionsLabelFormula: col?.optionsLabelFormula,
              optionsColorFormula: col?.optionsColorFormula,
              resolveMappingFormula: this.resolveMappingFormula,
              // Use a getter to avoid isLoading being a reactive dependency of columnDefs.
              // This prevents columnDefs from recomputing when loading state changes,
              // which would cause AG Grid to recreate all cell renderers (flickering).
              get isLoading() { return false; },
            };
            
            // Memoized label getter: O(n_options) only on first call per unique
            // options array reference, O(1) for all subsequent calls.
            const getLabelFromValue = createSelectLabelGetter(col, this.resolveMappingFormula);

            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "SelectCellRenderer",
              cellRendererParams: selectParams,
              cellEditor: "SelectCellRenderer",
              cellEditorParams: {
                ...selectParams,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data, params);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? SelectFilterWrapper : false,
              ...(col?.filter
                ? {
                    filterParams: {
                      selectOptions: selectParams,
                      closeOnApply: true,
                      translations: (() => {
                        const lang = this.cfg?.lang || 'en';
                        const translations = {
                          en: { reset: 'Reset', apply: 'Apply' },
                          fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                          es: { reset: 'Restablecer', apply: 'Aplicar' },
                          de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                          pt: { reset: 'Redefinir', apply: 'Aplicar' },
                        };
                        return translations[lang] || translations.en;
                      })(),
                    },
                  }
                : {}),
              // Use label for filtering and sorting instead of raw value.
              // Pass the options array so the getter can cache by array reference.
              valueGetter: (params) => {
                const rawOptions = col?.options;
                const options = Array.isArray(rawOptions) ? rawOptions : [];
                return getLabelFromValue(params.data?.[col?.field], options);
              },
              // Ensure the raw value (ID) is stored, not the label
              valueSetter: getValueSetter(col, (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              }),
              // Return raw value (ID) for filtering - filter model stores IDs
              filterValueGetter: (params) => {
                return params.data?.[col?.field];
              },
            };
          }
          case "user": {
            const rawUsers = col?.users;
            const userIdFormula = col?.userIdFormula || { type: 'f', code: 'context.mapping' };
            const userParams = {
              users: Array.isArray(rawUsers) ? rawUsers : [],
              maxNumberOfUsers: col?.maxNumberOfUsers ?? 4,
              userFocusColor: this.cfg.userFocusColor,
              cellFontFamily: this.cfg.cellFontFamily,
              resolveMappingFormula: this.resolveMappingFormula,
              userIdFormula: userIdFormula,
              // Use a getter to avoid isLoading being a reactive dependency of columnDefs.
              // This prevents columnDefs from recomputing when loading state changes,
              // which would cause AG Grid to recreate all cell renderers (flickering).
              get isLoading() { return false; },
            };
            
            // Memoized closures — created once per unique (field, formula) config,
            // not recreated on every columnDefs recompute.
            const extractUserIds = createUserIdsExtractor(col, this.resolveMappingFormula);
            const getUserNameFromId = createUserNameGetter(col);

            const isMultiple = (col?.maxNumberOfUsers ?? 4) > 1;

            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "UserCellRenderer",
              cellRendererParams: userParams,
              cellEditor: "UserCellRenderer",
              cellEditorParams: {
                ...userParams,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data, params);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? UserFilterWrapper : false,
              ...(col?.filter
                ? {
                    filterParams: {
                      users: userParams.users,
                      maxNumberOfUsers: userParams.maxNumberOfUsers,
                      userFocusColor: userParams.userFocusColor,
                      cellFontFamily: userParams.cellFontFamily,
                      resolveMappingFormula: userParams.resolveMappingFormula,
                      userIdFormula: userParams.userIdFormula,
                      isLoading: userParams.isLoading,
                      closeOnApply: true,
                      translations: (() => {
                        const lang = this.cfg?.lang || 'en';
                        const translations = {
                          en: { reset: 'Reset', apply: 'Apply' },
                          fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                          es: { reset: 'Restablecer', apply: 'Aplicar' },
                          de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                          pt: { reset: 'Redefinir', apply: 'Aplicar' },
                        };
                        return translations[lang] || translations.en;
                      })(),
                    },
                  }
                : {}),
              // Use user name for filtering and sorting instead of raw ID.
              // Pass the users array so the getter can cache by array reference.
              valueGetter: (params) => {
                const rawValue = params.data?.[col?.field];
                const extractedValue = extractUserIds(rawValue);
                if (!extractedValue) return '';

                const rawUsers = col?.users;
                const users = Array.isArray(rawUsers) ? rawUsers : [];

                if (isMultiple) {
                  // Multiple users: return comma-separated names
                  const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
                  return userIds.map(id => getUserNameFromId(id, users)).filter(Boolean).join(', ');
                } else {
                  // Single user: return name
                  return getUserNameFromId(extractedValue, users);
                }
              },
              // Ensure the raw value (ID or array of IDs) is stored
              valueSetter: getValueSetter(col, (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              }),
              // Return user ID(s) for filtering — filter model stores IDs
              filterValueGetter: (params) => {
                const rawValue = params.data?.[col?.field];
                return extractUserIds(rawValue) ?? null;
              },
            };
          }
          case "record": {
            const recordParams = {
              tableName: col?.recordTable,
              valueField: col?.recordValueField || 'id',
              displayField: col?.recordDisplayField || 'name',
              contextField: col?.recordContextField || '',
              previewFields: col?.recordPreviewFields || [],
              allowCreate: col?.allowCreateRecord || false,
              enableDebugLogs: !!this.cfg?.enableDebugLogs,
              getSupabaseInstance: () => wwLib.wwPlugins.supabase?.instance,
              onCreateClick: (ctx) => {
                const payload = typeof ctx === 'string' ? { columnField: ctx } : (ctx || {});
                this.activeCreateColumnField = payload.columnField || null;
                this.activeCreateRow = payload.row ?? null;
                this.activeCreateRowId = payload.rowId ?? null;
              },
              onRecordNavigate: (eventData) => {
                this.$emit("trigger-event", {
                  name: "onRecordNavigation",
                  event: eventData,
                });
              },
              get isLoading() { return false; },
            };

            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "RecordCellRenderer",
              cellRendererParams: recordParams,
              cellEditor: "RecordCellRenderer",
              cellEditorParams: {
                ...recordParams,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data, params);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? RecordFilterWrapper : false,
              ...(col?.filter
                ? {
                    filterParams: {
                      recordOptions: recordParams,
                      closeOnApply: true,
                      translations: (() => {
                        const lang = this.cfg?.lang || 'en';
                        const translations = {
                          en: { reset: 'Reset', apply: 'Apply' },
                          fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                          es: { reset: 'Restablecer', apply: 'Aplicar' },
                          de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                          pt: { reset: 'Redefinir', apply: 'Aplicar' },
                        };
                        return translations[lang] || translations.en;
                      })(),
                    },
                  }
                : {}),
              valueGetter: (params) => {
                return params.data?.[col?.field];
              },
              valueSetter: (params) => {
                // Read old value directly from data (not from AG Grid's oldValue
                // which may be stale when a valueGetter is defined)
                const oldVal = params.data?.[col?.field];
                params.data[col.field] = params.newValue;
                return oldVal !== params.newValue;
              },
            };
          }
          default: {
            // Determine the correct filter type based on cellDataType
            let filterType = false;
            if (col?.filter) {
              if (col?.cellDataType === 'number') {
                filterType = 'agNumberColumnFilter';
              } else if (col?.cellDataType === 'boolean') {
                // Use Set Filter for boolean columns to show True/False options
                filterType = 'agSetColumnFilter';
              } else {
                // Default to text filter for text, undefined, or other types
                filterType = 'agTextColumnFilter';
              }
            }

            const result = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: filterType,
              editable: col?.editable,
            };

            // Add boolean-specific handling
            if (col?.cellDataType === 'boolean') {
              // Set cellDataType so AG Grid can automatically configure other features
              // Note: We explicitly set filter type above to ensure Set Filter is used
              result.cellDataType = 'boolean';
              
              // Explicitly ensure Set Filter is used (override AG Grid's default Text Filter for boolean)
              if (col?.filter) {
                result.filter = 'agSetColumnFilter';
              }
              
              // Use checkbox cell renderer for boolean display
              result.cellRenderer = 'agCheckboxCellRenderer';
              
              // Normalize boolean values for the checkbox renderer
              result.valueGetter = (params) => {
                const value = params.data?.[col?.field];
                // Handle various boolean representations and convert to actual boolean
                if (value === true || value === 'true' || value === 1 || value === '1') {
                  return true;
                } else if (value === false || value === 'false' || value === 0 || value === '0') {
                  return false;
                }
                return value;
              };
              
              // Ensure the checkbox updates the data correctly
              result.valueSetter = (params) => {
                const newValue = params.newValue === true || params.newValue === 'true' || params.newValue === 1 || params.newValue === '1';
                params.data[col?.field] = newValue;
                return true;
              };
              
              // For editable boolean columns, use checkbox as both renderer and editor
              if (col?.editable) {
                result.cellEditor = 'agCheckboxCellEditor';
                // Create the validation function
                const validationFn = (params) => {
                  return getValidationErrors(col, params?.value, params?.data, params);
                };
                result.cellEditorParams = {
                  getValidationErrors: validationFn,
                };
              }
              
              // Configure filter params for boolean set filter
              // Explicitly configure to ensure Set Filter shows True/False options
              if (col?.filter && filterType === 'agSetColumnFilter') {
                // Merge with default filter params (buttons, closeOnApply, etc.)
                result.filterParams = {
                  ...(result.filterParams || {}),
                  values: (params) => {
                    // Return boolean values for the set filter
                    return [true, false];
                  },
                  valueFormatter: (params) => {
                    // Format boolean values as True/False (AG Grid will handle localization)
                    if (params.value === true || params.value === 'true' || params.value === 1 || params.value === '1') {
                      return 'True';
                    } else if (params.value === false || params.value === 'false' || params.value === 0 || params.value === '0') {
                      return 'False';
                    }
                    return String(params.value);
                  },
                  // Ensure filter uses actual boolean values, not strings
                  filterValueGetter: (params) => {
                    const value = params.data?.[col?.field];
                    // Convert to actual boolean for filtering
                    if (value === true || value === 'true' || value === 1 || value === '1') {
                      return true;
                    } else if (value === false || value === 'false' || value === 0 || value === '0') {
                      return false;
                    }
                    return value;
                  }
                };
              }
            } else if (col?.editable) {
              // Add cellEditor and cellEditorParams for editable non-boolean columns to ensure validation works
              // Create the validation function
              const validationFn = (params) => {
                return getValidationErrors(col, params?.value, params?.data, params);
              };

              // Explicitly set cellEditor to ensure validation is triggered
              // AG Grid's default editor might not call getValidationErrors consistently
              result.cellEditor = 'agTextCellEditor';
              
              result.cellEditorParams = {
                getValidationErrors: validationFn,
              };
            }

            if (col?.useCustomLabel) {
              result.valueFormatter = (params) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  params.value
                );
              };
              
              // Use display value for filtering and sorting if enabled
              if (col?.useDisplayValueForFilterSort) {
                // Helper function to get display value from raw value
                const getDisplayValue = (rawValue) => {
                  return this.resolveMappingFormula(
                    col?.displayLabelFormula,
                    rawValue
                  );
                };
                
                // Use display value for filtering
                result.filterValueGetter = (params) => {
                  const rawValue = params.data?.[col?.field];
                  return getDisplayValue(rawValue);
                };
                
                // Use display value for sorting with custom comparator
                if (col?.sortable) {
                  result.comparator = (valueA, valueB, nodeA, nodeB) => {
                    const rawValueA = nodeA?.data?.[col?.field];
                    const rawValueB = nodeB?.data?.[col?.field];
                    const displayValueA = getDisplayValue(rawValueA);
                    const displayValueB = getDisplayValue(rawValueB);
                    
                    // Handle null/undefined values
                    if (displayValueA == null && displayValueB == null) return 0;
                    if (displayValueA == null) return 1;
                    if (displayValueB == null) return -1;
                    
                    // Compare as numbers if both are numbers, otherwise as strings
                    const numA = Number(displayValueA);
                    const numB = Number(displayValueB);
                    if (!isNaN(numA) && !isNaN(numB)) {
                      return numA - numB;
                    }
                    
                    // String comparison
                    return String(displayValueA).localeCompare(String(displayValueB));
                  };
                }
              }
            }
            return result;
          }
        }

        return result;
      });

      // Build a map of column definitions by their colId/field for reordering
      allColumnDefs.forEach((colDef) => {
        const colId = colDef.colId || colDef.field;
        if (colId) {
          columnsMap.set(colId, colDef);
        }
      });

      // Reorder columns based on viewConfiguration.columnsOrder if provided with values
      // Empty array [] or absent key means use default column order from definitions
      // The distinction between "key absent" vs "key present but empty" is handled
      // by applyViewConfiguration at runtime for resetting column order
      let columns;
      const viewColumnsOrder = this.cfg.viewConfiguration?.columnsOrder;
      const hasValidColumnsOrder = viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0;
      if (hasValidColumnsOrder) {
        const orderedColumns = [];
        const usedColIds = new Set();

        // First, add columns in the order specified by viewConfiguration.columnsOrder
        for (const colId of viewColumnsOrder) {
          if (columnsMap.has(colId)) {
            orderedColumns.push(columnsMap.get(colId));
            usedColIds.add(colId);
          }
        }

        // Then, add any remaining columns that weren't in viewConfiguration.columnsOrder
        // (to handle cases where new columns were added to config but not to viewConfiguration.columnsOrder)
        for (const colDef of allColumnDefs) {
          const colId = colDef.colId || colDef.field;
          if (colId && !usedColIds.has(colId)) {
            orderedColumns.push(colDef);
          }
        }

        columns = orderedColumns;
      } else {
        columns = allColumnDefs;
      }

      // Inject hidden virtual columns for fields referenced in sorting/filters
      // but not present in column definitions (e.g., sort by created_at without showing it)
      const existingColIds = new Set(columns.map(c => c.colId || c.field));
      const virtualColIds = new Set();

      // Collect colIds from sorting config
      const sortingConfig = this.cfg.viewConfiguration?.sorting;
      if (Array.isArray(sortingConfig)) {
        for (const s of sortingConfig) {
          if (s?.colId && !existingColIds.has(s.colId)) {
            virtualColIds.add(s.colId);
          }
        }
      }

      // Collect colIds from filters config
      const filtersConfig = this.cfg.viewConfiguration?.filters;
      if (filtersConfig && typeof filtersConfig === 'object') {
        for (const colId of Object.keys(filtersConfig)) {
          if (!existingColIds.has(colId)) {
            virtualColIds.add(colId);
          }
        }
      }

      // Add hidden column defs for virtual columns so ag-grid can sort/filter by them
      for (const colId of virtualColIds) {
        columns.push({
          colId,
          field: colId,
          hide: true,
          suppressHeaderMenuButton: true,
          lockVisible: true,
          __virtualColumn: true,
        });
      }

      // Enable row drag only if rowReorder is enabled AND infinite scroll is NOT enabled
      // (row dragging is not supported with infinite row model)
      if (this.cfg.rowReorder && columns[0] && !this.isInfiniteScrollEnabled) {
        columns[0].rowDrag = true;
      }

      return columns;
    },
    rowSelection() {
      if (this.cfg.rowSelection === "multiple") {
        return {
          mode: "multiRow",
          checkboxes: !this.cfg.disableCheckboxes,
          headerCheckbox: !this.cfg.disableCheckboxes,
          selectAll: this.cfg.selectAll || "all",
          enableClickSelection: this.cfg.enableClickSelection,
        };
      } else if (this.cfg.rowSelection === "single") {
        return {
          mode: "singleRow",
          checkboxes: !this.cfg.disableCheckboxes,
          enableClickSelection: this.cfg.enableClickSelection,
        };
      } else {
        return {
          mode: "singleRow",
          checkboxes: false,
          isRowSelectable: () => false,
          enableClickSelection: this.cfg.enableClickSelection,
        };
      }
    },
    style() {
      if (this.cfg.layout === "auto") return {};
      return {
        height: this.cfg.height || "500px",
        minHeight: "200px",
      };
    },
    cssVars() {
      const columnChooserBackground =
        this.cfg.columnChooserBackground ||
        this.cfg.menuBackgroundColor ||
        this.cfg.headerBackgroundColor ||
        this.cfg.rowBackgroundColor;
      const columnChooserBorderColor =
        this.cfg.columnChooserBorderColor ||
        this.cfg.borderColor ||
        this.cfg.outerBorderColor;
      const columnChooserTextColor =
        this.cfg.columnChooserTextColor ||
        this.cfg.menuTextColor ||
        this.cfg.textColor ||
        this.cfg.cellColor ||
        this.cfg.headerTextColor;
      const columnChooserAccentColor =
        this.cfg.columnChooserAccentColor ||
        this.cfg.selectionCheckboxColor ||
        this.cfg.userFocusColor ||
        this.cfg.cellSelectionBorderColor;

      return {
        "--ww-data-grid_cc-background": columnChooserBackground,
        "--ww-data-grid_cc-border-color": columnChooserBorderColor,
        "--ww-data-grid_cc-border-radius": this.cfg.columnChooserBorderRadius || "8px",
        "--ww-data-grid_cc-text-color": columnChooserTextColor,
        "--ww-data-grid_cc-accent-color": columnChooserAccentColor,
        "--ww-data-grid_cc-width": this.cfg.columnChooserWidth || "260px",
        "--ww-data-grid_action-backgroundColor":
          this.cfg.actionBackgroundColor,
        "--ww-data-grid_action-color": this.cfg.actionColor,
        "--ww-data-grid_action-padding": this.cfg.actionPadding,
        "--ww-data-grid_action-border": this.cfg.actionBorder,
        "--ww-data-grid_action-borderRadius": this.cfg.actionBorderRadius,
        ...(this.cfg.actionFont
          ? { "--ww-data-grid_action-font": this.cfg.actionFont }
          : {
              "--ww-data-grid_action-fontSize": this.cfg.actionFontSize,
              "--ww-data-grid_action-fontFamily": this.cfg.actionFontFamily,
              "--ww-data-grid_action-fontWeight": this.cfg.actionFontWeight,
              "--ww-data-grid_action-fontStyle": this.cfg.actionFontStyle,
              "--ww-data-grid_action-lineHeight": this.cfg.actionLineHeight,
            }),
        "--ww-data-grid_record-pill-accent-color": this.cfg.recordPillAccentColor,
        "--ww-data-grid_record-pill-background": this.cfg.recordPillBackgroundColor,
        "--ww-data-grid_record-pill-border-color": this.cfg.recordPillBorderColor,
        "--ww-data-grid_record-pill-text-primary":
          this.cfg.recordPillTextPrimaryColor,
        "--ww-data-grid_record-pill-text-secondary":
          this.cfg.recordPillTextSecondaryColor,
        "--ww-data-grid_record-pill-accent-width":
          this.cfg.recordPillAccentWidth,
        "--ww-data-grid_record-pill-hover-shadow":
          this.cfg.recordPillHoverShadow,
      };
    },
    theme() {
      return themeQuartz.withParams({
        headerBackgroundColor: this.cfg.headerBackgroundColor,
        headerTextColor: this.cfg.headerTextColor,
        headerFontSize: this.cfg.headerFontSize,
        headerFontFamily: this.cfg.headerFontFamily,
        headerFontWeight: this.cfg.headerFontWeight,
        headerHeight:
          this.cfg.headerHeightMode !== "auto"
            ? this.cfg.headerHeight
            : undefined,
        borderColor: this.cfg.borderColor,
        wrapperBorder: this.cfg.outerBorderColor
          ? { style: "solid", width: 1, color: this.cfg.outerBorderColor }
          : undefined,
        cellTextColor: this.cfg.cellColor,
        cellFontFamily: this.cfg.cellFontFamily,
        dataFontSize: this.cfg.cellFontSize,
        oddRowBackgroundColor: this.cfg.rowAlternateColor,
        backgroundColor: this.cfg.rowBackgroundColor,
        rowHoverColor: this.cfg.rowHoverColor,
        selectedRowBackgroundColor: this.cfg.selectedRowBackgroundColor,
        rowVerticalPaddingScale: this.cfg.rowVerticalPaddingScale || 1,
        menuBackgroundColor: this.cfg.menuBackgroundColor,
        menuTextColor: this.cfg.menuTextColor,
        columnHoverColor: this.cfg.columnHoverColor,
        foregroundColor: this.cfg.textColor,
        checkboxCheckedBackgroundColor: this.cfg.selectionCheckboxColor,
        rangeSelectionBorderColor: this.cfg.cellSelectionBorderColor,
        checkboxUncheckedBorderColor: this.cfg.checkboxUncheckedBorderColor,
        focusShadow: this.cfg.focusShadow?.length
          ? this.cfg.focusShadow
          : undefined,
        wrapperBorderRadius: this.cfg.wrapperBorderRadius,
      });
    },
    rowStyle() {
      // Return a function that AG Grid will call for each row
      // This function evaluates conditional styling rules and focused row styling
      // IMPORTANT: Focused row styling is applied LAST to override conditional styles
      //
      // PERFORMANCE: We only use conditionalRowStyles as a reactive dependency here.
      // focusedRowId is read at call time (inside the returned function) so that
      // changing the focused row does NOT cause this computed to re-evaluate and
      // return a new function reference — which would force AG Grid to re-render
      // all rows. Instead, the focusedRowId watcher handles targeted redraws of
      // only the affected rows.
      const conditionalRowStyles = this.content?.conditionalRowStyles;
      
      const hasConditionalStyles = conditionalRowStyles && Array.isArray(conditionalRowStyles) && conditionalRowStyles.length > 0;
      
      // We always return a function now (instead of null) so that the function
      // reference stays stable. Returning null vs function on focusedRowId toggle
      // would also cause AG Grid to detect a prop change.
      // Keep a reference to 'this' for use inside the closure
      const self = this;
      
      // Return a stable function that reads focusedRowId at call time
      return (params) => {
        // params.data contains the row data
        const rowData = params.data;
        
        // If no row data, return null
        if (!rowData) {
          return null;
        }
        
        // Read focusedRowId at call time (not at computed evaluation time)
        // This prevents the computed from re-evaluating when focusedRowId changes
        const focusedRowId = self.cfg?.focusedRowId;
        const hasFocusedRow = focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '';
        
        // If no conditional styles and no focused row, return null early
        if (!hasConditionalStyles && !hasFocusedRow) {
          return null;
        }
        
        // Accumulate styles from all matching rules
        // Later rules override earlier ones for conflicting properties
        let mergedStyle = {};
        
        // Check if this row is the focused row (we'll apply styling at the end)
        let isFocusedRow = false;
        if (hasFocusedRow) {
          // Get the row's ID using the idFormula
          let baseId = self.resolveMappingFormula(self.cfg.idFormula, rowData);
          
          // Fallback to common ID fields if formula doesn't return a valid ID
          if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
            baseId = rowData.id || rowData._id || rowData.uuid || rowData.ID || rowData.Id;
          }
          
          // Compare with focusedRowId (convert both to strings for comparison)
          const baseIdStr = baseId != null ? String(baseId) : '';
          const focusedIdStr = String(focusedRowId);
          
          isFocusedRow = (baseIdStr === focusedIdStr);
        }
        
        // Apply conditional row styles FIRST
        if (hasConditionalStyles) {
          for (const rule of conditionalRowStyles) {
            // Skip rules without a condition formula
            if (!rule?.conditionFormula) {
              continue;
            }
            
            // Evaluate the condition formula with the row data as context
            let conditionResult = false;
            try {
              conditionResult = self.resolveMappingFormula(rule.conditionFormula, rowData);
            } catch (error) {
              // Log error in debug mode and skip this rule
              self.debugLog('[Conditional Row Style] Error evaluating condition:', error);
              continue;
            }
            
            // If condition is true, apply the styles from this rule
            if (conditionResult) {
              // Apply backgroundColor
              if (rule.backgroundColor) {
                mergedStyle.backgroundColor = rule.backgroundColor;
              }
              
              // Apply textColor (maps to color CSS property)
              if (rule.textColor) {
                mergedStyle.color = rule.textColor;
              }
              
              // Apply fontWeight
              if (rule.fontWeight) {
                mergedStyle.fontWeight = rule.fontWeight;
              }
              
              // Apply fontStyle
              if (rule.fontStyle) {
                mergedStyle.fontStyle = rule.fontStyle;
              }
              
              // Apply border properties
              if (rule.borderLeft) {
                mergedStyle.borderLeft = rule.borderLeft;
              }
              if (rule.borderRight) {
                mergedStyle.borderRight = rule.borderRight;
              }
              if (rule.borderTop) {
                mergedStyle.borderTop = rule.borderTop;
              }
              if (rule.borderBottom) {
                mergedStyle.borderBottom = rule.borderBottom;
              }
            }
          }
        }
        
        // Apply focused row styling LAST to override conditional styles
        if (isFocusedRow) {
          // Using box-shadow for a left border effect that doesn't affect layout
          mergedStyle.boxShadow = 'inset 4px 0 0 0 var(--ag-range-selection-border-color, #2196F3)';
          // Add a subtle background tint (overrides any conditional backgroundColor)
          mergedStyle.backgroundColor = 'var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1))';
        }
        
        // Return the merged style object, or null if no styles were applied
        return Object.keys(mergedStyle).length > 0 ? mergedStyle : null;
      };
    },
    isEditing() {
      /* wwEditor:start */
      return (
        this.wwEditorState.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION
      );
      /* wwEditor:end */
      // eslint-disable-next-line no-unreachable
      return false;
    },
    invalidEditValueMode() {
      return this.content?.invalidEditValueMode || "revert";
    },
    paginationPageSizeSelector() {
      if (
        !this.cfg.pagination ||
        this.cfg.hasPaginationSelector !== "multiple"
      ) {
        return false;
      }
      if (
        !Array.isArray(this.cfg.paginationPageSizeSelector) ||
        this.cfg.paginationPageSizeSelector.length === 0
      ) {
        return false;
      }
      return this.cfg.paginationPageSizeSelector;
    },
  },
  methods: {
    /**
     * Print a grid performance report to the browser console.
     * Only produces output when "Enable debug logs" is turned on in the editor.
     * Can be wired to a WeWeb action button for on-demand diagnostics.
     */
    reportPerformance() {
      this.gridMonitor.report();
    },
    /**
     * Reset all collected performance metrics.
     */
    resetPerformance() {
      this.gridMonitor.reset();
    },
    openColumnChooser() {
      this.showColumnChooser = true;
    },
    /**
     * Format a per-group row count as a localized "X items" / "X éléments" string.
     * Picks the singular form when count === 1, otherwise the plural form.
     * Returns '' for null/undefined (e.g. infinite-scroll mode before first fetch).
     */
    formatItemCount(count) {
      if (count === null || count === undefined) return '';
      const t = this.getTranslations(this.cfg?.lang || 'en');
      const tpl = count === 1 ? t.itemCountOne : t.itemCountMany;
      return (tpl || '{count}').replace('{count}', count);
    },
    hideColumn(colId) {
      if (!colId) return;
      const current = [...(this.hiddenColumns || [])];
      if (!current.includes(colId)) {
        current.push(colId);
        this.setHiddenColumns(current);
        this.chooserHiddenState = current;
        this.gridApi?.setColumnsVisible([colId], false);
        this.updateCurrentConfig();
        this.$emit('trigger-event', {
          name: 'columnVisibilityChanged',
          event: {
            columnId: colId,
            visible: false,
            hiddenColumns: current,
          },
        });
      }
    },
    showColumn(colId) {
      if (!colId) return;
      if (!(this.hiddenColumns || []).includes(colId)) return; // already visible, no-op
      const current = (this.hiddenColumns || []).filter(id => id !== colId);
      this.setHiddenColumns(current);
      this.chooserHiddenState = current;
      this.gridApi?.setColumnsVisible([colId], true);
      this.updateCurrentConfig();
      this.$emit('trigger-event', {
        name: 'columnVisibilityChanged',
        event: {
          columnId: colId,
          visible: true,
          hiddenColumns: current,
        },
      });
    },
    toggleColumnVisibility(colId) {
      const col = this.allColumnsList.find(c => c.colId === colId);
      if (col?.isLocked) return;
      if ((this.hiddenColumns || []).includes(colId)) {
        this.showColumn(colId);
      } else {
        this.hideColumn(colId);
      }
    },
    toggleAllColumns() {
      const colIds = this.allColumnsList.filter(c => !c.isLocked).map(c => c.colId);
      // Capture the intended outcome before any mutation
      const willBeVisible = !this.allColumnsVisible;
      if (!willBeVisible) {
        // Hide all columns
        this.setHiddenColumns([...colIds]);
        if (this.gridApi) this.gridApi.setColumnsVisible(colIds, false);
      } else {
        // Show all columns
        this.setHiddenColumns([]);
        if (this.gridApi) this.gridApi.setColumnsVisible(colIds, true);
      }
      const newHiddenColumns = willBeVisible ? [] : [...colIds];
      this.chooserHiddenState = newHiddenColumns;
      this.updateCurrentConfig();
      this.$emit('trigger-event', {
        name: 'columnVisibilityChanged',
        event: {
          columnId: null,
          visible: willBeVisible,
          hiddenColumns: newHiddenColumns,
        },
      });
    },
    onChooserDragStart(colId) {
      const col = this.allColumnsList.find(c => c.colId === colId);
      if (col?.isLocked) return;
      this.chooserDragColId = colId;
    },
    onChooserDragOver(colId) {
      if (this.chooserDragColId && colId !== this.chooserDragColId) {
        this.chooserDragOverColId = colId;
      }
    },
    onChooserDrop(targetColId) {
      const fromColId = this.chooserDragColId;
      if (!fromColId || fromColId === targetColId) {
        this.chooserDragColId = null;
        this.chooserDragOverColId = null;
        return;
      }
      const targetCol = this.allColumnsList.find(c => c.colId === targetColId);
      if (targetCol?.isLocked) {
        this.chooserDragColId = null;
        this.chooserDragOverColId = null;
        return;
      }
      // Reorder chooserColumnOrder
      const order = [...this.chooserColumnOrder];
      const fromIdx = order.indexOf(fromColId);
      const toIdx = order.indexOf(targetColId);
      if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, fromColId);
        this.chooserColumnOrder = order;
        // Apply new order to AG Grid
        if (this.gridApi) {
          this.gridApi.applyColumnState({
            state: order.map(colId => ({ colId })),
            applyOrder: true,
          });
        }
        this.updateCurrentConfig();
      }
      this.chooserDragColId = null;
      this.chooserDragOverColId = null;
    },
    onChooserDragEnd() {
      this.chooserDragColId = null;
      this.chooserDragOverColId = null;
    },
    /* wwEditor:start */
    checkIfColumnsStructureChanged(newDefs, oldDefs) {
      // If no old defs, structure changed (initial load)
      if (!oldDefs || !Array.isArray(oldDefs)) return false;
      
      // If no new defs or not an array, no structure change
      if (!newDefs || !Array.isArray(newDefs)) return false;
      
      // If number of columns changed, structure changed
      if (newDefs.length !== oldDefs.length) return true;
      
      // Check if column IDs or key properties changed
      for (let i = 0; i < newDefs.length; i++) {
        const newCol = newDefs[i];
        const oldCol = oldDefs[i];
        
        // If either column is undefined/null, consider it a change
        if (!newCol || !oldCol) return true;
        
        // Check if column ID changed
        const newColId = newCol.colId || newCol.field;
        const oldColId = oldCol.colId || oldCol.field;
        if (newColId !== oldColId) return true;
        
        // Check if filter/sortable flags changed
        if (newCol.filter !== oldCol.filter) return true;
        if (newCol.sortable !== oldCol.sortable) return true;
        
        // Check if header name changed
        if (newCol.headerName !== oldCol.headerName) return true;
      }
      
      // No structural changes detected
      return false;
    },
    /* wwEditor:end */
    getRowId(params) {
      // Get ID from formula
      let rowId = this.resolveMappingFormula(this.cfg.idFormula, params.data);
      
      // If formula returns a valid ID, use it directly (stable across re-renders)
      // IMPORTANT: Do NOT append data hashes - that causes row IDs to change whenever
      // any field in the row data changes, which forces AG Grid to destroy and recreate
      // all cell renderers (causing visible flickering on custom/user columns).
      if (rowId !== null && rowId !== undefined && rowId !== '') {
        return String(rowId);
      }
      
      // Fallback: generate a deterministic ID from the row index when no idFormula is set.
      // Using the row index from params ensures stability across re-renders as long as
      // the data order doesn't change. This is a reasonable fallback when no ID is configured.
      if (params.node?.rowIndex != null) {
        return `row-idx-${params.node.rowIndex}`;
      }
      
      // Last resort: hash-based ID from data content (deterministic but may change if data mutates)
      const dataStr = JSON.stringify(params.data || {});
      let hash = 0;
      for (let i = 0; i < dataStr.length; i++) {
        const char = dataStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `row-${Math.abs(hash)}`;
    },
    onActionTrigger(event) {
      this.$emit("trigger-event", {
        name: "action",
        event,
      });
    },
    onCellEditRequest(event) {
      // Method kept for potential future use
    },
    onCellEditingStarted(event) {
      this._pendingValidationError = null;
      this._validationFiredForCurrentEdit = false;
      this._lastActiveCellEdit = {
        rowIndex: event?.rowIndex,
        rowPinned: event?.node?.rowPinned ?? null,
        rowId: event?.node?.id,
        field: event?.colDef?.field,
        colId: event?.column?.getColId?.(),
        dataId: event?.data?.id,
        startedAt: Date.now(),
      };
      console.log('[Datagrid edit] cell editing started', this._lastActiveCellEdit);
    },
    onCellEditingStopped(event) {
      console.log('[Datagrid edit] cell editing stopped', {
        rowIndex: event?.rowIndex,
        rowId: event?.node?.id,
        field: event?.colDef?.field,
        colId: event?.column?.getColId?.(),
        dataId: event?.data?.id,
        lastActiveCellEdit: this._lastActiveCellEdit,
      });
      this._pendingValidationError = null;
      this._validationFiredForCurrentEdit = false;
      this._lastActiveCellEdit = null;
    },
    onRowEditingStarted(event) {
      console.log('[validation] >>> onRowEditingStarted', event?.rowIndex);
    },
    onRowEditingStopped(event) {
      console.log('[validation] >>> onRowEditingStopped', event?.rowIndex);
    },
    onCellValueChanged(event) {
      // Find the column configuration to get isDirectUpdate
      const columnId = event.column.getColId();
      const columnConfig = this.cfg.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );

      // Cross-group refresh in infinite-scroll + grouping mode.
      // When the user edits the grouping column itself, the row needs to move
      // from its old group grid to the new group grid. Since each group owns
      // its own infinite cache, we purge the cache of both the old and new
      // group APIs — AG Grid will refetch the visible block on each side.
      if (
        this.isGroupingActive &&
        this.isInfiniteScrollEnabled &&
        this.groupingState?.columnId === columnId &&
        this.groupGridApis &&
        this.groupGridApis.size > 0
      ) {
        const normalize = (v) => (v === null || v === undefined || v === '' ? null : String(v));
        const oldGroupVal = normalize(event.oldValue);
        const newGroupVal = normalize(event.data?.[columnId]);
        const targets = new Set();
        if (oldGroupVal !== newGroupVal) {
          // Map null/'' to the Unassigned-group sentinel (matches the
          // UNASSIGNED_GROUP constant used by groupGridApis Map keys).
          const UNASSIGNED = '__unassigned__';
          targets.add(oldGroupVal ?? UNASSIGNED);
          targets.add(newGroupVal ?? UNASSIGNED);
          // Small defer so the write has landed before we purge + refetch.
          setTimeout(() => {
            targets.forEach((gv) => {
              const api = this.groupGridApis.get(gv);
              if (!api) return;
              try { api.purgeInfiniteCache(); }
              catch (e) { this.debugLog?.(`[Group Infinite] purge failed for "${gv}":`, e?.message); }
            });
          }, 50);
        }
      }
      
      // For select columns: read the value directly from the data to ensure we get the ID, not the label
      // The valueSetter ensures the actual value (ID) is stored in the data field
      const newValue = event.data?.[columnId];
      
      // Check if this is a user column (all user columns need safeguard to prevent data fetching)
      const isUserColumn = columnConfig?.cellDataType === 'user';
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      const isForeignKeyColumn = isUserColumn && columnConfig?.isManyToMany === true;
      const defaultUserIdFormula = { type: 'f', code: 'context.mapping' };
      const userIdFormula = columnConfig?.userIdFormula || defaultUserIdFormula;
      
      // For user columns, get oldValue as raw user IDs (not display names)
      // AG Grid's event.oldValue might be the display value (names) due to valueGetter
      let oldValue = event.oldValue;
      
      if (isUserColumn && event.node) {
        // Use shared user utilities
        
        // Get users array from column config
        const users = columnConfig?.users || [];
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        
        // Try to get raw value from node's data (before it was changed)
        // Check if oldValue looks like a display value (names) or if it's already IDs
        const isDisplayValue = typeof oldValue === 'string' && 
          (oldValue.includes(',') || (oldValue.includes(' ') && !oldValue.match(/^[a-f0-9-]{36}$/i)));
        
        let normalizedOldValue;
        
          if (isDisplayValue) {
            // oldValue appears to be display names - convert to IDs
            if (oldValue.includes(',')) {
              // Multiple users: comma-separated names
              const names = oldValue.split(',').map(n => n.trim()).filter(Boolean);
              const ids = names.map(name => findUserIdByName(name, users)).filter(id => id != null);
              normalizedOldValue = ids.length > 0 ? ids : null;
            } else {
              // Single user: name
              normalizedOldValue = findUserIdByName(oldValue, users);
            }
          } else {
            // oldValue might already be IDs - extract using formula if needed
            normalizedOldValue = extractUserIds(oldValue, event.node.data, this.resolveMappingFormula, userIdFormula);
            
            // If extraction returned the same value and it's a string, check if it's a name
            if (normalizedOldValue === oldValue && typeof oldValue === 'string' && users.length > 0) {
              // Check if it's already a valid ID
              const isValidId = users.some(u => u.id === oldValue);
              if (!isValidId) {
                // Might be a name - try to find ID
                const foundId = findUserIdByName(oldValue, users);
                if (foundId) {
                  normalizedOldValue = foundId;
                }
              }
            }
          }
        
        // Ensure format matches setCellValue expectations:
        // - Single user: string ID
        // - Multiple users: array of string IDs
        if (isMultiple) {
          // Ensure it's an array
          if (Array.isArray(normalizedOldValue)) {
            oldValue = normalizedOldValue;
          } else if (normalizedOldValue != null) {
            oldValue = [normalizedOldValue];
          } else {
            oldValue = [];
          }
        } else {
          // Ensure it's a single value (not array)
          if (Array.isArray(normalizedOldValue) && normalizedOldValue.length > 0) {
            oldValue = normalizedOldValue[0];
          } else {
            oldValue = normalizedOldValue;
          }
        }
      } else {
        // For non-user columns, use oldValue as-is
        oldValue = event.oldValue;
      }
      
      // Don't emit event if values are the same (e.g., when edit was cancelled with Escape)
      if (valuesEqual(oldValue, newValue)) {
        return; // Skip emitting event when values are the same (cancelled edit)
      }
      // For select columns, oldValue should already be the option value (not label)
      // AG Grid's oldValue should match what's stored in data, which is the option value
      
      // Set flag to prevent data fetching during ANY user column update
      // This prevents watchers from triggering Supabase fetches when we modify user data
      if (isUserColumn) {
        this.debugLog('[User Column Update] Setting isUpdatingDataLocally flag to TRUE');
        this.setUpdatingDataLocally(true);
        this.debugLog('[User Column Update] Flag set, about to process update');
      }
      
      // If it's a many-to-many user column (junction table), simulate creating a fake junction record
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      // maxNumberOfUsers only affects whether the result is stored as an array or single object
      if (isForeignKeyColumn && newValue) {
        // Normalize newValue to array format for processing
        const userIds = Array.isArray(newValue) ? newValue : [newValue];
        const userIdFormulaForJunction = columnConfig?.userIdFormula || defaultUserIdFormula;
        
        // Use shared junction record factory
        
        // Create fake junction records using shared utility
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        let fakeJunctionRecord;
        if (isMultiple) {
          // Multiple users: array of nested structures
          fakeJunctionRecord = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormulaForJunction));
        } else {
          // Single user: single nested structure (not array)
          fakeJunctionRecord = createFakeJunctionRecord(userIds[0], userIdFormulaForJunction);
        }
        
        try {
          // Update the row data with the fake junction record
          event.data[columnId] = fakeJunctionRecord;
          
          // Refresh the cell to show the updated value
          // CRITICAL FIX: Wrap in setTimeout to prevent error #252
          if (this.gridApi && event.node) {
            const rowNode = event.node;
            setTimeout(() => {
              if (this.gridApi) {
                this.gridApi.refreshCells({
                  rowNodes: [rowNode],
                  columns: [columnId],
                  force: true,
                });
              }
            }, 0);
          }
          
          this.debugLog('[Foreign Key] Created fake junction record:', {
            columnId,
            userIdFormula: userIdFormulaForJunction,
            fakeRecord: fakeJunctionRecord,
          });
        } catch (error) {
          console.error('[Foreign Key] Error creating fake junction record:', error);
        }
      }
      
      // Clear flag after a short delay for ALL user column updates
      // This ensures watchers don't trigger fetches during the update
      if (isUserColumn) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.debugLog('[User Column Update] Clearing isUpdatingDataLocally flag');
            this.setUpdatingDataLocally(false);
            this.debugLog('[User Column Update] Flag cleared');
          }, 200); // Delay to ensure all watchers have processed
        });
      }
      
      // Redraw the row to re-evaluate conditional row styles
      // This is needed because getRowStyle is only called when rows are rendered
      // Only do this if conditional styles are defined (avoid unnecessary redraws)
      if (this.gridApi && event.node && this.content?.conditionalRowStyles?.length > 0) {
        // Use a slightly longer timeout to batch with any other updates
        setTimeout(() => {
          if (this.gridApi && !this.isGridRendering) {
            const hasActiveEditor = typeof this.gridApi.getEditingCells === 'function' &&
              this.gridApi.getEditingCells().length > 0;
            if (hasActiveEditor) {
              console.log('[Datagrid edit] skipped conditional row redraw while editor active', {
                rowIndex: event?.rowIndex,
                rowId: event?.node?.id,
                columnId,
              });
              this.gridApi.refreshCells({
                rowNodes: [event.node],
                force: true,
              });
              return;
            }
            this.gridApi.redrawRows({ rowNodes: [event.node] });
          }
        }, 50);
      }
      
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: isForeignKeyColumn && event.data?.[columnId] ? event.data[columnId] : newValue, // Use fake junction record if created
          columnId: columnId,
          row: event.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    onRowClicked(event) {
      this.$emit("trigger-event", {
        name: "rowClicked",
        event: {
          row: event.data,
          id: event.node.id,
          index: event.node.sourceRowIndex,
          displayIndex: event.rowIndex,
        },
      });
    },
    onCustomCellEdit(event) {
      this.$emit("trigger-event", {
        name: event.type,
        event: {
          columnId: event.columnId,
          field: event.field,
          value: event.value,
          row: event.row,
          id: event.id,
          index: event.index,
          displayIndex: event.displayIndex,
          isCancel: event.isCancel || false,
        },
      });
    },
    /**
     * Component action: Set a cell value for a specific row and column
     * @param {string|number} rowId - The ID of the row (must match the idFormula output)
     * @param {string} columnId - The column ID (field name or actionName)
     * @param {any} newValue - The new value to set for the cell
     * @returns {boolean} - Returns true if successful, false otherwise
     */
    async setCellValue(rowId, columnId, newValue) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing cell value operations
      // This prevents error #252 when setCellValue is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for setCellValue:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.setCellValue(rowId, columnId, newValue);
            resolve(result);
          }, 100);
        });
      }
      
      if (!rowId || columnId === undefined || columnId === null) {
        console.warn("[Datagrid] setCellValue requires rowId and columnId parameters");
        return false;
      }

      // In grouped mode, locate the row in whichever group grid contains it.
      // Fall back to the primary gridApi for single-grid mode.
      let targetApi = this.gridApi;
      let rowNode = null;
      if (this.isGroupingActive) {
        const found = this.findGroupForRowId(rowId);
        if (found) {
          targetApi = found.api;
          rowNode = found.node;
        }
      }
      if (!rowNode) {
        rowNode = findRowNode(targetApi, rowId, this.resolveMappingFormula, this.content);
      }

      if (!rowNode) {
        console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
        // Debug: log available row IDs to help troubleshoot
        if (this.cfg?.enableDebugLogs) {
          const availableIds = getAvailableRowIds(targetApi, this.resolveMappingFormula, this.content);
          console.log('[Datagrid] Available row IDs:', availableIds);
        }
        return false;
      }
      
      if (!rowNode.data) {
        console.warn(`[Datagrid] Row node found but has no data`);
        return false;
      }
      
      // Find the column configuration
      const columnConfig = this.cfg.columns?.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      if (!columnConfig) {
        console.warn(`[Datagrid] Column "${columnId}" not found in column configuration`);
      }
      
      // Handle user columns - convert user ID(s) to nested structure if many-to-many
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      let valueToSet = newValue;
      const isUserColumn = columnConfig?.cellDataType === 'user';
      if (isUserColumn) {
        const isManyToMany = columnConfig?.isManyToMany === true;
        const userIdFormula = columnConfig?.userIdFormula || { type: 'f', code: 'context.mapping' };
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        
        if (isManyToMany && newValue) {
          // Use shared junction record factory
          
          // Normalize newValue to array for processing
          const userIds = Array.isArray(newValue) ? newValue : [newValue];
          
          // Convert user ID(s) to nested structure using shared utility
          if (isMultiple) {
            // Multiple users: array of nested structures
            valueToSet = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormula));
          } else {
            // Single user: single nested structure (not array)
            valueToSet = createFakeJunctionRecord(userIds[0], userIdFormula);
          }
        }
        // For non-many-to-many user columns, valueToSet remains as newValue (user ID or array of IDs)
      }
      
      // Update the data directly
      rowNode.data[columnId] = valueToSet;
      
      // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
      // Use setTimeout to avoid calling grid API during render phase
      setTimeout(() => {
        if (this.gridApi && !this.isGridRendering) {
          if (this.content?.conditionalRowStyles?.length > 0) {
            // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
            this.gridApi.redrawRows({ rowNodes: [rowNode] });
          } else {
            // Just refresh the specific cell if no conditional styles
            this.gridApi.refreshCells({
              rowNodes: [rowNode],
              columns: [columnId],
              force: true,
            });
          }
        }
      }, 0);
      
      // Note: We don't trigger the cellValueChanged event here because this is a programmatic
      // update via component action. The event should only fire for user-initiated edits.
      
      return true;
    },
    triggerCellValueChanged(rowId, columnId, newValue) {
      if (!this.gridApi) {
        console.log("Grid API is not initialized yet");
        return;
      }
      
      // Use unified row lookup utility
      let rowNode = findRowNode(this.gridApi, rowId, this.resolveMappingFormula, this.content);
      
      if (!rowNode) {
        console.log(`Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
        return;
      }
      
      if (!rowNode.data) {
        console.log(`Row node found but has no data`);
        return;
      }
      
      const oldValue = rowNode.data?.[columnId];
      
      // Find the column configuration to get isDirectUpdate
      const columnConfig = this.cfg.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      if (!columnConfig) {
        console.log(`Column "${columnId}" not found in column configuration`);
      }
      
      // Update the data directly
      rowNode.data[columnId] = newValue;
      
      // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
      // Use setTimeout to avoid calling grid API during render phase
      setTimeout(() => {
        if (this.gridApi && !this.isGridRendering) {
          if (this.content?.conditionalRowStyles?.length > 0) {
            // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
            this.gridApi.redrawRows({ rowNodes: [rowNode] });
          } else {
            // Just refresh the specific cell if no conditional styles
            this.gridApi.refreshCells({
              rowNodes: [rowNode],
              columns: [columnId],
              force: true,
            });
          }
        }
      }, 0);
      
      // Manually trigger the event (bypassing AG Grid's event)
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: newValue,
          columnId: columnId,
          row: rowNode.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    /**
     * Component action: Refresh a specific row from Supabase
     * @param {string|number} rowId - The ID of the row to refresh
     * @returns {Promise<boolean>} - Returns true if successful, false otherwise
     */
    async refreshRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing refresh operations
      // This prevents error #252 when refreshRow is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for refreshRow:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.refreshRow(rowId);
            resolve(result);
          }, 100);
        });
      }
      
      if (this.content?.dataSource !== 'supabase') {
        console.warn("[Datagrid] refreshRow only works with Supabase data source");
        return false;
      }
      
      if (rowId === null || rowId === undefined) {
        console.warn("[Datagrid] refreshRow requires a rowId parameter");
        return false;
      }

      // Extract primary key field from idFormula
      // Formula format: "context.mapping?.['id']" or "context.mapping?.id"
      const idFormula = this.content?.idFormula;
      let primaryKeyField = 'id'; // default
      
      if (idFormula?.code) {
        // Match patterns like: mapping?.['fieldName'] or mapping?.fieldName or mapping.fieldName
        const match = idFormula.code.match(/mapping\??\.\[?['"]?(\w+)['"]?\]?/);
        if (match && match[1]) {
          primaryKeyField = match[1];
        }
      }

      try {
        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await this.waitForSupabaseInstance(10000, 100);
        const tableName = this.content?.supabaseTable;
        const queryString = this.content?.supabaseQuery || '*';

        if (!supabase) {
          console.warn("[Datagrid] Supabase instance not available after waiting");
          return false;
        }

        if (!tableName) {
          console.warn("[Datagrid] Supabase table name is required");
          return false;
        }

        // Fetch the single row
        const { data, error } = await supabase
          .from(tableName)
          .select(queryString)
          .eq(primaryKeyField, rowId)
          .single();

        if (error) throw error;
        if (!data) {
          console.warn(`[Datagrid] Row with ${primaryKeyField}="${rowId}" not found`);
          return false;
        }

        // In grouped mode, locate the row in whichever group grid contains it.
        // Fall back to the primary gridApi for single-grid mode.
        let targetApi = this.gridApi;
        let rowNode = null;
        if (this.isGroupingActive) {
          const found = this.findGroupForRowId(rowId);
          if (found) {
            targetApi = found.api;
            rowNode = found.node;
          }
        }
        if (!rowNode) {
          rowNode = findRowNode(targetApi, rowId, this.resolveMappingFormula, this.content);
        }

        if (rowNode) {
          const getColumnId = (column) => {
            if (!column) return null;
            if (typeof column.getColId === 'function') return column.getColId();
            return column.colId || column.field || null;
          };
          const editingCells = typeof targetApi?.getEditingCells === 'function'
            ? targetApi.getEditingCells()
            : [];
          const hasActiveEditor = editingCells.length > 0;
          const rowPinned = rowNode.rowPinned ?? null;
          const editingColumnIds = new Set(
            editingCells
              .filter((cell) => (
                cell?.rowIndex === rowNode.rowIndex &&
                (cell?.rowPinned ?? null) === rowPinned
              ))
              .map((cell) => getColumnId(cell?.column))
              .filter(Boolean)
          );
          const isRowBeingEdited = editingColumnIds.size > 0;
          const formatEditingCells = (cells) => cells.map((cell) => ({
            rowIndex: cell?.rowIndex,
            rowPinned: cell?.rowPinned ?? null,
            colId: getColumnId(cell?.column),
          }));
          const shouldPreserveEditState = hasActiveEditor;

          console.log('[Datagrid refreshRow] row found', {
            rowId,
            rowNodeId: rowNode.id,
            rowIndex: rowNode.rowIndex,
            rowPinned,
            hasGetEditingCells: typeof targetApi?.getEditingCells === 'function',
            editingCells: formatEditingCells(editingCells),
            hasActiveEditor,
            isRowBeingEdited,
            editingColumnIds: Array.from(editingColumnIds),
            lastActiveCellEdit: this._lastActiveCellEdit,
            willUseInPlaceUpdate: shouldPreserveEditState && !!rowNode.data,
          });

          if (shouldPreserveEditState && rowNode.data) {
            // Preserve active editors by avoiding row replacement while any
            // edit is open. If this row is edited, leave that column untouched.
            Object.keys(rowNode.data).forEach((key) => {
              if (!Object.prototype.hasOwnProperty.call(data, key) && !editingColumnIds.has(key)) {
                delete rowNode.data[key];
              }
            });
            Object.keys(data).forEach((key) => {
              if (!editingColumnIds.has(key)) {
                rowNode.data[key] = data[key];
              }
            });
          } else {
            // Update the row data
            console.log('[Datagrid refreshRow] using rowNode.setData', {
              rowId,
              reason: shouldPreserveEditState ? 'missing rowNode.data' : 'no active editor',
            });
            rowNode.setData(data);
          }

          // CRITICAL FIX: Wrap refresh in setTimeout to prevent error #252
          // This ensures the API call happens outside the current render cycle
          setTimeout(() => {
            if (targetApi && !this.isGridRendering) {
              const editingCellsNow = typeof targetApi?.getEditingCells === 'function'
                ? targetApi.getEditingCells()
                : [];
              console.log('[Datagrid refreshRow] deferred refresh', {
                rowId,
                editingCellsAtRefresh: formatEditingCells(editingCellsNow),
                initialHasActiveEditor: hasActiveEditor,
                initialIsRowBeingEdited: isRowBeingEdited,
                hasConditionalRowStyles: this.content?.conditionalRowStyles?.length > 0,
              });
              if (shouldPreserveEditState) {
                const refreshColumns = Object.keys(data).filter((key) => !editingColumnIds.has(key));
                console.log('[Datagrid refreshRow] refreshCells while preserving edit state', {
                  rowId,
                  refreshColumns,
                  skippedEditingColumns: Array.from(editingColumnIds),
                });
                if (refreshColumns.length > 0) {
                  targetApi.refreshCells({
                    rowNodes: [rowNode],
                    columns: refreshColumns,
                    force: true,
                  });
                }
              } else if (this.content?.conditionalRowStyles?.length > 0) {
                // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
                console.log('[Datagrid refreshRow] redrawRows with no active editor', { rowId });
                targetApi.redrawRows({ rowNodes: [rowNode] });
              } else {
                // Just refresh cells if no conditional styles
                console.log('[Datagrid refreshRow] refreshCells with no active editor', { rowId });
                targetApi.refreshCells({
                  rowNodes: [rowNode],
                  force: true,
                });
              }
            }
          }, 0);
          
          this.debugLog(`[Datagrid] Row ${rowId} refreshed successfully`);
          return true;
        } else {
          // Row not found in grid but was fetched from DB - add it to the grid
          this.debugLog(`[Datagrid] Row with id "${rowId}" not found in grid, adding it from database`);
          
          const isInfiniteScroll = this.cfg?.enableInfiniteScroll === true;

          // CRITICAL: Set flag to prevent watchers from triggering a full grid re-render
          // When we update supabaseDataRef, the rowData computed will change, which would
          // normally cause AG Grid to see a new array reference and re-render everything.
          // By setting this flag, the watch on rowData.value will skip processing.
          this.setUpdatingDataLocally(true);
          this.debugLog('[Datagrid refreshRow] Setting isUpdatingDataLocally flag to TRUE');
          
          // Helper to safely check if something is a ref object (has .value property as object)
          const isRefObject = (val) => {
            return val !== null && typeof val === 'object' && 'value' in val;
          };
          
          // Helper to safely get ref values (handles both ref objects and unwrapped values)
          const getRefValue = (refOrValue) => {
            if (isRef(refOrValue)) return refOrValue.value;
            if (isRefObject(refOrValue)) return refOrValue.value;
            return refOrValue;
          };
          
          // Helper to safely set ref values
          const setRefValue = (refOrValue, newValue) => {
            if (isRef(refOrValue)) {
              refOrValue.value = newValue;
              return true;
            }
            if (isRefObject(refOrValue)) {
              refOrValue.value = newValue;
              return true;
            }
            // If it's already unwrapped (primitive), we can't set it directly
            return false;
          };
          
          try {
            if (isInfiniteScroll) {
              // For infinite scroll mode when ADDING a new row:
              // CRITICAL FIX: We cannot use the cached data approach because supabaseData
              // only contains the current block, not all rows. If we return cached data,
              // AG Grid will think that's all the data and replace existing rows.
              // 
              // Instead, we need to:
              // 1. Clear the isUpdatingDataLocally flag so getRows fetches fresh data
              // 2. Purge the cache and refresh - this will trigger a fresh fetch from Supabase
              //    which will include the newly added row
              // 3. Wait for the row to appear in the grid before returning
              
              this.debugLog('[Datagrid] Infinite scroll mode: clearing flag to fetch fresh data with new row');
              
              // Clear the flag BEFORE refreshing so getRows will fetch from Supabase
              this.setUpdatingDataLocally(false);
              
              // Purge and refresh the infinite cache
              // With flag cleared, this will fetch fresh data from Supabase including the new row
              return new Promise((resolve) => {
                setTimeout(async () => {
                  if (this.gridApi) {
                    this.gridApi.purgeInfiniteCache();
                    this.debugLog('[Datagrid] Purged infinite cache to reload data with new row');
                    
                    // Refresh the datasource to trigger fresh data fetch
                    const currentDatasource = this.datasource;
                    if (currentDatasource) {
                      this.gridApi.setGridOption('datasource', currentDatasource);
                      this.debugLog('[Datagrid] Refreshed datasource - will fetch fresh data from Supabase');
                    }
                    
                    // CRITICAL: Wait for the row to appear in the grid before resolving
                    // This ensures subsequent actions can find the row
                    try {
                      await waitForRowInGridLocal(rowId, 10000);
                      this.debugLog(`[Datagrid] Row ${rowId} is now present in the grid`);
                      resolve(true);
                    } catch (error) {
                      console.warn(`[Datagrid] Row ${rowId} may not have appeared in grid:`, error.message);
                      // Still resolve true as the row was fetched and cache was refreshed
                      resolve(true);
                    }
                  } else {
                    resolve(false);
                  }
                }, 0);
              });
            } else {
              // For regular mode (non-infinite scroll), use applyTransaction to add the row
              // This is the most efficient way as it only updates the affected rows in the grid
              this.gridApi.applyTransaction({ add: [data], addIndex: 0 });
              this.debugLog(`[Datagrid] Row ${rowId} added to grid using applyTransaction`);
              
              // Update the cached data to keep it in sync
              // The isUpdatingDataLocally flag prevents the rowData watch from causing a re-render
              const supabaseDataRefValue = this.supabaseDataRef;
              if (supabaseDataRefValue) {
                const currentDataValue = getRefValue(supabaseDataRefValue);
                if (Array.isArray(currentDataValue)) {
                  const newData = [...currentDataValue];
                  newData.unshift(data);
                  if (!setRefValue(supabaseDataRefValue, newData)) {
                    // If we couldn't set through ref, try to modify array in place
                    if (Array.isArray(supabaseDataRefValue)) {
                      supabaseDataRefValue.unshift(data);
                    }
                  }
                  this.debugLog(`[Datagrid] Updated cached data, now ${newData.length} rows`);
                }
              }
              
              // Increment total count if available
              if (this.supabaseTotalCountRef) {
                const currentCount = getRefValue(this.supabaseTotalCountRef) || 0;
                setRefValue(this.supabaseTotalCountRef, currentCount + 1);
                this.debugLog(`[Datagrid] Incremented total count to ${currentCount + 1}`);
              }
            }
            
            this.debugLog(`[Datagrid] Row ${rowId} added successfully from database`);
            return true;
          } finally {
            // Clear the flag after a delay to allow any pending watchers to be skipped
            // Use nextTick + setTimeout to ensure all Vue reactivity has settled
            this.$nextTick(() => {
              setTimeout(() => {
                this.setUpdatingDataLocally(false);
                this.debugLog('[Datagrid refreshRow] Clearing isUpdatingDataLocally flag');
              }, 200);
            });
          }
        }
      } catch (error) {
        console.error('[Datagrid] Error refreshing row:', error);
        return false;
      }
    },
    async stopCellEditing(cancel = false) {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for stopCellEditing");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.stopEditing(cancel);
      }, 0);
    },
    async createRecord(columnId, rowId, data) {
      const col = this.cfg?.columns?.find(c => c.field === columnId);
      if (!col || col.cellDataType !== 'record') {
        console.warn(`[Datagrid] createRecord: column "${columnId}" not found or not a record column`);
        return;
      }
      if (!col.recordTable) {
        console.warn(`[Datagrid] createRecord: column "${columnId}" has no recordTable configured`);
        return;
      }

      const supabase = wwLib.wwPlugins?.supabase?.instance;
      if (!supabase) {
        console.warn('[Datagrid] createRecord: Supabase plugin is not available');
        return;
      }

      const { data: newRecord, error } = await supabase
        .from(col.recordTable)
        .insert(data)
        .select()
        .single();

      if (error || !newRecord) {
        console.warn('[Datagrid] createRecord: insert failed', error);
        return;
      }

      const valueField = col.recordValueField || 'id';
      await this.setCellValue(rowId, columnId, newRecord[valueField]);

      if (this.activeCreateColumnField === columnId) {
        this.activeCreateColumnField = null;
        this.activeCreateRow = null;
        this.activeCreateRowId = null;
      }

      this.$emit('trigger-event', {
        name: 'onRecordCreated',
        event: { record: newRecord, columnId, rowId: String(rowId) },
      });
    },

    closeCreateRecordForm() {
      this.activeCreateColumnField = null;
      this.activeCreateRow = null;
      this.activeCreateRowId = null;
    },

    async resetFilters() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for resetFilters");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.isGroupingActive && this.groupGridApis && this.groupGridApis.size > 0) {
          this.groupGridApis.forEach((api) => {
            try { api.setFilterModel(null); } catch (e) { /* noop */ }
          });
        } else if (this.gridApi) {
          this.gridApi.setFilterModel(null);
        }
      }, 0);
    },
    async resetSort() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for resetSort");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        const applyReset = (api) => {
          try {
            api.applyColumnState({
              state: [],
              defaultState: { sort: null },
            });
          } catch (e) { /* noop */ }
        };
        if (this.isGroupingActive && this.groupGridApis && this.groupGridApis.size > 0) {
          this.groupGridApis.forEach(applyReset);
        } else if (this.gridApi) {
          applyReset(this.gridApi);
        }
      }, 0);
    },
    async deselectAll() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for deselectAll");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.isGroupingActive && this.groupGridApis && this.groupGridApis.size > 0) {
          this.groupGridApis.forEach((api) => {
            try { api.deselectAll(); } catch (e) { /* noop */ }
          });
        } else if (this.gridApi) {
          this.gridApi.deselectAll();
        }
      }, 0);
    },
    async selectAll(mode) {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for selectAll");
        return;
      }
      if (!this.gridApi) return;
      if (this.cfg.rowSelection !== "multiple") {
        wwLib.logStore.warning(
          "Select all will have no effect, as row selection is not set to multiple"
        );
        return;
      }
      const selectMode = mode || this.cfg.selectAll || "all";
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.isGroupingActive && this.groupGridApis && this.groupGridApis.size > 0) {
          this.groupGridApis.forEach((api) => {
            try { api.selectAll(selectMode); } catch (e) { /* noop */ }
          });
        } else if (this.gridApi) {
          this.gridApi.selectAll(selectMode);
        }
      }, 0);
    },
    async selectRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing selection
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for selectRow:", error.message);
        return;
      }

      if (!this.gridApi) return;

      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        setTimeout(() => this.selectRow(rowId), 100);
        return;
      }

      // In grouped mode, locate the row in whichever group grid contains it.
      let rowNode = null;
      if (this.isGroupingActive) {
        const found = this.findGroupForRowId(rowId);
        if (found) {
          rowNode = found.node;
        }
      }
      if (!rowNode) {
        rowNode = findRowNode(this.gridApi, rowId, this.resolveMappingFormula, this.content);
      }

      if (rowNode) {
        rowNode.setSelected(true);
      }
    },
    async deselectRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing deselection
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for deselectRow:", error.message);
        return;
      }

      if (!this.gridApi) return;

      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        setTimeout(() => this.deselectRow(rowId), 100);
        return;
      }

      // In grouped mode, locate the row in whichever group grid contains it.
      let rowNode = null;
      if (this.isGroupingActive) {
        const found = this.findGroupForRowId(rowId);
        if (found) {
          rowNode = found.node;
        }
      }
      if (!rowNode) {
        rowNode = findRowNode(this.gridApi, rowId, this.resolveMappingFormula, this.content);
      }

      if (rowNode) {
        rowNode.setSelected(false);
      }
    },
    async removeRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing remove operations
      // This prevents error #252 when removeRow is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for removeRow:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.removeRow(rowId);
            resolve(result);
          }, 100);
        });
      }
      
      if (rowId === null || rowId === undefined) {
        console.warn("[Datagrid] removeRow requires a rowId parameter");
        return false;
      }

      // In grouped mode, locate the row in whichever group grid contains it.
      // Fall back to the primary gridApi for single-grid mode.
      let targetApi = this.gridApi;
      let rowNode = null;
      if (this.isGroupingActive) {
        const found = this.findGroupForRowId(rowId);
        if (found) {
          targetApi = found.api;
          rowNode = found.node;
        }
      }
      if (!rowNode) {
        rowNode = findRowNode(targetApi, rowId, this.resolveMappingFormula, this.content);
      }

      if (!rowNode) {
        console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid`);
        return false;
      }
      
      // Set flag to prevent re-fetching during local update
      // This prevents watchers from triggering data fetches when we remove a row
      // CRITICAL: Set flag BEFORE any operations to prevent any watchers from firing
      this.setUpdatingDataLocally(true);
      this.debugLog('[Remove Row] Setting isUpdatingDataLocally flag to TRUE');
      
      // Remove the row from the grid
      try {
        const isInfiniteScroll = this.cfg?.dataSource === 'supabase' && this.cfg?.enableInfiniteScroll === true;
        
        if (isInfiniteScroll) {
          // For infinite scroll mode, applyTransaction doesn't work properly
          // We need to:
          // 1. Store the rowId to filter out when datasource returns cached data
          // 2. Remove from cached supabaseData
          // 3. Decrement total count
          // 4. Purge cache and refresh datasource
          // 5. The datasource's getRows will filter out the removed row when returning cached data
          
          // Store the removed row ID so datasource can filter it out
          // Access the removedRowIds ref from setup
          if (this.removedRowIds) {
            this.removedRowIds.add(String(rowId));
            this.debugLog(`[Remove Row] Added row ${rowId} to removedRowIds set (size: ${this.removedRowIds.size})`);
            
            // Periodic cleanup to prevent unbounded growth
            cleanupRemovedIds();
          } else {
            this.debugLog(`[Remove Row] Warning: removedRowIds not available`);
          }
          
          // Remove from cached data
          if (this.supabaseDataRef && Array.isArray(this.supabaseDataRef.value)) {
            const currentData = [...this.supabaseDataRef.value];
            const filteredData = currentData.filter(row => {
              const rowIdFromData = this.resolveMappingFormula(this.cfg.idFormula, row);
              return String(rowIdFromData) !== String(rowId);
            });
            
            // Update cached data
            this.supabaseDataRef.value = filteredData;
            this.debugLog(`[Remove Row] Removed from cached data, ${filteredData.length} rows remaining`);
          }
          
          // Decrement total count
          if (this.supabaseTotalCountRef && this.supabaseTotalCountRef.value > 0) {
            this.supabaseTotalCountRef.value = this.supabaseTotalCountRef.value - 1;
            this.debugLog(`[Remove Row] Decremented total count to ${this.supabaseTotalCountRef.value}`);
          }
          
          // For infinite scroll mode, we need to remove the row from the view
          // Since applyTransaction doesn't work reliably, we'll:
          // 1. Try to hide/remove the node directly from the DOM
          // 2. Purge and refresh the cache to rebuild without the row
          
          // First, try to remove the row node from the DOM directly
          try {
            // Get the row element from the DOM
            const rowElement = this.gridContainerRef?.querySelector(`[row-id="${rowNode.id}"]`);
            if (rowElement) {
              // Hide the row by setting display to none
              rowElement.style.display = 'none';
              this.debugLog('[Remove Row] Hid row element from DOM');
            } else {
              // Try alternative selector patterns
              const allRows = this.gridContainerRef?.querySelectorAll('.ag-row');
              if (allRows) {
                allRows.forEach((rowEl, index) => {
                  const rowNodeFromGrid = this.gridApi.getDisplayedRowAtIndex(index);
                  if (rowNodeFromGrid && rowNodeFromGrid.id === rowNode.id) {
                    rowEl.style.display = 'none';
                    this.debugLog('[Remove Row] Hid row element using index lookup');
                  }
                });
              }
            }
          } catch (e) {
            this.debugLog('[Remove Row] Could not hide row from DOM:', e.message);
          }
          
          // Purge the entire infinite cache - this clears all cached blocks
          this.gridApi.purgeInfiniteCache();
          this.debugLog('[Remove Row] Purged infinite cache');
          
          // Refresh the datasource - this will trigger getRows calls for visible blocks
          // Our flag prevents actual fetching, and getRows will return filtered cached data
          const currentDatasource = this.datasource;
          if (currentDatasource) {
            // Reset the datasource to force AG Grid to re-fetch visible blocks
            this.gridApi.setGridOption('datasource', currentDatasource);
            this.debugLog('[Remove Row] Refreshed datasource (getRows will return filtered data)');
            
            // After a short delay, refresh the infinite cache to rebuild the view
            setTimeout(() => {
              try {
                // refreshInfiniteCache will rebuild the view from the datasource
                // Since our flag is set, getRows will return filtered cached data
                this.gridApi.refreshInfiniteCache();
                this.debugLog('[Remove Row] Refreshed infinite cache - view should update with filtered data');
              } catch (e) {
                this.debugLog('[Remove Row] refreshInfiniteCache not available, trying alternative:', e.message);
                // Fallback: try to refresh cells
                try {
                  this.gridApi.refreshCells({ force: true });
                  this.debugLog('[Remove Row] Fallback: refreshed cells');
                } catch (e2) {
                  this.debugLog('[Remove Row] Could not refresh cells either');
                }
              }
            }, 200);
          } else {
            this.debugLog('[Remove Row] Datasource not available, skipping refresh');
          }
          
          this.debugLog(`[Datagrid] Row ${rowId} removed successfully from infinite scroll grid`);
        } else {
          // For regular mode, use standard applyTransaction
          this.gridApi.applyTransaction({ remove: [rowNode.data] });
          this.debugLog(`[Datagrid] Row ${rowId} removed successfully`);
        }
        
        // Clear the flag after a delay to allow transaction to complete
        // and prevent any watchers from triggering re-fetches
        // Use a longer delay for infinite scroll mode to ensure datasource doesn't refresh
        const delay = isInfiniteScroll ? 500 : 200;
        setTimeout(() => {
          this.setUpdatingDataLocally(false);
          // For infinite scroll, keep removedRowIds for a bit longer to ensure all datasource calls are filtered
          // Then clear it after an additional delay
          if (isInfiniteScroll && this.removedRowIds) {
            setTimeout(() => {
              // Don't clear removedRowIds - we want to keep filtering this row out permanently
              // until the next real data fetch (which will naturally exclude it if it's deleted from DB)
              this.debugLog(`[Remove Row] Keeping removedRowIds (size: ${this.removedRowIds.size}) for future filtering`);
            }, 100);
          }
          this.debugLog('[Remove Row] Clearing isUpdatingDataLocally flag');
        }, delay);
        
        return true;
      } catch (error) {
        console.error('[Datagrid] Error removing row:', error);
        // Clear flag on error immediately
        this.setUpdatingDataLocally(false);
        this.debugLog('[Remove Row] Error occurred, clearing isUpdatingDataLocally flag');
        return false;
      }
    },
    /**
     * Apply focus to the row specified by focusedRowId property.
     * This method is called when the grid renders data to ensure the focused row
     * is always visible and styled correctly.
     * @param {boolean} scrollToRow - Whether to scroll the row into view (default: false for re-renders)
     */
    async applyFocusedRow(scrollToRow = false) {
      const focusedRowId = this.cfg?.focusedRowId;
      
      // If no focused row ID is set, clear any existing focus styling
      if (focusedRowId === null || focusedRowId === undefined || focusedRowId === '') {
        // Clear any custom action focus class from all cells
        if (this.gridContainerRef) {
          const focusedCells = this.gridContainerRef.querySelectorAll('.ag-cell-action-focus');
          focusedCells.forEach(cell => cell.classList.remove('ag-cell-action-focus'));
        }
        return;
      }
      
      // Ensure grid is ready
      if (!this.gridApi || this.isGridRendering) {
        return;
      }
      
      // Use unified row lookup utility
      let rowNode = findRowNode(this.gridApi, focusedRowId, this.resolveMappingFormula, this.content);
      
      // If row not found, it might be filtered out or not loaded yet (infinite scroll)
      if (!rowNode || !rowNode.data) {
        this.debugLog('[applyFocusedRow] Row not found:', focusedRowId);
        return;
      }
      
      // If scrollToRow is true, scroll the row into view and set cell focus
      if (scrollToRow) {
        const rowIndex = rowNode.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          // Scroll to center the row
          this.gridApi.ensureIndexVisible(rowIndex, 'middle');
          
          // Set focus on the first column
          this.$nextTick(() => {
            if (!this.gridApi) return;
            
            const allColumns = this.gridApi.getAllGridColumns();
            if (allColumns && allColumns.length > 0) {
              const firstColumnId = allColumns[0].getColId();
              
              setTimeout(() => {
                if (this.gridApi) {
                  this.gridApi.setFocusedCell(rowIndex, firstColumnId);
                  
                  // Add custom action focus class
                  this.$nextTick(() => {
                    if (this.gridContainerRef) {
                      const focusedCell = this.gridContainerRef.querySelector('.ag-cell-focus');
                      if (focusedCell) {
                        focusedCell.classList.add('ag-cell-action-focus');
                      }
                    }
                  });
                }
              }, 100);
            }
          });
        }
      }
      
      // Redraw the row to ensure styles are applied (rowStyle will check focusedRowId)
      if (rowNode) {
        this.gridApi.redrawRows({ rowNodes: [rowNode] });
      }
    },
    /* wwEditor:start */
    generateColumns() {
      this.$emit("update:content", {
        columns: this.rowData?.[0]
          ? Object.keys(this.rowData[0]).map((key) => ({
              field: key,
              sortable: true,
              filter: true,
            }))
          : [],
      });
    },
    getOnActionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        actionName: "actionName",
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getOnCellValueChangedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.cfg.columns || [];
      const firstEditableColumn = columns.find(
        (col) => col?.editable && (col?.cellDataType !== "action" && col?.cellDataType !== "image")
      );
      return {
        oldValue: "oldValue",
        newValue: "newValue",
        columnId: firstEditableColumn?.field || "columnId",
        row: data[0],
        isDirectUpdate: firstEditableColumn?.isDirectUpdate || false,
      };
    },
    getSelectionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
      };
    },
    getRowClickedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getRowDraggedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        targetIndex: 1,
        rows: data,
      };
    },
    getRowDragStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
      };
    },
    getColumnMovedTestEvent() {
      const data = this.columnDefs;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        toIndex: 1,
        columnId: data[0]?.field,
        columnsOrder: data.map((col) => col?.field).filter(Boolean),
      };
    },
    getColumnResizedTestEvent() {
      const columns = this.columnDefs;
      if (!columns || !columns[0]) throw new Error("No columns found");
      const columnsWidths = {};
      columns.forEach((col) => {
        const colId = col?.colId || col?.field;
        if (colId) {
          columnsWidths[colId] = col?.width || 150;
        }
      });
      return {
        columnId: columns[0]?.colId || columns[0]?.field,
        width: columns[0]?.width || 150,
        columnsWidths: columnsWidths,
      };
    },
    getCellEditStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getCellEditEndTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
        isCancel: false,
      };
    },
    getScrollTestEvent() {
      if (!this.gridApi) throw new Error("Grid API is not initialized");
      return {
        scrollTop: 500,
        scrollLeft: 0,
        scrollHeight: 1000,
        clientHeight: 400,
        distanceFromBottom: 100,
        isNearBottom: true,
        isAtBottom: false,
        totalRows: this.gridApi.getDisplayedRowCount() || 0,
      };
    },
    /* wwEditor:end */
  },
  /* wwEditor:start */
  watch: {
    columnDefs: {
      async handler(newDefs, oldDefs) {
        if (this.wwEditorState?.boundProps?.columns) return;
        
        // Skip if grid is not ready yet
        if (!this.gridApi) return;
        
        // CRITICAL FIX: Only reset column state if columns structure actually changed
        // Don't reset if only data or other reactive dependencies changed
        // This preserves user-applied filters and sorting
        const shouldResetState = this.checkIfColumnsStructureChanged(newDefs, oldDefs);
        if (shouldResetState && this.gridApi) {
          // Save current filters and sorting before reset
          const currentFilters = this.gridApi.getFilterModel();
          const currentSort = this.gridApi.getState()?.sort?.sortModel;
          
          this.gridApi.resetColumnState();
          
          // Restore filters and sorting after reset if they exist
          if (currentFilters && Object.keys(currentFilters).length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.setFilterModel(currentFilters);
              }
            });
          }
          if (currentSort && currentSort.length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          }
        }

        if (this.wwEditorState.isACopy) return;

        // Auto-create containerId for new custom columns
        const columnIndex = (this.rawContent.columns || []).findIndex(
          (col) => col?.cellDataType === "custom" && !col?.containerId
        );
        if (columnIndex !== -1) {
          const newColumns = [...this.rawContent.columns];
          let column = { ...newColumns[columnIndex] };
          column.containerId = await this.createElement("ww-flexbox", {
            _state: { name: `Cell ${column.headerName || column.field}` },
          });
          newColumns[columnIndex] = column;
          this.$emit("update:content:effect", { columns: newColumns });
          return;
        }

      },
      deep: true,
    },
  },
  /* wwEditor:end */
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
.record-create-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(1px);
}

.record-create-popup {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  width: fit-content;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-create-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.record-create-popup-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  font-family: inherit;
}

.record-create-popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.record-create-popup-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  flex: 1;
}

.ww-datagrid {
  position: relative;
  isolation: isolate; // Create a new stacking context to contain AG Grid elements
  
  // Fix horizontal scroll alignment between header and body
  // Optimize scroll containers for better synchronization
  :deep(.ag-header-viewport),
  :deep(.ag-body-viewport) {
    // Use hardware acceleration for smooth scrolling and proper synchronization
    transform: translateZ(0);
    backface-visibility: hidden;
    // Force GPU acceleration for better scroll performance
    -webkit-transform: translateZ(0);
  }

  // Promote the main scroll container to its own GPU compositor layer.
  // will-change:scroll-position tells the browser to create a separate layer
  // before the user starts scrolling, avoiding layer-promotion jank mid-scroll.
  :deep(.ag-body-viewport) {
    will-change: scroll-position;
  }
  
  // Remove minimum height when using auto height layout
  // AG Grid sets a 150px minimum height by default for auto height to avoid empty grids
  // This removes that minimum height as per AG Grid documentation
  :deep(.ag-center-cols-viewport) {
    min-height: 75px !important;
  }
  
  // Improve virtualization for large datasets
  :deep(.ag-center-cols-container) {
    min-height: 0 !important;
  }
}

.ww-datagrid {
  
  :deep(.ag-body-viewport) {
    overflow-y: auto !important;
  }

  // Always-visible, simple horizontal scrollbar (single-grid mode)
  // Pinned to the bottom of the component, above all grid content.
  :deep(.ag-body-horizontal-scroll),
  :deep(.ag-body-horizontal-scroll-viewport),
  :deep(.ag-horizontal-left-spacer),
  :deep(.ag-horizontal-right-spacer) {
    height: 8px !important;
    min-height: 8px !important;
    max-height: 8px !important;
  }

  :deep(.ag-body-horizontal-scroll) {
    position: sticky !important;
    bottom: 0 !important;
    z-index: 100 !important;
    background: #f1f1f1;
  }

  // Ensure pinned-column spacers also show the scrollbar background
  // (so the bar renders edge-to-edge even under pinned action columns)
  :deep(.ag-horizontal-left-spacer),
  :deep(.ag-horizontal-right-spacer) {
    background: #f1f1f1 !important;
    overflow: hidden !important;
    pointer-events: none;
  }

  :deep(.ag-body-horizontal-scroll-viewport) {
    overflow-x: scroll !important;
    scrollbar-width: thin;
    scrollbar-color: #888 #f1f1f1;

    &::-webkit-scrollbar {
      height: 8px;
      width: 8px;
      -webkit-appearance: none;
      appearance: none;
    }
    &::-webkit-scrollbar-button,
    &::-webkit-scrollbar-button:single-button,
    &::-webkit-scrollbar-button:start:decrement,
    &::-webkit-scrollbar-button:end:increment,
    &::-webkit-scrollbar-button:horizontal:start:decrement,
    &::-webkit-scrollbar-button:horizontal:end:increment,
    &::-webkit-scrollbar-button:vertical:start:decrement,
    &::-webkit-scrollbar-button:vertical:end:increment {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    &::-webkit-scrollbar-corner {
      background: transparent;
    }
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 0;
    }
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 0;

      &:hover {
        background: #555;
      }
    }
  }

  // Ensure header and body rows stay aligned during horizontal scroll
  :deep(.ag-header-row),
  :deep(.ag-row) {
    // Use hardware acceleration for better scroll performance
    transform: translateZ(0);
    backface-visibility: hidden;
    // contain:style tells the browser that style changes inside a row don't
    // affect sibling rows, eliminating cross-row style recalculation during scroll.
    contain: style;
  }
  
  // Disable transitions on header and body cells during scroll to prevent lag
  // This ensures columns stay aligned during horizontal scrolling
  :deep(.ag-header-cell),
  :deep(.ag-cell) {
    // Only disable transitions on transform/position properties that affect scroll alignment
    // Keep other transitions (like hover effects) intact
    transition-property: background-color, color, border-color, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    // Isolate style recalculations within each cell to avoid cascade invalidations
    contain: style;
  }
  
  :deep(.ag-cell-wrapper),
  :deep(.ag-cell-value) {
    height: 100%;
  }
  
  :deep(.ag-header-cell) {
    &.-center .ag-header-cell-label {
      justify-content: center;
    }
    &.-right {
      .ag-header-cell-label {
        justify-content: flex-end;
      }
      .ag-header-cell-filter-button {
        margin-left: 4px;
      }
    }
    &.-left .ag-header-cell-label {
      justify-content: flex-start;
    }
  }
  
  // Control z-index of filter menus and floating panels only
  // These are the elements that appear above the grid
  :deep(.ag-popup) {
    z-index: 1000 !important; // Reasonable z-index for filter menus
  }
  
  :deep(.ag-filter-wrapper) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-column-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-filter) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-cell) {
    .ag-cell-value {
      display: flex;
    }

    &.-right {
      .ag-cell-value {
        justify-content: flex-end;
      }
    }
    &.-center {
      .ag-cell-value {
        justify-content: center;
      }
    }
    &.-left {
      .ag-cell-value {
        justify-content: flex-start;
      }
    }
    
    // Remove default padding for select column cells
    &:has(.select-cell) {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    // Suppress focus border effects for cells with suppressRowInteraction (keep background)
    &.-suppress-row-interaction {
      // Override focus and range selection border/outline styling only
      &.ag-cell-focus,
      &.ag-cell-range-selected,
      &:focus,
      &:focus-within {
        outline: none !important;
        box-shadow: none !important;
        border-color: transparent !important;
      }
    }
  }

  // Action focus styling - applies when cell is focused programmatically (not keyboard navigation)
  :deep(.ag-cell-action-focus:not(.-suppress-row-interaction)) {
    // Background highlight for action-focused cell
    background-color: var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1)) !important;
    
    // Border highlight using box-shadow for clean rendering
    box-shadow: inset 0 0 0 2px var(--ag-range-selection-border-color, var(--ag-active-color, #2196f3)) !important;
    
    // Smooth transition for focus effect
    transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
  }

  // Suppress cell focus border styling for suppress-row-interaction cells (stronger selectors)
  :deep(.ag-cell-focus.-suppress-row-interaction),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-focus),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-range-selected) {
    outline: none !important;
    box-shadow: none !important;
    border: 1px solid transparent !important;
  }

  // Override AG Grid's range selection border for suppress-row-interaction cells
  :deep(.ag-cell.-suppress-row-interaction) {
    &.ag-cell-range-single-cell,
    &.ag-cell-range-selected-1,
    &.ag-cell-range-selected-2,
    &.ag-cell-range-selected-3,
    &.ag-cell-range-selected-4 {
      border-color: transparent !important;
    }
  }

  // Make editable inputs take full cell width
  :deep(.ag-cell-inline-editing) {
    padding: 0 !important;
    
    .ag-cell-wrapper {
      width: 100%;
      height: 100%;
      padding: 0;
    }
    
    // Default AG Grid text input
    .ag-input-field-input {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Custom cell editors (DateCellEditor, etc.)
    input,
    textarea,
    select {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Cell editor wrapper
    > * {
      width: 100%;
      height: 100%;
    }
  }
  
  /* wwEditor:start */
  &.editing {
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: initial;
      z-index: 10;
    }
  }
  /* wwEditor:end */
}

// ── Column Chooser ───────────────────────────────────────────────────────────

.column-chooser-container {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5;
}

// Trigger button
.column-chooser-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  height: 100%;
  min-height: 28px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-header-foreground-color, #ccc));
  line-height: 1;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
  }

  &.has-hidden {
    color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
  }
}

.cc-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

// Panel
.cc-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: var(--ww-data-grid_cc-width, 260px);
  background: var(--ww-data-grid_cc-background, var(--ag-background-color, #1e2228));
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Work Sans', sans-serif;

  // Apply Work Sans to all text descendants
  *, *::before, *::after {
    font-family: 'Work Sans', sans-serif;
  }
}

// Header
.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.08)));
}

.cc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  letter-spacing: 0.01em;
}

.cc-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  padding: 0;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  }
}

// ==================== Chooser tabs (Columns / Grouping) ====================
.cc-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.08)));
}

.cc-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; // overlap parent border
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  border-radius: 4px 4px 0 0;

  &:hover:not(.cc-tab--active) {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-tab--active {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    border-bottom-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    font-weight: 600;
  }
}

// ==================== Grouping tab content ====================
.cc-group-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.06)));
}

.cc-group-select-label {
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  flex: 0 0 auto;
}

.cc-group-select {
  flex: 1;
  appearance: none;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.12)));
  border-radius: 6px;
  padding: 6px 28px 6px 10px;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%239aa0aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s, background-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  }

  &:focus {
    outline: none;
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 25%, transparent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  option {
    background: var(--ww-data-grid_cc-background, var(--ag-background-color, #1f2125));
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  }
}

.cc-group-loading-dot {
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--ww-data-grid_cc-text-color, #94a3b8) 28%, transparent);
  border-top-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  border-radius: 999px;
  animation: ww-group-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.cc-group-actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px 6px;
}

.cc-group-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.12)));
  border-radius: 6px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #d1d5db));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  svg {
    color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
    flex-shrink: 0;
  }

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 12%, transparent);
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    svg { color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)); }
  }
}

.cc-group-list-label {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
}

.cc-group-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin: 4px 6px 0;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #1f2329));
  transition: background 0.12s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 8%, transparent);
  }

  .cc-group-toggle-label {
    flex: 1;
    line-height: 1.2;
  }
}

.cc-group-list {
  display: flex;
  flex-direction: column;
  padding: 0 6px 8px;
  max-height: 320px;
  overflow-y: auto;
}

.cc-group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
  transition: background 0.12s, transform 0.12s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-group-row--dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  &.cc-group-row--drag-over {
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 16%, transparent);
    box-shadow: inset 0 2px 0 0 var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  }
}

.cc-group-row__swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15) inset;
}

.cc-group-row__label {
  flex: 1;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-group-row__count {
  flex-shrink: 0;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}

// Search row (select-all + search input)
.cc-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.06)));
}

.cc-search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: 6px;
  padding: 6px 10px;
}

.cc-search-icon {
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  flex-shrink: 0;
  opacity: 0.6;
}

.cc-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  width: 100%;

  &::placeholder {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #9aa0aa));
    opacity: 0.5;
  }
}

// Custom checkbox
.cc-checkbox-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.cc-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 4px;
  border: 2px solid var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
  background: transparent;
  position: relative;
  transition: background 0.15s, border-color 0.15s;

  &:checked {
    background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));

    &::after {
      content: '';
      position: absolute;
      left: 3px;
      top: 0px;
      width: 5px;
      height: 9px;
      border: 2px solid var(--ww-data-grid_cc-background, #fff);
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
    }
  }

  &:indeterminate {
    background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));

    &::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 50%;
      width: 8px;
      height: 2px;
      background: var(--ww-data-grid_cc-background, #fff);
      transform: translateY(-50%);
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

// Column list
.cc-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 0 6px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 18%, transparent);
    border-radius: 2px;
  }
}

// Each column row
.cc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  cursor: default;
  transition: background 0.1s;
  border-left: 2px solid transparent;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-row--drag-over {
    border-left-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b9eff) 12%, transparent);
  }

  &.cc-row--dragging {
    opacity: 0.4;
  }

  &.cc-row--locked {
    opacity: 0.5;
    cursor: default;

    &:hover {
      background: transparent;
    }
  }
}

.cc-checkbox-wrap--locked {
  cursor: default;
  pointer-events: none;
}

.cc-drag-handle {
  display: flex;
  align-items: center;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  opacity: 0.4;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:active {
    cursor: grabbing;
  }

  &.cc-drag-handle--disabled {
    opacity: 0.15;
    cursor: default;
    pointer-events: none;
  }

  .cc-row:hover & {
    opacity: 0.7;
  }
}

.cc-col-name {
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #d8dce3));
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #9aa0aa));
  opacity: 0.6;
  text-align: center;
}

// Fade transition
.cc-fade-enter-active,
.cc-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.cc-fade-enter-from,
.cc-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

// ===========================================================================
// Grouping feature styles
// ===========================================================================

.ww-datagrid.grouped {
  display: flex !important;
  flex-direction: column !important;
  row-gap: 14px;
  // Top padding keeps the first group from sitting flush against whatever
  // sits above the component (toolbar, tabs, page header, etc.). !important
  // because the host wrapper sometimes resets padding on the root element.
  padding: 16px 4px 12px !important;
}

.ww-group-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ag-background-color, #ffffff) 68%, transparent);
  backdrop-filter: blur(2px);
  pointer-events: all;
}

.ww-group-loading-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 999px;
  background: var(--ag-background-color, #ffffff);
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.12));
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  color: var(--ag-foreground-color, #111827);
  font-size: 13px;
  font-weight: 600;
}

.ww-group-loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top-color: var(--ag-accent-color, #3b82f6);
  border-radius: 999px;
  animation: ww-group-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.group-loading-fade-enter-active,
.group-loading-fade-leave-active {
  transition: opacity 0.16s ease;
}

.group-loading-fade-enter-from,
.group-loading-fade-leave-to {
  opacity: 0;
}

@keyframes ww-group-spin {
  to {
    transform: rotate(360deg);
  }
}

// .ww-group-toolbar removed — its buttons now live in the chooser panel's
// Grouping tab (.cc-group-actions / .cc-group-action-btn).

.ww-group {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  // No overflow:hidden here — column filter / menu popups inside the grid
  // need to be able to extend past the group's bottom edge. The rounded
  // corners are produced by the header (top) and footer (bottom) themselves
  // via their own border-top-*-radius / border-bottom-*-radius, so the parent
  // doesn't need to clip anything to look right.
  transition: opacity 0.15s ease, box-shadow 0.15s ease;


  &.ww-group--dragging {
    opacity: 0.45;
  }

  &.ww-group--drag-over {
    box-shadow: 0 0 0 2px var(--ag-active-color, #3b9eff);
  }

  &.ww-group--collapsed {
    .ww-group__header {
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
      margin-bottom: 0;
    }
  }
}

.ww-group__header {
  --group-color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--group-color) 10%, transparent);
  border-left: 4px solid var(--group-color);
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  cursor: grab;
  user-select: none;
  font-family: inherit;

  &:active {
    cursor: grabbing;
  }

  &:hover {
    background: color-mix(in srgb, var(--group-color) 16%, transparent);
  }
}

.ww-group__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--group-color);
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: color-mix(in srgb, var(--group-color) 20%, transparent);
  }

  &.ww-group__chevron--open {
    transform: rotate(90deg);
  }
}

.ww-group__title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
}

.ww-group__label {
  font-size: 13px;
  font-weight: 600;
  color: color-mix(in srgb, var(--group-color) 80%, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.ww-group__items {
  font-size: 11px;
  font-weight: 500;
  // Use the user-configured Text color (cfg.textColor → --ag-foreground-color).
  color: var(--ag-foreground-color, #6b7280);
  opacity: 0.75;
  line-height: 1.2;
  white-space: nowrap;
}

.ww-group__drag-handle {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--group-color);
  opacity: 0.5;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  .ww-group__header:hover & {
    opacity: 0.85;
  }

  &:active {
    cursor: grabbing;
  }
}

.ww-group__grid {
  width: 100%;
  min-height: 0;
  border-left: 4px solid var(--group-color, #9ca3af);
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  overflow: hidden;

  :deep(.ag-body-horizontal-scroll) {
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
  }

  :deep(.ag-body-horizontal-scroll-viewport) {
    overflow-x: hidden !important;
  }
}

// Group grid is always sandwiched between header and footer when expanded —
// keep its corners square so the header/footer do the rounding.
.ww-group:not(.ww-group--collapsed) .ww-group__grid {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

// Footer mirrors the header: same color tint, same border-left accent, same
// padding rhythm. Only difference is rounding on the bottom corners and a
// flex-end alignment so the item count sits on the right.
.ww-group__footer {
  --group-color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--group-color) 10%, transparent);
  border-left: 4px solid var(--group-color);
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  user-select: none;
  font-family: inherit;
}

.ww-group__footer-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--ag-foreground-color, #6b7280);
  opacity: 0.75;
  line-height: 1.2;
  white-space: nowrap;
}

.ww-group-horizontal-scroll {
  position: absolute;
  bottom: 0;
  z-index: 30;
  height: 8px;
  overflow-x: scroll;
  overflow-y: hidden;
  flex: 0 0 auto;
  scrollbar-width: thin;
  scrollbar-color: #888 #f1f1f1;

  &::-webkit-scrollbar {
    height: 8px;
    width: 8px;
    -webkit-appearance: none;
    appearance: none;
  }

  &::-webkit-scrollbar-button,
  &::-webkit-scrollbar-button:single-button,
  &::-webkit-scrollbar-button:start:decrement,
  &::-webkit-scrollbar-button:end:increment,
  &::-webkit-scrollbar-button:horizontal:start:decrement,
  &::-webkit-scrollbar-button:horizontal:end:increment,
  &::-webkit-scrollbar-button:vertical:start:decrement,
  &::-webkit-scrollbar-button:vertical:end:increment {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 0;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 0;

    &:hover {
      background: #555;
    }
  }
}

.ww-group-horizontal-scroll__spacer {
  height: 1px;
}
</style>
