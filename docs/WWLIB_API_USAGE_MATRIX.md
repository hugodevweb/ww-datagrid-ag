# wwLib API Usage Matrix

Role: decision matrix for choosing the right `wwLib` API, with concrete examples and guardrails.

Companion files:
- [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md)
- [WWLIB_API_REFERENCE.md](./WWLIB_API_REFERENCE.md)
- [README_AGENT_PACK.md](./README_AGENT_PACK.md)

## How to use this file

Use this file when you already know the task you need to solve and want the shortest path to:

- the right `wwLib` API
- a safe default usage pattern
- a warning about when not to use it

If you need architecture and lifecycle context first, start with [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md).

## Core rule

If a WeWeb problem has platform semantics, prefer `wwLib` over hand-rolled Vue logic.

Typical platform semantics:

- multilingual content
- collection wrappers and pagination
- formula/code mappings
- workflow triggers
- link semantics
- component variables
- page/path resolution
- plugin-backed data/auth

## Decision Matrix

| Task | Prefer | Example | Use when | Do not use when |
| --- | --- | --- | --- | --- |
| Get localized text from content | `wwLib.wwLang.getText` | `wwLib.wwLang.getText(content.label)` | content may be multilingual | value is already a plain fixed string and no WeWeb language fallback is needed |
| Change current language | `wwLib.wwLang.setLang` | `wwLib.wwLang.setLang('fr')` | page supports multiple langs and you need official language switching | target lang is not part of current page langs |
| Normalize a possibly paginated collection prop | `wwLib.wwUtils.getDataFromCollection` | `wwLib.wwUtils.getDataFromCollection(props.items)` | prop may be raw array or WeWeb collection object | you explicitly need full collection metadata such as `total`, `offset`, `limit` |
| Evaluate mapping formulas for repeated data | `wwLib.wwFormula.useFormula().resolveMapping` | `resolveMapping(data.value, content.mapping, {})` | mapping config comes from WeWeb formulas/code | mapping is static JS and not configurable by WeWeb users |
| Evaluate one formula against current context | `wwLib.wwFormula.useFormula().resolveFormula` | `resolveFormula(content.formula, null)` | formula needs repeat/layout/local/dropzone context | plain computed logic is enough and no WeWeb formula object exists |
| Evaluate one mapping formula with external item | `wwLib.wwFormula.useFormula().resolveMappingFormula` | `resolveMappingFormula(formula, { rawData, index }, '')` | transforming external dataset rows using stored formula config | there is no formula object with `type` and `code` |
| Add WeWeb-compatible link behavior to a component | `wwLib.wwElement.useLink` | `const { tag, properties } = wwLib.wwElement.useLink();` | component supports internal/external/file/popup/section links | component is never clickable and has no WeWeb link support |
| Get layout styles for layout-capable components | `wwLib.wwElement.useLayoutStyle` | `const layoutStyle = wwLib.wwElement.useLayoutStyle();` | component should respect WeWeb layout content/style/config | component has fully custom rendering with no WeWeb layout model |
| Read background video config | `wwLib.wwElement.useBackgroundVideo` | `const bgVideo = wwLib.wwElement.useBackgroundVideo();` | component supports standard WeWeb background video fields | component does not expose or render background video |
| Create a component-owned runtime variable | `wwLib.wwVariable.useComponentVariable` | `wwLib.wwVariable.useComponentVariable({ uid: props.uid, name: 'value', defaultValue: '' })` | value must integrate with repeats, library components, props, and WeWeb runtime | a plain local `ref` is enough and no WeWeb integration is needed |
| Read a variable by ID | `wwLib.wwVariable.getValue` | `wwLib.wwVariable.getValue(variableId)` | you already have a variable ID and need current store value | you need reactive binding local to a component; use `useComponentVariable` instead |
| Update a variable by ID | `wwLib.wwVariable.updateValue` | `wwLib.wwVariable.updateValue(variableId, nextValue)` | updating global/plugin/component variable in store | you are inside `useComponentVariable` and should call `setValue` on the returned handle |
| Trigger workflows by named trigger | `wwLib.wwWorkflow.executeTrigger` | `wwLib.wwWorkflow.executeTrigger('submit', { event: payload })` | runtime event should fan out into configured workflows | you need a specific global workflow by UID |
| Execute one global workflow directly | `wwLib.wwWorkflow.executeGlobal` | `await wwLib.wwWorkflow.executeGlobal(uid, params)` | you know the workflow UID and want its result | you only know a trigger name, not a workflow UID |
| Navigate to a page/route | `wwLib.wwApp.goTo` | `wwLib.wwApp.goTo('/pricing', {}, { hash: '#plans' })` | navigation should go through WeWeb router semantics | you are tempted to use deprecated top-level `wwLib.goTo` |
| Scroll to a DOM element | `wwLib.wwApp.scrollIntoView` | `wwLib.wwApp.scrollIntoView(el, { offset: 80 })` | you need scroll behavior consistent with WeWeb front window/document | element is missing or you need generic browser API only |
| Inject third-party script into head | `wwLib.wwApp.addScriptToHead` | `await wwLib.wwApp.addScriptToHead(url, { async: true })` | loading external SDKs in front runtime | you planned to use deprecated `wwLib.wwUtils.addScriptToHead` |
| Inject stylesheet into head | `wwLib.wwApp.addStyleSheetToHead` | `await wwLib.wwApp.addStyleSheetToHead(url)` | loading remote CSS or widget styles | CSS belongs in component bundle or static build pipeline |
| Build a page path from page ID | `wwLib.wwPageHelper.getPagePath` | `wwLib.wwPageHelper.getPagePath(pageId)` | you need a localized canonical page URL | you already have a resolved URL string |
| Read current design/project info | `wwLib.wwWebsiteData.getInfo` | `wwLib.wwWebsiteData.getInfo()` | need project langs/home page/info metadata | design store has not been initialized yet |
| Read current page object | `wwLib.wwWebsiteData.getCurrentPage` | `wwLib.wwWebsiteData.getCurrentPage()` | need page metadata in runtime | you only need current page ID |
| Read current page ID | `wwLib.wwWebsiteData.getCurrentPageId` | `wwLib.wwWebsiteData.getCurrentPageId()` | only ID is needed | full page object is required |
| Read raw collection object from store | `wwLib.wwCollection.getCollection` | `wwLib.wwCollection.getCollection(id)` | you need metadata plus data and know the collection ID | you only need display-ready items; use `wwUtils.getDataFromCollection` |
| Change pagination offset | `wwLib.wwCollection.setOffset` | `await wwLib.wwCollection.setOffset(id, 20)` | driving WeWeb pagination | collection is just a local array, not a store-backed WeWeb collection |
| Mutate in-store collection data | `wwLib.wwCollection.updateCollection` | `wwLib.wwCollection.updateCollection(id, row, { updateType: 'insert', updateIndex: 0 })` | runtime data must update in the central collection store | you can keep the data local to one component |
| Read text style object from content | `wwLib.wwUtils.getTextStyleFromContent` | `wwLib.wwUtils.getTextStyleFromContent(content)` | standard WeWeb text fields must become CSS style | text styles are entirely custom and do not use WeWeb text content fields |
| Parse typography token | `wwLib.wwUtils.getTypoFromToken` | `wwLib.wwUtils.getTypoFromToken(token)` | typography token string must be expanded to CSS fields | you already have final CSS fields |
| Resolve CSS variable token | `wwLib.wwUtils.getStyleFromToken` | `wwLib.wwUtils.getStyleFromToken(token)` | runtime token resolution from CSS vars is needed | running outside front DOM context |
| Parse CSS length string | `wwLib.wwUtils.getLengthUnit` | `wwLib.wwUtils.getLengthUnit('24px')` | user/config values may be CSS length strings | value is already normalized numeric/unit data |
| Generate UUID | `wwLib.wwUtils.getUid` | `wwLib.wwUtils.getUid()` | need unique stable ID | you planned to use deprecated `getUniqueId()` |
| Resolve nested property | `wwLib.wwUtils.resolveObjectPropertyPath` | `wwLib.wwUtils.resolveObjectPropertyPath(obj, 'a.b.c')` | dynamic nested path lookup is needed | direct property access is clearer and static |
| Determine if data is empty | `wwLib.wwUtils.isEmpty` | `wwLib.wwUtils.isEmpty(value)` | config may be null/empty string/empty array/object | emptiness rules need to distinguish cases more strictly |

