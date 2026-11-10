# reader-flash v1.0.3 智能体自说明与维护指南 (Agent Project Guide)

## 1. 版本概述与设计目标
- **版本号**：`v1.0.3`（开发分支 `dev` 维护版）
- **项目定位**：作为 `reader` 新代际演进版本，保持现代化轻量技术栈（Vite 5 + Vue 3.4 + Pinia + Element Plus + Vert.x / SpringBoot），深度对齐原版 `reader` 的多源小说动态抓取、实时预览与阅读机制。
- **发布策略**：严格遵循用户规范，所有功能微调、测试与构建统一提交并推送至 `dev` 分支；`main` 分支保持冻结，直至用户发出正式发版指令。

---

## 2. 本版本核心功能修复与新增 (Changelog & Root Causes)

### 2.1 搜书结果“点击预览跳空白屏幕”根因彻底修复 (Search Preview & Zero-Blank-Screen Fix)
- **用户反馈**：搜索完书籍以后，点击预览直接跳成空白屏幕，未从目标网站抓取小说并在网页展示。
- **深入源码排查与根因分析**：
  1. **未入架书籍缺少书源参数**：
     - 在原版 `reader` 的设计中，从搜索结果进入阅读页时，书籍尚未加入本地书架（`getShelfBookByURL` 返回 `null`）。
     - 后端 `BookController.kt` 在 `bookInfo == null` 时，必须依靠请求体中的 `bookSourceUrl` 参数调用 `getBookSourceString(context)` 动态查找并加载书源规则（`WebBook.getBookInfo(bookUrl)` 与 `WebBook.getChapterList(book)`）。
     - 旧版 `Reader.vue` 请求 `/reader3/getChapterList` 和 `/reader3/getBookContent` 时仅传递了 `{ url: bookUrl.value }`，遗漏了 `bookSourceUrl: origin.value`。
     - 后端因为找不到书源配置，直接报错返回 `"未配置书源"`。
  2. **前端缺乏状态兜底导致完全白屏**：
     - 当 `getChapterList` 报错时，`chapterList` 数组为空且 `loading` 结束。
     - 视图模板中缺乏对空目录或加载异常的友好提示，导致正文视口直接渲染了一个空 `div`，用户视觉上表现为全屏空白。
  3. **后端书源 URL 匹配差异**：
     - 目标书源的 `bookSourceUrl` 结尾可能存在斜杠差异（如 `https://www.enjing.net/` 与 `https://www.enjing.net`），旧版代码使用严格等值比对导致书源对象匹配失败。
- **修复方案与实现**：
  - **前端请求参数补齐**：`Reader.vue` 中调用 `/reader3/getChapterList` 与 `/reader3/getBookContent` 时，完整携带 `{ url: bookUrl.value, bookSourceUrl: origin.value }`，确保后端无论书籍是否加入书架均能准确命中对应书源规则，实时从目标网站抓取章节目录与正文。
  - **零白屏全链路状态卡片**：
    - 增加 **抓取中状态（`catalogLoading`）**：全屏展示优雅旋转指示器，明确提示正在抓取目标小说《书名》与目标书源，缓解网络延迟焦虑；
    - 增加 **抓取失败友好卡片（`catalogError`）**：展示具体错误原因，并提供 `[🔄 重新抓取]` 和 `[‹ 返回书架 / 更换书源]` 按钮，杜绝任何形式的白屏死锁；
    - 增加 **正文加载中与失败兜底**：章节切换中提示加载状态，正文抓取失败时保留界面并支持一键重新加载。
  - **搜索卡片交互增强**：
    - 在主页搜索结果卡片上提供双入口操作：`[📖 立即预览]`（直接抓取并进入全屏阅读）与 `[➕ 加入书架]`（无需进入阅读即可一键收藏并刷新书架）。
    - 阅读器顶部控制栏在发现书籍未入架时，常驻展示 `[➕ 加入书架]` 胶囊按钮，预览满意后轻点即可永久收录。
  - **后端容错增强**：
    - 在 `BookController.kt` 的 `getBookSourceBySourceURL` 中增加对 URL 末尾斜杠的容错剔除（`trimEnd('/')`）。
    - 封面代理及远程抓取超时从原硬编码 3 秒延展至 10 秒。

