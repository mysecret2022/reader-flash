import { createRouter, createWebHashHistory } from 'vue-router';
import Index from '../views/Index.vue';
import Reader from '../views/Reader.vue';
import Admin from '../views/Admin.vue';

const routes = [
  { path: '/', name: 'Index', component: Index },
  { path: '/reader', name: 'Reader', component: Reader },
  { path: '/admin', name: 'Admin', component: Admin },
  { path: '/:catchAll(.*)', redirect: '/' }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
