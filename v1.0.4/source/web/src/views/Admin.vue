<template>
  <div class="admin-container" :class="isDark ? 'theme-dark' : 'theme-light'">
    <!-- 顶部导航栏 (Reader 官方风格) -->
    <header class="admin-header">
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
      <aside class="admin-sidebar">
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

      <main class="admin-main">
        <!-- 1. 系统概览与配置管理 -->
        <section v-if="activeTab === 'overview'" class="tab-pane">
          <div class="pane-header">
            <h2 class="pane-title">系统状态总览与核心配置</h2>
            <el-button size="small" @click="fetchSystemStats">🔄 刷新数据</el-button>
          </div>

          <!-- 4 个核心指标卡片 -->
          <div class="stat-cards">
            <div class="stat-card admin-card">
              <div class="stat-icon bg-blue">👥</div>
              <div class="stat-info">
                <div class="stat-value">{{ userList.length }} <span class="stat-unit">/ {{ systemConfig.userLimit || 10 }} 人</span></div>
                <div class="stat-label">注册用户配额</div>
              </div>
            </div>

            <div class="stat-card admin-card">
              <div class="stat-icon bg-green">📚</div>
              <div class="stat-info">
                <div class="stat-value">{{ sources.length }} <span class="stat-unit">源</span></div>
                <div class="stat-label">可用书源总数 (启用: {{ enabledSourcesCount }})</div>
              </div>
            </div>

            <div class="stat-card admin-card">
              <div class="stat-icon bg-purple">📖</div>
              <div class="stat-info">
                <div class="stat-value">{{ bookshelfList.length }} <span class="stat-unit">本</span></div>
                <div class="stat-label">当前书架书籍</div>
              </div>
            </div>

            <div class="stat-card admin-card">
              <div class="stat-icon bg-amber">⚡</div>
              <div class="stat-info">
                <div class="stat-value">LRU 极速</div>
                <div class="stat-label">TTL 协程防盗链缓存</div>
              </div>
            </div>
          </div>

          <!-- 快速配置表单 -->
          <div class="config-section admin-card" style="margin-top: 20px;">
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
          <div class="toolbar admin-toolbar">
            <el-input
              v-model="sourceKeyword"
              placeholder="搜索书源名称或域名..."
              clearable
              size="small"
              style="max-width: 260px;"
            />
            <div class="toolbar-actions">
              <el-input
                v-model="healthCheckKeyword"
                size="small"
                placeholder="测试词(默认: 的)"
                style="width: 120px;"
                title="体检检索测试词，默认使用高频词「的」"
              />
              <el-button size="small" type="success" :loading="healthChecking" plain @click="testSourcesHealth">
                🩺 多线程深度体检
              </el-button>
              <el-button size="small" type="warning" plain @click="toggleAllSources(true)">
                ✅ 全部启用
              </el-button>
              <el-button size="small" type="info" plain @click="toggleAllSources(false)">
                ⏸️ 全部停用
              </el-button>
              <el-button size="small" type="danger" plain @click="deleteDisabledSources">
                🗑️ 清理停用源
              </el-button>
            </div>
          </div>

          <!-- 多线程并发体检可见进度条卡片 (用户需求 2 & 3) -->
          <div v-if="healthChecking || healthCheckFinished" class="health-progress-card">
            <div class="progress-bar-header">
              <div class="progress-title">
                <span class="pulsing-indicator" :class="{ 'is-active': healthChecking }"></span>
                <span class="title-text">{{ healthChecking ? '⚡ 多线程并发深度体检中...' : '✅ 体检已完成' }}</span>
                <span class="progress-ratio">({{ healthCheckStats.current }} / {{ healthCheckStats.total }})</span>
              </div>
              <div class="progress-actions">
                <span v-if="healthChecking" class="detecting-name" :title="healthCheckStats.currentSourceName">
                  正在探测: {{ healthCheckStats.currentSourceName || '并发连接调度中...' }}
                </span>
                <el-button v-if="healthChecking" size="small" type="danger" plain @click="stopHealthCheck">
                  ⏹ 停止体检
                </el-button>
                <el-button v-if="healthCheckStats.dead > 0" size="small" type="warning" plain @click="purgeDeadSources">
                  🧹 一键清理 {{ healthCheckStats.dead }} 个失效源
                </el-button>
              </div>
            </div>

            <el-progress
              :percentage="healthCheckProgress"
              :status="healthCheckProgress === 100 ? 'success' : ''"
              :stroke-width="14"
              :text-inside="true"
              class="health-progress-bar"
            />

            <div class="progress-stat-pills">
              <span class="stat-pill good">🟢 优质可用: {{ healthCheckStats.good }}</span>
              <span class="stat-pill slow">🟡 响应较慢: {{ healthCheckStats.slow }}</span>
              <span class="stat-pill dead">🔴 无法访问: {{ healthCheckStats.dead }}</span>
              <span class="stat-pill total">📊 书源总数: {{ healthCheckStats.total }}</span>
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
            <el-table-column label="健康度" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="row.health === 'good' ? 'success' : row.health === 'slow' ? 'warning' : row.health === 'dead' ? 'danger' : 'info'">
                  {{ row.health === 'good' ? '🟢 优质' : row.health === 'slow' ? '🟡 较慢' : row.health === 'dead' ? '🔴 失效' : '⚪ 未测' }}
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
            <el-table-column prop="username" label="用户名" min-width="140">
              <template #default="{ row }">
                <span style="font-weight: 600; color: #f1f5f9;">{{ row.username }}</span>
                <el-tag v-if="row.username === 'admin'" size="small" type="warning" effect="plain" style="margin-left: 8px;">系统预设</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="角色身份" width="130">
              <template #default="{ row }">
                <el-tag size="small" :type="(row.isAdmin || row.is_admin || row.username === 'admin') ? 'danger' : 'info'">
                  {{ (row.isAdmin || row.is_admin || row.username === 'admin') ? '👑 管理员' : '👤 普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="WebDAV 备份" width="130">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enableWebdav !== false && row.enable_webdav !== false"
                  :disabled="row.username === 'admin'"
                  size="small"
                  @change="(val) => toggleUserPermission(row, 'enableWebdav', val)"
                />
              </template>
            </el-table-column>
            <el-table-column label="离线存储" width="120">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enableLocalStore !== false && row.enable_local_store !== false"
                  :disabled="row.username === 'admin'"
                  size="small"
                  @change="(val) => toggleUserPermission(row, 'enableLocalStore', val)"
                />
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

          <div class="admin-card" style="max-width: 600px; padding: 20px;">
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

          <div class="log-terminal">
            <pre class="log-content">{{ logsText || '暂无最近日志输出或日志目录为空...' }}</pre>
          </div>
        </section>
      </main>
    </div>

    <!-- 弹窗 1：导入书源（支持本地文件、网络远程链接、直接粘贴三种模式） -->
    <el-dialog v-model="showImportDialog" title="➕ 导入书源" width="90%" max-width="580px" append-to-body>
      <el-tabs v-model="importTab" class="import-tabs">
        <!-- 标签 1：本地文件导入 -->
        <el-tab-pane label="📁 本地文件导入" name="local">
          <div class="file-upload-dropzone" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleFileDrop">
            <input type="file" ref="fileInputRef" accept=".json,.txt" style="display: none;" @change="handleFileSelect" />
            <div class="dropzone-content">
              <div class="dropzone-icon">📥</div>
              <p class="dropzone-title">{{ localFileName ? localFileName : '点击选择本地书源文件，或直接拖拽文件到这里' }}</p>
              <p class="dropzone-sub">支持 .json 与 .txt 格式的书源定义文件</p>
              <div v-if="parsedSources.length > 0" class="parsed-badge">
                ✅ 已解析出 <strong>{{ parsedSources.length }}</strong> 个书源
              </div>
            </div>
          </div>
          <div style="margin-top: 16px; text-align: right;">
            <el-button @click="showImportDialog = false">取消</el-button>
            <el-button
              type="primary"
              class="glow-btn"
              :disabled="parsedSources.length === 0"
              :loading="importingSource"
              @click="submitLocalSources"
            >
              🚀 导入这 {{ parsedSources.length }} 个书源
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 标签 2：网络链接导入 -->
        <el-tab-pane label="🌐 网络链接导入" name="url">
          <div style="margin-bottom: 12px; font-size: 13px; color: #94a3b8;">
            请输入网络书源 JSON 文件的 HTTP / HTTPS 地址：
          </div>
          <el-input
            v-model="importSourceUrl"
            type="textarea"
            :rows="3"
            placeholder="如: https://example.com/sources.json"
            clearable
          />
          <div style="margin-top: 16px; text-align: right;">
            <el-button @click="showImportDialog = false">取消</el-button>
            <el-button
              type="primary"
              class="glow-btn"
              :loading="importingSource"
              @click="confirmImportSourceUrl"
            >
              🌐 拉取并导入
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 标签 3：JSON 文本直接粘贴 -->
        <el-tab-pane label="📝 文本/JSON 直接粘贴" name="text">
          <div style="margin-bottom: 12px; font-size: 13px; color: #94a3b8;">
            请将书源 JSON 数组或单个书源对象粘贴到下方：
          </div>
          <el-input
            v-model="importSourceContent"
            type="textarea"
            :rows="6"
            placeholder="[ { &quot;bookSourceName&quot;: &quot;...&quot;, &quot;bookSourceUrl&quot;: &quot;...&quot; } ]"
          />
          <div style="margin-top: 16px; text-align: right;">
            <el-button @click="showImportDialog = false">取消</el-button>
            <el-button
              type="primary"
              class="glow-btn"
              :loading="importingSource"
              @click="confirmImportSourceText"
            >
              📝 解析并导入
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
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
    <el-dialog v-model="showAddUserDialog" title="➕ 添加新用户" width="90%" max-width="480px" append-to-body>
      <el-form label-width="95px" class="user-add-form">
        <el-form-item label="用户名">
          <el-input v-model="newUserData.username" placeholder="至少 3 位字母或数字 (如 reader01)" clearable />
        </el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="newUserData.password" type="password" show-password placeholder="至少 4 位登录密码" clearable />
        </el-form-item>
        <el-form-item label="管理权限">
          <el-switch v-model="newUserData.isAdmin" active-text="设置为超级管理员" />
        </el-form-item>
        <el-form-item label="WebDAV 备份">
          <el-switch v-model="newUserData.enableWebdav" active-text="允许独立云备份" />
        </el-form-item>
        <el-form-item label="本地书籍存储">
          <el-switch v-model="newUserData.enableLocalStore" active-text="允许本地离线存储" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false">取消</el-button>
        <el-button type="primary" class="glow-btn" :loading="addingUser" @click="confirmAddUser">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import request from '../utils/request';
import { ElMessage, ElMessageBox } from 'element-plus';

const axios = request;
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
const importTab = ref('local');
const fileInputRef = ref(null);
const localFileName = ref('');
const parsedSources = ref([]);
const importSourceUrl = ref('');
const importSourceContent = ref('');
const importingSource = ref(false);

// 多线程体检状态
const healthChecking = ref(false);
const healthCheckFinished = ref(false);
const healthCheckKeyword = ref('的');
let cancelHealthCheck = false;
const healthCheckStats = ref({
  current: 0,
  total: 0,
  good: 0,
  slow: 0,
  dead: 0,
  currentSourceName: ''
});

const healthCheckProgress = computed(() => {
  if (healthCheckStats.value.total === 0) return 0;
  return Math.min(100, Math.floor((healthCheckStats.value.current / healthCheckStats.value.total) * 100));
});

const showRuleDialog = ref(false);
const editingRule = ref({});

const showAddUserDialog = ref(false);
const addingUser = ref(false);
const newUserData = ref({
  username: '',
  password: '',
  isAdmin: false,
  enableWebdav: true,
  enableLocalStore: true
});

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

// 书源导入处理
function triggerFileInput() {
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    processLocalFile(file);
  }
}

function handleFileDrop(event) {
  const file = event.dataTransfer.files?.[0];
  if (file) {
    processLocalFile(file);
  }
}

function processLocalFile(file) {
  localFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsed = JSON.parse(text);
      let list = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) {
          list = parsed.data;
        } else if (Array.isArray(parsed.sources)) {
          list = parsed.sources;
        } else if (parsed.bookSourceUrl || parsed.bookSourceName) {
          list = [parsed];
        }
      }
      list = list.filter(s => s && (s.bookSourceUrl || s.bookSourceName));
      if (list.length === 0) {
        ElMessage.warning('该文件中没有检测到有效书源内容');
        parsedSources.value = [];
        return;
      }
      parsedSources.value = list;
      ElMessage.success(`已成功解析文件「${file.name}」，包含 ${list.length} 个书源`);
    } catch (err) {
      ElMessage.error('书源文件解析失败，请确认文件格式为合法的 JSON');
      parsedSources.value = [];
    }
  };
  reader.onerror = () => {
    ElMessage.error('读取文件失败');
    parsedSources.value = [];
  };
  reader.readAsText(file);
}

