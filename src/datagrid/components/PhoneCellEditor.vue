<template>
  <div
    ref="editorRoot"
    class="phone-cell-editor"
    :style="rootStyle"
    @keydown.escape.stop.prevent="onRootEscape"
    @keydown.enter.stop.prevent="commitAndClose"
  >
    <button
      ref="countryBtn"
      type="button"
      class="pc-country-btn"
      aria-haspopup="listbox"
      :aria-expanded="dropdownOpen"
      @click="toggleDropdown"
    >
      <span class="pc-flag" v-html="selectedFlag || GLOBE_SVG"></span>
      <svg class="pc-caret" :class="{ open: dropdownOpen }" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <input
      ref="phoneInput"
      class="pc-number"
      type="tel"
      inputmode="tel"
      :value="displayValue"
      :placeholder="numberPlaceholder"
      @input="onPhoneInput"
    />

    <Teleport :to="teleportTarget" v-if="dropdownOpen && teleportTarget">
      <div
        ref="dropdownWrapper"
        class="pc-dropdown"
        :style="dropdownStyle"
      >
        <input
          ref="searchInput"
          v-model="search"
          class="pc-search"
          :placeholder="searchPlaceholder"
          @keydown.down.prevent="highlightNext"
          @keydown.up.prevent="highlightPrev"
          @keydown.enter.prevent="chooseHighlighted"
          @keydown.escape.stop.prevent="closeDropdownAndFocus"
        />
        <div ref="listEl" class="pc-list" role="listbox">
          <div
            v-for="(c, i) in filteredCountries"
            :key="c.code"
            class="pc-option"
            :class="{ highlighted: i === highlightedIndex, selected: c.code === selectedCountry }"
            role="option"
            :aria-selected="c.code === selectedCountry"
            @click="selectCountry(c)"
            @mouseenter="highlightedIndex = i"
          >
            <span class="pc-opt-flag" v-html="c.flag"></span>
            <span class="pc-opt-name">{{ c.name }}</span>
            <span class="pc-opt-dial">{{ c.dialCode }}</span>
          </div>
          <div v-if="filteredCountries.length === 0" class="pc-empty">{{ noResultsLabel }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import {
  parsePhoneNumber,
  getCountries,
  getCountryCallingCode,
  formatIncompletePhoneNumber,
  AsYouType,
} from "libphonenumber-js";
import * as countryFlagIcons from "country-flag-icons/string/3x2";

// Same shape as ww-phone-input's defaultPhoneData so the emitted object is
// familiar to no-code users.
const defaultPhoneData = {
  phoneNumber: "",
  countryCode: "FR",
  isValid: false,
  isPossible: false,
  countryCallingCode: "",
  nationalNumber: "",
  formatInternational: "",
  formatNational: "",
  type: "",
  e164: "",
  regionCode: "",
};

// Neutral 20x15 placeholder (Lucide "globe") so the trigger keeps a stable
// width before a country resolves — avoids layout shift.
const GLOBE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="15" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

const LABELS = {
  en: { number: "Phone number", search: "Search a country", noResults: "No results" },
  fr: { number: "Numéro de téléphone", search: "Rechercher un pays", noResults: "Aucun résultat" },
};

// Built once per locale — getCountries() x flags x calling codes x Intl names.
const _countryListCache = new Map();
function buildCountryList(lang) {
  const key = lang || "en";
  if (_countryListCache.has(key)) return _countryListCache.get(key);
  let dn = null;
  try { dn = new Intl.DisplayNames([key], { type: "region" }); } catch (e) { dn = null; }
  const list = getCountries()
    .map((code) => {
      const flag = countryFlagIcons[code];
      if (!flag) return null; // drop non-geographic codes without a flag
      let callingCode;
      try { callingCode = getCountryCallingCode(code); } catch (e) { return null; }
      let name = code;
      try { name = (dn && dn.of(code)) || code; } catch (e) { name = code; }
      return { code, name, dialCode: "+" + callingCode, flag };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
  _countryListCache.set(key, list);
  return list;
}

const onlyDigits = (s) => String(s == null ? "" : s).replace(/\D/g, "");

export default {
  name: "PhoneCellEditor",
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      localPhoneData: { ...defaultPhoneData },
      displayValue: "", // what's shown in the number input (national format)
      selectedCountry: "FR",
      originalValue: "",
      dropdownOpen: false,
      teleportTarget: null,
      search: "",
      highlightedIndex: 0,
      dropdownPos: { top: 0, left: 0 },
      dropdownMaxHeight: null,
      _countries: [],
      _cancelled: false,
      _emitted: false,
      GLOBE_SVG,
    };
  },
  computed: {
    rootStyle() {
      // Inline editor: fill the cell exactly.
      return { width: "100%", height: "100%" };
    },
    defaultCountry() {
      return this.params?.defaultCountry || "FR";
    },
    lang() {
      return this.params?.lang || "en";
    },
    labels() {
      return LABELS[this.lang] || LABELS.en;
    },
    numberPlaceholder() {
      return this.labels.number;
    },
    searchPlaceholder() {
      return this.labels.search;
    },
    noResultsLabel() {
      return this.labels.noResults;
    },
    preferredCountriesArray() {
      const pref = this.params?.preferredCountries;
      if (Array.isArray(pref)) return pref.map((c) => String(c).toUpperCase());
      if (typeof pref === "string" && pref.length) {
        return pref.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
      }
      return ["FR", "GB", "CA", "US", "DE"];
    },
    selectedFlag() {
      return countryFlagIcons[(this.selectedCountry || "").toUpperCase()] || "";
    },
    filteredCountries() {
      const all = this._countries;
      const q = this.search.trim().toLowerCase();
      if (q) {
        const digits = q.replace(/[^\d]/g, "");
        return all.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (digits && c.dialCode.replace(/\D/g, "").includes(digits))
        );
      }
      // Preferred first (in configured order), then the rest, deduped.
      const preferred = this.preferredCountriesArray;
      const prefSet = new Set(preferred);
      const byCode = new Map(all.map((c) => [c.code, c]));
      const pref = preferred.map((code) => byCode.get(code)).filter(Boolean);
      const rest = all.filter((c) => !prefSet.has(c.code));
      return [...pref, ...rest];
    },
    dropdownStyle() {
      const style = {
        position: "fixed",
        top: `${this.dropdownPos.top}px`,
        left: `${this.dropdownPos.left}px`,
        zIndex: 2000,
      };
      if (this.dropdownMaxHeight != null) {
        style.maxHeight = `${this.dropdownMaxHeight}px`;
        style.overflowY = "auto";
      }
      return style;
    },
  },
  mounted() {
    this._countries = buildCountryList(this.lang);
    this.teleportTarget = (wwLib?.getFrontDocument?.() || document).body;

    const raw = this.params?.value;
    let country = this.defaultCountry;
    let display = "";
    let phoneObj = { ...defaultPhoneData, countryCode: country };

    if (raw && typeof raw === "object") {
      // Legacy structured value — show it in international form.
      phoneObj = { ...defaultPhoneData, ...raw };
      country = phoneObj.countryCode || this.defaultCountry;
      display = phoneObj.formatInternational || this.formatIntl(phoneObj.e164 || phoneObj.phoneNumber || "");
    } else if (typeof raw === "string" && raw.trim()) {
      const hasLetters = /[a-zA-Z]/.test(raw);
      const pn = this.safeParse(raw, this.defaultCountry);
      // Only adopt the parse when it's a plausible phone number AND the input
      // is not free text — otherwise a junk string like "ext 4471 call me"
      // would be silently reinterpreted and overwrite the stored value.
      if (pn && pn.isPossible() && !hasLetters) {
        country = pn.country || this.defaultCountry;
        display = pn.formatInternational(); // international: with the leading "+"
        phoneObj = this.buildPhoneObject(display, country);
      } else {
        // Keep the raw string verbatim; leave formatInternational empty so
        // getValue() falls back to it and the value round-trips unchanged.
        display = raw;
        phoneObj = { ...defaultPhoneData, countryCode: country, phoneNumber: raw };
      }
    } else {
      // Empty cell: start blank so the user can type either a national number
      // (e.g. "0739323212" for FR) or an international one ("+44 ..."). The flag
      // shows the default country until a "+<code>" is typed.
      display = "";
    }

    this.selectedCountry = country;
    this.displayValue = display;
    this.localPhoneData = phoneObj;
    // Baseline for change detection mirrors what getValue() would return now,
    // so committing an untouched cell never emits or rewrites the value.
    this.originalValue = this.getValue();

    this.$nextTick(() => {
      this.focusInput();
      this.addClickOutsideListener();
    });
  },
  beforeUnmount() {
    this.removeClickOutsideListener();
    this.emitPhoneChange();
  },
  methods: {
    // ---- parsing / formatting -------------------------------------------
    safeParse(value, country) {
      const v = String(value == null ? "" : value);
      if (!v) return null;
      try {
        return parsePhoneNumber(v, country) || null;
      } catch (e) {
        return null;
      }
    },
    safeFormatIncomplete(value, country) {
      try {
        return formatIncompletePhoneNumber(String(value || ""), country) || "";
      } catch (e) {
        return String(value || "");
      }
    },
    callingDigits(country) {
      try {
        return String(getCountryCallingCode(country));
      } catch (e) {
        return "";
      }
    },
    // Format an international number (leading "+"), idempotently. Always rebuilds
    // from the digits so re-feeding an already-formatted value is stable.
    formatIntl(value) {
      const digits = onlyDigits(value);
      if (!digits) return "";
      return this.safeFormatIncomplete("+" + digits, undefined) || "+" + digits;
    },
    // Detect the country from an international number as it's typed. Returns the
    // ISO code only once libphonenumber is confident, else null (keep current).
    detectCountry(value, hint) {
      const digits = onlyDigits(value);
      if (!digits) return null;
      try {
        const ayt = new AsYouType(hint);
        ayt.input("+" + digits);
        return (ayt.getCountry && ayt.getCountry()) || ayt.country || null;
      } catch (e) {
        return null;
      }
    },
    // Build the full structured object from a phone value (may include "+") +
    // a country hint (used only when the value has no "+").
    buildPhoneObject(value, country) {
      const c = country || this.defaultCountry;
      const v = String(value == null ? "" : value);
      const obj = { ...defaultPhoneData, phoneNumber: v, countryCode: c };
      const pn = this.safeParse(v, c);
      if (pn && (pn.isValid() || pn.isPossible())) {
        obj.isValid = pn.isValid();
        obj.isPossible = pn.isPossible();
        obj.countryCallingCode = pn.countryCallingCode || "";
        obj.nationalNumber = pn.nationalNumber || "";
        obj.formatInternational = pn.formatInternational();
        obj.formatNational = pn.formatNational();
        obj.e164 = pn.format("E.164");
        obj.type = pn.getType() || "";
        obj.regionCode = pn.country || "";
        obj.countryCode = pn.country || c;
      } else {
        // Partial / not yet a real number: keep a clean display, but leave
        // formatInternational empty so we never store a fabricated value.
        obj.formatNational = this.safeFormatIncomplete(v, c);
      }
      return obj;
    },
    // ---- number input ----------------------------------------------------
    onPhoneInput(e) {
      const el = e.target;
      const oldVal = el.value;
      const caret = el.selectionStart == null ? oldVal.length : el.selectionStart;
      const digitsBeforeCaret = (oldVal.slice(0, caret).match(/\d/g) || []).length;

      const digits = onlyDigits(oldVal);
      const isInternational = oldVal.trimStart().charAt(0) === "+";

      let formatted;
      if (isInternational) {
        // International input ("+..."): format with the leading "+" and
        // auto-detect the country from the dialed code.
        if (digits) {
          const detected = this.detectCountry(digits, this.selectedCountry);
          if (detected) this.selectedCountry = detected;
        }
        formatted = this.formatIntl(digits);
        this.localPhoneData = this.buildPhoneObject(formatted, this.selectedCountry);
      } else {
        // National input (e.g. "0739323212" when FR is selected): format for
        // the selected country and parse it as a national number. The flag
        // stays on the selected country (no "+" → nothing to auto-detect).
        formatted = digits ? this.safeFormatIncomplete(digits, this.selectedCountry) : "";
        this.localPhoneData = this.buildPhoneObject(digits, this.selectedCountry);
      }

      this.displayValue = formatted;

      // Controlled input: force the DOM value + restore the caret by digit
      // count so reformatting (inserted spaces/"+") doesn't jump the cursor.
      el.value = formatted;
      const pos = this.caretAfterNDigits(formatted, digitsBeforeCaret);
      try { el.setSelectionRange(pos, pos); } catch (err) { /* non-text input */ }
    },
    caretAfterNDigits(str, n) {
      if (n <= 0) return 0;
      let count = 0;
      for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) >= 48 && str.charCodeAt(i) <= 57) {
          count++;
          if (count === n) return i + 1;
        }
      }
      return str.length;
    },
    focusInput() {
      const el = this.$refs.phoneInput;
      if (!el) return;
      el.focus();
      const len = el.value ? el.value.length : 0;
      try { el.setSelectionRange(len, len); } catch (e) { /* ignore */ }
    },
    // ---- country selection ----------------------------------------------
    selectCountry(c) {
      // Keep whichever mode the user is in: if the field shows an international
      // number ("+…") re-prefix it for the new country; otherwise keep the
      // national format for the new country.
      const wasIntl = this.displayValue.trimStart().charAt(0) === "+";
      const significant = this.localPhoneData.nationalNumber || "";
      this.selectedCountry = c.code;
      const code = this.callingDigits(c.code);

      if (!significant) {
        // No number yet — just switch the flag.
        this.displayValue = wasIntl && code ? `+${code} ` : "";
        this.localPhoneData = { ...defaultPhoneData, countryCode: c.code };
      } else if (wasIntl) {
        const formatted = this.formatIntl("+" + code + significant);
        this.displayValue = formatted;
        this.localPhoneData = this.buildPhoneObject(formatted, c.code);
      } else {
        // National display for the new country.
        const obj = this.buildPhoneObject(significant, c.code);
        this.displayValue = obj.formatNational || this.safeFormatIncomplete(significant, c.code) || significant;
        this.localPhoneData = obj;
      }
      this.closeDropdown();
      this.$nextTick(() => this.focusInput());
    },
    // ---- dropdown --------------------------------------------------------
    toggleDropdown() {
      if (this.dropdownOpen) this.closeDropdown();
      else this.openDropdown();
    },
    openDropdown() {
      this.search = "";
      this.dropdownOpen = true;
      const selIdx = this.filteredCountries.findIndex((c) => c.code === this.selectedCountry);
      this.highlightedIndex = selIdx >= 0 ? selIdx : 0;
      this.updateDropdownPosition();
      requestAnimationFrame(() => this.updateDropdownPosition());
      this.$nextTick(() => {
        this.updateDropdownPosition();
        if (this.$refs.searchInput) this.$refs.searchInput.focus();
        this.scrollToHighlighted();
      });
      setTimeout(() => this.updateDropdownPosition(), 50);
    },
    closeDropdown() {
      this.dropdownOpen = false;
      this.search = "";
    },
    closeDropdownAndFocus() {
      this.closeDropdown();
      this.$nextTick(() => this.focusInput());
    },
    updateDropdownPosition() {
      const btn = this.$refs.countryBtn;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      this.dropdownPos = { top: r.bottom + 4, left: r.left };
      this.dropdownMaxHeight = null;
      this.$nextTick(() => this.clampDropdownToViewport());
    },
    clampDropdownToViewport() {
      const wrap = this.$refs.dropdownWrapper;
      const btn = this.$refs.countryBtn;
      if (!wrap || !btn) return;
      const win = wwLib?.getFrontWindow?.() || window;
      const vw = win.innerWidth || document.documentElement.clientWidth;
      const vh = win.innerHeight || document.documentElement.clientHeight;
      const margin = 8;
      const rect = wrap.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      let left = this.dropdownPos.left;
      if (rect.right > vw - margin) left -= rect.right - (vw - margin);
      if (left < margin) left = margin;

      let top = btnRect.bottom + 4;
      let maxH = null;
      const spaceBelow = vh - btnRect.bottom - margin;
      const spaceAbove = btnRect.top - margin;
      if (rect.height > spaceBelow && spaceAbove > spaceBelow) {
        maxH = spaceAbove;
        top = Math.max(margin, btnRect.top - 4 - Math.min(rect.height, maxH));
      } else if (rect.height > spaceBelow) {
        maxH = spaceBelow;
      }
      this.dropdownPos = { top, left };
      this.dropdownMaxHeight = maxH;
    },
    highlightNext() {
      if (this.highlightedIndex < this.filteredCountries.length - 1) {
        this.highlightedIndex++;
        this.scrollToHighlighted();
      }
    },
    highlightPrev() {
      if (this.highlightedIndex > 0) {
        this.highlightedIndex--;
        this.scrollToHighlighted();
      }
    },
    chooseHighlighted() {
      const c = this.filteredCountries[this.highlightedIndex];
      if (c) this.selectCountry(c);
    },
    scrollToHighlighted() {
      this.$nextTick(() => {
        const list = this.$refs.listEl;
        if (!list) return;
        const el = list.querySelector(".pc-option.highlighted");
        if (el) el.scrollIntoView({ block: "nearest" });
      });
    },
    // ---- click outside ---------------------------------------------------
    isInsideEditor(target) {
      if (this.$refs.dropdownWrapper && this.$refs.dropdownWrapper.contains(target)) return true;
      if (this.$refs.editorRoot && this.$refs.editorRoot.contains(target)) return true;
      return false;
    },
    handleClickOutside(event) {
      const t = event.target;
      if (this.$refs.dropdownWrapper && this.$refs.dropdownWrapper.contains(t)) return;
      if (this.$refs.editorRoot && this.$refs.editorRoot.contains(t)) {
        // Clicking the country button: let its @click toggle handle open/close
        // (closing here would race the toggle and reopen the dropdown).
        const onButton = this.$refs.countryBtn && this.$refs.countryBtn.contains(t);
        if (this.dropdownOpen && !onButton) this.closeDropdown();
        return;
      }
      this.commitAndClose();
    },
    addClickOutsideListener() {
      const doc = wwLib?.getFrontDocument?.() || document;
      doc.addEventListener("mousedown", this.handleClickOutside, true);
    },
    removeClickOutsideListener() {
      const doc = wwLib?.getFrontDocument?.() || document;
      doc.removeEventListener("mousedown", this.handleClickOutside, true);
    },
    // ---- AG Grid editor interface ---------------------------------------
    getValue() {
      if (this.localPhoneData.formatInternational) {
        return this.localPhoneData.formatInternational;
      }
      const digits = onlyDigits(this.displayValue);
      if (!digits) return "";
      // Only the country dial code, no national number → treat as empty so the
      // prefilled "+<code>" prefix never gets stored.
      const codeDigits = this.callingDigits(this.selectedCountry);
      if (codeDigits && digits === codeDigits) return "";
      // Fall back to the raw display so an unparseable-but-typed value (or a
      // partial number) is preserved rather than wiped.
      return this.displayValue.trim();
    },
    isPopup() {
      return false;
    },
    // AG Grid cancel hook. params.stopEditing(true) does NOT cancel — its arg is
    // `suppressNavigateAfterEdit`, so the typed value would still be committed via
    // getValue(). Returning true here is the only way to make AG Grid discard the
    // edit, so Escape actually reverts the phone number instead of saving it.
    isCancelAfterEnd() {
      return this._cancelled === true;
    },
    getValidationErrors() {
      const cb = this.params?.getValidationErrors;
      if (typeof cb !== "function") return null;
      return cb({ value: this.getValue(), data: this.params?.data });
    },
    // ---- commit / cancel / emit -----------------------------------------
    emitPhoneChange() {
      if (this._cancelled || this._emitted) return;
      const current = this.getValue();
      if (current === this.originalValue) return;
      this._emitted = true;
      const cb = this.params?.onPhoneEdit;
      if (typeof cb === "function") {
        cb({
          ...this.localPhoneData,
          field: this.params?.colDef?.field,
          rowId: this.params?.data?.id ?? null,
          row: this.params?.data ?? null,
        });
      }
    },
    commitAndClose() {
      this.removeClickOutsideListener();
      if (this.params?.stopEditing) this.params.stopEditing();
    },
    cancelEditing() {
      this._cancelled = true;
      this.removeClickOutsideListener();
      if (this.params?.stopEditing) this.params.stopEditing(true);
    },
    onRootEscape() {
      if (this.dropdownOpen) {
        this.closeDropdown();
        this.$nextTick(() => this.focusInput());
      } else {
        this.cancelEditing();
      }
    },
  },
};
</script>

