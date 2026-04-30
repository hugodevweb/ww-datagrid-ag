// Plain-JS AG Grid cell renderer — no Vue mount cycle, much cheaper to
// instantiate per row than the previous SFC. Implements the AG Grid
// CellRenderer interface: { init, getGui, refresh, destroy }.
//
// The previous SFC had `refresh() { return false }` which forced AG Grid to
// destroy + recreate the renderer on every value change. This version
// returns true and mutates the existing <img> in place.

class ImageCellRenderer {
  init(params) {
    this.params = params;
    this.eGui = document.createElement("div");
    this.eGui.className = "image-cell";
    // Inlined from the previous SFC's scoped CSS so we don't need the
    // Vue scope-id attribute injection that scoped styles rely on.
    this.eGui.style.height = "100%";
    this.eGui.style.display = "flex";
    this.eGui.style.alignItems = "center";

    this.eImg = document.createElement("img");
    this.eImg.style.objectFit = "contain";
    if (params.width) this.eImg.style.width = params.width;
    if (params.height) this.eImg.style.height = params.height;

    this._applyValue(params?.value);
    this.eGui.appendChild(this.eImg);
  }

  _applyValue(value) {
    if (value) {
      if (this.eImg.parentNode !== this.eGui) this.eGui.appendChild(this.eImg);
      if (this.eImg.getAttribute("src") !== String(value)) {
        this.eImg.src = value;
      }
    } else if (this.eImg.parentNode === this.eGui) {
      // No value — detach the <img> so the cell is empty (matches v-if behavior)
      this.eGui.removeChild(this.eImg);
    }
  }

  getGui() {
    return this.eGui;
  }

  refresh(params) {
    this.params = params;
    this._applyValue(params?.value);
    return true;
  }

  destroy() {
    this.eGui = null;
    this.eImg = null;
    this.params = null;
  }
}

export default ImageCellRenderer;