## Patterns by scenario

## Scenario: render multilingual list items from collection input

Use:

- `wwLib.wwUtils.getDataFromCollection`
- `wwLib.wwLang.getText`

Example:

```js
const items = computed(() => wwLib.wwUtils.getDataFromCollection(props.items) || []);
const labels = computed(() => items.value.map(item => wwLib.wwLang.getText(item.label)));
```

Avoid:

- assuming `props.items` is always an array
- reading `item.label.en` directly

## Scenario: create configurable item mapping from no-code formulas

Use:

- `wwLib.wwFormula.useFormula`

Example:

```js
const { resolveMapping } = wwLib.wwFormula.useFormula();

const mappedItems = computed(() =>
    resolveMapping(wwLib.wwUtils.getDataFromCollection(props.items) || [], content.itemMapping, {
        label: '',
        value: null,
    })
);
```

Avoid:

- hand-executing `formula.code`
- assuming formulas only need the repeated item and not layout/local/dropzone context

## Scenario: expose editable component state that must cooperate with WeWeb runtime

Use:

- `wwLib.wwVariable.useComponentVariable`

Example:

```js
const currentValue = wwLib.wwVariable.useComponentVariable({
    uid: props.uid,
    name: 'value',
    defaultValue: '',
    type: 'string',
});
```

