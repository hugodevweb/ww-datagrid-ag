# WeWeb Components Master Guide

This is the consolidated master guide for building and modifying WeWeb custom components in this repository.

It combines:

- the onboarding model from `WEWEB_COMPONENTS_FOR_CODEX.md`
- the current repo pattern summary from `WEWEB_COMPONENTS_MCP_GUIDE.md`
- the strict implementation constraints from `WeWeb-Component-Development-Guide.md`

Use this file when you want one canonical document instead of jumping across multiple guides.

Role:

- single canonical guide combining onboarding, current repo patterns, and implementation constraints

Companion files:

- `README_AGENT_PACK.md`
- `WEWEB_COMPONENT_API_MATRIX.md`
- `WEWEB_COMPONENTS_FOR_CODEX.md`
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
- `WeWeb-Component-Development-Guide.md`

## 1. Mission

A WeWeb component agent must be able to:

- understand what a WeWeb component is
- choose the right implementation pattern before coding
- respect WeWeb editor/runtime constraints
- avoid breaking form integration, bindings, hidden child trees, or editor UX
- use current repository patterns instead of outdated assumptions

## 2. The Minimum Correct Mental Model

WeWeb custom components are Vue components integrated into a no-code platform.

They are not plain Vue props-in, DOM-out components.

Every serious WeWeb component must be understood across four layers:

1. schema layer
   - `ww-config.js`
2. runtime layer
   - `src/wwElement.vue` or `src/wwSection.vue`
3. platform layer
   - `wwLib`, platform props, workflow/events, form APIs, variables
4. editor-orchestration layer
   - `boundProps`, `sidepanelContent`, hidden inner elements, sidepanel sync, builder automation

The shortest reliable rule is:

- `ww-config.js` defines the editor/runtime contract
- runtime Vue code implements the behavior

## 3. Hard Constraints You Must Not Violate

These are the highest-priority implementation rules.

### 3.1 Safety and reactivity

- Treat every `props.content.*` value as reactive.
- Use optional chaining and defensive access for content-driven values.
- Prefer `computed()` for data derived from props.
- Do not initialize long-lived `ref()` state from props if it should stay reactive.

### 3.2 Editor code blocks

- `/* wwEditor:start */` and `/* wwEditor:end */` must be paired correctly.
- Use them for editor-only code in Vue files.
- Use them for `bindingValidation` and `propertyHelp` sections in config where needed.

### 3.3 DOM access

- Prefer `wwLib.getFrontDocument()` over raw `document`.
- Prefer `wwLib.getFrontWindow()` over raw `window`.
- Assume the platform may not use the global DOM you expect.

### 3.4 Root sizing

- Do not hardcode root width/height in a way that blocks user-defined sizing.
- Inner elements may be fixed when needed.
- Root containers should stay compatible with WeWeb sizing controls.

### 3.5 Build assumptions

- Build system is handled by `@weweb/cli`.
- Avoid adding custom bundler/compiler config unless explicitly required and approved.

## 4. Standard File Shapes

Most components look like:

```text
component/
  ww-config.js
  src/
    wwElement.vue
  package.json
```

Container-like components often use:

```text
component/
  ww-config.js
  src/
    wwSection.vue
  package.json
```

Advanced components may also have:

- `src/components/*`
- `src/composables/*`
- `src/use/*`
- `src/editor/*`
- `AI.md`

## 5. Runtime Props You Need to Recognize

Common props:

```js
props: {
  content: { type: Object, required: true },
  uid: { type: String, required: true },
  wwElementState: { type: Object, required: false },
  wwEditorState: { type: Object, required: false },
  wwFrontState: { type: Object, required: false },
}
```

What they mean:

- `content`
  - schema instance and configured data
- `uid`
  - unique component instance id
- `wwElementState`
  - states, platform props, attributes, runtime/editor overrides
- `wwEditorState`
  - edit mode, selection, sidepanel state, bound props, copy state
- `wwFrontState`
  - front-end context like screen size or section id

## 6. `ww-config.js` Top-Level Contract

Typical current shape:

```js
export default {
  inherit: { ... } | ['ww-text'],
  editor: { ... },
  options: { ... },
  states: [ ... ],
  properties: { ... },
  triggerEvents: [ ... ],
  actions: [ ... ],
};
```

