// Plain-JS AG Grid cell renderer for the "navigation" column type.
// Renders two icon buttons (detail + chat) per row. We avoid mounting Vue or
// wwElement to keep scrolling cheap — the wider context for this design is in
// the plan file and in ActionCellRenderer.js, which uses the same lifecycle.
//
// Reactivity model:
//   - cellRendererParams in createNavigationColumnDef is a function, so AG Grid
//     calls it on every refreshCells() and we get fresh focusRowId / tabValue
//     here on each refresh.
//   - Datagrid.vue watches the resolved focusRowId and calls refreshCells on
//     navigation columns when it changes — so this renderer doesn't need its
//     own subscription to the workspace variable.

import { ARROW_SQUARE_IN_SVG, CHATS_CIRCLE_SVG } from "../utils/navigationIcons.js";

const STYLE_ID = "ww-datagrid-navigation-styles";

const STYLE_CONTENT = `
    /* AG Grid's scroll viewports must keep overflow:hidden for virtualization,
       so the badge cannot escape the row's vertical bounds. Instead we shrink
       the button (31x28 in a 40px row) so there are ~6px of natural padding
       above and below it inside the cell — the badge overhangs into that
       padding while staying entirely within the row, so AG Grid never clips
       it. We still need overflow:visible on .ag-cell and its direct wrappers
       so the overhang isn't clipped at the cell boundary. */
    .ag-cell.ww-nav-cell,
    .ag-cell.ww-nav-cell > * {
      overflow: visible !important;
    }

    .ww-nav-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      box-sizing: border-box;
    }
    .ww-nav-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 31px;
      height: 33px;
      padding: 0;
      border-radius: 8px;
      border: 1px solid var(--ww-data-grid_navigation-borderColor, #e5e7eb);
      background: var(--ww-data-grid_navigation-bg, transparent);
      color: var(--ww-data-grid_navigation-iconColor, currentColor);
      cursor: pointer;
      line-height: 0;
      transition: background-color 120ms ease, transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }
    .ww-nav-btn:hover {
      background: var(--ww-data-grid_navigation-focusBg, rgba(0,0,0,0.08));
      border-color: var(--ww-data-grid_navigation-focusBorderColor, var(--ww-data-grid_navigation-borderColor, #e5e7eb));
    }
    /* Tab-specific highlight: only the active tab's button on the focused
       row gets styling. The other button stays in its default state. */
    .ww-nav-btn.is-focused {
      background: var(--ww-data-grid_navigation-focusBg, rgba(0,0,0,0.08));
      border-color: var(--ww-data-grid_navigation-focusBorderColor, var(--ww-data-grid_navigation-borderColor, #e5e7eb));
    }
    .ww-nav-btn--chat-active {
      background: var(--ww-data-grid_navigation-chatActiveBg, rgba(59,130,246,0.12));
    }
    .ww-nav-btn svg { display: block; width: 16px; height: 16px; }
    .ww-nav-badge {
      position: absolute;
      top: -3px;
      right: -4px;
      z-index: 5;
      min-width: 14px;
      height: 14px;
      border-radius: 8px;
      background: var(--ww-data-grid_navigation-badgeBg, #ef4444);
      color: var(--ww-data-grid_navigation-badgeColor, #ffffff);
      font: 600 10px/14px sans-serif;
      font-weight: 600;
      text-align: center;
      box-sizing: border-box;
      display: none;
      pointer-events: none;
      transform: scale(0.6);
      opacity: 0;
      transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 120ms ease;
    }
    .ww-nav-badge.is-visible {
      display: inline-block;
      transform: scale(1);
      opacity: 1;
    }
  `;

