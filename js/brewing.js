/**
 * brewing.js — 酿造系统
 * 支持药水配方、酿造台交互、药水效果
 */

import * as THREE from 'three';

// 药水效果类型
export const POTION_EFFECT = {
  SPEED: { id: 'speed', name: '速度', duration: 180, color: 0x8899ff, description: '移动速度提升' },
  SLOWNESS: { id: 'slowness', name: '缓慢', duration: 90, color: 0x5577aa, description: '移动速度降低' },
  HASTE: { id: 'haste', name: '急迫', duration: 180, color: 0xddddaa, description: '挖掘速度提升' },
  MINING_FATIGUE: { id: 'mining_fatigue', name: '挖掘疲劳', duration: 90, color: 0xaaaadd, description: '挖掘速度降低' },
  STRENGTH: { id: 'strength', name: '力量', duration: 180, color: 0xff8855, description: '近战伤害提升' },
  INSTANT_HEALTH: { id: 'instant_health', name: '瞬间治疗', duration: 0, color: 0xff5555, description: '立即恢复生命' },
  INSTANT_DAMAGE: { id: 'instant_damage', name: '瞬间伤害', duration: 0, color: 0x880000, description: '立即受到伤害' },
  JUMP_BOOST: { id: 'jump_boost', name: '跳跃提升', duration: 180, color: 0xaaff55, description: '跳跃高度提升' },
  NAUSEA: { id: 'nausea', name: '反胃', duration: 30, color: 0x88aa44, description: '视野扭曲' },
  REGENERATION: { id: 'regeneration', name: '生命恢复', duration: 45, color: 0xff6666, description: '持续恢复生命' },
  RESISTANCE: { id: 'resistance', name: '抗性提升', duration: 180, color: 0x9966aa, description: '减少受到的伤害' },
  FIRE_RESISTANCE: { id: 'fire_resistance', name: '抗火', duration: 180, color: 0xee8833, description: '免疫火焰伤害' },
  WATER_BREATHING: { id: 'water_breathing', name: '水下呼吸', duration: 180, color: 0x33aacc, description: '可在水中呼吸' },
  INVISIBILITY: { id: 'invisibility', name: '隐身', duration: 180, color: 0xaaaaff, description: '变为隐形' },
  BLINDNESS: { id: 'blindness', name: '失明', duration: 30, color: 0x1a1a1a, description: '视野变黑' },
  NIGHT_VISION: { id: 'night_vision', name: '夜视', duration: 180, color: 0x88aaff, description: '黑暗中也能看清' },
  HUNGER: { id: 'hunger', name: '饥饿', duration: 30, color: 0x668833, description: '快速消耗饥饿值' },
  WEAKNESS: { id: 'weakness', name: '虚弱', duration: 90, color: 0x6677aa, description: '近战伤害降低' },
  POISON: { id: 'poison', name: '中毒', duration: 45, color: 0x44aa33, description: '持续受到伤害' },
  WITHER: { id: 'wither', name: '凋零', duration: 40, color: 0x333333, description: '持续受到伤害(可致死)' },
  HEALTH_BOOST: { id: 'health_boost', name: '生命提升', duration: 180, color: 0xff4455, description: '最大生命值增加' },
  ABSORPTION: { id: 'absorption', name: '伤害吸收', duration: 90, color: 0xffeeaa, description: '获得吸收生命' },
  SATURATION: { id: 'saturation', name: '饱和', duration: 0, color: 0xff8833, description: '恢复饥饿值' },
  GLOWING: { id: 'glowing', name: '发光', duration: 60, color: 0xffeeaa, description: '身体发光' },
  LEVITATION: { id: 'levitation', name: '飘浮', duration: 10, color: 0xccccff, description: '向上飘浮' },
  LUCK: { id: 'luck', name: '幸运', duration: 300, color: 0x33aa55, description: '提升运气' },
  UNLUCK: { id: 'unluck', name: '霉运', duration: 300, color: 0xaa3355, description: '降低运气' },
};

