<template>
  <el-dialog
    v-model="visible"
    title="🎨 甄选书摘卡片"
    width="90%"
    class="visionos-dialog"
    destroy-on-close
    append-to-body
  >
    <div class="quote-modal-container">
      <!-- 模板切换与样式选择 -->
      <div class="template-selector">
        <el-radio-group v-model="currentTemplate" size="small" @change="renderCard">
          <el-radio-button label="polaroid">📷 拍立得相纸</el-radio-button>
          <el-radio-button label="business_card">✦ 极简微光名片</el-radio-button>
        </el-radio-group>

        <el-switch
          v-model="isDarkTheme"
          active-text="夜间微光"
          inactive-text="白天雅致"
          @change="renderCard"
        />
      </div>

      <!-- 卡片实时预览区 -->
      <div class="preview-area">
        <div v-if="loading" class="loading-box">正在排版生成书摘...</div>
        <img v-else-if="cardImgUrl" :src="cardImgUrl" class="card-preview-img" alt="书摘卡片" />
      </div>

      <!-- 操作按钮 -->
      <div class="action-footer">
        <el-button type="primary" class="glow-btn" :loading="loading" @click="downloadCard">
          💾 保存高清图片
        </el-button>
        <span class="mobile-tip">长按图片可直接保存或发送给好友</span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { generateQuoteCard } from '../utils/quoteCard';
import { ElMessage } from 'element-plus';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  quoteText: {
    type: String,
    default: ''
  },
  bookName: {
    type: String,
    default: ''
  },
  author: {
    type: String,
    default: ''
  },
  chapterTitle: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const currentTemplate = ref('polaroid');
const isDarkTheme = ref(false);
const cardImgUrl = ref('');
const loading = ref(false);

async function renderCard() {
  if (!props.quoteText) return;
  loading.value = true;
  try {
    cardImgUrl.value = await generateQuoteCard({
      quoteText: props.quoteText,
      bookName: props.bookName,
      author: props.author,
      chapterTitle: props.chapterTitle,
      template: currentTemplate.value,
      isDark: isDarkTheme.value
    });
  } catch (e) {
    console.error('渲染书摘卡片失败:', e);
    ElMessage.error('生成书摘失败');
  } finally {
    loading.value = false;
  }
}

watch(visible, (val) => {
  if (val) {
    renderCard();
  }
});

function downloadCard() {
  if (!cardImgUrl.value) return;
  const link = document.createElement('a');
  link.download = `书摘_${props.bookName}_${Date.now()}.png`;
  link.href = cardImgUrl.value;
  link.click();
  ElMessage.success('已开始下载书摘卡片');
}
</script>

<style scoped>
.quote-modal-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.template-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
  gap: 10px;
}

.preview-area {
  width: 100%;
  max-width: 480px;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 12px;
  padding: 10px;
  box-sizing: border-box;
}

.card-preview-img {
  max-width: 100%;
  max-height: 60vh;
  border-radius: 8px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.2);
}

.loading-box {
  color: #64748b;
  font-size: 13px;
}

.action-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.glow-btn {
  width: 100%;
  max-width: 320px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  font-weight: 600;
}

.mobile-tip {
  font-size: 11px;
  color: #94a3b8;
}
</style>
