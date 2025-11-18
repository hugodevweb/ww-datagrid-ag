import { createApp } from 'vue';
import SelectFilterComponent from './SelectFilterComponent.vue';

// Log immediately when this module is loaded
console.log('[SelectFilterWrapper] Module loaded');

/**
 * Manual wrapper for SelectFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 */
export default class SelectFilterWrapper {
    constructor() {
        console.log('[SelectFilterWrapper] constructor called');
        this.vueApp = null;
        this.vueInstance = null;
        // CRITICAL: Create eGui immediately in constructor
        // This ensures getGui() always has something to return
        this.eGui = document.createElement('div');
        this.eGui.className = 'select-filter-wrapper';
    }

    init(params) {
        console.log('[SelectFilterWrapper] init() called with params:', params);

        // Create and mount the Vue app to the pre-created container
        this.vueApp = createApp(SelectFilterComponent, { params });
        this.vueInstance = this.vueApp.mount(this.eGui);

        console.log('[SelectFilterWrapper] Vue instance created:', this.vueInstance);
    }

    getGui() {
        console.log('[SelectFilterWrapper] getGui() called, returning:', this.eGui);
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
        this.vueInstance?.setModel?.(model);
    }

    onParentModelChanged(model) {
        this.vueInstance?.onParentModelChanged?.(model);
    }

    refresh(params) {
        return this.vueInstance?.refresh?.(params) ?? true;
    }

    destroy() {
        console.log('[SelectFilterWrapper] destroy() called');
        if (this.vueApp) {
            this.vueApp.unmount();
            this.vueApp = null;
        }
        this.vueInstance = null;
        this.eGui = null;
    }
}
