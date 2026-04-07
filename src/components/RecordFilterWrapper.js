import { createApp } from 'vue';
import RecordFilterComponent from './RecordFilterComponent.vue';

/**
 * Manual wrapper for RecordFilterComponent to work with AG Grid Vue 3
 * This ensures AG Grid receives a proper instance with getGui() method
 */
export default class RecordFilterWrapper {
    constructor() {
        this.vueApp = null;
        this.vueInstance = null;
        this.eGui = document.createElement('div');
        this.eGui.className = 'record-filter-wrapper';
    }

    init(params) {
        this.vueApp = createApp(RecordFilterComponent, { params });
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
