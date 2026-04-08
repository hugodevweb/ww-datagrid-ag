# wwLib API Reference

Role: exhaustive quick-reference for `wwLib` public and semi-public surface based on `docs/wwlib-src`.

Companion files:
- [WWLIB_API_MASTER_GUIDE.md](./WWLIB_API_MASTER_GUIDE.md)
- [README_AGENT_PACK.md](./README_AGENT_PACK.md)

## Entry point

Primary entry file:

- `docs/wwlib-src/index.js`

Namespace assembly:

- `docs/wwlib-src/services/index.js`

## Top-level `wwLib`

### Stable/public

| API | Status | Notes |
| --- | --- | --- |
| `$on(event, fn)` | exported | event bus listener |
| `$once(event, fn)` | exported | one-shot event bus listener |
| `$emit(event, ...args)` | exported | event bus emit |
| `$off(event, fn)` | exported | event bus unsubscribe |
| `initFront({ router, store })` | exported | front bootstrap |
| `getFrontWindow()` | public | front window accessor |
| `getFrontDocument()` | public | front document accessor |
| `getFrontRouter()` | public | front router accessor |
| `getEditorWindow()` | public | currently returns `null` |
| `getEditorDocument()` | public | currently returns `null` |
| `getEditorRouter()` | public | editor router accessor |
| `useIcons()` | public | returns `{ getIcon: store.getIcon }` |

### Exported runtime helpers

| API | Status | Notes |
| --- | --- | --- |
| `front` | exported | runtime shell object |
| `$focus` | exported | mutable focus slot |
| `env` | exported | `process.env.NODE_ENV` |
| `getResponsiveStyleProp(...)` | internal-style | resolves responsive style prop |
| `globalContext` | exported | computed reactive runtime context |
| `pageData` | exported | computed current page data |
| `getEnvironment()` | exported | `editor`, `staging`, `preview`, `production` |
| `useBaseTag()` | exported | checks `<base>` usage |
| `getBaseTag()` | exported | returns normalized base path |

### Deprecated top-level wrappers

| API | Prefer instead |
| --- | --- |
| `goTo(...)` | `wwLib.wwApp.goTo(...)` |
| `getStyleFromToken(...)` | `wwLib.wwUtils.getStyleFromToken(...)` |
| `getTypoFromToken(...)` | `wwLib.wwUtils.getTypoFromToken(...)` |
| `element(value)` | no new usage |
| `resolveObjectPropertyPath(...)` | `wwLib.wwUtils.resolveObjectPropertyPath(...)` |
| `getTextStyleFromContent(...)` | `wwLib.wwUtils.getTextStyleFromContent(...)` |
| `executeWorkflow(...)` | `wwLib.wwWorkflow.executeGlobal(...)` |
| `findParentUidByFlag(...)` | avoid, legacy/editor-side |
| `selectParentByFlag(...)` | avoid, legacy/editor-side |
| `useCreateElement()` | `wwLib.wwElement.useCreate()` |
| `useLayoutStyle()` | `wwLib.wwElement.useLayoutStyle()` |

## Service namespaces

## `wwApp`

Source:

- `docs/wwlib-src/services/wwApp.js`

| API | Public | Notes |
| --- | --- | --- |
| `scrollIntoView(element, options)` | yes | smooth scroll with offset |
| `addScriptToHead(scriptUrl, attributes, options)` | yes | inject script into head |
| `addStyleSheetToHead(styleUrl, attributes, options)` | yes | inject stylesheet into head |
| `goTo(route, query, options)` | yes | route navigation helper |

## `wwAuth`

Source:

- `docs/wwlib-src/services/wwAuth.js`

| API | Public tag | Notes |
| --- | --- | --- |
| `isInitialized` | no | `ref(false)` |
| `plugin` | no | getter resolving current auth plugin |
| `init()` | no | idempotent auth init |
| `getUser()` | no | current user |
| `getIsAuthenticated()` | no | auth state |
| `getUnauthenticatedPageId()` | no | page fallback |
| `getUnauthorizedPageId()` | no | forbidden fallback |
| `getUserRoles()` | no | normalized roles |
| `matchUserGroups(userGroups)` | no | any group match |
| `matchUserGroup(userGroup)` | no | single group match |
| `matchRoles(roles)` | no | all roles required |

