# Reader-Flash 智能体项目说明文档 (Agent Project Guide) - v1.0.6

> 本文档专为后续接手的智能体与开发者编写，详尽记录了 reader-flash v1.0.6 的架构设计、100% 官方经典前端复刻规范、已深度修复的运行时缺陷、核心算法、测试运行指引及后续迭代路线图。

---

## 1. 版本概述 (v1.0.6)
- **核心目标**：在 100% 完整复刻只读仓库 `reader` 前端视觉美学与控制台管理体系的基础上，彻底解决 Vue 2 向 Vue 3 迁移过程中产生的所有致命运行时缺陷（包括 ESM 下的 `require` 崩溃、实例级 `$on`/`$once`/`$emit` 缺失、`this.$root.$children[0]` 崩溃、Element Plus 按钮图标空白等）。
- **包含的核心视图与弹窗**：
  - **主书架界面 (`Index.vue`)**：官方经典 260px 固定导航栏、搜索配置（单/多源、分组、并发数）、探索发现、全套书籍卡片及管理弹窗，保留 flash 独有的后端 SSE 流式搜书逻辑。
  - **沉浸式阅读界面 (`Reader.vue`)**：经典垂直悬浮工具栏、目录/书源/设置/书架弹窗、8 套底色与纹理（`body_x.png`, `content_x.png`, `popup_x.png`）、TTS 悬浮播放条，并深度注入 `findBestMatchedChapterIndex` 智能章节对齐防跳章算法。
  - **全功能控制台 (`Admin.vue`)**：100% 完整复刻全部 11 大功能选项卡（`overview`, `users`, `sources`, `shelf`, `userSpace`, `webdav`, `cache`, `cloudSync`, `logs`, `storage`, `backend`）以及 12 套管理弹窗。
  - **高颜值登录视图 (`Login.vue`)**：极光悬浮流萤毛玻璃卡片、账号登录与用户注册分段切换、密码显示切换、错误抖动反馈。
  - **全局应用根容器 (`App.vue`)**：全套全局弹窗（替换规则、书架管理、书友管理、MPCode等）、代码编辑器、暗黑日夜主题样式与四大经典字体（`reader-st`, `reader-fs`, `reader-kt`, `reader-ht`）。
- **保留现代技术栈与验证特性**：
  - 前端工程体系：Vite 5.4 + Vue 3.4 + Pinia + Vuex 4 + Element Plus + Stylus
  - 后端极速搜书：毫秒级 SSE 流式搜书通道 (`/reader3/searchBookMultiSSE` + `searchBookByEventStream`)
  - 智能防跳章换源对齐：四级对齐算法 (`findBestMatchedChapterIndex`)
- **构建环境**：Java 17+, Gradle 7.x/8.x, Node 22.x, Vite 5.4.
- **Git 目标分支**：`origin/dev`（禁止推向 `main` 分支）。

---

## 2. v1.0.6 发现并彻底修复的缺陷清单

### 2.1 致命运行时缺陷：Vite 客户端浏览器 ESM 中 `require(...)` 抛出 ReferenceError
- **问题输入与触发条件**：
  - 打开控制台 `/admin` 时，`Admin.vue` 初始化数据 `noCoverImage: require("../assets/imgs/noCover.jpeg")`。
  - 在 `Index.vue` 或 `BookManage.vue` 中点击“刷新封面”时调用 `require("axios/lib/helpers/buildURL")`。
  - 打开 `MPCode.vue` 弹窗时模板渲染 `:src="require('../assets/imgs/mpcode.jpg')"`。
  - 图片加载失败触发 `onCoverImgError` 时调用 `require("@/assets/imgs/noCover.jpeg")`。
- **预期行为**：平稳加载图片与解析 SSE URL。
- **实际表现**：浏览器控制台立即崩溃并抛出 `Uncaught ReferenceError: require is not defined`，导致页面白屏或功能中断。
- **根本原因**：Vite 在客户端是基于标准 ES Module 打包的，浏览器运行环境中不存在 CommonJS 的全局 `require` 函数。
- **修复措施**：
  1. 在 `web/src/plugins/helper.js` 中显式导出 ESM 规范的 `buildURL(url, params)` 函数。
  2. 在 `Admin.vue`、`Index.vue`、`BookManage.vue`、`BookSource.vue` 中全部改为 ESM `import { buildURL } from "../plugins/helper"`。
  3. 将所有图片的 `require(...)` 统一替换为标准静态 ESM `import`（如 `import noCover from "../assets/imgs/noCover.jpeg"`、`import mpcodeImg from "../assets/imgs/mpcode.jpg"`）。

### 2.2 致命运行时缺陷：Vue 3 中 `this.$root.$children` 为 undefined
- **问题输入与触发条件**：
  - 在 `ReplaceRule.vue`、`BookManage.vue`、`BookGroup.vue`、`Bookmark.vue`、`BookInfo.vue`、`RssSourceList.vue` 等组件中保存或刷新数据时执行 `this.$root.$children[0].loadBookShelf()` 等方法。
- **预期行为**：调用根组件 `App.vue` 上的全局数据加载方法。
- **实际表现**：抛出 `TypeError: Cannot read properties of undefined (reading '0')` 崩溃。
- **根本原因**：Vue 3 从组件实例上完全移除了 `$children` 属性。
- **修复措施**：
  - 在 `web/src/main.js` 中通过全局 mixin 在根组件挂载时捕获实例，并在 `this.$root` 上动态定义只读属性 `$children`，始终返回 `[rootAppInstance]`，100% 保持经典 Vue 2 调用兼容性。

