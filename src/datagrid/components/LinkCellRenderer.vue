<template>
  <div
    class="link-cell"
    :style="accentVars"
    @mousedown="stop"
    @click="onCellClick"
    @contextmenu="stop"
  >
    <a
      v-if="href && text"
      class="link-cell__a"
      :href="href"
      :target="target"
      :rel="rel"
      :title="text"
      >{{ text }}</a
    >
    <span v-else-if="text" class="link-cell__text" :title="text">{{ text }}</span>
  </div>
</template>

<script>
export default {
  name: "LinkCellRenderer",
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      // ag-grid-vue3 does not update the params prop after refresh(). Cache the
      // latest params here so computeds pick up new cell values (mirrors the
      // EmailCellRenderer pattern).
      _refreshedParams: null,
    };
  },
  computed: {
    activeParams() {
      return this._refreshedParams || this.params;
    },
    rendererParams() {
      return this.activeParams?.colDef?.cellRendererParams || {};
    },
    // Link text = the column's own field value (like the email column shows the
    // email). Empty value → no link is rendered.
    text() {
      const value = this.activeParams?.value;
      if (value == null) return "";
      return String(value).trim();
    },
    // Resolved destination:
    //   1. Per-row full-URL override (linkUrlFormula) when it resolves to a
    //      non-empty string — this is the "overwrite the link" capability.
    //   2. Otherwise `/{basePath || updateTable}/{id}` where updateTable mirrors
    //      the grid's Supabase Update Table (falling back to Supabase Table) and
    //      id comes from the configured id field (falling back to the row node id).
    // Returns "" when no valid destination can be built → the cell falls back to
    // rendering plain (non-link) text.
    href() {
      const p = this.rendererParams;
      const data = this.activeParams?.data || {};

      const override =
        typeof p.resolveUrl === "function" ? (p.resolveUrl(data) || "").trim() : "";
      if (override) return override;

      const base = String(p.basePath || p.tableName || "").trim();
      if (!base) return "";

      const idField = p.idField || "id";
      const id = data?.[idField] ?? this.activeParams?.node?.id;
      if (id == null || id === "") return "";

      return this.buildPath(base, id);
    },
    target() {
      return this.rendererParams?.openInNewTab ? "_blank" : "_self";
    },
    rel() {
      return this.rendererParams?.openInNewTab ? "noopener noreferrer" : null;
    },
    accentColor() {
      return this.rendererParams?.accentColor || "";
    },
    accentVars() {
      return this.accentColor ? { "--link-accent": this.accentColor } : {};
    },
  },
  methods: {
    // AG Grid interface: keep the existing instance alive and refresh in place.
    refresh(params) {
      this._refreshedParams = params;
      return true;
    },

    // Compose `/{base}/{id}`. Absolute URLs (http/https) are left untouched;
    // internal paths get a single leading slash and no duplicated separators.
    buildPath(base, id) {
      let b = String(base).trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(b) && !b.startsWith("/")) b = "/" + b;
      return `${b}/${encodeURIComponent(id)}`;
    },

    stop(ev) {
      // Isolate the link from AG Grid row interaction (focus/selection/rowClicked)
      // without cancelling the anchor's own navigation.
      ev.stopPropagation();
    },

    onCellClick(ev) {
      // Stop the click from bubbling to the row (row-click / selection). The
      // native <a> still performs the navigation (same tab) or opens a new tab.
      ev.stopPropagation();
    },
  },
};
</script>

<style scoped lang="scss">
.link-cell {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  box-sizing: border-box;
  overflow: hidden;
}

.link-cell__a {
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--link-accent, currentColor);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;

  &:hover {
    filter: brightness(0.85);
  }
}

.link-cell__text {
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: currentColor;
}
</style>
