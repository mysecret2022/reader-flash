<template>
  <div
    class="reader-page"
    :class="[`reader-theme-${readerStore.theme}`]"
    :style="readerStyle"
    @click="handleContainerClick"
    @keydown="handleKeyDown"
    tabindex="0"
    ref="readerContainer"
  >
    <!-- 顶部状态栏信息 (书名、章节名、离线标记、加入书架) -->
    <header class="reader-top-bar" :class="{ 'bar-visible': showControls }">
      <div class="top-bar-content matte-control-panel">
        <button class="icon-btn" @click.stop="goBack">‹ 返回</button>
        <span class="top-title" :title="bookName + ' - ' + (currentChapter?.title || '')">
          {{ bookName }} - {{ currentChapter?.title || (catalogLoading ? '正在解析目录...' : '目录加载完成') }}
        </span>
        <div class="top-actions">
          <button
            v-if="!isInBookshelf"
            class="icon-btn shelf-add-pill"
            @click.stop="addToBookshelf"
            title="将本书保存到书架"
          >
            ➕ 加入书架
          </button>
          <button class="icon-btn" @click.stop="showOfflineModal = true" title="全本离线">
            ✈️ {{ isCurrentCached ? '已离线' : '离线' }}
          </button>
          <button class="icon-btn" @click.stop="showStatsModal = true" title="阅读统计">
            📊
          </button>
        </div>
      </div>
    </header>

    <!-- 正文展示核心区 -->
    <main
      class="reader-content-viewport"
      @mouseup="handleSelectionChange"
      @touchend="handleSelectionChange"
    >
      <!-- 状态 1：正在从目标源抓取解析小说目录 -->
      <div v-if="catalogLoading" class="reader-state-card reader-loading">
        <div class="spinner"></div>
        <div class="state-title">正在抓取《{{ bookName }}》...</div>
        <div class="state-sub">正在与目标网站建立连接并解析小说目录，请稍候</div>
        <div v-if="origin" class="state-origin">书源目标源：{{ origin }}</div>
      </div>

      <!-- 状态 2：抓取失败，提示友好错误信息并提供重试与返回，杜绝白屏 -->
      <div v-else-if="catalogError && chapterList.length === 0" class="reader-state-card reader-error-state">
        <div class="error-emoji">⚠️</div>
        <div class="state-title">无法从目标源解析此书籍</div>
        <div class="state-desc">{{ catalogError }}</div>
        <div class="state-btns">
          <el-button type="primary" :loading="catalogLoading" @click="loadChapterCatalog">🔄 重新抓取</el-button>
          <el-button @click="goBack">‹ 返回书架 / 更换书源</el-button>
        </div>
      </div>

      <!-- 状态 3：目录已有，但正在拉取本章正文 -->
      <div v-else-if="loading" class="reader-state-card reader-loading">
        <div class="spinner"></div>
        <div class="state-title">正在抓取第 {{ currentIndex + 1 }} 章正文...</div>
        <div class="state-sub">{{ currentChapter?.title || '' }}</div>
      </div>

      <!-- 状态 4：模式 1 - 平滑上下滚动模式 -->
      <div v-else-if="readerStore.pageMode === 'scroll'" class="scroll-mode-container" ref="scrollContainer">
        <h2 class="chapter-heading">{{ currentChapter?.title }}</h2>
        <div class="chapter-body">
          <p
            v-for="(para, pIdx) in paragraphList"
            :key="pIdx"
            :class="{ 'speaking-highlight': currentSpeakingIndex === pIdx }"
          >
            {{ para }}
          </p>
        </div>
        <div class="chapter-nav-btns">
          <el-button :disabled="currentIndex <= 0" @click.stop="prevChapter">上一章</el-button>
          <el-button :disabled="currentIndex >= chapterList.length - 1" @click.stop="nextChapter">下一章</el-button>
        </div>
      </div>

      <!-- 状态 5：模式 2 - 3D 纸张仿真翻页 / 左右翻页模式 -->
      <div v-else class="simulation-flip-container" @click="handlePageFlipClick">
        <div class="simulation-page-sheet" :class="[`reader-theme-${readerStore.theme}`]">
          <div class="page-header">{{ currentChapter?.title }}</div>
          <div class="page-content-box">
            <p
              v-for="(para, pIdx) in paragraphList"
              :key="pIdx"
              :class="{ 'speaking-highlight': currentSpeakingIndex === pIdx }"
            >
              {{ para }}
            </p>
          </div>
          <div class="page-footer">
            <span>第 {{ currentIndex + 1 }} / {{ chapterList.length }} 章</span>
            <span>reader-flash 极速看书</span>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部控制面板抽屉 -->
    <footer class="reader-bottom-bar" :class="{ 'bar-visible': showControls }">
      <div class="bottom-bar-content matte-control-panel" @click.stop>
        <!-- 章节滑动跳转条 -->
        <div class="progress-slider-row">
          <button class="step-btn" @click="prevChapter">‹ 上一章</button>
          <el-slider
            v-model="sliderChapterIndex"
            :min="0"
            :max="Math.max(0, chapterList.length - 1)"
            :show-tooltip="false"
            @change="jumpToChapter"
          />
          <button class="step-btn" @click="nextChapter">下一章 ›</button>
        </div>

        <!-- 听书控制条 -->
        <div class="tts-row">
          <el-button
            size="small"
            :type="isSpeaking ? 'danger' : 'success'"
            class="glow-btn"
            @click="toggleSpeech"
          >
            {{ isSpeaking ? '⏹ 停止多角色听书' : '🎭 开启广播剧多角色听书' }}
          </el-button>
        </div>

        <!-- 白噪音伴读模块 -->
        <AmbientPlayer />

        <!-- 样式控制区（字体选择、主题配色、字号与翻页模式） -->
        <div class="settings-grid">
          <!-- 主题 4 色切换 -->
          <div class="setting-item">
            <span class="setting-label">阅读底色</span>
            <div class="theme-buttons">
              <button
                v-for="t in themes"
                :key="t.id"
                class="theme-color-btn"
                :class="[`theme-btn-${t.id}`, { active: readerStore.theme === t.id }]"
                @click="readerStore.setTheme(t.id)"
                :title="t.name"
              />
            </div>
          </div>

          <!-- 动态分片字体切换 (按需下载) -->
          <div class="setting-item">
            <span class="setting-label">排版字体</span>
            <el-select
              v-model="readerStore.fontId"
              size="small"
              style="width: 140px;"
              @change="readerStore.setFont"
            >
              <el-option
                v-for="f in FONT_OPTIONS"
                :key="f.id"
                :label="f.name"
                :value="f.id"
              />
            </el-select>
          </div>

          <!-- 翻页模式选择 -->
          <div class="setting-item">
            <span class="setting-label">翻页模式</span>
            <el-radio-group v-model="readerStore.pageMode" size="small" @change="readerStore.setPageMode">
              <el-radio-button label="simulation">3D 仿真</el-radio-button>
              <el-radio-button label="scroll">平滑滚动</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 字号与行距调节 -->
          <div class="setting-item font-size-ctrl">
            <span class="setting-label">字号</span>
            <el-button size="small" @click="readerStore.setFontSize(readerStore.fontSize - 1)">A-</el-button>
            <span class="size-val">{{ readerStore.fontSize }}</span>
            <el-button size="small" @click="readerStore.setFontSize(readerStore.fontSize + 1)">A+</el-button>
          </div>
        </div>

        <!-- 目录与书源调试抽屉按钮 -->
        <div class="bottom-footer-actions">
          <el-button text @click="showCatalogDrawer = true">📑 目录索引</el-button>
          <el-button text @click="refreshCurrentChapter">🔄 重新加载本章</el-button>
        </div>
      </div>
    </footer>

    <!-- 自研选词划线与书摘生成快捷胶囊 -->
    <div
      v-if="selectedText && bubblePos.x > 0"
      class="custom-selection-bubble"
      :style="{ left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }"
      @click.stop
    >
      <div class="bubble-btn" @click="copySelection">📋 复制</div>
      <div class="bubble-btn" @click="openQuoteModal">🎨 生成书摘</div>
    </div>

    <!-- 侧边平滑目录抽屉 -->
    <el-drawer
      v-model="showCatalogDrawer"
      title="📑 目录"
      direction="ltr"
      size="320px"
      append-to-body
    >
      <div class="catalog-drawer-content">
        <el-input
          v-model="catalogFilter"
          placeholder="按章节名称搜索..."
          clearable
          size="small"
          style="margin-bottom: 12px;"
        />
        <div class="chapter-list">
          <div
            v-for="(chap, idx) in filteredChapters"
            :key="chap.index"
            class="chapter-item"
            :class="{ active: chap.index === currentIndex }"
            @click="selectCatalogChapter(chap.index)"
          >
            <span>{{ chap.title }}</span>
            <span v-if="cachedIndices.has(chap.index)" class="cached-dot">●</span>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 弹窗组件：唯美书摘卡片生成器 -->
    <QuoteCardModal
      v-model="showQuoteModal"
      :quote-text="selectedText"
      :book-name="bookName"
      :chapter-title="currentChapter?.title"
    />

    <!-- 弹窗组件：全本 PWA 离线缓存 -->
    <OfflineDownloadModal
      v-model="showOfflineModal"
      :book="{ bookUrl, name: bookName }"
      :chapter-list="chapterList"
      :current-index="currentIndex"
    />

    <!-- 弹窗组件：个人阅读统计与成就 -->
    <ReadingStatsModal v-model="showStatsModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import request from '../utils/request';