### 6.1 `inherit`

Use to reuse editor/style/runtime behavior from an existing WeWeb type.

Observed forms:

- `inherit: { type: 'ww-layout' }`
- `inherit: { type: 'ww-text', exclude: ['text'] }`
- `inherit: ['ww-text']`

### 6.2 `editor`

Current editor config is often sophisticated, not just label/icon.

Common fields:

- `label`
- `icon`
- `bubble`
- `hint`
- `excludedSections`
- `customSettingsPropertiesOrder`
- `customStylePropertiesOrder`

### 6.3 `options`

Common current fields:

- `displayAllowedValues`
- `forceHydration`
- `autoByContent`
- `icons`
- `linkable`

### 6.4 `states`

Declare states that runtime may toggle:

- `focus`
- `readonly`
- `checked`
- `active`

### 6.5 `triggerEvents`

Workflow-facing events declared in config and emitted in runtime.

### 6.6 `actions`

Imperative APIs declared in config and implemented in runtime.

## 7. Property System

Common property fields:

- `label`
- `type`
- `section`
- `bindable`
- `defaultValue`
- `options`
- `hidden`
- `responsive`
- `classes`
- `states`
- `editorOnly`
- `navigator`
- `bindingValidation`
- `propertyHelp`
- `multilang`

Common property types in this repo:

- `Text`
- `Textarea`
- `Number`
- `OnOff`
- `TextSelect`
- `TextRadioGroup`
- `BigIconRadioGroup`
- `Color`
- `Length`
- `Spacing`
- `Border`
- `Shadows`
- `FontFamily`
- `SystemIcon`
- `Array`
- `Object`
- `ObjectList`
- `Collection`
- `ObjectPropertyPath`
- `Formula`
- `Info`
- `InfoBox`
- `Button`
- `Tabs`
- `Title`

## 8. Formula Mapping vs ObjectPropertyPath

This is one of the most important architectural decisions.

### Use `Formula` when:

- the component consumes external API or database data
- the input object shape may vary by project
- fallback logic is needed
- transformation or normalization is needed
- the mapped item may be primitive or object

Canonical pattern:

```js
mappingLabel: {
  type: 'Formula',
  options: content => ({
    template: Array.isArray(content.choices) ? content.choices[0] : null,
  }),
  defaultValue: {
    type: 'f',
    code: "context.mapping?.['label'] || context.mapping",
  },
}
```

Runtime:

```js
const { resolveMappingFormula } = wwLib.wwFormula.useFormula();
const label = resolveMappingFormula(props.content.mappingLabel, item) ?? item.label;
```

### Use `ObjectPropertyPath` when:

- only a simple path picker is needed
- the field is truly just one property path
- you want a lighter UX

### Practical decision

- prefer `Formula` for serious data widgets
- use `ObjectPropertyPath` for simpler schema-aware selection
- combine both when useful

## 9. Collection Access

Current normalization APIs:

- `wwLib.wwCollection.getCollectionData(...)`
- `wwLib.wwUtils.getDataFromCollection(...)`

Use normalized collection access whenever a property may represent:

- a literal array
- a WeWeb collection
- bound collection-like data

## 10. Internal Variables

Use `wwLib.wwVariable.useComponentVariable(...)` for platform-visible internal state.

Typical uses:

- form field value
- selected rows
- filters
- sort model
- dragging state
- current calendar view
- selected event
- upload state
- mention state

Canonical shape:

```js
const { value, setValue } = wwLib.wwVariable.useComponentVariable({
  uid: props.uid,
  name: 'value',
  type: 'any',
  defaultValue: computed(() => props.content.initValueSingle ?? null),
});
```

## 11. Form Integration

If a component behaves like a real field, it usually needs:

- internal value variable
- `inject('_wwForm:useForm', ...)`
- field metadata such as name and validation

Canonical pattern:

```js
const useForm = inject('_wwForm:useForm', () => {});
useForm(
  variableValue,
  { fieldName, validation, customValidation, initialValue },
  { elementState: props.wwElementState, emit, sidepanelFormPath: 'form', setValue }
);
```

## 12. State Synchronization

Use runtime emits to synchronize platform states:

