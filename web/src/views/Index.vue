<template>
  <div class="bookshelf-page">
    <!-- 顶部专业导航栏 -->
    <header class="app-header shelf-header">
      <div class="header-left">
        <span class="logo-text">⚡ Reader</span>
        <span class="version-tag">极速版</span>
      </div>

      <!-- 搜索输入框 -->
      <div class="search-bar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索书名、作者，毫秒级流式呈现..."
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <span class="search-icon">🔍</span>
          </template>
          <template #append>
            <el-button :loading="bookStore.isSearching" @click="handleSearch">
              搜索
            </el-button>
          </template>
        </el-input>
      </div>

      <div class="header-right">
        <el-tag size="small" type="info" effect="plain" class="current-user-tag">
          👤 {{ currentUsername }}
        </el-tag>
        <el-button class="nav-btn" circle @click="showStatsModal = true" title="个人阅读数据与成就">
          📊
        </el-button>
        <el-button class="nav-btn" circle @click="goToAdmin" title="书源管理中心">
          ⚙️
        </el-button>
        <el-button class="nav-btn logout-btn" circle @click="handleLogout" title="退出登录">
          🚪
        </el-button>
      </div>
    </header>

    <!-- 流式搜索结果展区 (搜索激活时浮现) -->
    <section v-if="bookStore.searchKeyword" class="search-results-section shelf-card">
      <div class="section-header">
        <div class="title-with-badge">
          <span class="section-title">🔍 搜索结果: “{{ bookStore.searchKeyword }}”</span>
          <span v-if="bookStore.isSearching" class="mint-badge animate-pulse">流式搜索中...</span>
          <span v-else class="mint-badge">共找到 {{ bookStore.searchResults.length }} 条结果</span>
        </div>
        <el-button size="small" text @click="clearSearch">关闭搜索</el-button>
      </div>

      <div v-if="bookStore.searchResults.length === 0 && !bookStore.isSearching" class="empty-tip">
        未找到相关小说，请尝试更换关键词或在书源管理中导入更多书源
      </div>

      <div class="search-grid">
        <div
          v-for="(item, idx) in bookStore.searchResults"
          :key="idx"
          class="search-card shelf-card"
          @click="openSearchResult(item)"
        >
          <div class="search-card-cover">
            <img :src="item.coverUrl || item.cover || defaultCover" :alt="item.name" loading="lazy" />
          </div>
          <div class="search-card-info">
            <div class="book-name">{{ item.name }}</div>
            <div class="book-author">✍️ {{ item.author || '未知作者' }}</div>
            <div class="book-latest">最新: {{ item.latestChapterTitle || '暂无章节' }}</div>
            <div class="book-source-tag">
              <span class="origin-tag">{{ item.originName || item.origin || '优质源' }}</span>
              <span v-if="item.time" class="rt-tag">⚡ {{ item.time }}ms</span>
            </div>
            <div class="search-card-actions" @click.stop>
              <button class="card-btn btn-preview" @click.stop="openSearchResult(item)">
                📖 立即预览
              </button>
              <button class="card-btn btn-shelf" @click.stop="addSearchResultToShelf(item)">
                ➕ 加入书架
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 主书架区域 -->
    <main class="bookshelf-main">
      <!-- 分组标签栏 -->
      <div class="group-tabs">
        <button
          class="group-tab-btn"
          :class="{ active: bookStore.selectedGroup === -1 }"
          @click="bookStore.selectedGroup = -1"
        >
          全部书籍 ({{ bookStore.bookshelf.length }})
        </button>
        <button
          v-for="grp in bookStore.groups"
          :key="grp.groupId"
          class="group-tab-btn"
          :class="{ active: bookStore.selectedGroup === grp.groupId }"
          @click="bookStore.selectedGroup = grp.groupId"
        >
          {{ grp.groupName }}
        </button>
      </div>

      <!-- 书架书籍卡片瀑布流网格 -->
      <div v-if="bookStore.filteredBooks.length === 0" class="empty-shelf shelf-card">
        <div class="empty-icon">📚</div>
        <div class="empty-text">书架空空如也，快去上方搜搜精彩小说吧</div>
      </div>

      <div v-else class="books-grid">
        <div
          v-for="book in bookStore.filteredBooks"
          :key="book.bookUrl"
          class="book-shelf-card shelf-card"
          @click="openBook(book)"
        >
          <!-- 封面图与离线角标 -->
          <div class="cover-wrapper">
            <img :src="book.coverUrl || book.cover || defaultCover" :alt="book.name" loading="lazy" />
            <span v-if="hasOfflineCache(book.bookUrl)" class="offline-badge">
              ⚡ 已离线
            </span>
          </div>

          <div class="shelf-book-info">
            <div class="shelf-book-title" :title="book.name">{{ book.name }}</div>
            <div class="shelf-book-author">{{ book.author || '未知作者' }}</div>
            <div class="shelf-book-bottom-row">
              <span class="shelf-book-progress">
                读至: {{ book.durChapterTitle || '第一章' }}
              </span>
              <button
                class="shelf-change-source-btn"
                @click.stop="openChangeSourceModal(book)"
                title="全网智能测速换源"
              >
                🔀 换源
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 个人阅读数据与成就弹窗 -->
    <ReadingStatsModal v-model="showStatsModal" />

    <!-- 书架换源抽屉 -->
    <BookSourceDrawer
      v-if="selectedShelfBook"
      v-model="showSourceDrawer"
      :book-name="selectedShelfBook.name"
      :author="selectedShelfBook.author"
      :book-url="selectedShelfBook.bookUrl"
      :origin="selectedShelfBook.origin"
      @change-source="handleShelfSourceChanged"
    />

    <!-- 移动端专属吸底导航栏 (偏向手机方向优化) -->
    <nav class="mobile-bottom-nav">
      <div class="nav-item active" @click="clearSearch">
        <span class="icon">📚</span>
        <span class="label">书架</span>
      </div>
      <div class="nav-item" @click="focusSearchInput">
        <span class="icon">🔍</span>
        <span class="label">找书</span>
      </div>
      <div class="nav-item" @click="showStatsModal = true">
        <span class="icon">📊</span>
        <span class="label">成就</span>
      </div>
      <div class="nav-item" @click="goToAdmin">
        <span class="icon">⚙️</span>
        <span class="label">控制台</span>
      </div>
      <div class="nav-item" @click="handleLogout">
        <span class="icon">🚪</span>
        <span class="label">退出</span>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useBookStore } from '../stores/book';
