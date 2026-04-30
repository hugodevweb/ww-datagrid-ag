// Plain-JS AG Grid cell renderer for action-button cells.
// CSS variables cascade from the .ww-datagrid root, so we set them via
// inline `style` declarations (resolved by the browser at paint time).
// This avoids relying on Vue scoped-style attributes.

class ActionCellRenderer {
  init(params) {
    this.params = params;

    this.eGui = document.createElement("div");
    this.eGui.className = "btn-container";
    this.eGui.style.cssText =
      "display:flex;justify-content:center;align-items:center;height:100%;";

    this.eBtn = document.createElement("button");
    this.eBtn.type = "button";
    this.eBtn.textContent = params?.label ?? "";
    this.eBtn.className =
      "datagrid-btn " + (params?.withFont ? "with-font" : "without-font");

    const fontStyle = params?.withFont
      ? "font:var(--ww-data-grid_action-font);"
      : (
          "font-size:var(--ww-data-grid_action-fontSize);" +
          "font-family:var(--ww-data-grid_action-fontFamily);" +
          "font-weight:var(--ww-data-grid_action-fontWeight);" +
          "font-style:var(--ww-data-grid_action-fontStyle);" +
          "line-height:var(--ww-data-grid_action-lineHeight,normal);"
        );

    this.eBtn.style.cssText =
      "background-color:var(--ww-data-grid_action-backgroundColor,unset);" +
      "color:var(--ww-data-grid_action-color,unset);" +
      "padding:var(--ww-data-grid_action-padding,unset);" +
      "border:var(--ww-data-grid_action-border,unset);" +
      "border-radius:var(--ww-data-grid_action-borderRadius);" +
      "cursor:pointer;" +
      fontStyle;

    this._onClick = (event) => {
      event.stopPropagation();
      const p = this.params;
      if (!p || typeof p.trigger !== "function") return;
      p.trigger({
        actionName: p.name,
        id: p.node?.id,
        index: p.node?.sourceRowIndex,
        displayIndex: p.node?.rowIndex,
        row: p.data,
      });
    };
    this.eBtn.addEventListener("click", this._onClick);

    this.eGui.appendChild(this.eBtn);
  }

  getGui() {
    return this.eGui;
  }

  refresh(params) {
    this.params = params;
    if (this.eBtn && params?.label != null) {
      const label = String(params.label);
      if (this.eBtn.textContent !== label) this.eBtn.textContent = label;
    }
    return true;
  }

  destroy() {
    if (this.eBtn && this._onClick) {
      this.eBtn.removeEventListener("click", this._onClick);
    }
    this.eGui = null;
    this.eBtn = null;
    this._onClick = null;
    this.params = null;
  }
}

export default ActionCellRenderer;
