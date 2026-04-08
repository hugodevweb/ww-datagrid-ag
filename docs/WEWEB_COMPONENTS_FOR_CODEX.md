# WeWeb Components for Codex

This document is the primary onboarding guide for an AI agent that has never seen WeWeb components before.

It is intentionally redundant.

Its goals are:

- explain the WeWeb component model from zero
- document the current patterns used in this repository
- help an agent choose the right architecture before writing code
- reduce wrong assumptions about editor/runtime behavior

Role:

- long-form onboarding guide for an AI agent starting from zero

Companion files:

- `README_AGENT_PACK.md`
- `WEWEB_COMPONENTS_MASTER_GUIDE.md`
- `WEWEB_COMPONENT_API_MATRIX.md`
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
- `WeWeb-Component-Development-Guide.md`

Use this when the agent needs the full conceptual walkthrough.
Use `WEWEB_COMPONENTS_MASTER_GUIDE.md` when one canonical file is preferred.

## 1. What a WeWeb Component Actually Is

A WeWeb custom component is not just a Vue component dropped into an app.

It is a Vue component that is:

- registered into the WeWeb editor/runtime through `ww-config.js`
- configured through an editor-facing schema
- rendered with platform props and platform helpers
- expected to work in both runtime and editor
- often expected to expose workflows, actions, form behavior, states, and no-code child editing

In practice, almost every real component has two layers:

1. declarative contract in `ww-config.js`
2. runtime implementation in `src/wwElement.vue` or `src/wwSection.vue`

The shortest correct mental model is:

- `ww-config.js` tells WeWeb what the component is
- Vue code tells WeWeb how the component behaves

## 2. The Four Layers You Must Keep in Mind

When reading or writing a component, think in four layers:

### 2.1 Schema Layer

Defined in `ww-config.js`.

This covers:

- label
- icon
- settings
- style properties
- bindable properties
- events
- actions
- hidden embedded elements
- custom editor grouping

### 2.2 Runtime Layer

Defined in `src/wwElement.vue` or `src/wwSection.vue`.

This covers:

- rendering
- reactivity
- event emission
- form registration
- state synchronization
- collection normalization
- nested WeWeb elements

### 2.3 Platform Layer

Exposed through `wwLib` and runtime props.

This covers:

- variables
- formulas
- collections
- DOM access
- icon loading
- notifications
- element creation
- local context registration

### 2.4 Editor-Orchestration Layer

This is where many agents fail because they think only about runtime UI.

This covers:

- `wwEditorState.boundProps`
- `wwEditorState.sidepanelContent`
- hidden inner elements
- sidepanel sync
- `update:content:effect`
- editor-only watchers
- copy guards
- auto-provisioned sub-elements

Modern WeWeb components often break if this layer is ignored.

## 3. Typical File Structures

The most common shape is:

```text
my-component/
  ww-config.js
  src/
    wwElement.vue
  package.json
```

Also common:

```text
my-container/
  ww-config.js
  src/
    wwSection.vue
  package.json
```

Richer components may also contain:

- `src/components/*`
- `src/composables/*`
- `src/use/*`
- `src/editor/*`
- `src/vendor/*`
- `AI.md`