// 药水类型
export const POTION_TYPE = {
  WATER: 'water',
  AWKWARD: 'awkward',
  THICK: 'thick',
  MUNDANE: 'mundane',
  SPLASH: 'splash',
  LINGERING: 'lingering',
};

// 酿造配方：材料 -> 药水效果
export const BREWING_RECIPES = {
  // 一级药水（从粗制药水）
  'awkward+nether_wart': { result: 'awkward', effect: null },
  'awkward+redstone': { result: 'mundane', effect: null },
  'awkward+glowstone': { result: 'thick', effect: null },

  // 基础药水
  'awkward+sugar': { effect: POTION_EFFECT.SPEED },
  'awkward+rabbit_foot': { effect: POTION_EFFECT.JUMP_BOOST },
  'awkward+glowstone_dust': { effect: POTION_EFFECT.SPEED, extended: false, level: 2 },
  'awkward+blaze_powder': { effect: POTION_EFFECT.STRENGTH },
  'awkward+magma_cream': { effect: POTION_EFFECT.FIRE_RESISTANCE },
  'awkward+ghast_tear': { effect: POTION_EFFECT.REGENERATION },
  'awkward+spider_eye': { effect: POTION_EFFECT.POISON },
  'awkward+golden_carrot': { effect: POTION_EFFECT.NIGHT_VISION },
  'awkward+pufferfish': { effect: POTION_EFFECT.WATER_BREATHING },
  'awkward+phantom_membrane': { effect: POTION_EFFECT.SLOW_FALLING },
  'awkward+turtle_shell': { effect: POTION_EFFECT.RESISTANCE },

  // 延长版（红石）
  'speed+redstone': { effect: POTION_EFFECT.SPEED, extended: true },
  'strength+redstone': { effect: POTION_EFFECT.STRENGTH, extended: true },
  'regeneration+redstone': { effect: POTION_EFFECT.REGENERATION, extended: true },
  'poison+redstone': { effect: POTION_EFFECT.POISON, extended: true },
  'night_vision+redstone': { effect: POTION_EFFECT.NIGHT_VISION, extended: true },
  'fire_resistance+redstone': { effect: POTION_EFFECT.FIRE_RESISTANCE, extended: true },
  'water_breathing+redstone': { effect: POTION_EFFECT.WATER_BREATHING, extended: true },

  // 强化版（荧石粉）
  'speed+glowstone': { effect: POTION_EFFECT.SPEED, level: 2 },
  'strength+glowstone': { effect: POTION_EFFECT.STRENGTH, level: 2 },
  'regeneration+glowstone': { effect: POTION_EFFECT.REGENERATION, level: 2 },
  'poison+glowstone': { effect: POTION_EFFECT.POISON, level: 2 },

  // 腐化效果（发酵蛛眼）
  'speed+fermented_spider_eye': { effect: POTION_EFFECT.SLOWNESS },
  'strength+fermented_spider_eye': { effect: POTION_EFFECT.WEAKNESS },
  'night_vision+fermented_spider_eye': { effect: POTION_EFFECT.INVISIBILITY },
  'poison+fermented_spider_eye': { effect: POTION_EFFECT.INSTANT_DAMAGE },

  // 喷溅药水（火药）
  'any+gunpowder': { splash: true },

  // 滞留药水（龙息）
  'splash+dragon_breath': { lingering: true },
};

export class BrewingSystem {
  constructor(game) {
    this.game = game;
    this.activeBrews = []; // 正在酿造的药水
    this.brewTime = 20; // 酿造所需时间（秒）
  }

