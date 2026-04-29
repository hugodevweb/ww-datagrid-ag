// Filter utilities for breaking down the convertFilterToSupabase function

/**
 * Apply text filter conditions to Supabase query
 */
export function applyTextFilter(query, field, condition) {
  switch (condition.type) {
    case 'equals':
      return query.eq(field, condition.filter);
    case 'notEqual':
      return query.neq(field, condition.filter);
    case 'contains':
      return query.ilike(field, `%${condition.filter}%`);
    case 'notContains':
      return query.not('ilike', field, `%${condition.filter}%`);
    case 'startsWith':
      return query.ilike(field, `${condition.filter}%`);
    case 'endsWith':
      return query.ilike(field, `%${condition.filter}`);
    case 'blank':
      return query.or(`${field}.is.null,${field}.eq.`);
    case 'notBlank':
      return query.not('or', `${field}.is.null,${field}.eq.`);
    default:
      console.warn(`[Filter] Unknown text filter type: ${condition.type}`);
      return query;
  }
}

/**
 * Apply number filter conditions to Supabase query
 */
export function applyNumberFilter(query, field, condition) {
  switch (condition.type) {
    case 'equals':
      return query.eq(field, condition.filter);
    case 'notEqual':
      return query.neq(field, condition.filter);
    case 'lessThan':
      return query.lt(field, condition.filter);
    case 'lessThanOrEqual':
      return query.lte(field, condition.filter);
    case 'greaterThan':
      return query.gt(field, condition.filter);
    case 'greaterThanOrEqual':
      return query.gte(field, condition.filter);
    case 'inRange':
      if (condition.filter != null && condition.filterTo != null) {
        return query.gte(field, condition.filter).lte(field, condition.filterTo);
      }
      return query;
    case 'blank':
      return query.is(field, null);
    case 'notBlank':
      return query.not('is', field, null);
    default:
      console.warn(`[Filter] Unknown number filter type: ${condition.type}`);
      return query;
  }
}

/**
 * Apply date filter conditions to Supabase query
 */
export function applyDateFilter(query, field, condition) {
  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  switch (condition.type) {
    case 'equals': {
      const date = formatDate(condition.dateFrom);
      return date ? query.eq(field, date) : query;
    }
    case 'notEqual': {
      const date = formatDate(condition.dateFrom);
      return date ? query.neq(field, date) : query;
    }
    case 'lessThan': {
      const date = formatDate(condition.dateFrom);
      return date ? query.lt(field, date) : query;
    }
    case 'greaterThan': {
      const date = formatDate(condition.dateFrom);
      return date ? query.gt(field, date) : query;
    }
    case 'inRange': {
      const fromDate = formatDate(condition.dateFrom);
      const toDate = formatDate(condition.dateTo);
      if (fromDate && toDate) {
        return query.gte(field, fromDate).lte(field, toDate);
      } else if (fromDate) {
        return query.gte(field, fromDate);
      } else if (toDate) {
        return query.lte(field, toDate);
      }
      return query;
    }
    case 'blank':
      return query.is(field, null);
    case 'notBlank':
      return query.not('is', field, null);
    default:
      console.warn(`[Filter] Unknown date filter type: ${condition.type}`);
      return query;
  }
}

/**
 * Apply boolean filter conditions to Supabase query
 */
export function applyBooleanFilter(query, field, condition) {
  switch (condition.type) {
    case 'true':
      return query.eq(field, true);
    case 'false':
      return query.eq(field, false);
    default:
      console.warn(`[Filter] Unknown boolean filter type: ${condition.type}`);
      return query;
  }
}

/**
 * Apply select filter conditions to Supabase query
 */
export function applySelectFilter(query, field, condition, column) {
  const { values } = condition;
  if (!values || !Array.isArray(values) || values.length === 0) {
    return query;
  }

  // Handle foreign key relationships
  if (column?.selectType === 'directFK' && column?.relatedTableIdField) {
    const relatedField = column.relatedTableIdField;
    return query.in(relatedField, values);
  }

  // Handle many-to-many relationships
  if (column?.selectType === 'manyToMany') {
    // Build OR conditions for each selected value
    const conditions = values.map(value => `${field}.cs.${JSON.stringify([value])}`);
    return query.or(conditions.join(','));
  }

  // Handle JSONB array relationships
  if (column?.selectType === 'jsonbArray') {
    const conditions = values.map(value => `${field}.cs.${JSON.stringify([value])}`);
    return query.or(conditions.join(','));
  }

  // Default: direct field comparison
  return query.in(field, values);
}

/**
 * Apply user filter conditions to Supabase query
 */
