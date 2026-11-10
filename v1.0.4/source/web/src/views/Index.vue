<template>
  <div
    class="index-wrapper"
    :class="{
      night: isNight,
      day: !isNight
    }"
  >
    <!-- 左侧固定 260px 导航栏 (精准对齐 192.168.0.30:8080) -->
    <div
      class="navigation-wrapper"
      :class="{
        'navigation-out': isMobile && !showMobileNav,
        'navigation-in': isMobile && showMobileNav
      }"
    >
      <div class="navigation-inner-wrapper">
        <div class="navigation-title">
          阅读
          <span class="version-text">v1.0.3</span>
        </div>
        <div class="navigation-sub-title">
          清风不识字，何故乱翻书
        </div>

        <!-- 1. 搜索书籍 -->
        <div class="search-wrapper">
          <el-input
            size="small"
            placeholder="搜索书籍"
            v-model="searchKeyword"
            class="search-input"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <span class="search-prefix-icon">🔍</span>
            </template>
          </el-input>
        </div>

        <!-- 搜索设置 -->
        <div class="setting-wrapper search-setting">
          <div class="setting-title">
            搜索设置
          </div>
          <div class="setting-item">
            <el-select
              size="small"
              v-model="searchType"
              class="setting-select"
              placeholder="请选择搜索方式"
            >
              <el-option label="多源搜索" value="multi" />
              <el-option label="单源搜索" value="single" />
            </el-select>
          </div>
          <div class="setting-item" v-show="searchType !== 'single'">
            <el-select
              size="small"
              v-model="bookSourceGroup"
              class="setting-select"
              placeholder="请选择搜索书源分组"
            >
              <el-option label="全部分组" value="" />
              <el-option
                v-for="grp in bookStore.groups"
                :key="grp.groupId"
                :label="`${grp.groupName}`"
                :value="grp.groupName"
              />
            </el-select>
          </div>
          <div class="setting-item" v-show="searchType !== 'single'">
            <el-select
              size="small"
              v-model="concurrentCount"
              class="setting-select"
              placeholder="请选择并发线程"
            >
              <el-option
                v-for="item in [4, 8, 12, 16, 24, 30]"
                :key="item"
                :label="item + '并发线程'"
                :value="item"
              />
            </el-select>
          </div>
        </div>

        <!-- 2. 探索发现 -->
        <div class="setting-wrapper">
          <div class="setting-title">
            探索发现
          </div>
          <div class="setting-item">
            <el-button
              type="primary"
              plain
              size="small"
              style="width: 100%; border-radius: 8px; font-weight: 500;"
              @click="openExplore"
            >
              探索书源 (发现/榜单)
            </el-button>
          </div>
        </div>

        <!-- 3. 管理与账户 -->
        <div class="setting-wrapper" style="margin-top: 28px;">
          <div class="setting-title">
            管理与账户
          </div>
          <div class="setting-item">
            <el-dropdown
              @command="handleAdminMenuCommand"
              trigger="click"
              style="width: 100%;"
            >
              <el-button
                type="primary"
                size="small"
                style="width: 100%; border-radius: 8px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;"
              >
                <span>管理 ({{ currentUsername }})</span>
                <span style="font-size: 11px;">▼</span>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu style="min-width: 160px;">
                  <el-dropdown-item command="admin">
                    控制台与管理后台
                  </el-dropdown-item>
                  <el-dropdown-item command="stats">
                    阅读数据与统计
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided>
                    退出当前账号
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 底部夜间模式与信息 -->
        <div class="bottom-icons">
          <div class="theme-item" @click="toggleNight" :title="isNight ? '切换白天模式' : '切换夜间模式'">
            <span v-if="!isNight">🌙</span>
            <span v-else>☀️</span>
          </div>
          <div class="bottom-icon">
            <a href="https://github.com/mysecret2022/reader-flash" target="_blank" rel="noreferrer" title="GitHub 仓库">
              <span style="font-size: 20px; cursor: pointer;">🐙</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 遮罩层 (移动端菜单展开时) -->
    <div
      v-if="isMobile && showMobileNav"
      class="nav-backdrop"
      @click="showMobileNav = false"
    ></div>

    <!-- 右侧书架/搜索主体区域 (精准对齐 192.168.0.30:8080) -->
    <div class="shelf-wrapper" ref="shelfWrapper" @click="isMobile && (showMobileNav = false)">
      <!-- 顶部操作栏 -->
      <div class="shelf-title">
        <div class="shelf-title-left">
          <span
            v-if="isMobile"
            class="mobile-menu-btn"
            @click.stop="showMobileNav = !showMobileNav"
          >
            ☰
          </span>
          {{ isSearchResult ? '搜索' : '书架' }}
          ({{ isSearchResult ? bookStore.searchResults.length : filteredBooks.length }})
          <span v-if="isSearchResult && bookStore.isSearching" class="stream-indicator">
            ⚡ 毫秒流式呈现中...
          </span>
        </div>

        <div class="shelf-title-actions">
          <div
            class="title-btn"
            v-if="isSearchResult"
            @click="backToShelf"
          >
            书架
          </div>
          <div
            class="title-btn"
            v-if="!isSearchResult"
            @click="refreshShelf"
          >
            <span v-if="refreshLoading">刷新中...</span>
            <span v-else>刷新</span>
          </div>
          <div
            class="title-btn"
            v-if="!isSearchResult"
            @click="showBookEditButton = !showBookEditButton"
          >
            {{ showBookEditButton ? "取消" : "编辑" }}
          </div>
        </div>
      </div>

      <!-- 分组 Tabs 栏 (仅在书架模式显示) -->
      <div class="book-group-wrapper" v-if="!isSearchResult">
        <el-tabs class="book-group-tabs" v-model="selectedGroupTab">
          <el-tab-pane label="全部" name="-1"></el-tab-pane>
          <el-tab-pane
            v-for="grp in bookStore.groups"
            :key="grp.groupId"
            :label="grp.groupName"
            :name="String(grp.groupId)"
          ></el-tab-pane>
        </el-tabs>
      </div>

      <!-- 书籍列表展区 (书架与搜索结果共用 360x112px 经典卡片) -->
      <div class="books-wrapper" ref="bookListRef">
        <div class="wrapper">
          <!-- 书架空状态 -->
          <div v-if="!isSearchResult && filteredBooks.length === 0" class="empty-shelf-tip">
            <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
            <div>书架暂无书籍，在左侧搜索栏搜索小说或进入后台导入书源</div>
          </div>

          <!-- 搜索空状态 -->
          <div v-if="isSearchResult && bookStore.searchResults.length === 0 && !bookStore.isSearching" class="empty-shelf-tip">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div>未找到相关小说，请尝试更换关键词</div>
          </div>

          <!-- 1. 书架书籍卡片列表 -->
          <template v-if="!isSearchResult">
            <div
              class="book"
              v-for="book in filteredBooks"
              :key="book.bookUrl"
              @click="toDetail(book)"
            >
              <div class="cover-img">
                <img
                  class="cover"
                  :src="book.coverUrl || defaultCover"
                  :alt="book.name"
                  loading="lazy"
                  @error="onCoverError"
                />
              </div>

              <div class="info">
                <!-- 右上角角标或操作按钮 -->
                <div class="book-operation">
                  <span
                    class="op-icon delete-icon"
                    v-if="showBookEditButton"
                    @click.stop="deleteBook(book)"
                    title="从书架删除"
                  >
                    ✕
                  </span>
                  <span
                    class="op-icon change-source-icon"
                    v-if="showBookEditButton"
                    @click.stop="openChangeSource(book)"
                    title="换源"
                  >
                    🔀
                  </span>
                  <div
                    class="unread-num-badge"
                    v-if="!showBookEditButton && getUnreadCount(book) > 0"
                  >
                    {{ getUnreadCount(book) > 99 ? '99+' : getUnreadCount(book) }}
                  </div>
                </div>

                <div class="name" :title="book.name">
                  {{ book.name }}
                </div>
                <div class="sub">
                  <span class="author">{{ book.author || '未知作者' }}</span>
                  <span class="dot" v-if="book.totalChapterNum">•</span>
                  <span class="size" v-if="book.totalChapterNum">共{{ book.totalChapterNum }}章</span>
                </div>
                <div class="dur-chapter" v-if="book.durChapterTitle">
                  已读：{{ book.durChapterTitle }}
                </div>
                <div class="last-chapter" v-if="book.latestChapterTitle">
                  {{ formatTime(book.lastCheckTime) }}：{{ book.latestChapterTitle }}
                </div>
              </div>
            </div>
          </template>

          <!-- 2. 搜索结果卡片列表 (经典对齐，支持立即加入书架) -->
          <template v-else>
            <div
              class="book search-card-item"
              v-for="(book, idx) in bookStore.searchResults"
              :key="idx"
              @click="toDetail(book)"
            >
              <div class="cover-img">
                <img
                  class="cover"
                  :src="book.coverUrl || book.cover || defaultCover"
                  :alt="book.name"
                  loading="lazy"
                  @error="onCoverError"
                />
              </div>

              <div class="info">
                <div class="name" :title="book.name">
                  {{ book.name }}
                </div>
                <div class="sub">
                  <span class="author">{{ book.author || '未知作者' }}</span>
                  <span class="dot">•</span>
                  <span class="source-tag-text">{{ book.originName || book.origin || '书源' }}</span>
                  <span v-if="book.time" class="source-time-text">⚡{{ book.time }}ms</span>
                </div>
                <div class="last-chapter" v-if="book.latestChapterTitle">
                  最新：{{ book.latestChapterTitle }}
                </div>
                <div class="search-card-bottom" @click.stop>
                  <el-tag
                    type="success"
                    size="small"
                    class="setting-connect"
                    :class="{ 'in-shelf': isBookInShelf(book) }"
                    @click.stop="addSearchResultToShelf(book)"
                  >
                    {{ isBookInShelf(book) ? '✓ 已在书架' : '➕ 加入书架' }}
                  </el-tag>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 阅读统计弹窗 -->
    <ReadingStatsModal v-model="showStatsModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useBookStore } from '../stores/book';
