<template>
  <div
    class="reader-page"
    :class="[`reader-theme-${readerStore.theme}`]"
    :style="readerStyle"
    @keydown="handleKeyDown"
    tabindex="0"
    ref="readerContainer"
  >
    <!-- 顶部状态栏信息 (返回、书名、换源、加入书架、离线标记、阅读统计) -->
    <header class="reader-top-bar" :class="{ 'bar-visible': showControls }">
      <div class="top-bar-content matte-control-panel">
        <button class="icon-btn" @click.stop="goBack">‹ 返回</button>
        <span class="top-title" :title="bookName + ' - ' + (currentChapter?.title || '')">
          {{ bookName }} - {{ currentChapter?.title || (catalogLoading ? '正在解析目录...' : '目录加载完成') }}
        </span>
        <div class="top-actions">
          <button
            class="icon-btn source-btn-pill"
            @click.stop.prevent="openSourceDrawer"
            title="全网智能测速换源"
          >
            🔀 换源
          </button>
          <button
            v-if="!isInBookshelf"
            class="icon-btn shelf-add-pill"
            @click.stop="addToBookshelf"
            title="将本书保存到书架"
          >
            ➕ 加入书架
          </button>
          <span v-else class="icon-btn shelf-added-tag" title="本书已在书架中">
            ✓ 已在书架
          </span>
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
      :class="{ 'is-paginated': readerStore.pageMode !== 'scroll' }"
      @mouseup="handleSelectionChange"
      @touchend="handleSelectionChange"
      @click="handleContainerClick"
    >
      <!-- 状态 1：正在从目标源抓取解析小说目录 -->
      <div v-if="catalogLoading" class="reader-state-card reader-loading">
        <div class="spinner"></div>
        <div class="state-title">正在抓取《{{ bookName }}》...</div>
        <div class="state-sub">正在与目标网站建立连接并解析小说目录，请稍候</div>
        <div v-if="origin" class="state-origin">书源目标源：{{ origin }}</div>
      </div>

      <!-- 状态 2：抓取失败，提示友好错误信息并提供重试与换源，杜绝白屏 -->
      <div v-else-if="catalogError && chapterList.length === 0" class="reader-state-card reader-error-state">
        <div class="error-emoji">⚠️</div>
        <div class="state-title">无法从当前书源解析此书籍</div>
        <div class="state-desc">{{ catalogError }}</div>
        <div class="state-btns">
          <el-button type="primary" :loading="catalogLoading" @click="loadChapterCatalog">🔄 重新抓取</el-button>
          <el-button type="warning" @click.stop.prevent="openSourceDrawer">🔀 立即换源</el-button>
          <el-button @click="goBack">‹ 返回书架</el-button>
        </div>
      </div>

      <!-- 状态 3：目录已有，但正在拉取本章正文 -->
      <div v-else-if="loading" class="reader-state-card reader-loading">
        <div class="spinner"></div>
        <div class="state-title">正在抓取第 {{ currentIndex + 1 }} 章正文...</div>
        <div class="state-sub">{{ currentChapter?.title || '' }}</div>
      </div>

      <!-- 状态 4：模式 1 - 平滑上下滚动模式 -->
      <div
        v-else-if="readerStore.pageMode === 'scroll'"
        class="scroll-mode-container"
        ref="scrollContainer"
        :style="{ maxWidth: `${readerStore.readWidth || 800}px` }"
        @click="handleScrollModeClick"
      >
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

      <!-- 状态 5：模式 2 - APP级 左右滑动模式 (真·手机阅读APP手势与触控反馈) -->
      <div
        v-else-if="readerStore.pageMode === 'slide'"
        class="app-flip-viewport slide-flip-container"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @click="handlePageTapArea"
      >
        <div
          class="slide-page-sheet"
          :class="[`reader-theme-${readerStore.theme}`]"
          :style="slideSheetStyle"
        >
          <div class="page-header">
            <span class="header-chap-title">{{ currentChapter?.title }}</span>
            <span class="header-clock">{{ currentTimeStr }}</span>
          </div>

          <div class="page-content-box">
            <p
              v-for="(para, pIdx) in currentPageParas"
              :key="pIdx"
              :class="{ 'speaking-highlight': isSpeakingThisPara(para) }"
            >
              {{ para }}
            </p>
          </div>

          <div class="page-footer">
            <span class="footer-left">第 {{ currentPageIndex + 1 }} / {{ totalPages }} 页</span>
            <span class="footer-right">第 {{ currentIndex + 1 }}/{{ chapterList.length }} 章 · {{ chapterProgress }}%</span>
          </div>
        </div>
      </div>

      <!-- 状态 6：模式 3 - 3D 纸张拟真仿真翻页 (彻底消除白屏，带真实立体纸张翻折阴影) -->
      <div
        v-else
        class="app-flip-viewport simulation-flip-container"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @click="handlePageTapArea"
      >
        <div
          class="simulation-page-sheet"
          :class="[
            `reader-theme-${readerStore.theme}`,
            { 'flipping-forward': isFlipping3D && flipDirection === 'next' },
            { 'flipping-backward': isFlipping3D && flipDirection === 'prev' }
          ]"
          :style="simulationSheetStyle"
        >
          <div class="page-header">
            <span class="header-chap-title">{{ currentChapter?.title }}</span>
            <span class="header-clock">{{ currentTimeStr }}</span>
          </div>

          <div class="page-content-box">
            <p
              v-for="(para, pIdx) in currentPageParas"
              :key="pIdx"
              :class="{ 'speaking-highlight': isSpeakingThisPara(para) }"
            >
              {{ para }}
            </p>
          </div>

          <div class="page-footer">
            <span class="footer-left">第 {{ currentPageIndex + 1 }} / {{ totalPages }} 页 (3D仿真)</span>
            <span class="footer-right">第 {{ currentIndex + 1 }}/{{ chapterList.length }} 章 · {{ chapterProgress }}%</span>
          </div>

          <!-- 仿真 3D 纸张背光与立体折角阴影 -->
          <div class="simulation-shadow-layer" :class="{ active: isFlipping3D }"></div>
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

        <!-- 快捷主题配色切换条 (7款 reader 经典配色) -->
        <div class="quick-themes-row">
          <div
            v-for="t in THEMES"
            :key="t.id"
            class="theme-color-pill"
            :class="{ active: readerStore.theme === t.id }"
            :style="{ background: t.bg, borderColor: t.border }"
            @click="readerStore.setTheme(t.id)"
            :title="t.name"
          >
            <span class="pill-dot" :style="{ background: t.color }"></span>
          </div>
        </div>

        <!-- 底部核心功能导航：目录、换源、排版设置、重载 -->
        <div class="bottom-footer-actions">
          <el-button text @click="showCatalogDrawer = true">📑 目录索引</el-button>
          <el-button text type="primary" @click.stop.prevent="openSourceDrawer">🔀 智能换源</el-button>
          <el-button text @click="showSettingsDrawer = true">⚙️ 排版设置</el-button>
          <el-button text @click="refreshCurrentChapter">🔄 重新加载</el-button>
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
      title="📑 目录索引"
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
            v-for="chap in filteredChapters"
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

    <!-- 智能全网换源抽屉 -->
    <BookSourceDrawer
      v-model="showBookSourceDrawer"
      :book-name="bookName"
      :author="author"
      :book-url="bookUrl"
      :origin="origin"
      :dur-chapter-index="currentIndex"
      :dur-chapter-title="currentChapter?.title || ''"
      @change-source="handleSourceChanged"
    />

    <!-- 排版设置与偏好抽屉 (含白噪音自主开启入口) -->
    <ReadSettingsDrawer v-model="showSettingsDrawer" />

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
      :book-url="bookUrl"
      :book-name="bookName"
      :chapter-list="chapterList"
    />

    <!-- 弹窗组件：阅读统计与阅读时长勋章 -->
    <ReadingStatsModal v-model="showStatsModal" />

    <!-- 常驻智能操作浮条 (在控制栏收起时贴心浮现，1键即开换源、设置与菜单，防止用户找不到入口) -->
    <div v-if="!showControls" class="floating-quick-bar" @click.stop>
      <button class="float-pill-btn primary" @click.stop.prevent="openSourceDrawer" title="快速换源">
        🔀 换源
      </button>
      <button class="float-pill-btn" @click.stop="showSettingsDrawer = true" title="排版与主题设置">
        ⚙️ 设置
      </button>
      <button class="float-pill-btn" @click.stop="showControls = true" title="呼出顶部与底部控制栏">
        ☰ 菜单
      </button>
    </div>
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
import BookSourceDrawer from '../components/BookSourceDrawer.vue';
import ReadSettingsDrawer from '../components/ReadSettingsDrawer.vue';
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

