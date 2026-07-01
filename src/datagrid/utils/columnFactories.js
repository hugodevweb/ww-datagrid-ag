// Column definition factories to prevent unnecessary AG Grid re-renders
// by memoizing function closures and avoiding recreation on every computed evaluation

// Cache for memoized formatters and other closures
const memoCache = new Map();

// Helper to create a stable memoized function
function memoize(key, factory) {
  if (!memoCache.has(key)) {
    memoCache.set(key, factory());
  }
  return memoCache.get(key);
}

// ---------------------------------------------------------------------------
// Cell display value cache
// ---------------------------------------------------------------------------
// Stores the *output* of value formatters keyed by a compound string of
// (columnId, rawValue, formatConfig).  When AG Grid virtualises rows and a
// previously-visible row re-enters the viewport, the formatter result is
// served from cache instead of being recomputed.
//
// Map is used instead of WeakMap because keys are primitive strings.
// Size is bounded to CELL_CACHE_MAX to prevent unbounded memory growth.
const cellDisplayCache = new Map();
const CELL_CACHE_MAX = 2000;

/**
 * Get or compute a formatted display value with caching.
 *
 * @param {string} colId     - Column identifier (field name or action name)
 * @param {string} configKey - Stable string that captures the formatter config
 *                             (e.g. currency code + locale, or date format)
 * @param {*}      rawValue  - The raw cell value (used as part of the cache key
 *                             and passed to factory when there is a cache miss)
 * @param {Function} factory - () => string  – computes the formatted display string
 * @returns {string}
 */
export function getCachedDisplayValue(colId, configKey, rawValue, factory) {
  const key = `${colId}::${configKey}::${rawValue}`;
  if (cellDisplayCache.has(key)) {
    return cellDisplayCache.get(key);
  }
  const result = factory();
  // Evict oldest entries when the cache is full
  if (cellDisplayCache.size >= CELL_CACHE_MAX) {
    cellDisplayCache.delete(cellDisplayCache.keys().next().value);
  }
  cellDisplayCache.set(key, result);
  return result;
}

/**
 * Clear the cell display cache (called alongside clearColumnCache when
 * column configuration changes).
 */
export function clearCellDisplayCache() {
  cellDisplayCache.clear();
}

// Clear cache when dependencies change (called from component)
export function clearColumnCache() {
  memoCache.clear();
}

// Cache for Intl.NumberFormat instances
const intlFormatters = new Map();

function getCachedNumberFormatter(locale, currency) {
  const key = `${locale}-${currency}`;
  if (!intlFormatters.has(key)) {
    try {
      intlFormatters.set(key, new Intl.NumberFormat(locale || navigator.language || 'en-US', {
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }));
    } catch (e) {
      // Fallback for invalid currency codes
      intlFormatters.set(key, null);
    }
  }
  return intlFormatters.get(key);
}

