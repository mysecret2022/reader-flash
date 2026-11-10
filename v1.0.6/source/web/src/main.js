import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus, { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import 'element-plus/dist/index.css';
import './assets/fonts/element-icons.css';
import './assets/fonts/iconfont.css';
import App from './App.vue';
import router from './router';
import store from './plugins/vuex';
import registerElementIcons from './plugins/icons';
import noCover from './assets/imgs/noCover.jpeg';
import noImage from './assets/imgs/noImage.png';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(store);
app.use(router);
app.use(ElementPlus);

// 注册所有 Element 经典字体图标组件，确保在 el-button / el-input 等中渲染出规范的 <i> 标签
registerElementIcons(app);

app.config.globalProperties.$message = ElMessage;
app.config.globalProperties.$msgbox = ElMessageBox;
app.config.globalProperties.$alert = ElMessageBox.alert;
app.config.globalProperties.$confirm = ElMessageBox.confirm;
app.config.globalProperties.$prompt = ElMessageBox.prompt;
app.config.globalProperties.$loading = ElLoading.service;
app.config.globalProperties.$ELEMENT = { zIndex: 2100 };

// Vue 2 响应式补丁：$set 与 $delete
app.config.globalProperties.$set = (target, key, val) => {
  if (target) target[key] = val;
  return val;
};
app.config.globalProperties.$delete = (target, key) => {
  if (target) delete target[key];
};

// 图片懒加载全局事件总线
const lazyloadBus = {
  listeners: new Map(),
  $on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  },
  $off(event, fn) {
    if (!event) {
      this.listeners.clear();
      return;
    }
    const fns = this.listeners.get(event);
    if (!fns) return;
    if (!fn) {
      this.listeners.delete(event);
      return;
    }
    const idx = fns.indexOf(fn);
    if (idx !== -1) fns.splice(idx, 1);
  },
  $emit(event, ...args) {
    const fns = this.listeners.get(event) || [];
    [...fns].forEach(fn => {
      try {
        fn(...args);
      } catch (e) {
        console.error(e);
      }
    });
  }
};
app.config.globalProperties.$Lazyload = lazyloadBus;

// 保存 App.vue 根组件引用以支持 Vue 2 经典的 this.$root.$children[0]
let rootAppInstance = null;

app.mixin({
  beforeCreate() {
    // 1. Vue 2 实例级事件总线补丁：$on, $once, $off 与实例级 $emit
    const listeners = new Map();
    this.$on = (event, fn) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return this;
    };
    this.$once = (event, fn) => {
      const onceFn = (...args) => {
        this.$off(event, onceFn);
        fn.apply(this, args);
      };
      onceFn._fn = fn;
      this.$on(event, onceFn);
      return this;
    };
    this.$off = (event, fn) => {
      if (!event) {
        listeners.clear();
        return this;
      }
      if (!fn) {
        listeners.delete(event);
        return this;
      }
      const fns = listeners.get(event);
      if (fns) {
        const idx = fns.findIndex(f => f === fn || f._fn === fn);
        if (idx !== -1) fns.splice(idx, 1);
      }
      return this;
    };
    if (this.$) {
      const origEmit = this.$.emit;
      this.$.emit = (event, ...args) => {
        const fns = listeners.get(event);
        if (fns) {
          [...fns].forEach(fn => {
            try {
              fn.apply(this, args);
            } catch (e) {
              console.error(e);
            }
          });
        }
        if (origEmit) {
          return origEmit(event, ...args);
        }
      };
    }
  },
  created() {
    // 捕获根组件
    if (this.$options.name === "app" || this.$options._name === "App") {
      rootAppInstance = this;
      if (typeof window !== "undefined") {
        window.__appInstance = this;
      }
    }
    // 2. Vue 2 this.$root.$children[0] 经典调用链路兼容
    if (this.$root && !this.$root.$children) {
      Object.defineProperty(this.$root, "$children", {
        get() {
          return [rootAppInstance || window.__appInstance || this];
        },
        configurable: true
      });
    }
  },
  computed: {
    api() {
      return this.$store.getters.api;
    },
    isWebApp() {
      return window.navigator.standalone;
    },
    isPWA() {
      return ["fullscreen", "standalone", "minimal-ui"].some(
        displayMode =>
          window.matchMedia("(display-mode: " + displayMode + ")").matches
      );
    },
    isNightTheme() {
      return this.$store.getters.isNight;
    },
    currentUserName() {
      return this.$store.getters.currentUserName;
    },
    // 3. 全局弹窗 actualShow 兼容：同时支持 Vue 3 modelValue 与 Vue 2 value / show
    actualShow() {
      if (this.modelValue !== undefined && this.modelValue !== null) {
        return this.modelValue;
      }
      if (this.$attrs && this.$attrs.modelValue !== undefined && this.$attrs.modelValue !== null) {
        return this.$attrs.modelValue;
      }
      if (this.value !== undefined && this.value !== null) {
        return this.value;
      }
      if (this.$attrs && this.$attrs.value !== undefined && this.$attrs.value !== null) {
        return this.$attrs.value;
      }
      return this.show;
    }
  },
  methods: {
    // 4. 全局弹窗可见性派发：同时向 Vue 3 和 Vue 2 模式派发事件
    onDialogVisibilityUpdate(val) {
      this.$emit("update:modelValue", val);
      this.$emit("update:show", val);
      this.$emit("setShow", val);
      this.$emit("input", val);
    },
    getImagePath(url, useSW) {
      if (
        url &&
        (url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("//"))
      ) {
        if (useSW && window.serviceWorkerReady) {
          return url;
        }
        return this.api + "/cover?path=" + url;
      }
      if (!url) return false;
      return this.$store.getters.apiRoot + url;
    },
    getCover(coverUrl, normal, useSW) {
      coverUrl = this.getImagePath(coverUrl, useSW);
      if (coverUrl) {
        return normal
          ? coverUrl
          : {
              src: coverUrl,
              error: noCover,
              loading: noCover
            };
      } else {
        return noCover;
      }
    },
    getImg(imgUrl) {
      imgUrl = this.getImagePath(imgUrl);
      if (imgUrl) {
        return {
          src: imgUrl,
          error: noImage,
          loading: noImage
        };
      } else {
        return noImage;
      }
    }
  }
});

app.directive("lazy", {
  mounted(el, binding) {
    const src = typeof binding.value === "string" ? binding.value : binding.value && binding.value.src;
    if (src) {
      el.src = src;
      el.onload = () => {
        lazyloadBus.$emit("loaded", { el, src });
      };
    }
    if (binding.value && binding.value.error) {
      el.onerror = () => {
        el.src = binding.value.error;
      };
    }
  },
  updated(el, binding) {
    const src = typeof binding.value === "string" ? binding.value : binding.value && binding.value.src;
    if (src && el.src !== src) {
      el.src = src;
      el.onload = () => {
        lazyloadBus.$emit("loaded", { el, src });
      };
    }
  }
});

app.mount('#app');
