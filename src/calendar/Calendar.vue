<template>
  <div class="ww-calendar" :class="{ 'is-compact': isCompactWidth, 'is-mobile': isMobileWidth }" :style="[cssVars, rootStyle]" ref="rootRef">
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
          <button
            type="button"
            class="cal-btn cal-btn--icon"
            :class="{ 'cal-btn--dragnav': dragData }"
            @click="goPrev"
            @dragenter.prevent="startDragNav(-1)"
            @dragover.prevent
            @dragleave="stopDragNav"
            :aria-label="t.calendarPrev"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button type="button" class="cal-btn cal-btn--today" @click="goToday">{{ t.calendarToday }}</button>
          <button
            type="button"
            class="cal-btn cal-btn--icon"
            :class="{ 'cal-btn--dragnav': dragData }"
            @click="goNext"
            @dragenter.prevent="startDragNav(1)"
            @dragover.prevent
            @dragleave="stopDragNav"
            :aria-label="t.calendarNext"
          >
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
              'cal-month__cell--drop': dragOverKey === dayKeyOf(day),
            }"
            @dragover.prevent="onDayDragOver(day)"
            @dragleave="onDayDragLeave(day)"
            @drop.prevent="onDayDrop(day)"
          >
            <div class="cal-month__date" @click="drillToDay(day)">{{ day.getDate() }}</div>
            <div class="cal-month__events">
              <CalendarEvent
                v-for="ev in cappedDayEvents(day)"
                :key="ev.rowId"
                compact
                :draggable="canEditDate"
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
                @dragstart="onEventDragStart(ev, $event)"
                @dragend="onEventDragEnd"
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
            <div v-for="h in 24" :key="h" class="cal-timegrid__hour-label" :style="{ height: hourPx + 'px' }">
              {{ hourLabel(h - 1) }}
            </div>
          </div>
          <div
            v-for="(day, di) in rangeDays"
            :key="di"
            class="cal-timegrid__col"
            :class="{
              'cal-timegrid__col--today': isToday(day),
              'cal-timegrid__col--drop': dragOverKey === 'col:' + di,
            }"
            @dragover.prevent="onColDragOver(di)"
            @dragleave="dragOverKey = null"
            @drop.prevent="onColDrop(day, $event)"
          >
            <div v-for="h in 24" :key="h" class="cal-timegrid__hour-line" :style="{ height: hourPx + 'px' }"></div>
            <div
              v-for="ev in timeGridEvents(day)"
              :key="ev.rowId"
              class="cal-timegrid__event"
              :data-tg-key="di + ':' + ev.rowId"
              :data-ideal="ev.idealTop"
              :style="{ top: eventTop(di, ev) + 'px' }"
            >
              <CalendarEvent
                :compact="isMobileWidth"
                :draggable="canEditDate"
                :fields="eventColumns"
                :row="ev.row"
                :resolve-mapping-formula="resolveMappingFormula"
                :color="eventColor(ev.row)"
                :time-label="formatTimeLabel(ev.date)"
                :cell-font-family="cfg.cellFontFamily || ''"
                :user-focus-color="cfg.userFocusColor || ''"
                @chip-click="onEventClick(ev.row)"
                @dragstart="onEventDragStart(ev, $event)"
                @dragend="onEventDragEnd"
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

      <!-- ============ WEEK COLUMNS (week, date-only column) ============ -->
      <div v-else-if="isWeekColumns" class="cal-weekcols">
        <div
          v-for="(day, di) in rangeDays"
          :key="di"
          class="cal-weekcols__col"
          :class="{
            'cal-weekcols__col--today': isToday(day),
            'cal-weekcols__col--drop': dragOverKey === dayKeyOf(day),
          }"
          @dragover.prevent="onDayDragOver(day)"
          @dragleave="onDayDragLeave(day)"
          @drop.prevent="onDayDrop(day)"
        >
          <div class="cal-weekcols__head" @click="drillToDay(day)">
            <span class="cal-weekcols__day-name">{{ weekdayLabels[di] }}</span>
            <span class="cal-weekcols__day-num">{{ day.getDate() }}</span>
          </div>
          <div class="cal-weekcols__body">
            <CalendarEvent
              v-for="ev in dayColumnEvents(day)"
              :key="ev.rowId"
              :compact="isMobileWidth"
              :draggable="canEditDate"
              :fields="eventColumns"
              :row="ev.row"
              :resolve-mapping-formula="resolveMappingFormula"
              :color="eventColor(ev.row)"
              :cell-font-family="cfg.cellFontFamily || ''"
              :user-focus-color="cfg.userFocusColor || ''"
              @chip-click="onEventClick(ev.row)"
              @dragstart="onEventDragStart(ev, $event)"
              @dragend="onEventDragEnd"
            />
            <div v-if="dayColumnEvents(day).length === 0" class="cal-weekcols__empty"></div>
          </div>
        </div>
      </div>

      <!-- ============ AGENDA (day without time, or custom) ============ -->
      <div v-else class="cal-agenda">
        <div v-if="agendaDays.length === 0" class="cal-agenda__empty">{{ t.calendarNoEvents }}</div>
        <div
          v-for="grp in agendaDays"
          :key="grp.key"
          class="cal-agenda__group"
          :class="{ 'cal-agenda__group--drop': dragOverKey === grp.key }"
          @dragover.prevent="onDayDragOver(grp.day)"
          @dragleave="onDayDragLeave(grp.day)"
          @drop.prevent="onDayDrop(grp.day)"
        >
          <div class="cal-agenda__date" :class="{ 'cal-agenda__date--today': isToday(grp.day) }">
            <span class="cal-agenda__date-num">{{ grp.day.getDate() }}</span>
            <span class="cal-agenda__date-rest">{{ agendaDateLabel(grp.day) }}</span>
          </div>
          <div class="cal-agenda__events">
            <CalendarEvent
              v-for="ev in grp.events"
              :key="ev.rowId"
              :draggable="canEditDate"
              :fields="eventColumns"
              :row="ev.row"
              :resolve-mapping-formula="resolveMappingFormula"
              :color="eventColor(ev.row)"
              :time-label="hasTime ? formatTimeLabel(ev.date) : ''"
              :cell-font-family="cfg.cellFontFamily || ''"
              :user-focus-color="cfg.userFocusColor || ''"
              @chip-click="onEventClick(ev.row)"
              @dragstart="onEventDragStart(ev, $event)"
              @dragend="onEventDragEnd"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Month hover preview: full event card (like the day view), non-interactive -->
    <div
      v-if="hoverEvent"
      ref="hoverCardRef"
      class="cal-hover-card"
      :style="{ top: hoverPos.top + 'px', left: hoverPos.left + 'px', opacity: hoverReady ? 1 : 0 }"
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
            <button v-if="cfg.enableFilterBuilder" type="button" class="cc-tab" :class="{ 'cc-tab--active': activeTab === 'filters' }" role="tab" @click="activeTab = 'filters'">{{ t.filtersTab || 'Filters' }}</button>
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
              <label class="cc-group-select-label">{{ t.calendarDefaultViewLabel }}</label>
              <select class="cc-group-select" :value="defaultView" @change="setDefaultView($event.target.value)">
                <option v-for="f in defaultViewOptions" :key="f" :value="f">{{ t['calendarFrame_' + f] }}</option>
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
          <template v-else-if="activeTab === 'fields'">
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
import CalendarEvent from './components/CalendarEvent.vue';
import FilterBuilder from '../shared/components/FilterBuilder.vue';
import { convertConditionsToSupabase } from '../shared/utils/convertConditionsToSupabase.js';
import { useAdvancedFilters } from '../shared/composables/useAdvancedFilters.js';
import { useRecordsVariable } from '../shared/composables/useRecordsVariable.js';
import { useResponsive } from '../shared/composables/useResponsive.js';
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

