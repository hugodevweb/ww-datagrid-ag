import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { GridApiQueue, GridApiUtils } from '../utils/gridApiQueue.js';
import { createGridMonitor } from '../utils/performanceMonitor.js';
import { waitForRowInGrid } from '../utils/rowLookup.js';

// Foundation composable: owns the grid API ref, queue, and the rendering/ready state
// flags used to coordinate with AG Grid's render cycle (preventing error #252).
//
// Inputs:
//   cfg                   — computed merged config (reactive ref)
//   props                 — component props (reads props.content for row lookups)
//   resolveMappingFormula — wwLib formula resolver
export function useGridApi(cfg, props, resolveMappingFormula) {
  // Debug logging helper (gated by cfg.enableDebugLogs)
  const debugLog = (...args) => {
    if (cfg.value?.enableDebugLogs) {
      console.log(...args);
    }
  };

  // Performance monitor — all recording is no-ops unless enableDebugLogs is on
  const gridMonitor = createGridMonitor(() => !!cfg.value?.enableDebugLogs);

  const gridApi = shallowRef(null);

  // Initialize grid API queue for this component instance
  const gridApiQueue = new GridApiQueue();
  const gridApiUtils = new GridApiUtils(gridApiQueue);

  // Cleanup queue on component unmount
  onBeforeUnmount(() => {
    gridApiQueue.clear();
  });

  const gridReady = ref(false);
  const dataRendered = ref(false);
  const dataLoadingTimeout = ref(null);

  // CRITICAL FIX: Track when the grid is actively rendering to prevent error #252
  // "cannot get grid to draw rows when it is in the middle of drawing rows"
  const isGridRendering = ref(false);

  // Helper to safely call grid API methods - defers to next tick if grid is rendering
  const safeGridApiCall = (callback, delay = 0) => {
    return new Promise((resolve) => {
      const executeCall = () => {
        if (!gridApi.value) {
          resolve(false);
          return;
        }

        // If grid is rendering, defer the call
        if (isGridRendering.value) {
          setTimeout(() => executeCall(), 10);
          return;
        }

        try {
          const result = callback();
          resolve(result);
        } catch (error) {
          // If we still get the error, retry with a longer delay
          if (error.message && error.message.includes('#252')) {
            setTimeout(() => executeCall(), 50);
          } else {
            console.error('[Datagrid] Safe API call error:', error);
            resolve(false);
          }
        }
      };

      if (delay > 0) {
        setTimeout(executeCall, delay);
      } else {
        executeCall();
      }
    });
  };

  // Helper to wait for grid to be fully ready (not just initialized, but ready for API calls)
  const waitForGridReady = (timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkReady = () => {
        if (gridApi.value && gridReady.value && !isGridRendering.value) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('[Datagrid] Timeout waiting for grid to be ready'));
          return;
        }

        setTimeout(checkReady, 50);
      };

      checkReady();
    });
  };

  // Helper to wait for a specific row to appear in the grid (using unified utility)
  const waitForRowInGridLocal = (rowId, timeout = 10000) => {
    return waitForRowInGrid(gridApi.value, rowId, resolveMappingFormula, props.content, timeout);
  };

  return {
    debugLog,
    gridMonitor,
    gridApi,
    gridApiQueue,
    gridApiUtils,
    gridReady,
    dataRendered,
    dataLoadingTimeout,
    isGridRendering,
    safeGridApiCall,
    waitForGridReady,
    waitForRowInGridLocal,
  };
}
