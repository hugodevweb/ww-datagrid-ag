<template>
  <div class="ww-kanban" :style="cssVars" ref="rootRef">
    <!-- Empty state -->
    <div v-if="!groupBy" class="kanban-empty">
      <div class="kanban-empty__title">{{ t.kanbanEmptyTitle }}</div>
      <div class="kanban-empty__subtitle">{{ t.kanbanEmptySubtitle }}</div>
    </div>

    <!-- Kanban board -->
    <div v-else class="kanban-board" ref="boardRef">
      <!-- Open groups: horizontal kanban columns. Collapsed groups don't render
           here — they can be re-shown from the config panel's groups list. -->
      <div class="kanban-columns">
        <div
          v-for="group in openGroups"
          :key="group.value"
          class="kanban-column"
          :style="{ '--group-color': group.color }"
          :class="{
            'kanban-column--drag-over': dragOverGroup === group.value,
            'kanban-column--drag-source': dragSourceGroup === group.value,
          }"
          @dragover.prevent="onColumnDragOver(group.value, $event)"
          @dragleave="onColumnDragLeave(group.value)"
          @drop.prevent="onColumnDrop(group.value)"
        >
          <!-- Header -->
          <div
            class="kanban-column__header"
            :draggable="!cardDragRowId"
            @dragstart="onGroupDragStart(group.value, $event)"
            @dragover.prevent="onGroupHeaderDragOver(group.value, $event)"
            @drop.prevent="onGroupHeaderDrop(group.value, $event)"
            @dragend="onGroupDragEnd"
          >
            <button
              type="button"
              class="kanban-column__chevron kanban-column__chevron--open"
              @click.stop="toggleGroupVisibility(group.value)"
              :aria-label="t.kanbanHideGroup"
              :title="t.kanbanHideGroup"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
            <span class="kanban-column__label" @click.stop="toggleGroupVisibility(group.value)">{{ group.label }}</span>
            <span class="kanban-column__count">{{ group.count }}</span>
          </div>

          <!-- Cards -->
          <div class="kanban-column__body">
            <div
              v-for="row in groupedRows.get(group.value) || []"
              :key="getRowId(row)"
              class="kanban-card"
              :class="{ 'kanban-card--dragging': cardDragRowId === getRowId(row) }"
              draggable="true"
              @click="onCardClick(row)"
              @dragstart="onCardDragStart(row, group.value, $event)"
              @dragend="onCardDragEnd"
            >
              <!-- Top-right dropzone — editor-droppable, runs at the card's top-right.
                   click + dragstart are stopped so users can interact with whatever
                   they drop in (buttons, menus, etc.) without firing card-click or
                   starting a card drag. -->
              <div
                class="kanban-card__dropzone"
                @click.stop
                @mousedown.stop
                @dragstart.stop.prevent
                draggable="false"
              >
                <wwLayoutItemContext
                  is-repeat
                  :index="cardIndexMap.get(getRowId(row)) ?? 0"
                  :item="{ row, rowId: getRowId(row), groupValue: group.value }"
                  :data="{ row, rowId: getRowId(row), groupValue: group.value }"
                  :repeated-items="visibleCards"
                >
                  <wwLayout path="kanbanCardDropzone" direction="row" />
                </wwLayoutItemContext>
              </div>

              <KanbanField
                v-for="(field, idx) in cardFields"
                :key="field"
                :column="findColumn(field)"
                :row="row"
                :resolve-mapping-formula="resolveMappingFormula"
                :is-title="idx === 0"
                :cell-font-family="cfg.cellFontFamily || ''"
                :user-focus-color="cfg.userFocusColor || ''"
              />
            </div>
            <div v-if="(groupedRows.get(group.value) || []).length === 0" class="kanban-column__empty">
              {{ t.kanbanDropHere }}
            </div>
          </div>
        </div>

        <div v-if="groups.length === 0" class="kanban-board__empty">
          {{ t.kanbanBoardEmpty }}
        </div>
      </div>
    </div>

    <!-- Config panel -->
    <div ref="configPanelRef" class="kanban-config-anchor">
      <Transition name="cc-fade">
        <div v-if="showConfig" class="cc-panel kanban-cc-panel" @click.stop>
          <div class="cc-header">
            <span class="cc-title">{{ t.kanbanSettings }}</span>
            <button class="cc-close-btn" @click="showConfig = false" :aria-label="t.kanbanClose">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="cc-tabs" role="tablist">
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'group' }"
              role="tab"
              :aria-selected="activeTab === 'group'"
              @click="activeTab = 'group'"
            >{{ t.kanbanGroupTab }}</button>
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'fields' }"
              role="tab"
              :aria-selected="activeTab === 'fields'"
              @click="activeTab = 'fields'"
            >{{ t.kanbanFieldsTab }}</button>
          </div>

          <!-- Group tab -->
          <template v-if="activeTab === 'group'">
            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ t.groupBy }}</label>
              <select
                class="cc-group-select"
                :value="groupBy || ''"
                :disabled="selectColumns.length === 0"
                @change="setGroupBy($event.target.value || null)"
              >
                <option value="">{{ t.noGrouping }}</option>
                <option v-for="opt in selectColumns" :key="opt.field" :value="opt.field">
                  {{ opt.headerName || opt.field }}
                </option>
              </select>
            </div>

            <template v-if="groupBy && groups.length > 0">
              <label class="cc-group-toggle-row">
                <input
                  type="checkbox"
                  class="cc-checkbox"
                  :checked="showUnassigned"
                  @change="setShowUnassigned($event.target.checked)"
                />
                <span class="cc-group-toggle-label">{{ t.kanbanShowUnassigned }}</span>
              </label>

              <div class="cc-group-list-label">{{ t.groupsOrder }}</div>
              <div class="cc-group-list">
                <div
                  v-for="g in groups"
                  :key="g.value"
                  class="cc-group-row"
                  :class="{
                    'cc-group-row--drag-over': configGroupDragOver === g.value && configGroupDrag !== g.value,
                    'cc-group-row--dragging': configGroupDrag === g.value,
                    'cc-group-row--hidden': g.hidden,
                  }"
                  draggable="true"
                  @dragstart="onConfigGroupDragStart(g.value)"
                  @dragover.prevent="onConfigGroupDragOver(g.value)"
                  @drop.prevent="onConfigGroupDrop(g.value)"
                  @dragend="onConfigGroupDragEnd"
                >
                  <button
                    type="button"
                    class="cc-group-visibility"
                    :class="{ 'cc-group-visibility--hidden': g.hidden }"
                    @click.stop="toggleGroupVisibility(g.value)"
                    :aria-label="g.hidden ? t.kanbanShowGroup : t.kanbanHideGroup"
                    :title="g.hidden ? t.kanbanShowGroup : t.kanbanHideGroup"
                  >
                    <svg v-if="!g.hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                  <span class="cc-group-row__swatch" :style="{ backgroundColor: g.color }"></span>
                  <span class="cc-drag-handle">
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                      <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                      <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                    </svg>
                  </span>
                  <span class="cc-group-row__label">{{ g.label }}</span>
                  <span class="cc-group-row__count">{{ g.count }}</span>
                </div>
              </div>
            </template>

            <div v-else-if="selectColumns.length === 0" class="cc-empty">
              {{ t.kanbanNoSelectColumns }}
            </div>
          </template>

          <!-- Card fields tab -->
          <template v-else-if="activeTab === 'fields'">
            <div class="cc-search-row">
              <div class="cc-search-box">
                <svg class="cc-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <input
                  class="cc-search-input"
                  type="text"
                  v-model="fieldSearch"
                  :placeholder="t.kanbanFieldsSearch"
                  @click.stop
                />
              </div>
            </div>

            <div class="cc-fields-meta">
              <span>{{ fieldsCounterText }}</span>
              <span v-if="cardFields.length === 0" class="cc-fields-meta__hint">{{ t.kanbanFieldsHint }}</span>
            </div>

            <div class="cc-list">
              <div
                v-for="col in filteredFieldList"
                :key="col.field"
                class="cc-row"
                :class="{
                  'cc-row--drag-over': fieldDragOver === col.field && fieldDrag !== col.field,
                  'cc-row--dragging': fieldDrag === col.field,
                }"
                :title="isFieldDisabled(col.field) ? maxFieldsTooltip : null"
                :draggable="!fieldSearch && cardFields.includes(col.field)"
                @dragstart="onFieldDragStart(col.field)"
                @dragover.prevent="onFieldDragOver(col.field)"
                @drop.prevent="onFieldDrop(col.field)"
                @dragend="onFieldDragEnd"
              >
                <label class="cc-checkbox-wrap" :class="{ 'cc-checkbox-wrap--locked': isFieldDisabled(col.field) }">
                  <input
                    type="checkbox"
                    class="cc-checkbox"
                    :checked="cardFields.includes(col.field)"
                    :disabled="isFieldDisabled(col.field)"
                    @change="toggleCardField(col.field)"
                  />
                </label>
                <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !cardFields.includes(col.field) || !!fieldSearch }">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                    <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                    <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                  </svg>
                </span>
                <span class="cc-col-name">{{ col.headerName || col.field }}</span>
                <span v-if="cardFields.indexOf(col.field) === 0" class="cc-field-badge">{{ t.kanbanTitleBadge }}</span>
              </div>
              <div v-if="filteredFieldList.length === 0" class="cc-empty">{{ t.kanbanNoFieldsMatch }}</div>
            </div>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import KanbanField from './components/KanbanField.vue';
