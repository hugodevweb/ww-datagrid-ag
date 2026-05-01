import { ref, nextTick, onBeforeUnmount } from 'vue';

// Filters & sort: owns the `filters` and `sort` WeWeb component variables and
// the `onFilterChanged` / `onSortChanged` event handlers (single-grid mode).
//
// All filtering/sorting now runs client-side on the in-memory dataset (the
// grid uses AG Grid's client-side row model and the full table is loaded
// up-front by useDataFetch). These handlers no longer trigger Supabase
// re-fetches — they just keep the WeWeb `filters` / `sort` variables and the
// `records` variable in sync with the displayed rows.
//
// Group-mode filter/sort handlers (onGroupFilterChanged, onGroupSortChanged)
// live in useGrouping and call back into onFilterChanged/onSortChanged.
//
// Inputs:
//   props, ctx
//   gridApi                  — shallowRef from useGridApi
//   debugLog                 — from useGridApi
//   isApplyingViewConfig     — ref (still inline in setup() until useViewConfig in S3)
//   updateCurrentConfig      — function (still inline in setup() until useViewConfig in S3)
//   updateRecordsFromGrid    — function from useDataFetch
export function useFiltersAndSort(props, ctx, {
  gridApi,
  debugLog,
  isApplyingViewConfig,
  updateCurrentConfig,
  updateRecordsFromGrid,
}) {
  // WeWeb component variables
  const { value: filterValue, setValue: setFilters } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'filters',
      type: 'object',
      defaultValue: {},
      readonly: true,
    });
  const { value: sortValue, setValue: setSort } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'sort',
      type: 'object',
      defaultValue: {},
      readonly: true,
    });

  // Kept for backward compatibility with consumers that referenced these refs;
  // no longer wired to debounced server fetches.
  const filterDebounceTimer = ref(null);
  const searchDebounceTimer = ref(null);

  const onFilterChanged = (event) => {
    if (!gridApi.value) return;

    const filterModel = gridApi.value.getFilterModel();
    if (
      JSON.stringify(filterModel || {}) !==
      JSON.stringify(filterValue.value || {})
    ) {
      setFilters(filterModel);

      // Update currentConfig to reflect the new filter state
      updateCurrentConfig();

      // Only emit event if this is a user-initiated change (not from view configuration)
      if (!isApplyingViewConfig.value) {
        ctx.emit('trigger-event', {
          name: 'filterChanged',
          event: filterModel,
        });
      } else {
        debugLog('[FilterChanged] Skipping event emission - change is from view configuration');
      }

      // Client-side filtering — AG Grid already applied the filter to the
      // in-memory model. Just sync the WeWeb `records` variable to the
      // currently-displayed rows.
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
        }, 100);
      });
    }
  };

  const onSortChanged = (event) => {
    if (!gridApi.value) return;

    const state = gridApi.value.getState();
    if (
      JSON.stringify(state.sort?.sortModel || []) !==
      JSON.stringify(sortValue.value || [])
    ) {
      setSort(state.sort?.sortModel || []);

      // Update currentConfig to reflect the new sort state
      updateCurrentConfig();

      // Only emit event if this is a user-initiated change (not from view configuration)
      if (!isApplyingViewConfig.value) {
        ctx.emit('trigger-event', {
          name: 'sortChanged',
          event: state.sort?.sortModel || [],
        });
      } else {
        debugLog('[SortChanged] Skipping event emission - change is from view configuration');
      }

      // Client-side sort — same story as filters above.
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
        }, 100);
      });
    }
  };

  onBeforeUnmount(() => {
    if (filterDebounceTimer.value) clearTimeout(filterDebounceTimer.value);
    if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value);
  });

  return {
    filterValue,
    setFilters,
    sortValue,
    setSort,
    filterDebounceTimer,
    searchDebounceTimer,
    onFilterChanged,
    onSortChanged,
  };
}