function ensureStylesInjected() {
  const doc = (typeof wwLib !== "undefined" && wwLib.getFrontDocument)
    ? wwLib.getFrontDocument()
    : document;
  if (!doc) return;
  const existing = doc.getElementById(STYLE_ID);
  // Refresh stale content (e.g. after HMR or when this module updates),
  // otherwise an old <style> from a previous load can mask the new rules.
  if (existing) {
    if (existing.textContent !== STYLE_CONTENT) {
      existing.textContent = STYLE_CONTENT;
    }
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_CONTENT;
  doc.head.appendChild(style);
}

class NavigationCellRenderer {
  init(params) {
    ensureStylesInjected();
    this.params = params;

    this.eGui = document.createElement("div");
    this.eGui.className = "ww-nav-cell";
    this.eGui.style.gap = "6px";

    // Suppress row interaction: nav buttons trigger workflows directly, so
    // clicks anywhere in this cell (including the gap around the buttons or
    // contextmenus) must not bubble up as row-click / row-selection events.
    // Mousedown matters for AG Grid's row focus path; click/contextmenu cover
    // the rowClicked trigger and the native context menu.
    this._stopBubble = (ev) => ev.stopPropagation();
    this.eGui.addEventListener("mousedown", this._stopBubble);
    this.eGui.addEventListener("click", this._stopBubble);
    this.eGui.addEventListener("contextmenu", this._stopBubble);

    this.eDetail = document.createElement("button");
    this.eDetail.type = "button";
    this.eDetail.className = "ww-nav-btn ww-nav-btn--detail";
    this.eDetail.setAttribute("aria-label", "Open details");
    this.eDetail.innerHTML = ARROW_SQUARE_IN_SVG;

    this.eChat = document.createElement("button");
    this.eChat.type = "button";
    this.eChat.className = "ww-nav-btn ww-nav-btn--chat";
    this.eChat.setAttribute("aria-label", "Open chat");
    this.eChat.innerHTML = CHATS_CIRCLE_SVG;

    this.eBadge = document.createElement("span");
    this.eBadge.className = "ww-nav-badge";
    this.eChat.appendChild(this.eBadge);

    this._onDetailClick = (ev) => this._fire("detail", false, ev);
    this._onDetailContext = (ev) => this._fire("detail", true, ev);
    this._onChatClick = (ev) => this._fire("chat", false, ev);
    this._onChatContext = (ev) => this._fire("chat", true, ev);

    this.eDetail.addEventListener("click", this._onDetailClick);
    this.eDetail.addEventListener("contextmenu", this._onDetailContext);
    this.eChat.addEventListener("click", this._onChatClick);
    this.eChat.addEventListener("contextmenu", this._onChatContext);

    this.eGui.appendChild(this.eDetail);
    this.eGui.appendChild(this.eChat);

    this._applyState();
  }

  getGui() {
    return this.eGui;
  }

  refresh(params) {
    this.params = params;
    this._applyState();
    return true;
  }

  destroy() {
    if (this.eGui && this._stopBubble) {
      this.eGui.removeEventListener("mousedown", this._stopBubble);
      this.eGui.removeEventListener("click", this._stopBubble);
      this.eGui.removeEventListener("contextmenu", this._stopBubble);
    }
    if (this.eDetail) {
      this.eDetail.removeEventListener("click", this._onDetailClick);
      this.eDetail.removeEventListener("contextmenu", this._onDetailContext);
    }
    if (this.eChat) {
      this.eChat.removeEventListener("click", this._onChatClick);
      this.eChat.removeEventListener("contextmenu", this._onChatContext);
    }
    this.eGui = null;
    this.eDetail = null;
    this.eChat = null;
    this.eBadge = null;
    this._stopBubble = null;
    this._onDetailClick = null;
    this._onDetailContext = null;
    this._onChatClick = null;
    this._onChatContext = null;
    this.params = null;
  }

  _fire(button, openNewTab, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const p = this.params;
    if (!p) {
      console.warn("[Navigation] click but params missing");
      return;
    }
    const rowId = p.rowId;
    const tab = button === "chat" ? "chat" : p.tabValue;
    const workflowId = p.workflowId;
    const focusVariableId = p.focusVariableId;
    console.log("[Navigation] click", { button, openNewTab, rowId, tab, workflowId, focusVariableId });

    // Update the focus-row workspace variable directly so the active tab's
    // is-focused styling applies immediately, without depending on the
    // global workflow to do the variable update.
    if (focusVariableId) {
      try {
        wwLib.wwVariable.updateValue(focusVariableId, rowId);
        console.log("[Navigation] focus variable set →", focusVariableId, "=", rowId);
      } catch (e) {
        console.warn("[Navigation] focus variable update failed:", e?.message);
      }
    }

    if (!workflowId) {
      console.warn("[Navigation] no workflowId configured — workflow NOT executed");
      return;
    }
    try {
      wwLib.wwWorkflow.executeGlobal(workflowId, {
        tab,
        id: rowId,
        openNewTab,
      });
      console.log("[Navigation] executeGlobal dispatched");
    } catch (e) {
      console.warn("[Navigation] executeGlobal failed:", e?.message);
    }
  }

  _applyState() {
    const p = this.params;
    if (!p || !this.eDetail || !this.eChat || !this.eBadge) return;

    const count = Number(p.messageCount) || 0;
    if (count > 0) {
      this.eChat.classList.add("ww-nav-btn--chat-active");
      this.eBadge.textContent = count > 99 ? "99+" : String(count);
      this.eBadge.classList.add("is-visible");
    } else {
      this.eChat.classList.remove("ww-nav-btn--chat-active");
      this.eBadge.classList.remove("is-visible");
      this.eBadge.textContent = "";
    }

    const focusRowId = p.focusRowId;
    const rowId = p.rowId;
    const tabValue = Number(p.tabValue) || 0;
    // Coerce to string for comparison — focus row id may come from a workspace
    // variable as a string while the row id comes from AG Grid as a number.
    const isFocused = focusRowId != null
      && rowId != null
      && String(focusRowId) === String(rowId);

    console.log("[Navigation] _applyState", {
      rowId,
      focusRowId,
      tabValue,
      isFocused,
      isFocusedAppliedTo: isFocused ? (tabValue === 1 ? "chat" : "detail") : "none",
    });

    // Tab-specific highlight: only the button matching tabValue on the
    // focused row gets styling. The other button keeps its default look.
    if (isFocused) {
      if (tabValue === 1) {
        this.eChat.classList.add("is-focused");
        this.eDetail.classList.remove("is-focused");
      } else {
        this.eDetail.classList.add("is-focused");
        this.eChat.classList.remove("is-focused");
      }
    } else {
      this.eDetail.classList.remove("is-focused");
      this.eChat.classList.remove("is-focused");
    }
  }
}

export default NavigationCellRenderer;
