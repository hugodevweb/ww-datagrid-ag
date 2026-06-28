// Placeholder tokens for filters & conditional styling.
//
// A saved view can store runtime-relative values as tokens like `%CURRENT_USER%`
// instead of literal ids. At runtime the token is resolved against a WeWeb
// variable (hard-coded id below) whose value is an object mapping
// placeholder name -> value, e.g. { "CURRENT_USER": "<uuid>", "MY_TEAM": ["a","b"] }.
//
// Core principle: STORE tokens, RESOLVE at consumption. Tokens stay verbatim in
// viewConfiguration / advancedFilters / the AG-Grid filter model, so saved views
// stay portable and re-resolve per user. Resolution happens only where a value is
// compared against a row (client) or turned into a query (server).

import { getVarByName } from './wwVariables.js';

export const PLACEHOLDER_VARIABLE_NAME = 'placeholders';

// Read the placeholder map from the bound WeWeb variable. Tolerates the value
// being an object or a JSON string; returns {} on anything unexpected.
export function getPlaceholderMap() {
  try {
    const raw = getVarByName(PLACEHOLDER_VARIABLE_NAME);
    if (raw == null) return {};
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return {};
      try {
        const parsed = JSON.parse(s);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return {};
  } catch (_) {
    return {};
  }
}

// Names offered by the picker UIs — the keys of the placeholder map.
export function getPlaceholderNames() {
  return Object.keys(getPlaceholderMap());
}

// Names offered for a given column kind. A placeholder with a `kinds` list is
// only offered for those kinds; one without restriction is offered everywhere.
// Pass a falsy kind to get every name.
export function getPlaceholderNamesForKind(kind) {
  const names = getPlaceholderNames();
  if (!kind) return names;
  return names.filter((name) => {
    const meta = metaFor(name);
    const kinds = meta && Array.isArray(meta.kinds) ? meta.kinds : null;
    return !kinds || kinds.includes(kind);
  });
}

const TOKEN_RE = /^%([^%]+)%$/;
const EMBEDDED_RE = /%([^%]+)%/g;

// True when the value is exactly a single `%NAME%` token.
export function isPlaceholderToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value.trim());
}

// Display label for a token chip: `%CURRENT_USER%` -> `CURRENT_USER`.
export function placeholderLabel(value) {
  if (typeof value !== 'string') return String(value ?? '');
  const m = value.trim().match(TOKEN_RE);
  return m ? m[1] : value;
}

// Wrap a bare name into its token form.
export function makeToken(name) {
  return `%${name}%`;
}

// ---------------------------------------------------------------------------
// Dynamic DATE placeholders — independent of the placeholder variable. A date
// token looks like `%DATE:<spec>%` and resolves to a local `YYYY-MM-DD` string
// computed from the current date. Specs:
//   today | weekStart | weekEnd | monthStart | monthEnd
//   <sign><n><unit>  e.g. -4d (4 days ago), +2w (in 2 weeks), -3m, +1y
//                    units: d=days w=weeks m=months y=years
// ---------------------------------------------------------------------------
const DATE_TOKEN_PREFIX = 'DATE:';
const RELATIVE_RE = /^([+-]?)(\d+)([dwmy])$/;

export function makeDateToken(spec) {
  return `%${DATE_TOKEN_PREFIX}${spec}%`;
}

export function isDateToken(value) {
  if (typeof value !== 'string') return false;
  const m = value.trim().match(TOKEN_RE);
  return !!m && m[1].startsWith(DATE_TOKEN_PREFIX);
}

