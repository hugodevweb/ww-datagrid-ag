# WeWeb Component API Matrix

This file maps important WeWeb APIs and patterns to the best concrete references in this repository.

Role:

- API and pattern lookup table with exact repository references

Companion files:

- `README_AGENT_PACK.md`
- `WEWEB_COMPONENTS_MASTER_GUIDE.md`
- `WEWEB_COMPONENTS_FOR_CODEX.md`
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
- `WeWeb-Component-Development-Guide.md`

## `Formula` Mapping

- `ww-calendar/ww-config.js`
- `ww-calendar/src/wwElement.vue`
- `ww-input-select/ww-config.js`
- `ww-input-select/src/wwElement_Select.vue`
- `ww-chat/ww-config.js`
- `ww-chat-ai/ww-config.js`
- `ww-datagrid-ag/src/wwElement.vue`

Look for:

- `type: 'Formula'`
- `options.template`
- `context.mapping`
- `resolveMappingFormula(...)`

## `ObjectPropertyPath`

- `ww-input-radio/ww-config.js`
- `ww-kanban/ww-config.js`
- `ww-input-rich-text/ww-config.js`

Look for:

- `type: 'ObjectPropertyPath'`
- `options: content => ({ object: ... })`
- `hidden(... boundProps ...)`

## Collection Normalization

- `ww-input-radio/src/wwElement.vue`
- `ww-kanban/src/wwElement.vue`
- `ww-mapbox/src/wwElement.vue`
- `ww-datagrid-ag/src/wwElement.vue`

Look for:

- `wwLib.wwCollection.getCollectionData(...)`
- `wwLib.wwUtils.getDataFromCollection(...)`

## Internal Variables

- `ww-input-select/src/wwElement_Select.vue`
- `ww-calendar/src/wwElement.vue`
- `ww-datagrid-ag/src/wwElement.vue`
- `ww-input-rich-text/src/wwElement.vue`
- `ww-kanban/src/wwElement.vue`

Look for:

- `wwLib.wwVariable.useComponentVariable(...)`

## Form Registration

- `ww-input-select/src/wwElement_Select.vue`
- `ww-input-checkbox/src/wwElement.vue`
- `ww-input-rich-text/src/wwElement.vue`

Look for:

- `inject('_wwForm:useForm', ...)`
- `useForm(...)`

## Editor State

- `ww-input-select/src/wwElement_Select.vue`
- `ww-lightbox/src/wwElement.vue`
- `ww-slider/src/wwElement.vue`
- `ww-container/src/wwElement.vue`
- `ww-columns/src/wwElement.vue`

Look for:

- `wwEditorState.boundProps`
- `wwEditorState.sidepanelContent`
- `wwEditorState.isSelected`
- `wwEditorState.isACopy`

## Front State

- `ww-container/src/wwElement.vue`
- `ww-columns/src/wwElement.vue`
- `ww-sliderV2/src/wwElement.vue`
- `ww-lightbox/src/wwElement.vue`

Look for:

- `wwFrontState.screenSize`
- `wwFrontState.sectionId`

## Update Channels

- `ww-slider/src/wwElement.vue`
- `ww-sliderV2/src/wwElement.vue`
- `ww-lightbox/src/wwElement.vue`
- `ww-container/src/wwElement.vue`
- `ww-columns/src/wwElement.vue`
- `ww-datagrid-ag/src/wwElement.vue`

Look for:

- `update:content`
- `update:content:effect`
- `update:sidepanel-content`

## Hidden Embedded Elements

- `ww-timeline/ww-config.js`
- `ww-kanban/ww-config.js`
- `ww-input-radio/ww-config.js`
- `ww-lightbox/ww-config.js`
- `ww-slider/ww-config.js`

Look for:

- `hidden: true`
- `defaultValue: { isWwObject: true, ... }`
- `navigator`

## Nested WeWeb Elements

- `ww-timeline/src/wwElement.vue`
- `ww-kanban/src/wwElement.vue`
- `ww-input-radio/src/wwElement.vue`

Look for:

- `<wwElement v-bind="content.someChild" />`
- `:ww-props="{ ... }"`

## Repeated Context

- `ww-timeline/src/wwElement.vue`
- `ww-kanban/src/wwElement.vue`
- `ww-input-radio/src/wwElement.vue`
- `ww-tab-trigger/src/wwElementTabTrigger.vue`

Look for:

- `<wwLayoutItemContext ...>`

## Create / Clone Element

- `ww-slider/src/wwElement.vue`
- `ww-sliderV2/src/wwElement.vue`
- `ww-lightbox/src/wwElement.vue`
- `ww-input-checkbox/src/wwElement.vue`
- `ww-datagrid-ag/src/wwElement.vue`

Look for:

- `wwLib.useCreateElement()`
- `wwLib.createElement(...)`
- `cloneElement`

## Teleport / Floating Dropdown

- `ww-input-select/src/wwElement_Select.vue`

Look for:

- `teleport`
- trigger rect positioning
- scroll/resize sync
- scroll lock

## DOM Access

- `ww-input-select/src/wwElement_Select.vue`
- `ww-kanban/src/wwElement.vue`
- `ww-input-recaptcha/src/wwElement.vue`

Look for:

- `wwLib.getFrontDocument()`
- `wwLib.getFrontWindow()`

## Provide / Inject

- `ww-input-select/src/wwElement_Select.vue`
- `ww-kanban/src/wwElement.vue`
- `ww-form-container/src/shared/useForm.js`

Look for:

- `provide(...)`
- `inject(...)`

## Local Context Registration

- `ww-input-select/src/wwElement_Select.vue`

Look for:

- `wwLib.wwElement.useRegisterElementLocalContext(...)`

## Dynamic Style by Formula

- `ww-datagrid-ag/src/wwElement.vue`

Look for:

- `getHeaderStyle`
- formula resolution against derived metadata

## Builder / Editor Automation

- `ww-slider/src/wwElement.vue`
- `ww-sliderV2/src/wwElement.vue`
- `ww-lightbox/src/wwElement.vue`
- `ww-datagrid-ag/src/wwElement.vue`
- `ww-columns/src/wwElement.vue`
- `ww-container/src/wwElement.vue`

Look for:

- editor-only watchers
- `isACopy`
- hidden child auto-provisioning
- sidepanel sync

