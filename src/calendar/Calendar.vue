<template>
  <div class="ww-calendar" :style="cssVars" ref="rootRef">
    <!-- Empty state when no date field is configured -->
    <div v-if="!dateField" class="cal-empty">
      <div class="cal-empty__title">{{ t.calEmptyTitle }}</div>
      <div class="cal-empty__subtitle">{{ t.calEmptySubtitle }}</div>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="cal-toolbar">
        <div class="cal-toolbar__nav">
          <button class="cal-btn cal-btn--icon" @click="goPrev" :aria-label="t.calPrev" :title="t.calPrev">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="cal-btn cal-btn--today" @click="goToday">{{ t.calToday }}</button>
          <button class="cal-btn cal-btn--icon" @click="goNext" :aria-label="t.calNext" :title="t.calNext">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <span class="cal-toolbar__label">{{ rangeLabel }}</span>
        </div>
        <div class="cal-toolbar__periods" role="tablist">
          <button
            v-for="p in periodOptions"
            :key="p.value"
            type="button"
            class="cal-btn cal-btn--period"
            :class="{ 'cal-btn--period-active': period === p.value }"
            @click="setPeriod(p.value)"
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Body -->
      <div class="cal-body">
        <!-- DAY -->
        <div v-if="period === 'day'" class="cal-day">
          <div class="cal-day__header">{{ dayHeaderLabel(cursor) }}</div>
          <div class="cal-day__list">
            <div v-if="visibleRows.length === 0" class="cal-empty-cell">{{ t.calNoItems }}</div>
            <div v-for="row in visibleRows" :key="getRowId(row)" class="cal-event cal-event--row" @click="onItemClick(row)">
              <NavigationButtons
                class="cal-event__nav"
                :row-id="getRowId(row)"
                :focus-row-id="navigationFocusRowId"
                :tab-value="navigationTabValue"
                :message-count="getMessageCount(row)"
                :workflow-id="navigationWorkflowId"
              />
              <span class="cal-event__time">{{ formatItemTime(row) }}</span>
              <div class="cal-event__fields">
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
            </div>
          </div>
        </div>

        <!-- WEEK -->
        <div v-else-if="period === 'week'" class="cal-week">
          <div class="cal-week__grid">
            <div
              v-for="day in weekDays"
              :key="day.iso"
              class="cal-week__day"
              :class="{ 'cal-week__day--today': day.isToday }"
            >
              <div class="cal-week__day-header" @click="drillToDay(day.date)">
                <span class="cal-week__dow">{{ day.dow }}</span>
                <span class="cal-week__dom">{{ day.dom }}</span>
              </div>
              <div class="cal-week__day-body">
                <div
                  v-for="row in day.rows"
                  :key="getRowId(row)"
                  class="cal-event cal-event--chip"
                  @click="onItemClick(row)"
                >
                  <NavigationButtons
                    class="cal-event__nav cal-event__nav--small"
                    :row-id="getRowId(row)"
                    :focus-row-id="navigationFocusRowId"
                    :tab-value="navigationTabValue"
                    :message-count="getMessageCount(row)"
                    :workflow-id="navigationWorkflowId"
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
                <div v-if="day.rows.length === 0" class="cal-empty-cell cal-empty-cell--soft"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- MONTH -->
        <div v-else-if="period === 'month'" class="cal-month">
          <div class="cal-month__dow-row">
            <div v-for="d in dayHeaders" :key="d" class="cal-month__dow">{{ d }}</div>
          </div>
          <div class="cal-month__grid">
            <div
              v-for="cell in monthCells"
              :key="cell.iso"
              class="cal-month__cell"
              :class="{
                'cal-month__cell--other': !cell.inMonth,
                'cal-month__cell--today': cell.isToday,
              }"
            >
              <div class="cal-month__cell-header" @click="drillToDay(cell.date)">
                <span class="cal-month__cell-dom">{{ cell.dom }}</span>
                <span v-if="cell.rows.length" class="cal-month__cell-count">{{ cell.rows.length }}</span>
              </div>
              <div class="cal-month__cell-body">
                <div
                  v-for="row in cell.rows.slice(0, 3)"
                  :key="getRowId(row)"
                  class="cal-event cal-event--chip cal-event--mini"
                  @click="onItemClick(row)"
                >
                  <NavigationButtons
                    class="cal-event__nav cal-event__nav--small"
                    :row-id="getRowId(row)"
                    :focus-row-id="navigationFocusRowId"
                    :tab-value="navigationTabValue"
                    :message-count="getMessageCount(row)"
                    :workflow-id="navigationWorkflowId"
                  />
                  <KanbanField
                    :column="findColumn(cardFields[0])"
                    :row="row"
                    :resolve-mapping-formula="resolveMappingFormula"
                    :is-title="true"
                    :cell-font-family="cfg.cellFontFamily || ''"
                    :user-focus-color="cfg.userFocusColor || ''"
                    v-if="cardFields[0]"
                  />
                </div>
                <div v-if="cell.rows.length > 3" class="cal-month__cell-more">
                  +{{ cell.rows.length - 3 }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- YEAR -->
        <div v-else-if="period === 'year'" class="cal-year">
          <div
            v-for="month in yearMonths"
            :key="month.idx"
            class="cal-year__month"
            @click="drillToMonth(month.idx)"
          >
            <div class="cal-year__title">{{ month.label }}<span class="cal-year__count">{{ month.count }}</span></div>
            <div class="cal-year__mini">
              <div v-for="d in dayHeaders" :key="d" class="cal-year__dow">{{ d }}</div>
              <div
                v-for="(cell, i) in month.cells"
                :key="i"
                class="cal-year__cell"
                :class="{
                  'cal-year__cell--other': !cell.inMonth,
                  'cal-year__cell--today': cell.isToday,
                  'cal-year__cell--has-events': cell.count > 0,
                }"
                :title="cell.count > 0 ? `${cell.count}` : ''"
              >{{ cell.dom }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Below grid -->
      <div v-if="gridFields.length > 0" class="cal-grid-wrap">
        <div class="cal-grid-title">{{ t.calBelowGridTitle }} <span class="cal-grid-count">{{ visibleRows.length }}</span></div>
        <div class="cal-grid-scroll">
          <table class="cal-grid">
            <thead>
              <tr>
                <th v-for="f in gridFields" :key="f">{{ findColumn(f)?.headerName || f }}</th>
                <th class="cal-grid__nav-col"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visibleRows" :key="'g-' + getRowId(row)" @click="onItemClick(row)">
                <td v-for="f in gridFields" :key="f">
                  <KanbanField
                    :column="findColumn(f)"
                    :row="row"
                    :resolve-mapping-formula="resolveMappingFormula"
                    :is-title="false"
                    :cell-font-family="cfg.cellFontFamily || ''"
                    :user-focus-color="cfg.userFocusColor || ''"
                  />
                </td>
                <td class="cal-grid__nav-col" @click.stop>
                  <NavigationButtons
                    :row-id="getRowId(row)"
                    :focus-row-id="navigationFocusRowId"
                    :tab-value="navigationTabValue"
                    :message-count="getMessageCount(row)"
                    :workflow-id="navigationWorkflowId"
                  />
                </td>
              </tr>
              <tr v-if="visibleRows.length === 0">
                <td :colspan="gridFields.length + 1" class="cal-grid__empty">{{ t.calNoItems }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Config panel -->
    <div ref="configPanelRef" class="cal-config-anchor">
      <Transition name="cc-fade">
        <div v-if="showConfig" class="cc-panel cal-cc-panel" @click.stop>
          <div class="cc-header">
            <span class="cc-title">{{ t.calSettings }}</span>
            <button class="cc-close-btn" @click="showConfig = false" :aria-label="t.kanbanClose || 'Close'">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="cc-tabs" role="tablist">
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'date' }"
              @click="activeTab = 'date'"
            >{{ t.calTabDate }}</button>
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'fields' }"
              @click="activeTab = 'fields'"
            >{{ t.calTabFields }}</button>
            <button
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeTab === 'grid' }"
              @click="activeTab = 'grid'"
            >{{ t.calTabGrid }}</button>
          </div>

          <!-- Date tab -->
          <template v-if="activeTab === 'date'">
            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ t.calDateField }}</label>
              <select
                class="cc-group-select"
                :value="dateField || ''"
                :disabled="dateColumns.length === 0"
                @change="setDateField($event.target.value || null)"
              >
                <option value="">{{ t.calNoDateField }}</option>
                <option v-for="opt in dateColumns" :key="opt.field" :value="opt.field">
                  {{ opt.headerName || opt.field }}
                </option>
              </select>
            </div>
            <div v-if="dateColumns.length === 0" class="cc-empty">{{ t.calNoDateColumns }}</div>

            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ t.calPeriod }}</label>
              <select
                class="cc-group-select"
                :value="period"
                @change="setPeriod($event.target.value)"
              >
                <option v-for="p in periodOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
          </template>

          <!-- Calendar card fields tab -->
          <template v-else-if="activeTab === 'fields'">
            <div class="cc-fields-meta">
              <span>{{ cardFieldsCounter }}</span>
            </div>
            <div class="cc-list">
              <div
                v-for="col in availableFields"
                :key="col.field"
                class="cc-row"
                :class="{
                  'cc-row--drag-over': cardFieldDragOver === col.field && cardFieldDrag !== col.field,
                  'cc-row--dragging': cardFieldDrag === col.field,
                }"
                :title="isCardFieldDisabled(col.field) ? cardMaxTooltip : null"
                :draggable="cardFields.includes(col.field)"
                @dragstart="onCardFieldDragStart(col.field)"
                @dragover.prevent="onCardFieldDragOver(col.field)"
                @drop.prevent="onCardFieldDrop(col.field)"
                @dragend="onCardFieldDragEnd"
              >
                <label class="cc-checkbox-wrap" :class="{ 'cc-checkbox-wrap--locked': isCardFieldDisabled(col.field) }">
                  <input
                    type="checkbox"
                    class="cc-checkbox"
                    :checked="cardFields.includes(col.field)"
                    :disabled="isCardFieldDisabled(col.field)"
                    @change="toggleCardField(col.field)"
                  />
                </label>
                <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !cardFields.includes(col.field) }">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                    <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                    <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                  </svg>
                </span>
                <span class="cc-col-name">{{ col.headerName || col.field }}</span>
                <span v-if="cardFields.indexOf(col.field) === 0" class="cc-field-badge">{{ t.kanbanTitleBadge || 'Title' }}</span>
              </div>
              <div v-if="availableFields.length === 0" class="cc-empty">{{ t.kanbanNoFieldsMatch || 'No fields.' }}</div>
            </div>
          </template>

          <!-- Below-grid fields tab -->
          <template v-else-if="activeTab === 'grid'">
            <div class="cc-fields-meta">
              <span>{{ gridFieldsCounter }}</span>
            </div>
            <div class="cc-list">
              <div
                v-for="col in availableGridFields"
                :key="col.field"
                class="cc-row"
                :class="{
                  'cc-row--drag-over': gridFieldDragOver === col.field && gridFieldDrag !== col.field,
                  'cc-row--dragging': gridFieldDrag === col.field,
                }"
                :draggable="gridFields.includes(col.field)"
                @dragstart="onGridFieldDragStart(col.field)"
                @dragover.prevent="onGridFieldDragOver(col.field)"
                @drop.prevent="onGridFieldDrop(col.field)"
                @dragend="onGridFieldDragEnd"
              >
                <label class="cc-checkbox-wrap">
                  <input
                    type="checkbox"
                    class="cc-checkbox"
                    :checked="gridFields.includes(col.field)"
                    @change="toggleGridField(col.field)"
                  />
                </label>
                <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !gridFields.includes(col.field) }">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                    <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                    <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                  </svg>
                </span>
                <span class="cc-col-name">{{ col.headerName || col.field }}</span>
              </div>
              <div v-if="availableGridFields.length === 0" class="cc-empty">{{ t.kanbanNoFieldsMatch || 'No fields.' }}</div>
            </div>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import KanbanField from '../kanban/components/KanbanField.vue';
