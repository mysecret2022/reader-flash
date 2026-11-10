# Reader-Flash 智能体项目说明文档 (Agent Project Guide) - v1.0.5

> 本文档专为后续接手的智能体与开发者编写，详尽记录了 reader-flash v1.0.5 的架构设计、100% 官方经典前端复刻规范、已解决的问题、核心算法、测试运行指引及后续迭代路线图。

---

## 1. 版本概述 (v1.0.5)
- **核心目标**：100% 完整复刻只读仓库 `reader` (`http://192.168.0.30:8080`) 的全部前端视觉美学、排版交互与控制台管理体系，包括：
  - **主书架界面 (`Index.vue`)**：官方经典 260px 固定导航栏、搜索配置（单/多源、分组、并发数）、探索发现、全套书籍卡片及管理弹窗。
  - **沉浸式阅读界面 (`Reader.vue`)**：经典垂直悬浮工具栏、目录/书源/设置/书架弹窗、8 套底色与纹理（`body_x.png`, `content_x.png`, `popup_x.png`）、TTS 悬浮播放条。
  - **全功能控制台 (`Admin.vue`)**：100% 完整复刻全部 11 大功能选项卡（`overview`, `users`, `sources`, `shelf`, `userSpace`, `webdav`, `cache`, `cloudSync`, `logs`, `storage`, `backend`）以及 12 套管理弹窗。
  - **高颜值登录视图 (`Login.vue`)**：极光悬浮流萤毛玻璃卡片、账号登录与用户注册分段切换、密码显示切换、错误抖动反馈。
  - **全局应用根容器 (`App.vue`)**：全套全局弹窗（替换规则、书架管理、书友管理、MPCode等）、代码编辑器、暗黑日夜主题样式与四大经典字体（`reader-st`, `reader-fs`, `reader-kt`, `reader-ht`）。
- **保留现代技术栈与验证特性**：
  - 前端工程体系：Vite 5.4 + Vue 3.4 + Pinia + Vuex 4 + Element Plus + Stylus
  - 后端极速搜书：毫秒级 SSE 流式搜书通道 (`/reader3/searchBookMultiSSE` + `searchBookByEventStream`)
  - 智能防跳章换源对齐：四级对齐算法 (`findBestMatchedChapterIndex`)
- **构建环境**：Java 17+, Gradle 7.x/8.x, Node 22.x, Vite 5.2.8.
- **Git 目标分支**：`origin/dev`（禁止推向 `main` 分支）。

---

## 2. 界面复刻架构与规范

### 2.1 主书架界面 (`Index.vue`)
1. **左侧固定 260px 导航栏 (`.navigation-wrapper`)**：
   - 宽度固定 `260px`，高度 `100vh`，背景色 `#F7F7F7`（暗黑主题 `#222222`）。
   - 标题：“阅读” (24px, 600)，右上角版本角标。
   - 副标题：“清风不识字，何故乱翻书” (16px, 500, `#b1b1b1`)。
   - 搜索输入框：胶囊式圆角 `border-radius: 50px`，边框 `#E3E3E3`，前置搜索图标。
   - 搜索设置区：搜索方式选择（单源/多源）、书源或分组选择、并发线程（4-30 线程）。
   - 探索发现：弹出 `Explore.vue` 发现/榜单。
   - 分组管理与账户菜单：下拉菜单进入管理后台、个人空间、退出登录。
   - 底部操作栏：🌙/☀️ 暗黑日夜主题切换按钮，GitHub 链接图标。
2. **右侧主书架展区 (`.shelf-wrapper`)**：
   - 顶部状态栏：左侧显示分组名称与图书数量，右侧包含“书架”、“加载更多”、“刷新”、“编辑”按钮。
   - 书籍分组栏：`el-tabs` 经典横向标签切换。
   - 书籍卡片展区：双列/多列卡片布局，包含封面、书名、作者、字数、最新章节/阅读进度、右上角未读数红色胶囊角标、编辑模式下快捷删除/修改封面/编辑按钮。
   - 全部弹窗：导入网络书源、失效书源治理与体检、导入本地书籍、修改封面。

### 2.2 小说阅读界面 (`Reader.vue`)
1. **纸张背景与 8 套经典底色**：
   - 经典羊皮纸与质感纹理（`body_0.png` ~ `body_6.png`, `content_0.png` ~ `content_6.png`, `popup_0.png` ~ `popup_6.png`）。
   - 象牙白、羊皮纸、护眼绿、深邃夜、水墨灰等 8 套出版级底色。
2. **经典左侧垂直悬浮工具栏 (`.tool-bar`)**：
   - 动态靠齐阅读正文左侧：`margin-left: -(readWidth / 2 + 68)px;`
   - 核心功能：书架、书源（换源测速与对齐）、排版设置（字体、字号、间距、翻页方式）、缓存、夜间模式、全屏。
3. **换源智能章节防跳章对齐算法**：
   - 优先通过 `findBestMatchedChapterIndex` 执行双重数字与核心文本精准对齐；
   - 包含中文章节数字自动转换（`chineseToNumber`）与标签噪声清洗（`parseChapterInfo`）；
   - 兜底原位安全回退，绝不发生误跳第一章问题。

