/**
 * fishing.js — 钓鱼系统
 * 支持钓鱼竿使用、鱼上钩机制、钓鱼奖励（鱼、宝藏、垃圾）
 */

import * as THREE from 'three';
import { BLOCK } from './blocks.js';

// 钓鱼奖励类型
export const FISH_LOOT = {
  FISH: [
    { id: 'cod', name: '鳕鱼', weight: 60, food: 2 },
    { id: 'salmon', name: '鲑鱼', weight: 25, food: 3 },
    { id: 'pufferfish', name: '河豚', weight: 13, food: 1, effect: 'poison' },
    { id: 'tropical_fish', name: '热带鱼', weight: 2, food: 1 },
  ],
  TREASURE: [
    { id: 'bow', name: '弓', weight: 16, enchanted: true },
    { id: 'fishing_rod', name: '钓鱼竿', weight: 16, enchanted: true },
    { id: 'book', name: '附魔书', weight: 16, enchanted: true },
    { id: 'name_tag', name: '命名牌', weight: 16 },
    { id: 'saddle', name: '鞍', weight: 16 },
    { id: 'nautilus_shell', name: '鹦鹉螺壳', weight: 16 },
    { id: 'lily_pad', name: '睡莲', weight: 4 },
  ],
  JUNK: [
    { id: 'stick', name: '木棍', weight: 10 },
    { id: 'string', name: '线', weight: 5 },
    { id: 'leather', name: '皮革', weight: 10 },
    { id: 'bowl', name: '碗', weight: 10 },
    { id: 'bone', name: '骨头', weight: 10 },
    { id: 'ink_sac', name: '墨囊', weight: 10 },
    { id: 'rotten_flesh', name: '腐肉', weight: 10 },
    { id: 'tripwire_hook', name: '绊线钩', weight: 10 },
    { id: 'bamboo', name: '竹子', weight: 5 },
  ],
};

// 钓鱼状态
export const FISHING_STATE = {
  IDLE: 'idle',
  CASTING: 'casting',
  WAITING: 'waiting',
  BITING: 'biting',
  REELING: 'reeling',
};

export class FishingSystem {
  constructor(game) {
    this.game = game;
    this.state = FISHING_STATE.IDLE;
    this.bobber = null;
    this.bobberPos = null;
    this.castTimer = 0;
    this.waitTimer = 0;
    this.biteTimer = 0;
    this.hookedFish = null;
    this.luckLevel = 0; // 海之眷顾附魔等级
    this.lureLevel = 0; // 饵钓附魔等级
  }

  // 抛竿
  cast() {
    if (this.state !== FISHING_STATE.IDLE) return false;

    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    // 寻找水面
    let waterPos = null;
    for (let i = 1; i < 20; i++) {
      const x = Math.floor(eye.x + dir.x * i);
      const y = Math.floor(eye.y + dir.y * i);
      const z = Math.floor(eye.z + dir.z * i);
      const block = this.game.world.getBlock(x, y, z);
      if (block === BLOCK.WATER) {
        waterPos = { x: x + 0.5, y: y + 0.9, z: z + 0.5 };
        break;
      }
      if (block !== 0 && block !== BLOCK.WATER) break; // 碰到固体方块
    }

    if (!waterPos) {
      if (this.game.ui) this.game.ui.showToast('没有找到水！');
      return false;
    }

    this.bobberPos = waterPos;
    this.state = FISHING_STATE.CASTING;
    this.castTimer = 0.5;

    // 创建浮标网格
    const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    this.bobber = new THREE.Mesh(geom, mat);
    this.bobber.position.set(waterPos.x, waterPos.y, waterPos.z);
    this.game.scene.add(this.bobber);

    return true;
  }

