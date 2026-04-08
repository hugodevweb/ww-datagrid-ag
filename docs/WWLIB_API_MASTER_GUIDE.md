# wwLib API Master Guide

Role: canonical API documentation for `wwLib` based on direct code inspection of `docs/wwlib-src`.

Companion files:
- [WWLIB_API_REFERENCE.md](./WWLIB_API_REFERENCE.md)
- [WEWEB_COMPONENTS_MASTER_GUIDE.md](./WEWEB_COMPONENTS_MASTER_GUIDE.md)
- [WeWeb-Component-Development-Guide.md](./WeWeb-Component-Development-Guide.md)

## What `wwLib` is

`wwLib` is the runtime facade that WeWeb components, plugins, formulas, workflows, and the front application use to talk to:

- the current front window/document/router
- the Vuex store and Pinia stores
- website/page/design metadata
- collections, variables, workflows, plugins, auth
- component helpers such as links, layout styles, formulas, and local reactive stores

It is not a cleanly separated SDK in the classic sense. It is a mixed surface:

- stable public API methods explicitly marked with `@PUBLIC_API`
- compatibility aliases kept for old components
- runtime internals that are exported but not clearly meant as public contracts
- editor-oriented or dev-oriented hooks that are stubs in the front build

For an AI agent, this distinction matters. Do not treat every exported function as equally safe.

## Stability heuristic

WeWeb developers explicitly do not guarantee that `wwLib` methods are stable.

Because of that, the practical priority is:

1. methods actively used by official WeWeb components in this repo
2. methods marked `@PUBLIC_API`
3. exported runtime helpers not clearly marked public
4. deprecated wrappers and legacy aliases
5. editor/runtime internals not used by current components

This heuristic is more important than the presence of a method on `wwLib`.

If a method is exported but not used by official components, assume higher change risk unless you have a strong code-level reason to use it.

## Source of truth

This guide is derived from:

- `docs/wwlib-src/index.js`
- `docs/wwlib-src/services/*.js`
- store helpers used by `wwLib`:
  - `docs/wwlib-support/scrollStore.js`
  - `docs/wwlib-support/keyboardStore.js`
  - `docs/wwlib-support/logStore.js`

If code and this document disagree, the code wins.

## High-level mental model

Think of `wwLib` as five layers.

1. Boot/runtime shell

- `initFront({ router, store })`
- `front`, `$store`, `$pinia`, `env`
- DOM accessors such as `getFrontWindow()`
- event bus methods `$on`, `$emit`, `$off`, `$once`

2. Global reactive context

- `globalContext`
- `pageData`
- `globalVariables`
- reactive stores like `scrollStore`, `keyboardEventStore`, `logStore`

3. Domain services

- `wwWebsiteData`
- `wwCollection`
- `wwVariable`
- `wwWorkflow`
- `wwAuth`
- `wwPluginHelper`

4. Component author helpers

- `wwElement.useLink()`
- `wwElement.useLayoutStyle()`
- `wwElement.useBackgroundVideo()`
- `wwFormula.useFormula()`
- `wwVariable.useComponentVariable()`
- `wwLang.getText()`

5. Utility and compatibility layer

- `wwUtils`
- deprecated top-level wrappers like `wwLib.goTo()`
- object helper aliases such as `wwElementHelper`

## Boot sequence and runtime wiring

`wwLib` is assembled in `src/wwLib/index.js` by merging all service namespaces from `services/index.js` and then adding top-level helpers.

### `initFront({ router, store })`

This is the main front bootstrap entrypoint. It:

- saves the front router to `wwLib.front.router`
- stores the Vuex store on `wwLib.$store`
- initializes logging via `wwLib.wwLog.init()`
- loads design/site data via `await wwLib.wwWebsiteData.init()`
- initializes language state via `wwLib.wwLang.init(router)`
- registers built-in plugins through `wwLib.wwPluginHelper.registerPlugin(...)`
- starts `scrollStore`
- starts `keyboardEventStore`

Implication: most `wwLib` services assume `initFront()` has already run. If you call them earlier, they may fail because router/store/design data are not ready.

## Top-level runtime API

### Event bus

`wwLib` exposes a tiny emitter-style event API:

- `$on(event, fn)`
- `$once(event, fn)`
- `$emit(event, ...args)`
- `$off(event, fn)`

Use cases visible from code:

- language change notifications: `wwLang:changed`
- link click / popup events: `wwLink:clicked`, `wwLink:closePopup`
- style/script load notifications: `wwUtils:newStyle-<id>`
- store load signal: `wwStore:dataLoaded`

