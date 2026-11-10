<template>
  <div class="admin-container" :class="isDark ? 'theme-dark' : 'theme-light'">
    <!-- 顶部导航栏 (Reader 官方风格) -->
    <header class="admin-header glass-panel">
      <div class="header-left">
        <div class="brand-logo" @click="$router.push('/')">
          <span class="brand-icon">⚡</span>
          <span class="brand-title">Reader</span>
          <span class="brand-badge">控制台 v2.0 极速版</span>
        </div>
      </div>
      <div class="header-right">
        <el-tag size="small" type="danger" effect="dark" class="user-badge">
          👑 系统管理员
        </el-tag>
        <el-button
          size="small"
          circle
          @click="toggleTheme"
          :title="isDark ? '切换亮色' : '切换深色'"
        >
          {{ isDark ? '☀️' : '🌙' }}
        </el-button>
        <el-button
          type="primary"
          size="small"
          class="glow-btn"
          @click="$router.push('/')"
        >
          ‹ 返回书架
        </el-button>
      </div>
    </header>

    <!-- 主体区域：侧边菜单 + 内容视窗 -->
    <div class="admin-body">
      <aside class="admin-sidebar glass-panel">
        <div class="sidebar-nav-list">
          <div
            v-for="item in navItems"
            :key="item.key"
            class="sidebar-nav-item"
            :class="{ active: activeTab === item.key }"
            @click="activeTab = item.key"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-title">{{ item.title }}</span>
          </div>
        </div>
      </aside>

      <main class="admin-main glass-card">
        <!-- 1. 系统概览与配置管理 -->
        <section v-if="activeTab === 'overview'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">系统状态总览与核心配置</h2>
            <el-button size="small" @click="fetchSystemStats">🔄 刷新数据</el-button>
          </div>

          <!-- 4 个核心指标卡片 -->
          <div class="stat-cards">
            <div class="stat-card glass-card">
              <div class="stat-icon bg-blue">👥</div>
              <div class="stat-info">
                <div class="stat-value">{{ userList.length }} <span class="stat-unit">/ {{ systemConfig.userLimit || 10 }} 人</span></div>
                <div class="stat-label">注册用户配额</div>
              </div>
            </div>

            <div class="stat-card glass-card">
              <div class="stat-icon bg-green">📚</div>
              <div class="stat-info">
                <div class="stat-value">{{ sources.length }} <span class="stat-unit">源</span></div>
                <div class="stat-label">可用书源总数 (启用: {{ enabledSourcesCount }})</div>
              </div>
            </div>

            <div class="stat-card glass-card">
              <div class="stat-icon bg-purple">📖</div>
              <div class="stat-info">
                <div class="stat-value">{{ bookshelfList.length }} <span class="stat-unit">本</span></div>
                <div class="stat-label">当前书架书籍</div>
              </div>
            </div>

            <div class="stat-card glass-card">
              <div class="stat-icon bg-amber">⚡</div>
              <div class="stat-info">
                <div class="stat-value">LRU 极速</div>
                <div class="stat-label">TTL 协程防盗链缓存</div>
              </div>
            </div>
          </div>

          <!-- 快速配置表单 -->
          <div class="config-section glass-card" style="margin-top: 20px;">
            <h3 class="section-title">⚙️ 系统多用户鉴权设置</h3>
            <el-form label-width="140px" style="max-width: 600px; margin-top: 15px;">
              <el-form-item label="多用户鉴权模式">
                <el-switch v-model="systemConfig.needLogin" />
                <span class="form-tip">开启后必须登录才可使用阅读与书架</span>
              </el-form-item>
              <el-form-item label="开放自由注册">
                <el-switch v-model="systemConfig.openRegister" />
                <span class="form-tip">关闭后仅管理员可手动添加新账号</span>
              </el-form-item>
              <el-form-item label="注册专属邀请码">
                <el-input v-model="systemConfig.inviteCode" placeholder="留空则免邀请码注册" clearable />
              </el-form-item>
              <el-form-item label="系统用户数上限">
                <el-input-number v-model="systemConfig.userLimit" :min="1" :max="500" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" class="glow-btn" :loading="savingConfig" @click="saveSystemConfig">
                  💾 保存系统配置
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </section>

        <!-- 2. 书源治理与导入 -->
        <section v-if="activeTab === 'sources'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">书源管理与规则体检</h2>
            <div class="header-actions">
              <el-button type="primary" size="small" class="glow-btn" @click="showImportDialog = true">
                ➕ 导入书源
              </el-button>
            </div>
          </div>

          <!-- 工具栏 -->
          <div class="toolbar glass-card">
            <el-input
              v-model="sourceKeyword"
              placeholder="搜索书源名称或域名..."
              clearable
              size="small"
              style="max-width: 260px;"
            />
            <div class="toolbar-actions">
              <el-button size="small" type="success" plain @click="testSourcesHealth">
                🩺 一键体检
              </el-button>
              <el-button size="small" type="warning" plain @click="toggleAllSources(true)">
                ✅ 全部启用
              </el-button>
              <el-button size="small" type="info" plain @click="toggleAllSources(false)">
                ⏸️ 全部停用
              </el-button>
              <el-button size="small" type="danger" plain @click="deleteDisabledSources">
                🗑️ 清理已失效源
              </el-button>
            </div>
          </div>

          <el-table :data="filteredSources" v-loading="loadingSources" style="width: 100%;" max-height="600">
            <el-table-column prop="bookSourceName" label="书源名称" min-width="180">
              <template #default="{ row }">
                <span class="source-name">{{ row.bookSourceName }}</span>
                <span v-if="row.bookSourceGroup" class="source-group-tag">{{ row.bookSourceGroup }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="bookSourceUrl" label="书源地址" min-width="220" show-overflow-tooltip />
            <el-table-column label="健康度" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.health === 'good' ? 'success' : row.health === 'dead' ? 'danger' : 'info'">
                  {{ row.health === 'good' ? '🟢 优质' : row.health === 'dead' ? '🔴 失效' : '⚪ 未测' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="90">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" active-color="#10b981" @change="saveSource(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="text" size="small" style="color: #ef4444;" @click="deleteSingleSource(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 3. 净化替换规则 -->
        <section v-if="activeTab === 'replaceRules'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">净化替换规则管理</h2>
            <el-button type="primary" size="small" class="glow-btn" @click="openAddRuleDialog">
              ➕ 新建替换规则
            </el-button>
          </div>

          <el-table :data="replaceRules" v-loading="loadingRules" style="width: 100%;" max-height="600">
            <el-table-column prop="name" label="规则名称" min-width="160" />
            <el-table-column prop="pattern" label="匹配正则 / 文本" min-width="200" show-overflow-tooltip />
            <el-table-column prop="replacement" label="替换为" min-width="140" show-overflow-tooltip />
            <el-table-column prop="scope" label="作用范围" min-width="120">
              <template #default="{ row }">
                <span>{{ row.scope || '全局通用' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="90">
              <template #default="{ row }">
                <el-switch v-model="row.isEnabled" active-color="#10b981" @change="saveRule(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button type="text" size="small" @click="editRule(row)">编辑</el-button>
                <el-button type="text" size="small" style="color: #ef4444;" @click="deleteRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 4. 书架与书籍管理 -->
        <section v-if="activeTab === 'bookshelf'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">书架书籍全量管理</h2>
            <el-button size="small" @click="fetchBookshelf">🔄 刷新书架</el-button>
          </div>

          <el-table :data="bookshelfList" v-loading="loadingShelf" style="width: 100%;" max-height="600">
            <el-table-column label="封面" width="70">
              <template #default="{ row }">
                <img :src="row.cover || '/assets/noCover-DZ6FWqFV.jpeg'" style="width: 40px; height: 52px; object-fit: cover; border-radius: 4px;" />
              </template>
            </el-table-column>
            <el-table-column prop="name" label="书名" min-width="180" />
            <el-table-column prop="author" label="作者" min-width="120" />
            <el-table-column prop="durChapterTitle" label="当前阅读章节" min-width="200" show-overflow-tooltip />
            <el-table-column prop="originName" label="当前绑定书源" min-width="140" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="text" size="small" style="color: #ef4444;" @click="removeBook(row)">移出书架</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 5. 用户管理与配额 -->
        <section v-if="activeTab === 'users'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">多用户配额与账号管理</h2>
            <el-button type="primary" size="small" class="glow-btn" @click="showAddUserDialog = true">
              ➕ 添加新用户
            </el-button>
          </div>

          <el-table :data="userList" v-loading="loadingUsers" style="width: 100%;">
            <el-table-column prop="username" label="用户名" min-width="140" />
            <el-table-column label="角色身份" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">
                  {{ row.role === 'admin' ? '👑 超级管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" type="success">正常活跃</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button type="text" size="small" @click="resetUserPassword(row)">重置密码</el-button>
                <el-button v-if="row.username !== 'admin'" type="text" size="small" style="color: #ef4444;" @click="deleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 6. 云端备份与 WebDAV -->
        <section v-if="activeTab === 'webdav'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">WebDAV 云端双向备份</h2>
          </div>

          <div class="glass-card" style="max-width: 600px; padding: 20px;">
            <el-form label-width="130px">
              <el-form-item label="WebDAV 服务器">
                <el-input v-model="webdavConfig.url" placeholder="如 https://dav.jianguoyun.com/dav/reader/" clearable />
              </el-form-item>
              <el-form-item label="WebDAV 账号">
                <el-input v-model="webdavConfig.username" placeholder="WebDAV 登录账号" clearable />
              </el-form-item>
              <el-form-item label="WebDAV 授权密码">
                <el-input v-model="webdavConfig.password" type="password" show-password placeholder="应用密码" clearable />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" class="glow-btn" @click="saveWebDAV">💾 保存配置</el-button>
                <el-button type="success" plain @click="backupToWebDAV">☁️ 立即全量备份</el-button>
              </el-form-item>
            </el-form>
          </div>
        </section>

        <!-- 7. 运行日志与诊断 -->
        <section v-if="activeTab === 'logs'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">系统诊断与实时运行日志</h2>
            <div class="header-actions">
              <el-button size="small" @click="fetchLogs">🔄 刷新日志</el-button>
            </div>
          </div>

          <div class="log-terminal glass-card">
            <pre class="log-content">{{ logsText || '暂无最近日志输出或日志目录为空...' }}</pre>
          </div>
        </section>
      </main>
    </div>

    <!-- 弹窗 1：导入书源 -->
    <el-dialog v-model="showImportDialog" title="➕ 导入新书源" width="90%" max-width="500px" append-to-body>
      <div class="import-dialog-body">
        <el-input v-model="importSourceUrl" placeholder="输入网络书源 URL (如 https://.../sources.json)" clearable />
        <div style="margin-top: 15px;">
          <el-button type="primary" class="glow-btn" style="width: 100%;" :loading="importingSource" @click="confirmImportSource">
            🚀 确认一键导入
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 弹窗 2：新建/编辑替换规则 -->
    <el-dialog v-model="showRuleDialog" :title="editingRule.id ? '编辑替换规则' : '➕ 新建替换规则'" width="90%" max-width="500px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="规则名称">
          <el-input v-model="editingRule.name" placeholder="如 去除水印网址" />
        </el-form-item>
        <el-form-item label="匹配内容">
          <el-input v-model="editingRule.pattern" type="textarea" :rows="2" placeholder="正则表达式或被替换关键词" />
        </el-form-item>
        <el-form-item label="替换为">
          <el-input v-model="editingRule.replacement" placeholder="留空则直接删除匹配内容" />
        </el-form-item>
        <el-form-item label="作用范围">
          <el-input v-model="editingRule.scope" placeholder="留空为全局通用，也可填书名或书源URL" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="editingRule.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">取消</el-button>
        <el-button type="primary" class="glow-btn" @click="confirmSaveRule">保存规则</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 3：添加新用户 -->
    <el-dialog v-model="showAddUserDialog" title="➕ 添加新用户" width="90%" max-width="450px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="newUserData.username" placeholder="账号名称" />
        </el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="newUserData.password" type="password" placeholder="设置初始密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false">取消</el-button>
        <el-button type="primary" class="glow-btn" @click="confirmAddUser">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const isDark = ref(true);
const activeTab = ref('overview');

const navItems = [
  { key: 'overview', title: '系统概览', icon: '📊' },
  { key: 'sources', title: '书源管理', icon: '📚' },
  { key: 'replaceRules', title: '净化替换', icon: '🧹' },
  { key: 'bookshelf', title: '书籍管理', icon: '📖' },
  { key: 'users', title: '用户配额', icon: '👥' },
  { key: 'webdav', title: '云端备份', icon: '☁️' },
  { key: 'logs', title: '运行日志', icon: '📋' }
];

// 数据状态
const userList = ref([]);
const sources = ref([]);
const bookshelfList = ref([]);
const replaceRules = ref([]);
const systemConfig = ref({
  needLogin: true,
  openRegister: true,
  inviteCode: '',
  userLimit: 10
});
const webdavConfig = ref({
  url: '',
  username: '',
  password: ''
});
const logsText = ref('');

// 交互状态
const sourceKeyword = ref('');
const loadingSources = ref(false);
const loadingRules = ref(false);
const loadingShelf = ref(false);
const loadingUsers = ref(false);
const savingConfig = ref(false);

const showImportDialog = ref(false);
const importSourceUrl = ref('');
const importingSource = ref(false);

const showRuleDialog = ref(false);
const editingRule = ref({});

const showAddUserDialog = ref(false);
const newUserData = ref({ username: '', password: '' });

// 计算属性
const enabledSourcesCount = computed(() => sources.value.filter(s => s.enabled).length);

const filteredSources = computed(() => {
  if (!sourceKeyword.value.trim()) return sources.value;
  const kw = sourceKeyword.value.trim().toLowerCase();
  return sources.value.filter(s =>
    (s.bookSourceName && s.bookSourceName.toLowerCase().includes(kw)) ||
    (s.bookSourceUrl && s.bookSourceUrl.toLowerCase().includes(kw))
  );
});

// 主题切换
function toggleTheme() {
  isDark.value = !isDark.value;
}

// 1. 获取概览数据
async function fetchSystemStats() {
  await Promise.all([
    fetchSources(),
    fetchBookshelf(),
    fetchUsers(),
    fetchSystemConfig()
  ]);
}

async function fetchSystemConfig() {
  try {
    const res = await axios.get('/reader3/getSystemConfig');
    if (res.data && res.data.isSuccess && res.data.data) {
      systemConfig.value = { ...systemConfig.value, ...res.data.data };
    }
  } catch (e) {
    // ignore
  }
}

async function saveSystemConfig() {
  savingConfig.value = true;
  try {
    await axios.post('/reader3/saveSystemConfig', systemConfig.value);
    ElMessage.success('系统配置已持久化保存');
  } catch (e) {
    ElMessage.error('保存配置失败');
  } finally {
    savingConfig.value = false;
  }
}

// 2. 书源操作
async function fetchSources() {
  loadingSources.value = true;
  try {
    const res = await axios.get('/reader3/getBookSources');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      sources.value = res.data.data.map(s => ({
        ...s,
        health: 'normal'
      }));
    }
  } catch (e) {
    console.error(e);
  } finally {
    loadingSources.value = false;
  }
}

async function saveSource(row) {
  try {
    await axios.post('/reader3/saveBookSource', row);
    ElMessage.success('书源状态已更新');
  } catch (e) {
    ElMessage.error('更新失败');
  }
}

async function confirmImportSource() {
  if (!importSourceUrl.value.trim()) {
    ElMessage.warning('请输入有效的书源链接');
    return;
  }
  importingSource.value = true;
  try {
    const res = await axios.post('/reader3/saveBookSourcesByUrl', { url: importSourceUrl.value.trim() });
    if (res.data && res.data.isSuccess) {
      ElMessage.success('书源导入成功');
      showImportDialog.value = false;
      importSourceUrl.value = '';
      fetchSources();
    } else {
      ElMessage.error(res.data?.errorMsg || '导入书源失败');
    }
  } catch (e) {
    ElMessage.error('网络请求异常，请检查书源链接');
  } finally {
    importingSource.value = false;
  }
}

async function testSourcesHealth() {
  ElMessage.info('开始一键体检前 15 个书源...');
  for (let i = 0; i < Math.min(15, sources.value.length); i++) {
    const s = sources.value[i];
    try {
      const start = Date.now();
      await axios.get('/reader3/searchBook', { params: { key: '剑来', bookSourceUrl: s.bookSourceUrl } });
      s.health = (Date.now() - start < 3000) ? 'good' : 'slow';
    } catch (e) {
      s.health = 'dead';
    }
  }
  ElMessage.success('体检完成！');
}

async function toggleAllSources(enable) {
  sources.value.forEach(s => s.enabled = enable);
  try {
    await axios.post('/reader3/saveBookSources', sources.value);
    ElMessage.success(enable ? '已全部启用' : '已全部停用');
  } catch (e) {
    ElMessage.error('批量更新失败');
  }
}

async function deleteSingleSource(row) {
  try {
    await ElMessageBox.confirm(`确定删除书源【${row.bookSourceName}】吗？`, '提示', { type: 'warning' });
    await axios.post('/reader3/deleteBookSource', row);
    sources.value = sources.value.filter(s => s.bookSourceUrl !== row.bookSourceUrl);
    ElMessage.success('删除成功');
  } catch (e) {}
}

async function deleteDisabledSources() {
  const dead = sources.value.filter(s => s.health === 'dead' || !s.enabled);
  if (!dead.length) {
    ElMessage.info('暂无需要清理的失效书源');
    return;
  }
  try {
    await ElMessageBox.confirm(`确认清理 ${dead.length} 个失效/未启用的书源吗？`, '清理确认', { type: 'warning' });
    for (const s of dead) {
      await axios.post('/reader3/deleteBookSource', s);
    }
    fetchSources();
    ElMessage.success('已清理完成');
  } catch (e) {}
}

// 3. 替换净化规则
async function fetchReplaceRules() {
  loadingRules.value = true;
  try {
    const res = await axios.get('/reader3/getReplaceRules');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      replaceRules.value = res.data.data;
    }
  } catch (e) {
  } finally {
    loadingRules.value = false;
  }
}

function openAddRuleDialog() {
  editingRule.value = { name: '', pattern: '', replacement: '', scope: '', isEnabled: true };
  showRuleDialog.value = true;
}

function editRule(row) {
  editingRule.value = { ...row };
  showRuleDialog.value = true;
}

async function confirmSaveRule() {
  if (!editingRule.value.name || !editingRule.value.pattern) {
    ElMessage.warning('请填写规则名称与匹配正则');
    return;
  }
  try {
    await axios.post('/reader3/saveReplaceRule', editingRule.value);
    ElMessage.success('保存规则成功');
    showRuleDialog.value = false;
    fetchReplaceRules();
  } catch (e) {
    ElMessage.error('保存失败');
  }
}

async function saveRule(row) {
  try {
    await axios.post('/reader3/saveReplaceRule', row);
    ElMessage.success('规则状态已更新');
  } catch (e) {
    ElMessage.error('更新失败');
  }
}

async function deleteRule(row) {
  try {
    await ElMessageBox.confirm(`确定删除规则【${row.name}】吗？`, '提示', { type: 'warning' });
    await axios.post('/reader3/deleteReplaceRule', row);
    fetchReplaceRules();
    ElMessage.success('删除成功');
  } catch (e) {}
}

// 4. 书架管理
async function fetchBookshelf() {
  loadingShelf.value = true;
  try {
    const res = await axios.get('/reader3/getBookshelf');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      bookshelfList.value = res.data.data;
    }
  } catch (e) {
  } finally {
    loadingShelf.value = false;
  }
}

async function removeBook(row) {
  try {
    await ElMessageBox.confirm(`确定将《${row.name}》移出书架吗？`, '提示', { type: 'warning' });
    await axios.post('/reader3/deleteShelfBook', { name: row.name, author: row.author });
    fetchBookshelf();
    ElMessage.success('已移出书架');
  } catch (e) {}
}

// 5. 用户管理
async function fetchUsers() {
  loadingUsers.value = true;
  try {
    const res = await axios.get('/reader3/getUserList');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      userList.value = res.data.data;
    }
  } catch (e) {
  } finally {
    loadingUsers.value = false;
  }
}

async function confirmAddUser() {
  if (!newUserData.value.username || !newUserData.value.password) {
    ElMessage.warning('请填写用户名与密码');
    return;
  }
  try {
    await axios.post('/reader3/saveUser', newUserData.value);
    ElMessage.success('用户创建成功');
    showAddUserDialog.value = false;
    newUserData.value = { username: '', password: '' };
    fetchUsers();
  } catch (e) {
    ElMessage.error('创建用户失败');
  }
}

async function resetUserPassword(row) {
  try {
    const { value } = await ElMessageBox.prompt(`请输入【${row.username}】的新密码:`, '重置密码', {
      inputType: 'password'
    });
    if (value) {
      await axios.post('/reader3/saveUser', { username: row.username, password: value });
      ElMessage.success('密码重置成功');
    }
  } catch (e) {}
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`确定删除用户【${row.username}】吗？`, '提示', { type: 'warning' });
    await axios.post('/reader3/deleteUser', { username: row.username });
    fetchUsers();
    ElMessage.success('删除成功');
  } catch (e) {}
}

// 6. WebDAV
async function saveWebDAV() {
  try {
    await axios.post('/reader3/saveUserWebdavConfig', webdavConfig.value);
    ElMessage.success('WebDAV 配置已保存');
  } catch (e) {
    ElMessage.error('保存失败');
  }
}

async function backupToWebDAV() {
  try {
    ElMessage.info('正在全量打包数据并上传到 WebDAV...');
    await axios.post('/reader3/backupToWebdav');
    ElMessage.success('云端备份成功！');
  } catch (e) {
    ElMessage.error('备份失败，请检查 WebDAV 连接');
  }
}

// 7. 日志
async function fetchLogs() {
  try {
    const res = await axios.get('/reader3/getSystemLogs');
    logsText.value = res.data || '暂无最近日志内容';
  } catch (e) {
    logsText.value = '获取系统日志超时或无权限。';
  }
}

onMounted(() => {
  fetchSystemStats();
  fetchReplaceRules();
  fetchLogs();
});
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: all 0.3s ease;
}

