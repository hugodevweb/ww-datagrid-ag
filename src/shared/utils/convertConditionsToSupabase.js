import { convertFilterToSupabase } from '../../datagrid/utils/convertFilterToSupabase.js';
import { getSupabaseFilterField, findColumnByField } from '../../datagrid/utils/supabaseFieldMappings.js';

// ---------------------------------------------------------------------------
// Filter Builder — flat, cross-column AND/OR conditions → Supabase query.
//
// Condition shape (produced by FilterBuilder.vue, stored in the `advancedFilters`
// component variable):
//   { field, type, operator, value, valueTo? }
//     field    — the column field / columnId (resolved to a Supabase path here)
//     type     — the column cellDataType (text/number/currency/boolean/date*/select/user/record)
//     operator — one of the operator keys below (matches convertFilterToSupabase types)
//     value    — scalar for text/number/date/boolean; array for select/user/record
//     valueTo  — second bound for inRange operators
//
// Two combinator modes:
//   'and' — apply each condition sequentially (reuses convertFilterToSupabase so
//           all the per-type nuance, incl. user/select/record relationships, is shared)
//   'or'  — emit a single PostgREST `.or('<token>,<token>,…')` group
// ---------------------------------------------------------------------------

// Normalise a column cellDataType to a builder "kind" used for operator/input lists.
export const normalizeFilterType = (cellDataType) => {
  const t = String(cellDataType || 'text').toLowerCase();
  if (t === 'auto' || t === '' || t === 'image' || t === 'action' || t === 'custom') return 'text';
  if (t === 'currency') return 'number';
  if (t === 'datestring' || t === 'datetime' || t === 'date') return 'date';
  if (['number', 'boolean', 'select', 'user', 'record', 'text'].includes(t)) return t;
  return 'text';
};

// Operator catalogue per builder kind. `value`s match the `filter.type` strings
// understood by convertFilterToSupabase so the AND path can reuse it directly.
export const OPERATORS_BY_KIND = {
  text: [
    { value: 'contains', label: 'Contient' },
    { value: 'notContains', label: 'Ne contient pas' },
    { value: 'equals', label: 'Égal à' },
    { value: 'notEqual', label: 'Différent de' },
    { value: 'startsWith', label: 'Commence par' },
    { value: 'endsWith', label: 'Se termine par' },
    { value: 'blank', label: 'Est vide' },
    { value: 'notBlank', label: "N'est pas vide" },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'notEqual', label: '≠' },
    { value: 'greaterThan', label: '>' },
    { value: 'greaterThanOrEqual', label: '≥' },
    { value: 'lessThan', label: '<' },
    { value: 'lessThanOrEqual', label: '≤' },
    { value: 'inRange', label: 'Entre' },
  ],
  date: [
    { value: 'equals', label: 'Le' },
    { value: 'notEqual', label: 'Pas le' },
    { value: 'greaterThan', label: 'Après' },
    { value: 'lessThan', label: 'Avant' },
    { value: 'inRange', label: 'Entre' },
  ],
  boolean: [
    { value: 'true', label: 'Est vrai' },
    { value: 'false', label: 'Est faux' },
  ],
  // Only isAnyOf is offered so every operator round-trips faithfully through
  // AG Grid's filter model (the custom select filter has no "exclude" concept).
  select: [
    { value: 'isAnyOf', label: "Est l'un de" },
  ],
  user: [{ value: 'isAnyOf', label: "Est l'un de" }],
  record: [{ value: 'isAnyOf', label: "Est l'un de" }],
};

export const getOperatorsForType = (cellDataType) =>
  OPERATORS_BY_KIND[normalizeFilterType(cellDataType)] || OPERATORS_BY_KIND.text;

// What value control the UI should render for a given (type, operator) pair.
export const getInputKind = (cellDataType, operator) => {
  const kind = normalizeFilterType(cellDataType);
  if (operator === 'blank' || operator === 'notBlank') return 'none';
  if (kind === 'boolean') return 'none';
  if (kind === 'select') return 'multi-select';
  if (kind === 'user') return 'multi-user';
  if (kind === 'record') return 'multi-record';
  if (kind === 'number') return operator === 'inRange' ? 'range-number' : 'number';
  if (kind === 'date') return operator === 'inRange' ? 'range-date' : 'date';
  return 'text';
};

