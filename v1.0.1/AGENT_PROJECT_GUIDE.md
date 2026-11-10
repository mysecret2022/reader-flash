# reader-flash v1.0.1 智能体自说明与维护指南 (Agent Project Guide)

## 1. 版本概述与设计目标
- **版本号**：`v1.0.1`（开发分支 `dev` 维护版）
- **项目定位**：作为 `reader` 全新代际演进版本，重构现代化技术栈（Vite 5 + Vue 3.4 + Pinia + Element Plus），保留并增强经典阅读内核与全套管理治理体系。
- **发布策略**：日常开发、需求微调与测试统一提交至 `dev` 分支；正式发布版（`main` 及正式镜像）仅在用户明确指令时合并发布。

---

## 2. 本版本核心功能修复与新增 (Changelog & Bug Fixes)

### 2.1 书源导入全能化 —— 新增本地文件拖拽导入 (Feature)
- **背景与需求**：原书源导入仅支持网络远程链接，用户本地有备份书源（`.json` / `.txt`）无法直接选择上传。
- **解决方案**：
  - 改造管理后台（`Admin.vue`）导入弹窗为 3 种交互模式：
    1. **📁 本地文件导入 (Local File)**：集成拖拽区与原生文件选择器，利用浏览器 `FileReader` 纯客户端零延迟读取解析，自动识别单条书源对象与书源数组，即时显示识别出的书源总数并提供一键导入；
    2. **🌐 网络远程链接 (Remote URL)**：支持一键输入远程书源 URL，具备前端跨域检测与后端代理拉取（`/reader3/readRemoteSourceFile`）双层兜底；
    3. **📝 文本/JSON 直接粘贴 (Raw JSON)**：支持直接粘贴复制的书源数据并实时校验导入。
  - 数据统一通过 `/reader3/saveBookSources` 批量沉淀到服务端。

### 2.2 管理员添加用户报错修复与权限闭环 (Bug Fix)
- **报错根因**：
  - 前端 `confirmAddUser` 原调用了不存在的 `/reader3/saveUser`，触发 404 导致创建失败报错。
  - 重置密码与删除用户路由未对齐后端规范（原分别调用了不存在的 `saveUser` 和 `deleteUser`）。
- **解决方案与对齐**：
  - **添加用户**：对齐后端 `/reader3/addUser` 接口，入参包含 `username`, `password`, `isAdmin`, `enableWebdav`, `enableLocalStore`，并在前端预检（用户名至少 3 位字母数字，密码至少 4 位），对接后端的校验错误信息（如用户名已存在、超出限额等）。
  - **重置密码**：对齐后端 `/reader3/resetPassword` 接口，传递 `{ username, password }`。
  - **删除用户**：对齐后端 `/reader3/deleteUsers` 接口，传递用户名数组 `[ username ]`。
  - **权限即时调整**：支持在用户列表直接切换 `WebDAV 备份` 与 `离线存储` 开关，调用 `/reader3/updateUser` 实时生效。

---

## 3. 架构与核心文件指引
- `web/src/views/Admin.vue`: 管理后台单文件组件（包含系统概览、书源治理、净化替换、书籍管理、多用户管理、WebDAV备份、日志控制台）。
- `web/src/views/Login.vue`: 专属 VisionOS 磨砂毛玻璃登录/注册页。
- `web/src/views/Reader.vue`: 出版级阅读器（5 大经典纸张背景，实体暗调磨砂菜单条，仿生翻页）。
- `web/src/views/Index.vue`: 现代书架主页。
- `src/main/java/com/htmake/reader/api/controller/UserController.kt`: 用户管理控制器（`addUser`, `resetPassword`, `deleteUsers`, `updateUser`）。
- `src/main/java/com/htmake/reader/api/controller/BookSourceController.kt`: 书源控制器（`saveBookSources`, `readRemoteSourceFile`, `readSourceFile`）。

---

## 4. 构建与同步指南
```bash
# 1. 编译前端并自动同步静态资源到后端
cd web && npm run sync

# 2. 本地测试运行（如需启动测试）
./build.sh run
```