  // 开始酿造
  startBrewing(ingredient, basePotion) {
    const key = `${basePotion.type}+${ingredient}`;
    const recipe = BREWING_RECIPES[key] || BREWING_RECIPES[`any+${ingredient}`];
    if (!recipe) return false;

    const brew = {
      ingredient,
      basePotion,
      recipe,
      timer: this.brewTime,
      done: false,
    };
    this.activeBrews.push(brew);
    return true;
  }

  update(dt) {
    for (let i = this.activeBrews.length - 1; i >= 0; i--) {
      const brew = this.activeBrews[i];
      brew.timer -= dt;
      if (brew.timer <= 0) {
        brew.done = true;
        const result = this.completeBrew(brew);
        this.activeBrews.splice(i, 1);
        if (this.game.ui) {
          this.game.ui.showToast(`酿造完成: ${result.name}`);
        }
      }
    }
  }

  completeBrew(brew) {
    const recipe = brew.recipe;
    let result = { ...brew.basePotion };

    if (recipe.effect) {
      result.effect = recipe.effect.id;
      result.color = recipe.effect.color;
      result.duration = recipe.effect.duration * (recipe.extended ? 2 : 1);
      result.level = recipe.level || 1;
      result.name = recipe.effect.name + (recipe.level > 1 ? ' II' : '');
    }
    if (recipe.splash) {
      result.type = POTION_TYPE.SPLASH;
      result.name = '喷溅' + (result.name || '药水');
    }
    if (recipe.lingering) {
      result.type = POTION_TYPE.LINGERING;
      result.name = '滞留' + (result.name || '药水');
    }

    return result;
  }

  // 使用药水
  drinkPotion(player, potion) {
    if (!potion || !potion.effect) {
      if (this.game.ui) this.game.ui.showToast('这瓶药水没有效果');
      return false;
    }

    const effect = POTION_EFFECT[potion.effect.toUpperCase()] || Object.values(POTION_EFFECT).find(e => e.id === potion.effect);
    if (!effect) return false;

    const duration = potion.duration || effect.duration;
    const level = potion.level || 1;

    // 添加效果到玩家
    player.activeEffects = player.activeEffects || [];
    player.activeEffects.push({
      id: effect.id,
      name: effect.name,
      duration: duration,
      level: level,
      color: effect.color,
    });

    if (effect.id === 'instant_health') {
      player.heal(level * 4);
    } else if (effect.id === 'instant_damage') {
      player.takeDamage(level * 6);
    } else if (effect.id === 'saturation') {
      player.eat(level * 4);
    }

    if (this.game.ui) {
      this.game.ui.showToast(`饮用了: ${potion.name || effect.name}`);
    }

    return true;
  }

  // 投掷喷溅药水
  throwSplashPotion(game, x, y, z, direction, potion) {
    // 创建药水实体
    const potionEntity = {
      position: { x, y, z },
      velocity: {
        x: direction.x * 15,
        y: direction.y * 15 + 3,
        z: direction.z * 15,
      },
      potion: potion,
      lifetime: 0,
      dead: false,
      mesh: null,
    };

    // 创建简单的球体网格
    if (game.scene) {
      const geom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshLambertMaterial({ color: potion.color || 0x8888ff });
      potionEntity.mesh = new THREE.Mesh(geom, mat);
      potionEntity.mesh.position.set(x, y, z);
      game.scene.add(potionEntity.mesh);
    }

    game.brewing = game.brewing || { flyingPotions: [] };
    game.brewing.flyingPotions.push(potionEntity);
    return potionEntity;
  }

