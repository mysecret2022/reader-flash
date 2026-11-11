# Reader-Flash 智能体项目说明文档 (Agent Project Guide) - v1.0.8

> 本文档专为后续接手的智能体与开发者编写，详尽记录了 reader-flash v1.0.8 的架构设计、Vue 3 JSX 正文渲染深度修复、第三方书源适配状态、测试运行指引及后续迭代路线图。

---

## 1. 版本概述 (v1.0.8)
- **核心目标**：彻底修复在 Vue 3 + JSX 架构下由于历史 `domPropsInnerHTML` 语法失效导致小说标题正常呈现但正文主要内容渲染为空白的致命缺陷；全面兼容普通阅读与滚动阅读模式下的文本及漫画渲染；并修复音频播放器的事件绑定机制。
- **构建环境**：Java 17+, Gradle 7.x/8.x, Node 22.x, Vite 5.4.
- **Git 目标分支**：`origin/dev`（严禁推向 `main` 分支）。

---

## 2. v1.0.8 发现并彻底修复的缺陷清单

### 2.1 致命渲染缺陷：小说仅显示标题，正文主要内容完全空白
- **问题输入与触发条件**：
  - 进入任何小说的阅读界面（如《天道图书馆》、《饲养全人类》等）。
  - 章节目录和小说标题通过 `<h3>{this.title}</h3>` 成功渲染。
  - 正文数据通过后端接口 `/reader3/getBookContent` 成功获取。
- **实际表现**：
  - 页面上可以看到醒目的章节标题（如“第41章 赌宝”），但下方本应显示正文的区域一片空白，没有任何小说段落文字。
- **根本原因**：
  - 在 Vue 2 JSX 中，`<p style={this.pStyle} domPropsInnerHTML={a} />` 是设置节点内部 HTML 的标准语法（编译为 `domProps: { innerHTML: a }`）。
  - 但在迁移到 Vue 3 + `@vue/babel-plugin-jsx` 之后，编译器将 `domPropsInnerHTML={a}` 作为普通的自定义属性 `dompropsinnerhtml="..."` 传递给 VNode。
  - Vue 3 底层 `runtime-dom` 的 `patchDOMProp` 仅识别标准的 `innerHTML` 和 `textContent`，其他属性全部通过 `setAttribute` 写入 HTML 标签。
  - 最终浏览器生成的 DOM 为：
    ```html
    <p style="..." dompropsinnerhtml="这是小说正文段落文字..." data-pos="12"></p>
    ```
    正文文本被当作属性值塞入，标签内部没有实际文字子节点，导致正文视觉上呈现 100% 彻底空白！
- **修复措施**：
  1. 将 `web/src/components/Content.vue` 中所有单章与滚动章节渲染的 `domPropsInnerHTML={a}` 彻底替换为 Vue 3 标准的 `innerHTML={a}`。
  2. 针对 `this.content` 与 `chapter.content` 增加了 `(this.content || "").split(/\n+/)` 安全非空守卫，杜绝加载过程中的空指针风险。
  3. 修复 `renderAudio()` 中遗留的 Vue 2 模板事件语法 `vOn:*`，重构为标准的 Vue 3 JSX 规范事件监听（如 `onLoadedmetadata`、`onProgress`、`onEnded` 等），并重构带有修饰符的点击事件阻止冒泡和默认行为。

---

## 3. 业务书源层面的“有标题无内容”现象排查总结
- **现象分析**：在实际使用某些特定第三方书源时，也会出现“有标题但没有正文”的现象，其核心机制在于：
  1. **目录接口与正文接口独立运行**：目录（`getChapterList`）仅抓取章节标题和网页链接，速度快且容易成功；正文（`getBookContent`）则是点击章节时按需抓取。
  2. **第三方站点规则失效或反爬**：某些书源的正文抽取规则年久失修（如 JavaScript 脚本解析报错、目标站点反爬拦截、或站点已停服），导致目录能抓到章节标题，但正文返回空或报错。
  3. **未配置书源**：在“换源”时若选用了尚未在用户书源库中建立完整有效规则的源，后端会返回“未配置书源”。
- **使用建议**：遇到此类情况时，通过右侧侧边栏【书源】抽屉点击【一键换源】或手动挑选响应速度正常、章节最新的书源（如“品书小说网8”等）即可畅快阅读。

---

## 4. 构建与测试指引

### 前端开发与构建
```bash
cd web
npm run sync # 编译前端并将产物同步至后端 classpath
```

### 后端打包与验证
```bash
./gradlew assemble -x test
# 打包生成的运行包位于 build/libs/reader-flash-*.jar
```

---

## 5. 后续维护注意事项
1. **JSX 语法规范**：在 Vue 3 JSX 中动态输出 HTML 必须统一使用 `innerHTML={val}`，严禁使用 Vue 2 的 `domPropsInnerHTML`。
2. **只读保护约束**：绝对禁止直接或间接修改只读仓库 `/home/ubuntu/luoxia/project/Gtihub自建仓库/reader` 下的任何文件。
3. **Git 提交**：始终推送到 `origin/dev` 分支。
