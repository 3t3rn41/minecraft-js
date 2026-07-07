/**
 * game.js — 游戏主控制器
 * 整合所有子系统：渲染、世界、玩家、输入、UI、生物、多人联机
 */

import * as THREE from 'three';
import { World } from './world.js';
import { Player, PLAYER_EYE } from './player.js';
import { Input } from './input.js';
import { Sky } from './sky.js';
import { UI } from './ui.js';
import { MobManager } from './mobs.js';
import { SaveManager } from './save.js';
import { Multiplayer } from './multiplayer.js';
import {
  BLOCK, BLOCK_DEFS, CHUNK_SIZE, CHUNK_HEIGHT,
  generateTextureAtlas, PLACEABLE_BLOCKS
} from './blocks.js';
import { GAMEMODE, GAMEMODE_NAMES, GAMEMODE_CONFIG, generateSkyblockIsland } from './gamemodes.js';
import { CommandSystem } from './commands.js';
import { WeatherSystem } from './weather.js';
import { EffectsManager } from './effects.js';
import { AchievementSystem } from './achievements.js';
import { MinigameManager, MINIGAME } from './mpegamodes.js';
import { RedstoneSystem } from './redstone.js';
import { EnchantmentSystem } from './enchant.js';
import { BrewingSystem, updatePlayerEffects } from './brewing.js';
import { FarmingSystem } from './farming.js';
import { FishingSystem } from './fishing.js';
import { RangedSystem } from './ranged.js';
import { MobileControls, isMobileDevice } from './mobile.js';
import { SoundSystem } from './sound.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.world = null;
    this.player = null;
    this.input = null;
    this.sky = null;
    this.ui = null;
    this.mobs = null;
    this.save = null;
    this.multiplayer = null;

    this.settings = {
      renderDistance: 5,
      sensitivity: 1.5,
      fog: true,
      fov: 75,
      showFPS: true,
    };

    // 移动端性能优化：降低渲染距离和像素比
    if (isMobileDevice()) {
      this.settings.renderDistance = 4;
      this.settings.fov = 70;
    }

    this.seed = Date.now();
    this.running = false;
    this.lastTime = 0;
    this.fps = 0;
    this.fpsCounter = 0;
    this.fpsTimer = 0;

    // 挖掘进度
    this.miningProgress = 0;
    this.miningTarget = null;

    // 材质
    this.blockMaterial = null;
    this.waterMaterial = null;

    // 高亮线框
    this.highlightBox = null;

    // 聊天
    this.chat = null;

    // 新系统
    this.weather = null;
    this.effects = null;
    this.achievements = null;
    this.commands = null;
    this.minigames = null;
    this.redstone = null;
    this.enchanting = null;
    this.brewing = null;
    this.farming = null;
    this.fishing = null;
    this.ranged = null;
    this.mobile = null;
    this.isMobile = false;
    this.sound = null;
    this.difficulty = 2; // 0=peaceful, 1=easy, 2=normal, 3=hard
    this.spawnPoint = { x: 0, y: 40, z: 0 };
    this.gamemode = GAMEMODE.SURVIVAL;
    this.nightSurvived = false;
    this.lastDeathPos = null;
  }

  async init(loadSave = false, multiplayerMode = null, gamemode = GAMEMODE.SURVIVAL) {
    this.gamemode = gamemode;

    // 加载存档
    this.save = new SaveManager();
    let saveData = null;
    if (loadSave && this.save.hasSave) {
      saveData = this.save.load();
      if (saveData) {
        this.seed = saveData.seed;
        if (saveData.settings) {
          this.settings = { ...this.settings, ...saveData.settings };
        }
      }
    }

    // 初始化 Three.js
    this.initThree();

    // 初始化纹理
    const atlas = generateTextureAtlas(THREE);

    // 创建材质 — 使用 alphaTest 使花草等植物方块的透明像素被正确剔除
    this.blockMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: false,
      alphaTest: 0.5,
    });

    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 创建世界
    this.world = new World(this.seed);

    // 创建音效系统（在玩家之前初始化）
    this.sound = new SoundSystem();
    this.sound.init();
    const resumeAudio = () => {
      if (this.sound) this.sound.resume();
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('touchend', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('touchend', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    // 应用存档修改
    if (saveData && saveData.modifiedBlocks) {
      for (const [key, blockId] of saveData.modifiedBlocks) {
        this.world.modifiedBlocks.set(key, blockId);
      }
    }

    // 创建玩家
    this.player = new Player(this.world);
    this.player.setGamemode(gamemode);
    this.player.sound = this.sound;

    // 应用存档玩家数据
    if (saveData && saveData.player) {
      this.player.deserialize(saveData.player);
    } else {
      // 找到出生点
      if (gamemode === GAMEMODE.SKYBLOCK) {
        generateSkyblockIsland(this.world);
        this.player.position = { x: 0.5, y: 45, z: 0.5 };
      } else {
        await this.findSpawnPoint();
      }
    }
    this.spawnPoint = { ...this.player.position };

    // 创建输入
    this.input = new Input(this.canvas);

    // 创建天空
    this.sky = new Sky(this.scene, this.renderer);
    if (saveData && saveData.sky) {
      this.sky.setTime(saveData.sky.time);
    }

    // 创建 UI
    this.ui = new UI(this);

    // 创建生物管理
    this.mobs = new MobManager(this);

    // 创建特效管理
    this.effects = new EffectsManager(this);

    // 创建天气系统
    this.weather = new WeatherSystem(this.scene, this.sky, this);

    // 创建成就系统
    this.achievements = new AchievementSystem(this);

    // 创建指令系统
    this.commands = new CommandSystem(this);

    // 创建小游戏管理
    this.minigames = new MinigameManager(this);

    // 创建红石系统
    this.redstone = new RedstoneSystem(this);

    // 创建附魔系统
    this.enchanting = new EnchantmentSystem(this);

    // 创建酿造系统
    this.brewing = new BrewingSystem(this);

    // 创建农耕系统
    this.farming = new FarmingSystem(this);

    // 创建钓鱼系统
    this.fishing = new FishingSystem(this);

    // 创建远程武器系统
    this.ranged = new RangedSystem(this);

    // 创建移动端控制系统
    this.isMobile = isMobileDevice();
    if (this.isMobile) {
      this.mobile = new MobileControls(this);
      // 移动端不使用指针锁定
      this._skipPointerLock = true;
    }

    // 创建高亮框
    this.createHighlightBox();

    // 多人联机 + 聊天（单人也可用指令）
    this.initChat();
    if (multiplayerMode) {
      this.multiplayer = new Multiplayer(this);
      this.achievements.onMultiplayerJoin();
    }

    // 应用设置
    this.applySettings(this.settings);

    // 预加载初始区块
    await this.preloadChunks();

    // 启动游戏循环
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();

    // 请求指针锁定（PC端）
    if (!this.isMobile) {
      this.input.requestPointerLock();
    }
  }

  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // 移动端降低像素比以提升性能
    const maxPixelRatio = isMobileDevice() ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async findSpawnPoint() {
    // 生成出生点附近的区块
    const cx = 0, cz = 0;
    this.world.getChunk(cx, cz);

    // 找到地面高度
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = this.world.getBlock(0, y, 0);
      if (block !== 0 && block !== BLOCK.WATER) {
        this.player.position = { x: 0.5, y: y + 1, z: 0.5 };
        break;
      }
    }
  }

  async preloadChunks() {
    const rd = this.settings.renderDistance;
    const px = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pz = Math.floor(this.player.position.z / CHUNK_SIZE);

    let loaded = 0;
    const total = (rd * 2 + 1) * (rd * 2 + 1);
    const loadingFill = document.getElementById('loading-fill');
    const loadingText = document.getElementById('loading-text');

    // 螺旋加载
    for (let r = 0; r <= rd; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r && r > 0) continue;
          const cx = px + dx;
          const cz = pz + dz;
          this.world.getChunk(cx, cz);
          loaded++;
          if (loadingFill) {
            loadingFill.style.width = `${(loaded / total) * 100}%`;
          }
          if (loadingText) {
            loadingText.textContent = `${Math.floor((loaded / total) * 100)}%`;
          }
        }
      }
      // 让浏览器有时间渲染加载界面
      await new Promise(r => setTimeout(r, 0));
    }

    // 构建初始网格
    for (const chunk of this.world.getAllChunks()) {
      chunk.buildMesh(this.scene, this.world, this.blockMaterial, this.waterMaterial);
    }

    // 隐藏加载界面
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.classList.add('hidden');
  }

  createHighlightBox() {
    const geom = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geom);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.highlightBox = new THREE.LineSegments(edges, mat);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);
  }

  // ===== 游戏主循环 =====
  gameLoop = () => {
    if (!this.running) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // 限制 dt 防止大跳跃
    if (dt > 0.1) dt = 0.1;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.gameLoop);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  update(dt) {
    // 移动端控件更新
    if (this.mobile) {
      this.mobile.update(dt);
    }

    // FPS 计算
    this.fpsCounter++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsCounter / this.fpsTimer);
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    // 菜单打开时的快捷键处理
    if (this.ui.isAnyMenuOpen()) {
      // 移动端隐藏触摸控件
      if (this.mobile) this.mobile.setVisible(false);
      // Escape 关闭菜单
      if (this.input.consumeKey('Escape')) {
        if (this.ui.inventoryOpen) {
          this.ui.closeInventory();
        } else if (this.ui.paused) {
          if (this.ui.settingsOpen) {
            this.ui.hidePauseSettings();
          } else {
            this.ui.resume();
          }
        }
      }
      // E 关闭背包
      if (this.input.consumeKey('KeyE') && this.ui.inventoryOpen) {
        this.ui.closeInventory();
      }
      this.ui.updateInfo(this.fps, this.player.position, this.sky.getTimeString());
      this.input.clearJustPressed();
      // 菜单关闭后恢复移动端控件
      return;
    }

    // 菜单关闭后恢复移动端控件
    if (this.mobile) this.mobile.setVisible(true);

    // 处理输入
    this.handleInput(dt);

    // 更新玩家
    this.player.update(dt, this.input);

    // 更新天空
    this.sky.update(dt, this.player.position);

    // 更新天气
    if (this.weather) {
      this.weather.update(dt, this.player.position);
    }

    // 更新特效
    if (this.effects) {
      this.effects.update(dt);
    }

    // 更新小游戏
    if (this.minigames) {
      this.minigames.update(dt);
    }

    // 成就检查
    if (this.achievements) {
      this.achievements.onPositionUpdate(this.player.position);
      if (!this.sky.isDaytime() && !this.nightSurvived) {
        this.nightSurvived = true;
        this.achievements.onNightSurvive();
      }
      if (this.sky.isDaytime()) this.nightSurvived = false;
    }

    // 更新生物
    this.mobs.update(dt);

    // 更新红石系统
    if (this.redstone) {
      this.redstone.update(dt);
    }

    // 更新酿造系统
    if (this.brewing) {
      this.brewing.update(dt);
      this.brewing.updateFlyingPotions(dt, this);
    }

    // 更新农耕系统
    if (this.farming) {
      this.farming.update(dt);
    }

    // 更新钓鱼系统
    if (this.fishing) {
      this.fishing.update(dt);
    }

    // 更新远程武器系统
    if (this.ranged) {
      this.ranged.update(dt);
    }

    // 更新玩家药水效果
    updatePlayerEffects(this.player, dt);

    // 更新多人联机
    if (this.multiplayer) {
      this.multiplayer.update(dt);
    }

    // 加载/卸载区块
    this.updateChunks();

    // 水流动处理（每2帧处理一次以减少开销）
    this._waterFlowCounter = (this._waterFlowCounter || 0) + 1;
    if (this._waterFlowCounter % 2 === 0) {
      this.world.updateWaterFlow(20);
    }

    // 更新区块网格（自适应：低帧率时减少每帧构建数）
    const meshBudget = this.fps < 30 ? 1 : this.fps < 50 ? 2 : 4;
    this.world.updateMeshes(this.scene, this.blockMaterial, this.waterMaterial, meshBudget);

    // 更新相机
    this.updateCamera();

    // 更新高亮框
    this.updateHighlight();

    // 更新挖掘进度
    this.updateMining(dt);

    // 检查死亡
    if (this.player.dead) {
      if (!this.lastDeathPos) {
        this.lastDeathPos = { ...this.player.position };
      }
      this.ui.showDeath();
    }

    // 更新 UI
    this.ui.updateHotbar();
    this.ui.updateHeldBlockDisplay();
    this.ui.updateStatusBars();
    this.ui.updateInfo(this.fps, this.player.position, this.sky.getTimeString());

    // 清除单次按键
    this.input.clearJustPressed();
  }

  handleInput(dt) {
    // 移动端：视角由触摸控制，不用指针锁定
    if (this.isMobile) {
      const { dx, dy } = this.input.consumeMouseDelta();
      const sens = this.settings.sensitivity * 0.002;
      this.player.yaw -= dx * sens;
      this.player.pitch -= dy * sens;
      this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
    } else if (this.input.pointerLocked) {
      // PC端：鼠标视角
      const { dx, dy } = this.input.consumeMouseDelta();
      const sens = this.settings.sensitivity * 0.002;
      this.player.yaw -= dx * sens;
      this.player.pitch -= dy * sens;
      this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
    }

    // 暂停
    if (this.input.consumeKey('Escape')) {
      this.ui.togglePause();
      return;
    }

    // 背包
    if (this.input.consumeKey('KeyE')) {
      this.ui.toggleInventory();
      return;
    }

    // 飞行模式（双击空格 或 F）—— 移动端通过按钮触发
    if (!this.isMobile && this.input.consumeKey('KeyF')) {
      this.player.toggleFly();
      this.ui.showToast(this.player.flying ? '飞行模式: 开启' : '飞行模式: 关闭');
    }

    // 双击空格切换飞行
    if (!this.isMobile && this.input.consumeKey('Space')) {
      const now = performance.now();
      if (now - (this._lastSpaceTap || 0) < 300) {
        this.player.toggleFly();
        this.ui.showToast(this.player.flying ? '飞行模式: 开启' : '飞行模式: 关闭');
        this._lastSpaceTap = 0; // 防止三连击重复触发
      } else {
        this._lastSpaceTap = now;
      }
    }

    // 潜行
    this.player.sneaking = !!this.input.keys['ShiftLeft'];

    // 冲刺
    this.player.sprinting = !!this.input.keys['ControlLeft'] && !!this.input.keys['KeyW'];

    // 快捷栏选择
    for (let i = 0; i < 9; i++) {
      if (this.input.consumeKey(`Digit${i + 1}`)) {
        this.player.hotbarIndex = i;
      }
    }

    // 滚轮切换
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) {
      this.player.hotbarIndex = (this.player.hotbarIndex + wheel + 9) % 9;
    }

    // 挖掘方块（左键持续）—— PC端和移动端共用
    if (this.input.mouseButtons.left) {
      this.startMining(dt);
    } else {
      this.miningTarget = null;
      this.miningProgress = 0;
    }

    // 放置方块（右键单击）—— PC端和移动端共用
    if (this.input.consumeRightClick()) {
      this.placeBlock();
    }

    // 攻击生物（左键单击）—— PC端
    if (!this.isMobile && this.input.consumeLeftClick()) {
      this.mobs.attackMobs(this.player);
      if (this.achievements) this.achievements.unlock('first_kill');
      // 红石交互（拉杆/按钮）
      if (this.currentRaycastHit && this.redstone) {
        this.redstone.onInteract(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, this.currentRaycastHit.blockId);
      }
      // 农耕交互
      if (this.currentRaycastHit && this.farming) {
        const item = this.player.getSelectedItem();
        this.farming.interactFarmland(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, item);
        this.farming.interactCrop(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, item);
      }
    }

    // 聊天/指令（单人也可用）—— 移动端通过按钮触发
    if (!this.isMobile && (this.input.consumeKey('KeyT') || this.input.consumeKey('Slash'))) {
      this.openChat();
    }

    // 保存
    if (this.input.consumeKey('F5')) {
      this.saveGame();
      if (this.ui) this.ui.showToast('游戏已保存');
    }

    // 移动端：单次点击攻击（挖掘释放时触发）
    if (this.isMobile && this.input.consumeLeftClick()) {
      this.mobs.attackMobs(this.player);
      if (this.achievements) this.achievements.unlock('first_kill');
      if (this.currentRaycastHit && this.redstone) {
        this.redstone.onInteract(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, this.currentRaycastHit.blockId);
      }
      if (this.currentRaycastHit && this.farming) {
        const item = this.player.getSelectedItem();
        this.farming.interactFarmland(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, item);
        this.farming.interactCrop(this.currentRaycastHit.x, this.currentRaycastHit.y, this.currentRaycastHit.z, item);
      }
    }
  }

  updateCamera() {
    const eye = this.player.getEyePosition();
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
  }

  updateChunks() {
    const px = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pz = Math.floor(this.player.position.z / CHUNK_SIZE);
    const rd = this.settings.renderDistance;

    // 加载新区块（只加载当前帧需要的，避免一次加载太多）
    let loadedThisFrame = 0;
    const maxLoadPerFrame = 2;
    for (let r = 0; r <= rd && loadedThisFrame < maxLoadPerFrame; r++) {
      for (let dx = -r; dx <= r && loadedThisFrame < maxLoadPerFrame; dx++) {
        for (let dz = -r; dz <= r && loadedThisFrame < maxLoadPerFrame; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r && r > 0) continue;
          const cx = px + dx;
          const cz = pz + dz;
          const key = `${cx},${cz}`;
          if (!this.world.chunks.has(key)) {
            this.world.getChunk(cx, cz);
            loadedThisFrame++;
          }
        }
      }
    }

    // 卸载远离区块
    this.world.unloadDistantChunks(this.scene, px, pz, rd + 2);
  }

  updateHighlight() {
    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const hit = this.world.raycast(
      new THREE.Vector3(eye.x, eye.y, eye.z),
      new THREE.Vector3(dir.x, dir.y, dir.z),
      6
    );

    if (hit) {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.currentRaycastHit = hit;
    } else {
      this.highlightBox.visible = false;
      this.currentRaycastHit = null;
    }
  }

  // ===== 设置游戏模式 =====
  setGamemode(mode) {
    this.gamemode = mode;
    this.player.setGamemode(mode);
    if (this.ui) this.ui.showToast(`游戏模式: ${GAMEMODE_NAMES[mode]}`);
    // 多人同步
    if (this.multiplayer) {
      this.multiplayer.sendGamemodeChange(mode);
    }
  }

  // ===== 挖掘 =====
  startMining(dt) {
    if (!this.currentRaycastHit) {
      this.miningTarget = null;
      this.miningProgress = 0;
      return;
    }

    const hit = this.currentRaycastHit;
    const key = `${hit.x},${hit.y},${hit.z}`;

    if (!this.miningTarget || this.miningTarget.key !== key) {
      this.miningTarget = { key, x: hit.x, y: hit.y, z: hit.z };
      this.miningProgress = 0;
    }

    // 挖掘速度取决于方块类型
    const def = BLOCK_DEFS[hit.blockId];
    if (def && def.name === '基岩' && !this.player.godMode) return;

    // 创造模式瞬间破坏
    if (this.player.canBreakInstantly()) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.miningProgress = 0;
      this.miningTarget = null;
      return;
    }

    // 简化的挖掘时间
    let mineTime = 0.3;
    if (def) {
      if (def.hardness) mineTime = def.hardness * 0.5;
      else if (def.name.includes('石')) mineTime = 0.8;
      else if (def.name.includes('铁')) mineTime = 1.5;
      else if (def.name.includes('钻石')) mineTime = 2.0;
      else if (def.name.includes('黑曜石')) mineTime = 10.0;
    }

    // 挖掘音效（间隔播放）
    this.miningSoundTimer = (this.miningSoundTimer || 0) + dt;
    if (this.miningSoundTimer >= 0.15) {
      if (this.sound) this.sound.dig(hit.blockId);
      this.miningSoundTimer = 0;
    }

    this.miningProgress += dt;
    if (this.miningProgress >= mineTime) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.miningProgress = 0;
      this.miningTarget = null;
    }
  }

  updateMining(dt) {
    // 挖掘进度由 startMining 处理
    // 这里可以添加挖掘裂纹效果
  }

  breakBlock(x, y, z) {
    const blockId = this.world.getBlock(x, y, z);
    if (blockId === 0 || blockId === BLOCK.BEDROCK) return;

    const def = BLOCK_DEFS[blockId];

    // TNT 爆炸
    if (def && def.explosive) {
      this.effects.spawnTNT(x + 0.5, y + 0.5, z + 0.5);
      this.world.setBlock(x, y, z, BLOCK.AIR);
      return;
    }

    // 红石通知
    if (this.redstone) {
      this.redstone.onBlockChange(x, y, z, blockId, BLOCK.AIR);
    }
    // 农耕通知
    if (this.farming) {
      this.farming.onBlockBreak(x, y, z, blockId);
    }

    // 删除方块
    this.world.setBlock(x, y, z, BLOCK.AIR);

    // 音效
    if (this.sound) this.sound.break(blockId);

    // 生成掉落物（创造模式不掉落）
    if (def.drops !== null && def.drops !== undefined && !this.player.gamemodeConfig.infiniteBlocks) {
      this.mobs.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.drops, 1);
    }

    // 破坏特效
    if (this.effects) {
      this.effects.createBlockBreakParticles(x, y, z, blockId);
    }

    // 成就
    if (this.achievements) {
      this.achievements.onBlockBroken(blockId);
    }

    // 多人同步
    if (this.multiplayer) {
      this.multiplayer.sendBlockChange(x, y, z, BLOCK.AIR);
    }
  }

  // ===== 放置方块 =====
  placeBlock() {
    if (!this.currentRaycastHit) return;
    if (!this.player.gamemodeConfig.canPlaceBlocks) return;

    const hit = this.currentRaycastHit;
    const item = this.player.getSelectedItem();
    if (!item && !this.player.gamemodeConfig.infiniteBlocks) return;

    const blockId = item ? item.id : BLOCK.STONE;
    const def = BLOCK_DEFS[blockId];

    // 食物：右键食用
    if (def && def.food) {
      if (this.player.hunger < this.player.maxHunger) {
        this.player.eat(def.food);
        this.player.consumeSelectedItem();
        if (this.ui) this.ui.showToast(`吃了 ${def.name} +${def.food} 饱食度`, 800);
      }
      return;
    }

    // 种子：右键在耕地上种植
    if (blockId === BLOCK.SEEDS && this.farming) {
      const targetBlock = this.world.getBlock(hit.x, hit.y, hit.z);
      if (targetBlock === BLOCK.FARMLAND) {
        const above = this.world.getBlock(hit.x, hit.y + 1, hit.z);
        if (above === 0) {
          this.world.setBlock(hit.x, hit.y + 1, hit.z, BLOCK.WHEAT_CROP);
          this.farming.plantCrop(hit.x, hit.y + 1, hit.z, BLOCK.WHEAT_CROP);
          if (!this.player.gamemodeConfig.infiniteBlocks) {
            this.player.consumeSelectedItem();
          }
          if (this.ui) this.ui.showToast('已种植种子', 800);
        }
      }
      return;
    }

    // 不可放置物品（工具、材料等）不放置
    if (def && !def.solid && !def.liquid && !PLACEABLE_BLOCKS.includes(blockId)) {
      // 耕地交互：右键草/泥土耕地
      if (this.farming) {
        this.farming.interactFarmland(hit.x, hit.y, hit.z, item);
      }
      return;
    }

    // 计算放置位置（被击中面的外侧）
    const placeX = hit.x + (hit.face ? hit.face[0] : 0);
    const placeY = hit.y + (hit.face ? hit.face[1] : 0);
    const placeZ = hit.z + (hit.face ? hit.face[2] : 0);

    // 检查是否与玩家碰撞
    const playerAABB = this.player.getAABB();
    if (placeX + 1 > playerAABB.minX && placeX < playerAABB.maxX &&
        placeY + 1 > playerAABB.minY && placeY < playerAABB.maxY &&
        placeZ + 1 > playerAABB.minZ && placeZ < playerAABB.maxZ) {
      return; // 不能在玩家位置放置
    }

    // 检查目标位置是否为空
    const targetBlock = this.world.getBlock(placeX, placeY, placeZ);
    if (targetBlock !== 0 && targetBlock !== BLOCK.WATER) return;

    // 放置方块
    this.world.setBlock(placeX, placeY, placeZ, blockId);

    // 音效
    if (this.sound) this.sound.place(blockId);

    // 红石通知
    if (this.redstone) {
      this.redstone.onBlockChange(placeX, placeY, placeZ, 0, blockId);
    }
    // 农耕通知
    if (this.farming) {
      this.farming.onBlockPlace(placeX, placeY, placeZ, blockId);
    }

    // 消耗物品（创造模式不消耗）
    if (!this.player.gamemodeConfig.infiniteBlocks) {
      this.player.consumeSelectedItem();
    }

    // 成就
    if (this.achievements) {
      this.achievements.onBlockPlaced();
    }

    // 多人同步
    if (this.multiplayer) {
      this.multiplayer.sendBlockChange(placeX, placeY, placeZ, blockId);
    }
  }

  // ===== 设置 =====
  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };

    if (this.camera) {
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.sky) {
      this.sky.setFogEnabled(this.settings.fog);
      const rd = this.settings.renderDistance;
      const fogFar = rd * CHUNK_SIZE * 0.8;
      const fogNear = fogFar * 0.3;
      this.sky.setFogDistance(fogNear, fogFar);
    }

    // 同步暂停菜单设置
    if (this.ui) {
      this.ui.syncSettingsToPause();
    }
  }

  // ===== 存档 =====
  saveGame() {
    if (this.save) {
      this.save.save(this.world, this.player, this.sky, this.settings, this.seed);
    }
  }

  // ===== 重生 =====
  respawnPlayer() {
    // 极限模式死亡后变旁观
    if (this.gamemode === GAMEMODE.HARDCORE) {
      this.setGamemode(GAMEMODE.SPECTATOR);
      this.ui.showToast('极限模式死亡！转为旁观模式');
    }
    this.player.respawn(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);
    // 找到安全的重生位置
    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
      const block = this.world.getBlock(
        Math.floor(this.spawnPoint.x),
        y,
        Math.floor(this.spawnPoint.z)
      );
      if (BLOCK_DEFS[block]?.solid) {
        this.player.position.y = y + 1;
        break;
      }
    }
    if (this.achievements) this.achievements.onDeath();
    this.lastDeathPos = null;
    if (!this.isMobile) {
      this.input.requestPointerLock();
    }
  }

  // ===== 退出到主菜单 =====
  quitToMenu() {
    this.running = false;
    this.saveGame();

    // 清理场景
    if (this.multiplayer) {
      this.multiplayer.disconnect();
    }
    this.mobs.clear();
    if (this.effects) {
      this.effects.clear();
    }

    // 隐藏游戏容器
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('pause-settings').classList.add('hidden');
    document.getElementById('inventory-screen').classList.add('hidden');
    document.getElementById('death-screen').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('hidden');

    // 显示主菜单
    document.getElementById('splash-screen').classList.remove('hidden');

    // 释放指针
    this.input.exitPointerLock();

    // 清理子系统
    if (this.redstone) {
      this.redstone.powerMap.clear();
      this.redstone.updateQueue.clear();
    }
    if (this.ranged) {
      this.ranged.clear();
    }
    if (this.fishing) {
      this.fishing.removeBobber();
    }

    // 清理 Three.js
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // ===== 聊天 =====
  initChat() {
    this.chat = {
      addMessage: (name, text) => {
        const messages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.textContent = `<${name}> ${text}`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        // 只保留最近20条
        while (messages.children.length > 20) {
          messages.removeChild(messages.firstChild);
        }
      }
    };

    document.getElementById('chat-box').classList.remove('hidden');

    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text) {
          if (text.startsWith('/')) {
            // 指令
            const result = this.commands.execute(text);
            if (result) {
              this.chat.addMessage('系统', result);
            }
          } else {
            // 聊天
            this.chat.addMessage(this.multiplayer ? this.multiplayer.playerName : '玩家', text);
            if (this.multiplayer) this.multiplayer.sendChat(text);
          }
        }
        input.value = '';
        input.blur();
        if (!this.isMobile) this.input.requestPointerLock();
      } else if (e.key === 'Escape') {
        input.value = '';
        input.blur();
        if (!this.isMobile) this.input.requestPointerLock();
      }
      e.stopPropagation();
    });
  }

  openChat() {
    const input = document.getElementById('chat-input');
    if (!this.isMobile) {
      this.input.exitPointerLock();
    }
    input.focus();
  }
}