const showControls = ref(false);
const showCatalogDrawer = ref(false);
const showBookSourceDrawer = ref(false);
const showSettingsDrawer = ref(false);
const showQuoteModal = ref(false);
const showOfflineModal = ref(false);
const showStatsModal = ref(false);
const catalogFilter = ref('');

const selectedText = ref('');
const bubblePos = ref({ x: 0, y: 0 });

// 分页与手势状态 (APP级体验核心)
const currentPageIndex = ref(0);
const touchDragX = ref(0);
const isTouching = ref(false);
const isFlipping3D = ref(false);
const flipDirection = ref('next');
const currentTimeStr = ref('');

let clockInterval = null;
let statsTimer = null;

// 7 款 reader 官方原版经典护眼底色
const THEMES = [
  { id: 0, name: '雅致米白', bg: '#faf5eb', color: '#262626', border: '#e8dec8' },
  { id: 1, name: '复古羊皮', bg: '#f5eacd', color: '#332a1e', border: '#e6d3a5' },
  { id: 2, name: '清新护眼', bg: '#e6f2e6', color: '#1c301c', border: '#cce2cc' },
  { id: 3, name: '淡雅海蓝', bg: '#e4f1f5', color: '#1f2d33', border: '#c7e0e8' },
  { id: 4, name: '暖粉少女', bg: '#f5e4e4', color: '#382323', border: '#e8c9c9' },
  { id: 5, name: '素灰静读', bg: '#e0e0e0', color: '#222222', border: '#cccccc' },
  { id: 6, name: '纯黑夜间', bg: '#121212', color: '#8c8c8c', border: '#2a2a2a' }
];