  // 更新飞行中的喷溅药水
  updateFlyingPotions(dt, game) {
    if (!game.brewing || !game.brewing.flyingPotions) return;
    const potions = game.brewing.flyingPotions;

    for (let i = potions.length - 1; i >= 0; i--) {
      const p = potions[i];
      p.lifetime += dt;

      // 重力
      p.velocity.y -= 20 * dt;

      // 移动
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      if (p.mesh) {
        p.mesh.position.set(p.position.x, p.position.y, p.position.z);
        p.mesh.rotation.x += dt * 5;
        p.mesh.rotation.y += dt * 3;
      }

      // 碰撞检测或超时
      const block = game.world.getBlock(
        Math.floor(p.position.x),
        Math.floor(p.position.y),
        Math.floor(p.position.z)
      );

      if (block !== 0 || p.lifetime > 5) {
        // 爆裂！对附近实体施加效果
        this.applySplashEffect(game, p.position, p.potion, 4);
        if (p.mesh) game.scene.remove(p.mesh);
        potions.splice(i, 1);
      }
    }
  }

  // 喷溅药水效果范围
  applySplashEffect(game, pos, potion, radius) {
    // 对玩家
    const player = game.player;
    const dist = Math.sqrt(
      (player.position.x - pos.x) ** 2 +
      (player.position.y - pos.y) ** 2 +
      (player.position.z - pos.z) ** 2
    );
    if (dist < radius) {
      this.drinkPotion(player, potion);
    }

    // 对生物
    if (game.mobs) {
      for (const mob of game.mobs.mobs) {
        const mdist = Math.sqrt(
          (mob.position.x - pos.x) ** 2 +
          (mob.position.y - pos.y) ** 2 +
          (mob.position.z - pos.z) ** 2
        );
        if (mdist < radius) {
          if (potion.effect === 'instant_damage') {
            mob.takeDamage((potion.level || 1) * 6);
          } else if (potion.effect === 'instant_health' && mob.type !== 'zombie' && mob.type !== 'skeleton') {
            mob.takeDamage(-(potion.level || 1) * 4);
          } else if (potion.effect === 'poison') {
            mob.activeEffects = mob.activeEffects || [];
            mob.activeEffects.push({ id: 'poison', duration: 30, level: 1 });
          }
        }
      }
    }

    // 粒子效果
    if (game.effects) {
      game.effects.createBlockBreakParticles(
        Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z),
        potion.color || 0x8888ff
      );
    }
  }
}

// 更新玩家药水效果
export function updatePlayerEffects(player, dt) {
  if (!player.activeEffects) return;
  for (let i = player.activeEffects.length - 1; i >= 0; i--) {
    const effect = player.activeEffects[i];
    if (effect.duration <= 0) {
      player.activeEffects.splice(i, 1);
      continue;
    }

    // 持续效果
    if (effect.id === 'regeneration') {
      effect._timer = (effect._timer || 0) + dt;
      if (effect._timer >= 2.5 - effect.level * 0.5) {
        player.heal(1);
        effect._timer = 0;
      }
    } else if (effect.id === 'poison') {
      effect._timer = (effect._timer || 0) + dt;
      if (effect._timer >= 1.25) {
        if (player.health > 1) player.takeDamage(1);
        effect._timer = 0;
      }
    } else if (effect.id === 'wither') {
      effect._timer = (effect._timer || 0) + dt;
      if (effect._timer >= 2) {
        player.takeDamage(1);
        effect._timer = 0;
      }
    } else if (effect.id === 'hunger') {
      player.exhaustion += dt * 0.5;
    }

    effect.duration -= dt;
  }
}

// 获取效果对移动速度的修正
export function getSpeedMultiplier(player) {
  if (!player.activeEffects) return 1;
  let mult = 1;
  for (const effect of player.activeEffects) {
    if (effect.id === 'speed') mult *= 1 + 0.2 * effect.level;
    if (effect.id === 'slowness') mult *= 1 - 0.15 * effect.level;
  }
  return Math.max(0.1, mult);
}

// 获取效果对伤害的修正
export function getDamageMultiplier(player) {
  if (!player.activeEffects) return 1;
  let mult = 1;
  for (const effect of player.activeEffects) {
    if (effect.id === 'strength') mult *= 1 + 0.3 * effect.level;
    if (effect.id === 'weakness') mult *= 1 - 0.2 * effect.level;
  }
  return mult;
}