const axios = request;
import { useReaderStore } from '../stores/reader';
import { useStatsStore } from '../stores/stats';
import { useOfflineStore } from '../stores/offline';
import { FONT_OPTIONS } from '../utils/fontLoader';
import AmbientPlayer from '../components/AmbientPlayer.vue';
import QuoteCardModal from '../components/QuoteCardModal.vue';
import OfflineDownloadModal from '../components/OfflineDownloadModal.vue';
import ReadingStatsModal from '../components/ReadingStatsModal.vue';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();

const readerStore = useReaderStore();
const statsStore = useStatsStore();
const offlineStore = useOfflineStore();

const bookUrl = ref(route.query.bookUrl || '');
const bookName = ref(route.query.name || '小说阅读');
const origin = ref(route.query.origin || '');
const author = ref(route.query.author || '');
const isInBookshelf = ref(false);

const chapterList = ref([]);
const currentIndex = ref(0);
const chapterContent = ref('');
const loading = ref(false);
const catalogLoading = ref(false);
const catalogError = ref('');
const contentError = ref('');

const showControls = ref(false);
const showCatalogDrawer = ref(false);
const showQuoteModal = ref(false);
const showOfflineModal = ref(false);
const showStatsModal = ref(false);
const catalogFilter = ref('');

const selectedText = ref('');
const bubblePos = ref({ x: 0, y: 0 });