## `wwApiRequests`

Source:

- `docs/wwlib-src/services/wwApiRequests.js`

| API | Public tag | Notes |
| --- | --- | --- |
| `_getApiUrl()` | no | reads `VITE_APP_API_URL` |
| `_getPluginsUrl()` | no | reads `VITE_APP_PLUGINS_URL` |
| `_getPreviewUrl()` | no | design override or env fallback |
| `_getCdnUrl()` | no | reads `VITE_APP_CDN_URL` |

## `wwCollection`

Source:

- `docs/wwlib-src/services/wwCollection.js`

| API | Public | Notes |
| --- | --- | --- |
| `getCollection(collectionId)` | no | reads collection from store |
| `getCollectionPluginConfig(collectionId)` | no | plugin component-base config |
| `getCollectionQueryConfig(collectionId)` | no | query config from plugin editor config |
| `_fetchCollection(id, { limit, offset })` | no | internal fetch primitive |
| `fetchCollection(id, { limit, offset }, workflowContext)` | no | main fetch orchestration |
| `updateCollection(collectionId, data, options)` | no | in-store mutation helper |
| `setOffset(collectionId, offset)` | yes | pagination offset API |
| `getPaginationOptions(collectionId)` | no | getter passthrough |
| `isCollection(value)` | no | normalized collection check |
| `getCollectionData(...args)` | yes, deprecated | use `wwUtils.getDataFromCollection` |

## `wwEditor`

Source:

- `docs/wwlib-src/services/wwEditor.js`

| API | Notes |
| --- | --- |
| none in this snapshot | file exports an empty object |

## `wwElement`

Source:

- `docs/wwlib-src/services/wwElement.js`

| API | Public | Notes |
| --- | --- | --- |
| `useCreate()` | yes | returns create/clone methods, front build warns only |
| `useLayoutStyle()` | yes | computed layout style helper |
| `useBackgroundVideo()` | yes | computed background video helper |
| `useLink({ isDisabled, forcedLinkRef })` | yes | WeWeb-aware link abstraction |
| `useRegisterElementLocalContext` | yes | re-exported helper |
| `getComponentLabel` | yes | re-exported helper |

`useCreate()` returns:

- `createElement(...)`
- `createElementFromTemplate(...)`
- `cloneElement(...)`

In the inspected front implementation, these only warn and do not create anything.

## `wwFormula`

Source:

- `docs/wwlib-src/services/wwFormula.js`

| API | Public | Notes |
| --- | --- | --- |
| `getValue` | yes | re-export of generic value resolver |
| `useFormula()` | yes | formula/code evaluation helpers |

`useFormula()` returns:

- `resolveMappingFormula(formula, mappingContext, defaultValue)`
- `resolveFormula(formula, defaultValue)`
- `resolveMapping(data, map, defaultMap)`

## `wwLang`

Source:

- `docs/wwlib-src/services/wwLang.js`

| API | Public | Notes |
| --- | --- | --- |
| `defaultLang` | no | internal mutable fallback |
| `init(router)` | no | runtime init |
| `lang` getter/setter | yes | current language |
| `setLang(lang)` | yes | validated page language switch |
| `getText(text)` | yes | multilingual getter |
| `setText(obj, text, lang)` | yes | multilingual setter |

## `wwLog`

Source:

- `docs/wwlib-src/services/wwLog.js`

| API | Public tag | Notes |
| --- | --- | --- |
| `isAllowed` | no | debug gating state |
| `init()` | no | enables debug logging |
| `log(...args)` | no | console log when allowed |
| `debug(...args)` | no | console debug when allowed |
| `group(...args)` | no | console group when allowed |
| `groupEnd(...args)` | no | console groupEnd when allowed |
| `warn(...args)` | no | always warns |
| `info(...args)` | no | always infos |
| `error(...args)` | no | always errors |

