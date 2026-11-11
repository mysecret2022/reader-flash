import { createRouter, createWebHashHistory } from 'vue-router';
import Index from '../views/Index.vue';
import Reader from '../views/Reader.vue';
import Admin from '../views/Admin.vue';
import Login from '../views/Login.vue';

const routes = [
  { path: '/', name: 'index', component: Index },
  { path: '/reader', name: 'Reader', component: Reader },
  { path: '/admin', name: 'Admin', component: Admin },
  { path: '/login', name: 'Login', component: Login },
  { path: '/:username', name: 'UserSpace', component: Admin },
  { path: '/:catchAll(.*)', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