This is a lightweight internal bus, not a typed public event system.

### Environment and DOM/router access

Public accessors:

- `getFrontWindow()`
- `getFrontDocument()`
- `getFrontRouter()`
- `getEditorWindow()`
- `getEditorDocument()`
- `getEditorRouter()`

Important caveats:

- `getEditorWindow()` currently returns `null`
- `getEditorDocument()` currently returns `null`
- these methods exist as public surface but the current implementation is front-focused

### Environment helpers

- `getEnvironment()` returns one of `editor`, `staging`, `preview`, `production`
- `useBaseTag()` checks whether the current document uses a `<base>` tag
- `getBaseTag()` returns the resolved base href path

### Responsive style helper

`getResponsiveStyleProp({ store, style, uid, states = [], prop })` resolves a style property for a component UID against responsive and stateful style data.

This is useful for runtime style resolution, but it is not marked `@PUBLIC_API`. Treat it as internal runtime plumbing unless you have a concrete reason to use it.

## Reactive global context

`wwLib.globalContext` is a reactive object with computed properties. It exposes data intended for formulas, workflows, and general runtime access.

Key properties:

- `page`
- `pageParameters`
- `pages`
- `colors`
- `spacings`
- `typographies`
- `browser`
- `screen`
- `componentPositionInfo`

### Practical meaning

- `page`: current page object from website data
- `pageParameters`: current route/page parameter values
- `pages`: page registry from design data
- `colors`, `spacings`, `typographies`: design token maps
- `browser`: browser-level environment info
- `screen`: current screen/scroll/page metrics, backed by `scrollStore`
- `componentPositionInfo`: per-element geometry data, also backed by `scrollStore`

`wwLib.pageData` is another computed helper that returns current page-level data, including current language and optional collection-driven page data.

## Namespace inventory

`services/index.js` exports these namespaces and stores:

- `wwApp`
- `wwAuth`
- `wwApiRequests`
- `wwCollection`
- `wwEditor`
- `wwElement`
- `wwElementHelper`
- `wwFormula`
- `wwLang`
- `wwLog`
- `wwObjectHelper`
- `wwPageHelper`
- `wwPluginHelper`
- `wwUtils`
- `wwVariable`
- `wwWebsiteData`
- `wwWorkflow`
- `globalVariables`
- `scrollStore`
- `keyboardEventStore`
- `logStore`

`wwElementHelper` is simply an alias of `wwObjectHelper`.

## Public vs internal vs deprecated

Use this rule set when generating code:

### Preferred public surface

These are explicitly marked `@PUBLIC_API` and are the safest choices:

- top-level DOM/router helpers
- `wwApp` navigation/head helpers
- `wwElement` composition helpers
- `wwFormula.getValue` and `wwFormula.useFormula`
- `wwLang.lang`, `wwLang.setLang`, `wwLang.getText`, `wwLang.setText`
- `wwVariable.getValue`, `wwVariable.updateValue`, `wwVariable.useComponentVariable`
- `wwWorkflow.executeTrigger`, `wwWorkflow.executeGlobal`
- most of `wwUtils`
- `wwPageHelper.getPagePath`
- `wwWebsiteData.getDesign/getInfo/getPages/getCurrentPage/getCurrentPageId`

### Highest-confidence surface by official usage

From current component usage in `https://github.com/weweb-assets`, the most trusted `wwLib` APIs are the ones repeatedly used by official components.

Strongly used examples:

- `wwLib.wwVariable.useComponentVariable`
- `wwLib.getFrontDocument`
- `wwLib.getFrontWindow`
- `wwLib.wwUtils.getUid`
- `wwLib.wwLang.getText`
- `wwLib.wwCollection.getCollectionData`
- `wwLib.wwUtils.getLengthUnit`
- `wwLib.wwElement.useRegisterElementLocalContext`
- `wwLib.useIcons`
- `wwLib.wwFormula.useFormula`
- `wwLib.wwElement.useLink`
- `wwLib.wwWebsiteData.getCurrentPage`
- `wwLib.wwUtils.getDataFromCollection`
- `wwLib.wwApp.goTo`

Important nuance:

- some strongly used APIs are still legacy or deprecated, for example `wwLib.resolveObjectPropertyPath` and `wwLib.wwCollection.getCollectionData`
- usage in official components gives them practical compatibility value even when the architecture suggests a newer alias
- when both are used, prefer the more current namespaced form for new code unless the current component family clearly still standardizes on the legacy alias