Current real references in this repo:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-calendar`
- `ww-datagrid-ag`
- `ww-chat`
- `ww-chat-ai`
- `ww-kanban`
- `ww-timeline`
- `ww-slider`
- `ww-lightbox`

## 4. The Two Core Files

## 4.1 `ww-config.js`

This exports the component contract.

Typical top-level shape:

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

Not every component uses every field, but these are the main ones.

## 4.2 `src/wwElement.vue`

This is the runtime implementation for element-like components.

Typical responsibilities:

- read `content`
- read editor/runtime props
- normalize data
- register forms
- emit events
- expose actions
- render nested WeWeb elements

## 4.3 `src/wwSection.vue`

This is often used for container-like or section-like components.

Typical responsibilities:

- provide layout/dropzone areas
- manage editor-only visibility or sidepanel logic
- host arbitrary child content

## 5. Runtime Props You Will See

Common current props:

```js
props: {
  content: { type: Object, required: true },
  uid: { type: String, required: true },
  wwElementState: { type: Object, required: false },
  wwEditorState: { type: Object, required: false },
  wwFrontState: { type: Object, required: false },
}
```

### 5.1 `content`

`content` is the runtime instance of the schema declared in `ww-config.js`.

If `ww-config.js` defines:

```js
properties: {
  title: {
    type: 'Text',
    defaultValue: 'Hello',
  }
}
```

then runtime reads:

```js
props.content.title
```

### 5.2 `uid`

Unique component instance id.

This is used heavily by:

- `useComponentVariable`
- DOM ids
- drag-and-drop grouping
- per-instance state

### 5.3 `wwElementState`

Platform-managed state for the component instance.

Common uses:

- `wwElementState.states`
- `wwElementState.props`
- `wwElementState.props.attributes`
- `wwElementState.name`

This matters for:

- readonly/focus/checked logic
- preserving form attributes
- HTML attributes coming from the platform
- inherited values from outer WeWeb systems

### 5.4 `wwEditorState`

Editor-specific state and metadata.

Common fields used in current components:

- `wwEditorState.editMode`
- `wwEditorState.isSelected`
- `wwEditorState.isEditing`
- `wwEditorState.isACopy`
- `wwEditorState.boundProps`
- `wwEditorState.sidepanelContent`

This prop is essential for:

- editor-specific UI
- mapping visibility
- sidepanel synchronization
- avoiding destructive automation during copy

### 5.5 `wwFrontState`

Front-end context used by richer/container components.

Common fields seen in this repo:

- `wwFrontState.screenSize`
- `wwFrontState.sectionId`

This matters for:

- screen-aware grid/layout mutations
- section-scoped element creation
- responsive editor/runtime behavior

## 6. `ww-config.js` in Detail

## 6.1 `inherit`

This reuses behavior from an existing WeWeb type.

Observed forms:

```js
inherit: { type: 'ww-layout' }
```

```js
inherit: { type: 'ww-text', exclude: ['text'] }
```

```js
inherit: ['ww-text']
```

Current examples:

- `ww-timeline`
- `ww-number`
- `ww-text`
- `ww-tab-list`
- `ww-tab-content`
- `ww-tab-trigger`

Use `inherit` when the component should behave like a known built-in component for style/editor behavior.

## 6.2 `editor`

This defines how the component appears in the WeWeb editor.

Common fields:

- `label`
- `icon`
- `bubble`
- `hint`
- `excludedSections`
- `customSettingsPropertiesOrder`
- `customStylePropertiesOrder`

### Grouping patterns

Simple key:

```js
'placeholder'
```

Inline group:

```js
['fieldName', 'validation', 'customValidation']
```

Collapsible group:

```js
{
  label: 'Header',
  isCollapsible: true,
  properties: ['headerBgColor', 'headerTextColor']
}
```

Large references:

- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-input-select`
- `ww-input-rich-text`

## 6.3 `options`

Observed current options:

- `displayAllowedValues`
- `forceHydration`
- `autoByContent`
- `icons`
- `linkable`

Meaning:

- `displayAllowedValues`
  - restricts allowed display modes in the editor
- `forceHydration`
  - ensures the component is hydrated client-side when runtime logic needs it
- `autoByContent`
  - sizing/behavior depends on content
- `icons`
  - declares icon assets used by a richer component
- `linkable`
  - allows link behavior/editor affordances

## 6.4 `states`

Declares component states that can be toggled at runtime.

Examples:

- `['focus', 'readonly']`
- `['checked', 'readonly']`
- `['active']`

These are later manipulated with:

```js
emit('add-state', 'focus');
emit('remove-state', 'focus');
```

## 6.5 `triggerEvents`

Declares the events exposed to workflows.

Simple example:

```js
triggerEvents: [
  { name: 'change', label: { en: 'On change' }, event: { value: '' }, default: true }
]
```

Current repo also uses richer payloads for:

- calendar interactions
- chat events
- row/grid events
- drag-and-drop events