// 听书与多角色广播剧
const isSpeaking = ref(false);
const currentSpeakingIndex = ref(-1);
let speechUtterance = null;
let statsTimer = null;

const themes = [
  { id: 0, name: '象牙白' },
  { id: 1, name: '羊皮纸' },
  { id: 2, name: '护眼绿' },
  { id: 3, name: '深邃夜' },
  { id: 4, name: '水墨灰' }
];

const currentChapter = computed(() => {
  return chapterList.value[currentIndex.value] || null;
});

const cachedIndices = computed(() => {
  return offlineStore.cachedIndicesMap[bookUrl.value] || new Set();
});

const isCurrentCached = computed(() => {
  return cachedIndices.value.has(currentIndex.value);
});

const sliderChapterIndex = computed({
  get: () => currentIndex.value,
  set: (val) => { currentIndex.value = val; }
});

const paragraphList = computed(() => {
  if (!chapterContent.value) return [];
  return chapterContent.value
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
});

const filteredChapters = computed(() => {
  const list = chapterList.value.map((c, i) => ({ ...c, index: i }));
  if (!catalogFilter.value.trim()) return list;
  return list.filter(c => c.title && c.title.includes(catalogFilter.value.trim()));
});

const readerStyle = computed(() => {
  return {
    fontSize: `${readerStore.fontSize}px`,
    lineHeight: readerStore.lineHeight,
    fontFamily: 'var(--reader-font-family)'
  };
});