import NavigationButtons from '../kanban/components/NavigationButtons.vue';
import { getTranslations } from '../shared/utils/sharedHelpers.js';
import { fetchSupabaseDataInfinite } from '../shared/utils/supabaseUtils.js';

const MAX_CARD_FIELDS = 3;
const MAX_GRID_FIELDS = 8;
const PERIODS = ['day', 'week', 'month', 'year'];

// Local fallbacks used when getTranslations() doesn't include calendar keys yet.
const CAL_FALLBACK = {
  calEmptyTitle: 'Configure your calendar',
  calEmptySubtitle: 'Pick a date field from the configuration panel.',
  calSettings: 'Calendar settings',
  calTabDate: 'Date',
  calTabFields: 'Item fields',
  calTabGrid: 'Grid columns',
  calDateField: 'Date field',
  calNoDateField: 'No date field',
  calNoDateColumns: 'No date or date-time columns available.',
  calPeriod: 'Period',
  calToday: 'Today',
  calPrev: 'Previous',
  calNext: 'Next',
  calNoItems: 'No items in this range.',
  calBelowGridTitle: 'Records in view',
  calPeriodDay: 'Day',
  calPeriodWeek: 'Week',
  calPeriodMonth: 'Month',
  calPeriodYear: 'Year',
  calCardFieldsCounter: '{count} / {max} item fields selected',
  calGridFieldsCounter: '{count} / {max} grid columns selected',
  calCardMaxTooltip: 'Maximum {max} item fields',
};

