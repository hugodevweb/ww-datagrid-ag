# wwLib Official Usage Index

Role: practical trust index for `wwLib` based on actual usage in official WeWeb components in this repository.

Companion files:
- [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md)
- [WWLIB_API_USAGE_MATRIX.md](./WWLIB_API_USAGE_MATRIX.md)
- [WWLIB_API_REFERENCE.md](./WWLIB_API_REFERENCE.md)
- [SYSTEM_PROMPT_WEWEB_WWLIB.md](./SYSTEM_PROMPT_WEWEB_WWLIB.md)

## Why this file exists

WeWeb developers said they do not guarantee that `wwLib` methods remain stable.

Because of that, the strongest practical signal is:

- which `wwLib` APIs are actually used by official components
- how often they appear
- which components are the best references for copying the pattern safely

This file is not trying to list every exported `wwLib` symbol.

It answers a more useful question:

- if an AI agent needs to choose a `wwLib` method, which ones are already validated by production component usage?

## Trust model

Use this priority:

1. heavily used in official components
2. clearly used in official components for the same scenario
3. marked `@PUBLIC_API` but weakly represented in official components
4. exported but weakly evidenced
5. deprecated or editor/runtime-internal only

## Strongest current signals

These are the most practically trusted `wwLib` APIs right now because they appear repeatedly in official components.

| API | Signal | What it usually means |
| --- | --- | --- |
| `wwLib.wwVariable.useComponentVariable` | very strong | default way to create WeWeb-aware component state |
| `wwLib.getFrontDocument` | very strong | standard DOM access instead of raw `document` |
| `wwLib.getFrontWindow` | strong | standard DOM/window access instead of raw `window` |
| `wwLib.wwUtils.getUid` | strong | standard ID generation |
| `wwLib.wwLang.getText` | strong | standard multilingual getter |
| `wwLib.wwCollection.getCollectionData` | medium-strong, legacy | still actively used collection normalization helper |
| `wwLib.wwUtils.getLengthUnit` | medium-strong | standard CSS length parsing helper |
| `wwLib.wwElement.useRegisterElementLocalContext` | medium-strong | standard local context exposure pattern |
| `wwLib.useIcons` | medium-strong | standard icon access pattern |
| `wwLib.wwFormula.useFormula` | medium-strong | standard formula/mapping evaluation entrypoint |
| `wwLib.wwElement.useLink` | medium | standard link abstraction for clickable components |
| `wwLib.useCreateElement` / `wwLib.wwElement.useCreate` | medium but caution | used by official components, but front-build behavior still needs care |
| `wwLib.wwApp.goTo` | narrow but real | used as official navigation helper |

## Usage index

## `wwLib.wwVariable.useComponentVariable`

Trust level: very high

Why:

- this is the single strongest runtime integration pattern across official components
- appears across form inputs, interactive widgets, media components, dialogs, calendars, grids, and compound components

Good reference components:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-calendar`
- `ww-chat`
- `ww-datagrid-ag`
- `ww-form-container`
- `ww-input-mask`
- `ww-input-otp`
- `ww-slider`

Where to look:

- [ww-input-select/src/wwElement_Select.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Select.vue)
- [ww-input-rich-text/src/wwElement.vue](https://github.com/weweb-assets/ww-input-rich-text/blob/main/src/wwElement.vue)
- [ww-calendar/src/wwElement.vue](https://github.com/weweb-assets/ww-calendar/blob/main/src/wwElement.vue)
- [ww-chat/src/wwElement.vue](https://github.com/weweb-assets/ww-chat/blob/main/src/wwElement.vue)
- [ww-datagrid-ag/src/wwElement.vue](https://github.com/weweb-assets/ww-datagrid-ag/blob/main/src/wwElement.vue)

Use when:

- a component needs platform-visible internal state
- state must work with repeat context, props, library components, or workflows

Avoid replacing with:

- plain `ref()` when WeWeb runtime semantics matter

## `wwLib.getFrontDocument`

Trust level: very high

Why:

- repeatedly used for front-safe DOM access
- matches the official WeWeb guidance to avoid raw `document`

Good reference components:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-dialog`
- `ww-input-mask`
- `ww-tabs`
- `ww-video-dailymotion`

