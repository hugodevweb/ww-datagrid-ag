import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// Component-width based responsiveness, shared by Datagrid, Kanban and Calendar.
//
// These are WeWeb custom components that can be placed anywhere on a page (full
// width, sidebar, split view), so the browser viewport is NOT a reliable proxy
// for how much room the component actually has. Instead of CSS `@media` queries
// we observe each component's OWN root width with a ResizeObserver and toggle
// classes; all responsive CSS keys off `.is-compact` / `.is-mobile` on the root.
//
// Usage:
//   const { width, isCompact, isMobile, responsiveClass } = useResponsive(rootRef);
//   <div ref="rootRef" :class="responsiveClass"> ...
//
// Breakpoints (px), tuned to the component width, not the viewport:
//   - compact: < 640  (tighter spacing / touch targets, still desktop-ish layout)
//   - mobile:  < 480  (phone layout — swipe lanes, full-screen overlays, etc.)
const COMPACT_MAX = 640;
const MOBILE_MAX = 480;

export function useResponsive(rootRef, { compactMax = COMPACT_MAX, mobileMax = MOBILE_MAX } = {}) {
  const width = ref(Infinity);
  let ro = null;

  const measure = () => {
    const el = rootRef.value;
    if (el) width.value = el.clientWidth || el.getBoundingClientRect().width || 0;
  };

  onMounted(() => {
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      if (rootRef.value) ro.observe(rootRef.value);
    }
  });

  onBeforeUnmount(() => {
    if (ro) { ro.disconnect(); ro = null; }
  });

  const isCompact = computed(() => width.value < compactMax);
  const isMobile = computed(() => width.value < mobileMax);

  // `.is-mobile` implies `.is-compact` so compact-tier rules also apply on phones.
  const responsiveClass = computed(() => ({
    'is-compact': isCompact.value,
    'is-mobile': isMobile.value,
  }));

  return { width, isCompact, isMobile, responsiveClass };
}
