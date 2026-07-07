/**
 * music.js — 程序化音乐与音效系统
 * 使用 Web Audio API 生成游戏音效和背景音乐
 */

// 音符频率（C4 = 261.63Hz）
const NOTE_FREQ = {
  C0: 16.35, Cs0: 17.32, D0: 18.35, Ds0: 19.45, E0: 20.60, F0: 21.83, Fs0: 23.12, G0: 24.50, Gs0: 25.96, A0: 27.50, As0: 29.14, B0: 30.87,
  C1: 32.70, Cs1: 34.65, D1: 36.71, Ds1: 38.89, E1: 41.20, F1: 43.65, Fs1: 46.25, G1: 49.00, Gs1: 51.91, A1: 55.00, As1: 58.27, B1: 61.74,
  C2: 65.41, Cs2: 69.30, D2: 73.42, Ds2: 77.78, E2: 82.41, F2: 87.31, Fs2: 92.50, G2: 98.00, Gs2: 103.83, A2: 110.00, As2: 116.54, B2: 123.47,
  C3: 130.81, Cs3: 138.59, D3: 146.83, Ds3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, Gs3: 207.65, A3: 220.00, As3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, D4: 293.66, Ds4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Gs4: 415.30, A4: 440.00, As4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, Ds5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Gs5: 830.61, A5: 880.00, As5: 932.33, B5: 987.77,
  C6: 1046.50, Cs6: 1108.73, D6: 1174.66, Ds6: 1244.51, E6: 1318.51, F6: 1396.91, Fs6: 1479.98, G6: 1567.98, Gs6: 1661.22, A6: 1760.00, As6: 1864.66, B6: 1975.53,
};

// 音效类型
export const SOUND = {
  // 方块
  BLOCK_BREAK: 'block_break',
  BLOCK_PLACE: 'block_place',
  BLOCK_STEP: 'block_step',
  // 玩家
  PLAYER_HURT: 'player_hurt',
  PLAYER_DEATH: 'player_death',
  PLAYER_LEVELUP: 'player_levelup',
  EAT: 'eat',
  DRINK: 'drink',
  // 战斗
  ATTACK: 'attack',
  ATTACK_CRIT: 'attack_crit',
  BOW_SHOOT: 'bow_shoot',
  ARROW_HIT: 'arrow_hit',
  EXPLOSION: 'explosion',
  // 环境
  SPLASH: 'splash',
  SWIM: 'swim',
  RAIN: 'rain',
  THUNDER: 'thunder',
  FIRE: 'fire',
  // 生物
  MOB_HURT: 'mob_hurt',
  MOB_DEATH: 'mob_death',
  // UI
  CLICK: 'click',
  TOAST: 'toast',
  CHEST_OPEN: 'chest_open',
  CHEST_CLOSE: 'chest_close',
  // 特殊
  PORTAL: 'portal',
  ENCHANT: 'enchant',
  TELEPORT: 'teleport',
  GLASS_BREAK: 'glass_break',
  FISHING_BITE: 'fishing_bite',
  LEVEL_UP: 'level_up',
  NOTE_BLOCK: 'note_block',
};

