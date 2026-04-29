/**
 * Grid Performance Monitor
 *
 * Lightweight utility to measure and report row-rendering performance.
 * All instrumentation is gated behind the `enabled` flag so it adds zero
 * overhead in production when debug logs are turned off.
 *
 * Usage (inside wwElement.vue setup / methods):
 *
 *   import { createGridMonitor } from './utils/performanceMonitor.js';
 *   const monitor = createGridMonitor(() => props.content?.enableDebugLogs);
 *
 *   // Wrap a potentially expensive call:
 *   monitor.time('applyTransaction', () => gridApi.applyTransaction(...));
 *
 *   // Track each scroll event:
 *   monitor.trackScroll();
 *
 *   // Print a summary to the console:
 *   monitor.report();
 */

/**
 * Create a monitor instance.
 *
 * @param {() => boolean} isEnabled - Reactive getter; when it returns false
 *                                    all methods are no-ops.
 * @returns {GridMonitor}
 */
export function createGridMonitor(isEnabled) {
  /** @type {Map<string, { count: number; totalMs: number; minMs: number; maxMs: number }>} */
  const metrics = new Map();

  let scrollCount = 0;
  let lastScrollTime = 0;
  let maxScrollGapMs = 0;

  // Rolling window of the last N frame durations for scroll-smoothness tracking
  const FRAME_WINDOW = 60;
  const frameDurations = [];
  let lastFrameTime = 0;

  function record(name, durationMs) {
    if (!metrics.has(name)) {
      metrics.set(name, { count: 0, totalMs: 0, minMs: Infinity, maxMs: -Infinity });
    }
    const m = metrics.get(name);
    m.count++;
    m.totalMs += durationMs;
    if (durationMs < m.minMs) m.minMs = durationMs;
    if (durationMs > m.maxMs) m.maxMs = durationMs;
  }

  return {
    /**
     * Measure a synchronous call and record its duration.
     *
     * @param {string}   name - Label for this measurement
     * @param {Function} fn   - Function to execute and time
     * @returns The return value of fn()
     */
    time(name, fn) {
      if (!isEnabled()) return fn();
      const t0 = performance.now();
      const result = fn();
      record(name, performance.now() - t0);
      return result;
    },

    /**
     * Start a named timer.  Returns a function that, when called, stops the
     * timer and records the elapsed duration.
     *
     * Useful for async flows:
     *   const stop = monitor.start('fetchRows');
     *   await fetch(...);
     *   stop();
     *
     * @param {string} name
     * @returns {() => void} stop function
     */
    start(name) {
      if (!isEnabled()) return () => {};
      const t0 = performance.now();
      return () => record(name, performance.now() - t0);
    },

    /**
     * Record that a scroll event occurred.  Tracks frequency and gap between
     * consecutive scroll events so you can see whether rapid scrolling is
     * outpacing the row buffer.
     */
    trackScroll() {
      if (!isEnabled()) return;
      const now = performance.now();
      scrollCount++;
      if (lastScrollTime > 0) {
        const gap = now - lastScrollTime;
        if (gap > maxScrollGapMs) maxScrollGapMs = gap;
      }
      lastScrollTime = now;
    },

    /**
     * Record a rendered animation frame.  Call once per rAF to track frame
     * duration so you can compute average FPS while scrolling.
     */
    trackFrame() {
      if (!isEnabled()) return;
      const now = performance.now();
      if (lastFrameTime > 0) {
        frameDurations.push(now - lastFrameTime);
        if (frameDurations.length > FRAME_WINDOW) frameDurations.shift();
      }
      lastFrameTime = now;
    },

    /**
     * Estimate frames-per-second from the rolling frame window.
     * Returns null when not enough data has been collected.
     *
     * @returns {number | null}
     */
    estimateFps() {
      if (frameDurations.length < 2) return null;
      const avgMs = frameDurations.reduce((a, b) => a + b, 0) / frameDurations.length;
      return avgMs > 0 ? Math.round(1000 / avgMs) : null;
    },

    /**
     * Print a formatted performance report to the browser console.
     * Only outputs when isEnabled() is true.
     */
    report() {
      if (!isEnabled()) return;

      const fps = this.estimateFps();
      console.group('[GridMonitor] Performance Report');

      // Scroll summary
      console.log(
        `Scroll events: ${scrollCount}  |  Max gap between events: ${maxScrollGapMs.toFixed(1)} ms` +
        (fps != null ? `  |  Est. FPS: ${fps}` : '')
      );

      // Per-operation summary table
      if (metrics.size > 0) {
        const rows = [];
        for (const [name, m] of metrics) {
          rows.push({
            operation: name,
            calls: m.count,
            'avg ms': (m.totalMs / m.count).toFixed(2),
            'min ms': m.minMs.toFixed(2),
            'max ms': m.maxMs.toFixed(2),
            'total ms': m.totalMs.toFixed(2),
          });
        }
        console.table(rows);
      } else {
        console.log('No timed operations recorded yet.');
      }

      console.groupEnd();
    },

    /**
     * Reset all collected data.
     */
    reset() {
      metrics.clear();
      scrollCount = 0;
      lastScrollTime = 0;
      maxScrollGapMs = 0;
      frameDurations.length = 0;
      lastFrameTime = 0;
    },
  };
}
