// Cell value utilities for breaking down onCellValueChanged and setCellValue functions

import {
  extractUserIds,
  getUserName,
  findUserIdByName,
  createFakeJunctionRecord,
  normalizeUserColumnOldValue,
  valuesEqual
} from './sharedHelpers.js';

/**
 * Detect column type and configuration from the columns array
 * @param {string} field - Field name
 * @param {Array} columns - Columns configuration array
 * @returns {Object|null} Column configuration object
 */
export function detectColumnConfig(field, columns) {
  if (!field || !columns || !Array.isArray(columns)) {
    return null;
  }

  return columns.find(col => col?.field === field) || null;
}

/**
 * Process user column value changes
 * @param {Object} params - Processing parameters
 * @param {any} params.newValue - New cell value
 * @param {any} params.oldValue - Old cell value
 * @param {Object} params.columnConfig - Column configuration
 * @param {Function} params.resolveMappingFormula - Formula resolver
 * @param {Object} params.rowData - Row data context
 * @returns {Object} Processing result with normalized values and fake records
 */
export function processUserColumnChange(params) {
  const { newValue, oldValue, columnConfig, resolveMappingFormula, rowData } = params;
  
  const userIdFormula = columnConfig?.userIdFormula || { type: 'f', code: 'context.mapping' };
  const users = columnConfig?.users || [];
  const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;

  // Normalize old value (convert display names to IDs if needed)
  const normalizedOldValue = normalizeUserColumnOldValue(oldValue, columnConfig, resolveMappingFormula);

  // Process new value
  let userIds = [];
  if (Array.isArray(newValue)) {
    // Multiple users selected
    userIds = newValue
      .map(val => extractUserIds(val, rowData, resolveMappingFormula, userIdFormula))
      .filter(id => id != null)
      .flat();
  } else if (newValue != null) {
    // Single user selected
    const extractedId = extractUserIds(newValue, rowData, resolveMappingFormula, userIdFormula);
    if (extractedId != null) {
      userIds = Array.isArray(extractedId) ? extractedId : [extractedId];
    }
  }

  // Create fake junction records if needed
  let fakeJunctionRecord = null;
  if (userIds.length > 0) {
    const userIdFormulaForJunction = columnConfig?.userIdFormula || userIdFormula;
    
    if (isMultiple) {
      // Multiple users: array of nested structures
      fakeJunctionRecord = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormulaForJunction));
    } else {
      // Single user: single nested structure (not array)
      fakeJunctionRecord = createFakeJunctionRecord(userIds[0], userIdFormulaForJunction);
    }
  }

  return {
    normalizedOldValue,
    userIds,
    fakeJunctionRecord,
    isMultiple
  };
}

/**
 * Check if cell value change should trigger style redraw
 * @param {Object} content - Component content configuration
 * @returns {boolean} True if redraw is needed
 */
export function shouldRedrawForStyles(content) {
  return !!(content?.conditionalRowStyles && content.conditionalRowStyles.length > 0);
}

/**
 * Emit cell value changed event
 * @param {Object} params - Event parameters
 * @param {Function} params.emit - Vue emit function
 * @param {string} params.field - Field name
 * @param {any} params.newValue - New value
 * @param {any} params.oldValue - Old value
 * @param {Object} params.rowData - Row data
 * @param {string} params.rowId - Row ID
 */
export function emitCellValueChangedEvent(params) {
  const { emit, field, newValue, oldValue, rowData, rowId } = params;
  
  emit('trigger-event', {
    name: 'cell-value-changed',
    event: {
      field,
      newValue,
      oldValue,
      rowData,
      rowId
    }
  });
}

/**
 * Handle data update flag management
 * @param {Object} params - Flag management parameters
 * @param {Function} params.setUpdatingDataLocally - Setter function
 * @param {Function} params.debugLog - Debug logging function
 * @param {number} params.delay - Delay before clearing flag (default: 200ms)
 */
export function manageDataUpdateFlag(params) {
  const { setUpdatingDataLocally, debugLog, delay = 200 } = params;
  
  setUpdatingDataLocally(true);
  debugLog('[Cell Value Change] Set isUpdatingDataLocally flag to prevent recursive updates');
  
  // Clear flag after delay
  setTimeout(() => {
    setUpdatingDataLocally(false);
    debugLog('[Cell Value Change] Cleared isUpdatingDataLocally flag');
  }, delay);
}

/**
 * Process cell value based on column type
 * @param {Object} params - Processing parameters
 * @param {any} params.value - Input value
 * @param {Object} params.columnConfig - Column configuration
 * @param {Function} params.resolveMappingFormula - Formula resolver
 * @param {Object} params.rowData - Row data context
 * @returns {any} Processed value
 */
export function processValueByType(params) {
  const { value, columnConfig, resolveMappingFormula, rowData } = params;
  
  if (!columnConfig) {
    return value;
  }

  switch (columnConfig.cellDataType) {
    case 'user':
      return processUserColumnChange({
        newValue: value,
        oldValue: null,
        columnConfig,
        resolveMappingFormula,
        rowData
      }).fakeJunctionRecord;
      
    case 'number':
    case 'currency':
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numValue = Number(value);
      return isNaN(numValue) ? null : numValue;
      
    case 'boolean':
      if (value === null || value === undefined) {
        return null;
      }
      return Boolean(value);
      
    case 'dateString':
    case 'dateTime':
      if (!value) {
        return null;
      }
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
      
    default:
      return value;
  }
}

/**
 * Get row ID from row data using ID formula
 * @param {Object} rowData - Row data object
 * @param {Object} idFormula - ID extraction formula
 * @param {Function} resolveMappingFormula - Formula resolver
 * @returns {string|null} Row ID
 */
export function getRowId(rowData, idFormula, resolveMappingFormula) {
  if (!rowData) return null;
  
  let baseId = resolveMappingFormula(idFormula, rowData);
  
  // If formula returns the field name instead of value, try direct access
  if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
    baseId = rowData.id || rowData._id || rowData.uuid || rowData.ID || rowData.Id;
  }
  
  return baseId != null ? String(baseId) : null;
}