async function submitLocalSources() {
  if (parsedSources.value.length === 0) {
    ElMessage.warning('请先选择有效的书源文件');
    return;
  }
  await saveSourcesToBackend(parsedSources.value);
}

async function confirmImportSourceUrl() {
  const url = importSourceUrl.value.trim();
  if (!url) {
    ElMessage.warning('请输入有效的书源链接');
    return;
  }
  importingSource.value = true;
  try {
    let sourceData = null;
    try {
      const res = await axios.get(url, { timeout: 8000 });
      sourceData = res.data;
    } catch (corsErr) {
      // 跨域或直接拉取受阻，调用后端代理拉取
      const remoteRes = await axios.post('/reader3/readRemoteSourceFile', { url });
      if (remoteRes.data && remoteRes.data.isSuccess && Array.isArray(remoteRes.data.data) && remoteRes.data.data.length > 0) {
        sourceData = JSON.parse(remoteRes.data.data[0]);
      } else {
        throw new Error(remoteRes.data?.errorMsg || '远程书源拉取失败');
      }
    }

    if (sourceData) {
      const list = Array.isArray(sourceData) ? sourceData : [sourceData];
      const ok = await saveSourcesToBackend(list);
      if (ok) {
        importSourceUrl.value = '';
      }
    }
  } catch (e) {
    ElMessage.error('拉取远程书源失败: ' + (e.message || e.toString()));
  } finally {
    importingSource.value = false;
  }
}