// Fallback WeWeb Object variable used to persist calendar navigation state when
// the "Calendar State — Variable ID" setting is left empty (e.g. on component
// instances placed before that setting existed). Overridden by the setting.
const DEFAULT_STATE_VAR_ID = '39535f5a-df56-47e4-b54a-8e963e02302f';

// Per-instance calendar navigation state (timeframe + anchor), keyed by uid.
// Module-level so it survives component unmount/remount during SPA page
// navigation, but resets on a full page reload.
const NAV_STATE_CACHE = new Map();

export default {
  name: 'Calendar',
  components: { CalendarEvent, FilterBuilder },
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
      // Filter Builder accent — driven by the cell Selection Border Color.
      '--ww-data-grid_filter-accent-color': cfg.value?.cellSelectionBorderColor || cfg.value?.columnChooserAccentColor || '#2563eb',
      '--ww-data-grid_cc-border-radius': cfg.value?.columnChooserBorderRadius || '8px',
      // Border used to mark the current day (instead of a background fill).
      // Driven by the "Selection Border Color" style property; falls back to
      // the accent color so today stays visible when it isn't set.
      '--cal-today-border-color': cfg.value?.cellSelectionBorderColor || cfg.value?.columnChooserAccentColor || '#3b82f6',
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

    // Filter Builder state (shared `advancedFilters` component variable).
    const {
      normalizedAdvancedFilters,
      setAdvancedFilters,
    } = useAdvancedFilters(props, { getDefault: () => cfg.value?.defaultAdvancedFilters });
    const filterBuilderColumns = computed(() => cfg.value?.columns || []);

    // ---- Local state, hydrated from viewConfiguration.calendar ----
    const dateField = ref(null);
    const eventFields = ref([]);
    const colorByField = ref(null);
    const defaultView = ref('month'); // saved default timeframe (part of the view)
    const timeframe = ref('month');   // live/navigated timeframe (not a saved edit)
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

    // Component-width based responsive state (toggles .is-compact / .is-mobile on
    // the root); all views reflow via CSS keyed off these classes.
    const { isCompact: isCompactWidth, isMobile: isMobileWidth } = useResponsive(rootRef);

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

    // Snapshot of the view-defining state. Excludes navigation state — the anchor
    // date, custom range, AND the timeframe — because moving between day/week/
    // month/year/custom is navigation, not a view edit. `viewEdited` is computed
    // against the LAST APPLIED snapshot (not the raw viewConfiguration), so
    // auto-applied defaults (e.g. the min-1 eventFields fallback) never count as
    // a user edit. Only the user changing the view's definition diverges.
    // Normalize an advanced-filters object for comparison/persistence.
    const normAdvanced = (v) => {
      const conditions = Array.isArray(v?.conditions) ? v.conditions : [];
      return { combinator: conditions.length ? (v?.combinator === 'or' ? 'or' : 'and') : 'and', conditions };
    };

    const snapshotViewState = () => ({
      dateField: dateField.value ?? null,
      eventFields: [...eventFields.value],
      colorByField: colorByField.value ?? null,
      defaultView: defaultView.value,
      weekStartsOn: weekStartsOn.value,
      advancedFilters: normAdvanced(normalizedAdvancedFilters.value),
    });
    let appliedBaseline = null;


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
        defaultView.value = defaultViewOptions.includes(c.defaultView) ? c.defaultView : 'month';
        // The calendar opens on the saved default view. Navigation moves from here.
        timeframe.value = defaultView.value;
        // Always open on the current period (today).
        anchorDate.value = startOfDay(new Date());
        customStart.value = c.customStart || '';
        customEnd.value = c.customEnd || '';
        weekStartsOn.value = c.weekStartsOn === 0 ? 0 : 1;
      } else {
        dateField.value = null;
        eventFields.value = firstFieldFallback();
        colorByField.value = null;
        defaultView.value = 'month';
        timeframe.value = 'month';
        anchorDate.value = startOfDay(new Date());
        customStart.value = '';
        customEnd.value = '';
        weekStartsOn.value = 1;
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

      // Baseline = exactly what we just applied, so the auto-defaults aren't
      // mistaken for user edits.
      appliedBaseline = snapshotViewState();

      setTimeout(() => {
        if (myGen !== applyConfigGen) return;
        isApplyingConfig.value = false;
        firstApplyDone.value = true;
        settleViewEdited();
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

    // True only when the user has diverged the view from the applied baseline.
    // The live `timeframe` is intentionally excluded — switching views is
    // navigation; only the saved `defaultView` counts as a view edit.
    const computeEdited = () => {
      const base = appliedBaseline || snapshotViewState();
      const curAdvanced = normAdvanced(normalizedAdvancedFilters.value);
      const baseAdvanced = base.advancedFilters || normAdvanced(null);
      return (
        base.dateField !== (dateField.value ?? null) ||
        !arraysEqual(base.eventFields, eventFields.value) ||
        base.colorByField !== (colorByField.value ?? null) ||
        base.defaultView !== defaultView.value ||
        base.weekStartsOn !== weekStartsOn.value ||
        baseAdvanced.combinator !== curAdvanced.combinator ||
        JSON.stringify(baseAdvanced.conditions) !== JSON.stringify(curAdvanced.conditions)
      );
    };
    // Write the current edited state to the shared WeWeb variable.
    const settleViewEdited = () => {
      const variableId = cfg.value?.viewEditedVariableId;
      if (!variableId) return;
      try { wwLib.wwVariable.updateValue(variableId, computeEdited()); } catch (_) { /* noop */ }
    };

    const writeCurrentConfig = () => {
      const config = {
        calendar: {
          dateField: dateField.value,
          eventFields: [...eventFields.value],
          colorByField: colorByField.value,
          defaultView: defaultView.value,
          timeframe: timeframe.value,
          anchorDate: dayKey(anchorDate.value),
          customStart: customStart.value || null,
          customEnd: customEnd.value || null,
          weekStartsOn: weekStartsOn.value,
        },
        advancedFilters: normAdvanced(normalizedAdvancedFilters.value),
      };
      setCurrentConfig(config);

      if (isApplyingConfig.value || !firstApplyDone.value) return;
      settleViewEdited();
    };

    watch(
      [dateField, eventFields, colorByField, defaultView, timeframe, anchorDate, customStart, customEnd, weekStartsOn, normalizedAdvancedFilters],
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
        // Programmatic normalization — fold it into the baseline so it isn't a "user edit".
        appliedBaseline = snapshotViewState();
        setTimeout(() => { if (myGen === applyConfigGen) isApplyingConfig.value = false; }, 0);
      }
    }, { deep: true });

    onMounted(() => applyViewConfig());

    // ---- Navigation state persistence (survives SPA page navigation) ----
    // The live timeframe + anchor (and custom range) are remembered per component
    // instance in a module-level cache, so leaving the calendar page and coming
    // back lands on the same day/week/month/year you were viewing. A full page
    // reload clears the cache, so fresh loads still open on today/default. This
    // is navigation only — it never touches viewEdited or the viewConfiguration.
    const buildNavState = () => ({
      timeframe: timeframe.value,
      anchorDate: dayKey(anchorDate.value),
      customStart: customStart.value || null,
      customEnd: customEnd.value || null,
    });

    // Optional durable persistence to a WeWeb Object variable. The variable
    // holds a map keyed by this calendar's `uid`, so a single Object variable
    // can be bound to several calendar instances without them clobbering each
    // other. Unlike NAV_STATE_CACHE (module-level, cleared on full reload), the
    // variable survives reloads and page navigation.
    const stateVarId = () => cfg.value?.calendarStateVariableId || DEFAULT_STATE_VAR_ID;
    const readNavStateVar = () => {
      const varId = stateVarId();
      if (!varId) return null;
      try {
        const all = wwLib.wwVariable.getValue(varId);
        const entry = all && typeof all === 'object' ? all[props.uid] : null;
        return entry && typeof entry === 'object' ? entry : null;
      } catch (_) { return null; }
    };
    const writeNavStateVar = (state) => {
      const varId = stateVarId();
      if (!varId) return;
      try {
        const current = wwLib.wwVariable.getValue(varId);
        const next = current && typeof current === 'object' ? { ...current } : {};
        next[props.uid] = state;
        wwLib.wwVariable.updateValue(varId, next);
      } catch (_) { /* noop */ }
    };

    const saveNavState = () => {
      const state = buildNavState();
      NAV_STATE_CACHE.set(props.uid, state);
      writeNavStateVar(state);
    };
    const applyNavState = (s) => {
      if (!s || typeof s !== 'object') return false;
      if (TIMEFRAMES.includes(s.timeframe)) timeframe.value = s.timeframe;
      const d = s.anchorDate ? parseEventDate(s.anchorDate) : null;
      if (d) anchorDate.value = startOfDay(d);
      customStart.value = s.customStart || '';
      customEnd.value = s.customEnd || '';
      return true;
    };
    const restoreNavState = () => {
      // The durable variable wins over the in-memory cache when both exist, so
      // a fresh page load restores the last saved position.
      applyNavState(readNavStateVar()) || applyNavState(NAV_STATE_CACHE.get(props.uid));
    };

    // Registered AFTER the applyViewConfig onMounted above, so it runs after the
    // defaults (today / default view) are set and overrides them with the last
    // position. navReady gates saves so the apply phase doesn't clobber storage.
    const navReady = ref(false);
    onMounted(() => {
      restoreNavState();
      // Persist the current state once on load so the variable is populated
      // immediately (not only after the first navigation).
      saveNavState();
      nextTick(() => { navReady.value = true; });
    });
    watch([timeframe, anchorDate, customStart, customEnd], () => { if (navReady.value) saveNavState(); });

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
      () => [cfg.value?.dataSource, cfg.value?.supabaseTable, cfg.value?.supabaseQuery, cfg.value?.supabaseFilters, cfg.value?.kanbanMaxRows, normalizedAdvancedFilters.value],
      () => fetchSupabase(),
      { deep: true }
    );
    onMounted(() => fetchSupabase());

    const allRows = computed(() => {
      if (cfg.value?.dataSource === 'supabase') return supabaseRows.value;
      const data = wwLib.wwUtils.getDataFromCollection(cfg.value?.rowData);
      return Array.isArray(data) ? data : [];
    });

    // Expose `records` / `isFetching` component variables (same names as the
    // datagrid) so bindings keep working when the calendar is the active view.
    useRecordsVariable(props, { rows: allRows, isFetching: supabaseFetching });

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
    // Week with a date-only column → Google-style day columns (no time grid).
    const isWeekColumns = computed(() => timeframe.value === 'week' && !hasTime.value);

    // ---- Month ----
    const monthDays = computed(() => buildMonthGrid(anchorDate.value, weekStartsOn.value).flat());
    const dayEvents = (day) => buckets.value.get(dayKey(day)) || [];
    const dayEventCount = (day) => dayEvents(day).length;
    const cappedDayEvents = (day) =>
      dayEvents(day).slice(0, MONTH_CELL_CAP).map(e => ({ row: e.row, date: e.date, rowId: getRowId(e.row) }));
    // All events for a day (week-columns layout), in time order.
    const dayColumnEvents = (day) =>
      dayEvents(day).map(e => ({ row: e.row, date: e.date, rowId: getRowId(e.row) }));

    // ---- Time-grid ----
    // Events are single points in time (no duration), anchored at their start
    // time (idealTop). Cards have variable height (depends on how many fields are
    // shown), so the actual non-overlap stacking is done after render by
    // measuring each card — see layoutTimeGrid() / eventTop().
    const timeGridEvents = (day) => {
      return dayEvents(day)
        .map(e => {
          const minutes = e.date.getHours() * 60 + e.date.getMinutes();
          return { row: e.row, date: e.date, rowId: getRowId(e.row), idealTop: (minutes / 60) * hourPx.value };
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

    // Hour row height. Stretches so the 24 hours fill the visible body height
    // (lines reach the bottom of the component); never shrinks below HOUR_PX, so
    // a short component scrolls instead.
    const hourPx = ref(HOUR_PX);
    const computeHourPx = () => {
      const body = timeGridBodyRef.value;
      const h = body?.clientHeight || 0;
      if (!h) return;
      hourPx.value = Math.max(HOUR_PX, h / 24);
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
    const relayoutTimeGrid = () => { computeHourPx(); nextTick(layoutTimeGrid); };
    let timeGridRO = null;
    watch(timeGridBodyRef, (el) => {
      if (timeGridRO) { timeGridRO.disconnect(); timeGridRO = null; }
      if (el && typeof ResizeObserver !== 'undefined') {
        timeGridRO = new ResizeObserver(() => relayoutTimeGrid());
        timeGridRO.observe(el);
      }
    });
    onMounted(() => nextTick(relayoutTimeGrid));
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
    // Selectable default views (custom is a navigation-only timeframe, not a default).
    const defaultViewOptions = TIMEFRAMES.filter(f => f !== 'custom');
    // Sets the saved default view and switches the current view to preview it.
    const setDefaultView = (v) => {
      if (!defaultViewOptions.includes(v)) return;
      defaultView.value = v;
      timeframe.value = v;
    };

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
    const hoverReady = ref(false); // gates visibility until measured & positioned
    const hoverCardRef = ref(null);
    let hoverHideTimer = null;
    let hoverSourceRect = null; // bounding rect of the hovered chip
    const HOVER_CARD_W = 260;
    const HOVER_MARGIN = 8;

    const onEventHover = (ev, domEvent) => {
      const el = domEvent?.currentTarget;
      if (!el) return;
      if (hoverHideTimer) { clearTimeout(hoverHideTimer); hoverHideTimer = null; }
      hoverSourceRect = el.getBoundingClientRect();
      // Provisional position; hidden (hoverReady=false) until measured next tick.
      hoverPos.value = { top: hoverSourceRect.bottom + 4, left: hoverSourceRect.left };
      hoverReady.value = false;
      hoverEvent.value = ev;
      nextTick(positionHoverCard);
    };

    // Clamp the preview so it stays inside BOTH the viewport and the calendar
    // wrapper. Prefers below the chip; flips above when it would overflow the
    // bottom. Measured after render so the real card height is used.
    const positionHoverCard = () => {
      const card = hoverCardRef.value;
      const rect = hoverSourceRect;
      if (!card || !rect) return;
      const win = (wwLib.getFrontWindow && wwLib.getFrontWindow()) || window;
      const root = rootRef.value;
      const rootRect = root
        ? root.getBoundingClientRect()
        : { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
      const cw = card.offsetWidth || HOVER_CARD_W;
      const ch = card.offsetHeight || 0;

      // Allowed bounds = intersection of viewport and wrapper, minus a margin.
      const minLeft = Math.max(HOVER_MARGIN, rootRect.left + 4);
      const maxRight = Math.min(win.innerWidth - HOVER_MARGIN, rootRect.right - 4);
      const minTop = Math.max(HOVER_MARGIN, rootRect.top + 4);
      const maxBottom = Math.min(win.innerHeight - HOVER_MARGIN, rootRect.bottom - 4);

      let left = Math.min(rect.left, maxRight - cw);
      left = Math.max(minLeft, left);

      let top = rect.bottom + 4;
      if (top + ch > maxBottom) {
        const above = rect.top - 4 - ch;
        top = above >= minTop ? above : Math.max(minTop, maxBottom - ch);
      }
      top = Math.max(minTop, Math.min(top, maxBottom - ch));

      hoverPos.value = { top, left };
      hoverReady.value = true;
    };

    const onEventLeave = () => {
      if (hoverHideTimer) clearTimeout(hoverHideTimer);
      // Small delay so moving between adjacent chips doesn't flicker the popover.
      hoverHideTimer = setTimeout(() => { hoverEvent.value = null; hoverHideTimer = null; }, 60);
    };

    // ---- Drag & drop to reschedule (only when the date column is editable) ----
    const canEditDate = computed(() => !!dateColumn.value?.editable);
    const dragData = ref(null);     // the event currently being dragged
    const dragOverKey = ref(null);  // dayKey or 'col:<index>' for drop highlight

    const onEventDragStart = (ev, domEvent) => {
      if (!canEditDate.value) { domEvent?.preventDefault?.(); return; }
      dragData.value = ev;
      hoverEvent.value = null;
      try {
        domEvent.dataTransfer.setData('text/plain', String(ev.rowId ?? ''));
        domEvent.dataTransfer.effectAllowed = 'move';
      } catch (_) { /* noop */ }
    };
    const onEventDragEnd = () => { dragData.value = null; dragOverKey.value = null; stopDragNav(); };

    // Hovering the prev/next buttons during a drag flips the period (month/week/…)
    // after a short dwell and keeps repeating, so you can drop on another month.
    let dragNavTimer = null;
    const stopDragNav = () => { if (dragNavTimer) { clearTimeout(dragNavTimer); dragNavTimer = null; } };
    const startDragNav = (dir) => {
      if (!dragData.value || dragNavTimer) return;
      const tick = () => {
        if (!dragData.value) { stopDragNav(); return; }
        if (dir < 0) goPrev(); else goNext();
        dragNavTimer = setTimeout(tick, 700);
      };
      dragNavTimer = setTimeout(tick, 600);
    };

    const onDayDragOver = (day) => { if (dragData.value) dragOverKey.value = dayKey(day); };
    const onDayDragLeave = (day) => { if (dragOverKey.value === dayKey(day)) dragOverKey.value = null; };
    const onDayDrop = (day) => {
      const ev = dragData.value;
      dragData.value = null; dragOverKey.value = null; stopDragNav();
      if (ev) rescheduleEvent(ev, day, null);
    };

    const onColDragOver = (di) => { if (dragData.value) dragOverKey.value = 'col:' + di; };
    const onColDrop = (day, domEvent) => {
      const ev = dragData.value;
      dragData.value = null; dragOverKey.value = null; stopDragNav();
      if (!ev) return;
      // Derive the drop time from the vertical position within the day column.
      let minutes = null;
      const el = domEvent?.currentTarget;
      if (el) {
        const rect = el.getBoundingClientRect();
        const y = domEvent.clientY - rect.top;
        minutes = Math.max(0, Math.min(23 * 60 + 45, Math.round(((y / hourPx.value) * 60) / 15) * 15));
      }
      rescheduleEvent(ev, day, minutes);
    };

    // Serialize the new Date back into the same shape as the original value so we
    // don't change the column's storage format (epoch / date-only / datetime).
    const serializeDateValue = (oldValue, d, col) => {
      const pad = (n) => String(n).padStart(2, '0');
      const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      if (typeof oldValue === 'number') {
        const ms = d.getTime();
        return oldValue < 1e12 ? Math.round(ms / 1000) : ms;
      }
      if (typeof oldValue === 'string' && /^\d+$/.test(oldValue.trim())) {
        const ms = d.getTime();
        return String(Number(oldValue.trim()) < 1e12 ? Math.round(ms / 1000) : ms);
      }
      if (col?.cellDataType === 'dateTime' || (typeof oldValue === 'string' && /\d{2}:\d{2}/.test(oldValue))) {
        return `${ymd}T${time}`;
      }
      return ymd;
    };

    const updateRowInSupabase = async (rowId, columnId, newValue) => {
      const updateTable = (cfg.value?.supabaseUpdateTable || '').trim();
      const queryTable = (cfg.value?.supabaseTable || '').trim();
      const tableName = updateTable || queryTable;
      if (!tableName) {
        console.warn('[Calendar] No writable target — set "Supabase Update Table" or handle cellValueChanged in a workflow.');
        return null;
      }
      const supabase = wwLib?.wwPlugins?.supabase?.instance;
      if (!supabase) { console.warn('[Calendar] Supabase plugin not available.'); return false; }
      const idFieldName = (cfg.value?.supabaseIdField || 'id').trim() || 'id';
      try {
        const { error } = await supabase.from(tableName).update({ [columnId]: newValue }).eq(idFieldName, rowId);
        if (error) {
          const msg = String(error.message || error).toLowerCase();
          const looksLikeViewError =
            msg.includes('cannot update') || msg.includes('not updatable') || msg.includes('updatable') ||
            error.code === '0A000' || error.code === '42809';
          if (looksLikeViewError && !updateTable) {
            console.warn(`[Calendar] UPDATE on "${tableName}" failed (non-updatable view?). Set "Supabase Update Table" or handle cellValueChanged in a workflow.`);
            return null;
          }
          console.warn('[Calendar] Supabase update error:', error.message || error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[Calendar] Supabase update threw:', e?.message || e);
        return false;
      }
    };

    // Optimistic local update + (optional) direct Supabase write + cellValueChanged.
    const rescheduleEvent = async (ev, targetDay, minutes) => {
      const col = dateColumn.value;
      if (!col || !canEditDate.value) return;
      const field = col.field;
      const row = ev.row;
      const oldValue = row?.[field];
      const orig = parseEventDate(oldValue) || new Date();
      const useMin = minutes != null ? minutes : orig.getHours() * 60 + orig.getMinutes();
      const nd = new Date(
        targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(),
        Math.floor(useMin / 60), useMin % 60, minutes != null ? 0 : orig.getSeconds(), 0
      );
      const newValue = serializeDateValue(oldValue, nd, col);
      if (newValue === oldValue) return;

      // Optimistic local update (rows are deep-reactive, so the event moves).
      try { row[field] = newValue; } catch (_) { /* noop */ }

      const directUpdate = !!col.isDirectUpdate;
      if (directUpdate && cfg.value?.dataSource === 'supabase') {
        const ok = await updateRowInSupabase(ev.rowId, field, newValue);
        if (ok === false) { try { row[field] = oldValue; } catch (_) { /* noop */ } return; }
      }

      ctx.emit('trigger-event', {
        name: 'cellValueChanged',
        event: { oldValue, newValue, columnId: field, row, isDirectUpdate: directUpdate },
      });
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
      stopDragNav();
      try { wwLib.getFrontDocument().removeEventListener('click', onDocumentClick); } catch (_) { /* noop */ }
    });

    // Exposed method (matches the forwarded-method contract in wwElement.vue).
    const refreshData = () => fetchSupabase();

    return {
      // refs
      rootRef, configPanelRef, timeGridBodyRef,
      // responsive
      isCompactWidth, isMobileWidth,
      // Filter Builder
      normalizedAdvancedFilters, setAdvancedFilters, filterBuilderColumns,
      // state
      cfg, cssVars, rootStyle, t,
      dateField, eventFields, colorByField, defaultView, timeframe, anchorDate,
      customStart, customEnd, weekStartsOn,
      showConfig, activeTab, fieldSearch,
      fieldDrag, fieldDragOver,
      // constants
      MAX_EVENT_FIELDS, MONTH_CELL_CAP, hourPx, timeframes: TIMEFRAMES,
      // computed
      dateColumns, selectColumns, availableFields, filteredFieldList,
      hasTime, isTimeGrid, isWeekColumns, eventColumns,
      monthDays, rangeDays, agendaDays,
      weekdayLabels, weekdayLabelsNarrow, periodTitle,
      fieldsCounterText, maxFieldsTooltip,
      // methods
      resolveMappingFormula, getRowId,
      eventColor, dayEvents, dayEventCount, cappedDayEvents, dayColumnEvents, timeGridEvents, eventTop,
      hoverEvent, hoverPos, hoverReady, hoverCardRef, onEventHover, onEventLeave,
      canEditDate, dragData, dragOverKey, dayKeyOf: dayKey,
      onEventDragStart, onEventDragEnd, startDragNav, stopDragNav,
      onDayDragOver, onDayDragLeave, onDayDrop, onColDragOver, onColDrop,
      yearMonthDays, monthTitle, isToday, formatTimeLabel, hourLabel, agendaDateLabel,
      goPrev, goNext, goToday, setTimeframe, drillToDay, drillToMonth,
      setCustomStart, setCustomEnd, setWeekStart, setDefaultView, defaultViewOptions,
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
/* While dragging, the nav buttons are drop-dwell targets; keep the icon from
   intercepting dragenter/dragleave so they fire on the button only. */
.cal-btn--icon svg { pointer-events: none; }
.cal-btn--dragnav {
  border-color: var(--ww-data-grid_cc-accent-color, #3b82f6);
  color: var(--ww-data-grid_cc-accent-color, #3b82f6);
}

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
/* Mark today with a border (selection border color) instead of a fill. */
.cal-month__cell--today {
  box-shadow: inset 0 0 0 2px var(--cal-today-border-color, var(--ww-data-grid_cc-accent-color, #3b82f6));
  border-radius: 8px;
}
.cal-month__events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  // `overflow-x: hidden` is explicit: with only `overflow-y: auto` the x axis
  // computes to `auto`, so an event chip touching the edge spawns a stray
  // horizontal scrollbar. Pairing both axes suppresses it.
  overflow: hidden auto;
  min-height: 0;
  min-width: 0;
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
  // x explicit (see .cal-month__events) — absolutely-positioned events are
  // already constrained by their left/right, so no horizontal scroll is wanted.
  overflow: hidden auto;
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
/* Mark today with a border (selection border color) instead of a fill. Inset
   box-shadow avoids the layout shift a real border would cause on the column. */
.cal-timegrid__col--today { box-shadow: inset 0 0 0 2px var(--cal-today-border-color, var(--ww-data-grid_cc-accent-color, #3b82f6)); border-radius: 8px; }
/* Drag & drop reschedule highlights */
.cal-month__cell--drop,
.cal-timegrid__col--drop,
.cal-agenda__group--drop {
  background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 12%, transparent);
  outline: 1px dashed var(--ww-data-grid_cc-accent-color, #3b82f6);
  outline-offset: -1px;
}
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

/* ===================== Week columns (date-only week) ===================== */
.cal-weekcols {
  /* Fill the calendar's remaining height when it is bounded; never collapse
     below this floor when it isn't (date-only columns have little content, so
     without a floor the day columns would shrink to their content height). */
  flex: 1 1 auto;
  display: flex;
  align-items: stretch; /* columns fill the full height so their borders reach the bottom */
  min-height: 420px;
  overflow: hidden;
}
.cal-weekcols__col {
  flex: 1 1 0;
  /* `align-self: stretch` fills the full available height — but only when the
     height stays `auto`. Setting an explicit `height: 100%` here disables the
     stretch and collapses to content height whenever the calendar isn't
     bounded by a definite-height wrapper, so it is intentionally omitted. */
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
}
.cal-weekcols__col:first-child { border-left: none; }
/* Mark today with a border (selection border color) instead of a fill. */
.cal-weekcols__col--today { box-shadow: inset 0 0 0 2px var(--cal-today-border-color, var(--ww-data-grid_cc-accent-color, #3b82f6)); border-radius: 8px; }
.cal-weekcols__col--drop {
  background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 12%, transparent);
  outline: 1px dashed var(--ww-data-grid_cc-accent-color, #3b82f6);
  outline-offset: -1px;
}
.cal-weekcols__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.08));
  cursor: pointer;
}
.cal-weekcols__day-name {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ag-foreground-color, #6b7280) 60%, transparent);
}
.cal-weekcols__day-num { font-size: 16px; font-weight: 600; }
.cal-weekcols__col--today .cal-weekcols__day-num { color: var(--ww-data-grid_cc-accent-color, #3b82f6); }
.cal-weekcols__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px;
  overflow: hidden auto;
  min-height: 0;
  min-width: 0;
}
.cal-weekcols__empty { flex: 1 1 auto; min-height: 20px; }

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
  overflow: hidden auto;
  min-height: 0;
  min-width: 0;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding-top: 4px;
}
.cal-agenda__date-num { font-size: 20px; font-weight: 700; line-height: 1.1; }
.cal-agenda__date-rest {
  font-size: 11px;
  line-height: 1.3;
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
  transition: opacity 0.08s ease;
}

/* ===================== Config panel (mirrors kanban .cc-*) ===================== */
.cal-config-anchor { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
.cal-cc-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  pointer-events: auto;
  width: 760px;
  max-width: calc(100% - 24px);
  box-sizing: border-box;
  background: var(--ww-data-grid_cc-background, #ffffff);
  border: 1px solid var(--ww-data-grid_cc-border-color, rgba(0, 0, 0, 0.08));
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
.cc-checkbox-wrap { display: inline-flex; align-items: center; flex-shrink: 0; cursor: pointer; }
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

/* ===================== Mobile (component width based) ===================== */
// All 5 views stay available on mobile; each reflows for narrow widths and
// bigger touch targets. Keyed off the .is-compact / .is-mobile classes set by
// useResponsive (the toolbar already wraps via flex-wrap).
.ww-calendar.is-compact {
  // Roomier tap targets on the toolbar controls.
  .cal-btn { padding: 7px 12px; font-size: 13px; }
  .cal-btn--icon { padding: 7px; }
  .cal-frame-btn { padding: 6px 10px; }
}

.ww-calendar.is-mobile {
  // ---- Month: tighter cells, smaller chips so 7 columns stay legible. ----
  .cal-month__cell { padding: 2px; gap: 2px; }
  .cal-month__date { font-size: 11px; padding: 1px 4px; }

  // ---- Time-grid (day/week): slimmer gutter, larger hour labels, wider
  // event side margins for touch. ----
  .cal-timegrid__gutter-head,
  .cal-timegrid__gutter { flex-basis: 40px; }
  .cal-timegrid__hour-label { font-size: 11px; padding-right: 4px; }
  .cal-timegrid__event { left: 5px; right: 5px; }

  // ---- Week columns: keep the base full-height fill (flex:1 + 420px floor);
  // the 7 day columns share the width equally so they fit without horizontal
  // scroll. (Overriding min-height here collapses the columns to header height.)

  // ---- Compact chips in the narrow day columns (week + time-grid): let the
  // title wrap to multiple lines instead of truncating, so it stays readable in
  // ~55px-wide columns. Scoped to these containers via :deep so the month
  // view's tiny cells keep single-line chips. ----
  .cal-weekcols :deep(.cal-event--compact),
  .cal-timegrid :deep(.cal-event--compact) {
    align-items: flex-start;
  }
  .cal-weekcols :deep(.cal-event__compact-title),
  .cal-timegrid :deep(.cal-event__compact-title) {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere; // break a long unbroken word to fit the column
  }

  // ---- Year: smaller month tiles so two-ish fit per row. ----
  .cal-year { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 10px; }

  // ---- Agenda: narrower date column. ----
  .cal-agenda__group { gap: 8px; }
  .cal-agenda__date { flex-basis: 76px; }
  .cal-agenda__date-num { font-size: 18px; }

  // ---- Config panel: fill the component as a sheet. ----
  .cal-cc-panel {
    top: 8px;
    right: 8px;
    left: 8px;
    width: auto;
    max-width: none;
    max-height: calc(100% - 16px);
  }
}
</style>
