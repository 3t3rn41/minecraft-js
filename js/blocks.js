/**
 * blocks.js — 方块类型定义 + 程序化纹理图集生成
 * 使用 Canvas 绘制像素化纹理，生成纹理图集供 Three.js 使用
 */

// ===== 方块 ID 常量 =====
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  COBBLESTONE: 8,
  WATER: 9,
  BEDROCK: 10,
  COAL_ORE: 11,
  IRON_ORE: 12,
  GOLD_ORE: 13,
  DIAMOND_ORE: 14,
  CRAFTING_TABLE: 15,
  GLASS: 16,
  SNOW: 17,
  BRICK: 18,
  BOOKSHELF: 19,
  // 新增方块
  TNT: 20,
  OBSIDIAN: 21,
  ICE: 22,
  LAVA: 23,
  TORCH: 24,
  LADDER: 25,
  FLOWER_RED: 26,
  FLOWER_YELLOW: 27,
  MUSHROOM: 28,
  BED_BLOCK: 29,
  CHEST: 30,
  NETHERRACK: 31,
  GLOWSTONE: 32,
  SANDSTONE: 33,
  CLAY: 34,
  PUMPKIN: 35,
  TALL_GRASS: 36,
  MOSS_STONE: 37,
  REDSTONE_ORE: 38,
  EMERALD_ORE: 39,
  REDSTONE_BLOCK: 40,
  QUARTZ: 41,
  TERRACOTTA: 42,
  PACKED_ICE: 43,
  BLUE_ICE: 44,
  // ===== 第二批扩展方块 =====
  IRON_BLOCK: 51,
  GOLD_BLOCK: 52,
  DIAMOND_BLOCK: 53,
  EMERALD_BLOCK: 54,
  COAL_BLOCK: 55,
  LAPIS_ORE: 56,
  LAPIS_BLOCK: 57,
  END_STONE: 58,
  DRAGON_EGG: 59,
  ENCHANTING_TABLE: 60,
  BREWING_STAND: 61,
  REDSTONE_DUST: 62,
  REDSTONE_TORCH: 63,
  LEVER: 64,
  STONE_BUTTON: 65,
  REDSTONE_LAMP: 66,
  PISTON: 67,
  STONE_PRESSURE_PLATE: 68,
  OAK_STAIRS: 69,
  COBBLESTONE_STAIRS: 70,
  STONE_SLAB: 71,
  OAK_SLAB: 72,
  OAK_FENCE: 73,
  IRON_BARS: 74,
  GLASS_PANE: 75,
  SPONGE: 76,
  SEA_LANTERN: 77,
  NETHER_BRICK: 78,
  SOUL_SAND: 79,
  GRAVEL: 80,
  CACTUS: 81,
  VINE: 82,
  FARMLAND: 83,
  WHEAT_CROP: 84,
  NETHER_PORTAL: 85,
  END_PORTAL_FRAME: 86,
  HAY_BLOCK: 87,
  BONE_BLOCK: 88,
  MAGMA: 89,
  PURPUR_BLOCK: 90,
  CONCRETE: 91,
  OAK_DOOR: 92,
  IRON_DOOR: 93,
  SPRUCE_LOG: 94,
  BIRCH_LOG: 95,
  DARK_OAK_LOG: 96,
  ACACIA_LOG: 97,
  JUNGLE_LOG: 98,
  STRIPPED_OAK_LOG: 99,
  CHISELED_STONE: 100,
  SMOOTH_STONE: 101,
  MOSSY_COBBLESTONE: 102,
  CRACKED_STONE: 103,
  ANDESITE: 104,
  DIORITE: 105,
  GRANITE: 106,
  PRISMARINE: 107,
  DARK_PRISMARINE: 108,
  SEA_LANTERN_GLOW: 109,
  RED_SAND: 110,
  RED_SANDSTONE: 111,
  MAGMA_CREAM: 112,
  MYCELIUM: 113,
  PODZOL: 114,
  COARSE_DIRT: 115,
  TERRACOTTA_WHITE: 116,
  TERRACOTTA_ORANGE: 117,
  TERRACOTTA_MAGENTA: 118,
  TERRACOTTA_LIGHT_BLUE: 119,
  TERRACOTTA_YELLOW: 120,
  TERRACOTTA_LIME: 121,
  TERRACOTTA_PINK: 122,
  TERRACOTTA_GRAY: 123,
  TERRACOTTA_CYAN: 124,
  TERRACOTTA_PURPLE: 125,
  TERRACOTTA_BLUE: 126,
  TERRACOTTA_BROWN: 127,
  TERRACOTTA_GREEN: 128,
  TERRACOTTA_RED: 129,
  TERRACOTTA_BLACK: 130,
  // ===== 第三批扩展方块 =====
  SLIME_BLOCK: 131,
  NETHER_STAR: 132,
  BOOK: 133,
  PAPER: 134,
  STICK: 135,
  COAL_ITEM: 136,
  DIAMOND_GEM: 137,
  EMERALD_GEM: 138,
  IRON_INGOT: 139,
  GOLD_INGOT: 140,
  BREAD: 141,
  APPLE: 142,
  BONE: 143,
  STRING_ITEM: 144,
  GUNPOWDER: 145,
  REDSTONE_DUST_ITEM: 146,
  BUCKET: 147,
  BOW: 148,
  ARROW: 149,
  FISHING_ROD: 150,
  FLINT: 151,
  LEATHER: 152,
  FEATHER: 153,
  WHEAT_ITEM: 154,
  SEEDS: 155,
  // ===== 食物物品 =====
  RAW_PORKCHOP: 156,
  RAW_BEEF: 157,
  RAW_CHICKEN: 158,
  RAW_MUTTON: 159,
  COOKED_PORKCHOP: 160,
  COOKED_BEEF: 161,
  COOKED_CHICKEN: 162,
  COOKED_MUTTON: 163,
};