const tr = (t, key) => (t && t[key]) || CAL_FALLBACK[key] || key;

// ---- date helpers (local) ----
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays    = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths  = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const addYears   = (d, n) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };
const startOfWeek = (d) => {
  const x = startOfDay(d);
  // Monday as week start. JS getDay(): 0=Sun ... 6=Sat
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
};
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default {
  name: 'Calendar',
  components: { KanbanField, NavigationButtons },
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

    // ---- merged config (same shape as kanban) ----
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
      for (const key of Object.keys(base)) if (!excludeSet.has(key)) merged[key] = base[key];
      return merged;
    });

    const t = computed(() => getTranslations(cfg.value?.lang || 'en'));

    const periodOptions = computed(() => [
      { value: 'day', label: tr(t.value, 'calPeriodDay') },
      { value: 'week', label: tr(t.value, 'calPeriodWeek') },
      { value: 'month', label: tr(t.value, 'calPeriodMonth') },
      { value: 'year', label: tr(t.value, 'calPeriodYear') },
    ]);

    // ---- navigation buttons context (mirrors kanban) ----
    const NAVIGATION_TAB_FORMULA = {
      type: 'f',
      code: "formulas['ec0f4ece-48ed-4145-b0a3-eb9985f1e4bd']()",
    };
    const NAVIGATION_WORKFLOW_ID = 'd4ab2a61-2728-4dc3-a144-9fd3d558411e';
    const navigationFocusRowId = computed(() => cfg.value?.focusedRowId);
    const navigationTabValue = computed(() =>
      Number(resolveMappingFormula(NAVIGATION_TAB_FORMULA) ?? 0)
    );
    const navigationWorkflowId = computed(() => NAVIGATION_WORKFLOW_ID);
    const getMessageCount = (row) => {
      const formula = cfg.value?.navigationMessageCountFormula;
      if (formula) {
        const v = resolveMappingFormula(formula, row);
        if (v != null && v !== '') return Number(v) || 0;
      }
      return row?.conversation?.messages?.length ?? 0;
    };

    // ---- css variables (mirrors kanban) ----
    const cssVars = computed(() => ({
      '--ag-foreground-color': cfg.value?.textColor || cfg.value?.cellColor || '#1f2937',
      '--ag-background-color': cfg.value?.backgroundColor || '#ffffff',
      '--ag-border-color': cfg.value?.borderColor || 'rgba(0,0,0,0.08)',
      '--ww-data-grid_cc-background': cfg.value?.columnChooserBackground || cfg.value?.backgroundColor || '#ffffff',
      '--ww-data-grid_cc-border-color': cfg.value?.columnChooserBorderColor || cfg.value?.borderColor || 'rgba(0,0,0,0.08)',
      '--ww-data-grid_cc-text-color': cfg.value?.columnChooserTextColor || cfg.value?.textColor || '#1f2937',
      '--ww-data-grid_cc-accent-color': cfg.value?.columnChooserAccentColor || '#3b82f6',
      '--ww-data-grid_cc-border-radius': cfg.value?.columnChooserBorderRadius || '8px',
      '--ww-data-grid_cc-width': cfg.value?.columnChooserWidth || '320px',
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

    // ---- local state ----
    const dateField = ref(null);
    const period = ref('month');
    const cardFields = ref([]);
    const gridFields = ref([]);
    const cursor = ref(startOfDay(new Date())); // current focused date

    const showConfig = ref(false);
    const activeTab = ref('date');

    const cardFieldDrag = ref(null);
    const cardFieldDragOver = ref(null);
    const gridFieldDrag = ref(null);
    const gridFieldDragOver = ref(null);

    const rootRef = ref(null);
    const configPanelRef = ref(null);

    // Apply / write gating, same shape as kanban.
    const isApplyingConfig = ref(true);
    const firstApplyDone = ref(false);
    let applyConfigGen = 0;

    // ---- columns helpers ----
    const findColumn = (field) => {
      if (!field) return null;
      return (cfg.value?.columns || []).find((c) => c?.field === field) || null;
    };
    const isDateColumn = (c) =>
      !!c && !!c.field && (c.cellDataType === 'dateString' || c.cellDataType === 'dateTime');
    const dateColumns = computed(() =>
      (cfg.value?.columns || []).filter(isDateColumn)
    );
    const availableFields = computed(() => {
      const cols = cfg.value?.columns || [];
      const filtered = cols.filter((c) => c && c.field && c.cellDataType !== 'action');
      // selected first, then the rest
      const selected = cardFields.value.map((f) => filtered.find((c) => c.field === f)).filter(Boolean);
      const rest = filtered.filter((c) => !cardFields.value.includes(c.field));
      return [...selected, ...rest];
    });
    const availableGridFields = computed(() => {
      const cols = cfg.value?.columns || [];
      const filtered = cols.filter((c) => c && c.field && c.cellDataType !== 'action');
      const selected = gridFields.value.map((f) => filtered.find((c) => c.field === f)).filter(Boolean);
      const rest = filtered.filter((c) => !gridFields.value.includes(c.field));
      return [...selected, ...rest];
    });

    const cardFieldsCounter = computed(() =>
      tr(t.value, 'calCardFieldsCounter')
        .replace('{count}', cardFields.value.length)
        .replace('{max}', MAX_CARD_FIELDS)
    );
    const gridFieldsCounter = computed(() =>
      tr(t.value, 'calGridFieldsCounter')
        .replace('{count}', gridFields.value.length)
        .replace('{max}', MAX_GRID_FIELDS)
    );
    const cardMaxTooltip = computed(() =>
      tr(t.value, 'calCardMaxTooltip').replace('{max}', MAX_CARD_FIELDS)
    );

    // ---- viewConfiguration sync ----
    const readCalendarFromViewConfig = () => {
      const c = cfg.value?.viewConfiguration?.calendar;
      if (!c || typeof c !== 'object') return null;
      return c;
    };

    const applyViewConfig = () => {
      const c = readCalendarFromViewConfig();
      isApplyingConfig.value = true;
      const myGen = ++applyConfigGen;
      const validFields = new Set((cfg.value?.columns || []).map((x) => x?.field).filter(Boolean));
      const validDateFields = new Set(dateColumns.value.map((x) => x.field));

      if (c) {
        dateField.value = c.dateField && validDateFields.has(c.dateField) ? c.dateField : null;
        period.value = PERIODS.includes(c.period) ? c.period : 'month';
        cardFields.value = Array.isArray(c.cardFields)
          ? c.cardFields.filter((f) => validFields.has(f)).slice(0, MAX_CARD_FIELDS)
          : [];
        gridFields.value = Array.isArray(c.gridFields)
          ? c.gridFields.filter((f) => validFields.has(f)).slice(0, MAX_GRID_FIELDS)
          : [];
      } else {
        dateField.value = dateColumns.value[0]?.field || null;
        period.value = 'month';
        cardFields.value = [];
        gridFields.value = [];
      }

      setTimeout(() => {
        if (myGen !== applyConfigGen) return;
        isApplyingConfig.value = false;
        firstApplyDone.value = true;
        const variableId = cfg.value?.viewEditedVariableId;
        if (variableId) {
          try { wwLib.wwVariable.updateValue(variableId, false); } catch (_) { /* noop */ }
        }
      }, 0);
    };

    // Exposed currentConfig variable (matches Datagrid/Kanban — only one view
    // mounts at a time, so no double-registration at runtime).
    const { setValue: setCurrentConfig } = wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'currentConfig',
      type: 'object',
      defaultValue: { calendar: { dateField: null, period: 'month', cardFields: [], gridFields: [] } },
      readonly: true,
    });

    const arraysEqual = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    const writeCurrentConfig = () => {
      const config = {
        calendar: {
          dateField: dateField.value,
          period: period.value,
          cardFields: [...cardFields.value],
          gridFields: [...gridFields.value],
        },
      };
      try { setCurrentConfig(config); } catch (_) { /* noop */ }
      if (isApplyingConfig.value || !firstApplyDone.value) return;
      const variableId = cfg.value?.viewEditedVariableId;
      if (!variableId) return;
      const baseline = readCalendarFromViewConfig() || {};
      const edited =
        (baseline.dateField ?? null) !== (dateField.value ?? null) ||
        (baseline.period ?? 'month') !== period.value ||
        !arraysEqual(baseline.cardFields || [], cardFields.value) ||
        !arraysEqual(baseline.gridFields || [], gridFields.value);
      try { wwLib.wwVariable.updateValue(variableId, edited); } catch (_) { /* noop */ }
    };

    watch([dateField, period, cardFields, gridFields], () => writeCurrentConfig(), { deep: true });
    watch(() => cfg.value?.viewConfiguration, () => applyViewConfig(), { deep: true });
    watch(() => cfg.value?.columns, () => {
      const validFields = new Set((cfg.value?.columns || []).map((x) => x?.field).filter(Boolean));
      const validDateFields = new Set(dateColumns.value.map((x) => x.field));
      const nextCard = cardFields.value.filter((f) => validFields.has(f));
      const nextGrid = gridFields.value.filter((f) => validFields.has(f));
      const dfInvalid = dateField.value && !validDateFields.has(dateField.value);
      if (!arraysEqual(nextCard, cardFields.value) || !arraysEqual(nextGrid, gridFields.value) || dfInvalid) {
        isApplyingConfig.value = true;
        const myGen = ++applyConfigGen;
        cardFields.value = nextCard;
        gridFields.value = nextGrid;
        if (dfInvalid) dateField.value = dateColumns.value[0]?.field || null;
        setTimeout(() => {
          if (myGen !== applyConfigGen) return;
          isApplyingConfig.value = false;
        }, 0);
      }
    }, { deep: true });

    onMounted(() => applyViewConfig());

    // ---- supabase data fetch (same shape as kanban) ----
    const supabaseRows = ref([]);
    const fetchSupabase = async () => {
      if (cfg.value?.dataSource !== 'supabase') return;
      const tableName = cfg.value?.supabaseTable;
      if (!tableName) return;
      const supabase = wwLib?.wwPlugins?.supabase?.instance;
      if (!supabase) return;
      const max = Number(cfg.value?.calendarMaxRows) || Number(cfg.value?.kanbanMaxRows) || 1000;
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
          formatFiltersForLog: () => '(calendar)',
        });
        supabaseRows.value = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn('[Calendar] Supabase fetch failed:', e?.message || e);
        supabaseRows.value = [];
      }
    };
    watch(
      () => [cfg.value?.dataSource, cfg.value?.supabaseTable, cfg.value?.supabaseQuery, cfg.value?.supabaseFilters, cfg.value?.calendarMaxRows],
      () => fetchSupabase(),
      { deep: true }
    );
    onMounted(() => fetchSupabase());

    const allRows = computed(() => {
      if (cfg.value?.dataSource === 'supabase') return supabaseRows.value;
      const data = wwLib.wwUtils.getDataFromCollection(cfg.value?.rowData);
      return Array.isArray(data) ? data : [];
    });

    const getRowId = (row) => {
      const fromFormula = resolveMappingFormula(cfg.value?.idFormula, row);
      if (fromFormula !== null && fromFormula !== undefined && fromFormula !== '') {
        return String(fromFormula);
      }
      return row?.id != null ? String(row.id) : null;
    };

    const getRowDate = (row) => {
      const f = dateField.value;
      if (!f || !row) return null;
      const raw = row[f];
      if (raw == null || raw === '') return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    // ---- current period range ----
    const periodRange = computed(() => {
      const c = cursor.value;
      switch (period.value) {
        case 'day': return { start: startOfDay(c), end: endOfDay(c) };
        case 'week': {
          const s = startOfWeek(c);
          return { start: s, end: endOfDay(addDays(s, 6)) };
        }
        case 'year': {
          const s = new Date(c.getFullYear(), 0, 1);
          return { start: startOfDay(s), end: endOfDay(new Date(c.getFullYear(), 11, 31)) };
        }
        case 'month':
        default: {
          const s = new Date(c.getFullYear(), c.getMonth(), 1);
          const e = new Date(c.getFullYear(), c.getMonth() + 1, 0);
          return { start: startOfDay(s), end: endOfDay(e) };
        }
      }
    });

    const visibleRows = computed(() => {
      if (!dateField.value) return [];
      const { start, end } = periodRange.value;
      const out = [];
      for (const row of allRows.value) {
        const d = getRowDate(row);
        if (!d) continue;
        if (d >= start && d <= end) out.push(row);
      }
      out.sort((a, b) => {
        const da = getRowDate(a)?.getTime() ?? 0;
        const db = getRowDate(b)?.getTime() ?? 0;
        return da - db;
      });
      return out;
    });

    // group rows by ISO day (for fast cell lookup in month/week)
    const rowsByDay = computed(() => {
      const m = new Map();
      for (const row of allRows.value) {
        const d = getRowDate(row);
        if (!d) continue;
        const key = isoDay(d);
        let arr = m.get(key);
        if (!arr) { arr = []; m.set(key, arr); }
        arr.push(row);
      }
      return m;
    });

    // ---- labels ----
    const monthName = (idx) =>
      ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'][idx];
    const monthShort = (idx) =>
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][idx];

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const rangeLabel = computed(() => {
      const c = cursor.value;
      switch (period.value) {
        case 'day': return `${dayHeaderLabel(c)}`;
        case 'week': {
          const s = startOfWeek(c);
          const e = addDays(s, 6);
          return `${s.getDate()} ${monthShort(s.getMonth())} – ${e.getDate()} ${monthShort(e.getMonth())} ${e.getFullYear()}`;
        }
        case 'year': return `${c.getFullYear()}`;
        case 'month':
        default: return `${monthName(c.getMonth())} ${c.getFullYear()}`;
      }
    });

    function dayHeaderLabel(d) {
      return `${dayHeaders[(d.getDay() + 6) % 7]} ${d.getDate()} ${monthShort(d.getMonth())} ${d.getFullYear()}`;
    }

    const weekDays = computed(() => {
      const s = startOfWeek(cursor.value);
      const today = startOfDay(new Date());
      const out = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(s, i);
        const key = isoDay(d);
        const rows = rowsByDay.value.get(key) || [];
        out.push({
          date: d,
          iso: key,
          dow: dayHeaders[i],
          dom: d.getDate(),
          rows,
          isToday: sameDay(d, today),
        });
      }
      return out;
    });

    const monthCells = computed(() => {
      const c = cursor.value;
      const firstOfMonth = new Date(c.getFullYear(), c.getMonth(), 1);
      const gridStart = startOfWeek(firstOfMonth);
      const today = startOfDay(new Date());
      const out = [];
      for (let i = 0; i < 42; i++) {
        const d = addDays(gridStart, i);
        const key = isoDay(d);
        out.push({
          date: d,
          iso: key,
          dom: d.getDate(),
          inMonth: d.getMonth() === c.getMonth(),
          isToday: sameDay(d, today),
          rows: rowsByDay.value.get(key) || [],
        });
      }
      return out;
    });

    const yearMonths = computed(() => {
      const year = cursor.value.getFullYear();
      const today = startOfDay(new Date());
      const out = [];
      for (let m = 0; m < 12; m++) {
        const first = new Date(year, m, 1);
        const gridStart = startOfWeek(first);
        const cells = [];
        let count = 0;
        for (let i = 0; i < 42; i++) {
          const d = addDays(gridStart, i);
          const inMonth = d.getMonth() === m;
          const rows = inMonth ? (rowsByDay.value.get(isoDay(d)) || []) : [];
          if (rows.length) count += rows.length;
          cells.push({
            inMonth,
            isToday: sameDay(d, today),
            dom: d.getDate(),
            count: rows.length,
          });
        }
        out.push({ idx: m, label: monthShort(m), cells, count });
      }
      return out;
    });

    // ---- toolbar actions ----
    const goToday = () => { cursor.value = startOfDay(new Date()); };
    const goPrev = () => {
      switch (period.value) {
        case 'day': cursor.value = addDays(cursor.value, -1); break;
        case 'week': cursor.value = addDays(cursor.value, -7); break;
        case 'year': cursor.value = addYears(cursor.value, -1); break;
        case 'month':
        default: cursor.value = addMonths(cursor.value, -1); break;
      }
    };
    const goNext = () => {
      switch (period.value) {
        case 'day': cursor.value = addDays(cursor.value, 1); break;
        case 'week': cursor.value = addDays(cursor.value, 7); break;
        case 'year': cursor.value = addYears(cursor.value, 1); break;
        case 'month':
        default: cursor.value = addMonths(cursor.value, 1); break;
      }
    };

    const setPeriod = (p) => { if (PERIODS.includes(p)) period.value = p; };
    const setDateField = (f) => { dateField.value = f || null; };

    const drillToDay = (d) => { cursor.value = startOfDay(d); period.value = 'day'; };
    const drillToMonth = (idx) => {
      cursor.value = new Date(cursor.value.getFullYear(), idx, 1);
      period.value = 'month';
    };

    // ---- item time label (for day view) ----
    const pad = (n) => String(n).padStart(2, '0');
    const formatItemTime = (row) => {
      const d = getRowDate(row);
      if (!d) return '';
      const col = findColumn(dateField.value);
      if (col?.cellDataType === 'dateTime') {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return '';
    };

    // ---- click ----
    const onItemClick = (row) => {
      const id = getRowId(row);
      ctx.emit('trigger-event', {
        name: 'rowClicked',
        event: { row, id, index: 0, displayIndex: 0 },
      });
    };

    // ---- field tab actions ----
    const isCardFieldDisabled = (field) => {
      if (cardFields.value.includes(field)) return false;
      return cardFields.value.length >= MAX_CARD_FIELDS;
    };
    const toggleCardField = (field) => {
      const idx = cardFields.value.indexOf(field);
      if (idx >= 0) cardFields.value = cardFields.value.filter((f) => f !== field);
      else if (cardFields.value.length < MAX_CARD_FIELDS) cardFields.value = [...cardFields.value, field];
    };
    const onCardFieldDragStart = (field) => {
      if (!cardFields.value.includes(field)) return;
      cardFieldDrag.value = field;
    };
    const onCardFieldDragOver = (field) => {
      if (!cardFieldDrag.value || !cardFields.value.includes(field)) return;
      cardFieldDragOver.value = field;
    };
    const onCardFieldDrop = (target) => {
      const src = cardFieldDrag.value;
      cardFieldDrag.value = null; cardFieldDragOver.value = null;
      if (!src || src === target) return;
      if (!cardFields.value.includes(target) || !cardFields.value.includes(src)) return;
      const arr = [...cardFields.value];
      arr.splice(arr.indexOf(src), 1);
      arr.splice(arr.indexOf(target), 0, src);
      cardFields.value = arr;
    };
    const onCardFieldDragEnd = () => { cardFieldDrag.value = null; cardFieldDragOver.value = null; };

    const toggleGridField = (field) => {
      const idx = gridFields.value.indexOf(field);
      if (idx >= 0) gridFields.value = gridFields.value.filter((f) => f !== field);
      else if (gridFields.value.length < MAX_GRID_FIELDS) gridFields.value = [...gridFields.value, field];
    };
    const onGridFieldDragStart = (field) => {
      if (!gridFields.value.includes(field)) return;
      gridFieldDrag.value = field;
    };
    const onGridFieldDragOver = (field) => {
      if (!gridFieldDrag.value || !gridFields.value.includes(field)) return;
      gridFieldDragOver.value = field;
    };
    const onGridFieldDrop = (target) => {
      const src = gridFieldDrag.value;
      gridFieldDrag.value = null; gridFieldDragOver.value = null;
      if (!src || src === target) return;
      if (!gridFields.value.includes(target) || !gridFields.value.includes(src)) return;
      const arr = [...gridFields.value];
      arr.splice(arr.indexOf(src), 1);
      arr.splice(arr.indexOf(target), 0, src);
      gridFields.value = arr;
    };
    const onGridFieldDragEnd = () => { gridFieldDrag.value = null; gridFieldDragOver.value = null; };

    // ---- config visibility: same external WeWeb variable as the datagrid's column chooser ----
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
      }
      const varId = cfg.value?.columnChooserVariableId;
      if (varId) {
        try { wwLib.wwVariable.updateValue(varId, val); } catch (_) { /* noop */ }
      }
    });
    watch(
      () => {
        const varId = cfg.value?.columnChooserVariableId;
        if (!varId) return undefined;
        try { return wwLib.wwVariable.getValue(varId); } catch (_) { return undefined; }
      },
      (newVal) => {
        if (newVal === undefined) return;
        const boolVal = !!newVal;
        if (showConfig.value !== boolVal) showConfig.value = boolVal;
      },
      { immediate: true }
    );
    onBeforeUnmount(() => {
      if (clickOutsideTimer) clearTimeout(clickOutsideTimer);
      try { wwLib.getFrontDocument().removeEventListener('click', onDocumentClick); } catch (_) { /* noop */ }
    });

    // Translation accessor used in the template — keys not yet present in
    // sharedHelpers fall through to CAL_FALLBACK.
    const tProxy = computed(() => {
      const base = t.value || {};
      const out = { ...base };
      for (const k of Object.keys(CAL_FALLBACK)) if (out[k] === undefined) out[k] = CAL_FALLBACK[k];
      return out;
    });

    return {
      rootRef, configPanelRef,
      cfg, cssVars,
      t: tProxy,
      periodOptions,
      dateField, period, cardFields, gridFields, cursor,
      showConfig, activeTab,
      cardFieldDrag, cardFieldDragOver, gridFieldDrag, gridFieldDragOver,
      dateColumns, availableFields, availableGridFields,
      cardFieldsCounter, gridFieldsCounter, cardMaxTooltip,
      visibleRows,
      weekDays, monthCells, yearMonths, dayHeaders,
      rangeLabel,
      navigationFocusRowId, navigationTabValue, navigationWorkflowId,
      resolveMappingFormula,
      findColumn, getRowId, getMessageCount,
      goPrev, goNext, goToday, setPeriod, setDateField,
      drillToDay, drillToMonth,
      dayHeaderLabel, formatItemTime,
      onItemClick,
      isCardFieldDisabled, toggleCardField,
      onCardFieldDragStart, onCardFieldDragOver, onCardFieldDrop, onCardFieldDragEnd,
      toggleGridField,
      onGridFieldDragStart, onGridFieldDragOver, onGridFieldDrop, onGridFieldDragEnd,
    };
  },
};
</script>

