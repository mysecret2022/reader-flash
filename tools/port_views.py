import re
import os

READER_SRC = "/home/ubuntu/luoxia/project/Gtihub自建仓库/reader/web/src"
TARGET_SRC = "/home/ubuntu/luoxia/project/Gtihub自建仓库/reader-flash/web/src"

def convert_slot_by_depth(content, open_pattern, slot_name, tag_name):
    idx = 0
    while True:
        m = re.search(open_pattern, content[idx:])
        if not m:
            break
        pos = idx + m.start()
        open_tag = m.group(0)
        depth = 0
        end_pos = -1
        i = pos
        open_prefix = "<" + tag_name
        close_tag = "</" + tag_name + ">"
        while i < len(content):
            if content.startswith(open_prefix, i) and (content[i + len(open_prefix)] in " >\n\r\t/"):
                depth += 1
                i += len(open_prefix)
            elif content.startswith(close_tag, i):
                depth -= 1
                if depth == 0:
                    end_pos = i + len(close_tag)
                    break
                i += len(close_tag)
            else:
                i += 1
        if end_pos != -1:
            clean_open_tag = re.sub(r"""\s*slot=(['"])[^'"]+\1""", "", open_tag)
            inner = content[pos + len(open_tag):end_pos - len(close_tag)]
            new_block = f"<template #{slot_name}>{clean_open_tag}{inner}{close_tag}</template>"
            content = content[:pos] + new_block + content[end_pos:]
            idx = pos + len(new_block)
        else:
            idx = pos + len(open_tag)
    return content

def fix_slots(content):
    # 1. Dialog title
    content = convert_slot_by_depth(content, r'<div[^>]*slot=["\']title["\'][^>]*>', "title", "div")
    
    # 2. Prefix icon
    content = re.sub(
        r'<i slot="prefix"([^>]*)></i>',
        r'<template #prefix><i\1></i></template>',
        content
    )

    # 3. Dropdown menu
    content = convert_slot_by_depth(content, r'<el-dropdown-menu[^>]*slot=["\']dropdown["\'][^>]*>', "dropdown", "el-dropdown-menu")

    # 4. Reference
    content = convert_slot_by_depth(content, r'<div[^>]*slot=["\']reference["\'][^>]*>', "reference", "div")
    content = convert_slot_by_depth(content, r'<el-button[^>]*slot=["\']reference["\'][^>]*>', "reference", "el-button")
    content = convert_slot_by_depth(content, r'<span[^>]*slot=["\']reference["\'][^>]*>', "reference", "span")

    # 5. Dialog footer
    content = convert_slot_by_depth(content, r'<div[^>]*slot=["\']footer["\'][^>]*>', "footer", "div")
    content = convert_slot_by_depth(content, r'<span[^>]*slot=["\']footer["\'][^>]*>', "footer", "span")

    # 6. Template slots
    content = re.sub(r'<template slot="prepend">', '<template #prepend>', content)
    content = re.sub(r'<template slot="append">', '<template #append>', content)

    return content

