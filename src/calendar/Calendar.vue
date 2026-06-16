<template>
  <div class="ww-calendar" :style="[cssVars, rootStyle]" ref="rootRef">
    <!-- Empty state: not configured (no date column selected yet) -->
    <div v-if="!dateField" class="cal-empty">
      <div class="cal-empty__title">{{ t.calendarEmptyTitle }}</div>
      <div class="cal-empty__subtitle">
        {{ dateColumns.length === 0 ? t.calendarNoDateColumns : t.calendarEmptySubtitle }}
      </div>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="cal-toolbar">
        <div class="cal-toolbar__nav">
          <button type="button" class="cal-btn cal-btn--icon" @click="goPrev" :aria-label="t.calendarPrev">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button type="button" class="cal-btn cal-btn--today" @click="goToday">{{ t.calendarToday }}</button>
          <button type="button" class="cal-btn cal-btn--icon" @click="goNext" :aria-label="t.calendarNext">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <div class="cal-toolbar__title">{{ periodTitle }}</div>

        <div class="cal-toolbar__frames">
          <button
            v-for="f in timeframes"
            :key="f"
            type="button"
            class="cal-frame-btn"
            :class="{ 'cal-frame-btn--active': timeframe === f }"
            @click="setTimeframe(f)"
          >{{ t['calendarFrame_' + f] }}</button>
        </div>
      </div>

      <!-- Custom range inputs -->
      <div v-if="timeframe === 'custom'" class="cal-custom-range">
        <label class="cal-custom-range__field">
          <span>{{ t.calendarFrom }}</span>
          <input type="date" :value="customStart" @change="setCustomStart($event.target.value)" />
        </label>
        <label class="cal-custom-range__field">
          <span>{{ t.calendarTo }}</span>
          <input type="date" :value="customEnd" @change="setCustomEnd($event.target.value)" />
        </label>
      </div>

      <!-- ============ MONTH ============ -->
      <div v-if="timeframe === 'month'" class="cal-month">
        <div class="cal-month__weekdays">
          <div v-for="(wd, i) in weekdayLabels" :key="i" class="cal-month__weekday">{{ wd }}</div>
        </div>
        <div class="cal-month__grid">
          <div
            v-for="(day, di) in monthDays"
            :key="di"
            class="cal-month__cell"
            :class="{
              'cal-month__cell--out': day.getMonth() !== anchorDate.getMonth(),
              'cal-month__cell--today': isToday(day),
            }"
          >
            <div class="cal-month__date" @click="drillToDay(day)">{{ day.getDate() }}</div>
            <div class="cal-month__events">
              <CalendarEvent
                v-for="ev in cappedDayEvents(day)"
                :key="ev.rowId"
                compact
                :fields="eventColumns"
                :row="ev.row"
                :resolve-mapping-formula="resolveMappingFormula"
                :color="eventColor(ev.row)"
                :time-label="hasTime ? formatTimeLabel(ev.date) : ''"
                :cell-font-family="cfg.cellFontFamily || ''"
                :user-focus-color="cfg.userFocusColor || ''"
                @chip-click="onEventClick(ev.row)"
                @mouseenter="onEventHover(ev, $event)"
                @mouseleave="onEventLeave"
              />
              <button
                v-if="dayEventCount(day) > MONTH_CELL_CAP"
                type="button"
                class="cal-month__more"
                @click="drillToDay(day)"
              >{{ t.calendarMore.replace('{count}', dayEventCount(day) - MONTH_CELL_CAP) }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ TIME-GRID (day / week with timestamps) ============ -->
      <div v-else-if="isTimeGrid" class="cal-timegrid">
        <div class="cal-timegrid__head">
          <div class="cal-timegrid__gutter-head"></div>
          <div
            v-for="(day, di) in rangeDays"
            :key="di"
            class="cal-timegrid__day-head"
            :class="{ 'cal-timegrid__day-head--today': isToday(day) }"
          >
            <span class="cal-timegrid__day-name">{{ weekdayLabels[di] }}</span>
            <span class="cal-timegrid__day-num">{{ day.getDate() }}</span>
          </div>
        </div>
        <div class="cal-timegrid__body" ref="timeGridBodyRef">
          <div class="cal-timegrid__gutter">
            <div v-for="h in 24" :key="h" class="cal-timegrid__hour-label" :style="{ height: HOUR_PX + 'px' }">
              {{ hourLabel(h - 1) }}
            </div>
          </div>
          <div
            v-for="(day, di) in rangeDays"
            :key="di"
            class="cal-timegrid__col"
            :class="{ 'cal-timegrid__col--today': isToday(day) }"
          >
            <div v-for="h in 24" :key="h" class="cal-timegrid__hour-line" :style="{ height: HOUR_PX + 'px' }"></div>
            <div
              v-for="ev in timeGridEvents(day)"
              :key="ev.rowId"
              class="cal-timegrid__event"
              :data-tg-key="di + ':' + ev.rowId"
              :data-ideal="ev.idealTop"
              :style="{ top: eventTop(di, ev) + 'px' }"
            >
              <CalendarEvent
                :fields="eventColumns"
                :row="ev.row"
                :resolve-mapping-formula="resolveMappingFormula"
                :color="eventColor(ev.row)"
                :time-label="formatTimeLabel(ev.date)"
                :cell-font-family="cfg.cellFontFamily || ''"
                :user-focus-color="cfg.userFocusColor || ''"
                @chip-click="onEventClick(ev.row)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ============ YEAR ============ -->
      <div v-else-if="timeframe === 'year'" class="cal-year">
        <div v-for="m in 12" :key="m" class="cal-year__month">
          <div class="cal-year__month-title" @click="drillToMonth(m - 1)">{{ monthTitle(m - 1) }}</div>
          <div class="cal-year__weekdays">
            <span v-for="(wd, i) in weekdayLabelsNarrow" :key="i">{{ wd }}</span>
          </div>
          <div class="cal-year__grid">
            <button
              v-for="(day, di) in yearMonthDays(m - 1)"
              :key="di"
              type="button"
              class="cal-year__day"
              :class="{
                'cal-year__day--out': day.getMonth() !== (m - 1),
                'cal-year__day--today': isToday(day),
                'cal-year__day--has': day.getMonth() === (m - 1) && dayEventCount(day) > 0,
              }"
              @click="drillToDay(day)"
            >
              {{ day.getDate() }}
              <span v-if="day.getMonth() === (m - 1) && dayEventCount(day) > 0" class="cal-year__dot"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- ============ AGENDA (day / week without time, or custom) ============ -->
      <div v-else class="cal-agenda">
        <div v-if="agendaDays.length === 0" class="cal-agenda__empty">{{ t.calendarNoEvents }}</div>
        <div v-for="grp in agendaDays" :key="grp.key" class="cal-agenda__group">
          <div class="cal-agenda__date" :class="{ 'cal-agenda__date--today': isToday(grp.day) }">
            <span class="cal-agenda__date-num">{{ grp.day.getDate() }}</span>
            <span class="cal-agenda__date-rest">{{ agendaDateLabel(grp.day) }}</span>
          </div>
          <div class="cal-agenda__events">
            <CalendarEvent
              v-for="ev in grp.events"
              :key="ev.rowId"
              :fields="eventColumns"
              :row="ev.row"
              :resolve-mapping-formula="resolveMappingFormula"
              :color="eventColor(ev.row)"
              :time-label="hasTime ? formatTimeLabel(ev.date) : ''"
              :cell-font-family="cfg.cellFontFamily || ''"
              :user-focus-color="cfg.userFocusColor || ''"
              @chip-click="onEventClick(ev.row)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Month hover preview: full event card (like the day view), non-interactive -->
    <div
      v-if="hoverEvent"
      class="cal-hover-card"
      :style="{ top: hoverPos.top + 'px', left: hoverPos.left + 'px' }"
    >
      <CalendarEvent
        :key="hoverEvent.rowId"
        :fields="eventColumns"
        :row="hoverEvent.row"
        :resolve-mapping-formula="resolveMappingFormula"
        :color="eventColor(hoverEvent.row)"
        :time-label="hasTime ? formatTimeLabel(hoverEvent.date) : ''"
        :cell-font-family="cfg.cellFontFamily || ''"
        :user-focus-color="cfg.userFocusColor || ''"
      />
    </div>

    <!-- Config panel (mirrors the kanban .cc-panel) -->
    <div ref="configPanelRef" class="cal-config-anchor">
      <Transition name="cc-fade">
        <div v-if="showConfig" class="cc-panel cal-cc-panel" @click.stop>
          <div class="cc-header">
            <span class="cc-title">{{ t.calendarSettings }}</span>
            <button class="cc-close-btn" @click="showConfig = false" :aria-label="t.kanbanClose">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="cc-tabs" role="tablist">
            <button type="button" class="cc-tab" :class="{ 'cc-tab--active': activeTab === 'date' }" role="tab" @click="activeTab = 'date'">{{ t.calendarDateTab }}</button>
            <button type="button" class="cc-tab" :class="{ 'cc-tab--active': activeTab === 'fields' }" role="tab" @click="activeTab = 'fields'">{{ t.calendarFieldsTab }}</button>
          </div>

          <!-- Date tab -->
          <template v-if="activeTab === 'date'">
            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ t.calendarDateSource }}</label>
              <select
                class="cc-group-select"
                :value="dateField || ''"
                :disabled="dateColumns.length === 0"
                @change="setDateField($event.target.value || null)"
              >
                <option value="">{{ t.calendarNoDateField }}</option>
                <option v-for="opt in dateColumns" :key="opt.field" :value="opt.field">{{ opt.headerName || opt.field }}</option>
              </select>
            </div>

            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ t.calendarColorBy }}</label>
              <select class="cc-group-select" :value="colorByField || ''" @change="setColorByField($event.target.value || null)">
                <option value="">{{ t.calendarNoColor }}</option>
                <option v-for="opt in selectColumns" :key="opt.field" :value="opt.field">{{ opt.headerName || opt.field }}</option>
              </select>
            </div>

            <label class="cc-group-toggle-row">
              <input type="checkbox" class="cc-checkbox" :checked="weekStartsOn === 1" @change="setWeekStart($event.target.checked ? 1 : 0)" />
              <span class="cc-group-toggle-label">{{ t.calendarWeekStartsMonday }}</span>
            </label>

            <div v-if="dateColumns.length === 0" class="cc-empty">{{ t.calendarNoDateColumns }}</div>
          </template>

          <!-- Fields tab -->
          <template v-else>
            <div class="cc-search-row">
              <div class="cc-search-box">
                <svg class="cc-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <input class="cc-search-input" type="text" v-model="fieldSearch" :placeholder="t.kanbanFieldsSearch" @click.stop />
              </div>
            </div>

            <div class="cc-fields-meta">
              <span>{{ fieldsCounterText }}</span>
              <span class="cc-fields-meta__hint">{{ t.calendarFieldsHint }}</span>
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
                :draggable="!fieldSearch && eventFields.includes(col.field)"
                @dragstart="onFieldDragStart(col.field)"
                @dragover.prevent="onFieldDragOver(col.field)"
                @drop.prevent="onFieldDrop(col.field)"
                @dragend="onFieldDragEnd"
              >
                <label class="cc-checkbox-wrap" :class="{ 'cc-checkbox-wrap--locked': isFieldDisabled(col.field) }">
                  <input
                    type="checkbox"
                    class="cc-checkbox"
                    :checked="eventFields.includes(col.field)"
                    :disabled="isFieldDisabled(col.field)"
                    @change="toggleEventField(col.field)"
                  />
                </label>
                <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !eventFields.includes(col.field) || !!fieldSearch }">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                    <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                    <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                    <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                  </svg>
                </span>
                <span class="cc-col-name">{{ col.headerName || col.field }}</span>
                <span v-if="eventFields.indexOf(col.field) === 0" class="cc-field-badge">{{ t.kanbanTitleBadge }}</span>
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
import CalendarEvent from './components/CalendarEvent.vue';
import { getTranslations } from '../shared/utils/sharedHelpers.js';
import { fetchSupabaseDataInfinite } from '../shared/utils/supabaseUtils.js';
import {
  parseEventDate,
  startOfDay,
  dayKey,
  isSameDay,
  addDays,
  getRange,
  buildMonthGrid,
  daysBetween,
  bucketEventsByDay,
  weekdayNames,
  periodLabel,
  monthName,
  formatTime,
} from './utils/calendarUtils.js';