## `wwObjectHelper`

Source:

- `docs/wwlib-src/services/wwObjectHelper.js`

Also exported as `wwElementHelper`.

| API | Public | Notes |
| --- | --- | --- |
| `typeAliases` | no | friendly type -> base ID map |
| `getDefault(type, content, _state, name)` | no | normalized template builder |
| `create(type, content, _state, parentSectionId, keepChildren, parentLibraryComponentId)` | yes | create from friendly params |
| `createFromTemplate(template, parentSectionId, keepChildren, parentLibraryComponentId)` | no | dispatches store creation |
| `createLibraryComponentInstance(libraryComponentBaseId)` | no | create library component instance |
| `cloneElement(uid, parentSectionId, name, parentLibraryComponentId)` | yes | clones object |
| `convertToTemplate(uid)` | no | full object template lookup |
| `getWwObject(uid)` | yes | direct object lookup |
| `removeWwObject(uidToRemove)` | no | tree removal helper |
| `findParentWwObject(uidToFind)` | no | parent tree lookup |
| `findWwObjectByName(name)` | no | name-based lookup |

## `wwPageHelper`

Source:

- `docs/wwlib-src/services/wwPageHelper.js`

| API | Public | Notes |
| --- | --- | --- |
| `getPagePath(pageId, lang)` | yes | build normalized page path |
| `guessPage(path)` | no | infer page from path using temp router |

## `wwPluginHelper`

Source:

- `docs/wwlib-src/services/wwPluginHelper.js`

| API | Public tag | Notes |
| --- | --- | --- |
| `registerPlugin(componentId, content, devOptions)` | no | plugin registration/bootstrap |
| `mountPlugin(plugin, payload)` | no | plugin facade + variables + formulas |
| `initPlugins()` | no | await all plugin loads |
| `waitPluginsLoaded()` | no | `Promise.all(_pluginPromises)` |
| `_pluginPromises` | no | internal |
| `_devPlugins` | no | internal |

## `wwUtils`

Source:

- `docs/wwlib-src/services/wwUtils.js`

| API | Public | Notes |
| --- | --- | --- |
| `getUniqueId()` | yes, deprecated | old numeric ID helper |
| `getUid()` | yes | UUID generator |
| `isValidUuid(string)` | yes | UUID validator |
| `getCdnPrefix()` | yes | CDN env prefix |
| `getLengthUnit(value, options)` | yes | parse CSS length string |
| `getTextStyleFromContent(content)` | yes | standard text style object |
| `getStyleFromToken(token)` | yes | CSS variable resolution |
| `getTypoFromToken(token)` | yes | parse typography token |
| `getDataFromCollection(collection)` | yes | normalize collection/raw input |
| `isEmpty(value)` | yes | generic emptiness check |
| `resolveObjectPropertyPath(object, path)` | yes | lodash get wrapper |
| `addScriptToHead(options, allowMultipleAdd)` | yes, deprecated | forward to `wwApp` |
| `scrollIntoView(element, offset)` | yes, deprecated | forward to `wwApp` |
| `convertColorToRGB(color)` | no | hex to rgba |
| `convertImgExtToType(ext)` | no | file extension to mime type |
| `formatBgImgUrl(imgUrl)` | no | escape URL for CSS `url(...)` |
| `getImgCdnUrl(url)` | no | prefixes relative asset URLs |
| `getImgExtFromUrl(url)` | no | extension extraction |
| `removeUid(obj)` | no | recursively strips ww object `uid` |
| `sanitize(id)` | no | lowercases and replaces spaces with `_` |
| `getComponentType(uid)` | no | `element`, `libraryComponent`, `section`, or `null` |

## `wwVariable`

Source:

- `docs/wwlib-src/services/wwVariable.js`