def port_component(content):
    # 1. Replace :visible.sync on el-dialog with v-model
    content = content.replace(":visible.sync=", "v-model=")
    content = content.replace(":current-page.sync=", "v-model:current-page=")
    content = content.replace(":page-size.sync=", "v-model:page-size=")
    content = content.replace(".native", "")

    # 2. Table columns: slot-scope="scope" -> #default="scope"
    content = re.sub(r'slot-scope="([^"]+)"', r'#default="\1"', content)

    # 3. Slots
    content = fix_slots(content)

    # 4. Handle prop "show" on el-dialog to prevent "v-model cannot be used on a prop"
    # If props: ["show"] or props contains show, use :model-value="actualShow"
    has_prop_show = re.search(r'props:\s*(?:\[[^\]]*["\']show["\'][^\]]*\]|\{[^}]*show:)', content)
    if has_prop_show:
        if 'actualShow' not in content:
            # Add props ["show", "value", "modelValue"]
            content = re.sub(
                r'props:\s*\[(["\'])show\1',
                r'props: ["show", "value", "modelValue"',
                content
            )
            # Add methods and computed
            method_injection = '''
    onDialogVisibilityUpdate(val) {
      this.$emit("update:modelValue", val);
      this.$emit("update:show", val);
      this.$emit("setShow", val);
      this.$emit("input", val);
    },'''
            content = re.sub(r'methods:\s*\{', 'methods: {' + method_injection, content, count=1)
            
            computed_injection = '''
    actualShow() {
      return (this.modelValue !== undefined && this.modelValue !== null) ? this.modelValue : ((this.value !== undefined && this.value !== null) ? this.value : this.show);
    },'''
            if 'computed:' in content:
                content = re.sub(r'computed:\s*\{', 'computed: {' + computed_injection, content, count=1)
            else:
                content = re.sub(r'data\(\)\s*\{', 'computed: {' + computed_injection + '\n  },\ndata() {', content, count=1)
        content = content.replace(
            'v-model="show"',
            ':model-value="actualShow" @update:model-value="onDialogVisibilityUpdate"'
        )

    # 5. Vue 3 v-model compatibility for other modal components
    if "value: {" in content and "modelValue" not in content:
        content = content.replace("value: {", "value: { default: false }, modelValue: {")
    elif "value: Boolean" in content and "modelValue" not in content:
        content = content.replace("value: Boolean", "value: Boolean, modelValue: Boolean")

    if "return this.value;" in content:
        content = content.replace("return this.value;", "return (this.modelValue !== undefined && this.modelValue !== null) ? this.modelValue : this.value;")
    if 'this.$emit("input", val);' in content:
        content = content.replace('this.$emit("input", val);', 'this.$emit("update:modelValue", val); this.$emit("input", val);')
    if "this.$emit('input', val);" in content:
        content = content.replace("this.$emit('input', val);", "this.$emit('update:modelValue', val); this.$emit('input', val);")

    return content

def port_all_components():
    comp_src_dir = os.path.join(READER_SRC, "components")
    comp_dst_dir = os.path.join(TARGET_SRC, "components")
    
    for f in sorted(os.listdir(comp_src_dir)):
        if f.endswith(".vue"):
            src_file = os.path.join(comp_src_dir, f)
            dst_file = os.path.join(comp_dst_dir, f)
            with open(src_file, "r", encoding="utf-8") as fp:
                c = fp.read()
            c = port_component(c)
            if f in ("Content.vue", "PopCatalog.vue") and "<script lang=\"jsx\">" not in c:
                c = c.replace("<script>", '<script lang="jsx">')
            with open(dst_file, "w", encoding="utf-8") as fp:
                fp.write(c)
            print(f"Ported component: {f}")

def port_axios():
    src_file = os.path.join(READER_SRC, "plugins/axios.js")
    dst_file = os.path.join(TARGET_SRC, "plugins/axios.js")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = c.replace('import { Message, MessageBox } from "element-ui";', 'import { ElMessage as Message, ElMessageBox as MessageBox } from "element-plus";')
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported axios.js")

def port_vuex():
    src_file = os.path.join(READER_SRC, "plugins/vuex.js")
    dst_file = os.path.join(TARGET_SRC, "plugins/vuex.js")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    
    c = c.replace('import Vue from "vue";', '')
    c = c.replace('import Vuex from "vuex";', 'import { createStore } from "vuex";')
    c = c.replace('import { Message } from "element-ui";', 'import { ElMessage as Message } from "element-plus";')
    c = c.replace('Vue.use(Vuex);', '')
    c = c.replace('export default new Vuex.Store({', 'export default createStore({')
    
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported vuex.js")

def port_admin():
    src_file = os.path.join(READER_SRC, "views/Admin.vue")
    dst_file = os.path.join(TARGET_SRC, "views/Admin.vue")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = port_component(c)
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported Admin.vue")

def port_login():
    src_file = os.path.join(READER_SRC, "views/Login.vue")
    dst_file = os.path.join(TARGET_SRC, "views/Login.vue")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = port_component(c)
    
    # Enhance cancel and success to support direct route navigation
    c = c.replace(
        'cancel() {\n      this.$emit("cancel");\n    },',
        'cancel() {\n      this.$emit("cancel");\n      if (this.$route && this.$route.path === "/login") {\n        this.$router.push("/");\n      }\n    },'
    )
    c = c.replace(
        'this.$emit("success", {\n            data: res.data.data,\n            remember: this.remember\n          });',
        'this.$emit("success", {\n            data: res.data.data,\n            remember: this.remember\n          });\n          if (this.$route && this.$route.path === "/login") {\n            this.$router.push("/");\n          }'
    )
    
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported Login.vue")

