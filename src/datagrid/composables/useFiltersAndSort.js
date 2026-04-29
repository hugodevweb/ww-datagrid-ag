import { ref, nextTick, onBeforeUnmount } from 'vue';

// Filters & sort: owns the `filters` and `sort` WeWeb component variables and
// the `onFilterChanged` / `onSortChanged` event handlers (single-grid mode).
// The handlers debounce Supabase requests by 300ms when in paginated mode.
//
// Group-mode filter/sort handlers (onGroupFilterChanged, onGroupSortChanged)
// live in useGrouping and call back into onFilterChanged/onSortChanged.
//
// Inputs:
//   props, ctx
//   gridApi                  — shallowRef from useGridApi
//   debugLog                 — from useGridApi
//   isInfiniteScrollEnabled  — computed ref from useDataFetch
//   isApplyingViewConfig     — ref (still inline in setup() until useViewConfig in S3)
//   updateCurrentConfig      — function (still inline in setup() until useViewConfig in S3)
//   fetchSupabaseData        — function from useDataFetch
//   updateRecordsFromGrid    — function from useDataFetch
export function useFiltersAndSort(props, ctx, {
  gridApi,
  debugLog,
  isInfiniteScrollEnabled,
  isApplyingViewConfig,
  updateCurrentConfig,
  fetchSupabaseData,
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

  // Debounce timers for Supabase fetches
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

      // If using Supabase, debounce filter changes to avoid excessive API calls
      if (props.content?.dataSource === 'supabase') {
        if (filterDebounceTimer.value) {
          clearTimeout(filterDebounceTimer.value);
        }

        filterDebounceTimer.value = setTimeout(() => {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, AG Grid automatically handles filter changes.
            // It resets its cache and calls getRows with the new filterModel.
            // We do NOT need to manually set the datasource - that causes duplicate queries.
            nextTick(() => {
              setTimeout(() => {
                updateRecordsFromGrid();
              }, 200);
            });
          } else {
            // For pagination mode, fetch data
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }, 300);
      } else {
        // For non-Supabase, update records after filter change
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }
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

      // If using Supabase, refetch data with new sort
      if (props.content?.dataSource === 'supabase') {
        if (isInfiniteScrollEnabled.value) {
          // For infinite scrolling, AG Grid automatically handles sort changes.
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 200);
          });
        } else {
          // For pagination mode, fetch data
          const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
          const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
          const filterModel = gridApi.value.getFilterModel();
          const sortModel = state.sort?.sortModel || [];
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
        }
      } else {
        // For non-Supabase, update records after sort change
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }
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
