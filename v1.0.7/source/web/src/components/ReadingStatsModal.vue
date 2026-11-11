<template>
  <el-dialog
    v-model="visible"
    title="📊 个人阅读数据与成就看板"
    width="90%"
    class="visionos-dialog"
    destroy-on-close
    append-to-body
  >
    <div class="stats-container">
      <!-- 顶部数据 4 宫格 -->
      <div class="metrics-grid">
        <div class="metric-card glass-card">
          <div class="metric-icon">⏱️</div>
          <div class="metric-value">{{ todayMinutes }} <span class="unit">分钟</span></div>
          <div class="metric-label">今日专注阅读</div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon">🚀</div>
          <div class="metric-value">{{ readingSpeed }} <span class="unit">字/分</span></div>
          <div class="metric-label">平均阅读速度</div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon">📖</div>
          <div class="metric-value">{{ formatWords(statsStore.todayWords) }}</div>
          <div class="metric-label">今日已读字数</div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon">📚</div>
          <div class="metric-value">{{ formatWords(statsStore.totalWords) }}</div>
          <div class="metric-label">累计阅读字数</div>
        </div>
      </div>

      <!-- 近 7 天阅读时长趋势折线图/柱状图 -->
      <div class="chart-section glass-card">
        <div class="section-title">📈 近 7 天阅读历程</div>
        <div class="bar-chart">
          <div
            v-for="(item, index) in displayWeekDays"
            :key="index"
            class="bar-col"
          >
            <div class="bar-value">{{ Math.round((item.seconds || 0) / 60) }}m</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ height: getBarHeight(item.seconds) }"
              ></div>
            </div>
            <div class="bar-label">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <!-- 成就勋章墙 -->
      <div class="achievements-section glass-card">
        <div class="section-title">🏆 荣誉成就墙</div>
        <div class="badges-grid">
          <div
            v-for="badge in badgeList"
            :key="badge.id"
            class="badge-item"
            :class="{ unlocked: statsStore.achievements[badge.id] }"
          >
            <div class="badge-icon">{{ badge.icon }}</div>
            <div class="badge-name">{{ badge.name }}</div>
            <div class="badge-desc">{{ badge.desc }}</div>
            <div class="badge-status">
              {{ statsStore.achievements[badge.id] ? '已达成 ✦' : '探索中' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useStatsStore } from '../stores/stats';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);
const statsStore = useStatsStore();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const todayMinutes = computed(() => {
  return Math.round(statsStore.todaySeconds / 60);
});

const readingSpeed = computed(() => {
  const mins = statsStore.todaySeconds / 60;
  if (mins < 1) return 450; // 默认初始参考阅读速度
  return Math.round(statsStore.todayWords / mins) || 450;
});

function formatWords(num) {
  if (!num) return '0 字';
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + ' 万字';
  }
  return num + ' 字';
}

const badgeList = [
  { id: 'first_read', icon: '🌟', name: '初涉书海', desc: '开启第一段沉浸阅读之旅' },
  { id: 'words_10k', icon: '🌱', name: '小试牛刀', desc: '累计阅读超过 1 万字' },
  { id: 'words_100k', icon: '📜', name: '读书破万卷', desc: '累计阅读超过 10 万字' },
  { id: 'words_1m', icon: '👑', name: '百万巨著', desc: '累计阅读突破 100 万字' },
  { id: 'night_owl', icon: '🌙', name: '月下伴读', desc: '深夜 23:00 后静心阅读' },
  { id: 'offline_fly', icon: '✈️', name: '云端漫卷', desc: '离线模式下无拘看书' },
  { id: 'book_finish', icon: '🎉', name: '一览无余', desc: '读完一本完整小说' }
];

const displayWeekDays = computed(() => {
  const result = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = statsStore.recentStats.find(r => r.date === dateStr);
    result.push({
      date: dateStr,
      label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
      seconds: found ? found.seconds : 0
    });
  }
  return result;
});

function getBarHeight(seconds) {
  const maxSecs = Math.max(3600, ...displayWeekDays.value.map(d => d.seconds || 0));
  const percent = Math.min(100, Math.round(((seconds || 0) / maxSecs) * 100));
  return `${Math.max(6, percent)}%`;
}

onMounted(() => {
  statsStore.loadRecentStats();
});
</script>

<style scoped>
.stats-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 75vh;
  overflow-y: auto;
  padding-right: 4px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 640px) {
  .metrics-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.metric-card {
  padding: 16px;
  text-align: center;
  border-radius: 14px;
}

.metric-icon {
  font-size: 24px;
  margin-bottom: 6px;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary-color);
}

.metric-value .unit {
  font-size: 13px;
  font-weight: normal;
  color: #64748b;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.chart-section {
  padding: 18px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 140px;
  padding-top: 20px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
}

.bar-value {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.bar-track {
  flex: 1;
  width: 18px;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #34d399 0%, #10b981 100%);
  border-radius: 6px;
  transition: height 0.5s ease;
}

.bar-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 6px;
}

.achievements-section {
  padding: 18px;
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.badge-item {
  padding: 14px 10px;
  text-align: center;
  border-radius: 12px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.15);
  opacity: 0.5;
  filter: grayscale(80%);
  transition: all 0.3s ease;
}

.badge-item.unlocked {
  opacity: 1;
  filter: none;
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.3);
}

.badge-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.badge-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.badge-desc {
  font-size: 10px;
  color: #64748b;
  line-height: 1.3;
}

.badge-status {
  font-size: 10px;
  margin-top: 6px;
  color: var(--primary-color);
  font-weight: 500;
}
</style>
