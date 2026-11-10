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

### 2.4 全网智能换源抽屉“闪退/秒关”根因彻底修复与移动端手势适配 (Change Source Drawer Fix)
- **用户反馈**：换源功能点击后“直接闪了一下就消失了”，无法正常唤出书源列表进行换源切换。
- **根因分析**：
  1. **遮罩层点击冲突 (Close-On-Click-Modal)**：Element Plus `el-drawer` 默认开启 `:close-on-click-modal="true"` 并在 `body` 上挂载全局遮罩层。在移动设备触摸（touch）或桌面快速点击时，点击事件冒泡至新挂载的遮罩层，导致组件判定为“点击外部区域”瞬间触发关闭（秒关/闪退）。
  2. **SSE 换源接口缺少 `url` 参数拦截报错**：后端 `/reader3/searchBookSourceSSE` 强制校验 `bookUrl` 参数（`if (bookUrl.isNullOrEmpty()) response.write("event: error")`），而旧版换源前端发起 SSE 仅传了 `name` 与 `author`，漏传了书籍链接 `url`，导致后端直接返回报错事件并中断流。
  3. **认证凭据丢失**：`BookSourceDrawer.vue` 误直接使用裸 `import axios from 'axios'`，缺少带拦截器注入 `accessToken` 和 `secureKey` 的封装请求对象，触发未登录鉴权失败。
  4. **全屏点击与手势穿透冲突**：阅读页根视口与左右滑动翻页均监听了区域点击，在抽屉展开瞬间若有事件穿透会触发控制栏切换与翻页干扰。
- **修复与加固实现**：
  1. **关闭误触屏蔽**：配置 `:close-on-click-modal="false"` 与 `:destroy-on-close="false"`，抽屉仅在用户主动点击顶部 `✕` 或底部“关闭窗口”按钮、以及按 Escape 键时平滑收起，杜绝任何形式的被动意外闪退。
  2. **参数与认证链路齐备**：换源抽屉改用标准封装 `request` 携带登录凭据；SSE 全网测速请求完整注入 `{ url: props.bookUrl, name, author, searchSize, accessToken, secureKey }`，完美命中后端实时抓取接口。
  3. **自适应移动端与桌面端**：手机端（屏幕宽度 < 640px）自适应从底部向上滑出（`btt`，APP 级底栏交互），桌面端从右向左滑出（`rtl`），尺寸动态适配不溢出。
  4. **全局防冲突门禁**：在 `Reader.vue` 的 `handleContainerClick` 与 `handlePageTapArea` 中增加 `hasActiveDrawerOrModal()` 校验，在换源或设置抽屉处于展开状态时，全面抑制正文翻页与控制栏展开逻辑。
  2. **Docker 容器硬件级硬熔断**：
     - 在 `docker-compose.yml` 中配置 `deploy.resources.limits.memory: 768M`，将包括 JVM 堆外内存与 Edge TTS 微服务在内的整个容器总内存封顶在 768MB，彻底防止极端情况下挤占宿主机资源。

### 2.4 全网智能换源、原生App级左右滑动与 3D 仿真白屏彻底修复
- **智能换源生态全面还原**：
  - 新建 `BookSourceDrawer.vue` 智能换源抽屉，支持快速调取已探知书源（`/reader3/getAvailableBookSource`）与全网 SSE 流式秒级并发测速（`/reader3/searchBookSourceSSE`）；
  - 在阅读页顶部显目位置加入【🔀 换源】入口，支持从当前章节直接对齐切换新源（`/reader3/setBookSource`）；
  - 在书架卡片操作区同步支持【🔀 换源】，换源后即刻自动刷新书架数据。
- **正文排版对齐官方 reader 库设计**：
  - 新建 `ReadSettingsDrawer.vue` 排版偏好抽屉，移植原版 reader 7 款经典护眼底色（米白、羊皮、护眼绿、海蓝、暖粉、素灰、纯黑夜间）；
  - 支持字号微调（12~36px）、字重（400常规/600加粗）、行高（1.2~3.0）、段间距、大屏版心宽度（640/800/960/1200px）调节；
  - 白噪音伴读模块移出常驻底部栏，收纳至排版偏好中供用户自主在后台开关，彻底净化主屏。
- **3D 仿真白屏修复与原生App级触控手势**：
  - 修复仿真翻页容器未声明宽高与底色导致的白屏缺陷，注入 3D 透视（`perspective: 1600px`）与纸张翻折阴影；
  - 增加真·手机阅读 App 手势：
    - 左右轻扫（`|deltaX| > 35px`）平滑切页/切章；
    - 屏幕左侧 30% 点击翻上一页，右侧 30% 翻下一页，中轴 40% 呼出控制栏；
    - 支持横向动态拖拽跟手位移与顺畅回弹。

---

## 3. 架构与核心文件指引
- `web/src/views/Reader.vue`: 现代化阅读核心，包含未入架小说实时抓取解析、加入书架、零白屏状态卡片、3D仿真/滚动翻页、多角色拟人听书、白噪音伴读。
- `web/src/views/Index.vue`: 移动端深度优化书架与找书面板，支持流式搜书卡片一键即时预览与快速入架。
- `web/src/views/Admin.vue`: 控制台后台治理中心，8 线程并发三阶段深度体检与无损书源管理。
- `web/src/components/BookSourceDrawer.vue`: 全网智能测速换源抽屉，毫秒级响应展示与无缝切源。
- `web/src/components/ReadSettingsDrawer.vue`: 经典阅读排版与护眼配色设置中心，收纳白噪音自主开关。
- `src/main/java/com/htmake/reader/api/controller/BookController.kt`: 书籍抓取、章节列表、目录解析与正文获取控制器。
- `src/main/java/com/htmake/reader/api/controller/BookSourceController.kt`: 书源保存、健康检查探针与远程书源获取。
