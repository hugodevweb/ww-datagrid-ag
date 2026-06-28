import { createApp } from 'vue';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import App from './App.vue';

// The real cell renderers call `wwLib?.getFrontDocument?.()`. Because `wwLib`
// is a bare (undeclared) global in the WeWeb runtime, optional chaining does
// NOT save us — referencing an undeclared identifier throws ReferenceError.
// So we provide a minimal stub that resolves to the standalone document/window.
window.wwLib = {
  getFrontDocument: () => document,
  getFrontWindow: () => window,
};

// AG Grid v34 is modular — register the community feature set once.
ModuleRegistry.registerModules([AllCommunityModule]);

createApp(App).mount('#app');
