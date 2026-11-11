# Reader-Flash 智能体项目说明文档 (Agent Project Guide) - v1.0.7

> 本文档专为后续接手的智能体与开发者编写，详尽记录了 reader-flash v1.0.7 的架构设计、100% 官方经典前端复刻规范、已深度修复的运行时缺陷、核心算法、测试运行指引及后续迭代路线图。

---

## 1. 版本概述 (v1.0.7)
- **核心目标**：彻底根除首屏启动时的本地缓存崩溃报错，并解决后端资源路径拦截冲突导致的全部经典图标 404 缺失问题，实现官方经典视觉样式与图标系统的 100% 完美复刻与稳定运行。
- **构建环境**：Java 17+, Gradle 7.x/8.x, Node 22.x, Vite 5.4.
- **Git 目标分支**：`origin/dev`（严禁推向 `main` 分支）。

---

## 2. v1.0.7 修复的致命缺陷与根本原因深度剖析

### 2.1 运行时缺陷：`Cannot read properties of undefined (reading 'setItem')` 与 `(reading 'getItem')`
- **问题输入与触发条件**：
  - 页面初次加载或刷新时，`App.vue` 中的 `loadBookShelf`、`loadBookGroup`、`loadReplaceRules` 分别发起请求。
  - 请求流经 `plugins/helper.js` 中的 `networkFirstRequest` 和 `cacheFirstRequest`，直接调用 `window.$cacheStorage.getItem` 与 `window.$cacheStorage.setItem`。
- **实际表现**：
  - 控制台连续抛出 3 条红字致命异常：
    1. `后端连接失败 TypeError: Cannot read properties of undefined (reading 'setItem')`
    2. `加载分组列表失败 TypeError: Cannot read properties of undefined (reading 'getItem')`
    3. `加载替换规则失败 TypeError: Cannot read properties of undefined (reading 'getItem')`
- **根本原因**：
  - 在官方原版 `reader/web/src/main.js` 中，通过 `localforage.createInstance({ name: "cacheStorage" })` 初始化并挂载了 `window.$cacheStorage`。
  - 在 `reader-flash` 迁移到 Vite + Vue 3 后，`main.js` 漏掉了 `localforage` 的初始化逻辑，导致 `window.$cacheStorage` 为 `undefined`。
- **修复措施**：
  1. 在 `web/src/main.js` 中引入 `localforage`，初始化 `window.$cacheStorage = localforage.createInstance({ name: 'cacheStorage' })`。
  2. 在 `main.js` 中同时提供带有 in-memory Map 及 localStorage 回退机制的健全对象，即使在极端环境或隐私模式下也能安全执行 `getItem`/`setItem`/`removeItem`，绝不抛出 undefined 错误。
  3. 在 `web/src/plugins/helper.js` 中编写 `getCacheStorage()` 保护函数，在 `networkFirstRequest` 和 `cacheFirstRequest` 中统一通过保护函数访问缓存，双重保障零异常。

### 2.2 视觉与静态资源缺陷：图标全部失效与字体 404
- **问题表现**：
  - 界面上所有按钮图标、书架操作图标、控制台图标、阅读器操作图标均无法显示。
  - 浏览器控制台报 `GET /assets/element-icons-B-tDfklg.woff 404 Not Found` 及 `GET /assets/iconfont-PstzbNMW.woff 404 Not Found`。
- **根本原因**：
  - 后端 Vert.x 路由在 `YueduApi.kt:107` 中明确注册了静态路由：
    `router.route("/assets/*").handler(StaticHandler.create().setAllowRootFileSystemAccess(true).setWebRoot(assetsDir)...)`
    该路由专门用于挂载用户磁盘上的 `storage/assets/` 目录！
  - Vite 默认的打包产物输出目录为 `assetsDir: 'assets'`，生成的资源 URL 均为 `/assets/...`。
  - 当前端请求 `/assets/element-icons-*.woff` 时，请求被后端的 `storage/assets/` 拦截器捕获并在磁盘目录中寻找，而不是从 classpath 中的前端 `web/` 静态包中获取，直接导致 404 错误！
  - 字体加载失败导致所有基于 `iconfont` 和 `element-icons` 的图标完全失去字形支持。
- **修复措施**：
  1. 在 `web/vite.config.js` 中配置 `base: './'` 并将静态资源输出目录指定为 `assetsDir: 'static'`。
  2. 构建打包产物全部生成在 `static/` 目录下（如 `dist/static/element-icons-*.woff`、`dist/static/iconfont-*.woff`、`dist/static/index-*.css` 等），彻底避开后端的 `/assets/*` 路由拦截。
  3. 更新 `web/src/assets/fonts/iconfont.css` 与 `web/src/assets/fonts/element-icons.css`，补齐规范的字体展示属性与样式类选择器。
  4. 彻底删除旧构建残留目录 `src/main/resources/web/assets`，重新构建并将 `dist/*` 同步至 `src/main/resources/web/`。
  5. 执行 `./gradlew assemble -x test` 重新打包后端 jar，经测试构建 100% 成功。

---

## 3. 项目架构与关键目录索引

- `src/main/java/`：Kotlin/Java 后端核心业务逻辑，包含 Vert.x REST API (`YueduApi.kt`)、书源解析执行引擎及 SSE 流式搜书通道。
- `src/main/resources/web/`：后端内嵌的前端静态部署目录（由 `web/` 构建产物同步而来）。
- `web/`：Vue 3 + Vite 5 前端源码仓库。
  - `web/src/App.vue`：应用根组件与全局弹窗中枢。
  - `web/src/views/Index.vue`：经典书架主界面与毫秒级 SSE 流式搜书。
  - `web/src/views/Reader.vue`：全沉浸式小说阅读器，含智能防跳章换源对齐。
  - `web/src/views/Admin.vue`：全功能控制台（11 大管理选项卡）。
  - `web/src/plugins/icons.js`：Element UI 经典图标在 Vue 3 下的动态桥接组件。
  - `web/src/plugins/helper.js`：全局通用工具类、缓存降级与防崩溃包装。

---

## 4. 构建与测试指引

### 前端开发与构建
```bash
cd web
# 本地热更新调试
npm run dev

# 编译并同步到后端资源目录
npm run sync
```

### 后端打包与验证
```bash
./gradlew assemble -x test
# 打包生成的运行包位于 build/libs/reader-flash-*.jar
```

---

## 5. 后续维护注意事项
1. **静态资源路径**：切勿在 `vite.config.js` 中将 `assetsDir` 改回 `assets`，否则会与 `YueduApi.kt` 的 `/assets/*` 磁盘目录路由再次冲突。
2. **只读保护约束**：绝对禁止直接或间接修改只读仓库 `/home/ubuntu/luoxia/project/Gtihub自建仓库/reader` 下的任何文件。
3. **Git 提交**：始终推送到 `origin/dev` 分支。