  // 钓鱼奖励 ID 到方块/物品 ID 的映射
  static LOOT_BLOCK_MAP = {
    // 鱼
    cod: BLOCK.APPLE, salmon: BLOCK.BREAD, tropical_fish: BLOCK.APPLE, pufferfish: BLOCK.MUSHROOM,
    // 宝藏
    bow: BLOCK.BOW, fishing_rod: BLOCK.FISHING_ROD, book: BLOCK.BOOK,
    name_tag: BLOCK.PAPER, saddle: BLOCK.LEATHER, nautilus_shell: BLOCK.FLINT,
    lily_pad: BLOCK.FLOWER_YELLOW,
    // 垃圾
    stick: BLOCK.STICK, string: BLOCK.STRING_ITEM, leather: BLOCK.LEATHER,
    bowl: BLOCK.BRICK, bone: BLOCK.BONE, ink_sac: BLOCK.COAL_ITEM,
    rotten_flesh: BLOCK.MUSHROOM, tripwire_hook: BLOCK.IRON_INGOT, bamboo: BLOCK.LOG,
  };

  // 收竿
  reel() {
    if (this.state === FISHING_STATE.IDLE) return;

    if (this.state === FISHING_STATE.BITING) {
      // 成功钓到东西！
      const loot = this.generateLoot();
      const blockId = FishingSystem.LOOT_BLOCK_MAP[loot.id] || BLOCK.APPLE;
      this.game.player.addItem(blockId, 1, true);
      if (this.game.ui) {
        this.game.ui.showToast(`钓到了: ${loot.name}！`);
      }
      if (this.game.achievements) {
        this.game.achievements.unlock('first_fish');
      }
    } else if (this.state === FISHING_STATE.WAITING) {
      if (this.game.ui) this.game.ui.showToast('收线太早了！');
    }

    this.removeBobber();
    this.state = FISHING_STATE.IDLE;
  }

  // 移除浮标
  removeBobber() {
    if (this.bobber) {
      this.game.scene.remove(this.bobber);
      this.bobber = null;
    }
    this.bobberPos = null;
    this.state = FISHING_STATE.IDLE;
    this.waitTimer = 0;
    this.biteTimer = 0;
  }

  // 生成钓鱼奖励
  generateLoot() {
    // 饵钓附魔减少垃圾概率，增加鱼概率
    // 海之眷顾增加宝藏概率
    const lureBonus = this.lureLevel * 0.05;
    const luckBonus = this.luckLevel * 0.04;

    const fishChance = 0.85 + lureBonus - luckBonus;
    const treasureChance = 0.05 + luckBonus;
    const junkChance = 1 - fishChance - treasureChance;

    const roll = Math.random();
    let category;
    if (roll < fishChance) category = FISH_LOOT.FISH;
    else if (roll < fishChance + treasureChance) category = FISH_LOOT.TREASURE;
    else category = FISH_LOOT.JUNK;

    // 加权随机选择
    const totalWeight = category.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of category) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return category[0];
  }

  // 每帧更新
  update(dt) {
    if (this.state === FISHING_STATE.IDLE) return;

    if (this.state === FISHING_STATE.CASTING) {
      this.castTimer -= dt;
      if (this.castTimer <= 0) {
        this.state = FISHING_STATE.WAITING;
        // 等待时间受饵钓影响：5-30秒 -> 减少5秒/级
        const minWait = Math.max(2, 5 - this.lureLevel);
        const maxWait = Math.max(5, 30 - this.lureLevel * 5);
        this.waitTimer = minWait + Math.random() * (maxWait - minWait);
      }
    }

    if (this.state === FISHING_STATE.WAITING) {
      this.waitTimer -= dt;
      // 浮标轻微浮动
      if (this.bobber) {
        this.bobber.position.y = this.bobberPos.y + Math.sin(Date.now() * 0.003) * 0.03;
      }
      if (this.waitTimer <= 0) {
        this.state = FISHING_STATE.BITING;
        this.biteTimer = 0.5; // 0.5秒内收竿
        if (this.game.ui) this.game.ui.showToast('咬钩了！快收线！');
      }
    }

    if (this.state === FISHING_STATE.BITING) {
      this.biteTimer -= dt;
      // 浮标下沉
      if (this.bobber) {
        this.bobber.position.y = this.bobberPos.y - 0.15;
      }
      if (this.biteTimer <= 0) {
        // 鱼跑了
        if (this.game.ui) this.game.ui.showToast('鱼跑了...');
        this.removeBobber();
      }
    }
  }

  // 检查玩家是否手持钓鱼竿
  isHoldingRod() {
    const item = this.game.player.getSelectedItem();
    return item && item.itemId === 'fishing_rod';
  }
}
