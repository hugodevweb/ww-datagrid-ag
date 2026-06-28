// Helpers for user-defined conditional row styling.
//
// End users build rules in the column-chooser menu: pick a column, an operator,
// and a value. Rules are stored in viewConfiguration.userConditionalRowStyles
// and compiled into per-row style closures that plug into the same merge loop
// used by the designer-defined `conditionalRowStyles` prop in useColumnState.

import { resolveValue } from '../../shared/utils/placeholders.js';

// Normalise an ag-grid cellDataType to one of the kinds we drive operator
// lists from. Mirrors normalizeFilterType in convertConditionsToSupabase.js
// so the styling tab classifies columns the same way the Filter Builder does.
export function normalizeColumnKind(cellDataType) {
  const t = String(cellDataType || 'text').toLowerCase();
  if (t === 'auto' || t === '' || t === 'image' || t === 'action' || t === 'navigation' || t === 'custom') return 'text';
  if (t === 'currency') return 'number';
  if (t === 'datestring' || t === 'datetime' || t === 'date') return 'date';
  if (['number', 'boolean', 'select', 'user', 'record', 'text'].includes(t)) return t;
  return 'text';
}

// Operator definitions. `kinds` declares which column kinds the operator
// applies to. `multi: true` flags operators whose value is an array (used by
// the picker UI in Datagrid.vue to render FilterValuePicker).
export const OPERATORS = [
  { key: 'equals',      kinds: ['text', 'number', 'date'],                                       needsValue: true },
  { key: 'notEquals',   kinds: ['text', 'number', 'date'],                                       needsValue: true },
  { key: 'contains',    kinds: ['text'],                                                          needsValue: true },
  { key: 'notContains', kinds: ['text'],                                                          needsValue: true },
  { key: 'startsWith',  kinds: ['text'],                                                          needsValue: true },
  { key: 'endsWith',    kinds: ['text'],                                                          needsValue: true },
  { key: 'gt',          kinds: ['number', 'date'],                                                needsValue: true },
  { key: 'gte',         kinds: ['number', 'date'],                                                needsValue: true },
  { key: 'lt',          kinds: ['number', 'date'],                                                needsValue: true },
  { key: 'lte',         kinds: ['number', 'date'],                                                needsValue: true },
  { key: 'isAnyOf',     kinds: ['select', 'user', 'record'],                                      needsValue: true, multi: true },
  { key: 'isNoneOf',    kinds: ['select', 'user', 'record'],                                      needsValue: true, multi: true },
  { key: 'isEmpty',     kinds: ['text', 'number', 'date', 'boolean', 'select', 'user', 'record'], needsValue: false },
  { key: 'isNotEmpty',  kinds: ['text', 'number', 'date', 'boolean', 'select', 'user', 'record'], needsValue: false },
  { key: 'isTrue',      kinds: ['boolean'],                                                       needsValue: false },
  { key: 'isFalse',     kinds: ['boolean'],                                                       needsValue: false },
];

// Fallback labels used when a translation is missing.
const OPERATOR_FALLBACK_LABELS = {
  equals: 'Equals',
  notEquals: 'Does not equal',
  contains: 'Contains',
  notContains: 'Does not contain',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  gt: 'Greater than',
  gte: 'Greater or equal',
  lt: 'Less than',
  lte: 'Less or equal',
  isEmpty: 'Is empty',
  isNotEmpty: 'Is not empty',
  isTrue: 'Is true',
  isFalse: 'Is false',
};

export function getOperatorLabel(key, translations) {
  const tKey = 'op_' + key;
  return (translations && translations[tKey]) || OPERATOR_FALLBACK_LABELS[key] || key;
}

const OPERATOR_MAP = OPERATORS.reduce((acc, op) => { acc[op.key] = op; return acc; }, {});

export function getOperatorsForType(cellDataType) {
  const k = normalizeColumnKind(cellDataType);
  return OPERATORS.filter(op => op.kinds.includes(k));
}

export function operatorIsMulti(operatorKey) {
  return !!OPERATOR_MAP[operatorKey]?.multi;
}

function readField(rowData, field) {
  if (!rowData || !field) return undefined;
  if (field.indexOf('.') === -1) return rowData[field];
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), rowData);
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function coerceNumber(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}