| API | Public | Notes |
| --- | --- | --- |
| `getValue(variableId)` | yes | read variable value |
| `updateValue(variableId, value, options)` | yes | validated variable write |
| `useComponentVariable(options)` | yes | WeWeb-aware component variable composition |
| `registerComponentVariable(payload)` | no | registers component variable in Pinia |
| `registerLibraryComponentVariable(payload)` | no | library component variable registration |
| `registerPluginVariable(payload)` | no | plugin variable registration |
| `unregisterPluginVariable(id)` | no | plugin variable removal |
| `unregisterComponentVariable(id)` | no | component variable removal |
| `unregisterLibraryComponentVariable(payload)` | no | library component variable removal |

`useComponentVariable(...)` returns:

- `value`
- `internalValue`
- `setValue(value)`

## `wwWebsiteData`

Source:

- `docs/wwlib-src/services/wwWebsiteData.js`

| API | Public | Notes |
| --- | --- | --- |
| `init()` | no | reads `window.wwg_designInfo` into store |
| `fetchPage(pageId)` | no | page hydration orchestration |
| `getPageRoute(pageIdOrLinkId, allowHomePageId)` | no | current-lang route helper |
| `getWebsiteName()` | yes, deprecated | old site name getter |
| `getDesign()` | yes | design object |
| `getInfo()` | yes | design info |
| `getPages()` | yes | pages array |
| `getCurrentPage()` | yes | current page getter |
| `getCurrentPageId()` | yes | current page ID getter |

## `wwWorkflow`

Source:

- `docs/wwlib-src/services/wwWorkflow.js`

| API | Public | Notes |
| --- | --- | --- |
| `executeTrigger(trigger, { event, conditions })` | yes | execute workflows by trigger |
| `executeGlobal(uid, parameters)` | yes | execute global workflow by UID |

## Runtime globals and stores

## `globalVariables`

Source:

- `docs/wwlib-src/services/globalVariables.js`

| Field | Notes |
| --- | --- |
| `_navigationId` | used to cancel stale async work on navigation |
| `customCodeVariables` | reactive bag for custom code variables |
| `globalComponentActionsFn.sections` | reactive action registry |
| `globalComponentActionsFn.elements` | reactive action registry |
| `globalComponentActionsFn.libraryComponents` | reactive action registry |

## `scrollStore`

Source:

- `docs/wwlib-support/scrollStore.js`

| API | Notes |
| --- | --- |
| `screen` | reactive scroll/screen/page metrics |
| `componentPositionInfo` | reactive per-component geometry info |
| `setValues()` | recompute metrics |
| `start()` | attach listeners and begin RAF tracking |

## `keyboardEventStore`

Source:

- `docs/wwlib-support/keyboardStore.js`

| API | Notes |
| --- | --- |
| `keyboardEventInfo` | reactive last keydown/keyup state |
| `start()` | attach keyboard listeners |

## `logStore`

Source:

- `docs/wwlib-support/logStore.js`

| API | Notes |
| --- | --- |
| `logs` | reactive log array |
| `log(type, message, meta)` | visible shape, implementation body not present in snapshot |
| `error(message, meta)` | wrapper |
| `warning(message, meta)` | wrapper |
| `info(message, meta)` | wrapper |
| `verbose(message, meta)` | wrapper |
| `registerListener(listener)` | subscribe |
| `unregisterListener(listener)` | unsubscribe |
| `clear()` | reset logs |
| `TYPES` | log type enum |

## Recommended first-choice APIs for component authors

If an agent needs one default shortlist, prefer these:

- `wwLib.wwLang.getText`
- `wwLib.wwFormula.useFormula`
- `wwLib.wwVariable.useComponentVariable`
- `wwLib.wwUtils.getDataFromCollection`
- `wwLib.wwElement.useLink`
- `wwLib.wwElement.useLayoutStyle`
- `wwLib.wwApp.goTo`
- `wwLib.wwWorkflow.executeTrigger`
- `wwLib.wwPageHelper.getPagePath`

## APIs to avoid by default

- top-level deprecated wrappers on `wwLib`
- `wwEditor` in this snapshot
- `wwElement.useCreate()` in front runtime unless editor context is confirmed
- direct mutation of `globalVariables`
- depending on internal underscored methods when a public alternative exists

