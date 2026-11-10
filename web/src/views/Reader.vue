<template>
  <div
    class="chapter-wrapper"
    :class="{
      night: isNight,
      day: !isNight,
      'mini-interface': isMobile
    }"
    :style="wrapperStyle"
    @keydown="handleKeyDown"
    tabindex="0"
    ref="readerContainer"
  >
    <!-- 左侧经典悬浮工具栏 (精准对齐 192.168.0.30:8080) -->
    <div
      class="tool-bar"
      :style="leftBarStyle"
      v-show="!isMobile || showMobileControls"
    >
      <div class="tools">
        <!-- 1. 书架 -->
        <div class="tool-icon" @click="openShelfModal" title="快速切换书籍">
          <div class="tool-sym">📚</div>
          <div class="icon-text">书架</div>
        </div>

        <!-- 2. 书源 (全网实时测速换源) -->
        <div class="tool-icon" @click="openSourceModal" title="书源切换与测速">
          <div class="tool-sym">🔀</div>
          <div class="icon-text">书源</div>
        </div>

        <!-- 3. 目录 (章节目录与倒序缓存) -->
        <div class="tool-icon" @click="openCatalogModal" title="章节目录">
          <div class="tool-sym">📑</div>
          <div class="icon-text">目录</div>
        </div>

        <!-- 4. 设置 (8套底色、字体、字号、翻页) -->
        <div class="tool-icon" @click="openSettingsModal" title="阅读设置">
          <div class="tool-sym">⚙️</div>
          <div class="icon-text">设置</div>
        </div>

        <!-- 5. 首页 (返回主书架) -->
        <div class="tool-icon" @click="toShelf" title="返回首页书架">
          <div class="tool-sym">🏠</div>
          <div class="icon-text">首页</div>
        </div>

        <!-- 6. 顶部 -->
        <div class="tool-icon" @click="scrollToTop" title="滚动到顶部" v-if="!isMobile">
          <div class="tool-sym">⬆️</div>
          <div class="icon-text">顶部</div>
        </div>

        <!-- 7. 底部 -->
        <div class="tool-icon" @click="scrollToBottom" title="滚动到底部" v-if="!isMobile">
          <div class="tool-sym">⬇️</div>
          <div class="icon-text">底部</div>
        </div>
      </div>
    </div>

    <!-- 右侧经典悬浮快捷操作栏 (精准对齐 192.168.0.30:8080) -->
    <div
      class="read-bar"
      :style="rightBarStyle"
      v-show="!isMobile || showMobileControls"
    >
      <div class="float-btn-zone">
        <!-- 夜间模式切换 -->
        <div class="float-btn" @click="toggleNight" :title="isNight ? '白天模式' : '夜间模式'">
          <span v-if="!isNight">🌙</span>
          <span v-else>☀️</span>
        </div>

        <!-- 刷新本章 -->
        <div class="float-btn" @click="refreshChapter" title="刷新本章正文">
          <span>🔄</span>
        </div>

        <!-- 全本离线 -->
        <div class="float-btn" @click="showOfflineModal = true" title="全本离线下载">
          <span>✈️</span>
        </div>

        <!-- 白噪声伴读 -->
        <div class="float-btn" @click="showAmbientModal = true" title="白噪声伴读">
          <span>🎵</span>
        </div>
      </div>
    </div>

    <!-- 顶部移动端状态栏 (手机端点击屏幕中央唤出) -->
    <div
      v-if="isMobile && showMobileControls"
      class="mobile-top-bar"
    >
      <div class="mobile-top-left" @click="toShelf">
        <span>‹ 返回</span>
      </div>
      <div class="mobile-top-title" :title="bookName">
        {{ bookName }}
      </div>
      <div class="mobile-top-actions">
        <span class="m-pill" @click="openSourceModal">换源</span>
        <span class="m-pill" v-if="!isInBookshelf" @click="addToBookshelf">加书架</span>
        <span class="m-pill in-shelf" v-else>已在书架</span>
      </div>
    </div>

    <!-- 正文展示核心区 -->
    <div
      class="chapter"
      :style="chapterStyle"
      @click="handleContentAreaClick"
      ref="chapterAreaRef"
    >
      <!-- 状态 1：正在解析目录 -->
      <div v-if="catalogLoading" class="reader-loading-card">
        <div class="spinner"></div>
        <div class="loading-title">正在抓取《{{ bookName }}》目录...</div>
        <div class="loading-sub">正在与目标书源建立连接并获取章节列表</div>
      </div>

      <!-- 状态 2：目录抓取失败 -->
      <div v-else-if="catalogError && chapterList.length === 0" class="reader-error-card">
        <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
        <div class="error-title">无法从当前书源加载目录</div>
        <div class="error-desc">{{ catalogError }}</div>
        <div class="error-btns">
          <el-button type="primary" size="small" @click="loadChapterCatalog">🔄 重新抓取</el-button>
          <el-button type="warning" size="small" @click="openSourceModal">🔀 立即换源</el-button>
          <el-button size="small" @click="toShelf">‹ 返回书架</el-button>
        </div>
      </div>

      <!-- 状态 3：目录已有，但正在拉取本章正文 -->
      <div v-else-if="loadingContent" class="reader-loading-card">
        <div class="spinner"></div>
        <div class="loading-title">正在加载第 {{ currentIndex + 1 }} 章正文...</div>
        <div class="loading-sub">{{ currentChapter?.title || '' }}</div>
      </div>

      <!-- 状态 4：正文呈现区 -->
      <div v-else class="content-container">
        <!-- 章节大标题 (红字起步，精准对齐 192.168.0.30:8080) -->
        <h1 class="chapter-red-title">
          {{ currentChapter?.title }}
        </h1>

        <!-- 模式 A：左右滑动翻页模式 (支持触控滑动手势) -->
        <div
          v-if="readerStore.pageMode === 'slide'"
          class="slide-content-box"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="paragraph-list" :style="paragraphContainerStyle">
            <p
              v-for="(para, pIdx) in paragraphList"
              :key="pIdx"
              class="reading-paragraph"
            >
              {{ para }}
            </p>
          </div>
        </div>

        <!-- 模式 B & C：平滑上下滚动与 3D 仿真模式 -->
        <div v-else class="scroll-content-box">
          <div class="paragraph-list" :style="paragraphContainerStyle">
            <p
              v-for="(para, pIdx) in paragraphList"
              :key="pIdx"
              class="reading-paragraph"
            >
              {{ para }}
            </p>
          </div>
        </div>

        <!-- 底部翻页与章节控制栏 -->
        <div class="chapter-footer-nav">
          <el-button
            class="nav-btn"
            :disabled="currentIndex <= 0"
            @click.stop="prevChapter"
          >
            上一章
          </el-button>

          <div class="chapter-progress-text">
            第 {{ currentIndex + 1 }} / {{ chapterList.length }} 章
          </div>

          <el-button
            class="nav-btn"
            :disabled="currentIndex >= chapterList.length - 1"
            @click.stop="nextChapter"
          >
            下一章
          </el-button>
        </div>
      </div>
    </div>

    <!-- ========================================================
         通用经典 767px 弹窗：书架抽屉、书源测速、目录面板、阅读设置
         ======================================================== -->

    <!-- 1. 经典目录面板 (PopCatalog) -->
    <el-dialog
      v-model="showCatalogModal"
      title="目录"
      :width="modalWidth"
      custom-class="classic-reader-dialog"
      append-to-body
    >
      <div class="dialog-popup-wrapper">
        <div class="popup-title-zone">
          <div class="popup-title">
            目录 <span>({{ chapterList.length }})</span>
          </div>
          <div class="popup-title-actions">
            <span class="action-btn" @click="isCatalogReverse = !isCatalogReverse">
              {{ isCatalogReverse ? "顺序" : "倒序" }}
            </span>
            <span class="action-btn" @click="scrollCatalogToTop">顶部</span>
            <span class="action-btn" @click="scrollCatalogToBottom">底部</span>
            <span class="action-btn" @click="refreshChapterCatalog">
              {{ catalogLoading ? "刷新中..." : "刷新" }}
            </span>
          </div>
        </div>

        <div class="catalog-list-scroll" ref="catalogScrollRef">
          <div class="catalog-grid">
            <div
              v-for="(chap, cIdx) in displayedCatalog"
              :key="chap.index"
              class="catalog-item"
              :class="{ 'is-active': chap.index === currentIndex }"
              @click="jumpToChapter(chap.index)"
            >
              <span class="chap-title-text">{{ chap.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 2. 经典书源换源与测速面板 (BookSource) -->
    <el-dialog
      v-model="showSourceModal"
      title="来源"
      :width="modalWidth"
      custom-class="classic-reader-dialog"
      append-to-body
    >
      <div class="dialog-popup-wrapper">
        <div class="popup-title-zone">
          <div class="popup-title">
            来源 ({{ availableSources.length }})
          </div>
          <div class="popup-title-actions">
            <span class="action-btn" @click="startSourceScan">
              {{ sourceScanning ? "测速扫描中..." : "⚡ 刷新测速" }}
            </span>
          </div>
        </div>

        <div class="source-list-scroll">
          <div v-if="sourceScanning && availableSources.length === 0" class="source-empty-tip">
            正在全网并发扫描可用书源，请稍候...
          </div>
          <div v-else-if="availableSources.length === 0" class="source-empty-tip">
            暂未发现其他可用书源
          </div>

          <div
            v-for="(src, sIdx) in availableSources"
            :key="sIdx"
            class="source-item-card"
            :class="{ 'is-current': isCurrentSource(src) }"
            @click="switchBookSource(src)"
          >
            <div class="source-header-row">
              <span class="source-name-badge">
                {{ src.originName || src.origin || '优质书源' }}
              </span>
              <span v-if="isCurrentSource(src)" class="current-badge">
                【当前使用】
              </span>
              <span v-if="src.time" class="source-latency">
                ⏱ {{ src.time }}ms
              </span>
            </div>

            <div class="source-latest-row">
              最新: {{ src.latestChapterTitle || '未知最新章节' }}
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 3. 经典阅读排版设置面板 (ReadSettings - 8套主题底色、字体、字号、翻页) -->
    <el-dialog
      v-model="showSettingsModal"
      title="设置"
      :width="modalWidth"
      custom-class="classic-reader-dialog"
      append-to-body
    >
      <div class="dialog-popup-wrapper">
        <div class="popup-title-zone">
          <div class="popup-title">设置</div>
        </div>

        <div class="settings-content-list">
          <!-- A. 8套经典底色 -->
          <div class="setting-row">
            <div class="setting-label">阅读底色</div>
            <div class="setting-options theme-options">
              <div
                v-for="th in CLASSIC_THEMES"
                :key="th.id"
                class="theme-color-box"
                :class="{ 'is-active': readerStore.theme === th.id }"
                :style="{ background: th.previewBg, color: th.color, border: th.border }"
                @click="readerStore.setTheme(th.id)"
              >
                {{ th.name }}
              </div>
            </div>
          </div>

          <!-- B. 字体选择 -->
          <div class="setting-row">
            <div class="setting-label">字体选择</div>
            <div class="setting-options">
              <el-radio-group v-model="readerStore.fontId" size="small" @change="readerStore.setFont">
                <el-radio-button :label="0">系统默认</el-radio-button>
                <el-radio-button :label="1">霞鹜文楷</el-radio-button>
                <el-radio-button :label="2">思源宋体</el-radio-button>
                <el-radio-button :label="3">毛笔手写</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- C. 字号大小 -->
          <div class="setting-row">
            <div class="setting-label">字号大小</div>
            <div class="setting-options step-options">
              <el-button size="small" @click="changeFontSize(-1)">➖</el-button>
              <span class="val-text">{{ readerStore.fontSize }} px</span>
              <el-button size="small" @click="changeFontSize(1)">➕</el-button>
            </div>
          </div>

          <!-- D. 行高 -->
          <div class="setting-row">
            <div class="setting-label">文字行高</div>
            <div class="setting-options">
              <el-radio-group v-model="readerStore.lineHeight" size="small" @change="readerStore.setLineHeight">
                <el-radio-button :label="1.5">1.5倍</el-radio-button>
                <el-radio-button :label="1.8">1.8倍(标准)</el-radio-button>
                <el-radio-button :label="2.0">2.0倍</el-radio-button>
                <el-radio-button :label="2.4">2.4倍</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- E. 桌面正文宽度 -->
          <div class="setting-row">
            <div class="setting-label">页面宽度</div>
            <div class="setting-options">
              <el-radio-group v-model="readerStore.readWidth" size="small" @change="readerStore.setReadWidth">
                <el-radio-button :label="640">紧凑 (640px)</el-radio-button>
                <el-radio-button :label="800">标准 (800px)</el-radio-button>
                <el-radio-button :label="960">宽阔 (960px)</el-radio-button>
                <el-radio-button :label="1200">全屏沉浸</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- F. 翻页模式 -->
          <div class="setting-row">
            <div class="setting-label">翻页方式</div>
            <div class="setting-options">
              <el-radio-group v-model="readerStore.pageMode" size="small" @change="readerStore.setPageMode">
                <el-radio-button label="scroll">上下滑动 (平滑滚动)</el-radio-button>
                <el-radio-button label="slide">左右滑动 (APP手势)</el-radio-button>
                <el-radio-button label="simulation">3D 仿真翻页</el-radio-button>
              </el-radio-group>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 4. 书架快捷切换弹窗 -->
    <el-dialog
      v-model="showShelfModal"
      title="书架书籍"
      :width="modalWidth"
      custom-class="classic-reader-dialog"
      append-to-body
    >
      <div class="dialog-popup-wrapper">
        <div class="popup-title-zone">
          <div class="popup-title">书架 ({{ bookStore.bookshelf.length }})</div>
          <div class="popup-title-actions">
            <span class="action-btn" @click="toShelf">前往主书架 ›</span>
          </div>
        </div>

        <div class="shelf-switch-list">
          <div
            v-for="b in bookStore.bookshelf"
            :key="b.bookUrl"
            class="shelf-switch-item"
            :class="{ 'is-active': b.bookUrl === bookUrl }"
            @click="switchBook(b)"
          >
            <div class="shelf-item-title">{{ b.name }}</div>
            <div class="shelf-item-sub">
              {{ b.author || '未知作者' }} · 已读: {{ b.durChapterTitle || '第1章' }}
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 白噪声伴读组件 -->
    <AmbientPlayer v-model="showAmbientModal" />

    <!-- 全本离线下载弹窗 -->
    <OfflineDownloadModal
      v-model="showOfflineModal"
      :book-url="bookUrl"
      :book-name="bookName"
      :author="author"
      :chapter-list="chapterList"
      :current-index="currentIndex"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useReaderStore } from '../stores/reader';
import { useBookStore } from '../stores/book';
import request from '../utils/request';
import AmbientPlayer from '../components/AmbientPlayer.vue';
import OfflineDownloadModal from '../components/OfflineDownloadModal.vue';

const route = useRoute();
const router = useRouter();
const readerStore = useReaderStore();
const bookStore = useBookStore();

// 8套经典底色配色 (完美复刻 192.168.0.30:8080)
const CLASSIC_THEMES = [
  {
    id: 0,
    name: '经典羊皮纸',
    previewBg: '#ede7da',
    bodyBg: 'var(--reader-paper-bg)',
    contentBg: 'var(--reader-paper-bg)',
    popupBg: '#ede7da',
    color: '#262626',
    border: '1px solid #d3c7b3'
  },
  {
    id: 1,
    name: '仿古纸',
    previewBg: '#f3edd9',
    bodyBg: '#f3edd9',
    contentBg: '#f3edd9',
    popupBg: '#ede7da',
    color: '#3d2e1e',
    border: '1px solid #dfd4b7'
  },
  {
    id: 2,
    name: '护眼淡绿',
    previewBg: '#dcead4',
    bodyBg: '#dcead4',
    contentBg: '#dcead4',
    popupBg: '#d2e3c9',
    color: '#1c3420',
    border: '1px solid #c2dbb5'
  },
  {
    id: 3,
    name: '浅天蓝',
    previewBg: '#d9e8fb',
    bodyBg: '#d9e8fb',
    contentBg: '#d9e8fb',
    popupBg: '#cfe0f7',
    color: '#1a2e40',
    border: '1px solid #b7d3f5'
  },
  {
    id: 4,
    name: '胭脂暖粉',
    previewBg: '#f5e4e4',
    bodyBg: '#f5e4e4',
    contentBg: '#f5e4e4',
    popupBg: '#faeceb',
    color: '#3f2121',
    border: '1px solid #e8cdcd'
  },
  {
    id: 5,
    name: '素雅浅灰',
    previewBg: '#e5e6e8',
    bodyBg: '#e5e6e8',
    contentBg: '#e5e6e8',
    popupBg: '#dbdcde',
    color: '#222426',
    border: '1px solid #ccc'
  },
  {
    id: 6,
    name: '深邃夜间',
    previewBg: '#121212',
    bodyBg: '#121212',
    contentBg: '#171717',
    popupBg: '#181818',
    color: '#abb2bf',
    border: '1px solid #333'
  },
  {
    id: 7,
    name: '纯净白',
    previewBg: '#ffffff',
    bodyBg: '#f7f7f7',
    contentBg: '#ffffff',
    popupBg: '#f7f7f7',
    color: '#262626',
    border: '1px solid #e3e3e3'
  }
];

const bookUrl = ref(route.query.bookUrl || '');
const tocUrl = ref(route.query.tocUrl || '');
const bookName = ref(route.query.name || '小说阅读');
const author = ref(route.query.author || '');
const origin = ref(route.query.origin || '');
const currentIndex = ref(parseInt(route.query.durChapterIndex, 10) || 0);

const chapterList = ref([]);
const currentContent = ref('');
const catalogLoading = ref(false);
const catalogError = ref('');
const loadingContent = ref(false);

const isNight = ref(localStorage.getItem('reader_night_mode') === 'true');
const windowWidth = ref(window.innerWidth);
const showMobileControls = ref(false);

// 弹窗状态
const showCatalogModal = ref(false);
const showSourceModal = ref(false);
const showSettingsModal = ref(false);
const showShelfModal = ref(false);
const showOfflineModal = ref(false);
const showAmbientModal = ref(false);

const isCatalogReverse = ref(false);
const availableSources = ref([]);
const sourceScanning = ref(false);

const catalogScrollRef = ref(null);
const chapterAreaRef = ref(null);

const isMobile = computed(() => windowWidth.value <= 768);
const modalWidth = computed(() => isMobile.value ? '94%' : '767px');

const currentTheme = computed(() => {
  return CLASSIC_THEMES.find(t => t.id === readerStore.theme) || CLASSIC_THEMES[0];
});

const wrapperStyle = computed(() => {
  if (isNight.value) {
    return {
      backgroundColor: '#121212',
      color: '#abb2bf'
    };
  }
  return {
    background: currentTheme.value.bodyBg,
    color: currentTheme.value.color
  };
});

const leftBarStyle = computed(() => {
  if (isMobile.value) return {};
  const halfWidth = (readerStore.readWidth || 800) / 2;
  return {
    marginLeft: `-${halfWidth + 68}px`,
    background: isNight.value ? '#181818' : currentTheme.value.popupBg
  };
});

const rightBarStyle = computed(() => {
  if (isMobile.value) return {};
  const halfWidth = (readerStore.readWidth || 800) / 2;
  return {
    marginRight: `-${halfWidth + 52}px`,
    background: isNight.value ? '#181818' : currentTheme.value.popupBg
  };
});

const chapterStyle = computed(() => {
  return {
    maxWidth: `${readerStore.readWidth || 800}px`
  };
});

const paragraphContainerStyle = computed(() => {
  const fontFamilies = [
    'custom-system, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    '"LXGW WenKai", custom-kt, reader-kt, "Kaiti SC", KaiTi, serif',
    '"Noto Serif SC", custom-st, reader-st, "Songti SC", Songti, serif',
    'shouti, "Kaiti SC", KaiTi, cursive, serif'
  ];
  return {
    fontFamily: fontFamilies[readerStore.fontId] || fontFamilies[1],
    fontSize: `${readerStore.fontSize || 18}px`,
    lineHeight: readerStore.lineHeight || 1.8,
    fontWeight: readerStore.fontWeight || 400
  };
});

const currentChapter = computed(() => {
  if (!chapterList.value || chapterList.value.length === 0) return null;
  return chapterList.value[currentIndex.value] || null;
});

const paragraphList = computed(() => {
  if (!currentContent.value) return [];
  return currentContent.value
    .split(/\r?\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
});

const displayedCatalog = computed(() => {
  if (!chapterList.value) return [];
  if (isCatalogReverse.value) {
    return [...chapterList.value].reverse();
  }
  return chapterList.value;
});

const isInBookshelf = computed(() => {
  return bookStore.bookshelf.some(
    b => (b.bookUrl && b.bookUrl === bookUrl.value) ||
         (b.name === bookName.value && b.author === author.value)
  );
});

// 手势滑动变量
let touchStartX = 0;
let touchStartY = 0;

const onTouchStart = (e) => {
  if (e.touches && e.touches[0]) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
};

const onTouchMove = () => {};

const onTouchEnd = (e) => {
  if (!e.changedTouches || !e.changedTouches[0]) return;
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;

  // 水平滑动距离大于 60px 且垂直偏移小于 80px
  if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 80) {
    if (deltaX < 0) {
      nextChapter();
    } else {
      prevChapter();
    }
  }
};

const handleContentAreaClick = (e) => {
  if (!isMobile.value) return;
  // 点击屏幕正中央 40% 区域切换控制栏
  const clickY = e.clientY;
  const h = window.innerHeight;
  if (clickY > h * 0.3 && clickY < h * 0.7) {
    showMobileControls.value = !showMobileControls.value;
  }
};

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  readerStore.initReaderEnvironment();

  if (isNight.value) {
    document.body.classList.add('night-theme');
  }

  await bookStore.fetchBookshelf();
  await loadChapterCatalog();

  if (route.query.openSource === '1') {
    openSourceModal();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const loadChapterCatalog = async () => {
  if (!bookUrl.value) return;
  catalogLoading.value = true;
  catalogError.value = '';

  try {
    let res = await request.get('/reader3/getChapterList', {
      params: { url: tocUrl.value || bookUrl.value }
    });

    if (res.data && res.data.isSuccess && Array.isArray(res.data.data) && res.data.data.length > 0) {
      chapterList.value = res.data.data.map((c, i) => ({
        index: c.index !== undefined ? c.index : i,
        title: c.title || c.name || `第 ${i + 1} 章`,
        url: c.url || c.chapterUrl || ''
      }));
      await loadChapterContent(currentIndex.value);
    } else {
      // 触发兜底书源解析
      const fallbackRes = await request.post('/reader3/saveBook', {
        bookUrl: bookUrl.value,
        name: bookName.value,
        author: author.value,
        origin: origin.value
      });
      if (fallbackRes.data && fallbackRes.data.isSuccess) {
        const retryRes = await request.get('/reader3/getChapterList', {
          params: { url: fallbackRes.data.data?.tocUrl || bookUrl.value }
        });
        if (retryRes.data?.data?.length > 0) {
          chapterList.value = retryRes.data.data.map((c, i) => ({
            index: c.index !== undefined ? c.index : i,
            title: c.title || c.name || `第 ${i + 1} 章`,
            url: c.url || c.chapterUrl || ''
          }));
          await loadChapterContent(currentIndex.value);
          return;
        }
      }
      catalogError.value = res.data?.msg || '目录为空，请尝试更换书源';
    }
  } catch (err) {
    catalogError.value = '目录抓取超时或网络异常，请尝试换源';
  } finally {
    catalogLoading.value = false;
  }
};

const loadChapterContent = async (index) => {
  if (!chapterList.value || !chapterList.value[index]) return;
  loadingContent.value = true;
  currentIndex.value = index;

  const chap = chapterList.value[index];

  try {
    const res = await request.get('/reader3/getBookContent', {
      params: {
        url: bookUrl.value,
        index: chap.index
      }
    });

    if (res.data && res.data.isSuccess && res.data.data) {
      currentContent.value = res.data.data;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // 保存阅读进度
      bookStore.saveBookProgress({
        bookUrl: bookUrl.value,
        name: bookName.value,
        durChapterIndex: index,
        durChapterTitle: chap.title,
        durChapterTime: Date.now()
      });
    } else {
      currentContent.value = '本章正文抓取失败，请尝试刷新或切换书源。';
    }
  } catch (err) {
    currentContent.value = '网络请求异常，无法拉取本章正文。';
  } finally {
    loadingContent.value = false;
  }
};

const prevChapter = () => {
  if (currentIndex.value > 0) {
    loadChapterContent(currentIndex.value - 1);
  }
};

const nextChapter = () => {
  if (currentIndex.value < chapterList.value.length - 1) {
    loadChapterContent(currentIndex.value + 1);
  }
};

const jumpToChapter = (idx) => {
  showCatalogModal.value = false;
  loadChapterContent(idx);
};

const refreshChapter = () => {
  loadChapterContent(currentIndex.value);
};

const refreshChapterCatalog = async () => {
  await loadChapterCatalog();
};

const toggleNight = () => {
  isNight.value = !isNight.value;
  localStorage.setItem('reader_night_mode', String(isNight.value));
  if (isNight.value) {
    document.body.classList.add('night-theme');
  } else {
    document.body.classList.remove('night-theme');
  }
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
};

const toShelf = () => {
  router.push('/');
};

const openCatalogModal = () => {
  showCatalogModal.value = true;
  nextTick(() => {
    // 自动滚动定位到当前章节
    if (catalogScrollRef.value) {
      const activeEl = catalogScrollRef.value.querySelector('.is-active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center' });
      }
    }
  });
};