async function confirmImportSourceText() {
  const content = importSourceContent.value.trim();
  if (!content) {
    ElMessage.warning('请粘贴书源 JSON 数据');
    return;
  }
  importingSource.value = true;
  try {
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const ok = await saveSourcesToBackend(list);
    if (ok) {
      importSourceContent.value = '';
    }
  } catch (e) {
    ElMessage.error('解析 JSON 数据失败: ' + (e.message || e.toString()));
  } finally {
    importingSource.value = false;
  }
}

async function saveSourcesToBackend(list) {
  if (!Array.isArray(list) || list.length === 0) {
    ElMessage.warning('未检测到有效书源数据');
    return false;
  }
  importingSource.value = true;
  try {
    const res = await axios.post('/reader3/saveBookSources', list);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`成功导入 ${list.length} 个书源！`);
      showImportDialog.value = false;
      parsedSources.value = [];
      localFileName.value = '';
      fetchSources();
      return true;
    } else {
      ElMessage.error(res.data?.errorMsg || '保存书源失败');
      return false;
    }
  } catch (e) {
    ElMessage.error('保存书源失败: ' + (e.message || e.toString()));
    return false;
  } finally {
    importingSource.value = false;
  }
}

function stopHealthCheck() {
  cancelHealthCheck = true;
  healthChecking.value = false;
  ElMessage.info('已中断体检');
}