// True when a condition has enough input to be applied (so half-typed rows are ignored).
export const isConditionComplete = (condition) => {
  if (!condition || !condition.field || !condition.operator) return false;
  const kind = normalizeFilterType(condition.type);
  const op = condition.operator;
  if (op === 'blank' || op === 'notBlank' || kind === 'boolean') return true;
  if (['select', 'user', 'record'].includes(kind)) {
    return Array.isArray(condition.value) && condition.value.length > 0;
  }
  if (op === 'inRange') {
    return condition.value !== '' && condition.value != null &&
      condition.valueTo !== '' && condition.valueTo != null;
  }
  return condition.value !== '' && condition.value != null;
};

// Build a single-entry AG-Grid-style filter model from one builder condition.
// Keyed by the column field so convertFilterToSupabase can resolve the Supabase path.
const conditionToFilterModelEntry = (condition) => {
  const kind = normalizeFilterType(condition.type);
  const { field, operator, value, valueTo } = condition;

  let filterObj;
  switch (kind) {
    case 'number':
      filterObj = { filterType: 'number', type: operator, filter: value, filterTo: valueTo };
      break;
    case 'date':
      filterObj = { filterType: 'date', type: operator, dateFrom: value, dateTo: valueTo };
      break;
    case 'boolean':
      filterObj = { filterType: 'text', type: operator };
      break;
    case 'select':
      filterObj = { type: 'selectFilter', values: Array.isArray(value) ? value : [], exclude: operator === 'isNoneOf' };
      break;
    case 'user':
      filterObj = { type: 'userFilter', values: Array.isArray(value) ? value : [] };
      break;
    case 'record':
      filterObj = { type: 'recordFilter', values: Array.isArray(value) ? value : [] };
      break;
    default:
      filterObj = { filterType: 'text', type: operator, filter: value };
  }
  return { [field]: filterObj };
};

// --- OR mode: PostgREST token helpers ------------------------------------

