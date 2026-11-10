<template>
  <div class="firefly-login-container">
    <!-- 顶部操作栏：返回书架 -->
    <div class="top-nav-bar">
      <button
        type="button"
        class="nav-pill-btn"
        @click="goHome"
        title="返回书架"
      >
        <span class="btn-icon">‹</span>
        <span>返回书架</span>
      </button>
    </div>

    <!-- VisionOS 极光悬浮毛玻璃登录卡片 -->
    <div class="login-card" :class="{ 'shake-active': isErrorShake }">
      <!-- 极光流萤发光标题 -->
      <div class="login-title">
        <span class="title-text firefly-glow-title select-none">
          ⚡ Reader
        </span>
        <p class="subtitle-desc">
          {{ isLogin ? "欢迎回来，开启舒适沉浸阅读" : "创建专属账号，实时同步书架与书源" }}
        </p>
      </div>

      <!-- 模式切换：登录 / 注册 -->
      <div class="segmented-control">
        <div
          class="tab-pill"
          :style="{ transform: isLogin ? 'translateX(0)' : 'translateX(100%)' }"
        ></div>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: isLogin }"
          @click="switchMode(true)"
        >
          <span>👤 账号登录</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: !isLogin }"
          @click="switchMode(false)"
        >
          <span>✍️ 用户注册</span>
        </button>
      </div>

      <!-- 表单区域 -->
      <form @submit.prevent="handleSubmit" class="login-form">
        <!-- 账号 -->
        <div class="input-wrapper" :class="{ focused: usernameFocus || loginForm.username }">
          <span class="input-icon">👤</span>
          <input
            type="text"
            v-model="loginForm.username"
            placeholder="请输入账号"
            class="firefly-input"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            required
            @focus="usernameFocus = true"
            @blur="usernameFocus = false"
          />
        </div>

        <!-- 密码 -->
        <div class="input-wrapper" :class="{ focused: passwordFocus || loginForm.password }">
          <span class="input-icon">🔒</span>
          <input
            :type="showPassword ? 'text' : 'password'"
            v-model="loginForm.password"
            placeholder="请输入密码"
            class="firefly-input"
            autocomplete="current-password"
            required
            @focus="passwordFocus = true"
            @blur="passwordFocus = false"
          />
          <button
            type="button"
            class="input-action-btn"
            @click="showPassword = !showPassword"
            :title="showPassword ? '隐藏密码' : '显示密码'"
          >
            <span>{{ showPassword ? '👁️' : '🕶️' }}</span>
          </button>
        </div>

        <!-- 注册邀请码 (注册时展开) -->
        <div
          v-if="!isLogin"
          class="input-wrapper"
          :class="{ focused: codeFocus || loginForm.code }"
        >
          <span class="input-icon">🔑</span>
          <input
            type="text"
            v-model="loginForm.code"
            placeholder="邀请码（未开放自由注册时必填）"
            class="firefly-input"
            autocomplete="off"
            @focus="codeFocus = true"
            @blur="codeFocus = false"
          />
        </div>

        <!-- 记住状态与操作 -->
        <div class="form-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="remember" />
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">保持登录状态</span>
          </label>
          <button
            type="button"
            class="link-ghost-btn"
            @click="clearLocalCache"
            title="清理本地历史凭据"
          >
            <span>🧹 清理凭据</span>
          </button>
        </div>

        <!-- 错误提示 -->
        <div class="error-banner" v-if="errorMsg">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- 提交按钮 -->
        <div class="submit-actions">
          <button type="submit" class="btn-firefly-submit" :disabled="loading">
            <span v-if="loading">⏳ 处理中...</span>
            <span v-else>{{ isLogin ? "立 即 登 录" : "注 册 账 号" }}</span>
          </button>
        </div>
      </form>

      <!-- 底部辅助说明 -->
      <div class="firefly-footer">
        <div class="tip-line">
          初始管理员: <strong class="badge-text">admin</strong> &nbsp;|&nbsp;
          初始密码: <strong class="badge-text">admin</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import request from '../utils/request';
import { ElMessage } from 'element-plus';

const router = useRouter();
const route = useRoute();

const isLogin = ref(true);
const remember = ref(true);
const showPassword = ref(false);
const loading = ref(false);
const errorMsg = ref('');
const isErrorShake = ref(false);

const usernameFocus = ref(false);
const passwordFocus = ref(false);
const codeFocus = ref(false);

const loginForm = ref({
  username: '',
  password: '',
  code: ''
});

function switchMode(loginMode) {
  isLogin.value = loginMode;
  errorMsg.value = '';
}

function triggerShake(msg) {
  errorMsg.value = msg || '登录失败，请检查账号密码';
  isErrorShake.value = true;
  setTimeout(() => {
    isErrorShake.value = false;
  }, 500);
}