import request from '../utils/request';
import ReadingStatsModal from '../components/ReadingStatsModal.vue';
import defaultCoverImg from '../assets/imgs/noCover.jpeg';

const router = useRouter();
const bookStore = useBookStore();

const defaultCover = defaultCoverImg;
const searchKeyword = ref('');
const searchType = ref('multi');
const bookSourceGroup = ref('');
const concurrentCount = ref(8);
const selectedGroupTab = ref('-1');
const showBookEditButton = ref(false);
const refreshLoading = ref(false);
const isSearchResult = ref(false);
const showStatsModal = ref(false);
const showMobileNav = ref(false);
const isNight = ref(localStorage.getItem('reader_night_mode') === 'true');
const windowWidth = ref(window.innerWidth);

const isMobile = computed(() => windowWidth.value <= 768);

const currentUsername = computed(() => {
  return localStorage.getItem('username') || 'admin';
});

const filteredBooks = computed(() => {
  const gId = parseInt(selectedGroupTab.value, 10);
  if (gId === -1 || isNaN(gId)) {
    return bookStore.bookshelf;
  }
  return bookStore.bookshelf.filter(b => b.group === gId);
});

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  if (isNight.value) {
    document.body.classList.add('night-theme');
  } else {
    document.body.classList.remove('night-theme');
  }
  await Promise.all([
    bookStore.fetchBookshelf(),
    bookStore.fetchGroups()
  ]);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const toggleNight = () => {
  isNight.value = !isNight.value;
  localStorage.setItem('reader_night_mode', String(isNight.value));
  if (isNight.value) {
    document.body.classList.add('night-theme');
  } else {
    document.body.classList.remove('night-theme');
  }
};

