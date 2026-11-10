<template>
  <el-drawer
    v-model="visible"
    title="⚙️ 阅读排版与偏好设置"
    direction="btt"
    size="auto"
    class="read-settings-drawer"
    :with-header="true"
    append-to-body
  >
    <div class="settings-container">
      <!-- 1. 翻页方式 (APP级体验核心) -->
      <div class="setting-group">
        <div class="group-title">翻页模式</div>
        <div class="mode-capsule-row">
          <button
            class="mode-btn"
            :class="{ active: readerStore.pageMode === 'slide' }"
            @click="readerStore.setPageMode('slide')"
          >
            📱 左右滑动 (APP手势)
          </button>
          <button
            class="mode-btn"
            :class="{ active: readerStore.pageMode === 'simulation' }"
            @click="readerStore.setPageMode('simulation')"
          >
            📖 3D 仿真翻页
          </button>
          <button
            class="mode-btn"
            :class="{ active: readerStore.pageMode === 'scroll' }"
            @click="readerStore.setPageMode('scroll')"
          >
            📜 上下滑动 (平滑滚动)
          </button>
        </div>
      </div>

      <!-- 2. 阅读经典主题底色 (移植原版 reader 7 款经典护眼配色) -->
      <div class="setting-group">
        <div class="group-title">阅读主题</div>
        <div class="theme-palette-grid">
          <div
            v-for="t in THEME_LIST"
            :key="t.id"
            class="theme-swatch"
            :class="{ active: readerStore.theme === t.id }"
            :style="{ background: t.bg, color: t.color, borderColor: t.border }"
            @click="readerStore.setTheme(t.id)"
          >
            <span class="theme-dot" :style="{ background: t.color }"></span>
            <span class="theme-name">{{ t.name }}</span>
          </div>
        </div>
      </div>

      <!-- 3. 字号与字重设置 -->
      <div class="setting-group-split">
        <div class="setting-group half-group">
          <div class="group-title">字号大小</div>
          <div class="stepper-row">
            <button class="step-btn" @click="readerStore.setFontSize(readerStore.fontSize - 1)">A -</button>
            <span class="step-val">{{ readerStore.fontSize }} px</span>
            <button class="step-btn" @click="readerStore.setFontSize(readerStore.fontSize + 1)">A +</button>
          </div>
        </div>
        <div class="setting-group half-group">
          <div class="group-title">字体粗细</div>
          <div class="stepper-row">
            <button
              class="step-btn text-btn"
              :class="{ active: readerStore.fontWeight === 400 }"
              @click="readerStore.setFontWeight(400)"
            >
              常规
            </button>
            <button
              class="step-btn text-btn"
              :class="{ active: readerStore.fontWeight === 600 }"
              @click="readerStore.setFontWeight(600)"
            >
              <b>加粗</b>
            </button>
          </div>
        </div>
      </div>

      <!-- 4. 行间距与段间距微调 (原 reader 规范) -->
      <div class="setting-group-split">
        <div class="setting-group half-group">
          <div class="group-title">行间距</div>
          <div class="stepper-row">
            <button class="step-btn" @click="changeLineHeight(-0.1)">-</button>
            <span class="step-val">{{ readerStore.lineHeight.toFixed(1) }}</span>
            <button class="step-btn" @click="changeLineHeight(0.1)">+</button>
          </div>
        </div>
        <div class="setting-group half-group">
          <div class="group-title">段间距</div>
          <div class="stepper-row">
            <button class="step-btn" @click="changeParagraphSpacing(-2)">-</button>
            <span class="step-val">{{ readerStore.paragraphSpacing }} px</span>
            <button class="step-btn" @click="changeParagraphSpacing(2)">+</button>
          </div>
        </div>
      </div>

      <!-- 5. 正文大屏阅读宽度 (防大屏宽屏阅读疲劳) -->
      <div class="setting-group">
        <div class="group-title">正文版心宽度 (桌面端)</div>
        <div class="width-selector-row">
          <button
            v-for="w in [640, 800, 960, 1200]"
            :key="w"
            class="width-btn"
            :class="{ active: readerStore.readWidth === w }"
            @click="readerStore.setReadWidth(w)"
          >
            {{ w }}px
          </button>
        </div>
      </div>

      <!-- 6. 书法与排版字体切片 -->
      <div class="setting-group">
        <div class="group-title">排版字体</div>
        <div class="font-options-row">
          <button
            v-for="f in FONT_OPTIONS"
            :key="f.id"
            class="font-btn"
            :class="{ active: readerStore.fontId === f.id }"
            @click="readerStore.setFont(f.id)"
          >
            {{ f.name }}
          </button>
        </div>
      </div>

      <!-- 7. 伴读白噪音 (用户在后台/设置自主按需开启，不强占阅读底部空间) -->
      <div class="setting-group ambient-group">
        <div class="ambient-header-line">
          <div class="group-title">🎧 伴读白噪音 (自主开启)</div>
          <el-switch
            v-model="ambientEnabled"
            @change="handleAmbientToggle"
            active-text="开启伴读"
          />
        </div>
        <div v-if="ambientEnabled" class="ambient-controls-box">
          <AmbientPlayer />
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useReaderStore } from '../stores/reader';
import { FONT_OPTIONS } from '../utils/fontLoader';
import AmbientPlayer from './AmbientPlayer.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const readerStore = useReaderStore();
const ambientEnabled = ref(Boolean(readerStore.ambientTrack));