### Exported but not explicitly public

These are available and used internally, but should be treated with more caution:

- `wwCollection.fetchCollection`, `updateCollection`, `getCollection`, `getCollectionPluginConfig`
- `wwAuth` methods
- `wwPluginHelper.*`
- `wwApiRequests._get*Url`
- `wwObjectHelper.findParentWwObject`, `findWwObjectByName`, `removeWwObject`
- `wwWebsiteData.fetchPage`, `getPageRoute`
- `globalVariables`
- `scrollStore`, `keyboardEventStore`, `logStore`

### Deprecated wrappers and aliases

Avoid these in new component code:

- `wwLib.goTo(...)` -> use `wwLib.wwApp.goTo(...)`
- `wwLib.getStyleFromToken(...)` -> use `wwLib.wwUtils.getStyleFromToken(...)`
- `wwLib.getTypoFromToken(...)` -> use `wwLib.wwUtils.getTypoFromToken(...)`
- `wwLib.element(value)` -> old helper producing `{ isWwObject: true, ...value }`
- `wwLib.resolveObjectPropertyPath(...)` -> use `wwLib.wwUtils.resolveObjectPropertyPath(...)`
- `wwLib.getTextStyleFromContent(...)` -> use `wwLib.wwUtils.getTextStyleFromContent(...)`
- `wwLib.executeWorkflow(...)` -> use `wwLib.wwWorkflow.executeGlobal(...)`
- `wwLib.findParentUidByFlag(...)` and `selectParentByFlag(...)`
- `wwLib.useCreateElement()` -> wrapper to `wwLib.wwElement.useCreate()`
- `wwLib.useLayoutStyle()` -> wrapper to `wwLib.wwElement.useLayoutStyle()`
- `wwLib.wwUtils.getUniqueId()` -> use `wwLib.wwUtils.getUid()`
- `wwLib.wwUtils.addScriptToHead(...)` -> use `wwLib.wwApp.addScriptToHead(...)`
- `wwLib.wwUtils.scrollIntoView(...)` -> use `wwLib.wwApp.scrollIntoView(...)`
- `wwLib.wwCollection.getCollectionData(...)` -> use `wwLib.wwUtils.getDataFromCollection(...)`
- `wwLib.wwWebsiteData.getWebsiteName()` -> deprecated

## Namespace details

## `wwApp`

Purpose: browser/runtime helpers for scrolling, head injection, and navigation.

### `scrollIntoView(element, options = {})`

Public.

Behavior:

- reads the element bounding rect
- scrolls the root `<html>` element
- defaults: `{ left: 0, offset: 0, behavior: 'smooth' }`
- computes `top` as `rect.top + window.scrollY - offset`

Use for:

- scrolling to sections
- scrolling to an element after interaction

### `addScriptToHead(scriptUrl, attributes = {}, options = {})`

Public.

Behavior:

- injects a `<script>` into `document.head`
- default options: `{ once: true, editor: false }`
- if the same `src` already exists and `once` is true, resolves without reinjecting
- emits `wwUtils:newStyle-<id>` on load
- returns a `Promise`

Notes:

- despite the event name containing `newStyle`, it is used for script load too
- `editor` exists in the options shape but is not used in the visible implementation

### `addStyleSheetToHead(styleUrl, attributes = {}, options = {})`

Public.

Behavior:

- injects a `<link rel="stylesheet">`
- no duplicate insertion for an existing `href`
- emits `wwUtils:newStyle-<id>` on load
- returns a `Promise`

### `goTo(route, query = {}, options = {})`

Public.

Behavior:

- normalizes route strings to leading and trailing slash
- resolves the route through the front router
- can open in new tab with `options.openInNewTab`
- prevents navigation if already on the same resolved route and no hash is requested
- if a hash/section is provided and the route is the current route, it scrolls to the section or scrolls to top

Key caveat:

- this implementation is front-only and wrapped in `wwFront` guards

## `wwAuth`

Purpose: auth abstraction over the currently configured auth plugin.

It is not marked public, but it is clearly meant to be used by runtime code.

### `plugin`

Getter that resolves the configured auth plugin from store data and `wwLib.wwPlugins`.

### `init()`

- idempotent through `isInitialized`
- calls plugin `_initAuth()` if present
- logs errors via `wwLib.wwLog.error`

### `getUser()`

- prefers plugin `_getUser()`
- otherwise falls back to `plugin.user`

### `getIsAuthenticated()`

