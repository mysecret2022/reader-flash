import { defineStore } from 'pinia';
import axios from 'axios';

export const useBookStore = defineStore('book', {
  state: () => ({
    bookshelf: [],
    groups: [],
    selectedGroup: -1, // -1 表示全部
    searchKeyword: '',
    searchResults: [],
    isSearching: false,
    searchProgress: 0,
    activeBook: null,
    chapterList: [],
    currentChapterIndex: 0
  }),

  getters: {
    filteredBooks: (state) => {
      if (state.selectedGroup === -1) return state.bookshelf;
      return state.bookshelf.filter(b => b.group === state.selectedGroup);
    }
  },

  actions: {
    async fetchBookshelf() {
      try {
        const res = await axios.get('/reader3/getBookshelf');
        if (res.data && res.data.isSuccess) {
          this.bookshelf = res.data.data || [];
        }
      } catch (e) {
        console.error('获取书架失败:', e);
      }
    },

    async fetchGroups() {
      try {
        const res = await axios.get('/reader3/getBookGroups');
        if (res.data && res.data.isSuccess) {
          this.groups = res.data.data || [];
        }
      } catch (e) {
        console.error('获取分组失败:', e);
      }
    },

    /**
     * 毫秒级 SSE 流式搜书：搜出一本立即上屏呈现一本
     */
    searchBooksStream(keyword) {
      if (!keyword || !keyword.trim()) return;

      this.isSearching = true;
      this.searchResults = [];
      this.searchKeyword = keyword;

      const url = `/reader3/searchBookMultiSSE?key=${encodeURIComponent(keyword)}&page=1`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            // 合并去重并按响应速度与综合热度优先展示
            for (const item of data) {
              const exists = this.searchResults.some(
                b => b.bookUrl === item.bookUrl || (b.name === item.name && b.author === item.author && b.origin === item.origin)
              );
              if (!exists) {
                this.searchResults.push(item);
              }
            }
          }
        } catch (e) {
          console.error('解析流式搜索数据失败:', e);
        }
      };

      eventSource.onerror = () => {
        this.isSearching = false;
        eventSource.close();
      };

      eventSource.addEventListener('end', () => {
        this.isSearching = false;
        eventSource.close();
      });
    },

    async saveBookProgress(book) {
      if (!book) return;
      try {
        await axios.post('/reader3/saveBookProgress', book);
      } catch (e) {
        console.error('同步阅读进度失败:', e);
      }
    }
  }
});
