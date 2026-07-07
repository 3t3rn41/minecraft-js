/**
 * redstone.js — 红石电路系统
 * 红石粉传导、红石火把反相、拉杆/按钮/压力板触发、红石灯亮灭、活塞推动
 */

import { BLOCK, BLOCK_DEFS } from './blocks.js';

export class RedstoneSystem {
  constructor(game) {
    this.game = game;
    this.powerMap = new Map(); // "x,y,z" -> power (0-15)
    this.updateQueue = new Set(); // 需要更新的坐标
    this.leverStates = new Map(); // 拉杆开关状态
    this.buttonTimers = new Map(); // 按钮倒计时
    this.pistonCooldowns = new Map();
    this.updateTimer = 0;
    this.updateInterval = 0.1; // 每 100ms 更新一次
  }

  // 当方块被放置/破坏时调用
  onBlockChange(x, y, z, oldBlock, newBlock) {
    const oldDef = BLOCK_DEFS[oldBlock];
    const newDef = BLOCK_DEFS[newBlock];

    // 如果是红石相关方块变化，标记需要更新
    if ((oldDef && oldDef.redstone) || (newDef && newDef.redstone)) {
      this.markForUpdate(x, y, z);
    }

    // 活塞被放置时初始化
    if (newBlock === BLOCK.PISTON) {
      this.checkPistonActivation(x, y, z);
    }
  }