// ===== 方块定义 =====
// textures: [top, bottom, side] — 纹理图集索引
export const BLOCK_DEFS = {
  [BLOCK.AIR]: { name: '空气', solid: false, transparent: true, textures: null },
  [BLOCK.GRASS]: { name: '草方块', solid: true, transparent: false, textures: [0, 2, 1], drops: BLOCK.DIRT },
  [BLOCK.DIRT]: { name: '泥土', solid: true, transparent: false, textures: [2, 2, 2], drops: BLOCK.DIRT },
  [BLOCK.STONE]: { name: '石头', solid: true, transparent: false, textures: [3, 3, 3], drops: BLOCK.COBBLESTONE },
  [BLOCK.SAND]: { name: '沙子', solid: true, transparent: false, textures: [4, 4, 4], drops: BLOCK.SAND },
  [BLOCK.LOG]: { name: '原木', solid: true, transparent: false, textures: [5, 5, 6], drops: BLOCK.LOG },
  [BLOCK.LEAVES]: { name: '树叶', solid: true, transparent: true, textures: [7, 7, 7], drops: BLOCK.LEAVES },
  [BLOCK.PLANKS]: { name: '木板', solid: true, transparent: false, textures: [8, 8, 8], drops: BLOCK.PLANKS },
  [BLOCK.COBBLESTONE]: { name: '圆石', solid: true, transparent: false, textures: [9, 9, 9], drops: BLOCK.COBBLESTONE },
  [BLOCK.WATER]: { name: '水', solid: false, transparent: true, textures: [10, 10, 10], drops: null, liquid: true },
  [BLOCK.BEDROCK]: { name: '基岩', solid: true, transparent: false, textures: [11, 11, 11], drops: null },
  [BLOCK.COAL_ORE]: { name: '煤矿石', solid: true, transparent: false, textures: [12, 12, 12], drops: BLOCK.COAL_ORE },
  [BLOCK.IRON_ORE]: { name: '铁矿石', solid: true, transparent: false, textures: [13, 13, 13], drops: BLOCK.IRON_ORE },
  [BLOCK.GOLD_ORE]: { name: '金矿石', solid: true, transparent: false, textures: [14, 14, 14], drops: BLOCK.GOLD_ORE },
  [BLOCK.DIAMOND_ORE]: { name: '钻石矿石', solid: true, transparent: false, textures: [15, 15, 15], drops: BLOCK.DIAMOND_ORE },
  [BLOCK.CRAFTING_TABLE]: { name: '工作台', solid: true, transparent: false, textures: [16, 8, 17], drops: BLOCK.CRAFTING_TABLE },
  [BLOCK.GLASS]: { name: '玻璃', solid: true, transparent: true, textures: [18, 18, 18], drops: null },
  [BLOCK.SNOW]: { name: '雪块', solid: true, transparent: false, textures: [19, 2, 20], drops: BLOCK.SNOW },
  [BLOCK.BRICK]: { name: '砖块', solid: true, transparent: false, textures: [21, 21, 21], drops: BLOCK.BRICK },
  [BLOCK.BOOKSHELF]: { name: '书架', solid: true, transparent: false, textures: [8, 8, 22], drops: BLOCK.BOOKSHELF },
  // 新增方块定义
  [BLOCK.TNT]: { name: 'TNT', solid: true, transparent: false, textures: [23, 23, 24], drops: BLOCK.TNT, explosive: true },
  [BLOCK.OBSIDIAN]: { name: '黑曜石', solid: true, transparent: false, textures: [25, 25, 25], drops: BLOCK.OBSIDIAN, hardness: 50 },
  [BLOCK.ICE]: { name: '冰', solid: true, transparent: true, textures: [26, 26, 26], drops: null, slippery: true },
  [BLOCK.LAVA]: { name: '岩浆', solid: false, transparent: true, textures: [27, 27, 27], drops: null, liquid: true, damage: 4 },
  [BLOCK.TORCH]: { name: '火把', solid: false, transparent: true, textures: [28, 28, 28], drops: BLOCK.TORCH, lightSource: 14 },
  [BLOCK.LADDER]: { name: '梯子', solid: false, transparent: true, textures: [29, 29, 29], drops: BLOCK.LADDER, climbable: true },
  [BLOCK.FLOWER_RED]: { name: '红花', solid: false, transparent: true, textures: [30, 30, 30], drops: BLOCK.FLOWER_RED, cross: true },
  [BLOCK.FLOWER_YELLOW]: { name: '黄花', solid: false, transparent: true, textures: [31, 31, 31], drops: BLOCK.FLOWER_YELLOW, cross: true },
  [BLOCK.MUSHROOM]: { name: '蘑菇', solid: false, transparent: true, textures: [32, 32, 32], drops: BLOCK.MUSHROOM, cross: true },
  [BLOCK.BED_BLOCK]: { name: '床', solid: false, transparent: true, textures: [33, 33, 34], drops: BLOCK.BED_BLOCK, interactable: 'bed' },
  [BLOCK.CHEST]: { name: '宝箱', solid: true, transparent: false, textures: [35, 35, 36], drops: BLOCK.CHEST, interactable: 'chest' },
  [BLOCK.NETHERRACK]: { name: '下界岩', solid: true, transparent: false, textures: [37, 37, 37], drops: BLOCK.NETHERRACK },
  [BLOCK.GLOWSTONE]: { name: '荧石', solid: true, transparent: false, textures: [38, 38, 38], drops: BLOCK.GLOWSTONE, lightSource: 15 },
  [BLOCK.SANDSTONE]: { name: '砂岩', solid: true, transparent: false, textures: [39, 39, 39], drops: BLOCK.SANDSTONE },
  [BLOCK.CLAY]: { name: '粘土', solid: true, transparent: false, textures: [40, 40, 40], drops: BLOCK.CLAY },
  [BLOCK.PUMPKIN]: { name: '南瓜', solid: true, transparent: false, textures: [41, 41, 42], drops: BLOCK.PUMPKIN },
  [BLOCK.TALL_GRASS]: { name: '草丛', solid: false, transparent: true, textures: [152, 152, 152], drops: BLOCK.SEEDS, cross: true },
  [BLOCK.MOSS_STONE]: { name: '苔石', solid: true, transparent: false, textures: [43, 43, 43], drops: BLOCK.MOSS_STONE },
  [BLOCK.REDSTONE_ORE]: { name: '红石矿石', solid: true, transparent: false, textures: [44, 44, 44], drops: BLOCK.REDSTONE_ORE },
  [BLOCK.EMERALD_ORE]: { name: '绿宝石矿石', solid: true, transparent: false, textures: [45, 45, 45], drops: BLOCK.EMERALD_ORE },
  [BLOCK.REDSTONE_BLOCK]: { name: '红石块', solid: true, transparent: false, textures: [46, 46, 46], drops: BLOCK.REDSTONE_BLOCK },
  [BLOCK.QUARTZ]: { name: '石英块', solid: true, transparent: false, textures: [47, 47, 47], drops: BLOCK.QUARTZ },
  [BLOCK.TERRACOTTA]: { name: '陶瓦', solid: true, transparent: false, textures: [48, 48, 48], drops: BLOCK.TERRACOTTA },
  [BLOCK.PACKED_ICE]: { name: '浮冰', solid: true, transparent: true, textures: [49, 49, 49], drops: null, slippery: true },
  [BLOCK.BLUE_ICE]: { name: '蓝冰', solid: true, transparent: true, textures: [50, 50, 50], drops: null, slippery: true },
  // ===== 第二批扩展方块定义 =====
  [BLOCK.IRON_BLOCK]: { name: '铁块', solid: true, transparent: false, textures: [51, 51, 51], drops: BLOCK.IRON_BLOCK, lightSource: 0 },
  [BLOCK.GOLD_BLOCK]: { name: '金块', solid: true, transparent: false, textures: [52, 52, 52], drops: BLOCK.GOLD_BLOCK },
  [BLOCK.DIAMOND_BLOCK]: { name: '钻石块', solid: true, transparent: false, textures: [53, 53, 53], drops: BLOCK.DIAMOND_BLOCK },
  [BLOCK.EMERALD_BLOCK]: { name: '绿宝石块', solid: true, transparent: false, textures: [54, 54, 54], drops: BLOCK.EMERALD_BLOCK },
  [BLOCK.COAL_BLOCK]: { name: '煤炭块', solid: true, transparent: false, textures: [55, 55, 55], drops: BLOCK.COAL_BLOCK },
  [BLOCK.LAPIS_ORE]: { name: '青金石矿石', solid: true, transparent: false, textures: [56, 56, 56], drops: BLOCK.LAPIS_ORE },
  [BLOCK.LAPIS_BLOCK]: { name: '青金石块', solid: true, transparent: false, textures: [57, 57, 57], drops: BLOCK.LAPIS_BLOCK },
  [BLOCK.END_STONE]: { name: '末地石', solid: true, transparent: false, textures: [58, 58, 58], drops: BLOCK.END_STONE },
  [BLOCK.DRAGON_EGG]: { name: '龙蛋', solid: true, transparent: false, textures: [59, 59, 59], drops: BLOCK.DRAGON_EGG },
  [BLOCK.ENCHANTING_TABLE]: { name: '附魔台', solid: true, transparent: false, textures: [60, 60, 61], drops: BLOCK.ENCHANTING_TABLE, interactable: 'enchant', lightSource: 7 },
  [BLOCK.BREWING_STAND]: { name: '酿造台', solid: true, transparent: true, textures: [62, 62, 62], drops: BLOCK.BREWING_STAND, interactable: 'brew' },
  [BLOCK.REDSTONE_DUST]: { name: '红石粉', solid: false, transparent: true, textures: [63, 63, 63], drops: BLOCK.REDSTONE_DUST, redstone: 'dust' },
  [BLOCK.REDSTONE_TORCH]: { name: '红石火把', solid: false, transparent: true, textures: [64, 64, 64], drops: BLOCK.REDSTONE_TORCH, redstone: 'torch', lightSource: 7 },
  [BLOCK.LEVER]: { name: '拉杆', solid: false, transparent: true, textures: [65, 65, 65], drops: BLOCK.LEVER, redstone: 'lever' },
  [BLOCK.STONE_BUTTON]: { name: '石头按钮', solid: false, transparent: true, textures: [66, 66, 66], drops: BLOCK.STONE_BUTTON, redstone: 'button' },
  [BLOCK.REDSTONE_LAMP]: { name: '红石灯', solid: true, transparent: false, textures: [67, 67, 67], drops: BLOCK.REDSTONE_LAMP, redstone: 'lamp' },
  [BLOCK.PISTON]: { name: '活塞', solid: true, transparent: false, textures: [68, 68, 68], drops: BLOCK.PISTON, redstone: 'piston' },
  [BLOCK.STONE_PRESSURE_PLATE]: { name: '压力板', solid: false, transparent: true, textures: [69, 69, 69], drops: BLOCK.STONE_PRESSURE_PLATE, redstone: 'plate' },
  [BLOCK.OAK_STAIRS]: { name: '橡木楼梯', solid: true, transparent: true, textures: [8, 8, 8], drops: BLOCK.OAK_STAIRS },
  [BLOCK.COBBLESTONE_STAIRS]: { name: '圆石楼梯', solid: true, transparent: true, textures: [9, 9, 9], drops: BLOCK.COBBLESTONE_STAIRS },
  [BLOCK.STONE_SLAB]: { name: '石台阶', solid: true, transparent: true, textures: [3, 3, 3], drops: BLOCK.STONE_SLAB },
  [BLOCK.OAK_SLAB]: { name: '木台阶', solid: true, transparent: true, textures: [8, 8, 8], drops: BLOCK.OAK_SLAB },
  [BLOCK.OAK_FENCE]: { name: '栅栏', solid: true, transparent: true, textures: [8, 8, 8], drops: BLOCK.OAK_FENCE },
  [BLOCK.IRON_BARS]: { name: '铁栏杆', solid: true, transparent: true, textures: [51, 51, 51], drops: BLOCK.IRON_BARS },
  [BLOCK.GLASS_PANE]: { name: '玻璃板', solid: true, transparent: true, textures: [18, 18, 18], drops: null },
  [BLOCK.SPONGE]: { name: '海绵', solid: true, transparent: false, textures: [70, 70, 70], drops: BLOCK.SPONGE },
  [BLOCK.SEA_LANTERN]: { name: '海晶灯', solid: true, transparent: false, textures: [71, 71, 71], drops: BLOCK.SEA_LANTERN, lightSource: 15 },
  [BLOCK.NETHER_BRICK]: { name: '下界砖', solid: true, transparent: false, textures: [72, 72, 72], drops: BLOCK.NETHER_BRICK },
  [BLOCK.SOUL_SAND]: { name: '灵魂沙', solid: true, transparent: false, textures: [73, 73, 73], drops: BLOCK.SOUL_SAND },
  [BLOCK.GRAVEL]: { name: '沙砾', solid: true, transparent: false, textures: [74, 74, 74], drops: BLOCK.GRAVEL },
  [BLOCK.CACTUS]: { name: '仙人掌', solid: true, transparent: true, textures: [75, 75, 75], drops: BLOCK.CACTUS, damage: 1 },
  [BLOCK.VINE]: { name: '藤蔓', solid: false, transparent: true, textures: [76, 76, 76], drops: BLOCK.VINE },
  [BLOCK.FARMLAND]: { name: '耕地', solid: true, transparent: false, textures: [77, 2, 2], drops: BLOCK.DIRT },
  [BLOCK.WHEAT_CROP]: { name: '小麦', solid: false, transparent: true, textures: [78, 78, 78], drops: BLOCK.WHEAT_CROP },
  [BLOCK.NETHER_PORTAL]: { name: '下界传送门', solid: false, transparent: true, textures: [79, 79, 79], drops: null, lightSource: 11 },
  [BLOCK.END_PORTAL_FRAME]: { name: '末地传送门框架', solid: true, transparent: false, textures: [80, 80, 80], drops: null },
  [BLOCK.HAY_BLOCK]: { name: '干草块', solid: true, transparent: false, textures: [81, 81, 81], drops: BLOCK.HAY_BLOCK },
  [BLOCK.BONE_BLOCK]: { name: '骨块', solid: true, transparent: false, textures: [82, 82, 82], drops: BLOCK.BONE_BLOCK },
  [BLOCK.MAGMA]: { name: '岩浆块', solid: true, transparent: false, textures: [83, 83, 83], drops: BLOCK.MAGMA, damage: 1, lightSource: 3 },
  [BLOCK.PURPUR_BLOCK]: { name: '紫珀块', solid: true, transparent: false, textures: [84, 84, 84], drops: BLOCK.PURPUR_BLOCK },
  [BLOCK.CONCRETE]: { name: '混凝土', solid: true, transparent: false, textures: [85, 85, 85], drops: BLOCK.CONCRETE },
  [BLOCK.OAK_DOOR]: { name: '橡木门', solid: true, transparent: true, textures: [8, 8, 8], drops: BLOCK.OAK_DOOR, interactable: 'door' },
  [BLOCK.IRON_DOOR]: { name: '铁门', solid: true, transparent: true, textures: [51, 51, 51], drops: BLOCK.IRON_DOOR, interactable: 'door' },
  [BLOCK.SPRUCE_LOG]: { name: '云杉原木', solid: true, transparent: false, textures: [86, 86, 87], drops: BLOCK.SPRUCE_LOG },
  [BLOCK.BIRCH_LOG]: { name: '白桦原木', solid: true, transparent: false, textures: [88, 88, 89], drops: BLOCK.BIRCH_LOG },
  [BLOCK.DARK_OAK_LOG]: { name: '深色橡木', solid: true, transparent: false, textures: [90, 90, 91], drops: BLOCK.DARK_OAK_LOG },
  [BLOCK.ACACIA_LOG]: { name: '金合欢原木', solid: true, transparent: false, textures: [92, 92, 93], drops: BLOCK.ACACIA_LOG },
  [BLOCK.JUNGLE_LOG]: { name: '丛林原木', solid: true, transparent: false, textures: [94, 94, 95], drops: BLOCK.JUNGLE_LOG },
  [BLOCK.STRIPPED_OAK_LOG]: { name: '去皮橡木', solid: true, transparent: false, textures: [96, 96, 97], drops: BLOCK.STRIPPED_OAK_LOG },
  [BLOCK.CHISELED_STONE]: { name: '錾制石头', solid: true, transparent: false, textures: [98, 98, 98], drops: BLOCK.CHISELED_STONE },
  [BLOCK.SMOOTH_STONE]: { name: '平滑石头', solid: true, transparent: false, textures: [99, 99, 99], drops: BLOCK.SMOOTH_STONE },
  [BLOCK.MOSSY_COBBLESTONE]: { name: '苔圆石', solid: true, transparent: false, textures: [43, 43, 43], drops: BLOCK.MOSSY_COBBLESTONE },
  [BLOCK.CRACKED_STONE]: { name: '裂纹石头', solid: true, transparent: false, textures: [100, 100, 100], drops: BLOCK.CRACKED_STONE },
  [BLOCK.ANDESITE]: { name: '安山岩', solid: true, transparent: false, textures: [101, 101, 101], drops: BLOCK.ANDESITE },
  [BLOCK.DIORITE]: { name: '闪长岩', solid: true, transparent: false, textures: [102, 102, 102], drops: BLOCK.DIORITE },
  [BLOCK.GRANITE]: { name: '花岗岩', solid: true, transparent: false, textures: [103, 103, 103], drops: BLOCK.GRANITE },
  [BLOCK.PRISMARINE]: { name: '海晶石', solid: true, transparent: false, textures: [104, 104, 104], drops: BLOCK.PRISMARINE },
  [BLOCK.DARK_PRISMARINE]: { name: '暗海晶石', solid: true, transparent: false, textures: [105, 105, 105], drops: BLOCK.DARK_PRISMARINE },
  [BLOCK.RED_SAND]: { name: '红沙', solid: true, transparent: false, textures: [106, 106, 106], drops: BLOCK.RED_SAND },
  [BLOCK.RED_SANDSTONE]: { name: '红砂岩', solid: true, transparent: false, textures: [107, 107, 107], drops: BLOCK.RED_SANDSTONE },
  [BLOCK.MYCELIUM]: { name: '菌丝', solid: true, transparent: false, textures: [108, 2, 108], drops: BLOCK.DIRT },
  [BLOCK.PODZOL]: { name: '灰化土', solid: true, transparent: false, textures: [109, 2, 110], drops: BLOCK.DIRT },
  [BLOCK.COARSE_DIRT]: { name: '砂土', solid: true, transparent: false, textures: [111, 111, 111], drops: BLOCK.COARSE_DIRT },
  [BLOCK.TERRACOTTA_WHITE]: { name: '白色陶瓦', solid: true, transparent: false, textures: [112, 112, 112], drops: BLOCK.TERRACOTTA_WHITE },
  [BLOCK.TERRACOTTA_ORANGE]: { name: '橙色陶瓦', solid: true, transparent: false, textures: [113, 113, 113], drops: BLOCK.TERRACOTTA_ORANGE },
  [BLOCK.TERRACOTTA_MAGENTA]: { name: '品红陶瓦', solid: true, transparent: false, textures: [114, 114, 114], drops: BLOCK.TERRACOTTA_MAGENTA },
  [BLOCK.TERRACOTTA_LIGHT_BLUE]: { name: '淡蓝陶瓦', solid: true, transparent: false, textures: [115, 115, 115], drops: BLOCK.TERRACOTTA_LIGHT_BLUE },
  [BLOCK.TERRACOTTA_YELLOW]: { name: '黄色陶瓦', solid: true, transparent: false, textures: [116, 116, 116], drops: BLOCK.TERRACOTTA_YELLOW },
  [BLOCK.TERRACOTTA_LIME]: { name: '黄绿陶瓦', solid: true, transparent: false, textures: [117, 117, 117], drops: BLOCK.TERRACOTTA_LIME },
  [BLOCK.TERRACOTTA_PINK]: { name: '粉红陶瓦', solid: true, transparent: false, textures: [118, 118, 118], drops: BLOCK.TERRACOTTA_PINK },
  [BLOCK.TERRACOTTA_GRAY]: { name: '灰色陶瓦', solid: true, transparent: false, textures: [119, 119, 119], drops: BLOCK.TERRACOTTA_GRAY },
  [BLOCK.TERRACOTTA_CYAN]: { name: '青色陶瓦', solid: true, transparent: false, textures: [120, 120, 120], drops: BLOCK.TERRACOTTA_CYAN },
  [BLOCK.TERRACOTTA_PURPLE]: { name: '紫色陶瓦', solid: true, transparent: false, textures: [121, 121, 121], drops: BLOCK.TERRACOTTA_PURPLE },
  [BLOCK.TERRACOTTA_BLUE]: { name: '蓝色陶瓦', solid: true, transparent: false, textures: [122, 122, 122], drops: BLOCK.TERRACOTTA_BLUE },
  [BLOCK.TERRACOTTA_BROWN]: { name: '棕色陶瓦', solid: true, transparent: false, textures: [123, 123, 123], drops: BLOCK.TERRACOTTA_BROWN },
  [BLOCK.TERRACOTTA_GREEN]: { name: '绿色陶瓦', solid: true, transparent: false, textures: [124, 124, 124], drops: BLOCK.TERRACOTTA_GREEN },
  [BLOCK.TERRACOTTA_RED]: { name: '红色陶瓦', solid: true, transparent: false, textures: [125, 125, 125], drops: BLOCK.TERRACOTTA_RED },
  [BLOCK.TERRACOTTA_BLACK]: { name: '黑色陶瓦', solid: true, transparent: false, textures: [126, 126, 126], drops: BLOCK.TERRACOTTA_BLACK },
  // ===== 第三批扩展方块定义 =====
  [BLOCK.SLIME_BLOCK]: { name: '粘液块', solid: true, transparent: true, textures: [127, 127, 127], drops: BLOCK.SLIME_BLOCK, bouncy: true },
  [BLOCK.NETHER_STAR]: { name: '下界之星', solid: false, transparent: true, textures: [128, 128, 128], drops: BLOCK.NETHER_STAR, lightSource: 14 },
  [BLOCK.BOOK]: { name: '书', solid: false, transparent: true, textures: [129, 129, 129], drops: BLOCK.BOOK },
  [BLOCK.PAPER]: { name: '纸', solid: false, transparent: true, textures: [130, 130, 130], drops: BLOCK.PAPER },
  [BLOCK.STICK]: { name: '木棍', solid: false, transparent: true, textures: [131, 131, 131], drops: BLOCK.STICK },
  [BLOCK.COAL_ITEM]: { name: '煤炭', solid: false, transparent: true, textures: [132, 132, 132], drops: BLOCK.COAL_ITEM },
  [BLOCK.DIAMOND_GEM]: { name: '钻石', solid: false, transparent: true, textures: [133, 133, 133], drops: BLOCK.DIAMOND_GEM },
  [BLOCK.EMERALD_GEM]: { name: '绿宝石', solid: false, transparent: true, textures: [134, 134, 134], drops: BLOCK.EMERALD_GEM },
  [BLOCK.IRON_INGOT]: { name: '铁锭', solid: false, transparent: true, textures: [135, 135, 135], drops: BLOCK.IRON_INGOT },
  [BLOCK.GOLD_INGOT]: { name: '金锭', solid: false, transparent: true, textures: [136, 136, 136], drops: BLOCK.GOLD_INGOT },
  [BLOCK.BREAD]: { name: '面包', solid: false, transparent: true, textures: [137, 137, 137], drops: BLOCK.BREAD, food: 5 },
  [BLOCK.APPLE]: { name: '苹果', solid: false, transparent: true, textures: [138, 138, 138], drops: BLOCK.APPLE, food: 4 },
  [BLOCK.BONE]: { name: '骨头', solid: false, transparent: true, textures: [139, 139, 139], drops: BLOCK.BONE },
  [BLOCK.STRING_ITEM]: { name: '线', solid: false, transparent: true, textures: [140, 140, 140], drops: BLOCK.STRING_ITEM },
  [BLOCK.GUNPOWDER]: { name: '火药', solid: false, transparent: true, textures: [141, 141, 141], drops: BLOCK.GUNPOWDER },
  [BLOCK.REDSTONE_DUST_ITEM]: { name: '红石粉', solid: false, transparent: true, textures: [142, 142, 142], drops: BLOCK.REDSTONE_DUST_ITEM },
  [BLOCK.BUCKET]: { name: '桶', solid: false, transparent: true, textures: [143, 143, 143], drops: BLOCK.BUCKET },
  [BLOCK.BOW]: { name: '弓', solid: false, transparent: true, textures: [144, 144, 144], drops: BLOCK.BOW },
  [BLOCK.ARROW]: { name: '箭矢', solid: false, transparent: true, textures: [145, 145, 145], drops: BLOCK.ARROW },
  [BLOCK.FISHING_ROD]: { name: '钓鱼竿', solid: false, transparent: true, textures: [146, 146, 146], drops: BLOCK.FISHING_ROD },
  [BLOCK.FLINT]: { name: '燧石', solid: false, transparent: true, textures: [147, 147, 147], drops: BLOCK.FLINT },
  [BLOCK.LEATHER]: { name: '皮革', solid: false, transparent: true, textures: [148, 148, 148], drops: BLOCK.LEATHER },
  [BLOCK.FEATHER]: { name: '羽毛', solid: false, transparent: true, textures: [149, 149, 149], drops: BLOCK.FEATHER },
  [BLOCK.WHEAT_ITEM]: { name: '小麦', solid: false, transparent: true, textures: [150, 150, 150], drops: BLOCK.WHEAT_ITEM },
  [BLOCK.SEEDS]: { name: '种子', solid: false, transparent: true, textures: [151, 151, 151], drops: BLOCK.SEEDS },
  // ===== 食物物品定义 =====
  [BLOCK.RAW_PORKCHOP]: { name: '生猪排', solid: false, transparent: true, textures: [153, 153, 153], drops: BLOCK.RAW_PORKCHOP, food: 3 },
  [BLOCK.RAW_BEEF]: { name: '生牛肉', solid: false, transparent: true, textures: [154, 154, 154], drops: BLOCK.RAW_BEEF, food: 3 },
  [BLOCK.RAW_CHICKEN]: { name: '生鸡肉', solid: false, transparent: true, textures: [155, 155, 155], drops: BLOCK.RAW_CHICKEN, food: 2 },
  [BLOCK.RAW_MUTTON]: { name: '生羊肉', solid: false, transparent: true, textures: [156, 156, 156], drops: BLOCK.RAW_MUTTON, food: 2 },
  [BLOCK.COOKED_PORKCHOP]: { name: '熟猪排', solid: false, transparent: true, textures: [157, 157, 157], drops: BLOCK.COOKED_PORKCHOP, food: 8 },
  [BLOCK.COOKED_BEEF]: { name: '牛排', solid: false, transparent: true, textures: [158, 158, 158], drops: BLOCK.COOKED_BEEF, food: 8 },
  [BLOCK.COOKED_CHICKEN]: { name: '熟鸡肉', solid: false, transparent: true, textures: [159, 159, 159], drops: BLOCK.COOKED_CHICKEN, food: 6 },
  [BLOCK.COOKED_MUTTON]: { name: '熟羊肉', solid: false, transparent: true, textures: [160, 160, 160], drops: BLOCK.COOKED_MUTTON, food: 6 },
};

