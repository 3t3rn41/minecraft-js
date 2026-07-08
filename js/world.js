/**
 * world.js — 世界管理 + 程序化地形生成
 * 包含：高度图、生物群系、洞穴、树木、矿石分布
 */

import { Chunk } from './chunk.js';
import { PerlinNoise } from './noise.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, BLOCK, BLOCK_DEFS } from './blocks.js';

// 生物群系类型
const BIOME = {
  PLAINS: 0,
  FOREST: 1,
  DESERT: 2,
  MOUNTAINS: 3,
  SNOW: 4,
  OCEAN: 5,
  BEACH: 6,
};

export class World {
  constructor(seed = Date.now()) {
    this.seed = seed;
    this.chunks = new Map();
    this.noiseHeight = new PerlinNoise(seed);
    this.noiseBiome = new PerlinNoise(seed + 1000);
    this.noiseCave = new PerlinNoise(seed + 2000);
    this.noiseTree = new PerlinNoise(seed + 3000);
    this.noiseOre = new PerlinNoise(seed + 4000);
    this.modifiedBlocks = new Map(); // 存储玩家修改的方块 key -> blockId
    this.waterUpdateQueue = []; // 水流动更新队列
    this.waterProcessing = new Set(); // 防止重复处理
  }

  // ===== 确定性哈希随机 =====
  // 基于世界种子 + 坐标的确定性伪随机数生成器
  // 确保相同种子 + 相同坐标 = 相同结果（跨客户端一致）
  _hashRandom(x, y, z, salt = 0) {
    let h = ((this.seed | 0) + salt) | 0;
    h = Math.imul(h ^ (x | 0), 2654435761);
    h = Math.imul(h ^ (y | 0), 2246822519);
    h = Math.imul(h ^ (z | 0), 3266489917);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296; // 返回 0..1
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  // 获取或生成区块
  getChunk(cx, cz, generate = true) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk && generate) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
      this.generateChunk(chunk);
    }
    return chunk;
  }

  // 获取方块（世界坐标）
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return 0;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.getBlock(lx, y, lz);
  }

  // 设置方块（世界坐标）
  setBlock(x, y, z, blockId, recordModification = true) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    const result = chunk.setBlock(lx, y, lz, blockId);

    if (recordModification) {
      this.modifiedBlocks.set(`${x},${y},${z}`, blockId);
    }

    // 标记邻居区块为脏（如果方块在边界）
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    // 如果是水方块，加入水流更新队列
    if (blockId === BLOCK.WATER) {
      this.queueWaterUpdate(x, y, z);
    }
    // 如果方块被移除/替换，检查上方和周围的水是否需要流动
    this.queueWaterUpdate(x, y + 1, z);
    this.queueWaterUpdate(x - 1, y, z);
    this.queueWaterUpdate(x + 1, y, z);
    this.queueWaterUpdate(x, y, z - 1);
    this.queueWaterUpdate(x, y, z + 1);

    return result;
  }

  // 将位置加入水流动更新队列
  queueWaterUpdate(x, y, z) {
    const key = `${x},${y},${z}`;
    if (!this.waterProcessing.has(key)) {
      this.waterProcessing.add(key);
      this.waterUpdateQueue.push({ x, y, z });
    }
  }

  // 水流动处理 — 每帧处理有限数量
  updateWaterFlow(maxPerTick = 30) {
    let processed = 0;
    while (this.waterUpdateQueue.length > 0 && processed < maxPerTick) {
      const { x, y, z } = this.waterUpdateQueue.shift();
      this.waterProcessing.delete(`${x},${y},${z}`);
      const block = this.getBlock(x, y, z);
      if (block !== BLOCK.WATER) continue;

      const below = this.getBlock(x, y - 1, z);
      // 1. 如果下方是空气，水向下流
      if (below === BLOCK.AIR) {
        this.setBlock(x, y, z, BLOCK.AIR, false);
        this.setBlock(x, y - 1, z, BLOCK.WATER, false);
        this.queueWaterUpdate(x, y - 1, z);
        // 周围的水可能需要补充
        this.queueWaterUpdate(x + 1, y, z);
        this.queueWaterUpdate(x - 1, y, z);
        this.queueWaterUpdate(x, y, z + 1);
        this.queueWaterUpdate(x, y, z - 1);
        processed++;
        continue;
      }

      // 2. 如果下方是固体，水平扩散
      if (BLOCK_DEFS[below]?.solid) {
        const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of sides) {
          const nx = x + dx;
          const nz = z + dz;
          const adjacent = this.getBlock(nx, y, nz);
          const adjacentBelow = this.getBlock(nx, y - 1, nz);
          // 只往下方为空气的方向扩散（防止无限水平扩散，形成自然流动）
          if (adjacent === BLOCK.AIR && adjacentBelow === BLOCK.AIR) {
            this.setBlock(nx, y, nz, BLOCK.WATER, false);
            this.queueWaterUpdate(nx, y, nz);
          }
        }
      }
      processed++;
    }
  }

  markChunkDirty(cx, cz) {
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  // ===== 程序化地形生成 =====
  generateChunk(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = ox + lx;
        const wz = oz + lz;

        // 获取生物群系
        const biome = this.getBiome(wx, wz);
        // 获取高度
        const height = this.getHeight(wx, wz, biome);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let block = BLOCK.AIR;

          if (y === 0) {
            block = BLOCK.BEDROCK;
          } else if (y < height - 4) {
            block = BLOCK.STONE;
            // 矿石生成
            block = this.maybeOre(wx, y, wz, block);
          } else if (y < height - 1) {
            block = biome === BIOME.DESERT ? BLOCK.SAND : BLOCK.DIRT;
          } else if (y < height) {
            // 地表方块
            if (biome === BIOME.DESERT || biome === BIOME.BEACH) {
              block = BLOCK.SAND;
            } else if (biome === BIOME.SNOW) {
              block = BLOCK.SNOW;
            } else if (biome === BIOME.OCEAN) {
              block = BLOCK.SAND; // 海底沙子
            } else {
              block = BLOCK.GRASS;
            }
          }

          // 水填充
          if (block === BLOCK.AIR && y <= WATER_LEVEL) {
            block = BLOCK.WATER;
          }

          // 洞穴生成
          if (block !== BLOCK.AIR && block !== BLOCK.WATER && block !== BLOCK.BEDROCK) {
            if (this.isCave(wx, y, wz)) {
              block = BLOCK.AIR;
            }
          }

          chunk.blocks[chunk.index(lx, y, lz)] = block;
        }

        // 树木和植被生成
        if (biome !== BIOME.DESERT && biome !== BIOME.OCEAN && biome !== BIOME.BEACH && height > WATER_LEVEL) {
          const surfaceBlock = chunk.blocks[chunk.index(lx, height - 1, lz)];
          if (surfaceBlock === BLOCK.GRASS || surfaceBlock === BLOCK.SNOW) {
            this.maybeTree(chunk, lx, height, lz, biome);
          }
          // 植被生成（草丛、花、蘑菇）
          if (surfaceBlock === BLOCK.GRASS) {
            this.maybeVegetation(chunk, lx, height, lz);
          }
        }

        // 水生植物生成（海草、海带）
        this.maybeWaterPlant(chunk, lx, lz, height, biome);
      }
    }

    // 应用玩家修改
    this.applyModifications(chunk);

    chunk.generated = true;
    chunk.dirty = true;
  }

  // 水生植物生成
  maybeWaterPlant(chunk, lx, lz, height, biome) {
    // 只在水域底部生成（height <= WATER_LEVEL 表示地表在水下）
    if (height > WATER_LEVEL) return;
    if (height < 2) return;

    const surfaceIdx = chunk.index(lx, height - 1, lz);
    const surfaceBlock = chunk.blocks[surfaceIdx];

    // 只在沙子或泥土上生成
    if (surfaceBlock !== BLOCK.SAND && surfaceBlock !== BLOCK.DIRT && surfaceBlock !== BLOCK.GRASS) return;

    // 确保上方是水
    const aboveBlock = chunk.blocks[chunk.index(lx, height, lz)];
    if (aboveBlock !== BLOCK.WATER) return;

    const wx = chunk.cx * CHUNK_SIZE + lx;
    const wz = chunk.cz * CHUNK_SIZE + lz;
    const r = this._hashRandom(wx, height, wz, 700);

    // 海草（较常见）
    if (r < 0.15) {
      chunk.blocks[chunk.index(lx, height, lz)] = BLOCK.SEAGRASS;
    }

    // 海带（较少见，会长高几格）
    if (r > 0.85 && r < 0.92) {
      const kelpHeight = 2 + Math.floor(this._hashRandom(wx, height + 1, wz, 701) * 4);
      for (let k = 0; k < kelpHeight; k++) {
        const ky = height + k;
        if (ky >= CHUNK_HEIGHT) break;
        const kIdx = chunk.index(lx, ky, lz);
        if (chunk.blocks[kIdx] === BLOCK.WATER) {
          chunk.blocks[kIdx] = BLOCK.KELP;
        } else {
          break;
        }
      }
    }
  }

  // 获取生物群系
  getBiome(x, z) {
    const temp = this.noiseBiome.fbm2D(x * 0.005, z * 0.005, 3, 0.5, 2);
    const humid = this.noiseBiome.fbm2D(x * 0.005 + 500, z * 0.005 + 500, 3, 0.5, 2);
    const mountain = this.noiseHeight.fbm2D(x * 0.003, z * 0.003, 4, 0.5, 2);
    // 大尺度海洋噪声
    const oceanNoise = this.noiseBiome.fbm2D(x * 0.002, z * 0.002, 3, 0.5, 2);

    // 海洋：大范围低洼区域
    if (oceanNoise < -0.25) return BIOME.OCEAN;
    // 海滩：海洋边缘
    if (oceanNoise < -0.15) return BIOME.BEACH;
    if (mountain > 0.4) return BIOME.MOUNTAINS;
    if (temp < -0.3) return BIOME.SNOW;
    if (temp > 0.3 && humid < 0) return BIOME.DESERT;
    if (humid > 0.2) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  // 获取地形高度
  getHeight(x, z, biome) {
    let baseHeight = 28;
    let amplitude = 8;

    if (biome === BIOME.OCEAN) {
      amplitude = 3;
      baseHeight = 18; // 低于水面 (WATER_LEVEL=24)
    } else if (biome === BIOME.BEACH) {
      amplitude = 2;
      baseHeight = 23; // 略低于或等于水面
    } else if (biome === BIOME.MOUNTAINS) {
      amplitude = 25;
      baseHeight = 30;
    } else if (biome === BIOME.PLAINS) {
      amplitude = 5;
      baseHeight = 28;
    } else if (biome === BIOME.FOREST) {
      amplitude = 7;
      baseHeight = 29;
    } else if (biome === BIOME.DESERT) {
      amplitude = 4;
      baseHeight = 26;
    } else if (biome === BIOME.SNOW) {
      amplitude = 10;
      baseHeight = 30;
    }

    const n1 = this.noiseHeight.fbm2D(x * 0.01, z * 0.01, 4, 0.5, 2);
    const n2 = this.noiseHeight.fbm2D(x * 0.05, z * 0.05, 2, 0.5, 2) * 0.3;
    const height = Math.floor(baseHeight + (n1 + n2) * amplitude);
    return Math.max(1, Math.min(CHUNK_HEIGHT - 5, height));
  }

  // 洞穴判定
  isCave(x, y, z) {
    if (y < 3 || y > 40) return false;
    const n = this.noiseCave.fbm3D(x * 0.05, y * 0.08, z * 0.05, 3, 0.5, 2);
    return n > 0.35;
  }

  // 矿石分布
  maybeOre(x, y, z, currentBlock) {
    if (currentBlock !== BLOCK.STONE) return currentBlock;
    const n = this.noiseOre.noise3D(x * 0.1, y * 0.1, z * 0.1);
    if (y < 5 && n > 0.7) return BLOCK.DIAMOND_ORE;
    if (y < 12 && n > 0.65) return BLOCK.GOLD_ORE;
    if (y < 25 && n > 0.6) return BLOCK.IRON_ORE;
    if (y < 40 && n > 0.55) return BLOCK.COAL_ORE;
    return currentBlock;
  }

  // 树木生成（确定性：基于坐标+种子的哈希随机）
  maybeTree(chunk, x, y, z, biome) {
    if (x < 2 || x >= CHUNK_SIZE - 2 || z < 2 || z >= CHUNK_SIZE - 2) return;
    const chance = biome === BIOME.FOREST ? 0.03 : 0.008;
    const wx = chunk.cx * CHUNK_SIZE + x;
    const wz = chunk.cz * CHUNK_SIZE + z;
    const r = this._hashRandom(wx, y, wz, 7777);
    if (r < chance) {
      this.placeTree(chunk, x, y, z);
    }
  }

  placeTree(chunk, x, y, z) {
    const wx = chunk.cx * CHUNK_SIZE + x;
    const wz = chunk.cz * CHUNK_SIZE + z;
    const r = this._hashRandom(wx, y, wz, 8888);
    const treeHeight = 4 + Math.floor(r * 3); // 4-6格高
    // 树干
    for (let i = 0; i < treeHeight; i++) {
      if (y + i < CHUNK_HEIGHT) {
        chunk.blocks[chunk.index(x, y + i, z)] = BLOCK.LOG;
      }
    }

    // 树叶 — 完全对称的球形树冠，无随机跳过
    // 树冠中心在树干顶部上方 1 格
    const crownY = y + treeHeight - 1; // 树干最高 log 的位置

    // 第 1 层（最低）：crownY - 1，半径 2，方形（5x5）
    this.placeLeafLayer(chunk, x, crownY - 1, z, 2, true);

    // 第 2 层：crownY，半径 2，去掉四角
    this.placeLeafLayer(chunk, x, crownY, z, 2, false);

    // 第 3 层：crownY + 1，半径 1（3x3）
    this.placeLeafLayer(chunk, x, crownY + 1, z, 1, true);

    // 第 4 层（最高）：crownY + 2，半径 0（十字）
    this.placeLeafCross(chunk, x, crownY + 2, z);
  }

  // 放置一层树叶（正方形），skipCorners=true 时不放四角
  placeLeafLayer(chunk, cx, cy, cz, radius, skipCorners) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        // 跳过树干位置（仅最低层即 radius=2 时）
        if (dx === 0 && dz === 0 && radius === 2) {
          // 树干位置不放叶子（让树干穿过）
          continue;
        }
        // 跳过四角
        if (skipCorners && Math.abs(dx) === radius && Math.abs(dz) === radius) continue;

        const lx = cx + dx;
        const lz = cz + dz;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && cy < CHUNK_HEIGHT) {
          if (chunk.blocks[chunk.index(lx, cy, lz)] === BLOCK.AIR) {
            chunk.blocks[chunk.index(lx, cy, lz)] = BLOCK.LEAVES;
          }
        }
      }
    }
  }

  // 放置十字形树叶（最高层）
  placeLeafCross(chunk, cx, cy, cz) {
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of offsets) {
      const lx = cx + dx;
      const lz = cz + dz;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && cy < CHUNK_HEIGHT) {
        if (chunk.blocks[chunk.index(lx, cy, lz)] === BLOCK.AIR) {
          chunk.blocks[chunk.index(lx, cy, lz)] = BLOCK.LEAVES;
        }
      }
    }
  }

  // 植被生成（确定性：基于坐标+种子的哈希随机）
  maybeVegetation(chunk, x, y, z) {
    const wx = chunk.cx * CHUNK_SIZE + x;
    const wz = chunk.cz * CHUNK_SIZE + z;
    // 仅约 5% 的格子生成植被
    const r0 = this._hashRandom(wx, y, wz, 9999);
    if (r0 > 0.05) return;
    const r = this._hashRandom(wx, y, wz, 11111);
    if (r < 0.50) {
      chunk.blocks[chunk.index(x, y, z)] = BLOCK.TALL_GRASS;
    } else if (r < 0.72) {
      chunk.blocks[chunk.index(x, y, z)] = BLOCK.FLOWER_RED;
    } else if (r < 0.90) {
      chunk.blocks[chunk.index(x, y, z)] = BLOCK.FLOWER_YELLOW;
    } else {
      chunk.blocks[chunk.index(x, y, z)] = BLOCK.MUSHROOM;
    }
  }

  // 应用玩家修改的方块
  applyModifications(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (const [key, blockId] of this.modifiedBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      if (x >= ox && x < ox + CHUNK_SIZE && z >= oz && z < oz + CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT) {
        chunk.blocks[chunk.index(x - ox, y, z - oz)] = blockId;
      }
    }
  }

  // 清除所有区块（用于客户端收到主机种子后重置世界）
  clearAllChunks(scene) {
    for (const chunk of this.chunks.values()) {
      if (scene) chunk.disposeMesh(scene);
    }
    this.chunks.clear();
  }

  // 更新区块网格（只更新脏区块，限制每帧数量）
  updateMeshes(scene, material, waterMaterial, maxPerFrame = 2) {
    let count = 0;
    // 按距离玩家排序，优先更新近处区块
    const dirtyChunks = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty && chunk.generated) {
        dirtyChunks.push(chunk);
      }
    }
    // 距离排序已在调用方处理，这里直接取前N个
    for (const chunk of dirtyChunks) {
      if (count >= maxPerFrame) break;
      chunk.buildMesh(scene, this, material, waterMaterial);
      count++;
    }
    return count;
  }

  // 卸载远离的区块
  unloadDistantChunks(scene, playerCX, playerCZ, distance) {
    const toRemove = [];
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - playerCX;
      const dz = chunk.cz - playerCZ;
      if (Math.abs(dx) > distance + 1 || Math.abs(dz) > distance + 1) {
        chunk.disposeMesh(scene);
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.chunks.delete(key);
    }
  }

  // 获取所有区块
  getAllChunks() {
    return Array.from(this.chunks.values());
  }

  // 检查方块是否可以碰撞
  isSolid(x, y, z) {
    const blockId = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    const def = BLOCK_DEFS[blockId];
    return def ? def.solid : false;
  }

  // 射线检测方块（DDA算法）
  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = stepX > 0 ? (x + 1 - origin.x) / direction.x : stepX < 0 ? (origin.x - x) / -direction.x : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - origin.y) / direction.y : stepY < 0 ? (origin.y - y) / -direction.y : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) / direction.z : stepZ < 0 ? (origin.z - z) / -direction.z : Infinity;

    let face = null;
    let dist = 0;

    while (dist < maxDistance) {
      const blockId = this.getBlock(x, y, z);
      if (blockId !== 0 && blockId !== BLOCK.WATER) {
        return {
          x, y, z,
          blockId,
          face: face, // 被击中的面方向
          distance: dist,
        };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        face = [0, -stepY, 0];
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        face = [0, 0, -stepZ];
      }
    }

    return null;
  }
}