function dateSpecOf(value) {
  const m = String(value ?? '').trim().match(TOKEN_RE);
  if (!m || !m[1].startsWith(DATE_TOKEN_PREFIX)) return '';
  return m[1].slice(DATE_TOKEN_PREFIX.length);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtLocalDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

// Resolve a DATE spec to a local YYYY-MM-DD string, or null if unrecognised.
function resolveDateToken(spec) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  switch (spec) {
    case 'today': return fmtLocalDate(base);
    case 'weekStart': { const d = new Date(base); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return fmtLocalDate(d); }
    case 'weekEnd':   { const d = new Date(base); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off + 6); return fmtLocalDate(d); }
    case 'monthStart': return fmtLocalDate(new Date(base.getFullYear(), base.getMonth(), 1));
    case 'monthEnd':   return fmtLocalDate(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    default: break;
  }
  const m = spec.match(RELATIVE_RE);
  if (m) {
    const n = (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
    const d = new Date(base);
    if (m[3] === 'd') d.setDate(d.getDate() + n);
    else if (m[3] === 'w') d.setDate(d.getDate() + n * 7);
    else if (m[3] === 'm') d.setMonth(d.getMonth() + n);
    else if (m[3] === 'y') d.setFullYear(d.getFullYear() + n);
    return fmtLocalDate(d);
  }
  return null;
}

const DATE_UNIT_LABELS = { d: ['jour', 'jours'], w: ['semaine', 'semaines'], m: ['mois', 'mois'], y: ['an', 'ans'] };

// Human label (French) for a DATE spec.
function dateTokenLabel(spec) {
  switch (spec) {
    case 'today': return "Aujourd'hui";
    case 'weekStart': return 'Début de semaine';
    case 'weekEnd': return 'Fin de semaine';
    case 'monthStart': return 'Début de mois';
    case 'monthEnd': return 'Fin de mois';
    default: break;
  }
  const m = spec.match(RELATIVE_RE);
  if (m) {
    const future = m[1] !== '-';
    const n = parseInt(m[2], 10);
    const [sing, plur] = DATE_UNIT_LABELS[m[3]] || ['', ''];
    const unit = n > 1 ? plur : sing;
    return future ? `Dans ${n} ${unit}` : `Il y a ${n} ${unit}`;
  }
  return spec;
}

// Lucide "calendar" icon, gray via currentColor.
export const DATE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

// Quick presets + relative units offered by the date placeholder menu.
export const DATE_PRESETS = ['today', 'weekStart', 'weekEnd', 'monthStart', 'monthEnd'];
export const DATE_UNITS = [
  { value: 'd', label: 'jours' },
  { value: 'w', label: 'semaines' },
  { value: 'm', label: 'mois' },
  { value: 'y', label: 'ans' },
];

// Display metadata for known placeholders: a friendly label and an optional
// inline SVG icon (Lucide). Keyed by the bare placeholder name (matched
// case-insensitively). Add an entry here to give a placeholder a nicer name/icon;
// unknown placeholders fall back to their raw key and the default "{ }" glyph.
// `kinds` (optional) restricts a placeholder to specific column kinds
// (text/number/date/boolean/select/user/record). Omit it to offer the
// placeholder everywhere. `%CURRENT_USER%` resolves to a user id, so it's only
// meaningful on user columns.
export const PLACEHOLDER_META = {
  CURRENT_USER: {
    label: 'Moi',
    kinds: ['user'],
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-user-round"><path d="M17.925 20.056a6 6 0 0 0-11.851.001"/><circle cx="12" cy="11" r="4"/><circle cx="12" cy="12" r="10"/></svg>',
  },
};

// Resolve a name OR token to its display-metadata entry (or null).
function metaFor(value) {
  const name = isPlaceholderToken(value) ? placeholderLabel(value) : String(value ?? '');
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(PLACEHOLDER_META, name)) return PLACEHOLDER_META[name];
  const upper = name.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(PLACEHOLDER_META, upper)) return PLACEHOLDER_META[upper];
  return null;
}

// Suffix appended to every placeholder label to signal it resolves at runtime.
export const DYNAMIC_SUFFIX = ' (dynamique)';

// Friendly display name for a placeholder name or token; falls back to the raw
// name. Always suffixed with "(dynamique)" so users see the value is dynamic.
export function placeholderDisplayName(value) {
  // Date tokens carry their own self-explanatory label (no "(dynamique)" suffix).
  if (isDateToken(value)) return dateTokenLabel(dateSpecOf(value));
  const meta = metaFor(value);
  const base = (meta && meta.label)
    ? meta.label
    : (isPlaceholderToken(value) ? placeholderLabel(value) : String(value ?? ''));
  return base ? `${base}${DYNAMIC_SUFFIX}` : base;
}

// Inline SVG icon string for a placeholder, or '' when none is defined.
export function placeholderIcon(value) {
  if (isDateToken(value)) return DATE_ICON;
  const meta = metaFor(value);
  return (meta && meta.icon) || '';
}

// Glyph HTML for a placeholder: its icon SVG if defined, else the literal "{ }".
// Safe to bind with v-html — the values come from the static registry above.
export function placeholderGlyphHtml(value) {
  return placeholderIcon(value) || '{ }';
}

// Resolve a name in the map. Bare-name first, then literal `%NAME%` fallback.
function lookup(map, name) {
  if (Object.prototype.hasOwnProperty.call(map, name)) return map[name];
  const literal = `%${name}%`;
  if (Object.prototype.hasOwnProperty.call(map, literal)) return map[literal];
  return undefined;
}

// Deep-resolve a value:
//  - whole-string token "%NAME%" -> map[NAME] (scalar OR array); unknown -> kept verbatim
//  - string with embedded tokens -> substring-replace known names
//  - array -> resolve each element and FLATTEN (a token resolving to an array expands)
//  - anything else -> unchanged
export function resolveValue(value, map = getPlaceholderMap()) {
  if (typeof value === 'string') {
    const whole = value.trim().match(TOKEN_RE);
    if (whole) {
      const inner = whole[1];
      // Dynamic date token (independent of the placeholder variable).
      if (inner.startsWith(DATE_TOKEN_PREFIX)) {
        const resolvedDate = resolveDateToken(inner.slice(DATE_TOKEN_PREFIX.length));
        return resolvedDate === null ? value : resolvedDate;
      }
      const resolved = lookup(map, inner);
      // Unknown name -> keep the token so it can't accidentally match real ids.
      return resolved === undefined ? value : resolved;
    }
    if (value.indexOf('%') !== -1) {
      return value.replace(EMBEDDED_RE, (full, name) => {
        const resolved = lookup(map, name);
        return resolved === undefined ? full : String(resolved);
      });
    }
    return value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      const r = resolveValue(item, map);
      if (Array.isArray(r)) out.push(...r);
      else out.push(r);
    }
    return out;
  }
  return value;
}

// Resolve an array of filter values: resolve + flatten + drop null/undefined.
// (Sentinels like '__empty__' are non-tokens and pass through unchanged.)
export function resolveValues(values, map = getPlaceholderMap()) {
  if (!Array.isArray(values)) return values;
  const resolved = resolveValue(values, map);
  const arr = Array.isArray(resolved) ? resolved : [resolved];
  return arr.filter((v) => v !== null && v !== undefined);
}
