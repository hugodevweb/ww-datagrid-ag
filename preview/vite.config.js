import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// Standalone preview of the real datagrid cell renderers, fed with mock data.
// Root is this folder; we alias `@` to ../src so we can import the actual
// component source (UserCellRenderer, RecordCellRenderer, SelectCellRenderer…).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  resolve: {
    // Force single instances of Vue AND ag-grid-community. ag-grid-vue3 mounts
    // custom cell renderers via getCurrentInstance() (no-ops on duplicate Vue),
    // and AG Grid's module/component registry must be the SAME ag-grid-community
    // instance the grid runs on — otherwise registered renderers silently never
    // instantiate (core text rendering still works, which is the tell).
    dedupe: ['vue', 'ag-grid-community', 'ag-grid-vue3'],
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: { port: 5180 },
});