### 2.3 管理控制台全量复刻 (`Admin.vue`)
1. **顶部状态栏导航 (`.admin-header`)**：
   - 品牌标识：`el-icon-reading` 图标 + “Reader” + “控制台 / 个人后台” 徽章。
   - 顶部操作：用户身份标签（系统管理员/账号设置）、暗黑亮色切换按钮、返回书架按钮。
2. **侧边栏导航 (`.admin-sidebar`) 与 11 大功能选项卡**：
   1. `overview`：系统状态总览与快速控制（4个核心统计卡片：用户配额、书源总数、书架书籍、缓存大小；快捷调整配额、书源批量控制、缓存清理、一键导出；系统环境与性能指标）。
   2. `users`：用户权限管理（用户列表、配额展示、新增用户、重置密码、修改到期时间）。
   3. `sources`：书源设置（书源检索、批量启用/禁用、批量删除、批量校验健康、书源编辑、测试抽屉、导入书源）。
   4. `shelf`：书架设置（多用户书架查看、批量迁移分组、书籍信息维护、换源）。
   5. `userSpace`：用户空间（个人书架管理、个人偏好配置）。
   6. `webdav`：WebDAV 备份与同步（连接配置、自动备份策略、云端历史备份列表与恢复）。
   7. `cache`：本地缓存（章节正文缓存、封面图片缓存清理与统计）。
   8. `cloudSync`：云同步与备份（多实例云端同步日志与连接配置）。
   9. `logs`：诊断运行日志（实时服务端运行日志滚动查看、日志级别过滤、一键清空）。
   10. `storage`：本地书仓维护（本地 TXT/EPUB 存储分析与磁盘占用清理）。
   11. `backend`：后端设定（后端接口地址、延迟测速、网络代理与并发控制）。
3. **12 大管理弹窗**：修改用户配额、书源批量控制、书架书籍整理、修改书籍封面、新建书籍分组、修改书籍分组、新增用户、重置密码、导入书源、失效书源治理、探索书源、探索发现结果列表。

### 2.4 登录视图 (`Login.vue`)
- 居中悬浮极光毛玻璃卡片。
- 分段滑动控制器：账号登录 / 用户注册。
- 账号、密码、密码显隐切换、注册邀请码输入。
- 输入校验与错误 Shake 抖动动画。

---

## 3. 工程改造与 Vue 3 兼容性适配说明

为了在保持 `reader-flash` 现代化工程架构（Vite 5 / Vue 3 / Element Plus）的前提下，完全无缝运行 `reader` 的 Vue 2 + Element UI 代码，我们完成了如下系统性适配：
1. **Element UI 经典图标字体系统整合**：
   - 完整引入 `element-icons.woff`、`element-icons.ttf` 与 `element-icons.css`，支持所有 `el-icon-*` 官方图标在 Element Plus 下原生渲染。
2. **Vue 3 模板指令与语法降级适配**：
   - 将 Vue 2 的 `:visible.sync` 自动转换映射为 Vue 3 标准 `v-model`。
   - 对模态子组件中的 `show` prop，采用 `:model-value="actualShow" @update:model-value="onDialogVisibilityUpdate"` 机制，规避 Vue 3 “v-model cannot be used on a prop” 语法报错。
   - 将 `slot-scope="scope"` 升级为 Vue 3 的 `#default="scope"`。
   - 将模态框自定义标题与底部按钮深度分析并包装为 `<template #title>` 与 `<template #footer>`。
3. **Vue 3 响应式状态管理 (`plugins/vuex.js`)**：
   - 使用 Vuex 4 的 `createStore` 重构状态中心，保留全套 `state`、`mutations`、`getters`，并通过 `app.use(store)` 挂载到 Vue 3 全局上下文中。
4. **Vue 3 全局总线与工具集**：
   - 针对 Vue 3 移除 `new Vue()` 作为事件总线的变动，用轻量级观察者模式实现 `EventBus`，支持 `$on`、`$off`、`$emit`。
   - 配置全局 mixin（`api`, `getImagePath`, `getCover`, `getImg`）与 `v-lazy` 图片懒加载指令。

---

## 4. 验证与构建测试记录

- **前端打包**：
  ```bash
  cd web
  npm run build
  ```
  结果：1763 个模块在 16s 内完成打包，无编译错误。
- **前端资源同步**：
  ```bash
  cd web
  npm run sync
  ```
  结果：构建产物自动同步至 `src/main/resources/web/`。
- **后端完整构建**：
  ```bash
  ./gradlew assemble -x test
  ```
  结果：Gradle 任务全部构建成功，生成 `build/libs/reader-flash-2.0.1.jar`。

---

## 5. 后续智能体维护指南

1. **修改前端页面注意事项**：
   - 严禁随意删除已复刻的选项卡或弹窗；
   - 如需为控制台增加新功能，请在对应的 Tab Pane（如 `Admin.vue` 中的对应 `section`）内扩充，避免破坏整体布局；
   - 任何样式调整必须在日间与夜间模式下同时测试对比。
2. **Git 提交与发布规范**：
   - 所有分支开发必须基于 `dev`，推送到远端 `origin/dev`，严禁推送至 `main`。