<style scoped lang="scss">
.ww-calendar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--ag-background-color, #ffffff);
  color: var(--ag-foreground-color, #1f2937);
  font-family: 'Work Sans', sans-serif;
  gap: 8px;
  padding: 12px;
  overflow: hidden;
}

.cal-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}
.cal-empty__title { font-size: 18px; font-weight: 600; }
.cal-empty__subtitle {
  font-size: 13px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
  max-width: 380px;
  line-height: 1.4;
}

/* Toolbar */
.cal-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--ag-border-color);
}
.cal-toolbar__nav { display: flex; align-items: center; gap: 6px; }
.cal-toolbar__label {
  margin-left: 10px;
  font-weight: 600;
  font-size: 14px;
}
.cal-toolbar__periods { display: flex; gap: 4px; }

.cal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ag-border-color);
  border-radius: 6px;
  background: var(--ag-background-color);
  color: var(--ag-foreground-color);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;

  &:hover { background: rgba(0,0,0,0.04); }
}
.cal-btn--icon { width: 28px; padding: 0; }
.cal-btn--today { font-weight: 600; }
.cal-btn--period-active {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.4);
  color: #2563eb;
}

/* Body */
.cal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* Generic event chip */
.cal-event {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border-radius: 6px;
  padding: 6px 8px;
  border: 1px solid var(--ag-border-color);
  background: var(--ag-background-color);

  &:hover { background: rgba(0,0,0,0.03); }
}
.cal-event__nav {
  flex: 0 0 auto;
  margin-left: auto;
  order: 99;
}
.cal-event__nav--small :deep(.ww-nav-btn) {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}
.cal-event__nav--small :deep(.ww-nav-btn svg) { width: 12px; height: 12px; }
.cal-event__time {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 75%, transparent);
  min-width: 38px;
}
.cal-event__fields {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* DAY */
.cal-day { display: flex; flex-direction: column; gap: 6px; padding: 4px; }
.cal-day__header {
  font-weight: 600;
  font-size: 13px;
  padding: 4px 2px 8px;
  border-bottom: 1px dashed var(--ag-border-color);
}
.cal-day__list { display: flex; flex-direction: column; gap: 6px; }
.cal-event--row { padding: 10px 12px; }

/* WEEK */
.cal-week { padding: 4px; }
.cal-week__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.cal-week__day {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ag-border-color);
  border-radius: 6px;
  background: var(--ag-background-color);
  min-height: 280px;
}
.cal-week__day--today { border-color: rgba(59,130,246,0.5); }
.cal-week__day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--ag-border-color);
  cursor: pointer;
}
.cal-week__day-header:hover { background: rgba(0,0,0,0.03); }
.cal-week__dow { font-size: 10px; text-transform: uppercase; opacity: 0.6; }
.cal-week__dom { font-size: 16px; font-weight: 600; }
.cal-week__day-body {
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
}
.cal-event--chip {
  flex-direction: column;
  align-items: stretch;
  padding: 6px 8px;
  gap: 2px;
  background: rgba(59,130,246,0.06);
  border-color: rgba(59,130,246,0.25);
}
.cal-event--chip .cal-event__nav {
  position: absolute;
  top: 2px;
  right: 2px;
  margin-left: 0;
}