def port_app():
    src_file = os.path.join(READER_SRC, "App.vue")
    dst_file = os.path.join(TARGET_SRC, "App.vue")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = port_component(c)
    c = c.replace('import ImageViewer from "element-ui/packages/image/src/image-viewer.vue";', 'import { ElImageViewer as ImageViewer } from "element-plus";')
    c = c.replace('import "./assets/fonts/iconfont.css";', 'import "./assets/fonts/element-icons.css";\nimport "./assets/fonts/iconfont.css";')
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported App.vue")

def port_index():
    src_file = os.path.join(READER_SRC, "views/Index.vue")
    dst_file = os.path.join(TARGET_SRC, "views/Index.vue")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = port_component(c)
    
    # Replace CommonJS require and element-ui dom import
    c = c.replace(
        'const buildURL = require("axios/lib/helpers/buildURL");\nimport { isInContainer } from "element-ui/src/utils/dom";',
        '''function buildURL(url, params) {
  if (!params) return url;
  const parts = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== null && typeof val !== "undefined" && val !== "") {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }
  return parts.length ? `${url}?${parts.join("&")}` : url;
}

function isInContainer(el, container) {
  if (!el || !container) return false;
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  return elRect.top < containerRect.bottom && elRect.bottom > containerRect.top && elRect.right > containerRect.left && elRect.left < containerRect.right;
}'''
    )

    if "<script lang=\"jsx\">" not in c:
        c = c.replace("<script>", '<script lang="jsx">')
    
    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported Index.vue")