// Shared validation function factory
export function createValidationFunction(col, resolveMappingFormula) {
  const cacheKey = `validation-${col.field}-${JSON.stringify(col.validation)}`;
  
  return memoize(cacheKey, () => {
    return (newValue, rowData) => {
      if (!col?.validation || !Array.isArray(col.validation)) {
        return null;
      }

      const errors = [];

      for (const rule of col.validation) {
        if (!rule?.type) {
          continue;
        }

        let isValid = true;
        let errorMessage = null;

        switch (rule.type) {
          case 'required':
            isValid = newValue !== null && newValue !== undefined && newValue !== '';
            errorMessage = rule.message || 'This field is required.';
            break;

          case 'minLength':
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              const minLength = parseInt(rule.value);
              if (!isNaN(minLength) && String(newValue).length < minLength) {
                isValid = false;
                errorMessage = rule.message || `Value must be at least ${minLength} characters long.`;
              }
            }
            break;

          case 'maxLength':
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              const maxLength = parseInt(rule.value);
              if (!isNaN(maxLength) && String(newValue).length > maxLength) {
                isValid = false;
                errorMessage = rule.message || `Value must be at most ${maxLength} characters long.`;
              }
            }
            break;

          case 'min':
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              const min = Number(rule.value);
              const numValue = Number(newValue);
              if (!isNaN(min) && !isNaN(numValue) && numValue < min) {
                isValid = false;
                errorMessage = rule.message || `Value must be at least ${min}.`;
              }
            }
            break;

          case 'max':
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              const max = Number(rule.value);
              const numValue = Number(newValue);
              if (!isNaN(max) && !isNaN(numValue) && numValue > max) {
                isValid = false;
                errorMessage = rule.message || `Value must be at most ${max}.`;
              }
            }
            break;

          case 'pattern':
            if (newValue !== null && newValue !== undefined && newValue !== '' && rule.value) {
              try {
                const regex = new RegExp(rule.value);
                const matches = regex.test(String(newValue));
                if (!matches) {
                  isValid = false;
                  errorMessage = rule.message || 'Value does not match the required pattern.';
                }
              } catch (e) {
                // If pattern is invalid, don't fail validation
              }
            }
            break;

          case 'email':
            if (newValue !== null && newValue !== undefined && newValue !== '') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(String(newValue).trim())) {
                isValid = false;
                errorMessage = rule.message || 'Please enter a valid email address.';
              }
            }
            break;

          case 'custom':
            if (rule.custom) {
              const validationContext = { ...rowData, ...(col?.field ? { [col.field]: newValue } : {}) };
              const result = resolveMappingFormula(rule.custom, validationContext);
              isValid = Boolean(result);
              errorMessage = rule.message || 'Custom validation failed.';
            }
            break;
        }

        if (!isValid && errorMessage) {
          errors.push(errorMessage);
        }
      }

      return errors.length > 0 ? errors : null;
    };
  });
}

// Date formatter factory
export function createDateFormatter(col) {
  const cacheKey = `date-formatter-${col.field}-${col.dateFormat}-${col.timeFormat}-${col.cellDataType}`;
  const configKey = `${col.dateFormat || 'auto'}-${col.timeFormat || 'HH:mm'}-${col.cellDataType || 'date'}`;
  
  return memoize(cacheKey, () => {
    return (value) => {
      if (!value) return '';

      // Serve from display cache first — date parsing + string manipulation is skipped
      // for every previously-seen value that re-enters the viewport during scroll.
      return getCachedDisplayValue(col.field, configKey, value, () => {
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;

        const dateFormat = col?.dateFormat || 'auto';
        const timeFormat = col?.timeFormat || 'HH:mm';

        // Format date part
        let formattedDate;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[date.getMonth()];

        switch (dateFormat) {
          case 'DD/MM/YYYY':
            formattedDate = `${day}/${month}/${year}`;
            break;
          case 'MM/DD/YYYY':
            formattedDate = `${month}/${day}/${year}`;
            break;
          case 'YYYY-MM-DD':
            formattedDate = `${year}-${month}-${day}`;
            break;
          case 'DD MMM YYYY':
            formattedDate = `${day} ${monthName} ${year}`;
            break;
          case 'auto':
          default:
            formattedDate = date.toLocaleDateString();
            break;
        }

        // Add time part for dateTime type
        if (col?.cellDataType === 'dateTime') {
          const hours24 = date.getHours();
          const hours12 = hours24 % 12 || 12;
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          const ampm = hours24 >= 12 ? 'PM' : 'AM';
          const hours24Str = String(hours24).padStart(2, '0');
          const hours12Str = String(hours12).padStart(2, '0');

          let formattedTime;
          switch (timeFormat) {
            case 'HH:mm:ss':
              formattedTime = `${hours24Str}:${minutes}:${seconds}`;
              break;
            case 'hh:mm A':
              formattedTime = `${hours12Str}:${minutes} ${ampm}`;
              break;
            case 'HH:mm':
            default:
              formattedTime = `${hours24Str}:${minutes}`;
              break;
          }

          return `${formattedDate} ${formattedTime}`;
        }

        return formattedDate;
      });
    };
  });
}