const MAX_EVENT_FIELDS = 5;
const MONTH_CELL_CAP = 3;
const HOUR_PX = 44;
const SLOT_PX = 52; // assumed time-grid card height, used to detect overlaps
const TIMEGRID_GAP = 8; // minimum vertical gap between stacked time-grid events
const TIMEFRAMES = ['day', 'week', 'month', 'year', 'custom'];

// Navigation workflow run on event click — same global workflow + parameters as
// the grid's navigation button. `tab` is the value of a global formula.
const NAV_WORKFLOW_ID = 'd4ab2a61-2728-4dc3-a144-9fd3d558411e';
const NAV_TAB_FORMULA_ID = 'ec0f4ece-48ed-4145-b0a3-eb9985f1e4bd';

export default {
  name: 'Calendar',
  components: { CalendarEvent },
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

    // Merged config — identical pattern to Datagrid.vue / Kanban.vue.
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

    const t = computed(() => getTranslations(cfg.value?.lang || 'en'));
    const lang = computed(() => cfg.value?.lang || 'en');

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

    // Root height — keeps the calendar height-bounded so it scrolls internally
    // instead of overflowing its WeWeb wrapper.
    //  - "auto" Height Mode: size to content (the page scrolls).
    //  - "fixed" Height Mode: use the configured Grid Height. An empty or "auto"
    //    Grid Height means "fill the wrapper" (height:100%), so the calendar
    //    adapts to a wrapper sized by the surrounding page layout. A px value
    //    (e.g. 600px) gives the calendar its own bounded height instead.
    const rootStyle = computed(() => {
      if (cfg.value?.layout === 'auto') return {};
      const h = cfg.value?.height;
      const fill = !h || h === 'auto';
      return { height: fill ? '100%' : h, minHeight: '0' };
    });

    // ---- Local state, hydrated from viewConfiguration.calendar ----
    const dateField = ref(null);
    const eventFields = ref([]);
    const colorByField = ref(null);
    const timeframe = ref('month');
    const anchorDate = ref(startOfDay(new Date()));
    const customStart = ref('');
    const customEnd = ref('');
    const weekStartsOn = ref(1);

    const showConfig = ref(false);
    const activeTab = ref('date');
    const fieldSearch = ref('');

    const fieldDrag = ref(null);
    const fieldDragOver = ref(null);

    const rootRef = ref(null);
    const configPanelRef = ref(null);

    // viewEdited write gating (mirrors Kanban).
    const isApplyingConfig = ref(true);
    const firstApplyDone = ref(false);
    let applyConfigGen = 0;

    const findColumn = (field) => {
      if (!field) return null;
      return (cfg.value?.columns || []).find(c => c?.field === field) || null;
    };

    const dateColumns = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols.filter(c => c && c.field && (c.cellDataType === 'dateString' || c.cellDataType === 'dateTime'));
    });

    const selectColumns = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols.filter(c => c && c.field && c.cellDataType === 'select');
    });

    const availableFields = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols.filter(c => c && c.field && c.cellDataType !== 'action');
    });

    const firstFieldFallback = () => {
      const first = availableFields.value[0];
      return first ? [first.field] : [];
    };

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
      const validFields = new Set((cfg.value?.columns || []).map(col => col?.field).filter(Boolean));
      const validDate = (f) => dateColumns.value.some(col => col.field === f);

      if (c) {
        dateField.value = c.dateField && validDate(c.dateField) ? c.dateField : null;
        const cleaned = Array.isArray(c.eventFields)
          ? c.eventFields.filter(f => validFields.has(f)).slice(0, MAX_EVENT_FIELDS)
          : [];
        eventFields.value = cleaned.length ? cleaned : firstFieldFallback();
        colorByField.value = c.colorByField && selectColumns.value.some(col => col.field === c.colorByField) ? c.colorByField : null;
        timeframe.value = TIMEFRAMES.includes(c.timeframe) ? c.timeframe : 'month';
        // Always open on the current period (today), regardless of any persisted
        // anchor — the timeframe still applies, so you see the current day / week
        // / month / year. Navigation (prev/next) moves from here.
        anchorDate.value = startOfDay(new Date());
        customStart.value = c.customStart || '';
        customEnd.value = c.customEnd || '';
        weekStartsOn.value = c.weekStartsOn === 0 ? 0 : 1;
      } else {
        dateField.value = null;
        eventFields.value = firstFieldFallback();
        colorByField.value = null;
        timeframe.value = 'month';
        anchorDate.value = startOfDay(new Date());
        customStart.value = '';
        customEnd.value = '';
        weekStartsOn.value = 1;
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

    const { value: currentConfig, setValue: setCurrentConfig } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: 'currentConfig',
        type: 'object',
        defaultValue: { calendar: { dateField: null, eventFields: [], timeframe: 'month' } },
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
          eventFields: [...eventFields.value],
          colorByField: colorByField.value,
          timeframe: timeframe.value,
          anchorDate: dayKey(anchorDate.value),
          customStart: customStart.value || null,
          customEnd: customEnd.value || null,
          weekStartsOn: weekStartsOn.value,
        },
      };
      setCurrentConfig(config);

      if (isApplyingConfig.value || !firstApplyDone.value) return;
      const variableId = cfg.value?.viewEditedVariableId;
      if (!variableId) return;
      const baseline = readCalendarFromViewConfig() || {};
      const edited =
        (baseline.dateField ?? null) !== (dateField.value ?? null) ||
        !arraysEqual(baseline.eventFields || [], eventFields.value) ||
        (baseline.colorByField ?? null) !== (colorByField.value ?? null) ||
        (baseline.timeframe ?? 'month') !== timeframe.value ||
        ((baseline.weekStartsOn === 0 ? 0 : 1) !== weekStartsOn.value);
      try { wwLib.wwVariable.updateValue(variableId, edited); } catch (_) { /* noop */ }
    };

    watch(
      [dateField, eventFields, colorByField, timeframe, anchorDate, customStart, customEnd, weekStartsOn],
      () => writeCurrentConfig(),
      { deep: true }
    );
    watch(() => cfg.value?.viewConfiguration, () => applyViewConfig(), { deep: true });

    // Reapply when columns change (a column may have been removed).
    watch(() => cfg.value?.columns, () => {
      const validFields = new Set((cfg.value?.columns || []).map(c => c?.field).filter(Boolean));
      const nextFields = eventFields.value.filter(f => validFields.has(f));
      const dateInvalid = dateField.value && !dateColumns.value.some(col => col.field === dateField.value);
      const colorInvalid = colorByField.value && !selectColumns.value.some(col => col.field === colorByField.value);
      if (!arraysEqual(nextFields, eventFields.value) || dateInvalid || colorInvalid) {
        isApplyingConfig.value = true;
        const myGen = ++applyConfigGen;
        eventFields.value = nextFields.length ? nextFields : firstFieldFallback();
        if (dateInvalid) dateField.value = null;
        if (colorInvalid) colorByField.value = null;
        setTimeout(() => { if (myGen === applyConfigGen) isApplyingConfig.value = false; }, 0);
      }
    }, { deep: true });

    onMounted(() => applyViewConfig());

    // ---- Data ----
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
          formatFiltersForLog: () => '(calendar)',
        });
        supabaseRows.value = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn('[Calendar] Supabase fetch failed:', e?.message || e);
        supabaseRows.value = [];
      } finally {
        supabaseFetching.value = false;
      }
    };
    watch(
      () => [cfg.value?.dataSource, cfg.value?.supabaseTable, cfg.value?.supabaseQuery, cfg.value?.supabaseFilters, cfg.value?.kanbanMaxRows],
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
      if (fromFormula !== null && fromFormula !== undefined && fromFormula !== '') return String(fromFormula);
      return row?.id != null ? String(row.id) : null;
    };

    // ---- Derived: columns, events, ranges ----
    const dateColumn = computed(() => findColumn(dateField.value));
    const hasTime = computed(() => dateColumn.value?.cellDataType === 'dateTime');
    const colorByColumn = computed(() => findColumn(colorByField.value));

    const eventColumns = computed(() => {
      return eventFields.value.map(f => findColumn(f)).filter(Boolean);
    });

    const eventColor = (row) => {
      const col = colorByColumn.value;
      if (!col) return '';
      const v = row?.[col.field];
      if (v == null) return '';
      const opts = Array.isArray(col.options) ? col.options : [];
      const match = opts.find(o => String(o?.value) === String(v));
      return match?.color || '';
    };

    const parsed = computed(() => bucketEventsByDay(allRows.value, dateField.value));
    const buckets = computed(() => parsed.value.buckets);

    const range = computed(() =>
      getRange(timeframe.value, anchorDate.value, weekStartsOn.value, customStart.value, customEnd.value)
    );

    const rangeDays = computed(() => daysBetween(range.value.start, range.value.end));

    const isTimeGrid = computed(() =>
      (timeframe.value === 'day' || timeframe.value === 'week') && hasTime.value
    );

    // ---- Month ----
    const monthDays = computed(() => buildMonthGrid(anchorDate.value, weekStartsOn.value).flat());
    const dayEvents = (day) => buckets.value.get(dayKey(day)) || [];
    const dayEventCount = (day) => dayEvents(day).length;
    const cappedDayEvents = (day) =>
      dayEvents(day).slice(0, MONTH_CELL_CAP).map(e => ({ row: e.row, date: e.date, rowId: getRowId(e.row) }));

    // ---- Time-grid ----
    // Events are single points in time (no duration), anchored at their start
    // time (idealTop). Cards have variable height (depends on how many fields are
    // shown), so the actual non-overlap stacking is done after render by
    // measuring each card — see layoutTimeGrid() / eventTop().
    const timeGridEvents = (day) => {
      return dayEvents(day)
        .map(e => {
          const minutes = e.date.getHours() * 60 + e.date.getMinutes();
          return { row: e.row, date: e.date, rowId: getRowId(e.row), idealTop: (minutes / 60) * HOUR_PX };
        })
        .sort((a, b) => a.idealTop - b.idealTop);
    };

    // Measured non-overlap layout: key `${dayIndex}:${rowId}` -> resolved top px.
    const timeGridBodyRef = ref(null);
    const eventTops = ref(new Map());
    const eventTop = (di, ev) => {
      const v = eventTops.value.get(di + ':' + ev.rowId);
      return v != null ? v : ev.idealTop;
    };

    // For each day column, walk its event cards in time order and push each down
    // to clear the previous card's measured bottom + gap, so taller (multi-field)
    // cards never overlap the next event.
    const layoutTimeGrid = () => {
      const body = timeGridBodyRef.value;
      if (!body) return;
      const next = new Map();
      body.querySelectorAll('.cal-timegrid__col').forEach(col => {
        let lastBottom = -Infinity;
        col.querySelectorAll('.cal-timegrid__event').forEach(el => {
          const ideal = parseFloat(el.dataset.ideal) || 0;
          let top = ideal;
          if (top < lastBottom + TIMEGRID_GAP) top = lastBottom + TIMEGRID_GAP;
          lastBottom = top + (el.offsetHeight || SLOT_PX);
          next.set(el.dataset.tgKey, top);
        });
      });
      eventTops.value = next;
    };

    // Re-measure after any change that affects which cards render or how tall
    // they are. Heights are independent of `top`, so applying the new tops never
    // re-triggers a height change (no layout loop).
    watch(
      () => [allRows.value, eventFields.value, dateField.value, timeframe.value, anchorDate.value, weekStartsOn.value, hasTime.value],
      () => nextTick(layoutTimeGrid),
      { deep: true }
    );
    let timeGridRO = null;
    watch(timeGridBodyRef, (el) => {
      if (timeGridRO) { timeGridRO.disconnect(); timeGridRO = null; }
      if (el && typeof ResizeObserver !== 'undefined') {
        timeGridRO = new ResizeObserver(() => layoutTimeGrid());
        timeGridRO.observe(el);
      }
    });
    onMounted(() => nextTick(layoutTimeGrid));
    onBeforeUnmount(() => { if (timeGridRO) { timeGridRO.disconnect(); timeGridRO = null; } });

    // ---- Year ----
    const yearMonthDays = (monthIndex) =>
      buildMonthGrid(new Date(anchorDate.value.getFullYear(), monthIndex, 1), weekStartsOn.value).flat();
    const monthTitle = (monthIndex) => monthName(monthIndex, lang.value, 'long');

    // ---- Agenda ----
    const agendaDays = computed(() => {
      const days = rangeDays.value;
      const out = [];
      for (const day of days) {
        const evs = (buckets.value.get(dayKey(day)) || [])
          .map(e => ({ row: e.row, date: e.date, rowId: getRowId(e.row) }));
        if (evs.length) out.push({ key: dayKey(day), day, events: evs });
      }
      return out;
    });

    // ---- Labels ----
    const weekdayLabels = computed(() => {
      if (timeframe.value === 'day') {
        // Single column header for day view
        return [weekdayNames(lang.value, anchorDate.value.getDay(), 'short')[0]];
      }
      return weekdayNames(lang.value, weekStartsOn.value, 'short');
    });
    const weekdayLabelsNarrow = computed(() => weekdayNames(lang.value, weekStartsOn.value, 'narrow'));
    const periodTitle = computed(() => periodLabel(timeframe.value, anchorDate.value, lang.value, range.value));

    const isToday = (day) => isSameDay(day, new Date());
    const formatTimeLabel = (date) => formatTime(date, lang.value);
    const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
    const agendaDateLabel = (day) => periodLabel('day', day, lang.value);

    // ---- Navigation ----
    const goPrev = () => shiftAnchor(-1);
    const goNext = () => shiftAnchor(1);
    const goToday = () => { anchorDate.value = startOfDay(new Date()); };
    const shiftAnchor = (dir) => {
      const a = anchorDate.value;
      switch (timeframe.value) {
        case 'day': anchorDate.value = addDays(a, dir); break;
        case 'week': anchorDate.value = addDays(a, dir * 7); break;
        case 'year': anchorDate.value = new Date(a.getFullYear() + dir, a.getMonth(), a.getDate()); break;
        case 'custom': {
          const span = Math.max(1, rangeDays.value.length);
          anchorDate.value = addDays(a, dir * span);
          break;
        }
        case 'month':
        default: anchorDate.value = new Date(a.getFullYear(), a.getMonth() + dir, 1); break;
      }
    };

    const setTimeframe = (f) => { if (TIMEFRAMES.includes(f)) timeframe.value = f; };
    const drillToDay = (day) => { anchorDate.value = startOfDay(day); timeframe.value = 'day'; };
    const drillToMonth = (monthIndex) => {
      anchorDate.value = new Date(anchorDate.value.getFullYear(), monthIndex, 1);
      timeframe.value = 'month';
    };
    const setCustomStart = (v) => { customStart.value = v || ''; };
    const setCustomEnd = (v) => { customEnd.value = v || ''; };
    const setWeekStart = (v) => { weekStartsOn.value = v === 0 ? 0 : 1; };

    // ---- Config: date / color / fields ----
    const setDateField = (field) => { dateField.value = field || null; };
    const setColorByField = (field) => { colorByField.value = field || null; };

    const fieldsCounterText = computed(() =>
      t.value.kanbanFieldsCounter.replace('{count}', eventFields.value.length).replace('{max}', MAX_EVENT_FIELDS)
    );
    const maxFieldsTooltip = computed(() =>
      (t.value.kanbanMaxFields || 'Maximum {max} fields').replace('{max}', MAX_EVENT_FIELDS)
    );

    const filteredFieldList = computed(() => {
      const q = fieldSearch.value.trim().toLowerCase();
      const list = availableFields.value;
      if (!q) {
        const selected = eventFields.value.map(f => list.find(c => c.field === f)).filter(Boolean);
        const unselected = list.filter(c => !eventFields.value.includes(c.field));
        return [...selected, ...unselected];
      }
      return list.filter(c => (c.headerName || c.field).toLowerCase().includes(q));
    });

    const isFieldDisabled = (field) => {
      if (eventFields.value.includes(field)) return false;
      return eventFields.value.length >= MAX_EVENT_FIELDS;
    };

    const toggleEventField = (field) => {
      const idx = eventFields.value.indexOf(field);
      if (idx >= 0) {
        // Enforce min 1 — can't remove the last remaining field.
        if (eventFields.value.length <= 1) return;
        eventFields.value = eventFields.value.filter(f => f !== field);
      } else if (eventFields.value.length < MAX_EVENT_FIELDS) {
        eventFields.value = [...eventFields.value, field];
      }
    };

    const onFieldDragStart = (field) => { if (eventFields.value.includes(field)) fieldDrag.value = field; };
    const onFieldDragOver = (field) => {
      if (!fieldDrag.value) return;
      if (eventFields.value.includes(field)) fieldDragOver.value = field;
    };
    const onFieldDrop = (target) => {
      const src = fieldDrag.value;
      fieldDrag.value = null;
      fieldDragOver.value = null;
      if (!src || src === target) return;
      if (!eventFields.value.includes(target) || !eventFields.value.includes(src)) return;
      const arr = [...eventFields.value];
      arr.splice(arr.indexOf(src), 1);
      arr.splice(arr.indexOf(target), 0, src);
      eventFields.value = arr;
    };
    const onFieldDragEnd = () => { fieldDrag.value = null; fieldDragOver.value = null; };

    // ---- Event click ----
    // Runs the same global navigation workflow as the grid's navigation button,
    // with the same parameters: { tab, id, openNewTab }. `tab` is the value of a
    // global formula; `id` is the clicked row's id. Also emits 'rowClicked' for
    // parity with the grid/kanban card click.
    const onEventClick = (row) => {
      const idFromFormula = resolveMappingFormula(cfg.value?.idFormula, row);
      const id =
        idFromFormula !== null && idFromFormula !== undefined && idFromFormula !== ''
          ? idFromFormula
          : row?.id;

      let tab = null;
      try {
        tab = resolveMappingFormula({ type: 'f', code: `formulas['${NAV_TAB_FORMULA_ID}']()` }, row);
      } catch (_) { /* noop */ }

      try {
        wwLib.wwWorkflow.executeGlobal(NAV_WORKFLOW_ID, { tab, id, openNewTab: false });
      } catch (e) {
        console.warn('[Calendar] navigation workflow failed:', e?.message || e);
      }

      ctx.emit('trigger-event', {
        name: 'rowClicked',
        event: { row, id: getRowId(row), index: 0, displayIndex: 0 },
      });
    };

    // ---- Month hover preview ----
    // Hovering a compact month chip shows the full event card (like the day
    // view) in a floating, non-interactive popover positioned near the chip.
    const hoverEvent = ref(null);
    const hoverPos = ref({ top: 0, left: 0 });
    let hoverHideTimer = null;
    const HOVER_CARD_W = 260;
    const onEventHover = (ev, domEvent) => {
      const el = domEvent?.currentTarget;
      if (!el) return;
      if (hoverHideTimer) { clearTimeout(hoverHideTimer); hoverHideTimer = null; }
      const rect = el.getBoundingClientRect();
      const win = (wwLib.getFrontWindow && wwLib.getFrontWindow()) || window;
      let left = rect.left;
      if (left + HOVER_CARD_W > win.innerWidth - 8) left = win.innerWidth - HOVER_CARD_W - 8;
      hoverPos.value = { top: rect.bottom + 4, left: Math.max(8, left) };
      hoverEvent.value = ev;
    };
    const onEventLeave = () => {
      if (hoverHideTimer) clearTimeout(hoverHideTimer);
      // Small delay so moving between adjacent chips doesn't flicker the popover.
      hoverHideTimer = setTimeout(() => { hoverEvent.value = null; hoverHideTimer = null; }, 60);
    };

    // ---- Config panel open/close (driven by columnChooserVariableId) ----
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
      const varId = cfg.value?.columnChooserVariableId;
      if (varId) { try { wwLib.wwVariable.updateValue(varId, val); } catch (_) { /* noop */ } }
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
      if (hoverHideTimer) clearTimeout(hoverHideTimer);
      try { wwLib.getFrontDocument().removeEventListener('click', onDocumentClick); } catch (_) { /* noop */ }
    });

    // Exposed method (matches the forwarded-method contract in wwElement.vue).
    const refreshData = () => fetchSupabase();

    return {
      // refs
      rootRef, configPanelRef, timeGridBodyRef,
      // state
      cfg, cssVars, rootStyle, t,
      dateField, eventFields, colorByField, timeframe, anchorDate,
      customStart, customEnd, weekStartsOn,
      showConfig, activeTab, fieldSearch,
      fieldDrag, fieldDragOver,
      // constants
      MAX_EVENT_FIELDS, MONTH_CELL_CAP, HOUR_PX, timeframes: TIMEFRAMES,
      // computed
      dateColumns, selectColumns, availableFields, filteredFieldList,
      hasTime, isTimeGrid, eventColumns,
      monthDays, rangeDays, agendaDays,
      weekdayLabels, weekdayLabelsNarrow, periodTitle,
      fieldsCounterText, maxFieldsTooltip,
      // methods
      resolveMappingFormula, getRowId,
      eventColor, dayEvents, dayEventCount, cappedDayEvents, timeGridEvents, eventTop,
      hoverEvent, hoverPos, onEventHover, onEventLeave,
      yearMonthDays, monthTitle, isToday, formatTimeLabel, hourLabel, agendaDateLabel,
      goPrev, goNext, goToday, setTimeframe, drillToDay, drillToMonth,
      setCustomStart, setCustomEnd, setWeekStart,
      setDateField, setColorByField, isFieldDisabled, toggleEventField,
      onFieldDragStart, onFieldDragOver, onFieldDrop, onFieldDragEnd,
      onEventClick, refreshData,
    };
  },
};
</script>

