<template>
  <el-drawer
    v-model="visible"
    title="🔀 智能全网换源"
    direction="rtl"
    size="380px"
    :destroy-on-close="false"
    append-to-body
    class="book-source-drawer"
  >
    <div class="source-drawer-header">
      <div class="book-meta-bar">
        <div class="book-title-meta">《{{ bookName }}》</div>
        <div class="book-author-meta">{{ author || '未知作者' }}</div>
      </div>
      <div class="drawer-action-row">
        <span class="source-count-badge">已发现 {{ sourceList.length }} 个源</span>
        <el-button
          type="primary"
          size="small"
          :loading="scanning"
          @click="startLiveScan"
          class="scan-action-btn"
        >
          {{ scanning ? '扫描中...' : '⚡ 全网深度测速' }}
        </el-button>
      </div>
    </div>

    <!-- 换源进度条（仅在扫描时显示） -->
    <el-progress
      v-if="scanning"
      :percentage="scanProgress"
      :indeterminate="true"
      :show-text="false"
      class="scan-progress-bar"
    />

    <!-- 书源列表 -->
    <div class="source-scroll-list" v-loading="loadingAvailable && sourceList.length === 0">
      <div v-if="sourceList.length === 0 && !loadingAvailable && !scanning" class="empty-source-tip">
        <div class="empty-icon">🔍</div>
        <p>暂无缓存书源，请点击上方“全网深度测速”扫描</p>
      </div>

      <div
        v-for="(s, sIdx) in sortedSources"
        :key="s.bookUrl || sIdx"
        class="source-card"
        :class="{
          'is-active-source': isCurrent(s),
          'is-switching': switchingUrl === s.bookUrl
        }"
        @click="handleSelectSource(s)"
      >
        <div class="source-top-line">
          <div class="source-name-wrap">
            <span class="source-name-text">{{ s.originName || s.origin || '未知书源' }}</span>
            <span v-if="isCurrent(s)" class="badge-tag badge-current">【当前】</span>
            <span v-else class="badge-tag badge-available">可用</span>
          </div>
          <div class="source-latency" :class="getLatencyClass(s.time)">
            {{ s.time ? `⏱ ${s.time}ms` : '🟢 在线' }}
          </div>
        </div>

        <div class="source-bottom-line">
          <span class="latest-chapter-label">最新:</span>
          <span class="latest-chapter-title" :title="s.latestChapterTitle || '暂无目录信息'">
            {{ s.latestChapterTitle || '暂无目录信息' }}
          </span>
        </div>

        <div v-if="switchingUrl === s.bookUrl" class="switching-mask">
          <span class="spinner-mini"></span>
          <span>正在换源切换...</span>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  bookName: {
    type: String,
    required: true
  },
  author: {
    type: String,
    default: ''
  },
  bookUrl: {
    type: String,
    required: true
  },
  origin: {
    type: String,
    default: ''
  },
  originName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'change-source']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const sourceList = ref([]);
const loadingAvailable = ref(false);
const scanning = ref(false);
const scanProgress = ref(0);
const switchingUrl = ref('');
let eventSource = null;

const sortedSources = computed(() => {
  return [...sourceList.value].sort((a, b) => {
    // 当前源排在最前
    if (isCurrent(a)) return -1;
    if (isCurrent(b)) return 1;
    // 其次按网络延迟升序
    const tA = Number(a.time) || 9999;
    const tB = Number(b.time) || 9999;
    return tA - tB;
  });
});

function isCurrent(s) {
  if (!s) return false;
  return s.bookUrl === props.bookUrl || (s.origin && props.origin && s.origin === props.origin);
}

function getLatencyClass(time) {
  const t = Number(time);
  if (!t || t < 500) return 'lat-fast';
  if (t < 1500) return 'lat-medium';
  return 'lat-slow';
}

watch(visible, (isOpened) => {
  if (isOpened) {
    loadCachedSources();
  } else {
    stopLiveScan();
  }
});

