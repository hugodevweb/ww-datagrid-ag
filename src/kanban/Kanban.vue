<template>
  <div class="ww-kanban" :class="{ 'is-compact': isCompactWidth, 'is-mobile': isMobileWidth }" :style="cssVars" ref="rootRef">
    <!-- Empty state -->
    <div v-if="!groupBy" class="kanban-empty">
      <div class="kanban-empty__title">{{ t.kanbanEmptyTitle }}</div>
      <div class="kanban-empty__subtitle">{{ t.kanbanEmptySubtitle }}</div>
    </div>

    <!-- Kanban board -->
    <div v-else class="kanban-board" ref="boardRef">
      <!-- Mobile: lane switcher. On narrow widths the board shows one full-width
           lane at a time (scroll-snap); these pills jump between groups and stay
           in sync as the user swipes. -->
      <div v-if="isMobileWidth && openGroups.length > 1" class="kanban-lane-tabs">
        <button
          v-for="(group, i) in openGroups"
          :key="group.value"
          type="button"
          class="kanban-lane-tab"
          :class="{ 'kanban-lane-tab--active': i === activeLaneIndex }"
          :style="{ '--group-color': group.color }"
          @click="goToLane(i)"
        >
          <span class="kanban-lane-tab__label">{{ group.label }}</span>
          <span class="kanban-lane-tab__count">{{ group.count }}</span>
        </button>
      </div>

      <!-- Open groups: horizontal kanban columns. Collapsed groups don't render
           here — they can be re-shown from the config panel's groups list. -->
      <div class="kanban-columns" ref="columnsRef" @scroll.passive="onLanesScroll">
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
          <!-- Header. The sticky positioning lives on the OUTER wrapper so it
               can have an opaque page-bg fill behind the inner rounded
               header. That fill covers cards scrolling underneath (which
               z-index/pseudo-element tricks can't, because negative-z-index
               children paint above the parent's bg, not behind it). -->
          <div class="kanban-column__header-stick">
            <div
              class="kanban-column__header"
              :draggable="!cardDragRowId"
              @dragstart="onGroupDragStart(group.value, $event)"
              @dragover.prevent="onGroupHeaderDragOver(group.value, $event)"
              @drop.prevent="onGroupHeaderDrop(group.value, $event)"
              @dragend="onGroupDragEnd"
            >
              <span class="kanban-column__label">{{ group.label }}</span>
              <span class="kanban-column__count">{{ group.count }}</span>
            </div>
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
              <!-- Top-right navigation buttons (detail + chat with unread badge).
                   The renderer itself stops mousedown/click/contextmenu bubbling
                   so card-click/selection don't fire; the wrapper additionally
                   stops dragstart so the buttons don't initiate a card drag. -->
              <NavigationButtons
                class="kanban-card__nav"
                :row-id="getRowId(row)"
                :focus-row-id="navigationFocusRowId"
                :tab-value="navigationTabValue"
                :message-count="getMessageCount(row)"
                :on-navigate="emitNavigate"
              />

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
            <button
              v-if="cfg.enableFilterBuilder"
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'filters' }"
              role="tab"
              :aria-selected="activeTab === 'filters'"
              @click="activeTab = 'filters'"
            >{{ t.filtersTab || 'Filters' }}</button>
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

          <!-- Filters tab (Filter Builder) -->
          <template v-else-if="activeTab === 'filters'">
            <FilterBuilder
              :columns="filterBuilderColumns"
              :model-value="normalizedAdvancedFilters"
              :data-source="cfg.dataSource"
              @update:model-value="setAdvancedFilters"
            />
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import KanbanField from './components/KanbanField.vue';
import NavigationButtons from './components/NavigationButtons.vue';
import FilterBuilder from '../shared/components/FilterBuilder.vue';
import { getTranslations, readViewConfiguration } from '../shared/utils/sharedHelpers.js';
import { getVarByName } from '../shared/utils/wwVariables.js';
import { fetchSupabaseDataInfinite } from '../shared/utils/supabaseUtils.js';
import { convertConditionsToSupabase } from '../shared/utils/convertConditionsToSupabase.js';
import { useAdvancedFilters } from '../shared/composables/useAdvancedFilters.js';
import { useRecordsVariable } from '../shared/composables/useRecordsVariable.js';
import { useResponsive } from '../shared/composables/useResponsive.js';

const UNASSIGNED_GROUP = '__unassigned__';
const MAX_CARD_FIELDS = 5;