<style scoped lang="scss">
.ww-calendar {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  /* Height is driven inline by `rootStyle` (Height Mode / Grid Height) so the
     component is always bounded and scrolls internally. min-height:0 lets the
     flex children shrink and own their scroll areas. */
  min-height: 0;
  background: var(--ag-background-color, #ffffff);
  color: var(--ag-foreground-color, #1f2937);
  font-family: 'Work Sans', sans-serif;
}

/* ===================== Empty state ===================== */
.cal-empty {
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
.cal-empty__title { font-size: 18px; font-weight: 600; }
.cal-empty__subtitle {
  font-size: 13px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
  max-width: 380px;
  line-height: 1.4;
}

/* ===================== Toolbar ===================== */
.cal-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  flex-wrap: wrap;
}
.cal-toolbar__nav { display: flex; align-items: center; gap: 6px; }
.cal-toolbar__title {
  flex: 1 1 auto;
  font-size: 15px;
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-toolbar__frames { display: flex; gap: 2px; }

.cal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--ag-background-color, #fff);
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.12));
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-foreground-color, #1f2937);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.cal-btn:hover { background: color-mix(in srgb, var(--ag-foreground-color, #000) 6%, transparent); }
.cal-btn--icon { padding: 5px; }

.cal-frame-btn {
  appearance: none;
  background: none;
  border: 1px solid transparent;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ag-foreground-color, #1f2937) 65%, transparent);
  border-radius: 6px;
  cursor: pointer;
  text-transform: capitalize;
  transition: background 0.12s, color 0.12s;
}
.cal-frame-btn:hover { background: color-mix(in srgb, var(--ag-foreground-color, #000) 6%, transparent); }
.cal-frame-btn--active {
  color: #fff;
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
}

.cal-custom-range {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
}
.cal-custom-range__field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: color-mix(in srgb, var(--ag-foreground-color, #1f2937) 70%, transparent);
}
.cal-custom-range__field input {
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  color: var(--ag-foreground-color, #1f2937);
  background: var(--ag-background-color, #fff);
}

/* ===================== Month ===================== */
.cal-month {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
}
.cal-month__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-month__weekday {
  padding: 6px 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 60%, transparent);
}
.cal-month__grid {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: 1fr;
  border-top: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  border-left: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  min-height: 0;
}
.cal-month__cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  border-right: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  min-height: 0;
  overflow: hidden;
}
.cal-month__cell--out { background: color-mix(in srgb, var(--ag-foreground-color, #000) 3%, transparent); }
.cal-month__cell--out .cal-month__date { opacity: 0.45; }
.cal-month__date {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 50%;
  cursor: pointer;
  line-height: 1.4;
}
.cal-month__cell--today .cal-month__date {
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: #fff;
}
.cal-month__events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 0;
}
.cal-month__more {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--ww-data-grid_cc-accent-color, #3b82f6);
  cursor: pointer;
}

/* ===================== Time-grid ===================== */
.cal-timegrid {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.cal-timegrid__head {
  display: flex;
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
}
.cal-timegrid__gutter-head { flex: 0 0 56px; }
.cal-timegrid__day-head {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  border-left: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
}
.cal-timegrid__day-name {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 60%, transparent);
}
.cal-timegrid__day-num { font-size: 15px; font-weight: 600; }
.cal-timegrid__day-head--today .cal-timegrid__day-num { color: var(--ww-data-grid_cc-accent-color, #3b82f6); }

.cal-timegrid__body {
  flex: 1 1 auto;
  display: flex;
  overflow-y: auto;
  min-height: 0;
}
.cal-timegrid__gutter { flex: 0 0 56px; }
.cal-timegrid__hour-label {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 2px 6px 0 0;
  font-size: 10px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 60%, transparent);
  box-sizing: border-box;
}
.cal-timegrid__col {
  position: relative;
  flex: 1 1 0;
  border-left: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
}
.cal-timegrid__col--today { background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 4%, transparent); }
.cal-timegrid__hour-line {
  border-bottom: 1px solid color-mix(in srgb, var(--ag-border-color, rgba(0, 0, 0, 0.08)) 60%, transparent);
  box-sizing: border-box;
}
.cal-timegrid__event {
  position: absolute;
  left: 3px;
  right: 3px;
  /* Only `top` is set inline. Overlapping events are pushed down (not split into
     columns), so each card spans the full column width. No fixed height:
     single-point events size to their content so the border isn't clipped. */
}

/* ===================== Year ===================== */
.cal-year {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  padding: 14px;
  overflow-y: auto;
  min-height: 0;
}
.cal-year__month {
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  padding: 8px;
}
.cal-year__month-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: capitalize;
  margin-bottom: 6px;
  cursor: pointer;
}
.cal-year__weekdays,
.cal-year__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-year__weekdays span {
  text-align: center;
  font-size: 9px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 55%, transparent);
  padding-bottom: 2px;
}
.cal-year__day {
  position: relative;
  appearance: none;
  background: none;
  border: none;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--ag-foreground-color, #1f2937);
  cursor: pointer;
  border-radius: 50%;
}
.cal-year__day:hover { background: color-mix(in srgb, var(--ag-foreground-color, #000) 8%, transparent); }
.cal-year__day--out { color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 40%, transparent); }
.cal-year__day--today {
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: #fff;
}
.cal-year__day--has { font-weight: 700; }
.cal-year__dot {
  position: absolute;
  bottom: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ww-data-grid_cc-accent-color, #3b82f6);
}
.cal-year__day--today .cal-year__dot { background: #fff; }

/* ===================== Agenda ===================== */
.cal-agenda {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
}
.cal-agenda__empty {
  margin: auto;
  font-size: 13px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
}
.cal-agenda__group {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.06));
}
.cal-agenda__date {
  flex: 0 0 110px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-top: 4px;
}
.cal-agenda__date-num { font-size: 20px; font-weight: 700; }
.cal-agenda__date-rest {
  font-size: 11px;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 70%, transparent);
}
.cal-agenda__date--today .cal-agenda__date-num { color: var(--ww-data-grid_cc-accent-color, #3b82f6); }
.cal-agenda__events {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* ===================== Month hover preview ===================== */
.cal-hover-card {
  position: fixed;
  z-index: 20;
  width: 260px;
  pointer-events: none; /* preview only — never steals hover from the chip */
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.2));
}

/* ===================== Config panel (mirrors kanban .cc-*) ===================== */
.cal-config-anchor { position: absolute; top: 0; right: 0; z-index: 10; }
.cal-cc-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: var(--ww-data-grid_cc-width, 300px);
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.08));
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
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.06));
}
.cc-title { font-size: 14px; font-weight: 700; }
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
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.06));
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
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.06));
}
.cc-group-select-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 65%, transparent);
}
.cc-group-select {
  flex: 1 1 auto;
  appearance: none;
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  cursor: pointer;
  &:focus { outline: none; border-color: var(--ww-data-grid_cc-accent-color, #3b82f6); }
}
.cc-group-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
}
.cc-group-toggle-label { font-size: 12px; }
.cc-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.06));
}
.cc-search-box { position: relative; flex: 1 1 auto; }
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
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, #1f2937);
  &:focus { outline: none; border-color: var(--ww-data-grid_cc-accent-color, #3b82f6); }
}
.cc-fields-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  font-size: 11px;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #1f2937) 60%, transparent);
}
.cc-fields-meta__hint { font-style: italic; }
.cc-list {
  display: flex;
  flex-direction: column;
  padding: 4px 8px 10px;
  max-height: 320px;
  overflow-y: auto;
}
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
.cc-row--dragging { opacity: 0.4; }
.cc-row--drag-over {
  background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 12%, transparent);
  border: 1px dashed var(--ww-data-grid_cc-accent-color, #3b82f6);
  padding: 5px 7px;
}
.cc-checkbox-wrap { display: inline-flex; align-items: center; cursor: pointer; }
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
.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
