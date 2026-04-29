<template>
    <div ref="cellElement" class="user-cell">
        <!-- Loading skeleton -->
        <div v-if="isLoadingState" class="user-skeleton">
            <div class="skeleton-shimmer"></div>
        </div>
        <!-- Normal display - Read Mode -->
        <div v-else class="user-display">
            <div
                v-for="(user, index) in displayUsers"
                :key="user.id || index"
                class="user-avatar-container"
                @mouseenter="showTooltipForUser(user, $event)"
                @mouseleave="handleAvatarMouseLeave"
                @mousemove="updateTooltipPosition()"
            >
                <img
                    :src="user.avatar_variants?.sm || user.avatar_url || getDefaultAvatar(user)"
                    :alt="getUserName(user)"
                    class="user-avatar"
                />
            </div>
        </div>
        
        <!-- Tooltip (Teleported to body) -->
        <Teleport :to="teleportTarget" v-if="showTooltip && currentTooltipUser && teleportTarget">
            <div 
                ref="tooltipElement"
                class="user-tooltip"
                :style="tooltipStyle"
                @mouseenter="keepTooltipVisible"
                @mouseleave="handleTooltipMouseLeave"
            >
                <div class="tooltip-header">
                    <img
                        :src="currentTooltipUser.avatar_variants?.md || currentTooltipUser.avatar_url || getDefaultAvatar(currentTooltipUser)"
                        :alt="getUserName(currentTooltipUser)"
                        class="tooltip-avatar"
                    />
                    <div class="tooltip-header-info">
                        <div class="tooltip-name">{{ getUserName(currentTooltipUser) }}</div>
                        <div v-if="currentTooltipUser.bio" class="tooltip-bio">{{ currentTooltipUser.bio }}</div>
                    </div>
                </div>
                <div 
                    v-if="currentTooltipUser.email || getUserPhone(currentTooltipUser)" 
                    class="tooltip-section-header"
                    @click="toggleContactInfo"
                >
                    <span class="section-label">Coordonnées</span>
                    <svg 
                        class="section-chevron" 
                        :class="{ 'expanded': showContactInfo }"
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        stroke-width="2" 
                        stroke-linecap="round" 
                        stroke-linejoin="round"
                    >
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                </div>
                <div v-if="showContactInfo && currentTooltipUser.email" class="tooltip-row">
                    <div class="tooltip-label-row">
                        <svg class="tooltip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: iconColor }">
                            <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                        <span class="tooltip-label">Email:</span>
                    </div>
                    <div class="tooltip-value-row">
                        <span class="tooltip-value">{{ currentTooltipUser.email }}</span>
                    </div>
                    <div class="tooltip-copy-row">
                        <button 
                            class="tooltip-copy-btn" 
                            :class="{ 'copied': copiedEmail }"
                            @click.stop="copyToClipboard(currentTooltipUser.email, 'email')"
                            type="button"
                            title="Copier"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-copy-icon lucide-clipboard-copy">
                                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                                <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
                                <path d="M16 4h2a2 2 0 0 1 2 2v4"/>
                                <path d="M21 14H11"/>
                                <path d="m15 10-4 4 4 4"/>
                            </svg>
                            <span class="copy-text">{{ copiedEmail ? 'Copié' : 'Copier' }}</span>
                        </button>
                    </div>
                </div>
                <div v-if="showContactInfo && getUserPhone(currentTooltipUser)" class="tooltip-row">
                    <div class="tooltip-label-row">
                        <svg class="tooltip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: iconColor }">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        <span class="tooltip-label">Tel:</span>
                    </div>
                    <div class="tooltip-value-row">
                        <span class="tooltip-phone-value">{{ getUserPhone(currentTooltipUser) }}</span>
                    </div>
                    <div class="tooltip-copy-row">
                        <button 
                            class="tooltip-copy-btn" 
                            :class="{ 'copied': copiedPhone }"
                            @click.stop="copyToClipboard(getUserPhone(currentTooltipUser), 'phone')"
                            type="button"
                            title="Copier"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-copy-icon lucide-clipboard-copy">
                                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                                <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
                                <path d="M16 4h2a2 2 0 0 1 2 2v4"/>
                                <path d="M21 14H11"/>
                                <path d="m15 10-4 4 4 4"/>
                            </svg>
                            <span class="copy-text">{{ copiedPhone ? 'Copié' : 'Copier' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
        
        <!-- Edit Mode Dropdown -->
        <Teleport :to="teleportTarget" v-if="isEditMode && teleportTarget">
            <div 
                class="user-dropdown-wrapper" 
                :style="dropdownStyle"
            >
                <div
                    ref="dropdownElement"
                    class="user-dropdown"
                    tabindex="0"
                    @keydown.escape="cancelEditing"
                    @keydown.enter.prevent="selectHighlightedUser"
                    @keydown.arrow-down.prevent="highlightNextUser"
                    @keydown.arrow-up.prevent="highlightPreviousUser"
                >
                    <!-- Search Input -->
                    <div class="user-search-container">
                        <input
                            ref="searchInput"
                            v-model="searchQuery"
                            type="text"
                            class="user-search-input"
                            :placeholder="searchPlaceholder"
                            @input="highlightedIndex = -1"
                            @keydown.escape.stop="cancelEditing"
                            @keydown.arrow-down.prevent="highlightNextUser"
                            @keydown.arrow-up.prevent="highlightPreviousUser"
                            @keydown.enter.prevent="selectHighlightedUser"
                        />
                    </div>
                    
                    <!-- Selected Users Pills (if multiple) -->
                    <div v-if="isMultiple && selectedUsers.length > 0" class="selected-users-pills">
                        <div 
                            v-for="user in selectedUsers" 
                            :key="user.id"
                            class="user-pill"
                        >
                            <img
                                :src="user.avatar_variants?.md || user.avatar_url || getDefaultAvatar(user)"
                                :alt="getUserName(user)"
                                class="pill-avatar"
                            />
                            <span class="pill-name">{{ getUserName(user) }}</span>
                            <button 
                                class="pill-remove"
                                @click.stop="removeUser(user.id)"
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
                                'selected': isUserSelected(user.id),
                                'highlighted': index === highlightedIndex
                            }"
                            :style="getUserOptionStyle(user)"
                            @click="toggleUser(user)"
                            @mouseenter="highlightedIndex = index"
                        >
                            <img
                                :src="user.avatar_variants?.md || user.avatar_url || getDefaultAvatar(user)"
                                :alt="getUserName(user)"
                                class="option-avatar"
                            />
                            <div class="option-info">
                                <div class="option-name">{{ getUserName(user) }}</div>
                                <div v-if="user.bio" class="option-bio">{{ user.bio }}</div>
                            </div>
                            <div v-if="isUserSelected(user.id)" class="option-check">✓</div>
                        </div>
                        <div v-if="filteredUsers.length === 0" class="no-users">
                            No users found
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
// Module-level cache for the SVG data-URL fallback avatars.
// Same display-name → same SVG, so we can skip the encodeURIComponent
// and string assembly on every renderer mount.
const defaultAvatarCache = new Map();
const DEFAULT_AVATAR_CACHE_MAX = 500;
const DEFAULT_AVATAR_PALETTE = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

function buildDefaultAvatarUrl(name) {
    const colorIndex = name.charCodeAt(0) % DEFAULT_AVATAR_PALETTE.length;
    const color = DEFAULT_AVATAR_PALETTE[colorIndex];
    const initial = name.charAt(0).toUpperCase();
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='${encodeURIComponent(color)}'/><text x='16' y='22' font-size='16' text-anchor='middle' fill='white' font-weight='bold'>${encodeURIComponent(initial)}</text></svg>`;
}

function getDefaultAvatarFor(name) {
    if (!name) name = '?';
    if (defaultAvatarCache.has(name)) {
        return defaultAvatarCache.get(name);
    }
    if (defaultAvatarCache.size >= DEFAULT_AVATAR_CACHE_MAX) {
        defaultAvatarCache.delete(defaultAvatarCache.keys().next().value);
    }
    const url = buildDefaultAvatarUrl(name);
    defaultAvatarCache.set(name, url);
    return url;
}

export default {
    name: "UserCellRenderer",
    props: {
        params: {
            type: Object,
            required: true,
        },
    },
    data() {
        // Pre-check if users are already available at creation time.
        // This prevents showing a skeleton flash when the component is recreated
        // (e.g., due to columnDefs recomputation) but the users data is already loaded.
        const editorParams = this.params?.colDef?.cellEditorParams || {};
        const rendererParams = this.params?.colDef?.cellRendererParams || {};
        const users = this.params?.users || editorParams?.users || rendererParams?.users || [];
        const usersAlreadyAvailable = Array.isArray(users) && users.length > 0;

        return {
            selectedUserIds: [],
            originalUserIds: [],
            dropdownPosition: { top: 100, left: 100, width: 200 },
            tooltipPosition: { top: 0, left: 0 },
            teleportTarget: null,
            highlightedIndex: -1,
            hasEverRendered: usersAlreadyAvailable,
            searchQuery: "",
            showTooltip: false,
            currentTooltipUser: null,
            tooltipHideTimeout: null,
            tooltipShowTimeout: null,
            isMouseOverTooltip: false,
            copiedEmail: false,
            copiedPhone: false,
            showContactInfo: false,
            // ag-grid-vue3 does not update the params prop reactively after refresh().
            // Cache the latest params here so computeds re-read fresh values
            // without forcing AG Grid to destroy and recreate this renderer.
            _refreshedParams: null,
        };
    },
    computed: {
        // Prefer params received via refresh() over the initial prop, since
        // ag-grid-vue3 doesn't propagate prop changes after refresh.
        activeParams() {
            return this._refreshedParams || this.params;
        },
        isEditMode() {
            // Check if stopEditing is present (indicates cell editor mode)
            const hasStopEditing = this.activeParams?.api && this.activeParams?.stopEditing;
            if (!hasStopEditing) return false;

            // Check if the column is editable
            const colDef = this.activeParams?.colDef;
            const isEditable = colDef?.editable !== false;

            return isEditable;
        },
        isLoadingState() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            if (this.activeParams?.isLoading || editorParams?.isLoading || rendererParams?.isLoading) {
                return true;
            }

            if (!this.hasEverRendered) {
                const usersNotLoaded = this.availableUsers.length === 0;
                if (usersNotLoaded) {
                    return true;
                }
            }

            return false;
        },
        availableUsers() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            const users = this.activeParams?.users ||
                         editorParams?.users ||
                         rendererParams?.users ||
                         [];

            return Array.isArray(users) ? users : [];
        },
        maxNumberOfUsers() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            return this.activeParams?.maxNumberOfUsers ||
                   editorParams?.maxNumberOfUsers ||
                   rendererParams?.maxNumberOfUsers ||
                   4;
        },
        isMultiple() {
            return this.maxNumberOfUsers > 1;
        },
        userIdFormula() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            return this.activeParams?.userIdFormula ||
                   editorParams?.userIdFormula ||
                   rendererParams?.userIdFormula ||
                   null;
        },
        resolveMappingFormula() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            return this.activeParams?.resolveMappingFormula ||
                   editorParams?.resolveMappingFormula ||
                   rendererParams?.resolveMappingFormula ||
                   null;
        },
        currentValue() {
            const field = this.activeParams?.colDef?.field;
            const rawValue = this.activeParams?.data?.[field] ?? this.activeParams?.value;

            // If no formula, return raw value directly
            if (!this.userIdFormula || !this.resolveMappingFormula) {
                return rawValue;
            }

            // Apply formula to extract user ID(s)
            const extractedValue = this.resolveMappingFormula(this.userIdFormula, rawValue);
            return extractedValue ?? rawValue; // Fallback to raw value if formula returns null/undefined
        },
        displayUsers() {
            if (!this.currentValue) return [];
            
            const userIds = Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue];
            return userIds
                .map(id => this.availableUsers.find(u => u.id === id))
                .filter(Boolean);
        },
        selectedUsers() {
            return this.selectedUserIds
                .map(id => this.availableUsers.find(u => u.id === id))
                .filter(Boolean);
        },
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
        userFocusColor() {
            const editorParams = this.activeParams?.colDef?.cellEditorParams || {};
            const rendererParams = this.activeParams?.colDef?.cellRendererParams || {};

            return this.activeParams?.userFocusColor ||
                   editorParams?.userFocusColor ||
                   rendererParams?.userFocusColor ||
                   null;
        },
        iconColor() {
            return this.userFocusColor || '#666';
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
        dropdownStyle() {
            return {
                position: 'fixed',
                top: `${this.dropdownPosition.top + 8}px`,
                left: `${this.dropdownPosition.left}px`,
                minWidth: `${Math.max(300, this.dropdownPosition.width)}px`,
                maxWidth: '400px',
                zIndex: 2000,
            };
        },
        tooltipStyle() {
            // Get font family from content (passed via params or from grid theme)
            const cellFontFamily = this.activeParams?.cellFontFamily || null;
            
            return {
                position: 'fixed',
                top: `${this.tooltipPosition.top}px`,
                left: `${this.tooltipPosition.left}px`,
                zIndex: 2000,
                fontFamily: cellFontFamily || 'inherit',
                transform: 'none', // Remove transform since we're calculating exact position
            };
        },
    },
    mounted() {
        this.initializeValue();
        this.teleportTarget = this.getCorrectBody();
        
        if (this.isEditMode) {
            this.clearTextSelection();
            this.updateDropdownPosition();
            
            requestAnimationFrame(() => {
                this.updateDropdownPosition();
            });
            
            this.$nextTick(() => {
                this.updateDropdownPosition();
                if (this.$refs.searchInput) {
                    this.$refs.searchInput.focus();
                }
            });
            
            setTimeout(() => {
                this.updateDropdownPosition();
                this.addClickOutsideListener();
                this.addEscapeKeyListener();
            }, 50);
        }
        
        this.$nextTick(() => {
            if (this.availableUsers.length > 0) {
                this.hasEverRendered = true;
            }
        });
    },
    beforeUnmount() {
        this.removeClickOutsideListener();
        this.removeEscapeKeyListener();
        if (this.tooltipShowTimeout) {
            clearTimeout(this.tooltipShowTimeout);
        }
        if (this.tooltipHideTimeout) {
            clearTimeout(this.tooltipHideTimeout);
        }
    },
    watch: {
        isEditMode(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.updateDropdownPosition();
                });
            }
        },
        availableUsers: {
            // immediate: false — the mounted() $nextTick already handles the
            // "users available at mount" case. This watcher only needs to fire
            // when users arrive asynchronously after the component is created,
            // so running it synchronously on every mount is redundant overhead.
            handler(newUsers) {
                if (!this.hasEverRendered && newUsers.length > 0) {
                    this.hasEverRendered = true;
                }
            },
            immediate: false,
        },
    },
    methods: {
        // AG Grid interface: called when the cell needs to update without full recreate.
        // We cache the latest params (ag-grid-vue3 doesn't update the prop after
        // refresh) and return true so AG Grid keeps this instance alive — much
        // cheaper than rebuilding the renderer (with its tooltip + dropdown
        // template) every time a cell value changes.
        refresh(params) {
            this._refreshedParams = params;
            return true;
        },
        initializeValue() {
            const value = this.currentValue;
            if (this.isMultiple) {
                this.selectedUserIds = Array.isArray(value) ? [...value] : (value ? [value] : []);
            } else {
                this.selectedUserIds = value ? [value] : [];
            }
            this.originalUserIds = [...this.selectedUserIds];
        },
        getUserName(user) {
            if (user.name) return user.name;
            if (user.firstname || user.lastname) {
                return [user.firstname, user.lastname].filter(Boolean).join(' ');
            }
            return user.email || user.id || 'Unknown User';
        },
        getUserPhone(user) {
            if (user.phone?.phone_number) {
                return user.phone.phone_number;
            }
            if (user.phone_number) {
                return user.phone_number;
            }
            return null;
        },
        getDefaultAvatar(user) {
            // Memoized at module level (see getDefaultAvatarFor) so identical
            // display names share the same SVG data URL across rows/scrolls.
            return getDefaultAvatarFor(this.getUserName(user));
        },
        isUserSelected(userId) {
            return this.selectedUserIds.includes(userId);
        },
        toggleUser(user) {
            if (this.isUserSelected(user.id)) {
                this.removeUser(user.id);
            } else {
                this.addUser(user.id);
            }
        },
        addUser(userId) {
            if (this.isMultiple) {
                if (this.selectedUserIds.length >= this.maxNumberOfUsers) {
                    return; // Can't add more
                }
                if (!this.selectedUserIds.includes(userId)) {
                    this.selectedUserIds.push(userId);
                    // Validate and exit edit mode when user is added
                    this.stopEditing();
                }
            } else {
                // Single selection: replace and auto-confirm
                this.selectedUserIds = [userId];
                this.stopEditing();
            }
        },
        removeUser(userId) {
            this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
        },
        getValue() {
            if (this.isMultiple) {
                return this.selectedUserIds.length > 0 ? this.selectedUserIds : null;
            } else {
                return this.selectedUserIds.length > 0 ? this.selectedUserIds[0] : null;
            }
        },
        // AG Grid editor interface method
        // Called by AG Grid before completing the edit to validate the current value
        getValidationErrors() {
            const cb = this.params?.getValidationErrors;
            if (typeof cb !== 'function') return null;
            return cb({ value: this.getValue(), data: this.params?.data });
        },
        stopEditing() {
            this.removeClickOutsideListener();
            if (this.params?.stopEditing) {
                this.params.stopEditing();
            }
        },
        cancelEditing() {
            this.selectedUserIds = [...this.originalUserIds];
            this.removeClickOutsideListener();
            this.removeEscapeKeyListener();
            if (this.params?.stopEditing) {
                this.params.stopEditing(true);
            }
        },
        getUserOptionStyle(user) {
            if (this.isUserSelected(user.id) && this.userFocusColor) {
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
                const list = this.$refs.dropdownElement?.querySelector('.user-list');
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
        copyToClipboard(text, type) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    this.handleCopySuccess(type);
                });
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.handleCopySuccess(type);
            }
        },
        handleCopySuccess(type) {
            if (type === 'email') {
                this.copiedEmail = true;
                setTimeout(() => {
                    this.copiedEmail = false;
                }, 2000);
            } else if (type === 'phone') {
                this.copiedPhone = true;
                setTimeout(() => {
                    this.copiedPhone = false;
                }, 2000);
            }
        },
        toggleContactInfo() {
            this.showContactInfo = !this.showContactInfo;
        },
        handleClickOutside(event) {
            const dropdown = this.$refs.dropdownElement?.parentElement;
            if (dropdown && !dropdown.contains(event.target)) {
                this.stopEditing();
            }
        },
        addClickOutsideListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.addEventListener('mousedown', this.handleClickOutside);
        },
        removeClickOutsideListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.removeEventListener('mousedown', this.handleClickOutside);
        },
        handleEscapeKey(event) {
            // Only handle escape if we're in edit mode
            if (this.isEditMode && event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.cancelEditing();
            }
        },
        addEscapeKeyListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.addEventListener('keydown', this.handleEscapeKey);
        },
        removeEscapeKeyListener() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            frontDocument.removeEventListener('keydown', this.handleEscapeKey);
        },
        clearTextSelection() {
            const frontWindow = wwLib?.getFrontWindow?.() || window;
            const selection = frontWindow.getSelection?.();
            if (selection) {
                if (selection.removeAllRanges) {
                    selection.removeAllRanges();
                } else if (selection.empty) {
                    selection.empty();
                }
            }
        },
        getCorrectBody() {
            const frontDocument = wwLib?.getFrontDocument?.() || document;
            return frontDocument.body;
        },
        updateDropdownPosition() {
            if (this.$refs.cellElement) {
                const rect = this.$refs.cellElement.getBoundingClientRect();
                const width = rect.width > 0 ? rect.width : 300;
                const top = rect.bottom > 0 ? rect.bottom : rect.top + 30;
                const left = rect.left >= 0 ? rect.left : 0;
                
                this.dropdownPosition = {
                    top: top,
                    left: left,
                    width: width,
                };
            }
        },
        showTooltipForUser(user, event) {
            // Clear any existing show timeout
            if (this.tooltipShowTimeout) {
                clearTimeout(this.tooltipShowTimeout);
                this.tooltipShowTimeout = null;
            }

            // Clear any pending hide timeout
            if (this.tooltipHideTimeout) {
                clearTimeout(this.tooltipHideTimeout);
                this.tooltipHideTimeout = null;
            }

            // Capture the hovered avatar element directly from the event so we
            // don't need to track per-user refs (avoids inline `:ref` binding
            // recreated on every render).
            this._hoveredAvatarEl = event?.currentTarget || null;

            // Set a delay before showing the tooltip (500ms)
            this.tooltipShowTimeout = setTimeout(() => {
                this.currentTooltipUser = user;
                this.showContactInfo = false; // Reset to collapsed state
                this.updateTooltipPosition();
                this.showTooltip = true;
                this.tooltipShowTimeout = null;
            }, 500);
        },
        handleAvatarMouseLeave() {
            // Clear the show timeout if mouse leaves before delay completes
            if (this.tooltipShowTimeout) {
                clearTimeout(this.tooltipShowTimeout);
                this.tooltipShowTimeout = null;
            }
            
            // Delay hiding to allow moving to tooltip
            this.tooltipHideTimeout = setTimeout(() => {
                // Only hide if mouse is not over tooltip
                if (!this.isMouseOverTooltip) {
                    this.hideTooltip();
                }
            }, 100);
        },
        keepTooltipVisible() {
            this.isMouseOverTooltip = true;
            // Clear any pending hide timeout
            if (this.tooltipHideTimeout) {
                clearTimeout(this.tooltipHideTimeout);
                this.tooltipHideTimeout = null;
            }
        },
        handleTooltipMouseLeave() {
            this.isMouseOverTooltip = false;
            // Small delay before hiding to allow moving back to avatar
            this.tooltipHideTimeout = setTimeout(() => {
                this.hideTooltip();
            }, 100);
        },
        hideTooltip() {
            this.showTooltip = false;
            this.currentTooltipUser = null;
            this.isMouseOverTooltip = false;
            this.showContactInfo = false; // Reset to collapsed state
            this._hoveredAvatarEl = null;
            if (this.tooltipHideTimeout) {
                clearTimeout(this.tooltipHideTimeout);
                this.tooltipHideTimeout = null;
            }
            if (this.tooltipShowTimeout) {
                clearTimeout(this.tooltipShowTimeout);
                this.tooltipShowTimeout = null;
            }
        },
        updateTooltipPosition() {
            this.$nextTick(() => {
                const avatarElement = this._hoveredAvatarEl;
                if (!avatarElement) return;
                
                const avatarRect = avatarElement.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Wait for tooltip to render to get actual dimensions
                this.$nextTick(() => {
                    if (!this.$refs.tooltipElement) {
                        // Fallback if tooltip not yet rendered
                        this.tooltipPosition = {
                            top: avatarRect.top,
                            left: avatarRect.right + 12,
                        };
                        return;
                    }
                    
                    const tooltipRect = this.$refs.tooltipElement.getBoundingClientRect();
                    const tooltipWidth = tooltipRect.width;
                    const tooltipHeight = tooltipRect.height;
                    
                    // Try to position to the right of avatar first
                    let left = avatarRect.right + 12;
                    let top = avatarRect.top;
                    
                    // If tooltip would go off-screen to the right, position to the left
                    if (left + tooltipWidth > viewportWidth - 12) {
                        left = avatarRect.left - tooltipWidth - 12;
                    }
                    
                    // If tooltip would go off-screen to the left, position above
                    if (left < 12) {
                        left = avatarRect.left + (avatarRect.width / 2) - (tooltipWidth / 2);
                        top = avatarRect.top - tooltipHeight - 12;
                    }
                    
                    // Ensure tooltip doesn't go off top or bottom
                    if (top < 12) {
                        top = 12;
                    }
                    if (top + tooltipHeight > viewportHeight - 12) {
                        top = viewportHeight - tooltipHeight - 12;
                    }
                    
                    // Ensure tooltip doesn't go off left or right edges
                    if (left < 12) {
                        left = 12;
                    }
                    if (left + tooltipWidth > viewportWidth - 12) {
                        left = viewportWidth - tooltipWidth - 12;
                    }
                    
                    this.tooltipPosition = {
                        top: top,
                        left: left,
                    };
                });
            });
        },
    },
};
</script>

<style scoped lang="scss">
.user-cell {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    padding: 4px;
    cursor: pointer;
    position: relative;
}

.user-display {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
}

.user-avatar-container {
    position: relative;
    display: inline-block;
    margin-left: -8px; // Overlap effect
    
    &:first-child {
        margin-left: 0; // First avatar doesn't need negative margin
    }
    
    &:hover {
        z-index: 10; // Bring hovered avatar to front
    }
}

.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    border: 2px solid white; // Border to separate overlapping avatars
    box-sizing: border-box;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
}

.user-tooltip {
    position: fixed;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    min-width: 223px;
    max-width: 400px;
    width: max-content;
    pointer-events: auto;
    white-space: normal;
    box-sizing: border-box;
}

.tooltip-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
}

.tooltip-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.tooltip-header-info {
    flex: 1;
    min-width: 0;
}

.tooltip-name {
    font-weight: 600;
    font-size: 16px;
    line-height: 1.4;
    margin-bottom: 4px;
    color: #000;
}

.tooltip-bio {
    font-size: 14px;
    color: #666;
    line-height: 1.4;
}

.tooltip-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    margin-top: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    user-select: none;
    border-top: 1px solid #e0e0e0;
    transition: all 0.2s;
    
    &:hover {
        opacity: 0.8;
    }
}

.section-label {
    font-weight: 500;
    font-size: 14px;
    color: #333;
}

.section-chevron {
    width: 16px;
    height: 16px;
    color: #666;
    transition: transform 0.2s;
    flex-shrink: 0;
    
    &.expanded {
        transform: rotate(180deg);
    }
}

.tooltip-row {
    margin-bottom: 12px;
    font-size: 14px;
    line-height: 1.4;
    
    &:last-child {
        margin-bottom: 0;
    }
    
    &:hover .tooltip-copy-row {
        display: block;
    }
}

.tooltip-label-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}

.tooltip-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

.tooltip-label {
    font-weight: 500;
    color: #333;
}

.tooltip-value-row {
    margin-left: 22px; // Align with label (16px icon + 6px gap)
}

.tooltip-value,
.tooltip-phone-value {
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
    font-size: 12px;
}

.tooltip-copy-row {
    display: none;
    margin-left: 22px; // Align with label (16px icon + 6px gap)
    margin-top: 4px;
}

.tooltip-copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #777777;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: white;
    transition: all 0.2s;
    
    svg {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
        fill: none;
        stroke: currentColor;
    }
    
    .copy-text {
        transition: opacity 0.2s, transform 0.2s;
    }
    
    &.copied .copy-text {
        animation: copyPulse 0.3s ease-out;
    }
    
    &:hover {
        background: #666666;
    }
    
    &:active {
        transform: scale(0.98);
    }
}

@keyframes copyPulse {
    0% {
        opacity: 0;
        transform: scale(0.8);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}

.user-skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    
    .skeleton-shimmer {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(
            90deg,
            #e2e8f0 0%,
            #f1f5f9 50%,
            #e2e8f0 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
    }
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

.user-dropdown-wrapper {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    border: none;
    user-select: none;
    font-size: inherit;
    font-family: inherit;
    position: relative;
    padding-top: 8px;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid white;
        transform: translateX(-50%) translateY(-100%);
    }
}

.user-dropdown {
    width: 100%;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    outline: none;
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

.pill-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
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
</style>