import { getTranslations } from '../shared/utils/sharedHelpers.js';
import { fetchSupabaseDataInfinite } from '../shared/utils/supabaseUtils.js';

const UNASSIGNED_GROUP = '__unassigned__';
const MAX_CARD_FIELDS = 5;

export default {
  name: 'Kanban',
  components: { KanbanField },
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  setup(props, ctx) {
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    // Merged config (matches Datagrid.vue: baseConfig keys override per-instance content).
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

    // Reactive translations — recomputes whenever cfg.lang changes.
    const t = computed(() => getTranslations(cfg.value?.lang || 'en'));

    const fieldsCounterText = computed(() =>
      t.value.kanbanFieldsCounter
        .replace('{count}', cardFields.value.length)
        .replace('{max}', MAX_CARD_FIELDS)
    );
    const maxFieldsTooltip = computed(() =>
      (t.value.kanbanMaxFields || 'Maximum {max} fields').replace('{max}', MAX_CARD_FIELDS)
    );

    const cssVars = computed(() => ({
      '--ag-foreground-color': cfg.value?.textColor || cfg.value?.cellColor || '#1f2937',
      '--ag-background-color': cfg.value?.backgroundColor || '#ffffff',
      '--ag-border-color': cfg.value?.borderColor || 'rgba(0,0,0,0.08)',
      '--ww-data-grid_cc-background': cfg.value?.columnChooserBackground || cfg.value?.backgroundColor || '#ffffff',
      '--ww-data-grid_cc-border-color': cfg.value?.columnChooserBorderColor || cfg.value?.borderColor || 'rgba(0,0,0,0.08)',
      '--ww-data-grid_cc-text-color': cfg.value?.columnChooserTextColor || cfg.value?.textColor || '#1f2937',
      '--ww-data-grid_cc-accent-color': cfg.value?.columnChooserAccentColor || '#3b82f6',
      '--ww-data-grid_cc-border-radius': cfg.value?.columnChooserBorderRadius || '8px',
      '--ww-data-grid_cc-width': cfg.value?.columnChooserWidth || '300px',
      fontFamily: cfg.value?.cellFontFamily || 'inherit',
    }));

    // ---- Local kanban state, hydrated from viewConfiguration.kanban ----
    const groupBy = ref(null);
    const cardFields = ref([]);
    const groupOrder = ref([]);
    const showUnassigned = ref(true);
    const hiddenGroups = ref(new Set());
    const showConfig = ref(false);
    const activeTab = ref('group');
    const fieldSearch = ref('');

    // Drag state
    const cardDragRowId = ref(null);
    const cardDragSource = ref(null);
    const dragSourceGroup = ref(null);
    const dragOverGroup = ref(null);

    const configGroupDrag = ref(null);
    const configGroupDragOver = ref(null);

    const fieldDrag = ref(null);
    const fieldDragOver = ref(null);

    const groupHeaderDrag = ref(null); // separate from card drag — reuses configGroupDrag style
    const groupHeaderDragOver = ref(null);

    const rootRef = ref(null);
    const boardRef = ref(null);
    const configPanelRef = ref(null);

    // viewEdited write gating.
    // - `isApplyingConfig` blocks writes during applyViewConfig's mutation phase.
    //   Cleared via setTimeout (NOT nextTick) so it stays true through Vue's
    //   watcher flush which runs in the same microtask as nextTick.
    // - `firstApplyDone` blocks writes until the first apply has completed.
    //   This stops a stale `viewEdited = true` from a previous mount/component
    //   from leaking through during the kanban's own initial state assembly.
    // - `applyConfigGen` lets only the latest apply's cleanup clear the flag.
    const isApplyingConfig = ref(true);
    const firstApplyDone = ref(false);
    let applyConfigGen = 0;

    // ---- viewConfiguration sync ----
    const readKanbanFromViewConfig = () => {
      const k = cfg.value?.viewConfiguration?.kanban;
      if (!k || typeof k !== 'object') return null;
      return k;
    };

    const applyViewConfig = () => {
      const k = readKanbanFromViewConfig();
      isApplyingConfig.value = true;
      const myGen = ++applyConfigGen;
      const validFields = new Set((cfg.value?.columns || []).map(c => c?.field).filter(Boolean));
      const isSelectField = (f) => {
        const col = (cfg.value?.columns || []).find(c => c?.field === f);
        return !!col && col.cellDataType === 'select';
      };
      if (k) {
        groupBy.value = k.groupBy && isSelectField(k.groupBy) ? k.groupBy : null;
        cardFields.value = Array.isArray(k.cardFields)
          ? k.cardFields.filter(f => validFields.has(f) && f !== groupBy.value).slice(0, MAX_CARD_FIELDS)
          : [];
        groupOrder.value = Array.isArray(k.order) ? [...k.order] : [];
        showUnassigned.value = k.showUnassigned !== false;
        hiddenGroups.value = new Set(Array.isArray(k.hiddenGroups) ? k.hiddenGroups : []);
      } else {
        groupBy.value = null;
        cardFields.value = [];
        groupOrder.value = [];
        showUnassigned.value = true;
        hiddenGroups.value = new Set();
      }
      // Clear via macrotask so any synchronous + microtask-queued watchers fire
      // first (with isApplyingConfig still true). Only the latest apply clears.
      setTimeout(() => {
        if (myGen !== applyConfigGen) return;
        isApplyingConfig.value = false;
        firstApplyDone.value = true;
        // Reset viewEdited to false — local state now matches the just-applied
        // baseline. This also clears any stale `true` left over from a previous
        // view (e.g. the datagrid's teardown writeback when switching views).
        const variableId = cfg.value?.viewEditedVariableId;
        if (variableId) {
          console.log('[viewEdited][kanban] applyViewConfig→FALSE (post-apply reset)', { variableId });
          try { wwLib.wwVariable.updateValue(variableId, false); } catch (_) { /* noop */ }
        }
      }, 0);
    };

    // Exposed currentConfig variable — same name as the datagrid. Either the
    // datagrid OR the kanban is mounted at any given moment (viewType switch
    // in wwElement.vue), so there's no double-registration at runtime.
    const { value: currentConfig, setValue: setCurrentConfig } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: 'currentConfig',
        type: 'object',
        defaultValue: { kanban: { groupBy: null, cardFields: [], order: [], showUnassigned: true } },
        readonly: true,
      });

    const writeCurrentConfig = () => {
      const hiddenGroupsArr = [...hiddenGroups.value];
      const config = {
        kanban: {
          groupBy: groupBy.value,
          cardFields: [...cardFields.value],
          order: [...groupOrder.value],
          showUnassigned: showUnassigned.value !== false,
          hiddenGroups: hiddenGroupsArr,
        },
      };
      setCurrentConfig(config);
      // viewEdited only fires for in-component user actions (drag/drop,
      // group/field reorder, hide/show, config menu changes). Programmatic
      // applies and the initial mount must NOT touch this variable.
      if (isApplyingConfig.value || !firstApplyDone.value) {
        console.log('[viewEdited][kanban] writeCurrentConfig SUPPRESSED', {
          isApplyingConfig: isApplyingConfig.value,
          firstApplyDone: firstApplyDone.value,
        });
        return;
      }
      const variableId = cfg.value?.viewEditedVariableId;
      if (!variableId) return;
      const baseline = readKanbanFromViewConfig() || {};
      const baselineHidden = Array.isArray(baseline.hiddenGroups) ? [...baseline.hiddenGroups].sort() : [];
      const currentHidden = [...hiddenGroupsArr].sort();
      const edited =
        (baseline.groupBy ?? null) !== (groupBy.value ?? null) ||
        !arraysEqual(baseline.cardFields || [], cardFields.value) ||
        !arraysEqual(baseline.order || [], groupOrder.value) ||
        ((baseline.showUnassigned !== false) !== (showUnassigned.value !== false)) ||
        !arraysEqual(baselineHidden, currentHidden);
      console.log('[viewEdited][kanban] writeCurrentConfig→' + edited, {
        variableId,
        baseline: { groupBy: baseline.groupBy, cardFields: baseline.cardFields, order: baseline.order, showUnassigned: baseline.showUnassigned, hiddenGroups: baseline.hiddenGroups },
        current: { groupBy: groupBy.value, cardFields: [...cardFields.value], order: [...groupOrder.value], showUnassigned: showUnassigned.value, hiddenGroups: hiddenGroupsArr },
      });
      try { wwLib.wwVariable.updateValue(variableId, edited); } catch (_) { /* noop */ }
    };

    const arraysEqual = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    // Keep the exposed variable in sync.
    watch([groupBy, cardFields, groupOrder, showUnassigned, hiddenGroups], () => writeCurrentConfig(), { deep: true });

    // Reapply when viewConfiguration prop changes externally.
    watch(() => cfg.value?.viewConfiguration, () => applyViewConfig(), { deep: true });

    // Reapply when columns change (a column may have been removed). This is
    // programmatic, not a user action — suppress viewEdited writes through it.
    watch(() => cfg.value?.columns, () => {
      const validFields = new Set((cfg.value?.columns || []).map(c => c?.field).filter(Boolean));
      const nextFields = cardFields.value.filter(f => validFields.has(f));
      const groupByInvalid = groupBy.value && !validFields.has(groupBy.value);
      if (!arraysEqual(nextFields, cardFields.value) || groupByInvalid) {
        isApplyingConfig.value = true;
        const myGen = ++applyConfigGen;
        cardFields.value = nextFields;
        if (groupByInvalid) groupBy.value = null;
        setTimeout(() => {
          if (myGen !== applyConfigGen) return;
          isApplyingConfig.value = false;
        }, 0);
      }
    }, { deep: true });

    onMounted(() => {
      console.log('[viewEdited][kanban] MOUNTED — initial applyViewConfig pending', {
        hasViewConfigKanban: !!readKanbanFromViewConfig(),
        viewEditedVariableId: cfg.value?.viewEditedVariableId,
      });
      applyViewConfig();
    });

    // ---- Computed: data, columns, groups ----

    const findColumn = (field) => {
      if (!field) return null;
      return (cfg.value?.columns || []).find(c => c?.field === field) || null;
    };

    const selectColumns = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols.filter(c => c && c.field && c.cellDataType === 'select');
    });

    const groupByColumn = computed(() => findColumn(groupBy.value));

    const availableFields = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols.filter(c => c && c.field && c.cellDataType !== 'action' && c.field !== groupBy.value);
    });

    const filteredFieldList = computed(() => {
      const q = fieldSearch.value.trim().toLowerCase();
      const list = availableFields.value;
      if (!q) {
        // Selected first (in order), then unselected
        const selected = cardFields.value
          .map(f => list.find(c => c.field === f))
          .filter(Boolean);
        const unselected = list.filter(c => !cardFields.value.includes(c.field));
        return [...selected, ...unselected];
      }
      return list.filter(c => (c.headerName || c.field).toLowerCase().includes(q));
    });

    // Supabase data path: when dataSource === 'supabase', the kanban fetches its
    // own slice (the datagrid is not mounted, so its supabaseData ref doesn't exist
    // here). We fetch a single large infinite-mode page since the kanban shows
    // every card across every group at once. Cap configurable via
    // cfg.kanbanMaxRows (default 1000).
    const supabaseRows = ref([]);
    const supabaseFetching = ref(false);
    const fetchSupabase = async () => {
      if (cfg.value?.dataSource !== 'supabase') return;
      const tableName = cfg.value?.supabaseTable;
      if (!tableName) return;
      const supabase = wwLib?.wwPlugins?.supabase?.instance;
      if (!supabase) return;
      const max = Number(cfg.value?.kanbanMaxRows) || 1000;
      supabaseFetching.value = true;
      try {
        const { data } = await fetchSupabaseDataInfinite({
          supabaseInstance: supabase,
          tableName,
          queryString: cfg.value?.supabaseQuery || '*',
          manualFilters: cfg.value?.supabaseFilters,
          searchValue: null,
          searchableColumns: null,
          filterModel: null,
          sortModel: null,
          startRow: 0,
          endRow: max,
          applyManualFilters: (q, filters) => {
            if (!Array.isArray(filters)) return q;
            for (const f of filters) {
              if (!f || !f.field || !f.operator) continue;
              try { q = q[f.operator](f.field, f.value); } catch (_) { /* noop */ }
            }
            return q;
          },
          applySearchToSupabase: (q) => q,
          convertFilterToSupabase: (_, q) => q,
          getSupabaseSortField: (id) => id,
          formatFiltersForLog: () => '(kanban)',
        });
        supabaseRows.value = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn('[Kanban] Supabase fetch failed:', e?.message || e);
        supabaseRows.value = [];
      } finally {
        supabaseFetching.value = false;
      }
    };

    // Refetch when the data source / table / filters change, or on mount when
    // already in supabase mode.
    watch(
      () => [cfg.value?.dataSource, cfg.value?.supabaseTable, cfg.value?.supabaseQuery, cfg.value?.supabaseFilters, cfg.value?.kanbanMaxRows],
      () => fetchSupabase(),
      { deep: true }
    );
    onMounted(() => fetchSupabase());

    const allRows = computed(() => {
      if (cfg.value?.dataSource === 'supabase') {
        return supabaseRows.value;
      }
      const data = wwLib.wwUtils.getDataFromCollection(cfg.value?.rowData);
      return Array.isArray(data) ? data : [];
    });

    const rowGroupKey = (row) => {
      if (!groupBy.value) return UNASSIGNED_GROUP;
      const v = row?.[groupBy.value];
      if (v === null || v === undefined || v === '') return UNASSIGNED_GROUP;
      return String(v);
    };

    const groupedRows = computed(() => {
      const out = new Map();
      if (!groupBy.value) return out;
      for (const row of allRows.value) {
        const k = rowGroupKey(row);
        let arr = out.get(k);
        if (!arr) { arr = []; out.set(k, arr); }
        arr.push(row);
      }
      return out;
    });

    const groups = computed(() => {
      const col = groupByColumn.value;
      if (!col) return [];
      const options = Array.isArray(col.options) ? col.options : [];
      const orderArr = Array.isArray(groupOrder.value) ? groupOrder.value : [];
      const dataMap = groupedRows.value;
      const hidden = hiddenGroups.value;

      const base = options.map(o => {
        const value = String(o?.value);
        return {
          value,
          label: o?.label ?? value,
          color: o?.color || '#9ca3af',
          count: dataMap.get(value)?.length || 0,
          hidden: hidden.has(value),
        };
      });

      const unassignedCount = dataMap.get(UNASSIGNED_GROUP)?.length || 0;
      if (showUnassigned.value !== false && unassignedCount > 0) {
        base.push({
          value: UNASSIGNED_GROUP,
          label: t.value.kanbanUnassigned,
          color: '#9ca3af',
          count: unassignedCount,
          hidden: hidden.has(UNASSIGNED_GROUP),
        });
      }

      if (orderArr.length === 0) return base;
      const byValue = new Map(base.map(g => [g.value, g]));
      const ordered = [];
      for (const v of orderArr) {
        if (byValue.has(v)) { ordered.push(byValue.get(v)); byValue.delete(v); }
      }
      byValue.forEach(g => ordered.push(g));
      return ordered;
    });

    const openGroups = computed(() => groups.value.filter(g => !g.hidden));

    // Flat list of all cards currently rendered on the board, in display order
    // (group order × per-group row order). Drives the per-card index passed to
    // wwLayoutItemContext so each dropzone has a stable, unique identity that
    // WeWeb can reliably persist across page navigations.
    const visibleCards = computed(() => {
      const out = [];
      for (const g of openGroups.value) {
        const rows = groupedRows.value.get(g.value) || [];
        for (const row of rows) {
          out.push({ row, rowId: getRowId(row), groupValue: g.value });
        }
      }
      return out;
    });
    const cardIndexMap = computed(() => {
      const m = new Map();
      const list = visibleCards.value;
      for (let i = 0; i < list.length; i++) {
        const id = list[i]?.rowId;
        if (id != null) m.set(id, i);
      }
      return m;
    });

    const getRowId = (row) => {
      const fromFormula = resolveMappingFormula(cfg.value?.idFormula, row);
      if (fromFormula !== null && fromFormula !== undefined && fromFormula !== '') {
        return String(fromFormula);
      }
      return row?.id != null ? String(row.id) : null;
    };

    // ---- Config menu actions ----
    const setGroupBy = (field) => {
      groupBy.value = field || null;
      // If the new groupBy is currently in cardFields, drop it.
      if (field) cardFields.value = cardFields.value.filter(f => f !== field);
      groupOrder.value = [];
    };

    const setShowUnassigned = (val) => { showUnassigned.value = !!val; };

    const isFieldDisabled = (field) => {
      if (cardFields.value.includes(field)) return false;
      return cardFields.value.length >= MAX_CARD_FIELDS;
    };

    const toggleCardField = (field) => {
      const idx = cardFields.value.indexOf(field);
      if (idx >= 0) {
        cardFields.value = cardFields.value.filter(f => f !== field);
      } else if (cardFields.value.length < MAX_CARD_FIELDS) {
        cardFields.value = [...cardFields.value, field];
      }
    };

    const toggleGroupVisibility = (value) => {
      const next = new Set(hiddenGroups.value);
      if (next.has(value)) next.delete(value); else next.add(value);
      hiddenGroups.value = next;
    };

    // ---- Card field reorder ----
    const onFieldDragStart = (field) => {
      if (!cardFields.value.includes(field)) return;
      fieldDrag.value = field;
    };
    const onFieldDragOver = (field) => {
      if (!fieldDrag.value) return;
      if (!cardFields.value.includes(field)) return;
      fieldDragOver.value = field;
    };
    const onFieldDrop = (target) => {
      const src = fieldDrag.value;
      fieldDrag.value = null;
      fieldDragOver.value = null;
      if (!src || src === target) return;
      if (!cardFields.value.includes(target) || !cardFields.value.includes(src)) return;
      const arr = [...cardFields.value];
      const fromIdx = arr.indexOf(src);
      const toIdx = arr.indexOf(target);
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, src);
      cardFields.value = arr;
    };
    const onFieldDragEnd = () => { fieldDrag.value = null; fieldDragOver.value = null; };

    // ---- Group header reorder (in config panel) ----
    const onConfigGroupDragStart = (value) => { configGroupDrag.value = value; };
    const onConfigGroupDragOver = (value) => { if (configGroupDrag.value && configGroupDrag.value !== value) configGroupDragOver.value = value; };
    const onConfigGroupDrop = (target) => {
      const src = configGroupDrag.value;
      configGroupDrag.value = null;
      configGroupDragOver.value = null;
      if (!src || src === target) return;
      const order = groups.value.map(g => g.value);
      const fromIdx = order.indexOf(src);
      const toIdx = order.indexOf(target);
      if (fromIdx < 0 || toIdx < 0) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, src);
      groupOrder.value = order;
    };
    const onConfigGroupDragEnd = () => { configGroupDrag.value = null; configGroupDragOver.value = null; };

    // ---- Group reorder via column header drag (board) ----
    const onGroupDragStart = (value, evt) => {
      if (cardDragRowId.value) return; // a card is being dragged — ignore
      groupHeaderDrag.value = value;
      try { evt?.dataTransfer?.setData('text/plain', `group:${value}`); } catch (_) { /* noop */ }
    };
    const onGroupHeaderDragOver = (value, evt) => {
      if (!groupHeaderDrag.value || groupHeaderDrag.value === value) return;
      groupHeaderDragOver.value = value;
    };
    const onGroupHeaderDrop = (target, evt) => {
      const src = groupHeaderDrag.value;
      groupHeaderDrag.value = null;
      groupHeaderDragOver.value = null;
      if (!src || src === target) return;
      const order = groups.value.map(g => g.value);
      const fromIdx = order.indexOf(src);
      const toIdx = order.indexOf(target);
      if (fromIdx < 0 || toIdx < 0) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, src);
      groupOrder.value = order;
    };
    const onGroupDragEnd = () => { groupHeaderDrag.value = null; groupHeaderDragOver.value = null; };

    // ---- Card click + card drag ----
    const onCardClick = (row) => {
      if (cardDragRowId.value) return; // suppress click after drag
      const id = getRowId(row);
      ctx.emit('trigger-event', {
        name: 'rowClicked',
        event: { row, id, index: 0, displayIndex: 0 },
      });
    };

    const onCardDragStart = (row, fromGroup, evt) => {
      const id = getRowId(row);
      if (!id) return;
      cardDragRowId.value = id;
      cardDragSource.value = row;
      dragSourceGroup.value = fromGroup;
      try {
        evt?.dataTransfer?.setData('text/plain', `card:${id}`);
        evt.dataTransfer.effectAllowed = 'move';
      } catch (_) { /* noop */ }
    };
    const onCardDragEnd = () => {
      cardDragRowId.value = null;
      cardDragSource.value = null;
      dragSourceGroup.value = null;
      dragOverGroup.value = null;
    };

    const onColumnDragOver = (groupValue, evt) => {
      if (!cardDragRowId.value) return;
      try { evt.dataTransfer.dropEffect = 'move'; } catch (_) { /* noop */ }
      dragOverGroup.value = groupValue;
    };
    const onColumnDragLeave = (groupValue) => {
      if (dragOverGroup.value === groupValue) dragOverGroup.value = null;
    };
    const onColumnDrop = async (toGroup) => {
      const rowId = cardDragRowId.value;
      const row = cardDragSource.value;
      const fromGroup = dragSourceGroup.value;
      // Reset drag state up front so a click can't fire on the just-dropped card.
      cardDragRowId.value = null;
      cardDragSource.value = null;
      dragSourceGroup.value = null;
      dragOverGroup.value = null;
      if (!rowId || !row || !groupBy.value) return;
      if (fromGroup === toGroup) return;
      await moveCardToGroup(row, rowId, fromGroup, toGroup);
    };

    // ---- The actual move: optimistic local + supabase + events ----
    const moveCardToGroup = async (row, rowId, fromGroup, toGroup) => {
      const columnId = groupBy.value;
      const oldValue = row?.[columnId] ?? null;
      const newValue = toGroup === UNASSIGNED_GROUP ? null : toGroup;

      // Optimistic local update
      try { row[columnId] = newValue; } catch (_) { /* noop */ }

      // Supabase write — skipped (null) when no writable target is configured;
      // failed (false) means revert and bail.
      if (cfg.value?.dataSource === 'supabase') {
        const result = await updateRowInSupabase(rowId, columnId, newValue);
        if (result === false) {
          try { row[columnId] = oldValue; } catch (_) { /* noop */ }
          console.warn('[Kanban] Supabase update failed — reverting card move.');
          return;
        }
        // result === null: no direct write, but events still fire so the user's
        // workflow can perform the update against the underlying table.
        // result === true: optimistic write matches the server.
      }

      // Events: cardMoved (kanban-specific) + cellValueChanged (parity with datagrid)
      ctx.emit('trigger-event', {
        name: 'cardMoved',
        event: {
          row,
          id: rowId,
          columnId,
          oldValue,
          newValue,
          oldGroup: fromGroup === UNASSIGNED_GROUP ? null : fromGroup,
          newGroup: toGroup === UNASSIGNED_GROUP ? null : toGroup,
        },
      });
      ctx.emit('trigger-event', {
        name: 'cellValueChanged',
        event: { oldValue, newValue, columnId, row, isDirectUpdate: false },
      });
    };

    // Returns:
    //   true  — UPDATE succeeded
    //   false — UPDATE was attempted but failed (caller should revert)
    //   null  — UPDATE was skipped intentionally (no writable target configured).
    //           Caller should NOT revert; the optimistic local write stays and
    //           the cardMoved / cellValueChanged events still fire so the user's
    //           workflow can do the write.
    const updateRowInSupabase = async (rowId, columnId, newValue) => {
      // Prefer supabaseUpdateTable (when supabaseTable is a view) over
      // supabaseTable itself. If neither is set we cannot write.
      const updateTable = (cfg.value?.supabaseUpdateTable || '').trim();
      const queryTable = (cfg.value?.supabaseTable || '').trim();
      const tableName = updateTable || queryTable;
      if (!tableName) {
        console.warn('[Kanban] No writable target — set "Supabase Update Table" if "Supabase Table" is a view, or rely on the cardMoved event.');
        return null;
      }
      const supabase = wwLib?.wwPlugins?.supabase?.instance;
      if (!supabase) {
        console.warn('[Kanban] Supabase plugin not available.');
        return false;
      }
      const idFieldName = (cfg.value?.supabaseIdField || 'id').trim() || 'id';
      try {
        const { error } = await supabase
          .from(tableName)
          .update({ [columnId]: newValue })
          .eq(idFieldName, rowId);
        if (error) {
          // Postgres view-not-updatable error codes / messages — fall back to
          // event-only behavior so the user's workflow can do the write against
          // the right table.
          const msg = String(error.message || error).toLowerCase();
          const looksLikeViewError =
            msg.includes('cannot update') ||
            msg.includes('not updatable') ||
            msg.includes('updatable') ||
            error.code === '0A000' || // feature_not_supported
            error.code === '42809';   // wrong_object_type
          if (looksLikeViewError && !updateTable) {
            console.warn(
              `[Kanban] UPDATE on "${tableName}" failed because it appears to be a non-updatable view. ` +
              `Set the "Supabase Update Table" option to the underlying table, or handle the cardMoved event in a workflow.`
            );
            return null;
          }
          console.warn('[Kanban] Supabase update error:', error.message || error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[Kanban] Supabase update threw:', e?.message || e);
        return false;
      }
    };

    // ---- Config visibility: driven by the same external WeWeb variable as the
    // datagrid's column chooser (cfg.columnChooserVariableId). Bidirectional —
    // the variable opens/closes the panel, and click-outside writes false back.
    const onDocumentClick = (evt) => {
      if (!showConfig.value) return;
      const panel = configPanelRef.value;
      if (panel && panel.contains(evt.target)) return;
      showConfig.value = false;
    };
    let clickOutsideTimer = null;
    watch(showConfig, (val) => {
      if (val) {
        if (clickOutsideTimer) clearTimeout(clickOutsideTimer);
        clickOutsideTimer = setTimeout(() => {
          clickOutsideTimer = null;
          wwLib.getFrontDocument().addEventListener('click', onDocumentClick);
        }, 0);
      } else {
        if (clickOutsideTimer) { clearTimeout(clickOutsideTimer); clickOutsideTimer = null; }
        wwLib.getFrontDocument().removeEventListener('click', onDocumentClick);
        fieldSearch.value = '';
      }
      // Push state back to the external variable.
      const varId = cfg.value?.columnChooserVariableId;
      if (varId) {
        try { wwLib.wwVariable.updateValue(varId, val); } catch (_) { /* noop */ }
      }
    });
    // External variable → showConfig
    watch(
      () => {
        const varId = cfg.value?.columnChooserVariableId;
        if (!varId) return undefined;
        try { return wwLib.wwVariable.getValue(varId); }
        catch (_) { return undefined; }
      },
      (newVal) => {
        if (newVal === undefined) return;
        const boolVal = !!newVal;
        if (showConfig.value !== boolVal) showConfig.value = boolVal;
      },
      { immediate: true }
    );
    onBeforeUnmount(() => {
      console.log('[viewEdited][kanban] UNMOUNTING');
      if (clickOutsideTimer) clearTimeout(clickOutsideTimer);
      try { wwLib.getFrontDocument().removeEventListener('click', onDocumentClick); } catch (_) { /* noop */ }
    });

    return {
      // refs
      rootRef, boardRef, configPanelRef,
      // state
      cfg, cssVars, t, fieldsCounterText, maxFieldsTooltip,
      groupBy, cardFields, showUnassigned,
      showConfig, activeTab, fieldSearch,
      configGroupDrag, configGroupDragOver,
      fieldDrag, fieldDragOver,
      cardDragRowId, dragSourceGroup, dragOverGroup,
      MAX_CARD_FIELDS,
      // computed
      selectColumns, availableFields, filteredFieldList, groups, groupedRows,
      openGroups, visibleCards, cardIndexMap,
      // methods
      resolveMappingFormula,
      findColumn, getRowId,
      setGroupBy, setShowUnassigned, toggleCardField, toggleGroupVisibility, isFieldDisabled,
      onFieldDragStart, onFieldDragOver, onFieldDrop, onFieldDragEnd,
      onConfigGroupDragStart, onConfigGroupDragOver, onConfigGroupDrop, onConfigGroupDragEnd,
      onGroupDragStart, onGroupHeaderDragOver, onGroupHeaderDrop, onGroupDragEnd,
      onCardClick, onCardDragStart, onCardDragEnd,
      onColumnDragOver, onColumnDragLeave, onColumnDrop,
    };
  },
};
</script>

