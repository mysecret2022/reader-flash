package io.legado.app.help

import com.script.CompiledScript
import com.script.Bindings
import io.legado.app.constant.AppConst
import java.security.MessageDigest
import java.util.LinkedHashMap

/**
 * Rhino JS 脚本预编译 LRU 缓存池与现代化语法兼容引擎
 * 1. 缓存编译后的 CompiledScript，避免在列表规则中重复编译相同 JS 源码的 AST。
 * 2. 自动转译现代 ES 语法（可选链 ?. 与空值合并 ??），彻底杜绝现代书源在服务端因语法报错静默阵亡。
 */
object RhinoScriptCache {

    private const val MAX_ENTRIES = 512

    private val cache = object : LinkedHashMap<String, CompiledScript>(MAX_ENTRIES, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CompiledScript>?): Boolean {
            return size > MAX_ENTRIES
        }
    }

    private fun md5(str: String): String {
        val digest = MessageDigest.getInstance("MD5")
        val bytes = digest.digest(str.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * 将现代 ES 语法（如可选链 ?. 与空值合并 ??）预转译为 Rhino 兼容的标准语法
     */
    fun transformModernSyntax(code: String): String {
        var result = code
        // 转换空值合并运算符: a ?? b -> ((a !== undefined && a !== null) ? a : b)
        if (result.contains("??")) {
            result = result.replace(Regex("""([a-zA-Z0-9_$.\[\]'"]+)\s*\?\?\s*([a-zA-Z0-9_$.\[\]'"]+)""")) { match ->
                val left = match.groupValues[1]
                val right = match.groupValues[2]
                "(($left !== undefined && $left !== null) ? $left : $right)"
            }
        }
        // 转换可选链运算符: a?.b -> (a != null ? a.b : undefined)
        if (result.contains("?.")) {
            result = result.replace(Regex("""([a-zA-Z0-9_$]+)\s*\?\.\s*([a-zA-Z0-9_$]+)""")) { match ->
                val obj = match.groupValues[1]
                val prop = match.groupValues[2]
                "($obj != null ? $obj.$prop : undefined)"
            }
        }
        return result
    }

    /**
     * 执行 JS，优先从预编译 LRU 缓存获取 CompiledScript 执行
     */
    fun eval(jsStr: String, bindings: Bindings): Any? {
        val transformedJs = transformModernSyntax(jsStr)
        val key = md5(transformedJs)
        val compiledScript = synchronized(cache) {
            cache[key] ?: run {
                try {
                    val script = AppConst.SCRIPT_ENGINE.compile(transformedJs)
                    cache[key] = script
                    script
                } catch (e: Exception) {
                    null
                }
            }
        }

        return if (compiledScript != null) {
            compiledScript.eval(bindings)
        } else {
            AppConst.SCRIPT_ENGINE.eval(transformedJs, bindings)
        }
    }
}