// 听书与多角色广播剧
const isSpeaking = ref(false);
const currentSpeakingIndex = ref(-1);
let speechUtterance = null;

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

// 动态分页计算：根据屏幕与正文字号计算每页容量，优雅切片
const charsPerPage = computed(() => {
  const fs = readerStore.fontSize || 18;
  const lh = readerStore.lineHeight || 1.8;
  const ps = readerStore.paragraphSpacing || 16;
  const width = Math.min(window.innerWidth - 48, readerStore.readWidth || 800);
  const height = window.innerHeight - 130;
  const cols = Math.floor(width / (fs + 2));
  const rows = Math.floor(height / (fs * lh + ps / 2));
  return Math.max(220, cols * rows);
});

const chapterPages = computed(() => {
  if (!paragraphList.value || paragraphList.value.length === 0) return [[]];
  const pages = [];
  let cur = [];
  let count = 0;
  const maxChars = charsPerPage.value;

  for (const p of paragraphList.value) {
    const len = p.length + 10;
    if (count + len > maxChars && cur.length > 0) {
      pages.push(cur);
      cur = [p];
      count = len;
    } else {
      cur.push(p);
      count += len;
    }
  }
  if (cur.length > 0) {
    pages.push(cur);
  }
  return pages.length > 0 ? pages : [[]];
});

const totalPages = computed(() => chapterPages.value.length);
const currentPageParas = computed(() => chapterPages.value[currentPageIndex.value] || []);
const chapterProgress = computed(() => {
  if (chapterList.value.length <= 1) return 100;
  return Math.round(((currentIndex.value + 1) / chapterList.value.length) * 100);
});

const filteredChapters = computed(() => {
  const list = chapterList.value.map((c, i) => ({ ...c, index: i }));
  if (!catalogFilter.value.trim()) return list;
  const q = catalogFilter.value.trim().toLowerCase();
  return list.filter(c => c.title && c.title.toLowerCase().includes(q));
});

const readerStyle = computed(() => {
  return {
    fontSize: `${readerStore.fontSize}px`,
    lineHeight: readerStore.lineHeight,
    fontWeight: readerStore.fontWeight || 400,
    fontFamily: 'var(--reader-font-family, system-ui)'
  };
});

const slideSheetStyle = computed(() => {
  const base = {
    maxWidth: `${readerStore.readWidth || 800}px`
  };
  if (isTouching.value && touchDragX.value !== 0) {
    base.transform = `translateX(${touchDragX.value}px)`;
    base.transition = 'none';
  }
  return base;
});

const simulationSheetStyle = computed(() => {
  const base = {
    maxWidth: `${readerStore.readWidth || 800}px`
  };
  if (isTouching.value && touchDragX.value !== 0) {
    const angle = Math.max(-180, Math.min(0, (touchDragX.value / window.innerWidth) * 180));
    base.transform = `rotateY(${angle}deg)`;
    base.transition = 'none';
  }
  return base;
});

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  currentTimeStr.value = `${h}:${m}`;
}

// 触摸手势控制 (原生App级滑动切换与微阻尼拖拽)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isSwipeAction = false;

function onTouchStart(e) {
  if (!e.touches || !e.touches[0]) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  touchDragX.value = 0;
  isTouching.value = true;
  isSwipeAction = false;
}

function onTouchMove(e) {
  if (!isTouching.value || !e.touches || !e.touches[0]) return;
  const deltaX = e.touches[0].clientX - touchStartX;
  const deltaY = e.touches[0].clientY - touchStartY;

  // 水平位移显著大于垂直位移时触发横向滑动
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
    isSwipeAction = true;
    touchDragX.value = deltaX;
  }
}