// Currency formatter factory
export function createCurrencyFormatter(col) {
  const cacheKey = `currency-formatter-${col.field}-${col.currencyMode}-${col.currencyCode}-${col.currencyLocale}`;
  
  return memoize(cacheKey, () => {
    return (params, resolveMappingFormula) => {
      const rawValue = params.data?.[col?.field];
      if (rawValue == null || rawValue === '') return '';

      // Get currency code from row data or column config
      const getCurrencyCode = (rowData, colDef) => {
        if (colDef?.currencyMode === 'perRow' && colDef?.currencyCodeField) {
          return resolveMappingFormula(colDef.currencyCodeField, rowData) || 'EUR';
        }
        return colDef?.currencyCode || 'EUR';
      };

      // Get locale for currency formatting
      const getLocale = (colDef) => {
        const locale = colDef?.currencyLocale;
        if (!locale || locale === 'auto') return navigator.language || 'en-US';
        return locale;
      };

      const currencyCode = getCurrencyCode(params.data, col);
      const locale = getLocale(col);

      // Convert cents to currency units
      const currencyValue = typeof rawValue === 'number' ? rawValue / 100 : parseFloat(rawValue) / 100;
      if (isNaN(currencyValue)) return '';

      // For per-row currency mode the currency code varies by row so cache per (value, code, locale).
      // For static mode the currency code is constant so any rawValue hit is valid.
      const configKey = `${locale}-${currencyCode}`;
      return getCachedDisplayValue(col.field, configKey, rawValue, () => {
        const formatter = getCachedNumberFormatter(locale, currencyCode);
        if (formatter) {
          try {
            return formatter.format(currencyValue);
          } catch (e) {
            return `${currencyValue.toFixed(2)} ${currencyCode}`;
          }
        }
        return `${currencyValue.toFixed(2)} ${currencyCode}`;
      });
    };
  });
}

// Date comparator factory
export function createDateComparator() {
  const cacheKey = 'date-comparator';
  
  return memoize(cacheKey, () => {
    return (valueA, valueB) => {
      const dateA = valueA ? new Date(valueA).getTime() : 0;
      const dateB = valueB ? new Date(valueB).getTime() : 0;
      return dateA - dateB;
    };
  });
}

// Currency comparator factory
export function createCurrencyComparator(col) {
  const cacheKey = `currency-comparator-${col.field}`;
  
  return memoize(cacheKey, () => {
    return (valueA, valueB, nodeA, nodeB) => {
      // Helper to get display value (cents / 100) for comparison
      const getDisplayValue = (value) => {
        if (value == null || value === '') return null;
        const currencyValue = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
        return isNaN(currencyValue) ? null : currencyValue;
      };

      const rawValueA = nodeA?.data?.[col?.field];
      const rawValueB = nodeB?.data?.[col?.field];
      const displayValueA = getDisplayValue(rawValueA);
      const displayValueB = getDisplayValue(rawValueB);
      
      // Handle null/undefined values
      if (displayValueA == null && displayValueB == null) return 0;
      if (displayValueA == null) return 1;
      if (displayValueB == null) return -1;
      
      // Numeric comparison
      return displayValueA - displayValueB;
    };
  });
}

// Currency value getter factory
export function createCurrencyValueGetter(col) {
  const cacheKey = `currency-value-getter-${col.field}`;
  
  return memoize(cacheKey, () => {
    return (params) => {
      const rawValue = params.data?.[col?.field];
      if (rawValue == null || rawValue === '') return null;
      const currencyValue = typeof rawValue === 'number' ? rawValue / 100 : parseFloat(rawValue) / 100;
      return isNaN(currencyValue) ? null : currencyValue;
    };
  });
}