import { useOfflineStore } from '../stores/offline';
import ReadingStatsModal from '../components/ReadingStatsModal.vue';
import BookSourceDrawer from '../components/BookSourceDrawer.vue';
import defaultCover from '../assets/imgs/noCover.jpeg';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const bookStore = useBookStore();
const offlineStore = useOfflineStore();

const searchQuery = ref('');
const showStatsModal = ref(false);
const showSourceDrawer = ref(false);
const selectedShelfBook = ref(null);

function openChangeSourceModal(book) {
  selectedShelfBook.value = book;
  showSourceDrawer.value = true;
}

function handleShelfSourceChanged() {
  bookStore.fetchBookshelf();
}

const currentUsername = computed(() => {
  try {
    const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return info.username || '读者';
  } catch (e) {
    return '读者';
  }
});

function handleSearch() {
  if (!searchQuery.value.trim()) return;
  bookStore.searchBooksStream(searchQuery.value.trim());
}

function clearSearch() {
  bookStore.searchKeyword = '';
  bookStore.searchResults = [];
  searchQuery.value = '';
}

function focusSearchInput() {
  const inputEl = document.querySelector('.search-bar input');
  if (inputEl) {
    inputEl.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定退出当前登录状态吗？', '退出确认', {
      type: 'warning',
      confirmButtonText: '确定退出',
      cancelButtonText: '取消'
    });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    sessionStorage.clear();
    ElMessage.success('已安全退出');
    router.push('/login');
  } catch (e) {}
}

function openBook(book) {
  router.push({
    path: '/reader',
    query: { bookUrl: book.bookUrl, name: book.name, origin: book.origin }
  });
}

function openSearchResult(item) {
  router.push({
    path: '/reader',
    query: {
      bookUrl: item.bookUrl,
      name: item.name,
      origin: item.origin || '',
      author: item.author || '',
      coverUrl: item.coverUrl || item.cover || '',
      search: '1'
    }
  });
}

