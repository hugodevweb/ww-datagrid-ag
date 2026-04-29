// Helper function to get the Supabase field path for filtering a column
// Only used when dataSource is 'supabase'
export const getSupabaseFilterField = (content, columnId) => {
  if (content?.dataSource !== 'supabase') {
    return columnId;
  }

  const column = content?.columns?.find(col => {
    const colId = col?.actionName || col?.field;
    return colId === columnId || col?.field === columnId;
  });

  const supabaseField = column?.supabaseFilterField?.trim();
  return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
};

// Helper function to get the Supabase field path for sorting a column
// Only used when dataSource is 'supabase'
export const getSupabaseSortField = (content, columnId) => {
  if (content?.dataSource !== 'supabase') {
    return columnId;
  }

  const column = content?.columns?.find(col => {
    const colId = col?.actionName || col?.field;
    return colId === columnId || col?.field === columnId;
  });

  const supabaseField = column?.supabaseSortField?.trim();
  return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
};

// Helper function to find a column by columnId (general purpose, not limited to user columns)
export const findColumnByField = (content, columnId) => {
  if (!columnId || !content?.columns) return null;

  const column = content.columns.find(col => {
    const colId = col?.actionName || col?.field;
    return colId === columnId || col?.field === columnId;
  });

  return column || null;
};

// Helper function to find a user column by columnId (improved lookup for many-to-many relationships)
export const findUserColumn = (content, columnId) => {
  if (!columnId || !content?.columns) return null;

  let column = content.columns.find(col => {
    const colId = col?.actionName || col?.field;
    return colId === columnId || col?.field === columnId;
  });

  // If not found, try matching by supabaseFilterField (for many-to-many relationships)
  if (!column) {
    column = content.columns.find(col => {
      if (col?.cellDataType !== 'user') return false;
      const supabaseField = col?.supabaseFilterField?.trim();
      if (!supabaseField) return false;
      // Check if columnId matches the supabaseFilterField or its base path
      // e.g., columnId="case_owners" matches supabaseFilterField="case_owners.profile.id"
      return supabaseField === columnId || supabaseField.startsWith(columnId + '.') || columnId.startsWith(supabaseField + '.');
    });
  }

  // If still not found, try a more flexible match (check if columnId contains field or vice versa)
  if (!column) {
    column = content.columns.find(col => {
      if (col?.cellDataType !== 'user') return false;
      const field = col?.field;
      if (!field) return false;
      const fieldLower = String(field).toLowerCase();
      const columnIdLower = String(columnId).toLowerCase();
      return fieldLower.includes(columnIdLower) || columnIdLower.includes(fieldLower);
    });
  }

  // Return column only if it's a user column with users array
  if (column && column.cellDataType === 'user' && Array.isArray(column.users)) {
    return column;
  }

  return null;
};