<style scoped lang="scss">
.phone-cell-editor {
  /* Floating popup matched to the cell width (set inline via rootStyle).
     Reads as plain cell content: no border, no shadow, no input chrome. */
  display: flex;
  align-items: center;
  height: 100%;
  box-sizing: border-box;
  padding: 0 4px;
  background: #ffffff;
  border: none;
  box-shadow: none;
  overflow: hidden;
}

.pc-country-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 2px;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
}

.pc-flag {
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

.pc-caret {
  flex-shrink: 0;
  color: #9ca3af;
  transition: transform 0.15s ease;

  &.open {
    transform: rotate(180deg);
  }
}

.pc-number {
  flex: 1 1 auto;
  min-width: 0; /* load-bearing: lets the input shrink instead of overflowing */
  width: auto;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 4px;
  font-family: inherit;
  font-size: 14px;
  color: inherit;
}
</style>

<!-- Non-scoped: (1) make AG Grid's inline edit wrapper fill the cell so the
     editor occupies the whole cell; (2) style the teleported dropdown (it lives
     on the body, so scoped styles can't reach it). -->
<style>
.ag-cell-edit-wrapper:has(.phone-cell-editor),
.ag-cell-editor:has(.phone-cell-editor) {
  width: 100%;
  height: 100%;
}

.pc-dropdown {
  min-width: 240px;
  max-width: 320px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  padding: 6px;
  box-sizing: border-box;
  font-family: inherit;
}
.pc-dropdown .pc-search {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}
.pc-dropdown .pc-search:focus {
  border-color: #4f46e5;
}
.pc-dropdown .pc-list {
  max-height: 240px;
  overflow-y: auto;
}
.pc-dropdown .pc-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #1f2430;
}
.pc-dropdown .pc-option.highlighted {
  background: #f1f5f9;
}
.pc-dropdown .pc-option.selected {
  font-weight: 600;
}
.pc-dropdown .pc-opt-flag {
  flex-shrink: 0;
  width: 20px;
  height: 15px;
  display: inline-flex;
  align-items: center;
}
.pc-dropdown .pc-opt-flag svg {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  display: block;
}
.pc-dropdown .pc-opt-name {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-dropdown .pc-opt-dial {
  flex-shrink: 0;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}
.pc-dropdown .pc-empty {
  padding: 10px 8px;
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
}
</style>