const scrollCatalogToTop = () => {
  if (catalogScrollRef.value) {
    catalogScrollRef.value.scrollTop = 0;
  }
};

const scrollCatalogToBottom = () => {
  if (catalogScrollRef.value) {
    catalogScrollRef.value.scrollTop = catalogScrollRef.value.scrollHeight;
  }
};

const openSettingsModal = () => {
  showSettingsModal.value = true;
};

const openShelfModal = () => {
  showShelfModal.value = true;
};

const switchBook = (b) => {
  showShelfModal.value = false;
  bookUrl.value = b.bookUrl;
  tocUrl.value = b.tocUrl || b.bookUrl;
  bookName.value = b.name;
  author.value = b.author || '';
  origin.value = b.origin || '';
  currentIndex.value = b.durChapterIndex || 0;
  loadChapterCatalog();
};

const changeFontSize = (delta) => {
  const cur = readerStore.fontSize || 18;
  readerStore.setFontSize(cur + delta);
};

const openSourceModal = () => {
  showSourceModal.value = true;
  if (availableSources.value.length === 0) {
    startSourceScan();
  }
};

const startSourceScan = async () => {
  if (!bookName.value) return;
  sourceScanning.value = true;
  availableSources.value = [];

  const token = localStorage.getItem('accessToken') || '';
  const url = `/reader3/searchBookMultiSSE?key=${encodeURIComponent(bookName.value)}&page=1&accessToken=${encodeURIComponent(token)}`;
  let eventSource = null;

  try {
    eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        for (const item of list) {
          if (!item) continue;
          if (item.name === bookName.value) {
            const exists = availableSources.value.some(
              s => (s.bookUrl && s.bookUrl === item.bookUrl) ||
                   (s.origin === item.origin && s.name === item.name)
            );
            if (!exists) {
              availableSources.value.push(item);
            }
          }
        }
      } catch (e) {}
    };

    eventSource.onerror = async () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      sourceScanning.value = false;
    };

    eventSource.addEventListener('end', () => {
      sourceScanning.value = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    });
  } catch (e) {
    sourceScanning.value = false;
  }
};

