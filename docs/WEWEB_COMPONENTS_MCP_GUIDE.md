# WeWeb Components MCP Guide

Practical repo-aware guide to current WeWeb component patterns, based on:

- official WeWeb docs
- current components in this repository
- runtime/editor conventions observed in real implementations

This document focuses on what is actually used now, including newer patterns that older notes either missed or understated.

Role:

- repo-aware summary of current patterns confirmed in the cloned components

Companion files:

- `README_AGENT_PACK.md`
- `WEWEB_COMPONENTS_MASTER_GUIDE.md`
- `WEWEB_COMPONENT_API_MATRIX.md`
- `WEWEB_COMPONENTS_FOR_CODEX.md`
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
- `WeWeb-Component-Development-Guide.md`

## 1. Current Mental Model

Modern WeWeb components in this repo are not just Vue components with props.

They are usually built from four layers:

1. `ww-config.js`
   - declares editor schema and component contract
2. `src/wwElement.vue` or `src/wwSection.vue`
   - runtime and editor-aware behavior
3. platform APIs exposed through `wwLib`
   - variables, formulas, collections, editor state, DOM access, icons, notifications, element creation
4. hidden embedded WeWeb element trees
   - used for no-code templating, compound widgets, and editor-managed inner structure

The main split is still:

- `ww-config.js` defines what the editor knows
- runtime Vue code defines how the component behaves

But current components also rely heavily on:

- `boundProps`
- `sidepanelContent`
- `wwElementState`
- `wwFrontState`
- hidden child trees
- formula mapping
- editor-only orchestration

## 2. File Shapes Used in Current Components

Common structures:

```text
component/
  ww-config.js
  src/
    wwElement.vue
  package.json
```

Also common:

```text
component/
  ww-config.js
  src/
    wwSection.vue
```

and richer components may also contain:

- `src/components/*`
- `src/composables/*`
- `src/editor/*`
- `src/use/*`
- `AI.md`

Current examples:

- inputs: `ww-input-basic`, `ww-input-select`, `ww-input-rich-text`, `ww-input-checkbox`, `ww-input-date-time-picker`
- data widgets: `ww-calendar`, `ww-datagrid-ag`, `ww-data-grid`, `ww-kanban`, `ww-timeline`, `ww-chat`, `ww-chat-ai`
- compound/embedded widgets: `ww-slider`, `ww-sliderV2`, `ww-lightbox`
- layout/container components: `ww-container`, `ww-columns`, `ww-modal`, `ww-webapp-sidebar`

## 3. What `ww-config.js` Really Contains Now

Typical top-level fields still include:

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

### 3.1 `inherit`

Observed forms:

- object form:
  - `inherit: { type: 'ww-layout' }`
  - `inherit: { type: 'ww-text', exclude: ['text'] }`
- array form:
  - `inherit: ['ww-text']`

Meaning:

- reuse editor/style behavior from an existing WeWeb type
- optionally exclude inherited capabilities

Current examples:

- `ww-timeline`
- `ww-tab-list`
- `ww-tab-content`
- `ww-tab-trigger`
- `ww-number`
- `ww-text`

### 3.2 `editor`

Currently used far beyond label/icon.

Observed capabilities:

- `label`
- `icon`
- `bubble`
- `hint`
- `customSettingsPropertiesOrder`
- `customStylePropertiesOrder`
- `excludedSections`

Grouping patterns actually used:

- string property key
- array of property keys
- object group:

```js
{
  label: 'Header',
  isCollapsible: true,
  properties: ['headerBgColor', 'headerTextColor']
}
```

Large current examples:

- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-input-select`
- `ww-input-rich-text`

### 3.3 `options`

Important currently used flags:

- `displayAllowedValues`
- `forceHydration`
- `autoByContent`
- `icons`
- `linkable`

Examples:

- `ww-modal`: `forceHydration: true`
- `ww-input-rich-text`: `icons: [...]`
- `ww-input-select`: `autoByContent: true`
- `ww-columns`, `ww-accordion-trigger`, `ww-text`: `linkable: true`

### 3.4 `states`

Still important, but now used more systematically with runtime emits.

Current examples:

- `ww-checkbox`: `['checked', 'readonly']`
- `ww-input-select`: `['focus', 'readonly']`
- `ww-kanban`: `['readonly']`
- `ww-tab-trigger`: active/focus behavior in runtime

### 3.5 `triggerEvents`

Modern components expose richer payloads than older form-only components.

Observed patterns:

- plain events with `{ value: ... }`
- domain events with structured payloads
- editor test helpers via `getTestEvent`

Examples:

- `ww-calendar`: click, drag, resize, view-change events
- `ww-chat`, `ww-chat-ai`: message and attachment events
- `ww-kanban`: drag/move event with list state
- `ww-datagrid-ag`: row, cell, filter, sort, drag, column-order events

### 3.6 `actions`

Actions remain declarative in config but are implemented by runtime methods with matching names.

Examples:

- `ww-calendar`: `changeView`, `goToDate`, `next`, `prev`, `today`
- `ww-input-select`: open/close/toggle/set/reset/focus actions
- `ww-input-rich-text`: formatting commands
- `ww-chat`, `ww-chat-ai`: `scrollToBottom`

## 4. Property System: What Is Actually Used

Observed property families include:

- text-like: `Text`, `Textarea`, `Title`
- numbers/boolean: `Number`, `OnOff`
- selects/radios: `TextSelect`, `TextRadioGroup`, `BigIconRadioGroup`
- visual/style: `Color`, `Length`, `Spacing`, `Border`, `Shadows`, `FontFamily`, `SystemIcon`
- structured data: `Array`, `Object`, `ObjectList`, `Collection`, `ObjectPropertyPath`, `Formula`
- editor-only helpers: `Info`, `InfoBox`, `Button`, `Tabs`

Common flags:

- `section: 'settings' | 'style'`
- `bindable: true`
- `bindable: 'repeatable'`
- `defaultValue`
- `options`
- `hidden`
- `responsive`
- `classes`
- `states`
- `editorOnly`
- `propertyHelp`
- `bindingValidation`
- `multilang`
- `navigator`

### 4.1 `hidden(...)` is now editor orchestration, not just cosmetic UX

Current signatures often use:

```js
hidden: (content, sidepanelContent, boundProps, wwProps) => ...
```

This is used to:

- show mapping fields only when data is bound
- hide overrides when parent `wwProps` already control a value
- hide attachment mapping fields until attachment formulas exist
- hide editor-only controls depending on sidepanel context

Key current examples:

- `ww-chat`
- `ww-chat-ai`
- `ww-kanban`
- `ww-input-rich-text`
- `ww-input-select`
- `ww-modal`

## 5. The Biggest Update: Formula Mapping Is Now a First-Class Pattern

For current data-heavy components, `ObjectPropertyPath` alone is no longer enough. The stronger pattern is:

1. accept bindable array/object input
2. expose one or more `Formula` properties for field mapping
3. set `options.template` from a representative item
4. resolve values at runtime through `wwLib.wwFormula.useFormula().resolveMappingFormula(...)`

### 5.1 Where this is clearly used now

- `ww-calendar`
- `ww-input-select`
- `ww-chat`
- `ww-chat-ai`
- `ww-datagrid-ag`
- `ww-radiogroup`

### 5.2 Typical config pattern

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

### 5.3 Typical runtime pattern

```js
const { resolveMappingFormula } = wwLib.wwFormula.useFormula();
const label = resolveMappingFormula(props.content.mappingLabel, item) ?? item.label;
```

### 5.4 Practical rule

Use `Formula` when:

- data shape may vary across projects
- component is intended for external API/database binding
- you need fallback logic such as `url ?? href`
- nested/derived values matter
- current item might be primitive or object

Use `ObjectPropertyPath` when:

- the component only needs a simple path picker
- the mapping is genuinely just one property path
- editor UX should stay minimal

Use both together when needed:

- `ObjectPropertyPath` for simple structural selection
- `Formula` for production-grade mapping and transformation

## 6. Collection and Data Input Patterns

Current repo uses:

- `wwLib.wwCollection.getCollectionData(...)`
- `wwLib.wwUtils.getDataFromCollection(...)`

Use normalized access when a property may be:

- plain array
- collection
- collection-backed binding

Primitive-or-object normalization is also common in components like `ww-input-radio`.

## 7. Internal State and Variables

`wwLib.wwVariable.useComponentVariable(...)` remains foundational, but current usage is broader than older docs described.

Used for:

- field value
- selected rows
- filters/sort
- current calendar view
- selected calendar event
- dragging state
- mention state
- upload/attachment state
- slider image state

Current examples:

- `ww-calendar`
- `ww-input-select`
- `ww-input-rich-text`
- `ww-datagrid-ag`
- `ww-kanban`
- `ww-video-*`

Important update:

- current components often pass a `computed(...)` as `defaultValue`
- this keeps internal variables aligned with reactive config defaults

## 8. Form Integration Patterns

The classic pattern is still valid:

- `useComponentVariable`
- `inject('_wwForm:useForm', ...)`
- register with field metadata

Current examples:

- `ww-input-select`
- `ww-input-checkbox`
- `ww-input-rich-text`

Typical shape:

```js
const useForm = inject('_wwForm:useForm', () => {});
useForm(
  variableValue,
  { fieldName, validation, customValidation, initialValue },
  { elementState: props.wwElementState, emit, sidepanelFormPath: 'form', setValue }
);
```

Newer detail:

- many components also use editor-only `formInfobox`
- visibility is driven by `sidepanelContent.form`

## 9. `wwElementState`, `wwEditorState`, `wwFrontState`

### 9.1 `wwElementState`

Used for:

- current states
- inherited props
- attributes
- platform-managed readonly/focus values
- element name/id for form controls

### 9.2 `wwEditorState`

Used for:

- edit mode checks
- `isSelected`
- `isACopy`
- `boundProps`
- `sidepanelContent`

This is the backbone of editor orchestration.

### 9.3 `wwFrontState`

Used for:

- `screenSize`
- `sectionId`

Examples:

- `ww-container`
- `ww-columns`
- `ww-sliderV2`
- `ww-lightbox`

## 10. Update Channels Between Runtime and Editor

The three core mutation channels are:

- `update:content`
- `update:content:effect`
- `update:sidepanel-content`

### 10.1 `update:content`

Used for direct content mutation.

Examples:

- `ww-slider`
- `ww-sliderV2`
- `ww-columns`
- `ww-label`

### 10.2 `update:content:effect`

Used when the component mutates editor-managed derived structures or hidden child trees.

Examples:

- `ww-container`
- `ww-columns`
- `ww-lightbox`
- `ww-mapbox`
- `ww-input-rich-text`
- `ww-datagrid-ag`

### 10.3 `update:sidepanel-content`

Used to sync editor-only UI state.

Examples:

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-modal`
- `ww-input-select`
- `ww-video-*`