async function checkBookshelfStatus() {
  if (!bookUrl.value) return;
  try {
    const res = await axios.get('/reader3/getBookshelf');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      isInBookshelf.value = res.data.data.some(b => b.bookUrl === bookUrl.value);
    }
  } catch (e) {}
}

async function addToBookshelf() {
  try {
    const payload = {
      name: bookName.value,
      author: author.value || '',
      bookUrl: bookUrl.value,
      origin: origin.value || '',
      originName: origin.value || '',
      coverUrl: route.query.coverUrl || '',
      durChapterIndex: currentIndex.value,
      durChapterTitle: currentChapter.value?.title || '',
      latestChapterTitle: chapterList.value[chapterList.value.length - 1]?.title || ''
    };
    const res = await axios.post('/reader3/saveBook', payload);
    if (res.data && res.data.isSuccess) {
      isInBookshelf.value = true;
      ElMessage.success(`《${bookName.value}》已成功加入书架！`);
    } else {
      ElMessage.error(res.data?.errorMsg || '加入书架失败');
    }
  } catch (e) {
    ElMessage.error('加入书架异常: ' + (e.message || ''));
  }
}

async function loadChapterCatalog() {
  if (!bookUrl.value) {
    catalogError.value = '未指定有效的小说链接';
    return;
  }
  catalogLoading.value = true;
  catalogError.value = '';
  loading.value = true;
  try {
    const payload = {
      url: bookUrl.value,
      bookSourceUrl: origin.value || ''
    };
    const res = await axios.post('/reader3/getChapterList', payload, { timeout: 25000 });
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data) && res.data.data.length > 0) {
      chapterList.value = res.data.data;
      catalogError.value = '';
      await loadChapterContent(currentIndex.value);
    } else {
      const errMsg = res.data?.errorMsg || '未能从目标源解析出章节目录，可能是书源已失效或目标网站防爬拦截';
      catalogError.value = errMsg;
      ElMessage.error(errMsg);
    }
  } catch (e) {
    const errMsg = e.response?.data?.errorMsg || e.message || '网络连接超时';
    catalogError.value = '抓取目标网站小说目录失败: ' + errMsg;
    ElMessage.error(catalogError.value);
  } finally {
    catalogLoading.value = false;
    loading.value = false;
  }
}

async function loadChapterContent(index) {
  if (!chapterList.value[index]) return;
  loading.value = true;
  contentError.value = '';
  currentIndex.value = index;
  statsStore.recordActivity();

  // 1. 优先读取 IndexedDB 离线缓存
  const offlineText = await offlineStore.getChapterContent(bookUrl.value, index);
  if (offlineText) {
    chapterContent.value = offlineText;
    loading.value = false;
    return;
  }

  // 2. 本地无缓存时向后端请求实时抓取正文
  try {
    const payload = {
      url: bookUrl.value,
      index: index,
      bookSourceUrl: origin.value || ''
    };
    const res = await axios.post('/reader3/getBookContent', payload, { timeout: 25000 });
    if (res.data && res.data.isSuccess) {
      chapterContent.value = res.data.data || '';
      contentError.value = '';
    } else {
      const errMsg = res.data?.errorMsg || '章节正文获取失败';
      contentError.value = errMsg;
      chapterContent.value = `⚠️ 获取本章正文失败：${errMsg}\n\n建议点击右上角重新加载，或返回搜索列表换源阅读。`;
    }
  } catch (e) {
    const errMsg = e.response?.data?.errorMsg || e.message || '网络连接超时';
    contentError.value = errMsg;
    chapterContent.value = `⚠️ 抓取目标网站本章正文失败：${errMsg}\n\n建议稍后重试或尝试更换其他书源。`;
  } finally {
    loading.value = false;
  }
}

