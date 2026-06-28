<template>
  <div
    ref="cellElement"
    class="phone-cell"
    :style="accentVars"
    @mouseenter="onCellMouseEnter"
    @mouseleave="onCellMouseLeave"
  >
    <span v-if="flagSvg" class="phone-flag" v-html="flagSvg"></span>
    <span class="phone-number">{{ displayNumber }}</span>

    <!-- Hover actions popover (Teleported, styled like the grid) -->
    <Teleport :to="teleportTarget" v-if="showPopover && rawValue && teleportTarget">
      <div
        ref="popoverElement"
        class="phone-popover"
        :style="popoverStyle"
        @mouseenter="onPopoverMouseEnter"
        @mouseleave="onPopoverMouseLeave"
      >
        <div class="phone-popover-number" :title="displayNumber">
          <span v-if="flagSvg" class="phone-popover-flag" v-html="flagSvg"></span>
          <span>{{ displayNumber }}</span>
        </div>
        <div class="phone-popover-actions">
          <button
            class="phone-popover-btn phone-popover-call-btn"
            type="button"
            @click.stop="callNumber"
          >
            <svg class="pc-icon" :class="{ 'pc-ring': calling }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>
            </svg>
            Appeler
          </button>
          <button
            class="phone-popover-btn phone-popover-copy-btn"
            :class="{ 'is-copied': copied }"
            type="button"
            @click.stop="copyNumber"
          >
            <svg v-if="!copied" class="pc-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <svg v-else class="pc-icon pc-pop" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            {{ copied ? 'Copié' : 'Copier' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { parsePhoneNumber } from "libphonenumber-js";
import * as countryFlagIcons from "country-flag-icons/string/3x2";

export default {
  name: "PhoneCellRenderer",
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      // ag-grid-vue3 does not update the params prop after calling refresh().
      // Cache the latest params here so computeds pick up new cell values.
      _refreshedParams: null,
      showPopover: false,
      copied: false,
      calling: false,
      popoverPosition: { top: 0, left: 0 },
      teleportTarget: null,
      _showTimer: null,
      _hideTimer: null,
      _copiedTimer: null,
      _callTimer: null,
    };
  },
  computed: {
    activeParams() {
      return this._refreshedParams || this.params;
    },
    rendererParams() {
      return this.activeParams?.colDef?.cellRendererParams || {};
    },
    defaultCountry() {
      return this.rendererParams?.defaultCountry || "FR";
    },
    displayFormatMode() {
      return this.rendererParams?.displayFormat || "international";
    },
    // Accent color (grid's navigation icon color), passed explicitly because the
    // popover is teleported outside the grid root where the cascade can't reach.
    accentColor() {
      return this.rendererParams?.accentColor || "";
    },
    accentVars() {
      return this.accentColor ? { "--phone-accent": this.accentColor } : {};
    },
    // The stored cell value is the formatInternational string. Tolerate an
    // object too (legacy data) by pulling a sensible string out of it.
    rawValue() {
      const value = this.activeParams?.value;
      if (value == null) return "";
      if (typeof value === "string") return value.trim();
      if (typeof value === "object") {
        return value.formatInternational || value.e164 || value.phoneNumber || "";
      }
      return String(value);
    },
    parsed() {
      const raw = this.rawValue;
      if (!raw) return null;
      try {
        return parsePhoneNumber(raw, this.defaultCountry) || null;
      } catch (e) {
        return null;
      }
    },
    countryCode() {
      return this.parsed?.country || "";
    },
    displayNumber() {
      const raw = this.rawValue;
      if (!raw) return "";
      if (this.parsed) {
        try {
          return this.displayFormatMode === "national"
            ? this.parsed.formatNational()
            : this.parsed.formatInternational();
        } catch (e) {
          return raw;
        }
      }
      // Unparseable string: show it as-is, no flag.
      return raw;
    },
    flagSvg() {
      const code = this.countryCode ? this.countryCode.toUpperCase() : "";
      if (code && countryFlagIcons[code]) {
        return countryFlagIcons[code];
      }
      return "";
    },
    // tel: target — prefer E.164, else a cleaned +digits string.
    telHref() {
      if (this.parsed) {
        try {
          return "tel:" + this.parsed.format("E.164");
        } catch (e) {
          /* fall through */
        }
      }
      const cleaned = this.rawValue.replace(/[^\d+]/g, "");
      return cleaned ? "tel:" + cleaned : "";
    },
    popoverStyle() {
      return {
        position: "fixed",
        top: `${this.popoverPosition.top}px`,
        left: `${this.popoverPosition.left}px`,
        zIndex: 1900,
        ...(this.accentColor ? { "--phone-accent": this.accentColor } : {}),
      };
    },
  },
  mounted() {
    this.teleportTarget = this.getCorrectBody();
  },
  beforeUnmount() {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    clearTimeout(this._copiedTimer);
    clearTimeout(this._callTimer);
  },
  methods: {
    // AG Grid interface: keep the existing instance alive and refresh in place.
    refresh(params) {
      this._refreshedParams = params;
      return true;
    },
    getCorrectBody() {
      const frontDocument = wwLib?.getFrontDocument?.() || document;
      return frontDocument.body;
    },
    onCellMouseEnter() {
      if (!this.rawValue) return;
      clearTimeout(this._hideTimer);
      this._showTimer = setTimeout(() => {
        this.updatePopoverPosition();
        this.showPopover = true;
      }, 300);
    },
    onCellMouseLeave() {
      clearTimeout(this._showTimer);
      this._hideTimer = setTimeout(() => {
        this.showPopover = false;
      }, 200);
    },
    onPopoverMouseEnter() {
      clearTimeout(this._hideTimer);
    },
    onPopoverMouseLeave() {
      this._hideTimer = setTimeout(() => {
        this.showPopover = false;
      }, 200);
    },
    updatePopoverPosition() {
      if (!this.$refs.cellElement) return;
      const rect = this.$refs.cellElement.getBoundingClientRect();
      const frontWindow = wwLib?.getFrontWindow?.() || window;
      const viewportWidth = frontWindow.innerWidth;
      const popoverWidth = 240;
      let left = rect.left;
      if (left + popoverWidth > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - popoverWidth - 8);
      }
      this.popoverPosition = {
        top: rect.bottom + 6,
        left,
      };
    },
    callNumber() {
      if (!this.telHref) return;
      // Ring animation to confirm the action fired.
      this.calling = true;
      clearTimeout(this._callTimer);
      this._callTimer = setTimeout(() => {
        this.calling = false;
      }, 700);
      const frontWindow = wwLib?.getFrontWindow?.() || window;
      try {
        frontWindow.location.href = this.telHref;
      } catch (e) {
        console.warn("[phone] tel link failed", e);
      }
    },
    async copyNumber() {
      const text = this.displayNumber || this.rawValue;
      if (!text) return;
      try {
        const frontWindow = wwLib?.getFrontWindow?.() || window;
        await (frontWindow.navigator?.clipboard || navigator.clipboard).writeText(text);
        this.copied = true;
        clearTimeout(this._copiedTimer);
        this._copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 1500);
      } catch (e) {
        console.warn("[phone] copy failed", e);
      }
    },
  },
};
</script>

