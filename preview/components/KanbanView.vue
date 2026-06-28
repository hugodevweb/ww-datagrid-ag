<template>
  <!-- Presentational kanban that mirrors the real Kanban.vue look (lanes grouped
       by a select field, draggable cards) without its WeWeb/Supabase coupling. -->
  <div class="kanban">
    <div class="kanban__controls">
      <label>Group by</label>
      <div class="kanban__seg">
        <button
          v-for="f in groupableFields"
          :key="f.field"
          type="button"
          :class="{ 'is-active': groupByField === f.field }"
          @click="groupByField = f.field"
        >{{ f.label }}</button>
      </div>
    </div>

    <div class="kanban__board">
      <div
        v-for="lane in lanes"
        :key="lane.value"
        class="kanban__col"
        :style="{ '--lane-color': lane.color }"
        :class="{ 'is-drop': dragOver === lane.value }"
        @dragover.prevent="dragOver = lane.value"
        @dragleave="dragOver === lane.value && (dragOver = null)"
        @drop.prevent="onDrop(lane.value)"
      >
        <div class="kanban__col-head">
          <span class="kanban__dot" />
          <span class="kanban__col-label">{{ lane.label }}</span>
          <span class="kanban__col-count">{{ lane.rows.length }}</span>
        </div>

        <div class="kanban__col-body">
          <article
            v-for="row in lane.rows"
            :key="row.id"
            class="kanban__card"
            :class="{ 'is-dragging': dragId === row.id }"
            draggable="true"
            @dragstart="onDragStart(row.id)"
            @dragend="dragId = null"
          >
            <div class="kanban__card-top">
              <img :src="row.cover" class="kanban__cover" alt="" />
              <span class="kanban__title">{{ row.project }}</span>
            </div>

            <div class="kanban__meta">
              <span
                class="kanban__pill"
                :style="pillStyle(priorityOption(row.priority))"
              >{{ priorityOption(row.priority)?.label }}</span>
              <span v-if="companyById(row.company_id)" class="kanban__company">
                {{ companyById(row.company_id).name }}
              </span>
            </div>

            <div class="kanban__card-foot">
              <div class="kanban__avatars">
                <img
                  v-for="uid in row.assignees"
                  :key="uid"
                  :src="avatarFor(uid)"
                  :title="nameFor(uid)"
                  class="kanban__avatar"
                  alt=""
                />
              </div>
              <span class="kanban__due">{{ formatDue(row.due) }}</span>
            </div>
          </article>

          <p v-if="!lane.rows.length" class="kanban__empty">Drop cards here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getDefaultAvatarFor, getUserName } from '@/shared/utils/avatarUtils.js';
import {
  STATUS_OPTIONS, PRIORITY_OPTIONS,
  priorityOption, userById, companyById,
} from '../mockData.js';
import { dataStore, patchRow } from '../store.js';

export default {
  name: 'KanbanView',
  data() {
    return {
      groupByField: 'status',
      groupableFields: [
        { field: 'status', label: 'Status' },
        { field: 'priority', label: 'Priority' },
      ],
      dragId: null,
      dragOver: null,
    };
  },
  computed: {
    options() {
      return this.groupByField === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS;
    },
    lanes() {
      return this.options.map((opt) => ({
        ...opt,
        rows: dataStore.rows.filter((r) => r[this.groupByField] === opt.value),
      }));
    },
  },
  methods: {
    priorityOption,
    companyById,
    avatarFor(uid) {
      return getDefaultAvatarFor(getUserName(userById(uid)));
    },
    nameFor(uid) {
      return getUserName(userById(uid));
    },
    pillStyle(opt) {
      if (!opt) return {};
      return { background: opt.color + '1f', color: opt.color };
    },
    formatDue(due) {
      const d = new Date(due);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    onDragStart(id) {
      this.dragId = id;
    },
    onDrop(laneValue) {
      this.dragOver = null;
      if (this.dragId == null) return;
      // Move the card → update the grouped field, reflected across all views.
      patchRow(this.dragId, { [this.groupByField]: laneValue });
      this.dragId = null;
    },
  },
};
</script>

<style scoped>
.kanban { display: flex; flex-direction: column; height: 100%; }
.kanban__controls { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.kanban__controls label { font-size: 13px; color: #6b7280; font-weight: 600; }
.kanban__seg { display: inline-flex; gap: 2px; padding: 3px; background: #f1f2f5; border-radius: 9px; }
.kanban__seg button {
  border: none; background: transparent; color: #6b7280;
  font-size: 13px; font-weight: 600; padding: 5px 12px; border-radius: 7px; cursor: pointer;
}
.kanban__seg button.is-active { background: #fff; color: #4f46e5; box-shadow: 0 1px 2px rgba(16,24,40,.08); }

.kanban__board {
  display: flex; gap: 14px; align-items: flex-start;
  overflow-x: auto; flex: 1 1 auto; padding-bottom: 8px;
}
.kanban__col {
  flex: 0 0 268px; background: #f7f8fa; border: 1px solid #ececec;
  border-radius: 12px; padding: 10px; transition: background .12s, border-color .12s;
}
.kanban__col.is-drop { background: #eef2ff; border-color: #c7d2fe; }
.kanban__col-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px 10px; }
.kanban__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--lane-color); flex: 0 0 auto; }
.kanban__col-label { font-size: 13px; font-weight: 700; color: #374151; }
.kanban__col-count {
  margin-left: auto; font-size: 12px; font-weight: 600; color: #6b7280;
  background: #fff; border-radius: 999px; padding: 1px 8px; border: 1px solid #ececec;
}
.kanban__col-body { display: flex; flex-direction: column; gap: 8px; min-height: 40px; }

.kanban__card {
  background: #fff; border: 1px solid #ececec; border-radius: 10px; padding: 10px 11px;
  cursor: grab; box-shadow: 0 1px 2px rgba(16,24,40,.04); transition: box-shadow .12s, transform .08s;
}
.kanban__card:hover { box-shadow: 0 4px 12px rgba(16,24,40,.1); }
.kanban__card.is-dragging { opacity: .5; }
.kanban__card-top { display: flex; align-items: center; gap: 9px; }
.kanban__cover { width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; }
.kanban__title { font-size: 13.5px; font-weight: 600; color: #1f2430; line-height: 1.3; }
.kanban__meta { display: flex; align-items: center; gap: 8px; margin: 9px 0; flex-wrap: wrap; }
.kanban__pill { padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.kanban__company { font-size: 12px; color: #6b7280; }
.kanban__card-foot { display: flex; align-items: center; justify-content: space-between; }
.kanban__avatars { display: flex; }
.kanban__avatar { width: 22px; height: 22px; border-radius: 50%; margin-left: -6px; border: 2px solid #fff; }
.kanban__avatar:first-child { margin-left: 0; }
.kanban__due { font-size: 12px; color: #6b7280; font-weight: 600; }
.kanban__empty { color: #b6bcc6; font-size: 12.5px; text-align: center; padding: 14px 0; margin: 0; }
</style>
