import { watch } from 'vue';

// Exposes the `records` and `isFetching` WeWeb component variables for the
// kanban and calendar views, mirroring the ones the datagrid owns in
// useDataFetch.js. All three views share the same component instance `uid`, and
// only one is mounted at a time (viewType switch in wwElement.vue), so there is
// no double-registration at runtime — whichever view is active keeps these
// variables in sync with its own data.
//
//   rows       — a ref/computed of the rows the view is working with (the full
//                dataset, already server-side filtered in supabase mode).
//   isFetching — a ref/computed of the view's loading state.
export function useRecordsVariable(props, { rows, isFetching }) {
  const { setValue: setRecords } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'records',
      type: 'array',
      defaultValue: [],
      readonly: true,
    });
  const { setValue: setIsFetching } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'isFetching',
      type: 'boolean',
      defaultValue: false,
      readonly: true,
    });
  // Mirror the datagrid's `table` variable (see useDataFetch.js) so the name of
  // the queried table stays exposed when the kanban/calendar view is active.
  // Empty in local ('mapping') mode where there is no backing table.
  const { setValue: setTable } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'table',
      type: 'string',
      defaultValue: '',
      readonly: true,
    });

  watch(
    rows,
    (val) => setRecords(Array.isArray(val) ? [...val] : []),
    { immediate: true, deep: true }
  );
  watch(
    () =>
      props.content?.dataSource === 'supabase'
        ? props.content?.supabaseTable || ''
        : '',
    (val) => setTable(val || ''),
    { immediate: true }
  );
  watch(
    isFetching,
    (val) => setIsFetching(!!val),
    { immediate: true }
  );

  return { setRecords, setIsFetching };
}