- intended to prefer plugin `_isAuthenticated`
- current code checks `_isAuthenticated` but calls `_getIsAuthenticated()`
- that mismatch looks like an implementation inconsistency and is worth treating as a possible bug

### Page redirection helpers

- `getUnauthenticatedPageId()`
- `getUnauthorizedPageId()`

These read either plugin methods or plugin settings.

### Role/group helpers

- `getUserRoles()`
- `matchUserGroups(userGroups)`
- `matchUserGroup(userGroup)`
- `matchRoles(roles)`

`getUserRoles()` supports role extraction from:

- single string
- array of strings
- array of objects using `roleTypeKey`

It can also map role names to local role IDs defined in plugin settings.

## `wwApiRequests`

Purpose: environment/config URL accessors.

Methods:

- `_getApiUrl()`
- `_getPluginsUrl()`
- `_getPreviewUrl()`
- `_getCdnUrl()`

These read from `import.meta.env`, except `_getPreviewUrl()` which first checks `designInfo.wewebPreviewURL`.

These are internal-style helpers because of the underscore naming.

## `wwCollection`

Purpose: read, fetch, paginate, normalize, and update collection data.

This namespace is larger than many component authors expect. It is a key part of runtime data flow.

### `getCollection(collectionId)`

- reads `data/getCollections` from store
- logs an error and returns `null` if missing

### `getCollectionPluginConfig(collectionId)`

- resolves the collection's plugin
- fetches component-base configuration for that plugin from Pinia

### `getCollectionQueryConfig(collectionId)`

- returns `collection.queryConfig` from the plugin editor configuration, if any

### `_fetchCollection(id, { limit, offset } = {})`

Internal fetch primitive.

Flow:

- resolves collection config from store
- resolves bound variable values used by collection config/filter/sort
- if collection mode is `dynamic`, asks the plugin namespace for `_fetchCollection(...)`
- normalizes plugin output to either:
  - `{ total, offset, data, type: 'collection', error }`
  - `{ data, error, type: 'single' }`
- otherwise, in front mode, falls back to preview fetch via `axios.post(...)`

### `fetchCollection(id, { limit, offset } = {}, workflowContext)`

Main fetch orchestration.

Important behavior:

- guards against stale navigation using `wwLib.globalVariables._navigationId`
- marks collection fetching state in store
- waits for plugins to finish loading
- merges paginated chunks into existing collection data
- locally re-applies filtering/sorting for dynamic collections when native pagination is absent
- logs success or failure through `logStore`
- triggers workflow `on-collection-fetch-error` on failure

This is not explicitly public, but it is central runtime API.

### `updateCollection(collectionId, data, options = {})`

Mutates collection data already in store.

Supported options:

- `updateType`: `insert`, `update`, `delete`, or omitted
- `updateIndex`
- `updateBy`: `index` or `id`
- `idKey`
- `idValue`
- `merge`
- `refreshFilter`
- `refreshSort`

Behavior:

- deep-clones incoming data unless deleting
- can target array entries by index or by ID
- can merge objects/arrays on update
- can re-run collection filter/sort after mutation

### `setOffset(collectionId, offset)`

Public.

Behavior:

- for dynamic collections with native pagination: fetches the new page
- otherwise simply updates `offset` in store

### `getPaginationOptions(collectionId)`

Returns pagination metadata from store.

### `isCollection(value)`

Checks for the normalized collection marker `type === 'collection'`.

### `getCollectionData(...)`

Public but deprecated.

Alias to `wwLib.wwUtils.getDataFromCollection(...)`.

## `wwElement`

Purpose: component-level composition helpers.

This is one of the most important namespaces for actual component authoring.

### `useCreate()`

Public.

Returns:

- `createElement(type, { content, _state } = {}, { keepChildren } = {})`
- `createElementFromTemplate(template, { keepChildren } = {})`
- `cloneElement(uid, { name } = {})`

Current front implementation:

- all three methods only warn that they should not be called on the production website

Interpretation:

- these are part of the broader API surface
- but in the front runtime build shown here, they are intentionally non-operative
- actual editor behavior likely exists in another build/context

This is exactly the kind of API an agent must not assume works on the front site.

### `useLayoutStyle()`

Public.

Injects component content/style/configuration/wwProps and returns a computed layout-style object using `getLayoutStyleFromContent(...)`.

Use this when authoring layout-capable components instead of reimplementing WeWeb layout style resolution yourself.

### `useBackgroundVideo()`

Public.

Reads standard WeWeb background video fields from injected `componentContent` and returns either:

- `null`
- or `{ url, loop, poster, preload, size }`

