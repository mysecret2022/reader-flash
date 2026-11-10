import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus, { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import 'element-plus/dist/index.css';
import './assets/fonts/element-icons.css';
import './assets/fonts/iconfont.css';
import App from './App.vue';
import router from './router';
import store from './plugins/vuex';
import noCover from './assets/imgs/noCover.jpeg';
import noImage from './assets/imgs/noImage.png';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(store);
app.use(router);
app.use(ElementPlus);

app.config.globalProperties.$message = ElMessage;
app.config.globalProperties.$msgbox = ElMessageBox;
app.config.globalProperties.$alert = ElMessageBox.alert;
app.config.globalProperties.$confirm = ElMessageBox.confirm;
app.config.globalProperties.$prompt = ElMessageBox.prompt;
app.config.globalProperties.$loading = ElLoading.service;
app.config.globalProperties.$ELEMENT = { zIndex: 2100 };

app.mixin({
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
    }
  },
  methods: {
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
    if (src) el.src = src;
    if (binding.value && binding.value.error) {
      el.onerror = () => { el.src = binding.value.error; };
    }
  },
  updated(el, binding) {
    const src = typeof binding.value === "string" ? binding.value : binding.value && binding.value.src;
    if (src && el.src !== src) {
      el.src = src;
    }
  }
});

app.mount('#app');
