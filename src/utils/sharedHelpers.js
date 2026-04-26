// Shared utilities to eliminate code duplication across the component

/**
 * Translation utilities for filter buttons and UI text
 */
export const translations = {
  en: {
    reset: 'Reset',
    apply: 'Apply',
    manageColumns: 'Manage columns',
    search: 'Search...',
    noColumnsMatch: 'No columns match "{searchTerm}"',
    columnsTab: 'Columns',
    groupingTab: 'Grouping',
    groupBy: 'Group by',
    noGrouping: 'No grouping',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
    noSelectColumns: 'No select-type columns are available to group by.',
    groupsOrder: 'Order',
    showUnassigned: 'Show unassigned group',
    itemCountOne: '{count} item',
    itemCountMany: '{count} items',
  },
  fr: {
    reset: 'Réinitialiser',
    apply: 'Appliquer',
    manageColumns: 'Gérer les colonnes',
    search: 'Rechercher...',
    noColumnsMatch: 'Aucune colonne ne correspond à "{searchTerm}"',
    columnsTab: 'Colonnes',
    groupingTab: 'Regroupement',
    groupBy: 'Grouper par',
    noGrouping: 'Aucun groupement',
    collapseAll: 'Tout replier',
    expandAll: 'Tout déplier',
    noSelectColumns: "Aucune colonne de type 'select' n'est disponible pour le regroupement.",
    groupsOrder: 'Ordre',
    showUnassigned: 'Afficher le groupe non assigné',
    itemCountOne: '{count} élément',
    itemCountMany: '{count} éléments',
  },
  es: {
    reset: 'Restablecer',
    apply: 'Aplicar',
    manageColumns: 'Gestionar columnas',
    search: 'Buscar...',
    noColumnsMatch: 'Ninguna columna coincide con "{searchTerm}"',
    columnsTab: 'Columnas',
    groupingTab: 'Agrupación',
    groupBy: 'Agrupar por',
    noGrouping: 'Sin agrupación',
    collapseAll: 'Contraer todo',
    expandAll: 'Expandir todo',
    noSelectColumns: 'No hay columnas de tipo select disponibles para agrupar.',
    groupsOrder: 'Orden',
    showUnassigned: 'Mostrar grupo sin asignar',
    itemCountOne: '{count} elemento',
    itemCountMany: '{count} elementos',
  },
  de: {
    reset: 'Zurücksetzen',
    apply: 'Anwenden',
    manageColumns: 'Spalten verwalten',
    search: 'Suchen...',
    noColumnsMatch: 'Keine Spalten entsprechen "{searchTerm}"',
    columnsTab: 'Spalten',
    groupingTab: 'Gruppierung',
    groupBy: 'Gruppieren nach',
    noGrouping: 'Keine Gruppierung',
    collapseAll: 'Alle einklappen',
    expandAll: 'Alle ausklappen',
    noSelectColumns: 'Keine Auswahl-Spalten zum Gruppieren verfügbar.',
    groupsOrder: 'Reihenfolge',
    showUnassigned: 'Nicht zugewiesene Gruppe anzeigen',
    itemCountOne: '{count} Element',
    itemCountMany: '{count} Elemente',
  },
  pt: {
    reset: 'Redefinir',
    apply: 'Aplicar',
    manageColumns: 'Gerenciar colunas',
    search: 'Pesquisar...',
    noColumnsMatch: 'Nenhuma coluna corresponde a "{searchTerm}"',
    columnsTab: 'Colunas',
    groupingTab: 'Agrupamento',
    groupBy: 'Agrupar por',
    noGrouping: 'Sem agrupamento',
    collapseAll: 'Recolher tudo',
    expandAll: 'Expandir tudo',
    noSelectColumns: 'Nenhuma coluna do tipo select disponível para agrupar.',
    groupsOrder: 'Ordem',
    showUnassigned: 'Mostrar grupo não atribuído',
    itemCountOne: '{count} item',
    itemCountMany: '{count} itens',
  },
};

/**
 * Get translations for a specific language
 * @param {string} lang - Language code (en, fr, es, de, pt)
 * @returns {object} Translation object
 */
export function getTranslations(lang) {
  return translations[lang] || translations.en;
}

/**
 * Get filter button translations (legacy compatibility)
 * @param {string} lang - Language code
 * @returns {object} Filter button translations
 */
export function getFilterTranslations(lang) {
  const t = getTranslations(lang);
  return { reset: t.reset, apply: t.apply };
}

/**
 * Extract user ID(s) from raw cell value using userIdFormula
 * @param {any} rawValue - Raw cell value 
 * @param {object} rowData - Row data context
 * @param {function} resolveMappingFormula - Formula resolver function
 * @param {object} userIdFormula - User ID extraction formula
 * @returns {any} Extracted user ID(s)
 */
export function extractUserIds(rawValue, rowData, resolveMappingFormula, userIdFormula) {
  if (!rawValue) return null;
  
  // Apply userIdFormula to extract user ID(s) from potentially nested structures
  const extractedValue = resolveMappingFormula(userIdFormula, rawValue);
  
  // Return the extracted value, or fallback to raw value if formula returns null/undefined
  return extractedValue ?? rawValue;
}

/**
 * Get user name from user object
 * @param {object} user - User object
 * @returns {string} Formatted user name
 */
