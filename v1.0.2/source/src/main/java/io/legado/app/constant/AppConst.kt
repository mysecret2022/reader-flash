package io.legado.app.constant

import java.text.SimpleDateFormat
import com.script.javascript.RhinoScriptEngine

object AppConst {

    const val UA_NAME = "User-Agent"

    val userAgent: String by lazy {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    }

    val SCRIPT_ENGINE: RhinoScriptEngine by lazy {
        RhinoScriptEngine()
    }

    val TIME_FORMAT: SimpleDateFormat by lazy {
        SimpleDateFormat("HH:mm")
    }

    val timeFormat: SimpleDateFormat by lazy {
        SimpleDateFormat("HH:mm")
    }

    val dateFormat: SimpleDateFormat by lazy {
        SimpleDateFormat("yyyy/MM/dd HH:mm")
    }

    val fileNameFormat: SimpleDateFormat by lazy {
        SimpleDateFormat("yy-MM-dd-HH-mm-ss")
    }

    val keyboardToolChars: List<String> by lazy {
        arrayListOf(
            "@", "&", "|", "%", "/", ":", "[", "]", "{", "}", "<", ">", "\\", "$", "#", "!", ".",
            "href", "src", "textNodes", "xpath", "json", "css", "id", "class", "tag"
        )
    }

    const val JS_INJECT_HELPERS = """function getVariable(k){try{if(k!==undefined&&k!==null){if(typeof java!=='undefined'&&java&&java.getVariable)return java.getVariable(k)||'';if(typeof source!=='undefined'&&source&&source.getVariable)return source.getVariable(k)||'';}else{if(typeof java!=='undefined'&&java&&java.getVariable)return java.getVariable()||'';if(typeof source!=='undefined'&&source&&source.getVariable)return source.getVariable()||'';}}catch(e){}return '';};function setVariable(a,b){try{if(b!==undefined){if(typeof java!=='undefined'&&java&&java.putVariable)return java.putVariable(a,b);if(typeof source!=='undefined'&&source&&source.putVariable)return source.putVariable(a,b);}else{if(typeof java!=='undefined'&&java&&java.setVariable)return java.setVariable(a);if(typeof source!=='undefined'&&source&&source.setVariable)return source.setVariable(a);}}catch(e){}};function putVariable(k,v){try{if(typeof java!=='undefined'&&java&&java.putVariable)return java.putVariable(k,v);if(typeof source!=='undefined'&&source&&source.putVariable)return source.putVariable(k,v);}catch(e){}return v;};if(typeof atob==='undefined'){atob=function(s){try{return ''+new java.lang.String(java.util.Base64.getDecoder().decode(''+s),"UTF-8");}catch(e){return '';}};}if(typeof btoa==='undefined'){btoa=function(s){try{return ''+java.util.Base64.getEncoder().encodeToString(new java.lang.String(''+s).getBytes("UTF-8"));}catch(e){return '';}};}if(!String.prototype.replaceAll){String.prototype.replaceAll=function(s,r){if(s instanceof RegExp){return this.replace(s,r);}return this.split(s).join(r);};}if(!Array.prototype.flat){Array.prototype.flat=function(depth){depth=depth===undefined?1:Math.floor(depth);if(depth<1)return Array.prototype.slice.call(this);return(function flat(arr,d){var res=[];for(var i=0;i<arr.length;i++){if(Array.isArray(arr[i])&&d>0){res=res.concat(flat(arr[i],d-1));}else if(arr[i]!==undefined){res.push(arr[i]);}}return res;})(this,depth);};};"""
}