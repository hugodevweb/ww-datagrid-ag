<template>
  <div class="ww-datagrid" :class="{ editing: isEditing }" :style="cssVars" ref="gridContainerRef">
    <ag-grid-vue
      :components="gridComponents"
      :rowData="rowData"
      :columnDefs="columnDefs"
      :initial-state="initialState"
      :defaultColDef="defaultColDef"
      :dataTypeDefinitions="dataTypeDefinitions"
      :domLayout="content.layout === 'auto' ? 'autoHeight' : 'normal'"
      :style="style"
      :rowSelection="rowSelection"
      :selection-column-def="{ pinned: true }"
      :theme="theme"
      :getRowId="getRowId"
      :rowModelType="rowModelType"
      :datasource="delayedDatasource"
      :cacheBlockSize="cacheBlockSize"
      :pagination="paginationEnabled"
      :paginationPageSize="
        forcedPaginationPageSize
          ? 0
          : paginationPageSizeSelector
          ? paginationPageSizeSelector[0]
          : content.paginationPageSize
      "
      :paginationPageSizeSelector="paginationPageSizeSelector"
      :suppressMovableColumns="!content.movableColumns"
      :columnHoverHighlight="content.columnHoverHighlight"
      :locale-text="localeText"
      :invalidEditValueMode="invalidEditValueMode"
      :getRowStyle="rowStyle"
      enableCellTextSelection
      ensureDomOrder
      :row-drag-managed="rowDragManaged"
      :rowBuffer="content.rowBuffer ?? 30"
      @grid-ready="onGridReady"
      @row-selected="onRowSelected"
      @selection-changed="onSelectionChanged"
      @cell-value-changed="onCellValueChanged"
      @cell-edit-request="onCellEditRequest"
      @filter-changed="onFilterChanged"
      @sort-changed="onSortChanged"
      @pagination-changed="onPaginationChanged"
      @row-clicked="onRowClicked"
      @row-drag-end="onRowDragged"
      @row-drag-enter="onRowDragEnter"
      @column-moved="onColumnMoved"
      @column-resized="onColumnResized"
      @body-scroll="onBodyScroll"
      @first-data-rendered="onFirstDataRendered"
      @model-updated="onModelUpdated"
    >
    </ag-grid-vue>
    <div v-if="content.allowColumnHiding && !isEditing" ref="columnChooserRef" class="column-chooser-container">
      <Transition name="cc-fade">
        <div v-if="showColumnChooser" class="cc-panel" @click.stop>
          <!-- Header -->
          <div class="cc-header">
            <span class="cc-title">Gérer les colonnes</span>
            <button class="cc-close-btn" @click="showColumnChooser = false" aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Search row with select-all -->
          <div class="cc-search-row">
            <label class="cc-checkbox-wrap" title="Tout afficher / masquer">
              <input
                type="checkbox"
                class="cc-checkbox"
                :checked="allColumnsVisible"
                :indeterminate.prop="someColumnsHidden"
                @change="toggleAllColumns"
              />
            </label>
            <div class="cc-search-box">
              <svg class="cc-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <input
                class="cc-search-input"
                type="text"
                v-model="columnChooserSearch"
                placeholder="Rechercher..."
                @click.stop
              />
            </div>
          </div>

          <!-- Column list -->
          <div class="cc-list">
            <div
              v-for="col in filteredColumnsList"
              :key="col.colId"
              class="cc-row"
              :class="{
                'cc-row--drag-over': chooserDragOverColId === col.colId && chooserDragColId !== col.colId,
                'cc-row--dragging': chooserDragColId === col.colId,
                'cc-row--locked': col.isLocked,
              }"
              :draggable="!columnChooserSearch && !col.isLocked"
              @dragstart="onChooserDragStart(col.colId)"
              @dragover.prevent="onChooserDragOver(col.colId)"
              @drop.prevent="onChooserDrop(col.colId)"
              @dragend="onChooserDragEnd"
            >
              <label class="cc-checkbox-wrap" :class="{ 'cc-checkbox-wrap--locked': col.isLocked }">
                <input
                  type="checkbox"
                  class="cc-checkbox"
                  :checked="!col.isHidden"
                  :disabled="col.isLocked"
                  @change="toggleColumnVisibility(col.colId)"
                />
              </label>
              <span class="cc-drag-handle" :class="{ 'cc-drag-handle--disabled': !!columnChooserSearch || col.isLocked }">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                  <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                  <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                  <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                </svg>
              </span>
              <span class="cc-col-name">{{ col.headerName }}</span>
            </div>
            <div v-if="filteredColumnsList.length === 0" class="cc-empty">
              Aucune colonne ne correspond à "{{ columnChooserSearch }}"
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script>
import {
  shallowRef,
  watchEffect,
  computed,
  inject,
  watch,
  nextTick,
  ref,
  onBeforeUnmount,
  isRef,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  ValidationModule,
} from "ag-grid-community";
import {
  AG_GRID_LOCALE_EN,
  AG_GRID_LOCALE_FR,
  AG_GRID_LOCALE_DE,
  AG_GRID_LOCALE_ES,
  AG_GRID_LOCALE_PT,
} from "@ag-grid-community/locale";
import ActionCellRenderer from "./components/ActionCellRenderer.vue";
import ImageCellRenderer from "./components/ImageCellRenderer.vue";
import WewebCellRenderer from "./components/WewebCellRenderer.vue";
import SelectCellRenderer from "./components/SelectCellRenderer.vue";
import SelectFilterComponent from "./components/SelectFilterComponent.vue";
import SelectFilterWrapper from "./components/SelectFilterWrapper.js";
import DateCellEditor from "./components/DateCellEditor.vue";
import UserCellRenderer from "./components/UserCellRenderer.vue";
import UserFilterComponent from "./components/UserFilterComponent.vue";
import UserFilterWrapper from "./components/UserFilterWrapper.js";

// TODO: maybe register less modules
// TODO: maybe register modules per grid instead of globally
// ValidationModule is REQUIRED for getValidationErrors to work
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

