// Centralized row lookup utilities to eliminate O(n) duplicated forEachNode patterns

/**
 * Unified row node lookup utility
 * @param {Object} gridApi - AG Grid API instance
 * @param {string|number} rowId - The row ID to search for
 * @param {Function} resolveMappingFormula - Formula resolver function
 * @param {Object} content - Component content (for idFormula)
 * @returns {Object|null} - Row node if found, null otherwise
 */
export function findRowNode(gridApi, rowId, resolveMappingFormula, content) {
  if (!gridApi || rowId === null || rowId === undefined) {
    return null;
  }

  // Try direct lookup first (fastest path)
  const rowIdStr = String(rowId);
  let rowNode = gridApi.getRowNode(rowIdStr);
  if (rowNode) return rowNode;

  // Try alternative ID format (number vs string)
  const alternativeId = typeof rowId === 'number' ? String(rowId) : Number(rowId);
  if (!isNaN(alternativeId)) {
    rowNode = gridApi.getRowNode(String(alternativeId));
    if (rowNode) return rowNode;
  }

  // Last resort: search through all rows
  gridApi.forEachNode((node) => {
    if (!rowNode && node.data) {
      // Get the base ID using the same formula as getRowId
      let baseId = resolveMappingFormula(content?.idFormula, node.data);
      
      // If formula returns the field name instead of value, try direct access
      if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
        baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
      }
      
      // Convert to string for comparison
      const baseIdStr = baseId != null ? String(baseId) : '';
      
      // Try exact match with base ID
      if (baseIdStr === rowIdStr) {
        rowNode = node;
        return; // Break out of forEach
      }
      // Check if the provided rowId matches the start of node.id (hash-appended IDs)
      else if (node.id && String(node.id).startsWith(rowIdStr + '-')) {
        rowNode = node;
        return;
      }
      // Check exact match with node.id
      else if (node.id && String(node.id) === rowIdStr) {
        rowNode = node;
        return;
      }
      // Fallback: check if rowId exists as a property value in node.data
      else if (node.data && Object.values(node.data).some(val => String(val) === rowIdStr)) {
        rowNode = node;
        return;
      }
    }
  });

  return rowNode || null;
}

/**
 * Wait for a specific row to appear in the grid (useful after data refresh)
 * @param {Object} gridApi - AG Grid API instance  
 * @param {string|number} rowId - The row ID to wait for
 * @param {Function} resolveMappingFormula - Formula resolver function
 * @param {Object} content - Component content (for idFormula)
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} - Resolves to true if row found, rejects on timeout
 */
export function waitForRowInGrid(gridApi, rowId, resolveMappingFormula, content, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkRow = () => {
      // First ensure grid is ready
      if (!gridApi) {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for row ${rowId} to appear in grid`));
          return;
        }
        setTimeout(checkRow, 100);
        return;
      }
      
      // Try to find the row
      const rowNode = findRowNode(gridApi, rowId, resolveMappingFormula, content);
      
      if (rowNode) {
        resolve(true);
        return;
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for row ${rowId} to appear in grid`));
        return;
      }
      
      // Check again in a short interval
      setTimeout(checkRow, 150);
    };
    
    checkRow();
  });
}

/**
 * Get available row IDs for debugging purposes
 * @param {Object} gridApi - AG Grid API instance
 * @param {Function} resolveMappingFormula - Formula resolver function  
 * @param {Object} content - Component content (for idFormula)
 * @returns {Array} - Array of row ID info objects
 */
export function getAvailableRowIds(gridApi, resolveMappingFormula, content) {
  if (!gridApi) return [];
  
  const availableIds = [];
  gridApi.forEachNode((node) => {
    if (node.data) {
      let baseId = resolveMappingFormula(content?.idFormula, node.data);
      if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
        baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
      }
      availableIds.push({ 
        baseId, 
        nodeId: node.id,
        dataId: node.data.id,
        dataKeys: Object.keys(node.data || {})
      });
    }
  });
  return availableIds;
}