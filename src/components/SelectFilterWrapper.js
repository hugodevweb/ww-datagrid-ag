import { createApp } from 'vue';
import SelectFilterComponent from './SelectFilterComponent.vue';

/**
 * Manual wrapper for SelectFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 * 
 * IMPORTANT: Handles timing issue where setModel may be called before
 * the filter component has loaded its options. Stores pending model
 * and applies it when options become available.
 */
export default class SelectFilterWrapper {
    constructor() {
        this.vueApp = null;
        this.vueInstance = null;
        // CRITICAL: Create eGui immediately in constructor
        // This ensures getGui() always has something to return
        this.eGui = document.createElement('div');
        this.eGui.className = 'select-filter-wrapper';
        
        // Track pending model for when setModel is called before options are loaded
        this.pendingModel = null;
        this.hasAppliedPendingModel = false;
    }

    init(params) {
        // Create and mount the Vue app to the pre-created container
        // Pass a callback that the component can use to notify when options are ready
        this.vueApp = createApp(SelectFilterComponent, { 
            params,
            onOptionsReady: () => this.onOptionsReady()
        });
        this.vueInstance = this.vueApp.mount(this.eGui);
    }

    /**
     * Called by the Vue component when options are loaded/available
     * If we have a pending model, apply it now
     */
    onOptionsReady() {
        if (this.pendingModel && !this.hasAppliedPendingModel) {
            this.hasAppliedPendingModel = true;
            // Apply the pending model now that options are available
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
        // Check if the Vue instance is ready and has options loaded
        const hasOptions = this.vueInstance?.hasOptionsLoaded?.() ?? false;
        
        if (!hasOptions && model) {
            // Store the model to apply later when options are ready
            this.pendingModel = model;
            this.hasAppliedPendingModel = false;
        } else {
            // Options are ready, apply immediately
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
