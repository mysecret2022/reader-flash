package io.legado.app.help

import io.legado.app.model.analyzeRule.QueryTTF
import io.legado.app.utils.ACache
import java.util.concurrent.ConcurrentHashMap
import java.util.LinkedHashMap

/**
 * reader-flash 高速内存 LRU 缓存管理器
 * 修复原版被写死返回 null 的 Bug，支持带 TTL 过期淘汰的高速内存缓存，
 * 让依赖令牌（Token）与防盗链凭证的现代书源满血复活！
 */
@Suppress("unused")
object CacheManager {

    private const val MAX_MEMORY_ENTRIES = 5000

    private data class CacheEntry(val value: String, val deadline: Long)

    // 线程安全内存 LRU 缓存池
    private val memoryCache = object : LinkedHashMap<String, CacheEntry>(256, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CacheEntry>?): Boolean {
            return size > MAX_MEMORY_ENTRIES
        }
    }

    private val queryTTFMap = ConcurrentHashMap<String, Pair<Long, QueryTTF>>()

    /**
     * saveTime 单位为秒，0 表示永久有效 (Long.MAX_VALUE)
     */
    @JvmOverloads
    fun put(key: String, value: Any, saveTime: Int = 0) {
        val deadline =
            if (saveTime <= 0) Long.MAX_VALUE else System.currentTimeMillis() + saveTime * 1000L
        when (value) {
            is QueryTTF -> queryTTFMap[key] = Pair(deadline, value)
            is ByteArray -> ACache.get().put(key, value, saveTime)
            else -> {
                synchronized(memoryCache) {
                    memoryCache[key] = CacheEntry(value.toString(), deadline)
                }
            }
        }
    }

    fun get(key: String): String? {
        val now = System.currentTimeMillis()
        synchronized(memoryCache) {
            val entry = memoryCache[key] ?: return null
            if (entry.deadline < now) {
                memoryCache.remove(key)
                return null
            }
            return entry.value
        }
    }

    fun getInt(key: String): Int? {
        return get(key)?.toIntOrNull()
    }

    fun getLong(key: String): Long? {
        return get(key)?.toLongOrNull()
    }

    fun getDouble(key: String): Double? {
        return get(key)?.toDoubleOrNull()
    }

    fun getFloat(key: String): Float? {
        return get(key)?.toFloatOrNull()
    }

    fun getByteArray(key: String): ByteArray? {
        return ACache.get().getAsBinary(key)
    }

    fun getQueryTTF(key: String): QueryTTF? {
        val cache = queryTTFMap[key] ?: return null
        if (cache.first == 0L || cache.first > System.currentTimeMillis()) {
            return cache.second
        }
        queryTTFMap.remove(key)
        return null
    }

    fun putFile(key: String, value: String, saveTime: Int = 0) {
        ACache.get().put(key, value, saveTime)
    }

    fun getFile(key: String): String? {
        return ACache.get().getAsString(key)
    }

    fun delete(key: String) {
        synchronized(memoryCache) {
            memoryCache.remove(key)
        }
        queryTTFMap.remove(key)
        ACache.get().remove(key)
    }

    fun clear() {
        synchronized(memoryCache) {
            memoryCache.clear()
        }
        queryTTFMap.clear()
        ACache.get().clear()
    }
}