const handleSearch = () => {
  if (!searchKeyword.value || !searchKeyword.value.trim()) {
    isSearchResult.value = false;
    return;
  }
  isSearchResult.value = true;
  if (isMobile.value) {
    showMobileNav.value = false;
  }
  bookStore.searchBooksStream(searchKeyword.value.trim());
};

const backToShelf = () => {
  isSearchResult.value = false;
  searchKeyword.value = '';
};

const refreshShelf = async () => {
  refreshLoading.value = true;
  try {
    await bookStore.fetchBookshelf();
    ElMessage.success('书架已更新');
  } finally {
    refreshLoading.value = false;
  }
};

const toDetail = (book) => {
  router.push({
    path: '/reader',
    query: {
      bookUrl: book.bookUrl,
      tocUrl: book.tocUrl || book.bookUrl,
      name: book.name,
      author: book.author || '',
      origin: book.origin || '',
      durChapterIndex: book.durChapterIndex !== undefined ? book.durChapterIndex : 0
    }
  });
};

const openChangeSource = (book) => {
  router.push({
    path: '/reader',
    query: {
      bookUrl: book.bookUrl,
      tocUrl: book.tocUrl || book.bookUrl,
      name: book.name,
      author: book.author || '',
      origin: book.origin || '',
      openSource: '1'
    }
  });
};