---

### 2.2 书源健康体检误杀修复与三阶段深度体检 (3-Stage Health Inspection)
- **问题背景**：用户反馈多组正常可访问的文学与分类小说网站（如 `wenxue88.com`, `enjing.net`, `66story.com`, `sudugu.org` 等）在后台体检时被误判为“失效”。
- **根因分析**：
  1. 旧版检测超时硬编码为 4.5 秒，在高并发下小说站响应通常在 3-7 秒，超时即被归入失效；
  2. 仅以关键字 `'我的'` 测试搜书，纯文学、分类专精网站无匹配结果时直接被标为失效；
  3. 相当一部分书源属于“发现/分类导航型书源”（仅配置 `exploreUrl`，无 `searchUrl`），调用 `searchBook` 会抛出未配置搜索规则异常，直接被误判为失效。
- **三阶段深度体检与防爬/WAF精准识别机制**：
  - **阶段 1（搜索规则实测）**：若书源配置了 `searchUrl`，使用可配置的高频字（默认 `'的'`）测试搜索，超时放宽至 10 秒；
  - **阶段 2（发现分类兜底）**：若搜索无果或未配置搜索规则，解析首个发现分类页面链接，调用 `/reader3/exploreBook` 验证能否解析出书籍；
  - **阶段 3（首页连通性探测）**：若规则暂未命中但网站完全可连通，调用 `/reader3/readRemoteSourceFile` 进行存活探针；
  - **严格精准裁决失效**：
    - 针对防火墙阻断（如 `403 Forbidden`、`安全检测拦截`、`Cloudflare 验证码`），精准标记为失效（避免爬虫盲目请求）；
    - 针对首页伪装 200 但实际为清空服务器（如 Apache/Nginx `404 Not Found: The requested URL was not found on this server`），进行指纹识别标记失效；
    - 针对首页 404 但其内部搜索与分类接口正常工作（如独步小说 `dbxsn.com`）的书源，阶段 1 / 阶段 2 实测可搜出小说，正确判定为存活，绝不误杀！

### 2.3 严控内存占用与双层资源熔断机制 (JVM & Container Memory Governance)
- **优化背景**：现代 JVM 默认按宿主机物理内存的 25% 动态分配堆内存。在 16G/32G 宿主机或软路由、NAS 上，容易因无上限膨胀导致占用过高。
- **解决方案与双层防护**：
  1. **JVM 运行时软上限**：
     - 在 `entrypoint.sh`、`docker-compose.yml`、`startup.sh`、`startup.cmd` 中全局注入默认内存限制：初始堆 `-Xms128m`，最大堆 `-Xmx512m`；
     - 启用现代化垃圾回收器 `-XX:+UseG1GC` 与容器感知 `-XX:+UseContainerSupport`，短时并发激增后及时高效释放内存，平稳回落至低内存区间。
  2. **Docker 容器硬件级硬熔断**：
     - 在 `docker-compose.yml` 中配置 `deploy.resources.limits.memory: 768M`，将包括 JVM 堆外内存与 Edge TTS 微服务在内的整个容器总内存封顶在 768MB，彻底防止极端情况下挤占宿主机资源。

---

## 3. 架构与核心文件指引
- `web/src/views/Reader.vue`: 现代化阅读核心，包含未入架小说实时抓取解析、加入书架、零白屏状态卡片、3D仿真/滚动翻页、多角色拟人听书、白噪音伴读。
- `web/src/views/Index.vue`: 移动端深度优化书架与找书面板，支持流式搜书卡片一键即时预览与快速入架。
- `web/src/views/Admin.vue`: 控制台后台治理中心，8 线程并发三阶段深度体检与无损书源管理。
- `src/main/java/com/htmake/reader/api/controller/BookController.kt`: 书籍抓取、章节列表、目录解析与正文获取控制器。
- `src/main/java/com/htmake/reader/api/controller/BookSourceController.kt`: 书源保存、健康检查探针与远程书源获取。