Some components also expose `getTestEvent`.

## 6.6 `actions`

Actions are imperative APIs exposed to the platform.

Examples:

- `changeView`
- `scrollToBottom`
- `focusEditor`
- `actionOpenDropdown`
- `actionResetValue`

If you declare an action, you must implement matching runtime behavior.

## 7. Properties: The Real Schema System

The property system is the core of WeWeb component authoring.

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

## 7.1 Property types actively used in this repo

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

## 7.2 `hidden(...)` is a major control surface

Do not think of `hidden` as simple cosmetic logic.

Current signatures may use:

```js
hidden: (content, sidepanelContent, boundProps, wwProps) => ...
```

This is used for:

- editor-only gating
- mapping fields that only appear when data is bound
- hiding child controls when parent `wwProps` override a value
- progressive configuration UX
- attachment and participant mapping sections

This is a core editor-orchestration mechanism.

## 7.3 `editorOnly`

Use this for editor UX state or helper controls that are not part of runtime business logic.

Common uses:

- warnings
- info boxes
- tabs
- selected submode
- editor-only toggles

## 7.4 `multilang`

If a property is translatable, runtime should usually read it through:

```js
wwLib.wwLang.getText(content.someProp)
```

Do not assume `content.someProp` is a plain string when `multilang` is involved.

## 8. The Biggest Current Pattern: Formula Mapping

This is the biggest update compared to older component notes.

For serious data-driven components, the current best pattern is often:

1. accept a bindable dataset
2. expose `Formula` properties for each important mapped field
3. feed a representative object into `options.template`
4. resolve values in runtime through `wwLib.wwFormula.useFormula().resolveMappingFormula(...)`

Canonical config shape:

```js
mappingLabel: {
  label: 'Label per item',
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

Canonical runtime shape:

```js
const { resolveMappingFormula } = wwLib.wwFormula.useFormula();
const label = resolveMappingFormula(props.content.mappingLabel, item) ?? item.label;
```

## 8.1 Where this is used right now

- `ww-calendar`
- `ww-input-select`
- `ww-chat`
- `ww-chat-ai`
- `ww-datagrid-ag`
- `ww-radiogroup`

## 8.2 When to use `Formula`

Use `Formula` when:

- the input shape may vary across projects
- the component is intended for collections, API data, database rows, external bindings
- you need fallback logic like `url ?? href`
- the mapped item may be primitive or object
- mapping needs to derive, transform, or normalize values

## 8.3 When to use `ObjectPropertyPath`

Use `ObjectPropertyPath` when:

- you only need a simple path picker
- the mapping is genuinely just one field path
- you want a lighter UX than full formula mapping

## 8.4 The practical rule

Prefer `Formula` for production-grade data widgets.
Use `ObjectPropertyPath` for simpler structural selection.
Use both together when it improves UX.

## 9. Collection Access Patterns

Current repo uses two common normalization helpers:

```js
wwLib.wwCollection.getCollectionData(content.someCollection)
```

and

```js
wwLib.wwUtils.getDataFromCollection(content.rowData)
```

Use normalized collection access whenever the property might contain:

- plain array
- WeWeb collection
- collection-backed dynamic data

Some components also normalize arrays of primitives and arrays of objects into one runtime shape.

Good example:

- `ww-input-radio`

## 10. Internal Variables via `useComponentVariable`

This is one of the most important APIs in WeWeb components.

Use:

```js
const { value, setValue } = wwLib.wwVariable.useComponentVariable({
  uid: props.uid,
  name: 'value',
  type: 'any',
  defaultValue: computed(() => props.content.initValueSingle ?? null),
});
```

Current usages include:

- form field values
- selected rows
- filters
- sort models
- current calendar view
- selected event
- dragging state
- mention state
- upload state
- image loading state

This variable is often visible to the platform and workflows, not only internal to the Vue tree.

## 11. Form Integration

If the component is a real field, use WeWeb form registration.

Canonical pattern:

```js
const useForm = inject('_wwForm:useForm', () => {});

