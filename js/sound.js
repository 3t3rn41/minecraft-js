/**
 * sound.js — 程序化音效系统（Web Audio API）
 * 无需外部音频文件，所有音效用振荡器和噪声实时合成
 */

export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this.initialized = false;
  }

  // 初始化音频上下文（必须在用户交互后调用）
  init() {
    if (this.initialized) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('音频系统初始化失败:', e);
      this.enabled = false;
    }
  }

  // 恢复音频上下文（浏览器策略要求用户交互后才能播放）
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // ===== 基础音效合成 =====

  // 播放一个简单的音调
  tone(freq, duration, type = 'square', gain = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // 播放噪声（用于破坏、脚步等）
  noise(duration, gain = 0.2, filterFreq = 1000) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    source.start();
  }

  // 频率扫描
  sweep(startFreq, endFreq, duration, type = 'square', gain = 0.2) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // ===== 游戏音效 =====

  // 挖掘方块
  dig(blockId) {
    if (!this.enabled || !this.ctx) return;
    // 不同方块不同音调
    const freq = 150 + (blockId % 10) * 20;
    this.noise(0.08, 0.15, 800);
    this.tone(freq, 0.08, 'square', 0.1);
  }

  // 破坏方块
  break(blockId) {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.15, 0.25, 600);
    this.tone(100 + (blockId % 5) * 30, 0.1, 'sawtooth', 0.12);
  }

  // 放置方块
  place(blockId) {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.06, 0.12, 1200);
    this.tone(300 + (blockId % 5) * 40, 0.06, 'square', 0.1);
  }

  // 跳跃
  jump() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(200, 400, 0.1, 'sine', 0.08);
  }

  // 落地
  land() {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.1, 0.15, 400);
  }

  // 受伤
  hurt() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(400, 100, 0.2, 'sawtooth', 0.2);
  }

  // 攻击
  attack() {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.05, 0.2, 2000);
    this.tone(800, 0.05, 'square', 0.1);
  }

  // 拾取物品
  pickup() {
    if (!this.enabled || !this.ctx) return;
    this.tone(800, 0.05, 'sine', 0.15);
    setTimeout(() => this.tone(1200, 0.05, 'sine', 0.15), 50);
  }

  // 吃食物
  eat() {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.1, 0.1, 500);
    setTimeout(() => this.noise(0.1, 0.1, 500), 150);
  }

  // 入水
  splash() {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.2, 0.2, 800);
  }

  // 切换快捷栏
  click() {
    if (!this.enabled || !this.ctx) return;
    this.tone(600, 0.03, 'sine', 0.05);
  }

  // 打开/关闭背包
  inventory() {
    if (!this.enabled || !this.ctx) return;
    this.tone(400, 0.05, 'sine', 0.1);
    setTimeout(() => this.tone(600, 0.05, 'sine', 0.1), 50);
  }

  // 等级提升
  levelUp() {
    if (!this.enabled || !this.ctx) return;
    this.tone(523, 0.1, 'sine', 0.15);
    setTimeout(() => this.tone(659, 0.1, 'sine', 0.15), 100);
    setTimeout(() => this.tone(784, 0.15, 'sine', 0.15), 200);
  }

  // 爆炸
  explosion() {
    if (!this.enabled || !this.ctx) return;
    this.noise(0.5, 0.4, 300);
    this.sweep(80, 20, 0.5, 'sawtooth', 0.2);
  }

  // 钓鱼抛竿
  fishCast() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(600, 200, 0.15, 'sine', 0.1);
  }

  // 钓鱼咬钩
  fishBite() {
    if (!this.enabled || !this.ctx) return;
    this.splash();
    setTimeout(() => this.tone(880, 0.1, 'sine', 0.15), 100);
  }

  // 弓箭射击
  bow() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(800, 300, 0.15, 'sine', 0.15);
    this.noise(0.05, 0.1, 2000);
  }

  // 弩射击
  crossbow() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(1000, 200, 0.1, 'square', 0.15);
    this.noise(0.06, 0.12, 2500);
  }

  // 三叉戟投掷
  trident() {
    if (!this.enabled || !this.ctx) return;
    this.sweep(300, 600, 0.2, 'sine', 0.12);
  }
}
