/**
 * enchant.js — 附魔系统
 * 支持武器、工具、护甲附魔，附魔台交互，附魔等级与效果
 */

// 附魔类型
export const ENCHANTMENT = {
  // 武器
  SHARPNESS: { id: 'sharpness', name: '锋利', maxLevel: 5, appliesTo: ['sword', 'axe'], description: '增加近战伤害' },
  KNOCKBACK: { id: 'knockback', name: '击退', maxLevel: 2, appliesTo: ['sword'], description: '增加击退距离' },
  FIRE_ASPECT: { id: 'fire_aspect', name: '火焰附加', maxLevel: 2, appliesTo: ['sword'], description: '目标着火' },
  LOOTING: { id: 'looting', name: '抢夺', maxLevel: 3, appliesTo: ['sword'], description: '生物掉落更多' },
  SMITE: { id: 'smite', name: '亡灵杀手', maxLevel: 5, appliesTo: ['sword', 'axe'], description: '对亡灵生物额外伤害' },
  BANE_OF_ARTHROPODS: { id: 'bane_of_arthropods', name: '节肢杀手', maxLevel: 5, appliesTo: ['sword', 'axe'], description: '对节肢动物额外伤害' },
  SWEEPING_EDGE: { id: 'sweeping_edge', name: '横扫之刃', maxLevel: 3, appliesTo: ['sword'], description: '横扫攻击伤害' },

  // 弓箭
  POWER: { id: 'power', name: '力量', maxLevel: 5, appliesTo: ['bow'], description: '弓箭伤害增加' },
  PUNCH: { id: 'punch', name: '冲击', maxLevel: 2, appliesTo: ['bow'], description: '弓箭击退' },
  FLAME: { id: 'flame', name: '火矢', maxLevel: 1, appliesTo: ['bow'], description: '箭矢点燃目标' },
  INFINITY: { id: 'infinity', name: '无限', maxLevel: 1, appliesTo: ['bow'], description: '射箭不消耗箭矢' },
  UNBREAKING: { id: 'unbreaking', name: '耐久', maxLevel: 3, appliesTo: ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'bow', 'helmet', 'chestplate', 'leggings', 'boots'], description: '减少耐久消耗' },

  // 工具
  EFFICIENCY: { id: 'efficiency', name: '效率', maxLevel: 5, appliesTo: ['pickaxe', 'axe', 'shovel', 'hoe'], description: '加快挖掘速度' },
  SILK_TOUCH: { id: 'silk_touch', name: '精准采集', maxLevel: 1, appliesTo: ['pickaxe', 'axe', 'shovel', 'hoe'], description: '方块直接掉落本体' },
  FORTUNE: { id: 'fortune', name: '时运', maxLevel: 3, appliesTo: ['pickaxe', 'axe', 'shovel'], description: '增加矿物掉落' },
  MENDING: { id: 'mending', name: '经验修补', maxLevel: 1, appliesTo: ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'bow', 'helmet', 'chestplate', 'leggings', 'boots'], description: '用经验修复耐久' },

  // 护甲
  PROTECTION: { id: 'protection', name: '保护', maxLevel: 4, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '减少所有伤害' },
  FIRE_PROTECTION: { id: 'fire_protection', name: '火焰保护', maxLevel: 4, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '减少火焰伤害' },
  FEATHER_FALLING: { id: 'feather_falling', name: '摔落保护', maxLevel: 4, appliesTo: ['boots'], description: '减少摔落伤害' },
  BLAST_PROTECTION: { id: 'blast_protection', name: '爆炸保护', maxLevel: 4, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '减少爆炸伤害' },
  PROJECTILE_PROTECTION: { id: 'projectile_protection', name: '弹射物保护', maxLevel: 4, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '减少弹射物伤害' },
  RESPIRATION: { id: 'respiration', name: '水下呼吸', maxLevel: 3, appliesTo: ['helmet'], description: '延长水下呼吸时间' },
  AQUA_AFFINITY: { id: 'aqua_affinity', name: '水下速掘', maxLevel: 1, appliesTo: ['helmet'], description: '水下挖掘速度加快' },
  THORNS: { id: 'thorns', name: '荆棘', maxLevel: 3, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '反弹伤害给攻击者' },
  DEPTH_STRIDER: { id: 'depth_strider', name: '深海探索者', maxLevel: 3, appliesTo: ['boots'], description: '水下移动速度加快' },
  FROST_WALKER: { id: 'frost_walker', name: '冰霜行者', maxLevel: 2, appliesTo: ['boots'], description: '行走时在水面生成冰' },
  SOUL_SPEED: { id: 'soul_speed', name: '灵魂疾行', maxLevel: 3, appliesTo: ['boots'], description: '在灵魂沙上加速' },

  // 三叉戟
  IMPALING: { id: 'impaling', name: '穿刺', maxLevel: 5, appliesTo: ['trident'], description: '对水生生物额外伤害' },
  RIPTIDE: { id: 'riptide', name: '激流', maxLevel: 3, appliesTo: ['trident'], description: '在雨中投掷时冲向目标' },
  LOYALTY: { id: 'loyalty', name: '忠诚', maxLevel: 3, appliesTo: ['trident'], description: '三叉戟飞回手中' },
  CHANNELING: { id: 'channeling', name: '引雷', maxLevel: 1, appliesTo: ['trident'], description: '雷暴时召唤闪电' },

  // 通用
  CURSE_OF_VANISHING: { id: 'curse_of_vanishing', name: '消失诅咒', maxLevel: 1, appliesTo: ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'bow', 'helmet', 'chestplate', 'leggings', 'boots'], description: '死亡时物品消失' },
  CURSE_OF_BINDING: { id: 'curse_of_binding', name: '绑定诅咒', maxLevel: 1, appliesTo: ['helmet', 'chestplate', 'leggings', 'boots'], description: '无法脱下' },
};