useForm(
  variableValue,
  { fieldName, validation, customValidation, initialValue },
  { elementState: props.wwElementState, emit, sidepanelFormPath: 'form', setValue }
);
```

Common supporting properties:

- `fieldName`
- `validation`
- `customValidation`
- `required`
- `initialValue`

Current references:

- `ww-input-select`
- `ww-input-checkbox`
- `ww-input-rich-text`

## 12. Runtime Events

Workflow events are usually emitted with:

```js
emit('trigger-event', {
  name: 'change',
  event: { value: nextValue },
});
```

Current components also emit domain-specific payloads such as:

- calendar event metadata
- message payloads
- attachment payloads
- row/cell/filter/sort data
- drag source/target information

Use meaningful payloads, not only `{ value }`, when the domain benefits from it.

## 13. Actions

Actions are imperative entry points exposed to workflows or parent systems.

Declare them in config, implement them in runtime.

Examples:

- dropdown open/close/reset
- editor focus
- scroll to bottom
- calendar navigation
- formatting commands

Action naming in this repo may be either:

- direct domain action names like `changeView`
- explicit prefixed names like `actionOpenDropdown`

Follow the existing pattern of the component you are modifying.

## 14. State Synchronization

Current components actively synchronize runtime booleans into WeWeb states.

Pattern:

```js
emit('add-state', 'readonly');
emit('remove-state', 'readonly');
```

Common states:

- `focus`
- `readonly`
- `checked`
- `active`

Examples:

- `ww-input-select`
- `ww-input-checkbox`
- `ww-input-basic`
- `ww-kanban`
- `ww-tab-trigger`
- `ww-input-date-time-picker`

## 15. `wwElementState` in Practice

Use it for:

- current declared states
- platform-provided readonly overrides
- HTML attributes
- input names/ids
- inherited props

Examples:

```js
props.wwElementState.states
props.wwElementState.props
props.wwElementState.props.attributes
props.wwElementState.name
```

This matters especially for form-compatible inputs.

## 16. `wwEditorState` in Practice

This prop is central to advanced editor-aware behavior.

Current repo uses it for:

- edit mode checks
- editor-only rendering changes
- binding-aware property visibility
- sidepanel synchronization
- avoiding copy-related destructive mutations
- selection-based state behavior

Important fields:

- `editMode`
- `isEditing`
- `isSelected`
- `isACopy`
- `boundProps`
- `sidepanelContent`

## 17. `wwFrontState` in Practice

Use this when the component must react to front-end context.

Current uses include:

- current screen size
- section id

This matters in:

- containers
- columns/layout builders
- sliders
- lightboxes

## 18. The Three Update Channels

These are essential:

### 18.1 `update:content`

Direct content mutation.

Used for:

- setting config values
- replacing simple content structures

### 18.2 `update:content:effect`

Derived or editor-managed mutation.

Used for:

- hidden child tree updates
- editor effects
- auto-provisioned structures
- binding cleanup/reset

### 18.3 `update:sidepanel-content`

Editor-only UI state updates.

Used for:

- selected slide/media index
- forced-open toggles
- editor hints and helper state

If you are building a rich component and never touch these channels, there is a good chance you are missing part of the real editor contract.

## 19. Hidden Embedded Elements

One of the most important WeWeb patterns is storing editable child trees as hidden properties.

Example:

```js
itemTemplate: {
  hidden: true,
  defaultValue: {
    isWwObject: true,
    type: 'ww-flexbox',
  },
}
```

Render it with:

```vue
<wwElement v-bind="content.itemTemplate" />
```

This pattern powers:

- editable templates
- embedded controls
- compound widgets
- repeated no-code subtrees

## 19.1 `navigator`

If a hidden child tree should still be editable in the editor, expose it through `navigator`.

Example shape:

```js
navigator: {
  group: 'Item Template',
}
```

## 20. Repeated Item Rendering

Use `wwLayoutItemContext` to expose per-item context to nested no-code elements.

Canonical pattern:

```vue
<wwLayoutItemContext is-repeat :index="index" :data="item">
  <wwElement v-bind="content.itemTemplate" />
