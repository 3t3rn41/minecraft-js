/**
 * mpegamodes.js — 多人小游戏模式
 * 包含：PvP 竞技场 / 建造大战 / 掘雪场(Spleef) / 夺旗
 *        跑酷竞速 / TNT跑酷 / 床战 / 空岛战争 / 躲猫猫
 */

import * as THREE from 'three';
import { BLOCK } from './blocks.js';

export const MINIGAME = {
  NONE: 'none',
  PVP_ARENA: 'pvp_arena',
  BUILD_BATTLE: 'build_battle',
  SPLEEF: 'spleef',
  CAPTURE_FLAG: 'capture_flag',
  PARKOUR_RACE: 'parkour_race',
  TNT_PARKOUR: 'tnt_parkour',
  BED_WARS: 'bed_wars',
  SKYWARS: 'skywars',
  HIDE_AND_SEEK: 'hide_and_seek',
};

export const MINIGAME_NAMES = {
  [MINIGAME.PVP_ARENA]: 'PvP 竞技场',
  [MINIGAME.BUILD_BATTLE]: '建造大战',
  [MINIGAME.SPLEEF]: '掘雪场',
  [MINIGAME.CAPTURE_FLAG]: '夺旗模式',
  [MINIGAME.PARKOUR_RACE]: '跑酷竞速',
  [MINIGAME.TNT_PARKOUR]: 'TNT跑酷',
  [MINIGAME.BED_WARS]: '床战',
  [MINIGAME.SKYWARS]: '空岛战争',
  [MINIGAME.HIDE_AND_SEEK]: '躲猫猫',
};

export class MinigameManager {
  constructor(game) {
    this.game = game;
    this.currentGame = MINIGAME.NONE;
    this.scores = new Map(); // playerName -> score
    this.timer = 0;
    this.timeLimit = 300; // 5分钟
    this.isActive = false;
    this.arenaCenter = { x: 0, y: 40, z: 0 };
    this.arenaSize = 30;
  }

  startMinigame(type, options = {}) {
    this.currentGame = type;
    this.isActive = true;
    this.timer = 0;
    this.timeLimit = options.timeLimit || 300;
    this.scores.clear();

    switch (type) {
      case MINIGAME.PVP_ARENA:
        this.setupPvPArena();
        break;
      case MINIGAME.BUILD_BATTLE:
        this.setupBuildBattle(options.theme || '城堡');
        break;
      case MINIGAME.SPLEEF:
        this.setupSpleef();
        break;
      case MINIGAME.CAPTURE_FLAG:
        this.setupCaptureFlag();
        break;
      case MINIGAME.PARKOUR_RACE:
        this.setupParkourRace();
        break;
      case MINIGAME.TNT_PARKOUR:
        this.setupTNTParkour();
        break;
      case MINIGAME.BED_WARS:
        this.setupBedWars();
        break;
      case MINIGAME.SKYWARS:
        this.setupSkywars();
        break;
      case MINIGAME.HIDE_AND_SEEK:
        this.setupHideAndSeek();
        break;
    }

    this.game.ui.showToast(`小游戏开始: ${MINIGAME_NAMES[type]}！`);

    // 多人同步
    if (this.game.multiplayer) {
      this.game.multiplayer.sendMinigameStart(type, options);
    }
  }

  stopMinigame() {
    if (!this.isActive) return;
    this.isActive = false;
    const winner = this.getWinner();
    this.game.ui.showToast(`小游戏结束！胜者: ${winner || '无人'}`);
    this.currentGame = MINIGAME.NONE;

    // 多人同步
    if (this.game.multiplayer) {
      this.game.multiplayer.sendMinigameStop(winner);
    }
  }

  // ===== PvP 竞技场 =====
  setupPvPArena() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;
    const s = this.arenaSize;