function prevChapter() {
  if (currentIndex.value > 0) {
    loadChapterContent(currentIndex.value - 1);
  }
}

function nextChapter() {
  if (currentIndex.value < chapterList.value.length - 1) {
    loadChapterContent(currentIndex.value + 1);
  }
}

function jumpToChapter(index) {
  loadChapterContent(index);
}

function selectCatalogChapter(index) {
  showCatalogDrawer.value = false;
  loadChapterContent(index);
}

function refreshCurrentChapter() {
  loadChapterContent(currentIndex.value);
}

function handleContainerClick(e) {
  statsStore.recordActivity();
  const width = window.innerWidth;
  const clickX = e.clientX;

  // 点击屏幕正中间 40% 区域呼出/隐藏菜单
  if (clickX > width * 0.3 && clickX < width * 0.7) {
    showControls.value = !showControls.value;
  }
}

function handlePageFlipClick(e) {
  statsStore.recordActivity();
  const width = window.innerWidth;
  const clickX = e.clientX;

  if (clickX < width * 0.3) {
    prevChapter();
  } else if (clickX > width * 0.7) {
    nextChapter();
  }
}

function handleSelectionChange() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  if (text.length > 2) {
    selectedText.value = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    bubblePos.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 12
    };
  } else {
    selectedText.value = '';
  }
}

function copySelection() {
  if (selectedText.value) {
    navigator.clipboard.writeText(selectedText.value);
    ElMessage.success('已复制到剪贴板');
    selectedText.value = '';
  }
}

function openQuoteModal() {
  showQuoteModal.value = true;
}

// 多角色拟人广播剧听书
function toggleSpeech() {
  if (!('speechSynthesis' in window)) {
    ElMessage.warning('当前浏览器暂不支持语音朗读');
    return;
  }

  if (isSpeaking.value) {
    window.speechSynthesis.cancel();
    isSpeaking.value = false;
    currentSpeakingIndex.value = -1;
    return;
  }

  isSpeaking.value = true;
  speakNextParagraph(0);
}

function speakNextParagraph(pIdx) {
  if (!isSpeaking.value || pIdx >= paragraphList.value.length) {
    isSpeaking.value = false;
    currentSpeakingIndex.value = -1;
    return;
  }

  currentSpeakingIndex.value = pIdx;
  const text = paragraphList.value[pIdx];

  // 智能识别对话（引号内的对话调高音调变女声/主角音，旁白采用稳重男声）
  const isDialogue = text.startsWith('“') || text.startsWith('"') || text.includes('说：');

  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.lang = 'zh-CN';
  speechUtterance.rate = readerStore.ttsSpeed || 1.0;
  speechUtterance.pitch = isDialogue ? 1.25 : 0.95; // 角色音色拟人区别

  speechUtterance.onend = () => {
    speakNextParagraph(pIdx + 1);
  };

  speechUtterance.onerror = () => {
    isSpeaking.value = false;
  };

  window.speechSynthesis.speak(speechUtterance);
}