function onTouchEnd(e) {
  if (!isTouching.value) return;
  isTouching.value = false;
  const deltaX = touchDragX.value;
  const elapsed = Date.now() - touchStartTime;
  touchDragX.value = 0;

  if (isSwipeAction) {
    if (deltaX < -35 || (deltaX < -15 && elapsed < 250)) {
      // 向左滑 -> 下一页
      nextPageWithAnimation();
    } else if (deltaX > 35 || (deltaX > 15 && elapsed < 250)) {
      // 向右滑 -> 上一页
      prevPageWithAnimation();
    }
    // 滑动完成后延时重置滑动标志，避免连带触发随后的 click 事件
    setTimeout(() => {
      isSwipeAction = false;
    }, 150);
  } else {
    // 触摸轻触 Tap 判定 (微小位移且用时短暂)
    if (Math.abs(deltaX) < 15 && elapsed < 350) {
      const width = window.innerWidth;
      const tapX = touchStartX;
      if (tapX < width * 0.25) {
        prevPageWithAnimation();
      } else if (tapX > width * 0.75) {
        nextPageWithAnimation();
      } else {
        // 点击正中 50% 呼出/收起控制栏
        showControls.value = !showControls.value;
      }
    }
  }
}

function hasActiveDrawerOrModal() {
  return showBookSourceDrawer.value || showSettingsDrawer.value || showCatalogDrawer.value || showQuoteModal.value || showOfflineModal.value || showStatsModal.value;
}

function openSourceDrawer() {
  showBookSourceDrawer.value = true;
}

function handlePageTapArea(e) {
  // 如果当前已有抽屉或弹窗打开，禁止误触翻页或控制栏
  if (hasActiveDrawerOrModal()) return;
  // 如果刚发生过滑动操作，忽略附带的 click
  if (isSwipeAction) {
    isSwipeAction = false;
    return;
  }
  if (selectedText.value) return;

  statsStore.recordActivity();
  const width = window.innerWidth;
  const clickX = (e && typeof e.clientX === 'number' && e.clientX > 0) ? e.clientX : touchStartX;

  if (clickX < width * 0.25) {
    // 点击左侧 25% -> 上一页
    prevPageWithAnimation();
  } else if (clickX > width * 0.75) {
    // 点击右侧 25% -> 下一页
    nextPageWithAnimation();
  } else {
    // 点击中间 50% -> 唤出/收起控制面板
    showControls.value = !showControls.value;
  }
}

function handleScrollModeClick(e) {
  if (hasActiveDrawerOrModal()) return;
  if (selectedText.value) return;
  statsStore.recordActivity();
  showControls.value = !showControls.value;
}

function nextPageWithAnimation() {
  if (readerStore.pageMode === 'simulation') {
    flipDirection.value = 'next';
    isFlipping3D.value = true;
    setTimeout(() => {
      nextPage();
      isFlipping3D.value = false;
    }, 280);
  } else {
    nextPage();
  }
}

function prevPageWithAnimation() {
  if (readerStore.pageMode === 'simulation') {
    flipDirection.value = 'prev';
    isFlipping3D.value = true;
    setTimeout(() => {
      prevPage();
      isFlipping3D.value = false;
    }, 280);
  } else {
    prevPage();
  }
}

function nextPage() {
  if (currentPageIndex.value < totalPages.value - 1) {
    currentPageIndex.value++;
  } else {
    // 翻完当前章最后一页，自动进下一章并回到第 0 页
    if (currentIndex.value < chapterList.length - 1) {
      nextChapter();
      currentPageIndex.value = 0;
    } else {
      ElMessage.info('已读至全书最新章节！');
    }
  }
}

function prevPage() {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--;
  } else {
    // 翻至当前章最前页，向前翻至上一章最后一页
    if (currentIndex.value > 0) {
      prevChapter();
      // 等待上一章内容加载后跳至尾页
      setTimeout(() => {
        currentPageIndex.value = Math.max(0, totalPages.value - 1);
      }, 300);
    } else {
      ElMessage.info('已是第一章开头');
    }
  }
}

async function checkBookshelfStatus() {
  if (!bookUrl.value && !bookName.value) return;
  try {
    const res = await axios.get('/reader3/getBookshelf');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      const match = res.data.data.find(b =>
        (b.bookUrl && b.bookUrl === bookUrl.value) ||
        (b.name && b.name === bookName.value && (!author.value || b.author === author.value))
      );
      isInBookshelf.value = !!match;
      if (match && typeof match.durChapterIndex === 'number' && match.durChapterIndex > 0) {
        const queryIndex = parseInt(route.query.index || '0', 10);
        if (currentIndex.value === 0 && queryIndex === 0 && chapterList.value.length > match.durChapterIndex) {
          currentIndex.value = match.durChapterIndex;
          await fetchChapterContent(currentIndex.value);
        }
      }
    }
  } catch (e) {}
}

async function addToBookshelf() {
  try {
    const payload = {
      name: bookName.value,
      author: author.value || '',
      bookUrl: bookUrl.value,
      tocUrl: route.query.tocUrl || bookUrl.value || '',
      origin: origin.value || '',
      originName: origin.value || '',
      durChapterIndex: currentIndex.value,
      durChapterTitle: currentChapter.value?.title || '',
      latestChapterTitle: chapterList.value[chapterList.value.length - 1]?.title || ''
    };
    const res = await axios.post('/reader3/saveBook', payload);
    if (res.data && res.data.isSuccess) {
      isInBookshelf.value = true;
      ElMessage.success('🎉 已成功加入书架！实时同步阅读进度');
    } else {
      ElMessage.error(res.data?.errorMsg || '加入书架失败');
    }
  } catch (e) {
    ElMessage.error('网络异常，加入书架失败');
  }
}