### `useLink({ isDisabled, forcedLinkRef } = {})`

Public.

This is the standard WeWeb link abstraction for components.

Returned object:

- `properties`: computed DOM/router-link props
- `tag`: computed tag name, usually `div`, `router-link`, or `a`
- `hasLink`
- `normalizedLink`

Features handled by `useLink()`:

- no-link state
- popup open/close links
- internal page links
- collection page links
- file links with download behavior
- mailto/tel links
- external links
- query params
- page parameters
- section hash navigation
- page load progress
- active-link internal state `_wwLinkActive`

This helper also emits events and dispatches popup/store actions. It is the preferred way to implement WeWeb-compatible linking.

### `useRegisterElementLocalContext`

Public export of the helper imported from `@/_front/use/useElementLocalContext`.

Use it when a component needs to expose local context to descendants in the WeWeb way.

### `getComponentLabel`

Public export of the common helper imported from `@/_common/helpers/component/component.js`.

## `wwFormula`

Purpose: formula and code evaluation helpers.

### `getValue`

Public re-export from `@/_common/helpers/code/customCode.js`.

Use this to resolve bound values and formula-backed values stored in WeWeb structures.

### `useFormula()`

Public.

It captures several injected contexts:

- `bindingContext`
- `_wwLocalContext`
- `wwLayoutContext`
- `_wwLibraryComponentContext`
- `_wwDropzoneContext`

Returns:

- `resolveMappingFormula(formula, mappingContext = null, defaultValue = null)`
- `resolveFormula(formula, defaultValue = null)`
- `resolveMapping(data, map = {}, defaultMap = {})`

#### `resolveMappingFormula(...)`

Evaluates either formula or code depending on `formula.type`:

- `f` -> formula evaluator
- otherwise -> code evaluator

Context passed to evaluation:

- `mapping`
- `item`
- `layout`
- `component`
- `dropzone`
- `local`

Returns `defaultValue` on missing formula or evaluation failure.

#### `resolveFormula(...)`

Similar, but without a separate mapping context.

#### `resolveMapping(...)`

Experimental helper for mapping arrays into enriched objects using formula definitions.

This is one of the most important modern WeWeb component patterns.

## `wwLang`

Purpose: runtime language state and multilingual value helpers.

### `init(router)`

- derives default language from website info
- resolves current language from route metadata and base path

### `lang`

Public getter/setter around store language state.

### `setLang(lang)`

Public.

Behavior:

- only allows languages present on the current page
- dispatches `front/setLang`
- emits `wwLang:changed`
- returns `true` on success, `false` if the page does not support the requested language

### `getText(text)`

Public.

Behavior:

- if value is primitive, stringifies it
- if value is multilingual object, prefers current language
- then falls back to default language
- then the first available key
- finally `''`

This is the standard multilingual getter for component content.

### `setText(obj, text, lang)`

Public.

Writes localized text into an object, defaulting to current language.

## `wwLog`

Purpose: console logging wrapper.

Behavior:

- `init()` enables debug logging in development or when cookie `debug` exists
- `log`, `debug`, `group`, `groupEnd` only run when allowed
- `warn`, `info`, `error` always call the console

This is a convenience logger, not the same thing as `logStore`.

## `wwObjectHelper`

Purpose: object/template creation and object-tree inspection utilities for WeWeb elements and sections.

Also exported as `wwElementHelper`.

### Type aliases

`typeAliases` maps friendly names like `ww-text`, `ww-image`, `ww-button`, `ww-container`, `ww-columns`, and others to base IDs.

### `getDefault(type, content = {}, _state = {}, name)`

Builds a normalized WeWeb object template:

- `isWwObject: true`
- `version: 3`
- `type`
- `content`
- `name`
- `_state`
- `wwObjectBaseId`

If `content.default` is missing, it wraps input content as `{ default: content }`.

### `create(type, content, _state, parentSectionId, keepChildren, parentLibraryComponentId)`

Public.

Compatibility wrapper that creates a default template and delegates to `createFromTemplate(...)`.

### `createFromTemplate(wwObjectTemplate, parentSectionId, keepChildren, parentLibraryComponentId)`

Behavior:

- ensures `wwObjectBaseId`
- rewrites old text/button `content.default.text` into `_ww-text_text`
- attaches parent identifiers
- dispatches `websiteData/createWwObjectFromTemplate`

### `createLibraryComponentInstance(libraryComponentBaseId)`

Creates a library component instance through the store.

### `cloneElement(uid, parentSectionId, name, parentLibraryComponentId)`

Public.

