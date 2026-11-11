import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const request = axios.create({
  baseURL: '/',
  withCredentials: true,
  timeout: 60000
});

// 全局请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('userToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers['accessToken'] = token;
      config.headers['Authorization'] = `Bearer ${token}`;
      config.params = config.params || {};
      if (!config.params.accessToken) {
        config.params.accessToken = token;
      }
    }
    const secureKey = localStorage.getItem('secureKey');
    if (secureKey) {
      config.headers = config.headers || {};
      config.headers['secureKey'] = secureKey;
      config.params = config.params || {};
      if (!config.params.secureKey) {
        config.params.secureKey = secureKey;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 全局响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res && res.isSuccess === false) {
      if (res.data === 'NEED_LOGIN' || res.errorMsg === '请登录后使用') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        if (router.currentRoute.value.path !== '/login') {
          ElMessage.warning('登录凭据已过期或未登录，请重新登录');
          router.push({
            path: '/login',
            query: { redirect: router.currentRoute.value.fullPath }
          });
        }
      }
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      if (router.currentRoute.value.path !== '/login') {
        ElMessage.warning('登录会话已失效，请重新登录');
        router.push({
          path: '/login',
          query: { redirect: router.currentRoute.value.fullPath }
        });
      }
    }
    return Promise.reject(error);
  }
);

export default request;