// 附魔等级名称（罗马数字）
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function getEnchantName(enchantId, level) {
  const ench = Object.values(ENCHANTMENT).find(e => e.id === enchantId);
  if (!ench) return '未知附魔';
  return `${ench.name} ${ROMAN[level] || level}`;
}

// 获取可用附魔列表
export function getAvailableEnchantments(itemType) {
  return Object.values(ENCHANTMENT).filter(e => e.appliesTo.includes(itemType));
}

// 检查两个附魔是否冲突
export function areCompatible(enchant1, enchant2) {
  const incompatible = {
    'sharpness': ['smite', 'bane_of_arthropods'],
    'smite': ['sharpness', 'bane_of_arthropods'],
    'bane_of_arthropods': ['sharpness', 'smite'],
    'silk_touch': ['fortune'],
    'fortune': ['silk_touch'],
    'infinity': ['mending'],
    'mending': ['infinity'],
    'riptide': ['loyalty', 'channeling'],
    'loyalty': ['riptide'],
    'channeling': ['riptide'],
    'frost_walker': ['depth_strider'],
    'depth_strider': ['frost_walker'],
    'protection': ['fire_protection', 'blast_protection', 'projectile_protection'],
    'fire_protection': ['protection', 'blast_protection', 'projectile_protection'],
    'blast_protection': ['protection', 'fire_protection', 'projectile_protection'],
    'projectile_protection': ['protection', 'fire_protection', 'blast_protection'],
  };
  const conflicts = incompatible[enchant1] || [];
  return !conflicts.includes(enchant2);
}

export class EnchantmentSystem {
  constructor(game) {
    this.game = game;
    this.enchantTableLevel = 0; // 书架数量决定附魔等级
  }

  // 对物品附魔
  enchantItem(item, enchantId, level) {
    if (!item) return false;
    if (!item.enchantments) item.enchantments = {};

    const ench = Object.values(ENCHANTMENT).find(e => e.id === enchantId);
    if (!ench) return false;
    if (level < 1 || level > ench.maxLevel) return false;

    // 检查冲突
    for (const existingId of Object.keys(item.enchantments)) {
      if (!areCompatible(enchantId, existingId)) {
        return false;
      }
    }

    item.enchantments[enchantId] = level;
    return true;
  }

  // 移除附魔
  removeEnchantment(item, enchantId) {
    if (!item || !item.enchantments) return false;
    delete item.enchantments[enchantId];
    return true;
  }

  // 获取物品的附魔等级
  getEnchantmentLevel(item, enchantId) {
    if (!item || !item.enchantments) return 0;
    return item.enchantments[enchantId] || 0;
  }