    // 清理区域并建造竞技场
    for (let x = -s; x <= s; x++) {
      for (let z = -s; z <= s; z++) {
        // 地面
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.COBBLESTONE, false);
        // 清空上方
        for (let y = cy; y < cy + 10; y++) {
          this.game.world.setBlock(cx + x, y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 围墙
    for (let i = -s; i <= s; i++) {
      this.game.world.setBlock(cx + i, cy, cz - s, BLOCK.STONE, false);
      this.game.world.setBlock(cx + i, cy, cz + s, BLOCK.STONE, false);
      this.game.world.setBlock(cx - s, cy, cz + i, BLOCK.STONE, false);
      this.game.world.setBlock(cx + s, cy, cz + i, BLOCK.STONE, false);
      // 高墙
      for (let y = 1; y <= 3; y++) {
        this.game.world.setBlock(cx + i, cy + y, cz - s, BLOCK.STONE, false);
        this.game.world.setBlock(cx + i, cy + y, cz + s, BLOCK.STONE, false);
        this.game.world.setBlock(cx - s, cy + y, cz + i, BLOCK.STONE, false);
        this.game.world.setBlock(cx + s, cy + y, cz + i, BLOCK.STONE, false);
      }
    }

    // 中心装饰
    for (let y = 0; y < 5; y++) {
      this.game.world.setBlock(cx, cy + y, cz, BLOCK.GLASS, false);
    }

    // 传送所有玩家到竞技场
    this.game.player.position = { x: cx, y: cy, z: cz };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };

    // 给玩家装备
    this.game.player.inventory = new Array(36).fill(null);
    this.game.player.inventory[0] = { id: BLOCK.STONE, count: 64 };
    this.game.player.inventory[1] = { id: BLOCK.COBBLESTONE, count: 64 };
    this.game.player.inventory[2] = { id: BLOCK.GLASS, count: 32 };
    this.game.player.health = 20;
  }

  // ===== 建造大战 =====
  setupBuildBattle(theme) {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 每个玩家分配一个建造区域
    const plotSize = 16;

    // 清理并铺设地面
    for (let x = -plotSize; x < plotSize; x++) {
      for (let z = -plotSize; z < plotSize; z++) {
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.GRASS, false);
        for (let y = cy; y < cy + 20; y++) {
          this.game.world.setBlock(cx + x, y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 给玩家大量方块
    this.game.player.inventory = new Array(36).fill(null);
    const buildBlocks = [BLOCK.STONE, BLOCK.PLANKS, BLOCK.GLASS, BLOCK.BRICK, BLOCK.PLANKS, BLOCK.LOG, BLOCK.LEAVES, BLOCK.SAND, BLOCK.SNOW, BLOCK.CRAFTING_TABLE];
    for (let i = 0; i < buildBlocks.length; i++) {
      this.game.player.inventory[i] = { id: buildBlocks[i], count: 64 };
    }

    this.game.player.position = { x: cx, y: cy, z: cz };
    this.game.ui.showToast(`主题: ${theme} — 你有 ${this.timeLimit} 秒！`);
  }

  // ===== 掘雪场 Spleef =====
  setupSpleef() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;
    const s = 20;

    // 建造雪地板
    for (let x = -s; x <= s; x++) {
      for (let z = -s; z <= s; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist > s) continue;
        this.game.world.setBlock(cx + x, cy, cz + z, BLOCK.SNOW, false);
        // 下方是岩浆（视觉）
        this.game.world.setBlock(cx + x, cy - 5, cz + z, BLOCK.COBBLESTONE, false);
        // 清空上方
        for (let y = 1; y <= 5; y++) {
          this.game.world.setBlock(cx + x, cy + y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 多层地板
    for (let layer = 1; layer <= 2; layer++) {
      for (let x = -s + 3; x <= s - 3; x++) {
        for (let z = -s + 3; z <= s - 3; z++) {
          this.game.world.setBlock(cx + x, cy - layer * 3, cz + z, BLOCK.SNOW, false);
        }
      }
    }

    this.game.player.position = { x: cx, y: cy + 1, z: cz };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };
    this.game.ui.showToast('掘雪场！挖掉脚下方块让对手掉落！');
  }

  // ===== 夺旗 =====
  setupCaptureFlag() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 蓝队基地
    const blueX = cx - 30;
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        this.game.world.setBlock(blueX + x, cy - 1, cz + z, BLOCK.COBBLESTONE, false);
      }
    }
    // 蓝旗
    this.game.world.setBlock(blueX, cy, cz, BLOCK.LOG, false);
    this.game.world.setBlock(blueX, cy + 1, cz, BLOCK.LEAVES, false);
    this.blueFlag = { x: blueX, y: cy, z: cz, taken: false };

    // 红队基地
    const redX = cx + 30;
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        this.game.world.setBlock(redX + x, cy - 1, cz + z, BLOCK.SAND, false);
      }
    }
    // 红旗
    this.game.world.setBlock(redX, cy, cz, BLOCK.LOG, false);
    this.game.world.setBlock(redX, cy + 1, cz, BLOCK.LEAVES, false);
    this.redFlag = { x: redX, y: cy, z: cz, taken: false };

    this.game.player.position = { x: blueX, y: cy, z: cz };
    this.game.ui.showToast('夺旗模式！夺取对方旗帜带回基地！');
  }

