// Plain-JS AG Grid "inner header" component.
// Registered via colDef.headerComponentParams.innerHeaderComponent, it replaces
// ONLY the header label content while leaving AG Grid's default header chrome
// (sort indicator, filter button, menu, resize handle) untouched.
//
// It prepends a small column-type icon (Lucide SVG, passed in via params.icon)
// before the column display name. The icon inherits the header text color via
// currentColor and is sized through the .cc-col-type-icon CSS class defined in
// Datagrid.vue.

class ColumnTypeHeader {
  init(params) {
    this.params = params;

    this.eGui = document.createElement("span");
    this.eGui.className = "cc-header-inner";

    const icon = params?.icon;
    if (icon) {
      this.eIcon = document.createElement("span");
      this.eIcon.className = "cc-col-type-icon";
      this.eIcon.innerHTML = icon;
      this.eGui.appendChild(this.eIcon);
    }

    this.eText = document.createElement("span");
    this.eText.className = "cc-col-type-name";
    this.eText.textContent = params?.displayName ?? "";
    this.eGui.appendChild(this.eText);
  }

  getGui() {
    return this.eGui;
  }

  refresh(params) {
    this.params = params;
    if (this.eText && params?.displayName != null) {
      const name = String(params.displayName);
      if (this.eText.textContent !== name) this.eText.textContent = name;
    }
    return true;
  }

  destroy() {
    this.eGui = null;
    this.eIcon = null;
    this.eText = null;
    this.params = null;
  }
}

export default ColumnTypeHeader;
