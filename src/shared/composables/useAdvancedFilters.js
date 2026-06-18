import { computed, watch, onMounted } from 'vue';

// Owns the `advancedFilters` WeWeb component variable — the canonical state of
// the runtime Filter Builder, shared by Datagrid, Kanban and Calendar (all three
// share the same component instance `uid`).
//
// Shape:
//   { combinator: 'and' | 'or', conditions: [ { field, type, operator, value, valueTo? } ] }
//
// Mirrors the variable pattern used by useFiltersAndSort (`filters`/`sort`).
//
// `options.getDefault` (optional) returns a default `{ combinator, conditions }`
// — typically `cfg.defaultAdvancedFilters`, which baseConfig can override. The
// runtime variable is seeded from it on mount and re-seeded when the default
// changes, unless the user has diverged from the last-seeded value.
export function useAdvancedFilters(props, { getDefault } = {}) {
  const { value: advancedFilters, setValue: setAdvancedFilters } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'advancedFilters',
      type: 'object',
      defaultValue: { combinator: 'and', conditions: [] },
      readonly: true,
    });

  // Always-normalised view of the variable (it can be set to null/partial externally).
  const normalized = computed(() => {
    const v = advancedFilters.value || {};
    return {
      combinator: v.combinator === 'or' ? 'or' : 'and',
      conditions: Array.isArray(v.conditions) ? v.conditions : [],
    };
  });

  const combinator = computed(() => normalized.value.combinator);
  const conditions = computed(() => normalized.value.conditions);
  const hasOrCombinator = computed(() => normalized.value.combinator === 'or');

  // --- Mutators (always replace the whole object so WeWeb reactivity fires) ---
  const setCombinator = (next) => {
    setAdvancedFilters({
      combinator: next === 'or' ? 'or' : 'and',
      conditions: normalized.value.conditions,
    });
  };

  const setConditions = (next) => {
    setAdvancedFilters({
      combinator: normalized.value.combinator,
      conditions: Array.isArray(next) ? next : [],
    });
  };

  const addCondition = (condition) => {
    setConditions([...normalized.value.conditions, condition]);
  };

  const updateCondition = (index, patch) => {
    const next = normalized.value.conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    setConditions(next);
  };

  const removeCondition = (index) => {
    setConditions(normalized.value.conditions.filter((_, i) => i !== index));
  };

  const clearConditions = () => {
    setAdvancedFilters({ combinator: normalized.value.combinator, conditions: [] });
  };

  // --- Seed from the (baseConfig-mergeable) default filters ---
  const normalizeDefault = (raw) => ({
    combinator: raw?.combinator === 'or' ? 'or' : 'and',
    conditions: Array.isArray(raw?.conditions) ? raw.conditions : [],
  });

  // JSON of the last value we seeded — lets us detect whether the user has since
  // diverged (don't clobber their edits) vs. is still on the seeded default.
  let seededKey = null;

  const applyDefault = () => {
    if (typeof getDefault !== 'function') return;
    const def = normalizeDefault(getDefault());
    const current = normalized.value;
    if (def.conditions.length === 0 && current.conditions.length === 0) return;
    // Seed when the builder is still empty, or when the user hasn't touched the
    // previously-seeded value (so a baseConfig change propagates).
    if (current.conditions.length === 0 || JSON.stringify(current) === seededKey) {
      setAdvancedFilters(def);
      seededKey = JSON.stringify(def);
    }
  };

  onMounted(() => applyDefault());
  if (typeof getDefault === 'function') {
    watch(() => JSON.stringify(getDefault() || null), () => applyDefault());
  }

  return {
    advancedFilters,
    setAdvancedFilters,
    normalizedAdvancedFilters: normalized,
    combinator,
    conditions,
    hasOrCombinator,
    setCombinator,
    setConditions,
    addCondition,
    updateCondition,
    removeCondition,
    clearConditions,
  };
}
