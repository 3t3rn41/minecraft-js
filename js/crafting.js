/**
 * crafting.js — 完整合成配方系统
 * 包含：工具、武器、护甲、建筑方块、装饰方块等配方
 */

import { BLOCK } from './blocks.js';

// 工具/武器/护甲物品类型
export const ITEM_TYPE = {
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SWORD: 'sword',
  HOE: 'hoe',
  BOW: 'bow',
  CROSSBOW: 'crossbow',
  TRIDENT: 'trident',
  ARROW: 'arrow',
  SPECTRAL_ARROW: 'spectral_arrow',
  SNOWBALL: 'snowball',
  EGG: 'egg',
  ENDER_PEARL: 'ender_pearl',
  FIREWORK_ROCKET: 'firework_rocket',
  FISHING_ROD: 'fishing_rod',
  HELMET: 'helmet',
  CHESTPLATE: 'chestplate',
  LEGGINGS: 'leggings',
  BOOTS: 'boots',
  SHIELD: 'shield',
  FLINT_AND_STEEL: 'flint_and_steel',
  SHEARS: 'shears',
  COMPASS: 'compass',
  CLOCK: 'clock',
  BUCKET: 'bucket',
  MAP: 'map',
  BOOK: 'book',
  PAPER: 'paper',
  STICK: 'stick',
  STRING: 'string',
  BONE_MEAL: 'bone_meal',
  SUGAR: 'sugar',
  LEATHER: 'leather',
  IRON_INGOT: 'iron_ingot',
  GOLD_INGOT: 'gold_ingot',
  DIAMOND: 'diamond',
  EMERALD: 'emerald',
  COAL: 'coal',
  STICK: 'stick',
  WHEAT: 'wheat',
  BREAD: 'bread',
  APPLE: 'apple',
  COOKED_BEEF: 'cooked_beef',
  RAW_BEEF: 'raw_beef',
  POTION: 'potion',
  BOTTLE: 'bottle',
};

// 材质等级
export const TOOL_MATERIAL = {
  WOOD: { name: '木质', durability: 60, speed: 2, damage: 1, harvestLevel: 1 },
  STONE: { name: '石质', durability: 130, speed: 4, damage: 2, harvestLevel: 2 },
  IRON: { name: '铁质', durability: 250, speed: 6, damage: 3, harvestLevel: 3 },
  GOLD: { name: '金质', durability: 32, speed: 12, damage: 2, harvestLevel: 1 },
  DIAMOND: { name: '钻石', durability: 1561, speed: 8, damage: 4, harvestLevel: 4 },
  NETHERITE: { name: '下界合金', durability: 2031, speed: 9, damage: 5, harvestLevel: 5 },
};

// 护甲材质
export const ARMOR_MATERIAL = {
  LEATHER: { name: '皮革', helmet: 1, chestplate: 3, leggings: 2, boots: 1, durability: 55 },
  IRON: { name: '铁', helmet: 2, chestplate: 5, leggings: 4, boots: 1, durability: 130 },
  GOLD: { name: '金', helmet: 1, chestplate: 3, leggings: 2, boots: 1, durability: 77 },
  DIAMOND: { name: '钻石', helmet: 3, chestplate: 6, leggings: 5, boots: 2, durability: 363 },
  NETHERITE: { name: '下界合金', helmet: 3, chestplate: 7, leggings: 5, boots: 3, durability: 407 },
};