Then write through:

```js
currentValue.setValue('next');
```

Avoid:

- replacing this with plain `ref()` when the value must survive repeats or library component context
- calling `wwLib.wwVariable.updateValue` directly for a component-local variable if you already have the component variable handle

## Scenario: clickable component with full WeWeb link semantics

Use:

- `wwLib.wwElement.useLink`

Example:

```js
const { tag, properties, hasLink } = wwLib.wwElement.useLink();
```

Then bind:

```vue
<component :is="tag" v-bind="properties">
    <slot />
</component>
```

Avoid:

- building raw `<a>` logic yourself if popup links, collection page links, hash links, or load progress may be involved

## Scenario: route the user to another WeWeb page

Use:

- `wwLib.wwApp.goTo`
- optionally `wwLib.wwPageHelper.getPagePath`

Example:

```js
const target = wwLib.wwPageHelper.getPagePath(pageId);
wwLib.wwApp.goTo(target);
```

Avoid:

- deprecated `wwLib.goTo`
- manual string concatenation for localized page paths

## Scenario: execute workflow from component logic

Use:

- `wwLib.wwWorkflow.executeTrigger` for trigger-based integration
- `wwLib.wwWorkflow.executeGlobal` for direct workflow execution

Example:

```js
wwLib.wwWorkflow.executeTrigger('change', {
    event: { value: nextValue },
});
```

Example:

```js
const result = await wwLib.wwWorkflow.executeGlobal(workflowUid, {
    value: nextValue,
});
```

Avoid:

- mixing them up; trigger-based and UID-based workflow execution are different APIs

## Scenario: load third-party widget assets

Use:

- `wwLib.wwApp.addScriptToHead`
- `wwLib.wwApp.addStyleSheetToHead`

Example:

```js
await wwLib.wwApp.addStyleSheetToHead('https://example.com/widget.css');
await wwLib.wwApp.addScriptToHead('https://example.com/widget.js', { async: true });
```

Avoid:

- deprecated `wwLib.wwUtils.addScriptToHead`
- repeated manual injections without checking whether `once` behavior is sufficient

## Scenario: parse standard WeWeb text content into CSS

Use:

- `wwLib.wwUtils.getTextStyleFromContent`

Example:

```js
const textStyle = computed(() => wwLib.wwUtils.getTextStyleFromContent(content));
```

Avoid:

- reconstructing all `_ww-text_*` fields yourself unless you deliberately need non-standard behavior

## APIs that look tempting but need caution

## `wwLib.wwElement.useCreate()`

Why it is tempting:

- it sounds like the standard way to create child elements

Why to be careful:

- in the inspected front build, `createElement`, `createElementFromTemplate`, and `cloneElement` only warn and do not execute real creation

Use only when:

- you have confirmed editor-capable context or another build path where creation is actually implemented

## `wwLib.wwPluginHelper.*`

Why it is tempting:

- plugins are central to WeWeb internals

Why to be careful:

- this is runtime bootstrap plumbing, not the first-choice component author API

Use only when:

- you are working on runtime/plugin infrastructure rather than ordinary component behavior

## `wwLib.globalVariables`

Why it is tempting:

- it is reactive and globally visible

Why to be careful:

- it is low-level coordination state such as navigation cancellation and action registries

Use only when:

- you understand the runtime contract already and no higher-level API exists

## `wwLib.wwCollection.fetchCollection()` and `updateCollection()`

Why they are useful:

- they expose real runtime collection orchestration

Why to be careful:

- they are not explicitly marked public and affect store-backed application data

Prefer them when:

- component behavior truly needs centralized collection state manipulation

Avoid when:

- local computed/transformed state is enough

## Anti-pattern shortcuts

Do not do this:

- use deprecated top-level wrappers when the namespaced API exists
- replace `useLink()` with custom anchor logic in linkable components
- replace `useComponentVariable()` with plain refs when WeWeb runtime integration matters
- read multilingual content with hard-coded language keys
- assume collection props are always plain arrays
- assume editor-only APIs work in the production front build

## Suggested reading order for an agent focused on `wwLib`

1. [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md)
2. [WWLIB_API_USAGE_MATRIX.md](./WWLIB_API_USAGE_MATRIX.md)
3. [WWLIB_API_REFERENCE.md](./WWLIB_API_REFERENCE.md)