  // 计算附魔加成伤害
  getEnchantmentDamage(item, target_type = 'normal') {
    if (!item || !item.enchantments) return 0;
    let bonus = 0;
    const sharp = this.getEnchantmentLevel(item, 'sharpness');
    if (sharp > 0) bonus += sharp * 1.25;
    const smite = this.getEnchantmentLevel(item, 'smite');
    if (smite > 0 && target_type === 'undead') bonus += smite * 2.5;
    const bane = this.getEnchantmentLevel(item, 'bane_of_arthropods');
    if (bane > 0 && target_type === 'arthropod') bonus += bane * 2.5;
    const impaling = this.getEnchantmentLevel(item, 'impaling');
    if (impaling > 0 && target_type === 'aquatic') bonus += impaling * 2.5;
    return bonus;
  }

  // 计算护甲附魔减伤
  getArmorEnchantmentReduction(armorItems, damageType = 'normal') {
    let reduction = 0;
    for (const item of armorItems) {
      if (!item || !item.enchantments) continue;
      const prot = item.enchantments.protection || 0;
      reduction += prot * 0.04; // 每级减少4%
      if (damageType === 'fire') {
        reduction += (item.enchantments.fire_protection || 0) * 0.08;
      }
      if (damageType === 'explosion') {
        reduction += (item.enchantments.blast_protection || 0) * 0.08;
      }
      if (damageType === 'projectile') {
        reduction += (item.enchantments.projectile_protection || 0) * 0.08;
      }
    }
    return Math.min(0.8, reduction); // 最多减少80%
  }

  // 计算摔落伤害减免
  getFallDamageReduction(armorItems) {
    let reduction = 0;
    for (const item of armorItems) {
      if (!item || !item.enchantments) continue;
      if (item.armorType === 'boots') {
        reduction += (item.enchantments.feather_falling || 0) * 0.12;
      }
    }
    return Math.min(0.9, reduction);
  }

  // 挖掘速度加成
  getMiningSpeedMultiplier(item) {
    if (!item || !item.enchantments) return 1;
    const eff = item.enchantments.efficiency || 0;
    return 1 + eff * 0.3;
  }

  // 附魔台交互：根据玩家等级和书架数量随机附魔
  rollEnchantments(playerLevel, bookshelfCount) {
    const maxLevel = Math.min(30, playerLevel + bookshelfCount);
    const slots = [];
    const numSlots = 3;

    for (let i = 0; i < numSlots; i++) {
      const power = Math.floor(maxLevel * (i + 1) / 3);
      const enchantCount = power > 15 ? 3 : power > 8 ? 2 : 1;
      const enchants = {};
      const available = Object.values(ENCHANTMENT).slice();
      for (let j = 0; j < enchantCount; j++) {
        const idx = Math.floor(Math.random() * available.length);
        const ench = available[idx];
        const level = Math.max(1, Math.min(ench.maxLevel, Math.ceil(power / 10)));
        enchants[ench.id] = level;
        available.splice(idx, 1);
      }
      slots.push({ cost: power, enchantments: enchants });
    }
    return slots;
  }

  // 应用荆棘效果
  applyThorns(armorItems, attacker) {
    let thornsLevel = 0;
    for (const item of armorItems) {
      if (item && item.enchantments && item.enchantments.thorns) {
        thornsLevel = Math.max(thornsLevel, item.enchantments.thorns);
      }
    }
    if (thornsLevel > 0 && attacker) {
      const chance = thornsLevel * 0.15;
      if (Math.random() < chance) {
        const damage = Math.floor(Math.random() * 4) + 1 + thornsLevel;
        if (attacker.takeDamage) {
          attacker.takeDamage(damage);
        }
        return damage;
      }
    }
    return 0;
  }

  // 耐久附魔检查
  shouldConsumeDurability(item) {
    if (!item || !item.enchantments) return true;
    const unbreaking = item.enchantments.unbreaking || 0;
    const chance = unbreaking * 0.2; // 每级20%几率不消耗
    return Math.random() > chance;
  }

  // 经验修补
  tryMend(armorItems, tools, xpAmount) {
    const mendable = [];
    for (const item of [...armorItems, ...tools]) {
      if (item && item.enchantments && item.enchantments.mending && item.durability !== undefined && item.durability < item.maxDurability) {
        mendable.push(item);
      }
    }
    if (mendable.length === 0) return xpAmount;
    const item = mendable[Math.floor(Math.random() * mendable.length)];
    const repaired = Math.min(xpAmount * 2, item.maxDurability - item.durability);
    item.durability += repaired;
    return Math.max(0, xpAmount - Math.ceil(repaired / 2));
  }
}