// 合成配方定义
// pattern: 3x3 网格，数字代表物品ID
// 0 = 空, 其他 = 物品类型或方块ID
// result: { id, count }
export const RECIPES = [
  // ===== 基础合成 =====
  {
    id: 'planks',
    pattern: [[0, 0, 0], [0, 5, 0], [0, 0, 0]], // 原木
    result: { blockId: BLOCK.PLANKS, count: 4 },
    name: '木板 x4',
  },
  {
    id: 'stick',
    pattern: [[0, 0, 0], [0, 7, 0], [0, 7, 0]], // 木板
    result: { itemId: ITEM_TYPE.STICK, count: 4 },
    name: '木棍 x4',
  },
  {
    id: 'crafting_table',
    pattern: [[7, 7, 0], [7, 7, 0], [0, 0, 0]],
    result: { blockId: BLOCK.CRAFTING_TABLE, count: 1 },
    name: '工作台',
  },
  {
    id: 'chest',
    pattern: [[7, 7, 7], [7, 0, 7], [7, 7, 7]],
    result: { blockId: BLOCK.CHEST, count: 1 },
    name: '宝箱',
  },
  {
    id: 'bookshelf',
    pattern: [[7, 7, 7], [21, 21, 21], [7, 7, 7]], // 木板 + 书 (简化用木板代替书)
    result: { blockId: BLOCK.BOOKSHELF, count: 1 },
    name: '书架',
  },

  // ===== 建筑方块 =====
  {
    id: 'brick',
    pattern: [[4, 4, 0], [4, 4, 0], [0, 0, 0]], // 粘土烧制 (简化)
    result: { blockId: BLOCK.BRICK, count: 4 },
    name: '砖块 x4',
  },
  {
    id: 'sandstone',
    pattern: [[4, 4, 0], [4, 4, 0], [0, 0, 0]], // 沙子
    result: { blockId: BLOCK.SANDSTONE, count: 4 },
    name: '砂岩 x4',
  },
  {
    id: 'oak_stairs',
    pattern: [[7, 0, 0], [7, 7, 0], [7, 7, 7]],
    result: { blockId: BLOCK.OAK_STAIRS, count: 4 },
    name: '橡木楼梯 x4',
  },
  {
    id: 'cobblestone_stairs',
    pattern: [[8, 0, 0], [8, 8, 0], [8, 8, 8]],
    result: { blockId: BLOCK.COBBLESTONE_STAIRS, count: 4 },
    name: '圆石楼梯 x4',
  },
  {
    id: 'stone_slab',
    pattern: [[0, 0, 0], [0, 0, 0], [3, 3, 3]],
    result: { blockId: BLOCK.STONE_SLAB, count: 6 },
    name: '石台阶 x6',
  },
  {
    id: 'oak_slab',
    pattern: [[0, 0, 0], [0, 0, 0], [7, 7, 7]],
    result: { blockId: BLOCK.OAK_SLAB, count: 6 },
    name: '木台阶 x6',
  },
  {
    id: 'oak_fence',
    pattern: [[7, 'stick', 7], [7, 'stick', 7], [0, 0, 0]],
    result: { blockId: BLOCK.OAK_FENCE, count: 3 },
    name: '栅栏 x3',
  },
  {
    id: 'glass_pane',
    pattern: [[16, 16, 16], [16, 16, 16], [0, 0, 0]],
    result: { blockId: BLOCK.GLASS_PANE, count: 16 },
    name: '玻璃板 x16',
  },
  {
    id: 'iron_bars',
    pattern: [[51, 51, 51], [51, 51, 51], [0, 0, 0]],
    result: { blockId: BLOCK.IRON_BARS, count: 16 },
    name: '铁栏杆 x16',
  },
  {
    id: 'ladder',
    pattern: [[7, 0, 7], [7, 7, 7], [7, 0, 7]],
    result: { blockId: BLOCK.LADDER, count: 3 },
    name: '梯子 x3',
  },
  {
    id: 'torch',
    pattern: [[0, 'coal', 0], [0, 'stick', 0], [0, 0, 0]],
    result: { blockId: BLOCK.TORCH, count: 4 },
    name: '火把 x4',
  },

  // ===== 矿物块 =====
  {
    id: 'iron_block',
    pattern: [[51, 51, 51], [51, 51, 51], [51, 51, 51]],
    result: { blockId: BLOCK.IRON_BLOCK, count: 1 },
    name: '铁块',
  },
  {
    id: 'gold_block',
    pattern: [[52, 52, 52], [52, 52, 52], [52, 52, 52]],
    result: { blockId: BLOCK.GOLD_BLOCK, count: 1 },
    name: '金块',
  },
  {
    id: 'diamond_block',
    pattern: [[53, 53, 53], [53, 53, 53], [53, 53, 53]],
    result: { blockId: BLOCK.DIAMOND_BLOCK, count: 1 },
    name: '钻石块',
  },
  {
    id: 'emerald_block',
    pattern: [[54, 54, 54], [54, 54, 54], [54, 54, 54]],
    result: { blockId: BLOCK.EMERALD_BLOCK, count: 1 },
    name: '绿宝石块',
  },
  {
    id: 'coal_block',
    pattern: [[55, 55, 55], [55, 55, 55], [55, 55, 55]],
    result: { blockId: BLOCK.COAL_BLOCK, count: 1 },
    name: '煤炭块',
  },
  {
    id: 'hay_block',
    pattern: [[84, 84, 84], [84, 84, 84], [84, 84, 84]],
    result: { blockId: BLOCK.HAY_BLOCK, count: 1 },
    name: '干草块',
  },

  // ===== 红石 =====
  {
    id: 'redstone_torch',
    pattern: [[0, 'redstone', 0], [0, 'stick', 0], [0, 0, 0]],
    result: { blockId: BLOCK.REDSTONE_TORCH, count: 1 },
    name: '红石火把',
  },
  {
    id: 'lever',
    pattern: [[0, 'cobblestone', 0], [0, 'stick', 0], [0, 0, 0]],
    result: { blockId: BLOCK.LEVER, count: 1 },
    name: '拉杆',
  },
  {
    id: 'stone_button',
    pattern: [[0, 3, 0], [0, 0, 0], [0, 0, 0]],
    result: { blockId: BLOCK.STONE_BUTTON, count: 1 },
    name: '石头按钮',
  },
  {
    id: 'redstone_lamp',
    pattern: [[51, 51, 51], [51, 'glowstone', 51], [51, 51, 51]],
    result: { blockId: BLOCK.REDSTONE_LAMP, count: 1 },
    name: '红石灯',
  },
  {
    id: 'piston',
    pattern: [[7, 7, 7], [51, 46, 51], [8, 'redstone', 8]],
    result: { blockId: BLOCK.PISTON, count: 1 },
    name: '活塞',
  },
  {
    id: 'pressure_plate',
    pattern: [[3, 3, 0], [0, 0, 0], [0, 0, 0]],
    result: { blockId: BLOCK.STONE_PRESSURE_PLATE, count: 1 },
    name: '压力板',
  },

  // ===== 功能方块 =====
  {
    id: 'enchanting_table',
    pattern: [[0, 0, 0], [51, 5, 51], [8, 'diamond', 8]],
    result: { blockId: BLOCK.ENCHANTING_TABLE, count: 1 },
    name: '附魔台',
  },
  {
    id: 'brewing_stand',
    pattern: [[0, 5, 0], [3, 0, 3], [0, 3, 0]],
    result: { blockId: BLOCK.BREWING_STAND, count: 1 },
    name: '酿造台',
  },
  {
    id: 'tnt',
    pattern: [[8, 8, 8], ['coal', 'coal', 'coal'], [8, 8, 8]],
    result: { blockId: BLOCK.TNT, count: 1 },
    name: 'TNT',
  },
  {
    id: 'bed',
    pattern: [[26, 26, 26], [7, 7, 7], [0, 0, 0]],
    result: { blockId: BLOCK.BED_BLOCK, count: 1 },
    name: '床',
  },

  // ===== 食物 =====
  {
    id: 'bread',
    pattern: [[84, 84, 84], [0, 0, 0], [0, 0, 0]],
    result: { itemId: ITEM_TYPE.BREAD, count: 1 },
    name: '面包',
  },

  // ===== 工具 =====
  {
    id: 'wood_pickaxe',
    pattern: [[7, 7, 7], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'pickaxe', material: 'wood', count: 1 },
    name: '木镐',
  },
  {
    id: 'stone_pickaxe',
    pattern: [[8, 8, 8], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'pickaxe', material: 'stone', count: 1 },
    name: '石镐',
  },
  {
    id: 'iron_pickaxe',
    pattern: [[51, 51, 51], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'pickaxe', material: 'iron', count: 1 },
    name: '铁镐',
  },
  {
    id: 'diamond_pickaxe',
    pattern: [[53, 53, 53], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'pickaxe', material: 'diamond', count: 1 },
    name: '钻石镐',
  },
  {
    id: 'wood_axe',
    pattern: [[7, 7, 0], [7, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'axe', material: 'wood', count: 1 },
    name: '木斧',
  },
  {
    id: 'iron_axe',
    pattern: [[51, 51, 0], [51, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'axe', material: 'iron', count: 1 },
    name: '铁斧',
  },
  {
    id: 'diamond_axe',
    pattern: [[53, 53, 0], [53, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'axe', material: 'diamond', count: 1 },
    name: '钻石斧',
  },
  {
    id: 'wood_sword',
    pattern: [[0, 7, 0], [0, 7, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'wood', count: 1 },
    name: '木剑',
  },
  {
    id: 'stone_sword',
    pattern: [[0, 8, 0], [0, 8, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'stone', count: 1 },
    name: '石剑',
  },
  {
    id: 'iron_sword',
    pattern: [[0, 51, 0], [0, 51, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'iron', count: 1 },
    name: '铁剑',
  },
  {
    id: 'diamond_sword',
    pattern: [[0, 53, 0], [0, 53, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'diamond', count: 1 },
    name: '钻石剑',
  },
  {
    id: 'wood_shovel',
    pattern: [[0, 7, 0], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'shovel', material: 'wood', count: 1 },
    name: '木锹',
  },
  {
    id: 'iron_shovel',
    pattern: [[0, 51, 0], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'shovel', material: 'iron', count: 1 },
    name: '铁锹',
  },
  {
    id: 'diamond_shovel',
    pattern: [[0, 53, 0], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'shovel', material: 'diamond', count: 1 },
    name: '钻石锹',
  },
  {
    id: 'wood_hoe',
    pattern: [[7, 7, 0], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'hoe', material: 'wood', count: 1 },
    name: '木锄',
  },
  {
    id: 'iron_hoe',
    pattern: [[51, 51, 0], [0, 'stick', 0], [0, 'stick', 0]],
    result: { toolType: 'hoe', material: 'iron', count: 1 },
    name: '铁锄',
  },

  // ===== 弓箭 =====
  {
    id: 'bow',
    pattern: [['stick', 0, 'stick'], ['string', 'stick', 'string'], ['stick', 0, 'stick']],
    result: { itemId: ITEM_TYPE.BOW, count: 1 },
    name: '弓',
  },
  {
    id: 'arrow',
    pattern: [[0, 'stick', 0], [0, 'stick', 'coal'], [0, 'stick', 0]],
    result: { itemId: ITEM_TYPE.ARROW, count: 4 },
    name: '箭矢 x4',
  },
  {
    id: 'fishing_rod',
    pattern: [[0, 0, 'stick'], [0, 'stick', 'string'], ['stick', 'string', 0]],
    result: { itemId: ITEM_TYPE.FISHING_ROD, count: 1 },
    name: '钓鱼竿',
  },

  // ===== 弩箭/三叉戟/射击武器 =====
  {
    id: 'crossbow',
    pattern: [['stick', 'iron_ingot', 'stick'], ['string', 'bow', 'string'], ['stick', 'iron_ingot', 'stick']],
    result: { itemId: ITEM_TYPE.CROSSBOW, count: 1 },
    name: '弩',
  },
  {
    id: 'spectral_arrow',
    pattern: [[0, 'glowstone', 0], ['arrow', 'arrow', 'arrow'], [0, 'glowstone', 0]],
    result: { itemId: ITEM_TYPE.SPECTRAL_ARROW, count: 4 },
    name: '光灵箭 x4',
  },
  {
    id: 'snowball',
    pattern: [[0, 17, 0], [0, 17, 0], [0, 0, 0]],
    result: { itemId: ITEM_TYPE.SNOWBALL, count: 4 },
    name: '雪球 x4',
  },
  {
    id: 'firework_rocket',
    pattern: [[0, 'gunpowder', 0], [0, 'paper', 0], [0, 0, 0]],
    result: { itemId: ITEM_TYPE.FIREWORK_ROCKET, count: 3 },
    name: '烟花火箭 x3',
  },
  {
    id: 'iron_sword',
    pattern: [[0, 'iron_ingot', 0], [0, 'iron_ingot', 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'iron', count: 1 },
    name: '铁剑',
  },
  {
    id: 'diamond_sword',
    pattern: [[0, 'diamond', 0], [0, 'diamond', 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'diamond', count: 1 },
    name: '钻石剑',
  },
  {
    id: 'wood_sword',
    pattern: [[0, 7, 0], [0, 7, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'wood', count: 1 },
    name: '木剑',
  },
  {
    id: 'stone_sword',
    pattern: [[0, 8, 0], [0, 8, 0], [0, 'stick', 0]],
    result: { toolType: 'sword', material: 'stone', count: 1 },
    name: '石剑',
  },

  // ===== 护甲 =====
  {
    id: 'leather_helmet',
    pattern: [[84, 84, 84], [84, 0, 84], [0, 0, 0]],
    result: { armorType: 'helmet', material: 'leather', count: 1 },
    name: '皮革头盔',
  },
  {
    id: 'leather_chestplate',
    pattern: [[84, 0, 84], [84, 84, 84], [84, 84, 84]],
    result: { armorType: 'chestplate', material: 'leather', count: 1 },
    name: '皮革胸甲',
  },
  {
    id: 'leather_leggings',
    pattern: [[84, 84, 84], [84, 0, 84], [84, 0, 84]],
    result: { armorType: 'leggings', material: 'leather', count: 1 },
    name: '皮革护腿',
  },
  {
    id: 'leather_boots',
    pattern: [[0, 0, 0], [84, 0, 84], [84, 0, 84]],
    result: { armorType: 'boots', material: 'leather', count: 1 },
    name: '皮革靴子',
  },
  {
    id: 'iron_helmet',
    pattern: [[51, 51, 51], [51, 0, 51], [0, 0, 0]],
    result: { armorType: 'helmet', material: 'iron', count: 1 },
    name: '铁头盔',
  },
  {
    id: 'iron_chestplate',
    pattern: [[51, 0, 51], [51, 51, 51], [51, 51, 51]],
    result: { armorType: 'chestplate', material: 'iron', count: 1 },
    name: '铁胸甲',
  },
  {
    id: 'iron_leggings',
    pattern: [[51, 51, 51], [51, 0, 51], [51, 0, 51]],
    result: { armorType: 'leggings', material: 'iron', count: 1 },
    name: '铁护腿',
  },
  {
    id: 'iron_boots',
    pattern: [[0, 0, 0], [51, 0, 51], [51, 0, 51]],
    result: { armorType: 'boots', material: 'iron', count: 1 },
    name: '铁靴子',
  },
  {
    id: 'diamond_helmet',
    pattern: [[53, 53, 53], [53, 0, 53], [0, 0, 0]],
    result: { armorType: 'helmet', material: 'diamond', count: 1 },
    name: '钻石头盔',
  },
  {
    id: 'diamond_chestplate',
    pattern: [[53, 0, 53], [53, 53, 53], [53, 53, 53]],
    result: { armorType: 'chestplate', material: 'diamond', count: 1 },
    name: '钻石胸甲',
  },
  {
    id: 'diamond_leggings',
    pattern: [[53, 53, 53], [53, 0, 53], [53, 0, 53]],
    result: { armorType: 'leggings', material: 'diamond', count: 1 },
    name: '钻石护腿',
  },
  {
    id: 'diamond_boots',
    pattern: [[0, 0, 0], [53, 0, 53], [53, 0, 53]],
    result: { armorType: 'boots', material: 'diamond', count: 1 },
    name: '钻石靴子',
  },

  // ===== 其他物品 =====
  {
    id: 'bucket',
    pattern: [[51, 0, 51], [0, 51, 0], [0, 0, 0]],
    result: { itemId: ITEM_TYPE.BUCKET, count: 1 },
    name: '桶',
  },
  {
    id: 'shield',
    pattern: [[7, 51, 7], [7, 7, 7], [0, 7, 0]],
    result: { itemId: ITEM_TYPE.SHIELD, count: 1 },
    name: '盾牌',
  },
  {
    id: 'paper',
    pattern: [[0, 0, 0], [84, 84, 84], [0, 0, 0]],
    result: { itemId: ITEM_TYPE.PAPER, count: 3 },
    name: '纸张 x3',
  },
  {
    id: 'map',
    pattern: [[7, 7, 7], [7, 'paper', 7], [7, 7, 7]],
    result: { itemId: ITEM_TYPE.MAP, count: 1 },
    name: '地图',
  },
];

// 物品解析：将模式中的值转为可比较的标识
function resolvePatternItem(value) {
  if (value === 0 || value === null) return null;
  if (typeof value === 'number') return `block:${value}`;
  return `item:${value}`;
}

// 归一化合成网格（移除空行空列）
function normalizePattern(grid) {
  const items = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const v = grid[y] ? grid[y][x] : 0;
      items.push(resolvePatternItem(v));
    }
  }
  return items;
}

// 匹配合成配方
export function matchRecipe(grid) {
  const input = normalizePattern(grid);

  for (const recipe of RECIPES) {
    const pattern = normalizePattern(recipe.pattern);
    if (patternsMatch(input, pattern)) {
      return recipe;
    }
  }
  return null;
}

// 检查两个模式是否匹配（支持位置偏移）
function patternsMatch(input, pattern) {
  // 找到输入和模式的边界
  const inputBounds = getBounds(input);
  const patternBounds = getBounds(pattern);

  if (!inputBounds || !patternBounds) return false;

  if (inputBounds.w !== patternBounds.w || inputBounds.h !== patternBounds.h) return false;

  // 比较裁剪后的网格
  for (let y = 0; y < inputBounds.h; y++) {
    for (let x = 0; x < inputBounds.w; x++) {
      const ix = inputBounds.minX + x;
      const iy = inputBounds.minY + y;
      const px = patternBounds.minX + x;
      const py = patternBounds.minY + y;
      if (input[iy * 3 + ix] !== pattern[py * 3 + px]) return false;
    }
  }
  return true;
}

function getBounds(arr) {
  let minX = 3, minY = 3, maxX = -1, maxY = -1;
  let hasAny = false;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (arr[y * 3 + x] !== null) {
        hasAny = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!hasAny) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// 获取所有配方列表（用于UI显示）
export function getRecipeList() {
  return RECIPES.map(r => ({
    id: r.id,
    name: r.name,
    pattern: r.pattern,
    result: r.result,
  }));
}

// ===== ITEM_TYPE 字符串 → BLOCK ID 映射 =====
// 用于将合成配方中的字符串标识符映射到背包中的数字方块 ID
const ITEM_TYPE_TO_BLOCK = {
  [ITEM_TYPE.STICK]: BLOCK.STICK,
  [ITEM_TYPE.STRING]: BLOCK.STRING_ITEM,
  [ITEM_TYPE.BOW]: BLOCK.BOW,
  [ITEM_TYPE.CROSSBOW]: BLOCK.CROSSBOW,
  [ITEM_TYPE.TRIDENT]: BLOCK.TRIDENT,
  [ITEM_TYPE.ARROW]: BLOCK.ARROW,
  [ITEM_TYPE.SPECTRAL_ARROW]: BLOCK.SPECTRAL_ARROW,
  [ITEM_TYPE.SNOWBALL]: BLOCK.SNOWBALL,
  [ITEM_TYPE.EGG]: BLOCK.EGG_ITEM,
  [ITEM_TYPE.ENDER_PEARL]: BLOCK.ENDER_PEARL,
  [ITEM_TYPE.FIREWORK_ROCKET]: BLOCK.FIREWORK_ROCKET,
  [ITEM_TYPE.FISHING_ROD]: BLOCK.FISHING_ROD,
  [ITEM_TYPE.BUCKET]: BLOCK.BUCKET,
  [ITEM_TYPE.SHIELD]: 0, // 盾牌暂无方块 ID，使用 0 占位
  [ITEM_TYPE.PAPER]: BLOCK.PAPER,
  [ITEM_TYPE.MAP]: 0,
  [ITEM_TYPE.BOOK]: BLOCK.BOOK,
  [ITEM_TYPE.BREAD]: BLOCK.BREAD,
  [ITEM_TYPE.FLINT_AND_STEEL]: 0,
  [ITEM_TYPE.SHEARS]: 0,
  [ITEM_TYPE.COMPASS]: 0,
  [ITEM_TYPE.CLOCK]: 0,
  [ITEM_TYPE.BONE_MEAL]: 0,
  [ITEM_TYPE.SUGAR]: 0,
  [ITEM_TYPE.LEATHER]: BLOCK.LEATHER,
  [ITEM_TYPE.IRON_INGOT]: BLOCK.IRON_INGOT,
  [ITEM_TYPE.GOLD_INGOT]: BLOCK.GOLD_INGOT,
  [ITEM_TYPE.DIAMOND]: BLOCK.DIAMOND_GEM,
  [ITEM_TYPE.EMERALD]: BLOCK.EMERALD_GEM,
  [ITEM_TYPE.COAL]: BLOCK.COAL_ITEM,
  [ITEM_TYPE.WHEAT]: BLOCK.WHEAT_ITEM,
  [ITEM_TYPE.APPLE]: BLOCK.APPLE,
  [ITEM_TYPE.POTION]: 0,
  [ITEM_TYPE.BOTTLE]: 0,
  [ITEM_TYPE.RAW_BEEF]: BLOCK.RAW_BEEF,
  [ITEM_TYPE.COOKED_BEEF]: BLOCK.COOKED_BEEF,
};

// 方块别名映射（合成配方中使用别名 → 实际 BLOCK ID）
const BLOCK_ALIAS = {
  'glowstone': BLOCK.GLOWSTONE,
  'redstone': BLOCK.REDSTONE_DUST_ITEM,
  'coal': BLOCK.COAL_ITEM,
  'diamond': BLOCK.DIAMOND_GEM,
  'emerald': BLOCK.EMERALD_GEM,
  'iron_ingot': BLOCK.IRON_INGOT,
  'gold_ingot': BLOCK.GOLD_INGOT,
  'leather': BLOCK.LEATHER,
  'paper': BLOCK.PAPER,
  'book': BLOCK.BOOK,
  'stick': BLOCK.STICK,
  'string': BLOCK.STRING_ITEM,
  'gunpowder': BLOCK.GUNPOWDER,
  'bow': BLOCK.BOW,
  'arrow': BLOCK.ARROW,
  'flint': BLOCK.FLINT,
  'feather': BLOCK.FEATHER,
};

// 工具/护甲类型 → 生成物品的方块 ID
// 合成出的工具/武器/护甲需要生成一个唯一的物品 ID
let _nextToolId = 10000;

/**
 * 将合成配方模式中的值解析为统一的数字 BLOCK ID
 * 用于比较 UI 背包中的物品和配方模式
 */
function resolveToBlockId(value) {
  if (value === 0 || value === null) return 0;
  if (typeof value === 'number') return value;
  // 字符串：先查别名映射，再查 ITEM_TYPE 映射
  if (BLOCK_ALIAS[value] !== undefined) return BLOCK_ALIAS[value];
  if (ITEM_TYPE_TO_BLOCK[value] !== undefined) return ITEM_TYPE_TO_BLOCK[value];
  return -1; // 未知标识
}

/**
 * 从 UI 背包网格匹配配方
 * @param {Array} grid - 9 元素数组，每个元素为 {id: blockId, count} 或 null
 * @returns {Object|null} - {id: blockId, count, recipe} 或 null
 */
export function matchRecipeFromInventory(grid) {
  // 将 UI 网格转为 2D 数字数组（block IDs）
  const inputGrid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 9; i++) {
    const x = i % 3;
    const y = Math.floor(i / 3);
    if (grid[i] && grid[i].id) {
      inputGrid[y][x] = grid[i].id;
    }
  }

  // 归一化输入网格为 block ID 数组
  const inputItems = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const v = inputGrid[y][x];
      inputItems.push(v === 0 ? null : `b:${v}`);
    }
  }

  // 遍历所有配方
  for (const recipe of RECIPES) {
    // 将配方的 pattern 也转为 block ID 数组
    const patternItems = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const v = recipe.pattern[y] ? recipe.pattern[y][x] : 0;
        const blockId = resolveToBlockId(v);
        patternItems.push(blockId === 0 ? null : `b:${blockId}`);
      }
    }

    if (patternsMatch(inputItems, patternItems)) {
      // 匹配成功，将结果转为 block ID
      return resolveRecipeResult(recipe);
    }
  }
  return null;
}

/**
 * 将配方的 result 转为 {id: blockId, count} 格式
 */
function resolveRecipeResult(recipe) {
  const result = recipe.result;
  let blockId = 0;

  if (result.blockId !== undefined) {
    blockId = result.blockId;
  } else if (result.itemId !== undefined) {
    // 查找 ITEM_TYPE → BLOCK 映射
    blockId = ITEM_TYPE_TO_BLOCK[result.itemId] || 0;
    // 如果映射不存在，使用动态 ID
    if (blockId === 0) {
      blockId = _nextToolId++;
    }
  } else if (result.toolType !== undefined) {
    // 工具/武器：生成动态 ID，并记录工具信息
    blockId = _nextToolId++;
  } else if (result.armorType !== undefined) {
    // 护甲：生成动态 ID，并记录护甲信息
    blockId = _nextToolId++;
  }

  return {
    id: blockId,
    count: result.count || 1,
    recipe: recipe,
    // 保留原始 result 信息，供 UI 创建工具/护甲
    resultType: result.toolType ? 'tool' : (result.armorType ? 'armor' : (result.itemId ? 'item' : 'block')),
    toolType: result.toolType || null,
    material: result.material || null,
    armorType: result.armorType || null,
    name: recipe.name,
  };
}