async function addSearchResultToShelf(item) {
  try {
    const payload = {
      name: item.name,
      author: item.author || '',
      bookUrl: item.bookUrl,
      origin: item.origin || '',
      originName: item.originName || item.origin || '',
      coverUrl: item.coverUrl || item.cover || '',
      latestChapterTitle: item.latestChapterTitle || ''
    };
    const res = await axios.post('/reader3/saveBook', payload);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`《${item.name}》已成功加入书架！`);
      await bookStore.fetchBookshelf();
    } else {
      ElMessage.error(res.data?.errorMsg || '加入书架失败');
    }
  } catch (e) {
    ElMessage.error('加入书架异常: ' + (e.message || ''));
  }
}

function goToAdmin() {
  router.push('/admin');
}

function hasOfflineCache(bookUrl) {
  const set = offlineStore.cachedIndicesMap[bookUrl];
  return set && set.size > 0;
}

onMounted(async () => {
  await bookStore.fetchBookshelf();
  await bookStore.fetchGroups();
});
</script>

<style scoped>
.bookshelf-page {
  min-height: 100vh;
  background: #0d1117;
  color: #e6edf3;
  padding: 16px;
  box-sizing: border-box;
}

.shelf-header {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.shelf-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s, border-color 0.2s;
}

.shelf-card:hover {
  transform: translateY(-2px);
  border-color: #388bfd;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.version-tag {
  font-size: 10px;
  background: #1f2937;
  color: #10b981;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #374151;
  font-weight: 600;
}

.search-bar {
  flex: 1;
  max-width: 500px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.nav-btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
}

.search-results-section {
  padding: 20px;
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.search-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.search-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
}

.search-card-cover {
  width: 64px;
  height: 88px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: #1e293b;
}

.search-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.book-name {
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-author {
  font-size: 12px;
  color: #94a3b8;
}

.book-latest {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-source-tag {
  display: flex;
  gap: 6px;
  font-size: 10px;
}

.origin-tag {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  padding: 1px 6px;
  border-radius: 4px;
}

.rt-tag {
  background: rgba(6, 182, 212, 0.15);
  color: #38bdf8;
  padding: 1px 6px;
  border-radius: 4px;
}

.search-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.card-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-preview {
  background: rgba(88, 166, 255, 0.18);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.35);
}

.btn-preview:hover {
  background: rgba(88, 166, 255, 0.32);
}

.btn-shelf {
  background: rgba(46, 160, 67, 0.18);
  color: #3fb950;
  border: 1px solid rgba(46, 160, 67, 0.35);
}

.btn-shelf:hover {
  background: rgba(46, 160, 67, 0.32);
}

.group-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.group-tab-btn {
  padding: 6px 16px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.group-tab-btn.active {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.4);
  font-weight: 600;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px;
}

@media (min-width: 640px) {
  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 20px;
  }
}

.book-shelf-card {
  display: flex;
  flex-direction: column;
  padding: 10px;
  cursor: pointer;
}

.cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 8px;
  overflow: hidden;
  background: #1e293b;
  margin-bottom: 8px;
}

.cover-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.offline-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(16, 185, 129, 0.88);
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.shelf-book-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.shelf-book-author {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.shelf-book-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 4px;
}

.shelf-book-progress {
  font-size: 10px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.shelf-change-source-btn {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.shelf-change-source-btn:hover {
  background: #10b981;
  color: #fff;
}

.empty-shelf {
  padding: 48px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: #64748b;
}

/* 移动端专属吸底导航栏与手机体验优化 */
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 768px) {
  .bookshelf-page {
    padding: 10px 10px calc(72px + env(safe-area-inset-bottom)) 10px;
  }
  .shelf-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }
  .header-left .version-tag {
    display: none;
  }
  .search-bar {
    order: 3;
    width: 100%;
    margin: 4px 0 0 0;
  }
  .current-user-tag {
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .books-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px;
  }
  .search-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }
  .search-card {
    padding: 10px;
  }

  /* 移动端底部悬浮导航 */
  .mobile-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(22, 27, 34, 0.96);
    backdrop-filter: blur(12px);
    border-top: 1px solid #30363d;
    z-index: 1000;
    justify-content: space-around;
    align-items: center;
  }
  .mobile-bottom-nav .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 100%;
    cursor: pointer;
    color: #8b949e;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-bottom-nav .nav-item:active {
    transform: scale(0.92);
  }
  .mobile-bottom-nav .nav-item.active {
    color: #34d399;
  }
  .mobile-bottom-nav .nav-item .icon {
    font-size: 18px;
    line-height: 1.2;
  }
  .mobile-bottom-nav .nav-item .label {
    font-size: 11px;
    margin-top: 2px;
  }
}
</style>