// ===== 可放置方块列表（用于背包） =====
export const PLACEABLE_BLOCKS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND,
  BLOCK.LOG, BLOCK.PLANKS, BLOCK.COBBLESTONE, BLOCK.LEAVES,
  BLOCK.GLASS, BLOCK.BRICK, BLOCK.CRAFTING_TABLE, BLOCK.BOOKSHELF,
  BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.GOLD_ORE, BLOCK.DIAMOND_ORE,
  BLOCK.SNOW, BLOCK.WATER, BLOCK.TNT, BLOCK.OBSIDIAN,
  BLOCK.ICE, BLOCK.LAVA, BLOCK.TORCH, BLOCK.LADDER,
  BLOCK.FLOWER_RED, BLOCK.FLOWER_YELLOW, BLOCK.MUSHROOM,
  BLOCK.TALL_GRASS, BLOCK.CHEST, BLOCK.GLOWSTONE, BLOCK.SANDSTONE,
  BLOCK.CLAY, BLOCK.PUMPKIN, BLOCK.MOSS_STONE, BLOCK.REDSTONE_ORE,
  BLOCK.EMERALD_ORE, BLOCK.REDSTONE_BLOCK, BLOCK.QUARTZ, BLOCK.TERRACOTTA,
  BLOCK.PACKED_ICE, BLOCK.BLUE_ICE, BLOCK.NETHERRACK,
  // 第二批扩展方块
  BLOCK.IRON_BLOCK, BLOCK.GOLD_BLOCK, BLOCK.DIAMOND_BLOCK, BLOCK.EMERALD_BLOCK,
  BLOCK.COAL_BLOCK, BLOCK.LAPIS_ORE, BLOCK.LAPIS_BLOCK, BLOCK.END_STONE,
  BLOCK.DRAGON_EGG, BLOCK.ENCHANTING_TABLE, BLOCK.BREWING_STAND,
  BLOCK.REDSTONE_DUST, BLOCK.REDSTONE_TORCH, BLOCK.LEVER, BLOCK.STONE_BUTTON,
  BLOCK.REDSTONE_LAMP, BLOCK.PISTON, BLOCK.STONE_PRESSURE_PLATE,
  BLOCK.OAK_STAIRS, BLOCK.COBBLESTONE_STAIRS, BLOCK.STONE_SLAB, BLOCK.OAK_SLAB,
  BLOCK.OAK_FENCE, BLOCK.IRON_BARS, BLOCK.GLASS_PANE, BLOCK.SPONGE,
  BLOCK.SEA_LANTERN, BLOCK.NETHER_BRICK, BLOCK.SOUL_SAND, BLOCK.GRAVEL,
  BLOCK.CACTUS, BLOCK.VINE, BLOCK.FARMLAND, BLOCK.WHEAT_CROP,
  BLOCK.NETHER_PORTAL, BLOCK.END_PORTAL_FRAME, BLOCK.HAY_BLOCK, BLOCK.BONE_BLOCK,
  BLOCK.MAGMA, BLOCK.PURPUR_BLOCK, BLOCK.CONCRETE, BLOCK.OAK_DOOR, BLOCK.IRON_DOOR,
  BLOCK.SPRUCE_LOG, BLOCK.BIRCH_LOG, BLOCK.DARK_OAK_LOG, BLOCK.ACACIA_LOG,
  BLOCK.JUNGLE_LOG, BLOCK.STRIPPED_OAK_LOG, BLOCK.CHISELED_STONE, BLOCK.SMOOTH_STONE,
  BLOCK.MOSSY_COBBLESTONE, BLOCK.CRACKED_STONE, BLOCK.ANDESITE, BLOCK.DIORITE,
  BLOCK.GRANITE, BLOCK.PRISMARINE, BLOCK.DARK_PRISMARINE,
  BLOCK.RED_SAND, BLOCK.RED_SANDSTONE, BLOCK.MYCELIUM, BLOCK.PODZOL, BLOCK.COARSE_DIRT,
  BLOCK.TERRACOTTA_WHITE, BLOCK.TERRACOTTA_ORANGE, BLOCK.TERRACOTTA_MAGENTA,
  BLOCK.TERRACOTTA_LIGHT_BLUE, BLOCK.TERRACOTTA_YELLOW, BLOCK.TERRACOTTA_LIME,
  BLOCK.TERRACOTTA_PINK, BLOCK.TERRACOTTA_GRAY, BLOCK.TERRACOTTA_CYAN,
  BLOCK.TERRACOTTA_PURPLE, BLOCK.TERRACOTTA_BLUE, BLOCK.TERRACOTTA_BROWN,
  BLOCK.TERRACOTTA_GREEN, BLOCK.TERRACOTTA_RED, BLOCK.TERRACOTTA_BLACK,
  // 食物物品
  BLOCK.RAW_PORKCHOP, BLOCK.RAW_BEEF, BLOCK.RAW_CHICKEN, BLOCK.RAW_MUTTON,
  BLOCK.COOKED_PORKCHOP, BLOCK.COOKED_BEEF, BLOCK.COOKED_CHICKEN, BLOCK.COOKED_MUTTON,
];