<style scoped lang="scss">
.ww-kanban {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: var(--ag-background-color, #ffffff);
  color: var(--ag-foreground-color, #1f2937);
  font-family: 'Work Sans', sans-serif;
}

/* ===================== Empty state ===================== */
.kanban-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
}
.kanban-empty__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ag-foreground-color, #1f2937);
}
.kanban-empty__subtitle {
  font-size: 13px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
  max-width: 380px;
  line-height: 1.4;
}

/* ===================== Board / columns ===================== */
.kanban-board {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}
.kanban-board__empty {
  margin: auto;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
  font-size: 13px;
}

/* Open columns row */
.kanban-columns {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 0;
}

.kanban-column {
  --group-color: #9ca3af;
  display: flex;
  flex-direction: column;
  flex: 0 0 280px;
  width: 280px;
  max-height: 100%;
  background: color-mix(in srgb, var(--group-color) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--group-color) 22%, transparent);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}
.kanban-column--drag-over {
  border-color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 14%, transparent);
}
.kanban-column--drag-source { opacity: 0.85; }

.kanban-column__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--group-color) 14%, transparent);
  border-left: 4px solid var(--group-color);
  cursor: grab;
  user-select: none;

  &:active { cursor: grabbing; }
}
.kanban-column__chevron {
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
  transition: transform 0.15s;
  flex-shrink: 0;

  &:hover { background: color-mix(in srgb, var(--group-color) 20%, transparent); }
  &.kanban-column__chevron--open { transform: rotate(90deg); }
}
.kanban-column__label {
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
  color: color-mix(in srgb, var(--group-color) 80%, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.kanban-column__count {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--group-color) 22%, transparent);
  color: color-mix(in srgb, var(--group-color) 80%, #111827);
  flex-shrink: 0;
}

.kanban-column__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  overflow-y: auto;
  min-height: 60px;
}