// Currency value parser factory  
export function createCurrencyValueParser() {
  const cacheKey = 'currency-value-parser';
  
  return memoize(cacheKey, () => {
    return (params) => {
      const input = params.newValue;
      if (input == null || input === '') return null;
      
      // Remove currency symbols and whitespace
      const cleaned = String(input).replace(/[€$£¥,\s]/g, '');
      const parsed = parseFloat(cleaned);
      
      if (isNaN(parsed)) return null;
      
      // Convert to cents (multiply by 100)
      return Math.round(parsed * 100);
    };
  });
}

// Generic value setter factory
export function createValueSetter(col, customSetter) {
  const cacheKey = `value-setter-${col.field}-${!!customSetter}`;
  
  return memoize(cacheKey, () => {
    return (params) => {
      const { newValue, oldValue, data } = params;

      // If custom setter provided, use it
      if (customSetter) {
        return customSetter(params);
      }
      
      // Default behavior
      if (newValue !== oldValue && col?.field) {
         data[col.field] = newValue;
         return true;
      }
      return false;
    };
  });
}

// Action column factory
export function createActionColumnDef(col, commonProperties, onActionTrigger, content) {
  return {
    ...commonProperties,
    headerName: col?.headerName,
    cellRenderer: "ActionCellRenderer",
    cellRendererParams: {
      name: col?.actionName,
      label: col?.actionLabel,
      trigger: onActionTrigger,
      withFont: !!content.actionFont,
    },
    sortable: false,
    filter: false,
    colId: col?.actionName,
  };
}

// Fixed width for navigation columns: two 31px icon buttons + 6px gap = 68px of
// content, plus cell padding. Navigation cells always render the same content, so
// the column is locked to this width and cannot be resized. When only one button
// is shown (navigate-only / chat-only) the column is narrowed to a single button.
const NAVIGATION_COLUMN_WIDTH = 90;
const NAVIGATION_COLUMN_WIDTH_SINGLE = 55;

// Navigation column factory — renders a fixed pair of icon buttons (detail + chat)
// per row via the plain-JS NavigationCellRenderer. cellRendererParams is a
// function so AG Grid re-evaluates it on each refreshCells, picking up the
// latest focusRowId / tabValue from navContext without rebuilding the colDef.
export function createNavigationColumnDef(col, commonProperties, navContext) {
  // A single-button column (navigate-only / chat-only) needs less width.
  const width =
    col?.navigationButtons === "navigate" || col?.navigationButtons === "chat"
      ? NAVIGATION_COLUMN_WIDTH_SINGLE
      : NAVIGATION_COLUMN_WIDTH;
  return {
    ...commonProperties,
    // Lock width: override config width / stored view sizes / flex so the column
    // is exactly `width` and the user can't resize it. minWidth
    // === maxWidth === width keeps it pinned even through other sizing paths;
    // resizable: false drops the drag handle (overrides defaultColDef.resizable);
    // flex/suppressSizeToFit stop "size columns to fit" from stretching it.
    width: width,
    minWidth: width,
    maxWidth: width,
    flex: null,
    resizable: false,
    suppressSizeToFit: true,
    headerName: col?.headerName,
    cellRenderer: "NavigationCellRenderer",
    cellRendererParams: (params) => {
      const rowData = params.data;
      const rowId = params.node?.id ?? rowData?.id;
      // Which buttons to render: "both" (default), "navigate", or "chat".
      const buttons = col?.navigationButtons || "both";
      return {
        rowId,
        buttons,
        focusRowId: navContext?.focusRowId?.value ?? null,
        tabValue: navContext?.resolveTab ? navContext.resolveTab() : 0,
        messageCount: navContext?.resolveMessageCount
          ? navContext.resolveMessageCount(rowData, rowId)
          : (rowData?.conversation?.messages?.length ?? 0),
        onNavigate: navContext?.onNavigate,
      };
    },
    editable: false,
    sortable: false,
    filter: false,
    suppressKeyboardEvent: () => true,
    cellClass: "ww-nav-cell",
    colId: col?.field || `navigation-${col?.headerName || "col"}`,
  };
}