```js
emit('add-state', 'focus');
emit('remove-state', 'focus');
```

Common state meanings:

- focus
- readonly
- checked
- active

## 13. Editor-Orchestration APIs

These are critical in modern WeWeb components.

### 13.1 `wwEditorState.boundProps`

Use to detect when a property is bound and adapt editor UX.

Typical uses:

- show/hide mapping fields
- clear derived config when bindings are removed

### 13.2 `wwEditorState.sidepanelContent`

Use for editor-only UI state.

Typical uses:

- selected slide/media/tab
- force-open editor preview
- helper warnings and hints

### 13.3 `wwEditorState.isACopy`

Use as a guard against destructive editor automation during copy/duplicate flows.

## 14. Update Channels

Current components rely on three mutation channels:

- `update:content`
- `update:content:effect`
- `update:sidepanel-content`

Decision rule:

- direct content change: `update:content`
- derived/editor-managed structure: `update:content:effect`
- editor-only UI state: `update:sidepanel-content`

## 15. Hidden Embedded Elements

This is one of the key WeWeb no-code patterns.

Example:

```js
itemTemplate: {
  hidden: true,
  defaultValue: {
    isWwObject: true,
    type: 'ww-flexbox',
  },
  navigator: {
    group: 'Item Template',
  },
}
```

Render with:

```vue
<wwElement v-bind="content.itemTemplate" />
```

Use for:

- repeated templates
- nested editable visual structure
- compound components

## 16. Repeated Rendering

Use `wwLayoutItemContext` to inject per-item context into nested no-code trees.

Canonical pattern:

```vue
<wwLayoutItemContext is-repeat :index="index" :data="item">
  <wwElement v-bind="content.itemTemplate" />
</wwLayoutItemContext>
```

Additional fields may include:

- `item`
- `repeated-items`

## 17. Compound Components and `ww-props`

Parents can pass runtime props into nested WeWeb elements:

```vue
<wwElement
  v-bind="content.stackElement"
  :ww-props="{ items: stack.items, stack: stack.value }"
/>
```

Use when:

- parent owns orchestration
- child owns rendering

## 18. Dropzones and Containers

Use `<wwLayout path="...">` for editable child areas.

Container-like components may also use:

- `inherit-from-element`
- `wwFrontState.screenSize`
- editor-side grid mutation

## 19. Editor Automation

Current repo uses:

- `wwLib.useCreateElement()`
- `wwLib.createElement(...)`
- `cloneElement`

Use for:

- auto-provisioned slides
- hidden child trees
- auto-generated sub-elements

## 20. Floating UI and Global DOM

For dropdowns and overlays:

- use `teleport`
- compute position from trigger geometry
- listen to scroll/resize
- mount in the front document
- use `wwLib.getFrontDocument()` and `wwLib.getFrontWindow()`

## 21. Anti-Patterns

Avoid these:

- treating `content` like static props only
- building serious data widgets with only `ObjectPropertyPath`
- making fields without `useForm(...)`
- ignoring `boundProps` and `sidepanelContent`
- hardcoding repeated render without `wwLayoutItemContext`
- skipping `update:content:effect` when editor-managed structure exists
- using raw DOM globals when front-document helpers are available

## 22. Recommended Reference Components

Use these as primary references:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-datagrid-ag`
- `ww-kanban`
- `ww-timeline`
- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-columns`
- `ww-container`

## 23. Build Decision Checklist

Before implementing a component, answer:

1. Is it an input, selector, repeated template, data widget, container, or builder?
2. Does it need `inherit`?
3. Does it need `wwElementState`, `wwEditorState`, `wwFrontState`?
4. Does it need internal variables?
5. Does it need form integration?
6. Should it use `Formula` mapping?
7. Does it need hidden embedded elements?
8. Does it need repeated context?
9. Does it need editor mutation channels?
10. Does it need create/clone element automation?
11. Does it need floating UI or front-document access?

## 24. Companion Files

- `WEWEB_COMPONENTS_FOR_CODEX.md`
  - long onboarding guide for agents
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
  - current repo-aware pattern summary
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
  - quick index by use case
- `WeWeb-Component-Development-Guide.md`
  - stricter constraints and mandatory implementation rules

