/**
 * gamemodes.js — 游戏模式系统
 * 模式：生存(SURVIVAL) / 创造(CREATIVE) / 极限(HARDCORE) / 旁观(SPECTATOR) / 空岛(SKYBLOCK) / 体验(EXPERIENCE)
 */

export const GAMEMODE = {
  SURVIVAL: 0,
  CREATIVE: 1,
  HARDCORE: 2,
  SPECTATOR: 3,
  SKYBLOCK: 4,
  EXPERIENCE: 5,
  ADVENTURE: 6,
};

export const GAMEMODE_NAMES = {
  [GAMEMODE.SURVIVAL]: '生存模式',
  [GAMEMODE.CREATIVE]: '创造模式',
  [GAMEMODE.HARDCORE]: '极限模式',
  [GAMEMODE.SPECTATOR]: '旁观模式',
  [GAMEMODE.SKYBLOCK]: '空岛模式',
  [GAMEMODE.EXPERIENCE]: '体验模式',
  [GAMEMODE.ADVENTURE]: '冒险模式',
};

export const GAMEMODE_ICONS = {
  [GAMEMODE.SURVIVAL]: '⚔️',
  [GAMEMODE.CREATIVE]: '🎨',
  [GAMEMODE.HARDCORE]: '💀',
  [GAMEMODE.SPECTATOR]: '👁️',
  [GAMEMODE.SKYBLOCK]: '🏝️',
  [GAMEMODE.EXPERIENCE]: '🎁',
  [GAMEMODE.ADVENTURE]: '🏰',
};

// 各模式的配置
export const GAMEMODE_CONFIG = {
  [GAMEMODE.SURVIVAL]: {
    canFly: false,
    canTakeDamage: true,
    canBreakInstantly: false,
    infiniteBlocks: false,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: true,
    hungerEnabled: true,
    keepInventory: false,
    mobSpawning: true,
    deathAction: 'respawn',
  },
  [GAMEMODE.CREATIVE]: {
    canFly: true,
    canTakeDamage: false,
    canBreakInstantly: true,
    infiniteBlocks: true,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: true,
    hungerEnabled: false,
    keepInventory: true,
    mobSpawning: false,
    deathAction: 'none',
  },
  [GAMEMODE.HARDCORE]: {
    canFly: false,
    canTakeDamage: true,
    canBreakInstantly: false,
    infiniteBlocks: false,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: false,
    hungerEnabled: true,
    keepInventory: false,
    mobSpawning: true,
    mobMultiplier: 2.0, // 怪物更强
    deathAction: 'spectator', // 死亡后变旁观
  },
  [GAMEMODE.SPECTATOR]: {
    canFly: true,
    canTakeDamage: false,
    canBreakInstantly: false,
    infiniteBlocks: false,
    canPlaceBlocks: false,
    canInteract: false,
    healthRegen: true,
    hungerEnabled: false,
    keepInventory: true,
    mobSpawning: true,
    noclip: true, // 穿墙
    invisible: true,
    deathAction: 'none',
  },
  [GAMEMODE.SKYBLOCK]: {
    canFly: false,
    canTakeDamage: true,
    canBreakInstantly: false,
    infiniteBlocks: false,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: true,
    hungerEnabled: true,
    keepInventory: false,
    mobSpawning: false,
    deathAction: 'respawn',
    skyblockWorld: true,
  },
  [GAMEMODE.EXPERIENCE]: {
    canFly: true,
    canTakeDamage: false,
    canBreakInstantly: true,
    infiniteBlocks: true,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: true,
    hungerEnabled: false,
    keepInventory: true,
    mobSpawning: true,
    deathAction: 'none',
    experienceMode: true, // 体验模式：免合成直接使用所有可合成物品
  },
  [GAMEMODE.ADVENTURE]: {
    name: '冒险模式',
    canFly: false,
    canTakeDamage: true,
    mobSpawning: false,          // 冒险模式接管自己的刷怪
    deathAction: 'adventure_respawn',
    canBreakInstantly: false,
    canPlaceBlocks: true,
    canInteract: true,
    healthRegen: true,
    hungerEnabled: false,
    keepInventory: true,
    infiniteBlocks: false,
    noclip: false,
    experienceMode: false,
  },
};

// 生成空岛世界的小岛
export function generateSkyblockIsland(world) {
  const cx = 0, cz = 0;
  const islandY = 40;
  const radius = 5;

  // 草+泥土+石头基座
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const dist = Math.sqrt(x * x + z * z);
      if (dist > radius) continue;
      // 底层石头
      for (let y = islandY; y < islandY + 2; y++) {
        world.setBlock(cx + x, y, cz + z, 3, false); // STONE
      }
      // 泥土层
      for (let y = islandY + 2; y < islandY + 4; y++) {
        world.setBlock(cx + x, y, cz + z, 2, false); // DIRT
      }
      // 草顶层
      world.setBlock(cx + x, islandY + 4, cz + z, 1, false); // GRASS
    }
  }

  // 树
  const treeX = cx + 2, treeZ = cz - 1;
  for (let y = islandY + 5; y < islandY + 9; y++) {
    world.setBlock(treeX, y, treeZ, 5, false); // LOG
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          const lx = treeX + dx, ly = islandY + 8 + dy, lz = treeZ + dz;
          if (world.getBlock(lx, ly, lz) === 0) {
            world.setBlock(lx, ly, lz, 6, false); // LEAVES
          }
        }
      }
    }
  }

  // 标记区块为已生成
  const chunk = world.getChunk(cx, cz);
  if (chunk) {
    chunk.dirty = true;
    chunk.generated = true;
  }
}

// 创造模式物品栏
export function getCreativeInventory() {
  const items = [];
  // 所有方块各一组
  for (let i = 1; i <= 19; i++) {
    items.push({ id: i, count: 64 });
  }
  return items;
}