// 智能中文章节数字解析
function chineseToNumber(chnStr) {
  const chnNumChar = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const chnNameValue = {
    '十': { value: 10, secUnit: false },
    '百': { value: 100, secUnit: false },
    '千': { value: 1000, secUnit: false },
    '万': { value: 10000, secUnit: true },
    '亿': { value: 100000000, secUnit: true }
  };
  let total = 0, section = 0, number = 0;
  let str = (chnStr || '').trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (str.startsWith('十')) str = '一' + str;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const numVal = chnNumChar[char];
    if (typeof numVal !== 'undefined') {
      number = numVal;
      if (i === str.length - 1) section += number;
    } else {
      const unit = chnNameValue[char];
      if (typeof unit !== 'undefined') {
        if (unit.secUnit) {
          section = (section + number) * unit.value;
          total += section;
          section = 0;
        } else {
          section += (number || 1) * unit.value;
        }
        number = 0;
      }
    }
  }
  total += section;
  return total || null;
}

// 提取章节标题核心文本与章节数字
function parseChapterInfo(rawTitle) {
  if (!rawTitle) return { num: null, coreTitle: '' };
  let title = String(rawTitle).trim();
  // 过滤 (求月票)、【二合一】等干扰标签
  title = title.replace(/[\(\[\{（【［].*?[\)\]\}）】］]/g, ' ').trim();
  // 过滤卷前缀与正文标识
  title = title.replace(/^(正文\s*|VIP卷\s*|作品相关\s*|卷[一二三四五六七八九十0-9]+\s*)/, '').trim();

  let num = null;
  const matchZhang = title.match(/第\s*([0-9零一二两三四五六七八九十百千万]+)\s*[章回节集话]/);
  if (matchZhang) {
    const rawNum = matchZhang[1];
    num = /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : chineseToNumber(rawNum);
  } else {
    const matchLeading = title.match(/^([0-9]{1,5})\s*[\.、\s:-]/);
    if (matchLeading) num = parseInt(matchLeading[1], 10);
  }

  let core = title.replace(/第\s*[0-9零一二两三四五六七八九十百千万]+\s*[章回节集话]/g, '');
  core = core.replace(/^[0-9]{1,5}\s*[\.、\s:-]/, '');
  core = core.replace(/[：:\s\-_,，。·]/g, '').trim();

  return { num, coreTitle: core };
}

// 智能章节对齐算法：优先双重匹配 -> 核心名称对齐 -> 章节号对齐 -> 原位兜底
function findBestMatchedChapterIndex(oldIndex, oldTitle, newChapterList) {
  if (!newChapterList || newChapterList.length === 0) return 0;
  if (!oldTitle && (oldIndex === null || oldIndex === undefined || oldIndex < 0)) return 0;

  const oldInfo = parseChapterInfo(oldTitle);
  const parsedNewList = newChapterList.map((c, idx) => ({
    index: idx,
    title: c.title || '',
    ...parseChapterInfo(c.title || '')
  }));

  // 1. 双重匹配：章节编号与核心标题双重一致（置信度 100%）
  if (oldInfo.num !== null && oldInfo.coreTitle && oldInfo.coreTitle.length >= 2) {
    const found = parsedNewList.find(c => c.num === oldInfo.num && (c.coreTitle.includes(oldInfo.coreTitle) || oldInfo.coreTitle.includes(c.coreTitle)));
    if (found) return found.index;
  }

  // 2. 核心标题完全相同（优先寻找离旧索引最近的章节）
  if (oldInfo.coreTitle && oldInfo.coreTitle.length >= 2) {
    const exactCoreMatches = parsedNewList.filter(c => c.coreTitle === oldInfo.coreTitle);
    if (exactCoreMatches.length > 0) {
      exactCoreMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
      return exactCoreMatches[0].index;
    }
    // 包含关系匹配
    const subCoreMatches = parsedNewList.filter(c => c.coreTitle && (c.coreTitle.includes(oldInfo.coreTitle) || oldInfo.coreTitle.includes(c.coreTitle)));
    if (subCoreMatches.length > 0) {
      subCoreMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
      return subCoreMatches[0].index;
    }
  }

  // 3. 章节编号匹配（如第10章对齐第十章）
  if (oldInfo.num !== null) {
    const numMatches = parsedNewList.filter(c => c.num === oldInfo.num);
    if (numMatches.length > 0) {
      numMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
      return numMatches[0].index;
    }
  }

  // 4. 原位安全兜底：保持与旧章节索引一致，防止跌落至第一章
  return Math.max(0, Math.min(oldIndex >= 0 ? oldIndex : 0, newChapterList.length - 1));
}

