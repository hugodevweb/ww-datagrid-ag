// Pure date helpers for the Calendar view. No Vue / WeWeb dependencies so they
// stay trivially testable and reusable across the calendar's render modes.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a raw cell value into a JS Date.
 * Mirrors the datagrid's `new Date(value)` approach (see columnFactories.js),
 * with extra handling for epoch numbers (seconds vs milliseconds).
 * @param {*} value - raw cell value (ISO string, Date, or epoch number)
 * @returns {Date|null}
 */
export function parseEventDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    // Heuristic: 10-digit values are epoch seconds, 13-digit are milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    // Numeric strings (epoch as string) — treat like numbers.
    if (/^\d+$/.test(s)) return parseEventDate(Number(s));
    // Pure date strings (yyyy-mm-dd) — build at LOCAL midnight. `new Date('yyyy-mm-dd')`
    // would parse as UTC and can shift the day in negative-offset timezones.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Local-midnight copy of a date (drops the time component). */
export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Stable yyyy-mm-dd key in local time (NOT UTC — avoids off-by-one bucketing). */
export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when two dates fall on the same local calendar day. */
export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * First day of the week containing `date`, honoring weekStartsOn (0=Sun, 1=Mon).
 */
export function startOfWeek(date, weekStartsOn = 1) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0..6, Sun=0
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/**
 * Inclusive-start / exclusive-end range for a timeframe anchored on `anchor`.
 * @returns {{start: Date, end: Date}} end is exclusive (start of the day after).
 */
export function getRange(timeframe, anchor, weekStartsOn = 1, customStart = null, customEnd = null) {
  const a = startOfDay(anchor);
  switch (timeframe) {
    case 'day':
      return { start: a, end: addDays(a, 1) };
    case 'week': {
      const start = startOfWeek(a, weekStartsOn);
      return { start, end: addDays(start, 7) };
    }
    case 'year': {
      const start = new Date(a.getFullYear(), 0, 1);
      const end = new Date(a.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    case 'custom': {
      const cs = customStart ? parseEventDate(customStart) : null;
      const ce = customEnd ? parseEventDate(customEnd) : null;
      const start = cs ? startOfDay(cs) : a;
      // end is exclusive → add a day so the custom-end day is included.
      const end = ce ? addDays(startOfDay(ce), 1) : addDays(start, 1);
      return { start, end: end > start ? end : addDays(start, 1) };
    }
    case 'month':
    default: {
      const start = new Date(a.getFullYear(), a.getMonth(), 1);
      const end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
      return { start, end };
    }
  }
}

/**
 * 6×7 grid of Dates covering the month containing `anchor`, padded with
 * leading/trailing days so every row has 7 cells starting on weekStartsOn.
 * @returns {Date[][]} weeks → days
 */
export function buildMonthGrid(anchor, weekStartsOn = 1) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first, weekStartsOn);
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(days);
  }
  return weeks;
}

/** Contiguous list of day Dates between start (inclusive) and end (exclusive). */
export function daysBetween(start, end) {
  const out = [];
  let cursor = startOfDay(start);
  const stop = startOfDay(end);
  // Guard against pathological ranges.
  let guard = 0;
  while (cursor < stop && guard < 4000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

/**
 * Bucket rows by their local calendar day, keyed yyyy-mm-dd, each list sorted
 * chronologically. Rows whose date column can't be parsed are dropped.
 * @returns {{ buckets: Map<string, Array<{row:*, date:Date}>>, parsed: Array<{row:*, date:Date}> }}
 */
export function bucketEventsByDay(rows, dateField) {
  const buckets = new Map();
  const parsed = [];
  if (!dateField || !Array.isArray(rows)) return { buckets, parsed };
  for (const row of rows) {
    const date = parseEventDate(row?.[dateField]);
    if (!date) continue;
    parsed.push({ row, date });
    const key = dayKey(date);
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push({ row, date });
  }
  for (const arr of buckets.values()) {
    arr.sort((x, y) => x.date - y.date);
  }
  return { buckets, parsed };
}

// ---- Intl-based localized names (keyed off the component's lang setting) ----

const LOCALE_BY_LANG = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-PT',
};

export function resolveLocale(lang) {
  if (!lang || lang === 'custom') return undefined; // browser default
  return LOCALE_BY_LANG[lang] || lang;
}

/** Localized weekday short names, ordered from weekStartsOn. */
export function weekdayNames(lang, weekStartsOn = 1, style = 'short') {
  const locale = resolveLocale(lang);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
  // 2023-01-01 was a Sunday — a stable anchor for weekday iteration.
  const sunday = new Date(2023, 0, 1);
  const names = [];
  for (let i = 0; i < 7; i++) {
    const idx = (weekStartsOn + i) % 7;
    names.push(fmt.format(addDays(sunday, idx)));
  }
  return names;
}

/** Localized label for a timeframe's current period (toolbar title). */
export function periodLabel(timeframe, anchor, lang, range = null) {
  const locale = resolveLocale(lang);
  switch (timeframe) {
    case 'day':
      return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(anchor);
    case 'week': {
      if (!range) return '';
      const lastDay = addDays(range.end, -1);
      const startFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
      const endFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      return `${startFmt.format(range.start)} – ${endFmt.format(lastDay)}`;
    }
    case 'year':
      return String(anchor.getFullYear());
    case 'custom': {
      if (!range) return '';
      const lastDay = addDays(range.end, -1);
      const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      return `${fmt.format(range.start)} – ${fmt.format(lastDay)}`;
    }
    case 'month':
    default:
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor);
  }
}

/** Localized month name (long) for a given month index 0..11. */
export function monthName(monthIndex, lang, style = 'long') {
  const locale = resolveLocale(lang);
  const fmt = new Intl.DateTimeFormat(locale, { month: style });
  return fmt.format(new Date(2023, monthIndex, 1));
}

/** Format an event's time-of-day for chips/time-grid (24h HH:mm). */
export function formatTime(date, lang) {
  const locale = resolveLocale(lang);
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