async function purgeDeadSources() {
  const deadSources = sources.value.filter(s => s.health === 'dead');
  if (deadSources.length === 0) {
    ElMessage.info('暂无检测出的失效书源');
    return;
  }
  try {
    await ElMessageBox.confirm(`确定一键清理这 ${deadSources.length} 个失效书源吗？`, '批量清理', {
      type: 'warning'
    });
    const keepSources = sources.value.filter(s => s.health !== 'dead');
    await axios.post('/reader3/saveBookSources', keepSources);
    sources.value = keepSources;
    healthCheckStats.value.dead = 0;
    ElMessage.success(`已清理 ${deadSources.length} 个失效书源！`);
  } catch (e) {}
}

// 提取书源首个发现分类页面 URL
function extractFirstExploreUrl(exploreUrl) {
  if (!exploreUrl) return null;
  try {
    const data = JSON.parse(exploreUrl);
    if (Array.isArray(data) && data.length > 0 && data[0].url) {
      return data[0].url;
    }
  } catch (e) {}
  const lines = String(exploreUrl).replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.includes('::')) {
      const parts = line.split('::');
      if (parts.length > 1 && parts[1].trim()) {
        return parts[1].trim();
      }
    } else if (line.startsWith('http') || line.startsWith('/')) {
      return line;
    }
  }
  return null;
}