const isCurrentSource = (src) => {
  return src.bookUrl === bookUrl.value || src.origin === origin.value;
};

/**
 * 智能换源与章节精准对齐算法 (杜绝跳回第一章)
 */
const switchBookSource = async (newSource) => {
  if (isCurrentSource(newSource)) {
    ElMessage.info('当前已在使用此书源');
    return;
  }

  const oldChapTitle = currentChapter.value?.title || '';
  const oldIndex = currentIndex.value;

  showSourceModal.value = false;
  catalogLoading.value = true;

  try {
    // 1. 更新书源引用
    bookUrl.value = newSource.bookUrl;
    tocUrl.value = newSource.tocUrl || newSource.bookUrl;
    origin.value = newSource.origin || '';

    // 2. 获取新源目录
    const res = await request.get('/reader3/getChapterList', {
      params: { url: tocUrl.value || bookUrl.value }
    });

    if (res.data?.data && res.data.data.length > 0) {
      chapterList.value = res.data.data.map((c, i) => ({
        index: c.index !== undefined ? c.index : i,
        title: c.title || c.name || `第 ${i + 1} 章`,
        url: c.url || c.chapterUrl || ''
      }));

      // 3. 智能对齐章节：按标题模糊匹配
      let targetIndex = -1;
      if (oldChapTitle) {
        const cleanOld = oldChapTitle.replace(/[第章节\s]/g, '').trim();
        targetIndex = chapterList.value.findIndex(c => {
          const cleanNew = c.title.replace(/[第章节\s]/g, '').trim();
          return cleanNew.includes(cleanOld) || cleanOld.includes(cleanNew);
        });
      }

      // 4. 若无法按标题对齐，回退到同序号索引
      if (targetIndex === -1) {
        targetIndex = Math.min(oldIndex, chapterList.value.length - 1);
      }

      ElMessage.success(`已切换至书源【${newSource.originName || newSource.origin}】，已精准对齐至第 ${targetIndex + 1} 章`);
      await loadChapterContent(targetIndex);
    } else {
      ElMessage.error('该书源目录解析为空');
    }
  } catch (err) {
    ElMessage.error('换源解析失败');
  } finally {
    catalogLoading.value = false;
  }
};