export default {
  components: {
    AgGridVue,
    ActionCellRenderer,
    ImageCellRenderer,
    WewebCellRenderer,
    SelectCellRenderer,
    SelectFilterComponent,
    UserCellRenderer,
    UserFilterComponent,
  },
  props: {
    content: {
      type: Object,
      required: true,
    },
    uid: {
      type: String,
      required: true,
    },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ["trigger-event", "update:content:effect"],
  setup(props, ctx) {
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    // Translation helper for filter buttons
    const getFilterTranslations = (lang) => {
      const translations = {
        en: { reset: 'Reset', apply: 'Apply' },
        fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
        es: { reset: 'Restablecer', apply: 'Aplicar' },
        de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
        pt: { reset: 'Redefinir', apply: 'Aplicar' },
      };
      return translations[lang] || translations.en;
    };

    // Debug logging helper
    const debugLog = (...args) => {
      if (props.content?.enableDebugLogs) {
        console.log(...args);
      }
    };

    // Helper to check if a viewConfiguration value is effectively empty
    // Returns true if value is null, undefined, empty object {}, or empty array []
    const isEmptyConfigValue = (value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    };

    // Helper function to get the Supabase field path for filtering a column
    // Only used when dataSource is 'supabase'
    const getSupabaseFilterField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseFilterField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseFilterField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Helper function to get the Supabase field path for sorting a column
    // Only used when dataSource is 'supabase'
    const getSupabaseSortField = (columnId) => {
      // Only use Supabase-specific fields when dataSource is 'supabase'
      if (props.content?.dataSource !== 'supabase') {
        return columnId;
      }
      
      const column = props.content?.columns?.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // Return supabaseSortField if provided and not empty, otherwise fall back to columnId
      const supabaseField = column?.supabaseSortField?.trim();
      return supabaseField && supabaseField.length > 0 ? supabaseField : columnId;
    };

    // Helper function to find a column by columnId (general purpose, not limited to user columns)
    const findColumnByField = (columnId) => {
      if (!columnId || !props.content?.columns) return null;
      
      // First, try standard lookup
      let column = props.content.columns.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      return column || null;
    };

    // Helper function to find a user column by columnId (improved lookup for many-to-many relationships)
    const findUserColumn = (columnId) => {
      if (!columnId || !props.content?.columns) return null;
      
      // First, try standard lookup
      let column = props.content.columns.find(col => {
        const colId = col?.actionName || col?.field;
        return colId === columnId || col?.field === columnId;
      });
      
      // If not found, try matching by supabaseFilterField (for many-to-many relationships)
      if (!column) {
        column = props.content.columns.find(col => {
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
        column = props.content.columns.find(col => {
          if (col?.cellDataType !== 'user') return false;
          const field = col?.field;
          if (!field) return false;
          // Check if columnId contains field or field contains columnId (case-insensitive)
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

    // Helper function to format filters for logging
    const formatFiltersForLog = (filterModel) => {
      if (!filterModel || Object.keys(filterModel).length === 0) {
        return 'none';
      }
      
      const filterStrings = [];
      for (const [columnId, filter] of Object.entries(filterModel)) {
        if (!filter) continue;
        
        let filterDesc = `${columnId}: `;
        
        if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // User filters now store user IDs directly in filter.values, not names
          // Use the IDs directly for logging
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else if (filter.filterType === 'text') {
          filterDesc += `${filter.type} "${filter.filter}"`;
        } else if (filter.filterType === 'number') {
          if (filter.type === 'inRange') {
            filterDesc += `${filter.filter} to ${filter.filterTo}`;
          } else {
            filterDesc += `${filter.type} ${filter.filter}`;
          }
        } else if (filter.filterType === 'date') {
          if (filter.type === 'inRange') {
            filterDesc += `${filter.dateFrom} to ${filter.dateTo}`;
          } else {
            filterDesc += `${filter.type} ${filter.dateFrom || filter.filter}`;
          }
        } else if (filter.type === 'selectFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // Select filters now store values (IDs) directly, not labels
          // Use the values directly for logging
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else if (filter.filterType === 'set' && filter.values) {
          filterDesc += `in [${filter.values.join(', ')}]`;
        } else {
          filterDesc += `${filter.type || filter.filterType || 'unknown'}`;
        }
        
        filterStrings.push(filterDesc);
      }
      
      return filterStrings.length > 0 ? filterStrings.join(' | ') : 'none';
    };

    // Convert AG Grid filter model to Supabase filter chain
    const convertFilterToSupabase = (filterModel, query) => {
      if (!filterModel || Object.keys(filterModel).length === 0) {
        return query;
      }

      let currentQuery = query;

      // Process each column filter
      for (const [columnId, filter] of Object.entries(filterModel)) {
        if (!filter) continue;

        // Get the Supabase field path for this column (supports nested relationships)
        // This will return the supabaseFilterField if set, otherwise columnId
        // For non-Supabase data sources, it just returns columnId
        const supabaseField = getSupabaseFilterField(columnId);

        // Handle user filters (custom filter type)
        if (filter.type === 'userFilter' && filter.values && Array.isArray(filter.values) && filter.values.length > 0) {
          // User filter now stores user IDs directly in filter.values, not names
          // Use the IDs directly for Supabase filtering
          // CRITICAL FIX: Use improved column lookup for many-to-many relationships
          const column = findUserColumn(columnId);

          if (column) {
            // Separate __empty__ sentinel from real user IDs
            const wantsEmpty = filter.values.includes('__empty__');
            const selectedUserIds = filter.values.filter(id => id != null && id !== '__empty__'); // Remove null/undefined and __empty__

            if (selectedUserIds.length > 0 || wantsEmpty) {
              // Determine user column type: check userColumnType first, fall back to isManyToMany for backward compatibility
              const userColumnType = column?.userColumnType || (column?.isManyToMany === true ? 'manyToMany' : 'directFK');

              // Get the appropriate filter field
              // For many-to-many, use supabaseFilterField if provided, otherwise use supabaseField
              // For direct FK and JSONB, use supabaseField (which is the column field)
              const filterField = (userColumnType === 'manyToMany' && column?.supabaseFilterField?.trim())
                ? column.supabaseFilterField.trim()
                : supabaseField;

              // If only filtering for empty (no user), just check for null/empty
              if (wantsEmpty && selectedUserIds.length === 0) {
                if (userColumnType === 'jsonbArray') {
                  // JSONB: null or empty array — use ->0 to check first element
                  // For null columns and empty arrays [], accessing index 0 returns null
                  currentQuery = currentQuery.is(`${filterField}->0`, null);
                } else if (userColumnType === 'manyToMany') {
                  // Many-to-many: filter field is null
                  currentQuery = currentQuery.is(filterField, null);
                } else {
                  // Direct FK: field is null
                  currentQuery = currentQuery.is(filterField, null);
                }
              } else if (wantsEmpty && selectedUserIds.length > 0) {
                // Both empty and specific users selected: use OR to combine
                const orConditions = [];

                // Add null/empty condition
                if (userColumnType === 'jsonbArray') {
                  // Use ->0.is.null to match both null and empty JSONB arrays
                  orConditions.push(`${filterField}->0.is.null`);
                } else {
                  orConditions.push(`${filterField}.is.null`);
                }

                // Add user ID conditions
                if (userColumnType === 'jsonbArray') {
                  selectedUserIds.forEach(id => {
                    orConditions.push(`${filterField}.cs.{${id}}`);
                  });
                } else if (userColumnType === 'manyToMany') {
                  selectedUserIds.forEach(id => {
                    orConditions.push(`${filterField}.eq.${id}`);
                  });
                } else {
                  // Direct FK
                  if (selectedUserIds.length === 1) {
                    orConditions.push(`${filterField}.eq.${selectedUserIds[0]}`);
                  } else {
                    orConditions.push(`${filterField}.in.(${selectedUserIds.join(',')})`);
                  }
                }

                currentQuery = currentQuery.or(orConditions.join(','));
              } else {
              // Only specific users selected (no __empty__)
              // Apply filter based on user column type
              if (userColumnType === 'jsonbArray') {
                // JSONB Array: Use contains operator for Supabase JSONB arrays
                // Supabase .contains() checks if the JSONB array contains the specified value(s)
                // Note: .contains() requires ALL values to be present, so for "any of" we use OR
                if (selectedUserIds.length === 1) {
                  // Single user: check if array contains this user ID
                  // For JSONB arrays, we pass an array with the single ID
                  currentQuery = currentQuery.contains(filterField, [selectedUserIds[0]]);
                } else {
                  // Multiple users: check if array contains ANY of the selected user IDs
                  // Use OR condition with individual contains checks for each ID
                  // PostgREST syntax for JSONB containment uses curly braces for array values
                  // Format: field.cs.{value} for checking if JSONB array contains the value
                  const orConditions = selectedUserIds.map(id => {
                    // Use curly braces for PostgREST array containment syntax
                    // This checks if the JSONB column contains the specified value
                    return `${filterField}.cs.{${id}}`;
                  }).join(',');
                  currentQuery = currentQuery.or(orConditions);
                }
              } else if (userColumnType === 'manyToMany') {
                // Many-to-Many: Use eq/in with supabaseFilterField (e.g., "case_owners.profile.id")
                if (selectedUserIds.length === 1) {
                  currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
                } else {
                  currentQuery = currentQuery.in(filterField, selectedUserIds);
                }

                // For many-to-many with nested paths, exclude null values at each level
                const isNestedPath = filterField.includes('.');

                if (isNestedPath) {
                  // For nested paths in junction tables, we need to check each level of the path
                  // to ensure the entire relationship chain exists
                  // Example: for "case_owners.profile.id", check:
                  // - case_owners is not null (junction table exists)
                  // - case_owners.profile is not null (nested relationship exists)
                  // - case_owners.profile.id is not null (field exists)
                  const pathParts = filterField.split('.');

                  // Build and check each intermediate path level
                  // This ensures that if any part of the relationship chain is null, the row is excluded
                  let currentPath = '';
                  for (let i = 0; i < pathParts.length; i++) {
                    if (i === 0) {
                      currentPath = pathParts[i];
                    } else {
                      currentPath += '.' + pathParts[i];
                    }
                    // Exclude rows where this path level is null
                    // Note: If this doesn't work for junction tables, we may need to use
                    // an inner join in the select statement (e.g., 'case_owners!inner(*)')
                    currentQuery = currentQuery.not(currentPath, 'is', null);
                  }
                } else {
                  // For direct fields, just exclude null values
                  // Supabase syntax: .not(field, 'is', null)
                  currentQuery = currentQuery.not(filterField, 'is', null);
                }
              } else {
                // Direct Foreign Key (default): Use eq/in operators
                if (selectedUserIds.length === 1) {
                  currentQuery = currentQuery.eq(filterField, selectedUserIds[0]);
                } else {
                  currentQuery = currentQuery.in(filterField, selectedUserIds);
                }

                // For direct FK, exclude null values
                currentQuery = currentQuery.not(filterField, 'is', null);
              }
              }

            } else {
              debugLog('[Supabase Filter] Warning: No valid user IDs found for names:', filter.values);
            }
          } else {
            // Enhanced error logging to help diagnose the issue
            debugLog('[Supabase Filter] Warning: Could not find user column or users array for:', columnId);
            debugLog('[Supabase Filter] Available columns:', props.content?.columns?.map(col => ({
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
          // Check if this is a boolean column (AG Grid uses Text Filter for boolean with True/False dropdown)
          const column = findColumnByField(columnId);
          const isBoolean = column?.cellDataType === 'boolean';
          
          // For boolean columns, handle True/False string values
          if (isBoolean) {
            // AG Grid's Text Filter for boolean uses type: "true" or type: "false" as strings
            // Also check filter.filter for the value
            let booleanValue = null;
            let isNotEqual = false;
            
            // Check if it's a notEqual operation first
            if (filter.type === 'notEqual' || filter.type === 'notEquals') {
              isNotEqual = true;
              // Get the value from filter.filter for notEqual
              const filterValue = filter.filter;
              if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
                booleanValue = true;
              } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
                booleanValue = false;
              }
            }
            // Check filter.type for direct true/false (AG Grid boolean text filter uses this)
            else if (filter.type === 'true' || filter.type === true) {
              booleanValue = true;
            } else if (filter.type === 'false' || filter.type === false) {
              booleanValue = false;
            } 
            // Also check filter.filter (fallback)
            else if (filter.filter === 'true' || filter.filter === true || filter.filter === 'True') {
              booleanValue = true;
            } else if (filter.filter === 'false' || filter.filter === false || filter.filter === 'False') {
              booleanValue = false;
            }
            // Handle equals type with string values
            else if (filter.type === 'equals') {
              const filterValue = filter.filter;
              if (filterValue === 'true' || filterValue === true || filterValue === 'True' || filterValue === '1' || filterValue === 1) {
                booleanValue = true;
              } else if (filterValue === 'false' || filterValue === false || filterValue === 'False' || filterValue === '0' || filterValue === 0) {
                booleanValue = false;
              }
            }
            
            // Apply boolean filter if we have a valid boolean value
            if (booleanValue !== null) {
              if (isNotEqual) {
                currentQuery = currentQuery.neq(supabaseField, booleanValue);
              } else {
                // For equals, true, false, or any other type, use eq
                currentQuery = currentQuery.eq(supabaseField, booleanValue);
              }
            }
          } else {
            // Regular text filters for non-boolean columns
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
            }
          }
        } else if (filter.filterType === 'number') {
          // Check if this is a currency column - need to convert display value back to cents
          const column = findColumnByField(columnId);
          const isCurrency = column?.cellDataType === 'currency';
          
          // Helper to convert filter value - multiply by 100 for currency columns
          const getFilterValue = (value) => {
            const numValue = Number(value);
            return isCurrency ? Math.round(numValue * 100) : numValue;
          };
          
          // Number filters
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
          // Date filters
          const filterDate = filter.dateFrom || filter.filter;
          const filterToDate = filter.dateTo || filter.filterTo;
          
          if (filter.type === 'equals') {
            // For date equals, we need to check the entire day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            currentQuery = currentQuery.gte(supabaseField, startOfDay.toISOString())
              .lte(supabaseField, endOfDay.toISOString());
          } else if (filter.type === 'notEqual') {
            // Not equal for dates: filter out the specific day
            // We'll use a workaround: filter for dates less than start of day OR greater than end of day
            const startOfDay = new Date(filterDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate);
            endOfDay.setHours(23, 59, 59, 999);
            // Use .or() with proper Supabase syntax
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
          // Select filters now store values (IDs) directly in filter.values, not labels
          // Use the values directly for Supabase filtering
          const optionValues = filter.values.filter(val => val != null); // Remove any null/undefined values
          
          if (optionValues.length > 0) {
            if (optionValues.length === 1) {
              currentQuery = currentQuery.eq(supabaseField, optionValues[0]);
            } else {
              currentQuery = currentQuery.in(supabaseField, optionValues);
            }
          }
        } else if (filter.filterType === 'set') {
          // Set filters (for boolean and other column types)
          if (filter.values && filter.values.length > 0) {
            // Check if this is a boolean column
            const column = findColumnByField(columnId);
            const isBoolean = column?.cellDataType === 'boolean';
            
            // Convert values to proper types
            let convertedValues = filter.values;
            if (isBoolean) {
              // Convert string booleans to actual booleans for Supabase
              convertedValues = filter.values.map(val => {
                // Handle various boolean representations
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

    // Apply search filter to Supabase query
    const applySearchToSupabase = (query, searchValue, searchableColumns) => {
      if (!searchValue || !searchValue.trim() || !searchableColumns || !Array.isArray(searchableColumns) || searchableColumns.length === 0) {
        return query;
      }

      const searchTerm = searchValue.trim();
      const validColumns = searchableColumns.filter(col => col && typeof col === 'string' && col.trim().length > 0);

      if (validColumns.length === 0) {
        return query;
      }

      // Map searchable columns to their Supabase field paths
      // This allows searchableColumns to contain either column IDs or direct Supabase paths
      const supabaseSearchFields = validColumns.map(col => {
        // Check if this is a column ID that has a supabaseFilterField
        const column = props.content?.columns?.find(c => {
          const colId = c?.actionName || c?.field;
          return colId === col || c?.field === col;
        });
        // Use supabaseFilterField if provided and not empty, otherwise use the column ID as-is
        // This allows searchableColumns to contain either column IDs or direct Supabase paths
        const supabaseField = column?.supabaseFilterField?.trim();
        return (supabaseField && supabaseField.length > 0) ? supabaseField : col;
      });

      // Build OR condition for all searchable columns
      // For Supabase, we need to use .or() with proper syntax
      // Format: or('col1.ilike.%term%,col2.ilike.%term%,...')
      if (supabaseSearchFields.length === 1) {
        // Single column: just use ilike
        return query.ilike(supabaseSearchFields[0], `%${searchTerm}%`);
      } else {
        // Multiple columns: use OR condition
        // Supabase OR syntax: or('col1.ilike.%term%,col2.ilike.%term%')
        // Note: The pattern needs to be properly escaped for special characters
        const escapedTerm = searchTerm.replace(/'/g, "''"); // Escape single quotes
        const orConditions = supabaseSearchFields
          .map(col => `${col}.ilike.%${escapedTerm}%`)
          .join(',');
        return query.or(orConditions);
      }
    };

    // Apply manual filters to Supabase query
    const applyManualFilters = (query, manualFilters) => {
      if (!manualFilters || !Array.isArray(manualFilters) || manualFilters.length === 0) {
        return query;
      }

      let currentQuery = query;

      for (const filter of manualFilters) {
        if (!filter?.field || !filter?.operator) {
          continue;
        }

        const field = filter.field;
        const operator = filter.operator;
        const value = filter.value;

        // Handle different operators
        switch (operator) {
          case 'eq':
            currentQuery = currentQuery.eq(field, value);
            break;
          case 'neq':
            currentQuery = currentQuery.neq(field, value);
            break;
          case 'gt':
            currentQuery = currentQuery.gt(field, value);
            break;
          case 'gte':
            currentQuery = currentQuery.gte(field, value);
            break;
          case 'lt':
            currentQuery = currentQuery.lt(field, value);
            break;
          case 'lte':
            currentQuery = currentQuery.lte(field, value);
            break;
          case 'like':
            currentQuery = currentQuery.like(field, value);
            break;
          case 'ilike':
            currentQuery = currentQuery.ilike(field, value);
            break;
          case 'is':
            // Handle 'is' for null/boolean checks
            if (value === 'null' || value === null) {
              currentQuery = currentQuery.is(field, null);
            } else if (value === 'true') {
              currentQuery = currentQuery.is(field, true);
            } else if (value === 'false') {
              currentQuery = currentQuery.is(field, false);
            }
            break;
          case 'in':
            // Handle 'in' for arrays - value should be comma-separated or array
            if (Array.isArray(value)) {
              currentQuery = currentQuery.in(field, value);
            } else if (typeof value === 'string' && value.includes(',')) {
              const values = value.split(',').map(v => v.trim());
              currentQuery = currentQuery.in(field, values);
            } else if (value) {
              currentQuery = currentQuery.in(field, [value]);
            }
            break;
          case 'contains':
            currentQuery = currentQuery.contains(field, value);
            break;
          case 'containedBy':
            currentQuery = currentQuery.containedBy(field, value);
            break;
          default:
            // Default to eq if unknown operator
            currentQuery = currentQuery.eq(field, value);
        }
      }

      return currentQuery;
    };

    // Helper function to wait for Supabase instance to become available
    // Retries with exponential backoff up to a maximum wait time
    // This function is defined in setup scope but can be used in methods via closure
    const waitForSupabaseInstance = async (maxWaitTime = 10000, initialDelay = 100) => {
      const startTime = Date.now();
      let delay = initialDelay;
      const maxDelay = 2000; // Maximum delay between retries (2 seconds)
      
      while (Date.now() - startTime < maxWaitTime) {
        const supabase = wwLib.wwPlugins.supabase.instance;
        if (supabase) {
          return supabase;
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay); // Exponential backoff, capped at maxDelay
      }
      
      // If we've waited the maximum time, return null
      return null;
    };

    // waitForSupabaseInstance is already defined as a const function, 
    // it will be exposed from setup for methods to access

    // Fetch data from Supabase for infinite scrolling (returns data directly)
    const fetchSupabaseDataForInfinite = async (startRow, endRow, filterModel = null, sortModel = null, searchValue = null) => {
      if (props.content?.dataSource !== 'supabase') {
        return { data: [], totalCount: 0 };
      }

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        return { data: [], totalCount: 0 };
      }

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await waitForSupabaseInstance(10000, 100);
        if (!supabase) {
          throw new Error('Supabase instance not available after waiting');
        }

        // Start building the query
        let query = supabase.from(tableName).select(queryString, { count: 'exact' });

        // Apply manual filters first (these are always applied)
        const manualFilters = props.content?.supabaseFilters;
        if (manualFilters && Array.isArray(manualFilters) && manualFilters.length > 0) {
          query = applyManualFilters(query, manualFilters);
        }

        // Apply search filter (before other filters)
        if (props.content?.enableSearch && searchValue && searchValue.trim()) {
          const searchableColumns = props.content?.searchableColumns || [];
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

        // Apply range for infinite scrolling
        // Note: AG Grid's endRow is exclusive (e.g., if endRow=50, it wants rows 0-49)
        // Supabase range is inclusive, so we use endRow - 1
        const supabaseFrom = startRow;
        const supabaseTo = endRow - 1;
        query = query.range(supabaseFrom, supabaseTo);

        // Log query details
        const filtersText = formatFiltersForLog(filterModel);
        const sortText = sortModel && sortModel.length > 0 
          ? sortModel.map(s => `${s.colId} ${s.sort}`).join(', ')
          : 'none';
        const searchText = (props.content?.enableSearch && searchValue && searchValue.trim()) 
          ? `"${searchValue}"` 
          : 'none';
        
        console.log(`[Supabase Query] Table: ${tableName} | Filters: ${filtersText} | Sort: ${sortText} | Search: ${searchText} | Range: ${supabaseFrom}-${supabaseTo}`);

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        const resultData = Array.isArray(data) ? data : [];
        const totalCount = count || 0;

        return { data: resultData, totalCount };
      } catch (error) {
        console.error('[Supabase Infinite] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        return { data: [], totalCount: 0 };
      } finally {
        supabaseLoading.value = false;
      }
    };

    // Fetch data from Supabase
    const fetchSupabaseData = async (page = 1, pageSize = 10, filterModel = null, sortModel = null, searchValue = null) => {
      // Skip fetch if we're updating data locally
      if (isUpdatingDataLocally.value) {
        return;
      }
      
      if (props.content?.dataSource !== 'supabase') {
        return;
      }

      const tableName = props.content?.supabaseTable;
      const queryString = props.content?.supabaseQuery || '*';

      if (!tableName) {
        supabaseError.value = 'Supabase table name is required';
        return;
      }

      // Create a unique key for this fetch request
      const fetchKey = JSON.stringify({ page, pageSize, filterModel, sortModel, searchValue, tableName, queryString });
      
      // Prevent duplicate/recursive calls
      if (isFetchingData.value) {
        return;
      }
      
      // Check if this is the same request as the last one
      if (lastFetchParams.value === fetchKey) {
        return;
      }

      // Set fetching flag and store params
      isFetchingData.value = true;
      lastFetchParams.value = fetchKey;

      try {
        supabaseLoading.value = true;
        supabaseError.value = null;

        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await waitForSupabaseInstance(10000, 100);
        if (!supabase) {
          throw new Error('Supabase instance not available after waiting');
        }

        // Start building the query
        let query = supabase.from(tableName).select(queryString, { count: 'exact' });

        // Apply manual filters first (these are always applied)
        const manualFilters = props.content?.supabaseFilters;
        if (manualFilters && Array.isArray(manualFilters) && manualFilters.length > 0) {
          query = applyManualFilters(query, manualFilters);
        }

        // Apply search filter (before other filters)
        if (props.content?.enableSearch && searchValue && searchValue.trim()) {
          const searchableColumns = props.content?.searchableColumns || [];
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

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        // Log query details
        const filtersText = formatFiltersForLog(filterModel);
        const sortText = sortModel && sortModel.length > 0 
          ? sortModel.map(s => `${s.colId} ${s.sort}`).join(', ')
          : 'none';
        const searchText = (props.content?.enableSearch && searchValue && searchValue.trim()) 
          ? `"${searchValue}"` 
          : 'none';
        
        console.log(`[Supabase Query] Table: ${tableName} | Filters: ${filtersText} | Sort: ${sortText} | Search: ${searchText} | Page: ${page} (${from}-${to})`);

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        supabaseData.value = Array.isArray(data) ? data : [];
        supabaseTotalCount.value = count || 0;

        // Update records after data is fetched (records will also be updated via rowData watch, but this ensures it's immediate)
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      } catch (error) {
        console.error('[Supabase] Error fetching data:', error);
        supabaseError.value = error.message || 'Failed to fetch data from Supabase';
        supabaseData.value = [];
        supabaseTotalCount.value = 0;
        setRecords([]);
      } finally {
        supabaseLoading.value = false;
        // Clear fetching flag after a short delay to allow grid to update
        setTimeout(() => {
          isFetchingData.value = false;
        }, 100);
      }
    };

    const gridApi = shallowRef(null);
    const { value: selectedRows, setValue: setSelectedRows } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "selectedRows",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: filterValue, setValue: setFilters } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "filters",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: sortValue, setValue: setSort } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "sort",
        type: "object",
        defaultValue: {},
        readonly: true,
      });
    const { value: columnOrder, setValue: setColumnOrder } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "columnOrder",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: hiddenColumns, setValue: setHiddenColumns } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "hiddenColumns",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const showColumnChooser = ref(false);
    const columnChooserRef = ref(null);
    const columnChooserSearch = ref('');
    const chooserColumnOrder = ref([]); // local ordered list of colIds for the panel
    const chooserHiddenState = ref([]); // local reactive hidden-columns list for the chooser UI
    const chooserDragColId = ref(null);
    const chooserDragOverColId = ref(null);

    const handleClickOutside = (event) => {
      if (columnChooserRef.value && !columnChooserRef.value.contains(event.target)) {
        showColumnChooser.value = false;
      }
    };

    let clickOutsideTimer = null;
    watch(showColumnChooser, (val) => {
      if (val) {
        // Initialize chooser order and hidden state from current grid state
        if (gridApi.value) {
          const gridCols = gridApi.value.getAllGridColumns();
          chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
          chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
        }
        columnChooserSearch.value = '';
        // Delay so the current click that opened the panel doesn't immediately close it.
        // Timer is tracked so it can be cancelled if the panel closes before it fires.
        clickOutsideTimer = setTimeout(() => {
          clickOutsideTimer = null;
          wwLib.getFrontDocument().addEventListener('click', handleClickOutside);
        }, 0);
      } else {
        // Cancel pending attach if panel closed before timer fired
        if (clickOutsideTimer !== null) {
          clearTimeout(clickOutsideTimer);
          clickOutsideTimer = null;
        }
        wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
        chooserDragColId.value = null;
        chooserDragOverColId.value = null;
      }
    });

    onBeforeUnmount(() => {
      if (clickOutsideTimer !== null) clearTimeout(clickOutsideTimer);
      wwLib.getFrontDocument().removeEventListener('click', handleClickOutside);
    });

    const { value: records, setValue: setRecords } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "records",
        type: "array",
        defaultValue: [],
        readonly: true,
      });
    const { value: isFetching, setValue: setIsFetching } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "isFetching",
        type: "boolean",
        defaultValue: false,
        readonly: true,
      });
    
    // Exposed variable for current grid configuration (includes user edits)
    // This can be stored and passed back to viewConfiguration to restore state
    const { value: currentConfig, setValue: setCurrentConfig } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "currentConfig",
        type: "object",
        defaultValue: {
          sizes: {},
          filters: {},
          sorting: [],
          columnsOrder: [],
          hiddenColumns: [],
        },
        readonly: true,
      });
    
    // Exposed variable for the configured column definitions (mirrors props.content.columns)
    const { value: columnDefsVar, setValue: setColumnDefsVar } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "columnDefs",
        type: "array",
        defaultValue: [],
        readonly: true,
      });

    watch(
      () => props.content?.columns,
      (newCols) => {
        setColumnDefsVar(Array.isArray(newCols) ? newCols : []);
      },
      { immediate: true, deep: true }
    );

    // Helper function to get current column widths from the grid
    const getCurrentColumnWidths = () => {
      if (!gridApi.value) return {};
      
      const columns = gridApi.value.getAllGridColumns();
      const widths = {};
      
      columns?.forEach((col) => {
        const colId = col.getColId();
        const actualWidth = col.getActualWidth();
        if (colId && actualWidth) {
          widths[colId] = actualWidth;
        }
      });
      
      return widths;
    };
    
    // Helper function to update the currentConfig exposed variable
    const updateCurrentConfig = () => {
      if (!gridApi.value) return;
      
      const columns = gridApi.value.getAllGridColumns();
      const config = {
        sizes: getCurrentColumnWidths(),
        filters: filterValue.value || {},
        sorting: sortValue.value || [],
        columnsOrder: columns?.map((col) => col.getColId()) || columnOrder.value || [],
        hiddenColumns: hiddenColumns.value || [],
      };
      
      setCurrentConfig(config);
    };

    // Function to update records variable from grid API (gets displayed rows)
    // Defined early so it can be used in onGridReady and other handlers
    // CRITICAL FIX: This function can trigger error #252 if called during render
    // Always call via safeUpdateRecordsFromGrid to ensure it runs outside render cycle
    const updateRecordsFromGrid = () => {
      if (!gridApi.value) {
        setRecords([]);
        return;
      }
      
      // Don't update records if grid is in the middle of rendering
      if (isGridRendering.value) {
        return;
      }

      try {
        const displayedRows = [];
        // Get all displayed row nodes from the grid
        gridApi.value.forEachNode((node) => {
          if (node.data) {
            displayedRows.push(node.data);
          }
        });
        setRecords(displayedRows);
      } catch (error) {
        // Check if this is the #252 error and silently retry later
        if (error.message && error.message.includes('#252')) {
          // Defer the update to avoid the render conflict
          setTimeout(() => updateRecordsFromGrid(), 100);
        } else {
          console.error('[Records] Error updating records from grid:', error);
          setRecords([]);
        }
      }
    };

    const gridReady = ref(false);
    const dataRendered = ref(false);
    const dataLoadingTimeout = ref(null);
    const gridContainerRef = ref(null);
    
    // CRITICAL FIX: Track when the grid is actively rendering to prevent error #252
    // "cannot get grid to draw rows when it is in the middle of drawing rows"
    const isGridRendering = ref(false);
    
    // Helper to safely call grid API methods - defers to next tick if grid is rendering
    const safeGridApiCall = (callback, delay = 0) => {
      return new Promise((resolve) => {
        const executeCall = () => {
          if (!gridApi.value) {
            resolve(false);
            return;
          }
          
          // If grid is rendering, defer the call
          if (isGridRendering.value) {
            setTimeout(() => executeCall(), 10);
            return;
          }
          
          try {
            const result = callback();
            resolve(result);
          } catch (error) {
            // If we still get the error, retry with a longer delay
            if (error.message && error.message.includes('#252')) {
              setTimeout(() => executeCall(), 50);
            } else {
              console.error('[Datagrid] Safe API call error:', error);
              resolve(false);
            }
          }
        };
        
        if (delay > 0) {
          setTimeout(executeCall, delay);
        } else {
          executeCall();
        }
      });
    };
    
    // Helper to wait for grid to be fully ready (not just initialized, but ready for API calls)
    const waitForGridReady = (timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          // Check if grid API is available and grid is marked as ready
          if (gridApi.value && gridReady.value && !isGridRendering.value) {
            resolve(true);
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error('[Datagrid] Timeout waiting for grid to be ready'));
            return;
          }
          
          // Check again in a short interval
          setTimeout(checkReady, 50);
        };
        
        checkReady();
      });
    };
    
    // Helper to wait for a specific row to appear in the grid (useful after refreshRow in infinite scroll)
    const waitForRowInGrid = (rowId, timeout = 10000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const rowIdStr = String(rowId);
        
        const checkRow = () => {
          // First ensure grid is ready
          if (!gridApi.value || !gridReady.value) {
            if (Date.now() - startTime > timeout) {
              reject(new Error(`[Datagrid] Timeout waiting for row ${rowId} to appear in grid`));
              return;
            }
            setTimeout(checkRow, 100);
            return;
          }
          
          // Wait for rendering to complete
          if (isGridRendering.value) {
            if (Date.now() - startTime > timeout) {
              reject(new Error(`[Datagrid] Timeout waiting for row ${rowId} - grid still rendering`));
              return;
            }
            setTimeout(checkRow, 100);
            return;
          }
          
          // Try to find the row in the grid
          let rowFound = false;
          gridApi.value.forEachNode((node) => {
            if (!rowFound && node.data) {
              const nodeIdValue = node.data.id ?? node.data[Object.keys(node.data)[0]];
              if (String(nodeIdValue) === rowIdStr || String(node.id) === rowIdStr) {
                rowFound = true;
              }
            }
          });
          
          if (rowFound) {
            resolve(true);
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error(`[Datagrid] Timeout waiting for row ${rowId} to appear in grid`));
            return;
          }
          
          // Check again in a short interval
          setTimeout(checkRow, 150);
        };
        
        checkRow();
      });
    };
    
    // Supabase data state
    const supabaseData = ref([]);
    const supabaseTotalCount = ref(0);
    const supabaseLoading = ref(false);
    const supabaseError = ref(null);
    const filterDebounceTimer = ref(null);
    const searchDebounceTimer = ref(null);
    
    // Guard to prevent duplicate/recursive fetches
    const isFetchingData = ref(false);
    const lastFetchParams = ref(null);
    
    // Flag to prevent data fetching when we're updating data locally (e.g., fake junction records)
    const isUpdatingDataLocally = ref(false);
    
    // Track removed row IDs for infinite scroll mode (so datasource can filter them out)
    const removedRowIds = ref(new Set());
    
    // Helper functions to set/get the flag from methods
    const setUpdatingDataLocally = (value) => {
      isUpdatingDataLocally.value = value;
    };
    const getUpdatingDataLocally = () => {
      return isUpdatingDataLocally.value;
    };

    const onGridReady = (params) => {
      gridApi.value = params.api;
      gridReady.value = true;
      // Set rendering flag during initial setup
      isGridRendering.value = true;
      
      const columns = params.api.getAllGridColumns();
      
      // Set initial column order from viewConfiguration if provided with values
      // At grid initialization, we use viewConfiguration.columnsOrder if it has values
      // Otherwise, use the default order from grid (from column definitions)
      const viewConfig = props.content.viewConfiguration;
      const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
      const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;
      
      if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
        setColumnOrder([...viewColumnsOrder]);
      } else {
        // Use default order from grid (no explicit order in viewConfiguration)
        setColumnOrder(columns.map((col) => col.getColId()));
      }
      
      // Update records from grid after grid is ready
      nextTick(() => {
        setTimeout(() => {
          updateRecordsFromGrid();
          // Initialize currentConfig after grid is ready
          updateCurrentConfig();
        }, 200);
      });
      
      // If data is already present when grid is ready, mark as rendered after a short delay
      nextTick(() => {
        if (rowData.value && rowData.value.length > 0) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              dataRendered.value = true;
              // Clear rendering flag after data is rendered
              isGridRendering.value = false;
            }, 200);
          });
        } else {
          // Empty data means it's loaded
          dataRendered.value = true;
          // Clear rendering flag
          setTimeout(() => {
            isGridRendering.value = false;
          }, 100);
        }
      });
    };
    
    // CRITICAL FIX: Track when grid finishes its first data render
    // This helps prevent error #252 by knowing when it's safe to call API methods
    const onFirstDataRendered = () => {
      // Clear rendering flag when first data is rendered
      setTimeout(() => {
        isGridRendering.value = false;
        dataRendered.value = true;
        
        // Apply focused row if focusedRowId is set (scroll to row on first render)
        const focusedRowId = props.content?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Use a longer delay to ensure grid is fully ready
          setTimeout(() => {
            if (gridApi.value && !isGridRendering.value) {
              // Find and scroll to the focused row
              const rowIdStr = String(focusedRowId);
              let rowNode = gridApi.value.getRowNode(rowIdStr);
              
              // Search through all rows if not found directly
              if (!rowNode) {
                gridApi.value.forEachNode((node) => {
                  if (!rowNode && node.data) {
                    let baseId = resolveMappingFormula(props.content.idFormula, node.data);
                    if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
                      baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
                    }
                    const baseIdStr = baseId != null ? String(baseId) : '';
                    if (baseIdStr === rowIdStr || 
                        (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
                        (node.id && String(node.id) === rowIdStr)) {
                      rowNode = node;
                    }
                  }
                });
              }
              
              // Scroll to and focus the row if found
              if (rowNode && rowNode.rowIndex !== null && rowNode.rowIndex !== undefined) {
                gridApi.value.ensureIndexVisible(rowNode.rowIndex, 'middle');
              }
            }
          }, 150);
        }
      }, 50);
    };
    
    // CRITICAL FIX: Track model updates to know when grid is actively rendering
    // This helps prevent error #252 during data updates
    const onModelUpdated = (event) => {
      // The model update is complete, clear rendering flag after a short delay
      // to allow any cascading renders to complete
      setTimeout(() => {
        isGridRendering.value = false;
        
        // Re-apply focused row styling after model update (e.g., after filter/sort/pagination)
        // This ensures the focused row remains visually highlighted even after data changes
        const focusedRowId = props.content?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Redraw rows to ensure rowStyle is re-applied with current focusedRowId
          if (gridApi.value && !isGridRendering.value) {
            // Don't scroll on model updates, just ensure styling is correct
            // The rowStyle function will handle the visual highlighting
          }
        }
      }, 50);
    };

    // Track last applied view configuration to detect changes
    const lastAppliedViewConfig = ref(null);
    
    // Flag to track when view configuration is being applied programmatically
    // This prevents filter/sort changed events from being triggered during view config changes
    const isApplyingViewConfig = ref(false);

    // Helper function to apply view configuration to the grid
    const applyViewConfiguration = (viewConfig, isInitial = false) => {
      if (!gridApi.value) return;
      
      debugLog('[ViewConfiguration] Applying view configuration:', viewConfig, 'isInitial:', isInitial);
      
      // Set flag to indicate we're applying view config programmatically
      isApplyingViewConfig.value = true;
      
      // Defer API calls to prevent error #252 during render cycle
      setTimeout(() => {
        if (!gridApi.value) {
          isApplyingViewConfig.value = false;
          return;
        }
        
        try {
          // 1. Apply filters if key is present (even if empty {} - which clears all filters)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'filters' in viewConfig) {
            const filters = viewConfig.filters;
            gridApi.value.setFilterModel(isEmptyConfigValue(filters) ? null : filters);
            debugLog('[ViewConfiguration] Applied filters:', filters, '(empty clears all filters)');
          } else {
            debugLog('[ViewConfiguration] Skipped filters (key not present, keeping current state)');
          }
          
          // 2. Apply sorting if key is present (even if empty [] - which clears all sorting)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'sorting' in viewConfig) {
            const sorting = viewConfig.sorting;
            if (isEmptyConfigValue(sorting)) {
              // Clear all sorting
              gridApi.value.applyColumnState({
                defaultState: { sort: null },
              });
              debugLog('[ViewConfiguration] Cleared all sorting (empty array)');
            } else {
              gridApi.value.applyColumnState({
                state: sorting,
                defaultState: { sort: null },
              });
              debugLog('[ViewConfiguration] Applied sorting:', sorting);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped sorting (key not present, keeping current state)');
          }
          
          // 3. Apply column order if key is present (even if empty [] - which resets to default order)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'columnsOrder' in viewConfig) {
            const columnsOrder = viewConfig.columnsOrder;
            if (isEmptyConfigValue(columnsOrder) || !Array.isArray(columnsOrder)) {
              // Reset to default column order (from column definitions)
              const defaultOrder = gridApi.value.getAllGridColumns()?.map(col => col.getColId()) || [];
              setColumnOrder([...defaultOrder]);
              debugLog('[ViewConfiguration] Reset columns order to default:', defaultOrder);
            } else {
              gridApi.value.applyColumnState({
                state: columnsOrder.map((colId) => ({ colId })),
                applyOrder: true,
              });
              setColumnOrder([...columnsOrder]);
              debugLog('[ViewConfiguration] Applied columns order:', columnsOrder);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped columns order (key not present, keeping current state)');
          }
          
          // 4. Apply column sizes if key is present (even if empty {} - which resets to default widths)
          // Only skip if the key is completely absent from viewConfig
          if (viewConfig && 'sizes' in viewConfig) {
            const sizes = viewConfig.sizes;
            const columns = gridApi.value.getAllGridColumns();
            
            if (isEmptyConfigValue(sizes)) {
              // Reset to default column widths from column configuration
              // Build column state with default widths (or null for flex columns)
              const columnState = [];
              const contentColumns = props.content?.columns || [];
              
              for (const col of columns) {
                const colId = col.getColId();
                // Find the column config to get default width
                const colConfig = contentColumns.find(c => 
                  (c?.actionName || c?.field) === colId
                );
                
                if (colConfig) {
                  // For flex columns, clear width to let flex take over
                  // For fixed columns, use the configured width
                  if (colConfig.widthAlgo === 'flex') {
                    columnState.push({ colId, width: null, flex: colConfig.flex ?? 1 });
                  } else if (colConfig.width && colConfig.width !== 'auto') {
                    const defaultWidth = wwLib.wwUtils.getLengthUnit(colConfig.width)?.[0];
                    if (defaultWidth) {
                      columnState.push({ colId, width: defaultWidth, flex: null });
                    }
                  }
                }
              }
              
              if (columnState.length > 0) {
                gridApi.value.applyColumnState({ state: columnState });
              }
              debugLog('[ViewConfiguration] Reset column sizes to default:', columnState);
            } else if (typeof sizes === 'object') {
              // Apply specific column widths
              const columnState = columns.map(col => {
                const colId = col.getColId();
                const width = sizes[colId];
                return width !== undefined ? { colId, width } : { colId };
              }).filter(state => state.width !== undefined);
              
              if (columnState.length > 0) {
                gridApi.value.applyColumnState({
                  state: columnState,
                });
                debugLog('[ViewConfiguration] Applied column sizes:', sizes);
              }
            }
          } else {
            debugLog('[ViewConfiguration] Skipped column sizes (key not present, keeping current state)');
          }
          
          // 5. Apply hidden columns if key is present
          if (viewConfig && 'hiddenColumns' in viewConfig) {
            const hidden = viewConfig.hiddenColumns;
            if (isEmptyConfigValue(hidden)) {
              // Show all columns (clear hidden state)
              setHiddenColumns([]);
              chooserHiddenState.value = [];
              const allCols = gridApi.value.getAllGridColumns();
              const colIds = allCols?.map(c => c.getColId()).filter(Boolean) || [];
              if (colIds.length > 0) {
                gridApi.value.setColumnsVisible(colIds, true);
              }
              debugLog('[ViewConfiguration] Cleared all hidden columns (empty array)');
            } else if (Array.isArray(hidden)) {
              setHiddenColumns([...hidden]);
              chooserHiddenState.value = [...hidden];
              const hiddenSet = new Set(hidden);
              const allCols = gridApi.value.getAllGridColumns();
              const toShow = [];
              const toHide = [];
              allCols?.forEach(col => {
                const cid = col.getColId();
                if (!cid) return;
                (hiddenSet.has(cid) ? toHide : toShow).push(cid);
              });
              if (toShow.length) gridApi.value.setColumnsVisible(toShow, true);
              if (toHide.length) gridApi.value.setColumnsVisible(toHide, false);
              debugLog('[ViewConfiguration] Applied hidden columns:', hidden);
            }
          } else {
            debugLog('[ViewConfiguration] Skipped hidden columns (key not present, keeping current state)');
          }

          // 6. Clear row selections when view changes (not on initial load)
          if (!isInitial) {
            gridApi.value.deselectAll();
            setSelectedRows([]);
            debugLog('[ViewConfiguration] Cleared row selections');
          }
          
          // Store the applied config
          lastAppliedViewConfig.value = JSON.stringify(viewConfig);
          
          // Reset flag after a short delay to allow AG Grid events to settle
          // AG Grid events are triggered asynchronously after API calls
          setTimeout(() => {
            isApplyingViewConfig.value = false;
            // Update currentConfig to reflect the applied view configuration
            updateCurrentConfig();
            // Sync chooser order and hidden state so the column management menu is up to date
            if (gridApi.value) {
              const gridCols = gridApi.value.getAllGridColumns();
              chooserColumnOrder.value = gridCols?.map(c => c.getColId()).filter(Boolean) || [];
              chooserHiddenState.value = gridCols?.filter(c => !c.isVisible()).map(c => c.getColId()).filter(Boolean) || [];
            }
            debugLog('[ViewConfiguration] View config application complete, events re-enabled');
          }, 100);
          
        } catch (e) {
          debugLog('[ViewConfiguration] Error applying view configuration:', e);
          isApplyingViewConfig.value = false;
          // Retry after a short delay if it's an AG Grid timing issue
          if (e.message && e.message.includes('#252')) {
            setTimeout(() => {
              applyViewConfiguration(viewConfig, isInitial);
            }, 100);
          }
        }
      }, 0);
    };

    // Watch for grid ready to apply initial view configuration
    watch(
      () => gridReady.value,
      (ready) => {
        if (!ready || !gridApi.value) return;
        
        // Apply initial view configuration when grid is ready
        if (props.content.viewConfiguration) {
          applyViewConfiguration(props.content.viewConfiguration, true);
        }
      },
      { immediate: true }
    );

    // Watch for viewConfiguration changes to apply new settings
    watch(
      () => props.content.viewConfiguration,
      (newConfig, oldConfig) => {
        if (!gridApi.value || !gridReady.value) return;
        
        // Stringify to compare deep equality
        const newConfigStr = JSON.stringify(newConfig);
        const oldConfigStr = lastAppliedViewConfig.value;
        
        // Only apply if the configuration has actually changed
        if (newConfigStr !== oldConfigStr) {
          debugLog('[ViewConfiguration] Configuration changed, applying new view');
          applyViewConfiguration(newConfig, false);
        }
      },
      { deep: true }
    );

    // CRITICAL FIX: initialState should only be set once on mount, not reactive
    // If it's reactive, it will reset filters/sorting whenever props change
    // We use a ref to ensure it's set only once and never changes
    const initialState = ref(null);
    
    // Set initial state only once when component mounts
    // After the grid is ready and applies this state, we don't use it again
    // This prevents overriding user-applied filters and sorts
    if (!initialState.value) {
      const state = {
        partialColumnState: true,
      };
      // NOTE: Filters, sorts, and sizes are applied via watcher when viewConfiguration changes
      // We only set column order in initialState for AG Grid's initial render
      // At initialization, both "key absent" and "empty array []" use default column order
      // The distinction between absent vs empty matters for runtime changes (handled by applyViewConfiguration)
      const viewConfig = props.content.viewConfiguration;
      const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
      const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;
      
      // Only set initial column order if explicitly provided with values
      if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
        state.columnOrder = {
          orderedColIds: viewColumnsOrder,
        };
      }
      initialState.value = state;
    }

    const onRowSelected = (event) => {
      const name = event.node.isSelected() ? "rowSelected" : "rowDeselected";
      ctx.emit("trigger-event", {
        name,
        event: { row: event.data },
      });
    };

    const onRowDragged = (event) => {
      const rows = [];
      event.api.forEachNode((node) => {
        rows.push(node.data);
      });
      ctx.emit("trigger-event", {
        name: "rowDragged",
        event: {
          row: event.node.data,
          id: event.node.id,
          targetIndex: event.overIndex,
          rows,
        },
      });
    };

    const onRowDragEnter = (event) => {
      ctx.emit("trigger-event", {
        name: "rowDragStart",
        event: {
          row: event.node.data,
          id: event.node.id,
        },
      });
    };

    const onSelectionChanged = (event) => {
      if (!gridApi.value) return;
      const selected = gridApi.value.getSelectedRows() || [];
      setSelectedRows(selected);
    };

    const onFilterChanged = (event) => {
      if (!gridApi.value) return;

      const filterModel = gridApi.value.getFilterModel();
      if (
        JSON.stringify(filterModel || {}) !==
        JSON.stringify(filterValue.value || {})
      ) {
        setFilters(filterModel);
        
        // Update currentConfig to reflect the new filter state
        updateCurrentConfig();
        
        // Only emit event if this is a user-initiated change (not from view configuration)
        if (!isApplyingViewConfig.value) {
          ctx.emit("trigger-event", {
            name: "filterChanged",
            event: filterModel,
          });
        } else {
          debugLog('[FilterChanged] Skipping event emission - change is from view configuration');
        }

        // If using Supabase, debounce filter changes to avoid excessive API calls
        if (props.content?.dataSource === 'supabase') {
          // Clear existing debounce timer
          if (filterDebounceTimer.value) {
            clearTimeout(filterDebounceTimer.value);
          }

          // Debounce filter changes (300ms)
          filterDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, AG Grid automatically handles filter changes
              // when filterChangedCallback() is called by the filter component.
              // It resets its cache and calls getRows with the new filterModel.
              // We do NOT need to manually set the datasource - that causes duplicate queries.
              // Just update records after the grid has refreshed.
              // AG Grid handles this automatically - just update records after refresh
              nextTick(() => {
                setTimeout(() => {
                  updateRecordsFromGrid();
                }, 200);
              });
            } else {
              // For pagination mode, fetch data
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
              // Records will be updated when rowData changes (via watch)
            }
          }, 300);
        } else {
          // For non-Supabase, update records after filter change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
      }
    };

    const onSortChanged = (event) => {
      if (!gridApi.value) return;

      const state = gridApi.value.getState();
      if (
        JSON.stringify(state.sort?.sortModel || []) !==
        JSON.stringify(sortValue.value || [])
      ) {
        setSort(state.sort?.sortModel || []);
        
        // Update currentConfig to reflect the new sort state
        updateCurrentConfig();
        
        // Only emit event if this is a user-initiated change (not from view configuration)
        if (!isApplyingViewConfig.value) {
          ctx.emit("trigger-event", {
            name: "sortChanged",
            event: state.sort?.sortModel || [],
          });
        } else {
          debugLog('[SortChanged] Skipping event emission - change is from view configuration');
        }

        // If using Supabase, refetch data with new sort
        if (props.content?.dataSource === 'supabase') {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, AG Grid automatically handles sort changes.
            // It resets its cache and calls getRows with the new sortModel.
            // We do NOT need to manually set the datasource - that causes duplicate queries.
            // Just update records after the grid has refreshed.
            // AG Grid handles this automatically - just update records after refresh
            nextTick(() => {
              setTimeout(() => {
                updateRecordsFromGrid();
              }, 200);
            });
          } else {
            // For pagination mode, fetch data
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = state.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            // Records will be updated when rowData changes (via watch)
          }
        } else {
          // For non-Supabase, update records after sort change
          nextTick(() => {
            setTimeout(() => {
              updateRecordsFromGrid();
            }, 100);
          });
        }
      }
    };

    const onPaginationChanged = (event) => {
      if (!gridApi.value) return;
      
      // Skip pagination changes if infinite scrolling is enabled
      if (isInfiniteScrollEnabled.value) {
        return;
      }
      
      // Skip if we're updating data locally (e.g., fake junction records)
      // This prevents refreshCells from triggering unnecessary fetches
      if (isUpdatingDataLocally.value) {
        return;
      }
      
      // If using Supabase, refetch data for new page
      if (props.content?.dataSource === 'supabase') {
        const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
        const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
        const filterModel = gridApi.value.getFilterModel();
        const state = gridApi.value.getState();
        const sortModel = state?.sort?.sortModel || [];
        const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
        fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
        // Records will be updated when rowData changes (via watch)
      } else {
        // For non-Supabase, update records after pagination change
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }
    };

    const onColumnMoved = (event) => {
      if (!event.finished || event.source !== "uiColumnMoved") return;
      const columns = event.api.getAllGridColumns();
      const newOrder = columns.map((col) => col.getColId());
      setColumnOrder(newOrder);

      // Keep chooser panel in sync so it doesn't show a stale order if open
      if (showColumnChooser.value) {
        chooserColumnOrder.value = newOrder.filter(Boolean);
      }

      // Update currentConfig to reflect the new column order
      updateCurrentConfig();
      
      ctx.emit("trigger-event", {
        name: "columnMoved",
        event: {
          toIndex: event.toIndex,
          columnId: event.column.getColId(),
          columnsOrder: columns.map((col) => col.getColId()),
        },
      });
    };

    const onColumnResized = (event) => {
      // Only emit on user-initiated resize that is finished
      if (!event.finished || event.source !== "uiColumnResized") return;
      
      const columns = event.api.getAllGridColumns();
      const columnsWidths = {};
      
      // Build an object of all column widths
      columns.forEach((col) => {
        const colId = col.getColId();
        const actualWidth = col.getActualWidth();
        if (colId && actualWidth) {
          columnsWidths[colId] = actualWidth;
        }
      });
      
      // Update currentConfig to reflect the new column widths
      updateCurrentConfig();
      
      // Get the resized column info
      const resizedColumn = event.column;
      const columnId = resizedColumn?.getColId();
      const width = resizedColumn?.getActualWidth();
      
      ctx.emit("trigger-event", {
        name: "columnResized",
        event: {
          columnId: columnId,
          width: width,
          columnsWidths: columnsWidths,
        },
      });
    };

    // Track scroll debounce timer
    const scrollDebounceTimer = ref(null);

    // Cleanup on unmount
    onBeforeUnmount(() => {
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      if (filterDebounceTimer.value) {
        clearTimeout(filterDebounceTimer.value);
      }
      if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value);
      }
    });

    const onBodyScroll = (event) => {
      if (!gridApi.value) return;
      
      const api = event?.api || gridApi.value;
      
      // Get scroll container dimensions from the grid container ref
      if (!gridContainerRef.value) return;
      
      const scrollContainer = gridContainerRef.value.querySelector('.ag-body-viewport');
      if (!scrollContainer) return;
      
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const scrollTopPos = scrollContainer.scrollTop || event?.top || 0;
      const scrollLeftPos = scrollContainer.scrollLeft || event?.left || 0;
      
      // Calculate if near bottom (within 100px of bottom)
      const distanceFromBottom = scrollHeight - (scrollTopPos + clientHeight);
      const isNearBottom = distanceFromBottom <= 100;
      const isAtBottom = distanceFromBottom <= 5;
      
      // Debounce to avoid too many events
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      
      scrollDebounceTimer.value = setTimeout(() => {
        // Emit scroll event with useful information for pagination management
        ctx.emit("trigger-event", {
          name: "scroll",
          event: {
            scrollTop: scrollTopPos,
            scrollLeft: scrollLeftPos,
            scrollHeight: scrollHeight,
            clientHeight: clientHeight,
            distanceFromBottom: distanceFromBottom,
            isNearBottom: isNearBottom,
            isAtBottom: isAtBottom,
            totalRows: api.getDisplayedRowCount() || 0,
          },
        });
      }, 100); // 100ms debounce to reduce event frequency
    };

    /* wwEditor:start */
    const { createElement } = wwLib.useCreateElement();
    /* wwEditor:end */

    // Hack to force pagination page size update when changing pagination selector mode
    const forcedPaginationPageSize = ref(false);
    watch(
      () => props.content.hasPaginationSelector,
      (newVal, oldVal) => {
        if (oldVal === "multiple" && newVal !== "multiple") {
          forcedPaginationPageSize.value = true;
          nextTick().then(() => {
            forcedPaginationPageSize.value = false;
          });
        }
      }
    );

    // Determine if infinite scrolling is enabled
    const isInfiniteScrollEnabled = computed(() => {
      return props.content?.dataSource === 'supabase' && props.content?.enableInfiniteScroll === true;
    });

    // Row model type - 'infinite' if enabled, otherwise undefined (defaults to client-side)
    const rowModelType = computed(() => {
      return isInfiniteScrollEnabled.value ? 'infinite' : undefined;
    });

    // Row drag managed - disabled for infinite row model (not supported by AG Grid)
    const rowDragManaged = computed(() => {
      return !isInfiniteScrollEnabled.value;
    });

    // Pagination should be disabled when infinite scrolling is enabled
    const paginationEnabled = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return false;
      }
      return props.content?.pagination;
    });

    // Cache block size for infinite scrolling
    const cacheBlockSize = computed(() => {
      if (isInfiniteScrollEnabled.value) {
        return props.content?.infiniteBlockSize || 100;
      }
      return undefined;
    });

    // Create datasource for infinite scrolling
    const datasource = computed(() => {
      if (!isInfiniteScrollEnabled.value) {
        return undefined;
      }

      return {
        rowCount: undefined, // Will be determined dynamically
        getRows: async (params) => {
          const { startRow, endRow, sortModel, filterModel, successCallback, failCallback } = params;

          // Skip fetching if we're updating data locally (e.g., removing a row)
          // This prevents unnecessary re-fetches when we're making local modifications
          // For infinite scroll, AG Grid will automatically try to refetch when rows are removed
          // We prevent this by checking the flag and using the current supabaseData cache
          if (isUpdatingDataLocally.value) {
            // IMPORTANT: We need to check if the requested block matches our cached block
            // If it doesn't, we should return empty data to force AG Grid to hide those rows
            // Otherwise, return filtered cached data
            
            let cachedData = Array.isArray(supabaseData.value) ? [...supabaseData.value] : [];
            let cachedTotal = supabaseTotalCount.value || 0;
            
            // CRITICAL: Filter out any removed rows (tracked in removedRowIds ref)
            // This ensures removed rows don't appear when datasource is refreshed
            if (removedRowIds.value && removedRowIds.value.size > 0) {
              const beforeFilter = cachedData.length;
              cachedData = cachedData.filter(row => {
                if (!row) return false; // Skip null/undefined rows
                // Get row ID using idFormula
                const rowId = resolveMappingFormula(props.content?.idFormula, row);
                const rowIdStr = rowId != null ? String(rowId) : '';
                // Keep row if it's not in the removed set
                return !removedRowIds.value.has(rowIdStr);
              });
              const afterFilter = cachedData.length;
              // Adjust total count if we filtered out rows
              if (beforeFilter > afterFilter && cachedTotal > 0) {
                cachedTotal = Math.max(0, cachedTotal - (beforeFilter - afterFilter));
              }
            }
            
            // Return filtered cached data
            // If cached data is empty or we filtered everything out, return empty with adjusted total
            // This tells AG Grid there's no data for this block, which will hide empty rows
            const finalTotal = cachedData.length > 0 ? cachedTotal : (cachedTotal > 0 ? cachedTotal : 0);
            // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
            // This ensures the callback is called outside the render cycle
            isGridRendering.value = true;
            setTimeout(() => {
              try {
                successCallback(cachedData, finalTotal > 0 ? finalTotal : (cachedData.length > 0 ? undefined : 0));
              } finally {
                // Clear the rendering flag after a small delay
                setTimeout(() => {
                  isGridRendering.value = false;
                }, 50);
              }
            }, 0);
            return;
          }
          const requestedBlockSize = endRow - startRow;

          try {
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            
            const { data, totalCount } = await fetchSupabaseDataForInfinite(
              startRow,
              endRow,
              filterModel,
              sortModel,
              searchValue
            );

            // Determine if this is the last row
            // If we got fewer rows than requested, or if we've reached the total count, we're done
            const rowCount = data.length;
            
            // CRITICAL FIX: Handle 0 rows case
            // If totalCount is 0, we're definitely done (no rows to show)
            // If we got fewer rows than requested, we're done (last block)
            // If we've reached or exceeded totalCount, we're done
            const isLastBlock = totalCount === 0 || 
                                rowCount < requestedBlockSize || 
                                (totalCount > 0 && endRow >= totalCount);
            
            // CRITICAL FIX: Set lastRow to 0 when totalCount is 0 (no rows)
            // This tells AG Grid to stop fetching and show "no rows" message
            const lastRow = isLastBlock ? (totalCount === 0 ? 0 : totalCount) : undefined;

            // Update supabaseData for records variable first (before callback)
            // Note: In infinite scroll mode, supabaseData will only contain the current block
            // The grid manages the full dataset internally
            supabaseData.value = data;
            supabaseTotalCount.value = totalCount;

            // CRITICAL FIX: Use setTimeout to defer successCallback, preventing error #252
            // This ensures the callback is called outside the current render cycle
            isGridRendering.value = true;
            setTimeout(() => {
              try {
                // Call success callback with the data
                successCallback(data, lastRow);
              } catch (error) {
                console.error('[Infinite Scroll] Error in successCallback:', error);
              } finally {
                // Clear the rendering flag after a small delay to allow grid to finish
                setTimeout(() => {
                  isGridRendering.value = false;
                  // Update records from grid after rendering is complete
                  nextTick(() => {
                    setTimeout(() => {
                      updateRecordsFromGrid();
                    }, 50);
                  });
                }, 50);
              }
            }, 0);
          } catch (error) {
            console.error('[Infinite Scroll] Error in getRows:', error);
            isGridRendering.value = false;
            setTimeout(() => {
              failCallback();
            }, 0);
          }
        },
      };
    });

    // CRITICAL FIX: Delay datasource initialization to prevent error #252
    // AG Grid can call getRows during its initial render cycle, causing conflicts
    // We use a ref that's set after grid is ready, not a computed, to have better control
    const delayedDatasource = ref(undefined);
    
    // Watch for grid ready to set the datasource after a delay
    watch(
      () => [gridReady.value, isInfiniteScrollEnabled.value, datasource.value],
      ([ready, infiniteEnabled, ds]) => {
        if (ready && infiniteEnabled && ds && !delayedDatasource.value) {
          // Delay setting the datasource to allow grid to finish initial render
          setTimeout(() => {
            delayedDatasource.value = ds;
          }, 100);
        } else if (!infiniteEnabled) {
          delayedDatasource.value = undefined;
        }
      },
      { immediate: true }
    );

    const rowData = computed(() => {
      // If using infinite scrolling, rowData should be undefined (grid uses datasource)
      if (isInfiniteScrollEnabled.value) {
        return undefined;
      }
      // If using Supabase with pagination, return Supabase data
      if (props.content?.dataSource === 'supabase') {
        return supabaseData.value;
      }

      // Otherwise, use local data (existing behavior)
      const data = wwLib.wwUtils.getDataFromCollection(props.content.rowData);
      return Array.isArray(data) ? data ?? [] : [];
    });

    // Track if we've ever rendered data (for initial load detection)
    const hasEverRendered = ref(false);

    // Watch for data changes to detect loading state and update records variable
    watch(() => rowData.value, (newData, oldData) => {
      // Skip processing if we're updating data locally (e.g., fake junction records)
      // This prevents triggering loading states or unnecessary updates during local modifications
      if (isUpdatingDataLocally.value) {
        return;
      }

      // For non-infinite scroll modes, update records from rowData
      // For infinite scroll, records will be updated via grid API watchers
      if (!isInfiniteScrollEnabled.value) {
        setRecords(Array.isArray(newData) ? [...newData] : []);
      } else {
        // For infinite scroll, update from grid API after a short delay to let grid update
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      }

      // If we've already rendered data once, don't show loading skeleton for updates
      // This prevents select cells from flickering when bound data is updated
      if (hasEverRendered.value) {
        // Data is being updated, not initially loaded - keep rendered state
        if (Array.isArray(newData) && newData.length > 0) {
          dataRendered.value = true;
        } else if (Array.isArray(newData) && newData.length === 0) {
          dataRendered.value = true;
        }
        // Force AG Grid's internal row store to pick up the new data.
        // refreshCells() alone is not enough because it re-renders from AG Grid's
        // internal store, which may still hold stale references if the row objects
        // were mutated in place rather than replaced.
        // Using applyTransaction({ update }) explicitly tells AG Grid which rows changed.
        nextTick(() => {
          setTimeout(() => {
            if (gridApi.value) {
              if (Array.isArray(newData) && newData.length > 0) {
                // Shallow-clone each row so AG Grid sees new object references
                const clonedRows = newData.map(row => ({ ...row }));
                gridApi.value.applyTransaction({ update: clonedRows });
              }
              gridApi.value.refreshCells({ force: true });
            }
          }, 0);
        });
        return;
      }

      // Initial load: show loading skeleton until rendered
      if (newData !== oldData && Array.isArray(newData) && newData.length > 0) {
        dataRendered.value = false;
        // Clear any existing timeout
        if (dataLoadingTimeout.value) {
          clearTimeout(dataLoadingTimeout.value);
        }
        // Wait for AG Grid to render, then mark as rendered
        nextTick(() => {
          if (gridApi.value) {
            // Use requestAnimationFrame to wait for render cycle
            requestAnimationFrame(() => {
              setTimeout(() => {
                dataRendered.value = true;
                hasEverRendered.value = true;
              }, 200); // Give time for all cells (especially select cells) to render
            });
          }
        });
      } else if (Array.isArray(newData) && newData.length === 0) {
        // Empty data means it's loaded (just empty)
        dataRendered.value = true;
        hasEverRendered.value = true;
      }
    }, { deep: true, immediate: true });

    // Detect loading state - show skeleton when grid is not ready or data is not yet rendered
    const isLoading = computed(() => {
      // Check if grid API is ready
      if (!gridReady.value) return true;
      
      // If using Supabase, check Supabase loading state
      if (props.content?.dataSource === 'supabase') {
        return supabaseLoading.value;
      }
      
      // Check if rowData source is undefined/null (not loaded yet)
      const rawData = props.content?.rowData;
      if (rawData === undefined || rawData === null) {
        return true;
      }
      
      // If we have data but it hasn't been rendered yet, show skeleton
      const data = rowData.value;
      if (Array.isArray(data) && data.length > 0 && !dataRendered.value) {
        return true;
      }
      
      return false;
    });

    // Watch loading state and update isFetching exposed variable
    watch(
      () => isLoading.value,
      (loading) => {
        setIsFetching(loading);
      },
      { immediate: true }
    );

    // Track the last serialized conditional row styles to detect actual changes
    const lastConditionalRowStylesJson = ref(null);
    
    // Watch for conditional row styles changes and redraw all rows to re-apply styles
    // Use JSON comparison to avoid unnecessary redraws from reference changes
    watch(
      () => props.content?.conditionalRowStyles,
      (newStyles) => {
        // Skip if no styles defined
        if (!newStyles || !Array.isArray(newStyles) || newStyles.length === 0) {
          if (lastConditionalRowStylesJson.value !== null) {
            lastConditionalRowStylesJson.value = null;
            // Styles were removed, redraw to clear any applied styles
            if (gridApi.value && gridReady.value && !isGridRendering.value) {
              setTimeout(() => {
                if (gridApi.value) {
                  gridApi.value.redrawRows();
                }
              }, 100);
            }
          }
          return;
        }
        
        // Serialize current styles to compare
        const currentJson = JSON.stringify(newStyles);
        
        // Only redraw if styles actually changed (not just reference change)
        if (currentJson !== lastConditionalRowStylesJson.value) {
          lastConditionalRowStylesJson.value = currentJson;
          
          // Debounce the redraw to avoid multiple rapid redraws
          if (gridApi.value && gridReady.value && !isGridRendering.value) {
            setTimeout(() => {
              if (gridApi.value) {
                gridApi.value.redrawRows();
              }
            }, 100);
          }
        }
      },
      { deep: true }
    );

    // Track the last applied focused row ID to avoid duplicate applications
    const lastAppliedFocusedRowId = ref(null);

    // Helper to find a row node by its ID (using idFormula matching)
    const findRowNodeById = (rowId) => {
      if (!gridApi.value || rowId === null || rowId === undefined || rowId === '') return null;
      const rowIdStr = String(rowId);
      
      // Try direct lookup first (fastest path)
      let rowNode = gridApi.value.getRowNode(rowIdStr);
      if (rowNode) return rowNode;
      
      // Search through all rows by matching the ID formula
      gridApi.value.forEachNode((node) => {
        if (!rowNode && node.data) {
          let baseId = resolveMappingFormula(props.content.idFormula, node.data);
          if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
            baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
          }
          const baseIdStr = baseId != null ? String(baseId) : '';
          if (baseIdStr === rowIdStr ||
              (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
              (node.id && String(node.id) === rowIdStr)) {
            rowNode = node;
          }
        }
      });
      return rowNode;
    };

    // Watch for focusedRowId changes and apply focus to the specified row
    // This provides a declarative way to keep a row in focus (persists across data changes)
    // PERFORMANCE: Only redraws the old and new focused rows, not the entire grid
    watch(
      () => props.content?.focusedRowId,
      async (newRowId, oldRowId) => {
        // Skip if grid is not ready or value hasn't changed
        if (!gridApi.value || !gridReady.value) return;
        
        // Normalize values for comparison (treat empty string as null)
        const normalizedNew = newRowId === '' ? null : newRowId;
        const normalizedOld = oldRowId === '' ? null : oldRowId;
        
        // Skip if the effective value hasn't changed
        if (normalizedNew === normalizedOld) return;
        
        // Update tracking variable
        lastAppliedFocusedRowId.value = normalizedNew;
        
        // Defer execution to avoid conflicts with grid rendering
        setTimeout(async () => {
          if (!gridApi.value || isGridRendering.value) return;
          
          // Collect only the affected row nodes (old focused + new focused)
          const rowNodesToRedraw = [];
          
          // Find the previously focused row node to remove its styling
          if (normalizedOld !== null && normalizedOld !== undefined) {
            const oldNode = findRowNodeById(normalizedOld);
            if (oldNode) rowNodesToRedraw.push(oldNode);
          }
          
          // Clear focus if new value is null/undefined/empty
          if (normalizedNew === null || normalizedNew === undefined) {
            // Clear any custom action focus class from all cells
            if (gridContainerRef.value) {
              const focusedCells = gridContainerRef.value.querySelectorAll('.ag-cell-action-focus');
              focusedCells.forEach(cell => cell.classList.remove('ag-cell-action-focus'));
            }
            gridApi.value.clearFocusedCell();
            // Only redraw the previously focused row to remove its styling
            if (rowNodesToRedraw.length > 0) {
              gridApi.value.redrawRows({ rowNodes: rowNodesToRedraw });
            }
            return;
          }
          
          // Find the newly focused row node to apply styling
          const newNode = findRowNodeById(normalizedNew);
          if (newNode && !rowNodesToRedraw.includes(newNode)) {
            rowNodesToRedraw.push(newNode);
          }
          
          // Only redraw the affected rows (old + new focused), not the entire grid
          if (rowNodesToRedraw.length > 0) {
            gridApi.value.redrawRows({ rowNodes: rowNodesToRedraw });
          }
        }, 100);
      },
      { immediate: false }
    );

    // Watch for dataSource changes and fetch initial data
    watch(
      () => props.content?.dataSource,
      (newSource, oldSource) => {
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        // Only fetch if source actually changed to supabase
        if (newSource === 'supabase' && newSource !== oldSource && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource
            // CRITICAL FIX: Preserve filters and sorts when switching to server-side mode
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            gridApi.value.setGridOption('datasource', datasource.value);
            nextTick(() => {
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          } else {
            // Reset last fetch params to allow new fetch
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      },
      { immediate: false }
    );

    // Watch for Supabase configuration changes
    watch(
      () => [props.content?.supabaseTable, props.content?.supabaseQuery],
      (newValues, oldValues) => {
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, refresh the datasource
            // CRITICAL FIX: Preserve filters and sorts when table/query changes
            // CRITICAL FIX: Wrap in setTimeout to prevent error #252
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            setTimeout(() => {
              if (!gridApi.value) return;
              gridApi.value.setGridOption('datasource', datasource.value);
              setTimeout(() => {
                if (!gridApi.value) return;
                if (currentFilters && Object.keys(currentFilters).length > 0) {
                  gridApi.value.setFilterModel(currentFilters);
                }
                if (currentSort && currentSort.length > 0) {
                  gridApi.value.applyColumnState({
                    state: currentSort,
                    defaultState: { sort: null },
                  });
                }
              }, 50);
            }, 0);
          } else {
            // Reset last fetch params to allow new fetch
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const filterModel = gridApi.value.getFilterModel();
            const state = gridApi.value.getState();
            const sortModel = state?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
          }
        }
      }
    );

    // Initial data fetch when grid is ready and using Supabase
    const initialFetchDone = ref(false);
    watch(
      () => [gridReady.value, props.content?.dataSource, props.content?.supabaseTable],
      ([ready, source, table], oldValues) => {
        // Handle undefined oldValues on first run
        if (oldValues) {
          const [oldReady, oldSource, oldTable] = oldValues;
          // Only fetch if values actually changed and we haven't done initial fetch yet
          if (ready === oldReady && source === oldSource && table === oldTable) {
            return;
          }
          
          // Reset initial fetch flag if dataSource changes away from supabase
          if (source !== 'supabase' && oldSource === 'supabase') {
            initialFetchDone.value = false;
          }
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        // Handle initial setup
        if (ready && source === 'supabase' && table && gridApi.value && !initialFetchDone.value) {
          initialFetchDone.value = true;
          
          if (isInfiniteScrollEnabled.value) {
            // For infinite scrolling, set the datasource
            // Note: rowModelType is set via computed property at grid initialization
            // and cannot be changed dynamically (AG Grid limitation)
            // CRITICAL FIX: Preserve filters and sorts when initializing infinite scroll
            // CRITICAL FIX: Wrap in setTimeout to prevent error #252
            const currentFilters = gridApi.value.getFilterModel();
            const currentSort = gridApi.value.getState()?.sort?.sortModel;
            
            setTimeout(() => {
              if (!gridApi.value) return;
              gridApi.value.setGridOption('datasource', datasource.value);
              
              // Restore filters and sorts after setting datasource
              setTimeout(() => {
                if (!gridApi.value) return;
                if (currentFilters && Object.keys(currentFilters).length > 0) {
                  gridApi.value.setFilterModel(currentFilters);
                }
                if (currentSort && currentSort.length > 0) {
                  gridApi.value.applyColumnState({
                    state: currentSort,
                    defaultState: { sort: null },
                  });
                }
              }, 50);
            }, 0);
          } else {
            // For pagination mode, fetch initial data
            lastFetchParams.value = null;
            const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
            const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            fetchSupabaseData(currentPage, pageSize, null, null, searchValue);
          }
        }
      },
      { immediate: true       }
    );

    // Watch for infinite scrolling configuration changes
    // Note: rowModelType and cacheBlockSize are initial properties and cannot be changed after grid init
    // Users must reload the page to switch between row model types
    watch(
      () => [props.content?.enableInfiniteScroll, props.content?.infiniteBlockSize],
      (newValues, oldValues) => {
        // Only update if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && props.content?.enableInfiniteScroll && gridApi.value) {
          // Refresh the datasource when infinite scrolling settings change
          // Note: cacheBlockSize is an initial property and cannot be changed dynamically
          // CRITICAL FIX: Preserve filters and sorts when refreshing infinite scroll
          // CRITICAL FIX: Wrap in setTimeout to prevent error #252
          const currentFilters = gridApi.value.getFilterModel();
          const currentSort = gridApi.value.getState()?.sort?.sortModel;
          
          setTimeout(() => {
            if (!gridApi.value) return;
            gridApi.value.setGridOption('datasource', datasource.value);
            
            setTimeout(() => {
              if (!gridApi.value) return;
              if (currentFilters && Object.keys(currentFilters).length > 0) {
                gridApi.value.setFilterModel(currentFilters);
              }
              if (currentSort && currentSort.length > 0) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            }, 50);
          }, 0);
        }
      }
    );

    // Watch for search value changes (with debounce for Supabase)
    watch(
      () => [props.content?.enableSearch, props.content?.searchValue, props.content?.searchableColumns],
      (newValues, oldValues) => {
        // Only fetch if values actually changed (skip if oldValues is undefined on first run)
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && props.content?.enableSearch && gridApi.value) {
          // Clear existing debounce timer
          if (searchDebounceTimer.value) {
            clearTimeout(searchDebounceTimer.value);
          }
          
          // Debounce search changes (300ms)
          searchDebounceTimer.value = setTimeout(() => {
            if (isInfiniteScrollEnabled.value) {
              // For infinite scrolling, refresh the datasource
              // CRITICAL FIX: Preserve filters and sorts when search changes
              // CRITICAL FIX: Wrap in setTimeout to prevent error #252
              if (gridApi.value) {
                const currentFilters = gridApi.value.getFilterModel();
                const currentSort = gridApi.value.getState()?.sort?.sortModel;
                setTimeout(() => {
                  if (!gridApi.value) return;
                  gridApi.value.setGridOption('datasource', datasource.value);
                  setTimeout(() => {
                    if (!gridApi.value) return;
                    if (currentFilters && Object.keys(currentFilters).length > 0) {
                      gridApi.value.setFilterModel(currentFilters);
                    }
                    if (currentSort && currentSort.length > 0) {
                      gridApi.value.applyColumnState({
                        state: currentSort,
                        defaultState: { sort: null },
                      });
                    }
                  }, 50);
                }, 0);
              }
            } else {
              // For pagination mode, fetch data
              lastFetchParams.value = null;
              const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
              const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
              const filterModel = gridApi.value.getFilterModel();
              const state = gridApi.value.getState();
              const sortModel = state?.sort?.sortModel || [];
              const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
              fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
            }
          }, 300);
        }
      }
    );

    // When select/user column options arrive from API after the grid has rendered,
    // AG Grid does NOT call refresh() on existing cell renderers — it only updates
    // its internal column definitions. We watch for option changes and force a
    // refreshCells() so that cell renderers receive the new params with options.
    // flush:'post' ensures the component has re-rendered (columnDefs recomputed)
    // before we act; setTimeout ensures ag-grid-vue3 has forwarded the new
    // columnDefs to the grid API.
    watch(
      () => props.content?.columns?.map(col => col?.options || col?.users),
      (newVal, oldVal) => {
        if (!oldVal || !gridApi.value || !gridReady.value) return;
        setTimeout(() => {
          if (gridApi.value) {
            gridApi.value.refreshCells({ force: true });
          }
        }, 100);
      },
      { deep: true, flush: 'post' }
    );

    function refreshData() {
      // Wait for grid to be ready and not rendering before refreshing cells
      // Use setTimeout to avoid error #252
      nextTick(() => {
        setTimeout(() => {
          if (gridApi.value && !isGridRendering.value) {
            gridApi.value.refreshCells();
          } else if (gridApi.value && isGridRendering.value) {
            // Retry after rendering completes
            setTimeout(() => {
              if (gridApi.value) gridApi.value.refreshCells();
            }, 100);
          }
        }, 0);
      });
    }

    const gridComponents = {
      ActionCellRenderer,
      ImageCellRenderer,
      WewebCellRenderer,
      SelectCellRenderer,
      SelectFilterComponent,
      DateCellEditor,
      UserCellRenderer,
      UserFilterComponent,
    };

    return {
      resolveMappingFormula,
      debugLog,
      onGridReady,
      onFirstDataRendered,
      onModelUpdated,
      onRowSelected,
      onSelectionChanged,
      gridApi,
      onFilterChanged,
      onSortChanged,
      setUpdatingDataLocally, // Expose setter so methods can update the flag
      getUpdatingDataLocally, // Expose getter so methods can check the flag
      removedRowIds, // Expose removedRowIds so methods and datasource can access it
      localeText: computed(() => {
        switch (props.content.lang) {
          case "fr":
            return AG_GRID_LOCALE_FR;
          case "de":
            return AG_GRID_LOCALE_DE;
          case "es":
            return AG_GRID_LOCALE_ES;
          case "pt":
            return AG_GRID_LOCALE_PT;
          case "custom":
            return {
              ...AG_GRID_LOCALE_EN,
              ...(props.content.localeText || {}),
            };
          default:
            return AG_GRID_LOCALE_EN;
        }
      }),
      forcedPaginationPageSize,
      onRowDragged,
      onRowDragEnter,
      onColumnMoved,
      onColumnResized,
      onPaginationChanged,
      onBodyScroll,
      gridContainerRef,
      initialState,
      refreshData,
      rowData,
      rowModelType,
      rowDragManaged,
      datasource,
      delayedDatasource,
      cacheBlockSize,
      paginationEnabled,
      isLoading,
      isInfiniteScrollEnabled,
      gridComponents,
      // Expose supabaseData and supabaseTotalCount for methods to access
      supabaseDataRef: supabaseData,
      supabaseTotalCountRef: supabaseTotalCount,
      // Expose grid ready state and helpers for component actions
      gridReady,
      isGridRendering,
      waitForGridReady,
      waitForRowInGrid,
      // Expose waitForSupabaseInstance for methods to use
      waitForSupabaseInstance,
      safeGridApiCall,
      hiddenColumns,
      setHiddenColumns,
      showColumnChooser,
      columnChooserRef,
      columnChooserSearch,
      chooserColumnOrder,
      chooserHiddenState,
      chooserDragColId,
      chooserDragOverColId,
      updateCurrentConfig,
      columnDefsVar,
      /* wwEditor:start */
      createElement,
      rawContent: inject("componentRawContent", {}),
      /* wwEditor:end */
    };
  },
  computed: {
    defaultColDef() {
      return {
        editable: false,
        resizable: this.content.resizableColumns,
        autoHeaderHeight: this.content.headerHeightMode === "auto",
        wrapHeaderText: this.content.headerHeightMode === "auto",
        singleClickEdit: this.content.cellEditMode !== "doubleClick",
        cellClass:
          this.content.cellAlignmentMode === "custom"
            ? `-${this.content.cellAlignment || "left"} ||`
            : null,
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
        },
        // Note: cellEditorParams with getValidationErrors is added per-column,
        // not in defaultColDef, to allow column-specific validation rules
      };
    },
    dataTypeDefinitions() {
      // Return undefined to use AG Grid's default data type handling
      // Custom formatting is handled via valueFormatter/valueParser on individual columns
      // This avoids "data type definition undefined does not exist" errors
      return undefined;
    },
    allColumnsList() {
      // Build a map of colId → column meta from content.columns (exclude design-time hidden)
      const colMap = new Map();
      for (const col of (this.content.columns || [])) {
        if (!col || (!col.field && !col.actionName) || col.hide) continue;
        const colId = col.actionName || col.field;
        colMap.set(colId, {
          colId,
          headerName: col.headerName || colId,
          isHidden: (this.chooserHiddenState || []).includes(colId),
          isLocked: !!col.lockedInChooser,
        });
      }

      // Sort by chooserColumnOrder (reflects live grid order), append any extras
      const ordered = [];
      const seen = new Set();
      for (const colId of (this.chooserColumnOrder || [])) {
        if (colMap.has(colId)) {
          ordered.push(colMap.get(colId));
          seen.add(colId);
        }
      }
      // Append columns not yet in the ordered list
      for (const [colId, meta] of colMap) {
        if (!seen.has(colId)) ordered.push(meta);
      }
      return ordered;
    },
    filteredColumnsList() {
      const q = (this.columnChooserSearch || '').toLowerCase().trim();
      if (!q) return this.allColumnsList;
      return this.allColumnsList.filter(c => c.headerName.toLowerCase().includes(q));
    },
    allColumnsVisible() {
      return !this.chooserHiddenState || this.chooserHiddenState.length === 0;
    },
    // Cheap count of runtime-toggleable columns (design-time hidden are excluded).
    // Used by someColumnsHidden to avoid pulling in the heavier allColumnsList computation.
    visibleColumnCount() {
      return (this.content.columns || []).filter(
        col => col && (col.field || col.actionName) && !col.hide
      ).length;
    },
    someColumnsHidden() {
      return !!(
        this.chooserHiddenState &&
        this.chooserHiddenState.length > 0 &&
        this.chooserHiddenState.length < this.visibleColumnCount
      );
    },
    columnDefs() {
      // First, map all columns to their definitions
      const columnsMap = new Map();

      // Helper to get validation errors for a value
      const getValidationErrors = (col, newValue, rowData) => {
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

            case 'custom':
              if (rule.custom) {
                // Create context with new value for the field
                const validationContext = { ...rowData, ...(col?.field ? { [col.field]: newValue } : {}) };
                const result = this.resolveMappingFormula(rule.custom, validationContext);
                // Formula should return true for valid, false for invalid
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

      // Helper to create value setter (validation is handled separately via getValidationErrors)
      const getValueSetter = (col, customSetter) => {
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
      };
      // Get column widths from viewConfiguration (for restoring user-resized widths)
      // Note: When sizes key is present but empty ({}), default column widths from column config will be used
      // When sizes key is absent (undefined), the current user-resized widths are preserved
      const viewConfig = this.content.viewConfiguration;
      const hasSizesKey = viewConfig && typeof viewConfig === 'object' && 'sizes' in viewConfig;
      const viewColumnSizes = hasSizesKey ? viewConfig.sizes : null;
      
      const allColumnDefs = this.content.columns
        .filter((col) => col != null && (col.field || col.actionName)) // Filter out null/undefined columns and columns without field/actionName
        .map((col, index) => {

        const minWidth =
          !col?.minWidth || col?.minWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.minWidth)?.[0];
        const maxWidth =
          !col?.maxWidth || col?.maxWidth === "auto"
            ? null
            : wwLib.wwUtils.getLengthUnit(col?.maxWidth)?.[0];
        
        // Get column identifier (actionName for action columns, field for others)
        const colId = col?.actionName || col?.field;
        
        // Check if view width is provided for this column (overrides column config width)
        const viewWidth = viewColumnSizes && colId && typeof viewColumnSizes[colId] === 'number'
          ? viewColumnSizes[colId]
          : null;
        
        // Use viewConfiguration.sizes if provided, otherwise use column config width
        // Note: When viewConfiguration.sizes is provided for a column, it overrides flex as well
        const width = viewWidth !== null
          ? viewWidth
          : (!col?.width || col?.width === "auto" || col?.widthAlgo === "flex"
              ? null
              : wwLib.wwUtils.getLengthUnit(col?.width)?.[0]);
        
        // Only use flex if no viewWidth is provided for this column
        const flex = viewWidth !== null
          ? null
          : (col?.widthAlgo === "flex" ? col?.flex ?? 1 : null);

        // Build cellClass array for column-specific styling
        const cellClasses = [];
        if (this.content.cellAlignmentMode !== "custom" && col?.cellAlignment) {
          cellClasses.push(`-${col?.cellAlignment}`);
        }
        if (col?.suppressRowInteraction) {
          cellClasses.push("-suppress-row-interaction");
        }

        const commonProperties = {
          minWidth,
          maxWidth,
          pinned: col?.pinned === "none" ? false : col?.pinned,
          width,
          flex,
          hide: !!col?.hide,
          headerClass: col?.headerAlignment ? `-${col?.headerAlignment}` : null,
          ...(cellClasses.length > 0 ? { cellClass: cellClasses } : {}),
          valueSetter: getValueSetter(col),
        };

        const cellDataType = col?.cellDataType;

        switch (cellDataType) {
          case "action": {
            return {
              ...commonProperties,
              headerName: col?.headerName,
              cellRenderer: "ActionCellRenderer",
              cellRendererParams: {
                name: col?.actionName,
                label: col?.actionLabel,
                trigger: this.onActionTrigger,
                withFont: !!this.content.actionFont,
              },
              sortable: false,
              filter: false,
              colId: col?.actionName,
            };
          }
          case "custom": {
            const customColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "WewebCellRenderer",
              cellRendererParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
                suppressRowInteraction: col?.suppressRowInteraction,
              },
              cellEditor: "WewebCellRenderer",
              cellEditorParams: {
                containerId: col?.containerId,
                trigger: this.onCustomCellEdit,
                suppressRowInteraction: col?.suppressRowInteraction,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? col?.customFilterType || "agTextColumnFilter" : false,
            };
            
            // Use display value for filtering and sorting if enabled
            if (col?.useDisplayValueForFilterSort && col?.displayLabelFormula) {
              // Helper function to get display value from raw value
              const getDisplayValue = (rawValue) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  rawValue
                );
              };
              
              // Use display value for filtering
              customColumn.filterValueGetter = (params) => {
                const rawValue = params.data?.[col?.field];
                return getDisplayValue(rawValue);
              };
              
              // Use display value for sorting with custom comparator
              if (col?.sortable) {
                customColumn.comparator = (valueA, valueB, nodeA, nodeB) => {
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
              }
            } else {
              // Add custom comparator based on filter type for proper sorting (when not using display value)
              if (col?.sortable && col?.customFilterType) {
                if (col.customFilterType === "agDateColumnFilter") {
                  customColumn.comparator = (valueA, valueB) => {
                    const dateA = valueA ? new Date(valueA).getTime() : 0;
                    const dateB = valueB ? new Date(valueB).getTime() : 0;
                    return dateA - dateB;
                  };
                } else if (col.customFilterType === "agNumberColumnFilter") {
                  customColumn.comparator = (valueA, valueB) => {
                    const numA = valueA != null ? parseFloat(valueA) : 0;
                    const numB = valueB != null ? parseFloat(valueB) : 0;
                    if (isNaN(numA) && isNaN(numB)) return 0;
                    if (isNaN(numA)) return 1;
                    if (isNaN(numB)) return -1;
                    return numA - numB;
                  };
                }
              }
            }
            
            return customColumn;
          }
          case "dateString":
          case "dateTime": {
            // Helper function to format date based on configuration
            const formatDateValue = (value) => {
              if (!value) return '';
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
            };

            const dateColumn = {
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
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              valueFormatter: (params) => formatDateValue(params.value),
              // Date comparator for proper sorting
              comparator: (valueA, valueB) => {
                const dateA = valueA ? new Date(valueA).getTime() : 0;
                const dateB = valueB ? new Date(valueB).getTime() : 0;
                return dateA - dateB;
              },
            };

            return dateColumn;
          }
          case "currency": {
            // Helper function to get currency code from row data or column config
            const getCurrencyCode = (rowData, col) => {
              if (col?.currencyMode === 'perRow' && col?.currencyCodeField) {
                return this.resolveMappingFormula(col.currencyCodeField, rowData) || 'EUR';
              }
              return col?.currencyCode || 'EUR';
            };

            // Helper function to get locale for currency formatting
            const getLocale = (col) => {
              const locale = col?.currencyLocale;
              if (!locale || locale === 'auto') return navigator.language || 'en-US';
              return locale;
            };

            // Helper function to format currency value (cents to formatted string)
            const formatCurrency = (value, currencyCode, locale) => {
              if (value == null || value === '') return '';

              // Convert cents to currency units
              const currencyValue = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
              if (isNaN(currencyValue)) return '';

              // Use Intl.NumberFormat for proper currency formatting
              try {
                return new Intl.NumberFormat(locale || navigator.language || 'en-US', {
                  style: 'currency',
                  currency: currencyCode || 'EUR',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(currencyValue);
              } catch (e) {
                // Fallback formatting if currency code is invalid
                return `${currencyValue.toFixed(2)} ${currencyCode || 'EUR'}`;
              }
            };

            // Helper function to parse user input to cents
            const parseCurrencyInput = (input) => {
              if (input == null || input === '') return null;
              
              // Remove currency symbols and whitespace
              const cleaned = String(input).replace(/[€$£¥,\s]/g, '');
              const parsed = parseFloat(cleaned);
              
              if (isNaN(parsed)) return null;
              
              // Convert to cents (multiply by 100)
              return Math.round(parsed * 100);
            };

            // Helper function to get display value (cents / 100) for filtering and sorting
            const getDisplayValue = (value) => {
              if (value == null || value === '') return null;
              const currencyValue = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
              return isNaN(currencyValue) ? null : currencyValue;
            };

            const currencyColumn = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: col?.filter ? 'agNumberColumnFilter' : false,
              editable: col?.editable,
              cellEditorParams: {
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              // Format display: convert cents to formatted currency
              // Use raw field value from params.data, not params.value (which comes from valueGetter)
              valueFormatter: (params) => {
                const rawValue = params.data?.[col?.field];
                const currencyCode = getCurrencyCode(params.data, col);
                const locale = getLocale(col);
                return formatCurrency(rawValue, currencyCode, locale);
              },
              // Get display value for sorting (cents / 100)
              valueGetter: (params) => {
                return getDisplayValue(params.data?.[col?.field]);
              },
              // Get display value for filtering (user types 12, not 1200)
              filterValueGetter: (params) => {
                return getDisplayValue(params.data?.[col?.field]);
              },
              // Parse user input: convert display value (e.g., "12") back to cents (1200)
              valueParser: (params) => {
                return parseCurrencyInput(params.newValue);
              },
              // Custom comparator for proper numeric sorting using display values
              comparator: (valueA, valueB, nodeA, nodeB) => {
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
              },
            };

            return currencyColumn;
          }
          case "image": {
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
          case "select": {
            const rawOptions = col?.options;
            const selectParams = {
              options: Array.isArray(rawOptions) ? rawOptions : [],
              optionsValueFormula: col?.optionsValueFormula,
              optionsLabelFormula: col?.optionsLabelFormula,
              optionsColorFormula: col?.optionsColorFormula,
              resolveMappingFormula: this.resolveMappingFormula,
              // Use a getter to avoid isLoading being a reactive dependency of columnDefs.
              // This prevents columnDefs from recomputing when loading state changes,
              // which would cause AG Grid to recreate all cell renderers (flickering).
              get isLoading() { return false; },
            };
            
            // Helper function to get label from value
            const getLabelFromValue = (value) => {
              const rawOptions = col?.options;
              const options = Array.isArray(rawOptions) ? rawOptions : [];
              
              // Process options with formula mapping if needed
              const processedOptions = options.map(option => {
                const optionValue = this.resolveMappingFormula(col?.optionsValueFormula, option) ?? option.value;
                const optionLabel = this.resolveMappingFormula(col?.optionsLabelFormula, option) ?? option.label;
                return {
                  value: optionValue || '',
                  label: optionLabel || optionValue || '',
                };
              });
              
              const foundOption = processedOptions.find(opt => opt.value === value);
              return foundOption?.label || value || '';
            };
            
            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "SelectCellRenderer",
              cellRendererParams: selectParams,
              cellEditor: "SelectCellRenderer",
              cellEditorParams: {
                ...selectParams,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? SelectFilterWrapper : false,
              ...(col?.filter
                ? {
                    filterParams: {
                      selectOptions: selectParams,
                      closeOnApply: true,
                      translations: (() => {
                        const lang = this.content?.lang || 'en';
                        const translations = {
                          en: { reset: 'Reset', apply: 'Apply' },
                          fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                          es: { reset: 'Restablecer', apply: 'Aplicar' },
                          de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                          pt: { reset: 'Redefinir', apply: 'Aplicar' },
                        };
                        return translations[lang] || translations.en;
                      })(),
                    },
                  }
                : {}),
              // Use label for filtering and sorting instead of value
              valueGetter: (params) => {
                return getLabelFromValue(params.data?.[col?.field]);
              },
              // Ensure the raw value (ID) is stored, not the label
              valueSetter: getValueSetter(col, (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              }),
              // Return raw value (ID) for filtering - filter model stores IDs
              filterValueGetter: (params) => {
                return params.data?.[col?.field];
              },
            };
          }
          case "user": {
            const rawUsers = col?.users;
            const userIdFormula = col?.userIdFormula || { type: 'f', code: 'context.mapping' };
            const userParams = {
              users: Array.isArray(rawUsers) ? rawUsers : [],
              maxNumberOfUsers: col?.maxNumberOfUsers ?? 4,
              userFocusColor: this.content.userFocusColor,
              cellFontFamily: this.content.cellFontFamily,
              resolveMappingFormula: this.resolveMappingFormula,
              userIdFormula: userIdFormula,
              // Use a getter to avoid isLoading being a reactive dependency of columnDefs.
              // This prevents columnDefs from recomputing when loading state changes,
              // which would cause AG Grid to recreate all cell renderers (flickering).
              get isLoading() { return false; },
            };
            
            // Helper function to extract user ID(s) from raw cell value using userIdFormula
            const extractUserIds = (rawValue, rowData) => {
              if (!rawValue) return null;
              
              // Apply userIdFormula to extract user ID(s) from potentially nested structures
              const extractedValue = this.resolveMappingFormula(userIdFormula, rawValue);
              
              // Return the extracted value, or fallback to raw value if formula returns null/undefined
              return extractedValue ?? rawValue;
            };
            
            // Helper function to get user name from ID
            const getUserNameFromId = (userId) => {
              if (!userId) return '';
              const rawUsers = col?.users;
              const users = Array.isArray(rawUsers) ? rawUsers : [];
              const user = users.find(u => u.id === userId);
              if (user) {
                if (user.name) return user.name;
                if (user.firstname || user.lastname) {
                  return [user.firstname, user.lastname].filter(Boolean).join(' ');
                }
                return user.email || userId;
              }
              return userId;
            };
            
            const isMultiple = (col?.maxNumberOfUsers ?? 4) > 1;
            
            return {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              cellRenderer: "UserCellRenderer",
              cellRendererParams: userParams,
              cellEditor: "UserCellRenderer",
              cellEditorParams: {
                ...userParams,
                getValidationErrors: (params) => {
                  return getValidationErrors(col, params.value, params.data);
                },
              },
              editable: col?.editable !== false,
              sortable: col?.sortable,
              filter: col?.filter ? UserFilterWrapper : false,
              ...(col?.filter
                ? {
                    filterParams: {
                      users: userParams.users,
                      maxNumberOfUsers: userParams.maxNumberOfUsers,
                      userFocusColor: userParams.userFocusColor,
                      cellFontFamily: userParams.cellFontFamily,
                      resolveMappingFormula: userParams.resolveMappingFormula,
                      userIdFormula: userParams.userIdFormula,
                      isLoading: userParams.isLoading,
                      closeOnApply: true,
                      translations: (() => {
                        const lang = this.content?.lang || 'en';
                        const translations = {
                          en: { reset: 'Reset', apply: 'Apply' },
                          fr: { reset: 'Réinitialiser', apply: 'Appliquer' },
                          es: { reset: 'Restablecer', apply: 'Aplicar' },
                          de: { reset: 'Zurücksetzen', apply: 'Anwenden' },
                          pt: { reset: 'Redefinir', apply: 'Aplicar' },
                        };
                        return translations[lang] || translations.en;
                      })(),
                    },
                  }
                : {}),
              // Use user name for filtering and sorting instead of ID
              // Apply userIdFormula first to extract user IDs from the raw cell value
              valueGetter: (params) => {
                const rawValue = params.data?.[col?.field];
                const extractedValue = extractUserIds(rawValue, params.data);
                if (!extractedValue) return '';
                
                if (isMultiple) {
                  // Multiple users: return comma-separated names
                  const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
                  return userIds.map(id => getUserNameFromId(id)).filter(Boolean).join(', ');
                } else {
                  // Single user: return name
                  return getUserNameFromId(extractedValue);
                }
              },
              // Ensure the raw value (ID or array of IDs) is stored
              valueSetter: getValueSetter(col, (params) => {
                if (params.newValue !== params.oldValue) {
                  params.data[col?.field] = params.newValue;
                  return true;
                }
                return false;
              }),
              // Return user ID(s) for filtering - filter model stores IDs
              filterValueGetter: (params) => {
                const rawValue = params.data?.[col?.field];
                const extractedValue = extractUserIds(rawValue, params.data);
                if (!extractedValue) return null;
                
                // Return the extracted user ID(s) directly
                return extractedValue;
              },
            };
          }
          default: {
            // Determine the correct filter type based on cellDataType
            let filterType = false;
            if (col?.filter) {
              if (col?.cellDataType === 'number') {
                filterType = 'agNumberColumnFilter';
              } else if (col?.cellDataType === 'boolean') {
                // Use Set Filter for boolean columns to show True/False options
                filterType = 'agSetColumnFilter';
              } else {
                // Default to text filter for text, undefined, or other types
                filterType = 'agTextColumnFilter';
              }
            }

            const result = {
              ...commonProperties,
              headerName: col?.headerName,
              field: col?.field,
              sortable: col?.sortable,
              filter: filterType,
              editable: col?.editable,
            };

            // Add boolean-specific handling
            if (col?.cellDataType === 'boolean') {
              // Set cellDataType so AG Grid can automatically configure other features
              // Note: We explicitly set filter type above to ensure Set Filter is used
              result.cellDataType = 'boolean';
              
              // Explicitly ensure Set Filter is used (override AG Grid's default Text Filter for boolean)
              if (col?.filter) {
                result.filter = 'agSetColumnFilter';
              }
              
              // Use checkbox cell renderer for boolean display
              result.cellRenderer = 'agCheckboxCellRenderer';
              
              // Normalize boolean values for the checkbox renderer
              result.valueGetter = (params) => {
                const value = params.data?.[col?.field];
                // Handle various boolean representations and convert to actual boolean
                if (value === true || value === 'true' || value === 1 || value === '1') {
                  return true;
                } else if (value === false || value === 'false' || value === 0 || value === '0') {
                  return false;
                }
                return value;
              };
              
              // Ensure the checkbox updates the data correctly
              result.valueSetter = (params) => {
                const newValue = params.newValue === true || params.newValue === 'true' || params.newValue === 1 || params.newValue === '1';
                params.data[col?.field] = newValue;
                return true;
              };
              
              // For editable boolean columns, use checkbox as both renderer and editor
              if (col?.editable) {
                result.cellEditor = 'agCheckboxCellEditor';
                // Create the validation function
                const validationFn = (params) => {
                  return getValidationErrors(col, params?.value, params?.data);
                };
                result.cellEditorParams = {
                  getValidationErrors: validationFn,
                };
              }
              
              // Configure filter params for boolean set filter
              // Explicitly configure to ensure Set Filter shows True/False options
              if (col?.filter && filterType === 'agSetColumnFilter') {
                // Merge with default filter params (buttons, closeOnApply, etc.)
                result.filterParams = {
                  ...(result.filterParams || {}),
                  values: (params) => {
                    // Return boolean values for the set filter
                    return [true, false];
                  },
                  valueFormatter: (params) => {
                    // Format boolean values as True/False (AG Grid will handle localization)
                    if (params.value === true || params.value === 'true' || params.value === 1 || params.value === '1') {
                      return 'True';
                    } else if (params.value === false || params.value === 'false' || params.value === 0 || params.value === '0') {
                      return 'False';
                    }
                    return String(params.value);
                  },
                  // Ensure filter uses actual boolean values, not strings
                  filterValueGetter: (params) => {
                    const value = params.data?.[col?.field];
                    // Convert to actual boolean for filtering
                    if (value === true || value === 'true' || value === 1 || value === '1') {
                      return true;
                    } else if (value === false || value === 'false' || value === 0 || value === '0') {
                      return false;
                    }
                    return value;
                  }
                };
              }
            } else if (col?.editable) {
              // Add cellEditor and cellEditorParams for editable non-boolean columns to ensure validation works
              // Create the validation function
              const validationFn = (params) => {
                return getValidationErrors(col, params?.value, params?.data);
              };

              // Explicitly set cellEditor to ensure validation is triggered
              // AG Grid's default editor might not call getValidationErrors consistently
              result.cellEditor = 'agTextCellEditor';
              
              result.cellEditorParams = {
                getValidationErrors: validationFn,
              };
            }

            if (col?.useCustomLabel) {
              result.valueFormatter = (params) => {
                return this.resolveMappingFormula(
                  col?.displayLabelFormula,
                  params.value
                );
              };
              
              // Use display value for filtering and sorting if enabled
              if (col?.useDisplayValueForFilterSort) {
                // Helper function to get display value from raw value
                const getDisplayValue = (rawValue) => {
                  return this.resolveMappingFormula(
                    col?.displayLabelFormula,
                    rawValue
                  );
                };
                
                // Use display value for filtering
                result.filterValueGetter = (params) => {
                  const rawValue = params.data?.[col?.field];
                  return getDisplayValue(rawValue);
                };
                
                // Use display value for sorting with custom comparator
                if (col?.sortable) {
                  result.comparator = (valueA, valueB, nodeA, nodeB) => {
                    const rawValueA = nodeA?.data?.[col?.field];
                    const rawValueB = nodeB?.data?.[col?.field];
                    const displayValueA = getDisplayValue(rawValueA);
                    const displayValueB = getDisplayValue(rawValueB);
                    
                    // Handle null/undefined values
                    if (displayValueA == null && displayValueB == null) return 0;
                    if (displayValueA == null) return 1;
                    if (displayValueB == null) return -1;
                    
                    // Compare as numbers if both are numbers, otherwise as strings
                    const numA = Number(displayValueA);
                    const numB = Number(displayValueB);
                    if (!isNaN(numA) && !isNaN(numB)) {
                      return numA - numB;
                    }
                    
                    // String comparison
                    return String(displayValueA).localeCompare(String(displayValueB));
                  };
                }
              }
            }
            return result;
          }
        }

        return result;
      });

      // Build a map of column definitions by their colId/field for reordering
      allColumnDefs.forEach((colDef) => {
        const colId = colDef.colId || colDef.field;
        if (colId) {
          columnsMap.set(colId, colDef);
        }
      });

      // Reorder columns based on viewConfiguration.columnsOrder if provided with values
      // Empty array [] or absent key means use default column order from definitions
      // The distinction between "key absent" vs "key present but empty" is handled
      // by applyViewConfiguration at runtime for resetting column order
      let columns;
      const viewColumnsOrder = this.content.viewConfiguration?.columnsOrder;
      const hasValidColumnsOrder = viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0;
      if (hasValidColumnsOrder) {
        const orderedColumns = [];
        const usedColIds = new Set();

        // First, add columns in the order specified by viewConfiguration.columnsOrder
        for (const colId of viewColumnsOrder) {
          if (columnsMap.has(colId)) {
            orderedColumns.push(columnsMap.get(colId));
            usedColIds.add(colId);
          }
        }

        // Then, add any remaining columns that weren't in viewConfiguration.columnsOrder
        // (to handle cases where new columns were added to config but not to viewConfiguration.columnsOrder)
        for (const colDef of allColumnDefs) {
          const colId = colDef.colId || colDef.field;
          if (colId && !usedColIds.has(colId)) {
            orderedColumns.push(colDef);
          }
        }

        columns = orderedColumns;
      } else {
        columns = allColumnDefs;
      }

      // Enable row drag only if rowReorder is enabled AND infinite scroll is NOT enabled
      // (row dragging is not supported with infinite row model)
      if (this.content.rowReorder && columns[0] && !this.isInfiniteScrollEnabled) {
        columns[0].rowDrag = true;
      }

      return columns;
    },
    rowSelection() {
      if (this.content.rowSelection === "multiple") {
        return {
          mode: "multiRow",
          checkboxes: !this.content.disableCheckboxes,
          headerCheckbox: !this.content.disableCheckboxes,
          selectAll: this.content.selectAll || "all",
          enableClickSelection: this.content.enableClickSelection,
        };
      } else if (this.content.rowSelection === "single") {
        return {
          mode: "singleRow",
          checkboxes: !this.content.disableCheckboxes,
          enableClickSelection: this.content.enableClickSelection,
        };
      } else {
        return {
          mode: "singleRow",
          checkboxes: false,
          isRowSelectable: () => false,
          enableClickSelection: this.content.enableClickSelection,
        };
      }
    },
    style() {
      if (this.content.layout === "auto") return {};
      return {
        height: this.content.height || "400px",
      };
    },
    cssVars() {
      return {
        "--ww-data-grid_cc-background": this.content.columnChooserBackground,
        "--ww-data-grid_cc-border-color": this.content.columnChooserBorderColor,
        "--ww-data-grid_cc-border-radius": this.content.columnChooserBorderRadius,
        "--ww-data-grid_cc-text-color": this.content.columnChooserTextColor,
        "--ww-data-grid_cc-accent-color": this.content.columnChooserAccentColor,
        "--ww-data-grid_cc-width": this.content.columnChooserWidth,
        "--ww-data-grid_action-backgroundColor":
          this.content.actionBackgroundColor,
        "--ww-data-grid_action-color": this.content.actionColor,
        "--ww-data-grid_action-padding": this.content.actionPadding,
        "--ww-data-grid_action-border": this.content.actionBorder,
        "--ww-data-grid_action-borderRadius": this.content.actionBorderRadius,
        ...(this.content.actionFont
          ? { "--ww-data-grid_action-font": this.content.actionFont }
          : {
              "--ww-data-grid_action-fontSize": this.content.actionFontSize,
              "--ww-data-grid_action-fontFamily": this.content.actionFontFamily,
              "--ww-data-grid_action-fontWeight": this.content.actionFontWeight,
              "--ww-data-grid_action-fontStyle": this.content.actionFontStyle,
              "--ww-data-grid_action-lineHeight": this.content.actionLineHeight,
            }),
      };
    },
    theme() {
      return themeQuartz.withParams({
        headerBackgroundColor: this.content.headerBackgroundColor,
        headerTextColor: this.content.headerTextColor,
        headerFontSize: this.content.headerFontSize,
        headerFontFamily: this.content.headerFontFamily,
        headerFontWeight: this.content.headerFontWeight,
        headerHeight:
          this.content.headerHeightMode !== "auto"
            ? this.content.headerHeight
            : undefined,
        borderColor: this.content.borderColor,
        cellTextColor: this.content.cellColor,
        cellFontFamily: this.content.cellFontFamily,
        dataFontSize: this.content.cellFontSize,
        oddRowBackgroundColor: this.content.rowAlternateColor,
        backgroundColor: this.content.rowBackgroundColor,
        rowHoverColor: this.content.rowHoverColor,
        selectedRowBackgroundColor: this.content.selectedRowBackgroundColor,
        rowVerticalPaddingScale: this.content.rowVerticalPaddingScale || 1,
        menuBackgroundColor: this.content.menuBackgroundColor,
        menuTextColor: this.content.menuTextColor,
        columnHoverColor: this.content.columnHoverColor,
        foregroundColor: this.content.textColor,
        checkboxCheckedBackgroundColor: this.content.selectionCheckboxColor,
        rangeSelectionBorderColor: this.content.cellSelectionBorderColor,
        checkboxUncheckedBorderColor: this.content.checkboxUncheckedBorderColor,
        focusShadow: this.content.focusShadow?.length
          ? this.content.focusShadow
          : undefined,
        wrapperBorderRadius: this.content.wrapperBorderRadius,
      });
    },
    rowStyle() {
      // Return a function that AG Grid will call for each row
      // This function evaluates conditional styling rules and focused row styling
      // IMPORTANT: Focused row styling is applied LAST to override conditional styles
      //
      // PERFORMANCE: We only use conditionalRowStyles as a reactive dependency here.
      // focusedRowId is read at call time (inside the returned function) so that
      // changing the focused row does NOT cause this computed to re-evaluate and
      // return a new function reference — which would force AG Grid to re-render
      // all rows. Instead, the focusedRowId watcher handles targeted redraws of
      // only the affected rows.
      const conditionalRowStyles = this.content?.conditionalRowStyles;
      
      const hasConditionalStyles = conditionalRowStyles && Array.isArray(conditionalRowStyles) && conditionalRowStyles.length > 0;
      
      // We always return a function now (instead of null) so that the function
      // reference stays stable. Returning null vs function on focusedRowId toggle
      // would also cause AG Grid to detect a prop change.
      // Keep a reference to 'this' for use inside the closure
      const self = this;
      
      // Return a stable function that reads focusedRowId at call time
      return (params) => {
        // params.data contains the row data
        const rowData = params.data;
        
        // If no row data, return null
        if (!rowData) {
          return null;
        }
        
        // Read focusedRowId at call time (not at computed evaluation time)
        // This prevents the computed from re-evaluating when focusedRowId changes
        const focusedRowId = self.content?.focusedRowId;
        const hasFocusedRow = focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '';
        
        // If no conditional styles and no focused row, return null early
        if (!hasConditionalStyles && !hasFocusedRow) {
          return null;
        }
        
        // Accumulate styles from all matching rules
        // Later rules override earlier ones for conflicting properties
        let mergedStyle = {};
        
        // Check if this row is the focused row (we'll apply styling at the end)
        let isFocusedRow = false;
        if (hasFocusedRow) {
          // Get the row's ID using the idFormula
          let baseId = self.resolveMappingFormula(self.content.idFormula, rowData);
          
          // Fallback to common ID fields if formula doesn't return a valid ID
          if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
            baseId = rowData.id || rowData._id || rowData.uuid || rowData.ID || rowData.Id;
          }
          
          // Compare with focusedRowId (convert both to strings for comparison)
          const baseIdStr = baseId != null ? String(baseId) : '';
          const focusedIdStr = String(focusedRowId);
          
          isFocusedRow = (baseIdStr === focusedIdStr);
        }
        
        // Apply conditional row styles FIRST
        if (hasConditionalStyles) {
          for (const rule of conditionalRowStyles) {
            // Skip rules without a condition formula
            if (!rule?.conditionFormula) {
              continue;
            }
            
            // Evaluate the condition formula with the row data as context
            let conditionResult = false;
            try {
              conditionResult = self.resolveMappingFormula(rule.conditionFormula, rowData);
            } catch (error) {
              // Log error in debug mode and skip this rule
              self.debugLog('[Conditional Row Style] Error evaluating condition:', error);
              continue;
            }
            
            // If condition is true, apply the styles from this rule
            if (conditionResult) {
              // Apply backgroundColor
              if (rule.backgroundColor) {
                mergedStyle.backgroundColor = rule.backgroundColor;
              }
              
              // Apply textColor (maps to color CSS property)
              if (rule.textColor) {
                mergedStyle.color = rule.textColor;
              }
              
              // Apply fontWeight
              if (rule.fontWeight) {
                mergedStyle.fontWeight = rule.fontWeight;
              }
              
              // Apply fontStyle
              if (rule.fontStyle) {
                mergedStyle.fontStyle = rule.fontStyle;
              }
              
              // Apply border properties
              if (rule.borderLeft) {
                mergedStyle.borderLeft = rule.borderLeft;
              }
              if (rule.borderRight) {
                mergedStyle.borderRight = rule.borderRight;
              }
              if (rule.borderTop) {
                mergedStyle.borderTop = rule.borderTop;
              }
              if (rule.borderBottom) {
                mergedStyle.borderBottom = rule.borderBottom;
              }
            }
          }
        }
        
        // Apply focused row styling LAST to override conditional styles
        if (isFocusedRow) {
          // Using box-shadow for a left border effect that doesn't affect layout
          mergedStyle.boxShadow = 'inset 4px 0 0 0 var(--ag-range-selection-border-color, #2196F3)';
          // Add a subtle background tint (overrides any conditional backgroundColor)
          mergedStyle.backgroundColor = 'var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1))';
        }
        
        // Return the merged style object, or null if no styles were applied
        return Object.keys(mergedStyle).length > 0 ? mergedStyle : null;
      };
    },
    isEditing() {
      /* wwEditor:start */
      return (
        this.wwEditorState.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION
      );
      /* wwEditor:end */
      // eslint-disable-next-line no-unreachable
      return false;
    },
    invalidEditValueMode() {
      return this.content?.invalidEditValueMode || "revert";
    },
    paginationPageSizeSelector() {
      if (
        !this.content.pagination ||
        this.content.hasPaginationSelector !== "multiple"
      ) {
        return false;
      }
      if (
        !Array.isArray(this.content.paginationPageSizeSelector) ||
        this.content.paginationPageSizeSelector.length === 0
      ) {
        return false;
      }
      return this.content.paginationPageSizeSelector;
    },
  },
  methods: {
    openColumnChooser() {
      this.showColumnChooser = true;
    },
    hideColumn(colId) {
      if (!colId) return;
      const current = [...(this.hiddenColumns || [])];
      if (!current.includes(colId)) {
        current.push(colId);
        this.setHiddenColumns(current);
        this.chooserHiddenState = current;
        this.gridApi?.setColumnsVisible([colId], false);
        this.updateCurrentConfig();
        this.$emit('trigger-event', {
          name: 'columnVisibilityChanged',
          event: {
            columnId: colId,
            visible: false,
            hiddenColumns: current,
          },
        });
      }
    },
    showColumn(colId) {
      if (!colId) return;
      if (!(this.hiddenColumns || []).includes(colId)) return; // already visible, no-op
      const current = (this.hiddenColumns || []).filter(id => id !== colId);
      this.setHiddenColumns(current);
      this.chooserHiddenState = current;
      this.gridApi?.setColumnsVisible([colId], true);
      this.updateCurrentConfig();
      this.$emit('trigger-event', {
        name: 'columnVisibilityChanged',
        event: {
          columnId: colId,
          visible: true,
          hiddenColumns: current,
        },
      });
    },
    toggleColumnVisibility(colId) {
      const col = this.allColumnsList.find(c => c.colId === colId);
      if (col?.isLocked) return;
      if ((this.hiddenColumns || []).includes(colId)) {
        this.showColumn(colId);
      } else {
        this.hideColumn(colId);
      }
    },
    toggleAllColumns() {
      const colIds = this.allColumnsList.filter(c => !c.isLocked).map(c => c.colId);
      // Capture the intended outcome before any mutation
      const willBeVisible = !this.allColumnsVisible;
      if (!willBeVisible) {
        // Hide all columns
        this.setHiddenColumns([...colIds]);
        if (this.gridApi) this.gridApi.setColumnsVisible(colIds, false);
      } else {
        // Show all columns
        this.setHiddenColumns([]);
        if (this.gridApi) this.gridApi.setColumnsVisible(colIds, true);
      }
      const newHiddenColumns = willBeVisible ? [] : [...colIds];
      this.chooserHiddenState = newHiddenColumns;
      this.updateCurrentConfig();
      this.$emit('trigger-event', {
        name: 'columnVisibilityChanged',
        event: {
          columnId: null,
          visible: willBeVisible,
          hiddenColumns: newHiddenColumns,
        },
      });
    },
    onChooserDragStart(colId) {
      const col = this.allColumnsList.find(c => c.colId === colId);
      if (col?.isLocked) return;
      this.chooserDragColId = colId;
    },
    onChooserDragOver(colId) {
      if (this.chooserDragColId && colId !== this.chooserDragColId) {
        this.chooserDragOverColId = colId;
      }
    },
    onChooserDrop(targetColId) {
      const fromColId = this.chooserDragColId;
      if (!fromColId || fromColId === targetColId) {
        this.chooserDragColId = null;
        this.chooserDragOverColId = null;
        return;
      }
      const targetCol = this.allColumnsList.find(c => c.colId === targetColId);
      if (targetCol?.isLocked) {
        this.chooserDragColId = null;
        this.chooserDragOverColId = null;
        return;
      }
      // Reorder chooserColumnOrder
      const order = [...this.chooserColumnOrder];
      const fromIdx = order.indexOf(fromColId);
      const toIdx = order.indexOf(targetColId);
      if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, fromColId);
        this.chooserColumnOrder = order;
        // Apply new order to AG Grid
        if (this.gridApi) {
          this.gridApi.applyColumnState({
            state: order.map(colId => ({ colId })),
            applyOrder: true,
          });
        }
        this.updateCurrentConfig();
      }
      this.chooserDragColId = null;
      this.chooserDragOverColId = null;
    },
    onChooserDragEnd() {
      this.chooserDragColId = null;
      this.chooserDragOverColId = null;
    },
    /* wwEditor:start */
    checkIfColumnsStructureChanged(newDefs, oldDefs) {
      // If no old defs, structure changed (initial load)
      if (!oldDefs || !Array.isArray(oldDefs)) return false;
      
      // If no new defs or not an array, no structure change
      if (!newDefs || !Array.isArray(newDefs)) return false;
      
      // If number of columns changed, structure changed
      if (newDefs.length !== oldDefs.length) return true;
      
      // Check if column IDs or key properties changed
      for (let i = 0; i < newDefs.length; i++) {
        const newCol = newDefs[i];
        const oldCol = oldDefs[i];
        
        // If either column is undefined/null, consider it a change
        if (!newCol || !oldCol) return true;
        
        // Check if column ID changed
        const newColId = newCol.colId || newCol.field;
        const oldColId = oldCol.colId || oldCol.field;
        if (newColId !== oldColId) return true;
        
        // Check if filter/sortable flags changed
        if (newCol.filter !== oldCol.filter) return true;
        if (newCol.sortable !== oldCol.sortable) return true;
        
        // Check if header name changed
        if (newCol.headerName !== oldCol.headerName) return true;
      }
      
      // No structural changes detected
      return false;
    },
    /* wwEditor:end */
    getRowId(params) {
      // Get ID from formula
      let rowId = this.resolveMappingFormula(this.content.idFormula, params.data);
      
      // If formula returns a valid ID, use it directly (stable across re-renders)
      // IMPORTANT: Do NOT append data hashes - that causes row IDs to change whenever
      // any field in the row data changes, which forces AG Grid to destroy and recreate
      // all cell renderers (causing visible flickering on custom/user columns).
      if (rowId !== null && rowId !== undefined && rowId !== '') {
        return String(rowId);
      }
      
      // Fallback: generate a deterministic ID from the row index when no idFormula is set.
      // Using the row index from params ensures stability across re-renders as long as
      // the data order doesn't change. This is a reasonable fallback when no ID is configured.
      if (params.node?.rowIndex != null) {
        return `row-idx-${params.node.rowIndex}`;
      }
      
      // Last resort: hash-based ID from data content (deterministic but may change if data mutates)
      const dataStr = JSON.stringify(params.data || {});
      let hash = 0;
      for (let i = 0; i < dataStr.length; i++) {
        const char = dataStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `row-${Math.abs(hash)}`;
    },
    onActionTrigger(event) {
      this.$emit("trigger-event", {
        name: "action",
        event,
      });
    },
    onCellEditRequest(event) {
      // Method kept for potential future use
    },
    onCellValueChanged(event) {
      // Find the column configuration to get isDirectUpdate
      const columnId = event.column.getColId();
      const columnConfig = this.content.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      // For select columns: read the value directly from the data to ensure we get the ID, not the label
      // The valueSetter ensures the actual value (ID) is stored in the data field
      const newValue = event.data?.[columnId];
      
      // Check if this is a user column (all user columns need safeguard to prevent data fetching)
      const isUserColumn = columnConfig?.cellDataType === 'user';
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      const isForeignKeyColumn = isUserColumn && columnConfig?.isManyToMany === true;
      const defaultUserIdFormula = { type: 'f', code: 'context.mapping' };
      const userIdFormula = columnConfig?.userIdFormula || defaultUserIdFormula;
      
      // For user columns, get oldValue as raw user IDs (not display names)
      // AG Grid's event.oldValue might be the display value (names) due to valueGetter
      let oldValue = event.oldValue;
      
      if (isUserColumn && event.node) {
        // Helper function to extract user ID(s) from raw cell value using userIdFormula
        const extractUserIds = (rawValue, rowData) => {
          if (!rawValue) return null;
          // Apply userIdFormula to extract user ID(s) from potentially nested structures
          const extractedValue = this.resolveMappingFormula(userIdFormula, rawValue);
          // Return the extracted value, or fallback to raw value if formula returns null/undefined
          return extractedValue ?? rawValue;
        };
        
        // Helper function to get user name (for reverse lookup)
        const getUserName = (user) => {
          if (user.name) return user.name;
          if (user.firstname || user.lastname) {
            return [user.firstname, user.lastname].filter(Boolean).join(' ');
          }
          return user.email || user.id || '';
        };
        
        // Helper function to find user ID by name
        const findUserIdByName = (name, users) => {
          if (!name || !users || !Array.isArray(users)) return null;
          const user = users.find(u => {
            const userName = getUserName(u);
            return userName === name || u.id === name || u.email === name;
          });
          return user?.id || null;
        };
        
        // Get users array from column config
        const users = columnConfig?.users || [];
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        
        // Try to get raw value from node's data (before it was changed)
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
          normalizedOldValue = extractUserIds(oldValue, event.node.data);
          
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
        
        // Ensure format matches setCellValue expectations:
        // - Single user: string ID
        // - Multiple users: array of string IDs
        if (isMultiple) {
          // Ensure it's an array
          if (Array.isArray(normalizedOldValue)) {
            oldValue = normalizedOldValue;
          } else if (normalizedOldValue != null) {
            oldValue = [normalizedOldValue];
          } else {
            oldValue = [];
          }
        } else {
          // Ensure it's a single value (not array)
          if (Array.isArray(normalizedOldValue) && normalizedOldValue.length > 0) {
            oldValue = normalizedOldValue[0];
          } else {
            oldValue = normalizedOldValue;
          }
        }
      } else {
        // For non-user columns, use oldValue as-is
        oldValue = event.oldValue;
      }
      
      // Don't emit event if values are the same (e.g., when edit was cancelled with Escape)
      // This handles both primitive values and arrays
      const valuesEqual = (() => {
        if (oldValue === newValue) return true;
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
          if (oldValue.length !== newValue.length) return false;
          return oldValue.every((val, idx) => val === newValue[idx]);
        }
        return false;
      })();
      
      if (valuesEqual) {
        return; // Skip emitting event when values are the same (cancelled edit)
      }
      // For select columns, oldValue should already be the option value (not label)
      // AG Grid's oldValue should match what's stored in data, which is the option value
      
      // Set flag to prevent data fetching during ANY user column update
      // This prevents watchers from triggering Supabase fetches when we modify user data
      if (isUserColumn) {
        this.debugLog('[User Column Update] Setting isUpdatingDataLocally flag to TRUE');
        this.setUpdatingDataLocally(true);
        this.debugLog('[User Column Update] Flag set, about to process update');
      }
      
      // If it's a many-to-many user column (junction table), simulate creating a fake junction record
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      // maxNumberOfUsers only affects whether the result is stored as an array or single object
      if (isForeignKeyColumn && newValue) {
        // Normalize newValue to array format for processing
        const userIds = Array.isArray(newValue) ? newValue : [newValue];
        const userIdFormulaForJunction = columnConfig?.userIdFormula || defaultUserIdFormula;
        
        // Helper function to create fake junction record structure based on userIdFormula
        const createFakeJunctionRecord = (userId, formula) => {
          // Parse the formula code to understand the nested structure
          const formulaCode = formula?.code || '';
          
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
        };
        
        // Create fake junction records - always create array structure for many-to-many
        // Check maxNumberOfUsers to determine if we should store as array or single object
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        let fakeJunctionRecord;
        if (isMultiple) {
          // Multiple users: array of nested structures
          fakeJunctionRecord = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormulaForJunction));
        } else {
          // Single user: single nested structure (not array)
          fakeJunctionRecord = createFakeJunctionRecord(userIds[0], userIdFormulaForJunction);
        }
        
        try {
          // Update the row data with the fake junction record
          event.data[columnId] = fakeJunctionRecord;
          
          // Refresh the cell to show the updated value
          // CRITICAL FIX: Wrap in setTimeout to prevent error #252
          if (this.gridApi && event.node) {
            const rowNode = event.node;
            setTimeout(() => {
              if (this.gridApi) {
                this.gridApi.refreshCells({
                  rowNodes: [rowNode],
                  columns: [columnId],
                  force: true,
                });
              }
            }, 0);
          }
          
          this.debugLog('[Foreign Key] Created fake junction record:', {
            columnId,
            userIdFormula: userIdFormulaForJunction,
            fakeRecord: fakeJunctionRecord,
          });
        } catch (error) {
          console.error('[Foreign Key] Error creating fake junction record:', error);
        }
      }
      
      // Clear flag after a short delay for ALL user column updates
      // This ensures watchers don't trigger fetches during the update
      if (isUserColumn) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.debugLog('[User Column Update] Clearing isUpdatingDataLocally flag');
            this.setUpdatingDataLocally(false);
            this.debugLog('[User Column Update] Flag cleared');
          }, 200); // Delay to ensure all watchers have processed
        });
      }
      
      // Redraw the row to re-evaluate conditional row styles
      // This is needed because getRowStyle is only called when rows are rendered
      // Only do this if conditional styles are defined (avoid unnecessary redraws)
      if (this.gridApi && event.node && this.content?.conditionalRowStyles?.length > 0) {
        // Use a slightly longer timeout to batch with any other updates
        setTimeout(() => {
          if (this.gridApi && !this.isGridRendering) {
            this.gridApi.redrawRows({ rowNodes: [event.node] });
          }
        }, 50);
      }
      
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: isForeignKeyColumn && event.data?.[columnId] ? event.data[columnId] : newValue, // Use fake junction record if created
          columnId: columnId,
          row: event.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    onRowClicked(event) {
      this.$emit("trigger-event", {
        name: "rowClicked",
        event: {
          row: event.data,
          id: event.node.id,
          index: event.node.sourceRowIndex,
          displayIndex: event.rowIndex,
        },
      });
    },
    onCustomCellEdit(event) {
      this.$emit("trigger-event", {
        name: event.type,
        event: {
          columnId: event.columnId,
          field: event.field,
          value: event.value,
          row: event.row,
          id: event.id,
          index: event.index,
          displayIndex: event.displayIndex,
          isCancel: event.isCancel || false,
        },
      });
    },
    /**
     * Component action: Set a cell value for a specific row and column
     * @param {string|number} rowId - The ID of the row (must match the idFormula output)
     * @param {string} columnId - The column ID (field name or actionName)
     * @param {any} newValue - The new value to set for the cell
     * @returns {boolean} - Returns true if successful, false otherwise
     */
    async setCellValue(rowId, columnId, newValue) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing cell value operations
      // This prevents error #252 when setCellValue is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for setCellValue:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.setCellValue(rowId, columnId, newValue);
            resolve(result);
          }, 100);
        });
      }
      
      if (!rowId || columnId === undefined || columnId === null) {
        console.warn("[Datagrid] setCellValue requires rowId and columnId parameters");
        return false;
      }
      
      // Try to get the row node
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found and rowId is a number, try converting to string and vice versa
      if (!rowNode) {
        const alternativeId = typeof rowId === 'number' ? String(rowId) : Number(rowId);
        if (!isNaN(alternativeId)) {
          rowNode = this.gridApi.getRowNode(alternativeId);
        }
      }
      
      // If still not found, search through all rows by matching the ID formula
      // CRITICAL: getRowId appends a hash to the ID formula result, so we need to match
      // by the base ID (from formula) rather than the full node.id
      if (!rowNode) {
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            // Get the base ID using the same formula as getRowId (without hash)
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // If formula returns the field name instead of value, try direct access
            // This handles cases where the formula might not resolve correctly
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              // Try common ID field names directly from node.data
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            // Convert to string for comparison
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            // Try exact match with base ID (what user provides)
            if (baseIdStr === rowIdStr) {
              rowNode = node;
            }
            // Also check if the provided rowId matches the start of node.id
            // (in case getRowId appended a hash: "uuid-hash")
            else if (node.id && String(node.id).startsWith(rowIdStr + '-')) {
              rowNode = node;
            }
            // Also check if node.id exactly matches (in case user provided full ID with hash)
            else if (node.id && String(node.id) === rowIdStr) {
              rowNode = node;
            }
            // Fallback: check if rowId exists as a property value in node.data
            else if (node.data && Object.values(node.data).some(val => String(val) === rowIdStr)) {
              rowNode = node;
            }
          }
        });
      }
      
      if (!rowNode) {
        console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
        // Debug: log available row IDs to help troubleshoot
        if (this.content?.enableDebugLogs) {
          const availableIds = [];
          this.gridApi.forEachNode((node) => {
            if (node.data) {
              let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
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
          console.log('[Datagrid] Available row IDs:', availableIds);
        }
        return false;
      }
      
      if (!rowNode.data) {
        console.warn(`[Datagrid] Row node found but has no data`);
        return false;
      }
      
      // Find the column configuration
      const columnConfig = this.content.columns?.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      if (!columnConfig) {
        console.warn(`[Datagrid] Column "${columnId}" not found in column configuration`);
      }
      
      // Handle user columns - convert user ID(s) to nested structure if many-to-many
      // isManyToMany is the ONLY condition that determines if a column is managed as many-to-many
      let valueToSet = newValue;
      const isUserColumn = columnConfig?.cellDataType === 'user';
      if (isUserColumn) {
        const isManyToMany = columnConfig?.isManyToMany === true;
        const userIdFormula = columnConfig?.userIdFormula || { type: 'f', code: 'context.mapping' };
        const isMultiple = (columnConfig?.maxNumberOfUsers ?? 4) > 1;
        
        if (isManyToMany && newValue) {
          // Helper function to create fake junction record structure based on userIdFormula
          const createFakeJunctionRecord = (userId, formula) => {
            // Parse the formula code to understand the nested structure
            const formulaCode = formula?.code || '';
            
            // Extract path from formula (e.g., "profile.id" from "context.mapping?.profile?.id")
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
          };
          
          // Normalize newValue to array for processing
          const userIds = Array.isArray(newValue) ? newValue : [newValue];
          
          // Convert user ID(s) to nested structure based on maxNumberOfUsers
          if (isMultiple) {
            // Multiple users: array of nested structures
            valueToSet = userIds.map(userId => createFakeJunctionRecord(userId, userIdFormula));
          } else {
            // Single user: single nested structure (not array)
            valueToSet = createFakeJunctionRecord(userIds[0], userIdFormula);
          }
        }
        // For non-many-to-many user columns, valueToSet remains as newValue (user ID or array of IDs)
      }
      
      // Update the data directly
      rowNode.data[columnId] = valueToSet;
      
      // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
      // Use setTimeout to avoid calling grid API during render phase
      setTimeout(() => {
        if (this.gridApi && !this.isGridRendering) {
          if (this.content?.conditionalRowStyles?.length > 0) {
            // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
            this.gridApi.redrawRows({ rowNodes: [rowNode] });
          } else {
            // Just refresh the specific cell if no conditional styles
            this.gridApi.refreshCells({
              rowNodes: [rowNode],
              columns: [columnId],
              force: true,
            });
          }
        }
      }, 0);
      
      // Note: We don't trigger the cellValueChanged event here because this is a programmatic
      // update via component action. The event should only fire for user-initiated edits.
      
      return true;
    },
    triggerCellValueChanged(rowId, columnId, newValue) {
      if (!this.gridApi) {
        console.log("Grid API is not initialized yet");
        return;
      }
      
      // Try to get the row node
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found and rowId is a number, try converting to string and vice versa
      if (!rowNode) {
        const alternativeId = typeof rowId === 'number' ? String(rowId) : Number(rowId);
        if (!isNaN(alternativeId)) {
          rowNode = this.gridApi.getRowNode(alternativeId);
        }
      }
      
      // If still not found, search through all rows by matching the ID formula
      // CRITICAL: getRowId appends a hash to the ID formula result, so we need to match
      // by the base ID (from formula) rather than the full node.id
      if (!rowNode) {
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            // Get the base ID using the same formula as getRowId (without hash)
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // If formula returns the field name instead of value, try direct access
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            // Convert to string for comparison
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            // Try exact match with base ID (what user provides)
            if (baseIdStr === rowIdStr) {
              rowNode = node;
            }
            // Also check if the provided rowId matches the start of node.id
            else if (node.id && String(node.id).startsWith(rowIdStr + '-')) {
              rowNode = node;
            }
            // Also check if node.id exactly matches
            else if (node.id && String(node.id) === rowIdStr) {
              rowNode = node;
            }
            // Fallback: check if rowId exists as a property value in node.data
            else if (node.data && Object.values(node.data).some(val => String(val) === rowIdStr)) {
              rowNode = node;
            }
          }
        });
      }
      
      if (!rowNode) {
        console.log(`Row with id "${rowId}" not found in the grid. Make sure the row ID matches the ID formula output.`);
        return;
      }
      
      if (!rowNode.data) {
        console.log(`Row node found but has no data`);
        return;
      }
      
      const oldValue = rowNode.data?.[columnId];
      
      // Find the column configuration to get isDirectUpdate
      const columnConfig = this.content.columns.find(
        (col) => col?.field === columnId || col?.actionName === columnId
      );
      
      if (!columnConfig) {
        console.log(`Column "${columnId}" not found in column configuration`);
      }
      
      // Update the data directly
      rowNode.data[columnId] = newValue;
      
      // Refresh the cells OR redraw the row (not both - redrawRows also refreshes cells)
      // Use setTimeout to avoid calling grid API during render phase
      setTimeout(() => {
        if (this.gridApi && !this.isGridRendering) {
          if (this.content?.conditionalRowStyles?.length > 0) {
            // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
            this.gridApi.redrawRows({ rowNodes: [rowNode] });
          } else {
            // Just refresh the specific cell if no conditional styles
            this.gridApi.refreshCells({
              rowNodes: [rowNode],
              columns: [columnId],
              force: true,
            });
          }
        }
      }, 0);
      
      // Manually trigger the event (bypassing AG Grid's event)
      this.$emit("trigger-event", {
        name: "cellValueChanged",
        event: {
          oldValue: oldValue,
          newValue: newValue,
          columnId: columnId,
          row: rowNode.data,
          isDirectUpdate: columnConfig?.isDirectUpdate || false,
        },
      });
    },
    /**
     * Component action: Refresh a specific row from Supabase
     * @param {string|number} rowId - The ID of the row to refresh
     * @returns {Promise<boolean>} - Returns true if successful, false otherwise
     */
    async refreshRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing refresh operations
      // This prevents error #252 when refreshRow is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for refreshRow:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.refreshRow(rowId);
            resolve(result);
          }, 100);
        });
      }
      
      if (this.content?.dataSource !== 'supabase') {
        console.warn("[Datagrid] refreshRow only works with Supabase data source");
        return false;
      }
      
      if (rowId === null || rowId === undefined) {
        console.warn("[Datagrid] refreshRow requires a rowId parameter");
        return false;
      }

      // Extract primary key field from idFormula
      // Formula format: "context.mapping?.['id']" or "context.mapping?.id"
      const idFormula = this.content?.idFormula;
      let primaryKeyField = 'id'; // default
      
      if (idFormula?.code) {
        // Match patterns like: mapping?.['fieldName'] or mapping?.fieldName or mapping.fieldName
        const match = idFormula.code.match(/mapping\??\.\[?['"]?(\w+)['"]?\]?/);
        if (match && match[1]) {
          primaryKeyField = match[1];
        }
      }

      try {
        // Wait for Supabase instance to become available (with retry logic)
        const supabase = await this.waitForSupabaseInstance(10000, 100);
        const tableName = this.content?.supabaseTable;
        const queryString = this.content?.supabaseQuery || '*';

        if (!supabase) {
          console.warn("[Datagrid] Supabase instance not available after waiting");
          return false;
        }

        if (!tableName) {
          console.warn("[Datagrid] Supabase table name is required");
          return false;
        }

        // Fetch the single row
        const { data, error } = await supabase
          .from(tableName)
          .select(queryString)
          .eq(primaryKeyField, rowId)
          .single();

        if (error) throw error;
        if (!data) {
          console.warn(`[Datagrid] Row with ${primaryKeyField}="${rowId}" not found`);
          return false;
        }

        // Find and update the row in the grid
        let rowNode = null;
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            if (baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data[primaryKeyField];
            }
            if (String(baseId) === rowIdStr) {
              rowNode = node;
            }
          }
        });

        if (rowNode) {
          // Update the row data
          rowNode.setData(data);
          
          // CRITICAL FIX: Wrap refresh in setTimeout to prevent error #252
          // This ensures the API call happens outside the current render cycle
          setTimeout(() => {
            if (this.gridApi && !this.isGridRendering) {
              if (this.content?.conditionalRowStyles?.length > 0) {
                // Redraw the row to re-evaluate conditional row styles (also refreshes cells)
                this.gridApi.redrawRows({ rowNodes: [rowNode] });
              } else {
                // Just refresh cells if no conditional styles
                this.gridApi.refreshCells({
                  rowNodes: [rowNode],
                  force: true,
                });
              }
            }
          }, 0);
          
          this.debugLog(`[Datagrid] Row ${rowId} refreshed successfully`);
          return true;
        } else {
          // Row not found in grid but was fetched from DB - add it to the grid
          this.debugLog(`[Datagrid] Row with id "${rowId}" not found in grid, adding it from database`);
          
          const isInfiniteScroll = this.content?.enableInfiniteScroll === true;
          
          // CRITICAL: Set flag to prevent watchers from triggering a full grid re-render
          // When we update supabaseDataRef, the rowData computed will change, which would
          // normally cause AG Grid to see a new array reference and re-render everything.
          // By setting this flag, the watch on rowData.value will skip processing.
          this.setUpdatingDataLocally(true);
          this.debugLog('[Datagrid refreshRow] Setting isUpdatingDataLocally flag to TRUE');
          
          // Helper to safely check if something is a ref object (has .value property as object)
          const isRefObject = (val) => {
            return val !== null && typeof val === 'object' && 'value' in val;
          };
          
          // Helper to safely get ref values (handles both ref objects and unwrapped values)
          const getRefValue = (refOrValue) => {
            if (isRef(refOrValue)) return refOrValue.value;
            if (isRefObject(refOrValue)) return refOrValue.value;
            return refOrValue;
          };
          
          // Helper to safely set ref values
          const setRefValue = (refOrValue, newValue) => {
            if (isRef(refOrValue)) {
              refOrValue.value = newValue;
              return true;
            }
            if (isRefObject(refOrValue)) {
              refOrValue.value = newValue;
              return true;
            }
            // If it's already unwrapped (primitive), we can't set it directly
            return false;
          };
          
          try {
            if (isInfiniteScroll) {
              // For infinite scroll mode when ADDING a new row:
              // CRITICAL FIX: We cannot use the cached data approach because supabaseData
              // only contains the current block, not all rows. If we return cached data,
              // AG Grid will think that's all the data and replace existing rows.
              // 
              // Instead, we need to:
              // 1. Clear the isUpdatingDataLocally flag so getRows fetches fresh data
              // 2. Purge the cache and refresh - this will trigger a fresh fetch from Supabase
              //    which will include the newly added row
              // 3. Wait for the row to appear in the grid before returning
              
              this.debugLog('[Datagrid] Infinite scroll mode: clearing flag to fetch fresh data with new row');
              
              // Clear the flag BEFORE refreshing so getRows will fetch from Supabase
              this.setUpdatingDataLocally(false);
              
              // Purge and refresh the infinite cache
              // With flag cleared, this will fetch fresh data from Supabase including the new row
              return new Promise((resolve) => {
                setTimeout(async () => {
                  if (this.gridApi) {
                    this.gridApi.purgeInfiniteCache();
                    this.debugLog('[Datagrid] Purged infinite cache to reload data with new row');
                    
                    // Refresh the datasource to trigger fresh data fetch
                    const currentDatasource = this.datasource;
                    if (currentDatasource) {
                      this.gridApi.setGridOption('datasource', currentDatasource);
                      this.debugLog('[Datagrid] Refreshed datasource - will fetch fresh data from Supabase');
                    }
                    
                    // CRITICAL: Wait for the row to appear in the grid before resolving
                    // This ensures subsequent actions can find the row
                    try {
                      await this.waitForRowInGrid(rowId, 10000);
                      this.debugLog(`[Datagrid] Row ${rowId} is now present in the grid`);
                      resolve(true);
                    } catch (error) {
                      console.warn(`[Datagrid] Row ${rowId} may not have appeared in grid:`, error.message);
                      // Still resolve true as the row was fetched and cache was refreshed
                      resolve(true);
                    }
                  } else {
                    resolve(false);
                  }
                }, 0);
              });
            } else {
              // For regular mode (non-infinite scroll), use applyTransaction to add the row
              // This is the most efficient way as it only updates the affected rows in the grid
              this.gridApi.applyTransaction({ add: [data], addIndex: 0 });
              this.debugLog(`[Datagrid] Row ${rowId} added to grid using applyTransaction`);
              
              // Update the cached data to keep it in sync
              // The isUpdatingDataLocally flag prevents the rowData watch from causing a re-render
              const supabaseDataRefValue = this.supabaseDataRef;
              if (supabaseDataRefValue) {
                const currentDataValue = getRefValue(supabaseDataRefValue);
                if (Array.isArray(currentDataValue)) {
                  const newData = [...currentDataValue];
                  newData.unshift(data);
                  if (!setRefValue(supabaseDataRefValue, newData)) {
                    // If we couldn't set through ref, try to modify array in place
                    if (Array.isArray(supabaseDataRefValue)) {
                      supabaseDataRefValue.unshift(data);
                    }
                  }
                  this.debugLog(`[Datagrid] Updated cached data, now ${newData.length} rows`);
                }
              }
              
              // Increment total count if available
              if (this.supabaseTotalCountRef) {
                const currentCount = getRefValue(this.supabaseTotalCountRef) || 0;
                setRefValue(this.supabaseTotalCountRef, currentCount + 1);
                this.debugLog(`[Datagrid] Incremented total count to ${currentCount + 1}`);
              }
            }
            
            this.debugLog(`[Datagrid] Row ${rowId} added successfully from database`);
            return true;
          } finally {
            // Clear the flag after a delay to allow any pending watchers to be skipped
            // Use nextTick + setTimeout to ensure all Vue reactivity has settled
            this.$nextTick(() => {
              setTimeout(() => {
                this.setUpdatingDataLocally(false);
                this.debugLog('[Datagrid refreshRow] Clearing isUpdatingDataLocally flag');
              }, 200);
            });
          }
        }
      } catch (error) {
        console.error('[Datagrid] Error refreshing row:', error);
        return false;
      }
    },
    async stopCellEditing(cancel = false) {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for stopCellEditing");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.stopEditing(cancel);
      }, 0);
    },
    async resetFilters() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for resetFilters");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.setFilterModel(null);
      }, 0);
    },
    async resetSort() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for resetSort");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.applyColumnState({
          state: [],
          defaultState: { sort: null },
        });
      }, 0);
    },
    async deselectAll() {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for deselectAll");
        return;
      }
      if (!this.gridApi) return;
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.deselectAll();
      }, 0);
    },
    async selectAll(mode) {
      // Wait for grid to be ready
      try {
        await this.waitForGridReady(2000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for selectAll");
        return;
      }
      if (!this.gridApi) return;
      if (this.content.rowSelection !== "multiple") {
        wwLib.logStore.warning(
          "Select all will have no effect, as row selection is not set to multiple"
        );
        return;
      }
      // Defer to avoid error #252
      setTimeout(() => {
        if (this.gridApi) this.gridApi.selectAll(mode || this.content.selectAll || "all");
      }, 0);
    },
    async selectRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing selection
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for selectRow:", error.message);
        return;
      }
      
      if (!this.gridApi) return;
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        setTimeout(() => this.selectRow(rowId), 100);
        return;
      }
      
      // Try to get the row node directly first
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found, search by base ID (getRowId appends a hash)
      if (!rowNode) {
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // If formula returns the field name instead of value, try direct access
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            if (baseIdStr === rowIdStr || 
                (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
                (node.id && String(node.id) === rowIdStr) ||
                (node.data && Object.values(node.data).some(val => String(val) === rowIdStr))) {
              rowNode = node;
            }
          }
        });
      }
      
      if (rowNode) {
        rowNode.setSelected(true);
      }
    },
    async deselectRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing deselection
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for deselectRow:", error.message);
        return;
      }
      
      if (!this.gridApi) return;
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        setTimeout(() => this.deselectRow(rowId), 100);
        return;
      }
      
      // Try to get the row node directly first
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found, search by base ID (getRowId appends a hash)
      if (!rowNode) {
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // If formula returns the field name instead of value, try direct access
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            if (baseIdStr === rowIdStr || 
                (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
                (node.id && String(node.id) === rowIdStr) ||
                (node.data && Object.values(node.data).some(val => String(val) === rowIdStr))) {
              rowNode = node;
            }
          }
        });
      }
      
      if (rowNode) {
        rowNode.setSelected(false);
      }
    },
    async removeRow(rowId) {
      // CRITICAL FIX: Wait for grid to be fully ready before performing remove operations
      // This prevents error #252 when removeRow is called before grid is ready
      try {
        await this.waitForGridReady(5000);
      } catch (error) {
        console.warn("[Datagrid] Grid not ready for removeRow:", error.message);
        return false;
      }
      
      if (!this.gridApi) {
        console.warn("[Datagrid] Grid API is not initialized yet");
        return false;
      }
      
      // Additional check: if grid is currently rendering, defer the call
      if (this.isGridRendering) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.removeRow(rowId);
            resolve(result);
          }, 100);
        });
      }
      
      if (rowId === null || rowId === undefined) {
        console.warn("[Datagrid] removeRow requires a rowId parameter");
        return false;
      }
      
      // Try to get the row node directly first
      let rowNode = this.gridApi.getRowNode(rowId);
      
      // If not found, search by base ID (getRowId appends a hash)
      if (!rowNode) {
        const rowIdStr = String(rowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            // If formula returns the field name instead of value, try direct access
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            if (baseIdStr === rowIdStr || 
                (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
                (node.id && String(node.id) === rowIdStr) ||
                (node.data && Object.values(node.data).some(val => String(val) === rowIdStr))) {
              rowNode = node;
            }
          }
        });
      }
      
      if (!rowNode) {
        console.warn(`[Datagrid] Row with id "${rowId}" not found in the grid`);
        return false;
      }
      
      // Set flag to prevent re-fetching during local update
      // This prevents watchers from triggering data fetches when we remove a row
      // CRITICAL: Set flag BEFORE any operations to prevent any watchers from firing
      this.setUpdatingDataLocally(true);
      this.debugLog('[Remove Row] Setting isUpdatingDataLocally flag to TRUE');
      
      // Remove the row from the grid
      try {
        const isInfiniteScroll = this.content?.dataSource === 'supabase' && this.content?.enableInfiniteScroll === true;
        
        if (isInfiniteScroll) {
          // For infinite scroll mode, applyTransaction doesn't work properly
          // We need to:
          // 1. Store the rowId to filter out when datasource returns cached data
          // 2. Remove from cached supabaseData
          // 3. Decrement total count
          // 4. Purge cache and refresh datasource
          // 5. The datasource's getRows will filter out the removed row when returning cached data
          
          // Store the removed row ID so datasource can filter it out
          // Access the removedRowIds ref from setup
          if (this.removedRowIds) {
            this.removedRowIds.add(String(rowId));
            this.debugLog(`[Remove Row] Added row ${rowId} to removedRowIds set (size: ${this.removedRowIds.size})`);
          } else {
            this.debugLog(`[Remove Row] Warning: removedRowIds not available`);
          }
          
          // Remove from cached data
          if (this.supabaseDataRef && Array.isArray(this.supabaseDataRef.value)) {
            const currentData = [...this.supabaseDataRef.value];
            const filteredData = currentData.filter(row => {
              const rowIdFromData = this.resolveMappingFormula(this.content.idFormula, row);
              return String(rowIdFromData) !== String(rowId);
            });
            
            // Update cached data
            this.supabaseDataRef.value = filteredData;
            this.debugLog(`[Remove Row] Removed from cached data, ${filteredData.length} rows remaining`);
          }
          
          // Decrement total count
          if (this.supabaseTotalCountRef && this.supabaseTotalCountRef.value > 0) {
            this.supabaseTotalCountRef.value = this.supabaseTotalCountRef.value - 1;
            this.debugLog(`[Remove Row] Decremented total count to ${this.supabaseTotalCountRef.value}`);
          }
          
          // For infinite scroll mode, we need to remove the row from the view
          // Since applyTransaction doesn't work reliably, we'll:
          // 1. Try to hide/remove the node directly from the DOM
          // 2. Purge and refresh the cache to rebuild without the row
          
          // First, try to remove the row node from the DOM directly
          try {
            // Get the row element from the DOM
            const rowElement = this.gridContainerRef?.querySelector(`[row-id="${rowNode.id}"]`);
            if (rowElement) {
              // Hide the row by setting display to none
              rowElement.style.display = 'none';
              this.debugLog('[Remove Row] Hid row element from DOM');
            } else {
              // Try alternative selector patterns
              const allRows = this.gridContainerRef?.querySelectorAll('.ag-row');
              if (allRows) {
                allRows.forEach((rowEl, index) => {
                  const rowNodeFromGrid = this.gridApi.getDisplayedRowAtIndex(index);
                  if (rowNodeFromGrid && rowNodeFromGrid.id === rowNode.id) {
                    rowEl.style.display = 'none';
                    this.debugLog('[Remove Row] Hid row element using index lookup');
                  }
                });
              }
            }
          } catch (e) {
            this.debugLog('[Remove Row] Could not hide row from DOM:', e.message);
          }
          
          // Purge the entire infinite cache - this clears all cached blocks
          this.gridApi.purgeInfiniteCache();
          this.debugLog('[Remove Row] Purged infinite cache');
          
          // Refresh the datasource - this will trigger getRows calls for visible blocks
          // Our flag prevents actual fetching, and getRows will return filtered cached data
          const currentDatasource = this.datasource;
          if (currentDatasource) {
            // Reset the datasource to force AG Grid to re-fetch visible blocks
            this.gridApi.setGridOption('datasource', currentDatasource);
            this.debugLog('[Remove Row] Refreshed datasource (getRows will return filtered data)');
            
            // After a short delay, refresh the infinite cache to rebuild the view
            setTimeout(() => {
              try {
                // refreshInfiniteCache will rebuild the view from the datasource
                // Since our flag is set, getRows will return filtered cached data
                this.gridApi.refreshInfiniteCache();
                this.debugLog('[Remove Row] Refreshed infinite cache - view should update with filtered data');
              } catch (e) {
                this.debugLog('[Remove Row] refreshInfiniteCache not available, trying alternative:', e.message);
                // Fallback: try to refresh cells
                try {
                  this.gridApi.refreshCells({ force: true });
                  this.debugLog('[Remove Row] Fallback: refreshed cells');
                } catch (e2) {
                  this.debugLog('[Remove Row] Could not refresh cells either');
                }
              }
            }, 200);
          } else {
            this.debugLog('[Remove Row] Datasource not available, skipping refresh');
          }
          
          this.debugLog(`[Datagrid] Row ${rowId} removed successfully from infinite scroll grid`);
        } else {
          // For regular mode, use standard applyTransaction
          this.gridApi.applyTransaction({ remove: [rowNode.data] });
          this.debugLog(`[Datagrid] Row ${rowId} removed successfully`);
        }
        
        // Clear the flag after a delay to allow transaction to complete
        // and prevent any watchers from triggering re-fetches
        // Use a longer delay for infinite scroll mode to ensure datasource doesn't refresh
        const delay = isInfiniteScroll ? 500 : 200;
        setTimeout(() => {
          this.setUpdatingDataLocally(false);
          // For infinite scroll, keep removedRowIds for a bit longer to ensure all datasource calls are filtered
          // Then clear it after an additional delay
          if (isInfiniteScroll && this.removedRowIds) {
            setTimeout(() => {
              // Don't clear removedRowIds - we want to keep filtering this row out permanently
              // until the next real data fetch (which will naturally exclude it if it's deleted from DB)
              this.debugLog(`[Remove Row] Keeping removedRowIds (size: ${this.removedRowIds.size}) for future filtering`);
            }, 100);
          }
          this.debugLog('[Remove Row] Clearing isUpdatingDataLocally flag');
        }, delay);
        
        return true;
      } catch (error) {
        console.error('[Datagrid] Error removing row:', error);
        // Clear flag on error immediately
        this.setUpdatingDataLocally(false);
        this.debugLog('[Remove Row] Error occurred, clearing isUpdatingDataLocally flag');
        return false;
      }
    },
    /**
     * Apply focus to the row specified by focusedRowId property.
     * This method is called when the grid renders data to ensure the focused row
     * is always visible and styled correctly.
     * @param {boolean} scrollToRow - Whether to scroll the row into view (default: false for re-renders)
     */
    async applyFocusedRow(scrollToRow = false) {
      const focusedRowId = this.content?.focusedRowId;
      
      // If no focused row ID is set, clear any existing focus styling
      if (focusedRowId === null || focusedRowId === undefined || focusedRowId === '') {
        // Clear any custom action focus class from all cells
        if (this.gridContainerRef) {
          const focusedCells = this.gridContainerRef.querySelectorAll('.ag-cell-action-focus');
          focusedCells.forEach(cell => cell.classList.remove('ag-cell-action-focus'));
        }
        return;
      }
      
      // Ensure grid is ready
      if (!this.gridApi || this.isGridRendering) {
        return;
      }
      
      // Find the row node by ID
      let rowNode = this.gridApi.getRowNode(String(focusedRowId));
      
      // If not found directly, try alternative ID formats
      if (!rowNode) {
        const alternativeId = typeof focusedRowId === 'number' ? String(focusedRowId) : Number(focusedRowId);
        if (!isNaN(alternativeId)) {
          rowNode = this.gridApi.getRowNode(String(alternativeId));
        }
      }
      
      // If still not found, search through all rows by matching the ID formula
      if (!rowNode) {
        const rowIdStr = String(focusedRowId);
        
        this.gridApi.forEachNode((node) => {
          if (!rowNode && node.data) {
            let baseId = this.resolveMappingFormula(this.content.idFormula, node.data);
            
            if (baseId === 'id' || baseId === null || baseId === undefined || baseId === '') {
              baseId = node.data.id || node.data._id || node.data.uuid || node.data.ID || node.data.Id;
            }
            
            const baseIdStr = baseId != null ? String(baseId) : '';
            
            if (baseIdStr === rowIdStr || 
                (node.id && String(node.id).startsWith(rowIdStr + '-')) ||
                (node.id && String(node.id) === rowIdStr)) {
              rowNode = node;
            }
          }
        });
      }
      
      // If row not found, it might be filtered out or not loaded yet (infinite scroll)
      if (!rowNode || !rowNode.data) {
        this.debugLog('[applyFocusedRow] Row not found:', focusedRowId);
        return;
      }
      
      // If scrollToRow is true, scroll the row into view and set cell focus
      if (scrollToRow) {
        const rowIndex = rowNode.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          // Scroll to center the row
          this.gridApi.ensureIndexVisible(rowIndex, 'middle');
          
          // Set focus on the first column
          this.$nextTick(() => {
            if (!this.gridApi) return;
            
            const allColumns = this.gridApi.getAllGridColumns();
            if (allColumns && allColumns.length > 0) {
              const firstColumnId = allColumns[0].getColId();
              
              setTimeout(() => {
                if (this.gridApi) {
                  this.gridApi.setFocusedCell(rowIndex, firstColumnId);
                  
                  // Add custom action focus class
                  this.$nextTick(() => {
                    if (this.gridContainerRef) {
                      const focusedCell = this.gridContainerRef.querySelector('.ag-cell-focus');
                      if (focusedCell) {
                        focusedCell.classList.add('ag-cell-action-focus');
                      }
                    }
                  });
                }
              }, 100);
            }
          });
        }
      }
      
      // Redraw the row to ensure styles are applied (rowStyle will check focusedRowId)
      if (rowNode) {
        this.gridApi.redrawRows({ rowNodes: [rowNode] });
      }
    },
    /* wwEditor:start */
    generateColumns() {
      this.$emit("update:content", {
        columns: this.rowData?.[0]
          ? Object.keys(this.rowData[0]).map((key) => ({
              field: key,
              sortable: true,
              filter: true,
            }))
          : [],
      });
    },
    getOnActionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        actionName: "actionName",
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getOnCellValueChangedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.content.columns || [];
      const firstEditableColumn = columns.find(
        (col) => col?.editable && (col?.cellDataType !== "action" && col?.cellDataType !== "image")
      );
      return {
        oldValue: "oldValue",
        newValue: "newValue",
        columnId: firstEditableColumn?.field || "columnId",
        row: data[0],
        isDirectUpdate: firstEditableColumn?.isDirectUpdate || false,
      };
    },
    getSelectionTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
      };
    },
    getRowClickedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getRowDraggedTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        targetIndex: 1,
        rows: data,
      };
    },
    getRowDragStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
      };
    },
    getColumnMovedTestEvent() {
      const data = this.columnDefs;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        toIndex: 1,
        columnId: data[0]?.field,
        columnsOrder: data.map((col) => col?.field).filter(Boolean),
      };
    },
    getColumnResizedTestEvent() {
      const columns = this.columnDefs;
      if (!columns || !columns[0]) throw new Error("No columns found");
      const columnsWidths = {};
      columns.forEach((col) => {
        const colId = col?.colId || col?.field;
        if (colId) {
          columnsWidths[colId] = col?.width || 150;
        }
      });
      return {
        columnId: columns[0]?.colId || columns[0]?.field,
        width: columns[0]?.width || 150,
        columnsWidths: columnsWidths,
      };
    },
    getCellEditStartTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    },
    getCellEditEndTestEvent() {
      const data = this.rowData;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = this.columnDefs;
      const customColumn = columns.find(
        (col) => col.cellRenderer === "WewebCellRenderer"
      );
      return {
        columnId: customColumn?.field || "field",
        field: customColumn?.field || "field",
        value: data[0]?.[customColumn?.field],
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
        isCancel: false,
      };
    },
    getScrollTestEvent() {
      if (!this.gridApi) throw new Error("Grid API is not initialized");
      return {
        scrollTop: 500,
        scrollLeft: 0,
        scrollHeight: 1000,
        clientHeight: 400,
        distanceFromBottom: 100,
        isNearBottom: true,
        isAtBottom: false,
        totalRows: this.gridApi.getDisplayedRowCount() || 0,
      };
    },
    /* wwEditor:end */
  },
  /* wwEditor:start */
  watch: {
    columnDefs: {
      async handler(newDefs, oldDefs) {
        if (this.wwEditorState?.boundProps?.columns) return;
        
        // Skip if grid is not ready yet
        if (!this.gridApi) return;
        
        // CRITICAL FIX: Only reset column state if columns structure actually changed
        // Don't reset if only data or other reactive dependencies changed
        // This preserves user-applied filters and sorting
        const shouldResetState = this.checkIfColumnsStructureChanged(newDefs, oldDefs);
        if (shouldResetState && this.gridApi) {
          // Save current filters and sorting before reset
          const currentFilters = this.gridApi.getFilterModel();
          const currentSort = this.gridApi.getState()?.sort?.sortModel;
          
          this.gridApi.resetColumnState();
          
          // Restore filters and sorting after reset if they exist
          if (currentFilters && Object.keys(currentFilters).length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.setFilterModel(currentFilters);
              }
            });
          }
          if (currentSort && currentSort.length > 0) {
            this.$nextTick(() => {
              if (this.gridApi) {
                this.gridApi.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          }
        }

        if (this.wwEditorState.isACopy) return;

        // We assume there will only be one custom column each time
        const columnIndex = (this.rawContent.columns || []).findIndex(
          (col) => col?.cellDataType === "custom" && !col?.containerId
        );
        if (columnIndex === -1) return;
        const newColumns = [...this.rawContent.columns];
        let column = { ...newColumns[columnIndex] };
        column.containerId = await this.createElement("ww-flexbox", {
          _state: { name: `Cell ${column.headerName || column.field}` },
        });
        newColumns[columnIndex] = column;
        this.$emit("update:content:effect", { columns: newColumns });
      },
      deep: true,
    },
  },
  /* wwEditor:end */
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
.ww-datagrid {
  position: relative;
  isolation: isolate; // Create a new stacking context to contain AG Grid elements
  
  // Fix horizontal scroll alignment between header and body
  // Optimize scroll containers for better synchronization
  :deep(.ag-header-viewport),
  :deep(.ag-body-viewport) {
    // Use hardware acceleration for smooth scrolling and proper synchronization
    transform: translateZ(0);
    backface-visibility: hidden;
    // Force GPU acceleration for better scroll performance
    -webkit-transform: translateZ(0);
  }
  
  // Remove minimum height when using auto height layout
  // AG Grid sets a 150px minimum height by default for auto height to avoid empty grids
  // This removes that minimum height as per AG Grid documentation
  :deep(.ag-center-cols-viewport) {
    min-height: 75px !important;
  }
  
  // Ensure header and body rows stay aligned during horizontal scroll
  :deep(.ag-header-row),
  :deep(.ag-row) {
    // Use hardware acceleration for better scroll performance
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  
  // Disable transitions on header and body cells during scroll to prevent lag
  // This ensures columns stay aligned during horizontal scrolling
  :deep(.ag-header-cell),
  :deep(.ag-cell) {
    // Only disable transitions on transform/position properties that affect scroll alignment
    // Keep other transitions (like hover effects) intact
    transition-property: background-color, color, border-color, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }
  
  :deep(.ag-cell-wrapper),
  :deep(.ag-cell-value) {
    height: 100%;
  }
  
  :deep(.ag-header-cell) {
    &.-center .ag-header-cell-label {
      justify-content: center;
    }
    &.-right {
      .ag-header-cell-label {
        justify-content: flex-end;
      }
      .ag-header-cell-filter-button {
        margin-left: 4px;
      }
    }
    &.-left .ag-header-cell-label {
      justify-content: flex-start;
    }
  }
  
  // Control z-index of filter menus and floating panels only
  // These are the elements that appear above the grid
  :deep(.ag-popup) {
    z-index: 1000 !important; // Reasonable z-index for filter menus
  }
  
  :deep(.ag-filter-wrapper) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-column-menu) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-filter) {
    z-index: 1000 !important;
  }
  
  :deep(.ag-cell) {
    .ag-cell-value {
      display: flex;
    }

    &.-right {
      .ag-cell-value {
        justify-content: flex-end;
      }
    }
    &.-center {
      .ag-cell-value {
        justify-content: center;
      }
    }
    &.-left {
      .ag-cell-value {
        justify-content: flex-start;
      }
    }
    
    // Remove default padding for select column cells
    &:has(.select-cell) {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    // Suppress focus border effects for cells with suppressRowInteraction (keep background)
    &.-suppress-row-interaction {
      // Override focus and range selection border/outline styling only
      &.ag-cell-focus,
      &.ag-cell-range-selected,
      &:focus,
      &:focus-within {
        outline: none !important;
        box-shadow: none !important;
        border-color: transparent !important;
      }
    }
  }

  // Action focus styling - applies when cell is focused programmatically (not keyboard navigation)
  :deep(.ag-cell-action-focus:not(.-suppress-row-interaction)) {
    // Background highlight for action-focused cell
    background-color: var(--ag-range-selection-background-color, rgba(33, 150, 243, 0.1)) !important;
    
    // Border highlight using box-shadow for clean rendering
    box-shadow: inset 0 0 0 2px var(--ag-range-selection-border-color, var(--ag-active-color, #2196f3)) !important;
    
    // Smooth transition for focus effect
    transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
  }

  // Suppress cell focus border styling for suppress-row-interaction cells (stronger selectors)
  :deep(.ag-cell-focus.-suppress-row-interaction),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-focus),
  :deep(.ag-cell.-suppress-row-interaction.ag-cell-range-selected) {
    outline: none !important;
    box-shadow: none !important;
    border: 1px solid transparent !important;
  }

  // Override AG Grid's range selection border for suppress-row-interaction cells
  :deep(.ag-cell.-suppress-row-interaction) {
    &.ag-cell-range-single-cell,
    &.ag-cell-range-selected-1,
    &.ag-cell-range-selected-2,
    &.ag-cell-range-selected-3,
    &.ag-cell-range-selected-4 {
      border-color: transparent !important;
    }
  }

  // Make editable inputs take full cell width
  :deep(.ag-cell-inline-editing) {
    padding: 0 !important;
    
    .ag-cell-wrapper {
      width: 100%;
      height: 100%;
      padding: 0;
    }
    
    // Default AG Grid text input
    .ag-input-field-input {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Custom cell editors (DateCellEditor, etc.)
    input,
    textarea,
    select {
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box;
      padding: 0 8px; /* Add padding inside input for text readability */
    }
    
    // Cell editor wrapper
    > * {
      width: 100%;
      height: 100%;
    }
  }
  
  /* wwEditor:start */
  &.editing {
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: initial;
      z-index: 10;
    }
  }
  /* wwEditor:end */
}

// ── Column Chooser ───────────────────────────────────────────────────────────

.column-chooser-container {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5;
}

// Trigger button
.column-chooser-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  height: 100%;
  min-height: 28px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--ag-border-color, rgba(255,255,255,0.1));
  border-radius: 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--ag-header-foreground-color, #ccc);
  line-height: 1;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.has-hidden {
    color: var(--ag-active-color, #3b9eff);
  }
}