## 11. Editor-Orchestrated Automation

Current components create or clone hidden inner elements when config changes.

APIs seen now:

- `wwLib.useCreateElement()`
- `wwLib.createElement(...)`
- `createElement`
- `cloneElement`

Examples:

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-input-checkbox`
- `ww-datagrid-ag`

Container-like components also check `wwEditorState.isACopy` to avoid destructive editor automation.

## 12. Hidden Embedded Elements and Compound Components

Typical hidden element property:

```js
someElement: {
  hidden: true,
  defaultValue: { isWwObject: true, type: 'ww-flexbox' },
}
```

Rendered with:

```vue
<wwElement v-bind="content.someElement" />
```

Compound variant:

```vue
<wwElement
  v-bind="content.stackElement"
  :ww-props="{ items: stack.items, stack: stack.value }"
/>
```

Current examples:

- `ww-kanban`
- `ww-timeline`
- `ww-input-radio`
- `ww-lightbox`

## 13. Repeated Item Rendering

`wwLayoutItemContext` is still the main primitive.

Current patterns:

```vue
<wwLayoutItemContext is-repeat :index="index" :data="item">
  <wwElement v-bind="content.template" />
</wwLayoutItemContext>
```

Also observed:

- `:item="..."`
- `:repeated-items="..."`

Examples:

- `ww-timeline`
- `ww-kanban`
- `ww-input-radio`
- `ww-tab-trigger`

## 14. Dropzones and Layout Containers

Dropzones are created with `<wwLayout path="...">`.

Current repo also confirms more layout-specific APIs:

- `inherit-from-element`
- screen-aware mutation of grids/children
- editor overlays and placeholders

Examples:

- `ww-modal`
- `ww-container`
- `ww-columns`
- `ww-webapp-sidebar`

## 15. State Emission Patterns

Common emits:

- `add-state`
- `remove-state`

Examples:

- `ww-checkbox`
- `ww-input-checkbox`
- `ww-input-basic`
- `ww-kanban`
- `ww-tab-trigger`
- `ww-input-date-time-picker`
- `ww-input-rich-text`

Typical usage:

- focus
- readonly
- checked
- active

## 16. DOM and Platform Isolation

Observed APIs:

- `wwLib.getFrontDocument()`
- `wwLib.getFrontWindow()`

Examples:

- `ww-kanban` injects temporary drag cursor CSS into front document
- `ww-input-select` teleports to `#app` in the front document and blocks scrolling via front window/document
- `ww-input-recaptcha` uses front window for global callback/bootstrap

## 17. Teleport, Overlays, and Global UI

Complex floating UI often needs global mounting.

Pattern:

