import { createRouter, createWebHashHistory } from 'vue-router';
import Index from '../views/Index.vue';
import Reader from '../views/Reader.vue';
import Admin from '../views/Admin.vue';
import Login from '../views/Login.vue';

const routes = [
  { path: '/', name: 'Index', component: Index },
  { path: '/reader', name: 'Reader', component: Reader },
  { path: '/admin', name: 'Admin', component: Admin },
  { path: '/login', name: 'Login', component: Login },
  { path: '/:catchAll(.*)', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 全局路由守卫：严格拦截未登录游客，未登录禁止进入主界面与控制台
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('userToken');
  const isLoginPage = to.path === '/login';

  if (!token && !isLoginPage) {
    // 未登录访问受保护页面，强制重定向到 /login
    next({ path: '/login', query: { redirect: to.fullPath } });
  } else if (token && isLoginPage) {
    // 已登录访问登录页，直接跳转主页
    next('/');
  } else {
    next();
  }
});

export default router;
