# WeWeb Agent Pack

This folder contains a documentation pack for AI agents working with WeWeb custom components.

It now also includes a dedicated `wwLib` API documentation set, because `wwLib` is a core runtime surface behind many WeWeb component patterns.

Official reference components mentioned in this pack live in:

- `https://github.com/weweb-assets`

This starter repository contains the documentation pack and a dummy component, but not the full official component mirror.

Primary entry point:

- start with `WEWEB_COMPONENTS_MASTER_GUIDE.md` if only one file should be read first
- start with `WEWEB_COMPONENTS_FOR_CODEX.md` if the agent needs fuller onboarding from zero

If the agent has never seen WeWeb before, use the files in this order:

1. `WEWEB_COMPONENTS_MASTER_GUIDE.md`
   - canonical guide
   - explains the component model, hard rules, main APIs, and decision checklist
2. `WEWEB_COMPONENT_API_MATRIX.md`
   - fast map from API/pattern to exact reference files in the repo
3. `WEWEB_COMPONENTS_FOR_CODEX.md`
   - long onboarding manual with fuller explanations and recipes
4. `WEWEB_COMPONENTS_MCP_GUIDE.md`
   - repo-aware summary of current patterns and what changed compared to older assumptions
5. `WeWeb-Component-Development-Guide.md`
   - stricter implementation constraints and mandatory guardrails
6. `WWLIB_API_MASTER_GUIDE.md`
   - canonical guide to the `wwLib` runtime API
7. `WWLIB_API_REFERENCE.md`
   - fast lookup table for `wwLib` namespaces, methods, and caveats
8. `WWLIB_API_USAGE_MATRIX.md`
   - decision matrix with examples, safe defaults, and "when not to use" rules
9. `SYSTEM_PROMPT_WEWEB_WWLIB.md`
   - system prompt that forces an agent to prioritize `wwLib` APIs proven by official component usage
10. `WWLIB_OFFICIAL_USAGE_INDEX.md`
   - lookup table for which `wwLib` methods are actually used by official components and where to copy patterns from

## Purpose of Each File

- `WEWEB_COMPONENTS_MASTER_GUIDE.md`
  - best single file if you only want one document
- `WEWEB_COMPONENT_API_MATRIX.md`
  - best file when you know the API/pattern you need and want exact repo references
- `WEWEB_COMPONENTS_FOR_CODEX.md`
  - best file for onboarding an agent from zero
- `WEWEB_COMPONENTS_MCP_GUIDE.md`
  - best file for understanding current repo conventions at a glance
- `SYSTEM_PROMPT_WEWEB_COMPONENTS.md`
  - ready-to-use system prompt for an agent dedicated to WeWeb components
- `WEWEB_COMPONENT_PATTERNS_INDEX.md`
  - quick lookup by component category such as input, select, grid, chat, repeater, builder, container
- `WWLIB_API_MASTER_GUIDE.md`
  - best file when the task depends on `wwLib` behavior, lifecycle, or runtime semantics
- `WWLIB_API_REFERENCE.md`
  - best file when you need to know whether a concrete `wwLib` method exists and how safe it is to use
- `WWLIB_API_USAGE_MATRIX.md`
  - best file when you know the task you need to solve and want the fastest safe API choice
- `SYSTEM_PROMPT_WEWEB_WWLIB.md`
  - best file when the agent must reason about both WeWeb components and `wwLib` with usage-based API trust
- `WWLIB_OFFICIAL_USAGE_INDEX.md`
  - best file when you want repository-proven references for a concrete `wwLib` method

## Recommended Working Mode for an Agent

Before editing a component:

1. classify the component type
2. open its `ww-config.js`
3. open its runtime Vue file
4. check the closest matching references in `WEWEB_COMPONENT_API_MATRIX.md`
5. if the component relies on runtime helpers, open `WWLIB_API_MASTER_GUIDE.md` or `WWLIB_API_REFERENCE.md`
6. if you need the shortest API decision path, open `WWLIB_API_USAGE_MATRIX.md`
7. if the API choice is sensitive, confirm it in `WWLIB_OFFICIAL_USAGE_INDEX.md`
8. only then implement changes

## Best Current Reference Components

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

## Quick Rule

If an agent starts treating a WeWeb component like plain Vue UI without considering:

- `ww-config.js`
- `wwEditorState`
- `boundProps`
- `sidepanelContent`
- `useForm(...)`
- `Formula` mapping
- hidden embedded elements
- `update:content:effect`

then it is probably on the wrong track.

