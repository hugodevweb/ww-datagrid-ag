// Unified Supabase data fetching utilities to eliminate duplication

// ============================================================================
// Load-all-rows mode constants
// ----------------------------------------------------------------------------
// These are the hidden defaults driving fetchSupabaseDataAll. Not exposed in
// ww-config — see plan in ~/.claude/plans/could-you-make-a-sharded-anchor.md.
// ============================================================================
const LOAD_ALL_CHUNK_SIZE = 50;     // Rows per Supabase request (Supabase caps at 1000)
const LOAD_ALL_CONCURRENCY = 4;     // Max chunks in flight at once
const LOAD_ALL_MAX_ROWS = 15000;    // Safety cap; warn + truncate beyond

/**
 * Apply all "where" / "order by" clauses (manual filters, search, AG Grid
 * filter model, sort model) onto a Supabase query builder. Extracted so
 * fetchSupabaseDataUnified and fetchSupabaseDataAll apply identical query
 * shaping — keeps server-side filter/sort behavior in lock-step across modes.
 */
function buildSupabaseQuery(query, config) {
  const {
    manualFilters,
    searchValue,
    searchableColumns,
    filterModel,
    sortModel,
    applyManualFilters,
    applySearchToSupabase,
    convertFilterToSupabase,
    getSupabaseSortField,
  } = config;

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

  return query;
}

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
    searchValue,
    filterModel,
    sortModel,
    pagination,
    formatFiltersForLog,
  } = config;

  if (!supabaseInstance || !tableName) {
    throw new Error('Supabase instance and table name are required');
  }

  // Start building the query
  let query = supabaseInstance.from(tableName).select(queryString, { count: 'exact' });

  // Apply filters/search/sort via shared helper so all fetch modes line up
  query = buildSupabaseQuery(query, config);

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

/**
 * Bulk fetcher for "load all rows" mode (Monday.com-style UX).
 *
 * Probes the table count, then fires N chunked range() requests with bounded
 * concurrency, concatenates the results in submission order, and returns the
 * full dataset. Targets up to ~15k rows; anything bigger is truncated with a
 * warning so the grid degrades gracefully instead of OOMing the browser.
 *
 * Filters/search/sort are applied at fetch time via the same buildSupabaseQuery
 * helper used by fetchSupabaseDataUnified — ensures pagination and load-all
 * paths produce identically-shaped result sets.
 *
 * @param {Object} config - Same shape as fetchSupabaseDataUnified, minus
 *   pagination, plus optional `onProgress({loaded,total,chunkIndex,totalChunks})`
 *   and `abortSignal` for caller-driven cancellation.
 * @returns {Promise<{data: Array, totalCount: number, truncated: boolean, durationMs: number}>}
 */
export async function fetchSupabaseDataAll(config) {
  const {
    supabaseInstance,
    tableName,
    queryString = '*',
    searchValue,
    filterModel,
    sortModel,
    formatFiltersForLog,
    onProgress,
    abortSignal,
  } = config;

  if (!supabaseInstance || !tableName) {
    throw new Error('Supabase instance and table name are required');
  }

  const startTime = Date.now();

  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      const err = new Error('fetchSupabaseDataAll aborted');
      err.name = 'AbortError';
      throw err;
    }
  };

  const buildQuery = (withCount) => {
    let q = supabaseInstance
      .from(tableName)
      .select(queryString, withCount ? { count: 'exact' } : undefined);
    return buildSupabaseQuery(q, config);
  };

  // Log once for the whole burst (not per chunk) — keeps console quiet.
  const filtersText = formatFiltersForLog ? formatFiltersForLog(filterModel) : 'unknown';
  const sortText = sortModel && sortModel.length > 0
    ? sortModel.map(s => `${s.colId} ${s.sort}`).join(', ')
    : 'none';
  const searchText = (searchValue && searchValue.trim()) ? `"${searchValue}"` : 'none';
  console.log(`[Supabase LoadAll] Starting | Table: ${tableName} | Filters: ${filtersText} | Sort: ${sortText} | Search: ${searchText}`);

  // ---- Probe: first chunk + total count ---------------------------------
  throwIfAborted();
  const probe = await buildQuery(true).range(0, LOAD_ALL_CHUNK_SIZE - 1);
  if (probe.error) throw probe.error;

  const totalCount = probe.count || 0;
  const probeData = Array.isArray(probe.data) ? probe.data : [];

  // Fast paths: empty table or fits in one chunk.
  if (totalCount === 0) {
    console.log(`[Supabase LoadAll] count=0, chunks=0, durationMs=${Date.now() - startTime}`);
    return { data: [], totalCount: 0, truncated: false, durationMs: Date.now() - startTime };
  }
  if (totalCount <= LOAD_ALL_CHUNK_SIZE) {
    onProgress?.({ loaded: probeData.length, total: totalCount, chunkIndex: 0, totalChunks: 1 });
    console.log(`[Supabase LoadAll] count=${totalCount}, chunks=1, durationMs=${Date.now() - startTime}`);
    return { data: probeData, totalCount, truncated: false, durationMs: Date.now() - startTime };
  }

  // ---- Decide truncation -------------------------------------------------
  const truncated = totalCount > LOAD_ALL_MAX_ROWS;
  const effectiveTotal = truncated ? LOAD_ALL_MAX_ROWS : totalCount;
  if (truncated) {
    console.warn(`[Supabase LoadAll] Dataset (${totalCount}) exceeds cap (${LOAD_ALL_MAX_ROWS}); truncating.`);
  }

  // ---- Build remaining chunk ranges --------------------------------------
  // Probe already covered [0, CHUNK_SIZE-1]. Remaining starts at CHUNK_SIZE.
  const ranges = [];
  for (let from = LOAD_ALL_CHUNK_SIZE; from < effectiveTotal; from += LOAD_ALL_CHUNK_SIZE) {
    const to = Math.min(from + LOAD_ALL_CHUNK_SIZE - 1, effectiveTotal - 1);
    ranges.push([from, to]);
  }
  const totalChunks = ranges.length + 1; // probe is chunk 0
  onProgress?.({ loaded: probeData.length, total: effectiveTotal, chunkIndex: 0, totalChunks });

  // ---- Bounded-concurrency runner ---------------------------------------
  // results[i] holds chunk i+1's rows (probe is index 0). Preserves order
  // regardless of completion sequence.
  const results = new Array(ranges.length);
  let nextIdx = 0;
  let loaded = probeData.length;

  const worker = async () => {
    while (nextIdx < ranges.length) {
      const i = nextIdx++;
      const [from, to] = ranges[i];
      throwIfAborted();
      const { data, error } = await buildQuery(false).range(from, to);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      results[i] = rows;
      loaded += rows.length;
      onProgress?.({ loaded, total: effectiveTotal, chunkIndex: i + 1, totalChunks });
    }
  };

  const workerCount = Math.min(LOAD_ALL_CONCURRENCY, ranges.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // ---- Concatenate in order ----------------------------------------------
  const allData = [probeData, ...results].flat();
  const durationMs = Date.now() - startTime;
  console.log(`[Supabase LoadAll] count=${effectiveTotal}, chunks=${totalChunks}, durationMs=${durationMs}${truncated ? ' (truncated)' : ''}`);

  return { data: allData, totalCount: effectiveTotal, truncated, durationMs };
}