export function getUserName(user) {
  if (!user) return '';
  if (user.name) return user.name;
  if (user.firstname || user.lastname) {
    return [user.firstname, user.lastname].filter(Boolean).join(' ');
  }
  return user.email || user.id || '';
}

/**
 * Find user ID by name in users array
 * @param {string} name - User name to search for
 * @param {Array} users - Array of user objects
 * @returns {string|null} User ID if found, null otherwise
 */
export function findUserIdByName(name, users) {
  if (!name || !users || !Array.isArray(users)) return null;
  
  const user = users.find(u => {
    const userName = getUserName(u);
    return userName === name || u.id === name || u.email === name;
  });
  return user?.id || null;
}

/**
 * Create fake junction record structure based on userIdFormula
 * This handles many-to-many relationships by creating nested objects
 * that match the expected structure for Supabase joins
 * 
 * @param {string} userId - User ID to create record for
 * @param {object} userIdFormula - Formula defining the nested structure
 * @returns {object} Fake junction record
 */
export function createFakeJunctionRecord(userId, userIdFormula) {
  // Parse the formula code to understand the nested structure
  const formulaCode = userIdFormula?.code || '';
  
  // Extract path from formula (e.g., "profile.id" from "context.mapping?.profile?.id")
  // Pattern: mapping?.profile?.id or mapping?.['profile']?.['id'] or mapping?.profile?.['id']
  const pathMatch = formulaCode.match(/mapping\?\.?\[?['"]?(\w+)['"]?\]?\?\.?\[?['"]?(\w+)['"]?\]?/);
  
  if (pathMatch && pathMatch.length >= 3) {
    const [, ...pathParts] = pathMatch;
    const path = pathParts.filter(Boolean);
    
    if (path.length > 0) {
      // Create nested structure: { [path[0]]: { [path[1]]: userId } }
      const result = {};
      let current = result;
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = userId;
      return result;
    }
  }
  
  // Fallback: try common patterns
  if (formulaCode.includes('profile') && formulaCode.includes('id')) {
    return { profile: { id: userId } };
  }
  
  // Default: return simple structure with id
  return { id: userId };
}

/**
 * Normalize old value for user columns (convert display names to IDs)
 * @param {any} oldValue - Raw old value from AG Grid event
 * @param {object} columnConfig - Column configuration
 * @param {function} resolveMappingFormula - Formula resolver function
 * @returns {any} Normalized old value (user ID or array of IDs)
 */
export function normalizeUserColumnOldValue(oldValue, columnConfig, resolveMappingFormula) {
  if (!columnConfig || columnConfig.cellDataType !== 'user') {
    return oldValue;
  }

  const userIdFormula = columnConfig?.userIdFormula || { type: 'f', code: 'context.mapping' };
  const users = columnConfig?.users || [];
  const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;

  // Check if oldValue looks like a display value (names) or if it's already IDs
  const isDisplayValue = typeof oldValue === 'string' && 
    (oldValue.includes(',') || (oldValue.includes(' ') && !oldValue.match(/^[a-f0-9-]{36}$/i)));

  let normalizedOldValue;

  if (isDisplayValue) {
    // oldValue appears to be display names - convert to IDs
    if (oldValue.includes(',')) {
      // Multiple users: comma-separated names
      const names = oldValue.split(',').map(n => n.trim()).filter(Boolean);
      const ids = names.map(name => findUserIdByName(name, users)).filter(id => id != null);
      normalizedOldValue = ids.length > 0 ? ids : null;
    } else {
      // Single user: name
      normalizedOldValue = findUserIdByName(oldValue, users);
    }
  } else {
    // oldValue might already be IDs - extract using formula if needed
    normalizedOldValue = extractUserIds(oldValue, null, resolveMappingFormula, userIdFormula);
    
    // If extraction returned the same value and it's a string, check if it's a name
    if (normalizedOldValue === oldValue && typeof oldValue === 'string' && users.length > 0) {
      // Check if it's already a valid ID
      const isValidId = users.some(u => u.id === oldValue);
      if (!isValidId) {
        // Might be a name - try to find ID
        const foundId = findUserIdByName(oldValue, users);
        if (foundId) {
          normalizedOldValue = foundId;
        }
      }
    }
  }

  // Ensure format matches expectations: Single user: string ID, Multiple users: array of string IDs
  if (isMultiple) {
    // Ensure it's an array
    if (Array.isArray(normalizedOldValue)) {
      return normalizedOldValue;
    } else if (normalizedOldValue != null) {
      return [normalizedOldValue];
    } else {
      return [];
    }
  } else {
    // Ensure it's a single value (not array)
    if (Array.isArray(normalizedOldValue) && normalizedOldValue.length > 0) {
      return normalizedOldValue[0];
    } else {
      return normalizedOldValue;
    }
  }
}

/**
 * Check if two values are equal (handles both primitive values and arrays)
 * @param {any} a - First value
 * @param {any} b - Second value  
 * @returns {boolean} True if values are equal
 */
export function valuesEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
  return false;
}

/**
 * Create a stable cache key from multiple values
 * @param {...any} values - Values to create cache key from
 * @returns {string} Cache key
 */
export function createCacheKey(...values) {
  return values
    .map(val => {
      if (val === null || val === undefined) return 'null';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    })
    .join('|');
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}