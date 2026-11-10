import { defineStore } from 'pinia';
import request from '../utils/request';

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
        const res = await request.get('/reader3/getBookshelf');
        if (res.data && res.data.isSuccess) {
          this.bookshelf = res.data.data || [];
        }
      } catch (e) {
        console.error('获取书架失败:', e);
      }
    },

    async fetchGroups() {
      try {
        const res = await request.get('/reader3/getBookGroups');
        if (res.data && res.data.isSuccess) {
          this.groups = res.data.data || [];
        }
      } catch (e) {
        console.error('获取分组失败:', e);
      }
    },

    /**
     * 毫秒级 SSE 流式搜书 + 智能兜底：搜出一本立即呈现一本
     */
    searchBooksStream(keyword) {
      if (!keyword || !keyword.trim()) return;

      this.isSearching = true;
      this.searchResults = [];
      this.searchKeyword = keyword.trim();

      const token = localStorage.getItem('accessToken') || localStorage.getItem('userToken') || '';
      const url = `/reader3/searchBookMultiSSE?key=${encodeURIComponent(this.searchKeyword)}&page=1&accessToken=${encodeURIComponent(token)}`;
      let eventSource = null;
      let hasReceivedAny = false;

      try {
        eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const books = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
            if (books && books.length > 0) {
              hasReceivedAny = true;
              for (const item of books) {
                if (!item) continue;
                const exists = this.searchResults.some(
                  b => (b.bookUrl && b.bookUrl === item.bookUrl) ||
                       (b.name === item.name && b.author === item.author && b.origin === item.origin)
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

        eventSource.onerror = async () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // 若 SSE 中断且未获得数据，无缝降级采用 HTTP 批量搜书兜底
          if (!hasReceivedAny || this.searchResults.length === 0) {
            await this.fallbackSearch(this.searchKeyword);
          }
          this.isSearching = false;
        };

        eventSource.addEventListener('end', () => {
          this.isSearching = false;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        });
      } catch (err) {
        console.error('创建 EventSource 失败:', err);
        this.fallbackSearch(this.searchKeyword);
        this.isSearching = false;
      }
    },

    async fallbackSearch(keyword) {
      try {
        const res = await request.get('/reader3/searchBookMulti', {
          params: { key: keyword, searchSize: 40 }
        });
        if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
          for (const item of res.data.data) {
            if (!item) continue;
            const exists = this.searchResults.some(
              b => (b.bookUrl && b.bookUrl === item.bookUrl) ||
                   (b.name === item.name && b.author === item.author && b.origin === item.origin)
            );
            if (!exists) {
              this.searchResults.push(item);
            }
          }
        }
      } catch (e) {
        console.error('兜底搜书失败:', e);
      }
    },

    async saveBookProgress(book) {
      if (!book) return;
      try {
        await request.post('/reader3/saveBookProgress', book);
      } catch (e) {
        console.error('同步阅读进度失败:', e);
      }
    }
  }
});
