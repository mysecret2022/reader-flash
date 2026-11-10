# reader-flash v1.0.2 智能体自说明与维护指南 (Agent Project Guide)

## 1. 版本概述与设计目标
- **版本号**：`v1.0.2`（开发分支 `dev` 维护版）
- **项目定位**：作为 `reader` 全新代际演进版本，重构现代化技术栈（Vite 5 + Vue 3.4 + Pinia + Element Plus），保留并增强经典阅读内核与全套管理治理体系。
- **发布策略**：日常开发、需求微调与测试统一提交至 `dev` 分支；正式发布版（`main` 及正式镜像）仅在用户明确指令时合并发布。

---

## 2. 本版本核心功能修复与新增 (Changelog & Bug Fixes)

### 2.1 游客拦截与全局鉴权守卫 (Security Guard)
- **问题背景**：原路由未设置访问守卫，游客未登录可直接打开主页或后台控制台，且后台 API 因未传递凭据直接报错 `NEED_LOGIN`。
- **解决方案**：
  - 在 `web/src/router/index.js` 配置全局路由前置守卫（`beforeEach`）：无有效登录 Token 访问受保护页面（如主页 `/`、控制台 `/admin`）强制重定向至 `/login`。
  - 创建全局统一请求实例 `web/src/utils/request.js`：开启 `withCredentials: true`，并在拦截器中自动为请求注入 `accessToken` 请求头与 Query 参数，响应拦截器捕获 `NEED_LOGIN` / 401 自动清理会话并引导回登录页。

### 2.2 控制台多线程并发体检与可见进度条 (Multi-Threaded Health Check)
- **问题背景**：旧版体检仅串行测试前 15 个源，无进度反馈，耗时长且无法掌握检测全貌。
- **解决方案**：
  - 新增 8 路多线程并发连接池（`CONCURRENCY = 8`），多源并行并发探测。
  - 增加实时动态体检进度卡片：包含 `<el-progress>` 动画进度条、正在探测的书源名称、已测/总数计数器（`current / total`）、优质源/较慢源/失效源统计胶囊标签、一键终止按钮与一键批量清理失效源按钮。

### 2.3 主页流式搜书与数据解析修复 (Search Fix & Fallback)
- **问题背景**：主页搜索书籍无法呈现结果。
- **根因分析**：
  - SSE 流式接口未带身份凭据导致后端拦截；
  - 后端返回数据结构为 `{ lastIndex, data: [ SearchBook... ] }`，前端原代码使用 `if (Array.isArray(data))` 判断导致所有书籍被错误过滤丢弃；
  - 封面字段兼容：后端实体为 `coverUrl`。
- **解决方案**：
  - `stores/book.js` 中自动拼接 `accessToken` 参数；
  - 修正数据提取逻辑：`const books = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : [])`；
  - 增加 SSE 中断时的 HTTP 批量搜索（`/reader3/searchBookMulti`）智能兜底。

### 2.4 移动端/手机端深度优化 (Mobile-First Optimization)
- **优化细节**：
  - 增加移动端专属吸底导航栏（📚 书架、🔍 找书、📊 成就、⚙️ 控制台、🚪 退出），触控反馈友好，适配全面屏手势条（`safe-area-inset-bottom`）；
  - 书架与搜索列表在手机屏幕下自动切换为双列/单列高密度紧凑卡片，自适应屏幕宽度；
  - 管理后台侧边菜单在手机端自适应为横向横向滑动标签胶囊，操作直观顺手。

---

## 3. 本地测试与自测闭环
- 在本地 8095 端口运行打包 JAR 并完成以下全链路测试：
  1. 未登录拦截测试：游客 POST `/reader3/addUser` 成功返回 `NEED_LOGIN`；
  2. 管理员登录测试：POST `/login` 返回管理员身份与有效 `accessToken`；
  3. 创建用户测试：带 `accessToken` 调用 POST `/reader3/addUser` 成功创建普通用户 `reader01`；
  4. 书源导入测试：带 `accessToken` 调用 POST `/reader3/saveBookSources` 成功保存书源并在 `/reader3/getBookSources` 中持久化存储。
- 测试完成后已严格清理临时进程与存储数据。

---

## 4. 架构与核心文件指引
- `web/src/utils/request.js`: 全局请求与鉴权拦截器。
- `web/src/router/index.js`: 路由定义与未登录访问重定向守卫。
- `web/src/views/Admin.vue`: 管理后台（多线程体检、书源多模式导入、用户管理）。
- `web/src/views/Index.vue`: 移动端优化书架与流式搜索主页。
- `web/src/stores/book.js`: 书架状态与 SSE 搜书。
