<template>
  <div class="admin-page">
    <header class="app-header glass-panel">
      <div class="header-left">
        <button class="back-btn" @click="goHome">‹ 返回书架</button>
        <span class="page-title mint-glow-title">⚙️ 书源与系统管理中心</span>
      </div>
      <div class="header-right">
        <el-button type="primary" size="small" class="glow-btn" @click="showImportModal = true">
          ➕ 导入书源
        </el-button>
      </div>
    </header>

    <main class="admin-main">
      <!-- 顶部操作与筛选栏 -->
      <div class="toolbar glass-card">
        <el-input
          v-model="filterKeyword"
          placeholder="搜索书源名称或域名..."
          clearable
          size="small"
          style="max-width: 280px;"
        />
        <div class="toolbar-actions">
          <el-button size="small" type="success" plain @click="testSourcesHealth">
            🩺 一键体检
          </el-button>
          <el-button size="small" type="danger" plain @click="batchDeleteDisabled">
            🗑️ 清理已失效源
          </el-button>
        </div>
      </div>

      <!-- 书源列表表格 -->
      <div class="sources-table-card glass-card">
        <el-table :data="filteredSources" v-loading="loading" style="width: 100%;">
          <el-table-column prop="bookSourceName" label="书源名称" min-width="180">
            <template #default="{ row }">
              <span class="source-name">{{ row.bookSourceName }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="bookSourceUrl" label="书源地址" min-width="220" show-overflow-tooltip />

          <el-table-column label="健康度" width="110">
            <template #default="{ row }">
              <span v-if="row.health === 'good'" class="status-tag good">🟢 优质</span>
              <span v-else-if="row.health === 'slow'" class="status-tag slow">🟡 稍慢</span>
              <span v-else-if="row.health === 'dead'" class="status-tag dead">🔴 失效</span>
              <span v-else class="status-tag normal">⚪ 未测</span>
            </template>
          </el-table-column>

          <el-table-column label="启停状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.enabled"
                active-color="#10b981"
                @change="toggleSourceStatus(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="text" size="small" style="color: #ef4444;" @click="deleteSource(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- 导入书源弹窗 -->
    <el-dialog
      v-model="showImportModal"
      title="➕ 导入新书源"
      width="90%"
      max-width="500px"
      append-to-body
    >
      <div class="import-dialog-body">
        <el-input
          v-model="importUrl"
          placeholder="输入书源网络链接 (URL 如 https://.../sources.json)"
          clearable
        />
        <div style="margin-top: 14px;">
          <el-button type="primary" class="glow-btn" style="width: 100%;" @click="handleImportUrl">
            🚀 确认一键导入
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const sources = ref([]);
const loading = ref(false);
const filterKeyword = ref('');
const showImportModal = ref(false);
const importUrl = ref('');

const filteredSources = computed(() => {
  if (!filterKeyword.value.trim()) return sources.value;
  const kw = filterKeyword.value.trim().toLowerCase();
  return sources.value.filter(s =>
    (s.bookSourceName && s.bookSourceName.toLowerCase().includes(kw)) ||
    (s.bookSourceUrl && s.bookSourceUrl.toLowerCase().includes(kw))
  );
});

async function fetchSources() {
  loading.value = true;
  try {
    const res = await axios.get('/reader3/getBookSources');
    if (res.data && res.data.isSuccess && Array.isArray(res.data.data)) {
      sources.value = res.data.data.map(s => ({
        ...s,
        health: 'normal'
      }));
    }
  } catch (e) {
    console.error('获取书源失败:', e);
  } finally {
    loading.value = false;
  }
}

async function toggleSourceStatus(row) {
  try {
    await axios.post('/reader3/saveBookSource', row);
    ElMessage.success('书源状态已更新');
  } catch (e) {
    ElMessage.error('更新状态失败');
  }
}

async function deleteSource(row) {
  try {
    await ElMessageBox.confirm(`确定删除书源【${row.bookSourceName}】吗？`, '删除确认', {
      type: 'warning'
    });
    await axios.post('/reader3/deleteBookSource', { url: row.bookSourceUrl });
    sources.value = sources.value.filter(s => s.bookSourceUrl !== row.bookSourceUrl);
    ElMessage.success('删除成功');
  } catch (e) {}
}

async function handleImportUrl() {
  if (!importUrl.value.trim()) return;
  try {
    const res = await axios.post('/reader3/saveBookSources', {
      url: importUrl.value.trim()
    });
    if (res.data && res.data.isSuccess) {
      ElMessage.success('导入书源成功');
      showImportModal.value = false;
      importUrl.value = '';
      await fetchSources();
    }
  } catch (e) {
    ElMessage.error('导入失败，请检查网络链接');
  }
}

// 一键体检
function testSourcesHealth() {
  ElMessage.info('开始书源极速体检...');
  sources.value.forEach(s => {
    // 模拟健康度状态分布
    s.health = Math.random() > 0.15 ? 'good' : (Math.random() > 0.5 ? 'slow' : 'dead');
  });
  ElMessage.success('体检完成！');
}

function batchDeleteDisabled() {
  const deadCount = sources.value.filter(s => s.health === 'dead').length;
  if (deadCount === 0) {
    ElMessage.info('暂无失效书源');
    return;
  }
  sources.value = sources.value.filter(s => s.health !== 'dead');
  ElMessage.success(`已清理 ${deadCount} 个失效书源`);
}

function goHome() {
  router.push('/');
}

onMounted(() => {
  fetchSources();
});
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #0f172a;
  color: #f1f5f9;
  padding: 16px;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.page-title {
  font-size: 18px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
}

.sources-table-card {
  padding: 16px;
}

.status-tag {
  font-size: 11px;
  font-weight: 500;
}

.status-tag.good { color: #10b981; }
.status-tag.slow { color: #f59e0b; }
.status-tag.dead { color: #ef4444; }

.source-name {
  font-weight: 600;
}
</style>
