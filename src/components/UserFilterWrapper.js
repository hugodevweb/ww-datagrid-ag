import { createApp } from 'vue';
import UserFilterComponent from './UserFilterComponent.vue';

/**
 * Manual wrapper for UserFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 * 
 * IMPORTANT: Handles timing issue where setModel may be called before
 * the filter component has loaded its users. Stores pending model
 * and applies it when users become available.
 */
export default class UserFilterWrapper {
    constructor() {
        this.vueApp = null;
        this.vueInstance = null;
        // CRITICAL: Create eGui immediately in constructor
        // This ensures getGui() always has something to return
        this.eGui = document.createElement('div');
        this.eGui.className = 'user-filter-wrapper';
        
        // Track pending model for when setModel is called before users are loaded
        this.pendingModel = null;
        this.hasAppliedPendingModel = false;
    }

    init(params) {
        // Create and mount the Vue app to the pre-created container
        // Pass a callback that the component can use to notify when users are ready
        this.vueApp = createApp(UserFilterComponent, { 
            params,
            onUsersReady: () => this.onUsersReady()
        });
        this.vueInstance = this.vueApp.mount(this.eGui);
    }

    /**
     * Called by the Vue component when users are loaded/available
     * If we have a pending model, apply it now
     */
    onUsersReady() {
        if (this.pendingModel && !this.hasAppliedPendingModel) {
            this.hasAppliedPendingModel = true;
            // Apply the pending model now that users are available
            this.vueInstance?.setModel?.(this.pendingModel);
            this.pendingModel = null;
        }
    }

    getGui() {
        return this.eGui;
    }

    isFilterActive() {
        return this.vueInstance?.isFilterActive?.() ?? false;
    }

    doesFilterPass(params) {
        return this.vueInstance?.doesFilterPass?.(params) ?? true;
    }

    getModel() {
        return this.vueInstance?.getModel?.() ?? null;
    }

    setModel(model) {
        // Check if the Vue instance is ready and has users loaded
        const hasUsers = this.vueInstance?.hasUsersLoaded?.() ?? false;
        
        if (!hasUsers && model) {
            // Store the model to apply later when users are ready
            this.pendingModel = model;
            this.hasAppliedPendingModel = false;
        } else {
            // Users are ready, apply immediately
            this.vueInstance?.setModel?.(model);
            this.pendingModel = null;
            this.hasAppliedPendingModel = true;
        }
    }

    onParentModelChanged(model) {
        this.vueInstance?.onParentModelChanged?.(model);
    }

    refresh(params) {
        return this.vueInstance?.refresh?.(params) ?? true;
    }

    destroy() {
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }
        this.vueInstance = null;
        this.eGui = null;
        this.pendingModel = null;
    }
}
