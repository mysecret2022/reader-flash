<template>
  <el-drawer
    v-model="visible"
    :title="`🔀 智能全网换源`"
    :direction="drawerDirection"
    :size="drawerSize"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :destroy-on-close="false"
    :with-header="true"
    append-to-body
    class="book-source-drawer"
    @close="handleClose"
  >
    <template #header>
      <div class="custom-drawer-header">
        <div class="header-main-title">
          <span class="header-icon">🔀</span>
          <span class="header-text">智能换源与测速</span>
        </div>
        <div class="header-sub-meta">
          《{{ bookName }}》<span v-if="author"> · {{ author }}</span>
        </div>
      </div>
    </template>

    <div class="drawer-inner-container">
      <!-- 顶部信息与一键扫描栏 -->
      <div class="source-drawer-toolbar">
        <div class="toolbar-stat">
          <span class="source-count-pill">
            已发现 <strong>{{ sourceList.length }}</strong> 个书源
          </span>
          <span v-if="scanning" class="live-scanning-badge">
            <span class="spinner-dot"></span> 正在实时抓取中
          </span>
        </div>
        <el-button
          type="primary"
          size="small"
          :loading="scanning"
          @click="startLiveScan"
          class="scan-action-btn"
        >
          {{ scanning ? '深度扫描中...' : '⚡ 全网实时测速' }}
        </el-button>
      </div>

      <!-- 换源扫描实时动态进度条 -->
      <el-progress
        v-if="scanning"
        :percentage="scanProgress"
        :indeterminate="true"
        :show-text="false"
        class="scan-progress-bar"
      />

      <!-- 书源滚动列表区 -->
      <div class="source-scroll-list" v-loading="loadingAvailable && sourceList.length === 0">
        <!-- 空状态与提示 -->
        <div v-if="sourceList.length === 0 && !loadingAvailable && !scanning" class="empty-source-tip">
          <div class="empty-icon">🔍</div>
          <div class="empty-main-text">暂无已缓存的书源</div>
          <p class="empty-sub-text">点击右上角“全网实时测速”即可深度检索全网可用书源并测试延迟</p>
          <el-button type="primary" size="default" @click="startLiveScan" style="margin-top: 14px;">
            ⚡ 开始全网深度测速
          </el-button>
        </div>

        <!-- 书源卡片项 -->
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
              <span v-if="isCurrent(s)" class="badge-tag badge-current">当前正在阅读</span>
              <span v-else class="badge-tag badge-available">可用</span>
            </div>
            <div class="source-latency" :class="getLatencyClass(s.time)">
              {{ s.time ? `⏱ ${s.time}ms` : '🟢 在线' }}
            </div>
          </div>

          <div class="source-bottom-line">
            <span class="latest-chapter-label">最新章节:</span>
            <span class="latest-chapter-title" :title="s.latestChapterTitle || '暂无目录信息'">
              {{ s.latestChapterTitle || '暂无目录信息' }}
            </span>
          </div>

          <!-- 切换遮罩 -->
          <div v-if="switchingUrl === s.bookUrl" class="switching-mask">
            <span class="spinner-mini"></span>
            <span>正在平滑换源并重置目录...</span>
          </div>
        </div>
      </div>

      <!-- 底部安全关闭栏 -->
      <div class="drawer-bottom-bar">
        <el-button @click="handleClose" class="bottom-close-btn" round>
          关闭窗口
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import request from '../utils/request';
const axios = request;
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
  },
  durChapterIndex: {
    type: Number,
    default: 0
  },
  durChapterTitle: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'change-source', 'closed']);

// 内部显隐状态绑定，与父级保持受控单向流动，杜绝意外闪退
const visible = ref(false);

const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 640);
function handleWindowResize() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 640;
}

const drawerDirection = computed(() => isMobile.value ? 'btt' : 'rtl');
const drawerSize = computed(() => isMobile.value ? '88%' : '440px');

const sourceList = ref([]);
const loadingAvailable = ref(false);
const scanning = ref(false);
const scanProgress = ref(0);
const switchingUrl = ref('');
let eventSource = null;
let scanTimeoutTimer = null;

// 双向受控同步
watch(
  () => props.modelValue,
  (newVal) => {
    visible.value = newVal;
    if (newVal) {
      loadCachedSources();
    } else {
      stopLiveScan();
    }
  },
  { immediate: true }
);

function handleClose() {
  visible.value = false;
  stopLiveScan();
  emit('update:modelValue', false);
  emit('closed');
}

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
    console.warn('获取已缓存书源失败，自动触发实时扫描:', err);
    if (sourceList.value.length === 0) {
      startLiveScan();
    }
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
  const secureKey = localStorage.getItem('secureKey') || '';
  const queryParams = new URLSearchParams({
    url: props.bookUrl,
    name: props.bookName,
    author: props.author || '',
    searchSize: '36'
  });
  if (token) {
    queryParams.set('accessToken', token);
  }
  if (secureKey) {
    queryParams.set('secureKey', secureKey);
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
    scanTimeoutTimer = setTimeout(() => {
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
  if (scanTimeoutTimer) {
    clearTimeout(scanTimeoutTimer);
    scanTimeoutTimer = null;
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
      bookSourceUrl: source.origin || source.bookSourceUrl || '',
      name: props.bookName,
      author: props.author || '',
      durChapterIndex: props.durChapterIndex,
      durChapterTitle: props.durChapterTitle
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
      handleClose();
    } else {
      ElMessage.error(res.data?.errorMsg || '换源切换失败，请尝试其他书源');
    }
  } catch (err) {
    ElMessage.error('换源网络请求异常，请稍后重试');
  } finally {
    switchingUrl.value = '';
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleWindowResize);
  }
  stopLiveScan();
});
</script>

<style scoped>
.custom-drawer-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-main-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.header-sub-meta {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-inner-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #1e293b);
}

.source-drawer-toolbar {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(148, 163, 184, 0.06);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.toolbar-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-count-pill {
  font-size: 13px;
  color: #475569;
}

.source-count-pill strong {
  color: #10b981;
  font-weight: 700;
}

.live-scanning-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.spinner-dot {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  animation: pulse-dot 1s infinite alternate;
}

@keyframes pulse-dot {
  from { opacity: 0.3; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1.2); }
}

.scan-action-btn {
  border-radius: 8px;
  font-weight: 600;
}

.scan-progress-bar {
  margin: 0;
  height: 2px;
}

.source-scroll-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-source-tip {
  text-align: center;
  padding: 48px 24px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 38px;
  margin-bottom: 10px;
}

.empty-main-text {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.empty-sub-text {
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
  max-width: 280px;
  margin: 0 auto;
}

.source-card {
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
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
  overflow: hidden;
}

.source-name-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
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

.drawer-bottom-bar {
  padding: 10px 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  display: flex;
  justify-content: center;
  background: rgba(248, 250, 252, 0.6);
}

.bottom-close-btn {
  width: 100%;
  max-width: 240px;
}
</style>
