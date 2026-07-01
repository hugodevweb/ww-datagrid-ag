<template>
  <!-- Mirrors the "View Option" switcher from the WeWeb app: clicking a tab
       sets tablesSettings.type, which the wrapper reads to pick the view. -->
  <div class="view-tabs" role="tablist" aria-label="View switcher">
    <button
      v-for="opt in options"
      :key="opt.type"
      type="button"
      role="tab"
      class="view-tab"
      :class="{ 'view-tab--active': active === opt.type }"
      :aria-selected="active === opt.type"
      @click="$emit('change', opt.type)"
    >
      <span class="view-tab__icon" v-html="opt.icon" />
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'ViewTabs',
  props: {
    active: { type: String, required: true },
  },
  emits: ['change'],
  data() {
    return {
      options: [
        {
          type: 'grid',
          label: 'Grid',
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`,
        },
        {
          type: 'kanban',
          label: 'Kanban',
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/></svg>`,
        },
        {
          type: 'calendar',
          label: 'Calendar',
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
        },
      ],
    };
  },
};
</script>

<style scoped>
.view-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: #f1f2f5;
  border-radius: 10px;
}
.view-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}
.view-tab:hover { color: #374151; }
.view-tab--active {
  background: #fff;
  color: #4f46e5;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
}
.view-tab__icon { display: inline-flex; }
</style>
