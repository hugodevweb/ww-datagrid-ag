// Grid API call queue to replace setTimeout cascades with proper event-driven approach

/**
 * Queue manager for AG Grid API calls to avoid timing issues and race conditions
 */
export class GridApiQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.frameId = null;
  }

  /**
   * Add a grid API call to the queue
   * @param {Function} apiCall - Function that makes the grid API call
   * @param {Object} options - Options for the call
   * @param {number} options.priority - Priority (0 = highest, higher numbers = lower priority)
   * @param {string} options.description - Description for debugging
   * @param {Function} options.condition - Optional condition function that must return true to execute
   * @returns {Promise} Promise that resolves when the call is executed
   */
  enqueue(apiCall, options = {}) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        apiCall,
        resolve,
        reject,
        priority: options.priority || 0,
        description: options.description || 'Grid API call',
        condition: options.condition,
        timestamp: Date.now()
      };

      // Insert based on priority (lower numbers = higher priority)
      const insertIndex = this.queue.findIndex(item => item.priority > queueItem.priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue using requestAnimationFrame for better performance
   */
  processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.frameId = requestAnimationFrame(() => {
      this.processQueueSync();
    });
  }

  /**
   * Synchronously process queue items
   */
  processQueueSync() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        // Check condition if provided
        if (item.condition && !item.condition()) {
          // Skip this item if condition fails
          item.resolve(false);
          continue;
        }

        // Execute the API call
        const result = item.apiCall();
        item.resolve(result);
      } catch (error) {
        console.error(`[GridApiQueue] Error in ${item.description}:`, error);
        item.reject(error);
      }
    }

    this.isProcessing = false;
    this.frameId = null;
  }

  /**
   * Clear all pending calls
   */
  clear() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    // Reject all pending calls
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });

    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Get queue status for debugging
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      items: this.queue.map(item => ({
        description: item.description,
        priority: item.priority,
        age: Date.now() - item.timestamp
      }))
    };
  }
}

/**
 * Utility functions for common grid API patterns
 */
export class GridApiUtils {
  constructor(gridApiQueue) {
    this.queue = gridApiQueue;
  }

  /**
   * Safely refresh cells with proper timing
   */
  refreshCells(gridApi, options = {}) {
    return this.queue.enqueue(
      () => {
        if (gridApi) {
          return gridApi.refreshCells(options);
        }
        return false;
      },
      {
        priority: 2,
        description: `refreshCells(${JSON.stringify(options)})`,
        condition: () => !!gridApi
      }
    );
  }

  /**
   * Safely redraw rows with proper timing
   */
  redrawRows(gridApi, options = {}) {
    return this.queue.enqueue(
      () => {
        if (gridApi) {
          return gridApi.redrawRows(options);
        }
        return false;
      },
      {
        priority: 2,
        description: `redrawRows(${JSON.stringify(options)})`,
        condition: () => !!gridApi
      }
    );
  }

  /**
   * Set filter model with validation
   */
  setFilterModel(gridApi, filterModel, description = 'setFilterModel') {
    return this.queue.enqueue(
      () => {
        if (gridApi) {
          return gridApi.setFilterModel(filterModel);
        }
        return false;
      },
      {
        priority: 1, // High priority for filter changes
        description,
        condition: () => !!gridApi
      }
    );
  }

  /**
   * Apply column state with validation
   */
  applyColumnState(gridApi, state, description = 'applyColumnState') {
    return this.queue.enqueue(
      () => {
        if (gridApi) {
          return gridApi.applyColumnState(state);
        }
        return false;
      },
      {
        priority: 1, // High priority for column changes
        description,
        condition: () => !!gridApi
      }
    );
  }

  /**
   * Set datasource with proper validation
   */
  setDatasource(gridApi, datasource, description = 'setDatasource') {
    return this.queue.enqueue(
      () => {
        if (gridApi && datasource) {
          return gridApi.setGridOption('datasource', datasource);
        }
        return false;
      },
      {
        priority: 0, // Highest priority for datasource changes
        description,
        condition: () => !!(gridApi && datasource)
      }
    );
  }

  /**
   * Complex datasource refresh pattern (replaces the duplicated pattern)
   */
  async refreshDatasourceWithState(gridApi, datasource, description = 'refreshDatasourceWithState') {
    if (!gridApi || !datasource) return false;

    // Capture current state
    const currentFilters = gridApi.getFilterModel();
    const currentSort = gridApi.getState()?.sort?.sortModel;

    try {
      // Set new datasource
      await this.setDatasource(gridApi, datasource, `${description} - setDatasource`);

      // Restore filters if they exist
      if (currentFilters && Object.keys(currentFilters).length > 0) {
        await this.setFilterModel(gridApi, currentFilters, `${description} - restoreFilters`);
      }

      // Restore sorting if it exists
      if (currentSort && currentSort.length > 0) {
        await this.applyColumnState(gridApi, {
          state: currentSort,
          defaultState: { sort: null },
        }, `${description} - restoreSort`);
      }

      return true;
    } catch (error) {
      console.error(`[GridApiUtils] Error in ${description}:`, error);
      return false;
    }
  }

  /**
   * Batch multiple operations
   */
  async batchOperations(operations) {
    const promises = operations.map(op => {
      return this.queue.enqueue(op.apiCall, {
        priority: op.priority || 2,
        description: op.description || 'Batch operation',
        condition: op.condition
      });
    });

    return Promise.all(promises);
  }
}

// Singleton instance for the grid API queue
export const globalGridApiQueue = new GridApiQueue();
export const globalGridApiUtils = new GridApiUtils(globalGridApiQueue);