async function handleSourceChanged(newSourceInfo) {
  // 1. 牢牢记录换源前的章节索引与章节标题
  const oldTitle = currentChapter.value?.title || '';
  const oldIndex = currentIndex.value;

  bookUrl.value = newSourceInfo.newUrl;
  if (newSourceInfo.origin) origin.value = newSourceInfo.origin;

  // 2. 拉取新书源目录（传入 autoFetch = false，绝不提前强制重置为第1章）
  await loadChapterCatalog(false);

  // 3. 智能多级对齐章节
  let targetIndex = oldIndex;
  if (chapterList.value && chapterList.value.length > 0) {
    targetIndex = findBestMatchedChapterIndex(oldIndex, oldTitle, chapterList.value);
  }

  currentIndex.value = targetIndex;
  currentPageIndex.value = 0;

  // 4. 同步更新路由参数
  router.replace({
    path: '/reader',
    query: {
      ...route.query,
      bookUrl: newSourceInfo.newUrl,
      origin: newSourceInfo.origin,
      name: bookName.value,
      author: author.value,
      index: targetIndex
    }
  });

  // 5. 抓取目标章节正文
  await fetchChapterContent(targetIndex);

  // 6. 保存最新进度至书架
  saveProgress(targetIndex);
  checkBookshelfStatus();

  const targetTitle = chapterList.value[targetIndex]?.title || `第 ${targetIndex + 1} 章`;
  ElMessage.success(`🎉 换源成功，已自动对齐至：${targetTitle}`);
}

async function loadChapterCatalog(autoFetch = true) {
  if (!bookUrl.value) return;
  catalogLoading.value = true;
  catalogError.value = '';

  try {
    const res = await axios.post('/reader3/getChapterList', {
      url: bookUrl.value
    }, { timeout: 15000 });

    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      chapterList.value = res.data.data.map((c, idx) => ({
        index: idx,
        title: c.title || c.chapterTitle || `第 ${idx + 1} 章`,
        url: c.url || c.chapterUrl || ''
      }));

      if (chapterList.value.length > 0) {
        if (autoFetch) {
          const queryIndex = parseInt(route.query.index || '0', 10);
          currentIndex.value = Math.max(0, Math.min(queryIndex, chapterList.value.length - 1));
          await fetchChapterContent(currentIndex.value);
        }
      } else {
        catalogError.value = '目标书源返回的目录为空，可能该站点改版或防爬拦截';
      }
    } else {
      catalogError.value = res.data?.errorMsg || '未能从目标源解析出章节目录，建议立即换源';
    }
  } catch (err) {
    catalogError.value = err.message || '网络连接超时，无法连接目标书源';
  } finally {
    catalogLoading.value = false;
  }
}

async function fetchChapterContent(index) {
  if (!chapterList.value[index]) return;
  const chapter = chapterList.value[index];
  loading.value = true;
  currentPageIndex.value = 0;

  try {
    const res = await axios.post('/reader3/getBookContent', {
      url: bookUrl.value,
      index: index
    }, { timeout: 12000 });

    if (res.data && res.data.isSuccess) {
      chapterContent.value = res.data.data || '';
      saveProgress(index);
    } else {
      const errMsg = res.data?.errorMsg || '未知解析异常';
      chapterContent.value = `⚠️ 获取本章正文失败：${errMsg}\n\n建议点击顶部【🔀 换源】切换至优质源继续阅读。`;
    }
  } catch (err) {
    chapterContent.value = `⚠️ 网络连接超时：无法拉取本章正文。\n\n建议点击顶部【🔀 换源】切换书源。`;
  } finally {
    loading.value = false;
  }
}

function prevChapter() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    fetchChapterContent(currentIndex.value);
  }
}

function nextChapter() {
  if (currentIndex.value < chapterList.value.length - 1) {
    currentIndex.value++;
    fetchChapterContent(currentIndex.value);
  }
}

function jumpToChapter(val) {
  currentIndex.value = val;
  fetchChapterContent(val);
}

function selectCatalogChapter(idx) {
  showCatalogDrawer.value = false;
  currentIndex.value = idx;
  fetchChapterContent(idx);
}

function refreshCurrentChapter() {
  fetchChapterContent(currentIndex.value);
}

function saveProgress(idx) {
  try {
    axios.post('/reader3/saveBookProgress', {
      url: bookUrl.value,
      index: idx
    });
    router.replace({
      query: {
        ...route.query,
        index: idx
      }
    });
  } catch (e) {}
}

function handleContainerClick(e) {
  if (hasActiveDrawerOrModal()) return;
  if (selectedText.value) return;
  statsStore.recordActivity();
  // 点击页面空白处或边缘时切换控制栏
  showControls.value = !showControls.value;
}

