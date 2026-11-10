/**
 * reader-flash 纯客户端 Web Audio API 白噪音伴读合成器
 * 零网络下载、零服务器带宽消耗、断网与飞行模式全功能可用
 * 内置：窗外夜雨、炉火柴响、深夜夏蝉、森林微风
 */

class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.currentTrack = null;
    this.nodes = [];
    this.timer = null;
    this.volume = 0.5;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.nodes.forEach(n => {
      try {
        if (n.stop) n.stop();
        n.disconnect();
      } catch (e) {}
    });
    this.nodes = [];
    this.currentTrack = null;
  }

  play(trackName) {
    this.init();
    if (!this.ctx) return;

    if (this.currentTrack === trackName) {
      this.stop();
      return false;
    }

    this.stop();
    this.currentTrack = trackName;

    switch (trackName) {
      case 'rain':
        this.createRain();
        break;
      case 'fire':
        this.createFire();
        break;
      case 'cicada':
        this.createCicada();
        break;
      case 'wind':
        this.createWind();
        break;
      default:
        break;
    }
    return true;
  }

  // 1. 窗外夜雨（粉红噪声 + 柔和低通滤波）
  createRain() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start();
    this.nodes.push(whiteNoise, filter);
  }

  // 2. 壁炉柴火（温暖低频 + 随机噼啪脆响）
  createFire() {
    this.createWind(280, 0.4); // 暖炉轰鸣底噪

    // 随机噼啪碎爆音
    this.timer = setInterval(() => {
      if (!this.ctx || this.currentTrack !== 'fire') return;
      if (Math.random() > 0.4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120 + Math.random() * 400, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.3 * Math.random(), this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      }
    }, 150);
  }

  // 3. 深夜夏蝉（高频周期颤音）
  createCicada() {
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(4500, this.ctx.currentTime);

    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(16, this.ctx.currentTime);
    modGain.gain.setValueAtTime(1200, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    mod.start();
    this.nodes.push(osc, mod, modGain, gain);
  }

  // 4. 森林微风（深沉布朗噪声 + 舒缓呼吸起伏）
  createWind(cutoff = 380, vol = 0.5) {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const brownNoise = this.ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.15, this.ctx.currentTime);

    brownNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    brownNoise.start();
    this.nodes.push(brownNoise, filter, gain);
  }
}

export const ambientSound = new AmbientSoundEngine();
