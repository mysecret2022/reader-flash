import { defineStore } from 'pinia';
import axios from 'axios';
import { saveChapterOffline, getChapterOffline, getCachedChapterIndices, clearBookOfflineCache } from '../utils/db';

export const useOfflineStore = defineStore('offline', {
  state: () => ({
    isDownloading: false,
    downloadBookUrl: '',
    currentProgress: 0,
    totalToDownload: 0,
    cachedIndicesMap: {} // { [bookUrl]: Set<number> }
  }),

  actions: {
    async refreshCachedIndices(bookUrl) {
      if (!bookUrl) return;
      const set = await getCachedChapterIndices(bookUrl);
      this.cachedIndicesMap[bookUrl] = set;
    },

    /**
     * 后台平滑离线缓存多章节（支持全本离线）
     */
    async downloadChapters(book, chapterList, startIndex = 0, count = 100) {
      if (this.isDownloading) return;
      this.isDownloading = true;
      this.downloadBookUrl = book.bookUrl;
      this.currentProgress = 0;

      const endIndex = Math.min(startIndex + count, chapterList.length);
      this.totalToDownload = endIndex - startIndex;

      const cachedSet = await getCachedChapterIndices(book.bookUrl);

      for (let i = startIndex; i < endIndex; i++) {
        if (!this.isDownloading) break;

        const chap = chapterList[i];
        if (cachedSet.has(i)) {
          this.currentProgress += 1;
          continue;
        }

        try {
          const res = await axios.post('/reader3/getBookContent', {
            url: book.bookUrl,
            index: i
          });

          if (res.data && res.data.isSuccess && res.data.data) {
            await saveChapterOffline(book.bookUrl, i, chap.title, res.data.data);
            cachedSet.add(i);
          }
        } catch (e) {
          console.warn(`离线下载第 ${i} 章失败:`, e);
        }

        this.currentProgress += 1;
        // 适度节流 50ms，避免过密请求抢占主线程网络
        await new Promise(r => setTimeout(r, 50));
      }

      this.cachedIndicesMap[book.bookUrl] = cachedSet;
      this.isDownloading = false;
      this.downloadBookUrl = '';
    },

    cancelDownload() {
      this.isDownloading = false;
    },

    async getChapterContent(bookUrl, index) {
      return await getChapterOffline(bookUrl, index);
    },

    async clearCache(bookUrl) {
      await clearBookOfflineCache(bookUrl);
      delete this.cachedIndicesMap[bookUrl];
    }
  }
});
