import { getSupabaseFilterField, findColumnByField, findUserColumn } from './supabaseFieldMappings.js';
import { resolveValue, resolveValues } from '../../shared/utils/placeholders.js';

// Resolve placeholder tokens (e.g. %CURRENT_USER%) inside a filter entry's value
// fields. Returns a shallow copy so the stored filter model keeps its raw tokens.
const resolveFilterEntry = (filter) => {
  if (!filter || typeof filter !== 'object') return filter;
  const out = { ...filter };
  if (Array.isArray(out.values)) out.values = resolveValues(out.values);
  if ('filter' in out) out.filter = resolveValue(out.filter);
  if ('filterTo' in out) out.filterTo = resolveValue(out.filterTo);
  if ('dateFrom' in out) out.dateFrom = resolveValue(out.dateFrom);
  if ('dateTo' in out) out.dateTo = resolveValue(out.dateTo);
  return out;
};

// Convert AG Grid filter model to Supabase filter chain.
// Pure function — extracted from Datagrid.vue setup() (was lines ~770-1164).
//
// Parameters:
//   filterModel: AG Grid filter model object
//   query: Supabase query builder
//   content: props.content from the component (needed for column lookups)
//   debugLog: optional logger function (defaults to no-op)
export const convertFilterToSupabase = (filterModel, query, content, debugLog = () => {}) => {
  if (!filterModel || Object.keys(filterModel).length === 0) {
    return query;
  }

  let currentQuery = query;

  // Process each column filter
  for (const [columnId, rawFilter] of Object.entries(filterModel)) {
    if (!rawFilter) continue;
    // Resolve placeholder tokens before building the query (model stays untouched).
    const filter = resolveFilterEntry(rawFilter);

    // Get the Supabase field path for this column (supports nested relationships)
    // This will return the supabaseFilterField if set, otherwise columnId
    // For non-Supabase data sources, it just returns columnId
    const supabaseField = getSupabaseFilterField(content, columnId);

    // Handle user filters (custom filter type)
    if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
      // User filter now stores user IDs directly in filter.values, not names
      // Use the IDs directly for Supabase filtering
      // CRITICAL FIX: Use improved column lookup for many-to-many relationships
      const column = findUserColumn(content, columnId);

      if (column) {
        // Separate __empty__ sentinel from real user IDs
        const wantsEmpty = filter.values.includes('__empty__');
        const selectedUserIds = filter.values.filter(id => id != null && id !== '__empty__');

        if (selectedUserIds.length > 0 || wantsEmpty) {
          const userColumnType = column?.userColumnType || (column?.isManyToMany === true ? 'manyToMany' : 'directFK');

          const filterField = (userColumnType === 'manyToMany' && column?.supabaseFilterField?.trim())
            ? column.supabaseFilterField.trim()
            : supabaseField;

          if (wantsEmpty && selectedUserIds.length === 0) {
            if (userColumnType === 'jsonbArray') {
              currentQuery = currentQuery.is(`${filterField}->0`, null);
            } else if (userColumnType === 'manyToMany') {
              currentQuery = currentQuery.is(filterField, null);
            } else {
              currentQuery = currentQuery.is(filterField, null);
            }
          } else if (wantsEmpty && selectedUserIds.length > 0) {
            const orConditions = [];

            if (userColumnType === 'jsonbArray') {
              orConditions.push(`${filterField}->0.is.null`);
            } else {
              orConditions.push(`${filterField}.is.null`);
            }

            if (userColumnType === 'jsonbArray') {
              selectedUserIds.forEach(id => {
                orConditions.push(`${filterField}.cs.{${id}}`);
              });
            } else if (userColumnType === 'manyToMany') {
              selectedUserIds.forEach(id => {
                orConditions.push(`${filterField}.eq.${id}`);
              });
            } else {
              if (selectedUserIds.length === 1) {
                orConditions.push(`${filterField}.eq.${selectedUserIds[0]}`);
              } else {
                orConditions.push(`${filterField}.in.(${selectedUserIds.join(',')})`);
              }
            }

            currentQuery = currentQuery.or(orConditions.join(','));
          } else {
            if (userColumnType === 'jsonbArray') {
              if (selectedUserIds.length === 1) {
                currentQuery = currentQuery.contains(filterField, [selectedUserIds[0]]);
              } else {
                const orConditions = selectedUserIds.map(id => {
                  return `${filterField}.cs.{${id}}`;
                }).join(',');
                currentQuery = currentQuery.or(orConditions);
              }
            } else if (userColumnType === 'manyToMany') {
              if (selectedUserIds.length === 1) {
                currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
              } else {
                currentQuery = currentQuery.in(filterField, selectedUserIds);
              }

              const isNestedPath = filterField.includes('.');

              if (isNestedPath) {
                const pathParts = filterField.split('.');

                let currentPath = '';
                for (let i = 0; i < pathParts.length; i++) {
                  if (i === 0) {
                    currentPath = pathParts[i];
                  } else {
                    currentPath += '.' + pathParts[i];
                  }
                  currentQuery = currentQuery.not(currentPath, 'is', null);
                }
              } else {
                currentQuery = currentQuery.not(filterField, 'is', null);
              }
            } else {
              if (selectedUserIds.length === 1) {
                currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
              } else {
                currentQuery = currentQuery.in(filterField, selectedUserIds);
              }

              currentQuery = currentQuery.not(filterField, 'is', null);
            }
          }

        } else {
          debugLog('[Supabase Filter] Warning: No valid user IDs found for names:', filter.values);
        }
      } else {
        debugLog('[Supabase Filter] Warning: Could not find user column or users array for:', columnId);
        debugLog('[Supabase Filter] Available columns:', content?.columns?.map(col => ({
          field: col?.field,
          actionName: col?.actionName,
          cellDataType: col?.cellDataType,
          userColumnType: col?.userColumnType,
          isManyToMany: col?.isManyToMany,
          supabaseFilterField: col?.supabaseFilterField,
          hasUsers: Array.isArray(col?.users),
          usersCount: Array.isArray(col?.users) ? col.users.length : 0
        })));
        debugLog('[Supabase Filter] Searching for columnId:', columnId);
      }
      continue;
    }

    // Handle different filter types
    if (filter.filterType === 'text') {
      const column = findColumnByField(content, columnId);
      const isBoolean = column?.cellDataType === 'boolean';

      if (isBoolean) {
        let booleanValue = null;
        let isNotEqual = false;

        if (filter.type === 'notEqual' || filter.type === 'notEquals') {
          isNotEqual = true;
          const filterValue = filter.filter;
          if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
            booleanValue = true;
          } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
            booleanValue = false;
          }
        }
        else if (filter.type === 'true' || filter.type === true) {
          booleanValue = true;
        } else if (filter.type === 'false' || filter.type === false) {
          booleanValue = false;
        }
        else if (filter.filter === 'true' || filter.filter === true || filter.filter === 'True') {
          booleanValue = true;
        } else if (filter.filter === 'false' || filter.filter === false || filter.filter === 'False') {
          booleanValue = false;
        }
        else if (filter.type === 'equals') {
          const filterValue = filter.filter;
          if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
            booleanValue = true;
          } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
            booleanValue = false;
          }
        }

        if (booleanValue !== null) {
          if (isNotEqual) {
            currentQuery = currentQuery.neq(supabaseField, booleanValue);
          } else {
            currentQuery = currentQuery.eq(supabaseField, booleanValue);
          }
        }
      } else {
        if (filter.type === 'equals') {
          currentQuery = currentQuery.eq(supabaseField, filter.filter);
        } else if (filter.type === 'notEqual') {
          currentQuery = currentQuery.neq(supabaseField, filter.filter);
        } else if (filter.type === 'contains') {
          currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}%`);
        } else if (filter.type === 'notContains') {
          currentQuery = currentQuery.not('ilike', supabaseField, `%${filter.filter}%`);
        } else if (filter.type === 'startsWith') {
          currentQuery = currentQuery.ilike(supabaseField, `${filter.filter}%`);
        } else if (filter.type === 'endsWith') {
          currentQuery = currentQuery.ilike(supabaseField, `%${filter.filter}`);
        } else if (filter.type === 'blank') {
          currentQuery = currentQuery.is(supabaseField, null);
        } else if (filter.type === 'notBlank') {
          currentQuery = currentQuery.not(supabaseField, 'is', null);
        }
      }
    } else if (filter.filterType === 'number') {
      const column = findColumnByField(content, columnId);
      const isCurrency = column?.cellDataType === 'currency';

      const getFilterValue = (value) => {
        const numValue = Number(value);
        return isCurrency ? Math.round(numValue * 100) : numValue;
      };

      if (filter.type === 'equals') {
        currentQuery = currentQuery.eq(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'notEqual') {
        currentQuery = currentQuery.neq(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'greaterThan') {
        currentQuery = currentQuery.gt(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'greaterThanOrEqual') {
        currentQuery = currentQuery.gte(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'lessThan') {
        currentQuery = currentQuery.lt(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'lessThanOrEqual') {
        currentQuery = currentQuery.lte(supabaseField, getFilterValue(filter.filter));
      } else if (filter.type === 'inRange') {
        currentQuery = currentQuery.gte(supabaseField, getFilterValue(filter.filter))
          .lte(supabaseField, getFilterValue(filter.filterTo));
      }
    } else if (filter.filterType === 'date') {
      const filterDate = filter.dateFrom || filter.filter;
      const filterToDate = filter.dateTo || filter.filterTo;

      if (filter.type === 'equals') {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);
        currentQuery = currentQuery.gte(supabaseField, startOfDay.toISOString())
          .lte(supabaseField, endOfDay.toISOString());
      } else if (filter.type === 'notEqual') {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);
        currentQuery = currentQuery.or(`and(${supabaseField}.lt.${startOfDay.toISOString()},${supabaseField}.gt.${endOfDay.toISOString()})`);
      } else if (filter.type === 'greaterThan') {
        currentQuery = currentQuery.gt(supabaseField, new Date(filterDate).toISOString());
      } else if (filter.type === 'greaterThanOrEqual') {
        currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString());
      } else if (filter.type === 'lessThan') {
        currentQuery = currentQuery.lt(supabaseField, new Date(filterDate).toISOString());
      } else if (filter.type === 'lessThanOrEqual') {
        currentQuery = currentQuery.lte(supabaseField, new Date(filterDate).toISOString());
      } else if (filter.type === 'inRange') {
        currentQuery = currentQuery.gte(supabaseField, new Date(filterDate).toISOString())
          .lte(supabaseField, new Date(filterToDate).toISOString());
      }
    } else if (filter.type === 'selectFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
      const wantsEmpty = filter.values.includes('__empty__');
      const optionValues = filter.values.filter(val => val != null && val !== '__empty__');

      // "is none of" — exclude the selected values (used by the filter builder)
      if (filter.exclude === true) {
        if (optionValues.length === 1) {
          currentQuery = currentQuery.neq(supabaseField, optionValues[0]);
        } else if (optionValues.length > 1) {
          currentQuery = currentQuery.not(supabaseField, 'in', `(${optionValues.join(',')})`);
        }
      } else if (wantsEmpty && optionValues.length === 0) {
        currentQuery = currentQuery.is(supabaseField, null);
      } else if (wantsEmpty && optionValues.length > 0) {
        const orConditions = [`${supabaseField}.is.null`];
        if (optionValues.length === 1) {
          orConditions.push(`${supabaseField}.eq.${optionValues[0]}`);
        } else {
          orConditions.push(`${supabaseField}.in.(${optionValues.join(',')})`);
        }
        currentQuery = currentQuery.or(orConditions.join(','));
      } else if (optionValues.length > 0) {
        if (optionValues.length === 1) {
          currentQuery = currentQuery.eq(supabaseField, optionValues[0]);
        } else {
          currentQuery = currentQuery.in(supabaseField, optionValues);
        }
      }
    } else if (filter.type === 'recordFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
      const wantsEmpty = filter.values.includes('__empty__');
      const recordValues = filter.values.filter(val => val != null && val !== '__empty__');

      if (wantsEmpty && recordValues.length === 0) {
        currentQuery = currentQuery.is(supabaseField, null);
      } else if (wantsEmpty && recordValues.length > 0) {
        const orConditions = [`${supabaseField}.is.null`];
        if (recordValues.length === 1) {
          orConditions.push(`${supabaseField}.eq.${recordValues[0]}`);
        } else {
          orConditions.push(`${supabaseField}.in.(${recordValues.join(',')})`);
        }
        currentQuery = currentQuery.or(orConditions.join(','));
      } else if (recordValues.length > 0) {
        if (recordValues.length === 1) {
          currentQuery = currentQuery.eq(supabaseField, recordValues[0]);
        } else {
          currentQuery = currentQuery.in(supabaseField, recordValues);
        }
      }
    } else if (filter.filterType === 'set') {
      if (filter.values && filter.values.length > 0) {
        const column = findColumnByField(content, columnId);
        const isBoolean = column?.cellDataType === 'boolean';

        let convertedValues = filter.values;
        if (isBoolean) {
          convertedValues = filter.values.map(val => {
            if (val === 'true' || val === true || val === 1 || val === '1') return true;
            if (val === 'false' || val === false || val === 0 || val === '0') return false;
            return val;
          });
        }

        if (convertedValues.length === 1) {
          currentQuery = currentQuery.eq(supabaseField, convertedValues[0]);
        } else {
          currentQuery = currentQuery.in(supabaseField, convertedValues);
        }
      }
    }
  }

  return currentQuery;
};