// Custom column factory
export function createCustomColumnDef(col, commonProperties, onCustomCellEdit, resolveMappingFormula) {
  const validationFn = createValidationFunction(col, resolveMappingFormula);

  // Performance: only mount the (heavy) WewebCellRenderer when the column
  // actually has a containerId to host. Without one, the renderer would
  // wrap an empty <wwElement> per row at full Vue-mount cost — a column
  // configured without a custom container has nothing to display beyond
  // its raw value, so we let AG Grid's built-in fast text path handle it.
  // The editor is still wired so editable cells continue to behave
  // identically when activated (one-shot cost, not in the scroll hot path).
  const hasContainer = !!col?.containerId;

  const customColumn = {
    ...commonProperties,
    headerName: col?.headerName,
    field: col?.field,
    ...(hasContainer
      ? {
          cellRenderer: "WewebCellRenderer",
          cellRendererParams: {
            containerId: col?.containerId,
            trigger: onCustomCellEdit,
            suppressRowInteraction: col?.suppressRowInteraction,
          },
        }
      : {}),
    cellEditor: "WewebCellRenderer",
    cellEditorParams: {
      containerId: col?.containerId,
      trigger: onCustomCellEdit,
      suppressRowInteraction: col?.suppressRowInteraction,
      getValidationErrors: (params) => {
        return validationFn(params.value, params.data);
      },
    },
    editable: col?.editable !== false,
    sortable: col?.sortable,
    filter: col?.filter ? col?.customFilterType || "agTextColumnFilter" : false,
  };
  
  // Use display value for filtering and sorting if enabled
  if (col?.useDisplayValueForFilterSort && col?.displayLabelFormula) {
    // Helper function to get display value from raw value
    const getDisplayValue = memoize(`display-value-${col.field}`, () => {
      return (rawValue) => {
        return resolveMappingFormula(col?.displayLabelFormula, rawValue);
      };
    });
    
    // Use display value for filtering
    customColumn.filterValueGetter = (params) => {
      const rawValue = params.data?.[col?.field];
      return getDisplayValue(rawValue);
    };
    
    // Use display value for sorting with custom comparator
    if (col?.sortable) {
      customColumn.comparator = memoize(`custom-comparator-${col.field}`, () => {
        return (valueA, valueB, nodeA, nodeB) => {
          const rawValueA = nodeA?.data?.[col?.field];
          const rawValueB = nodeB?.data?.[col?.field];
          const displayValueA = getDisplayValue(rawValueA);
          const displayValueB = getDisplayValue(rawValueB);
          
          // Handle null/undefined values
          if (displayValueA == null && displayValueB == null) return 0;
          if (displayValueA == null) return 1;
          if (displayValueB == null) return -1;
          
          // Use filter type to determine comparison method
          if (col?.customFilterType === "agDateColumnFilter") {
            const dateA = displayValueA ? new Date(displayValueA).getTime() : 0;
            const dateB = displayValueB ? new Date(displayValueB).getTime() : 0;
            return dateA - dateB;
          } else if (col?.customFilterType === "agNumberColumnFilter") {
            const numA = displayValueA != null ? parseFloat(displayValueA) : 0;
            const numB = displayValueB != null ? parseFloat(displayValueB) : 0;
            if (isNaN(numA) && isNaN(numB)) return 0;
            if (isNaN(numA)) return 1;
            if (isNaN(numB)) return -1;
            return numA - numB;
          } else {
            // Text comparison
            return String(displayValueA).localeCompare(String(displayValueB));
          }
        };
      });
    }
  } else {
    // Add custom comparator based on filter type for proper sorting (when not using display value)
    if (col?.sortable && col?.customFilterType) {
      if (col.customFilterType === "agDateColumnFilter") {
        customColumn.comparator = createDateComparator();
      } else if (col.customFilterType === "agNumberColumnFilter") {
        customColumn.comparator = memoize(`number-comparator-${col.field}`, () => {
          return (valueA, valueB) => {
            const numA = valueA != null ? parseFloat(valueA) : 0;
            const numB = valueB != null ? parseFloat(valueB) : 0;
            if (isNaN(numA) && isNaN(numB)) return 0;
            if (isNaN(numA)) return 1;
            if (isNaN(numB)) return -1;
            return numA - numB;
          };
        });
      }
    }
  }
  
  return customColumn;
}