// ===== 纹理图集 =====
const TILE_SIZE = 16;
const ATLAS_COLS = 16;
const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS; // 256x256

// 简单随机数（基于坐标，保证确定性）
function rand(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// 计算 tile 在图集中的像素偏移（自动换行）
function tilePx(tileIndex) {
  return {
    x: (tileIndex % ATLAS_COLS) * TILE_SIZE,
    y: Math.floor(tileIndex / ATLAS_COLS) * TILE_SIZE,
  };
}

// 在 tile 中设置像素（tx 为线性 tile 索引，ty 保持兼容）
function setPixel(ctx, tx, ty, px, py, color) {
  const ax = (tx % ATLAS_COLS) + (tx >= ATLAS_COLS ? 0 : 0);
  const realTx = tx % ATLAS_COLS;
  const realTy = ty + Math.floor(tx / ATLAS_COLS);
  ctx.fillStyle = color;
  ctx.fillRect(realTx * TILE_SIZE + px, realTy * TILE_SIZE + py, 1, 1);
}

// 填充整个 tile
function fillTile(ctx, tx, ty, color) {
  const realTx = tx % ATLAS_COLS;
  const realTy = ty + Math.floor(tx / ATLAS_COLS);
  ctx.fillStyle = color;
  ctx.fillRect(realTx * TILE_SIZE, realTy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

// 清除整个 tile 为透明
function clearTile(ctx, tx, ty) {
  const realTx = tx % ATLAS_COLS;
  const realTy = ty + Math.floor(tx / ATLAS_COLS);
  ctx.clearRect(realTx * TILE_SIZE, realTy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

// 给 tile 加噪声纹理
function noisyTile(ctx, tx, ty, baseColor, variation) {
  const realTx = tx % ATLAS_COLS;
  const realTy = ty + Math.floor(tx / ATLAS_COLS);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(realTx * 100 + x, realTy * 100 + y);
      const v = (n - 0.5) * variation;
      const c = adjustColor(baseColor, v);
      setPixel(ctx, tx, ty, x, y, c);
    }
  }
}

// 颜色调整
function adjustColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.max(0, Math.min(255, Math.round(r + amount)));
  const ng = Math.max(0, Math.min(255, Math.round(g + amount)));
  const nb = Math.max(0, Math.min(255, Math.round(b + amount)));
  return `rgb(${nr},${ng},${nb})`;
}

// 生成纹理图集
let _atlasCanvas = null;
let _atlasTexture = null;

export function generateTextureAtlas(THREE) {
  if (_atlasTexture) return _atlasTexture;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 关键：先用不透明黑色填满整个画布，防止透明像素在 mipmap 生成时混入 tile 边缘
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Tile 0: 草顶
  noisyTile(ctx, 0, 0, '#5a9c3d', 30);

  // Tile 1: 草侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let color;
      if (y < 4 + Math.floor(rand(x, 0) * 3)) {
        color = adjustColor('#5a9c3d', (rand(x, y) - 0.5) * 30);
      } else {
        color = adjustColor('#8b6240', (rand(x, y) - 0.5) * 25);
      }
      setPixel(ctx, 1, 0, x, y, color);
    }
  }

  // Tile 2: 泥土
  noisyTile(ctx, 2, 0, '#8b6240', 25);

  // Tile 3: 石头
  noisyTile(ctx, 3, 0, '#808080', 20);

  // Tile 4: 沙子
  noisyTile(ctx, 4, 0, '#e0cf8a', 15);

  // Tile 5: 原木顶（年轮）
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      let c = d < 1.5 ? '#6b4a25' : d < 3 ? '#8b6235' : d < 5 ? '#7a5530' : d < 7 ? '#8b6235' : '#6b4a25';
      c = adjustColor(c, (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 5, 0, x, y, c);
    }
  }

  // Tile 6: 原木侧（树皮纹理）
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#6b4a25';
      if (x === 0 || x === 15) c = '#5a3d1e';
      else if (rand(x, y) > 0.7) c = '#7a5530';
      else if (rand(x, y) > 0.5) c = '#6b4a25';
      c = adjustColor(c, (rand(x, y + 10) - 0.5) * 10);
      setPixel(ctx, 6, 0, x, y, c);
    }
  }

  // Tile 7: 树叶
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.7 ? '#3d7a25' : n > 0.4 ? '#4a9c2d' : n > 0.2 ? '#2d5a1a' : '#3d7a25';
      c = adjustColor(c, (rand(x, y + 5) - 0.5) * 20);
      setPixel(ctx, 7, 0, x, y, c);
    }
  }

  // Tile 8: 木板
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#a87c4a';
      if (y % 8 === 0 || y % 8 === 7) c = '#7a5530';
      if (x === 7 && (y < 8)) c = '#7a5530';
      if (x === 3 && (y >= 8)) c = '#7a5530';
      c = adjustColor(c, (rand(x, y) - 0.5) * 12);
      setPixel(ctx, 8, 0, x, y, c);
    }
  }

  // Tile 9: 圆石
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.6 ? '#6a6a6a' : n > 0.3 ? '#808080' : '#7a7a7a';
      if ((x + y) % 8 === 0 || (x - y) % 8 === 0) c = '#555';
      c = adjustColor(c, (rand(x, y + 3) - 0.5) * 15);
      setPixel(ctx, 9, 0, x, y, c);
    }
  }

  // Tile 10: 水
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = adjustColor('#2a6df0', (rand(x, y) - 0.5) * 20);
      setPixel(ctx, 10, 0, x, y, c);
    }
  }

  // Tile 11: 基岩
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.5 ? '#3a3a3a' : '#2a2a2a';
      c = adjustColor(c, (rand(x, y + 7) - 0.5) * 10);
      setPixel(ctx, 11, 0, x, y, c);
    }
  }

  // Tile 12: 煤矿石（石头+黑色斑点）
  drawOre(ctx, 12, 0, '#808080', '#1a1a1a');

  // Tile 13: 铁矿石
  drawOre(ctx, 13, 0, '#808080', '#c8a060');

  // Tile 14: 金矿石
  drawOre(ctx, 14, 0, '#808080', '#ffd700');

  // Tile 15: 钻石矿石
  drawOre(ctx, 15, 0, '#808080', '#4af0e0');

  // Tile 16: 工作台顶
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#8b6235';
      if (x < 8 && y < 8) c = '#a87c4a';
      if (x >= 8 && y < 8) c = '#6b4a25';
      if (x < 8 && y >= 8) c = '#6b4a25';
      if (x >= 8 && y >= 8) c = '#a87c4a';
      // 网格线
      if (x % 8 === 0 || y % 8 === 0) c = '#4a3015';
      c = adjustColor(c, (rand(x, y) - 0.5) * 10);
      setPixel(ctx, 16, 0, x, y, c);
    }
  }

  // Tile 17: 工作台侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#a87c4a';
      if (y < 2) c = '#5a3d1e';
      // 工具图案
      if (y >= 3 && y <= 6 && x >= 2 && x <= 5) c = '#666';
      if (y >= 8 && y <= 12 && x >= 9 && x <= 13) c = '#8b4513';
      c = adjustColor(c, (rand(x, y) - 0.5) * 10);
      setPixel(ctx, 17, 0, x, y, c);
    }
  }

  // Tile 18: 玻璃 — 使用不透明浅蓝色，透明效果由面剔除逻辑处理
  noisyTile(ctx, 18, 0, '#a0c8e0', 10);
  {
    const o = tilePx(18);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 1, o.y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }
  for (let i = 2; i < TILE_SIZE - 2; i += 4) {
    setPixel(ctx, 18, 0, i, 2, 'rgba(255,255,255,0.6)');
    setPixel(ctx, 18, 0, 2, i, 'rgba(255,255,255,0.6)');
  }

  // Tile 19: 雪顶
  noisyTile(ctx, 19, 0, '#f0f0f5', 8);

  // Tile 20: 雪侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let color;
      if (y < 3 + Math.floor(rand(x, 1) * 2)) {
        color = adjustColor('#f0f0f5', (rand(x, y) - 0.5) * 8);
      } else {
        color = adjustColor('#8b6240', (rand(x, y) - 0.5) * 20);
      }
      setPixel(ctx, 20, 0, x, y, color);
    }
  }

  // Tile 21: 砖块
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#8b4513';
      const row = Math.floor(y / 4);
      const offset = row % 2 === 0 ? 0 : 4;
      if (y % 4 === 0) c = '#5a2d0a';
      if ((x + offset) % 8 === 0) c = '#5a2d0a';
      c = adjustColor(c, (rand(x, y) - 0.5) * 8);
      setPixel(ctx, 21, 0, x, y, c);
    }
  }

  // Tile 22: 书架侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#a87c4a';
      if (y < 2 || y > 13) c = '#7a5530';
      else {
        const bookColors = ['#cc3333', '#3366cc', '#33aa33', '#cccc33', '#cc6633'];
        const bookIdx = Math.floor(x / 3) % bookColors.length;
        c = bookColors[bookIdx];
        if (x % 3 === 2) c = adjustColor(c, -30);
      }
      c = adjustColor(c, (rand(x, y) - 0.5) * 8);
      setPixel(ctx, 22, 0, x, y, c);
    }
  }

  // ===== 新增方块纹理 =====

  // Tile 23: TNT 顶面
  fillTile(ctx, 23, 0, '#cc2222');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y >= 3 && y <= 5) setPixel(ctx, 23, 0, x, y, '#ffffff');
      if (y === 4 && x >= 3 && x <= 12) {
        const letters = 'TNT';
        const idx = Math.floor((x - 3) / 3);
        if (idx < 3 && idx >= 0) setPixel(ctx, 23, 0, x, y, '#000000');
      }
      if (rand(x, y) > 0.9) setPixel(ctx, 23, 0, x, y, adjustColor('#cc2222', -20));
    }
  }

  // Tile 24: TNT 侧面
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#cc2222';
      if (y >= 7 && y <= 9) c = '#f5f5f5';
      if (y === 8 && x >= 2 && x <= 13) c = '#000000';
      c = adjustColor(c, (rand(x, y) - 0.5) * 10);
      setPixel(ctx, 24, 0, x, y, c);
    }
  }

  // Tile 25: 黑曜石
  noisyTile(ctx, 25, 0, '#1a0a2a', 25);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 10, y + 10) > 0.85) setPixel(ctx, 25, 0, x, y, '#3a1a4a');
    }
  }

  // Tile 26: 冰
  noisyTile(ctx, 26, 0, '#a0d0f0', 12);
  {
    const o = tilePx(26);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sx = Math.floor(rand(i, 0) * 12);
      const sy = Math.floor(rand(i, 1) * 12);
      ctx.beginPath();
      ctx.moveTo(o.x + sx, o.y + sy);
      ctx.lineTo(o.x + sx + 4, o.y + sy + 4);
      ctx.stroke();
    }
  }

  // Tile 27: 岩浆
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.7 ? '#ffaa00' : n > 0.4 ? '#ff6600' : '#cc3300';
      c = adjustColor(c, (rand(x, y + 5) - 0.5) * 20);
      setPixel(ctx, 27, 0, x, y, c);
    }
  }

  // Tile 28: 火把
  fillTile(ctx, 28, 0, '#000000');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (x >= 6 && x <= 9 && y >= 2 && y <= 14) setPixel(ctx, 28, 0, x, y, '#8b6235');
      if (x >= 6 && x <= 9 && y >= 0 && y <= 3) {
        const c = rand(x, y) > 0.5 ? '#ffdd00' : '#ff8800';
        setPixel(ctx, 28, 0, x, y, c);
      }
    }
  }

  // Tile 29: 梯子
  fillTile(ctx, 29, 0, '#5a3d1e');
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 29, 0, 2, y, '#8b6235');
    setPixel(ctx, 29, 0, 13, y, '#8b6235');
    if (y % 4 === 3) {
      for (let x = 2; x <= 13; x++) setPixel(ctx, 29, 0, x, y, '#8b6235');
    }
  }

  // Tile 30: 红花（透明背景）
  clearTile(ctx, 30, 0);
  // 茎
  for (let y = 8; y <= 14; y++) {
    setPixel(ctx, 30, 0, 7, y, '#3a7a25');
    setPixel(ctx, 30, 0, 8, y, '#2d5a1a');
  }
  // 叶子
  setPixel(ctx, 30, 0, 5, 11, '#4a8c2d');
  setPixel(ctx, 30, 0, 6, 12, '#4a8c2d');
  setPixel(ctx, 30, 0, 9, 12, '#4a8c2d');
  setPixel(ctx, 30, 0, 10, 11, '#4a8c2d');
  // 花瓣
  for (let y = 4; y <= 8; y++) {
    for (let x = 4; x <= 11; x++) {
      const dx = x - 7.5, dy = y - 6;
      if (dx * dx + dy * dy < 12) {
        setPixel(ctx, 30, 0, x, y, rand(x, y) > 0.5 ? '#ff2222' : '#cc1111');
      }
    }
  }
  setPixel(ctx, 30, 0, 7, 6, '#ffff00');
  setPixel(ctx, 30, 0, 8, 6, '#ffff00');

  // Tile 31: 黄花（透明背景）
  clearTile(ctx, 31, 0);
  // 茎
  for (let y = 8; y <= 14; y++) {
    setPixel(ctx, 31, 0, 7, y, '#3a7a25');
    setPixel(ctx, 31, 0, 8, y, '#2d5a1a');
  }
  // 叶子
  setPixel(ctx, 31, 0, 5, 11, '#4a8c2d');
  setPixel(ctx, 31, 0, 6, 12, '#4a8c2d');
  setPixel(ctx, 31, 0, 9, 12, '#4a8c2d');
  setPixel(ctx, 31, 0, 10, 11, '#4a8c2d');
  // 花瓣
  for (let y = 4; y <= 8; y++) {
    for (let x = 4; x <= 11; x++) {
      const dx = x - 7.5, dy = y - 6;
      if (dx * dx + dy * dy < 12) {
        setPixel(ctx, 31, 0, x, y, rand(x, y) > 0.5 ? '#ffdd00' : '#ffaa00');
      }
    }
  }
  setPixel(ctx, 31, 0, 7, 6, '#ff6600');
  setPixel(ctx, 31, 0, 8, 6, '#ff6600');

  // Tile 32: 蘑菇（透明背景）
  clearTile(ctx, 32, 0);
  // 茎
  for (let y = 10; y <= 14; y++) {
    setPixel(ctx, 32, 0, 7, y, '#f5f5f5');
    setPixel(ctx, 32, 0, 8, y, '#e0e0e0');
  }
  // 蘑菇帽
  for (let y = 6; y <= 12; y++) {
    for (let x = 5; x <= 10; x++) {
      const dx = x - 7.5, dy = y - 9;
      if (dx * dx + dy * dy < 8) {
        setPixel(ctx, 32, 0, x, y, rand(x, y) > 0.5 ? '#cc2222' : '#dd3333');
      }
    }
  }
  for (let y = 3; y <= 5; y++) {
    for (let x = 6; x <= 9; x++) {
      setPixel(ctx, 32, 0, x, y, '#f5f5f5');
    }
  }

  // Tile 33: 床顶
  fillTile(ctx, 33, 0, '#cc3333');
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 33, 0, 0, y, '#8b6235');
    setPixel(ctx, 33, 0, 15, y, '#8b6235');
    setPixel(ctx, 33, 0, y === 0 ? 0 : 15 - y, y, adjustColor('#cc3333', (rand(y, 0) - 0.5) * 15));
  }

  // Tile 34: 床侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#cc3333';
      if (y < 4) c = '#8b6235';
      c = adjustColor(c, (rand(x, y) - 0.5) * 8);
      setPixel(ctx, 34, 0, x, y, c);
    }
  }

  // Tile 35: 宝箱顶
  fillTile(ctx, 35, 0, '#8b6235');
  {
    const o = tilePx(35);
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 2, o.y + 2, 12, 12);
    for (let i = 4; i < 12; i += 3) {
      ctx.strokeRect(o.x + i, o.y + 4, 2, 8);
    }
  }

  // Tile 36: 宝箱侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#8b6235';
      if (y === 0 || y === 7 || y === 15) c = '#5a3d1e';
      if (x === 0 || x === 15) c = '#5a3d1e';
      if (y >= 6 && y <= 9 && x >= 6 && x <= 9) c = '#ffdd00';
      c = adjustColor(c, (rand(x, y) - 0.5) * 6);
      setPixel(ctx, 36, 0, x, y, c);
    }
  }

  // Tile 37: 下界岩
  noisyTile(ctx, 37, 0, '#5a1a1a', 30);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 5, y + 5) > 0.8) setPixel(ctx, 37, 0, x, y, '#2a0a0a');
    }
  }

  // Tile 38: 荧石
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.6 ? '#fff5aa' : n > 0.3 ? '#ddcc77' : '#aa9955';
      setPixel(ctx, 38, 0, x, y, c);
    }
  }

  // Tile 39: 砂岩
  noisyTile(ctx, 39, 0, '#e0d0a0', 10);
  {
    const o = tilePx(39);
    ctx.strokeStyle = '#c0b080';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 1, o.y + 1, 14, 14);
    ctx.strokeRect(o.x + 1, o.y + 5, 14, 1);
    ctx.strokeRect(o.x + 1, o.y + 10, 14, 1);
  }

  // Tile 40: 粘土
  noisyTile(ctx, 40, 0, '#a0a0b0', 8);

  // Tile 41: 南瓜顶
  fillTile(ctx, 41, 0, '#dd8800');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d > 7) setPixel(ctx, 41, 0, x, y, '#aa6600');
      if (rand(x, y) > 0.8) setPixel(ctx, 41, 0, x, y, adjustColor('#dd8800', -15));
    }
  }
  // 茎
  setPixel(ctx, 41, 0, 7, 2, '#3a5a25');
  setPixel(ctx, 41, 0, 8, 2, '#3a5a25');

  // Tile 42: 南瓜侧
  fillTile(ctx, 42, 0, '#dd8800');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#dd8800';
      c = adjustColor(c, (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 42, 0, x, y, c);
    }
  }
  // 杰克南瓜灯脸
  setPixel(ctx, 42, 0, 4, 5, '#000000'); setPixel(ctx, 42, 0, 5, 5, '#000000');
  setPixel(ctx, 42, 0, 10, 5, '#000000'); setPixel(ctx, 42, 0, 11, 5, '#000000');
  setPixel(ctx, 42, 0, 5, 10, '#000000'); setPixel(ctx, 42, 0, 6, 11, '#000000');
  setPixel(ctx, 42, 0, 7, 11, '#000000'); setPixel(ctx, 42, 0, 8, 11, '#000000');
  setPixel(ctx, 42, 0, 9, 11, '#000000'); setPixel(ctx, 42, 0, 10, 10, '#000000');

  // Tile 43: 苔石
  noisyTile(ctx, 43, 0, '#7a7a7a', 15);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 3, y + 3) > 0.6) setPixel(ctx, 43, 0, x, y, '#4a7a3a');
    }
  }

  // Tile 44: 红石矿石
  drawOre(ctx, 44, 0, '#7a7a7a', '#ff0000');

  // Tile 45: 绿宝石矿石
  drawOre(ctx, 45, 0, '#7a7a7a', '#00ff44');

  // Tile 46: 红石块
  noisyTile(ctx, 46, 0, '#aa0000', 15);

  // Tile 47: 石英块
  noisyTile(ctx, 47, 0, '#f0f0f0', 5);

  // Tile 48: 陶瓦
  noisyTile(ctx, 48, 0, '#9a6a4a', 10);

  // Tile 49: 浮冰
  noisyTile(ctx, 49, 0, '#80c0e0', 8);

  // Tile 50: 蓝冰
  noisyTile(ctx, 50, 0, '#4080d0', 8);

  // ===== 第二批扩展方块纹理 (51-126) =====

  // Tile 51: 铁块
  noisyTile(ctx, 51, 0, '#d8d8d8', 8);

  // Tile 52: 金块
  noisyTile(ctx, 52, 0, '#ffd700', 10);

  // Tile 53: 钻石块
  noisyTile(ctx, 53, 0, '#4af0e0', 8);

  // Tile 54: 绿宝石块
  noisyTile(ctx, 54, 0, '#00ff44', 8);

  // Tile 55: 煤炭块
  noisyTile(ctx, 55, 0, '#1a1a1a', 12);

  // Tile 56: 青金石矿石
  drawOre(ctx, 56, 0, '#808080', '#1a4acc');

  // Tile 57: 青金石块
  noisyTile(ctx, 57, 0, '#1a4acc', 10);

  // Tile 58: 末地石
  noisyTile(ctx, 58, 0, '#d8d8a0', 8);

  // Tile 59: 龙蛋
  fillTile(ctx, 59, 0, '#1a0a1a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x, y) > 0.5) setPixel(ctx, 59, 0, x, y, '#3a1a3a');
      if (rand(x + 10, y + 10) > 0.85) setPixel(ctx, 59, 0, x, y, '#6a3a6a');
    }
  }

  // Tile 60: 附魔台顶
  fillTile(ctx, 60, 0, '#2a1a3a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x, y) > 0.7) setPixel(ctx, 60, 0, x, y, '#4a2a5a');
      if (x >= 6 && x <= 9 && y >= 6 && y <= 9) setPixel(ctx, 60, 0, x, y, '#ffdd00');
    }
  }

  // Tile 61: 附魔台侧
  noisyTile(ctx, 61, 0, '#3a2a4a', 10);
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 61, 0, 0, y, '#1a0a2a');
    setPixel(ctx, 61, 0, 15, y, '#1a0a2a');
  }

  // Tile 62: 酿造台
  fillTile(ctx, 62, 0, '#3a2a1a');
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 62, 0, 7, y, '#8b6235');
    setPixel(ctx, 62, 0, 8, y, '#8b6235');
  }

  // Tile 63: 红石粉
  fillTile(ctx, 63, 0, '#3a0a0a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x, y) > 0.5) setPixel(ctx, 63, 0, x, y, '#ff0000');
      if (rand(x + 5, y + 5) > 0.8) setPixel(ctx, 63, 0, x, y, '#ff6666');
    }
  }

  // Tile 64: 红石火把
  fillTile(ctx, 64, 0, '#000000');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (x >= 6 && x <= 9 && y >= 4 && y <= 15) setPixel(ctx, 64, 0, x, y, '#8b6235');
      if (x >= 6 && x <= 9 && y >= 0 && y <= 4) setPixel(ctx, 64, 0, x, y, '#ff0000');
    }
  }

  // Tile 65: 拉杆
  fillTile(ctx, 65, 0, '#5a4a3a');
  setPixel(ctx, 65, 0, 7, 6, '#8b6235');
  setPixel(ctx, 65, 0, 8, 6, '#8b6235');
  setPixel(ctx, 65, 0, 7, 7, '#8b6235');
  setPixel(ctx, 65, 0, 8, 7, '#8b6235');
  setPixel(ctx, 65, 0, 7, 10, '#3a3a3a');
  setPixel(ctx, 65, 0, 8, 10, '#3a3a3a');

  // Tile 66: 石头按钮
  noisyTile(ctx, 66, 0, '#808080', 5);
  for (let y = 5; y <= 10; y++) {
    for (let x = 6; x <= 9; x++) {
      setPixel(ctx, 66, 0, x, y, '#a0a0a0');
    }
  }

  // Tile 67: 红石灯（关闭）
  noisyTile(ctx, 67, 0, '#8a6a3a', 8);

  // Tile 68: 活塞侧
  noisyTile(ctx, 68, 0, '#8b6235', 8);
  for (let y = 3; y <= 12; y++) {
    for (let x = 3; x <= 12; x++) {
      setPixel(ctx, 68, 0, x, y, '#6b4a25');
    }
  }

  // Tile 69: 压力板
  noisyTile(ctx, 69, 0, '#808080', 5);
  for (let y = 4; y <= 11; y++) {
    setPixel(ctx, 69, 0, 4, y, '#a0a0a0');
    setPixel(ctx, 69, 0, 11, y, '#a0a0a0');
  }

  // Tile 70: 海绵
  noisyTile(ctx, 70, 0, '#e0e040', 15);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 20, y + 20) > 0.7) setPixel(ctx, 70, 0, x, y, '#c0c020');
    }
  }

  // Tile 71: 海晶灯
  noisyTile(ctx, 71, 0, '#3a8a8a', 10);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x, y) > 0.6) setPixel(ctx, 71, 0, x, y, '#5aceaa');
    }
  }

  // Tile 72: 下界砖
  noisyTile(ctx, 72, 0, '#2a0a0a', 10);

  // Tile 73: 灵魂沙
  noisyTile(ctx, 73, 0, '#3a2a1a', 15);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 3, y + 3) > 0.7) setPixel(ctx, 73, 0, x, y, '#1a0a0a');
    }
  }

  // Tile 74: 沙砾
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      let c = n > 0.5 ? '#7a7a6a' : n > 0.2 ? '#6a6a5a' : '#8a8a7a';
      c = adjustColor(c, (rand(x, y + 3) - 0.5) * 15);
      setPixel(ctx, 74, 0, x, y, c);
    }
  }

  // Tile 75: 仙人掌
  noisyTile(ctx, 75, 0, '#3a8a2a', 10);

  // Tile 76: 藤蔓
  noisyTile(ctx, 76, 0, '#3a7a25', 15);

  // Tile 77: 耕地
  noisyTile(ctx, 77, 0, '#6a4a2a', 10);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y % 8 < 2) setPixel(ctx, 77, 0, x, y, '#5a3a1a');
    }
  }

  // Tile 78: 小麦作物
  fillTile(ctx, 78, 0, '#3a7a25');
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 78, 0, 7, y, '#ddaa00');
    setPixel(ctx, 78, 0, 8, y, '#ddaa00');
  }

  // Tile 79: 下界传送门
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 79, 0, x, y, n > 0.5 ? '#4a0a8a' : '#2a0a5a');
    }
  }

  // Tile 80: 末地传送门框架
  noisyTile(ctx, 80, 0, '#3a3a1a', 8);
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      setPixel(ctx, 80, 0, x, y, '#1a1a0a');
    }
  }

  // Tile 81: 干草块
  noisyTile(ctx, 81, 0, '#ddcc33', 10);
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 81, 0, 0, y, '#bbaa22');
    setPixel(ctx, 81, 0, 15, y, '#bbaa22');
    if (y % 4 === 0) {
      for (let x = 0; x < TILE_SIZE; x++) setPixel(ctx, 81, 0, x, y, '#bbaa22');
    }
  }

  // Tile 82: 骨块
  noisyTile(ctx, 82, 0, '#f5f5e0', 5);

  // Tile 83: 岩浆块
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 83, 0, x, y, n > 0.5 ? '#aa3300' : n > 0.2 ? '#cc5500' : '#882200');
    }
  }

  // Tile 84: 紫珀块
  noisyTile(ctx, 84, 0, '#8a5a8a', 8);

  // Tile 85: 混凝土
  noisyTile(ctx, 85, 0, '#9a9a9a', 5);

  // Tiles 86-97: 各类原木
  // 86: 云杉原木顶
  noisyTile(ctx, 86, 0, '#3a2a1a', 10);
  // 87: 云杉原木侧
  noisyTile(ctx, 87, 0, '#4a3a2a', 8);
  // 88: 白桦原木顶
  noisyTile(ctx, 88, 0, '#e0e0d0', 5);
  // 89: 白桦原木侧
  noisyTile(ctx, 89, 0, '#d0d0c0', 5);
  // 90: 深色橡木顶
  noisyTile(ctx, 90, 0, '#2a1a0a', 10);
  // 91: 深色橡木侧
  noisyTile(ctx, 91, 0, '#3a2a1a', 8);
  // 92: 金合欢原木顶
  noisyTile(ctx, 92, 0, '#6a4a2a', 10);
  // 93: 金合欢原木侧
  noisyTile(ctx, 93, 0, '#7a5a3a', 8);
  // 94: 丛林原木顶
  noisyTile(ctx, 94, 0, '#5a4a2a', 10);
  // 95: 丛林原木侧
  noisyTile(ctx, 95, 0, '#6a5a3a', 8);
  // 96: 去皮橡木顶
  noisyTile(ctx, 96, 0, '#a87c4a', 8);
  // 97: 去皮橡木侧
  noisyTile(ctx, 97, 0, '#b88c5a', 6);

  // Tile 98: 錾制石头
  noisyTile(ctx, 98, 0, '#808080', 10);
  for (let y = 3; y <= 6; y++) {
    for (let x = 3; x <= 6; x++) setPixel(ctx, 98, 0, x, y, '#707070');
  }
  for (let y = 9; y <= 12; y++) {
    for (let x = 9; x <= 12; x++) setPixel(ctx, 98, 0, x, y, '#707070');
  }

  // Tile 99: 平滑石头
  noisyTile(ctx, 99, 0, '#909090', 5);

  // Tile 100: 裂纹石头
  noisyTile(ctx, 100, 0, '#808080', 15);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rand(i, 0) * 14) + 1;
    const y = Math.floor(rand(i, 1) * 14) + 1;
    setPixel(ctx, 100, 0, x, y, '#5a5a5a');
    setPixel(ctx, 100, 0, x + 1, y, '#6a6a6a');
  }

  // Tile 101: 安山岩
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 101, 0, x, y, n > 0.5 ? '#9a9a9a' : n > 0.2 ? '#8a8a8a' : '#aaaaaa');
    }
  }

  // Tile 102: 闪长岩
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 102, 0, x, y, n > 0.5 ? '#d0d0c0' : n > 0.2 ? '#c0c0b0' : '#e0e0d0');
    }
  }

  // Tile 103: 花岗岩
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 103, 0, x, y, n > 0.5 ? '#c08060' : n > 0.2 ? '#b07050' : '#d09070');
    }
  }

  // Tile 104: 海晶石
  noisyTile(ctx, 104, 0, '#3a8a8a', 12);
  // Tile 105: 暗海晶石
  noisyTile(ctx, 105, 0, '#2a5a5a', 10);
  // Tile 106: 红沙
  noisyTile(ctx, 106, 0, '#c06030', 10);
  // Tile 107: 红砂岩
  noisyTile(ctx, 107, 0, '#b05020', 8);
  // Tile 108: 菌丝顶
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = rand(x, y);
      setPixel(ctx, 108, 0, x, y, n > 0.5 ? '#6a4a7a' : n > 0.2 ? '#5a3a6a' : '#7a5a8a');
    }
  }
  // Tile 109: 灰化土顶
  noisyTile(ctx, 109, 0, '#5a4a2a', 10);
  // Tile 110: 灰化土侧
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y < 3 + Math.floor(rand(x, 1) * 2)) {
        setPixel(ctx, 110, 0, x, y, adjustColor('#6a4a2a', (rand(x, y) - 0.5) * 10));
      } else {
        setPixel(ctx, 110, 0, x, y, adjustColor('#8b6240', (rand(x, y) - 0.5) * 20));
      }
    }
  }
  // Tile 111: 砂土
  noisyTile(ctx, 111, 0, '#9a7a4a', 10);

  // Tiles 112-126: 16色陶瓦
  const terracottaColors = [
    '#f0f0f0', '#e08030', '#c040a0', '#40a0e0',
    '#e0e040', '#40e040', '#e080a0', '#505050',
    '#40a0a0', '#8040c0', '#4040e0', '#604020',
    '#40a040', '#e04040', '#202020'
  ];
  for (let i = 0; i < terracottaColors.length; i++) {
    noisyTile(ctx, 112 + i, 0, terracottaColors[i], 8);
  }

  // ===== 第三批扩展方块纹理 (127-151) =====
  // Tile 127: 粘液块
  noisyTile(ctx, 127, 0, '#55aa33', 15);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 20, y + 20) > 0.6) setPixel(ctx, 127, 0, x, y, '#77cc55');
      if (rand(x + 40, y + 40) > 0.85) setPixel(ctx, 127, 0, x, y, '#3a8a22');
    }
  }

  // Tile 128: 下界之星
  fillTile(ctx, 128, 0, '#0a0a0a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < 2) setPixel(ctx, 128, 0, x, y, '#ffffff');
      else if (d < 4) setPixel(ctx, 128, 0, x, y, '#aaccff');
      else if (d < 6) setPixel(ctx, 128, 0, x, y, '#4466aa');
      else if (rand(x, y) > 0.7) setPixel(ctx, 128, 0, x, y, '#1a1a3a');
    }
  }

  // Tile 129: 书
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = '#aa6633';
      if (y < 2 || y > 13) c = '#8b4513';
      if (y >= 2 && y <= 13) {
        const bookColors = ['#cc3333', '#3366cc', '#33aa33', '#cccc33'];
        c = bookColors[Math.floor(x / 4) % bookColors.length];
        if (x % 4 === 3) c = adjustColor(c, -40);
      }
      setPixel(ctx, 129, 0, x, y, c);
    }
  }

  // Tile 130: 纸
  noisyTile(ctx, 130, 0, '#f5f5e0', 3);
  for (let y = 0; y < TILE_SIZE; y++) {
    setPixel(ctx, 130, 0, 0, y, '#e0e0cc');
    setPixel(ctx, 130, 0, 15, y, '#e0e0cc');
  }

  // Tile 131: 木棍
  fillTile(ctx, 131, 0, '#000000');
  for (let y = 4; y <= 12; y++) {
    for (let x = 6; x <= 9; x++) {
      setPixel(ctx, 131, 0, x, y, y % 2 === 0 ? '#a87c4a' : '#8b6235');
    }
  }

  // Tile 132: 煤炭
  noisyTile(ctx, 132, 0, '#1a1a1a', 10);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand(x + 5, y + 5) > 0.7) setPixel(ctx, 132, 0, x, y, '#333333');
    }
  }

  // Tile 133: 钻石（宝石）
  fillTile(ctx, 133, 0, '#0a3a4a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < 3) setPixel(ctx, 133, 0, x, y, '#4af0e0');
      else if (d < 5) setPixel(ctx, 133, 0, x, y, '#2accc0');
      else if (d < 7) setPixel(ctx, 133, 0, x, y, '#1a8898');
    }
  }

  // Tile 134: 绿宝石（宝石）
  fillTile(ctx, 134, 0, '#0a3a1a');
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < 3) setPixel(ctx, 134, 0, x, y, '#00ff44');
      else if (d < 5) setPixel(ctx, 134, 0, x, y, '#00cc33');
      else if (d < 7) setPixel(ctx, 134, 0, x, y, '#008822');
    }
  }

  // Tile 135: 铁锭
  noisyTile(ctx, 135, 0, '#d8d8d8', 6);
  for (let y = 4; y <= 11; y++) {
    for (let x = 3; x <= 12; x++) {
      setPixel(ctx, 135, 0, x, y, '#cccccc');
      if (y === 4 || y === 11 || x === 3 || x === 12) setPixel(ctx, 135, 0, x, y, '#aaaaaa');
    }
  }

  // Tile 136: 金锭
  noisyTile(ctx, 136, 0, '#ffd700', 6);
  for (let y = 4; y <= 11; y++) {
    for (let x = 3; x <= 12; x++) {
      setPixel(ctx, 136, 0, x, y, '#ffdd00');
      if (y === 4 || y === 11 || x === 3 || x === 12) setPixel(ctx, 136, 0, x, y, '#ddbb00');
    }
  }

  // Tile 137: 面包
  fillTile(ctx, 137, 0, '#000000');
  for (let y = 5; y <= 11; y++) {
    for (let x = 3; x <= 12; x++) {
      const c = adjustColor('#ddaa44', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 137, 0, x, y, c);
    }
  }
  setPixel(ctx, 137, 0, 5, 4, '#ddaa44');
  setPixel(ctx, 137, 0, 8, 4, '#ddaa44');
  setPixel(ctx, 137, 0, 11, 4, '#ddaa44');

  // Tile 138: 苹果
  fillTile(ctx, 138, 0, '#000000');
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < 4) setPixel(ctx, 138, 0, x, y, rand(x, y) > 0.5 ? '#dd2222' : '#cc1111');
    }
  }
  setPixel(ctx, 138, 0, 7, 3, '#3a5a25');
  setPixel(ctx, 138, 0, 8, 3, '#3a5a25');

  // Tile 139: 骨头
  fillTile(ctx, 139, 0, '#000000');
  for (let y = 6; y <= 9; y++) {
    for (let x = 3; x <= 12; x++) {
      setPixel(ctx, 139, 0, x, y, '#f5f5e0');
    }
  }
  for (let y = 4; y <= 11; y++) {
    setPixel(ctx, 139, 0, 3, y, '#f5f5e0');
    setPixel(ctx, 139, 0, 4, y, '#f5f5e0');
    setPixel(ctx, 139, 0, 11, y, '#f5f5e0');
    setPixel(ctx, 139, 0, 12, y, '#f5f5e0');
  }

  // Tile 140: 线
  fillTile(ctx, 140, 0, '#000000');
  for (let y = 5; y <= 10; y++) {
    for (let x = 3; x <= 12; x++) {
      if (rand(x, y) > 0.3) setPixel(ctx, 140, 0, x, y, '#eeeeee');
    }
  }

  // Tile 141: 火药
  fillTile(ctx, 141, 0, '#000000');
  for (let y = 5; y <= 10; y++) {
    for (let x = 4; x <= 11; x++) {
      const n = rand(x, y);
      setPixel(ctx, 141, 0, x, y, n > 0.5 ? '#444444' : '#333333');
      if (n > 0.8) setPixel(ctx, 141, 0, x, y, '#555555');
    }
  }

  // Tile 142: 红石粉（物品）
  fillTile(ctx, 142, 0, '#3a0a0a');
  for (let y = 5; y <= 10; y++) {
    for (let x = 4; x <= 11; x++) {
      if (rand(x, y) > 0.4) setPixel(ctx, 142, 0, x, y, '#ff0000');
      if (rand(x + 5, y + 5) > 0.7) setPixel(ctx, 142, 0, x, y, '#ff6666');
    }
  }

  // Tile 143: 桶
  fillTile(ctx, 143, 0, '#000000');
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      let c = '#888888';
      if (x === 4 || x === 11 || y === 4 || y === 11) c = '#666666';
      setPixel(ctx, 143, 0, x, y, c);
    }
  }
  setPixel(ctx, 143, 0, 7, 3, '#666666');
  setPixel(ctx, 143, 0, 8, 3, '#666666');

  // Tile 144: 弓
  fillTile(ctx, 144, 0, '#000000');
  for (let y = 3; y <= 12; y++) {
    const bend = Math.abs(y - 7.5);
    setPixel(ctx, 144, 0, 3 + Math.floor(bend * 0.5), y, '#8b6235');
    setPixel(ctx, 144, 0, 12 - Math.floor(bend * 0.5), y, '#8b6235');
  }
  for (let y = 3; y <= 12; y++) {
    setPixel(ctx, 144, 0, 7, y, '#eeeeee');
  }

  // Tile 145: 箭矢
  fillTile(ctx, 145, 0, '#000000');
  for (let x = 3; x <= 13; x++) {
    setPixel(ctx, 145, 0, x, 7, '#8b6235');
    setPixel(ctx, 145, 0, x, 8, '#8b6235');
  }
  for (let i = 0; i < 3; i++) {
    setPixel(ctx, 145, 0, 3 + i, 6, '#eeeeee');
    setPixel(ctx, 145, 0, 3 + i, 9, '#eeeeee');
  }
  setPixel(ctx, 145, 0, 13, 7, '#888888');
  setPixel(ctx, 145, 0, 13, 8, '#888888');

  // Tile 146: 钓鱼竿
  fillTile(ctx, 146, 0, '#000000');
  for (let y = 3; y <= 12; y++) {
    setPixel(ctx, 146, 0, 4 + Math.floor((12 - y) * 0.6), y, '#8b6235');
  }
  for (let x = 4; x <= 12; x++) {
    setPixel(ctx, 146, 0, x, 12 - Math.floor((x - 4) * 0.6), '#eeeeee');
  }

  // Tile 147: 燧石
  noisyTile(ctx, 147, 0, '#3a3a3a', 10);
  for (let y = 5; y <= 10; y++) {
    for (let x = 5; x <= 10; x++) {
      if (rand(x, y) > 0.5) setPixel(ctx, 147, 0, x, y, '#4a4a4a');
    }
  }

  // Tile 148: 皮革
  noisyTile(ctx, 148, 0, '#8b4513', 10);
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      if (rand(x + 10, y + 10) > 0.7) setPixel(ctx, 148, 0, x, y, '#6b3410');
    }
  }

  // Tile 149: 羽毛
  fillTile(ctx, 149, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 6; x <= 9; x++) {
      if (rand(x, y) > 0.3) setPixel(ctx, 149, 0, x, y, '#ffffff');
    }
  }
  for (let y = 3; y <= 13; y++) {
    setPixel(ctx, 149, 0, 7, y, '#eeeeee');
    setPixel(ctx, 149, 0, 8, y, '#eeeeee');
  }

  // Tile 150: 小麦（物品）
  fillTile(ctx, 150, 0, '#000000');
  for (let y = 4; y <= 12; y++) {
    setPixel(ctx, 150, 0, 7, y, '#ddaa44');
    setPixel(ctx, 150, 0, 8, y, '#ddaa44');
    if (y >= 6 && y <= 10) {
      setPixel(ctx, 150, 0, 6, y, '#ccaa22');
      setPixel(ctx, 150, 0, 9, y, '#ccaa22');
    }
  }

  // Tile 151: 种子
  fillTile(ctx, 151, 0, '#000000');
  for (let y = 6; y <= 9; y++) {
    for (let x = 6; x <= 9; x++) {
      const cx = 7.5, cy = 7.5;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < 2) setPixel(ctx, 151, 0, x, y, '#8b6235');
      if (d < 1) setPixel(ctx, 151, 0, x, y, '#a87c4a');
    }
  }

  // Tile 152: 草丛 (Tall Grass)（透明背景）
  clearTile(ctx, 152, 0);
  for (let y = 2; y <= 14; y++) {
    for (let x = 3; x <= 12; x++) {
      const n = rand(x, y);
      if (n > 0.3) {
        let c = n > 0.7 ? '#5a9c3d' : n > 0.5 ? '#4a8c2d' : '#3a7a25';
        c = adjustColor(c, (rand(x, y + 5) - 0.5) * 15);
        setPixel(ctx, 152, 0, x, y, c);
      }
    }
  }
  // taller blades
  for (let x = 4; x <= 11; x += 2) {
    for (let y = 2; y <= 14; y++) {
      if (rand(x + 20, y) > 0.4) {
        setPixel(ctx, 152, 0, x, y, adjustColor('#6aac4d', (rand(x, y) - 0.5) * 20));
      }
    }
  }

  // Tile 153: 生猪排
  fillTile(ctx, 153, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#d4886a', (rand(x, y) - 0.5) * 25);
      if (y < 5 || y > 12) c = adjustColor('#b0604a', (rand(x, y) - 0.5) * 15);
      if ((x === 3 || x === 13) && (y < 5 || y > 12)) c = '#f5f5dc';
      setPixel(ctx, 153, 0, x, y, c);
    }
  }

  // Tile 154: 生牛肉
  fillTile(ctx, 154, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#c41e3a', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 11) c = adjustColor('#f5f5dc', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 154, 0, x, y, c);
    }
  }

  // Tile 155: 生鸡肉
  fillTile(ctx, 155, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#f5c6c6', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 11) c = adjustColor('#e8b0b0', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 155, 0, x, y, c);
    }
  }

  // Tile 156: 生羊肉
  fillTile(ctx, 156, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#d4607a', (rand(x, y) - 0.5) * 25);
      if (y < 5 || y > 12) c = adjustColor('#f5f5dc', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 156, 0, x, y, c);
    }
  }

  // Tile 157: 熟猪排
  fillTile(ctx, 157, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#8b4513', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 12) c = adjustColor('#6b3a0a', (rand(x, y) - 0.5) * 15);
      if ((x === 3 || x === 13) && (y < 5 || y > 12)) c = '#daa520';
      setPixel(ctx, 157, 0, x, y, c);
    }
  }

  // Tile 158: 牛排
  fillTile(ctx, 158, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#6b2d0a', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 11) c = adjustColor('#8b4513', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 158, 0, x, y, c);
    }
  }

  // Tile 159: 熟鸡肉
  fillTile(ctx, 159, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#d4a574', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 11) c = adjustColor('#c4955a', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 159, 0, x, y, c);
    }
  }

  // Tile 160: 熟羊肉
  fillTile(ctx, 160, 0, '#000000');
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      let c = adjustColor('#8b3a1a', (rand(x, y) - 0.5) * 20);
      if (y < 5 || y > 12) c = adjustColor('#a0522d', (rand(x, y) - 0.5) * 15);
      setPixel(ctx, 160, 0, x, y, c);
    }
  }

  _atlasCanvas = canvas;

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  // 关键：纹理图集禁用 mipmap，使用 NearestFilter 防止相邻 tile 在 mipmap 降采样时互相渗透
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  _atlasTexture = texture;
  return texture;
}

