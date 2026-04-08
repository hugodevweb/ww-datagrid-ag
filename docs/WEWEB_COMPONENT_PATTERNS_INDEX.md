# WeWeb Component Patterns Index

Quick index for finding the best reference component by problem type.

Role:

- quick lookup by component category and use case

Companion files:

- `README_AGENT_PACK.md`
- `WEWEB_COMPONENTS_MASTER_GUIDE.md`
- `WEWEB_COMPONENT_API_MATRIX.md`
- `WEWEB_COMPONENTS_FOR_CODEX.md`
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
- `WeWeb-Component-Development-Guide.md`

## Input / Form Field

- `ww-input-basic`
- `ww-input-checkbox`
- `ww-input-select`
- `ww-input-rich-text`
- `ww-input-date-time-picker`

Main patterns:

- `useComponentVariable`
- `useForm(...)`
- `wwElementState.props.attributes`
- focus/readonly state sync
- `triggerEvents.change`

## Select / Picker / Dropdown

- `ww-input-select`
- `ww-input-radio`
- `ww-radiogroup`

Main patterns:

- collection normalization
- `Formula` mapping
- search
- teleport/floating dropdown
- actions like open/close/reset/focus

## Repeated No-Code Template

- `ww-timeline`
- `ww-kanban`

Main patterns:

- hidden embedded child element
- `wwLayoutItemContext`
- nested `<wwElement>`
- optional `ww-props`

## Data Widget / Data Visualization

- `ww-calendar`
- `ww-datagrid-ag`
- `ww-data-grid`

Main patterns:

- formula-based mapping
- internal variables for selection/sort/filter
- rich trigger events
- actions
- dynamic style logic

## Chat / Messaging

- `ww-chat`
- `ww-chat-ai`

Main patterns:

- formula mapping for messages
- nested formula mapping for attachments/participants
- rich event payloads
- auto-scroll behavior
- streaming state for AI chat

## Builder / Editor-Managed Component

- `ww-slider`
- `ww-sliderV2`
- `ww-lightbox`

Main patterns:

- `createElement`
- `cloneElement`
- hidden managed child trees
- `update:content:effect`
- `update:sidepanel-content`

## Container / Layout / Dropzone

- `ww-container`
- `ww-columns`
- `ww-modal`
- `ww-webapp-sidebar`

Main patterns:

- `<wwLayout path="...">`
- `inherit-from-element`
- `wwFrontState.screenSize`
- editor-side layout mutation

## Formula Mapping

Best references:

- `ww-input-select`
- `ww-calendar`
- `ww-chat`
- `ww-chat-ai`
- `ww-datagrid-ag`

Look for:

- `type: 'Formula'`
- `options.template`
- `context.mapping`
- `resolveMappingFormula(...)`

## Hidden Embedded Elements

Best references:

- `ww-timeline`
- `ww-kanban`
- `ww-lightbox`
- `ww-input-radio`

Look for:

- `hidden: true`
- `defaultValue: { isWwObject: true, ... }`
- `navigator`
- `<wwElement v-bind="content.someChild" />`

## Editor Orchestration

Best references:

- `ww-input-select`
- `ww-input-rich-text`
- `ww-columns`
- `ww-container`
- `ww-lightbox`
- `ww-datagrid-ag`

Look for:

- `wwEditorState.boundProps`
- `wwEditorState.sidepanelContent`
- `update:content:effect`
- `update:sidepanel-content`
- `isACopy`

## Floating UI / Teleport / Global DOM

Best reference:

- `ww-input-select`

Look for:

- `teleport`
- `wwLib.getFrontDocument()`
- `wwLib.getFrontWindow()`
- scroll/resize listeners
- dropdown positioning