def port_reader():
    src_file = os.path.join(READER_SRC, "views/Reader.vue")
    dst_file = os.path.join(TARGET_SRC, "views/Reader.vue")
    with open(src_file, "r", encoding="utf-8") as fp:
        c = fp.read()
    c = port_component(c)
    
    # Inject chapter alignment anti-jump algorithms into Reader.vue methods
    alignment_code = '''
    // === 智能中文章节数字解析 ===
    chineseToNumber(chnStr) {
      const chnNumChar = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
      const chnNameValue = {
        '十': { value: 10, secUnit: false },
        '百': { value: 100, secUnit: false },
        '千': { value: 1000, secUnit: false },
        '万': { value: 10000, secUnit: true },
        '亿': { value: 100000000, secUnit: true }
      };
      let total = 0, section = 0, number = 0;
      let str = (chnStr || '').trim();
      if (/^\\d+$/.test(str)) return parseInt(str, 10);
      if (str.startsWith('十')) str = '一' + str;
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const numVal = chnNumChar[char];
        if (typeof numVal !== 'undefined') {
          number = numVal;
          if (i === str.length - 1) section += number;
        } else {
          const unit = chnNameValue[char];
          if (typeof unit !== 'undefined') {
            if (unit.secUnit) {
              section = (section + number) * unit.value;
              total += section;
              section = 0;
            } else {
              section += (number || 1) * unit.value;
            }
            number = 0;
          }
        }
      }
      total += section;
      return total || null;
    },

    // === 提取章节标题核心文本与章节数字 ===
    parseChapterInfo(rawTitle) {
      if (!rawTitle) return { num: null, coreTitle: '' };
      let title = String(rawTitle).trim();
      title = title.replace(/[\\(\\[\\{（【［].*?[\\)\\]\\}）】］]/g, ' ').trim();
      title = title.replace(/^(正文\\s*|VIP卷\\s*|作品相关\\s*|卷[一二三四五六七八九十0-9]+\\s*)/, '').trim();

      let num = null;
      const matchZhang = title.match(/第\\s*([0-9零一二两三四五六七八九十百千万]+)\\s*[章回节集话]/);
      if (matchZhang) {
        const rawNum = matchZhang[1];
        num = /^\\d+$/.test(rawNum) ? parseInt(rawNum, 10) : this.chineseToNumber(rawNum);
      } else {
        const matchLeading = title.match(/^([0-9]{1,5})\\s*[\\.、\\s:-]/);
        if (matchLeading) num = parseInt(matchLeading[1], 10);
      }

      let core = title.replace(/第\\s*[0-9零一二两三四五六七八九十百千万]+\\s*[章回节集话]/g, '');
      core = core.replace(/^[0-9]{1,5}\\s*[\\.、\\s:-]/, '');
      core = core.replace(/[：:\\s\\-_,，。·]/g, '').trim();

      return { num, coreTitle: core };
    },

    // === 智能章节对齐算法：优先双重匹配 -> 核心名称对齐 -> 章节号对齐 -> 原位兜底 ===
    findBestMatchedChapterIndex(oldIndex, oldTitle, newChapterList) {
      if (!newChapterList || newChapterList.length === 0) return 0;
      if (!oldTitle && (oldIndex === null || oldIndex === undefined || oldIndex < 0)) return 0;

      const oldInfo = this.parseChapterInfo(oldTitle);
      const parsedNewList = newChapterList.map((c, idx) => ({
        index: idx,
        title: c.title || '',
        ...this.parseChapterInfo(c.title || '')
      }));

      // 1. 双重匹配：章节编号与核心标题双重一致（置信度 100%）
      if (oldInfo.num !== null && oldInfo.coreTitle && oldInfo.coreTitle.length >= 2) {
        const found = parsedNewList.find(c => c.num === oldInfo.num && (c.coreTitle.includes(oldInfo.coreTitle) || oldInfo.coreTitle.includes(c.coreTitle)));
        if (found) return found.index;
      }

      // 2. 核心标题完全相同（优先寻找离旧索引最近的章节）
      if (oldInfo.coreTitle && oldInfo.coreTitle.length >= 2) {
        const exactCoreMatches = parsedNewList.filter(c => c.coreTitle === oldInfo.coreTitle);
        if (exactCoreMatches.length > 0) {
          exactCoreMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
          return exactCoreMatches[0].index;
        }
        const subCoreMatches = parsedNewList.filter(c => c.coreTitle && (c.coreTitle.includes(oldInfo.coreTitle) || oldInfo.coreTitle.includes(c.coreTitle)));
        if (subCoreMatches.length > 0) {
          subCoreMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
          return subCoreMatches[0].index;
        }
      }

      // 3. 章节编号匹配（如第10章对齐第十章）
      if (oldInfo.num !== null) {
        const numMatches = parsedNewList.filter(c => c.num === oldInfo.num);
        if (numMatches.length > 0) {
          numMatches.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex));
          return numMatches[0].index;
        }
      }

      // 4. 原位安全兜底：保持与旧章节索引一致，防止跌落至第一章
      return Math.max(0, Math.min(oldIndex >= 0 ? oldIndex : 0, newChapterList.length - 1));
    },
'''
    # Inject before changeBookSource()
    target_str = 'changeBookSource() {'
    replacement = alignment_code + '\n    changeBookSource() {\n      const oldIndex = (this.$store.getters.readingBook && this.$store.getters.readingBook.index) || 0;\n      const oldTitle = this.title || "";\n      this._oldSourceState = { oldIndex, oldTitle };\n'
    c = c.replace(target_str, replacement)
    
    # Inside loadCatalog: align index after catalog loaded
    old_catalog_logic = '''var index = book.index || 0;
            this.getContent(index);'''
    new_catalog_logic = '''var index = book.index || 0;
            if (this._oldSourceState && book.catalog && book.catalog.length > 0) {
              index = this.findBestMatchedChapterIndex(this._oldSourceState.oldIndex, this._oldSourceState.oldTitle, book.catalog);
              book.index = index;
              this.$store.commit("setReadingBook", book);
              this._oldSourceState = null;
            }
            this.getContent(index);'''
    c = c.replace(old_catalog_logic, new_catalog_logic)

    with open(dst_file, "w", encoding="utf-8") as fp:
        fp.write(c)
    print("Ported Reader.vue with chapter alignment anti-jump logic!")

if __name__ == "__main__":
    port_all_components()
    port_axios()
    port_vuex()
    port_admin()
    port_login()
    port_app()
    port_index()
    port_reader()
    print("All views and components ported successfully!")
