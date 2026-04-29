// Selection composable: owns the `selectedRows` WeWeb component variable and
// the row-selection / row-drag event handlers for the single-grid mode.
//
// Group-mode selection handlers (onGroupRowSelected, onGroupSelectionChanged)
// live in useGrouping and call setSelectedRows from this composable.
//
// Inputs:
//   props    — component props (uses props.uid for the WeWeb variable)
//   ctx      — Vue setup context (used for ctx.emit)
//   gridApi  — shallowRef from useGridApi
export function useSelection(props, ctx, { gridApi }) {
  const { value: selectedRows, setValue: setSelectedRows } =
    wwLib.wwVariable.useComponentVariable({
      uid: props.uid,
      name: 'selectedRows',
      type: 'array',
      defaultValue: [],
      readonly: true,
    });

  const onRowSelected = (event) => {
    const name = event.node.isSelected() ? 'rowSelected' : 'rowDeselected';
    ctx.emit('trigger-event', {
      name,
      event: { row: event.data },
    });
  };

  const onRowDragged = (event) => {
    const rows = [];
    event.api.forEachNode((node) => {
      rows.push(node.data);
    });
    ctx.emit('trigger-event', {
      name: 'rowDragged',
      event: {
        row: event.node.data,
        id: event.node.id,
        targetIndex: event.overIndex,
        rows,
      },
    });
  };

  const onRowDragEnter = (event) => {
    ctx.emit('trigger-event', {
      name: 'rowDragStart',
      event: {
        row: event.node.data,
        id: event.node.id,
      },
    });
  };

  const onSelectionChanged = (event) => {
    if (!gridApi.value) return;
    const selected = gridApi.value.getSelectedRows() || [];
    setSelectedRows(selected);
  };

  return {
    selectedRows,
    setSelectedRows,
    onRowSelected,
    onRowDragged,
    onRowDragEnter,
    onSelectionChanged,
  };
}