  // ===== 更新 =====
  update(dt) {
    if (!this.isActive) return;

    this.timer += dt;
    if (this.timer >= this.timeLimit) {
      this.stopMinigame();
      return;
    }

    // PvP：检查玩家间距离
    if (this.currentGame === MINIGAME.PVP_ARENA) {
      // 检查是否离开竞技场
      const px = this.game.player.position.x;
      const pz = this.game.player.position.z;
      const dist = Math.sqrt(
        (px - this.arenaCenter.x) ** 2 +
        (pz - this.arenaCenter.z) ** 2
      );
      if (dist > this.arenaSize + 2) {
        // 传送回中心
        this.game.player.position = { ...this.arenaCenter };
        this.game.player.velocity = { x: 0, y: 0, z: 0 };
        this.game.ui.showToast('不要离开竞技场！');
      }
    }

    // Spleef：检查玩家是否掉落
    if (this.currentGame === MINIGAME.SPLEEF) {
      if (this.game.player.position.y < this.arenaCenter.y - 6) {
        this.game.ui.showToast('你掉落了！(-1 分)');
        this.game.player.position = { x: this.arenaCenter.x, y: this.arenaCenter.y + 1, z: this.arenaCenter.z };
        this.game.player.velocity = { x: 0, y: 0, z: 0 };
        const name = this.game.multiplayer?.playerName || '玩家';
        const current = this.scores.get(name) || 0;
        this.scores.set(name, current - 1);
        // 多人同步得分
        if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current - 1);
      }
    }

