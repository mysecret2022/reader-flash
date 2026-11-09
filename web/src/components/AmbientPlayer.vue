<template>
  <div class="ambient-player glass-card">
    <div class="player-header">
      <span class="ambient-title">🎧 白噪音伴读环境音</span>
      <span v-if="readerStore.ambientTrack" class="active-tag">播放中</span>
    </div>

    <div class="sound-grid">
      <button
        v-for="sound in sounds"
        :key="sound.id"
        class="sound-btn"
        :class="{ active: readerStore.ambientTrack === sound.id }"
        @click="readerStore.toggleAmbient(sound.id)"
      >
        <span class="sound-icon">{{ sound.icon }}</span>
        <span class="sound-name">{{ sound.name }}</span>
      </button>
    </div>

    <!-- 音量调节滑块 -->
    <div v-if="readerStore.ambientTrack" class="volume-slider-box">
      <span class="vol-label">🔈</span>
      <el-slider
        v-model="volumePercent"
        :min="0"
        :max="100"
        :show-tooltip="false"
        @input="onVolumeChange"
      />
      <span class="vol-label">🔊</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useReaderStore } from '../stores/reader';

const readerStore = useReaderStore();

const sounds = [
  { id: 'rain', icon: '🌧️', name: '窗外夜雨' },
  { id: 'fire', icon: '🔥', name: '壁炉柴响' },
  { id: 'cicada', icon: '🦗', name: '深夜夏蝉' },
  { id: 'wind', icon: '🍃', name: '森林微风' }
];

const volumePercent = computed({
  get: () => Math.round(readerStore.ambientVolume * 100),
  set: (val) => readerStore.setAmbientVolume(val / 100)
});

function onVolumeChange(val) {
  readerStore.setAmbientVolume(val / 100);
}
</script>

<style scoped>
.ambient-player {
  padding: 12px 14px;
  border-radius: 12px;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ambient-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.active-tag {
  font-size: 10px;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  padding: 1px 6px;
  border-radius: 9999px;
  font-weight: 600;
}

.sound-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.sound-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(148, 163, 184, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sound-btn:hover {
  background: rgba(16, 185, 129, 0.08);
}

.sound-btn.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
}

.sound-icon {
  font-size: 18px;
}

.sound-name {
  font-size: 11px;
  color: #475569;
}

.sound-btn.active .sound-name {
  color: #059669;
  font-weight: 600;
}

.volume-slider-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 0 4px;
}

.vol-label {
  font-size: 12px;
}
</style>
