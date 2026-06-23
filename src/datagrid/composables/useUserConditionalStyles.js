import { ref, watch } from 'vue';

// User-defined conditional row styling.
//
// Owns the `userRules` ref (the array of rule objects that lives inside
// viewConfiguration.userConditionalRowStyles + currentConfig.userConditionalRowStyles).
// Provides add/update/delete/reorder methods used by the Conditional Styling tab
// in the column chooser. Watches `cfg.viewConfiguration.userConditionalRowStyles`
// so external changes (e.g. swapping the bound variable) flow back into the grid.
//
// Mutations call `getUpdateCurrentConfig()` to push the new rules into
// currentConfig — same plumbing used by filter/sort/sizes.
export function useUserConditionalStyles(cfg, { getUpdateCurrentConfig }) {
  const userRules = ref(normalizeRules(cfg.value?.viewConfiguration?.userConditionalRowStyles));

  // Watch external viewConfiguration changes (e.g. user swaps the bound view).
  watch(
    () => cfg.value?.viewConfiguration?.userConditionalRowStyles,
    (incoming) => {
      const next = normalizeRules(incoming);
      if (rulesEqual(next, userRules.value)) return;
      userRules.value = next;
    }
  );

  const pushToCurrentConfig = () => {
    const fn = getUpdateCurrentConfig?.();
    if (typeof fn === 'function') {
      try { fn(); } catch (_) { /* noop */ }
    }
  };

  const addRule = () => {
    const rule = {
      id: generateRuleId(),
      label: '',
      conditions: [{ field: '', operator: 'equals', value: '' }],
      backgroundColor: '',
      textColor: '',
      bold: false,
      italic: false,
    };
    userRules.value = [...userRules.value, rule];
    pushToCurrentConfig();
    return rule;
  };

  const updateRule = (id, patch) => {
    let changed = false;
    userRules.value = userRules.value.map(r => {
      if (r.id !== id) return r;
      changed = true;
      return { ...r, ...patch };
    });
    if (changed) pushToCurrentConfig();
  };

  const deleteRule = (id) => {
    const next = userRules.value.filter(r => r.id !== id);
    if (next.length === userRules.value.length) return;
    userRules.value = next;
    pushToCurrentConfig();
  };

  const reorderRules = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= userRules.value.length || toIdx >= userRules.value.length) return;
    const next = [...userRules.value];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    userRules.value = next;
    pushToCurrentConfig();
  };

  const addCondition = (ruleId) => {
    updateRule(ruleId, {
      conditions: [
        ...(userRules.value.find(r => r.id === ruleId)?.conditions || []),
        { field: '', operator: 'equals', value: '' },
      ],
    });
  };

  const updateCondition = (ruleId, idx, patch) => {
    const rule = userRules.value.find(r => r.id === ruleId);
    if (!rule) return;
    const conditions = (rule.conditions || []).map((c, i) => i === idx ? { ...c, ...patch } : c);
    updateRule(ruleId, { conditions });
  };

  const deleteCondition = (ruleId, idx) => {
    const rule = userRules.value.find(r => r.id === ruleId);
    if (!rule) return;
    const conditions = (rule.conditions || []).filter((_, i) => i !== idx);
    updateRule(ruleId, { conditions });
  };

  return {
    userRules,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
    addCondition,
    updateCondition,
    deleteCondition,
  };
}

function normalizeRules(input) {
  if (!Array.isArray(input)) return [];
  return input.map(r => ({
    id: r?.id || generateRuleId(),
    label: typeof r?.label === 'string' ? r.label : '',
    conditions: Array.isArray(r?.conditions)
      ? r.conditions.map(c => ({
          field: c?.field || '',
          operator: c?.operator || 'equals',
          value: c?.value ?? '',
        }))
      : [],
    backgroundColor: r?.backgroundColor || '',
    textColor: r?.textColor || '',
    bold: !!r?.bold,
    italic: !!r?.italic,
  }));
}

function rulesEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

let __ruleIdSeq = 0;
function generateRuleId() {
  __ruleIdSeq += 1;
  return `ucs-${Date.now().toString(36)}-${__ruleIdSeq.toString(36)}`;
}