export function applyUserFilter(query, field, condition, column, resolveMappingFormula) {
  const { values } = condition;
  if (!values || !Array.isArray(values) || values.length === 0) {
    return query;
  }

  // Extract user IDs from the values
  const userIds = [];
  for (const value of values) {
    if (value && typeof value === 'object' && value.id) {
      userIds.push(value.id);
    } else if (typeof value === 'string') {
      userIds.push(value);
    }
  }

  if (userIds.length === 0) {
    return query;
  }

  // Handle different user column types
  if (column?.userType === 'directFK' && column?.userIdField) {
    // Direct foreign key relationship
    return query.in(column.userIdField, userIds);
  }

  if (column?.userType === 'manyToMany') {
    // Many-to-many relationship through junction table
    if (column?.junctionTableName && column?.junctionCurrentIdField && column?.junctionUserIdField) {
      // This requires a more complex query - for now, filter by user IDs in array
      const conditions = userIds.map(id => `${field}.cs.${JSON.stringify([{ id }])}`);
      return query.or(conditions.join(','));
    }
  }

  if (column?.userType === 'jsonbArray') {
    // JSONB array of user IDs
    const conditions = userIds.map(id => `${field}.cs.${JSON.stringify([id])}`);
    return query.or(conditions.join(','));
  }

  // Default: assume field contains user IDs directly
  return query.in(field, userIds);
}

/**
 * Apply set filter conditions to Supabase query
 */
export function applySetFilter(query, field, condition) {
  const { values } = condition;
  if (!values || !Array.isArray(values) || values.length === 0) {
    return query;
  }

  return query.in(field, values);
}

/**
 * Main filter conversion function that delegates to specific filter handlers
 */
export function convertSingleFilterToSupabase(filterModel, query, columns, resolveMappingFormula) {
  for (const [columnId, filter] of Object.entries(filterModel)) {
    if (!filter) continue;

    // Find column configuration
    const column = columns?.find(col => col?.field === columnId) || {};
    
    // Get Supabase field path (handle nested relationships)
    const supabaseField = getSupabaseFilterField(columnId, column);

    // Handle different filter structures
    if (filter.conditions && Array.isArray(filter.conditions)) {
      // Multi-condition filter (AND/OR)
      let conditionQuery = query;
      const operator = filter.operator || 'AND';
      
      if (operator === 'OR') {
        // Build OR conditions
        const orConditions = [];
        for (const condition of filter.conditions) {
          const tempQuery = applyFilterCondition(query, supabaseField, condition, column, resolveMappingFormula);
          // This is complex for OR - might need to build condition strings
          // For now, apply each condition separately (this is an approximation)
          conditionQuery = tempQuery;
        }
        query = conditionQuery;
      } else {
        // Apply AND conditions sequentially
        for (const condition of filter.conditions) {
          query = applyFilterCondition(query, supabaseField, condition, column, resolveMappingFormula);
        }
      }
    } else {
      // Single condition filter
      query = applyFilterCondition(query, supabaseField, filter, column, resolveMappingFormula);
    }
  }

  return query;
}

/**
 * Apply a single filter condition based on the filter type
 */
function applyFilterCondition(query, field, condition, column, resolveMappingFormula) {
  // Determine filter type based on column configuration or condition type
  const filterType = getFilterType(column, condition);

  switch (filterType) {
    case 'text':
      return applyTextFilter(query, field, condition);
    case 'number':
      return applyNumberFilter(query, field, condition);
    case 'date':
      return applyDateFilter(query, field, condition);
    case 'boolean':
      return applyBooleanFilter(query, field, condition);
    case 'select':
      return applySelectFilter(query, field, condition, column);
    case 'user':
      return applyUserFilter(query, field, condition, column, resolveMappingFormula);
    case 'set':
      return applySetFilter(query, field, condition);
    default:
      console.warn(`[Filter] Unknown filter type: ${filterType} for column: ${column?.field}`);
      return query;
  }
}

/**
 * Get filter type based on column configuration
 */
function getFilterType(column, condition) {
  // Check column data type first
  if (column?.cellDataType) {
    switch (column.cellDataType) {
      case 'number':
      case 'currency':
        return 'number';
      case 'dateString':
      case 'dateTime':
        return 'date';
      case 'boolean':
        return 'boolean';
      case 'select':
        return 'select';
      case 'user':
        return 'user';
      default:
        return 'text';
    }
  }

  // Check filter configuration
  if (column?.filter) {
    if (column.filter === 'agNumberColumnFilter') return 'number';
    if (column.filter === 'agDateColumnFilter') return 'date';
    if (column.filter === 'agSetColumnFilter') return 'set';
    if (column.filter === 'SelectFilterComponent') return 'select';
    if (column.filter === 'UserFilterComponent') return 'user';
  }

  // Check condition type
  if (condition?.filterType) {
    if (condition.filterType === 'number') return 'number';
    if (condition.filterType === 'date') return 'date';
    if (condition.filterType === 'set') return 'set';
  }

  // Default to text
  return 'text';
}

/**
 * Get Supabase field path for filtering (handle nested relationships)
 */
function getSupabaseFilterField(columnId, column) {
  // If column has a specific Supabase field mapping, use that
  if (column?.supabaseField) {
    return column.supabaseField;
  }

  // For foreign key relationships, use the foreign key field
  if (column?.selectType === 'directFK' && column?.relatedTableIdField) {
    return column.relatedTableIdField;
  }

  if (column?.userType === 'directFK' && column?.userIdField) {
    return column.userIdField;
  }

  // Default to column ID
  return columnId;
}