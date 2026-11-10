/**
 * reader-flash 高性能本地 IndexedDB 离线存储系统
 * 支持全本离线高速缓存、章节极速直读、脱网阅读、进度与统计持久化
 */

const DB_NAME = 'reader_flash_db';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. 离线书籍元数据表
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'bookUrl' });
      }

      // 2. 离线章节全文表 (composite key: "bookUrl##index")
      if (!db.objectStoreNames.contains('chapters')) {
        const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chapterStore.createIndex('bookUrl', 'bookUrl', { unique: false });
        chapterStore.createIndex('bookUrl_index', ['bookUrl', 'index'], { unique: true });
      }

      // 3. 阅读时长与字数统计表 (key: YYYY-MM-DD)
      if (!db.objectStoreNames.contains('reading_stats')) {
        db.createObjectStore('reading_stats', { keyPath: 'date' });
      }

      // 4. 用户成就与书摘收藏表
      if (!db.objectStoreNames.contains('quotes')) {
        db.createObjectStore('quotes', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * 保存单个章节正文至本地
 */
export async function saveChapterOffline(bookUrl, index, title, content) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    const item = {
      id: `${bookUrl}##${index}`,
      bookUrl,
      index,
      title,
      content,
      updatedAt: Date.now()
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 获取本地离线章节正文
 */
export async function getChapterOffline(bookUrl, index) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const req = store.get(`${bookUrl}##${index}`);
    req.onsuccess = () => resolve(req.result ? req.result.content : null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 检查指定书籍已离线的章节序号集合
 */
export async function getCachedChapterIndices(bookUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const index = store.index('bookUrl');
    const req = index.getAllKeys(IDBKeyRange.only(bookUrl));

    req.onsuccess = () => {
      const keys = req.result || [];
      const cachedIndices = new Set(keys.map(k => {
        const parts = String(k).split('##');
        return parseInt(parts[1], 10);
      }));
      resolve(cachedIndices);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 清除指定书籍的所有离线缓存
 */
export async function clearBookOfflineCache(bookUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chapters', 'books'], 'readwrite');
    const store = tx.objectStore('chapters');
    const index = store.index('bookUrl');
    const req = index.openCursor(IDBKeyRange.only(bookUrl));

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        tx.objectStore('books').delete(bookUrl);
        resolve(true);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 记录每日阅读数据（秒数与字数）
 */
export async function recordReadingStats(durationSeconds, wordsCount) {
  if (durationSeconds <= 0) return;
  const db = await openDB();
  const dateStr = new Date().toISOString().slice(0, 10);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_stats', 'readwrite');
    const store = tx.objectStore('reading_stats');
    const getReq = store.get(dateStr);

    getReq.onsuccess = () => {
      const data = getReq.result || { date: dateStr, seconds: 0, words: 0 };
      data.seconds += durationSeconds;
      data.words += (wordsCount || 0);
      data.lastUpdated = Date.now();
      store.put(data);
      resolve(data);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 获取最近 7 天阅读数据
 */
export async function getRecentReadingStats() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reading_stats', 'readonly');
    const store = tx.objectStore('reading_stats');
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      // 升序排列
      all.sort((a, b) => a.date.localeCompare(b.date));
      resolve(all.slice(-7));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}