.theme-light {
  background: #f1f5f9;
  color: #1e293b;
}

.admin-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.brand-icon {
  font-size: 22px;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.brand-badge {
  font-size: 11px;
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.admin-sidebar {
  width: 220px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 8px;
}

.sidebar-nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.sidebar-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

.sidebar-nav-item.active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.pane-title {
  font-size: 18px;
  font-weight: 600;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.bg-blue { background: rgba(59, 130, 246, 0.15); }
.bg-green { background: rgba(16, 185, 129, 0.15); }
.bg-purple { background: rgba(168, 85, 247, 0.15); }
.bg-amber { background: rgba(245, 158, 11, 0.15); }

.stat-value {
  font-size: 22px;
  font-weight: 700;
}

.stat-unit {
  font-size: 13px;
  color: #94a3b8;
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.log-terminal {
  border-radius: 8px;
  background: #090d16;
  padding: 16px;
  height: 600px;
  overflow: auto;
}

.log-content {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #38bdf8;
  white-space: pre-wrap;
  margin: 0;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .admin-body {
    flex-direction: column;
  }
  .admin-sidebar {
    width: 100%;
    overflow-x: auto;
    padding: 8px;
  }
  .sidebar-nav-list {
    flex-direction: row;
  }
  .sidebar-nav-item {
    white-space: nowrap;
  }
}
</style>