// Date column factory
export function createDateColumnDef(col, commonProperties, resolveMappingFormula) {
  const validationFn = createValidationFunction(col, resolveMappingFormula);
  const formatter = createDateFormatter(col);
  const comparator = createDateComparator();
  
  return {
    ...commonProperties,
    headerName: col?.headerName,
    field: col?.field,
    sortable: col?.sortable,
    filter: col?.filter ? 'agDateColumnFilter' : false,
    editable: col?.editable,
    cellEditor: 'DateCellEditor',
    cellEditorParams: {
      isDateTime: col?.cellDataType === 'dateTime',
      getValidationErrors: (params) => {
        return validationFn(params.value, params.data);
      },
    },
    valueFormatter: (params) => formatter(params.value),
    comparator: comparator,
  };
}

// Currency column factory
export function createCurrencyColumnDef(col, commonProperties, resolveMappingFormula) {
  const validationFn = createValidationFunction(col, resolveMappingFormula);
  const formatter = createCurrencyFormatter(col);
  const comparator = createCurrencyComparator(col);
  const valueGetter = createCurrencyValueGetter(col);
  const valueParser = createCurrencyValueParser();
  
  return {
    ...commonProperties,
    headerName: col?.headerName,
    field: col?.field,
    sortable: col?.sortable,
    filter: col?.filter ? 'agNumberColumnFilter' : false,
    editable: col?.editable,
    cellEditorParams: {
      getValidationErrors: (params) => {
        return validationFn(params.value, params.data);
      },
    },
    // Format display: convert cents to formatted currency
    valueFormatter: (params) => formatter(params, resolveMappingFormula),
    // Get display value for sorting (cents / 100)
    valueGetter: valueGetter,
    // Get display value for filtering (user types 12, not 1200)
    filterValueGetter: valueGetter,
    // Parse user input: convert display value (e.g., "12") back to cents (1200)
    valueParser: valueParser,
    // Custom comparator for proper numeric sorting using display values
    comparator: comparator,
  };
}

// Image column factory
export function createImageColumnDef(col, commonProperties) {
  return {
    ...commonProperties,
    headerName: col?.headerName,
    field: col?.field,
    cellRenderer: "ImageCellRenderer",
    cellRendererParams: {
      width: col?.imageWidth,
      height: col?.imageHeight,
    },
  };
}

// ---------------------------------------------------------------------------
// Select column helpers
// ---------------------------------------------------------------------------

/**
 * Create a memoized label-from-value getter for a select column.
 *
 * The returned function `(value, options) => label` builds an O(1) Map from
 * option-value → option-label the *first* time it sees a given `options`
 * array reference, then returns cached results for every subsequent call.
 * Each call with the same options reference is therefore O(1) instead of
 * O(n_options) — critical when this runs inside AG Grid's valueGetter for
 * every visible row.
 *
 * The internal WeakMap is scoped to the factory closure so that a formula
 * change (which produces a new cacheKey → new closure) automatically starts
 * with a fresh WeakMap, preventing stale label data.
 *
 * @param {object}   col                  - Column configuration
 * @param {Function} resolveMappingFormula - Formula resolver from the component
 * @returns {(value: any, options: any[]) => string}
 */