</wwLayoutItemContext>
```

Richer forms may also pass:

- `item`
- `repeated-items`

Current examples:

- `ww-timeline`
- `ww-kanban`
- `ww-input-radio`
- `ww-tab-trigger`

## 21. Compound Components and `ww-props`

A parent component can render an embedded child and pass runtime props into it.

Pattern:

```vue
<wwElement
  v-bind="content.stackElement"
  :ww-props="{ items: stack.items, stack: stack.value }"
/>
```

This is powerful when:

- the parent owns orchestration/data logic
- the child owns visual rendering

Best current reference:

- `ww-kanban`

## 22. Dropzones and Containers

Use `<wwLayout path="...">` for editable child areas or slots.

Simple pattern:

```vue
<wwLayout path="bodyContent" direction="column" />
```

Advanced container components may also use:

- `inherit-from-element`
- screen-aware grid systems
- editor overlays
- hidden structural content

Key references:

- `ww-modal`
- `ww-container`
- `ww-columns`
- `ww-webapp-sidebar`

## 23. Editor-Orchestrated Automation

Current WeWeb components often create or clone internal child elements automatically.

Important APIs:

- `wwLib.useCreateElement()`
- `wwLib.createElement(...)`
- `createElement`
- `cloneElement`

Use these for:

- sliders
- lightboxes
- auto-generated cell renderers
- hidden embedded sub-structures

Important references:

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-datagrid-ag`

## 24. Copy Guards and Editor Safety

When a component auto-mutates editor content, check for copy scenarios.

Current pattern:

```js
if (this.wwEditorState.isACopy) return;
```

This prevents duplicate or destructive mutations during duplication/copy flows.

Seen in:

- `ww-container`
- `ww-columns`

## 25. Provide/Inject Patterns

Modern components use `provide/inject` for internal APIs.

Examples:

- `_wwForm:useForm`
- select internals
- kanban drag handlers

This is useful for:

- compound architectures
- deep child coordination
- editor/runtime integration

## 26. Local Context Registration

Some advanced components expose local context to nested authoring surfaces.

Current API:

- `wwLib.wwElement.useRegisterElementLocalContext(...)`

Best example:

- `ww-input-select`

This helps nested elements access structured local data and markdown documentation.

## 27. Floating UI and Teleport

Complex popups often need global mounting.

Current pattern:

- `teleport` dropdown/popup to a front-document mount point
- measure trigger rect
- recompute position on scroll/resize
- optionally block page scrolling

Best current reference:

- `ww-input-select`

## 28. DOM Access Rules

Prefer platform-safe DOM helpers:

- `wwLib.getFrontDocument()`
- `wwLib.getFrontWindow()`

Use these for:

- injecting styles
- querying the app root
- scroll handling
- global callbacks
- script/library integration

Do not assume raw `window` and `document` are the right context.

## 29. Dynamic Runtime Styling Through Formula

`Formula` is not only for row/record mapping.

Current repo also uses formula-based styling.

Best example:

- `ww-datagrid-ag`

There, header styles are computed from a mapping context like:

```js
{
  id,
  name,
  dataType,
  type,
}
```

This means formulas can also be used for:

- metadata-driven style
- per-column behavior
- dynamic labels

## 30. Practical Recipes

## 30.1 Recipe: Form-Compatible Input

Use:

- `value` internal variable
- `useForm(...)`
- `triggerEvents.change`
- optional `initValueChange`
- `wwElementState.props.attributes`
- focus/readonly state sync

References:

- `ww-input-basic`
- `ww-input-checkbox`
- `ww-input-select`

## 30.2 Recipe: Data-Driven Select or Picker

Use:

- normalized collection input
- `Formula` mapping for label/value
- optional mapping for icon/image/disabled
- search if needed
- internal selection state
- actions like open/close/focus/reset

Reference:

- `ww-input-select`

## 30.3 Recipe: Repeated No-Code Template

Use:

- bindable dataset
- hidden embedded template
- `wwLayoutItemContext`
- nested `<wwElement>`

References:

- `ww-timeline`
- `ww-kanban`

