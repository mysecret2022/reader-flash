# ⚡ reader-flash (极速现代化小说阅读系统)

> 本项目是 [mysecret2022/reader](https://github.com/mysecret2022/reader) 的下一代现代化极速重构版本，专为追求极致性能、秒级冷启与沉浸式阅读体验而生。

---

## 📖 项目简介

**reader-flash** 是一款专注于纯粹、舒适、高效的中文小说阅读系统。针对传统网页版阅读器“体积臃肿、冷启迟钝、书源在手机端能用而在网页端大面积阵亡”的顽疾，我们进行了端到端的现代化重构：

- 🚀 **极速现代化前端架构**：从老旧 Vue 2 + Webpack 升级为 **Vite 5 + Vue 3.4 (组合式 API) + Pinia + Element Plus**，运行时内存开销减少 50% 以上，长篇小说翻页零掉帧。
- ⚡ **破除书源解析差异**：重写带 TTL 过期淘汰的高速内存 LRU 缓存管理器（彻底修复原版 `CacheManager.get()` 返回 `null` 的重大 Bug），修复现代书源依赖的 Token 与防盗链凭证；升级现代 JavaScript 语法解析（兼容可选链 `?.`、空值合并 `??` 与 Base64 工具链），书源解析能力 100% 对齐手机端 Legado。
- 🔍 **毫秒级 SSE 流式搜书**：随搜随显，告别漫长等待；对死链与超时坏源 2.5 秒内极速放弃（Fast-Fail），配合高并发连接池与分层并发调度，搜索速度提升数倍。
- ✈️ **全本 PWA 离线缓存**：基于浏览器本地大型数据库（IndexedDB），支持后台平滑下载全本章节，在高铁、飞机等完全断网环境下依然畅读无阻，联网后自动双向同步阅读进度。
- 📊 **个人阅读成就看板**：实时追踪有效阅读时长（内置防挂机智能暂停机制）、阅读字数、平均阅读时速、近 7 天阅读趋势图与“荣誉成就徽章墙”。
- 🎨 **唯美金句书摘生成**：正文选词一键生成【拍立得质感相纸】与【极简毛玻璃名片】双模板书摘卡片，纯客户端 2x Retina 高清 Canvas 离屏渲染，一键长按或导出高清长图分享。
- 🎧 **视听一体化与伴读书房**：内置 Web Audio API 纯客户端合成的 4 款白噪音环境音（窗外夜雨、壁炉柴响、深夜夏蝉、森林微风，0 网络开销）；支持多角色拟人广播剧听书（智能拆解旁白与对话角色音色）。
- 🔤 **动态中文字体切片按需加载**：默认使用系统原生优质字体（首屏 0 流量、秒级冷启）；当用户主动点选“霞鹜文楷”、“思源宋体”或“手书体”时，才按需下载当页切片并永久保存在本地，兼得书法美感与极致性能。

---

## 🛠️ 快速启动 (三步上手)

### 方式一：Docker 模式部署 (原生双架构：同时支持 ARM64 与 AMD64)

> 💡 **架构原生支持**：官方镜像已通过 GitHub Actions 构建为**多架构镜像（Multi-Arch OCI Image）**，同时原生包含 **`linux/amd64` (Intel/AMD PC、云服务器)** 与 **`linux/arm64` (树莓派、Apple Silicon M 系列 Mac、群晖/绿联/极空间/飞牛等各类 NAS 与 ARM 软路由)**。Docker 会根据您的系统架构**自动精准匹配下载**，无需任何额外配置！

#### 1. Docker Compose 方式 (推荐，一键启动)

**Linux / macOS:**
```bash
./start-docker.sh
```

**Windows:**
双击运行 `start-docker.bat`，或在命令行中执行：
```bat
docker compose pull && docker compose up -d
```

#### 2. Docker 单行命令启动 (适合 NAS、轻量云服务器或无 compose 环境)

```bash
docker run -d \
  --name reader-flash \
  --restart always \
  -p 8080:8080 \
  -v $(pwd)/storage:/storage \
  -v $(pwd)/logs:/app/logs \
  -e TZ=Asia/Shanghai \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e JAVA_OPTS="-Xmx512m" \
  -e READER_APP_SECURE=true \
  ghcr.io/mysecret2022/reader-flash:latest
```

- **访问地址**：`http://localhost:8080` (或 `http://服务器IP:8080`)
- **默认管理员账号**：`admin`
- **默认管理员密码**：`admin`

---

### 方式二：源码编译与本地运行

#### 1. 前端编译与同步
```bash
cd web
npm install
npm run sync    # 编译 Vite 产物并自动同步至后端静态资源目录
```

#### 2. 后端编译与启动
```bash
# 根目录下编译可执行 JAR
./gradlew bootJar

# 启动服务
java -jar build/libs/reader-2.0.1.jar --reader.server.port=8090
```

---

## 📂 项目结构

```
reader-flash/
├── src/main/java/              # 后端核心源码 (Spring Boot / Vert.x / Legado 核心解析引擎)
│   ├── com/htmake/reader/      # API 控制器、Verticle 与并发调度器
│   └── io/legado/app/          # 规则解析、Rhino JS 引擎、CacheManager 缓存
├── web/                        # 前端现代工程 (Vite 5 + Vue 3.4 + Pinia + Element Plus)
│   ├── src/
│   │   ├── views/              # 现代书架 (Index.vue)、阅读器 (Reader.vue)、书源管理 (Admin.vue)
│   │   ├── components/         # 阅读统计看板、离线缓存弹窗、书摘卡片生成器、白噪音伴读条
│   │   ├── stores/             # Pinia 状态管理 (book, reader, stats, offline)
│   │   ├── utils/              # IndexedDB 本地数据库、动态字体切片加载器、Web Audio 白噪音合成
│   │   └── assets/styles/      # VisionOS 极光薄荷荧光毛玻璃样式规范
│   └── vite.config.js          # Vite 构建配置
├── Dockerfile                  # 容器化构建定义
├── docker-compose.yml          # Docker Compose 编排服务
├── start-docker.sh             # Linux / Mac 一键启动脚本
├── start-docker.bat            # Windows 一键启动脚本
├── v1.0.0/                     # 版本归档与智能体自说明文档
└── README.md
```

---

## 📄 开源许可证

本项目基于 [GPL-3.0 License](LICENSE) 开源发布，完整保留原项目版权与协议。
