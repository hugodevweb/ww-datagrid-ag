<template>
    <!-- The parent controls visibility via v-if before mounting this component,
         so the Teleport is always active once this SFC is in the DOM. -->
    <Teleport :to="teleportTarget">
        <div
            ref="tooltipEl"
            class="user-tooltip"
            :style="tooltipStyle"
            @mouseenter="$emit('mouseenter')"
            @mouseleave="$emit('mouseleave')"
        >
            <!-- Header: avatar + name/bio -->
            <div class="tooltip-header">
                <img
                    :src="user.avatar_variants?.md || user.avatar_url || getDefaultAvatar(user)"
                    :alt="getUserName(user)"
                    class="tooltip-avatar"
                />
                <div class="tooltip-header-info">
                    <div class="tooltip-name">{{ getUserName(user) }}</div>
                    <div v-if="user.bio" class="tooltip-bio">{{ user.bio }}</div>
                </div>
            </div>

            <!-- Collapsible contact section -->
            <div
                v-if="user.email || getUserPhone(user)"
                class="tooltip-section-header"
                @click="$emit('toggle-contact-info')"
            >
                <span class="section-label">Coordonnées</span>
                <svg
                    class="section-chevron"
                    :class="{ expanded: showContactInfo }"
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                >
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </div>

            <!-- Email row -->
            <div v-if="showContactInfo && user.email" class="tooltip-row">
                <div class="tooltip-label-row">
                    <svg class="tooltip-icon" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        :style="{ color: iconColor }"
                    >
                        <rect width="20" height="16" x="2" y="4" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <span class="tooltip-label">Email:</span>
                </div>
                <div class="tooltip-value-row">
                    <span class="tooltip-value">{{ user.email }}</span>
                </div>
                <div class="tooltip-copy-row">
                    <button
                        class="tooltip-copy-btn"
                        :class="{ copied: copiedEmail }"
                        type="button"
                        title="Copier"
                        @click.stop="$emit('copy', user.email, 'email')"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        >
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

            <!-- Phone row -->
            <div v-if="showContactInfo && getUserPhone(user)" class="tooltip-row">
                <div class="tooltip-label-row">
                    <svg class="tooltip-icon" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        :style="{ color: iconColor }"
                    >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span class="tooltip-label">Tel:</span>
                </div>
                <div class="tooltip-value-row">
                    <span class="tooltip-phone-value">{{ getUserPhone(user) }}</span>
                </div>
                <div class="tooltip-copy-row">
                    <button
                        class="tooltip-copy-btn"
                        :class="{ copied: copiedPhone }"
                        type="button"
                        title="Copier"
                        @click.stop="$emit('copy', getUserPhone(user), 'phone')"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        >
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
</template>

<script>
import { getUserName, getUserPhone, getDefaultAvatar } from '../utils/avatarUtils.js';

export default {
    name: 'UserTooltip',

    props: {
        /** User object to display in the tooltip. */
        user: { type: Object, required: true },
        /** Teleport target (document.body of the correct frame). */
        teleportTarget: { type: Object, default: null },
        /** Pre-computed style object from the parent (position + font-family). */
        tooltipStyle: { type: Object, default: () => ({}) },
        /** Icon tint colour (derived from userFocusColor in parent). */
        iconColor: { type: String, default: '#666' },
        /** Whether the contact-info section is expanded. */
        showContactInfo: { type: Boolean, default: false },
        /** Whether the email copy button is in "copied" state. */
        copiedEmail: { type: Boolean, default: false },
        /** Whether the phone copy button is in "copied" state. */
        copiedPhone: { type: Boolean, default: false },
    },

    emits: ['mouseenter', 'mouseleave', 'toggle-contact-info', 'copy'],

    methods: {
        // Re-export utilities as methods so the template can call them.
        getUserName,
        getUserPhone,
        getDefaultAvatar,

        /**
         * Return the rendered tooltip DOM element.
         * Called by the parent (via $refs.userTooltip.getTooltipEl()) to read
         * the tooltip's bounding rect for position calculation.
         */
        getTooltipEl() {
            return this.$refs.tooltipEl ?? null;
        },
    },
};
</script>

<style scoped lang="scss">
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
    margin-left: 22px;
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
    0%   { opacity: 0; transform: scale(0.8); }
    50%  { transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
}
</style>
