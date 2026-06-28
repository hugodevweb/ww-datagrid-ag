// Access WeWeb website (app) variables by NAME instead of by hard-coded id so the
// component survives WeWeb project duplication (WeWeb regenerates variable ids on
// duplicate, but names are stable).
//
// At runtime WeWeb registers every website variable in this bag keyed by BOTH its
// id and its name (see weweb-front/src/pinia/variables.js `add()` ->
// wwLib.globalVariables.customCodeVariables). The bag is a Vue `reactive` object
// holding writable `computed` refs, and a reactive object AUTO-UNWRAPS refs on
// access — so `customCodeVariables[name]` already IS the variable's value (reading
// `.value` off it would be wrong). The runtime itself relies on this: custom-code
// bindings read `variables['id']` directly and write `customCodeVariables.x = y`.
// Reads stay reactive (the unwrap tracks the computed's deps); writes route through
// the computed setter -> wwVariable store (equivalent to updateValue for full-value
// writes).
//
// NOTE: only *website* variables are name-keyed (not component/plugin variables),
// and formula/workflow names are stripped from published data — so this by-name
// trick works for app variables only.

export function getVarByName(name) {
  try {
    return wwLib?.globalVariables?.customCodeVariables?.[name];
  } catch (_) {
    return undefined;
  }
}

export function setVarByName(name, value) {
  try {
    const bag = wwLib?.globalVariables?.customCodeVariables;
    // Assigning to the reactive property routes through the variable's computed
    // setter (the bag auto-unwraps on write). Only write if the variable exists,
    // so we never create a dangling key disconnected from the wwVariable store.
    if (bag && name in bag) bag[name] = value;
  } catch (_) {
    /* noop */
  }
}