export function createSelectLabelGetter(col, resolveMappingFormula) {
  const valueFormulaCode = col?.optionsValueFormula?.code ?? '';
  const labelFormulaCode = col?.optionsLabelFormula?.code ?? '';
  const cacheKey = `select-label-getter-${col.field}-${valueFormulaCode}-${labelFormulaCode}`;

  return memoize(cacheKey, () => {
    // Scoped to this closure: invalidated automatically when the memoize key
    // changes (i.e. when formula config changes and clearColumnCache() is called).
    const labelByOptions = new WeakMap();

    return (value, options) => {
      if (value == null || value === '') return '';
      if (!options || !options.length) return String(value);

      // Build or reuse the lookup map for this exact options array instance.
      let lookupMap = labelByOptions.get(options);
      if (!lookupMap) {
        lookupMap = new Map();
        for (const option of options) {
          const optValue = resolveMappingFormula(col?.optionsValueFormula, option) ?? option.value;
          const optLabel = resolveMappingFormula(col?.optionsLabelFormula, option) ?? option.label;
          const k = optValue != null ? String(optValue) : '';
          const v = optLabel != null ? String(optLabel) : (k || '');
          lookupMap.set(k, v);
        }
        labelByOptions.set(options, lookupMap);
      }

      const strValue = String(value);
      return lookupMap.has(strValue) ? lookupMap.get(strValue) : String(value);
    };
  });
}

// ---------------------------------------------------------------------------
// User column helpers
// ---------------------------------------------------------------------------

// Module-level WeakMap: users array ref → Map<userId, displayName>.
// userId→name mappings are intrinsic to the user objects, not formula-dependent,
// so they can safely be shared across closures for the same users array.
const userNameLookupCache = new WeakMap();

/**
 * Create a memoized user-name-from-id getter for a user column.
 *
 * The returned function `(userId, users) => name` builds an O(1) Map from
 * userId → display-name the *first* time it sees a given `users` array
 * reference, then returns cached results for every subsequent call.
 *
 * @param {object} col - Column configuration
 * @returns {(userId: string, users: any[]) => string}
 */
export function createUserNameGetter(col) {
  const cacheKey = `user-name-getter-${col.field}`;

  return memoize(cacheKey, () => {
    return (userId, users) => {
      if (!userId) return '';
      if (!users || !users.length) return String(userId);

      // Build or reuse the lookup map for this exact users array instance.
      let lookupMap = userNameLookupCache.get(users);
      if (!lookupMap) {
        lookupMap = new Map();
        for (const user of users) {
          if (!user?.id) continue;
          let name;
          if (user.name) {
            name = user.name;
          } else if (user.firstname || user.lastname) {
            name = [user.firstname, user.lastname].filter(Boolean).join(' ');
          } else {
            name = user.email || String(user.id);
          }
          lookupMap.set(String(user.id), name);
        }
        userNameLookupCache.set(users, lookupMap);
      }

      const strId = String(userId);
      return lookupMap.has(strId) ? lookupMap.get(strId) : strId;
    };
  });
}

/**
 * Create a memoized user-IDs extractor for a user column.
 *
 * The returned function `(rawValue) => ids` applies the column's
 * `userIdFormula` to extract user ID(s) from a potentially nested cell value
 * (e.g. Supabase junction-table joins), falling back to the raw value when
 * the formula returns nothing.
 *
 * The closure is memoized per (field, formula) so it is not recreated on
 * every columnDefs recompute.
 *
 * @param {object}   col                  - Column configuration
 * @param {Function} resolveMappingFormula - Formula resolver from the component
 * @returns {(rawValue: any) => any}
 */
export function createUserIdsExtractor(col, resolveMappingFormula) {
  const userIdFormula = col?.userIdFormula || { type: 'f', code: 'context.mapping' };
  const formulaCode = userIdFormula?.code ?? '';
  const cacheKey = `user-ids-extractor-${col.field}-${formulaCode}`;

  return memoize(cacheKey, () => {
    return (rawValue) => {
      if (!rawValue) return null;
      const extracted = resolveMappingFormula(userIdFormula, rawValue);
      return extracted ?? rawValue;
    };
  });
}

// Clear all caches (call when major dependencies change)
export function clearAllCaches() {
  clearColumnCache();
  intlFormatters.clear();
  clearCellDisplayCache();
}