### 2.3 致命运行时缺陷：Vue 3 移除实例级 `$on`、`$once`、`$off`
- **问题输入与触发条件**：
  - 在 `Reader.vue` 中 11 处核心阅读流程（如 `this.$once("showContent", ...)`、`this.$once("loadCatalog", ...)`、`this.$once("iframeLoad", ...)`）以及 `Index.vue` 中 1 处导入确认流程。
  - 在 `Reader.vue:708` 中调用 `this.$Lazyload.$on("loaded", ...)`。
- **预期行为**：等待阅读器章节加载完成后执行回调。
- **实际表现**：抛出 `TypeError: this.$once is not a function` 和 `Cannot read properties of undefined (reading '$on')`。
- **根本原因**：Vue 3 完全剥离了组件实例上的 EventEmitter 接口。
- **修复措施**：
  1. 在 `web/src/main.js` 的 `beforeCreate` 中注入实例级事件订阅器，并巧妙劫持底层 `this.$.emit`，使 `$once`/`$on`/`$off` 与 `$emit` 在组件内部完美协同。
  2. 在 `app.config.globalProperties` 上提供 `$Lazyload` 全局事件总线，并在 `v-lazy` 指令图片加载完成时发射 `loaded` 事件。

### 2.4 致命运行时缺陷：Vue 3 移除 `this.$set` 与 `this.$delete`
- **问题输入与触发条件**：
  - 在 `ReadSettings.vue:560` 中切换 `edgeSwipeBack`，调用 `this.$set(this.config, "edgeSwipeBack", nextVal)`。
  - 在 `BookManage.vue:687, 714` 中更新书籍列表状态，调用 `this.$set(this.bookList, index, ...)`。
- **预期行为**：设置对象或数组属性并触发响应式更新。
- **实际表现**：抛出 `TypeError: this.$set is not a function`。
- **修复措施**：
  - 在 `web/src/main.js` 中设置 `app.config.globalProperties.$set = (target, key, val) => { if (target) target[key] = val; return val; };` 及 `$delete` 补丁。

### 2.5 视觉缺陷：Element Plus 中 `<el-button icon="el-icon-*">` 图标空白
- **问题输入与触发条件**：
  - 全局所有 `<el-button icon="el-icon-back">`、`<el-input prefix-icon="el-icon-search">`。
- **预期行为**：渲染出经典 Element UI 字体图标。
- **实际表现**：Element Plus 的 `icon` 属性在 Vue 3 中把字符串当作动态组件名称渲染，生成了自定义标签 `<el-icon-back></el-icon-back>`，由于缺乏组件定义和 CSS 类名，图标区呈现完全空白！
- **修复措施**：
  - 编写 `web/src/plugins/icons.js`，批量提取 `element-icons.css` 中的全部 282 个图标类名，并在 Vue 3 中动态注册为输出 `<i class="el-icon-*"></i>` 的标准图标组件，彻底恢复所有按钮与输入框的前置/后置图标。

### 2.6 弹窗双向绑定缺陷：16 个弹窗组件未定义 `actualShow`
- **根本原因**：上一版迁移脚本在判定 `'actualShow' not in content` 时由于执行顺序错误导致注入被跳过，使得 `SearchBookContent.vue`、`ReplaceRule.vue`、`BookManage.vue` 等 16 个弹窗模板中的 `:model-value="actualShow"` 无法解析。
- **修复措施**：
  1. 在 `web/src/main.js` 中提供全局 `actualShow` 与 `onDialogVisibilityUpdate` 计算属性和方法，兜底所有模态框。
  2. 在 16 个弹窗组件中将 `props: ["show"]` 全量扩充为 `props: ["show", "value", "modelValue"]`，消除 Vue 3 访问未声明属性的警告。

### 2.7 结构缺陷：`Admin.vue` 中卡片废弃语法 `<div slot="header">`
- **修复措施**：重构为 Element Plus 官方规范的 `<template #header>`。

### 2.8 路由缺陷：`router/index.js` 强制拦截 `/admin` 跳转 `/login`
- **修复措施**：移除人工生硬路由重定向，恢复官方由后端返回 `NEED_LOGIN` 时弹出登录弹窗的自然交互。

---

## 3. 验证与构建测试记录

- **前端单测与 SSR 渲染验证**：
  ```bash
  cd web && node -e '...' # 验证 buildURL、图标注册渲染、rootInstance 注入、$on/$once/$emit 闭环
  ```
  结果：全部断言通过，0 警告，0 报错。
- **前端打包编译**：
  ```bash
  cd web && npm run sync
  ```
  结果：1765 个模块全部编译通过，产物自动无损同步至 `src/main/resources/web/`。
- **后端整包打包**：
  ```bash
  ./gradlew assemble -x test
  ```
  结果：`BUILD SUCCESSFUL in 19s`，生成标准可部署 JAR 文件。
- **只读目录保护确认**：
  ```bash
  git -C /home/ubuntu/luoxia/project/Gtihub自建仓库/reader status
  ```
  结果：`nothing to commit, working tree clean`，0 变更。

---

## 4. 后续维护与智能体接手路线图
1. **书源与 WebDAV 实机联调**：在真实多源并发网络环境下观察后端 Vert.x 响应式断路器的稳定性。
2. **多终端适配**：验证移动端浏览器（PWA 独立全屏模式）下阅读界面手势翻页与沉浸式状态栏的表现。
