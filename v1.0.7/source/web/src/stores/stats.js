import { defineStore } from 'pinia';
import { recordReadingStats, getRecentReadingStats } from '../utils/db';

const ACHIEVEMENTS_KEY = 'reader_flash_achievements';

export const useStatsStore = defineStore('stats', {
  state: () => {
    const savedAchievements = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '{}');
    return {
      activeSeconds: 0,
      todaySeconds: 0,
      todayWords: 0,
      totalWords: 0,
      recentStats: [], // 近 7 天阅读记录
      lastActivityTime: Date.now(),
      isIdle: false,
      achievements: {
        first_read: savedAchievements.first_read || false,
        words_10k: savedAchievements.words_10k || false,
        words_100k: savedAchievements.words_100k || false,
        words_1m: savedAchievements.words_1m || false,
        night_owl: savedAchievements.night_owl || false,
        offline_fly: savedAchievements.offline_fly || false,
        book_finish: savedAchievements.book_finish || false
      }
    };
  },

  actions: {
    recordActivity() {
      this.lastActivityTime = Date.now();
      if (this.isIdle) {
        this.isIdle = false;
      }
    },

    tickSecond(readingWordCount = 0) {
      const now = Date.now();
      // 超过 3 分钟（180 秒）无任何翻页或滑动，自动判定为挂机暂停
      if (now - this.lastActivityTime > 180000) {
        this.isIdle = true;
        return;
      }

      this.activeSeconds += 1;
      this.todaySeconds += 1;

      // 累计字数并定期存库
      if (this.activeSeconds % 10 === 0) {
        this.flushStats(readingWordCount);
      }

      // 检查深夜阅读成就
      const currentHour = new Date().getHours();
      if (currentHour >= 23 || currentHour < 4) {
        this.unlockAchievement('night_owl');
      }

      this.unlockAchievement('first_read');
    },

    async flushStats(wordsAdded = 0) {
      if (this.activeSeconds === 0) return;
      await recordReadingStats(10, wordsAdded);
      this.todayWords += wordsAdded;
      this.totalWords += wordsAdded;

      // 检查字数成就
      if (this.totalWords >= 10000) this.unlockAchievement('words_10k');
      if (this.totalWords >= 100000) this.unlockAchievement('words_100k');
      if (this.totalWords >= 1000000) this.unlockAchievement('words_1m');
    },

    async loadRecentStats() {
      try {
        this.recentStats = await getRecentReadingStats();
        // 计算今日累计
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayRecord = this.recentStats.find(r => r.date === todayStr);
        if (todayRecord) {
          this.todaySeconds = todayRecord.seconds || 0;
          this.todayWords = todayRecord.words || 0;
        }
      } catch (e) {
        console.error('加载阅读统计失败:', e);
      }
    },

    unlockAchievement(id) {
      if (!this.achievements[id]) {
        this.achievements[id] = true;
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(this.achievements));
      }
    }
  }
});