function handleKeyDown(e) {
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prevPageWithAnimation();
  } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    nextPageWithAnimation();
  } else if (e.key === 'Escape') {
    showControls.value = false;
  } else if (e.key === 'm' || e.key === 'M' || e.key === ' ') {
    showControls.value = !showControls.value;
  }
}

function goBack() {
  router.push('/');
}

// 听书逻辑
function isSpeakingThisPara(para) {
  if (!isSpeaking.value || currentSpeakingIndex.value < 0) return false;
  return paragraphList.value[currentSpeakingIndex.value] === para;
}

function toggleSpeech() {
  if (isSpeaking.value) {
    stopSpeech();
  } else {
    startSpeech();
  }
}

function startSpeech() {
  if (!('speechSynthesis' in window)) {
    ElMessage.warning('当前浏览器环境不支持语音合成');
    return;
  }
  isSpeaking.value = true;
  currentSpeakingIndex.value = 0;
  speakNextParagraph();
}

function speakNextParagraph() {
  if (!isSpeaking.value) return;
  if (currentSpeakingIndex.value >= paragraphList.value.length) {
    // 本章读完自动进下一章
    nextChapter();
    currentSpeakingIndex.value = 0;
    setTimeout(() => {
      speakNextParagraph();
    }, 1000);
    return;
  }

  const text = paragraphList.value[currentSpeakingIndex.value];
  if (!text) {
    currentSpeakingIndex.value++;
    speakNextParagraph();
    return;
  }

  window.speechSynthesis.cancel();
  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.lang = 'zh-CN';
  speechUtterance.rate = readerStore.ttsSpeed || 1.0;

  speechUtterance.onend = () => {
    currentSpeakingIndex.value++;
    speakNextParagraph();
  };

  speechUtterance.onerror = () => {
    isSpeaking.value = false;
  };

  window.speechSynthesis.speak(speechUtterance);
}

function stopSpeech() {
  isSpeaking.value = false;
  currentSpeakingIndex.value = -1;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function handleSelectionChange() {
  const sel = window.getSelection();
  const txt = sel ? sel.toString().trim() : '';
  if (txt.length > 2) {
    selectedText.value = txt;
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      bubblePos.value = {
        x: rect.left + rect.width / 2,
        y: rect.top - 12
      };
    } catch (e) {}
  } else {
    selectedText.value = '';
  }
}

function copySelection() {
  if (selectedText.value) {
    navigator.clipboard.writeText(selectedText.value);
    ElMessage.success('已复制所选文字');
    selectedText.value = '';
  }
}

function openQuoteModal() {
  showQuoteModal.value = true;
}

onMounted(() => {
  readerStore.initReaderEnvironment();
  updateClock();
  clockInterval = setInterval(updateClock, 30000);

  if (bookUrl.value) {
    loadChapterCatalog();
    checkBookshelfStatus();
  }

  statsTimer = setInterval(() => {
    statsStore.recordReadingTime(10);
  }, 10000);
});

onUnmounted(() => {
  stopSpeech();
  if (statsTimer) clearInterval(statsTimer);
  if (clockInterval) clearInterval(clockInterval);
});
</script>

<style scoped>
/* 7 款 reader 官方经典阅读主题配色变量 */
.reader-theme-0 {
  --reader-bg: #faf5eb;
  --reader-text: #262626;
  --reader-panel: rgba(237, 231, 218, 0.96);
  --reader-border: #e8dec8;
}
.reader-theme-1 {
  --reader-bg: #f5eacd;
  --reader-text: #332a1e;
  --reader-panel: rgba(235, 217, 176, 0.96);
  --reader-border: #e6d3a5;
}
.reader-theme-2 {
  --reader-bg: #e6f2e6;
  --reader-text: #1c301c;
  --reader-panel: rgba(213, 232, 213, 0.96);
  --reader-border: #cce2cc;
}
.reader-theme-3 {
  --reader-bg: #e4f1f5;
  --reader-text: #1f2d33;
  --reader-panel: rgba(210, 229, 235, 0.96);
  --reader-border: #c7e0e8;
}
.reader-theme-4 {
  --reader-bg: #f5e4e4;
  --reader-text: #382323;
  --reader-panel: rgba(235, 210, 210, 0.96);
  --reader-border: #e8c9c9;
}
.reader-theme-5 {
  --reader-bg: #e0e0e0;
  --reader-text: #222222;
  --reader-panel: rgba(210, 210, 210, 0.96);
  --reader-border: #cccccc;
}
.reader-theme-6 {
  --reader-bg: #121212;
  --reader-text: #8c8c8c;
  --reader-panel: rgba(26, 26, 26, 0.96);
  --reader-border: #2a2a2a;
}