async function testSourcesHealth() {
  if (sources.value.length === 0) {
    ElMessage.warning('书源列表为空，请先导入书源');
    return;
  }

  cancelHealthCheck = false;
  healthChecking.value = true;
  healthCheckFinished.value = false;

  const list = sources.value;
  healthCheckStats.value = {
    current: 0,
    total: list.length,
    good: 0,
    slow: 0,
    dead: 0,
    currentSourceName: ''
  };

  // 8路多线程并发连接池 (用户需求 3)
  const CONCURRENCY = 8;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < list.length && !cancelHealthCheck) {
      const idx = currentIndex++;
      const s = list[idx];
      healthCheckStats.value.currentSourceName = s.bookSourceName || s.bookSourceUrl;

      const startTime = Date.now();
      let isAlive = false;
      let isSlow = false;
      let isDead = false;

      // 阶段 1：搜索规则实测（如果书源配置了 searchUrl）
      const hasSearch = Boolean(s.searchUrl && String(s.searchUrl).trim());
      if (hasSearch) {
        try {
          const res = await axios.post('/reader3/searchBook', {
            key: healthCheckKeyword.value.trim() || '的',
            bookSourceUrl: s.bookSourceUrl
          }, { timeout: 10000 });
          const elapsed = Date.now() - startTime;
          if (res.data && res.data.isSuccess && Array.isArray(res.data.data) && res.data.data.length > 0) {
            isAlive = true;
            isSlow = elapsed >= 3000;
          }
        } catch (err) {
          // 搜索暂未命中或规则稍有偏差，不急于一票否决，交给后置阶段继续验证
        }
      }

      // 阶段 2：发现分类页（Explore）兜底验证（解决文学、分类小说网等无搜索规则但网站完全正常的问题）
      if (!isAlive && !cancelHealthCheck) {
        const firstExplore = extractFirstExploreUrl(s.exploreUrl);
        if (firstExplore) {
          try {
            const expRes = await axios.post('/reader3/exploreBook', {
              ruleFindUrl: firstExplore,
              bookSourceUrl: s.bookSourceUrl,
              page: 1
            }, { timeout: 10000 });
            const elapsed = Date.now() - startTime;
            if (expRes.data && expRes.data.isSuccess && Array.isArray(expRes.data.data) && expRes.data.data.length > 0) {
              isAlive = true;
              isSlow = elapsed >= 3000;
            }
          } catch (expErr) {
            // 发现页未解析出结果，交给阶段 3 站点连通性最终裁定
          }
        }
      }

      // 阶段 3：网站首页/源连通性兜底探测（精准识别防火墙403拦截、404空站或真实连通）
      if (!isAlive && !cancelHealthCheck) {
        try {
          const pingRes = await axios.post('/reader3/readRemoteSourceFile', {
            url: s.bookSourceUrl
          }, { timeout: 8000 });
          if (pingRes.data && pingRes.data.isSuccess) {
            const bodyStr = Array.isArray(pingRes.data.data) ? String(pingRes.data.data[0] || '') : String(pingRes.data.data || '');
            const bodyLower = bodyStr.toLowerCase();
            const isBlockedOrNotFound = 
              bodyLower.includes('403 forbidden') ||
              bodyLower.includes('403 禁止访问') ||
              bodyLower.includes('访问被拒绝') ||
              bodyLower.includes('未通过安全检测') ||
              bodyLower.includes('just a moment...') ||
              (bodyLower.includes('404 not found') && bodyLower.includes('the requested url was not found')) ||
              (bodyLower.includes('404') && bodyLower.includes('not found') && bodyStr.length < 800);

            if (isBlockedOrNotFound) {
              isDead = true;
            } else {
              // 网站服务器完全在线且无拦截/报错，判定存活良好，绝不误杀！
              isAlive = true;
              isSlow = true;
            }
          } else {
            const errMsg = String(pingRes.data?.errorMsg || '');
            if (errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('拦截')) {
              isDead = true;
            }
          }
        } catch (pingErr) {
          const errMsg = String(pingErr.message || '');
          if (errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED')) {
            isDead = true;
          }
        }
      }

      // 最终综合状态判断
      if (isAlive) {
        if (!isSlow) {
          s.health = 'good';
          healthCheckStats.value.good++;
        } else {
          s.health = 'slow';
          healthCheckStats.value.slow++;
        }
      } else if (isDead) {
        // 确认域名失效、连接被拒或404才标记失效
        s.health = 'dead';
        healthCheckStats.value.dead++;
      } else {
        // 虽未搜到指定关键字书籍，但网站并未宕机，标记为较慢/待复核，杜绝误杀！
        s.health = 'slow';
        healthCheckStats.value.slow++;
      }

      healthCheckStats.value.current++;
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(CONCURRENCY, list.length); w++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  healthChecking.value = false;
  healthCheckFinished.value = true;
  healthCheckStats.value.currentSourceName = '检测完毕';
  ElMessage.success(`多线程体检完成！优质 ${healthCheckStats.value.good} 个，较慢/可用 ${healthCheckStats.value.slow} 个，失效 ${healthCheckStats.value.dead} 个`);
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
  const username = (newUserData.value.username || '').trim();
  const password = (newUserData.value.password || '').trim();
  if (!username) {
    ElMessage.warning('请输入用户名');
    return;
  }
  if (!password) {
    ElMessage.warning('请输入登录密码');
    return;
  }
  if (username.length < 3) {
    ElMessage.warning('用户名不能低于 3 位');
    return;
  }
  const usernameReg = /^[a-zA-Z0-9]+$/;
  if (!usernameReg.test(username)) {
    ElMessage.warning('用户名只能由英文字母和数字组成');
    return;
  }
  if (password.length < 4) {
    ElMessage.warning('密码不能低于 4 位');
    return;
  }

  addingUser.value = true;
  try {
    const payload = {
      username: username,
      password: password,
      isAdmin: Boolean(newUserData.value.isAdmin),
      enableWebdav: newUserData.value.enableWebdav !== false,
      enableLocalStore: newUserData.value.enableLocalStore !== false
    };
    const res = await axios.post('/reader3/addUser', payload);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`用户【${username}】创建成功！`);
      showAddUserDialog.value = false;
      newUserData.value = {
        username: '',
        password: '',
        isAdmin: false,
        enableWebdav: true,
        enableLocalStore: true
      };
      fetchUsers();
    } else {
      ElMessage.error(res.data?.errorMsg || '创建用户失败');
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.errorMsg || '网络请求异常，创建用户失败');
  } finally {
    addingUser.value = false;
  }
}