function handleKeyDown(e) {
  statsStore.recordActivity();
  if (e.key === 'ArrowRight' || e.key === ' ') {
    nextChapter();
  } else if (e.key === 'ArrowLeft') {
    prevChapter();
  } else if (e.key === 'Escape') {
    showControls.value = !showControls.value;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}

onMounted(async () => {
  readerStore.initReaderEnvironment();
  await checkBookshelfStatus();
  await loadChapterCatalog();
  await offlineStore.refreshCachedIndices(bookUrl.value);

  // 启动阅读时间记录器 (每秒触发一次)
  statsTimer = setInterval(() => {
    const wordsInPage = paragraphList.value.join('').length;
    statsStore.tickSecond(Math.round(wordsInPage / 100));
  }, 1000);
});

onUnmounted(() => {
  if (statsTimer) clearInterval(statsTimer);
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
});
</script>

<style scoped>
.reader-page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  outline: none;
  user-select: text;
  -webkit-user-select: text;
  transition: background-color 0.3s, color 0.3s;
}

.reader-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transform: translateY(-100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 8px 16px;
}

.reader-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 8px 16px;
}

.bar-visible {
  transform: translateY(0);
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}

.top-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 55%;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shelf-add-pill {
  background: rgba(16, 185, 129, 0.2) !important;
  color: #10b981 !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-weight: 600 !important;
  border: 1px solid rgba(16, 185, 129, 0.4) !important;
  transition: all 0.2s;
}

.shelf-add-pill:hover {
  background: rgba(16, 185, 129, 0.35) !important;
}

.bottom-bar-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.progress-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.tts-row {
  text-align: center;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 640px) {
  .settings-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 11px;
  color: #64748b;
}

.theme-buttons {
  display: flex;
  gap: 8px;
}

.theme-color-btn {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 2px solid transparent;
  cursor: pointer;
}

.theme-btn-0 { background: #fbfaf7; }
.theme-btn-1 { background: #f3edd9; }
.theme-btn-2 { background: #dcead4; }
.theme-btn-3 { background: #141518; }
.theme-btn-4 { background: #e5e6e8; }

.theme-color-btn.active {
  border-color: #10b981;
}

.font-size-ctrl {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.size-val {
  font-size: 13px;
  font-weight: 600;
}

.bottom-footer-actions {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 8px;
}

.reader-content-viewport {
  min-height: 100vh;
  padding: 40px 20px 80px;
  box-sizing: border-box;
  max-width: 800px;
  margin: 0 auto;
}

.reader-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 32px 20px;
  text-align: center;
}

.state-title {
  font-size: 18px;
  font-weight: 600;
  margin-top: 16px;
  margin-bottom: 8px;
}

.state-sub {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 6px;
}

.state-origin {
  font-size: 12px;
  color: #94a3b8;
  word-break: break-all;
  max-width: 480px;
}

.reader-error-state {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  margin-top: 40px;
}

.error-emoji {
  font-size: 40px;
}

.state-desc {
  font-size: 14px;
  color: #ef4444;
  margin-bottom: 20px;
  max-width: 500px;
  line-height: 1.5;
}

.state-btns {
  display: flex;
  gap: 12px;
}

.chapter-heading {
  font-size: 1.4em;
  font-weight: 700;
  margin-bottom: 24px;
}

.chapter-body p {
  text-indent: 2em;
  margin-bottom: 1em;
  line-height: inherit;
  transition: background 0.2s;
}

.speaking-highlight {
  background: rgba(16, 185, 129, 0.18);
  border-radius: 4px;
  padding: 2px 4px;
}

.page-header {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 16px;
}

.page-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 24px;
}

.reader-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 12px;
  color: #64748b;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.catalog-drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chapter-list {
  flex: 1;
  overflow-y: auto;
}

.chapter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 8px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

.chapter-item:hover {
  background: rgba(16, 185, 129, 0.05);
}

.chapter-item.active {
  color: var(--primary-color);
  font-weight: 600;
}

.cached-dot {
  color: #10b981;
  font-size: 10px;
}

.icon-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
</style>
