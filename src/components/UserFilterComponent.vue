<template>
    <div class="user-filter">
        <div v-if="isLoadingUsers || isLoadingUsersState" class="user-filter-empty">
            <div class="loading-with-refresh">
                <span>Loading users...</span>
                <button 
                    type="button" 
                    class="refresh-btn" 
                    @click="refreshUsers"
                    title="Refresh users list"
                >
                    <span class="refresh-icon">↻</span>
                </button>
            </div>
        </div>
        <div v-else class="user-filter-content">
            <!-- Search Input -->
            <div class="user-search-container">
                <input
                    ref="searchInput"
                    v-model="searchQuery"
                    type="text"
                    class="user-search-input"
                    :placeholder="searchPlaceholder"
                    @input="highlightedIndex = -1"
                    @keydown.escape.stop="onReset"
                    @keydown.arrow-down.prevent="highlightNextUser"
                    @keydown.arrow-up.prevent="highlightPreviousUser"
                    @keydown.enter.prevent="selectHighlightedUser"
                />
            </div>
            
            <!-- Selected Users Pills -->
            <div v-if="selectedUserNames.length > 0" class="selected-users-pills">
                <div 
                    v-for="userName in selectedUserNames" 
                    :key="userName"
                    class="user-pill"
                >
                    <span class="pill-name">{{ userName }}</span>
                    <button 
                        class="pill-remove"
                        @click.stop="removeUserName(userName)"
                        type="button"
                    >×</button>
                </div>
            </div>
            
            <!-- Users List -->
            <div class="user-list">
                <div 
                    v-for="(user, index) in filteredUsers" 
                    :key="user.id"
                    class="user-option"
                    :class="{ 
                        'selected': isUserNameSelected(user),
                        'highlighted': index === highlightedIndex
                    }"
                    :style="getUserOptionStyle(user)"
                    @click="toggleUser(user)"
                    @mouseenter="highlightedIndex = index"
                >
                    <img 
                        :src="user.avatar_url || getDefaultAvatar(user)" 
                        :alt="getUserName(user)"
                        class="option-avatar"
                    />
                    <div class="option-info">
                        <div class="option-name">{{ getUserName(user) }}</div>
                        <div v-if="user.bio" class="option-bio">{{ user.bio }}</div>
                    </div>
                    <div v-if="isUserNameSelected(user)" class="option-check">✓</div>
                </div>
                <div v-if="filteredUsers.length === 0" class="no-users">
                    No users found
                </div>
            </div>
            
            <!-- Filter Actions -->
            <div class="user-filter-actions">
                <button
                    type="button"
                    class="filter-btn reset"
                    :disabled="!canReset"
                    @click="onReset"
                >
                    {{ translations.reset }}
                </button>
                <button
                    type="button"
                    class="filter-btn apply"
                    :disabled="!canApply"
                    @click="onApply"
                >
                    {{ translations.apply }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "UserFilterComponent",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    // Expose methods for AG Grid filter interface
    expose: ['getGui', 'isFilterActive', 'doesFilterPass', 'getModel', 'setModel', 'onParentModelChanged', 'refresh'],
    created() {
        // Try to load users immediately when component is created
        // This helps in production where reactive properties might not be immediately available
        if (this.params) {
            const colDef = this.params.colDef || {};
            const filterParams = colDef.filterParams || this.params.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Try filterParams first
            if (filterParams && Object.keys(filterParams).length > 0) {
                this.setUserParams(filterParams);
            }
            
            // If still no users, try editor params
            if (this.availableUsers.length === 0 && editorParams && Object.keys(editorParams).length > 0) {
                this.setUserParams(editorParams);
            }
            
            // If still no users, try renderer params
            if (this.availableUsers.length === 0 && rendererParams && Object.keys(rendererParams).length > 0) {
                this.setUserParams(rendererParams);
            }
        }
    },
    data() {
        return {
            userParams: {},
            availableUsers: [],
            searchQuery: "",
            highlightedIndex: -1,
            pendingSelection: new Set(), // Store user names
            appliedSelection: new Set(), // Store user names
            refreshTimer: null,
            loadingStartTime: null, // Track when loading started
        };
    },
    computed: {
        filteredUsers() {
            if (!this.searchQuery.trim()) {
                return this.availableUsers;
            }
            
            const query = this.searchQuery.toLowerCase();
            return this.availableUsers.filter(user => {
                const name = this.getUserName(user).toLowerCase();
                const email = (user.email || "").toLowerCase();
                const bio = (user.bio || "").toLowerCase();
                return name.includes(query) || email.includes(query) || bio.includes(query);
            });
        },
        selectedUserNames() {
            return Array.from(this.pendingSelection);
        },
        isLoadingUsers() {
            // Priority: Show data if available, regardless of isLoading flag
            const hasUsers = Array.isArray(this.availableUsers) && this.availableUsers.length > 0;
            const isLoading = !!this.userParams?.isLoading;
            
            // If we have users, never show loading
            if (hasUsers) {
                this.loadingStartTime = null; // Reset loading timer
                return false;
            }
            
            // Only show loading if flag is true AND we don't have users
            // Add timeout: if loading > 3s, show refresh button instead
            if (isLoading && !hasUsers) {
                // Track when loading started
                if (!this.loadingStartTime) {
                    this.loadingStartTime = Date.now();
                }
                
                // Check if we've been loading too long (> 3 seconds)
                const loadingDuration = Date.now() - this.loadingStartTime;
                if (loadingDuration > 3000) {
                    // Stop showing loading, show refresh button instead
                    return false;
                }
                return true;
            }
            
            // Reset loading timer if not loading
            this.loadingStartTime = null;
            return false;
        },
        translations() {
            const filterParams = this.params?.colDef?.filterParams || this.params?.filterParams || {};
            const defaultTranslations = { reset: 'Reset', apply: 'Apply' };
            return filterParams.translations || defaultTranslations;
        },
        canApply() {
            if (!this.pendingSelection.size && !this.appliedSelection.size) {
                return false;
            }
            return !this.areSetsEqual(this.pendingSelection, this.appliedSelection);
        },
        canReset() {
            return this.pendingSelection.size > 0 || this.appliedSelection.size > 0;
        },
        userFocusColor() {
            return this.userParams?.userFocusColor || null;
        },
        searchPlaceholder() {
            const locale = navigator.language || navigator.userLanguage || 'en';
            const lang = locale.split('-')[0].toLowerCase();
            
            const translations = {
                'en': 'Search users...',
                'fr': 'Rechercher des utilisateurs...',
                'es': 'Buscar usuarios...',
                'de': 'Benutzer suchen...',
                'pt': 'Pesquisar usuários...',
                'it': 'Cerca utenti...',
                'nl': 'Zoek gebruikers...',
                'pl': 'Szukaj użytkowników...',
                'ru': 'Поиск пользователей...',
                'ja': 'ユーザーを検索...',
                'zh': '搜索用户...',
                'ko': '사용자 검색...',
            };
            
            return translations[lang] || translations['en'];
        },
        isLoadingUsersState() {
            // Check if we should show refresh button (loading > 3s with no users)
            const hasUsers = Array.isArray(this.availableUsers) && this.availableUsers.length > 0;
            const isLoading = !!this.userParams?.isLoading;
            
            if (hasUsers) return false;
            if (!isLoading) return false;
            
            if (this.loadingStartTime) {
                const loadingDuration = Date.now() - this.loadingStartTime;
                return loadingDuration > 3000;
            }
            
            return false;
        },
    },
    mounted() {
        this.initializeUsers();
        this.syncSelectionsFromModel(null, { updateApplied: true });
        
        // Try to initialize users multiple times with different sources
        // This helps in production where reactive properties might not be immediately available
        const tryInitializeUsers = () => {
            if (!this.params) return;
            
            // Try multiple sources
            const colDef = this.params.colDef || {};
            const filterParams = colDef.filterParams || this.params.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Try filterParams first
            if (filterParams && Object.keys(filterParams).length > 0) {
                this.setUserParams(filterParams);
            }
            
            // If still no users, try editor params
            if (this.availableUsers.length === 0 && editorParams && Object.keys(editorParams).length > 0) {
                this.setUserParams(editorParams);
            }
            
            // If still no users, try renderer params
            if (this.availableUsers.length === 0 && rendererParams && Object.keys(rendererParams).length > 0) {
                this.setUserParams(rendererParams);
            }
        };
        
        // Try immediately
        tryInitializeUsers();
        
        // Try again after a short delay (for async loading)
        setTimeout(tryInitializeUsers, 100);
        setTimeout(tryInitializeUsers, 500);
        
        // Set up a periodic check for users (in case they load asynchronously)
        this.refreshTimer = setInterval(() => {
            if (!this.params) return;
            
            const currentUsers = this.getCurrentUsers();
            const currentUsersStr = JSON.stringify(currentUsers || []);
            const availableUsersStr = JSON.stringify(this.availableUsers || []);
            
            if (currentUsersStr !== availableUsersStr) {
                tryInitializeUsers();
            }
        }, 500);
    },
    beforeUnmount() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },
    watch: {
        // Watch for changes in params to refresh users
        'params.colDef.filterParams': {
            handler(newParams) {
                if (newParams) {
                    this.setUserParams(newParams);
                }
            },
            deep: true,
            immediate: true, // Run immediately for production
        },
        // Watch for changes in users array
        'params.colDef.filterParams.users': {
            handler(newUsers, oldUsers) {
                if (newUsers !== oldUsers && Array.isArray(newUsers)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setUserParams(filterParams);
                }
            },
            deep: true,
            immediate: true, // Run immediately for production
        },
        // Watch for changes in cellRendererParams and cellEditorParams users
        'params.colDef.cellRendererParams.users': {
            handler(newUsers, oldUsers) {
                if (newUsers !== oldUsers && Array.isArray(newUsers)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setUserParams(filterParams);
                }
            },
            deep: true,
            immediate: true, // Run immediately for production
        },
        'params.colDef.cellEditorParams.users': {
            handler(newUsers, oldUsers) {
                if (newUsers !== oldUsers && Array.isArray(newUsers)) {
                    const filterParams = this.params?.colDef?.filterParams || {};
                    this.setUserParams(filterParams);
                }
            },
            deep: true,
            immediate: true, // Run immediately for production
        },
    },
    methods: {
        // AG Grid filter interface methods
        getGui() {
            return this.$el;
        },
        getCurrentUsers() {
            if (!this.params) return null;
            
            const colDef = this.params.colDef || {};
            const filterParams = colDef.filterParams || this.params.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Check in priority order: filterParams > editorParams > rendererParams
            // Also check both colDef.filterParams and params.filterParams for compatibility
            if (Array.isArray(filterParams.users) && filterParams.users.length > 0) {
                return filterParams.users;
            }
            if (Array.isArray(editorParams.users) && editorParams.users.length > 0) {
                return editorParams.users;
            }
            if (Array.isArray(rendererParams.users) && rendererParams.users.length > 0) {
                return rendererParams.users;
            }
            
            return null;
        },
        refresh(newParams) {
            // Refresh users when called
            if (this.params) {
                const filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};
                this.setUserParams(filterParams);
            }
            
            return true;
        },
        initializeUsers() {
            if (this.params) {
                const filterParams = this.params.colDef?.filterParams || this.params.filterParams || {};
                this.setUserParams(filterParams);
            }
        },
        setUserParams(filterParams = {}) {
            const colDef = this.params?.colDef || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Also check params.filterParams if filterParams is empty
            const paramsFilterParams = this.params?.filterParams || {};
            if (!filterParams || Object.keys(filterParams).length === 0) {
                filterParams = paramsFilterParams;
            }
            
            // Priority order: filterParams > editorParams > rendererParams
            let users = null;
            let userFocusColor = null;
            let cellFontFamily = null;
            let resolveMappingFormula = null;
            let userIdFormula = null;
            let isLoading = null;
            
            // Try to get from filterParams first
            if (filterParams && typeof filterParams === 'object') {
                if (Array.isArray(filterParams.users) && filterParams.users.length > 0) {
                    users = filterParams.users;
                }
                userFocusColor = filterParams.userFocusColor;
                cellFontFamily = filterParams.cellFontFamily;
                resolveMappingFormula = filterParams.resolveMappingFormula;
                userIdFormula = filterParams.userIdFormula;
                isLoading = filterParams.isLoading;
            }
            
            // Fallback to editor params
            if ((users === null || (Array.isArray(users) && users.length === 0)) && Array.isArray(editorParams.users) && editorParams.users.length > 0) {
                users = editorParams.users;
                if (!userFocusColor) userFocusColor = editorParams.userFocusColor;
                if (!cellFontFamily) cellFontFamily = editorParams.cellFontFamily;
                if (!resolveMappingFormula) resolveMappingFormula = editorParams.resolveMappingFormula;
                if (!userIdFormula) userIdFormula = editorParams.userIdFormula;
                if (isLoading === null || isLoading === undefined) isLoading = editorParams.isLoading;
            }
            
            // Fallback to renderer params
            if ((users === null || (Array.isArray(users) && users.length === 0)) && Array.isArray(rendererParams.users) && rendererParams.users.length > 0) {
                users = rendererParams.users;
                if (!userFocusColor) userFocusColor = rendererParams.userFocusColor;
                if (!cellFontFamily) cellFontFamily = rendererParams.cellFontFamily;
                if (!resolveMappingFormula) resolveMappingFormula = rendererParams.resolveMappingFormula;
                if (!userIdFormula) userIdFormula = rendererParams.userIdFormula;
                if (isLoading === null || isLoading === undefined) isLoading = rendererParams.isLoading;
            }
            
            // Ensure users is always an array
            if (!Array.isArray(users)) {
                users = [];
            }
            
            // If we have users, set isLoading to false (users are available)
            if (users.length > 0) {
                isLoading = false;
            }
            
            this.userParams = {
                users: users,
                userFocusColor: userFocusColor,
                cellFontFamily: cellFontFamily,
                resolveMappingFormula: resolveMappingFormula,
                userIdFormula: userIdFormula,
                isLoading: isLoading || false,
            };
            
            this.availableUsers = [...users];
        },
        getUserName(user) {
            if (user.name) return user.name;
            if (user.firstname || user.lastname) {
                return [user.firstname, user.lastname].filter(Boolean).join(' ');
            }
            return user.email || user.id || 'Unknown User';
        },
        getDefaultAvatar(user) {
            // Generate a simple colored circle based on user name
            const name = this.getUserName(user);
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
            const colorIndex = name.charCodeAt(0) % colors.length;
            return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='${encodeURIComponent(colors[colorIndex])}'/><text x='16' y='22' font-size='16' text-anchor='middle' fill='white' font-weight='bold'>${encodeURIComponent(name.charAt(0).toUpperCase())}</text></svg>`;
        },
        isUserNameSelected(user) {
            const userName = this.getUserName(user);
            return this.pendingSelection.has(userName);
        },
        toggleUser(user) {
            const userName = this.getUserName(user);
            const nextSelection = new Set(this.pendingSelection);
            if (nextSelection.has(userName)) {
                nextSelection.delete(userName);
            } else {
                nextSelection.add(userName);
            }
            this.pendingSelection = nextSelection;
        },
        removeUserName(userName) {
            const nextSelection = new Set(this.pendingSelection);
            nextSelection.delete(userName);
            this.pendingSelection = nextSelection;
        },
        getUserOptionStyle(user) {
            if (this.isUserNameSelected(user) && this.userFocusColor) {
                return {
                    'background-color': `${this.userFocusColor} !important`,
                };
            }
            return {};
        },
        selectHighlightedUser() {
            if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredUsers.length) {
                const user = this.filteredUsers[this.highlightedIndex];
                this.toggleUser(user);
            }
        },
        highlightNextUser() {
            if (this.highlightedIndex < this.filteredUsers.length - 1) {
                this.highlightedIndex++;
                this.scrollToHighlighted();
            }
        },
        highlightPreviousUser() {
            if (this.highlightedIndex > 0) {
                this.highlightedIndex--;
                this.scrollToHighlighted();
            }
        },
        scrollToHighlighted() {
            this.$nextTick(() => {
                const list = this.$el?.querySelector('.user-list');
                if (!list) return;
                
                const highlightedElement = list.querySelector('.user-option.highlighted');
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({
                        block: 'nearest',
                        behavior: 'smooth',
                    });
                }
            });
        },
        // AG Grid filter interface methods
        getModel() {
            if (!this.isFilterActive()) {
                return null;
            }
            // Store user names in the model (matching what filterValueGetter returns)
            return {
                type: "userFilter",
                values: Array.from(this.appliedSelection), // These are user names
            };
        },
        setModel(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        onParentModelChanged(model) {
            this.syncSelectionsFromModel(model, { updateApplied: true });
        },
        isFilterActive() {
            return this.appliedSelection.size > 0;
        },
        doesFilterPass(params) {
            if (!this.isFilterActive()) {
                return true;
            }
            const rowValue = this.getRowValue(params);
            
            // If row has no users, it doesn't match any filter
            if (!rowValue || rowValue === '') {
                return false;
            }
            
            // For multiple users, filterValueGetter returns comma-separated names
            // We need to check if any of the selected user names match any name in the row value
            if (typeof rowValue === 'string' && rowValue.includes(',')) {
                // Multiple users: split by comma and check each name
                const rowUserNames = rowValue.split(',').map(name => name.trim()).filter(Boolean);
                return rowUserNames.some(name => this.appliedSelection.has(name));
            } else {
                // Single user: direct match
                return this.appliedSelection.has(rowValue);
            }
        },
        getRowValue(filterParams) {
            // AG Grid passes the result of filterValueGetter as params.value
            // For user columns, this should be the user name(s), not the raw ID(s)
            if (filterParams && "value" in filterParams) {
                const value = filterParams.value;
                // If value is already a string (user names from filterValueGetter), return it directly
                if (typeof value === 'string') {
                    return value;
                }
                // If value is not a string, it might be raw data that needs formula extraction
                // This can happen if filterValueGetter didn't process it correctly
                return this.getUserNamesFromValue(value);
            }
            // Fallback: try to get from data field directly
            const field = this.params?.colDef?.field;
            if (field && filterParams?.data && Object.prototype.hasOwnProperty.call(filterParams.data, field)) {
                // If filterValueGetter is defined, we shouldn't reach here
                // But if we do, we need to convert ID(s) to name(s) using formula if available
                const rawValue = filterParams.data[field];
                return this.getUserNamesFromValue(rawValue);
            }
            return undefined;
        },
        getUserNamesFromValue(value) {
            // Convert user ID(s) to user name(s)
            if (!value) return '';
            
            // Apply userIdFormula if available to extract user ID(s) from nested structures
            let extractedValue = value;
            if (this.userParams?.userIdFormula && this.userParams?.resolveMappingFormula) {
                const resolved = this.userParams.resolveMappingFormula(this.userParams.userIdFormula, value);
                extractedValue = resolved ?? value; // Fallback to raw value if formula returns null/undefined
            }
            
            const userIds = Array.isArray(extractedValue) ? extractedValue : [extractedValue];
            const userNames = userIds
                .map(id => {
                    const user = this.availableUsers.find(u => u.id === id);
                    return user ? this.getUserName(user) : null;
                })
                .filter(Boolean);
            
            return userNames.join(', ');
        },
        onApply() {
            this.appliedSelection = new Set(this.pendingSelection);
            this.params?.filterChangedCallback();
            if (this.params?.filterParams?.closeOnApply && this.params?.api?.hidePopupMenu) {
                this.params.api.hidePopupMenu();
            }
        },
        onReset() {
            if (!this.canReset) return;
            this.pendingSelection = new Set();
            this.appliedSelection = new Set();
            this.params?.filterChangedCallback();
        },
        syncSelectionsFromModel(model, { updateApplied } = { updateApplied: true }) {
            if (!model || !Array.isArray(model.values) || model.values.length === 0) {
                if (updateApplied) {
                    this.appliedSelection = new Set();
                }
                this.pendingSelection = updateApplied ? new Set(this.appliedSelection) : new Set();
                return;
            }
            const next = new Set(model.values);
            if (updateApplied) {
                this.appliedSelection = new Set(next);
            }
            this.pendingSelection = new Set(next);
        },
        areSetsEqual(a, b) {
            if (a.size !== b.size) return false;
            for (const value of a) {
                if (!b.has(value)) return false;
            }
            return true;
        },
        refreshUsers() {
            // Force refresh by re-checking all sources
            this.loadingStartTime = Date.now(); // Reset loading timer
            
            // Try multiple sources
            const colDef = this.params?.colDef || {};
            const filterParams = colDef.filterParams || this.params?.filterParams || {};
            const rendererParams = colDef.cellRendererParams || {};
            const editorParams = colDef.cellEditorParams || {};
            
            // Try filterParams first
            if (filterParams && Object.keys(filterParams).length > 0) {
                this.setUserParams(filterParams);
            }
            
            // If still no users, try editor params
            if (this.availableUsers.length === 0 && editorParams && Object.keys(editorParams).length > 0) {
                this.setUserParams(editorParams);
            }
            
            // If still no users, try renderer params
            if (this.availableUsers.length === 0 && rendererParams && Object.keys(rendererParams).length > 0) {
                this.setUserParams(rendererParams);
            }
            
            // Also trigger refresh on parent if available
            if (this.params?.api) {
                this.params.api.refreshCells();
            }
        },
    },
};
</script>

<style scoped lang="scss">
.user-filter {
    display: flex;
    flex-direction: column;
    min-width: 300px;
    max-width: 400px;
    max-height: 500px;
    font-family: inherit;
    color: inherit;
}

.user-filter-content {
    display: flex;
    flex-direction: column;
    max-height: 500px;
}

.user-search-container {
    padding: 8px;
    border-bottom: 1px solid #e0e0e0;
}

.user-search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    
    &:focus {
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
    }
}

.selected-users-pills {
    padding: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border-bottom: 1px solid #e0e0e0;
    max-height: 100px;
    overflow-y: auto;
}

.user-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f0f0f0;
    border-radius: 16px;
    padding: 4px 8px;
    font-size: 12px;
}

.pill-name {
    color: #333;
}

.pill-remove {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
    
    &:hover {
        background-color: #ddd;
    }
}

.user-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
}

.user-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
    
    &:hover {
        background-color: #f5f5f5;
    }
    
    &.highlighted {
        background-color: #e8f4f8;
    }
    
    &.selected {
        font-weight: 500;
    }
}

.option-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.option-info {
    flex: 1;
    min-width: 0;
}

.option-name {
    font-size: 14px;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.option-bio {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.option-check {
    color: #4a90e2;
    font-weight: bold;
    font-size: 16px;
    flex-shrink: 0;
}

.no-users {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 14px;
}

.user-filter-actions {
    padding: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #e0e0e0;
}

.filter-btn {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    color: #333333;
    cursor: pointer;
    font-weight: 400;
    padding: 6px 16px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    
    &.reset {
        background-color: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: #333333;
    }
    
    &.apply {
        background-color: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: #333333;
    }
    
    &:hover {
        background-color: #f5f5f5;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: #ffffff;
    }
}

.user-filter-empty {
    padding: 16px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.6);
}

.loading-with-refresh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.refresh-btn {
    background: none;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
        background-color: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.3);
    }
    
    &:active {
        transform: scale(0.95);
    }
}

.refresh-icon {
    font-size: 16px;
    line-height: 1;
    display: inline-block;
    transition: transform 0.3s ease;
}

.refresh-btn:hover .refresh-icon {
    transform: rotate(180deg);
}
</style>