  // 标记坐标及其邻居需要更新
  markForUpdate(x, y, z) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          this.updateQueue.add(`${x + dx},${y + dy},${z + dz}`);
        }
      }
    }
  }

  // 玩家交互（拉杆/按钮）
  onInteract(x, y, z, blockId) {
    const key = `${x},${y},${z}`;
    const def = BLOCK_DEFS[blockId];

    if (!def || !def.redstone) return false;

    if (def.redstone === 'lever') {
      const state = this.leverStates.get(key) || false;
      this.leverStates.set(key, !state);
      this.markForUpdate(x, y, z);
      if (this.game.ui) this.game.ui.showToast(`拉杆: ${!state ? '开启' : '关闭'}`);
      // 多人同步
      if (this.game.multiplayer) this.game.multiplayer.sendRedstoneUpdate(x, y, z, !state);
      return true;
    }

    if (def.redstone === 'button') {
      this.buttonTimers.set(key, 1.5); // 1.5 秒后自动关闭
      this.markForUpdate(x, y, z);
      if (this.game.ui) this.game.ui.showToast('按钮按下！');
      // 多人同步
      if (this.game.multiplayer) this.game.multiplayer.sendRedstoneUpdate(x, y, z, undefined, 1.5);
      return true;
    }

    return false;
  }

  // 检查压力板是否被踩
  checkPressurePlates(playerPos) {
    const px = Math.floor(playerPos.x);
    const py = Math.floor(playerPos.y);
    const pz = Math.floor(playerPos.z);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const block = this.game.world.getBlock(px + dx, py - 1, pz + dz);
        if (block === BLOCK.STONE_PRESSURE_PLATE) {
          const key = `${px + dx},${py - 1},${pz + dz}`;
          this.buttonTimers.set(key, 0.2);
          this.markForUpdate(px + dx, py - 1, pz + dz);
        }
      }
    }
  }

  // 获取某个位置的信号强度
  getPower(x, y, z) {
    const key = `${x},${y},${z}`;
    return this.powerMap.get(key) || 0;
  }

  // 计算某个位置应该有多少信号
  computePower(x, y, z) {
    const block = this.game.world.getBlock(x, y, z);
    const def = BLOCK_DEFS[block];
    if (!def) return 0;

    const key = `${x},${y},${z}`;

    // 信号源
    if (def.redstone === 'lever') {
      return this.leverStates.get(key) ? 15 : 0;
    }
    if (def.redstone === 'button' || def.redstone === 'plate') {
      return this.buttonTimers.has(key) ? 15 : 0;
    }
    if (def.redstone === 'torch') {
      // 红石火把：如果附着面有信号则熄灭（反相器）
      return 15; // 简化：始终输出15
    }

    // 红石粉：取邻居中最大的信号 - 1
    if (def.redstone === 'dust') {
      let maxNeighbor = 0;
      const neighbors = [
        [x + 1, y, z], [x - 1, y, z],
        [x, y, z + 1], [x, y, z - 1],
        [x + 1, y - 1, z], [x - 1, y - 1, z],
        [x, y - 1, z + 1], [x, y - 1, z - 1],
        [x + 1, y + 1, z], [x - 1, y + 1, z],
        [x, y + 1, z + 1], [x, y + 1, z - 1],
      ];
      for (const [nx, ny, nz] of neighbors) {
        const nBlock = this.game.world.getBlock(nx, ny, nz);
        const nDef = BLOCK_DEFS[nBlock];
        if (nDef && (nDef.redstone === 'dust' || nDef.redstone === 'torch' ||
                     nDef.redstone === 'lever' || nDef.redstone === 'button')) {
          const nPower = this.getPower(nx, ny, nz);
          maxNeighbor = Math.max(maxNeighbor, nPower);
        }
        // 红石块直接输出信号
        if (nBlock === BLOCK.REDSTONE_BLOCK) {
          maxNeighbor = 15;
        }
      }
      return Math.max(0, maxNeighbor - 1);
    }

    return 0;
  }

  // 更新红石网络
  updateRedstone() {
    // BFS 更新所有受影响的位置
    const visited = new Set();
    const queue = Array.from(this.updateQueue);
    this.updateQueue.clear();

    while (queue.length > 0) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      visited.add(key);

      const [x, y, z] = key.split(',').map(Number);
      const block = this.game.world.getBlock(x, y, z);
      const def = BLOCK_DEFS[block];
      if (!def || !def.redstone) continue;

      const newPower = this.computePower(x, y, z);
      const oldPower = this.getPower(x, y, z);

      if (newPower !== oldPower) {
        this.powerMap.set(key, newPower);
        // 传播到邻居
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const nKey = `${x + dx},${y + dy},${z + dz}`;
              if (!visited.has(nKey)) {
                queue.push(nKey);
              }
            }
          }
        }
        // 触发输出方块
        this.updateOutputBlocks(x, y, z, newPower);
      }
    }
  }

  // 更新输出方块（灯、活塞）
  updateOutputBlocks(x, y, z, power) {
    // 检查相邻方块是否是红石灯或活塞
    const neighbors = [
      [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z],
      [x, y, z + 1], [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
      const block = this.game.world.getBlock(nx, ny, nz);
      const def = BLOCK_DEFS[block];

      if (def && def.redstone === 'lamp') {
        // 红石灯亮灭效果（通过亮度模拟）
        if (power > 0) {
          // 点亮：在方块上方放置光源
          if (this.game.world.setBlock(nx, ny, nz, block, false)) {
            // 标记区块重新渲染
            this.game.world.markChunkDirty(Math.floor(nx / 16), Math.floor(nz / 16));
          }
        }
      }

      if (def && def.redstone === 'piston') {
        if (power > 0) {
          this.activatePiston(nx, ny, nz);
        }
      }
    }
  }

  // 活塞激活
  activatePiston(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.pistonCooldowns.has(key)) return;
    this.pistonCooldowns.set(key, 2.0);

    // 简化版：推动前方一个方块
    // 需要知道活塞朝向，这里假设向上推
    const targetY = y + 1;
    const block = this.game.world.getBlock(x, targetY, z);
    if (block !== 0 && block !== BLOCK.BEDROCK) {
      const def = BLOCK_DEFS[block];
      if (def && def.solid && !def.liquid) {
        // 推动方块
        this.game.world.setBlock(x, targetY, z, 0, false);
        this.game.world.setBlock(x, targetY + 1, z, block, false);
        this.game.world.markChunkDirty(Math.floor(x / 16), Math.floor(z / 16));

        // 多人同步
        if (this.game.multiplayer) {
          this.game.multiplayer.sendBlockChange(x, targetY, z, 0);
          this.game.multiplayer.sendBlockChange(x, targetY + 1, z, block);
        }
      }
    }
  }

  // 检查活塞是否被激活
  checkPistonActivation(x, y, z) {
    const neighbors = [
      [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z],
      [x, y, z + 1], [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
      const power = this.getPower(nx, ny, nz);
      if (power > 0) {
        this.activatePiston(x, y, z);
        break;
      }
    }
  }

  // 每帧更新
  update(dt) {
    this.updateTimer -= dt;
    if (this.updateTimer <= 0) {
      this.updateTimer = this.updateInterval;
      if (this.updateQueue.size > 0) {
        this.updateRedstone();
      }
    }

    // 更新按钮/压力板计时器
    for (const [key, timer] of this.buttonTimers) {
      const newTimer = timer - this.updateInterval;
      if (newTimer <= 0) {
        this.buttonTimers.delete(key);
        const [x, y, z] = key.split(',').map(Number);
        this.markForUpdate(x, y, z);
      }
    }

    // 更新活塞冷却
    for (const [key, timer] of this.pistonCooldowns) {
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        this.pistonCooldowns.delete(key);
      }
    }

    // 检查玩家是否踩在压力板上
    if (this.game.player && !this.game.player.flying) {
      this.checkPressurePlates(this.game.player.position);
    }
  }

  // 获取某位置是否被充能
  isPowered(x, y, z) {
    // 检查六个方向
    const neighbors = [
      [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z],
      [x, y, z + 1], [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
      if (this.getPower(nx, ny, nz) > 0) return true;
      const block = this.game.world.getBlock(nx, ny, nz);
      if (block === BLOCK.REDSTONE_BLOCK) return true;
    }
    return false;
  }
}
