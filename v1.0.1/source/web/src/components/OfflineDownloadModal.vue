<template>
  <el-dialog
    v-model="visible"
    title="✈️ PWA 全本离线缓存管理"
    width="90%"
    class="visionos-dialog"
    destroy-on-close
    append-to-body
  >
    <div class="offline-container">
      <div class="tip-card glass-card">
        <div class="tip-title">⚡ 坐高铁、乘飞机，断网无忧看全本</div>
        <div class="tip-text">
          正文将高速缓存至浏览器本地 IndexedDB 数据库中。在完全断网的环境下依然能任意翻页跳转，联网后自动同步进度。
        </div>
      </div>

      <!-- 离线统计与状态 -->
      <div class="cache-status-card glass-card">
        <div class="status-row">
          <span>当前书籍:</span>
          <strong>《{{ book?.name || '当前图书' }}》</strong>
        </div>
        <div class="status-row">
          <span>总章节数:</span>
          <span>{{ chapterList.length }} 章</span>
        </div>
        <div class="status-row">
          <span>已离线章节:</span>
          <span class="cached-count">{{ cachedCount }} 章 ({{ cachedPercent }}%)</span>
        </div>
      </div>

      <!-- 下载进度条 -->
      <div v-if="offlineStore.isDownloading" class="progress-section glass-card">
        <div class="progress-info">
          <span>正在离线下载章节...</span>
          <span>{{ offlineStore.currentProgress }} / {{ offlineStore.totalToDownload }}</span>
        </div>
        <el-progress
          :percentage="downloadPercentage"
          :stroke-width="10"
          color="#10b981"
          striped
          striped-flow
        />
        <div style="margin-top: 12px; text-align: right;">
          <el-button size="small" type="danger" plain @click="offlineStore.cancelDownload">
            暂停下载
          </el-button>
        </div>
      </div>

      <!-- 下载操作区 -->
      <div v-else class="actions-section">
        <div class="action-buttons">
          <el-button
            type="primary"
            class="glow-btn"
            :disabled="cachedCount >= chapterList.length"
            @click="startDownload(chapterList.length)"
          >
            🚀 离线全本书籍 (推荐)
          </el-button>

          <el-button
            type="success"
            plain
            :disabled="cachedCount >= chapterList.length"
            @click="startDownload(200)"
          >
            📥 离线后 200 章
          </el-button>

          <el-button
            type="info"
            plain
            :disabled="cachedCount >= chapterList.length"
            @click="startDownload(50)"
          >
            📥 离线后 50 章
          </el-button>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <el-button
            type="text"
            style="color: #ef4444;"
            :disabled="cachedCount === 0"
            @click="handleClearCache"
          >
            🗑️ 清除本书本地离线数据
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useOfflineStore } from '../stores/offline';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  book: {
    type: Object,
    default: () => ({})
  },
  chapterList: {
    type: Array,
    default: () => []
  },
  currentIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:modelValue']);
const offlineStore = useOfflineStore();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const cachedSet = computed(() => {
  return offlineStore.cachedIndicesMap[props.book?.bookUrl] || new Set();
});

const cachedCount = computed(() => {
  return cachedSet.value.size;
});

const cachedPercent = computed(() => {
  if (!props.chapterList.length) return 0;
  return Math.min(100, Math.round((cachedCount.value / props.chapterList.length) * 100));
});

const downloadPercentage = computed(() => {
  if (!offlineStore.totalToDownload) return 0;
  return Math.min(100, Math.round((offlineStore.currentProgress / offlineStore.totalToDownload) * 100));
});

watch(() => props.book?.bookUrl, (url) => {
  if (url) {
    offlineStore.refreshCachedIndices(url);
  }
}, { immediate: true });

function startDownload(count) {
  if (!props.book || !props.chapterList.length) {
    ElMessage.warning('暂无章节可下载');
    return;
  }
  offlineStore.downloadChapters(props.book, props.chapterList, props.currentIndex, count);
}

async function handleClearCache() {
  try {
    await ElMessageBox.confirm('确定清除本书已缓存的离线章节吗？', '提示', {
      type: 'warning',
      confirmButtonText: '确定清除',
      cancelButtonText: '取消'
    });
    await offlineStore.clearCache(props.book.bookUrl);
    ElMessage.success('离线缓存已清除');
  } catch (e) {}
}
</script>

<style scoped>
.offline-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tip-card {
  padding: 14px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
}

.tip-title {
  font-size: 14px;
  font-weight: 600;
  color: #059669;
  margin-bottom: 4px;
}

.tip-text {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.cache-status-card {
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #64748b;
}

.status-row strong {
  color: #1e293b;
}

.cached-count {
  color: var(--primary-color);
  font-weight: 600;
}

.progress-section {
  padding: 16px;
  border-radius: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.glow-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  font-weight: 600;
}
</style>
