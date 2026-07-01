import { ref, computed, watch, onBeforeUnmount } from 'vue';

// Column chooser: owns the chooser-panel UI state, the click-outside handler
// + its bidirectional external-variable sync, the column-list computeds
// (allColumnsList / filteredColumnsList / allColumnsVisible /
// visibleColumnCount / someColumnsHidden), and the chooser methods
// (open / hide / show / toggle visibility / toggle all / drag-reorder).
//
// Behavior preserved from the original Options-API + setup() implementation:
//  - Opening the chooser snapshots current column order + hidden state.
//  - The handler attaches asynchronously so the click that opened the panel
//    doesn't immediately close it.
//  - Bidirectional `cfg.columnChooserVariableId` sync: external WeWeb variable
//    drives `showColumnChooser` and vice versa.
export function useColumnChooser(cfg, props, ctx, {
  gridApi, debugLog,
  hiddenColumns, setHiddenColumns,
  isVirtualColumn,
  // Late-bound deps (useViewConfig is created BEFORE useColumnChooser, but
  // we use a thunk for symmetry with other composables and to keep the
  // contract resilient to future ordering changes).
  getUpdateCurrentConfig,
}) {
  // Chooser UI state
  const showColumnChooser = ref(false);
  const columnChooserRef = ref(null);
  const columnChooserSearch = ref('');
  const chooserColumnOrder = ref([]); // local ordered list of colIds for the panel
  const chooserHiddenState = ref([]); // local reactive hidden-columns list for the chooser UI
  const chooserDragColId = ref(null);
  const chooserDragOverColId = ref(null);
  // Chooser panel active tab — 'columns' (default, existing UI) or 'grouping' (new UI).
  const activeChooserTab = ref('columns');

  // Click-outside handler: closes the panel when clicking anywhere outside.
  const handleClickOutside = (event) => {
    if (columnChooserRef.value && !columnChooserRef.value.contains(event.target)) {
      showColumnChooser.value = false;
    }
  };

  let clickOutsideTimer = null;
  watch(showColumnChooser, (val) => {
    if (val) {
      // Initialize chooser order and hidden state from current grid state
      if (gridApi.value) {
        const gridCols = gridApi.value.getAllGridColumns()?.filter(c => !isVirtualColumn(c));
        chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
        chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
      }
      columnChooserSearch.value = '';
      // Delay so the current click that opened the panel doesn't immediately close it.
      // Timer is tracked so it can be cancelled if the panel closes before it fires.
      clickOutsideTimer = setTimeout(() => {
        clickOutsideTimer = null;
        wwLib.getFrontDocument().addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      // Cancel pending attach if panel closed before timer fired
      if (clickOutsideTimer !== null) {
        clearTimeout(clickOutsideTimer);
        clickOutsideTimer = null;
      }
      wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
      chooserDragColId.value = null;
      chooserDragOverColId.value = null;
    }

    // Sync external variable with column chooser state
    const ccVarId = cfg.value?.columnChooserVariableId;
    if (ccVarId) {
      try {
        wwLib.wwVariable.updateValue(ccVarId, val);
        debugLog(`[ColumnChooserVariable] Set variable "${ccVarId}" →`, val);
      } catch (e) {
        debugLog('[ColumnChooserVariable] Could not update variable:', ccVarId, e);
      }
    }
  });

  // Watch external variable to control column chooser visibility
  watch(
    () => {
      const varId = cfg.value?.columnChooserVariableId;
      if (!varId) return undefined;
      try {
        return wwLib.wwVariable.getValue(varId);
      } catch (e) {
        return undefined;
      }
    },
    (newVal) => {
      if (newVal === undefined) return;
      const boolVal = !!newVal;
      if (showColumnChooser.value !== boolVal) {
        showColumnChooser.value = boolVal;
        debugLog(`[ColumnChooserVariable] External variable changed → showColumnChooser =`, boolVal);
      }
    }
  );

  onBeforeUnmount(() => {
    if (clickOutsideTimer !== null) clearTimeout(clickOutsideTimer);
    wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
  });

  // Column list computeds
  const allColumnsList = computed(() => {
    // Build a map of colId → column meta from content.columns (exclude design-time hidden)
    const colMap = new Map();
    for (const col of (cfg.value.columns || [])) {
      if (!col || (!col.field && !col.actionName) || col.hide) continue;
      const colId = col.actionName || col.field;
      colMap.set(colId, {
        colId,
        headerName: col.headerName || colId,
        isHidden: (chooserHiddenState.value || []).includes(colId),
        isLocked: !!col.lockedInChooser,
      });
    }

    // Sort by chooserColumnOrder (reflects live grid order), append any extras
    const ordered = [];
    const seen = new Set();
    for (const colId of (chooserColumnOrder.value || [])) {
      if (colMap.has(colId)) {
        ordered.push(colMap.get(colId));
        seen.add(colId);
      }
    }
    // Append columns not yet in the ordered list
    for (const [colId, meta] of colMap) {
      if (!seen.has(colId)) ordered.push(meta);
    }

    // Move locked columns to the top, preserving their relative order
    const locked = ordered.filter(c => c.isLocked);
    const unlocked = ordered.filter(c => !c.isLocked);
    return [...locked, ...unlocked];
  });

  const filteredColumnsList = computed(() => {
    const q = (columnChooserSearch.value || '').toLowerCase().trim();
    if (!q) return allColumnsList.value;
    return allColumnsList.value.filter(c => c.headerName.toLowerCase().includes(q));
  });

  const allColumnsVisible = computed(() => {
    return !chooserHiddenState.value || chooserHiddenState.value.length === 0;
  });

  // Cheap count of runtime-toggleable columns (design-time hidden are excluded).
  // Used by someColumnsHidden to avoid pulling in the heavier allColumnsList computation.
  const visibleColumnCount = computed(() => {
    return (cfg.value.columns || []).filter(
      col => col && (col.field || col.actionName) && !col.hide
    ).length;
  });

  const someColumnsHidden = computed(() => {
    return !!(
      chooserHiddenState.value &&
      chooserHiddenState.value.length > 0 &&
      chooserHiddenState.value.length < visibleColumnCount.value
    );
  });

  // Methods
  const openColumnChooser = () => {
    showColumnChooser.value = true;
  };

  const hideColumn = (colId) => {
    if (!colId) return;
    const current = [...(hiddenColumns.value || [])];
    if (!current.includes(colId)) {
      current.push(colId);
      setHiddenColumns(current);
      chooserHiddenState.value = current;
      gridApi.value?.setColumnsVisible([colId], false);
      const updateCurrentConfig = getUpdateCurrentConfig?.();
      if (updateCurrentConfig) updateCurrentConfig();
      ctx.emit('trigger-event', {
        name: 'columnVisibilityChanged',
        event: {
          columnId: colId,
          visible: false,
          hiddenColumns: current,
        },
      });
    }
  };

  const showColumn = (colId) => {
    if (!colId) return;
    if (!(hiddenColumns.value || []).includes(colId)) return; // already visible, no-op
    const current = (hiddenColumns.value || []).filter(id => id !== colId);
    setHiddenColumns(current);
    chooserHiddenState.value = current;
    gridApi.value?.setColumnsVisible([colId], true);
    const updateCurrentConfig = getUpdateCurrentConfig?.();
    if (updateCurrentConfig) updateCurrentConfig();
    ctx.emit('trigger-event', {
      name: 'columnVisibilityChanged',
      event: {
        columnId: colId,
        visible: true,
        hiddenColumns: current,
      },
    });
  };

  const toggleColumnVisibility = (colId) => {
    const col = allColumnsList.value.find(c => c.colId === colId);
    if (col?.isLocked) return;
    if ((hiddenColumns.value || []).includes(colId)) {
      showColumn(colId);
    } else {
      hideColumn(colId);
    }
  };

  const toggleAllColumns = () => {
    const colIds = allColumnsList.value.filter(c => !c.isLocked).map(c => c.colId);
    // Capture the intended outcome before any mutation
    const willBeVisible = !allColumnsVisible.value;
    if (!willBeVisible) {
      // Hide all columns
      setHiddenColumns([...colIds]);
      if (gridApi.value) gridApi.value.setColumnsVisible(colIds, false);
    } else {
      // Show all columns
      setHiddenColumns([]);
      if (gridApi.value) gridApi.value.setColumnsVisible(colIds, true);
    }
    const newHiddenColumns = willBeVisible ? [] : [...colIds];
    chooserHiddenState.value = newHiddenColumns;
    const updateCurrentConfig = getUpdateCurrentConfig?.();
    if (updateCurrentConfig) updateCurrentConfig();
    ctx.emit('trigger-event', {
      name: 'columnVisibilityChanged',
      event: {
        columnId: null,
        visible: willBeVisible,
        hiddenColumns: newHiddenColumns,
      },
    });
  };

  const onChooserDragStart = (colId) => {
    const col = allColumnsList.value.find(c => c.colId === colId);
    if (col?.isLocked) return;
    chooserDragColId.value = colId;
  };

  const onChooserDragOver = (colId) => {
    if (chooserDragColId.value && colId !== chooserDragColId.value) {
      chooserDragOverColId.value = colId;
    }
  };

  const onChooserDrop = (_targetColId) => {
    // Column order is LOCKED to the hard-coded config order — the chooser can
    // toggle visibility but can never reorder columns. Just clear the drag state
    // without applying any reorder.
    chooserDragColId.value = null;
    chooserDragOverColId.value = null;
  };

  const onChooserDragEnd = () => {
    chooserDragColId.value = null;
    chooserDragOverColId.value = null;
  };

  return {
    // State
    showColumnChooser,
    columnChooserRef,
    columnChooserSearch,
    chooserColumnOrder,
    chooserHiddenState,
    chooserDragColId,
    chooserDragOverColId,
    activeChooserTab,
    // Computeds
    allColumnsList,
    filteredColumnsList,
    allColumnsVisible,
    visibleColumnCount,
    someColumnsHidden,
    // Methods
    openColumnChooser,
    hideColumn,
    showColumn,
    toggleColumnVisibility,
    toggleAllColumns,
    onChooserDragStart,
    onChooserDragOver,
    onChooserDrop,
    onChooserDragEnd,
  };
}
