import { defineStore } from 'pinia';
import { applyFont } from '../utils/fontLoader';
import { ambientSound } from '../utils/ambientSound';

const STORAGE_KEY = 'reader_flash_settings';

export const useReaderStore = defineStore('reader', {
  state: () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      theme: saved.theme !== undefined ? saved.theme : 0, // 0白天, 1羊皮纸, 2护眼绿, 3暗黑
      fontId: saved.fontId !== undefined ? saved.fontId : 0, // 默认系统原生字体(0MB)
      fontSize: saved.fontSize || 18,
      lineHeight: saved.lineHeight || 1.8,
      paragraphSpacing: saved.paragraphSpacing || 16,
      pageMode: saved.pageMode || 'simulation', // 'scroll' | 'slide' | 'simulation'
      ambientTrack: null,
      ambientVolume: saved.ambientVolume !== undefined ? saved.ambientVolume : 0.5,
      ttsVoice: saved.ttsVoice || 'zh-CN-YunxiNeural',
      ttsSpeed: saved.ttsSpeed || 1.0,
      autoCleanAd: saved.autoCleanAd !== undefined ? saved.autoCleanAd : true
    };
  },

  actions: {
    saveSettings() {
      const { theme, fontId, fontSize, lineHeight, paragraphSpacing, pageMode, ambientVolume, ttsVoice, ttsSpeed, autoCleanAd } = this;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme, fontId, fontSize, lineHeight, paragraphSpacing, pageMode, ambientVolume, ttsVoice, ttsSpeed, autoCleanAd
      }));
    },

    setTheme(themeId) {
      this.theme = themeId;
      this.saveSettings();
    },

    setFont(fontId) {
      this.fontId = fontId;
      applyFont(fontId);
      this.saveSettings();
    },

    setFontSize(size) {
      this.fontSize = Math.max(12, Math.min(36, size));
      this.saveSettings();
    },

    setLineHeight(lh) {
      this.lineHeight = lh;
      this.saveSettings();
    },

    setParagraphSpacing(ps) {
      this.paragraphSpacing = ps;
      this.saveSettings();
    },

    setPageMode(mode) {
      this.pageMode = mode;
      this.saveSettings();
    },

    toggleAmbient(track) {
      if (this.ambientTrack === track) {
        ambientSound.stop();
        this.ambientTrack = null;
      } else {
        ambientSound.play(track);
        ambientSound.setVolume(this.ambientVolume);
        this.ambientTrack = track;
      }
    },

    setAmbientVolume(vol) {
      this.ambientVolume = vol;
      ambientSound.setVolume(vol);
      this.saveSettings();
    },

    initReaderEnvironment() {
      // 启动时按需加载字体
      applyFont(this.fontId);
    }
  }
});