// Compare two values numerically when possible, else fall back to date parsing.
// Lets gt/gte/lt/lte work for both numbers and dates (incl. resolved %DATE:…%).
function compareNumericOrDate(raw, target, cmp) {
  const a = coerceNumber(raw), b = coerceNumber(target);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return cmp(a, b);
  const da = Date.parse(raw), db = Date.parse(target);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return cmp(da, db);
  return false;
}

export function evaluateCondition(condition, rowData) {
  if (!condition || !condition.field || !condition.operator) return false;
  const raw = readField(rowData, condition.field);
  const op = condition.operator;
  // Resolve placeholder tokens (e.g. %CURRENT_USER%) against the runtime variable.
  const target = resolveValue(condition.value);

  switch (op) {
    case 'isEmpty':    return isEmptyValue(raw);
    case 'isNotEmpty': return !isEmptyValue(raw);
    case 'isTrue':     return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'isFalse':    return raw === false || raw === 'false' || raw === 0 || raw === '0';
    case 'equals':     return String(raw ?? '') === String(target ?? '');
    case 'notEquals':  return String(raw ?? '') !== String(target ?? '');
    case 'contains':   return String(raw ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
    case 'notContains':return !String(raw ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
    case 'startsWith': return String(raw ?? '').toLowerCase().startsWith(String(target ?? '').toLowerCase());
    case 'endsWith':   return String(raw ?? '').toLowerCase().endsWith(String(target ?? '').toLowerCase());
    case 'gt':         return compareNumericOrDate(raw, target, (x, y) => x > y);
    case 'gte':        return compareNumericOrDate(raw, target, (x, y) => x >= y);
    case 'lt':         return compareNumericOrDate(raw, target, (x, y) => x < y);
    case 'lte':        return compareNumericOrDate(raw, target, (x, y) => x <= y);
    case 'isAnyOf':    {
      if (!Array.isArray(target) || target.length === 0) return false;
      // For multi-value cells (e.g. multi-select arrays), match if ANY raw value is in target.
      if (Array.isArray(raw)) return raw.some(rv => target.some(tv => String(rv ?? '') === String(tv ?? '')));
      return target.some(tv => String(tv ?? '') === String(raw ?? ''));
    }
    case 'isNoneOf':   {
      if (!Array.isArray(target) || target.length === 0) return true;
      if (Array.isArray(raw)) return !raw.some(rv => target.some(tv => String(rv ?? '') === String(tv ?? '')));
      return !target.some(tv => String(tv ?? '') === String(raw ?? ''));
    }
    default:           return false;
  }
}

export function mapBoldItalicToStyle({ bold, italic }) {
  const out = {};
  if (bold) out.fontWeight = 'bold';
  if (italic) out.fontStyle = 'italic';
  return out;
}

// Compile a user rule into a (rowData) => styleObject | null closure that the
// merge loop in useColumnState.js can call alongside the designer-prop closures.
// Returns null if the rule has no usable conditions or no style to apply.
export function compileUserRule(rule) {
  if (!rule) return null;
  const conditions = Array.isArray(rule.conditions)
    ? rule.conditions.filter(c => {
        if (!c || !c.field || !c.operator) return false;
        // Drop incomplete multi-conditions (no values picked yet) so the rule
        // doesn't match every row while the user is mid-edit.
        if (operatorIsMulti(c.operator)) {
          return Array.isArray(c.value) && c.value.length > 0;
        }
        return true;
      })
    : [];
  if (conditions.length === 0) return null;

  const styleToApply = {};
  if (rule.backgroundColor) styleToApply.backgroundColor = rule.backgroundColor;
  if (rule.textColor) styleToApply.color = rule.textColor;
  Object.assign(styleToApply, mapBoldItalicToStyle({ bold: rule.bold, italic: rule.italic }));
  if (Object.keys(styleToApply).length === 0) return null;

  return (rowData) => {
    if (!rowData) return null;
    for (let i = 0; i < conditions.length; i++) {
      if (!evaluateCondition(conditions[i], rowData)) return null;
    }
    return styleToApply;
  };
}

export function getDefaultOperatorForType(type) {
  const ops = getOperatorsForType(type);
  return ops[0]?.key || 'equals';
}

export function operatorNeedsValue(operatorKey) {
  return OPERATOR_MAP[operatorKey]?.needsValue !== false;
}