const addToBookshelf = async () => {
  try {
    const payload = {
      name: bookName.value,
      author: author.value,
      bookUrl: bookUrl.value,
      tocUrl: tocUrl.value || bookUrl.value,
      origin: origin.value,
      durChapterIndex: currentIndex.value,
      durChapterTitle: currentChapter.value?.title || ''
    };
    const res = await request.post('/reader3/saveBook', payload);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`《${bookName.value}》已加入书架`);
      await bookStore.fetchBookshelf();
    } else {
      ElMessage.error(res.data?.msg || '加入书架失败');
    }
  } catch (e) {
    ElMessage.error('加入书架网络异常');
  }
};

const handleKeyDown = (e) => {
  if (e.key === 'ArrowLeft') {
    prevChapter();
  } else if (e.key === 'ArrowRight') {
    nextChapter();
  }
};
</script>

<style scoped>
.chapter-wrapper {
  min-height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  position: relative;
  outline: none;
  overflow-x: hidden;
  transition: background 0.3s ease, color 0.3s ease;
}

/* ========================================================
   左侧悬浮工具栏 (精准对齐 192.168.0.30:8080)
   ======================================================== */
.tool-bar {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: 2001;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tool-bar .tools {
  display: flex;
  flex-direction: column;
}

.tool-icon {
  font-size: 18px;
  width: 58px;
  height: 52px;
  text-align: center;
  padding-top: 8px;
  cursor: pointer;
  outline: none;
  user-select: none;
  box-sizing: border-box;
  transition: background-color 0.2s;
}

.tool-icon:hover {
  background: rgba(0, 0, 0, 0.06);
}

.tool-sym {
  font-size: 16px;
  line-height: 20px;
}

.icon-text {
  font-size: 11px;
  line-height: 14px;
  color: inherit;
}

/* ========================================================
   右侧悬浮快捷栏 (精准对齐 192.168.0.30:8080)
   ======================================================== */
.read-bar {
  position: fixed;
  top: 60px;
  right: 50%;
  z-index: 2001;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 8px 4px;
}

.float-btn-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.float-btn {
  width: 36px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 16px;
  cursor: pointer;
  border-radius: 50%;
  user-select: none;
  transition: transform 0.2s, background 0.2s;
}

.float-btn:hover {
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.05);
}