// Escape a value for use inside a PostgREST `.or()` token. Wrap in double quotes
// when it contains reserved characters.
const enc = (val) => {
  const s = String(val ?? '');
  return /[(),."]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
};

const numVal = (kind, ctype, val) => {
  const n = Number(val);
  return String(ctype === 'currency' ? Math.round(n * 100) : n);
};

const dateVal = (val) => new Date(val).toISOString();

// Convert one builder condition to a PostgREST `.or()` token, or null to skip.
const conditionToOrToken = (condition, content) => {
  if (!isConditionComplete(condition)) return null;
  const field = getSupabaseFilterField(content, condition.field);
  const kind = normalizeFilterType(condition.type);
  const ctype = String(condition.type || '').toLowerCase();
  const op = condition.operator;
  const v = condition.value;

  switch (kind) {
    case 'text':
      switch (op) {
        case 'equals': return `${field}.eq.${enc(v)}`;
        case 'notEqual': return `${field}.neq.${enc(v)}`;
        case 'contains': return `${field}.ilike.*${v}*`;
        case 'notContains': return `${field}.not.ilike.*${v}*`;
        case 'startsWith': return `${field}.ilike.${v}*`;
        case 'endsWith': return `${field}.ilike.*${v}`;
        case 'blank': return `${field}.is.null`;
        case 'notBlank': return `${field}.not.is.null`;
        default: return null;
      }
    case 'number':
      switch (op) {
        case 'equals': return `${field}.eq.${numVal(kind, ctype, v)}`;
        case 'notEqual': return `${field}.neq.${numVal(kind, ctype, v)}`;
        case 'greaterThan': return `${field}.gt.${numVal(kind, ctype, v)}`;
        case 'greaterThanOrEqual': return `${field}.gte.${numVal(kind, ctype, v)}`;
        case 'lessThan': return `${field}.lt.${numVal(kind, ctype, v)}`;
        case 'lessThanOrEqual': return `${field}.lte.${numVal(kind, ctype, v)}`;
        case 'inRange': return `and(${field}.gte.${numVal(kind, ctype, v)},${field}.lte.${numVal(kind, ctype, condition.valueTo)})`;
        default: return null;
      }
    case 'date':
      switch (op) {
        case 'equals': {
          const start = new Date(v); start.setHours(0, 0, 0, 0);
          const end = new Date(v); end.setHours(23, 59, 59, 999);
          return `and(${field}.gte.${start.toISOString()},${field}.lte.${end.toISOString()})`;
        }
        case 'notEqual': {
          const start = new Date(v); start.setHours(0, 0, 0, 0);
          const end = new Date(v); end.setHours(23, 59, 59, 999);
          return `or(${field}.lt.${start.toISOString()},${field}.gt.${end.toISOString()})`;
        }
        case 'greaterThan': return `${field}.gt.${dateVal(v)}`;
        case 'lessThan': return `${field}.lt.${dateVal(v)}`;
        case 'inRange': return `and(${field}.gte.${dateVal(v)},${field}.lte.${dateVal(condition.valueTo)})`;
        default: return null;
      }
    case 'boolean':
      if (op === 'true') return `${field}.eq.true`;
      if (op === 'false') return `${field}.eq.false`;
      return null;
    case 'select':
    case 'user':
    case 'record': {
      const vals = (Array.isArray(v) ? v : []).filter((x) => x != null && x !== '__empty__');
      if (vals.length === 0) return null;
      if (op === 'isNoneOf') {
        return vals.length === 1 ? `${field}.neq.${enc(vals[0])}` : `${field}.not.in.(${vals.map(enc).join(',')})`;
      }
      return vals.length === 1 ? `${field}.eq.${enc(vals[0])}` : `${field}.in.(${vals.map(enc).join(',')})`;
    }
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Main entry point. `advanced` is the `advancedFilters` variable value:
//   { combinator: 'and' | 'or', conditions: [...] }
// Returns the query with the advanced filters applied.
// ---------------------------------------------------------------------------
export const convertConditionsToSupabase = (advanced, query, content, debugLog = () => {}) => {
  const combinator = advanced?.combinator === 'or' ? 'or' : 'and';
  const conditions = Array.isArray(advanced?.conditions) ? advanced.conditions : [];
  const active = conditions.filter(isConditionComplete);
  if (active.length === 0) return query;

  if (combinator === 'and') {
    let q = query;
    for (const condition of active) {
      const entry = conditionToFilterModelEntry(condition);
      q = convertFilterToSupabase(entry, q, content, debugLog);
    }
    return q;
  }

  // OR: single PostgREST or-group, AND-combined with any manual/header filters.
  const tokens = active.map((c) => conditionToOrToken(c, content)).filter(Boolean);
  if (tokens.length === 0) return query;
  return query.or(tokens.join(','));
};

// ---------------------------------------------------------------------------
// Two-way bridge with AG Grid's (flat) filter model — used by the Datagrid to
// keep the builder and the per-column header filters in sync for the AND case.
// ---------------------------------------------------------------------------

// Builder conditions → AG Grid filter model `{ [field]: filterObj }`.
// Flat: one entry per field (a later condition on the same field wins — the
// builder is a flat AND list, so duplicate-column conditions are uncommon).
export const conditionsToAgGridFilterModel = (conditions) => {
  const model = {};
  for (const condition of (Array.isArray(conditions) ? conditions : []).filter(isConditionComplete)) {
    Object.assign(model, conditionToFilterModelEntry(condition));
  }
  return model;
};

// One AG Grid filter object → builder condition fields (sans field), or null.
const agFilterToConditionParts = (filter, type) => {
  if (!filter) return null;
  const kind = normalizeFilterType(type);

  if (filter.type === 'selectFilter') return { operator: 'isAnyOf', value: Array.isArray(filter.values) ? filter.values : [] };
  if (filter.type === 'userFilter') return { operator: 'isAnyOf', value: Array.isArray(filter.values) ? filter.values : [] };
  if (filter.type === 'recordFilter') return { operator: 'isAnyOf', value: Array.isArray(filter.values) ? filter.values : [] };
  if (filter.filterType === 'set') return { operator: 'isAnyOf', value: Array.isArray(filter.values) ? filter.values : [] };

  if (kind === 'boolean') {
    const raw = filter.type === 'true' || filter.filter === 'true' || filter.filter === true ? 'true'
      : filter.type === 'false' || filter.filter === 'false' || filter.filter === false ? 'false' : null;
    return raw ? { operator: raw, value: '' } : null;
  }
  if (filter.filterType === 'number') {
    return { operator: filter.type, value: filter.filter, valueTo: filter.filterTo };
  }
  if (filter.filterType === 'date') {
    return { operator: filter.type, value: filter.dateFrom || filter.filter, valueTo: filter.dateTo || filter.filterTo };
  }
  // text (default)
  return { operator: filter.type, value: filter.filter };
};

// AG Grid filter model → builder conditions array.
// Expands AG Grid's combined 2-condition form (condition1/condition2) into rows.
export const agGridFilterModelToConditions = (filterModel, content) => {
  const out = [];
  for (const [field, filter] of Object.entries(filterModel || {})) {
    if (!filter) continue;
    const column = findColumnByField(content, field);
    const type = column?.cellDataType || 'text';

    const subFilters = filter.condition1 || filter.condition2
      ? [filter.condition1, filter.condition2].filter(Boolean)
      : [filter];

    for (const sub of subFilters) {
      const parts = agFilterToConditionParts(sub, type);
      if (parts && parts.operator) out.push({ field, type, ...parts });
    }
  }
  return out;
};