Where to look:

- [ww-input-select/src/wwElement_Select.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Select.vue)
- [ww-input-rich-text/src/suggestion.js](https://github.com/weweb-assets/ww-input-rich-text/blob/main/src/suggestion.js)
- [ww-dialog/src/wwElement.vue](https://github.com/weweb-assets/ww-dialog/blob/main/src/wwElement.vue)

Use when:

- touching DOM outside template refs
- querying body/head/global nodes
- attaching/removing document-level listeners

## `wwLib.getFrontWindow`

Trust level: high

Good reference components:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-tabs-new`
- `ww-calendly-embed`

Where to look:

- [ww-input-select/src/wwElement_Select.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Select.vue)
- [ww-tabs-new/src/wwElementTabsNew.vue](https://github.com/weweb-assets/ww-tabs-new/blob/main/src/wwElementTabsNew.vue)

Use when:

- adding front-window listeners
- calling SDKs attached to the front window

## `wwLib.wwUtils.getUid`

Trust level: high

Good reference components:

- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-data-grid`
- `ww-input-select`
- `ww-dropdown`

Where to look:

- [ww-chat/src/wwElement.vue](https://github.com/weweb-assets/ww-chat/blob/main/src/wwElement.vue)
- [ww-calendar/src/wwElement.vue](https://github.com/weweb-assets/ww-calendar/blob/main/src/wwElement.vue)
- [ww-input-select/src/select/useAccessibility.js](https://github.com/weweb-assets/ww-input-select/blob/main/src/select/useAccessibility.js)

Use when:

- generating stable client-side IDs for runtime items, accessibility IDs, message IDs, or element instance IDs

Prefer over:

- deprecated `wwLib.wwUtils.getUniqueId`

## `wwLib.wwLang.getText`

Trust level: high

Good reference components:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-calendar`
- `ww-rich-text`
- `ww-breadcrumb`

Where to look:

- [ww-input-select/src/wwElement_Trigger.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Trigger.vue)
- [ww-calendar/src/wwElement.vue](https://github.com/weweb-assets/ww-calendar/blob/main/src/wwElement.vue)
- [ww-rich-text/src/wwElement.vue](https://github.com/weweb-assets/ww-rich-text/blob/main/src/wwElement.vue)

Use when:

- any content field may be multilingual

Do not do:

- direct `text.en` access unless the component deliberately hardcodes a language

## `wwLib.wwCollection.getCollectionData`

Trust level: medium-high for compatibility, lower for forward purity

Why:

- still used in multiple official components
- but officially this is a deprecated path compared to `wwLib.wwUtils.getDataFromCollection(...)`

Good reference components:

- `ww-kanban`
- `ww-input-rich-text`
- `ww-data-grid`
- `ww-stack`
- `ww-mapbox`

Where to look:

- [ww-kanban/src/wwElement.vue](https://github.com/weweb-assets/ww-kanban/blob/main/src/wwElement.vue)
- [ww-input-rich-text/src/wwElement.vue](https://github.com/weweb-assets/ww-input-rich-text/blob/main/src/wwElement.vue)
- [ww-mapbox/src/wwElement.vue](https://github.com/weweb-assets/ww-mapbox/blob/main/src/wwElement.vue)

Use when:

- maintaining an existing component family that already uses it

Prefer for new code:

- `wwLib.wwUtils.getDataFromCollection(...)`

## `wwLib.wwUtils.getDataFromCollection`

Trust level: medium but modern

Why:

- fewer usages right now than the legacy collection helper
- but it is the cleaner replacement and already used in newer components

Good reference components:

- `ww-datagrid-ag`

Where to look:

- [ww-datagrid-ag/src/wwElement.vue](https://github.com/weweb-assets/ww-datagrid-ag/blob/main/src/wwElement.vue)

Use when:

- writing new code that needs to normalize raw data vs collection-wrapper input

## `wwLib.wwUtils.getLengthUnit`

Trust level: medium-high

Good reference components:

- `ww-input-basic`
- `ww-input-mask`
- `ww-input-range`
- `ww-input-search`
- `ww-input-toggle`
- `ww-datagrid-ag`

Where to look:

- [ww-input-basic/src/composables/useInput.js](https://github.com/weweb-assets/ww-input-basic/blob/main/src/composables/useInput.js)
- [ww-input-mask/src/wwElement.vue](https://github.com/weweb-assets/ww-input-mask/blob/main/src/wwElement.vue)
- [ww-datagrid-ag/src/wwElement.vue](https://github.com/weweb-assets/ww-datagrid-ag/blob/main/src/wwElement.vue)

Use when:

- parsing sizes, delays, transitions, selector dimensions, radius, widths, heights

## `wwLib.wwElement.useRegisterElementLocalContext`

Trust level: medium-high

Good reference components:

- `ww-input-select`
- `ww-chat`
- `ww-chat-ai`
- `ww-dialog`
- `ww-slider`
- `ww-tabs-new`

Where to look:

- [ww-input-select/src/wwElement_Select.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Select.vue)
- [ww-chat/src/wwElement.vue](https://github.com/weweb-assets/ww-chat/blob/main/src/wwElement.vue)
- [ww-slider/src/wwElement.vue](https://github.com/weweb-assets/ww-slider/blob/main/src/wwElement.vue)

Use when:

- child subcomponents need local reactive context from the parent component

## `wwLib.useIcons`

Trust level: medium-high

Good reference components:

- `ww-icon`
- `ww-input-file`
- `ww-input-rich-text`
- `ww-input-select`
- `ww-chat`
- `ww-timeline`

Where to look:

- [ww-icon/src/wwElement.vue](https://github.com/weweb-assets/ww-icon/blob/main/src/wwElement.vue)
- [ww-input-select/src/wwElement_Option.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Option.vue)
- [ww-timeline/src/wwElement.vue](https://github.com/weweb-assets/ww-timeline/blob/main/src/wwElement.vue)

Use when:

- component needs WeWeb-managed icons rather than a hardcoded icon asset strategy

## `wwLib.wwFormula.useFormula`

Trust level: medium-high

Good reference components:

- `ww-input-select`
- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-datagrid-ag`
- `ww-radiogroup`

Where to look:

- [ww-input-select/src/wwElement_Select.vue](https://github.com/weweb-assets/ww-input-select/blob/main/src/wwElement_Select.vue)
- [ww-calendar/src/wwElement.vue](https://github.com/weweb-assets/ww-calendar/blob/main/src/wwElement.vue)
- [ww-datagrid-ag/src/wwElement.vue](https://github.com/weweb-assets/ww-datagrid-ag/blob/main/src/wwElement.vue)

Use when:

- evaluating formula/code objects from configurable mappings
- mapping repeated items through WeWeb formula semantics

## `wwLib.wwElement.useLink`

Trust level: medium

Good reference components:

- `ww-button`
- `ww-text`
- `ww-image`
- `ww-icon`
- `ww-columns`
- `ww-flexbox`

Where to look:

- [ww-button/src/wwElement.vue](https://github.com/weweb-assets/ww-button/blob/main/src/wwElement.vue)
- [ww-text/src/wwElement.vue](https://github.com/weweb-assets/ww-text/blob/main/src/wwElement.vue)
- [ww-image/src/wwElement.vue](https://github.com/weweb-assets/ww-image/blob/main/src/wwElement.vue)

Use when:

- component is clickable and should support WeWeb link semantics

## `wwLib.wwApp.goTo`

Trust level: narrow but trusted

Good reference components:

- `ww-breadcrumb`

Where to look:

- [ww-breadcrumb/src/wwElement.vue](https://github.com/weweb-assets/ww-breadcrumb/blob/main/src/wwElement.vue)

Use when:

- imperative navigation is needed from runtime logic

Prefer over:

- deprecated top-level `wwLib.goTo(...)`

## `wwLib.wwWebsiteData.getCurrentPage`

Trust level: narrow but trusted

Good reference components:

- `ww-breadcrumb`

Where to look:

- [ww-breadcrumb/src/wwElement.vue](https://github.com/weweb-assets/ww-breadcrumb/blob/main/src/wwElement.vue)

Use when:

- current page metadata is needed directly

## `wwLib.resolveObjectPropertyPath`

Trust level: medium for compatibility, legacy-shape

Why:

- still used by multiple official components
- newer docs should prefer `wwLib.wwUtils.resolveObjectPropertyPath(...)`

Good reference components:

- `ww-input-multiselect`
- `ww-input-rich-text`
- `ww-kanban`
- `ww-map`
- `ww-mapbox`
- `ww-openstreetmap-leaflet`

Where to look:

- [ww-input-multiselect/src/wwElement.vue](https://github.com/weweb-assets/ww-input-multiselect/blob/main/src/wwElement.vue)
- [ww-kanban/src/wwElement.vue](https://github.com/weweb-assets/ww-kanban/blob/main/src/wwElement.vue)
- [ww-mapbox/src/wwElement.vue](https://github.com/weweb-assets/ww-mapbox/blob/main/src/wwElement.vue)

Prefer for new code:

- `wwLib.wwUtils.resolveObjectPropertyPath(...)`

## `wwLib.wwUtils.resolveObjectPropertyPath`

Trust level: low frequency but architecturally preferred

Good reference components:

- `ww-breadcrumb`

Where to look:

- [ww-breadcrumb/src/wwElement.vue](https://github.com/weweb-assets/ww-breadcrumb/blob/main/src/wwElement.vue)

Interpretation:

- this is the cleaner namespaced form
- current official usage is still migrating

## `wwLib.useCreateElement` and `wwLib.wwElement.useCreate`

Trust level: medium by usage, but caution required

Why:

- they are used in official components such as sliders, tabs, buttons, rich text, lightbox, grids, and inputs
- but in the inspected front build, the implementation of create/clone methods warns instead of executing real creation

Good reference components:

- `ww-slider`
- `ww-tabs`
- `ww-lightbox`
- `ww-button`
- `ww-input-mask`
- `ww-datagrid-ag`

Where to look:

- [ww-slider/src/wwElement.vue](https://github.com/weweb-assets/ww-slider/blob/main/src/wwElement.vue)
- [ww-tabs/src/wwElement.vue](https://github.com/weweb-assets/ww-tabs/blob/main/src/wwElement.vue)
- [ww-lightbox/src/wwElement.vue](https://github.com/weweb-assets/ww-lightbox/blob/main/src/wwElement.vue)
- [ww-input-mask/src/wwElement.vue](https://github.com/weweb-assets/ww-input-mask/blob/main/src/wwElement.vue)

Interpretation:

- this is trusted as a real WeWeb pattern
- but only in the right execution context
- do not assume the front runtime implementation alone tells the full story

## Official-usage-based recommendations

## Default shortlist for AI agents

If an agent needs the safest default `wwLib` set, start with:

- `wwLib.wwVariable.useComponentVariable`
- `wwLib.getFrontDocument`
- `wwLib.getFrontWindow`
- `wwLib.wwUtils.getUid`
- `wwLib.wwLang.getText`
- `wwLib.wwFormula.useFormula`
- `wwLib.wwElement.useLink`
- `wwLib.wwElement.useRegisterElementLocalContext`
- `wwLib.wwUtils.getLengthUnit`
- `wwLib.wwApp.goTo`

Then use case-by-case:

- `wwLib.wwUtils.getDataFromCollection(...)` for new collection-normalization code
- `wwLib.wwCollection.getCollectionData(...)` when maintaining older official patterns
- `wwLib.wwUtils.resolveObjectPropertyPath(...)` for new code
- `wwLib.resolveObjectPropertyPath(...)` when staying consistent with an older component family

## Methods that are real but not automatically first-choice

These should not be picked just because they exist:

- `wwLib.wwPluginHelper.*`
- `wwLib.globalVariables`
- `wwLib.wwCollection.fetchCollection(...)`
- `wwLib.wwCollection.updateCollection(...)`
- weakly evidenced editor/helper APIs

## Reading strategy

If an agent needs to copy a pattern safely:

1. find the method in this file
2. open one of the listed reference components
3. compare with [WWLIB_API_USAGE_MATRIX.md](./WWLIB_API_USAGE_MATRIX.md)
4. check [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md) for caveats before generalizing the pattern