.kanban-column__empty {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 50%, transparent);
  border: 1px dashed color-mix(in srgb, var(--group-color) 30%, transparent);
  border-radius: 6px;
  padding: 16px 10px;
  min-height: 60px;
}

/* ===================== Card ===================== */
.kanban-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  /* Reserve space on the right of the first row so the dropzone can sit there
     without overlapping the title field. */
  padding-right: 44px;
  background: var(--ag-background-color, #ffffff);
  border: 1px solid var(--ag-border-color, rgba(0,0,0,0.08));
  border-radius: 6px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s, transform 0.05s, border-color 0.15s;

  &:hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    border-color: color-mix(in srgb, var(--group-color) 40%, var(--ag-border-color, rgba(0,0,0,0.1)));
  }

  &:active { cursor: grabbing; }
}
.kanban-card--dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.kanban-card__dropzone {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: default;
  /* Keep the dropzone compact — anything dropped in flows in a row */
  max-width: 60%;
}
.kanban-card__dropzone :deep(*) {
  /* Children keep their own cursor; the card's grab cursor doesn't bleed in. */
  cursor: auto;
}

/* ===================== Config panel (mirrors .cc-panel) ===================== */
.kanban-config-anchor {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
}
.kanban-cc-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: var(--ww-data-grid_cc-width, 300px);
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.08));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.06));
}
.cc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ww-data-grid_cc-text-color, #1f2937);
}
.cc-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 60%, transparent);

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 8%, transparent);
    color: var(--ww-data-grid_cc-text-color, #1f2937);
  }
}

