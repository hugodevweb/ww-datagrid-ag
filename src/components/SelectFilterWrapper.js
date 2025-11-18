import { createApp } from 'vue';
import SelectFilterComponent from './SelectFilterComponent.vue';

/**
 * Manual wrapper for SelectFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 */
export default class SelectFilterWrapper {
    constructor() {
        console.log('[SelectFilterWrapper] constructor called');
        this.vueApp = null;
        this.vueInstance = null;
        this.eGui = null;
    }

    init(params) {
        console.log('[SelectFilterWrapper] init() called with params:', params);

        // Create a container for the Vue app
        this.eGui = document.createElement('div');

        // Create and mount the Vue app
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
