import { createApp } from 'vue';
import UserFilterComponent from './UserFilterComponent.vue';

/**
 * Manual wrapper for UserFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 */
export default class UserFilterWrapper {
    constructor() {
        this.vueApp = null;
        this.vueInstance = null;
        // CRITICAL: Create eGui immediately in constructor
        // This ensures getGui() always has something to return
        this.eGui = document.createElement('div');
        this.eGui.className = 'user-filter-wrapper';
    }

    init(params) {
        // Create and mount the Vue app to the pre-created container
        this.vueApp = createApp(UserFilterComponent, { params });
        this.vueInstance = this.vueApp.mount(this.eGui);
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
        this.vueInstance?.setModel?.(model);
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
    }
}