.cc-tabs {
  display: flex;
  padding: 0 8px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.06));
}
.cc-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 60%, transparent);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  border-radius: 4px 4px 0 0;

  &:hover:not(.cc-tab--active) {
    color: var(--ww-data-grid_cc-text-color, #1f2937);
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 6%, transparent);
  }
  &.cc-tab--active {
    color: var(--ww-data-grid_cc-text-color, #1f2937);
    border-bottom-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
    font-weight: 600;
  }
}

.cc-group-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.06));
}
.cc-group-select-label {
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 65%, transparent);
}
.cc-group-select {
  flex: 1 1 auto;
  appearance: none;
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.1));
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
  }
}

.cc-group-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
.cc-group-toggle-label {
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, #1f2937);
}

.cc-group-list-label {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 55%, transparent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cc-group-list,
.cc-list {
  display: flex;
  flex-direction: column;
  padding: 4px 8px 10px;
  max-height: 320px;
  overflow-y: auto;
}
.cc-group-row,
.cc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
  transition: background 0.1s;

  &:hover { background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 5%, transparent); }
  &:active { cursor: grabbing; }
}
.cc-group-row--dragging,
.cc-row--dragging { opacity: 0.4; }
.cc-group-row--drag-over,
.cc-row--drag-over {
  background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 12%, transparent);
  border: 1px dashed var(--ww-data-grid_cc-accent-color, #3b82f6);
  padding: 5px 7px;
}
.cc-group-row__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.cc-group-row__label {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-group-row__count {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 8%, transparent);
}
.cc-group-row--hidden .cc-group-row__label,
.cc-group-row--hidden .cc-group-row__count {
  opacity: 0.55;
}
.cc-group-visibility {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 60%, transparent);
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 8%, transparent);
    color: var(--ww-data-grid_cc-text-color, #1f2937);
  }
}
.cc-group-visibility--hidden { opacity: 0.7; }

.cc-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.06));
}
.cc-search-box {
  position: relative;
  flex: 1 1 auto;
}
.cc-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 50%, transparent);
}
.cc-search-input {
  width: 100%;
  padding: 5px 8px 5px 28px;
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.1));
  border-radius: 4px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, #1f2937);

  &:focus {
    outline: none;
    border-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
  }
}

.cc-fields-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  font-size: 11px;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 60%, transparent);
}
.cc-fields-meta__hint {
  font-style: italic;
}

.cc-checkbox-wrap {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.cc-checkbox-wrap--locked { cursor: not-allowed; opacity: 0.5; }
.cc-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
}

.cc-drag-handle {
  display: inline-flex;
  align-items: center;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 35%, transparent);
}
.cc-drag-handle--disabled { opacity: 0.25; }

.cc-col-name {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}
.cc-field-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: #ffffff;
}

.cc-empty {
  padding: 16px 14px;
  font-size: 12px;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 55%, transparent);
  text-align: center;
}

/* Transition */
.cc-fade-enter-active, .cc-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.cc-fade-enter-from, .cc-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