// 移植原版 reader 7 款经典经典阅读配色
const THEME_LIST = [
  { id: 0, name: '雅致米白', bg: '#faf5eb', color: '#262626', border: '#e8dec8' },
  { id: 1, name: '复古羊皮', bg: '#f5eacd', color: '#332a1e', border: '#e6d3a5' },
  { id: 2, name: '清新护眼', bg: '#e6f2e6', color: '#1c301c', border: '#cce2cc' },
  { id: 3, name: '淡雅海蓝', bg: '#e4f1f5', color: '#1f2d33', border: '#c7e0e8' },
  { id: 4, name: '暖粉少女', bg: '#f5e4e4', color: '#382323', border: '#e8c9c9' },
  { id: 5, name: '素灰静读', bg: '#e0e0e0', color: '#222222', border: '#cccccc' },
  { id: 6, name: '纯黑夜间', bg: '#121212', color: '#8c8c8c', border: '#2a2a2a' }
];

function changeLineHeight(delta) {
  const newVal = Math.max(1.2, Math.min(3.0, parseFloat((readerStore.lineHeight + delta).toFixed(1))));
  readerStore.setLineHeight(newVal);
}

function changeParagraphSpacing(delta) {
  const newVal = Math.max(0, Math.min(40, readerStore.paragraphSpacing + delta));
  readerStore.setParagraphSpacing(newVal);
}

function handleAmbientToggle(val) {
  if (!val && readerStore.ambientTrack) {
    readerStore.toggleAmbient(readerStore.ambientTrack);
  }
}
</script>

<style scoped>
.read-settings-drawer :deep(.el-drawer__body) {
  padding: 16px 20px 32px;
  max-width: 680px;
  margin: 0 auto;
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #1e293b);
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-group-split {
  display: flex;
  gap: 16px;
}

.half-group {
  flex: 1;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.3px;
}

.mode-capsule-row {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  padding: 9px 8px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.mode-btn:hover {
  border-color: #10b981;
}

.mode-btn.active {
  background: #10b981;
  border-color: #10b981;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.24);
}

.theme-palette-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

@media (max-width: 500px) {
  .theme-palette-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.theme-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.18s;
}

.theme-swatch.active {
  outline: 2px solid #10b981;
  outline-offset: 1px;
}

.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stepper-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: #f8fafc;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.step-btn.text-btn {
  flex: 1;
  text-align: center;
}

.step-btn.text-btn.active {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.step-val {
  min-width: 60px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.width-selector-row, .font-options-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.width-btn, .font-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s;
}

.width-btn.active, .font-btn.active {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
  font-weight: 600;
}

.ambient-group {
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 14px;
}

.ambient-header-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ambient-controls-box {
  margin-top: 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.05);
  padding: 8px;
}
</style>
