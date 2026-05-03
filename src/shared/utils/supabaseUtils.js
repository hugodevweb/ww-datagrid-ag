// Unified Supabase data fetching utilities to eliminate duplication

/**
 * Unified Supabase data fetching function
 * Handles both pagination and infinite scroll modes
 * @param {Object} config - Configuration object
 * @param {string} config.mode - 'pagination' or 'infinite'
 * @param {Object} config.supabaseInstance - Supabase client instance
 * @param {string} config.tableName - Table name
 * @param {string} config.queryString - Select query string
 * @param {Object} config.manualFilters - Manual filters array
 * @param {string} config.searchValue - Search value
 * @param {Array} config.searchableColumns - Searchable columns
 * @param {Object} config.filterModel - AG Grid filter model
 * @param {Array} config.sortModel - AG Grid sort model
 * @param {Object} config.pagination - Pagination config
 * @param {number} config.pagination.page - Page number (for pagination mode)
 * @param {number} config.pagination.pageSize - Page size (for pagination mode)
 * @param {number} config.pagination.startRow - Start row (for infinite mode)
 * @param {number} config.pagination.endRow - End row (for infinite mode)
 * @param {Function} config.applyManualFilters - Function to apply manual filters
 * @param {Function} config.applySearchToSupabase - Function to apply search
 * @param {Function} config.convertFilterToSupabase - Function to convert filters
 * @param {Function} config.getSupabaseSortField - Function to get sort field
 * @param {Function} config.formatFiltersForLog - Function to format filters for logging
 * @returns {Promise<Object>} Result object with data and totalCount
 */
export async function fetchSupabaseDataUnified(config) {
  const {
    mode,
    supabaseInstance,
    tableName,
    queryString = '*',
    manualFilters,
    searchValue,
    searchableColumns,
    filterModel,
    sortModel,
    pagination,
    applyManualFilters,
    applySearchToSupabase,
    convertFilterToSupabase,
    getSupabaseSortField,
    formatFiltersForLog
  } = config;

  if (!supabaseInstance || !tableName) {
    throw new Error('Supabase instance and table name are required');
  }

  // Start building the query
  let query = supabaseInstance.from(tableName).select(queryString, { count: 'exact' });

  // Apply manual filters first (these are always applied)
  if (manualFilters && Array.isArray(manualFilters) && manualFilters.length > 0) {
    query = applyManualFilters(query, manualFilters);
  }

  // Apply search filter (before other filters)
  if (searchValue && searchValue.trim() && searchableColumns) {
    query = applySearchToSupabase(query, searchValue, searchableColumns);
  }

  // Apply filters
  if (filterModel && Object.keys(filterModel).length > 0) {
    query = convertFilterToSupabase(filterModel, query);
  }

  // Apply sorting
  if (sortModel && Array.isArray(sortModel) && sortModel.length > 0) {
    for (const sort of sortModel) {
      const columnId = sort.colId;
      // Get the Supabase field path for this column (supports nested relationships)
      const supabaseField = getSupabaseSortField(columnId);
      const order = sort.sort === 'asc' ? true : false;
      query = query.order(supabaseField, { ascending: order });
    }
  }

  // Apply pagination based on mode
  let from, to;
  if (mode === 'infinite') {
    // For infinite scroll: startRow, endRow (endRow is exclusive)
    from = pagination.startRow;
    to = pagination.endRow - 1;
  } else {
    // For pagination: page, pageSize
    from = (pagination.page - 1) * pagination.pageSize;
    to = from + pagination.pageSize - 1;
  }
  query = query.range(from, to);

  // Log query details
  const filtersText = formatFiltersForLog ? formatFiltersForLog(filterModel) : 'unknown';
  const sortText = sortModel && sortModel.length > 0 
    ? sortModel.map(s => `${s.colId} ${s.sort}`).join(', ')
    : 'none';
  const searchText = (searchValue && searchValue.trim()) 
    ? `"${searchValue}"` 
    : 'none';
  
  const paginationText = mode === 'infinite' 
    ? `Range: ${from}-${to}`
    : `Page: ${pagination.page} (${from}-${to})`;
    
  console.log(`[Supabase Query] Table: ${tableName} | Filters: ${filtersText} | Sort: ${sortText} | Search: ${searchText} | ${paginationText}`);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const resultData = Array.isArray(data) ? data : [];
  const totalCount = count || 0;

  return { data: resultData, totalCount };
}

/**
 * Create a fetch key for caching/deduplication
 * @param {Object} params - Parameters to create key from
 * @returns {string} Unique fetch key
 */
export function createFetchKey(params) {
  return JSON.stringify(params);
}

/**
 * Wrapper for pagination mode
 * @param {Object} config - Configuration (same as fetchSupabaseDataUnified but with page/pageSize)
 * @returns {Promise<Object>} Result with data and totalCount
 */
export async function fetchSupabaseDataPaginated(config) {
  return fetchSupabaseDataUnified({
    ...config,
    mode: 'pagination',
    pagination: {
      page: config.page,
      pageSize: config.pageSize
    }
  });
}

/**
 * Wrapper for infinite scroll mode
 * @param {Object} config - Configuration (same as fetchSupabaseDataUnified but with startRow/endRow)
 * @returns {Promise<Object>} Result with data and totalCount
 */
export async function fetchSupabaseDataInfinite(config) {
  return fetchSupabaseDataUnified({
    ...config,
    mode: 'infinite',
    pagination: {
      startRow: config.startRow,
      endRow: config.endRow
    }
  });
}

/**
 * Count-only fetch (head:true). Use when you need just the total — e.g.
 * group badges that should display before opening the group's grid.
 * Skips select payload: cheaper than fetchSupabaseDataUnified.
 */
export async function fetchSupabaseDataCount(config) {
  const {
    supabaseInstance,
    tableName,
    manualFilters,
    searchValue,
    searchableColumns,
    filterModel,
    applyManualFilters,
    applySearchToSupabase,
    convertFilterToSupabase,
    formatFiltersForLog,
  } = config;

  if (!supabaseInstance || !tableName) {
    throw new Error('Supabase instance and table name are required');
  }

  let query = supabaseInstance
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (manualFilters && Array.isArray(manualFilters) && manualFilters.length > 0) {
    query = applyManualFilters(query, manualFilters);
  }
  if (searchValue && searchValue.trim() && searchableColumns) {
    query = applySearchToSupabase(query, searchValue, searchableColumns);
  }
  if (filterModel && Object.keys(filterModel).length > 0) {
    query = convertFilterToSupabase(filterModel, query);
  }

  const filtersText = formatFiltersForLog ? formatFiltersForLog(filterModel) : 'unknown';
  const searchText = (searchValue && searchValue.trim()) ? `"${searchValue}"` : 'none';
  console.log(`[Supabase Count] Table: ${tableName} | Filters: ${filtersText} | Search: ${searchText}`);

  const { error, count } = await query;
  if (error) throw error;
  return count || 0;
}