function goHome() {
  router.push('/');
}

async function handleSubmit() {
  const username = loginForm.value.username.trim();
  const password = loginForm.value.password.trim();
  if (!username || !password) {
    triggerShake('请完整填写用户名和密码');
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await request.post('/login', {
      username,
      password,
      isLogin: isLogin.value
    });
    if (res && res.data && res.data.isSuccess) {
      const data = res.data.data;
      const token = data?.accessToken || data?.token || `${username}:${data?.token || ''}`;
      if (token) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('userToken', token);
      }
      if (data) {
        localStorage.setItem('userInfo', JSON.stringify(data));
      }
      ElMessage.success(isLogin.value ? '登录成功' : '注册成功');
      const target = (route.query && route.query.redirect) ? String(route.query.redirect) : '/';
      router.push(target);
    } else {
      const msg = res.data?.errorMsg || '操作失败，请重试';
      triggerShake(msg);
    }
  } catch (err) {
    const msg = err.response?.data?.errorMsg || '网络或服务异常，请稍后重试';
    triggerShake(msg);
  } finally {
    loading.value = false;
  }
}

function clearLocalCache() {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    sessionStorage.clear();
    loginForm.value = { username: '', password: '', code: '' };
    ElMessage.info('已清理本地登录凭据缓存');
  } catch (e) {
    // ignore
  }
}
</script>

<style scoped>
/* 整个页面：精致的高透毛玻璃流萤背景 */
.firefly-login-container {
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 70%, #020617 100%);
  background-size: cover;
  position: fixed;
  inset: 0;
  z-index: 2000;
  overflow-y: auto;
}

/* 顶部操作条 */
.top-nav-bar {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 10;
}

.nav-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: rgba(18, 22, 34, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 500;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  cursor: pointer;
  transition: all 0.25s ease;
}

.nav-pill-btn:hover {
  background: rgba(18, 22, 34, 0.85);
  border-color: rgba(99, 242, 201, 0.6);
  color: #34d399;
  transform: translateY(-1px);
}

/* VisionOS 悬浮极光毛玻璃卡片核心样式 */
.login-card {
  margin: 20px;
  width: 100%;
  max-width: 440px;
  border-radius: 28px !important;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  padding: 36px 32px 28px;

  /* 高透磨砂质感 */
  background: rgba(18, 24, 38, 0.68) !important;
  backdrop-filter: blur(36px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(36px) saturate(210%) !important;

  /* 极光微光边框与景深悬浮投影 */
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.65),
    0 0 50px -10px rgba(99, 242, 201, 0.25),
    0 0 35px -8px rgba(251, 191, 36, 0.15),
    inset 0 1.5px 2px rgba(255, 255, 255, 0.45) !important;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

/* 抖动动画 */
.shake-active {
  animation: cardShake 0.45s ease-in-out;
}

@keyframes cardShake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

.login-title {
  text-align: center;
  margin-bottom: 24px;
}

.title-text {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.firefly-glow-title {
  background: linear-gradient(135deg, #ffffff 0%, #34d399 50%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.subtitle-desc {
  margin-top: 8px;
  font-size: 13px;
  color: #94a3b8;
}

/* 模式切换分段控件 */
.segmented-control {
  position: relative;
  display: flex;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 9999px;
  padding: 4px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-pill {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(6, 182, 212, 0.8) 100%);
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn {
  flex: 1;
  position: relative;
  z-index: 1;
  background: transparent;
  border: none;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s ease;
  border-radius: 9999px;
}

.tab-btn.active {
  color: #ffffff;
}

/* 输入框 */
.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 0 14px;
  margin-bottom: 16px;
  transition: all 0.25s ease;
}

.input-wrapper.focused {
  border-color: #34d399;
  background: rgba(15, 23, 42, 0.85);
  box-shadow: 0 0 15px rgba(52, 211, 153, 0.25);
}

.input-icon {
  font-size: 16px;
  margin-right: 10px;
  opacity: 0.8;
}

.firefly-input {
  flex: 1;
  background: transparent;
  border: none;
  height: 44px;
  color: #f8fafc;
  font-size: 14px;
  outline: none;
}

.firefly-input::placeholder {
  color: #64748b;
}

.input-action-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}

/* 选项条 */
.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  font-size: 12px;
  color: #94a3b8;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 6px;
  accent-color: #10b981;
}

.link-ghost-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  transition: color 0.2s;
}

.link-ghost-btn:hover {
  color: #34d399;
}

/* 错误提示 */
.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

/* 提交按钮 */
.btn-firefly-submit {
  width: 100%;
  height: 46px;
  background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
  transition: all 0.25s ease;
}

.btn-firefly-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(16, 185, 129, 0.5);
}

.btn-firefly-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.firefly-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

.badge-text {
  color: #38bdf8;
}
</style>
