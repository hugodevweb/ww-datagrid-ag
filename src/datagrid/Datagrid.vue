<template>
  <div class="ww-datagrid" :class="{ editing: isEditing, grouped: isGroupingActive, 'ww-datagrid--auto-layout': cfg.layout === 'auto', 'is-compact': isCompactWidth, 'is-mobile': isMobileWidth }" :style="[cssVars, style]" ref="gridContainerRef">
    <!-- Single-grid mode: unchanged behavior -->
    <ag-grid-vue
      v-if="!isGroupingActive"
      :components="gridComponents"
      :rowData="rowData"
      :columnDefs="columnDefs"
      :initial-state="initialState"
      :defaultColDef="defaultColDef"
      :dataTypeDefinitions="dataTypeDefinitions"
      :domLayout="cfg.layout === 'auto' ? 'autoHeight' : 'normal'"
      :style="cfg.layout !== 'auto' ? { height: '100%' } : {}"
      :rowSelection="rowSelection"
      :selection-column-def="{ pinned: !isMobileWidth }"
      :theme="theme"
      :getRowId="getRowId"
      :popup-parent="popupParent"
      :pagination="paginationEnabled"
      :paginationPageSize="
        forcedPaginationPageSize
          ? 0
          : paginationPageSizeSelector
          ? paginationPageSizeSelector[0]
          : cfg.paginationPageSize
      "
      :paginationPageSizeSelector="paginationPageSizeSelector"
      :suppressMovableColumns="!cfg.movableColumns"
      :columnHoverHighlight="cfg.columnHoverHighlight"
      :locale-text="localeText"
      :invalidEditValueMode="invalidEditValueMode"
      :getRowStyle="rowStyle"
      enableCellTextSelection
      ensureDomOrder
      row-drag-managed
      :rowBuffer="cfg.rowBuffer ?? 25"
      :rowHeight="cfg.rowHeight ?? 40"
      :suppressRowVirtualisation="false"
      :animateRows="true"
      :debounceVerticalScrollbar="false"
      :suppressScrollOnNewData="true"
      @grid-ready="onGridReady"
      @row-selected="onRowSelected"
      @selection-changed="onSelectionChanged"
      @cell-value-changed="onCellValueChanged"
      @cell-edit-request="onCellEditRequest"
      @cell-editing-started="onCellEditingStarted"
      @cell-editing-stopped="onCellEditingStopped"
      @row-editing-started="onRowEditingStarted"
      @row-editing-stopped="onRowEditingStopped"
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

    <!-- Multi-grid mode: one grid per group, collapsible, drag-reorderable.
         Group-wide actions (collapse all / expand all / reorder) now live in
         the column-chooser panel's Grouping tab. -->
    <template v-else>
      <div
        v-for="group in orderedGroups"
        :key="group.value"
        class="ww-group"
        :data-group-value="group.value"
        :style="{ '--group-color': group.color }"
        :class="{
          'ww-group--dragging': groupDragValue === group.value,
          'ww-group--drag-over': groupDragOverValue === group.value && groupDragValue !== group.value,
          'ww-group--collapsed': group.collapsed,
        }"
      >
        <div
          class="ww-group__header"
          :style="{ '--group-color': group.color }"
          :draggable="true"
          @dragstart="onGroupDragStart(group.value)"
          @dragover.prevent="onGroupDragOver(group.value)"
          @drop.prevent="onGroupDrop(group.value)"
          @dragend="onGroupDragEnd"
          @click.self="toggleGroupCollapsed(group.value)"
        >
          <button
            type="button"
            class="ww-group__chevron"
            :class="{ 'ww-group__chevron--open': !group.collapsed }"
            @click.stop="toggleGroupCollapsed(group.value)"
            :aria-expanded="!group.collapsed"
            :aria-label="group.collapsed ? 'Expand group' : 'Collapse group'"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="ww-group__title-block" @click.stop="toggleGroupCollapsed(group.value)">
            <span class="ww-group__label">{{ group.label }}</span>
            <span
              v-if="group.count !== null && group.count !== undefined"
              class="ww-group__items"
            >{{ formatItemCount(group.count) }}</span>
          </div>
        </div>

        <ag-grid-vue
          v-if="!group.collapsed"
          :components="gridComponents"
          :rowData="groupRowData(group.value)"
          :alignedGrids="alignedGridApisForGroup"
          :columnDefs="columnDefs"
          :defaultColDef="defaultColDef"
          :dataTypeDefinitions="dataTypeDefinitions"
          domLayout="autoHeight"
          class="ww-group__grid"
          :rowSelection="rowSelection"
          :selection-column-def="{ pinned: !isMobileWidth }"
          :theme="theme"
          :getRowId="getRowId"
          :popup-parent="popupParent"
          :context="{ groupValue: group.value }"
          :rowClassRules="groupRowClassRules"
          :pagination="paginationEnabled"
          :paginationPageSize="
            forcedPaginationPageSize
              ? 0
              : paginationPageSizeSelector
              ? paginationPageSizeSelector[0]
              : cfg.paginationPageSize
          "
          :paginationPageSizeSelector="paginationPageSizeSelector"
          :suppressMovableColumns="!cfg.movableColumns"
          :columnHoverHighlight="cfg.columnHoverHighlight"
          :locale-text="localeText"
          :invalidEditValueMode="invalidEditValueMode"
          :getRowStyle="rowStyle"
          enableCellTextSelection
          ensureDomOrder
          :row-drag-managed="true"
          :suppressMoveWhenRowDragging="false"
          :rowBuffer="cfg.rowBuffer ?? 25"
          :rowHeight="cfg.rowHeight ?? 40"
          :suppressRowVirtualisation="false"
          :animateRows="true"
          :debounceVerticalScrollbar="false"
          :suppressScrollOnNewData="true"
          @grid-ready="(p) => onGroupGridReady(group.value, p)"
          @vue:unmounted="() => onGroupGridUnmounted(group.value)"
          @row-selected="(e) => onGroupRowSelected(group.value, e)"
          @selection-changed="(e) => onGroupSelectionChanged(group.value, e)"
          @cell-value-changed="onCellValueChanged"
          @cell-edit-request="onCellEditRequest"
          @cell-editing-started="onCellEditingStarted"
          @cell-editing-stopped="onCellEditingStopped"
          @row-editing-started="onRowEditingStarted"
          @row-editing-stopped="onRowEditingStopped"
          @filter-changed="(e) => onGroupFilterChanged(group.value, e)"
          @sort-changed="(e) => onGroupSortChanged(group.value, e)"
          @pagination-changed="onPaginationChanged"
          @row-clicked="onRowClicked"
          @column-moved="(e) => onGroupColumnMoved(group.value, e)"
          @column-resized="(e) => onGroupColumnResized(group.value, e)"
          @body-scroll="(e) => onGroupBodyScrollWrapper(group.value, e)"
          @first-data-rendered="onFirstDataRendered"
          @model-updated="onModelUpdated"
        >
        </ag-grid-vue>

        <!-- Invisible sentinel observed by the IntersectionObserver wired in
             useGrouping.observeGroupLoadMoreSentinel — when it enters a
             viewport-bottom margin the next paged-append block is fetched
             for this group. Per-group grids run with domLayout="autoHeight"
             so their bodies don't scroll; the sentinel sits OUTSIDE the grid
             and rides the outer .ww-datagrid scroll context. -->
        <div
          v-if="!group.collapsed"
          class="ww-group__load-more-sentinel"
          :data-group-value="group.value"
        ></div>
      </div>

      <div
        ref="groupHorizontalScrollRef"
        class="ww-group__hscroll"
        v-show="hasGroupHorizontalOverflow"
        @scroll="onGroupHorizontalScrollbarScroll"
      >
        <div
          class="ww-group__hscroll-spacer"
          :style="{
            width: groupHorizontalScrollWidth + 'px',
            marginLeft: groupHorizontalScrollLeft + 'px',
          }"
        ></div>
      </div>

    </template>

    <Transition name="group-loading-fade">
      <div
        v-if="isGroupingTransitionLoading"
        class="ww-group-loading-overlay"
        role="status"
        aria-live="polite"
      >
        <div class="ww-group-loading-card">
          <span class="ww-group-loading-spinner" aria-hidden="true"></span>
          <span>{{ getTranslations(cfg?.lang || 'en').loadingGroups || 'Loading groups...' }}</span>
        </div>
      </div>
    </Transition>

    <div v-if="(cfg.allowColumnHiding || cfg.enableFilterBuilder) && !isEditing" ref="columnChooserRef" class="column-chooser-container">
      <Transition name="cc-fade">
        <div v-if="showColumnChooser" class="cc-panel" @click.stop>
          <!-- Header -->
          <div class="cc-header">
            <span class="cc-title">{{ getTranslations(cfg?.lang || 'en').manageColumns }}</span>
            <button class="cc-close-btn" @click="showColumnChooser = false" aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="cc-tabs" role="tablist">
            <button
              v-if="cfg.allowColumnHiding"
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'columns' }"
              role="tab"
              :aria-selected="activeChooserTab === 'columns'"
              @click="activeChooserTab = 'columns'"
            >
              {{ getTranslations(cfg?.lang || 'en').columnsTab }}
            </button>
            <button
              v-if="cfg.allowColumnHiding"
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'grouping' }"
              role="tab"
              :aria-selected="activeChooserTab === 'grouping'"
              @click="activeChooserTab = 'grouping'"
            >
              {{ getTranslations(cfg?.lang || 'en').groupingTab }}
            </button>
            <button
              v-if="cfg.enableFilterBuilder"
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'filters' }"
              role="tab"
              :aria-selected="activeChooserTab === 'filters'"
              @click="activeChooserTab = 'filters'"
            >
              {{ getTranslations(cfg?.lang || 'en').filtersTab || 'Filters' }}
            </button>
            <button
              v-if="cfg.allowColumnHiding"
              type="button"
              class="cc-tab"
              :class="{ 'cc-tab--active': activeChooserTab === 'styling' }"
              role="tab"
              :aria-selected="activeChooserTab === 'styling'"
              @click="activeChooserTab = 'styling'"
            >
              {{ getTranslations(cfg?.lang || 'en').stylingTab || 'Styling' }}
            </button>
          </div>

          <!-- Tab: Columns -->
          <template v-if="activeChooserTab === 'columns'">
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
                  :placeholder="getTranslations(cfg?.lang || 'en').search"
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
                {{ getTranslations(cfg?.lang || 'en').noColumnsMatch.replace('{searchTerm}', columnChooserSearch) }}
              </div>
            </div>
          </template>

          <!-- Tab: Grouping -->
          <template v-else-if="activeChooserTab === 'grouping'">
            <!-- Group-by selector -->
            <div class="cc-group-select-row">
              <label class="cc-group-select-label">{{ getTranslations(cfg?.lang || 'en').groupBy }}</label>
              <select
                class="cc-group-select"
                :value="pendingGroupingColumnId !== null ? pendingGroupingColumnId : (groupingState?.columnId || '')"
                :disabled="selectableGroupingColumns.length === 0 || isGroupingTransitionLoading"
                @change="setGroupingColumn($event.target.value || null)"
              >
                <option value="">{{ getTranslations(cfg?.lang || 'en').noGrouping }}</option>
                <option
                  v-for="opt in selectableGroupingColumns"
                  :key="opt.field"
                  :value="opt.field"
                >{{ opt.displayName }}</option>
              </select>
              <span v-if="isGroupingTransitionLoading" class="cc-group-loading-dot" aria-hidden="true"></span>
            </div>

            <!-- Collapse / expand all + group ordering -->
            <template v-if="isGroupingActive && orderedGroups.length > 0">
              <div class="cc-group-actions">
                <button
                  type="button"
                  class="cc-group-action-btn"
                  @click="collapseAllGroups"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ getTranslations(cfg?.lang || 'en').collapseAll }}</span>
                </button>
                <button
                  type="button"
                  class="cc-group-action-btn"
                  @click="expandAllGroups"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="transform: rotate(-90deg);">
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ getTranslations(cfg?.lang || 'en').expandAll }}</span>
                </button>
              </div>

              <label class="cc-group-toggle-row">
                <input
                  type="checkbox"
                  class="cc-checkbox"
                  :checked="groupingState?.showUnassigned !== false"
                  @change="setShowUnassigned($event.target.checked)"
                />
                <span class="cc-group-toggle-label">{{ getTranslations(cfg?.lang || 'en').showUnassigned }}</span>
              </label>

              <div class="cc-group-list-label">{{ getTranslations(cfg?.lang || 'en').groupsOrder }}</div>
              <div class="cc-group-list">
                <div
                  v-for="group in orderedGroups"
                  :key="group.value"
                  class="cc-group-row"
                  :class="{
                    'cc-group-row--drag-over': groupDragOverValue === group.value && groupDragValue !== group.value,
                    'cc-group-row--dragging': groupDragValue === group.value,
                  }"
                  draggable="true"
                  @dragstart="onGroupDragStart(group.value)"
                  @dragover.prevent="onGroupDragOver(group.value)"
                  @drop.prevent="onGroupDrop(group.value)"
                  @dragend="onGroupDragEnd"
                >
                  <span class="cc-group-row__swatch" :style="{ backgroundColor: group.color }"></span>
                  <span class="cc-drag-handle">
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                      <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                      <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                    </svg>
                  </span>
                  <span class="cc-group-row__label">{{ group.label }}</span>
                  <span v-if="group.count !== null && group.count !== undefined" class="cc-group-row__count">{{ group.count }}</span>
                </div>
              </div>
            </template>

            <!-- Empty state: no select columns -->
            <div v-else-if="selectableGroupingColumns.length === 0" class="cc-empty">
              {{ getTranslations(cfg?.lang || 'en').noSelectColumns }}
            </div>
          </template>

          <!-- Tab: Filters (Filter Builder) -->
          <template v-else-if="activeChooserTab === 'filters'">
            <FilterBuilder
              :columns="filterBuilderColumns"
              :model-value="normalizedAdvancedFilters"
              :data-source="cfg.dataSource"
              @update:model-value="setAdvancedFilters"
            />
          </template>

          <!-- Tab: Conditional Styling -->
          <template v-else-if="activeChooserTab === 'styling'">
            <div class="cc-styling-actions">
              <button type="button" class="cc-styling-add-btn" @click="addUserRule()">
                + {{ getTranslations(cfg?.lang || 'en').addRule || 'Add rule' }}
              </button>
            </div>

            <div v-if="!userRules || userRules.length === 0" class="cc-empty">
              {{ getTranslations(cfg?.lang || 'en').noRulesYet || 'No rules yet. Add one to color rows based on their content.' }}
            </div>

            <div v-else class="cc-styling-list">
              <div
                v-for="(rule, ruleIdx) in userRules"
                :key="rule.id"
                class="cc-styling-rule"
                :class="{
                  'cc-styling-rule--drag-over': userRuleDragOverId === rule.id && userRuleDragId !== rule.id,
                  'cc-styling-rule--dragging': userRuleDragId === rule.id,
                }"
                :draggable="userRuleDragId === null || userRuleDragId === rule.id"
                @dragstart="onUserRuleDragStart(rule.id)"
                @dragover.prevent="onUserRuleDragOver(rule.id)"
                @drop.prevent="onUserRuleDrop(rule.id)"
                @dragend="onUserRuleDragEnd"
              >
                <div class="cc-styling-rule-header" @click="toggleRuleExpanded(rule.id)">
                  <span class="cc-drag-handle">
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                      <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
                      <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                      <circle cx="3" cy="12" r="1.5"/><circle cx="9" cy="12" r="1.5"/>
                    </svg>
                  </span>
                  <span
                    class="cc-styling-rule-swatch"
                    :style="{
                      backgroundColor: rule.backgroundColor || 'transparent',
                      color: rule.textColor || 'inherit',
                      fontWeight: rule.bold ? 'bold' : 'normal',
                      fontStyle: rule.italic ? 'italic' : 'normal',
                    }"
                  >Aa</span>
                  <span class="cc-styling-rule-name">
                    {{ rule.label || ((getTranslations(cfg?.lang || 'en').ruleN || 'Rule {n}').replace('{n}', ruleIdx + 1)) }}
                  </span>
                  <button
                    type="button"
                    class="cc-styling-rule-delete"
                    :aria-label="getTranslations(cfg?.lang || 'en').deleteRule || 'Delete rule'"
                    @click.stop="deleteUserRule(rule.id)"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>

                <div v-if="expandedRuleIds.has(rule.id)" class="cc-styling-rule-body" @click.stop>
                  <!-- Label -->
                  <label class="cc-styling-field">
                    <span class="cc-styling-field-label">{{ getTranslations(cfg?.lang || 'en').ruleLabel || 'Rule name' }}</span>
                    <input
                      type="text"
                      class="cc-styling-input"
                      :value="rule.label"
                      @input="updateUserRule(rule.id, { label: $event.target.value })"
                    />
                  </label>

                  <!-- Conditions -->
                  <div class="cc-styling-field">
                    <span class="cc-styling-field-label">{{ getTranslations(cfg?.lang || 'en').conditions || 'Conditions' }}</span>
                    <div
                      v-for="(cond, cIdx) in rule.conditions"
                      :key="cIdx"
                      class="cc-styling-condition-wrap"
                    >
                      <div class="cc-styling-condition">
                        <select
                          class="cc-styling-select"
                          :value="cond.field"
                          @change="updateUserCondition(rule.id, cIdx, { field: $event.target.value })"
                        >
                          <option value="" disabled>{{ getTranslations(cfg?.lang || 'en').pickColumn || 'Select a column' }}</option>
                          <option
                            v-for="opt in userRuleColumnOptions"
                            :key="opt.field"
                            :value="opt.field"
                          >{{ opt.headerName }}</option>
                        </select>
                        <select
                          class="cc-styling-select"
                          :value="cond.operator"
                          @change="onOperatorChange(rule.id, cIdx, $event.target.value)"
                        >
                          <option
                            v-for="op in getOperatorsForField(cond.field)"
                            :key="op.key"
                            :value="op.key"
                          >{{ op.label }}</option>
                        </select>
                        <!-- Value input — varies by column kind + operator -->
                        <template v-if="getValueInputKind(cond) === 'picker'">
                          <button
                            type="button"
                            class="cc-styling-input cc-styling-input--value cc-styling-picker-toggle"
                            :class="{ 'cc-styling-picker-toggle--open': isPickerOpen(rule.id, cIdx), 'cc-styling-picker-toggle--placeholder': !Array.isArray(cond.value) || cond.value.length === 0 }"
                            @click="togglePicker(rule.id, cIdx)"
                          >
                            <span class="cc-styling-picker-summary">{{ pickerSummary(cond) }}</span>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="cc-styling-picker-chevron">
                              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          </button>
                        </template>
                        <template v-else-if="getValueInputKind(cond) === 'date'">
                          <input
                            v-if="!isPlaceholderToken(cond.value)"
                            type="date"
                            class="cc-styling-input cc-styling-input--value"
                            :value="cond.value"
                            @input="updateUserCondition(rule.id, cIdx, { value: $event.target.value })"
                          />
                          <span v-else class="cc-styling-input cc-styling-input--value cc-styling-token">
                            <span class="cc-styling-token-glyph" v-html="placeholderGlyphHtml(cond.value)"></span>{{ placeholderDisplayName(cond.value) }}
                            <button type="button" class="cc-styling-token-x" @click="updateUserCondition(rule.id, cIdx, { value: '' })" aria-label="Clear">×</button>
                          </span>
                          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateUserCondition(rule.id, cIdx, { value: $event })" />
                          <DatePlaceholderMenu @select="updateUserCondition(rule.id, cIdx, { value: $event })" />
                        </template>
                        <template v-else-if="getValueInputKind(cond) === 'number'">
                          <input
                            v-if="!isPlaceholderToken(cond.value)"
                            type="number"
                            class="cc-styling-input cc-styling-input--value"
                            :value="cond.value"
                            :placeholder="getTranslations(cfg?.lang || 'en').value || 'Value'"
                            @input="updateUserCondition(rule.id, cIdx, { value: $event.target.value })"
                          />
                          <span v-else class="cc-styling-input cc-styling-input--value cc-styling-token">
                            <span class="cc-styling-token-glyph" v-html="placeholderGlyphHtml(cond.value)"></span>{{ placeholderDisplayName(cond.value) }}
                            <button type="button" class="cc-styling-token-x" @click="updateUserCondition(rule.id, cIdx, { value: '' })" aria-label="Clear">×</button>
                          </span>
                          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateUserCondition(rule.id, cIdx, { value: $event })" />
                        </template>
                        <template v-else-if="getValueInputKind(cond) === 'text'">
                          <input
                            v-if="!isPlaceholderToken(cond.value)"
                            type="text"
                            class="cc-styling-input cc-styling-input--value"
                            :value="cond.value"
                            :placeholder="getTranslations(cfg?.lang || 'en').value || 'Value'"
                            @input="updateUserCondition(rule.id, cIdx, { value: $event.target.value })"
                          />
                          <span v-else class="cc-styling-input cc-styling-input--value cc-styling-token">
                            <span class="cc-styling-token-glyph" v-html="placeholderGlyphHtml(cond.value)"></span>{{ placeholderDisplayName(cond.value) }}
                            <button type="button" class="cc-styling-token-x" @click="updateUserCondition(rule.id, cIdx, { value: '' })" aria-label="Clear">×</button>
                          </span>
                          <PlaceholderMenu :kind="placeholderKind(cond)" @select="updateUserCondition(rule.id, cIdx, { value: $event })" />
                        </template>
                        <button
                          type="button"
                          class="cc-styling-condition-delete"
                          :disabled="rule.conditions.length <= 1"
                          :aria-label="getTranslations(cfg?.lang || 'en').deleteCondition || 'Remove condition'"
                          @click="deleteUserCondition(rule.id, cIdx)"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                      <!-- Inline picker (in normal flow so it scrolls with the panel) -->
                      <div v-if="getValueInputKind(cond) === 'picker' && isPickerOpen(rule.id, cIdx)" class="cc-styling-picker-inline" @click.stop>
                        <FilterValuePicker
                          :column="getColumnDef(cond.field) || {}"
                          :model-value="Array.isArray(cond.value) ? cond.value : []"
                          @update:model-value="updateUserCondition(rule.id, cIdx, { value: $event })"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      class="cc-styling-add-condition-btn"
                      @click="addUserCondition(rule.id)"
                    >+ {{ getTranslations(cfg?.lang || 'en').addCondition || 'Add condition' }}</button>
                  </div>

                  <!-- Style controls -->
                  <div class="cc-styling-row cc-styling-row--colors">
                    <label class="cc-styling-color-field">
                      <span class="cc-styling-field-label">{{ getTranslations(cfg?.lang || 'en').backgroundColorLabel || 'Background' }}</span>
                      <span class="cc-styling-color-control">
                        <span
                          class="cc-styling-color-swatch"
                          :class="{ 'cc-styling-color-swatch--empty': !rule.backgroundColor }"
                          :style="{ backgroundColor: rule.backgroundColor || 'transparent' }"
                        ></span>
                        <span class="cc-styling-color-value">{{ rule.backgroundColor || (getTranslations(cfg?.lang || 'en').noneShort || 'None') }}</span>
                        <input
                          type="color"
                          class="cc-styling-color-input"
                          :value="rule.backgroundColor || '#ffffff'"
                          :aria-label="getTranslations(cfg?.lang || 'en').backgroundColorLabel || 'Background'"
                          @input="updateUserRule(rule.id, { backgroundColor: $event.target.value })"
                        />
                        <button
                          v-if="rule.backgroundColor"
                          type="button"
                          class="cc-styling-clear-color"
                          :aria-label="getTranslations(cfg?.lang || 'en').clear || 'Clear'"
                          @click.stop.prevent="updateUserRule(rule.id, { backgroundColor: '' })"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </span>
                    </label>
                    <label class="cc-styling-color-field">
                      <span class="cc-styling-field-label">{{ getTranslations(cfg?.lang || 'en').textColorLabel || 'Text' }}</span>
                      <span class="cc-styling-color-control">
                        <span
                          class="cc-styling-color-swatch"
                          :class="{ 'cc-styling-color-swatch--empty': !rule.textColor }"
                          :style="{ backgroundColor: rule.textColor || 'transparent' }"
                        ></span>
                        <span class="cc-styling-color-value">{{ rule.textColor || (getTranslations(cfg?.lang || 'en').noneShort || 'None') }}</span>
                        <input
                          type="color"
                          class="cc-styling-color-input"
                          :value="rule.textColor || '#000000'"
                          :aria-label="getTranslations(cfg?.lang || 'en').textColorLabel || 'Text'"
                          @input="updateUserRule(rule.id, { textColor: $event.target.value })"
                        />
                        <button
                          v-if="rule.textColor"
                          type="button"
                          class="cc-styling-clear-color"
                          :aria-label="getTranslations(cfg?.lang || 'en').clear || 'Clear'"
                          @click.stop.prevent="updateUserRule(rule.id, { textColor: '' })"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </span>
                    </label>
                  </div>

                  <div class="cc-styling-field">
                    <span class="cc-styling-field-label">{{ getTranslations(cfg?.lang || 'en').styleLabel || 'Style' }}</span>
                    <div class="cc-styling-toggle-group">
                      <button
                        type="button"
                        class="cc-styling-toggle-btn"
                        :class="{ 'cc-styling-toggle-btn--active': rule.bold }"
                        :aria-pressed="rule.bold"
                        :aria-label="getTranslations(cfg?.lang || 'en').boldLabel || 'Bold'"
                        @click="updateUserRule(rule.id, { bold: !rule.bold })"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="cc-styling-toggle-btn"
                        :class="{ 'cc-styling-toggle-btn--active': rule.italic }"
                        :aria-pressed="rule.italic"
                        :aria-label="getTranslations(cfg?.lang || 'en').italicLabel || 'Italic'"
                        @click="updateUserRule(rule.id, { italic: !rule.italic })"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <line x1="19" x2="10" y1="4" y2="4"/>
                          <line x1="14" x2="5" y1="20" y2="20"/>
                          <line x1="15" x2="9" y1="4" y2="20"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <!-- Create record form popup — teleported to body so it covers the full page -->
    <Teleport :to="createPopupTeleportTarget" v-if="activeCreateColumnField !== null && createPopupTeleportTarget">
      <div
        class="record-create-overlay"
        @click.self="closeCreateRecordForm()"
      >
        <div class="record-create-popup">
          <div class="record-create-popup-header">
            <span class="record-create-popup-title">Créer une fiche</span>
            <button class="record-create-popup-close" @click="closeCreateRecordForm()" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="record-create-popup-body">
            <wwLayoutItemContext
              is-repeat
              :index="0"
              :item="{ row: activeCreateRow, rowId: activeCreateRowId, columnField: activeCreateColumnField }"
              :data="{ row: activeCreateRow, rowId: activeCreateRowId, columnField: activeCreateColumnField }"
            >
              <wwLayout path="createRecordDropzone" direction="column" />
            </wwLayoutItemContext>
          </div>
        </div>
      </div>
    </Teleport>
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
  onMounted,
  onBeforeUnmount,
  isRef,
  markRaw,
} from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import {
  AG_GRID_LOCALE_EN,
  AG_GRID_LOCALE_FR,
  AG_GRID_LOCALE_DE,
  AG_GRID_LOCALE_ES,
  AG_GRID_LOCALE_PT,
} from "@ag-grid-community/locale";
import ActionCellRenderer from "./components/ActionCellRenderer.js";
import ImageCellRenderer from "./components/ImageCellRenderer.js";
import NavigationCellRenderer from "./components/NavigationCellRenderer.js";
import WewebCellRenderer from "./components/WewebCellRenderer.vue";
import SelectCellRenderer from "./components/SelectCellRenderer.vue";
import SelectFilterComponent from "./components/SelectFilterComponent.vue";
import SelectFilterWrapper from "./components/SelectFilterWrapper.js";
import DateCellEditor from "./components/DateCellEditor.vue";
import UserCellRenderer from "./components/UserCellRenderer.vue";
import RecordCellRenderer from "./components/RecordCellRenderer.vue";
import UserFilterComponent from "./components/UserFilterComponent.vue";
import UserFilterWrapper from "./components/UserFilterWrapper.js";
import RecordFilterWrapper from "./components/RecordFilterWrapper.js";
import PhoneCellRenderer from "./components/PhoneCellRenderer.vue";
import EmailCellRenderer from "./components/EmailCellRenderer.vue";
import PhoneCellEditor from "./components/PhoneCellEditor.vue";
import {
  clearAllCaches,
  createValidationFunction,
  createActionColumnDef,
  createCustomColumnDef,
  createDateColumnDef,
  createCurrencyColumnDef,
  createImageColumnDef,
  createValueSetter,
  createSelectLabelGetter,
  createUserNameGetter,
  createUserIdsExtractor,
} from "./utils/columnFactories.js";
import {
  findRowNode,
  getAvailableRowIds
} from "./utils/rowLookup.js";
import {
  getTranslations,
  getFilterTranslations,
  extractUserIds,
  getUserName,
  findUserIdByName,
  createFakeJunctionRecord,
  normalizeUserColumnOldValue,
  valuesEqual,
  createCacheKey,
  debounce,
  readViewConfiguration
} from "../shared/utils/sharedHelpers.js";
import {
  fetchSupabaseDataPaginated,
  fetchSupabaseDataInfinite,
  fetchSupabaseDataCount,
  createFetchKey
} from "../shared/utils/supabaseUtils.js";
import {
  applyTextFilter,
  applyNumberFilter,
  applyDateFilter,
  applyBooleanFilter,
  applySelectFilter,
  applyUserFilter,
  applySetFilter,
  convertSingleFilterToSupabase
} from "./utils/filterUtils.js";
import {
  detectColumnConfig,
  processUserColumnChange,
  shouldRedrawForStyles,
  emitCellValueChangedEvent,
  manageDataUpdateFlag,
  processValueByType,
  getRowId
} from "./utils/cellValueUtils.js";
import {
  getSupabaseFilterField as _getSupabaseFilterField,
  getSupabaseSortField as _getSupabaseSortField,
  findColumnByField as _findColumnByField,
  findUserColumn as _findUserColumn,
} from "./utils/supabaseFieldMappings.js";
import { convertFilterToSupabase as _convertFilterToSupabase } from "./utils/convertFilterToSupabase.js";
import {
  conditionsToAgGridFilterModel,
  agGridFilterModelToConditions,
} from "../shared/utils/convertConditionsToSupabase.js";
import { useAdvancedFilters } from "../shared/composables/useAdvancedFilters.js";
import FilterBuilder from "../shared/components/FilterBuilder.vue";
import FilterValuePicker from "../shared/components/FilterValuePicker.vue";
import PlaceholderMenu from "../shared/components/PlaceholderMenu.vue";
import DatePlaceholderMenu from "../shared/components/DatePlaceholderMenu.vue";
import { isPlaceholderToken, placeholderDisplayName, placeholderGlyphHtml } from "../shared/utils/placeholders.js";
import { getVarByName } from "../shared/utils/wwVariables.js";
import { useGridApi } from "./composables/useGridApi.js";
import { useSelection } from "./composables/useSelection.js";
import { useDataFetch, isDirectAdvancedCondition } from "./composables/useDataFetch.js";
import { useFiltersAndSort } from "./composables/useFiltersAndSort.js";
import { useInfiniteScroll } from "./composables/useInfiniteScroll.js";
import { useGrouping } from "./composables/useGrouping.js";
import { useViewConfig } from "./composables/useViewConfig.js";
import { useColumnState } from "./composables/useColumnState.js";
import { useColumnChooser } from "./composables/useColumnChooser.js";
import { useUserConditionalStyles } from "./composables/useUserConditionalStyles.js";
import { OPERATORS, getOperatorsForType, operatorNeedsValue, operatorIsMulti, normalizeColumnKind, getOperatorLabel } from "./utils/conditionStyleHelpers.js";
import { useCellEditing } from "./composables/useCellEditing.js";
import { useGridActions } from "./composables/useGridActions.js";
import { useResponsive } from "../shared/composables/useResponsive.js";