.reader-page {
  background-color: var(--reader-bg, #faf5eb);
  color: var(--reader-text, #262626);
  min-height: 100vh;
  width: 100%;
  position: relative;
  transition: background-color 0.25s ease, color 0.25s ease;
  user-select: text;
  outline: none;
}

/* 顶部操作控制栏 */
.reader-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  transform: translateY(-100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  padding: 8px 16px;
}

.reader-top-bar.bar-visible {
  transform: translateY(0);
}

.matte-control-panel {
  background: var(--reader-panel, rgba(255, 255, 255, 0.96));
  color: var(--reader-text, #262626);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--reader-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
}

.top-title {
  font-size: 14px;
  font-weight: 600;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-btn-pill {
  background: #10b981 !important;
  color: #fff !important;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
}

.shelf-add-pill {
  background: #3b82f6 !important;
  color: #fff !important;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
}

.shelf-added-tag {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #10b981 !important;
  border: 1px solid rgba(16, 185, 129, 0.3) !important;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 500;
}

/* 正文视口区域 */
.reader-content-viewport {
  min-height: 100vh;
  box-sizing: border-box;
}

.reader-content-viewport:not(.is-paginated) {
  padding: 40px 20px 80px;
}

/* 滚动模式样式 */
.scroll-mode-container {
  margin: 0 auto;
}

.chapter-heading {
  font-size: 1.4em;
  font-weight: 700;
  margin-bottom: 24px;
}

.chapter-body p, .page-content-box p {
  text-indent: 2em;
  margin-bottom: 14px;
  line-height: inherit;
  font-weight: inherit;
  text-align: justify;
  word-break: break-all;
  transition: background 0.2s;
}

.speaking-highlight {
  background: rgba(16, 185, 129, 0.22);
  border-radius: 4px;
  padding: 2px 4px;
}

.chapter-nav-btns {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding-bottom: 40px;
}

/* APP 级左右滑动与 3D 仿真视口容器 */
.app-flip-viewport {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--reader-bg, #faf5eb);
  touch-action: pan-y;
  user-select: none;
}

.slide-flip-container, .simulation-flip-container {
  padding: 12px 14px;
  box-sizing: border-box;
}

.slide-page-sheet, .simulation-page-sheet {
  width: 100%;
  height: calc(100vh - 32px);
  border-radius: 6px;
  box-sizing: border-box;
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: var(--reader-bg, #faf5eb);
  color: var(--reader-text, #262626);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: relative;
}

.slide-page-sheet {
  transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1);
}

.simulation-page-sheet {
  perspective: 1600px;
  -webkit-perspective: 1600px;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transform-origin: left center;
  transition: transform 0.32s cubic-bezier(0.25, 1, 0.5, 1);
}

.simulation-page-sheet.flipping-forward {
  transform: rotateY(-180deg);
}

.simulation-page-sheet.flipping-backward {
  transform: rotateY(0deg);
}

.simulation-shadow-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.28s;
  background: linear-gradient(to right, rgba(0,0,0,0) 30%, rgba(0,0,0,0.18) 100%);
}

.simulation-shadow-layer.active {
  opacity: 1;
}

.page-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  opacity: 0.65;
  margin-bottom: 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.header-chap-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 75%;
}

.page-content-box {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.page-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  opacity: 0.65;
  margin-top: 12px;
  padding-top: 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

/* 底部操作面板 */
.reader-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  transform: translateY(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  padding: 8px 16px;
}

.reader-bottom-bar.bar-visible {
  transform: translateY(0);
}

.bottom-bar-content {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 680px;
  margin: 0 auto;
}

.progress-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-slider-row :deep(.el-slider) {
  flex: 1;
}

.step-btn {
  background: none;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.tts-row {
  display: flex;
  justify-content: center;
}

.glow-btn {
  border-radius: 20px;
  padding: 6px 18px;
}

.quick-themes-row {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.theme-color-pill {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border-width: 1px;
  border-style: solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s;
}

.theme-color-pill.active {
  transform: scale(1.15);
  box-shadow: 0 0 0 2px #10b981;
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.bottom-footer-actions {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 8px;
}

/* 状态提示卡片 */
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
  font-size: 13px;
  color: #64748b;
}

.state-origin {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
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
  color: #10b981;
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

.custom-selection-bubble {
  position: fixed;
  transform: translate(-50%, -100%);
  background: #1e293b;
  color: #fff;
  border-radius: 8px;
  padding: 4px 8px;
  display: flex;
  gap: 8px;
  font-size: 12px;
  z-index: 200;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25);
}

.bubble-btn {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.bubble-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 常驻智能操作浮条 */
.floating-quick-bar {
  position: fixed;
  bottom: 22px;
  right: 18px;
  z-index: 95;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--reader-panel, rgba(255, 255, 255, 0.94));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  padding: 5px 8px;
  border-radius: 24px;
  border: 1px solid var(--reader-border, rgba(0, 0, 0, 0.12));
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
  user-select: none;
}

.float-pill-btn {
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--reader-text, #262626);
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 14px;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.float-pill-btn:hover {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.float-pill-btn.primary {
  background: #10b981;
  color: #ffffff;
}

.float-pill-btn.primary:hover {
  background: #059669;
}
</style>
