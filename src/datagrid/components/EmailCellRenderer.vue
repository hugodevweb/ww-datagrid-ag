<template>
  <div
    ref="cellElement"
    class="email-cell"
    :style="accentVars"
    @mouseenter="onCellMouseEnter"
    @mouseleave="onCellMouseLeave"
  >
    <span v-if="email" class="email-address" :title="email">{{ email }}</span>

    <!-- Hover actions popover (Teleported, styled like the grid) -->
    <Teleport :to="teleportTarget" v-if="showPopover && email && teleportTarget">
      <div
        ref="popoverElement"
        class="email-popover"
        :style="popoverStyle"
        @mouseenter="onPopoverMouseEnter"
        @mouseleave="onPopoverMouseLeave"
      >
        <div class="email-popover-address" :title="email">{{ email }}</div>
        <div class="email-popover-actions">
          <button
            class="email-popover-btn email-popover-send-btn"
            type="button"
            @click.stop="sendEmail"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            Envoyer
          </button>
          <button
            class="email-popover-btn email-popover-copy-btn"
            type="button"
            @click.stop="copyEmail"
          >
            <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
export default {
  name: "EmailCellRenderer",
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      // ag-grid-vue3 does not update the params prop after refresh(). Cache the
      // latest params here so computeds pick up new cell values.
      _refreshedParams: null,
      showPopover: false,
      copied: false,
      popoverPosition: { top: 0, left: 0 },
      teleportTarget: null,
      _showTimer: null,
      _hideTimer: null,
      _copiedTimer: null,
    };
  },
  computed: {
    activeParams() {
      return this._refreshedParams || this.params;
    },
    email() {
      const value = this.activeParams?.value;
      if (value == null) return "";
      return String(value).trim();
    },
    rendererParams() {
      return this.activeParams?.colDef?.cellRendererParams || {};
    },
    // Accent (grid's navigation icon color). Exposed as a local CSS custom
    // property so both the in-cell text and the teleported popover — which
    // lives outside the grid root and can't inherit the grid's cascade — share
    // one source of truth and the hover states can reference it too.
    accentColor() {
      return this.rendererParams?.accentColor || "";
    },
    accentVars() {
      return this.accentColor ? { '--email-accent': this.accentColor } : {};
    },
    popoverStyle() {
      return {
        position: 'fixed',
        top: `${this.popoverPosition.top}px`,
        left: `${this.popoverPosition.left}px`,
        zIndex: 1900,
        ...(this.accentColor ? { '--email-accent': this.accentColor } : {}),
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
      if (!this.email) return;
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

    sendEmail() {
      if (!this.email) return;
      const frontWindow = wwLib?.getFrontWindow?.() || window;
      try {
        frontWindow.location.href = `mailto:${this.email}`;
      } catch (e) {
        console.warn('[email] mailto failed', e);
      }
    },

    async copyEmail() {
      if (!this.email) return;
      try {
        const frontWindow = wwLib?.getFrontWindow?.() || window;
        await (frontWindow.navigator?.clipboard || navigator.clipboard).writeText(this.email);
        this.copied = true;
        clearTimeout(this._copiedTimer);
        this._copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 1500);
      } catch (e) {
        console.warn('[email] copy failed', e);
      }
    },
  },
};
</script>

<style scoped lang="scss">
.email-cell {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  box-sizing: border-box;
  overflow: hidden;
}

.email-address {
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--email-accent, currentColor);
}

// ─── Hover popover ───────────────────────────────────────────────────────────

.email-popover {
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

.email-popover-address {
  color: var(--email-accent, #0f172a);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef2f7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-popover-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.email-popover-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s;
}

.email-popover-send-btn {
  background: var(--email-accent, #2563eb);
  color: white;

  &:hover {
    background: color-mix(in srgb, var(--email-accent, #2563eb) 85%, black);
  }
}

.email-popover-copy-btn {
  background: #f3f4f6;
  color: #374151;

  &:hover {
    background: color-mix(in srgb, var(--email-accent, #2563eb) 12%, white);
    color: var(--email-accent, #2563eb);
  }
}
</style>