Converts an existing object to template, recreates it, and returns `{ isWwObject: true, uid: newId }`.

### `convertToTemplate(uid)`

Returns full object template from store.

### `getWwObject(uid)`

Public.

Returns a wwObject directly from store getters.

### `removeWwObject(uidToRemove)`

Searches sections and objects, removes a referenced child from array content, dispatches store removal, and returns parent metadata if found.

### `findParentWwObject(uidToFind)`

Searches sections and objects and returns:

- `parentId`
- `childType`
- `childPath`
- optional `childIndex`
- parent section/library component metadata
- parent type (`section` or `element`)

### `findWwObjectByName(name)`

Searches wwObjects by `name` and sections by `sectionTitle`.

## `wwPageHelper`

Purpose: page path generation and route guessing.

### `getPagePath(pageId, lang = wwLib.wwLang.lang)`

Public.

Behavior:

- loads website info and pages from `wwWebsiteData`
- resolves by page ID or link ID
- inserts language segment when required
- omits page slug for the home page
- always returns a trailing slash

Throws if:

- project info missing
- language missing
- page missing

### `guessPage(path)`

Builds a temporary router from all pages and tries to resolve the path.

Returns:

- `pageId`
- `params`
- `collectionIndex`

Useful for route inference, but not marked public.

## `wwPluginHelper`

Purpose: plugin registration, mounting, variable/formula wiring, and load synchronization.

This is exported and heavily used by runtime bootstrap, but it is not clearly a stable public SDK.

### `registerPlugin(componentId, content, devOptions = null)`

Behavior:

- resolves plugin by component ID or name, or creates a dev plugin
- ensures `wwLib.wwPlugins` exists as a shallow reactive object
- reads runtime settings from `window.wwg_pluginsSettings`
- loads plugin config from `componentBases` Pinia store
- updates plugin settings in website data store
- delegates to `mountPlugin(...)`

### `mountPlugin(plugin, { content = {}, config = {}, settings = {} })`

Behavior:

- writes plugin facade into `wwLib.wwPlugins[namespace]`
- exposes getters for plugin `id`, `isLoaded`, and cloned `settings`
- also aliases by plugin ID for retrocompatibility
- registers plugin variables into the variables store
- defines reactive getters/setters for each plugin variable on the plugin object
- registers plugin formulas into the store
- executes `_onLoad(settings)` or `onLoad(settings)` if available
- tracks loading promises in `_pluginPromises`

### `initPlugins()` and `waitPluginsLoaded()`

Used to await plugin initialization completion.

### Internal state

- `_pluginPromises`
- `_devPlugins`

Treat those as internal.

## `wwUtils`

Purpose: generic utilities and several legacy compatibility helpers.

### ID and UUID helpers

- `getUniqueId()` public but deprecated
- `getUid()` public, preferred
- `isValidUuid(string)` public

### Asset/environment helpers

- `getCdnPrefix()`
- `getImgCdnUrl(url)`
- `getImgExtFromUrl(url)`
- `convertImgExtToType(ext)`
- `formatBgImgUrl(imgUrl)`

### CSS/text helpers

- `getLengthUnit(value, options)`
- `getTextStyleFromContent(content)`
- `getStyleFromToken(token)`
- `getTypoFromToken(token)`
- `convertColorToRGB(color)`
- `sanitize(id)`

### Data helpers

- `getDataFromCollection(collection)`
- `isEmpty(value)`
- `resolveObjectPropertyPath(object, path)`
- `removeUid(obj)`
- `getComponentType(uid)`

### Deprecated adapters

- `addScriptToHead(...)`
- `scrollIntoView(...)`

They simply warn and forward to `wwApp`.

#### `getLengthUnit(value, options)`

Important behavior:

- understands `auto`, `unset`, `normal`
- parses strings like `12px`, `50%`, `1.5em`
- returns tuple `[length, unit]`
- can use `defaultLength`, `defaultUnit`, `round`

#### `getTextStyleFromContent(content)`

Builds a CSS style object from standard WeWeb text content fields.

This is the helper behind many text-like components.

#### `getStyleFromToken(token)`

Resolves CSS custom property tokens like `var(--token, fallback)` against the front document.

#### `getTypoFromToken(token)`

Parses a typography token string into:

- `fontWeight`
- `fontSize`
- `lineHeight`
- `fontFamily`
- `fontStyle`

#### `getDataFromCollection(collection)`

Normalizes collection input for component usage:

- returns raw input if it is not a normalized collection object
- returns `collection.data` for non-paginated collections
- slices paginated collection data using `offset` and `limit`