<style scoped lang="scss">
.phone-cell {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  box-sizing: border-box;
  overflow: hidden;
}

.phone-flag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 15px;

  :deep(svg) {
    width: 100%;
    height: 100%;
    border-radius: 2px;
    display: block;
  }
}

.phone-number {
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// ─── Hover popover ───────────────────────────────────────────────────────────

.phone-popover {
  background: white;
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
  border: 1px solid #e5e7eb;
  min-width: 200px;
  max-width: 300px;
  padding: 10px;
  font-family: inherit;
  font-size: 13px;
}

.phone-popover-number {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--phone-accent, #0f172a);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef2f7;

  span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.phone-popover-flag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 15px;

  :deep(svg) {
    width: 100%;
    height: 100%;
    border-radius: 2px;
    display: block;
  }
}

.phone-popover-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.phone-popover-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.phone-popover-call-btn {
  background: var(--phone-accent, #2563eb);
  color: white;

  &:hover {
    background: color-mix(in srgb, var(--phone-accent, #2563eb) 85%, black);
  }
}

.phone-popover-copy-btn {
  background: #f3f4f6;
  color: #374151;

  &:hover {
    background: color-mix(in srgb, var(--phone-accent, #2563eb) 12%, white);
    color: var(--phone-accent, #2563eb);
  }

  // Completion state: flash green when the copy succeeds.
  &.is-copied {
    background: #dcfce7;
    color: #16a34a;
  }
}

.pc-icon {
  flex-shrink: 0;
}

// Checkmark pops in when the copy completes.
.pc-pop {
  animation: pc-pop 0.32s cubic-bezier(0.22, 1.2, 0.36, 1);
}

// Phone icon rings/wiggles when a call is triggered.
.pc-ring {
  transform-origin: 50% 60%;
  animation: pc-ring 0.7s ease;
}

@keyframes pc-pop {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); }
}

@keyframes pc-ring {
  0%, 100% { transform: rotate(0); }
  15% { transform: rotate(-20deg); }
  30% { transform: rotate(16deg); }
  45% { transform: rotate(-12deg); }
  60% { transform: rotate(8deg); }
  75% { transform: rotate(-4deg); }
}
</style>
