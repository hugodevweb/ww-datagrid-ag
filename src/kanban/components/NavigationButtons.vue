<template>
  <div ref="rootRef" class="ww-nav-buttons" @dragstart.stop.prevent draggable="false"></div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import NavigationCellRenderer from "../../datagrid/components/NavigationCellRenderer.js";

export default {
  name: "NavigationButtons",
  props: {
    rowId: { type: [String, Number], default: null },
    focusRowId: { type: [String, Number], default: null },
    focusVariableId: { type: String, default: "" },
    tabValue: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    workflowId: { type: String, default: "" },
  },
  setup(props) {
    const rootRef = ref(null);
    let renderer = null;

    const buildParams = () => ({
      rowId: props.rowId,
      focusRowId: props.focusRowId,
      focusVariableId: props.focusVariableId,
      tabValue: props.tabValue,
      messageCount: props.messageCount,
      workflowId: props.workflowId,
    });

    onMounted(() => {
      console.log("[Navigation] NavigationButtons mounted", buildParams());
      renderer = new NavigationCellRenderer();
      renderer.init(buildParams());
      const gui = renderer.getGui();
      if (gui && rootRef.value) rootRef.value.appendChild(gui);
    });

    watch(
      () => [props.rowId, props.focusRowId, props.focusVariableId, props.tabValue, props.messageCount, props.workflowId],
      () => {
        if (renderer) renderer.refresh(buildParams());
      }
    );

    onBeforeUnmount(() => {
      if (renderer) {
        renderer.destroy();
        renderer = null;
      }
    });

    return { rootRef };
  },
};
</script>

<style scoped>
.ww-nav-buttons {
  display: inline-flex;
  align-items: center;
}
</style>