- mount popup/dropdown via `teleport`
- compute position from trigger rect
- listen to scroll/resize on front window

Best example:

- `ww-input-select`

## 18. Provide/Inject and Local Context APIs

Current components use `provide/inject` for compound architecture more than older docs captured.

Observed uses:

- drag handlers in `ww-kanban`
- select internals in `ww-input-select`
- form hooks via `_wwForm:*`

`ww-input-select` also registers local context through:

- `wwLib.wwElement.useRegisterElementLocalContext(...)`

## 19. Dynamic Runtime Styling Through Formulas

Formula is not only for mapping bound records.

Example:

- `ww-datagrid-ag` computes header styles per column using `Formula`

The mapping context can be a derived object such as:

```js
{
  id,
  name,
  dataType,
  type,
}
```

## 20. Recommended Patterns by Use Case

### 20.1 Simple input component

Use:

- bindable initial value
- `useComponentVariable`
- `useForm(...)`
- `triggerEvents.change`
- `wwElementState.props.attributes`
- `add-state` / `remove-state` for focus/readonly if relevant

Good refs:

- `ww-input-basic`
- `ww-input-checkbox`
- `ww-input-select`

### 20.2 Data-driven selector/list control

Use:

- bindable list input
- `Formula` mapping for label/value/icon/image/disabled
- optional search
- local context or option registration if component is compound

Good refs:

- `ww-input-select`
- `ww-input-radio`
- `ww-radiogroup`

### 20.3 Repeated visual template

Use:

- bindable collection
- hidden embedded element
- `wwLayoutItemContext`
- optional `ww-props`

Good refs:

- `ww-timeline`
- `ww-kanban`

### 20.4 Complex data widget

Use:

- normalized collection access
- formula mapping
- internal variables for selection/sort/filter
- rich `triggerEvents`
- actions if imperative control is needed

Good refs:

- `ww-calendar`
- `ww-datagrid-ag`
- `ww-chat`
- `ww-chat-ai`

### 20.5 Builder/editor-managed component

Use:

- hidden child trees
- `useCreateElement` / `createElement`
- `update:content:effect`
- `update:sidepanel-content`
- copy guards via `isACopy`

Good refs:

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-datagrid-ag`
- `ww-columns`
- `ww-container`

## 21. Main Corrections to Older Notes

1. `Formula` is now a first-class mapping mechanism, not an edge case.
2. `ObjectPropertyPath` is still useful, but no longer the best universal pattern for modern data-driven components.
3. `boundProps` and `sidepanelContent` are part of core editor logic, not optional details.
4. `wwFrontState` matters in real container/editor orchestration.
5. Complex components increasingly use `teleport`, `provide/inject`, and local context registration.
6. Hidden child element automation through `createElement`/`update:content:effect` is a normal production pattern.
7. Current repo patterns rely more heavily on internal variables than older notes implied.
8. Event payloads and actions have become much richer and more domain-specific.

## 22. Minimal Baseline Checklist for New Components

Before implementing a new component, verify:

1. Is it an input, selector, data widget, layout container, repeated template, or editor-managed builder?
2. Does it need `inherit`?
3. Does it need `wwElementState`, `wwEditorState`, and possibly `wwFrontState`?
4. Does it need internal variables via `useComponentVariable`?
5. Does it need form registration via `useForm(...)`?
6. Should it use `Formula` mapping instead of only `ObjectPropertyPath`?
7. Does it need `boundProps`-aware editor behavior?
8. Does it need `update:content`, `update:content:effect`, or `update:sidepanel-content`?
9. Does it need hidden embedded elements and `<wwElement>`?
10. Does it need `wwLayoutItemContext` for repeated rendering?
11. Does it need editor automation via `createElement` or `cloneElement`?
12. Does it need platform-safe DOM access through `wwLib.getFrontDocument()` / `wwLib.getFrontWindow()`?

## 23. Best Current Reference Components

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

## 24. Sources

Official:

- https://developer.weweb.io/component-anatomy.html
- https://developer.weweb.io/add-dropzone.html
- https://developer.weweb.io/add-element-property.html
- https://developer.weweb.io/add-translated-property.html
- https://developer.weweb.io/use-element-state.html
- https://developer.weweb.io/update-content.html
- https://developer.weweb.io/custom-editor-interface.html

Repository references:

- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-columns`
- `ww-container`
- `ww-datagrid-ag`
- `ww-input-rich-text`
- `ww-input-select`
- `ww-kanban`
- `ww-lightbox`
- `ww-slider`
- `ww-sliderV2`
- `ww-timeline`

