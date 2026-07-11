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
import { RangedSystem, PROJECTILE_TYPE, Projectile } from './ranged.js';
import { MobileControls, isMobileDevice } from './mobile.js';
import { SoundSystem } from './sound.js';
import { PlayerModel } from './playermodel.js';
import { HeldItemViewModel } from './helditem.js';
import { AdventureMode } from './adventure.js';

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
      maxFps: 60,
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
    this.adventure = null;  // 冒险模式
    this.difficulty = 2; // 0=peaceful, 1=easy, 2=normal, 3=hard
    this.spawnPoint = { x: 0, y: 40, z: 0 };
    this.gamemode = GAMEMODE.SURVIVAL;
    this.nightSurvived = false;
    this.lastDeathPos = null;

    // 相机模式: 0=第一人称, 1=第三人称(背后), 2=第三人称(正面)
    this.cameraMode = 0;
    this.localPlayerModel = null; // 第三人称视角下的本地玩家模型
    this.heldItemViewModel = null; // 第一人称手持物品3D渲染器
    this._attackAnimTimer = 0;   // 攻击挥臂动画计时器
    this._bodyYaw = 0;          // 身体朝向（延迟跟随头部）
    this._lastHeldItemId = null; // 上次同步的手持物品ID（避免重复更新）

    // 加特林连发状态
    this._gatlingFireCooldown = 0; // 加特林射击冷却计时器
    this._gatlingBarrelSpin = 0;   // 加特林枪管旋转角度
    this._gatlingIsFiring = false; // 加特林是否正在连发
    this._gatlingBlockDamage = new Map(); // 加特林方块累积伤害 key=blockKey, val=damage

    // 龙息炮连射状态
    this._dragonBreathFireCooldown = 0; // 龙息炮射击冷却计时器
    this._dragonBreathIsFiring = false; // 龙息炮是否正在喷射

    // 巴雷特狙击镜状态
    this._barrettScoped = false;   // 狙击镜是否开启
    this._barrettFovTransition = 0; // FOV过渡进度 0~1
    this._normalFov = 75;          // 正常FOV（从settings同步）
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
    } else if (this._isMultiplayerClient) {
      // 客户端模式：跳过出生点搜索和区块生成，等收到主机世界数据后再生成
      this.player.position = { x: 0.5, y: 64, z: 0.5 };
      this._waitingForWorldData = true;
      console.log('客户端模式：等待主机世界数据...');
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

    // 创建本地玩家模型（用于第三人称视角）
    this.localPlayerModel = new PlayerModel(this.multiplayer ? this.multiplayer.playerName : 'Player');
    this.localPlayerModel.group.visible = false; // 第一人称时隐藏
    this.scene.add(this.localPlayerModel.group);

    // 创建第一人称手持物品3D渲染器
    this.heldItemViewModel = new HeldItemViewModel(this);

    // 创建高亮框
    this.createHighlightBox();

    // 多人联机 + 聊天（单人也可用指令）
    this.initChat();
    if (multiplayerMode) {
      this.multiplayer = new Multiplayer(this);
      this.achievements.onMultiplayerJoin();
    }

    // 冒险模式初始化
    if (gamemode === GAMEMODE.ADVENTURE) {
      this.adventure = new AdventureMode(this);
      this.adventure.init(loadSave);
    }

    // 应用设置
    this.applySettings(this.settings);

    // 预加载初始区块（客户端模式跳过，等收到主机世界数据后再生成）
    if (!this._waitingForWorldData) {
      await this.preloadChunks();
    }

    // 启动游戏循环
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();

    // 请求指针锁定（PC端）
    if (!this.isMobile) {
      this.input.requestPointerLock();
    }

    // 初始化身体朝向与视线一致
    this._bodyYaw = this.player.yaw;
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
    // 螺旋搜索出生点，确保不在水中
    const maxRadius = 48; // 搜索半径
    for (let r = 0; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r && r > 0) continue;

          // 确保对应区块已生成
          this.world.getChunk(Math.floor(dx / 16), Math.floor(dz / 16));

          // 从上往下找第一个实体方块
          for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
            const block = this.world.getBlock(dx, y, dz);
            if (block === 0 || block === BLOCK.WATER) continue;
            const def = BLOCK_DEFS[block];
            if (!def || !def.solid) break; // 非实体方块，跳过此列

            // 检查上方两格是否为空
            if (this.world.getBlock(dx, y + 1, dz) === 0 &&
                this.world.getBlock(dx, y + 2, dz) === 0) {
              this.player.position = { x: dx + 0.5, y: y + 1, z: dz + 0.5 };
              return;
            }
            break; // 实体方块上方无空间，换下一列
          }
        }
      }
      // 每圈让浏览器有机会响应
      if (r % 8 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // 全部搜索失败：在高处生成
    this.player.position = { x: 0.5, y: 50, z: 0.5 };
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

    // 挖掘进度可视化（半透明黑色覆盖层）
    const mineGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const mineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.miningOverlay = new THREE.Mesh(mineGeom, mineMat);
    this.miningOverlay.visible = false;
    this.scene.add(this.miningOverlay);
  }

  // ===== 游戏主循环 =====
  gameLoop = () => {
    if (!this.running) return;

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;

    // 帧率限制
    const maxFps = this.settings.maxFps || 60;
    const minFrameTime = 1000 / maxFps;
    const elapsed = now - this.lastTime;

    if (elapsed < minFrameTime) {
      // 未达到目标帧间隔，等待剩余时间后重试
      setTimeout(() => requestAnimationFrame(this.gameLoop), minFrameTime - elapsed);
      return;
    }

    this.lastTime = now;
    dt = dt > 0.1 ? 0.1 : dt;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.gameLoop);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      // 渲染第一人称手持物品（右下角3D）
      if (this.heldItemViewModel) {
        this.heldItemViewModel.render();
      }
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

    // 加特林方块伤害记录定期清理（每5秒清空一次，防止无限增长）
    this._gatlingCleanupTimer = (this._gatlingCleanupTimer || 0) + dt;
    if (this._gatlingCleanupTimer > 5) {
      if (this._gatlingBlockDamage && this._gatlingBlockDamage.size > 0) {
        this._gatlingBlockDamage.clear();
      }
      this._gatlingCleanupTimer = 0;
    }

    // 更新玩家药水效果
    updatePlayerEffects(this.player, dt);

    // 更新多人联机
    if (this.multiplayer) {
      this.multiplayer.update(dt);
    }

    // 冒险模式更新
    if (this.adventure) {
      this.adventure.update(dt);
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
    this.updateCamera(dt);

    // 更新狙击镜FOV过渡
    this._updateScopeFov(dt);

    // 更新高亮框
    this.updateHighlight();

    // 更新挖掘进度
    this.updateMining(dt);

    // 检查死亡
    if (this.player.dead) {
      if (!this.lastDeathPos) {
        this.lastDeathPos = { ...this.player.position };
      }
      if (this.gamemode === GAMEMODE.ADVENTURE && this.adventure) {
        // 冒险模式：只触发一次死亡（_respawnTimer > 0 表示已触发）
        if (this.adventure._respawnTimer <= 0) {
          this.adventure.onLocalDeath();
        }
      } else {
        this.ui.showDeath();
      }
    }

    // 同步手持物品（第一人称3D视图 + 第三人称模型手中）
    this._syncHeldItem();
    // 更新第一人称手持物品动画
    if (this.heldItemViewModel) {
      this.heldItemViewModel.update(dt);
    }

    // 更新 UI（限制 DOM 更新频率，每3帧更新一次状态栏和信息，减少布局抖动）
    this.ui.updateHotbar();
    this._uiUpdateCounter = (this._uiUpdateCounter || 0) + 1;
    if (this._uiUpdateCounter % 3 === 0) {
      this.ui.updateStatusBars();
      this.ui.updateInfo(this.fps, this.player.position, this.sky.getTimeString());
      this.ui.updateRadar();
    }

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
      if (this.player.toggleFly()) {
        this.ui.showToast(this.player.flying ? '飞行模式: 开启' : '飞行模式: 关闭');
      }
    }

    // 切换人称视角（V键）—— 第一人称 → 第三人称(背后) → 第三人称(正面) → 第一人称
    if (this.input.consumeKey('KeyV')) {
      this.cameraMode = (this.cameraMode + 1) % 3;
      const modeNames = ['第一人称', '第三人称', '正面视角'];
      this.ui.showToast(`视角: ${modeNames[this.cameraMode]}`);
      if (this.localPlayerModel) {
        this.localPlayerModel.group.visible = this.cameraMode !== 0;
      }
      // 强制重新同步手持物品
      this._lastHeldItemId = null;
    }

    // 双击空格切换飞行
    if (!this.isMobile && this.input.consumeKey('Space')) {
      const now = performance.now();
      if (now - (this._lastSpaceTap || 0) < 300) {
        if (this.player.toggleFly()) {
          this.ui.showToast(this.player.flying ? '飞行模式: 开启' : '飞行模式: 关闭');
        }
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

    // ===== 远程武器射击（左键）=====
    // 手持远程武器时，左键射击；否则正常挖掘/攻击
    const heldItem = this.player.getSelectedItem();
    const isHoldingRangedWeapon = heldItem && this._isRangedWeapon(heldItem.id);

    if (isHoldingRangedWeapon) {
      // 远程武器：左键射击，不挖掘
      this.miningTarget = null;
      this.miningProgress = 0;

      // 加特林 & 龙息炮：按住左键连发
      if (heldItem.id === BLOCK.GATLING) {
        if (this.input.mouseButtons.left) {
          this._gatlingIsFiring = true;
          if (this._gatlingFireCooldown <= 0) {
            this.useRangedWeapon(heldItem.id);
            this._gatlingFireCooldown = 0.08; // 每发间隔80ms
          }
        } else {
          this._gatlingIsFiring = false;
        }
      } else if (heldItem.id === BLOCK.DRAGON_BREATH) {
        // 龙息炮：按住左键连射火焰投射物
        if (this.input.mouseButtons.left) {
          this._dragonBreathIsFiring = true;
          if (this._dragonBreathFireCooldown <= 0) {
            this.useRangedWeapon(heldItem.id);
            this._dragonBreathFireCooldown = 0.12; // 每次射击间隔120ms
          }
        } else {
          this._dragonBreathIsFiring = false;
        }
      } else {
        this._gatlingIsFiring = false;
        this._dragonBreathIsFiring = false;
        if (this.input.consumeLeftClick()) {
          this.useRangedWeapon(heldItem.id);
        }
      }

      // 加特林枪管旋转动画
      if (this._gatlingIsFiring) {
        this._gatlingBarrelSpin += dt * 30; // 快速旋转
      } else if (this._gatlingBarrelSpin > 0) {
        this._gatlingBarrelSpin += dt * 10; // 减速旋转
        if (this._gatlingBarrelSpin > 100) this._gatlingBarrelSpin = 0; // 重置避免溢出
      }

      // 加特林冷却递减
      if (this._gatlingFireCooldown > 0) {
        this._gatlingFireCooldown -= dt;
      }

      // 龙息炮冷却递减
      if (this._dragonBreathFireCooldown > 0) {
        this._dragonBreathFireCooldown -= dt;
      }
    } else {
      // 挖掘方块（左键持续）—— PC端和移动端共用
      if (this.input.mouseButtons.left) {
        this.startMining(dt);
      } else {
        this.miningTarget = null;
        this.miningProgress = 0;
        if (this.miningOverlay) this.miningOverlay.visible = false;
      }
    }

    // 放置方块（右键单击）—— PC端和移动端共用
    if (this.input.consumeRightClick()) {
      // 巴雷特右键开镜/关镜
      if (heldItem && heldItem.id === BLOCK.BARRETT) {
        this.toggleBarrettScope();
      } else {
        this.placeBlock();
      }
    }

    // 攻击生物（左键单击）—— PC端
    if (!isHoldingRangedWeapon && !this.isMobile && this.input.consumeLeftClick()) {
      this._attackAnimTimer = 0.3;
      // 触发第一人称手持物品挥动动画
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      // 获取武器属性（射程与伤害）
      const weaponStats = this.getWeaponStats();
      // 优先攻击远程玩家（PvP）
      let hitMob = this.mobs.attackMobs(this.player, weaponStats.reach, weaponStats.damage);
      if (this.multiplayer) {
        this.multiplayer.tryAttackRemotePlayers(this.player, weaponStats.reach, weaponStats.damage);
      }
      // 攻击挥砍特效
      this._triggerAttackEffect(hitMob);
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

    // 冒险模式：商店(B) / 技能(N) / 每日任务(J)
    if (this.adventure && this.adventure.ui) {
      if (this.input.consumeKey('KeyB')) {
        this.adventure.ui.toggleShop();
      }
      if (this.input.consumeKey('KeyN')) {
        this.adventure.ui.toggleSkills();
      }
if (this.input.consumeKey('KeyJ')) {
this.adventure.ui.toggleDaily();
}
if (this.input.consumeKey('KeyK')) {
this.adventure.ui.toggleLeaderboard();
}
    }

    // 开发者模式：按P键弹出密码框（仅冒险模式）
    if (this.adventure && this.input.consumeKey('KeyP')) {
      this.showDevPasswordDialog();
    }

    // 移动端：单次点击攻击（挖掘释放时触发）
    if (!isHoldingRangedWeapon && this.isMobile && this.input.consumeLeftClick()) {
      this._attackAnimTimer = 0.3;
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      const weaponStats = this.getWeaponStats();
      let hitMob = this.mobs.attackMobs(this.player, weaponStats.reach, weaponStats.damage);
      if (this.multiplayer) {
        this.multiplayer.tryAttackRemotePlayers(this.player, weaponStats.reach, weaponStats.damage);
      }
      this._triggerAttackEffect(hitMob);
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

  // ===== 开发者模式（隐藏功能）=====
  showDevPasswordDialog() {
    // 已解锁则不重复弹窗
    if (this.adventure && this.adventure.devMode) {
      if (this.ui) this.ui.showToast('开发者模式已激活 ✅', 2000);
      return;
    }

    const overlay = document.getElementById('dev-password-overlay');
    if (!overlay) return;

    // 退出指针锁定以便输入
    if (!this.isMobile) this.input.exitPointerLock();
    overlay.classList.remove('hidden');

    const input = document.getElementById('dev-password-input');
    const error = document.getElementById('dev-password-error');
    input.value = '';
    error.style.display = 'none';
    setTimeout(() => input.focus(), 50);

    const confirmBtn = document.getElementById('dev-password-confirm');
    const cancelBtn = document.getElementById('dev-password-cancel');

    const closeDialog = () => {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKeydown);
      if (!this.isMobile) this.input.requestPointerLock();
    };

    const onConfirm = () => {
      const password = input.value.trim();
      if (password === '13245768') {
        // 解锁开发者模式
        this.adventure.devMode = true;
        // 设置巨额金币
        this.adventure.econ.teamGold[this.adventure.localPlayerId] = 9999999;
        if (this.player) this.player.gold = 9999999;
        if (this.adventure.ui) {
          this.adventure.ui.updateGold(9999999);
          this.adventure.ui.showToast('🔓 开发者模式已解锁！无限金币已激活', 3000);
        }
        closeDialog();
      } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    };

    const onCancel = () => {
      closeDialog();
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
      e.stopPropagation();
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
  }

  updateCamera(dt) {
    const eye = this.player.getEyePosition();

    // 屏幕震动偏移
    let shakeX = 0, shakeY = 0;
    if (this.effects && this.effects.screenShake > 0) {
      const shake = this.effects.getShakeOffset();
      shakeX = shake.x;
      shakeY = shake.y;
    }

    if (this.cameraMode === 0) {
      // 第一人称
      this.camera.position.set(eye.x + shakeX, eye.y + shakeY, eye.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = this.player.pitch;
    } else {
      // 第三人称
      const maxDist = 3.5;
      const cp = Math.cos(this.player.pitch);
      const dirX = -Math.sin(this.player.yaw) * cp;
      const dirY = Math.sin(this.player.pitch);
      const dirZ = -Math.cos(this.player.yaw) * cp;

      let camX, camY, camZ;
      if (this.cameraMode === 1) {
        // 背后视角：相机在玩家身后
        camX = eye.x - dirX * maxDist;
        camY = eye.y - dirY * maxDist;
        camZ = eye.z - dirZ * maxDist;
      } else {
        // 正面视角：相机在玩家前方
        camX = eye.x + dirX * maxDist;
        camY = eye.y + dirY * maxDist;
        camZ = eye.z + dirZ * maxDist;
      }

      // 防止相机穿墙：从眼睛位置射线检测
      if (this.world) {
        const rayStart = new THREE.Vector3(eye.x, eye.y, eye.z);
        const rayDir = new THREE.Vector3(camX - eye.x, camY - eye.y, camZ - eye.z);
        const rayLen = rayDir.length();
        if (rayLen > 0.01) {
          rayDir.normalize();
          const hit = this.world.raycast(rayStart, rayDir, rayLen);
          if (hit) {
            const hitDist = Math.sqrt(
              (hit.x + 0.5 - eye.x) ** 2 +
              (hit.y + 0.5 - eye.y) ** 2 +
              (hit.z + 0.5 - eye.z) ** 2
            );
            const safeDist = Math.max(0.5, hitDist - 0.3);
            camX = eye.x + rayDir.x * safeDist;
            camY = eye.y + rayDir.y * safeDist;
            camZ = eye.z + rayDir.z * safeDist;
          }
        }
      }

      this.camera.position.set(camX + shakeX, camY + shakeY, camZ);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = this.player.pitch;
    }

    // 更新本地玩家模型位置和动画（第三人称时）
    if (this.localPlayerModel && this.cameraMode !== 0) {
      this.localPlayerModel.group.position.set(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );

      // === 头部/身体分离扭动逻辑 ===
      const maxHeadYaw = Math.PI / 3; // 头部最大独立扭动角度 (60°)
      const isMoving = Math.abs(this.player.velocity.x) > 0.1 || Math.abs(this.player.velocity.z) > 0.1;

      if (isMoving) {
        // 行走时身体立刻对齐视线方向（背对玩家）
        this._bodyYaw = this.player.yaw;
      } else {
        // 静止时：正常范围内仅头部转，超出范围后身体平滑跟随
        let yawDiff = this.player.yaw - this._bodyYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

        if (Math.abs(yawDiff) > maxHeadYaw) {
          const targetBodyYaw = this.player.yaw - Math.sign(yawDiff) * maxHeadYaw;
          let bodyDiff = targetBodyYaw - this._bodyYaw;
          while (bodyDiff > Math.PI) bodyDiff -= Math.PI * 2;
          while (bodyDiff < -Math.PI) bodyDiff += Math.PI * 2;
          this._bodyYaw += bodyDiff * 0.12;
        }
        while (this._bodyYaw > Math.PI) this._bodyYaw -= Math.PI * 2;
        while (this._bodyYaw < -Math.PI) this._bodyYaw += Math.PI * 2;
      }

      // 模型正面(+Z)与视线(-Z)相差180°，需补偿
      this.localPlayerModel.group.rotation.y = this._bodyYaw + Math.PI;

      // 头部：Y轴 = 视线与身体朝向的差值，X轴 = 俯仰角
      let headYawRel = this.player.yaw - this._bodyYaw;
      while (headYawRel > Math.PI) headYawRel -= Math.PI * 2;
      while (headYawRel < -Math.PI) headYawRel += Math.PI * 2;
      if (this.localPlayerModel.head) {
        this.localPlayerModel.head.rotation.y = headYawRel;
        this.localPlayerModel.head.rotation.x = -this.player.pitch;
      }

      this.localPlayerModel.updateAnimation(dt, {
        moving: isMoving,
        sprinting: this.player.sprinting,
        sneaking: this.player.sneaking,
        attacking: this._attackAnimTimer > 0,
      });
    }

    // 攻击动画计时器递减
    if (this._attackAnimTimer > 0) {
      this._attackAnimTimer -= dt;
    }
  }

  // ===== 同步手持物品到第一人称视图模型和第三人称模型 =====
  _syncHeldItem() {
    const item = this.player.getSelectedItem();
    const itemId = item ? item.id : null;

    // 仅在物品变化时更新模型
    if (itemId === this._lastHeldItemId) return;
    this._lastHeldItemId = itemId;

    // 切换武器时关闭巴雷特狙击镜
    if (this._barrettScoped && itemId !== BLOCK.BARRETT) {
      this._barrettScoped = false;
      this._barrettFovTransition = 0;
      const scopeEl = document.getElementById('sniper-scope');
      if (scopeEl) scopeEl.classList.add('hidden');
    }

    // 切换武器时停止加特林连发和龙息炮喷射
    if (itemId !== BLOCK.GATLING) {
      this._gatlingIsFiring = false;
    }
    if (itemId !== BLOCK.DRAGON_BREATH) {
      this._dragonBreathIsFiring = false;
    }

    const atlasTexture = this.blockMaterial ? this.blockMaterial.map : null;
    const toolData = this.player.toolData || {};

    // 第一人称视图模型
    if (this.heldItemViewModel) {
      this.heldItemViewModel.setItem(itemId, toolData, atlasTexture);
      this.heldItemViewModel.enabled = (this.cameraMode === 0) && itemId !== null;
    }

    // 第三人称模型手中物品
    if (this.localPlayerModel) {
      this.localPlayerModel.setHeldItem(itemId, toolData, atlasTexture);
    }
  }

  // ===== 获取当前武器属性（射程与伤害）=====
  // 根据手持物品类型和材质返回 {reach, damage}
  getWeaponStats() {
    const item = this.player.getSelectedItem();
    // 默认：徒手
    let reach = 2.5;
    let damage = 1;

    if (item) {
      const td = this.player.toolData;
      const tdEntry = td && td[item.id];

      if (tdEntry && tdEntry.toolType) {
        const toolType = tdEntry.toolType;
        const material = tdEntry.material || 'wood';

        // 材质伤害表 [wood, stone, iron, gold, diamond, netherite]
        const damageTable = {
          sword:   { wood: 4, stone: 5, iron: 6, gold: 4, diamond: 7, netherite: 8 },
          axe:     { wood: 3, stone: 4, iron: 5, gold: 3, diamond: 6, netherite: 7 },
          pickaxe: { wood: 2, stone: 3, iron: 4, gold: 2, diamond: 5, netherite: 6 },
          shovel:  { wood: 1, stone: 2, iron: 3, gold: 1, diamond: 4, netherite: 5 },
          hoe:     { wood: 1, stone: 1, iron: 2, gold: 1, diamond: 2, netherite: 3 },
          shield:  { wood: 1, stone: 1, iron: 1, gold: 1, diamond: 1, netherite: 1 },
        };

        // 射程
        const reachTable = {
          sword: 3.0,
          axe: 3.0,
          pickaxe: 2.8,
          shovel: 2.8,
          hoe: 3.0,
          shield: 2.5,
        };

        if (damageTable[toolType]) {
          damage = damageTable[toolType][material] || damageTable[toolType].wood;
        }
        if (reachTable[toolType]) {
          reach = reachTable[toolType];
        }
      } else if (item.id === BLOCK.TRIDENT) {
        // 三叉戟近战：高伤害，较长射程
        reach = 3.5;
        damage = 9;
      } else if (item.id === BLOCK.BOW || item.id === BLOCK.CROSSBOW) {
        // 弓弩不用于近战
        reach = 2.0;
        damage = 1;
      } else if (item.id === BLOCK.PISTOL) {
        // 手枪近战：枪托敲击
        reach = 2.0;
        damage = 2;
      } else if (item.id === BLOCK.ROCKET_LAUNCHER) {
        // 火箭筒近战：近身不推荐
        reach = 2.5;
        damage = 3;
      } else if (item.id === BLOCK.GATLING) {
        // 加特林近战：重型枪身砸击
        reach = 2.0;
        damage = 3;
      } else if (item.id === BLOCK.BARRETT) {
        // 巴雷特近战：枪托猛击
        reach = 2.0;
        damage = 4;
      } else if (item.id === BLOCK.FISHING_ROD) {
        reach = 2.5;
        damage = 1;
      } else {
        // 其他物品（方块等）：相当于徒手
        reach = 2.5;
        damage = 1;
      }
    }

    return { reach, damage };
  }

  // ===== 攻击挥砍特效 =====
  _triggerAttackEffect(hitMob) {
    if (!this.effects) return;

    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();

    // 判断武器类型
    const item = this.player.getSelectedItem();
    let weaponType = 'fist';
    let effectColor = 0xffffff;

    if (item) {
      const td = this.player.toolData;
      if (td && td[item.id]) {
        if (td[item.id].toolType === 'sword') {
          weaponType = 'sword';
          effectColor = 0xffeeaa;
        } else if (td[item.id].toolType === 'axe') {
          weaponType = 'axe';
          effectColor = 0xddcc88;
        } else if (td[item.id].toolType === 'pickaxe') {
          weaponType = 'pickaxe';
          effectColor = 0xaaccff;
        } else if (td[item.id].toolType === 'shovel') {
          weaponType = 'shovel';
          effectColor = 0xddbb88;
        }
      }
      if (item.id === BLOCK.TRIDENT) {
        weaponType = 'trident';
        effectColor = 0x4ac8e0;
      }
    }

    // 在视线前方生成挥砍特效
    const fxX = eye.x + dir.x * 1.5;
    const fxY = eye.y + dir.y * 1.5;
    const fxZ = eye.z + dir.z * 1.5;

    this.effects.createSlashEffect(fxX, fxY, fxZ, dir, effectColor, weaponType);

    // 如果命中生物，在命中位置生成额外粒子
    if (hitMob && hitMob.position) {
      this.effects.createBlockBreakParticles(
        hitMob.position.x,
        hitMob.position.y + hitMob.height * 0.5,
        hitMob.position.z,
        effectColor
      );
    }
  }

  updateChunks() {
    const px = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pz = Math.floor(this.player.position.z / CHUNK_SIZE);
    const rd = this.settings.renderDistance;

    // 记录玩家区块坐标供 world.updateMeshes 排序使用
    this.world._lastPlayerChunkX = px;
    this.world._lastPlayerChunkZ = pz;

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
  setGamemode(mode, skipSync = false) {
    this.gamemode = mode;
    this.player.setGamemode(mode);
    if (this.ui) this.ui.showToast(`游戏模式: ${GAMEMODE_NAMES[mode]}`);
    // 更新背包面板可见性（体验模式）
    if (this.ui) this.ui.updateExperiencePanelVisibility();
    // 多人同步
    if (this.multiplayer && !skipSync) {
      this.multiplayer.sendGamemodeChange(mode);
    }
  }

  // ===== 挖掘 =====
  startMining(dt) {
    if (!this.currentRaycastHit) {
      this.miningTarget = null;
      this.miningProgress = 0;
      if (this.miningOverlay) this.miningOverlay.visible = false;
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
    if (def && def.name === '基岩' && !this.player.godMode) {
      if (this.miningOverlay) this.miningOverlay.visible = false;
      return;
    }

    // 创造模式瞬间破坏
    if (this.player.canBreakInstantly()) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.miningProgress = 0;
      this.miningTarget = null;
      if (this.miningOverlay) this.miningOverlay.visible = false;
      return;
    }

    // ===== 基于工具效率的拆除时间计算 =====
    const mineTime = this.calculateMiningTime(hit.blockId, def);

    // 挖掘音效（间隔播放）
    this.miningSoundTimer = (this.miningSoundTimer || 0) + dt;
    if (this.miningSoundTimer >= 0.15) {
      if (this.sound) this.sound.dig(hit.blockId);
      this.miningSoundTimer = 0;
    }

    this.miningProgress += dt;

    // 挖掘进度可视化
    if (this.miningOverlay && mineTime > 0 && mineTime !== Infinity) {
      const progress = Math.min(1, this.miningProgress / mineTime);
      this.miningOverlay.visible = true;
      this.miningOverlay.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.miningOverlay.material.opacity = progress * 0.4;
    }

    if (this.miningProgress >= mineTime) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.miningProgress = 0;
      this.miningTarget = null;
      if (this.miningOverlay) this.miningOverlay.visible = false;
    }
  }

  /**
   * 计算拆除方块所需时间（秒）
   * 综合考虑方块材质类型、手持工具类型和工具材质
   */
  calculateMiningTime(blockId, def) {
    if (!def) return 0.3;

    // 基岩不可破坏
    if (def.name === '基岩') return Infinity;

    // 方块材质分类 → { baseTime, preferredTool }
    // baseTime: 徒手拆除的基础时间（秒）
    // preferredTool: 最有效的工具类型
    const blockMaterial = this._getBlockMaterial(blockId, def);

    // 基础拆除时间
    let baseTime = blockMaterial.baseTime;

    // 黑曜石特殊处理
    if (def.hardness === 50) baseTime = 50;

    // 获取手持工具
    const item = this.player.getSelectedItem();
    let toolType = null;
    let toolMaterial = null;

    if (item) {
      const td = this.player.toolData;
      if (td && td[item.id] && td[item.id].toolType) {
        toolType = td[item.id].toolType;
        toolMaterial = td[item.id].material || 'wood';
      }
    }

    if (!toolType) {
      // 无工具：使用基础时间
      return baseTime;
    }

    // 工具材质速度倍率
    const materialSpeed = {
      wood: 2.0,
      stone: 4.0,
      iron: 6.0,
      gold: 12.0,
      diamond: 8.0,
      netherite: 9.0,
    };

    // 判断工具是否匹配方块材质
    const isCorrectTool = (blockMaterial.preferredTool === toolType);

    if (isCorrectTool) {
      // 正确工具：大幅加速
      const speed = materialSpeed[toolMaterial] || 2.0;
      return Math.max(0.05, baseTime / speed);
    } else {
      // 错误工具：略微加速（工具本身比徒手强一点）
      const wrongToolSpeed = (materialSpeed[toolMaterial] || 2.0) * 0.3;
      return Math.max(0.1, baseTime / (1 + wrongToolSpeed * 0.2));
    }
  }

  /**
   * 根据方块ID和定义返回材质类型信息
   * @returns {{ baseTime: number, preferredTool: string }}
   */
  _getBlockMaterial(blockId, def) {
    const name = def.name || '';

    // 石材类 → 镐
    if (name.includes('石') || name.includes('圆石') || name.includes('砖') ||
        name.includes('砂岩') || name.includes('下界') || name.includes('荧石') ||
        name.includes('粘土') || blockId === BLOCK.BEDROCK) {
      // 硬石质（矿石、黑曜石等）
      if (name.includes('铁') || name.includes('钻石')) {
        return { baseTime: 3.0, preferredTool: 'pickaxe' };
      }
      if (name.includes('黑曜石')) {
        return { baseTime: 50, preferredTool: 'pickaxe' };
      }
      return { baseTime: 1.5, preferredTool: 'pickaxe' };
    }

    // 木制类 → 斧
    if (name.includes('木') || name.includes('原木') || name.includes('木板') ||
        name.includes('工作台') || name.includes('书架') || name.includes('宝箱') ||
        name.includes('床') || name.includes('梯子')) {
      return { baseTime: 1.5, preferredTool: 'axe' };
    }

    // 泥土/沙子类 → 锹
    if (name.includes('泥') || name.includes('草') || name.includes('沙') ||
        name.includes('雪') || name.includes('粘') || name.includes('南瓜')) {
      return { baseTime: 0.8, preferredTool: 'shovel' };
    }

    // 植物/叶子 → 剪刀（无剪刀时用徒手）
    if (name.includes('叶') || name.includes('花') || name.includes('蘑菇')) {
      return { baseTime: 0.3, preferredTool: 'hoe' };
    }

    // 玻璃/冰
    if (name.includes('玻璃') || name.includes('冰')) {
      return { baseTime: 0.5, preferredTool: 'pickaxe' };
    }

    // 默认
    return { baseTime: 1.0, preferredTool: 'pickaxe' };
  }

  updateMining(dt) {
    // 挖掘进度由 startMining 处理
    // 这里可以添加挖掘裂纹效果
  }

  // 武器破坏方块的辅助方法（含掉落物、特效、多人同步）
  // skipDrops: 创造模式/远程武器可跳过掉落物
  destroyBlock(x, y, z, skipDrops = false) {
    const blockId = this.world.getBlock(x, y, z);
    if (blockId === 0 || blockId === BLOCK.BEDROCK) return false;

    const def = BLOCK_DEFS[blockId];
    if (!def) return false;

    // 红石/农耕通知
    if (this.redstone) this.redstone.onBlockChange(x, y, z, blockId, BLOCK.AIR);
    if (this.farming) this.farming.onBlockBreak(x, y, z, blockId);

    // 删除方块
    this.world.setBlock(x, y, z, BLOCK.AIR);

    // 音效
    if (this.sound) this.sound.break(blockId);

    // 掉落物
    if (!skipDrops && def.drops !== null && def.drops !== undefined && !this.player.gamemodeConfig.infiniteBlocks) {
      this.mobs.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.drops, 1);
    }

    // 破坏特效
    if (this.effects) this.effects.createBlockBreakParticles(x, y, z, blockId);

    // 多人同步
    if (this.multiplayer) this.multiplayer.sendBlockChange(x, y, z, BLOCK.AIR);

    return true;
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
  // 判断物品是否为远程武器
  _isRangedWeapon(blockId) {
    return blockId === BLOCK.BOW || blockId === BLOCK.CROSSBOW || blockId === BLOCK.TRIDENT ||
      blockId === BLOCK.PISTOL || blockId === BLOCK.ROCKET_LAUNCHER ||
      blockId === BLOCK.GATLING || blockId === BLOCK.BARRETT ||
      blockId === BLOCK.DRAGON_BREATH || blockId === BLOCK.THUNDER_GUN ||
      blockId === BLOCK.ANNIHILATOR ||
      blockId === BLOCK.SNOWBALL || blockId === BLOCK.EGG_ITEM ||
      blockId === BLOCK.ENDER_PEARL || blockId === BLOCK.FIREWORK_ROCKET;
  }

  // 使用远程武器（左键触发）
  useRangedWeapon(blockId) {
    if (blockId === BLOCK.BOW) {
      this.useBow();
    } else if (blockId === BLOCK.CROSSBOW) {
      this.useCrossbow();
    } else if (blockId === BLOCK.TRIDENT) {
      this.useTrident();
    } else if (blockId === BLOCK.PISTOL) {
      this.usePistol();
    } else if (blockId === BLOCK.ROCKET_LAUNCHER) {
      this.useRocketLauncher();
    } else if (blockId === BLOCK.SNOWBALL) {
      if (this.ranged) this.ranged.throwItem(PROJECTILE_TYPE.SNOWBALL, { damage: 0, gravity: 1, maxLifetime: 15 });
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      this._attackAnimTimer = 0.2;
    } else if (blockId === BLOCK.EGG_ITEM) {
      if (this.ranged) this.ranged.throwItem(PROJECTILE_TYPE.EGG, { damage: 0, gravity: 1, maxLifetime: 15 });
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      this._attackAnimTimer = 0.2;
    } else if (blockId === BLOCK.ENDER_PEARL) {
      if (this.ranged) this.ranged.throwItem(PROJECTILE_TYPE.ENDER_PEARL, { damage: 0, gravity: 1, maxLifetime: 60 });
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      this._attackAnimTimer = 0.2;
    } else if (blockId === BLOCK.FIREWORK_ROCKET) {
      if (this.ranged) this.ranged.throwItem(PROJECTILE_TYPE.FIREWORK_ROCKET, { damage: 0, gravity: 0.3, maxLifetime: 20 });
      if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
      this._attackAnimTimer = 0.2;
    } else if (blockId === BLOCK.GATLING) {
      this.useGatling();
    } else if (blockId === BLOCK.BARRETT) {
      this.useBarrett();
    } else if (blockId === BLOCK.DRAGON_BREATH) {
      this.useDragonBreath();
    } else if (blockId === BLOCK.THUNDER_GUN) {
      this.useThunderGun();
    } else if (blockId === BLOCK.ANNIHILATOR) {
      this.useAnnihilator();
    }
  }

  placeBlock() {
    const item = this.player.getSelectedItem();
    const blockId = item ? item.id : 0;

    // 远程武器已改为左键射击，右键不再触发武器
    // 巴雷特右键开镜逻辑在 handleInput 中处理
    // 其他远程武器右键不做任何事
    if (this._isRangedWeapon(blockId)) return;

    // ===== 以下为普通方块放置逻辑 =====
    if (!this.currentRaycastHit && !item) return;
    if (!this.player.gamemodeConfig.canPlaceBlocks) return;
    if (!item && !this.player.gamemodeConfig.infiniteBlocks) return;

    const placeBlockId = item ? item.id : BLOCK.STONE;
    const def = BLOCK_DEFS[placeBlockId];

    if (!this.currentRaycastHit) return;
    const hit = this.currentRaycastHit;

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
    if (placeBlockId === BLOCK.SEEDS && this.farming) {
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
    if (def && !def.solid && !def.liquid && !PLACEABLE_BLOCKS.includes(placeBlockId)) {
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
    this.world.setBlock(placeX, placeY, placeZ, placeBlockId);

    // 音效
    if (this.sound) this.sound.place(placeBlockId);

    // 红石通知
    if (this.redstone) {
      this.redstone.onBlockChange(placeX, placeY, placeZ, 0, placeBlockId);
    }
    // 农耕通知
    if (this.farming) {
      this.farming.onBlockPlace(placeX, placeY, placeZ, placeBlockId);
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
      this.multiplayer.sendBlockChange(placeX, placeY, placeZ, placeBlockId);
    }
  }

  // ===== 远程武器使用方法（全部无限弹药）=====

  // 使用弓 — 无限箭矢
  useBow(bowItem) {
    if (!this.ranged) return;

    // 触发第一人称挥动动画
    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.3;

    const power = 1.0;
    this.ranged.shootArrow(power, {});
  }

  // 使用弩 — 无限箭矢
  useCrossbow(crossbowItem) {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.3;

    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();

    // 在视线方向偏移1格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const projectile = new Projectile(this, PROJECTILE_TYPE.CROSSBOW_BOLT, spawnX, spawnY, spawnZ, dir, {
      speed: 60,
      damage: 9,
      owner: this.player,
      maxLifetime: 120,
      gravity: 0.15,
      piercing: 1,
    });

    this.ranged.projectiles.push(projectile);

    if (this.sound) this.sound.crossbow();

    if (this.multiplayer) {
      this.multiplayer.sendProjectile(PROJECTILE_TYPE.CROSSBOW_BOLT, eye, dir, { speed: 60, damage: 9, maxLifetime: 120, gravity: 0.15, piercing: 1 });
    }
  }

  // 使用三叉戟 — 无限弹药
  useTrident(tridentItem) {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.3;

    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();

    // 在视线方向偏移1格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const projectile = new Projectile(this, PROJECTILE_TYPE.TRIDENT, spawnX, spawnY, spawnZ, dir, {
      speed: 35,
      damage: 8,
      owner: this.player,
      maxLifetime: 120,
      gravity: 0.5,
    });

    this.ranged.projectiles.push(projectile);

    if (this.sound) this.sound.trident();

    if (this.multiplayer) {
      this.multiplayer.sendProjectile(PROJECTILE_TYPE.TRIDENT, eye, dir, { speed: 35, damage: 8, maxLifetime: 120, gravity: 0.5 });
    }
  }

// 使用手枪 — 无限子弹
usePistol(pistolItem) {
if (!this.ranged) return;

if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
this._attackAnimTimer = 0.15;

this.ranged.shootBullet();
}

  // 使用火箭筒 — 无限火箭弹
  useRocketLauncher(rlItem) {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.5;

    this.ranged.shootRocket();
  }

  // 使用加特林 — 无限子弹，连发
  useGatling() {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.05;

    this.ranged.shootGatling();
  }

  // 使用巴雷特 — 无限子弹，高伤害
  useBarrett() {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.4;

    this.ranged.shootSniper();
  }

// 使用龙息炮 — 发射火焰投射物
useDragonBreath() {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.1;

    this.ranged.shootDragonBreath();
  }

  // 使用雷霆链枪 — 闪电链
  useThunderGun() {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.3;

    this.ranged.shootThunderGun();
  }

  // 使用湮灭炮 — 量子球
  useAnnihilator() {
    if (!this.ranged) return;

    if (this.heldItemViewModel) this.heldItemViewModel.triggerSwing();
    this._attackAnimTimer = 0.5;

    this.ranged.shootAnnihilator();
  }

  // 切换巴雷特狙击镜
  toggleBarrettScope() {
    this._barrettScoped = !this._barrettScoped;
    this._barrettFovTransition = 0; // 重置过渡进度

    // 显示/隐藏狙击镜UI
    const scopeEl = document.getElementById('sniper-scope');
    if (scopeEl) {
      scopeEl.classList.toggle('hidden', !this._barrettScoped);
    }

    if (this.ui) {
      this.ui.showToast(this._barrettScoped ? '狙击镜: 开启' : '狙击镜: 关闭', 600);
    }
  }

  // 更新狙击镜FOV过渡
  _updateScopeFov(dt) {
    if (!this.camera) return;

    this._normalFov = this.settings.fov;
    const scopeFov = 20; // 狙击镜FOV

    if (this._barrettScoped) {
      // 开镜过渡
      this._barrettFovTransition = Math.min(1, this._barrettFovTransition + dt * 4);
    } else {
      // 关镜过渡
      this._barrettFovTransition = Math.max(0, this._barrettFovTransition - dt * 4);
    }

    const targetFov = this._normalFov + (scopeFov - this._normalFov) * this._barrettFovTransition;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // 如果过渡完成且未开镜，确保FOV完全恢复
    if (!this._barrettScoped && this._barrettFovTransition <= 0) {
      this.camera.fov = this._normalFov;
      this.camera.updateProjectionMatrix();
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
    // 找到安全的重生位置（不在水中）
    const sx = Math.floor(this.spawnPoint.x);
    const sz = Math.floor(this.spawnPoint.z);
    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
      const block = this.world.getBlock(sx, y, sz);
      const def = BLOCK_DEFS[block];
      if (def && def.solid) {
        // 确保上方两格为空
        if (this.world.getBlock(sx, y + 1, sz) === 0 &&
            this.world.getBlock(sx, y + 2, sz) === 0) {
          this.player.position.y = y + 1;
          break;
        }
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

    // 清理本地玩家模型
    if (this.localPlayerModel) {
      this.scene.remove(this.localPlayerModel.group);
      this.localPlayerModel.dispose();
      this.localPlayerModel = null;
    }

    // 清理第一人称手持物品渲染器
    if (this.heldItemViewModel) {
      this.heldItemViewModel.dispose();
      this.heldItemViewModel = null;
    }

    // 清理场景
    if (this.multiplayer) {
      this.multiplayer.disconnect();
    }
    // 清理房间发现服务
    if (this.roomDiscovery) {
      this.roomDiscovery.destroy();
      this.roomDiscovery = null;
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

  // ===== 冒险模式钩子方法 =====

  onGoldPickup(amount) {
    if (this.adventure) {
      const pid = (this.multiplayer && this.multiplayer.playerId) || 'local';
      // 客户端：上报金币拾取给主机
      if (this.adventure.isClient && this.multiplayer) {
        this.multiplayer.sendAdvPickup(amount, 'pickup');
        return;
      }
      this.adventure.econ.addGold(pid, amount, 'pickup');
      // 金币拾取音效
      if (this.sound) this.sound.goldCoin();
    }
  }

  onMobKilled(mob, killerId) {
    if (this.adventure) {
      const pid = killerId || (this.multiplayer && this.multiplayer.playerId) || 'local';
      this.adventure.onKill(pid, mob);
    }
  }
}