const deleteBook = (book) => {
  ElMessageBox.confirm(`确定要将《${book.name}》从书架中移除吗？`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await request.post('/reader3/deleteBook', { bookUrl: book.bookUrl });
      if (res.data && res.data.isSuccess) {
        ElMessage.success(`《${book.name}》已从书架移除`);
        await bookStore.fetchBookshelf();
      } else {
        ElMessage.error(res.data?.msg || '删除失败');
      }
    } catch (e) {
      ElMessage.error('删除书籍网络异常');
    }
  }).catch(() => {});
};

const isBookInShelf = (book) => {
  return bookStore.bookshelf.some(
    b => (b.bookUrl && b.bookUrl === book.bookUrl) ||
         (b.name === book.name && b.author === book.author)
  );
};

const addSearchResultToShelf = async (book) => {
  if (isBookInShelf(book)) {
    ElMessage.info('本书已在书架中');
    return;
  }
  try {
    const payload = {
      name: book.name,
      author: book.author,
      bookUrl: book.bookUrl,
      tocUrl: book.tocUrl || book.bookUrl,
      origin: book.origin,
      originName: book.originName || book.origin,
      coverUrl: book.coverUrl || book.cover,
      intro: book.intro
    };
    const res = await request.post('/reader3/saveBook', payload);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`《${book.name}》已成功加入书架`);
      await bookStore.fetchBookshelf();
    } else {
      ElMessage.error(res.data?.msg || '加入书架失败');
    }
  } catch (err) {
    ElMessage.error('加入书架网络异常');
  }
};

const openExplore = () => {
  ElMessage.info('探索书源中心可前往后台管理');
};

const handleAdminMenuCommand = (cmd) => {
  if (cmd === 'admin') {
    router.push('/admin');
  } else if (cmd === 'stats') {
    showStatsModal.value = true;
  } else if (cmd === 'logout') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userToken');
    ElMessage.success('已安全退出登录');
    router.push('/login');
  }
};

const getUnreadCount = (book) => {
  if (book.totalChapterNum && book.durChapterIndex !== undefined) {
    return Math.max(0, book.totalChapterNum - 1 - book.durChapterIndex);
  }
  return 0;
};

const formatTime = (ts) => {
  if (!ts) return '最新';
  const diff = Date.now() - Number(ts);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
};

const onCoverError = (e) => {
  e.target.src = defaultCover;
};
</script>

<style scoped>
.index-wrapper {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background-color: #ffffff;
  color: #333333;
}

/* 导航栏 (左侧固定 260px) */
.navigation-wrapper {
  width: 260px;
  min-width: 260px;
  height: 100%;
  box-sizing: border-box;
  background-color: #f7f7f7;
  position: relative;
  z-index: 100;
  transition: transform 0.3s ease;
}