// TODO: maybe register less modules
// TODO: maybe register modules per grid instead of globally
ModuleRegistry.registerModules([AllCommunityModule]);

export default {
  components: {
    AgGridVue,
    // ActionCellRenderer and ImageCellRenderer are AG Grid JS class
    // renderers (not Vue components); they're registered via the
    // `gridComponents` prop on <ag-grid-vue>, not via Vue's component
    // lookup, so they don't belong in this map.
    WewebCellRenderer,
    SelectCellRenderer,
    SelectFilterComponent,
    UserCellRenderer,
    RecordCellRenderer,
    PhoneCellRenderer,
    PhoneCellEditor,
    EmailCellRenderer,
    UserFilterComponent,
    FilterBuilder,
    FilterValuePicker,
    PlaceholderMenu,
    DatePlaceholderMenu,
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
  emits: ["trigger-event", "update:content", "update:content:effect"],
  setup(props, ctx) {
    const { resolveMappingFormula } = wwLib.wwFormula.useFormula();

    // Merged config: baseConfig keys override per-instance content (same logic as Options API cfg)
    const cfg = computed(() => {
      // viewConfiguration is no longer a bindable prop — it is read directly from
      // a hardcoded WeWeb variable and always overrides any content/baseConfig value.
      const viewConfiguration = readViewConfiguration();
      const content = props.content;
      if (!content || typeof content !== 'object') return { ...(content ?? {}), viewConfiguration };
      const base = content.baseConfig;
      const excludes = content.baseConfigExcludes;
      if (!base || typeof base !== 'object') return { ...content, viewConfiguration };
      const excludeSet = new Set(Array.isArray(excludes) ? excludes : []);
      excludeSet.add('baseConfig');
      excludeSet.add('baseConfigExcludes');
      const merged = { ...content };
      for (const key of Object.keys(base)) {
        if (!excludeSet.has(key)) merged[key] = base[key];
      }
      merged.viewConfiguration = viewConfiguration;
      return merged;
    });

    // Use shared translation utility

    // Foundation: grid API, queue, ready/rendering flags, debug logging, gridMonitor
    const {
      debugLog,
      gridMonitor,
      gridApi,
      gridApiQueue,
      gridApiUtils,
      gridReady,
      dataRendered,
      dataLoadingTimeout,
      isGridRendering,
      safeGridApiCall,
      waitForGridReady,
      waitForRowInGridLocal,
    } = useGridApi(cfg, props, resolveMappingFormula);

    // Navigation column context — the workflow id, tab formula, and message
    // count resolver are top-level grid props (one nav column per view), so we
    // build them once here and hand the bundle to useCellEditing for the
    // per-row colDef factory to consume. The focus-row source is the grid's
    // existing `focusedRowId` config (Selection group), so binding one
    // workspace variable drives both the row scroll-into-view focus and the
    // navigation button focus styling.
    const NAVIGATION_TAB_FORMULA = {
      type: "f",
      // Inlined from the former global formula (id ec0f4ece…, whose name is
      // stripped at runtime so formulas['name']() can't be used). References the
      // `recordTab` app variable BY NAME so it survives project duplication.
      code: "wwFormulas.getKeyValue(variables['recordTab'],globalContext.page?.['id'])||0",
    };
    // App variable (array of the focused record's chat messages) read by name.
    const RECORD_MESSAGES_VARIABLE_NAME = "recordMessages";
    const navigationFocusRowId = computed(() => cfg.value.focusedRowId);
    // The focused record's chat badge mirrors the live `recordMessages` app
    // variable (the open record's message list) so realtime inserts update the
    // count instantly. Read BY NAME — see wwVariables.js: the reactive bag
    // auto-unwraps the variable's computed ref, so reading it inside this
    // computed tracks its deps and the count stays reactive. Referenced by name
    // (not id) so it survives WeWeb project duplication.
    const recordMessagesCount = computed(() => {
      const v = getVarByName(RECORD_MESSAGES_VARIABLE_NAME);
      return Array.isArray(v) ? v.length : 0;
    });
    const navContext = {
      focusRowId: navigationFocusRowId,
      resolveTab: () =>
        Number(resolveMappingFormula(NAVIGATION_TAB_FORMULA) ?? 0),
      resolveMessageCount: (rowData, rowId) => {
        // For the focused record, the badge reflects the live `recordMessages`
        // count; every other row keeps its per-row formula/fallback count.
        const focusRowId = navigationFocusRowId.value;
        if (
          focusRowId != null && focusRowId !== "" &&
          rowId != null &&
          String(focusRowId) === String(rowId)
        ) {
          return recordMessagesCount.value;
        }
        const formula = cfg.value.navigationMessageCountFormula;
        if (formula) {
          const override = resolveMappingFormula(formula, rowData);
          if (override != null && override !== "") return Number(override) || 0;
        }
        return rowData?.conversation?.messages?.length ?? 0;
      },
      // Emit the navigate trigger event; wire it to "open record" in the editor.
      onNavigate: (payload) =>
        ctx.emit("trigger-event", { name: "navigate", event: payload }),
    };

    // Refresh only the navigation column cells in place (no full grid repaint,
    // no Vue remount). The renderer's refresh() pulls fresh focusRowId /
    // tabValue / messageCount from cellRendererParams (a function), so focus
    // styling and the chat badge update on the matching rows instantly.
    const refreshNavigationCells = () => {
      if (!gridApi.value) return;
      // Mirror the colId logic in createNavigationColumnDef so refreshCells
      // can locate the column whether or not the user set a `field`.
      const navColIds = (cfg.value.columns || [])
        .filter((c) => c?.cellDataType === "navigation")
        .map((c) => c.field || `navigation-${c.headerName || "col"}`);
      if (navColIds.length) {
        try {
          gridApi.value.refreshCells({ columns: navColIds, force: true });
        } catch (e) {
          // ignore — grid may be tearing down
        }
      }
    };
    // Move focus styling to the newly focused row.
    watch(navigationFocusRowId, refreshNavigationCells, { flush: "post" });
    // Realtime chat badge: when the focused record's `recordMessages` array
    // changes (e.g. a new message arrives), repaint the nav column so the
    // focused row's badge reflects the new count.
    watch(recordMessagesCount, refreshNavigationCells, { flush: "post" });

    // Helper to check if a viewConfiguration value is effectively empty
    // Returns true if value is null, undefined, empty object {}, or empty array []
    const isEmptyConfigValue = (value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    };

    const findColumnByField = (columnId) => _findColumnByField(props.content, columnId);

    // Selection: selectedRows variable + row selection / drag event handlers
    const {
      selectedRows,
      setSelectedRows,
      onRowSelected,
      onRowDragged,
      onRowDragEnter,
      onSelectionChanged,
    } = useSelection(props, ctx, { gridApi });

    // Composable: advanced (Filter Builder) state — the `advancedFilters`
    // component variable shared across grid/kanban/calendar. Created before
    // useDataFetch so the OR-mode getter can be injected into the fetch path.
    const {
      setAdvancedFilters,
      normalizedAdvancedFilters,
    } = useAdvancedFilters(props, { getDefault: () => cfg.value?.defaultAdvancedFilters });

    // Composable: Supabase data fetching, filter helpers, records/isFetching variables,
    // removed-row tracking, isInfiniteScrollEnabled.
    const {
      records, setRecords,
      isFetching, setIsFetching,
      supabaseData, supabaseTotalCount, supabaseLoading, supabaseError,
      isFetchingData, lastFetchParams,
      isUpdatingDataLocally, setUpdatingDataLocally, getUpdatingDataLocally,
      removedRowIds, cleanupRemovedIds, clearRemovedIds,
      isInfiniteScrollEnabled,
      formatFiltersForLog, applySearchToSupabase, applyManualFilters,
      convertFilterToSupabase, getSupabaseSortField,
      waitForSupabaseInstance,
      fetchSupabaseDataForInfinite, fetchSupabaseData,
      updateRecordsFromGrid,
    } = useDataFetch(cfg, props, {
      gridApi, debugLog, isGridRendering,
      getAdvancedFilters: () => normalizedAdvancedFilters.value,
      // Late-bound — useGrouping is created after useDataFetch. These let
      // updateRecordsFromGrid aggregate the per-group row sets so `records`
      // stays populated in grouped mode (where the single-grid forEachNode
      // path that normally seeds it can't see every group).
      getIsGroupingActive: () => isGroupingActive?.value ?? false,
      getOrderedGroups: () => orderedGroups,
      getGroupRowData: () => groupRowData,
    });

    // DOM container ref for the grid wrapper (used for scroll detection and
    // group-mode horizontal scrollbar metrics). Hoisted above useGrouping
    // since useGrouping reads it for the multi-grid scrollbar sync.
    const gridContainerRef = ref(null);

    // True only for the brief synchronous window of a cell editor's DOM `input`
    // event (set by the capture-phase listener wired in onMounted, reset on the
    // next microtask). AG Grid's built-in editors revalidate on every keystroke
    // (input → onValueChange → validate → getValidationErrors); consulting this
    // flag lets useCellEditing's getValidationErrors stay silent while the user
    // is typing so the red border + `validationFailed` workflow only surface on
    // submission (Enter / Tab / blur commit), which never runs inside an input
    // event. See onMounted below and useCellEditing's getValidationErrors.
    const suppressLiveValidation = ref(false);

    // Component-width based responsive state (toggles .is-compact / .is-mobile on
    // the root). Detection is the component's own width, not the viewport.
    const { isCompact: isCompactWidth, isMobile: isMobileWidth } = useResponsive(gridContainerRef);

    // Composable: grouping feature — multi-grid layout, persisted collapsed state,
    // group event handlers, drag-reorder, horizontal scrollbar sync. Cycle-deps
    // (updateCurrentConfig, scheduleRefreshGroupCounts, single-grid handlers, etc.)
    // are passed as thunks that resolve at call time, after the orchestrator has
    // finished wiring all composables.
    const {
      UNASSIGNED_GROUP,
      groupingState, pendingGroupingColumnId, isGroupingTransitionLoading,
      groupGridApis, groupSelections, groupInfiniteCounts,
      bumpGroupingDataVersion,
      groupHorizontalScrollRef, groupHorizontalScrollWidth,
      groupHorizontalViewportWidth, groupHorizontalScrollLeft,
      groupDragValue, groupDragOverValue,
      groupingColumnId, isGroupingActive, groupingSourceRows, groupedRowData,
      orderedGroups, hasGroupHorizontalOverflow, selectableGroupingColumns,
      isSelectColumn, isValidGroupColumn,
      getGroupColor, getGroupLabel, rowGroupKey, groupRowData,
      alignedGridApisForGroup, findGroupForRowId,
      getStoredCollapsedForView, persistCollapsedForView,
      getGroupHorizontalScrollViewports, updateGroupHorizontalScrollbarMetrics,
      onGroupHorizontalScrollbarScroll, onGroupBodyScroll,
      onGroupGridReady, onGroupGridUnmounted,
      onGroupFilterChanged, onGroupSortChanged,
      onGroupColumnResized, onGroupColumnMoved,
      onGroupSelectionChanged, onGroupRowSelected,
      onGroupDragStart, onGroupDragOver, onGroupDrop, onGroupDragEnd,
      toggleGroupCollapsed, collapseAllGroups, expandAllGroups, expandGroup,
      applyGroupingWithLoading, setGroupingColumn, setShowUnassigned,
      writeGroupingToViewConfig,
    } = useGrouping(cfg, props, ctx, resolveMappingFormula, {
      gridApi, gridReady, debugLog,
      gridContainerRef,
      findColumnByField,
      setSelectedRows,
      isInfiniteScrollEnabled, supabaseData,
      // Thunks resolve at call time:
      getIsVirtualColumn: () => isVirtualColumn,
      getUpdateCurrentConfig: () => updateCurrentConfig,
      getScheduleRefreshGroupCounts: () => scheduleRefreshGroupCounts,
      getLoadInitialForGroup: () => loadInitialForGroup,
      getLoadMoreForGroup: () => loadMoreForGroup,
      getRefetchAllVisibleGroups: () => refetchAllVisibleGroups,
      getGroupPagedRowData: () => groupPagedRowData,
      getAddRowToGroupState: () => addRowToGroupState,
      getRemoveRowFromGroupState: () => removeRowFromGroupState,
      // Stamp the count-refresh race guard from drag/drop paths in
      // useGrouping that bump groupInfiniteCounts directly (collapsed-dest
      // optimistic +1) without going through addRowToGroupState.
      getStampGroupMutation: () => stampGroupMutation,
      getOnFilterChanged: () => onFilterChanged,
      getOnSortChanged: () => onSortChanged,
      getOnColumnMoved: () => onColumnMoved,
      getOnColumnResized: () => onColumnResized,
      getFilterValue: () => filterValue,
      getSortValue: () => sortValue,
      getColumnOrder: () => columnOrder,
      getCurrentConfig: () => currentConfig,
    });

    // Composable: column state — owns columnOrder/hiddenColumns WeWeb
    // variables, isVirtualColumn helper, the simple visual computeds
    // (defaultColDef, dataTypeDefinitions, rowSelection, style, cssVars,
    // theme, rowStyle), validation tracking refs (used by columnDefs +
    // cell-editing in S6), and onColumnMoved/onColumnResized event handlers.
    // columnDefs itself stays in `computed:` until S6 (it depends on
    // `this.onActionTrigger`/`this.onCustomCellEdit` which are still in
    // `methods:`).
    const {
      columnOrder, setColumnOrder,
      hiddenColumns, setHiddenColumns,
      isVirtualColumn,
      defaultColDef, dataTypeDefinitions,
      rowSelection, style, cssVars, theme, rowStyle,
      _pendingValidationError, _validationFiredForCurrentEdit,
      onColumnMoved, onColumnResized,
    } = useColumnState(cfg, props, ctx, resolveMappingFormula, {
      gridApi, debugLog,
      // Late-bound — useViewConfig + useColumnChooser are created AFTER:
      getUpdateCurrentConfig: () => updateCurrentConfig,
      getShowColumnChooser: () => showColumnChooser,
      getChooserColumnOrder: () => chooserColumnOrder,
      // Late-bound — useUserConditionalStyles is created AFTER useColumnState.
      getUserConditionalRowStyles: () => userRules,
    });

    // Composable: column chooser — owns the chooser-panel state + the
    // click-outside handler with bidirectional `columnChooserVariableId`
    // sync, the column-list computeds (allColumnsList /
    // filteredColumnsList / allColumnsVisible / visibleColumnCount /
    // someColumnsHidden), and the chooser methods (open / hide / show /
    // toggle visibility / toggle all / drag-reorder).
    const {
      showColumnChooser,
      columnChooserRef,
      columnChooserSearch,
      chooserColumnOrder,
      chooserHiddenState,
      chooserDragColId,
      chooserDragOverColId,
      activeChooserTab,
      allColumnsList,
      filteredColumnsList,
      allColumnsVisible,
      visibleColumnCount,
      someColumnsHidden,
      openColumnChooser,
      hideColumn,
      showColumn,
      toggleColumnVisibility,
      toggleAllColumns,
      onChooserDragStart,
      onChooserDragOver,
      onChooserDrop,
      onChooserDragEnd,
    } = useColumnChooser(cfg, props, ctx, {
      gridApi, debugLog,
      hiddenColumns, setHiddenColumns,
      isVirtualColumn,
      // Late-bound — useViewConfig is created AFTER:
      getUpdateCurrentConfig: () => updateCurrentConfig,
    });

    // Composable: user-defined conditional row styling rules. Owns the
    // `userRules` array that lives inside viewConfiguration.userConditionalRowStyles
    // and currentConfig.userConditionalRowStyles. Mutations call
    // updateCurrentConfig (thunked — useViewConfig is created AFTER).
    const {
      userRules,
      addRule: addUserRule,
      updateRule: updateUserRule,
      deleteRule: deleteUserRule,
      reorderRules: reorderUserRules,
      addCondition: addUserCondition,
      updateCondition: updateUserCondition,
      deleteCondition: deleteUserCondition,
    } = useUserConditionalStyles(cfg, {
      getUpdateCurrentConfig: () => updateCurrentConfig,
    });
    // Local UI state for the Conditional Styling chooser tab.
    const expandedRuleIds = ref(new Set());
    const userRuleDragId = ref(null);
    const userRuleDragOverId = ref(null);
    const toggleRuleExpanded = (id) => {
      const next = new Set(expandedRuleIds.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      expandedRuleIds.value = next;
    };
    const onUserRuleDragStart = (id) => { userRuleDragId.value = id; };
    const onUserRuleDragOver = (id) => { userRuleDragOverId.value = id; };
    const onUserRuleDrop = (id) => {
      const fromId = userRuleDragId.value;
      userRuleDragId.value = null;
      userRuleDragOverId.value = null;
      if (!fromId || fromId === id) return;
      const fromIdx = userRules.value.findIndex(r => r.id === fromId);
      const toIdx = userRules.value.findIndex(r => r.id === id);
      reorderUserRules(fromIdx, toIdx);
    };
    const onUserRuleDragEnd = () => {
      userRuleDragId.value = null;
      userRuleDragOverId.value = null;
    };
    // Build column options for the field dropdown. Excludes columns that don't
    // expose row data (navigation, action, image-only) — they have no value
    // for conditions to read.
    const STYLING_EXCLUDED_TYPES = new Set(['navigation', 'action']);
    const userRuleColumnOptions = computed(() => {
      const cols = cfg.value?.columns || [];
      return cols
        .filter(c =>
          c &&
          c.field &&
          !c.hide &&
          !STYLING_EXCLUDED_TYPES.has(c.cellDataType) &&
          !c.actionName
        )
        .map(c => ({
          field: c.field,
          headerName: c.headerName || c.field,
          cellDataType: c.cellDataType || 'any',
        }));
    });
    const getColumnTypeForField = (field) => {
      const col = userRuleColumnOptions.value.find(c => c.field === field);
      return col?.cellDataType || 'any';
    };
    const getOperatorsForField = (field) => {
      const t = getTranslations(cfg.value?.lang || 'en');
      return getOperatorsForType(getColumnTypeForField(field)).map(op => ({
        ...op,
        label: getOperatorLabel(op.key, t),
      }));
    };
    const conditionNeedsValue = (operator) => operatorNeedsValue(operator);
    const conditionIsMulti = (operator) => operatorIsMulti(operator);

    // Find the raw column definition (carries options/users/recordTable for the picker).
    const getColumnDef = (field) => (cfg.value?.columns || []).find(c => c?.field === field) || null;

    // What value input to render for a (field, operator) pair:
    //   'none' — operator takes no value (isEmpty / isTrue / etc.)
    //   'picker' — open FilterValuePicker (select/user/record + isAnyOf/isNoneOf)
    //   'date' | 'number' | 'text' — native input
    const getValueInputKind = (cond) => {
      if (!operatorNeedsValue(cond.operator)) return 'none';
      if (operatorIsMulti(cond.operator)) return 'picker';
      const kind = normalizeColumnKind(getColumnTypeForField(cond.field));
      if (kind === 'date') return 'date';
      if (kind === 'number') return 'number';
      return 'text';
    };

    // Column kind for a styling condition — used to scope placeholder offers.
    const placeholderKind = (cond) => normalizeColumnKind(getColumnTypeForField(cond.field));

    // When the operator switches between scalar and multi, the value type
    // (string ↔ array) has to change with it — otherwise the picker receives
    // a string and the text input receives an array.
    const onOperatorChange = (ruleId, cIdx, newOp) => {
      const rule = userRules.value.find(r => r.id === ruleId);
      const cond = rule?.conditions?.[cIdx];
      if (!cond) return;
      const wasMulti = operatorIsMulti(cond.operator);
      const willBeMulti = operatorIsMulti(newOp);
      const patch = { operator: newOp };
      if (wasMulti !== willBeMulti) patch.value = willBeMulti ? [] : '';
      updateUserCondition(ruleId, cIdx, patch);
    };

    // Inline picker open state. Mirrors FilterBuilder's "one row open at a time".
    // Key shape: `${ruleId}|${cIdx}`.
    const openPickerKey = ref(null);
    const togglePicker = (ruleId, cIdx) => {
      const key = ruleId + '|' + cIdx;
      openPickerKey.value = openPickerKey.value === key ? null : key;
    };
    const isPickerOpen = (ruleId, cIdx) => openPickerKey.value === ruleId + '|' + cIdx;

    // Compact summary shown on the picker toggle button.
    const pickerSummary = (cond) => {
      const t = getTranslations(cfg.value?.lang || 'en');
      const placeholder = t.pickValuesPlaceholder || 'Pick values…';
      if (!Array.isArray(cond.value) || cond.value.length === 0) return placeholder;
      const col = getColumnDef(cond.field);
      const kind = normalizeColumnKind(col?.cellDataType);
      const labelFor = (v) => {
        if (isPlaceholderToken(v)) return placeholderDisplayName(v);
        if (kind === 'select') {
          const opt = (col?.options || []).find(o => String(o?.value ?? '') === String(v));
          return opt?.label ?? String(v);
        }
        if (kind === 'user') {
          const u = (col?.users || []).find(x => String(x?.id) === String(v));
          if (!u) return String(v);
          const name = u.full_name || u.name || u.email;
          return name ?? String(v);
        }
        return String(v);
      };
      const labels = cond.value.slice(0, 2).map(labelFor);
      const more = cond.value.length - labels.length;
      return more > 0
        ? `${labels.join(', ')} +${more}`
        : labels.join(', ');
    };

    const activeCreateColumnField = ref(null);
    const activeCreateRow = ref(null);
    const activeCreateRowId = ref(null);
    const createPopupTeleportTarget = ref(null);
    // popupParent for AG Grid filter/menu popups. Set to the front document
    // body so popups escape the per-group `.ww-group__grid` overflow:hidden
    // clip in grouped mode (otherwise filter popups get cropped on the right).
    // Resolved eagerly so the value is available at grid-init, not on mount.
    const popupParent = ref((wwLib?.getFrontDocument?.() || document)?.body || null);

    // Composable: cell editing — owns the columnDefs computed, all cell/row
    // editing lifecycle handlers (onCellValueChanged, onCellEditingStarted/
    // Stopped, etc.), action triggering, and the _lastActiveCellEdit ref
    // (consumed by useGridActions for diagnostic logging).
    const {
      columnDefs,
      _lastActiveCellEdit,
      getRowId,
      onActionTrigger,
      onCellEditRequest,
      onCellEditingStarted,
      onCellEditingStopped,
      onRowEditingStarted,
      onRowEditingStopped,
      onCellValueChanged,
      onRowClicked,
      onCustomCellEdit,
    } = useCellEditing(cfg, props, ctx, resolveMappingFormula, {
      gridApi, debugLog, isGridRendering,
      _pendingValidationError, _validationFiredForCurrentEdit,
      suppressLiveValidation,
      isGroupingActive, groupingState, groupGridApis,
      isInfiniteScrollEnabled, setUpdatingDataLocally,
      activeCreateColumnField, activeCreateRow, activeCreateRowId,
      bumpGroupingDataVersion, expandGroup,
      // Thunks: useInfiniteScroll is created AFTER useCellEditing, so its
      // handles aren't bound yet at construction time. Resolve lazily.
      getScheduleRefreshGroupCounts: () => scheduleRefreshGroupCounts,
      getAddRowToGroupState: () => addRowToGroupState,
      getRemoveRowFromGroupState: () => removeRowFromGroupState,
      navContext,
      isMobile: isMobileWidth,
    });

    // Composable: grid actions — programmatic actions exposed to WeWeb
    // workflows (setCellValue, refreshRow, removeRow, selectRow, etc.) plus
    // a couple of internal callers (createRecord uses setCellValue).
    const {
      setCellValue,
      triggerCellValueChanged,
      refreshRow,
      stopCellEditing,
      createRecord,
      closeCreateRecordForm,
      resetFilters,
      resetSort,
      deselectAll,
      selectAll,
      selectRow,
      deselectRow,
      removeRow,
      applyFocusedRow,
    } = useGridActions(cfg, props, ctx, resolveMappingFormula, {
      gridApi, debugLog, isGridRendering,
      waitForGridReady, waitForRowInGridLocal,
      isGroupingActive, groupGridApis, findGroupForRowId,
      removedRowIds, cleanupRemovedIds, setUpdatingDataLocally,
      supabaseData, supabaseTotalCount,
      waitForSupabaseInstance,
      // getDatasource thunk is no longer used (paged-append owns its own
      // state); kept undefined for shape compatibility with the destructure.
      getDatasource: () => undefined,
      gridContainerRef,
      activeCreateColumnField, activeCreateRow, activeCreateRowId,
      _lastActiveCellEdit,
    });



    // Resolve teleport target for the create record popup, and refresh the
    // popupParent in case the front document wasn't ready at setup time.
    onMounted(() => {
      console.log('[viewEdited][datagrid] MOUNTED', {
        viewEditedVariableId: cfg.value?.viewEditedVariableId,
        hasViewConfiguration: !!cfg.value?.viewConfiguration,
      });
      const body = (wwLib?.getFrontDocument?.() || document).body;
      createPopupTeleportTarget.value = body;
      if (!popupParent.value) popupParent.value = body;

      // Defer validation feedback to submission only. AG Grid's built-in cell
      // editors revalidate on every keystroke; we flag the synchronous window
      // of the editor's DOM `input` event so getValidationErrors reports no
      // errors mid-typing. Capture phase guarantees this runs before AG Grid's
      // own input handler (which is on the input element itself), and the
      // microtask reset fires after the whole input→validate chain completes,
      // leaving submission (Enter/Tab/blur — never inside an input event) to
      // surface the red border + validationFailed workflow.
      const root = gridContainerRef.value;
      if (root) {
        root.addEventListener('input', onEditorInputCapture, true);
      }

      // Subscribe to the page-wide refresh bus (see forceRefetch above).
      const win = wwLib?.getFrontWindow?.() || window;
      win.addEventListener(DATAGRID_REFRESH_EVENT, onGlobalRefresh);
      win.addEventListener(DATAGRID_REFRESH_ROW_EVENT, onGlobalRefreshRow);
    });

    // See onMounted: marks live-typing input so validation stays silent until
    // the edit is submitted. Scoped to AG Grid cell editors so typing in the
    // filter builder / column chooser inputs is ignored.
    const onEditorInputCapture = (event) => {
      const target = event?.target;
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('.ag-cell-editor, .ag-cell-inline-editing, .ag-cell-edit-wrapper')
      ) {
        suppressLiveValidation.value = true;
        queueMicrotask(() => { suppressLiveValidation.value = false; });
      }
    };

    const { value: activeCreateColumn, setValue: setActiveCreateColumn } =
      wwLib.wwVariable.useComponentVariable({
        uid: props.uid,
        name: "activeCreateColumn",
        type: "string",
        defaultValue: null,
        readonly: true,
      });
    // Keep the ref and the component variable in sync
    watch(activeCreateColumnField, (val) => setActiveCreateColumn(val));

    

    // Clear column caches when major dependencies change to prevent stale memoized functions
    watch(
      () => [
        cfg.value?.columns,
        cfg.value?.lang,
        props.content?.actionFont,
        props.content?.cellFontFamily,
        props.content?.userFocusColor
      ],
      () => {
        clearAllCaches();
      },
      { deep: true }
    );



    // Composable: paged-append data lifecycle (single-grid + per-group),
    // upfront group counts, and the rowModelType / paginationEnabled /
    // rowDragManaged computeds. Depends on useDataFetch + grouping refs.
    const {
      rowModelType, rowDragManaged, paginationEnabled,
      pagedRowData, totalCount: pagedTotalCount, isLoadingMore, allLoaded, blockSize,
      loadInitial, loadMore, refetchAll,
      groupPagedRowData, loadInitialForGroup, loadMoreForGroup, refetchAllForGroup,
      refetchAllVisibleGroups,
      addRowToGroupState, removeRowFromGroupState, stampGroupMutation,
      fetchSupabaseGroupCount, scheduleRefreshGroupCounts,
    } = useInfiniteScroll(cfg, props, resolveMappingFormula, {
      gridApi, gridReady,
      isInfiniteScrollEnabled,
      supabaseTotalCount,
      fetchSupabaseDataForInfinite, waitForSupabaseInstance,
      formatFiltersForLog, applySearchToSupabase, applyManualFilters, convertFilterToSupabase,
      UNASSIGNED_GROUP,
      isGroupingActive, groupingColumnId, orderedGroups,
      groupGridApis, groupInfiniteCounts,
    });

    // Helper function to get current column widths from the grid
    // Helper to check if a column is a virtual (sort/filter-only) column

    // Composable: view configuration — owns currentConfig / columnDefs WeWeb
    // variables, applyViewConfiguration, gridReady & viewConfiguration watchers,
    // and the one-time initialState seeding (incl. grouping bootstrap).
    // filterValue / sortValue come via thunks because useFiltersAndSort is
    // created AFTER useViewConfig.
    const {
      currentConfig, setCurrentConfig,
      columnDefsVar, setColumnDefsVar,
      getCurrentColumnWidths,
      updateCurrentConfig,
      updateViewEditedVariable,
      suppressEditedUntil,
      lastAppliedViewConfig,
      isApplyingViewConfig,
      applyViewConfiguration,
      initialState,
    } = useViewConfig(cfg, props, ctx, {
      gridApi, gridReady, debugLog,
      getFilterValue: () => filterValue,
      getSortValue: () => sortValue,
      // Thunked because useFiltersAndSort is created AFTER useViewConfig —
      // direct destructure here would TDZ-throw.
      getSetFilters: () => setFilters,
      getSetSort: () => setSort,
      // Advanced filters (Filter Builder) — savable in viewConfiguration.
      getAdvancedFilters: () => normalizedAdvancedFilters.value,
      getSetAdvancedFilters: () => setAdvancedFilters,
      groupingState, groupGridApis, groupSelections,
      getStoredCollapsedForView, isValidGroupColumn,
      setSelectedRows,
      columnOrder, setColumnOrder,
      hiddenColumns, setHiddenColumns,
      chooserColumnOrder, chooserHiddenState,
      isVirtualColumn,
      isEmptyConfigValue,
      // User conditional row styles plumbing.
      getUserRules: () => userRules,
      setUserRules: (incoming) => {
        if (!Array.isArray(incoming)) { userRules.value = []; return; }
        userRules.value = incoming.map(r => ({
          id: r?.id || `ucs-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
          label: typeof r?.label === 'string' ? r.label : '',
          conditions: Array.isArray(r?.conditions)
            ? r.conditions.map(c => ({ field: c?.field || '', operator: c?.operator || 'equals', value: c?.value ?? '' }))
            : [],
          backgroundColor: r?.backgroundColor || '',
          textColor: r?.textColor || '',
          bold: !!r?.bold,
          italic: !!r?.italic,
        }));
      },
    });






    const onGridReady = (params) => {
      gridApi.value = params.api;
      gridReady.value = true;
      // Set rendering flag during initial setup
      isGridRendering.value = true;
      
      const columns = params.api.getAllGridColumns();
      
      // Set initial column order from viewConfiguration if provided with values
      // At grid initialization, we use viewConfiguration.columnsOrder if it has values
      // Otherwise, use the default order from grid (from column definitions)
      const viewConfig = cfg.value?.viewConfiguration;
      const hasColumnsOrderKey = viewConfig && typeof viewConfig === 'object' && 'columnsOrder' in viewConfig;
      const viewColumnsOrder = hasColumnsOrderKey ? viewConfig.columnsOrder : undefined;
      
      if (viewColumnsOrder && Array.isArray(viewColumnsOrder) && viewColumnsOrder.length > 0) {
        setColumnOrder([...viewColumnsOrder]);
      } else {
        // Use default order from grid (no explicit order in viewConfiguration)
        // Filter out virtual columns (sort/filter-only) from the default order
        setColumnOrder(columns.filter(col => !isVirtualColumn(col)).map((col) => col.getColId()));
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
    
    // One-shot guard: refetch the focused row from the data source exactly once
    // per component lifecycle (on mount). onFirstDataRendered can fire more than
    // once (e.g. per group grid in grouped mode), so this prevents repeat fetches.
    let hasAutoRefetchedFocusedRow = false;

    // CRITICAL FIX: Track when grid finishes its first data render
    // This helps prevent error #252 by knowing when it's safe to call API methods
    const onFirstDataRendered = () => {
      // Clear rendering flag when first data is rendered
      setTimeout(() => {
        isGridRendering.value = false;
        dataRendered.value = true;
        
        // Apply focused row if focusedRowId is set (scroll to row on first render)
        const focusedRowId = cfg.value?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Silently refetch the focused row from the data source on mount so it
          // shows the freshest values without a visible reload. refreshRow updates
          // the single row in place (no spinner, no full re-render). Gated to
          // Supabase (the only source refreshRow supports) and run once per mount.
          if (!hasAutoRefetchedFocusedRow && props.content?.dataSource === 'supabase') {
            hasAutoRefetchedFocusedRow = true;
            Promise.resolve(refreshRow(focusedRowId)).catch((err) => {
              console.warn('[Datagrid] Auto-refetch of focused row failed:', err);
            });
          }

          // Use a longer delay to ensure grid is fully ready
          setTimeout(() => {
            if (gridApi.value && !isGridRendering.value) {
              // Find and scroll to the focused row using unified lookup
              let rowNode = findRowNode(gridApi.value, focusedRowId, resolveMappingFormula, props.content);

              // Scroll to and focus the row if found
              if (rowNode && rowNode.rowIndex !== null && rowNode.rowIndex !== undefined) {
                gridApi.value.ensureIndexVisible(rowNode.rowIndex, 'middle');
              }
            }
          }, 150);
        }
        if (isGroupingActive.value) {
          updateGroupHorizontalScrollbarMetrics();
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
        const focusedRowId = cfg.value?.focusedRowId;
        if (focusedRowId !== null && focusedRowId !== undefined && focusedRowId !== '') {
          // Redraw rows to ensure rowStyle is re-applied with current focusedRowId
          if (gridApi.value && !isGridRendering.value) {
            // Don't scroll on model updates, just ensure styling is correct
            // The rowStyle function will handle the visual highlighting
          }
        }
        if (isGroupingActive.value) {
          updateGroupHorizontalScrollbarMetrics();
        }
      }, 50);
    };


    // Composable: filters / sort WeWeb variables + onFilterChanged / onSortChanged
    // event handlers (single-grid mode). Group-mode handlers in useGrouping (S3)
    // delegate back to these.
    const {
      filterValue, setFilters,
      sortValue, setSort,
      filterDebounceTimer, searchDebounceTimer,
      onFilterChanged, onSortChanged,
    } = useFiltersAndSort(props, ctx, {
      gridApi, debugLog,
      isInfiniteScrollEnabled, isApplyingViewConfig,
      updateCurrentConfig,
      fetchSupabaseData, updateRecordsFromGrid,
      getRefetchAll: () => refetchAll,
    });

    // ===== Filter Builder ⇄ AG Grid two-way sync (AND case) =====
    // The builder's flat AND conditions ARE the per-column header filters: in
    // AND mode we mirror the builder into AG Grid's filter model (and back).
    // The OR case has no AG Grid representation, so it clears the header filters
    // and drives the Supabase query via the advanced-filters fetch path instead.

    // Re-run the Supabase fetch (used for OR mode, where the AG Grid filter
    // model is empty and so AG Grid's own change-detection won't refetch).
    const triggerSupabaseRefetch = () => {
      if (props.content?.dataSource !== 'supabase' || !gridApi.value) return;
      if (isInfiniteScrollEnabled.value) {
        // Grouped paged-append: each group owns its own client-side grid, so
        // refreshInfiniteCache() is a no-op here. Dispatch a per-group server
        // refetch instead — the per-group query already folds in OR-mode
        // advanced filters via getOrModeAdvancedFilters(). Also refresh the
        // collapsed-group badge counts so they reflect the new filter.
        if (isGroupingActive.value) {
          const sortModel = Array.isArray(sortValue.value) ? sortValue.value : [];
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          try { refetchAllVisibleGroups(gridApi.value.getFilterModel() || {}, sortModel, searchValue); }
          catch (e) { /* noop */ }
          try { scheduleRefreshGroupCounts?.(); } catch (e) { /* noop */ }
          nextTick(() => setTimeout(() => updateRecordsFromGrid(), 200));
          return;
        }
        try { gridApi.value.refreshInfiniteCache?.(); } catch (e) { /* noop */ }
        nextTick(() => setTimeout(() => updateRecordsFromGrid(), 200));
      } else {
        const currentPage = (gridApi.value.paginationGetCurrentPage() || 0) + 1;
        const pageSize = gridApi.value.paginationGetPageSize() || props.content?.paginationPageSize || 10;
        const state = gridApi.value.getState();
        const sortModel = state?.sort?.sortModel || [];
        const filterModel = gridApi.value.getFilterModel();
        const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
        fetchSupabaseData(currentPage, pageSize, filterModel, sortModel, searchValue);
      }
    };

    // ===== Page-wide refresh bus =====
    // A single workflow can refresh every datagrid on the current page without
    // binding to a specific instance: each grid listens for the global
    // 'ww-datagrid:refresh' window event and reloads itself. Listeners are tied
    // to the mount lifecycle (see onMounted / onBeforeUnmount), so only grids
    // currently on the page respond. Trigger from a "Run JavaScript" action:
    //   wwLib.getFrontWindow().dispatchEvent(new CustomEvent('ww-datagrid:refresh'))
    // Optionally pass { detail: { uid: '<element-uid>' } } to refresh one grid.
    const DATAGRID_REFRESH_EVENT = 'ww-datagrid:refresh';

    // Reload this grid from its data source. Supabase grids do a true refetch
    // (reset the dedupe guard so an identical-params reload isn't skipped);
    // other data sources fall back to a cell re-render.
    const forceRefetch = () => {
      if (props.content?.dataSource === 'supabase') {
        lastFetchParams.value = null;
        triggerSupabaseRefetch();
      } else {
        refreshData();
      }
    };

    const onGlobalRefresh = (event) => {
      // Optional targeting: a `uid` in the event refreshes only that grid
      // (props.uid is the WeWeb element UID). No uid → refresh every grid.
      const targetUid = event?.detail?.uid;
      if (targetUid && targetUid !== props.uid) return;
      forceRefetch();
    };

    // Single-row variant of the refresh bus: reload one row by id from Supabase
    // across every grid on the page that holds it. Trigger from a "Run
    // JavaScript" action:
    //   wwLib.getFrontWindow().dispatchEvent(
    //     new CustomEvent('ww-datagrid:refresh-row', { detail: { rowId } }))
    // A broadcast (no uid) only refreshes grids that already contain the row and
    // never inserts it elsewhere. Pass a `uid` to target one specific grid,
    // where the per-instance add-if-missing behaviour still applies.
    const DATAGRID_REFRESH_ROW_EVENT = 'ww-datagrid:refresh-row';

    const onGlobalRefreshRow = (event) => {
      const detail = event?.detail || {};
      const rowId = detail.rowId;
      if (rowId === null || rowId === undefined) return;
      const targetUid = detail.uid;
      if (targetUid) {
        if (targetUid !== props.uid) return;
        refreshRow(rowId);
      } else {
        refreshRow(rowId, { addIfMissing: false });
      }
    };

    // Canonicalise an AG Grid filter model into the builder's shape so the two
    // directions can be compared without false diffs (e.g. dateTo:null vs omitted).
    const canonicalModel = (model) =>
      conditionsToAgGridFilterModel(agGridFilterModelToConditions(model || {}, props.content));

    // Resolve the grid api the forward-sync should drive. In single-grid mode
    // that's gridApi.value. In grouped mode gridApi.value is just the grid of
    // one group and can go stale (a collapsed group's destroyed api, or a grid
    // AG Grid recreated without firing a Vue unmount). Driving a dead api makes
    // setFilterModel a silent no-op — no filter-changed event, so the `filters`
    // variable never updates and the groups never refetch. Pick a guaranteed-
    // live group grid instead; onGroupFilterChanged then fans the change out to
    // every group and dispatches the per-group server refetch.
    const resolveFilterTargetApi = () => {
      const isLive = (api) => {
        if (!api) return false;
        try { return typeof api.isDestroyed === 'function' ? !api.isDestroyed() : true; }
        catch (_) { return false; }
      };
      if (!isGroupingActive.value) return gridApi.value;
      if (isLive(gridApi.value) && Array.from(groupGridApis.value.values()).includes(gridApi.value)) {
        return gridApi.value;
      }
      return Array.from(groupGridApis.value.values()).find(isLive) || null;
    };

    // Refetch data for an explicit AG Grid filter model, across every data-source
    // mode. Used by the grouped forward-sync path, which sets the `filters`
    // variable directly (rather than via the grid's filter-changed event) and so
    // must drive its own refetch. Reads the model from the argument, NOT from a
    // grid api — in grouped mode the grids are cleared asynchronously by the
    // redundant sync watcher, so their getFilterModel() is stale at call time.
    const dispatchFilterRefetch = (model) => {
      const filterModel = model || {};
      if (props.content?.dataSource !== 'supabase') {
        nextTick(() => setTimeout(() => updateRecordsFromGrid(), 100));
        return;
      }
      const sortModel = Array.isArray(sortValue.value) ? sortValue.value : [];
      const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
      if (isInfiniteScrollEnabled.value) {
        if (isGroupingActive.value) {
          try { refetchAllVisibleGroups(filterModel, sortModel, searchValue); } catch (_) { /* noop */ }
          try { scheduleRefreshGroupCounts?.(); } catch (_) { /* noop */ }
        } else {
          try { refetchAll(filterModel, sortModel, searchValue); } catch (_) { /* noop */ }
        }
        nextTick(() => setTimeout(() => updateRecordsFromGrid(), 200));
      } else {
        const page = (gridApi.value?.paginationGetCurrentPage?.() || 0) + 1;
        const pageSize = gridApi.value?.paginationGetPageSize?.() || props.content?.paginationPageSize || 10;
        fetchSupabaseData(page, pageSize, filterModel, sortModel, searchValue);
      }
    };

    // Forward: builder state → grid.
    watch(
      normalizedAdvancedFilters,
      (adv) => {
        if (isApplyingViewConfig.value) return;
        const targetApi = resolveFilterTargetApi();
        if (adv.combinator === 'and') {
          // Date-token conditions (e.g. %DATE:today%) can't ride AG Grid's built-in
          // date filter — exclude them from the mirror; they're applied straight to
          // the Supabase query via getOrModeAdvancedFilters() instead.
          const mirrorConditions = adv.conditions.filter(c => !isDirectAdvancedCondition(c));
          const hasDirect = adv.conditions.some(isDirectAdvancedCondition);
          const desired = conditionsToAgGridFilterModel(mirrorConditions);
          const model = Object.keys(desired).length ? desired : null;

          if (isGroupingActive.value) {
            // Grouped mode: the grid filter-changed round-trip is unreliable.
            // Custom filter types (select / user / record) frequently DON'T fire
            // filter-changed when cleared via setFilterModel(null), and the
            // primary group api can be stale — so the event-driven chain leaves
            // the exposed `filters` variable holding the old value and never
            // marks the view edited. Make `filters` authoritative instead: set
            // it directly, let the redundant group-sync watcher push it to every
            // mounted grid (under its own re-entry guard, so no per-grid refetch
            // storm), and dispatch a single refetch with the explicit model.
            if (JSON.stringify(filterValue.value || {}) !== JSON.stringify(desired)) {
              setFilters(desired);
              dispatchFilterRefetch(model);
              if (!isApplyingViewConfig.value) {
                ctx.emit('trigger-event', { name: 'filterChanged', event: desired });
              }
            } else if (props.content?.dataSource === 'supabase') {
              // Header model unchanged, but a direct (date-token) condition may
              // have changed — refetch (the fetch-key guard dedups no-ops).
              dispatchFilterRefetch(model);
            }
          } else if (targetApi) {
            // Single-grid mode: drive the grid; its filter-changed handler
            // (onFilterChanged) updates the `filters` variable and refetches.
            const current = canonicalModel(targetApi.getFilterModel());
            if (JSON.stringify(desired) !== JSON.stringify(current)) {
              targetApi.setFilterModel(model);
            } else if (props.content?.dataSource === 'supabase') {
              // Header model unchanged, but a direct (date-token) condition may
              // have changed — refetch (the fetch-key guard dedups no-ops).
              triggerSupabaseRefetch();
            }
          }
        } else {
          // OR mode: clear header filters once (which itself triggers a refetch),
          // otherwise refetch directly when editing further OR conditions.
          if (isGroupingActive.value) {
            // Same authoritative handling as AND: the OR conditions live in the
            // Supabase query (getOrModeAdvancedFilters), and the header model
            // stays empty. Clear `filters` if needed and dispatch a refetch.
            if (Object.keys(filterValue.value || {}).length > 0) {
              setFilters({});
            }
            dispatchFilterRefetch(null);
          } else if (targetApi) {
            const current = targetApi.getFilterModel() || {};
            if (Object.keys(current).length) {
              targetApi.setFilterModel(null);
            } else {
              triggerSupabaseRefetch();
            }
          }
        }
        // Persist into currentConfig and (re)evaluate the view-edited flag. In
        // AND mode onFilterChanged also calls this, but combinator-only changes
        // and OR edits don't go through it — so call it here for every change.
        updateCurrentConfig();
      },
      { deep: true }
    );

    // Reverse: header filters → builder (AND mode only; OR conditions aren't in the
    // model). Not gated on isApplyingViewConfig so the builder also reflects filters
    // restored from a saved view; the forward watcher is gated, so no write-back loop.
    watch(
      filterValue,
      (model) => {
        if (normalizedAdvancedFilters.value.combinator !== 'and') return;
        // Date-token conditions live only in the builder (not the header model),
        // so preserve them here — otherwise reconciling against an empty header
        // model would silently delete them.
        const currentConditions = normalizedAdvancedFilters.value.conditions;
        const directConditions = currentConditions.filter(isDirectAdvancedCondition);
        const parsed = agGridFilterModelToConditions(model || {}, props.content);
        const desiredFromModel = conditionsToAgGridFilterModel(parsed);
        const currentMirror = conditionsToAgGridFilterModel(currentConditions.filter(c => !isDirectAdvancedCondition(c)));
        if (JSON.stringify(desiredFromModel) !== JSON.stringify(currentMirror)) {
          setAdvancedFilters({ combinator: 'and', conditions: [...parsed, ...directConditions] });
        }
      },
      { deep: true }
    );

    // Columns metadata for the builder UI (kept reactive to config changes).
    const filterBuilderColumns = computed(() => cfg.value?.columns || []);

    // When the panel opens and column hiding is disabled, the Filters tab is the
    // only available tab — make it the default selection.
    watch(showColumnChooser, (open) => {
      if (open && !cfg.value?.allowColumnHiding && cfg.value?.enableFilterBuilder) {
        activeChooserTab.value = 'filters';
      }
    });



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




    // Track scroll debounce timer
    const scrollDebounceTimer = ref(null);

    // Cleanup on unmount
    onBeforeUnmount(() => {
      console.log('[viewEdited][datagrid] UNMOUNTING');
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value);
      }
      const root = gridContainerRef.value;
      if (root) {
        root.removeEventListener('input', onEditorInputCapture, true);
      }

      // Unsubscribe from the page-wide refresh bus.
      const win = wwLib?.getFrontWindow?.() || window;
      win.removeEventListener(DATAGRID_REFRESH_EVENT, onGlobalRefresh);
      win.removeEventListener(DATAGRID_REFRESH_ROW_EVENT, onGlobalRefreshRow);
    });

    const onBodyScroll = (event) => {
      if (!gridApi.value) return;

      // Track scroll frequency for performance monitoring
      gridMonitor.trackScroll();

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

      // Paged-append: when the user scrolls within ~200px of the bottom,
      // fetch the next block and append. The composable de-dupes concurrent
      // calls via isLoadingMore and short-circuits when allLoaded is true.
      if (isInfiniteScrollEnabled.value && distanceFromBottom <= 200) {
        const filterModel = api.getFilterModel?.() || null;
        const sortModel = api.getState?.()?.sort?.sortModel || [];
        const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
        loadMore(api, filterModel, sortModel, searchValue);
      }

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

    // Group-grid scroll wrapper. Forwards horizontal-scroll syncing to the
    // existing handler from useGrouping, and triggers per-group loadMore in
    // paged-append mode when the user nears the bottom of a group's grid.
    const onGroupBodyScrollWrapper = (groupValue, event) => {
      onGroupBodyScroll(event);
      if (!isInfiniteScrollEnabled.value || !isGroupingActive.value) return;
      const api = event?.api;
      if (!api) return;
      try {
        const lastIdx = typeof api.getLastDisplayedRowIndex === 'function'
          ? api.getLastDisplayedRowIndex()
          : (api.getDisplayedRowCount?.() ?? 0) - 1;
        const total = api.getDisplayedRowCount?.() ?? 0;
        if (total === 0) return;
        // Trigger loadMore when the last visible row is within 10 of the
        // current loaded count.
        if (lastIdx >= total - 10) {
          const filterModel = api.getFilterModel?.() || null;
          const sortModel = api.getState?.()?.sort?.sortModel || [];
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          loadMoreForGroup(groupValue, api, filterModel, sortModel, searchValue);
        }
      } catch (_) { /* noop */ }
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







    const rowData = computed(() => {
      // Paged-append mode: bind the per-block accumulator. AG Grid diffs by
      // getRowId on prop changes, so appending a new block leaves existing
      // rendered rows intact and only mounts the new ones.
      if (isInfiniteScrollEnabled.value) {
        return pagedRowData.value;
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

    // Watch for data changes with shallow comparison for better performance
    // Track array length and reference changes instead of deep comparison
    const rowDataLength = ref(0);
    const rowDataRef = ref(null);
    
    watch(() => rowData.value, (newData, oldData) => {
      // Skip processing if we're updating data locally (e.g., fake junction records)
      if (isUpdatingDataLocally.value) {
        return;
      }

      // Check if this is just a reference change or actual data change
      const newLength = Array.isArray(newData) ? newData.length : 0;
      const oldLength = rowDataLength.value;
      const isArrayChange = newData !== rowDataRef.value;
      const isLengthChange = newLength !== oldLength;
      
      // Update tracking refs
      rowDataLength.value = newLength;
      rowDataRef.value = newData;

      // Grouped mode: `records` is aggregated from the per-group row sets (the
      // top-level rowData is not what the group grids render), so defer to the
      // grouping-aware updateRecordsFromGrid rather than the flat newData.
      if (isGroupingActive.value) {
        nextTick(() => {
          setTimeout(() => {
            updateRecordsFromGrid();
          }, 100);
        });
      } else if (!isInfiniteScrollEnabled.value) {
        // For non-paged-append modes, update records from rowData.
        setRecords(Array.isArray(newData) ? [...newData] : []);
      } else {
        // Paged-append mode: AG Grid is the source of truth — pull records from
        // the grid api after the prop diff has settled.
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
        
        // Only apply transaction if there was an actual array or length change.
        // In paged-append mode, AG Grid's prop diff handles add/remove on its
        // own — bypass the bulk update transaction (which would re-emit row
        // mutations for every loaded row on every append).
        if ((isArrayChange || isLengthChange) && !isInfiniteScrollEnabled.value) {
          nextTick(() => {
            const hasActiveEditor = typeof gridApi.value?.getEditingCells === 'function' &&
              gridApi.value.getEditingCells().length > 0;
            if (hasActiveEditor) {
              console.log('[Datagrid rowData] skipped grid data refresh while editor active');
              return;
            }

            // Use queue-based approach for grid operations
            if (Array.isArray(newData) && newData.length > 0) {
              // Apply transaction first
              gridApiQueue.enqueue(
                () => {
                  if (gridApi.value) {
                    const clonedRows = newData.map(row => ({ ...row }));
                    return gridApi.value.applyTransaction({ update: clonedRows });
                  }
                },
                {
                  priority: 0,
                  description: 'applyTransaction for rowData update',
                  condition: () => !!gridApi.value
                }
              );
            }

            // Then refresh cells
            gridApiUtils.refreshCells(gridApi.value, { force: true }).catch(error => {
              console.warn('[Datagrid] Error during rowData refresh:', error);
            });
          });
        }
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
    }, { immediate: true }); // Removed deep: true for better performance

    // Grouped mode keeps `records` in sync from the per-group row sets. The
    // single-grid onGridReady / rowData paths that normally seed `records`
    // either never run in grouped mode (the single grid isn't mounted) or
    // can't see the per-group data (paged-append stores each group's rows in
    // its own state, not the top-level rowData). Watch a cheap signature of the
    // rendered groups + their row counts and re-aggregate whenever it changes:
    // initial load, lazy block loads, drag-between-groups, group toggles.
    const groupedRecordsSignature = computed(() => {
      if (!isGroupingActive.value) return '';
      const groups = orderedGroups.value || [];
      return groups
        .map((g) => `${g.value}:${(groupRowData(g.value) || []).length}`)
        .join('|');
    });
    watch(
      groupedRecordsSignature,
      () => {
        if (!isGroupingActive.value) return;
        nextTick(() => updateRecordsFromGrid());
      },
      { immediate: true }
    );

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

    // Track conditional row styles changes more efficiently
    const lastConditionalRowStylesJson = ref(null);
    
    // Watch for conditional row styles with optimized change detection
    watch(
      () => props.content?.conditionalRowStyles,
      (newStyles) => {
        // Skip if no styles defined
        if (!newStyles || !Array.isArray(newStyles) || newStyles.length === 0) {
          if (lastConditionalRowStylesJson.value !== null) {
            lastConditionalRowStylesJson.value = null;
            // Styles were removed, redraw to clear any applied styles
            if (gridApi.value && gridReady.value && !isGridRendering.value) {
              const hasActiveEditor = typeof gridApi.value.getEditingCells === 'function' &&
                gridApi.value.getEditingCells().length > 0;
              if (hasActiveEditor) {
                console.log('[Datagrid styles] skipped redraw while editor active');
                return;
              }
              // Use queue-based approach instead of setTimeout
              gridApiUtils.redrawRows(gridApi.value).catch(error => {
                console.warn('[Datagrid] Error during conditional styles redraw:', error);
              });
            }
          }
          return;
        }
        
        // Create lightweight hash instead of full JSON.stringify for performance
        const currentHash = newStyles.length > 0 ? 
          `${newStyles.length}-${JSON.stringify(newStyles[0])}-${JSON.stringify(newStyles[newStyles.length - 1])}` :
          '0';
        
        // Only redraw if styles actually changed (not just reference change)
        if (currentHash !== lastConditionalRowStylesJson.value) {
          lastConditionalRowStylesJson.value = currentHash;
          
          // Debounce the redraw to avoid multiple rapid redraws
          if (gridApi.value && gridReady.value && !isGridRendering.value) {
            const hasActiveEditor = typeof gridApi.value.getEditingCells === 'function' &&
              gridApi.value.getEditingCells().length > 0;
            if (hasActiveEditor) {
              console.log('[Datagrid styles] skipped redraw while editor active');
              return;
            }
            // Use queue-based approach instead of setTimeout
            gridApiUtils.redrawRows(gridApi.value).catch(error => {
              console.warn('[Datagrid] Error during conditional styles clear:', error);
            });
          }
        }
      }
      // Removed deep: true - shallow comparison is sufficient since we're hashing content
    );

    // User-defined conditional row styles: mirror the prop-rules watcher above
    // so adding / editing / deleting a user rule actually re-paints rows.
    // Without this, the rowStyle computed yields a fresh function but AG Grid
    // keeps its cached per-row styles until something forces a redraw.
    const lastUserRulesHash = ref(null);
    watch(
      // Deep watch — rule edits mutate inner fields (color picker, conditions),
      // so a shallow `() => userRules.value` watcher misses them.
      userRules,
      (newRules) => {
        const arr = Array.isArray(newRules) ? newRules : [];
        const hash = arr.length === 0 ? '0' : JSON.stringify(arr);
        if (hash === lastUserRulesHash.value) return;
        lastUserRulesHash.value = hash;

        if (!gridReady.value || isGridRendering.value) return;
        const hasActiveEditor =
          gridApi.value &&
          typeof gridApi.value.getEditingCells === 'function' &&
          gridApi.value.getEditingCells().length > 0;
        if (hasActiveEditor) return;

        // Redraw single-grid mode.
        if (gridApi.value) {
          gridApiUtils.redrawRows(gridApi.value).catch(err => {
            console.warn('[Datagrid] user conditional styles redraw error:', err);
          });
        }
        // Redraw every per-group grid (grouped mode).
        try {
          groupGridApis?.value?.forEach((api) => {
            try { api?.redrawRows?.(); } catch (_) { /* noop */ }
          });
        } catch (_) { /* noop */ }
      },
      { deep: true }
    );

    // Track the last applied focused row ID to avoid duplicate applications
    const lastAppliedFocusedRowId = ref(null);

    // Helper to find a row node by its ID (using unified row lookup utility)
    const findRowNodeById = (rowId) => {
      if (rowId === null || rowId === undefined || rowId === '') return null;
      return findRowNode(gridApi.value, rowId, resolveMappingFormula, props.content);
    };

    // Watch for focusedRowId changes and apply focus to the specified row
    // This provides a declarative way to keep a row in focus (persists across data changes)
    // PERFORMANCE: Only redraws the old and new focused rows, not the entire grid
    watch(
      () => cfg.value?.focusedRowId,
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
        // Clear removed IDs when data source changes
        if (newSource !== oldSource) {
          clearRemovedIds();
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        // Only fetch if source actually changed to supabase
        if (newSource === 'supabase' && newSource !== oldSource && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // Paged-append: kick off the first-block fetch with current
            // filter/sort state. Routed per-group when grouping is active.
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            if (isGroupingActive.value) {
              refetchAllVisibleGroups(filterModel, sortModel, searchValue);
            } else {
              refetchAll(filterModel, sortModel, searchValue);
            }
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
        
        // Clear removed IDs when table or query changes (fresh data context)
        if (oldValues) {
          clearRemovedIds();
        }
        
        // Skip fetch if we're updating data locally (e.g., fake junction records)
        if (isUpdatingDataLocally.value) {
          return;
        }
        
        if (props.content?.dataSource === 'supabase' && gridApi.value) {
          if (isInfiniteScrollEnabled.value) {
            // Paged-append: refetch first block on table/query change. In
            // grouped mode, dispatch to every mounted group.
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            if (isGroupingActive.value) {
              refetchAllVisibleGroups(filterModel, sortModel, searchValue);
            } else {
              refetchAll(filterModel, sortModel, searchValue);
            }
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
            // Paged-append: kick off the first block fetch. In grouped mode
            // each group's grid-ready handles its own loadInitialForGroup,
            // so the single-grid call short-circuits inside loadInitial.
            const filterModel = gridApi.value.getFilterModel();
            const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
            const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
            if (!isGroupingActive.value) {
              loadInitial(filterModel, sortModel, searchValue);
            }
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

    // Grouping toggle — when grouping turns off in paged-append mode the
    // single grid remounts (v-if swap) and needs an initial fetch since
    // initialFetchDone has already fired. When grouping turns on, the
    // per-group grids' grid-ready triggers their own loadInitialForGroup,
    // so nothing extra is required here.
    watch(
      () => isGroupingActive.value,
      (active, wasActive) => {
        if (wasActive && !active && isInfiniteScrollEnabled.value && gridApi.value) {
          const filterModel = gridApi.value.getFilterModel();
          const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          loadInitial(filterModel, sortModel, searchValue);
        }
      }
    );

    // Watch for paged-append configuration changes — block size or toggle.
    // Both refetch the first block; AG Grid's prop diff handles the visual
    // reset when pagedRowData is reassigned.
    watch(
      () => [cfg.value?.enableInfiniteScroll, cfg.value?.infiniteBlockSize],
      (newValues, oldValues) => {
        if (oldValues && JSON.stringify(newValues) === JSON.stringify(oldValues)) {
          return;
        }

        if (cfg.value?.dataSource === 'supabase' && cfg.value?.enableInfiniteScroll && gridApi.value) {
          const filterModel = gridApi.value.getFilterModel();
          const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
          const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
          if (isGroupingActive.value) {
            refetchAllVisibleGroups(filterModel, sortModel, searchValue);
          } else {
            refetchAll(filterModel, sortModel, searchValue);
          }
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
              // Paged-append: refetch first block with the new search value.
              // In grouped mode, dispatch per-group.
              if (gridApi.value) {
                const filterModel = gridApi.value.getFilterModel();
                const sortModel = gridApi.value.getState()?.sort?.sortModel || [];
                const searchValue = props.content?.enableSearch ? props.content?.searchValue : null;
                if (isGroupingActive.value) {
                  refetchAllVisibleGroups(filterModel, sortModel, searchValue);
                } else {
                  refetchAll(filterModel, sortModel, searchValue);
                }
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

    // Watch for changes in select/user column options with better performance
    // Track option changes without creating new arrays on every evaluation
    const columnOptionsHash = ref('');
    
    watch(
      () => {
        // Create a stable hash of options instead of mapping arrays
        if (!props.content?.columns) return '';
        return props.content.columns
          .filter(col => col?.options || col?.users)
          .map(col => {
            const options = col?.options || [];
            const users = col?.users || [];
            // Create a simple hash based on array lengths and first/last items
            const optionsHash = options.length > 0 ? 
              `opt-${options.length}-${JSON.stringify(options[0])}-${JSON.stringify(options[options.length - 1])}` : 'opt-0';
            const usersHash = users.length > 0 ? 
              `usr-${users.length}-${users[0]?.id}-${users[users.length - 1]?.id}` : 'usr-0';
            return `${col.field}:${optionsHash}:${usersHash}`;
          })
          .join('|');
      },
      (newHash, oldHash) => {
        if (!oldHash || !gridApi.value || !gridReady.value || newHash === oldHash) return;
        
        // Update hash tracking
        columnOptionsHash.value = newHash;
        
        // Use queue-based approach instead of setTimeout
        gridApiUtils.refreshCells(gridApi.value, { force: true }).catch(error => {
          console.warn('[Datagrid] Error during column options refresh:', error);
        });
      },
      { flush: 'post' }
    ); // Removed deep: true for better performance

    function refreshData() {
      // Wait for grid to be ready and not rendering before refreshing cells
      // Use setTimeout to avoid error #252
      nextTick(() => {
        setTimeout(() => {
          const doRefresh = () => {
            if (isGroupingActive.value && groupGridApis.value.size > 0) {
              // Iterate all group grids in multi-grid mode
              groupGridApis.value.forEach((api) => {
                try {
                  if (api) api.refreshCells();
                } catch (e) {
                  console.warn('[Datagrid] refreshCells failed on group grid:', e?.message);
                }
              });
            } else if (gridApi.value) {
              gridApi.value.refreshCells();
            }
          };
          if (!isGridRendering.value) {
            doRefresh();
          } else {
            // Retry after rendering completes
            setTimeout(doRefresh, 100);
          }
        }, 0);
      });
    }

    const gridComponents = markRaw(Object.freeze({
      ActionCellRenderer,
      ImageCellRenderer,
      NavigationCellRenderer,
      WewebCellRenderer,
      SelectCellRenderer,
      SelectFilterComponent,
      DateCellEditor,
      UserCellRenderer,
      UserFilterComponent,
      PhoneCellRenderer,
      PhoneCellEditor,
      EmailCellRenderer,
    }));

    // Per-group rowClassRules. Each per-group grid passes its own groupValue
    // via `:context="{ groupValue }"`; the rule fires on rows whose grouping
    // column value no longer matches the grid's group — e.g. right after the
    // user edits the grouping column locally but before the Supabase write
    // round-trips and the per-group infinite cache is purged. The CSS for
    // .ww-row-leaving fades the row out so the move feels animated instead
    // of abrupt.
    const groupRowClassRules = markRaw(Object.freeze({
      'ww-row-leaving': (params) => {
        // In paged-append mode the cross-group cell edit calls
        // applyTransaction({ remove }) synchronously, so AG Grid removes
        // the row from its rowModel before any redraw. Tagging the row as
        // "leaving" is unnecessary there and harmful: AG Grid's autoHeight
        // layout reserves a slot for every row in the rowModel, and our
        // .ww-row-leaving { display: none } CSS leaves a blank gap during
        // the brief window between the cell-edit redraw and the transaction
        // taking effect. Short-circuit so the rule only fires in the
        // legacy in-place-mutation path (full client-side / paginated mode).
        if (isInfiniteScrollEnabled.value) return false;
        const colId = groupingColumnId.value;
        if (!colId) return false;
        // Skip rows whose data isn't bound (defensive — placeholder rows
        // shouldn't reach this rule in client-side mode).
        if (!params?.data) return false;
        const raw = params.data[colId];
        const expected = (raw === null || raw === undefined || raw === '')
          ? '__unassigned__'
          : String(raw);
        return expected !== params?.context?.groupValue;
      },
      // Defensive only — the old infinite-cache placeholder rows (data
      // undefined while a block was fetching) are gone in client-side mode.
      // Keeps the CSS rule a no-op rather than removing it everywhere.
      'ww-row-loading': (params) => !params?.data,
    }));

    // ===== S7: inlined Options-API leftovers =====
    // The 3 small computeds, 4 wrapper methods, and editor-only stubs that
    // were too small to justify their own composables. Lifted verbatim from
    // the previous `computed:` / `methods:` blocks; `this.X` references
    // converted to setup-scope reads.
    const isEditing = computed(() => {
      /* wwEditor:start */
      return (
        props.wwEditorState?.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION
      );
      /* wwEditor:end */
      // eslint-disable-next-line no-unreachable
      return false;
    });

    const invalidEditValueMode = computed(() => props.content?.invalidEditValueMode || "revert");

    const paginationPageSizeSelector = computed(() => {
      if (
        !cfg.value.pagination ||
        cfg.value.hasPaginationSelector !== "multiple"
      ) {
        return false;
      }
      if (
        !Array.isArray(cfg.value.paginationPageSizeSelector) ||
        cfg.value.paginationPageSizeSelector.length === 0
      ) {
        return false;
      }
      return cfg.value.paginationPageSizeSelector;
    });

    /**
     * Print a grid performance report to the browser console.
     * Only produces output when "Enable debug logs" is turned on in the editor.
     * Can be wired to a WeWeb action button for on-demand diagnostics.
     */
    const reportPerformance = () => {
      gridMonitor.report();
    };

    /**
     * Reset all collected performance metrics.
     */
    const resetPerformance = () => {
      gridMonitor.reset();
    };

    /**
     * Format a per-group row count as a localized "X items" / "X éléments" string.
     * Picks the singular form when count === 1, otherwise the plural form.
     * Returns '' for null/undefined (e.g. infinite-scroll mode before first fetch).
     */
    const formatItemCount = (count) => {
      if (count === null || count === undefined) return '';
      const t = getTranslations(cfg.value?.lang || 'en');
      const tpl = count === 1 ? t.itemCountOne : t.itemCountMany;
      return (tpl || '{count}').replace('{count}', count);
    };

    /* wwEditor:start */
    const rawContent = inject("componentRawContent", {});

    const checkIfColumnsStructureChanged = (newDefs, oldDefs) => {
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
    };

    const generateColumns = () => {
      ctx.emit("update:content", {
        columns: rowData.value?.[0]
          ? Object.keys(rowData.value[0]).map((key) => ({
              field: key,
              sortable: true,
              filter: true,
            }))
          : [],
      });
    };

    const getOnActionTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        actionName: "actionName",
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    };

    const getOnCellValueChangedTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = cfg.value.columns || [];
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
    };

    const getSelectionTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
      };
    };

    const getRowClickedTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        index: 0,
        displayIndex: 0,
      };
    };

    const getRowDraggedTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
        targetIndex: 1,
        rows: data,
      };
    };

    const getRowDragStartTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        row: data[0],
        id: 0,
      };
    };

    const getColumnMovedTestEvent = () => {
      const data = columnDefs.value;
      if (!data || !data[0]) throw new Error("No data found");
      return {
        toIndex: 1,
        columnId: data[0]?.field,
        columnsOrder: data.map((col) => col?.field).filter(Boolean),
      };
    };

    const getColumnResizedTestEvent = () => {
      const columns = columnDefs.value;
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
    };

    const getCellEditStartTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = columnDefs.value;
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
    };

    const getCellEditEndTestEvent = () => {
      const data = rowData.value;
      if (!data || !data[0]) throw new Error("No data found");
      const columns = columnDefs.value;
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
    };

    const getScrollTestEvent = () => {
      if (!gridApi.value) throw new Error("Grid API is not initialized");
      return {
        scrollTop: 500,
        scrollLeft: 0,
        scrollHeight: 1000,
        clientHeight: 400,
        distanceFromBottom: 100,
        isNearBottom: true,
        isAtBottom: false,
        totalRows: gridApi.value.getDisplayedRowCount() || 0,
      };
    };

    // Editor-only watch on columnDefs: auto-creates `containerId` for new
    // custom columns + resets column state when the columns structure
    // actually changes (preserving filters/sort across the reset).
    watch(
      columnDefs,
      async (newDefs, oldDefs) => {
        if (props.wwEditorState?.boundProps?.columns) return;

        // Skip if grid is not ready yet
        if (!gridApi.value) return;

        // CRITICAL FIX: Only reset column state if columns structure actually changed
        // Don't reset if only data or other reactive dependencies changed
        // This preserves user-applied filters and sorting
        const shouldResetState = checkIfColumnsStructureChanged(newDefs, oldDefs);
        if (shouldResetState && gridApi.value) {
          // Save current filters and sorting before reset
          const currentFilters = gridApi.value.getFilterModel();
          const currentSort = gridApi.value.getState()?.sort?.sortModel;

          gridApi.value.resetColumnState();

          // Restore filters and sorting after reset if they exist
          if (currentFilters && Object.keys(currentFilters).length > 0) {
            nextTick(() => {
              if (gridApi.value) {
                gridApi.value.setFilterModel(currentFilters);
              }
            });
          }
          if (currentSort && currentSort.length > 0) {
            nextTick(() => {
              if (gridApi.value) {
                gridApi.value.applyColumnState({
                  state: currentSort,
                  defaultState: { sort: null },
                });
              }
            });
          }
        }

        if (props.wwEditorState?.isACopy) return;

        // Auto-create containerId for new custom columns
        const columnIndex = (rawContent.columns || []).findIndex(
          (col) => col?.cellDataType === "custom" && !col?.containerId
        );
        if (columnIndex !== -1) {
          const newColumns = [...rawContent.columns];
          let column = { ...newColumns[columnIndex] };
          column.containerId = await createElement("ww-flexbox", {
            _state: { name: `Cell ${column.headerName || column.field}` },
          });
          newColumns[columnIndex] = column;
          ctx.emit("update:content:effect", { columns: newColumns });
          return;
        }
      },
      { deep: true }
    );
    /* wwEditor:end */

    return {
      resolveMappingFormula,
      debugLog,
      gridMonitor,
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
      cleanupRemovedIds, // Expose cleanup function for methods
      clearRemovedIds, // Expose clear function for methods
      gridApiQueue, // Expose grid API queue for methods
      gridApiUtils, // Expose grid API utilities for methods
      localeText: computed(() => {
        switch (cfg.value?.lang) {
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
              ...(cfg.value?.localeText || {}),
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
      onGroupBodyScrollWrapper,
      gridContainerRef,
      isCompactWidth,
      isMobileWidth,
      initialState,
      refreshData,
      rowData,
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
      waitForRowInGrid: waitForRowInGridLocal,
      // Expose waitForSupabaseInstance for methods to use
      waitForSupabaseInstance,
      safeGridApiCall,
      hiddenColumns,
      setHiddenColumns,
      getTranslations,
      activeCreateColumnField,
      activeCreateRow,
      activeCreateRowId,
      createPopupTeleportTarget,
      popupParent,
      showColumnChooser,
      columnChooserRef,
      activeChooserTab,
      // Filter Builder
      normalizedAdvancedFilters,
      setAdvancedFilters,
      filterBuilderColumns,
      selectableGroupingColumns,
      setGroupingColumn,
      setShowUnassigned,
      pendingGroupingColumnId,
      isGroupingTransitionLoading,
      columnChooserSearch,
      chooserColumnOrder,
      chooserHiddenState,
      chooserDragColId,
      chooserDragOverColId,
      updateCurrentConfig,
      columnDefsVar,
      // ========== COLUMN STATE EXPORTS (S5) ==========
      defaultColDef,
      dataTypeDefinitions,
      rowSelection,
      style,
      cssVars,
      theme,
      rowStyle,
      // Validation tracking refs — read/written by Options-API cell-editing
      // methods (onCellEditingStarted/Stopped); will move into useCellEditing
      // in Session 6.
      _pendingValidationError,
      _validationFiredForCurrentEdit,
      // ========== COLUMN CHOOSER EXPORTS (S5) ==========
      allColumnsList,
      filteredColumnsList,
      allColumnsVisible,
      visibleColumnCount,
      someColumnsHidden,
      openColumnChooser,
      hideColumn,
      showColumn,
      toggleColumnVisibility,
      toggleAllColumns,
      onChooserDragStart,
      onChooserDragOver,
      onChooserDrop,
      onChooserDragEnd,
      // ========== USER CONDITIONAL STYLES EXPORTS ==========
      userRules,
      addUserRule,
      updateUserRule,
      deleteUserRule,
      addUserCondition,
      updateUserCondition,
      deleteUserCondition,
      expandedRuleIds,
      userRuleDragId,
      userRuleDragOverId,
      toggleRuleExpanded,
      onUserRuleDragStart,
      onUserRuleDragOver,
      onUserRuleDrop,
      onUserRuleDragEnd,
      userRuleColumnOptions,
      getOperatorsForField,
      conditionNeedsValue,
      conditionIsMulti,
      getValueInputKind,
      getColumnDef,
      onOperatorChange,
      openPickerKey,
      togglePicker,
      isPickerOpen,
      pickerSummary,
      isPlaceholderToken,
      placeholderDisplayName,
      placeholderGlyphHtml,
      placeholderKind,
      // ========== GROUPING EXPORTS ==========
      isGroupingActive,
      orderedGroups,
      groupRowData,
      groupingState,
      groupDragValue,
      groupDragOverValue,
      onGroupGridReady,
      onGroupGridUnmounted,
      onGroupFilterChanged,
      onGroupSortChanged,
      onGroupColumnResized,
      onGroupColumnMoved,
      onGroupSelectionChanged,
      onGroupRowSelected,
      onGroupDragStart,
      onGroupDragOver,
      onGroupDrop,
      onGroupDragEnd,
      toggleGroupCollapsed,
      collapseAllGroups,
      expandAllGroups,
      findGroupForRowId,
      groupGridApis,
      alignedGridApisForGroup,
      groupHorizontalScrollRef,
      groupHorizontalScrollWidth,
      groupHorizontalViewportWidth,
      groupHorizontalScrollLeft,
      hasGroupHorizontalOverflow,
      onGroupHorizontalScrollbarScroll,
      onGroupBodyScroll,
      groupInfiniteCounts,
      groupRowClassRules,
      // ========== /GROUPING EXPORTS ==========
      // ========== CELL EDITING EXPORTS (S6) ==========
      columnDefs,
      _lastActiveCellEdit,
      getRowId,
      onActionTrigger,
      onCellEditRequest,
      onCellEditingStarted,
      onCellEditingStopped,
      onRowEditingStarted,
      onRowEditingStopped,
      onCellValueChanged,
      onRowClicked,
      onCustomCellEdit,
      // ========== GRID ACTIONS EXPORTS (S6) ==========
      setCellValue,
      triggerCellValueChanged,
      refreshRow,
      stopCellEditing,
      createRecord,
      closeCreateRecordForm,
      resetFilters,
      resetSort,
      deselectAll,
      selectAll,
      selectRow,
      deselectRow,
      removeRow,
      applyFocusedRow,
      // ========== S7 INLINED LEFTOVERS ==========
      cfg,
      isEditing,
      invalidEditValueMode,
      paginationPageSizeSelector,
      reportPerformance,
      resetPerformance,
      formatItemCount,
      /* wwEditor:start */
      createElement,
      rawContent,
      checkIfColumnsStructureChanged,
      generateColumns,
      getOnActionTestEvent,
      getOnCellValueChangedTestEvent,
      getSelectionTestEvent,
      getRowClickedTestEvent,
      getRowDraggedTestEvent,
      getRowDragStartTestEvent,
      getColumnMovedTestEvent,
      getColumnResizedTestEvent,
      getCellEditStartTestEvent,
      getCellEditEndTestEvent,
      getScrollTestEvent,
      /* wwEditor:end */
    };
  },
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
.record-create-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(1px);
}

.record-create-popup {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  width: fit-content;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-create-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.record-create-popup-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  font-family: inherit;
}

.record-create-popup-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.record-create-popup-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  flex: 1;
}

.ww-datagrid {
  position: relative;
  isolation: isolate; // Create a new stacking context to contain AG Grid elements
  box-sizing: border-box; // padding stays inside cfg.height so we don't exceed the WeWeb wrapper
  min-height: 0; // let a flex-parent (WeWeb wrapper) actually constrain us
  // Background of the grid surface (covers the gaps between stacked groups
  // in grouped mode and the area around the grid body in single-grid mode).
  // Driven by cfg.gridBackgroundColor → cssVars; defaults to transparent so
  // unconfigured grids show whatever sits behind them.
  background: var(--ww-data-grid_grid-background, transparent);
  // Hard cap at the WeWeb wrapper's bounds. Wins over any inline cfg.height
  // and prevents auto-layout grouped mode (stacked autoHeight grids) from
  // pushing past the wrapper.
  max-width: 100%;
  max-height: 100%;

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

  // Promote the main scroll container to its own GPU compositor layer.
  // will-change:scroll-position tells the browser to create a separate layer
  // before the user starts scrolling, avoiding layer-promotion jank mid-scroll.
  :deep(.ag-body-viewport) {
    will-change: scroll-position;
  }
  
  // Remove minimum height when using auto height layout
  // AG Grid sets a 150px minimum height by default for auto height to avoid empty grids
  // This removes that minimum height as per AG Grid documentation
  :deep(.ag-center-cols-viewport) {
    min-height: 75px !important;
  }
  
  // Improve virtualization for large datasets
  :deep(.ag-center-cols-container) {
    min-height: 0 !important;
  }
}

.ww-datagrid {
  
  :deep(.ag-body-viewport) {
    overflow-y: auto !important;
  }

  // Always-visible, simple horizontal scrollbar (single-grid mode)
  // Pinned to the bottom of the component, above all grid content.
  :deep(.ag-body-horizontal-scroll),
  :deep(.ag-body-horizontal-scroll-viewport),
  :deep(.ag-horizontal-left-spacer),
  :deep(.ag-horizontal-right-spacer) {
    height: 14px !important;
    min-height: 14px !important;
    max-height: 14px !important;
  }

  :deep(.ag-body-horizontal-scroll) {
    position: sticky !important;
    bottom: 0 !important;
    z-index: 100 !important;
    background: #f1f1f1;
  }

  // Ensure pinned-column spacers also show the scrollbar background
  // (so the bar renders edge-to-edge even under pinned action columns)
  :deep(.ag-horizontal-left-spacer),
  :deep(.ag-horizontal-right-spacer) {
    background: #f1f1f1 !important;
    overflow: hidden !important;
    pointer-events: none;
  }

  :deep(.ag-body-horizontal-scroll-viewport) {
    overflow-x: scroll !important;
    scrollbar-width: auto;
    scrollbar-color: #888 #f1f1f1;

    &::-webkit-scrollbar {
      height: 14px;
      width: 14px;
      -webkit-appearance: none;
      appearance: none;
    }
    &::-webkit-scrollbar-button,
    &::-webkit-scrollbar-button:single-button,
    &::-webkit-scrollbar-button:start:decrement,
    &::-webkit-scrollbar-button:end:increment,
    &::-webkit-scrollbar-button:horizontal:start:decrement,
    &::-webkit-scrollbar-button:horizontal:end:increment,
    &::-webkit-scrollbar-button:vertical:start:decrement,
    &::-webkit-scrollbar-button:vertical:end:increment {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    &::-webkit-scrollbar-corner {
      background: transparent;
    }
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 0;
    }
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 0;

      &:hover {
        background: #555;
      }
    }
  }

  // Ensure header and body rows stay aligned during horizontal scroll
  :deep(.ag-header-row),
  :deep(.ag-row) {
    // Use hardware acceleration for better scroll performance
    transform: translateZ(0);
    backface-visibility: hidden;
    // contain:style tells the browser that style changes inside a row don't
    // affect sibling rows, eliminating cross-row style recalculation during scroll.
    contain: style;
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
    // Isolate style recalculations within each cell to avoid cascade invalidations
    contain: style;
  }
  
  :deep(.ag-cell-wrapper),
  :deep(.ag-cell-value) {
    height: 100%;
  }
  
  // Per-column-type header icon (rendered by ColumnTypeHeader innerHeaderComponent)
  :deep(.cc-header-inner) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }
  :deep(.cc-col-type-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    opacity: 0.6;

    svg {
      width: 1em;
      height: 1em;
      display: block;
    }
  }
  :deep(.cc-col-type-name) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  inset: 0;
  z-index: 5;
  // Span the whole wrapper so the panel can be sized against it, but let
  // clicks fall through to the grid everywhere except the panel itself.
  pointer-events: none;
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
  border-left: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-header-foreground-color, #ccc));
  line-height: 1;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
  }

  &.has-hidden {
    color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
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
  background: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

// Panel
.cc-panel {
  position: absolute;
  top: 4px;
  right: 0;
  pointer-events: auto;
  width: 760px;
  max-width: calc(100% - 16px);
  box-sizing: border-box;
  background: var(--ww-data-grid_cc-background, var(--ag-background-color, #1e2228));
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: var(--ww-data-grid_cc-border-radius, 8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  z-index: 1000;
  // Stay inside the wrapper with a 12px gap at the bottom (4px top offset + 12px).
  max-height: calc(100% - 16px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Work Sans', sans-serif;

  // Apply Work Sans to all text descendants
  *, *::before, *::after {
    font-family: 'Work Sans', sans-serif;
  }
}

// Mobile: the column-chooser panel becomes a near-full-screen sheet so the
// columns / grouping / filters lists have room and stay touch-usable.
.ww-datagrid.is-mobile {
  .cc-panel {
    top: 8px;
    right: 8px;
    left: 8px;
    width: auto;
    max-width: none;
    max-height: calc(100% - 16px);
  }

  // Bigger touch targets in the header (sort/menu icons) and a thicker grouped
  // horizontal scrollbar so it can be grabbed with a finger.
  :deep(.ag-header-cell),
  :deep(.ag-header-group-cell) {
    touch-action: manipulation;
  }

  &.grouped .ww-group__hscroll {
    height: 18px;
    flex-basis: 18px;
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
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  padding: 0;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  }
}

// ==================== Chooser tabs (Columns / Grouping) ====================
.cc-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.08)));
}

.cc-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; // overlap parent border
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  border-radius: 4px 4px 0 0;

  &:hover:not(.cc-tab--active) {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-tab--active {
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    border-bottom-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    font-weight: 600;
  }
}

// ==================== Grouping tab content ====================
.cc-group-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.06)));
}

.cc-group-select-label {
  font-size: 12px;
  font-weight: 500;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  flex: 0 0 auto;
}

.cc-group-select {
  flex: 1;
  appearance: none;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.12)));
  border-radius: 6px;
  padding: 6px 28px 6px 10px;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%239aa0aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s, background-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  }

  &:focus {
    outline: none;
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 25%, transparent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  option {
    background: var(--ww-data-grid_cc-background, var(--ag-background-color, #1f2125));
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  }
}

.cc-group-loading-dot {
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--ww-data-grid_cc-text-color, #94a3b8) 28%, transparent);
  border-top-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  border-radius: 999px;
  animation: ww-group-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.cc-group-actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px 6px;
}

.cc-group-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.12)));
  border-radius: 6px;
  font-size: 12px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #d1d5db));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  svg {
    color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
    flex-shrink: 0;
  }

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 12%, transparent);
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
    svg { color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)); }
  }
}

.cc-group-list-label {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
}

.cc-group-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin: 4px 6px 0;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #1f2329));
  transition: background 0.12s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #000000) 8%, transparent);
  }

  .cc-group-toggle-label {
    flex: 1;
    line-height: 1.2;
  }
}

.cc-group-list {
  display: flex;
  flex-direction: column;
  padding: 0 6px 8px;
  max-height: 320px;
  overflow-y: auto;
}

.cc-group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
  transition: background 0.12s, transform 0.12s;

  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-group-row--dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  &.cc-group-row--drag-over {
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 16%, transparent);
    box-shadow: inset 0 2px 0 0 var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
  }
}

.cc-group-row__swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15) inset;
}

.cc-group-row__label {
  flex: 1;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-group-row__count {
  flex-shrink: 0;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 10%, transparent);
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}

// Conditional Styling tab
.cc-styling-actions {
  padding: 10px 14px 4px;
}
.cc-styling-add-btn {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  background: transparent;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  font-size: 13px;
  cursor: pointer;
  &:hover {
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #2196F3) 8%, transparent);
    border-color: var(--ww-data-grid_cc-accent-color, #2196F3);
  }
}
.cc-styling-list {
  padding: 6px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}
.cc-styling-rule {
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: 6px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 3%, transparent);
  &--dragging { opacity: 0.5; }
  &--drag-over { border-color: var(--ww-data-grid_cc-accent-color, #2196F3); }
}
.cc-styling-rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
.cc-styling-rule-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  font-size: 11px;
  flex-shrink: 0;
}
.cc-styling-rule-name {
  flex: 1;
  font-size: 13px;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-styling-rule-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 60%, transparent);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  &:hover { color: #e74c3c; background: color-mix(in srgb, #e74c3c 10%, transparent); }
}
.cc-styling-rule-body {
  padding: 4px 10px 12px;
  border-top: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-styling-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-styling-field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 60%, transparent);
}
.cc-styling-input {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 5%, transparent);
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  font-size: 13px;
  outline: none;
  &:focus { border-color: var(--ww-data-grid_cc-accent-color, #2196F3); }
}
.cc-styling-input--value { min-width: 0; flex: 1; }
.cc-styling-token {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ww-data-grid_cc-accent-color, #2196F3);
  border-color: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #2196F3) 45%, transparent);
  background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #2196F3) 14%, transparent);
  font-weight: 500;
}
.cc-styling-token-glyph {
  font-weight: 700;
  letter-spacing: -1px;
  color: #9aa0aa;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  :deep(svg) { width: 15px; height: 15px; }
}
.cc-styling-token-x {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  margin-left: auto;
  padding: 0 2px;
  opacity: 0.75;
  &:hover { opacity: 1; }
}
.cc-styling-select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 5%, transparent);
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  font-size: 12px;
  outline: none;
  min-width: 0;
  flex: 1;
}
.cc-styling-condition-wrap {
  margin-bottom: 6px;
}
.cc-styling-condition {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cc-styling-picker-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  text-align: left;
  cursor: pointer;
  &--placeholder { color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #9aa0aa)) 60%, transparent); }
  &--open { border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6)); }
}
.cc-styling-picker-summary {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-styling-picker-chevron {
  flex-shrink: 0;
  opacity: 0.7;
  transition: transform 0.15s;
}
.cc-styling-picker-toggle--open .cc-styling-picker-chevron {
  transform: rotate(180deg);
}
.cc-styling-picker-inline {
  margin-top: 6px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.12)));
  border-radius: 6px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 4%, transparent);
  overflow: hidden;
}
.cc-styling-condition-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 50%, transparent);
  padding: 2px 4px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:hover:not(:disabled) { color: #e74c3c; background: color-mix(in srgb, #e74c3c 10%, transparent); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
}
.cc-styling-add-condition-btn {
  background: none;
  border: none;
  color: var(--ww-data-grid_cc-accent-color, #2196F3);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 0;
  text-align: left;
  &:hover { text-decoration: underline; }
}
.cc-styling-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.cc-styling-row--colors {
  gap: 10px;
}
.cc-styling-color-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
// Pill-shaped color control: hidden native input covers the whole control so
// clicking anywhere opens the picker. Inline swatch + hex preview keeps the
// affordance obvious without the tiny OS-default 36×28 chip.
.cc-styling-color-control {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 8px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  border-radius: 6px;
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 5%, transparent);
  cursor: pointer;
  min-width: 0;
  height: 32px;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover { border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6)); }
  &:focus-within {
    border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b82f6) 25%, transparent);
  }
}
.cc-styling-color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  flex-shrink: 0;
}
.cc-styling-color-swatch--empty {
  background:
    linear-gradient(45deg, transparent 45%, #e74c3c 45%, #e74c3c 55%, transparent 55%),
    color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 8%, transparent);
}
.cc-styling-color-value {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.cc-styling-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.cc-styling-clear-color {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 60%, transparent);
  flex-shrink: 0;
  &:hover { color: #e74c3c; background: color-mix(in srgb, #e74c3c 12%, transparent); }
}

.cc-styling-toggle-group {
  display: inline-flex;
  gap: 6px;
}
.cc-styling-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.18)));
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 5%, transparent);
  color: var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed));
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s;
  &:hover { border-color: var(--ww-data-grid_cc-accent-color, var(--ag-accent-color, #3b82f6)); }
  &--active {
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #2196F3) 20%, transparent);
    border-color: var(--ww-data-grid_cc-accent-color, #2196F3);
    color: var(--ww-data-grid_cc-accent-color, #2196F3);
  }
  svg { display: block; }
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
  background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  border: 1px solid var(--ww-data-grid_cc-border-color, var(--ag-border-color, rgba(255,255,255,0.1)));
  border-radius: 6px;
  padding: 6px 10px;
}

.cc-search-icon {
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
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
      border: 2px solid var(--ww-data-grid_cc-background, #fff);
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
      background: var(--ww-data-grid_cc-background, #fff);
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
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 18%, transparent);
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
    background: color-mix(in srgb, var(--ww-data-grid_cc-text-color, #ffffff) 7%, transparent);
  }

  &.cc-row--drag-over {
    border-left-color: var(--ww-data-grid_cc-accent-color, var(--ag-active-color, #3b9eff));
    background: color-mix(in srgb, var(--ww-data-grid_cc-accent-color, #3b9eff) 12%, transparent);
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
  color: color-mix(in srgb, var(--ww-data-grid_cc-text-color, var(--ag-foreground-color, #e8eaed)) 62%, transparent);
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

// ===========================================================================
// Grouping feature styles
// ===========================================================================

.ww-datagrid.grouped {
  display: flex !important;
  flex-direction: column !important;
  row-gap: 14px;
  // Padding is 0 on every side. The visual breathing room above the first
  // group (formerly padding-top: 16px) now lives on the first .ww-group's
  // margin-top so that the scrollport's top edge is flush with the first
  // sticky .ww-group__header — otherwise rows scrolling past would appear
  // in the padding-top strip behind/above the sticky header (depends on
  // browser handling of padding-top + position:sticky).
  // The sticky .ww-group__hscroll bar provides the visual bottom inset, so
  // no padding-bottom either. Horizontal padding stays 0 so .ww-group__hscroll
  // can span the full component width — matching the single-grid and kanban
  // views. The 4px horizontal breathing room is applied as margin on each
  // .ww-group (see below). !important is kept because the host wrapper
  // sometimes resets padding on the root element.
  padding: 0 !important;

  > .ww-group {
    margin: 0 4px;

    // Visual breathing room above the first group, replacing the former
    // container padding-top. Lives on the group itself so that, once the
    // user scrolls, this margin scrolls out of view and the sticky header
    // pins flush against the top of the scrollport.
    &:first-child {
      margin-top: 16px;
    }
  }
  // Fixed-layout only: each per-group ag-grid uses domLayout="autoHeight" so
  // it sizes to its own row count. Without overflow handling here, the
  // stacked groups would blow past the configured Grid Height (cfg.height).
  // overflow-y:auto makes the container respect that height and scroll
  // through the groups internally — and gives the sticky scrollbar below a
  // scroll context to stick within.
  // In auto-layout mode (handled below) the component sizes to content and
  // the WeWeb wrapper is the scrolling ancestor, so we deliberately do NOT
  // set overflow-y here — that would make .ww-datagrid.grouped the scrolling
  // ancestor of the sticky bar (even though it doesn't actually scroll),
  // preventing the bar from sticking to the wrapper viewport.
  &:not(.ww-datagrid--auto-layout) {
    overflow-y: auto;
  }

  // Shared horizontal scrollbar pinned to the bottom of the grouped
  // component. Drives every group's horizontal scroll via the composable's
  // onGroupHorizontalScrollbarScroll handler, kept in sync the other way
  // by each ag-grid-vue's @body-scroll → onGroupBodyScroll.
  .ww-group__hscroll {
    position: sticky;
    bottom: 0;
    // Push the bar to the bottom of the flex column when the stacked groups
    // don't fill the container — without this, position:sticky has nothing
    // to stick against and the bar lays out directly under the last group.
    // No-op when groups overflow (no free space) so the sticky-while-
    // scrolling behaviour is preserved.
    margin-top: auto;
    width: 100%;
    height: 14px;
    min-height: 14px;
    // Prevent the flex column layout from shrinking the bar when groups
    // expand to fill the container.
    flex: 0 0 14px;
    overflow-x: auto;
    overflow-y: hidden;
    z-index: 100;
    background: #f1f1f1;
    scrollbar-width: auto;
    scrollbar-color: #888 #f1f1f1;

    &::-webkit-scrollbar {
      height: 14px;
      width: 14px;
      -webkit-appearance: none;
      appearance: none;
    }
    &::-webkit-scrollbar-button,
    &::-webkit-scrollbar-button:single-button,
    &::-webkit-scrollbar-button:start:decrement,
    &::-webkit-scrollbar-button:end:increment,
    &::-webkit-scrollbar-button:horizontal:start:decrement,
    &::-webkit-scrollbar-button:horizontal:end:increment {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    &::-webkit-scrollbar-corner {
      background: transparent;
    }
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 0;
    }
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 0;

      &:hover {
        background: #555;
      }
    }
  }

  .ww-group__hscroll-spacer {
    height: 1px;
  }
}

.ww-group-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ag-background-color, #ffffff) 68%, transparent);
  backdrop-filter: blur(2px);
  pointer-events: all;
}

.ww-group-loading-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 999px;
  background: var(--ag-background-color, #ffffff);
  border: 1px solid var(--ag-border-color, rgba(0, 0, 0, 0.12));
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
  color: var(--ag-foreground-color, #111827);
  font-size: 13px;
  font-weight: 600;
}

.ww-group-loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top-color: var(--ag-accent-color, #3b82f6);
  border-radius: 999px;
  animation: ww-group-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.group-loading-fade-enter-active,
.group-loading-fade-leave-active {
  transition: opacity 0.16s ease;
}

.group-loading-fade-enter-from,
.group-loading-fade-leave-to {
  opacity: 0;
}

@keyframes ww-group-spin {
  to {
    transform: rotate(360deg);
  }
}

// .ww-group-toolbar removed — its buttons now live in the chooser panel's
// Grouping tab (.cc-group-actions / .cc-group-action-btn).

.ww-group {
  // Approximate rendered height of .ww-group__header (10px top/bottom
  // padding + ~18px content row). Consumed by the sticky :deep(.ag-header)
  // rule inside .ww-group__grid so the column header pins immediately
  // below the group title row. Defined here on the common parent so it
  // cascades to both children.
  --ww-group-header-height: 38px;
  display: flex;
  flex-direction: column;
  // No border on the .ww-group container itself. The neutral 1 px border
  // (matching the single-grid wrapperBorder) is scoped to whichever child
  // is actually visible:
  //   - expanded → .ww-group__grid carries the border (title floats outside)
  //   - collapsed → .ww-group--collapsed .ww-group__header carries the border
  // Same thing for the 4 px coloured left line. This makes the title row
  // visually escape the group's container in expanded state.
  // No overflow:hidden — column filter / menu popups inside the grid need
  // to extend past the group's bottom edge.
  transition: opacity 0.15s ease, box-shadow 0.15s ease;


  &.ww-group--dragging {
    opacity: 0.45;
  }

  &.ww-group--drag-over {
    box-shadow: 0 0 0 2px var(--ag-active-color, #3b9eff);
  }

  // Cross-group row-drag drop target. Class is toggled by useGrouping on
  // addRowDropZone's onDragEnter / onDragLeave callbacks while a row from
  // another group is hovered over this container — gives the user clear
  // feedback about where the drop would land. Distinct from
  // .ww-group--drag-over (which is for reordering group headers).
  &.ww-group--drop-target {
    box-shadow: 0 0 0 2px var(--group-color, #10b981);
    background: color-mix(in srgb, var(--group-color, #10b981) 6%, transparent);
  }

  // Collapsed: the title row IS the group's only visible surface, so it
  // carries both the 4 px coloured line and the neutral 1 px border +
  // radius (matching the single-grid wrapperBorder).
  &.ww-group--collapsed .ww-group__header {
    border: 1px solid var(--ww-data-grid_group-border-color, #ECECEC);
    border-left: 4px solid var(--group-color);
    border-radius: var(--ww-data-grid_group-border-radius, 8px);
  }
}

.ww-group__header {
  --group-color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: grab;
  user-select: none;
  font-family: inherit;
  // Pin the header to the top of the scrolling ancestor so the group name
  // stays visible while the user scrolls deep into a long group. Stacks
  // naturally: header A pins until group A's bottom edge passes the top,
  // then header B replaces it.
  position: sticky;
  top: 0;
  // Kept below .column-chooser-container (z-index: 5) so the column
  // chooser panel (.cc-panel) and any other floating menus stack above
  // this sticky header — z-index on a sticky element creates a stacking
  // context, so a higher value here would trap floating menus visually
  // beneath it. z: 2 still wins against AG Grid row content (which sits
  // at z: auto inside .ag-body-viewport), so rows scrolling past are
  // still covered.
  z-index: 2;
  // Opaque background so scrolled rows do not bleed through the sticky
  // header. Uses the AG Grid theme background to match light/dark themes.
  background: var(--ag-background-color, #ffffff);
  // No border-radius. The colored 4 px left line is applied conditionally
  // via `.ww-group--collapsed .ww-group__header` (defined on the .ww-group
  // block above) so the line only appears when the group is collapsed;
  // when expanded the title "floats" with no chrome around it.

  &:active {
    cursor: grabbing;
  }
}

.ww-group__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--group-color);
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: color-mix(in srgb, var(--group-color) 20%, transparent);
  }

  &.ww-group__chevron--open {
    transform: rotate(90deg);
  }
}

.ww-group__title-block {
  display: flex;
  // Default (expanded): inline — count sits right next to the title with
  // a small gap, balancing the freed-up horizontal space the title row
  // gains when it floats outside the grid border.
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;

  // Collapsed: stack title over count (matches the original reference
  // mock — collapsed groups read like a small "PARIS\n18 Éléments" pill).
  .ww-group--collapsed & {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }
}

.ww-group__label {
  font-size: 13px;
  font-weight: 600;
  color: color-mix(in srgb, var(--group-color) 80%, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.ww-group__items {
  font-size: 11px;
  font-weight: 500;
  // Use the user-configured Text color (cfg.textColor → --ag-foreground-color).
  color: var(--ag-foreground-color, #6b7280);
  opacity: 0.75;
  line-height: 1.2;
  white-space: nowrap;
}

// Invisible sentinel inserted at the bottom of each expanded group's DOM
// (after the AG Grid). Observed by useGrouping.observeGroupLoadMoreSentinel
// — when it scrolls into the viewport-bottom margin the next paged-append
// block fetches for that group. Per-group grids run with autoHeight so
// their bodies don't scroll; this sentinel rides the outer container's
// scroll context.
.ww-group__load-more-sentinel {
  height: 1px;
  width: 100%;
  pointer-events: none;
}

.ww-group__grid {
  width: 100%;
  min-height: 0;
  // overflow MUST stay non-clipping (visible) so position:sticky on the
  // inner .ag-header can pin against the outer scroll context
  // (.ww-datagrid.grouped, or the WeWeb wrapper in auto-layout mode). Any
  // overflow:hidden on this element or on the AG Grid wrapper ancestors
  // below would trap sticky inside the per-group grid and break it. The
  // border-radius corner clipping that overflow:hidden used to provide is
  // visually negligible here because AG Grid in autoHeight mode sizes its
  // content to match this container exactly — nothing extends past the
  // rounded corners in normal use.
  overflow: visible;
  // 4 px coloured line on the left + the neutral 1 px wrapperBorder + the
  // configured wrapperBorderRadius. The grid is what carries the bordered
  // "card" look in expanded mode — the title row above sits OUTSIDE the
  // border so it visually escapes the group container. Element is
  // rendered only when expanded (v-if="!group.collapsed"); collapsed
  // groups carry the same chrome on the title row instead (see
  // `.ww-group--collapsed .ww-group__header`).
  border: 1px solid var(--ww-data-grid_group-border-color, #ECECEC);
  border-left: 4px solid var(--group-color, #9ca3af);
  border-radius: var(--ww-data-grid_group-border-radius, 8px);

  // Suppress AG Grid's own wrapper border so it doesn't double up against
  // the per-group container border above. The single-grid mode still
  // picks it up via the shared theme; only per-group grids drop it.
  // Also unclip overflow on every wrapper between .ag-header and the
  // outer scroll context so the sticky column header can pin properly
  // (see overflow:visible note above).
  :deep(.ag-root-wrapper) {
    border: 0 !important;
    overflow: visible !important;
  }
  :deep(.ag-root-wrapper-body),
  :deep(.ag-root) {
    overflow: visible !important;
  }

  // Pin the AG Grid column header just below the group title row so the
  // column names stay visible while scrolling through a long group. Sticky
  // is released when .ww-group__grid (the containing block) exits the
  // viewport — i.e., when the user scrolls past this group's rows — so
  // the next group's column header takes over naturally.
  // z: 1 keeps the header above row content (rows render at z: auto inside
  // the body viewport) but below .ww-group__header (z: 2) and below the
  // column-chooser panel (.column-chooser-container at z: 5). A higher
  // value here would trap floating menus opened from inside the column
  // header beneath this sticky element's stacking context.
  :deep(.ag-header) {
    position: sticky;
    top: var(--ww-group-header-height, 38px);
    z-index: 1;
  }

  // Per-group grids run with domLayout="autoHeight" — they should hug their
  // rows. The .ww-datagrid-wide rule sets a 75px floor on .ag-center-cols-viewport
  // (useful for single-grid mode to avoid an empty-looking grid); reset it
  // here so a group with one or two rows doesn't get padded out with whitespace.
  :deep(.ag-center-cols-viewport) {
    min-height: 0 !important;
  }

  // Empty group: AG Grid renders a noRowsOverlay ("Aucune ligne à afficher")
  // when rowData is empty, but with autoHeight the body collapses to 0px
  // and pins the overlay container (.ag-overlay) to the same height — any
  // min-height on the wrapper inside is then clipped by the parent. The
  // fix is to force a floor on the body itself, scoped via :has() so it
  // only applies when the no-rows overlay wrapper is actually in the DOM
  // (AG Grid mounts/removes that wrapper as the overlay shows/hides).
  // Non-empty groups still match the :deep(.ag-center-cols-viewport)
  // min-height:0 rule above and continue to hug their rows.
  :deep(.ag-root-wrapper:has(.ag-overlay-no-rows-wrapper)) .ag-body-viewport,
  :deep(.ag-root-wrapper:has(.ag-overlay-no-rows-wrapper)) .ag-center-cols-viewport {
    min-height: var(--ww-data-grid_row-height, 40px) !important;
  }

  // Row whose grouping-column value no longer matches its grid's group.
  // After applyTransaction({ remove }), AG Grid keeps the old row nodes in
  // DOM (animateRows + the row buffer) until the next viewport invalidation
  // — so the source group can flash a list of phantom rows whose statuses
  // are visibly wrong. Hide them outright instead of fading: the row count
  // badge already reflects the post-move state, so the rule cleanly drops
  // anything AG Grid hasn't released yet.
  :deep(.ag-row.ww-row-leaving) {
    display: none !important;
  }

  // Hide infinite-cache loading placeholder rows so they don't show as
  // empty rows inside a group while a block is being fetched.
  :deep(.ag-row.ww-row-loading) {
    display: none !important;
  }

  // Fade the source row while it's being dragged so the user sees it lift
  // out of the group. AG Grid adds .ag-row-dragging during managed drag.
  :deep(.ag-row.ag-row-dragging) {
    opacity: 0.4;
    transition: opacity 0.15s ease-out;
  }

  // Ghost preview row: inserted into a dest grid while the cursor hovers
  // over it during drag (see useGrouping.handleCrossGroupDragEnter). Reads
  // as "not really here yet" — desaturated, dimmed, dashed border — until
  // the drop turns it into a real row (class stripped in handleCrossGroupDrop).
  :deep(.ag-row.ww-row-drag-preview) {
    opacity: 0.45;
    filter: grayscale(0.85);
    background-color: rgba(0, 0, 0, 0.03) !important;
    pointer-events: none;
    transition: opacity 0.15s ease-out, filter 0.15s ease-out;
  }
}

// Every per-group grid hides AG Grid's native horizontal scrollbar — the
// shared sticky .ww-group__hscroll bar at the bottom of .ww-datagrid.grouped
// drives all groups via `alignedGrids` + onGroupBodyScroll.
.ww-group__grid {
  :deep(.ag-body-horizontal-scroll) {
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
  }

  :deep(.ag-body-horizontal-scroll-viewport) {
    overflow-x: hidden !important;
  }
}


</style>