/* ========================================================
   正文呈现区域 (精准对齐 192.168.0.30:8080)
   ======================================================== */
.chapter {
  margin: 0 auto;
  width: 100%;
  padding: 48px 32px 96px 32px;
  box-sizing: border-box;
  min-height: 100vh;
}

.chapter-red-title {
  color: #ed4259;
  font-size: 24px;
  font-weight: 600;
  line-height: 34px;
  margin-top: 0;
  margin-bottom: 28px;
  text-align: left;
}

.paragraph-list {
  text-align: justify;
}

.reading-paragraph {
  text-indent: 2em;
  margin: 4px 0 12px 0;
  word-break: break-all;
  letter-spacing: 0.5px;
}

.chapter-footer-nav {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chapter-progress-text {
  font-size: 13px;
  color: #909399;
}

/* 加载与错误状态卡片 */
.reader-loading-card,
.reader-error-card {
  padding: 80px 20px;
  text-align: center;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(237, 66, 89, 0.2);
  border-top-color: #ed4259;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-title,
.error-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.loading-sub,
.error-desc {
  font-size: 13px;
  color: #909399;
  margin-bottom: 20px;
}

/* ========================================================
   弹窗通用羊皮纸质感样式 (767px 经典复刻)
   ======================================================== */
.dialog-popup-wrapper {
  margin: -20px -20px -20px -20px;
  padding: 24px;
  background: var(--reader-paper-bg);
  box-sizing: border-box;
}

.popup-title-zone {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid #ed4259;
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.popup-title {
  font-size: 18px;
  color: #ed4259;
  font-weight: 600;
}

.popup-title span {
  font-size: 14px;
  font-weight: normal;
}

.popup-title-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  font-size: 13px;
  color: #ed4259;
  cursor: pointer;
  user-select: none;
}

.action-btn:hover {
  text-decoration: underline;
}

/* 目录网格 (桌面双列呈现，移动端单列) */
.catalog-list-scroll {
  max-height: 420px;
  overflow-y: auto;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.catalog-item {
  height: 36px;
  line-height: 36px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #444444;
  padding: 0 4px;
  transition: color 0.15s;
}

.catalog-item:hover,
.catalog-item.is-active {
  color: #ed4259 !important;
  font-weight: 600;
}

/* 书源列表 */
.source-list-scroll {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-item-card {
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.source-item-card:hover {
  border-color: #ed4259;
  transform: translateY(-1px);
}

.source-item-card.is-current {
  border-color: #ed4259;
  background: rgba(237, 66, 89, 0.05);
}

.source-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.source-name-badge {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.current-badge {
  font-size: 12px;
  color: #ed4259;
  font-weight: 500;
}

.source-latency {
  margin-left: auto;
  font-size: 12px;
  color: #67c23a;
}

.source-latest-row {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-empty-tip {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

/* 设置项行排布 */
.settings-content-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 6px 0;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.setting-label {
  width: 72px;
  font-size: 14px;
  color: #606266;
  flex-shrink: 0;
}

.setting-options {
  flex: 1;
}

.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-color-box {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s;
}

.theme-color-box:hover,
.theme-color-box.is-active {
  transform: scale(1.05);
  box-shadow: 0 0 0 2px #ed4259;
}

.step-options {
  display: flex;
  align-items: center;
  gap: 12px;
}

.val-text {
  font-size: 14px;
  font-weight: 600;
}

/* 书架切换面板 */
.shelf-switch-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shelf-switch-item {
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.shelf-switch-item:hover,
.shelf-switch-item.is-active {
  border-color: #ed4259;
  color: #ed4259;
}

.shelf-item-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.shelf-item-sub {
  font-size: 11px;
  color: #909399;
}

/* 移动端专属控制栏与适配 */
.mobile-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: rgba(237, 231, 218, 0.96);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 2002;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.mobile-top-left {
  font-size: 14px;
  color: #409eff;
  cursor: pointer;
}

.mobile-top-title {
  font-size: 14px;
  font-weight: 600;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-top-actions {
  display: flex;
  gap: 6px;
}

.m-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #ed4259;
  color: #fff;
  cursor: pointer;
}

.m-pill.in-shelf {
  background: #67c23a;
}

@media screen and (max-width: 768px) {
  .tool-bar {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100vw;
    border-radius: 12px 12px 0 0;
    background: rgba(237, 231, 218, 0.98);
  }

  .tool-bar .tools {
    flex-direction: row;
    justify-content: space-around;
  }

  .tool-icon {
    width: auto;
    flex: 1;
    height: 50px;
  }

  .read-bar {
    display: none;
  }

  .chapter {
    padding: 24px 16px 80px 16px;
  }

  .catalog-grid {
    grid-template-columns: 1fr;
  }

  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