This is the preferred replacement for deprecated `wwCollection.getCollectionData()`.

## `wwVariable`

Purpose: variable lookup, update, registration, and component variable composition.

### `getValue(variableId)`

Public.

Reads current variable value from the Pinia variables store.

### `updateValue(variableId, value, options = {})`

Public.

Supported options:

- `path`
- `index`
- `arrayUpdateType`
- `workflowContext`
- `silent`

Behavior:

- checks variable existence
- rejects `undefined` except for delete-like array operations
- validates/coerces via `checkVariableType(...)`
- writes through `variablesStore.setValue(...)`
- returns the resulting value

On failure, it logs with `wwLib.wwLog.error(...)`.

### `useComponentVariable(options)`

Public and extremely important for component authoring.

Purpose:

- create a component-owned variable
- expose it as readonly reactive value plus setter
- transparently adapt to repeats, library components, and prop overrides

Key options:

- `uid`
- `name`
- `defaultValue`
- `componentType`
- `type`
- `readonly`
- `resettable`
- `onUpdate`
- `labelOnly`
- `preserveReference`
- `isActive`

Returned object:

- `value`
- `internalValue`
- `setValue(value)`

Important behavior:

- if component is inside a repeat, it does not register a global variable and uses internal state
- if inside a library component, it registers against the library component context
- if a prop of the same name exists in `wwElementState.props`, setter emits `update:<name>` instead of writing variable store directly
- `onUpdate(newValue, oldValue)` fires for non-prop updates when the value actually changes

This is one of the strongest examples of WeWeb-specific component runtime behavior. Do not replace it with plain Vue refs when you need integration with the platform.

### Registration helpers

- `registerComponentVariable(...)`
- `registerLibraryComponentVariable(...)`
- `registerPluginVariable(...)`
- `unregisterComponentVariable(id)`
- `unregisterLibraryComponentVariable(...)`
- `unregisterPluginVariable(id)`

These are useful but less clearly intended as first-choice public API.

## `wwWebsiteData`

Purpose: website/design/page data loading and retrieval.

### `init()`

Front runtime initialization:

- reads `window.wwg_designInfo`
- dispatches `websiteData/setFullDesign`

### `fetchPage(pageId)`

Loads page JSON payloads, collections, variables, formulas, workflows, and library component data, then hydrates the store.

Important behavior:

- logs page load through `logStore`
- fetches static collection JSON files when needed
- emits `wwStore:dataLoaded` after store hydration
- can throw an object with `redirectUrl`

### `getPageRoute(pageIdOrLinkId, allowHomePageId)`

Returns page path for current language by page ID or link ID.

### Public getters

- `getDesign()`
- `getInfo()`
- `getPages()`
- `getCurrentPage()`
- `getCurrentPageId()`

### Deprecated

- `getWebsiteName()`

## `wwWorkflow`

Purpose: execute workflows from runtime code.

### `executeTrigger(trigger, { event, conditions = {} })`

Public.

Executes workflows matching a trigger and optional conditions, passing `event`.

### `executeGlobal(uid, parameters)`

Public.

Behavior:

- resolves a global workflow by UID from store
- executes it with context:
  - `parameters`
  - previous workflow result via `data/getWorkflowResults`
- throws if no UID or workflow missing
- throws the execution error if one occurred
- returns the workflow result otherwise

## `wwEditor`

`wwEditor` is exported from `services/index.js`, but the inspected file is effectively empty in this codebase snapshot.

Implication:

- older top-level wrappers like `findParentUidByFlag` and `selectParentByFlag` still delegate to it
- in this snapshot, those wrappers are not useful
- do not build new code around `wwEditor` unless you inspect another editor-specific build/source

## `globalVariables`

Purpose: low-level mutable runtime globals.

Shape:

- `_navigationId`
- `customCodeVariables`
- `globalComponentActionsFn.sections`
- `globalComponentActionsFn.elements`
- `globalComponentActionsFn.libraryComponents`

This is runtime plumbing. Useful to understand, but not a first-choice public API for new component code.

## Reactive stores exposed on `wwLib`

## `scrollStore`

Created by `createScrollStore()`.

Exposes:

- `screen`
- `componentPositionInfo`
- `setValues()`
- `start()`

Behavior:

- tracks scroll position, viewport size, page size
- computes scroll percentages
- continuously tracks element geometry for registered component IDs
- executes workflows on `page-scroll` and `page-resize`

`screen.value` shape:

- `scroll.x`
- `scroll.y`
- `scroll.xPercent`
- `scroll.yPercent`
- `screenSize.width`
- `screenSize.height`
- `pageSize.width`
- `pageSize.height`

## `keyboardEventStore`

Created by `createKeyboardEventStore()`.

Exposes:

- `keyboardEventInfo`
- `start()`

Behavior:

- listens to `keydown` and `keyup`
- stores latest event info for each
- triggers workflows `keydown` and `keyup`

`keyboardEventInfo.value` shape:

- `keydown.key`
- `keydown.keyCode`
- `keydown.shiftKey`
- `keydown.ctrlKey`
- `keydown.altKey`
- `keydown.metaKey`
- same fields for `keyup`

## `logStore`

Created by `createLogStore()`.

Exposes:

- `logs`
- `log(type, message, meta)`
- `error(...)`
- `warning(...)`
- `info(...)`
- `verbose(...)`
- `registerListener(listener)`
- `unregisterListener(listener)`
- `clear()`
- `TYPES`

Observed caveat:

- in the inspected snapshot, the body of `log(type, message, meta)` is effectively empty
- the public shape exists, and the rest of the code writes to `logStore`
- but you should verify the final implementation before relying on persisted log entries

## Top-level compatibility wrappers

`src/wwLib/index.js` adds old-style top-level methods that forward to newer namespaces.

For new code, prefer the namespaced versions:

- `wwLib.wwApp.goTo`
- `wwLib.wwUtils.getStyleFromToken`
- `wwLib.wwUtils.getTypoFromToken`
- `wwLib.wwUtils.resolveObjectPropertyPath`
- `wwLib.wwUtils.getTextStyleFromContent`
- `wwLib.wwWorkflow.executeGlobal`
- `wwLib.wwElement.useCreate`
- `wwLib.wwElement.useLayoutStyle`

## Safe usage rules for AI agents

1. Prefer methods marked `@PUBLIC_API`.
2. Prefer namespaced methods over top-level deprecated wrappers.
3. Treat `wwElement.useCreate()` as editor/dev-oriented unless you confirm the current context supports it.
4. Use `wwElement.useLink()` instead of hand-rolling WeWeb link behavior.
5. Use `wwFormula.useFormula()` for mapping/code formulas instead of evaluating custom code manually.
6. Use `wwVariable.useComponentVariable()` when a component variable must integrate with repeats, props, library components, or WeWeb state.
7. Use `wwLang.getText()` for multilingual content objects.
8. Use `wwUtils.getDataFromCollection()` when a prop may be either raw data or a collection wrapper.
9. Treat `wwPluginHelper`, `globalVariables`, and unannotated store internals as advanced runtime plumbing.
10. Assume front/runtime and editor behavior differ unless confirmed.

## Recommended usage patterns

### Pattern: multilingual text

```js
const label = computed(() => wwLib.wwLang.getText(content.label));
```

### Pattern: collection normalization

```js
const items = computed(() => wwLib.wwUtils.getDataFromCollection(props.items) || []);
```

### Pattern: formula-driven mapping

```js
const { resolveMapping } = wwLib.wwFormula.useFormula();
const mappedItems = computed(() => resolveMapping(rawItems.value, content.mapping, {}));
```

### Pattern: WeWeb-aware link rendering

```js
const { tag, properties, hasLink } = wwLib.wwElement.useLink();
```

### Pattern: component-owned variable

```js
const state = wwLib.wwVariable.useComponentVariable({
  uid: props.uid,
  name: 'value',
  defaultValue: '',
  type: 'string',
});
```

## Known implementation caveats

- `wwEditor` is empty in this snapshot.
- `wwElement.useCreate()` methods warn instead of performing creation in the front build.
- `wwAuth.getIsAuthenticated()` checks `_isAuthenticated` but calls `_getIsAuthenticated()`.
- `logStore.log(...)` has no visible implementation in the inspected file snapshot.
- some APIs are public only for backward compatibility, not because they are the best modern choice.

## What an AI agent should infer from this API

`wwLib` is not just a utility bag. It is the bridge into WeWeb runtime conventions. If an agent writes components as if this were plain Vue, it will usually miss:

- multilingual content handling
- collection wrappers and pagination
- formula/code mapping
- WeWeb link semantics
- variable registration and repeat/library component context
- workflow triggers
- plugin-backed data/auth behavior

The correct strategy is:

- use `wwLib` helpers for platform semantics
- use plain Vue only for component-local presentation logic
- avoid undocumented internals unless the codebase itself clearly depends on them