.navigation-inner-wrapper {
  padding: 48px 36px 66px 36px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.navigation-title {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  line-height: 33px;
}

.navigation-title .version-text {
  float: right;
  font-size: 14px;
  line-height: 33px;
  font-weight: 400;
  color: #b1b1b1;
  display: inline-block;
  cursor: pointer;
}

.navigation-sub-title {
  font-size: 16px;
  font-weight: 500;
  margin-top: 16px;
  color: #b1b1b1;
}

.search-wrapper {
  margin-top: 24px;
}

.search-input :deep(.el-input__inner) {
  border-radius: 50px;
  border-color: #e3e3e3;
  padding-left: 32px;
}

.search-prefix-icon {
  font-size: 14px;
  color: #909399;
}

.setting-wrapper {
  margin-top: 36px;
}

.setting-title {
  font-size: 14px;
  color: #b1b1b1;
  margin-bottom: 8px;
}

.setting-item {
  padding-top: 8px;
}

.setting-select {
  width: 100%;
}

.bottom-icons {
  position: absolute;
  bottom: 30px;
  width: 188px;
  left: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.theme-item {
  line-height: 34px;
  width: 36px;
  height: 36px;
  border-radius: 100%;
  display: inline-block;
  cursor: pointer;
  text-align: center;
  vertical-align: middle;
  background-color: #e4e7ed;
  font-size: 18px;
  user-select: none;
  transition: all 0.2s;
}

.theme-item:hover {
  transform: scale(1.08);
}

.bottom-icon {
  height: 36px;
  display: flex;
  align-items: center;
}

/* 右侧主书架展区 */
.shelf-wrapper {
  flex: 1;
  height: 100%;
  padding: 48px;
  overflow-y: auto;
  box-sizing: border-box;
  background-color: #ffffff;
}

.shelf-title {
  font-size: 24px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  color: #2c3e50;
}

.shelf-title-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-menu-btn {
  font-size: 22px;
  cursor: pointer;
  padding-right: 6px;
}

.stream-indicator {
  font-size: 13px;
  font-weight: 500;
  color: #409eff;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.shelf-title-actions {
  display: flex;
  gap: 18px;
  font-size: 15px;
}

.title-btn {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
  user-select: none;
}

.title-btn:hover {
  color: #66b1ff;
}

.book-group-wrapper {
  margin-bottom: 20px;
}

.book-group-tabs :deep(.el-tabs__header) {
  margin-bottom: 0px;
}

.books-wrapper {
  width: 100%;
}

.wrapper {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 20px;
}

/* 经典 360px x 112px 书籍卡片 */
.book {
  box-sizing: border-box;
  width: 360px;
  height: 112px;
  padding: 16px 20px;
  display: flex;
  flex-direction: row;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  background: #ffffff;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;
}

.book:hover {
  background: rgba(0, 0, 0, 0.02);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.cover-img {
  width: 80px;
  height: 100%;
  min-width: 80px;
  margin-right: 16px;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
}

.book-operation {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.op-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  padding: 2px 4px;
}

.op-icon:hover {
  color: #409eff;
}

.unread-num-badge {
  background-color: #f56c6c;
  color: #ffffff;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 10px;
  line-height: 14px;
}

.name {
  font-size: 16px;
  font-weight: 600;
  color: #33373d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 20px;
  padding-right: 32px;
}

.sub {
  font-size: 12px;
  color: #969ba3;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.dot {
  margin: 0 2px;
}

.dur-chapter {
  font-size: 12px;
  color: #969ba3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.last-chapter {
  font-size: 12px;
  color: #969ba3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.source-tag-text {
  color: #409eff;
  font-weight: 500;
}

.source-time-text {
  color: #67c23a;
  font-size: 11px;
}

.search-card-bottom {
  margin-top: 4px;
}

.setting-connect {
  cursor: pointer;
  font-weight: 500;
}

.setting-connect.in-shelf {
  background-color: #f0f9eb;
  border-color: #e1f3d8;
  color: #67c23a;
}

.empty-shelf-tip {
  padding: 60px 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
  width: 100%;
}

/* 暗黑夜间主题 (.night) */
.index-wrapper.night {
  background-color: #121212;
  color: #d1d5db;
}

.index-wrapper.night .navigation-wrapper {
  background-color: #181818;
  border-right: 1px solid #222222;
}

.index-wrapper.night .navigation-title {
  color: #e5e7eb;
}

.index-wrapper.night .shelf-wrapper {
  background-color: #141414;
}

.index-wrapper.night .shelf-title {
  color: #e5e7eb;
}

.index-wrapper.night .book {
  background-color: #1e1e1e;
  border-color: #2c2c2c;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.index-wrapper.night .book:hover {
  background-color: #262626;
}

.index-wrapper.night .name {
  color: #e5e7eb;
}

.index-wrapper.night .theme-item {
  background-color: #2d2d2d;
  color: #ffd04b;
}

/* 响应式移动端适配 */
@media screen and (max-width: 768px) {
  .navigation-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    transform: translateX(-100%);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.2);
  }

  .navigation-wrapper.navigation-in {
    transform: translateX(0);
  }

  .nav-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }

  .shelf-wrapper {
    padding: 20px 16px;
  }

  .book {
    width: 100%;
  }
}
</style>