// 绘制矿石纹理
function drawOre(ctx, tx, ty, baseColor, oreColor) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let c = adjustColor(baseColor, (rand(x, y) - 0.5) * 15);
      setPixel(ctx, tx, ty, x, y, c);
    }
  }
  // 矿石斑点
  const spots = [
    [3, 3], [4, 3], [3, 4],
    [9, 5], [10, 5], [10, 6],
    [6, 9], [7, 9], [6, 10],
    [11, 11], [12, 11], [11, 12],
    [2, 12], [3, 12],
  ];
  for (const [sx, sy] of spots) {
    if (rand(sx, sy) > 0.3) {
      setPixel(ctx, tx, ty, sx, sy, adjustColor(oreColor, (rand(sx, sy) - 0.5) * 20));
    }
  }
}

// 获取某个方块面的 UV 坐标
export function getFaceUV(blockId, faceIndex) {
  // faceIndex: 0=top, 1=bottom, 2=side
  const def = BLOCK_DEFS[blockId];
  if (!def || !def.textures) return null;
  const tileIndex = def.textures[faceIndex];
  const col = tileIndex % ATLAS_COLS;
  const row = Math.floor(tileIndex / ATLAS_COLS);
  const tileSize = 1 / ATLAS_COLS;
  // 添加一点 padding 防止纹理渗透
  const pad = 0.001;
  return {
    u0: col * tileSize + pad,
    v0: 1 - (row + 1) * tileSize + pad,
    u1: (col + 1) * tileSize - pad,
    v1: 1 - row * tileSize - pad,
  };
}

// 生成方块图标（用于UI显示）
export function generateBlockIcon(blockId, size = 36) {
  const def = BLOCK_DEFS[blockId];
  if (!def || !def.textures) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (_atlasCanvas) {
    const tileIndex = def.textures[2] !== undefined ? def.textures[2] : def.textures[0];
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    ctx.drawImage(
      _atlasCanvas,
      col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      0, 0, size, size
    );
  }
  return canvas.toDataURL();
}

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 24;
