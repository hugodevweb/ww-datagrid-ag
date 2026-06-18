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
    filtersTab: 'Filters',
    groupBy: 'Group by',
    noGrouping: 'No grouping',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
    noSelectColumns: 'No select-type columns are available to group by.',
    groupsOrder: 'Order',
    showUnassigned: 'Show unassigned group',
    itemCountOne: '{count} item',
    itemCountMany: '{count} items',
    kanbanConfigure: 'Configure',
    kanbanConfigureFull: 'Configure kanban',
    kanbanSettings: 'Kanban settings',
    kanbanClose: 'Close',
    kanbanGroupTab: 'Group',
    kanbanFieldsTab: 'Card fields',
    kanbanEmptyTitle: 'Configure your kanban',
    kanbanEmptySubtitle: 'Pick a status field and the fields shown on each card from the configuration panel.',
    kanbanEmptyBtn: 'Open settings',
    kanbanBoardEmpty: 'The selected status field has no options to display.',
    kanbanDropHere: 'Drop cards here',
    kanbanShowUnassigned: 'Show unassigned',
    kanbanNoSelectColumns: 'No select-type columns available. Add a "select" column to enable grouping.',
    kanbanFieldsSearch: 'Search fields',
    kanbanFieldsCounter: '{count} / {max} selected',
    kanbanFieldsHint: 'First field becomes the card title',
    kanbanTitleBadge: 'Title',
    kanbanNoFieldsMatch: 'No fields match.',
    kanbanUnassigned: 'Unassigned',
    kanbanMaxFields: 'Maximum {max} fields',
    kanbanShowGroup: 'Show group',
    kanbanHideGroup: 'Hide group',
    calendarEmptyTitle: 'Configure your calendar',
    calendarEmptySubtitle: 'Pick a date or timestamp column and the fields shown on each event from the configuration panel.',
    calendarPrev: 'Previous',
    calendarNext: 'Next',
    calendarToday: 'Today',
    calendarFrame_day: 'Day',
    calendarFrame_week: 'Week',
    calendarFrame_month: 'Month',
    calendarFrame_year: 'Year',
    calendarFrame_custom: 'Custom',
    calendarFrom: 'From',
    calendarTo: 'To',
    calendarMore: '+{count} more',
    calendarNoEvents: 'No events in this period.',
    calendarSettings: 'Calendar settings',
    calendarDateTab: 'Date',
    calendarFieldsTab: 'Event fields',
    calendarDateSource: 'Date source',
    calendarNoDateField: 'No date field',
    calendarColorBy: 'Color by',
    calendarNoColor: 'No color',
    calendarDefaultViewLabel: 'Default view',
    calendarWeekStartsMonday: 'Week starts on Monday',
    calendarNoDateColumns: 'No date or timestamp columns available. Add a "Date" or "Date & time" column to use the calendar.',
    calendarFieldsHint: 'First field becomes the event title',
  },
  fr: {
    reset: 'Réinitialiser',
    apply: 'Appliquer',
    manageColumns: 'Gérer les colonnes',
    search: 'Rechercher...',
    noColumnsMatch: 'Aucune colonne ne correspond à "{searchTerm}"',
    columnsTab: 'Colonnes',
    groupingTab: 'Regroupement',
    filtersTab: 'Filtres',
    groupBy: 'Grouper par',
    noGrouping: 'Aucun groupement',
    collapseAll: 'Tout replier',
    expandAll: 'Tout déplier',
    noSelectColumns: "Aucune colonne de type 'select' n'est disponible pour le regroupement.",
    groupsOrder: 'Ordre',
    showUnassigned: 'Afficher le groupe non assigné',
    itemCountOne: '{count} élément',
    itemCountMany: '{count} éléments',
    kanbanConfigure: 'Configurer',
    kanbanConfigureFull: 'Configurer le kanban',
    kanbanSettings: 'Paramètres du kanban',
    kanbanClose: 'Fermer',
    kanbanGroupTab: 'Groupe',
    kanbanFieldsTab: 'Champs des cartes',
    kanbanEmptyTitle: 'Configurez votre kanban',
    kanbanEmptySubtitle: 'Choisissez un champ de statut et les champs affichés sur chaque carte depuis le panneau de configuration.',
    kanbanEmptyBtn: 'Ouvrir les paramètres',
    kanbanBoardEmpty: 'Le champ de statut sélectionné n\'a aucune option à afficher.',
    kanbanDropHere: 'Déposer les cartes ici',
    kanbanShowUnassigned: 'Afficher non assigné',
    kanbanNoSelectColumns: 'Aucune colonne de type "select" disponible. Ajoutez-en une pour activer le regroupement.',
    kanbanFieldsSearch: 'Rechercher des champs',
    kanbanFieldsCounter: '{count} / {max} sélectionnés',
    kanbanFieldsHint: 'Le premier champ devient le titre de la carte',
    kanbanTitleBadge: 'Titre',
    kanbanNoFieldsMatch: 'Aucun champ ne correspond.',
    kanbanUnassigned: 'Non assigné',
    kanbanMaxFields: 'Maximum {max} champs',
    kanbanShowGroup: 'Afficher le groupe',
    kanbanHideGroup: 'Masquer le groupe',
    calendarEmptyTitle: 'Configurez votre calendrier',
    calendarEmptySubtitle: "Choisissez une colonne de date ou d'horodatage et les champs affichés sur chaque événement depuis le panneau de configuration.",
    calendarPrev: 'Précédent',
    calendarNext: 'Suivant',
    calendarToday: "Aujourd'hui",
    calendarFrame_day: 'Jour',
    calendarFrame_week: 'Semaine',
    calendarFrame_month: 'Mois',
    calendarFrame_year: 'Année',
    calendarFrame_custom: 'Personnalisé',
    calendarFrom: 'Du',
    calendarTo: 'Au',
    calendarMore: '+{count} de plus',
    calendarNoEvents: 'Aucun événement sur cette période.',
    calendarSettings: 'Paramètres du calendrier',
    calendarDateTab: 'Date',
    calendarFieldsTab: "Champs de l'événement",
    calendarDateSource: 'Source de date',
    calendarNoDateField: 'Aucun champ de date',
    calendarColorBy: 'Couleur par',
    calendarNoColor: 'Aucune couleur',
    calendarDefaultViewLabel: 'Vue par défaut',
    calendarWeekStartsMonday: 'La semaine commence le lundi',
    calendarNoDateColumns: 'Aucune colonne de date ou d\'horodatage disponible. Ajoutez une colonne « Date » ou « Date et heure » pour utiliser le calendrier.',
    calendarFieldsHint: "Le premier champ devient le titre de l'événement",
  },
  es: {
    reset: 'Restablecer',
    apply: 'Aplicar',
    manageColumns: 'Gestionar columnas',
    search: 'Buscar...',
    noColumnsMatch: 'Ninguna columna coincide con "{searchTerm}"',
    columnsTab: 'Columnas',
    groupingTab: 'Agrupación',
    filtersTab: 'Filtros',
    groupBy: 'Agrupar por',
    noGrouping: 'Sin agrupación',
    collapseAll: 'Contraer todo',
    expandAll: 'Expandir todo',
    noSelectColumns: 'No hay columnas de tipo select disponibles para agrupar.',
    groupsOrder: 'Orden',
    showUnassigned: 'Mostrar grupo sin asignar',
    itemCountOne: '{count} elemento',
    itemCountMany: '{count} elementos',
    kanbanConfigure: 'Configurar',
    kanbanConfigureFull: 'Configurar kanban',
    kanbanSettings: 'Configuración del kanban',
    kanbanClose: 'Cerrar',
    kanbanGroupTab: 'Grupo',
    kanbanFieldsTab: 'Campos de la tarjeta',
    kanbanEmptyTitle: 'Configura tu kanban',
    kanbanEmptySubtitle: 'Elige un campo de estado y los campos mostrados en cada tarjeta desde el panel de configuración.',
    kanbanEmptyBtn: 'Abrir ajustes',
    kanbanBoardEmpty: 'El campo de estado seleccionado no tiene opciones para mostrar.',
    kanbanDropHere: 'Soltar tarjetas aquí',
    kanbanShowUnassigned: 'Mostrar sin asignar',
    kanbanNoSelectColumns: 'No hay columnas de tipo "select" disponibles. Añade una para habilitar la agrupación.',
    kanbanFieldsSearch: 'Buscar campos',
    kanbanFieldsCounter: '{count} / {max} seleccionados',
    kanbanFieldsHint: 'El primer campo se convierte en el título de la tarjeta',
    kanbanTitleBadge: 'Título',
    kanbanNoFieldsMatch: 'Ningún campo coincide.',
    kanbanUnassigned: 'Sin asignar',
    kanbanMaxFields: 'Máximo {max} campos',
    kanbanShowGroup: 'Mostrar grupo',
    kanbanHideGroup: 'Ocultar grupo',
    calendarEmptyTitle: 'Configura tu calendario',
    calendarEmptySubtitle: 'Elige una columna de fecha o marca de tiempo y los campos mostrados en cada evento desde el panel de configuración.',
    calendarPrev: 'Anterior',
    calendarNext: 'Siguiente',
    calendarToday: 'Hoy',
    calendarFrame_day: 'Día',
    calendarFrame_week: 'Semana',
    calendarFrame_month: 'Mes',
    calendarFrame_year: 'Año',
    calendarFrame_custom: 'Personalizado',
    calendarFrom: 'Desde',
    calendarTo: 'Hasta',
    calendarMore: '+{count} más',
    calendarNoEvents: 'No hay eventos en este período.',
    calendarSettings: 'Configuración del calendario',
    calendarDateTab: 'Fecha',
    calendarFieldsTab: 'Campos del evento',
    calendarDateSource: 'Fuente de fecha',
    calendarNoDateField: 'Sin campo de fecha',
    calendarColorBy: 'Color por',
    calendarNoColor: 'Sin color',
    calendarDefaultViewLabel: 'Vista predeterminada',
    calendarWeekStartsMonday: 'La semana empieza el lunes',
    calendarNoDateColumns: 'No hay columnas de fecha o marca de tiempo disponibles. Añade una columna "Fecha" o "Fecha y hora" para usar el calendario.',
    calendarFieldsHint: 'El primer campo se convierte en el título del evento',
  },
  de: {
    reset: 'Zurücksetzen',
    apply: 'Anwenden',
    manageColumns: 'Spalten verwalten',
    search: 'Suchen...',
    noColumnsMatch: 'Keine Spalten entsprechen "{searchTerm}"',
    columnsTab: 'Spalten',
    groupingTab: 'Gruppierung',
    filtersTab: 'Filter',
    groupBy: 'Gruppieren nach',
    noGrouping: 'Keine Gruppierung',
    collapseAll: 'Alle einklappen',
    expandAll: 'Alle ausklappen',
    noSelectColumns: 'Keine Auswahl-Spalten zum Gruppieren verfügbar.',
    groupsOrder: 'Reihenfolge',
    showUnassigned: 'Nicht zugewiesene Gruppe anzeigen',
    itemCountOne: '{count} Element',
    itemCountMany: '{count} Elemente',
    kanbanConfigure: 'Konfigurieren',
    kanbanConfigureFull: 'Kanban konfigurieren',
    kanbanSettings: 'Kanban-Einstellungen',
    kanbanClose: 'Schließen',
    kanbanGroupTab: 'Gruppe',
    kanbanFieldsTab: 'Kartenfelder',
    kanbanEmptyTitle: 'Kanban konfigurieren',
    kanbanEmptySubtitle: 'Wählen Sie ein Statusfeld und die auf jeder Karte angezeigten Felder im Konfigurationsbereich aus.',
    kanbanEmptyBtn: 'Einstellungen öffnen',
    kanbanBoardEmpty: 'Das gewählte Statusfeld hat keine Optionen zum Anzeigen.',
    kanbanDropHere: 'Karten hier ablegen',
    kanbanShowUnassigned: 'Nicht zugewiesen anzeigen',
    kanbanNoSelectColumns: 'Keine Spalten vom Typ "select" verfügbar. Fügen Sie eine hinzu, um die Gruppierung zu aktivieren.',
    kanbanFieldsSearch: 'Felder suchen',
    kanbanFieldsCounter: '{count} / {max} ausgewählt',
    kanbanFieldsHint: 'Das erste Feld wird zum Kartentitel',
    kanbanTitleBadge: 'Titel',
    kanbanNoFieldsMatch: 'Keine Felder entsprechen.',
    kanbanUnassigned: 'Nicht zugewiesen',
    kanbanMaxFields: 'Maximal {max} Felder',
    kanbanShowGroup: 'Gruppe anzeigen',
    kanbanHideGroup: 'Gruppe ausblenden',
    calendarEmptyTitle: 'Kalender konfigurieren',
    calendarEmptySubtitle: 'Wählen Sie eine Datums- oder Zeitstempelspalte und die auf jedem Ereignis angezeigten Felder im Konfigurationsbereich aus.',
    calendarPrev: 'Zurück',
    calendarNext: 'Weiter',
    calendarToday: 'Heute',
    calendarFrame_day: 'Tag',
    calendarFrame_week: 'Woche',
    calendarFrame_month: 'Monat',
    calendarFrame_year: 'Jahr',
    calendarFrame_custom: 'Benutzerdefiniert',
    calendarFrom: 'Von',
    calendarTo: 'Bis',
    calendarMore: '+{count} mehr',
    calendarNoEvents: 'Keine Ereignisse in diesem Zeitraum.',
    calendarSettings: 'Kalendereinstellungen',
    calendarDateTab: 'Datum',
    calendarFieldsTab: 'Ereignisfelder',
    calendarDateSource: 'Datumsquelle',
    calendarNoDateField: 'Kein Datumsfeld',
    calendarColorBy: 'Farbe nach',
    calendarNoColor: 'Keine Farbe',
    calendarDefaultViewLabel: 'Standardansicht',
    calendarWeekStartsMonday: 'Woche beginnt am Montag',
    calendarNoDateColumns: 'Keine Datums- oder Zeitstempelspalten verfügbar. Fügen Sie eine "Datum"- oder "Datum & Zeit"-Spalte hinzu, um den Kalender zu nutzen.',
    calendarFieldsHint: 'Das erste Feld wird zum Ereignistitel',
  },
  pt: {
    reset: 'Redefinir',
    apply: 'Aplicar',
    manageColumns: 'Gerenciar colunas',
    search: 'Pesquisar...',
    noColumnsMatch: 'Nenhuma coluna corresponde a "{searchTerm}"',
    columnsTab: 'Colunas',
    groupingTab: 'Agrupamento',
    filtersTab: 'Filtros',
    groupBy: 'Agrupar por',
    noGrouping: 'Sem agrupamento',
    collapseAll: 'Recolher tudo',
    expandAll: 'Expandir tudo',
    noSelectColumns: 'Nenhuma coluna do tipo select disponível para agrupar.',
    groupsOrder: 'Ordem',
    showUnassigned: 'Mostrar grupo não atribuído',
    itemCountOne: '{count} item',
    itemCountMany: '{count} itens',
    kanbanConfigure: 'Configurar',
    kanbanConfigureFull: 'Configurar kanban',
    kanbanSettings: 'Configurações do kanban',
    kanbanClose: 'Fechar',
    kanbanGroupTab: 'Grupo',
    kanbanFieldsTab: 'Campos do cartão',
    kanbanEmptyTitle: 'Configure seu kanban',
    kanbanEmptySubtitle: 'Escolha um campo de status e os campos exibidos em cada cartão no painel de configuração.',
    kanbanEmptyBtn: 'Abrir configurações',
    kanbanBoardEmpty: 'O campo de status selecionado não tem opções para exibir.',
    kanbanDropHere: 'Solte os cartões aqui',
    kanbanShowUnassigned: 'Mostrar não atribuído',
    kanbanNoSelectColumns: 'Nenhuma coluna do tipo "select" disponível. Adicione uma para ativar o agrupamento.',
    kanbanFieldsSearch: 'Buscar campos',
    kanbanFieldsCounter: '{count} / {max} selecionados',
    kanbanFieldsHint: 'O primeiro campo se torna o título do cartão',
    kanbanTitleBadge: 'Título',
    kanbanNoFieldsMatch: 'Nenhum campo corresponde.',
    kanbanUnassigned: 'Não atribuído',
    kanbanMaxFields: 'Máximo {max} campos',
    kanbanShowGroup: 'Mostrar grupo',
    kanbanHideGroup: 'Ocultar grupo',
    calendarEmptyTitle: 'Configure seu calendário',
    calendarEmptySubtitle: 'Escolha uma coluna de data ou de carimbo de data/hora e os campos exibidos em cada evento no painel de configuração.',
    calendarPrev: 'Anterior',
    calendarNext: 'Próximo',
    calendarToday: 'Hoje',
    calendarFrame_day: 'Dia',
    calendarFrame_week: 'Semana',
    calendarFrame_month: 'Mês',
    calendarFrame_year: 'Ano',
    calendarFrame_custom: 'Personalizado',
    calendarFrom: 'De',
    calendarTo: 'Até',
    calendarMore: '+{count} mais',
    calendarNoEvents: 'Nenhum evento neste período.',
    calendarSettings: 'Configurações do calendário',
    calendarDateTab: 'Data',
    calendarFieldsTab: 'Campos do evento',
    calendarDateSource: 'Fonte de data',
    calendarNoDateField: 'Nenhum campo de data',
    calendarColorBy: 'Cor por',
    calendarNoColor: 'Sem cor',
    calendarDefaultViewLabel: 'Vista padrão',
    calendarWeekStartsMonday: 'A semana começa na segunda-feira',
    calendarNoDateColumns: 'Nenhuma coluna de data ou carimbo de data/hora disponível. Adicione uma coluna "Data" ou "Data e hora" para usar o calendário.',
    calendarFieldsHint: 'O primeiro campo se torna o título do evento',
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