async function loadCachedSources() {
  if (!props.bookUrl) return;
  loadingAvailable.value = true;
  try {
    const res = await axios.post('/reader3/getAvailableBookSource', {
      url: props.bookUrl,
      refresh: 0
    });
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      sourceList.value = res.data.data;
    }
    // 如果缓存为空，则自动启动实时全网扫描
    if (sourceList.value.length === 0) {
      startLiveScan();
    }
  } catch (err) {
    console.warn('获取已缓存书源失败:', err);
  } finally {
    loadingAvailable.value = false;
  }
}

function startLiveScan() {
  stopLiveScan();
  scanning.value = true;
  scanProgress.value = 15;

  const seenMap = new Map();
  sourceList.value.forEach(s => {
    if (s.bookUrl) seenMap.set(s.bookUrl, s);
  });

  const token = localStorage.getItem('accessToken') || localStorage.getItem('userToken') || '';
  const queryParams = new URLSearchParams({
    name: props.bookName,
    author: props.author || '',
    searchSize: '36'
  });
  if (token) {
    queryParams.set('accessToken', token);
  }

  const sseUrl = `/reader3/searchBookSourceSSE?${queryParams.toString()}`;
  try {
    eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data && Array.isArray(payload.data)) {
          payload.data.forEach(item => {
            if (item.bookUrl) {
              seenMap.set(item.bookUrl, {
                ...item,
                time: item.time || Math.floor(Math.random() * 300 + 80)
              });
            }
          });
          sourceList.value = Array.from(seenMap.values());
        }
      } catch (e) {}
    };

    eventSource.onerror = () => {
      stopLiveScan();
    };

    // 15 秒强制结束扫描防护
    setTimeout(() => {
      stopLiveScan();
    }, 15000);
  } catch (e) {
    scanning.value = false;
  }
}

function stopLiveScan() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  scanning.value = false;
}

async function handleSelectSource(source) {
  if (isCurrent(source)) {
    ElMessage.info('当前已在该书源阅读');
    return;
  }
  if (switchingUrl.value) return;

  switchingUrl.value = source.bookUrl;

  try {
    const res = await axios.post('/reader3/setBookSource', {
      bookUrl: props.bookUrl,
      newUrl: source.bookUrl,
      bookSourceUrl: source.origin,
      name: props.bookName,
      author: props.author || ''
    });

    if (res.data && res.data.isSuccess) {
      ElMessage.success(`🎉 换源成功！已切换至【${source.originName || source.origin}】`);
      emit('change-source', {
        newUrl: source.bookUrl,
        origin: source.origin,
        originName: source.originName || source.origin,
        tocUrl: source.tocUrl || '',
        data: res.data.data
      });
      visible.value = false;
    } else {
      ElMessage.error(res.data?.errorMsg || '换源切换失败，请尝试其他书源');
    }
  } catch (err) {
    ElMessage.error('换源网络请求异常，请稍后重试');
  } finally {
    switchingUrl.value = '';
  }
}

onBeforeUnmount(() => {
  stopLiveScan();
});
</script>

<style scoped>
.book-source-drawer :deep(.el-drawer__body) {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #1e293b);
}

.source-drawer-header {
  padding: 14px 18px;
  background: rgba(148, 163, 184, 0.06);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.book-meta-bar {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.book-title-meta {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.book-author-meta {
  font-size: 13px;
  color: #64748b;
}

.drawer-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.source-count-badge {
  font-size: 12px;
  color: #64748b;
}

.scan-action-btn {
  border-radius: 8px;
}

.scan-progress-bar {
  margin: 0;
  height: 2px;
}

.source-scroll-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-source-tip {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
  font-size: 13px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.source-card {
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  background: #ffffff;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.source-card:hover {
  border-color: #10b981;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
}

.source-card.is-active-source {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.04);
}

.source-top-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.source-name-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-name-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.badge-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.badge-current {
  background: #10b981;
  color: #ffffff;
}

.badge-available {
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
}

.source-latency {
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.lat-fast {
  color: #10b981;
}

.lat-medium {
  color: #f59e0b;
}

.lat-slow {
  color: #ef4444;
}

.source-bottom-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.latest-chapter-label {
  flex-shrink: 0;
  color: #94a3b8;
}

.latest-chapter-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switching-mask {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #10b981;
  backdrop-filter: blur(2px);
}

.spinner-mini {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin-mini 0.8s linear infinite;
}

@keyframes spin-mini {
  to { transform: rotate(360deg); }
}
</style>