export class MusicSystem {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.5;
    this.musicEnabled = true;
    this.musicVolume = 0.3;
    this.currentMusic = null;
    this.musicTimer = 0;
    this.musicInterval = 120; // 每2分钟播放一首
    this.noteBlockInstruments = ['piano', 'bass', 'snare', 'hat', 'bass_drum', 'bell', 'flute', 'guitar', 'xylophone'];
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not available');
      this.enabled = false;
    }
  }

  // 确保上下文已初始化
  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 播放音效
  playSound(type, x = 0, y = 0, z = 0, volume = 1, pitch = 1) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    // 距离衰减
    const player = this.game.player;
    if (player) {
      const dx = x - player.position.x;
      const dy = y - player.position.y;
      const dz = z - player.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 32) return; // 超过32格不播放
      volume *= Math.max(0.1, 1 - dist / 32);
    }

    switch (type) {
      case SOUND.BLOCK_BREAK: this.playBlockBreak(volume, pitch); break;
      case SOUND.BLOCK_PLACE: this.playBlockPlace(volume, pitch); break;
      case SOUND.PLAYER_HURT: this.playPlayerHurt(volume, pitch); break;
      case SOUND.ATTACK: this.playAttack(volume, pitch); break;
      case SOUND.BOW_SHOOT: this.playBowShoot(volume, pitch); break;
      case SOUND.ARROW_HIT: this.playArrowHit(volume, pitch); break;
      case SOUND.EXPLOSION: this.playExplosion(volume, pitch); break;
      case SOUND.SPLASH: this.playSplash(volume, pitch); break;
      case SOUND.THUNDER: this.playThunder(volume, pitch); break;
      case SOUND.RAIN: this.playRain(volume); break;
      case SOUND.CLICK: this.playClick(volume, pitch); break;
      case SOUND.TOAST: this.playToast(volume, pitch); break;
      case SOUND.CHEST_OPEN: this.playChestOpen(volume, pitch); break;
      case SOUND.CHEST_CLOSE: this.playChestClose(volume, pitch); break;
      case SOUND.TELEPORT: this.playTeleport(volume, pitch); break;
      case SOUND.GLASS_BREAK: this.playGlassBreak(volume, pitch); break;
      case SOUND.FISHING_BITE: this.playFishingBite(volume, pitch); break;
      case SOUND.LEVEL_UP: this.playLevelUp(volume, pitch); break;
      case SOUND.ENCHANT: this.playEnchant(volume, pitch); break;
      case SOUND.PORTAL: this.playPortal(volume, pitch); break;
      case SOUND.NOTE_BLOCK: this.playNoteBlock(volume, pitch); break;
      case SOUND.PLAYER_DEATH: this.playPlayerDeath(volume, pitch); break;
      case SOUND.MOB_HURT: this.playMobHurt(volume, pitch); break;
      case SOUND.MOB_DEATH: this.playMobDeath(volume, pitch); break;
      case SOUND.FIRE: this.playFire(volume); break;
    }
  }

  // 通用合成器：播放一个简单音色
  playTone(freq, duration, type = 'sine', volume = 1, attack = 0.01, decay = 0.1) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  // 噪音生成器
  playNoise(duration, volume = 1, filterFreq = 1000, filterType = 'lowpass') {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration);
  }

  // === 具体音效实现 ===

  playBlockBreak(volume, pitch) {
    this.playNoise(0.15, volume * 0.5, 800 + pitch * 200);
    this.playTone(150 * pitch, 0.1, 'square', volume * 0.3);
  }

  playBlockPlace(volume, pitch) {
    this.playTone(200 * pitch, 0.08, 'square', volume * 0.4);
    this.playNoise(0.08, volume * 0.3, 600);
  }

  playPlayerHurt(volume, pitch) {
    this.playTone(200 * pitch, 0.15, 'sawtooth', volume * 0.5);
    this.playTone(150 * pitch, 0.2, 'sine', volume * 0.3);
  }

  playPlayerDeath(volume, pitch) {
    this.playTone(300 * pitch, 0.3, 'sawtooth', volume * 0.4);
    setTimeout(() => this.playTone(200 * pitch, 0.4, 'sawtooth', volume * 0.3), 100);
    setTimeout(() => this.playTone(100 * pitch, 0.6, 'sine', volume * 0.3), 300);
  }

  playAttack(volume, pitch) {
    this.playNoise(0.08, volume * 0.4, 2000, 'highpass');
    this.playTone(400 * pitch, 0.05, 'square', volume * 0.2);
  }

  playBowShoot(volume, pitch) {
    this.playTone(800 * pitch, 0.05, 'sine', volume * 0.3);
    setTimeout(() => this.playTone(600 * pitch, 0.08, 'sine', volume * 0.2), 30);
  }

  playArrowHit(volume, pitch) {
    this.playNoise(0.1, volume * 0.5, 3000, 'highpass');
    this.playTone(300 * pitch, 0.08, 'square', volume * 0.2);
  }

  playExplosion(volume, pitch) {
    this.playNoise(0.5, volume * 0.8, 200, 'lowpass');
    this.playTone(80 * pitch, 0.4, 'sawtooth', volume * 0.5);
    setTimeout(() => this.playNoise(0.3, volume * 0.3, 100), 50);
  }

  playSplash(volume, pitch) {
    this.playNoise(0.3, volume * 0.4, 4000, 'highpass');
    this.playTone(400 * pitch, 0.1, 'sine', volume * 0.2);
  }

  playThunder(volume, pitch) {
    this.playNoise(1.0, volume * 0.8, 200, 'lowpass');
    this.playTone(60 * pitch, 0.8, 'sawtooth', volume * 0.6);
  }

  playRain(volume) {
    this.playNoise(0.5, volume * 0.15, 6000, 'highpass');
  }

  playFire(volume) {
    this.playNoise(0.3, volume * 0.2, 2000, 'bandpass');
  }

  playClick(volume, pitch) {
    this.playTone(600 * pitch, 0.03, 'square', volume * 0.3);
  }

  playToast(volume, pitch) {
    this.playTone(523 * pitch, 0.05, 'sine', volume * 0.3);
    setTimeout(() => this.playTone(659 * pitch, 0.05, 'sine', volume * 0.3), 50);
  }

  playChestOpen(volume, pitch) {
    this.playTone(300 * pitch, 0.1, 'square', volume * 0.3);
    setTimeout(() => this.playTone(400 * pitch, 0.1, 'square', volume * 0.2), 80);
  }

  playChestClose(volume, pitch) {
    this.playTone(400 * pitch, 0.1, 'square', volume * 0.3);
    setTimeout(() => this.playTone(300 * pitch, 0.1, 'square', volume * 0.2), 80);
  }

  playTeleport(volume, pitch) {
    this.playTone(800 * pitch, 0.05, 'sine', volume * 0.3);
    setTimeout(() => this.playTone(1000 * pitch, 0.05, 'sine', volume * 0.3), 30);
    setTimeout(() => this.playTone(1200 * pitch, 0.05, 'sine', volume * 0.3), 60);
  }

  playGlassBreak(volume, pitch) {
    this.playNoise(0.2, volume * 0.5, 6000, 'highpass');
    this.playTone(2000 * pitch, 0.1, 'sine', volume * 0.2);
  }

  playFishingBite(volume, pitch) {
    this.playTone(400 * pitch, 0.05, 'sine', volume * 0.3);
    setTimeout(() => this.playTone(600 * pitch, 0.05, 'sine', volume * 0.3), 50);
  }

  playLevelUp(volume, pitch) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f * pitch, 0.15, 'sine', volume * 0.3), i * 80);
    });
  }

  playEnchant(volume, pitch) {
    this.playTone(400 * pitch, 0.3, 'sine', volume * 0.2);
    setTimeout(() => this.playTone(500 * pitch, 0.3, 'sine', volume * 0.2), 100);
    setTimeout(() => this.playTone(600 * pitch, 0.3, 'sine', volume * 0.2), 200);
  }

  playPortal(volume, pitch) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.playTone((200 + i * 100) * pitch, 0.2, 'sine', volume * 0.2), i * 50);
    }
  }

  playMobHurt(volume, pitch) {
    this.playTone(150 * pitch, 0.1, 'sawtooth', volume * 0.4);
  }

  playMobDeath(volume, pitch) {
    this.playTone(100 * pitch, 0.3, 'sawtooth', volume * 0.4);
    setTimeout(() => this.playTone(60 * pitch, 0.3, 'sine', volume * 0.3), 100);
  }

  playNoteBlock(volume, pitch, instrument = 'piano') {
    const freq = 261.63 * Math.pow(2, (pitch - 12) / 12);
    const type = {
      piano: 'sine',
      bass: 'sine',
      snare: 'sawtooth',
      hat: 'square',
      bass_drum: 'sine',
      bell: 'sine',
      flute: 'sine',
      guitar: 'triangle',
      xylophone: 'triangle',
    }[instrument] || 'sine';

    if (instrument === 'snare' || instrument === 'hat' || instrument === 'bass_drum') {
      this.playNoise(0.1, volume * 0.5, instrument === 'snare' ? 3000 : 500, instrument === 'bass_drum' ? 'lowpass' : 'highpass');
    } else {
      this.playTone(freq, 0.3, type, volume * 0.4);
    }
  }

  // === 背景音乐 ===
  // 程序化生成简单的背景音乐
  playBackgroundMusic() {
    if (!this.enabled || !this.musicEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    // 简单的旋律：C大调
    const melody = [
      NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5,
      NOTE_FREQ.B4, NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.C4,
      NOTE_FREQ.D4, NOTE_FREQ.F4, NOTE_FREQ.A4, NOTE_FREQ.D5,
      NOTE_FREQ.C5, NOTE_FREQ.A4, NOTE_FREQ.F4, NOTE_FREQ.D4,
      NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5, NOTE_FREQ.E5,
      NOTE_FREQ.D5, NOTE_FREQ.B4, NOTE_FREQ.G4, NOTE_FREQ.E4,
      NOTE_FREQ.C4, NOTE_FREQ.E4, NOTE_FREQ.G4, NOTE_FREQ.C5,
      NOTE_FREQ.G4, NOTE_FREQ.E4, NOTE_FREQ.C4, 0,
    ];

    const bassLine = [
      NOTE_FREQ.C2, NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.G2,
      NOTE_FREQ.A2, NOTE_FREQ.A2, NOTE_FREQ.F2, NOTE_FREQ.F2,
      NOTE_FREQ.C2, NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.G2,
      NOTE_FREQ.C2, NOTE_FREQ.C2, NOTE_FREQ.G2, NOTE_FREQ.G2,
    ];

    const noteDuration = 0.3;
    let noteIndex = 0;

    const playNext = () => {
      if (!this.currentMusic) return;

      const freq = melody[noteIndex % melody.length];
      if (freq > 0) {
        this.playTone(freq, noteDuration * 0.9, 'sine', this.musicVolume * 0.3);
        // 和弦
        this.playTone(freq * 1.5, noteDuration * 0.9, 'sine', this.musicVolume * 0.15);
      }

      // 贝斯
      const bassFreq = bassLine[Math.floor(noteIndex / 2) % bassLine.length];
      if (noteIndex % 2 === 0 && bassFreq > 0) {
        this.playTone(bassFreq, noteDuration * 1.8, 'triangle', this.musicVolume * 0.2);
      }

      noteIndex++;
      this.currentMusic = setTimeout(playNext, noteDuration * 1000);
    };

    this.currentMusic = setTimeout(playNext, 0);
  }

  stopMusic() {
    if (this.currentMusic) {
      clearTimeout(this.currentMusic);
      this.currentMusic = null;
    }
  }

  update(dt) {
    if (this.musicEnabled && !this.currentMusic) {
      this.musicTimer += dt;
      if (this.musicTimer >= this.musicInterval) {
        this.musicTimer = 0;
        this.playBackgroundMusic();
        // 音乐播放约30秒后自动停止
        setTimeout(() => this.stopMusic(), 30000);
      }
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
  }
}