## 30.4 Recipe: Complex Data Widget

Use:

- formula mapping
- normalized data input
- internal platform variables
- richer workflow events
- actions for imperative control

References:

- `ww-calendar`
- `ww-datagrid-ag`
- `ww-chat`
- `ww-chat-ai`

## 30.5 Recipe: Editor-Managed Builder

Use:

- hidden child trees
- `createElement` / `cloneElement`
- sidepanel sync
- `update:content:effect`
- copy guards

References:

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`
- `ww-columns`
- `ww-container`

## 31. Common Mistakes

### 31.1 Treating `content` as plain static props

Wrong mental model.

`content` is schema-driven editor/runtime state.

### 31.2 Using only `ObjectPropertyPath` for serious data-driven widgets

This is often too weak now.

Prefer `Formula` mapping when:

- data shape varies
- values need fallback logic
- complex external bindings are expected

### 31.3 Forgetting `wwLang.getText(...)`

If a property may be translated, do not render raw `content.foo`.

### 31.4 Building a field without `useForm(...)`

It may look like an input but not behave like a WeWeb form field.

### 31.5 Ignoring `boundProps` and `sidepanelContent`

Many editor behaviors now depend on them.

### 31.6 Skipping `update:content:effect`

This often breaks builder-like or derived editor structures.

### 31.7 Hardcoding repeated rendering without `wwLayoutItemContext`

Nested no-code bindings will not get proper item context.

### 31.8 Ignoring `wwElementState.props.attributes`

You may break platform-managed attributes or form integration.

### 31.9 Using raw DOM globals instead of front-document helpers

This can break component isolation.

## 32. Decision Tree Before You Build

Ask these questions first:

1. Is this component mainly an input, a selector, a data widget, a repeated template, a container, or a builder?
2. Does it need `inherit` from an existing WeWeb type?
3. Will it be used with external API/database data?
4. If yes, should it use `Formula` mapping?
5. Does it need form behavior?
6. Does it need hidden embedded elements?
7. Does it need repeated context?
8. Does it need sidepanel/editor-only synchronization?
9. Does it need child auto-generation?
10. Does it need floating UI or platform-safe DOM access?

If you answer these up front, implementation quality improves immediately.

## 33. Best Current Reference Components

Use these as the strongest current references:

- `ww-input-select`
  - selector, formulas, search, floating UI, forms, local context
- `ww-input-rich-text`
  - rich input, forms, mention mapping, editor orchestration
- `ww-calendar`
  - data mapping, actions, structured events
- `ww-chat`
  - multi-layer formula mapping, attachments, participants
- `ww-chat-ai`
  - role-based chat, streaming state, attachment mapping
- `ww-datagrid-ag`
  - advanced formulas, internal variables, auto-generated child elements, dynamic styling
- `ww-kanban`
  - repeated compound stacks with `ww-props`
- `ww-timeline`
  - repeated embedded template rendering
- `ww-slider`
  - editor-managed slides and child creation
- `ww-sliderV2`
  - section-scoped child provisioning
- `ww-lightbox`
  - hidden embedded arrays and editor sidepanel sync
- `ww-columns`
  - container/grid mutation patterns
- `ww-container`
  - responsive editor-aware layout mutation

## 34. Short Version

If you remember only a few rules, remember these:

- `ww-config.js` defines the component contract
- `content` is the runtime instance of that contract
- use `useComponentVariable` for platform-visible internal state
- use `useForm(...)` for real form fields
- prefer `Formula` mapping for serious data-driven components
- use `boundProps` and `sidepanelContent` for editor-aware logic
- use `update:content:effect` for derived/editor-managed mutations
- use hidden embedded elements plus `<wwElement>` for compound/no-code structure
- use `wwLayoutItemContext` for repeated templates
- use `wwLib.getFrontDocument()` / `wwLib.getFrontWindow()` for global DOM work

## 35. Companion Documents

- `WEWEB_COMPONENTS_MCP_GUIDE.md`
  - repo-aware current pattern summary
- `WeWeb-Component-Development-Guide.md`
  - strict implementation constraints and mandatory rules