    // 夺旗：检查是否拿到旗帜
    if (this.currentGame === MINIGAME.CAPTURE_FLAG) {
      const px = this.game.player.position.x;
      const py = this.game.player.position.y;
      const pz = this.game.player.position.z;

      if (!this.redFlag.taken) {
        const dist = Math.sqrt(
          (px - this.redFlag.x) ** 2 +
          (py - this.redFlag.y) ** 2 +
          (pz - this.redFlag.z) ** 2
        );
        if (dist < 2) {
          this.redFlag.taken = true;
          this.game.ui.showToast('🚩 拿到红旗！带回蓝队基地！');
        }
      } else {
        // 检查是否回到蓝队基地
        const dist = Math.sqrt(
          (px - this.blueFlag.x) ** 2 +
          (pz - this.blueFlag.z) ** 2
        );
        if (dist < 3) {
          this.redFlag.taken = false;
          const name = this.game.multiplayer?.playerName || '玩家';
          const current = this.scores.get(name) || 0;
          this.scores.set(name, current + 1);
          this.game.ui.showToast(`🏆 得分！${name}: ${current + 1} 分`);
          // 多人同步得分
          if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current + 1);
        }
      }
    }

    // 跑酷竞速：检查检查点
    if (this.currentGame === MINIGAME.PARKOUR_RACE) {
      this.updateParkourRace(dt);
    }

    // TNT跑酷：方块消失
    if (this.currentGame === MINIGAME.TNT_PARKOUR) {
      this.updateTNTParkour(dt);
    }

    // 床战：检查床是否被破坏
    if (this.currentGame === MINIGAME.BED_WARS) {
      this.updateBedWars(dt);
    }

    // 空岛战争：检查玩家是否掉落
    if (this.currentGame === MINIGAME.SKYWARS) {
      this.updateSkywars(dt);
    }

    // 躲猫猫
    if (this.currentGame === MINIGAME.HIDE_AND_SEEK) {
      this.updateHideAndSeek(dt);
    }
  }

  // ===== 跑酷竞速 =====
  setupParkourRace() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 清理起点区域
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.PLANKS, false);
        for (let y = 0; y <= 5; y++) {
          this.game.world.setBlock(cx + x, cy + y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 生成跑酷赛道：跳跃平台
    this.parkourCheckpoints = [];
    let dir = 0; // 0=+x, 1=+z, 2=-x, 3=-z
    let px = cx, py = cy, pz = cz;
    const segmentCount = 20;

    for (let i = 0; i < segmentCount; i++) {
      const gap = 2 + Math.floor(Math.random() * 2);
      const jumpHeight = Math.random() > 0.5 ? 1 : 0;
      const platformLen = 2 + Math.floor(Math.random() * 2);

      // 计算方向偏移
      const dx = dir === 0 ? 1 : dir === 2 ? -1 : 0;
      const dz = dir === 1 ? 1 : dir === 3 ? -1 : 0;

      // 跳跃间隙
      px += dx * gap;
      pz += dz * gap;
      py += jumpHeight;

      // 建造平台
      for (let j = 0; j < platformLen; j++) {
        this.game.world.setBlock(px + dx * j, py - 1, pz + dz * j, BLOCK.PLANKS, false);
        // 清空上方
        for (let y = 0; y <= 3; y++) {
          this.game.world.setBlock(px + dx * j, py + y, pz + dz * j, BLOCK.AIR, false);
        }
      }

      // 每5格设一个检查点
      if (i % 5 === 4) {
        this.parkourCheckpoints.push({ x: px, y: py, z: pz, reached: false });
        // 检查点标记方块
        this.game.world.setBlock(px, py, pz + 1, BLOCK.GLOWSTONE, false);
        this.game.world.setBlock(px, py + 2, pz + 1, BLOCK.TORCH, false);
      }

      // 随机转向
      if (Math.random() > 0.6) {
        dir = (dir + 1) % 4;
      }

      px += dx * platformLen;
      pz += dz * platformLen;
    }

    // 终点
    this.parkourFinish = { x: px, y: py, z: pz, reached: false };
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        this.game.world.setBlock(px + x, py - 1, pz + z, BLOCK.GOLD_BLOCK, false);
      }
    }
    // 终点标记
    for (let y = 0; y < 5; y++) {
      this.game.world.setBlock(px, py + y, pz, BLOCK.GLOWSTONE, false);
    }

    this.lastCheckpoint = { x: cx, y: cy, z: cz };
    this.game.player.position = { x: cx, y: cy, z: cz };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };
    this.game.ui.showToast('跑酷竞速！到达金色终点获胜！');
  }

  updateParkourRace(dt) {
    const px = this.game.player.position.x;
    const py = this.game.player.position.y;
    const pz = this.game.player.position.z;

    // 检查检查点
    for (const cp of this.parkourCheckpoints || []) {
      if (!cp.reached) {
        const dist = Math.sqrt((px - cp.x) ** 2 + (py - cp.y) ** 2 + (pz - cp.z) ** 2);
        if (dist < 2) {
          cp.reached = true;
          this.lastCheckpoint = { x: cp.x, y: cp.y, z: cp.z };
          this.game.ui.showToast('✅ 检查点已到达！');
        }
      }
    }

    // 掉落重置
    if (py < this.arenaCenter.y - 10) {
      this.game.player.position = { ...this.lastCheckpoint };
      this.game.player.velocity = { x: 0, y: 0, z: 0 };
      const name = this.game.multiplayer?.playerName || '玩家';
      const current = this.scores.get(name) || 0;
      this.scores.set(name, current - 1);
      if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current - 1);
      this.game.ui.showToast('掉落！回到检查点 (-1分)');
    }

    // 到达终点
    if (this.parkourFinish && !this.parkourFinish.reached) {
      const dist = Math.sqrt((px - this.parkourFinish.x) ** 2 + (pz - this.parkourFinish.z) ** 2);
      if (dist < 3 && Math.abs(py - this.parkourFinish.y) < 3) {
        this.parkourFinish.reached = true;
        const name = this.game.multiplayer?.playerName || '玩家';
        const current = this.scores.get(name) || 0;
        this.scores.set(name, current + 10);
        if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current + 10);
        this.game.ui.showToast(`🏆 ${name} 到达终点！+10分！`);
      }
    }
  }

  // ===== TNT跑酷 =====
  setupTNTParkour() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 起点平台
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.STONE, false);
        for (let y = 0; y <= 5; y++) {
          this.game.world.setBlock(cx + x, cy + y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 生成 TNT 跑酷路径：踩到的方块会消失
    this.tntPlatformBlocks = []; // 记录所有跑酷方块 {x,y,z, timer}
    let dir = 0;
    let px = cx, py = cy, pz = cz;
    const length = 30;

    for (let i = 0; i < length; i++) {
      const dx = dir === 0 ? 1 : dir === 2 ? -1 : 0;
      const dz = dir === 1 ? 1 : dir === 3 ? -1 : 0;

      px += dx * 2;
      pz += dz * 2;

      // 跑酷方块（用沙子表示会消失的方块）
      this.game.world.setBlock(px, py - 1, pz, BLOCK.SAND, false);
      this.tntPlatformBlocks.push({ x: px, y: py - 1, z: pz, timer: -1, triggered: false });

      // 随机升降
      if (Math.random() > 0.7) {
        py += 1;
      }

      // 随机转向
      if (Math.random() > 0.7) {
        dir = (dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
      }
    }

    // 终点
    this.game.world.setBlock(px, py - 1, pz, BLOCK.GOLD_BLOCK, false);
    this.tntFinish = { x: px, y: py, z: pz };

    this.game.player.position = { x: cx, y: cy, z: cz };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };
    this.game.ui.showToast('TNT跑酷！踩到的方块会消失，快跑！');
  }

  updateTNTParkour(dt) {
    const ppx = Math.floor(this.game.player.position.x);
    const ppy = Math.floor(this.game.player.position.y) - 1;
    const ppz = Math.floor(this.game.player.position.z);

    // 检查玩家踩到的方块
    for (const block of this.tntPlatformBlocks || []) {
      if (block.x === ppx && block.y === ppy && block.z === ppz && !block.triggered) {
        block.triggered = true;
        block.timer = 1.0; // 1秒后消失
      }

      // 倒计时消失
      if (block.triggered && block.timer > 0) {
        block.timer -= dt;
        // 闪烁效果（更换方块为TNT表示即将爆炸）
        if (block.timer < 0.5 && this.game.world.getBlock(block.x, block.y, block.z) !== BLOCK.TNT) {
          this.game.world.setBlock(block.x, block.y, block.z, BLOCK.TNT, false);
        }
        if (block.timer <= 0) {
          this.game.world.setBlock(block.x, block.y, block.z, BLOCK.AIR, false);
          if (this.game.effects) {
            this.game.effects.createBlockBreakParticles(block.x, block.y, block.z, BLOCK.SAND);
          }
          // 多人同步
          if (this.game.multiplayer) {
            this.game.multiplayer.sendBlockChange(block.x, block.y, block.z, BLOCK.AIR);
          }
        }
      }
    }

    // 掉落重置
    if (this.game.player.position.y < this.arenaCenter.y - 15) {
      this.game.player.position = { x: this.arenaCenter.x, y: this.arenaCenter.y, z: this.arenaCenter.z };
      this.game.player.velocity = { x: 0, y: 0, z: 0 };
      const name = this.game.multiplayer?.playerName || '玩家';
      const current = this.scores.get(name) || 0;
      this.scores.set(name, current - 1);
      if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current - 1);
      this.game.ui.showToast('掉落！(-1分)');
    }

    // 到达终点
    if (this.tntFinish) {
      const dist = Math.sqrt(
        (this.game.player.position.x - this.tntFinish.x) ** 2 +
        (this.game.player.position.z - this.tntFinish.z) ** 2
      );
      if (dist < 2) {
        const name = this.game.multiplayer?.playerName || '玩家';
        const current = this.scores.get(name) || 0;
        this.scores.set(name, current + 10);
        if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current + 10);
        this.game.ui.showToast(`🏆 ${name} 完成TNT跑酷！+10分！`);
        this.tntFinish = null;
      }
    }
  }

  // ===== 床战 =====
  setupBedWars() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 蓝队基地
    const blueBase = { x: cx - 25, y: cy, z: cz - 25 };
    // 红队基地
    const redBase = { x: cx + 25, y: cy, z: cz + 25 };

    // 建造蓝队基地
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        this.game.world.setBlock(blueBase.x + x, cy - 1, blueBase.z + z, BLOCK.COBBLESTONE, false);
        for (let y = 0; y <= 6; y++) {
          this.game.world.setBlock(blueBase.x + x, cy + y, blueBase.z + z, BLOCK.AIR, false);
        }
      }
    }
    // 蓝队床
    this.game.world.setBlock(blueBase.x, cy, blueBase.z, BLOCK.BED_BLOCK, false);
    // 蓝队墙
    for (let y = 0; y <= 3; y++) {
      this.game.world.setBlock(blueBase.x + 4, cy + y, blueBase.z, BLOCK.STONE, false);
      this.game.world.setBlock(blueBase.x - 4, cy + y, blueBase.z, BLOCK.STONE, false);
      this.game.world.setBlock(blueBase.x, cy + y, blueBase.z + 4, BLOCK.STONE, false);
      this.game.world.setBlock(blueBase.x, cy + y, blueBase.z - 4, BLOCK.STONE, false);
    }

    // 建造红队基地
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        this.game.world.setBlock(redBase.x + x, cy - 1, redBase.z + z, BLOCK.SANDSTONE, false);
        for (let y = 0; y <= 6; y++) {
          this.game.world.setBlock(redBase.x + x, cy + y, redBase.z + z, BLOCK.AIR, false);
        }
      }
    }
    // 红队床
    this.game.world.setBlock(redBase.x, cy, redBase.z, BLOCK.BED_BLOCK, false);
    // 红队墙
    for (let y = 0; y <= 3; y++) {
      this.game.world.setBlock(redBase.x + 4, cy + y, redBase.z, BLOCK.STONE, false);
      this.game.world.setBlock(redBase.x - 4, cy + y, redBase.z, BLOCK.STONE, false);
      this.game.world.setBlock(redBase.x, cy + y, redBase.z + 4, BLOCK.STONE, false);
      this.game.world.setBlock(redBase.x, cy + y, redBase.z - 4, BLOCK.STONE, false);
    }

    // 中间桥梁
    for (let i = -20; i <= 20; i++) {
      this.game.world.setBlock(cx + i, cy - 1, cz, BLOCK.PLANKS, false);
    }

    this.blueBed = { x: blueBase.x, y: cy, z: blueBase.z, alive: true };
    this.redBed = { x: redBase.x, y: cy, z: redBase.z, alive: true };

    // 给玩家装备
    this.game.player.inventory = new Array(36).fill(null);
    this.game.player.inventory[0] = { id: BLOCK.STONE, count: 64 };
    this.game.player.inventory[1] = { id: BLOCK.PLANKS, count: 64 };
    this.game.player.inventory[2] = { id: BLOCK.SAND, count: 32 };
    this.game.player.inventory[3] = { id: BLOCK.TNT, count: 8 };
    this.game.player.inventory[4] = { id: BLOCK.GLASS, count: 32 };
    this.game.player.health = 20;

    this.game.player.position = { x: blueBase.x, y: cy + 1, z: blueBase.z };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };
    this.game.ui.showToast('床战！保护你的床，摧毁对方的床！');
  }

  updateBedWars(dt) {
    // 检查蓝队床是否被破坏
    if (this.blueBed && this.blueBed.alive) {
      const block = this.game.world.getBlock(this.blueBed.x, this.blueBed.y, this.blueBed.z);
      if (block !== BLOCK.BED_BLOCK) {
        this.blueBed.alive = false;
        this.game.ui.showToast('❌ 你的床被破坏了！无法重生！');
      }
    }

    // 检查红队床是否被破坏
    if (this.redBed && this.redBed.alive) {
      const block = this.game.world.getBlock(this.redBed.x, this.redBed.y, this.redBed.z);
      if (block !== BLOCK.BED_BLOCK) {
        this.redBed.alive = false;
        const name = this.game.multiplayer?.playerName || '玩家';
        const current = this.scores.get(name) || 0;
        this.scores.set(name, current + 5);
        if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current + 5);
        this.game.ui.showToast(`🏆 红队床被摧毁！+5分！`);
        this.redBed = null;
      }
    }

    // 玩家死亡后检查是否有床
    if (this.game.player.dead || this.game.player.health <= 0) {
      if (this.blueBed && this.blueBed.alive) {
        // 重生
        this.game.player.health = 20;
        this.game.player.dead = false;
        this.game.player.position = { x: this.blueBed.x, y: this.arenaCenter.y + 1, z: this.blueBed.z };
        this.game.player.velocity = { x: 0, y: 0, z: 0 };
        this.game.ui.showToast('你在基地重生了！');
      }
    }
  }

  // ===== 空岛战争 =====
  setupSkywars() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 生成多个空岛
    this.skywarsIslands = [];
    const islandCount = 6;
    const radius = 18;

    for (let i = 0; i < islandCount; i++) {
      const angle = (i / islandCount) * Math.PI * 2;
      const ix = cx + Math.cos(angle) * radius;
      const iy = cy + Math.floor(Math.random() * 4);
      const iz = cz + Math.sin(angle) * radius;
      const islandRadius = 4 + Math.floor(Math.random() * 2);

      // 建造空岛
      for (let x = -islandRadius; x <= islandRadius; x++) {
        for (let z = -islandRadius; z <= islandRadius; z++) {
          const dist = Math.sqrt(x * x + z * z);
          if (dist > islandRadius) continue;
          this.game.world.setBlock(ix + x, iy - 1, iz + z, BLOCK.GRASS, false);
          // 清空上方
          for (let y = 0; y <= 8; y++) {
            this.game.world.setBlock(ix + x, iy + y, iz + z, BLOCK.AIR, false);
          }
        }
      }

      // 每个岛放一个宝箱
      this.game.world.setBlock(ix, iy, iz, BLOCK.CHEST, false);

      // 岛上放一棵树
      if (Math.random() > 0.3) {
        const tx = ix + 1, tz = iz - 1;
        for (let y = 0; y < 4; y++) {
          this.game.world.setBlock(tx, iy + y, tz, BLOCK.LOG, false);
        }
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 3; dy <= 4; dy++) {
              if (Math.abs(dx) + Math.abs(dz) <= 2) {
                this.game.world.setBlock(tx + dx, iy + dy, tz + dz, BLOCK.LEAVES, false);
              }
            }
          }
        }
      }

      this.skywarsIslands.push({ x: ix, y: iy, z: iz });
    }

    // 中间岛
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist > 3) continue;
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.OBSIDIAN, false);
        for (let y = 0; y <= 6; y++) {
          this.game.world.setBlock(cx + x, cy + y, cz + z, BLOCK.AIR, false);
        }
      }
    }
    // 中间岛宝箱（更好奖励）
    this.game.world.setBlock(cx, cy, cz, BLOCK.CHEST, false);

    // 传送玩家到第一个岛
    const startIsland = this.skywarsIslands[0];
    this.game.player.position = { x: startIsland.x, y: startIsland.y + 1, z: startIsland.z };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };

    // 给基础装备
    this.game.player.inventory = new Array(36).fill(null);
    this.game.player.inventory[0] = { id: BLOCK.STONE, count: 32 };
    this.game.player.inventory[1] = { id: BLOCK.PLANKS, count: 16 };
    this.game.player.health = 20;

    this.game.ui.showToast('空岛战争！搜刮宝箱，消灭对手！');
  }

  updateSkywars(dt) {
    // 玩家掉入虚空
    if (this.game.player.position.y < this.arenaCenter.y - 20) {
      const name = this.game.multiplayer?.playerName || '玩家';
      const current = this.scores.get(name) || 0;
      this.scores.set(name, current - 1);
      if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current - 1);

      // 重生到最近的岛
      if (this.skywarsIslands && this.skywarsIslands.length > 0) {
        const island = this.skywarsIslands[0];
        this.game.player.position = { x: island.x, y: island.y + 1, z: island.z };
        this.game.player.velocity = { x: 0, y: 0, z: 0 };
        this.game.player.health = 20;
        this.game.player.dead = false;
        this.game.ui.showToast('掉入虚空！(-1分)');
      }
    }
  }

  // ===== 躲猫猫 =====
  setupHideAndSeek() {
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    // 建造一个有大量方块的迷宫式建筑
    const buildingSize = 24;
    for (let x = -buildingSize; x <= buildingSize; x++) {
      for (let z = -buildingSize; z <= buildingSize; z++) {
        // 地面
        this.game.world.setBlock(cx + x, cy - 1, cz + z, BLOCK.GRASS, false);
        // 清空
        for (let y = 0; y <= 10; y++) {
          this.game.world.setBlock(cx + x, cy + y, cz + z, BLOCK.AIR, false);
        }
      }
    }

    // 围墙
    for (let i = -buildingSize; i <= buildingSize; i++) {
      for (let y = 0; y <= 5; y++) {
        this.game.world.setBlock(cx + i, cy + y, cz - buildingSize, BLOCK.STONE, false);
        this.game.world.setBlock(cx + i, cy + y, cz + buildingSize, BLOCK.STONE, false);
        this.game.world.setBlock(cx - buildingSize, cy + y, cz + i, BLOCK.STONE, false);
        this.game.world.setBlock(cx + buildingSize, cy + y, cz + i, BLOCK.STONE, false);
      }
    }

    // 随机放置方块（作为躲藏道具）
    const propBlocks = [BLOCK.PLANKS, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.LEAVES, BLOCK.BRICK, BLOCK.LOG, BLOCK.SAND, BLOCK.GLASS];
    for (let i = 0; i < 200; i++) {
      const x = cx + Math.floor((Math.random() - 0.5) * buildingSize * 1.8);
      const y = cy + Math.floor(Math.random() * 5);
      const z = cz + Math.floor((Math.random() - 0.5) * buildingSize * 1.8);
      const block = propBlocks[Math.floor(Math.random() * propBlocks.length)];
      this.game.world.setBlock(x, y, z, block, false);
    }

    // 建造几个小屋
    for (let h = 0; h < 5; h++) {
      const hx = cx + Math.floor((Math.random() - 0.5) * 30);
      const hz = cz + Math.floor((Math.random() - 0.5) * 30);
      const hw = 3 + Math.floor(Math.random() * 2);
      // 地板
      for (let x = -hw; x <= hw; x++) {
        for (let z = -hw; z <= hw; z++) {
          this.game.world.setBlock(hx + x, cy, hz + z, BLOCK.PLANKS, false);
        }
      }
      // 墙
      for (let y = 1; y <= 3; y++) {
        for (let x = -hw; x <= hw; x++) {
          this.game.world.setBlock(hx + x, cy + y, hz - hw, BLOCK.PLANKS, false);
          this.game.world.setBlock(hx + x, cy + y, hz + hw, BLOCK.PLANKS, false);
        }
        for (let z = -hw; z <= hw; z++) {
          this.game.world.setBlock(hx - hw, cy + y, hz + z, BLOCK.PLANKS, false);
          this.game.world.setBlock(hx + hw, cy + y, hz + z, BLOCK.PLANKS, false);
        }
      }
      // 屋顶
      for (let x = -hw; x <= hw; x++) {
        for (let z = -hw; z <= hw; z++) {
          this.game.world.setBlock(hx + x, cy + 4, hz + z, BLOCK.LOG, false);
        }
      }
    }

    // 躲猫猫状态
    this.hideSeekPhase = 'hide'; // hide -> seek
    this.hideTimer = 20; // 20秒躲藏时间
    this.seekTimer = 0;
    this.disguiseBlock = null; // 玩家伪装的方块

    this.game.player.position = { x: cx, y: cy + 1, z: cz };
    this.game.player.velocity = { x: 0, y: 0, z: 0 };
    this.game.ui.showToast('躲猫猫！你有20秒躲藏，然后躲避寻找者！');
  }

  updateHideAndSeek(dt) {
    if (this.hideSeekPhase === 'hide') {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) {
        this.hideSeekPhase = 'seek';
        this.seekTimer = this.timeLimit - this.timer;
        this.game.ui.showToast('⏰ 躲藏时间结束！寻找者开始行动！');
        // 生成一个寻找者（僵尸代替）
        if (this.game.mobs) {
          const px = this.game.player.position.x;
          const py = this.game.player.position.y;
          const pz = this.game.player.position.z;
          // 在远处生成3个寻找者
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            this.game.mobs.spawnMob(
              this.arenaCenter.x + Math.cos(angle) * 15,
              this.arenaCenter.y + 1,
              this.arenaCenter.z + Math.sin(angle) * 15,
              'zombie'
            );
          }
        }
      } else if (Math.floor(this.hideTimer) !== Math.floor(this.hideTimer + dt)) {
        this.game.ui.showToast(`躲藏时间: ${Math.ceil(this.hideTimer)}秒`);
      }
    }

    // 检查玩家是否伪装（蹲下不动时伪装成附近方块）
    if (this.hideSeekPhase === 'seek') {
      if (this.game.player.sneaking) {
        // 玩家蹲下时伪装
        if (!this.disguiseBlock) {
          // 记录伪装方块
          const blockBelow = this.game.world.getBlock(
            Math.floor(this.game.player.position.x),
            Math.floor(this.game.player.position.y) - 1,
            Math.floor(this.game.player.position.z)
          );
          if (blockBelow !== 0) {
            this.disguiseBlock = blockBelow;
            this.game.ui.showToast(`已伪装为: ${this.game.world.getBlock ? '' : ''}方块`);
          }
        }
      } else {
        this.disguiseBlock = null;
      }

      // 存活奖励
      this.seekSurvivalTimer = (this.seekSurvivalTimer || 0) + dt;
      if (this.seekSurvivalTimer >= 10) {
        this.seekSurvivalTimer = 0;
        const name = this.game.multiplayer?.playerName || '玩家';
        const current = this.scores.get(name) || 0;
        this.scores.set(name, current + 1);
        if (this.game.multiplayer) this.game.multiplayer.sendMinigameScore(name, current + 1);
      }
    }
  }

  addScore(playerName, score) {
    const current = this.scores.get(playerName) || 0;
    this.scores.set(playerName, current + score);
  }

  getWinner() {
    let maxScore = 0;
    let winner = null;
    for (const [name, score] of this.scores) {
      if (score > maxScore) {
        maxScore = score;
        winner = name;
      }
    }
    return winner;
  }

  getTimeRemaining() {
    return Math.max(0, Math.ceil(this.timeLimit - this.timer));
  }

  getScoreboard() {
    const entries = Array.from(this.scores.entries()).sort((a, b) => b[1] - a[1]);
    return entries.map(([name, score], i) => `${i + 1}. ${name}: ${score}分`).join('\n');
  }

  serialize() {
    return {
      currentGame: this.currentGame,
      scores: Array.from(this.scores.entries()),
      timer: this.timer,
      isActive: this.isActive,
    };
  }
}