export default {
  name: 'Kanban',
  components: { KanbanField, NavigationButtons, FilterBuilder },
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  setup(props, ctx) {
    console.log("[Navigation] Kanban setup() running");
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    // Merged config (matches Datagrid.vue: baseConfig keys override per-instance content).
    const cfg = computed(() => {
      // viewConfiguration is no longer a bindable prop — it is read directly from
      // a hardcoded WeWeb variable and always overrides any content/baseConfig value.
      const viewConfiguration = readViewConfiguration();
      const content = props.content;
      if (!content || typeof content !== 'object') return { ...(content ?? {}), viewConfiguration };
      const base = content.baseConfig;
      const excludes = content.baseConfigExcludes;
      if (!base || typeof base !== 'object') return { ...content, viewConfiguration };
      const excludeSet = new Set(Array.isArray(excludes) ? excludes : []);
      excludeSet.add('baseConfig');
      excludeSet.add('baseConfigExcludes');
      const merged = { ...content };
      for (const key of Object.keys(base)) {
        if (!excludeSet.has(key)) merged[key] = base[key];
      }
      merged.viewConfiguration = viewConfiguration;
      return merged;
    });

    // Reactive translations — recomputes whenever cfg.lang changes.
    const t = computed(() => getTranslations(cfg.value?.lang || 'en'));

    // Navigation buttons context — same shape as createNavigationColumnDef in
    // the datagrid view, but reactive Vue props replace AG Grid's refreshCells
    // plumbing. Per-row messageCount stays as a function call from the template.
    // The focus-row source is the grid's existing `focusedRowId` config; the
    // tab formula and workflow id are hardcoded.
    const NAVIGATION_TAB_FORMULA = {
      type: "f",
      // Inlined from the former global formula (id ec0f4ece…, whose name is
      // stripped at runtime so formulas['name']() can't be used). References the
      // `recordTab` app variable BY NAME so it survives project duplication.
      code: "wwFormulas.getKeyValue(variables['recordTab'],globalContext.page?.['id'])||0",
    };
    const navigationFocusRowId = computed(() => cfg.value?.focusedRowId);
    const navigationTabValue = computed(() =>
      Number(resolveMappingFormula(NAVIGATION_TAB_FORMULA) ?? 0)
    );

    watch(
      [navigationTabValue, navigationFocusRowId],
      ([tab, focusRowId]) => {
        console.log("[Navigation]", { tab, focusRowId });
      },
      { immediate: true }
    );
    // Emit the navigate trigger event; wire it to "open record" in the editor.
    const emitNavigate = (payload) =>
      ctx.emit('trigger-event', { name: 'navigate', event: payload });
    // App variable (array of the focused record's chat messages) read by name.
    // Reading it inside this computed keeps the count reactive (the reactive bag
    // auto-unwraps the variable's computed ref — see wwVariables.js), so the
    // focused card's badge updates in realtime as messages arrive.
    const RECORD_MESSAGES_VARIABLE_NAME = 'recordMessages';
    const recordMessagesCount = computed(() => {
      const v = getVarByName(RECORD_MESSAGES_VARIABLE_NAME);
      return Array.isArray(v) ? v.length : 0;
    });
    const getMessageCount = (row) => {
      // The focused record's badge reflects the live `recordMessages` count;
      // every other card keeps its per-row formula/fallback count.
      const focusRowId = navigationFocusRowId.value;
      const rowId = getRowId(row);
      if (
        focusRowId != null && focusRowId !== '' &&
        rowId != null &&
        String(focusRowId) === String(rowId)
      ) {
        return recordMessagesCount.value;
      }
      const formula = cfg.value?.navigationMessageCountFormula;
      if (formula) {
        const v = resolveMappingFormula(formula, row);
        if (v != null && v !== '') return Number(v) || 0;
      }
      return row?.conversation?.messages?.length ?? 0;
    };

    // Filter Builder state (shared `advancedFilters` component variable).
    const {
      normalizedAdvancedFilters,
      setAdvancedFilters,
    } = useAdvancedFilters(props, { getDefault: () => cfg.value?.defaultAdvancedFilters });
    const filterBuilderColumns = computed(() => cfg.value?.columns || []);

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
      // Filter Builder accent — driven by the cell Selection Border Color.
      '--ww-data-grid_filter-accent-color': cfg.value?.cellSelectionBorderColor || cfg.value?.columnChooserAccentColor || '#2563eb',
      '--ww-data-grid_cc-border-radius': cfg.value?.columnChooserBorderRadius || '8px',
      // Navigation button color tokens — mirrors the cascade in
      // useColumnState.js so ww-config color customizations apply in the
      // kanban view too (the buttons are rendered by NavigationCellRenderer
      // here just like in the datagrid).
      '--ww-data-grid_navigation-bg': cfg.value?.navigationButtonBackground ?? 'transparent',
      '--ww-data-grid_navigation-hoverBg': cfg.value?.navigationButtonHoverBackground ?? 'rgba(0,0,0,0.04)',
      '--ww-data-grid_navigation-focusBg': cfg.value?.navigationButtonFocusBackground ?? 'rgba(0,0,0,0.08)',
      '--ww-data-grid_navigation-iconColor': cfg.value?.navigationIconColor ?? 'currentColor',
      '--ww-data-grid_navigation-borderColor':
        cfg.value?.navigationBorderColor || cfg.value?.borderColor || '#e5e7eb',
      '--ww-data-grid_navigation-focusBorderColor':
        cfg.value?.navigationFocusBorderColor ||
        cfg.value?.navigationBorderColor ||
        cfg.value?.borderColor ||
        '#e5e7eb',
      '--ww-data-grid_navigation-chatActiveBg':
        cfg.value?.navigationChatActiveBackground ?? 'rgba(59,130,246,0.12)',
      '--ww-data-grid_navigation-badgeBg': cfg.value?.navigationBadgeBackground ?? '#ef4444',
      '--ww-data-grid_navigation-badgeColor': cfg.value?.navigationBadgeTextColor ?? '#ffffff',
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

    // Component-width based responsive state. On mobile the board switches from
    // side-by-side lanes to one full-width lane at a time (scroll-snap) with a
    // pill switcher to jump between groups — see goToLane / onLanesScroll below.
    const { isCompact: isCompactWidth, isMobile: isMobileWidth } = useResponsive(rootRef);
    const columnsRef = ref(null);
    const activeLaneIndex = ref(0);

    // Scroll the lane at `index` so its left edge aligns with the board's left
    // (works regardless of offsetParent by diffing bounding rects).
    const goToLane = (index) => {
      const el = columnsRef.value;
      if (!el) return;
      const cols = el.querySelectorAll('.kanban-column');
      const col = cols[index];
      if (!col) return;
      const delta = col.getBoundingClientRect().left - el.getBoundingClientRect().left;
      el.scrollTo({ left: el.scrollLeft + delta, behavior: 'smooth' });
    };

    // Keep the active pill in sync as the user swipes: pick the lane whose left
    // edge is nearest the board's left edge.
    const onLanesScroll = () => {
      const el = columnsRef.value;
      if (!el) return;
      const contLeft = el.getBoundingClientRect().left;
      let best = 0, bestDist = Infinity;
      el.querySelectorAll('.kanban-column').forEach((c, i) => {
        const d = Math.abs(c.getBoundingClientRect().left - contLeft);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      activeLaneIndex.value = best;
    };

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
      // Restore advanced (Filter Builder) filters when present in the view config.
      // Only when the key exists, so an absent key keeps the seeded defaults.
      const vc = cfg.value?.viewConfiguration;
      if (vc && typeof vc === 'object' && 'advancedFilters' in vc) {
        const adv = vc.advancedFilters;
        setAdvancedFilters({
          combinator: adv?.combinator === 'or' ? 'or' : 'and',
          conditions: Array.isArray(adv?.conditions) ? adv.conditions : [],
        });
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

    // Normalize an advanced-filters object for comparison/persistence.
    const normAdvanced = (v) => {
      const conditions = Array.isArray(v?.conditions) ? v.conditions : [];
      return { combinator: conditions.length ? (v?.combinator === 'or' ? 'or' : 'and') : 'and', conditions };
    };

    const writeCurrentConfig = () => {
      const hiddenGroupsArr = [...hiddenGroups.value];
      const advanced = normAdvanced(normalizedAdvancedFilters.value);
      const config = {
        kanban: {
          groupBy: groupBy.value,
          cardFields: [...cardFields.value],
          order: [...groupOrder.value],
          showUnassigned: showUnassigned.value !== false,
          hiddenGroups: hiddenGroupsArr,
        },
        advancedFilters: advanced,
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
      const baseAdvanced = normAdvanced(cfg.value?.viewConfiguration?.advancedFilters);
      const advancedEdited =
        baseAdvanced.combinator !== advanced.combinator ||
        JSON.stringify(baseAdvanced.conditions) !== JSON.stringify(advanced.conditions);
      const edited =
        (baseline.groupBy ?? null) !== (groupBy.value ?? null) ||
        !arraysEqual(baseline.cardFields || [], cardFields.value) ||
        !arraysEqual(baseline.order || [], groupOrder.value) ||
        ((baseline.showUnassigned !== false) !== (showUnassigned.value !== false)) ||
        !arraysEqual(baselineHidden, currentHidden) ||
        advancedEdited;
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
    watch([groupBy, cardFields, groupOrder, showUnassigned, hiddenGroups, normalizedAdvancedFilters], () => writeCurrentConfig(), { deep: true });

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
          advancedFilters: normalizedAdvancedFilters.value,
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
          convertConditionsToSupabase,
          content: props.content,
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
      () => [cfg.value?.dataSource, cfg.value?.supabaseTable, cfg.value?.supabaseQuery, cfg.value?.supabaseFilters, cfg.value?.kanbanMaxRows, normalizedAdvancedFilters.value],
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

    // Expose `records` / `isFetching` component variables (same names as the
    // datagrid) so bindings keep working when the kanban is the active view.
    useRecordsVariable(props, { rows: allRows, isFetching: supabaseFetching });

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
      rootRef, boardRef, configPanelRef, columnsRef,
      // responsive / mobile lane switcher
      isCompactWidth, isMobileWidth, activeLaneIndex, goToLane, onLanesScroll,
      // Filter Builder
      normalizedAdvancedFilters, setAdvancedFilters, filterBuilderColumns,
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
      openGroups,
      navigationFocusRowId, navigationTabValue, emitNavigate,
      // methods
      resolveMappingFormula,
      findColumn, getRowId, getMessageCount,
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
  // Establish a single, self-contained stacking context for the whole board.
  // Without this, the sticky column headers (z-index: 5), the card nav button
  // (z-index: 2) and the config anchor (z-index: 10) resolve their z-index
  // against the PAGE root, so they paint on top of external WeWeb popups/
  // modals. `isolation: isolate` traps every internal z-index inside the
  // kanban — they still layer correctly relative to each other, but the board
  // as a whole now sits at a single `z-index: auto` slot that any real popup
  // (which renders later / higher in the page) cleanly covers.
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0; // let a flex-parent (WeWeb wrapper) constrain the kanban; was 300px which forced overflow on shorter wrappers
  box-sizing: border-box;
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
  // Horizontal padding lives on .kanban-columns so the horizontal scrollbar
  // (which sits at the bottom of .kanban-columns) spans the full component
  // width. Vertical padding lives here so the sticky column headers can pin
  // flush against the scroll viewport top with no gap above them.
  padding: 12px 0 0 0;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}
.kanban-board__empty {
  margin: auto;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
  font-size: 13px;
}

/* Open columns row. CSS Grid (instead of flexbox) so all columns
   automatically take the height of the tallest column — flex's
   `align-items: stretch` only stretches up to the container's cross-size,
   it can't make every item match the tallest sibling. */
.kanban-columns {
  flex: 1 1 auto;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 280px;
  align-items: stretch;
  gap: 12px;
  padding: 0 0 0 12px;
  overflow-x: auto;
  overflow-y: auto;
  min-height: 0;

  // Match datagrid horizontal scrollbar so position + look are consistent
  // across all view types.
  scrollbar-width: auto;
  scrollbar-color: #888 #f1f1f1;

  &::-webkit-scrollbar {
    height: 14px;
    width: 14px;
    -webkit-appearance: none;
    appearance: none;
  }
  &::-webkit-scrollbar-button,
  &::-webkit-scrollbar-button:single-button,
  &::-webkit-scrollbar-button:start:decrement,
  &::-webkit-scrollbar-button:end:increment,
  &::-webkit-scrollbar-button:horizontal:start:decrement,
  &::-webkit-scrollbar-button:horizontal:end:increment {
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

/* ===================== Mobile: swipe between lanes ===================== */
// On narrow widths the side-by-side lanes become one full-width lane at a time
// with horizontal scroll-snap; the pill switcher (.kanban-lane-tabs) jumps
// between groups and stays in sync as the user swipes (see onLanesScroll).
.kanban-lane-tabs {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
  padding: 0 12px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}
.kanban-lane-tab {
  --group-color: #9ca3af;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.12));
  background: var(--ag-background-color, #ffffff);
  color: var(--ag-foreground-color, #1f2937);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--group-color);
    flex: 0 0 auto;
  }
}
.kanban-lane-tab__count {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.65;
}
.kanban-lane-tab--active {
  border-color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 14%, var(--ag-background-color, #ffffff));
}

.ww-kanban.is-mobile {
  // One full-width lane per view; swipe (scroll-snap) moves between lanes.
  .kanban-columns {
    grid-auto-columns: 100%;
    gap: 0;
    padding: 0;
    scroll-snap-type: x mandatory;
    // The pill switcher is the primary lane navigation, so reclaim the
    // scrollbar's vertical space; swipe still scrolls.
    &::-webkit-scrollbar { height: 0; }
  }
  .kanban-column {
    scroll-snap-align: start;
    // Inner breathing room now that the lane spans the full component width.
    padding: 0 12px;
    box-sizing: border-box;
  }
}

// Column is a transparent flex wrapper. The visual outline + bg used to live
// on this element, but with a sticky rounded header, any column-level border
// extends the full column height — which means it stays visible as a 1px
// strip alongside the sticky header. So the wrapper and body each carry
// their own borders/bg now (continuous shape via half-rounded corners).
.kanban-column {
  --group-color: #9ca3af;
  display: flex;
  flex-direction: column;
  // Width is set by .kanban-columns' `grid-auto-columns: 280px`. Height comes
  // from the grid row, which equals the tallest column's intrinsic height —
  // so all columns end up the same height as the one with the most cards.
}
.kanban-column--drag-source { opacity: 0.85; }

// Sticky wrapper. Provides the opaque rectangular fill that covers cards
// scrolling underneath. Its bg matches the page bg (--ag-background-color),
// so where it extends past the inner header's rounded corners it blends
// invisibly with the page — i.e. you only ever see the rounded inner header
// and the page color in its corner cutouts, never the column's tinted body.
// Sticky wrapper. RECTANGULAR (no border-radius, no border) so it has no
// cutouts of its own to leak through. Its bg matches the page bg so where
// it covers the area outside the inner header's rounded shape, it blends
// invisibly with the page — the inner header looks like a rounded "tab"
// floating on the page. Opaque, so cards and the body's borders scrolling
// underneath are completely hidden.
.kanban-column__header-stick {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--ag-background-color, #ffffff);
}

.kanban-column__header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 16px;
  background-color: var(--ag-background-color, #ffffff);
  background-image: linear-gradient(
    color-mix(in srgb, var(--group-color) 14%, transparent),
    color-mix(in srgb, var(--group-color) 14%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--group-color) 22%, transparent);
  border-bottom: 0;
  // Rounded top corners only; the square bottom sits flush with the body
  // below so the two together form one continuous rounded shape.
  border-radius: 8px 8px 0 0;
  cursor: grab;
  user-select: none;

  &:active { cursor: grabbing; }

  // Colored left tag — replaces the previous `border-left`. Painted as a
  // positioned descendant so it sits on top of the header's bg.
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
    background: var(--group-color);
    border-top-left-radius: 7px;
  }
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
  // shrink: 0 — without this the body shrinks to fit the column's stretched
  // height and cards overflow out the rounded bottom. shrink: 0 keeps the
  // body at its content height; the column grows to match and .kanban-columns
  // gets the vertical scrollbar.
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  min-height: 60px;
  background: color-mix(in srgb, var(--group-color) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--group-color) 22%, transparent);
  border-top: 0;
  border-radius: 0 0 8px 8px;
  transition: border-color 0.15s, background 0.15s;
}

.kanban-column--drag-over .kanban-column__body {
  border-color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 14%, transparent);
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

.kanban-card__nav {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  cursor: default;
}
.kanban-card__nav :deep(*) {
  cursor: auto;
}

/* ===================== Config panel (mirrors .cc-panel) ===================== */
.kanban-config-anchor {
  position: absolute;
  inset: 0;
  z-index: 10;
  // Span the whole wrapper for sizing; clicks fall through except on the panel.
  pointer-events: none;
}
// Mobile: config panel fills the component as a sheet.
.ww-kanban.is-mobile .kanban-cc-panel {
  top: 8px;
  right: 8px;
  left: 8px;
  width: auto;
  max-width: none;
  max-height: calc(100% - 16px);
}
.kanban-cc-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  pointer-events: auto;
  width: 760px;
  max-width: calc(100% - 24px);
  box-sizing: border-box;
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.08));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  // Stay inside the wrapper with a 12px gap at the bottom (12px top + 12px).
  max-height: calc(100% - 24px);
  overflow-y: auto;
  overflow-x: hidden;
  font-family: 'Work Sans', sans-serif;

  // Apply Work Sans to all descendants, including form controls (inputs /
  // selects / textareas) which don't inherit font-family by default.
  *, *::before, *::after {
    font-family: 'Work Sans', sans-serif;
  }
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
  flex-shrink: 0;
  cursor: pointer;
}
.cc-checkbox-wrap--locked { cursor: not-allowed; opacity: 0.5; }
/* Custom checkbox — matches the grid's column chooser. */
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
