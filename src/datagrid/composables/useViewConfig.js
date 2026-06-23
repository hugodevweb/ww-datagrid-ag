import { ref, watch, onBeforeUnmount } from 'vue';

// View configuration: owns the `currentConfig` and `columnDefs` WeWeb variables,
// `applyViewConfiguration` (the function that pushes a saved viewConfiguration
// into the grid), the edited-variable suppression machinery, the two watchers
// that drive initial-apply and external-change-apply, and the one-time
// `initialState` seeding (including grouping bootstrap).
//
// Dependencies fall into three buckets:
//   1. Foundation (cfg/props/ctx/gridApi/gridReady/debugLog).
//   2. From other composables (filterValue/sortValue from useFiltersAndSort —
//      passed via thunks because useFiltersAndSort is created AFTER this one;
//      groupingState/etc. from useGrouping; setSelectedRows from useSelection).
//   3. Still inline in setup() (columnOrder, hiddenColumns, chooserColumnOrder,
//      chooserHiddenState, isVirtualColumn, isEmptyConfigValue) — will move
//      into useColumnState / useColumnChooser in Session 5; passed as deps for
//      now to keep the contract stable.
export function useViewConfig(cfg, props, ctx, {
  gridApi, gridReady, debugLog,
  // Thunks: useFiltersAndSort is created AFTER useViewConfig, so its returns
  // (filterValue, sortValue) cannot be referenced directly at construction.
  getFilterValue,
  getSortValue,
  // Setters for the global filter/sort WeWeb variables, thunked because
  // useFiltersAndSort is created AFTER this composable. Used by the
  // view-config apply path so it can update `filterValue` even when ag-grid's
  // setFilterModel silently no-ops on a stale gridApi (which happens during
  // grouping toggle, when old per-group apis are destroyed before the new
  // ones mount). Without this, newly-mounted group grids reapply the OLD
  // filterValue from onGroupGridReady, reinstating a filter the view config
  // was trying to clear/replace.
  getSetFilters,
  getSetSort,
  // Advanced filters (Filter Builder) — thunks for parity with filter/sort.
  // getAdvancedFilters() returns the normalized { combinator, conditions } value;
  // getSetAdvancedFilters() returns the setter used by the apply path.
  getAdvancedFilters,
  getSetAdvancedFilters,
  // From useGrouping (created BEFORE useViewConfig — direct refs are OK):
  groupingState, groupGridApis, groupSelections,
  getStoredCollapsedForView, isValidGroupColumn,
  // From useSelection:
  setSelectedRows,
  // Still inline in setup() (Session 5 will absorb these):
  columnOrder, setColumnOrder,
  hiddenColumns, setHiddenColumns,
  chooserColumnOrder, chooserHiddenState,
  isVirtualColumn,
  isEmptyConfigValue,
  // User conditional row styles plumbing (from useUserConditionalStyles).
  // Thunked because useUserConditionalStyles is created AFTER useViewConfig.
  getUserRules,
  setUserRules,
}) {
  // Exposed variable for current grid configuration (includes user edits)
  // This can be stored and passed back to viewConfiguration to restore state
  const { value: currentConfig, setValue: setCurrentConfig } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: "currentConfig",
      type: "object",
      defaultValue: {
        sizes: {},
        filters: {},
        advancedFilters: { combinator: 'and', conditions: [] },
        sorting: [],
        columnsOrder: [],
        hiddenColumns: [],
        userConditionalRowStyles: [],
      },
      readonly: true,
    });

  // Exposed variable for the configured column definitions (mirrors props.content.columns)
  const { value: columnDefsVar, setValue: setColumnDefsVar } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: "columnDefs",
      type: "array",
      defaultValue: [],
      readonly: true,
    });

  watch(
    () => props.content?.columns,
    (newCols) => {
      setColumnDefsVar(Array.isArray(newCols) ? newCols : []);
    },
    { immediate: true, deep: true }
  );

  // Helper function to get current column widths from the grid
  const getCurrentColumnWidths = () => {
    if (!gridApi.value) return {};

    const columns = gridApi.value.getAllGridColumns();
    const widths = {};

    columns?.forEach((col) => {
      if (isVirtualColumn(col)) return; // Skip virtual columns
      const colId = col.getColId();
      const actualWidth = col.getActualWidth();
      if (colId && actualWidth) {
        widths[colId] = actualWidth;
      }
    });

    return widths;
  };

  // Helper function to update the currentConfig exposed variable
  const updateCurrentConfig = () => {
    if (!gridApi.value) return;

    const columns = gridApi.value.getAllGridColumns()?.filter(col => !isVirtualColumn(col));
    // collapsed is intentionally omitted — it lives in a dedicated WeWeb variable
    // keyed by view id, not in viewConfiguration.
    const grouping = groupingState?.value
      ? {
          columnId: groupingState.value.columnId ?? null,
          order: Array.isArray(groupingState.value.order) ? [...groupingState.value.order] : [],
          showUnassigned: groupingState.value.showUnassigned !== false,
        }
      : { columnId: null, order: [], showUnassigned: true };
    const filterValue = getFilterValue();
    const sortValue = getSortValue();
    const advanced = getAdvancedFilters?.();
    const userRulesRef = getUserRules?.();
    const userConditionalRowStyles = Array.isArray(userRulesRef?.value)
      ? userRulesRef.value
      : [];
    const config = {
      sizes: getCurrentColumnWidths(),
      filters: filterValue?.value || {},
      advancedFilters: {
        combinator: advanced?.combinator === 'or' ? 'or' : 'and',
        conditions: Array.isArray(advanced?.conditions) ? advanced.conditions : [],
      },
      sorting: sortValue?.value || [],
      columnsOrder: columns?.map((col) => col.getColId()) || columnOrder.value || [],
      hiddenColumns: hiddenColumns.value || [],
      grouping,
      userConditionalRowStyles,
    };

    setCurrentConfig(config);
    updateViewEditedVariable(config);
  };

  // Deep-equal helper restricted to the view-state keys
  const isViewConfigEdited = (current, baseline) => {
    if (!baseline || typeof baseline !== 'object') return false;

    const keysToCheck = ['sizes', 'filters', 'advancedFilters', 'sorting', 'columnsOrder', 'hiddenColumns', 'grouping', 'userConditionalRowStyles'];

    for (const key of keysToCheck) {
      const baseVal = baseline[key];
      const curVal = current?.[key];

      // Advanced filters (Filter Builder): structured { combinator, conditions }.
      // Combinator is irrelevant when there are no conditions, so normalize it
      // away in that case to avoid false positives.
      if (key === 'advancedFilters') {
        const norm = (v) => {
          const conditions = Array.isArray(v?.conditions) ? v.conditions : [];
          return {
            combinator: conditions.length ? (v?.combinator === 'or' ? 'or' : 'and') : 'and',
            conditions,
          };
        };
        const b = norm(baseVal);
        const c = norm(curVal);
        if (b.combinator !== c.combinator) return true;
        if (JSON.stringify(b.conditions) !== JSON.stringify(c.conditions)) return true;
        continue;
      }

      // If baseline is absent/empty, any non-empty current value means edited
      if (isEmptyConfigValue(baseVal)) {
        if (!isEmptyConfigValue(curVal)) return true;
        continue;
      }

      // Special case: grouping is a structured object { columnId, order, showUnassigned }.
      // collapsed is excluded — it's tracked in a separate WeWeb variable, not viewConfiguration.
      if (key === 'grouping') {
        if (!curVal || typeof curVal !== 'object') return true;
        if ((baseVal.columnId ?? null) !== (curVal.columnId ?? null)) return true;
        const bOrder = Array.isArray(baseVal.order) ? baseVal.order : [];
        const cOrder = Array.isArray(curVal.order) ? curVal.order : [];
        if (bOrder.length !== cOrder.length) return true;
        for (let i = 0; i < bOrder.length; i++) if (bOrder[i] !== cOrder[i]) return true;
        // showUnassigned defaults to true when absent
        if ((baseVal.showUnassigned !== false) !== (curVal.showUnassigned !== false)) return true;
        continue;
      }

      if (Array.isArray(baseVal)) {
        if (!Array.isArray(curVal)) return true;
        // For columnsOrder: live grid may have extra columns added after the config was saved.
        // Only compare the relative order of columns present in the baseline.
        const effectiveCurVal = (key === 'columnsOrder')
          ? curVal.filter(id => baseVal.includes(id))
          : curVal;
        if (baseVal.length !== effectiveCurVal.length) return true;
        for (let i = 0; i < baseVal.length; i++) {
          const b = baseVal[i];
          const c = effectiveCurVal[i];
          if (typeof b === 'object' && b !== null) {
            // For sorting: compare colId + sort directly to avoid JSON key-order sensitivity
            const sortMatch = (key === 'sorting') && typeof c === 'object' && c !== null
              && b.colId === c.colId && b.sort === c.sort;
            if (!sortMatch && JSON.stringify(b) !== JSON.stringify(c)) return true;
          } else if (b !== c) {
            return true;
          }
        }
      } else if (typeof baseVal === 'object') {
        if (typeof curVal !== 'object' || curVal === null) return true;
        // Only compare keys present in the baseline — extra columns in the live grid are ignored
        const bKeys = Object.keys(baseVal);
        for (const k of bKeys) {
          const bv = baseVal[k];
          const cv = curVal[k];
          // For sizes (numeric widths) allow ±1px rounding tolerance
          const numericMatch = (key === 'sizes') && typeof bv === 'number' && typeof cv === 'number' && Math.abs(bv - cv) <= 1;
          if (!numericMatch && bv !== cv) return true;
        }
      } else {
        if (baseVal !== curVal) return true;
      }
    }

    return false;
  };

  // Suppression window for the edited variable. Any time the viewConfiguration
  // prop changes (e.g. navigating between pages/tables), the grid and the new
  // baseline can be briefly out of sync as AG Grid rebuilds columns/data and
  // emits late events. While this window is active, we refuse to flip the
  // edited variable to `true` — we only allow `false`. Extended on each
  // viewConfiguration change.
  const suppressEditedUntil = ref(0);

  // The edited variable is "armed" only after the view has fully loaded and
  // settled (see the gridReady watcher). Until then we NEVER report edited=true.
  // This is the root guard against a false positive on load: when the component
  // opens on the kanban/calendar view, this datagrid mounts only transiently
  // (viewType resolves a tick later) and unmounts before arming — so it can
  // never flash the edited icon. A genuinely-active grid arms shortly after load
  // and reports real user edits from then on.
  const editedArmed = ref(false);

  // Once this datagrid instance unmounts (e.g. the view switches to kanban/
  // calendar), it must stop touching the shared viewEdited variable so its
  // orphaned timers / late grid events can't write after the next view mounts.
  const disposed = ref(false);
  onBeforeUnmount(() => { disposed.value = true; });

  // Update external WeWeb variable when view-edited state changes
  const updateViewEditedVariable = (config) => {
    if (disposed.value) return;
    const variableId = cfg.value?.viewEditedVariableId;
    if (!variableId) return;

    // Skip during programmatic view config application — grid is mid-transition
    // The watcher resets the variable to false once the config is fully applied
    if (isApplyingViewConfig?.value) {
      console.log('[viewEdited][datagrid] updateViewEditedVariable SUPPRESSED — isApplyingViewConfig');
      debugLog(`[ViewEditedVariable] Skipping update — viewConfiguration is being applied`);
      return;
    }

    const baseline = cfg.value?.viewConfiguration;
    const edited = isViewConfigEdited(config, baseline);

    // Root guard: never report `true` before the view has loaded/settled. This
    // stops the transient-mount flash on kanban/calendar load (and any edited
    // flash during the grid's own initial settle). `false` still passes through
    // so the variable converges correctly.
    if (edited && !editedArmed.value) {
      console.log('[viewEdited][datagrid] updateViewEditedVariable SUPPRESSED — not armed (initial load)');
      return;
    }

    // During the suppression window after a viewConfiguration change, do not
    // let late grid events mark the view as edited. Allow `false` through so
    // state converges correctly once the grid settles.
    if (edited && Date.now() < suppressEditedUntil.value) {
      console.log('[viewEdited][datagrid] updateViewEditedVariable SUPPRESSED — within 2s window of viewConfig change');
      debugLog(`[ViewEditedVariable] Suppressed true → view just changed, ignoring late grid event`);
      return;
    }

    try {
      console.log('[viewEdited][datagrid] updateViewEditedVariable→' + edited, {
        variableId,
        config,
        baseline,
        callerStack: new Error().stack?.split('\n').slice(2, 6).join('\n'),
      });
      wwLib.wwVariable.updateValue(variableId, edited);
      debugLog(`[ViewEditedVariable] Set variable "${variableId}" →`, edited);
    } catch (e) {
      debugLog('[ViewEditedVariable] Could not update variable:', variableId, e);
    }
  };

  // Track last applied view configuration to detect changes
  const lastAppliedViewConfig = ref(null);

  // Flag to track when view configuration is being applied programmatically
  // This prevents filter/sort changed events from being triggered during view config changes
  const isApplyingViewConfig = ref(false);
  // Generation counter to handle concurrent applyViewConfiguration calls.
  // Only the last apply's cleanup timeout should clear the flag.
  let applyViewConfigGeneration = 0;

  // Helper function to apply view configuration to the grid
  const applyViewConfiguration = (viewConfig, isInitial = false) => {
    if (!gridApi.value) return;

    debugLog('[ViewConfiguration] Applying view configuration:', viewConfig, 'isInitial:', isInitial);

    // Set flag to indicate we're applying view config programmatically
    isApplyingViewConfig.value = true;
    // Increment generation so previous apply's cleanup timeout won't clear the flag
    const myGeneration = ++applyViewConfigGeneration;

    // Defer API calls to prevent error #252 during render cycle
    setTimeout(() => {
      if (!gridApi.value) {
        if (myGeneration === applyViewConfigGeneration) {
          isApplyingViewConfig.value = false;
        }
        return;
      }

      try {
        // 0. Apply grouping FIRST, before any AG Grid API calls below.
        // Rationale: when viewConfiguration is updated via a reset → repopulate
        // flow (two updates in close succession), the previous setTimeout may
        // have already triggered a layout swap (single ↔ per-group grids),
        // leaving `gridApi.value` pointing at a destroyed AG Grid handle. Calls
        // like setFilterModel on a destroyed api throw, the outer catch fires,
        // and any code after it never runs. By placing the grouping write
        // first, the grouped layout is reactivated even if the api calls
        // below fail; the per-group grids' onGridReady will then re-apply
        // filters/sort/widths from the live state refs.
        {
          const groupingPresent = viewConfig && 'grouping' in viewConfig;
          const g = groupingPresent ? viewConfig.grouping : null;
          const prevColumnId = groupingState.value?.columnId ?? null;
          if (!groupingPresent || isEmptyConfigValue(g) || !g || !g.columnId) {
            groupingState.value = { columnId: null, order: [], collapsed: [], showUnassigned: true };
            // Grouping deactivated — drop any per-group api refs so a later
            // re-activation starts fresh.
            if (prevColumnId !== null) {
              groupGridApis.value = new Map();
              groupSelections.value = new Map();
            }
            debugLog(
              groupingPresent
                ? '[ViewConfiguration] Disabled grouping (empty or no columnId)'
                : '[ViewConfiguration] Disabled grouping (key not present)'
            );
          } else if (isValidGroupColumn(g.columnId)) {
            groupingState.value = {
              columnId: g.columnId,
              order: Array.isArray(g.order) ? [...g.order] : [],
              collapsed: getStoredCollapsedForView(),
              showUnassigned: g.showUnassigned !== false,
            };
            // Only wipe the per-group api/selection caches when grouping
            // ACTIVATES or the column CHANGES. Wiping unconditionally on
            // every apply (including the initial gridReady-triggered apply
            // where grouping is already active) clears the freshly-registered
            // grid apis before each group grid's staggered datasource-assign
            // setTimeout fires its `stillMounted` check — leaving every
            // group grid without a datasource and rendering zero rows.
            if (prevColumnId !== g.columnId) {
              groupGridApis.value = new Map();
              groupSelections.value = new Map();
            }
            debugLog('[ViewConfiguration] Applied grouping:', groupingState.value);
          } else {
            console.warn(`[Datagrid] viewConfiguration.grouping.columnId="${g.columnId}" is invalid or not a select column — grouping ignored.`);
            groupingState.value = { columnId: null, order: [], collapsed: [], showUnassigned: true };
          }
        }

        // 0.5 Apply advanced filters (Filter Builder) if key present. Done before
        // the header filters below so the refetch they trigger already sees the
        // restored advanced (OR-mode) conditions. The builder's forward watcher is
        // suppressed while isApplyingViewConfig is true, so this won't double-apply.
        if (viewConfig && 'advancedFilters' in viewConfig) {
          const adv = viewConfig.advancedFilters;
          const setAdv = getSetAdvancedFilters?.();
          if (typeof setAdv === 'function') {
            if (isEmptyConfigValue(adv) || !adv) {
              setAdv({ combinator: 'and', conditions: [] });
            } else {
              setAdv({
                combinator: adv.combinator === 'or' ? 'or' : 'and',
                conditions: Array.isArray(adv.conditions) ? adv.conditions : [],
              });
            }
          }
          debugLog('[ViewConfiguration] Applied advanced filters:', adv);
        } else {
          debugLog('[ViewConfiguration] Skipped advanced filters (key not present, keeping current state)');
        }

        // 1. Apply filters if key is present (even if empty {} - which clears all filters)
        // Only skip if the key is completely absent from viewConfig
        if (viewConfig && 'filters' in viewConfig) {
          const filters = viewConfig.filters;
          const isEmpty = isEmptyConfigValue(filters);
          const modelToApply = isEmpty ? null : filters;
          // 1) Update the global filterValue WeWeb variable FIRST. This is
          //    the source of truth that newly-mounted per-group grids read
          //    in onGroupGridReady — if we only call setFilterModel on the
          //    (possibly stale) gridApi.value, a freshly-remounted group
          //    grid will re-apply the OLD filterValue and undo our change.
          const setFiltersFn = getSetFilters?.();
          if (typeof setFiltersFn === 'function') {
            setFiltersFn(modelToApply || {});
          }
          // 2) Apply to the primary api so single-grid mode stays in sync.
          try { gridApi.value?.setFilterModel?.(modelToApply); } catch (_) { /* noop */ }
          // 3) Apply to every mounted per-group api (grouped mode). The
          //    primary api is one of these in grouped mode, but applying to
          //    all of them keeps the column-header active-filter chip and
          //    the underlying filter state in sync across groups even when
          //    gridApi.value itself was destroyed by the grouping-toggle
          //    earlier in the same apply pass.
          try {
            groupGridApis?.value?.forEach((api) => {
              try { api?.setFilterModel?.(modelToApply); } catch (_) { /* noop */ }
            });
          } catch (_) { /* noop */ }
          debugLog('[ViewConfiguration] Applied filters:', filters, '(empty clears all filters)');
        } else {
          debugLog('[ViewConfiguration] Skipped filters (key not present, keeping current state)');
        }

        // 2. Apply sorting if key is present (even if empty [] - which clears all sorting)
        // Only skip if the key is completely absent from viewConfig
        if (viewConfig && 'sorting' in viewConfig) {
          const sorting = viewConfig.sorting;
          if (isEmptyConfigValue(sorting)) {
            // Clear all sorting
            gridApi.value.applyColumnState({
              defaultState: { sort: null },
            });
            debugLog('[ViewConfiguration] Cleared all sorting (empty array)');
          } else {
            gridApi.value.applyColumnState({
              state: sorting,
              defaultState: { sort: null },
            });
            debugLog('[ViewConfiguration] Applied sorting:', sorting);
          }
        } else {
          debugLog('[ViewConfiguration] Skipped sorting (key not present, keeping current state)');
        }

        // 3. Apply column order if key is present (even if empty [] - which resets to default order)
        // Only skip if the key is completely absent from viewConfig
        if (viewConfig && 'columnsOrder' in viewConfig) {
          const columnsOrder = viewConfig.columnsOrder;
          if (isEmptyConfigValue(columnsOrder) || !Array.isArray(columnsOrder)) {
            // Reset to default column order (from column definitions)
            const defaultOrder = gridApi.value.getAllGridColumns()?.filter(col => !isVirtualColumn(col)).map(col => col.getColId()) || [];
            setColumnOrder([...defaultOrder]);
            debugLog('[ViewConfiguration] Reset columns order to default:', defaultOrder);
          } else {
            gridApi.value.applyColumnState({
              state: columnsOrder.map((colId) => ({ colId })),
              applyOrder: true,
            });
            setColumnOrder([...columnsOrder]);
            debugLog('[ViewConfiguration] Applied columns order:', columnsOrder);
          }
        } else {
          debugLog('[ViewConfiguration] Skipped columns order (key not present, keeping current state)');
        }

        // 4. Apply column sizes if key is present (even if empty {} - which resets to default widths)
        // Only skip if the key is completely absent from viewConfig
        if (viewConfig && 'sizes' in viewConfig) {
          const sizes = viewConfig.sizes;
          const columns = gridApi.value.getAllGridColumns();

          if (isEmptyConfigValue(sizes)) {
            // Reset to default column widths from column configuration
            // Build column state with default widths (or null for flex columns)
            const columnState = [];
            const contentColumns = props.content?.columns || [];

            for (const col of columns) {
              const colId = col.getColId();
              // Find the column config to get default width
              const colConfig = contentColumns.find(c =>
                (c?.actionName || c?.field) === colId
              );

              if (colConfig) {
                // For flex columns, clear width to let flex take over
                // For fixed columns, use the configured width
                if (colConfig.widthAlgo === 'flex') {
                  columnState.push({ colId, width: null, flex: colConfig.flex ?? 1 });
                } else if (colConfig.width && colConfig.width !== 'auto') {
                  const defaultWidth = wwLib.wwUtils.getLengthUnit(colConfig.width)?.[0];
                  if (defaultWidth) {
                    columnState.push({ colId, width: defaultWidth, flex: null });
                  }
                }
              }
            }

            if (columnState.length > 0) {
              gridApi.value.applyColumnState({ state: columnState });
            }
            debugLog('[ViewConfiguration] Reset column sizes to default:', columnState);
          } else if (typeof sizes === 'object') {
            // Apply specific column widths
            const columnState = columns.map(col => {
              const colId = col.getColId();
              const width = sizes[colId];
              return width !== undefined ? { colId, width } : { colId };
            }).filter(state => state.width !== undefined);

            if (columnState.length > 0) {
              gridApi.value.applyColumnState({
                state: columnState,
              });
              debugLog('[ViewConfiguration] Applied column sizes:', sizes);
            }
          }
        } else {
          debugLog('[ViewConfiguration] Skipped column sizes (key not present, keeping current state)');
        }

        // 5. Apply hidden columns if key is present
        if (viewConfig && 'hiddenColumns' in viewConfig) {
          const hidden = viewConfig.hiddenColumns;
          if (isEmptyConfigValue(hidden)) {
            // Show all columns (clear hidden state), but keep virtual columns hidden
            setHiddenColumns([]);
            chooserHiddenState.value = [];
            const allCols = gridApi.value.getAllGridColumns();
            const colIds = allCols?.filter(c => !isVirtualColumn(c)).map(c => c.getColId()).filter(Boolean) || [];
            if (colIds.length > 0) {
              gridApi.value.setColumnsVisible(colIds, true);
            }
            debugLog('[ViewConfiguration] Cleared all hidden columns (empty array)');
          } else if (Array.isArray(hidden)) {
            setHiddenColumns([...hidden]);
            chooserHiddenState.value = [...hidden];
            const hiddenSet = new Set(hidden);
            const allCols = gridApi.value.getAllGridColumns();
            const toShow = [];
            const toHide = [];
            allCols?.forEach(col => {
              const cid = col.getColId();
              if (!cid) return;
              // Virtual columns (sort/filter-only) must always stay hidden
              if (isVirtualColumn(col)) {
                toHide.push(cid);
                return;
              }
              (hiddenSet.has(cid) ? toHide : toShow).push(cid);
            });
            if (toShow.length) gridApi.value.setColumnsVisible(toShow, true);
            if (toHide.length) gridApi.value.setColumnsVisible(toHide, false);
            debugLog('[ViewConfiguration] Applied hidden columns:', hidden);
          }
        } else {
          debugLog('[ViewConfiguration] Skipped hidden columns (key not present, keeping current state)');
        }

        // 6. User conditional row styles are tightly bound to the view. Unlike
        // filters/sort/sizes which preserve current state when the key is
        // absent, styles ALWAYS reset on a view change — absent, empty, or
        // non-array all mean "clear all rules." This prevents stale styles
        // from one view leaking into another when switching.
        {
          const incoming = viewConfig ? viewConfig.userConditionalRowStyles : undefined;
          const setUserRulesFn = typeof setUserRules === 'function' ? setUserRules : null;
          if (Array.isArray(incoming) && incoming.length > 0) {
            setUserRulesFn?.(incoming);
            debugLog('[ViewConfiguration] Applied user conditional row styles:', incoming);
          } else {
            setUserRulesFn?.([]);
            debugLog('[ViewConfiguration] Cleared user conditional row styles (absent/empty in new view)');
          }
        }

        // (Grouping was applied at the top of this try block, before any
        // AG Grid API calls — see step 0 above for rationale.)

        // 7. Clear row selections when view changes (not on initial load)
        if (!isInitial) {
          try { gridApi.value.deselectAll(); } catch (_) { /* noop */ }
          groupGridApis.value.forEach(api => { try { api.deselectAll(); } catch (_) { /* noop */ } });
          groupSelections.value = new Map();
          setSelectedRows([]);
          debugLog('[ViewConfiguration] Cleared row selections');
        }

        // Store the applied config
        lastAppliedViewConfig.value = JSON.stringify(viewConfig);

        // Reset flag after a short delay to allow AG Grid events to settle
        // AG Grid events are triggered asynchronously after API calls
        setTimeout(() => {
          // Only the latest applyViewConfiguration call should clear the flag.
          // If a newer call was made, let that one handle cleanup.
          if (myGeneration !== applyViewConfigGeneration) {
            debugLog('[ViewConfiguration] Skipping cleanup for superseded apply (generation', myGeneration, 'vs', applyViewConfigGeneration + ')');
            return;
          }
          // Update currentConfig while flag is still true so that
          // updateViewEditedVariable() is skipped — the grid may report
          // minor differences (e.g. pixel rounding) that don't represent
          // a real user edit.
          updateCurrentConfig();
          // Sync chooser order and hidden state so the column management menu is up to date
          if (gridApi.value) {
            const gridCols = gridApi.value.getAllGridColumns()?.filter(c => !isVirtualColumn(c));
            chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
            chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
          }
          // Re-enable events AFTER config sync so the edited variable isn't
          // falsely set to true by the post-application snapshot
          isApplyingViewConfig.value = false;
          debugLog('[ViewConfiguration] View config application complete, events re-enabled');
        }, 100);

      } catch (e) {
        debugLog('[ViewConfiguration] Error applying view configuration:', e);
        if (myGeneration === applyViewConfigGeneration) {
          isApplyingViewConfig.value = false;
        }
        // Retry after a short delay if it's an AG Grid timing issue
        if (e.message && e.message.includes('#252')) {
          setTimeout(() => {
            applyViewConfiguration(viewConfig, isInitial);
          }, 100);
        }
      }
    }, 0);
  };

  // Watch for grid ready to apply initial view configuration
  watch(
    () => gridReady.value,
    (ready) => {
      if (!ready || !gridApi.value) return;
      console.log('[viewEdited][datagrid] gridReady fired — initial apply pending');

      // Apply initial view configuration when grid is ready
      if (cfg.value?.viewConfiguration) {
        // Open a suppression window. The initial mount path triggers several
        // post-apply updateCurrentConfig calls (e.g. Datagrid.vue's
        // setTimeout(200) at line ~992 after grid-ready) that land AFTER
        // applyViewConfiguration's 100ms cleanup has cleared
        // isApplyingViewConfig. Without this window, those late calls compute
        // "edited" against a fresh AG-Grid snapshot that doesn't perfectly
        // match the baseline (flex widths, sort serialization, etc.) and
        // falsely flip the edited variable to true.
        suppressEditedUntil.value = Date.now() + 2000;

        applyViewConfiguration(cfg.value.viewConfiguration, true);

        const variableId = cfg.value?.viewEditedVariableId;
        if (variableId) {
          const safeReset = (reason) => {
            if (disposed.value) return;
            try {
              console.log('[viewEdited][datagrid] gridReady→FALSE (' + reason + ')', { variableId });
              wwLib.wwVariable.updateValue(variableId, false);
              debugLog(`[ViewEditedVariable] Set variable "${variableId}" → false (${reason})`);
            } catch (e) {
              debugLog('[ViewEditedVariable] Could not reset variable on init:', variableId, e);
            }
          };
          // Immediate reset, then mirror the viewConfiguration-changed path's
          // three-stage settle so any late grid events that fire during the
          // window are followed by a converging false.
          safeReset('initial config applied');
          setTimeout(() => safeReset('initial — late settle'), 300);
          setTimeout(() => safeReset('initial — final settle'), 1100);
        }
      }

      // Arm the edited variable once the initial load + suppression window has
      // fully settled. From here on, genuine user edits report true. We snapshot
      // currentConfig FIRST (so the public currentConfig reflects the settled
      // grid) and arm AFTER — any spurious diff in that snapshot (pixel
      // rounding, sort serialization quirks) is still blocked by !editedArmed
      // inside updateViewEditedVariable. Real edits after arming are picked up
      // by the normal event-driven updateCurrentConfig path.
      setTimeout(() => {
        if (disposed.value || !gridApi.value) return;
        updateCurrentConfig();
        editedArmed.value = true;
      }, 2100);
    },
    { immediate: true }
  );

  // Watch for viewConfiguration changes with optimized comparison
  watch(
    () => cfg.value?.viewConfiguration,
    (newConfig, oldConfig) => {
      if (!gridApi.value || !gridReady.value) return;

      // Use lightweight comparison instead of full JSON.stringify
      // Check if the config reference changed or key properties changed
      const isConfigChanged = newConfig !== oldConfig;
      let hasContentChanged = false;

      if (isConfigChanged && newConfig && oldConfig) {
        // Quick check of key properties instead of deep stringify
        const keys = ['filters', 'advancedFilters', 'sorting', 'columnsOrder', 'sizes', 'hiddenColumns', 'grouping', 'userConditionalRowStyles'];
        hasContentChanged = keys.some(key => {
          const newVal = newConfig[key];
          const oldVal = oldConfig[key];
          // advancedFilters: structural compare on { combinator, conditions }
          if (key === 'advancedFilters') {
            const a = newVal || {}; const b = oldVal || {};
            const aConds = Array.isArray(a.conditions) ? a.conditions : [];
            const bConds = Array.isArray(b.conditions) ? b.conditions : [];
            const aComb = aConds.length ? (a.combinator === 'or' ? 'or' : 'and') : 'and';
            const bComb = bConds.length ? (b.combinator === 'or' ? 'or' : 'and') : 'and';
            return aComb !== bComb || JSON.stringify(aConds) !== JSON.stringify(bConds);
          }
          // Simple reference and length comparison
          if (newVal !== oldVal) {
            // grouping needs a structural compare on { columnId, order, collapsed, showUnassigned }
            if (key === 'grouping') {
              const a = newVal || {}; const b = oldVal || {};
              if ((a.columnId ?? null) !== (b.columnId ?? null)) return true;
              const aOrder = Array.isArray(a.order) ? a.order : [];
              const bOrder = Array.isArray(b.order) ? b.order : [];
              if (aOrder.length !== bOrder.length || aOrder.some((v, i) => v !== bOrder[i])) return true;
              const aCol = Array.isArray(a.collapsed) ? a.collapsed : [];
              const bCol = Array.isArray(b.collapsed) ? b.collapsed : [];
              if (aCol.length !== bCol.length) return true;
              const bSet = new Set(bCol);
              if (aCol.some(v => !bSet.has(v))) return true;
              if ((a.showUnassigned !== false) !== (b.showUnassigned !== false)) return true;
              return false;
            }
            if (Array.isArray(newVal) && Array.isArray(oldVal)) {
              return newVal.length !== oldVal.length || newVal.some((item, idx) => item !== oldVal[idx]);
            }
            if (typeof newVal === 'object' && typeof oldVal === 'object') {
              const newKeys = newVal ? Object.keys(newVal) : [];
              const oldKeys = oldVal ? Object.keys(oldVal) : [];
              return newKeys.length !== oldKeys.length || newKeys.some(k => newVal[k] !== oldVal[k]);
            }
            return true;
          }
          return false;
        });
      } else if (isConfigChanged) {
        hasContentChanged = true;
      }

      // Always reset the edited variable whenever viewConfiguration changes,
      // regardless of whether the grid was re-synced — the new config is the new baseline.
      // We schedule the reset AFTER applyViewConfiguration has settled so that any
      // AG Grid events fired during/after the apply (which can arrive asynchronously,
      // e.g. due to pixel-rounding on sizes) cannot flip the variable back to true.
      const resetEditedVariable = (reason) => {
        if (disposed.value) return;
        const variableId = cfg.value?.viewEditedVariableId;
        if (!variableId) return;
        try {
          console.log('[viewEdited][datagrid] viewConfig-watcher→FALSE (' + reason + ')', { variableId });
          wwLib.wwVariable.updateValue(variableId, false);
          debugLog(`[ViewEditedVariable] Set variable "${variableId}" → false (${reason})`);
        } catch (e) {
          debugLog('[ViewEditedVariable] Could not reset variable:', variableId, e);
        }
      };

      // Open a suppression window so late grid events (from columns/data
      // rebuilding on page/table change) can't flip the edited variable to
      // true before the grid has settled on the new baseline.
      if (isConfigChanged) {
        suppressEditedUntil.value = Date.now() + 2000;
      }

      // Only apply grid changes if the configuration content actually changed
      if (hasContentChanged) {
        debugLog('[ViewConfiguration] Configuration changed, applying new view');
        applyViewConfiguration(newConfig, false);

        // Reset once apply settles. applyViewConfiguration clears its flag at ~100ms;
        // we reset just after that, and again a bit later to catch any late grid events.
        if (isConfigChanged) {
          setTimeout(() => resetEditedVariable('viewConfiguration changed'), 150);
          setTimeout(() => resetEditedVariable('viewConfiguration changed — late settle'), 400);
          setTimeout(() => resetEditedVariable('viewConfiguration changed — final settle'), 1000);
        }
      } else if (isConfigChanged) {
        // No grid apply needed — safe to reset immediately; no events will fire.
        resetEditedVariable('viewConfiguration changed');
      }
    }
    // Removed deep: true for better performance
  );

  // CRITICAL FIX: initialState should only be set once on mount, not reactive
  // If it's reactive, it will reset filters/sorting whenever props change
  // We use a ref to ensure it's set only once and never changes
  const initialState = ref(null);

  // Set initial state only once when component mounts
  // After the grid is ready and applies this state, we don't use it again
  // This prevents overriding user-applied filters and sorts
  if (!initialState.value) {
    const state = {
      partialColumnState: true,
    };
    // NOTE: Filters, sorts, and sizes are applied via watcher when viewConfiguration changes
    // We only set column order in initialState for AG Grid's initial render
    // At initialization, both "key absent" and "empty array []" use default column order
    // The distinction between absent vs empty matters for runtime changes (handled by applyViewConfiguration)
    const viewConfig = cfg.value?.viewConfiguration;
    const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
    const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;

    // Only set initial column order if explicitly provided with values
    if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
      state.columnOrder = {
        orderedColIds: viewColumnsOrder,
      };
    }
    initialState.value = state;

    // Seed groupingState from initial viewConfiguration so the component
    // mounts directly into multi-grid mode when grouping is pre-configured.
    // collapsed is hydrated from the dedicated WeWeb variable (keyed by view id).
    const initialGrouping = viewConfig && typeof viewConfig === 'object' ? viewConfig.grouping : null;
    if (initialGrouping && typeof initialGrouping === 'object' && initialGrouping.columnId) {
      groupingState.value = {
        columnId: initialGrouping.columnId,
        order: Array.isArray(initialGrouping.order) ? [...initialGrouping.order] : [],
        collapsed: getStoredCollapsedForView(),
        showUnassigned: initialGrouping.showUnassigned !== false,
      };
    }
  }

  return {
    currentConfig, setCurrentConfig,
    columnDefsVar, setColumnDefsVar,
    getCurrentColumnWidths,
    updateCurrentConfig,
    updateViewEditedVariable,
    suppressEditedUntil,
    lastAppliedViewConfig,
    isApplyingViewConfig,
    applyViewConfiguration,
    initialState,
  };
}