/* MONTH */
.cal-month { padding: 4px; display: flex; flex-direction: column; gap: 4px; }
.cal-month__dow-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.cal-month__dow {
  font-size: 11px;
  text-transform: uppercase;
  opacity: 0.6;
  text-align: center;
  padding: 4px 0;
}
.cal-month__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(96px, 1fr);
  gap: 4px;
  flex: 1 1 auto;
}
.cal-month__cell {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ag-border-color);
  border-radius: 6px;
  background: var(--ag-background-color);
  overflow: hidden;
}
.cal-month__cell--other {
  background: rgba(0,0,0,0.02);
  color: color-mix(in srgb, var(--ag-foreground-color, #9ca3af) 50%, transparent);
}
.cal-month__cell--today { border-color: rgba(59,130,246,0.5); }
.cal-month__cell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid transparent;
}
.cal-month__cell-header:hover { background: rgba(0,0,0,0.03); }
.cal-month__cell-count {
  font-size: 10px;
  background: rgba(59,130,246,0.15);
  color: #2563eb;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.cal-month__cell-body {
  padding: 2px 4px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1 1 auto;
}
.cal-event--mini {
  padding: 2px 4px 2px 6px;
  font-size: 11px;
  gap: 4px;
  background: rgba(59,130,246,0.06);
  border-color: rgba(59,130,246,0.2);
}
.cal-event--mini .cal-event__nav { position: static; margin-left: auto; }
.cal-month__cell-more {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
  padding: 0 4px;
}

/* YEAR */
.cal-year {
  padding: 4px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.cal-year__month {
  border: 1px solid var(--ag-border-color);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  background: var(--ag-background-color);

  &:hover { background: rgba(0,0,0,0.03); }
}
.cal-year__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 12px;
  padding-bottom: 6px;
}
.cal-year__count {
  font-size: 10px;
  background: rgba(59,130,246,0.15);
  color: #2563eb;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  &:empty { display: none; }
}
.cal-year__mini {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-year__dow {
  font-size: 9px;
  opacity: 0.55;
  text-align: center;
}
.cal-year__cell {
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
  border-radius: 3px;
  background: transparent;
}
.cal-year__cell--other { opacity: 0.3; }
.cal-year__cell--today { outline: 1px solid rgba(59,130,246,0.55); }
.cal-year__cell--has-events {
  background: rgba(59,130,246,0.14);
  color: #1d4ed8;
  font-weight: 600;
}

/* Below grid */
.cal-grid-wrap {
  flex: 0 0 auto;
  border-top: 1px solid var(--ag-border-color);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  max-height: 35%;
  min-height: 100px;
}
.cal-grid-title {
  font-size: 12px;
  font-weight: 600;
  padding: 0 4px 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cal-grid-count {
  font-size: 10px;
  background: rgba(0,0,0,0.06);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.cal-grid-scroll {
  overflow: auto;
  border: 1px solid var(--ag-border-color);
  border-radius: 6px;
}
.cal-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cal-grid th, .cal-grid td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ag-border-color);
  vertical-align: middle;
}
.cal-grid th {
  position: sticky;
  top: 0;
  background: var(--ag-background-color);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  opacity: 0.7;
  z-index: 1;
}
.cal-grid tbody tr { cursor: pointer; }
.cal-grid tbody tr:hover { background: rgba(0,0,0,0.03); }
.cal-grid__nav-col { width: 80px; }
.cal-grid__empty {
  text-align: center;
  padding: 14px;
  opacity: 0.6;
}

.cal-empty-cell {
  text-align: center;
  padding: 16px 8px;
  opacity: 0.6;
  font-size: 12px;
}
.cal-empty-cell--soft { padding: 4px; min-height: 8px; }

/* Config panel — minimal subset of the kanban cc-panel styles, kept local. */
.cal-config-anchor { position: relative; }
.cc-panel {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 50;
  width: var(--ww-data-grid_cc-width, 320px);
  background: var(--ww-data-grid_cc-background, #ffffff);
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0,0,0,0.08));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cc-title { font-weight: 600; font-size: 13px; }
.cc-close-btn {
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid var(--ww-data-grid_cc-border-color);
  border-radius: 4px;
  cursor: pointer;
  color: inherit;
}
.cc-tabs { display: flex; gap: 4px; }
.cc-tab {
  flex: 1 1 auto;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: inherit;
  border: 1px solid var(--ww-data-grid_cc-border-color);
  border-radius: 6px;
  cursor: pointer;
}
.cc-tab--active {
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: #ffffff;
  border-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
}
.cc-group-select-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-group-select-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.7;
}
.cc-group-select {
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--ww-data-grid_cc-border-color);
  border-radius: 6px;
  background: var(--ww-data-grid_cc-background);
  color: inherit;
  font-size: 12px;
}
.cc-fields-meta {
  font-size: 11px;
  opacity: 0.7;
  padding: 0 2px;
}
.cc-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
}
.cc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: default;
  font-size: 12px;
}
.cc-row:hover { background: rgba(0,0,0,0.04); }
.cc-row--drag-over { outline: 2px dashed var(--ww-data-grid_cc-accent-color, #3b82f6); }
.cc-row--dragging { opacity: 0.55; }
.cc-checkbox-wrap { display: inline-flex; align-items: center; }
.cc-checkbox-wrap--locked { opacity: 0.45; }
.cc-checkbox { width: 14px; height: 14px; }
.cc-drag-handle { color: rgba(0,0,0,0.35); cursor: grab; line-height: 0; }
.cc-drag-handle--disabled { opacity: 0.3; cursor: default; }
.cc-col-name { flex: 1 1 auto; }
.cc-field-badge {
  font-size: 9px;
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.cc-empty {
  padding: 8px;
  font-size: 11px;
  opacity: 0.7;
  text-align: center;
}

.cc-fade-enter-active, .cc-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.cc-fade-enter-from, .cc-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
