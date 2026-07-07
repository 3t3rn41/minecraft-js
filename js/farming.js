/**
 * farming.js — 农耕系统
 * 支持耕地、种植、作物生长、骨粉催熟、收获
 */

import { BLOCK, BLOCK_DEFS } from './blocks.js';

// 作物定义
export const CROP_DEFS = {
  [BLOCK.WHEAT_CROP]: {
    name: '小麦',
    maxStage: 7,
    growTime: 30, // 秒/阶段
    seedDrop: BLOCK.WHEAT_CROP,
    cropDrop: BLOCK.WHEAT_CROP,
    seedItem: 'wheat_seeds',
    cropItem: 'wheat',
    needsLight: true,
    needsWater: true,
    waterRange: 4,
  },
};

// 作物状态
export const CROP_STAGE_PREFIX = 'crop_stage_';

export class FarmingSystem {
  constructor(game) {
    this.game = game;
    this.crops = new Map(); // "x,y,z" -> { stage, growTimer, type }
    this.waterCheckCache = new Map();
  }

  // 当方块被放置时
  onBlockPlace(x, y, z, blockId) {
    if (blockId === BLOCK.WHEAT_CROP) {
      this.plantCrop(x, y, z, BLOCK.WHEAT_CROP);
    }
    if (blockId === BLOCK.FARMLAND) {
      // 检查附近水源
      this.checkFarmland(x, y, z);
    }
  }

  // 当方块被破坏时
  onBlockBreak(x, y, z, blockId) {
    if (blockId === BLOCK.WHEAT_CROP) {
      this.harvestCrop(x, y, z);
    }
    const key = `${x},${y},${z}`;
    this.crops.delete(key);
  }

  // 种植作物
  plantCrop(x, y, z, type) {
    const def = CROP_DEFS[type];
    if (!def) return false;
    this.crops.set(`${x},${y},${z}`, {
      type,
      stage: 0,
      growTimer: def.growTime,
    });
    return true;
  }

  // 收获作物
  harvestCrop(x, y, z) {
    const key = `${x},${y},${z}`;
    const crop = this.crops.get(key);
    if (!crop) return;

    const def = CROP_DEFS[crop.type];
    if (!def) return;

    if (crop.stage >= def.maxStage) {
      // 成熟收获
      const dropCount = 1 + Math.floor(Math.random() * 3);
      if (this.game.mobs) {
        this.game.mobs.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.cropDrop, dropCount);
      }
      if (this.game.achievements) {
        this.game.achievements.unlock('first_harvest');
      }
    } else {
      // 未成熟只掉种子
      if (this.game.mobs) {
        this.game.mobs.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.seedDrop, 1);
      }
    }
    this.crops.delete(key);
  }

  // 使用骨粉催熟
  applyBonemeal(x, y, z) {
    const key = `${x},${y},${z}`;
    const crop = this.crops.get(key);
    if (!crop) return false;

    const def = CROP_DEFS[crop.type];
    if (!def) return false;

    if (crop.stage < def.maxStage) {
      crop.stage += Math.ceil(def.maxStage / 4); // 骨粉加速1/4阶段
      crop.stage = Math.min(crop.stage, def.maxStage);
      crop.growTimer = def.growTime;

      // 粒子效果
      if (this.game.effects) {
        this.game.effects.createBlockBreakParticles(x, y, z, 0x90ee90);
      }
      return true;
    }
    return false;
  }

  // 检查耕地是否有水源
  checkFarmland(x, y, z) {
    const range = 4;
    for (let dx = -range; dx <= range; dx++) {
      for (let dz = -range; dz <= range; dz++) {
        if (dx === 0 && dz === 0) continue;
        const block = this.game.world.getBlock(x + dx, y, z + dz);
        if (block === BLOCK.WATER) return true;
      }
    }
    return false;
  }

  // 检查上方是否有足够光照
  hasLight(x, y, z) {
    // 简化：白天有光照
    if (!this.game.sky) return true;
    return this.game.sky.isDaytime();
  }

  // 每帧更新
  update(dt) {
    for (const [key, crop] of this.crops) {
      if (crop.stage >= (CROP_DEFS[crop.type]?.maxStage || 7)) continue;

      const [x, y, z] = key.split(',').map(Number);
      const def = CROP_DEFS[crop.type];
      if (!def) continue;

      // 检查条件
      const block = this.game.world.getBlock(x, y, z);
      if (block !== crop.type) {
        this.crops.delete(key);
        continue;
      }

      // 检查耕地是否还在
      const farmland = this.game.world.getBlock(x, y - 1, z);
      if (farmland !== BLOCK.FARMLAND) {
        this.crops.delete(key);
        continue;
      }

      // 检查水源
      if (def.needsWater && !this.checkFarmland(x, y - 1, z)) continue;

      // 检查光照
      if (def.needsLight && !this.hasLight(x, y, z)) continue;

      // 生长计时
      crop.growTimer -= dt;
      if (crop.growTimer <= 0) {
        crop.stage++;
        crop.growTimer = def.growTime;
        if (this.game.effects && crop.stage === def.maxStage) {
          this.game.effects.createBlockBreakParticles(x, y, z, 0x90ee90);
        }
      }
    }
  }

  // 获取作物状态
  getCropStage(x, y, z) {
    const crop = this.crops.get(`${x},${y},${z}`);
    return crop ? crop.stage : 0;
  }

  // 玩家与耕地交互（使用锄头创建耕地）
  interactFarmland(x, y, z, item) {
    const block = this.game.world.getBlock(x, y, z);
    if (block === BLOCK.GRASS || block === BLOCK.DIRT) {
      this.game.world.setBlock(x, y, z, BLOCK.FARMLAND);
      if (this.game.multiplayer) {
        this.game.multiplayer.sendBlockChange(x, y, z, BLOCK.FARMLAND);
      }
      if (this.game.ui) this.game.ui.showToast('耕地完成');
      return true;
    }
    return false;
  }

  // 玩家与作物交互
  interactCrop(x, y, z, item) {
    const key = `${x},${y},${z}`;
    const crop = this.crops.get(key);
    if (!crop) return false;

    const def = CROP_DEFS[crop.type];
    if (!def) return false;

    if (crop.stage >= def.maxStage) {
      // 成熟，收获
      this.harvestCrop(x, y, z);
      // 重新种植
      this.game.world.setBlock(x, y, z, crop.type);
      this.plantCrop(x, y, z, crop.type);
      return true;
    } else if (item && item.itemId === 'bone_meal') {
      // 骨粉催熟
      return this.applyBonemeal(x, y, z);
    }
    return false;
  }

  // 序列化
  serialize() {
    return {
      crops: Array.from(this.crops.entries()).map(([key, crop]) => ({ key, crop })),
    };
  }

  // 反序列化
  deserialize(data) {
    if (!data || !data.crops) return;
    for (const { key, crop } of data.crops) {
      this.crops.set(key, crop);
    }
  }
}