async function resetUserPassword(row) {
  try {
    const { value } = await ElMessageBox.prompt(`请输入用户【${row.username}】的新密码 (至少4位):`, '重置用户密码', {
      inputType: 'password',
      inputValidator: (val) => {
        if (!val || val.length < 4) return '密码不能低于 4 位';
        return true;
      }
    });
    if (value) {
      const res = await axios.post('/reader3/resetPassword', { username: row.username, password: value });
      if (res.data && res.data.isSuccess) {
        ElMessage.success(`已成功重置【${row.username}】的密码`);
      } else {
        ElMessage.error(res.data?.errorMsg || '重置密码失败');
      }
    }
  } catch (e) {}
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`确定删除用户【${row.username}】吗？删除后该用户数据与书架将一并清理。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    });
    const res = await axios.post('/reader3/deleteUsers', [row.username]);
    if (res.data && res.data.isSuccess) {
      ElMessage.success(`已删除用户【${row.username}】`);
      fetchUsers();
    } else {
      ElMessage.error(res.data?.errorMsg || '删除用户失败');
    }
  } catch (e) {}
}

async function toggleUserPermission(row, field, val) {
  try {
    const payload = {
      username: row.username,
      [field]: val
    };
    const res = await axios.post('/reader3/updateUser', payload);
    if (res.data && res.data.isSuccess) {
      ElMessage.success('用户权限已更新');
      row[field] = val;
    } else {
      ElMessage.error(res.data?.errorMsg || '更新权限失败');
      fetchUsers();
    }
  } catch (e) {
    ElMessage.error('网络请求异常');
    fetchUsers();
  }
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
/* 专业企业级控制台风格 (无反光模糊，数据清晰分明) */
.admin-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  color: #e6edf3;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  transition: all 0.25s ease;
}

.theme-light {
  background: #f6f8fa;
  color: #1f2328;
}

.admin-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.theme-light .admin-header {
  background: #ffffff;
  border-bottom: 1px solid #d0d7de;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.brand-icon {
  font-size: 20px;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.brand-badge {
  font-size: 11px;
  background: #1f2937;
  color: #10b981;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #374151;
}

.theme-light .brand-badge {
  background: #ecfdf5;
  color: #059669;
  border-color: #a7f3d0;
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
  background: #161b22;
  border-right: 1px solid #30363d;
  padding: 16px 8px;
}

.theme-light .admin-sidebar {
  background: #ffffff;
  border-right: 1px solid #d0d7de;
}

.sidebar-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  color: #8b949e;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.theme-light .sidebar-nav-item {
  color: #57606a;
}

.sidebar-nav-item:hover {
  background: #21262d;
  color: #f0f6fc;
}

.theme-light .sidebar-nav-item:hover {
  background: #f3f4f6;
  color: #1f2328;
}

.sidebar-nav-item.active {
  background: #1f6feb;
  color: #ffffff;
  font-weight: 600;
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #0d1117;
}

.theme-light .admin-main {
  background: #f6f8fa;
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
  margin: 0;
}

/* 专业数据卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.admin-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.theme-light .admin-card {
  background: #ffffff;
  border: 1px solid #d0d7de;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.bg-blue { background: rgba(59, 130, 246, 0.15); }
.bg-green { background: rgba(16, 185, 129, 0.15); }
.bg-purple { background: rgba(168, 85, 247, 0.15); }
.bg-amber { background: rgba(245, 158, 11, 0.15); }

.stat-value {
  font-size: 20px;
  font-weight: 700;
}

.stat-unit {
  font-size: 13px;
  color: #8b949e;
  font-weight: normal;
}

.theme-light .stat-unit {
  color: #6e7781;
}

.stat-label {
  font-size: 12px;
  color: #8b949e;
  margin-top: 2px;
}

.theme-light .stat-label {
  color: #6e7781;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
  background: #161b22;
  border: 1px solid #30363d;
}

.theme-light .admin-toolbar {
  background: #ffffff;
  border: 1px solid #d0d7de;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.log-terminal {
  border-radius: 8px;
  background: #010409;
  border: 1px solid #30363d;
  padding: 16px;
  height: 600px;
  overflow: auto;
}

.log-content {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #58a6ff;
  white-space: pre-wrap;
  margin: 0;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #8b949e;
}

.theme-light .form-tip {
  color: #6e7781;
}

/* 导入书源模态框 */
.file-upload-dropzone {
  border: 2px dashed #30363d;
  border-radius: 8px;
  padding: 36px 20px;
  text-align: center;
  background: #0d1117;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-upload-dropzone:hover {
  border-color: #3b82f6;
  background: #161b22;
}

.dropzone-icon {
  font-size: 42px;
  margin-bottom: 12px;
}

.dropzone-title {
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
  margin-bottom: 6px;
}

.dropzone-sub {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.parsed-badge {
  margin-top: 14px;
  display: inline-block;
  padding: 6px 14px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 6px;
  color: #4ade80;
  font-size: 13px;
}

.user-add-form .el-form-item {
  margin-bottom: 18px;
}

/* 多线程体检进度卡片 */
.health-progress-card {
  margin-bottom: 16px;
  padding: 14px 16px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
}

.theme-light .health-progress-card {
  background: #f6f8fa;
  border-color: #d0d7de;
}

.progress-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.pulsing-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
}

.pulsing-indicator.is-active {
  animation: pulse-ring 1.2s infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.9); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
  100% { transform: scale(0.9); opacity: 1; }
}

.progress-ratio {
  color: #58a6ff;
  font-size: 13px;
}

.detecting-name {
  font-size: 12px;
  color: #8b949e;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
  margin-right: 8px;
}

.progress-stat-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.stat-pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.stat-pill.good {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.25);
}

.stat-pill.slow {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.25);
}

.stat-pill.dead {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
}

.stat-pill.total {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.25);
}

@media (max-width: 768px) {
  .admin-header {
    padding: 10px 12px;
  }
  .brand-badge {
    display: none;
  }
  .admin-body {
    flex-direction: column;
  }
  .admin-sidebar {
    width: 100%;
    overflow-x: auto;
    padding: 8px 12px;
    background: #161b22;
    border-bottom: 1px solid #30363d;
  }
  .sidebar-nav-list {
    flex-direction: row;
    gap: 8px;
  }
  .sidebar-nav-item {
    white-space: nowrap;
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 20px;
  }
  .admin-main {
    padding: 12px;
  }
  .toolbar-actions {
    margin-top: 8px;
    width: 100%;
  }
  .toolbar-actions .el-button {
    flex: 1;
  }
  .progress-actions {
    width: 100%;
    margin-top: 6px;
  }
}
</style>