.cc-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--ag-active-color, #3b9eff);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

// Panel
.cc-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: var(--ww-data-grid_cc-width, 260px);
  background: var(--ww-data-grid_cc-background, var(--ag-background-color, #1e2228));
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Work Sans', sans-serif;

  // Apply Work Sans to all text descendants
  *, *::before, *::after {
    font-family: 'Work Sans', sans-serif;
  }
}

// Header
.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.08)));
}

.cc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  letter-spacing: 0.01em;
}

.cc-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--ag-foreground-color, #9aa0aa);
  padding: 0;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(255,255,255,0.08);
    color: var(--ag-foreground-color, #e8eaed);
  }
}

// Search row (select-all + search input)
.cc-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.06)));
}

.cc-search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ag-control-panel-background-color, rgba(255,255,255,0.06));
  border: 1px solid var(--ag-border-color, rgba(255,255,255,0.1));
  border-radius: 6px;
  padding: 6px 10px;
}

.cc-search-icon {
  color: var(--ag-foreground-color, #9aa0aa);
  flex-shrink: 0;
  opacity: 0.6;
}

.cc-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  width: 100%;

  &::placeholder {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #9aa0aa));
    opacity: 0.5;
  }
}

// Custom checkbox
.cc-checkbox-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.cc-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 4px;
  border: 2px solid var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
  background: transparent;
  position: relative;
  transition: background 0.15s, border-color 0.15s;

  &:checked {
    background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));

    &::after {
      content: '';
      position: absolute;
      left: 3px;
      top: 0px;
      width: 5px;
      height: 9px;
      border: 2px solid #fff;
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
    }
  }

  &:indeterminate {
    background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));

    &::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 50%;
      width: 8px;
      height: 2px;
      background: #fff;
      transform: translateY(-50%);
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

// Column list
.cc-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 0 6px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
  }
}

// Each column row
.cc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  cursor: default;
  transition: background 0.1s;
  border-left: 2px solid transparent;

  &:hover {
    background: rgba(255,255,255,0.05);
  }

  &.cc-row--drag-over {
    border-left-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    background: rgba(59, 158, 255, 0.06);
  }

  &.cc-row--dragging {
    opacity: 0.4;
  }

  &.cc-row--locked {
    opacity: 0.5;
    cursor: default;

    &:hover {
      background: transparent;
    }
  }
}

.cc-checkbox-wrap--locked {
  cursor: default;
  pointer-events: none;
}

.cc-drag-handle {
  display: flex;
  align-items: center;
  color: var(--ag-foreground-color, #9aa0aa);
  opacity: 0.4;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:active {
    cursor: grabbing;
  }

  &.cc-drag-handle--disabled {
    opacity: 0.15;
    cursor: default;
    pointer-events: none;
  }

  .cc-row:hover & {
    opacity: 0.7;
  }
}

.cc-col-name {
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #d8dce3));
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #9aa0aa));
  opacity: 0.6;
  text-align: center;
}

// Fade transition
.cc-fade-enter-active,
.cc-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.cc-fade-enter-from,
.cc-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
