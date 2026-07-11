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
    this.adventureTheme = null; // 冒险模式地图主题覆盖
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
const key = `${x},${y},${z}`;
this.modifiedBlocks.set(key, blockId);
// 同步更新区块修改索引
if (!this._chunkModIndex) this._chunkModIndex = new Map();
const ck = `${cx},${cz}`;
if (!this._chunkModIndex.has(ck)) this._chunkModIndex.set(ck, []);
const arr = this._chunkModIndex.get(ck);
if (!arr.includes(key)) arr.push(key);
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
            // 冒险模式主题覆盖：地下层
            if (this.adventureTheme) {
              const sb = this.adventureTheme.surfaceBlock;
              if (sb === 'sand') block = BLOCK.SAND;
              else if (sb === 'stone') block = BLOCK.STONE;
              else block = BLOCK.DIRT;
            } else {
              block = biome === BIOME.DESERT ? BLOCK.SAND : BLOCK.DIRT;
            }
          } else if (y < height) {
            // 地表方块
            if (this.adventureTheme) {
              const sb = this.adventureTheme.surfaceBlock;
              if (sb === 'sand') block = BLOCK.SAND;
              else if (sb === 'snow') block = BLOCK.SNOW;
              else if (sb === 'stone') block = BLOCK.STONE;
              else block = BLOCK.GRASS;
            } else if (biome === BIOME.DESERT || biome === BIOME.BEACH) {
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
          // 冒险模式：石头地表不生成树木
          const allowTrees = !this.adventureTheme || this.adventureTheme.surfaceBlock !== 'stone';
          if (allowTrees && (surfaceBlock === BLOCK.GRASS || surfaceBlock === BLOCK.SNOW)) {
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

    // 冒险模式：生成大型结构建筑
    if (this.adventureTheme) {
      this.generateAdventureStructures(chunk);
    }

    // 应用玩家修改
    this.applyModifications(chunk);

    chunk.generated = true;
    chunk.dirty = true;
  }

  // ===== 冒险模式大型结构生成 =====
  // 根据地图主题在区块中生成建筑、废墟、洞穴等复杂结构
  generateAdventureStructures(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const biome = this.adventureTheme.biome;

    // 使用确定性随机决定是否在此区块生成结构
    const structureRand = this._hashRandom(ox, 0, oz, 55555);

    if (biome === 'plains') {
      // 城市废墟：生成废弃建筑
      if (structureRand < 0.25) {
        this.generateRuinedBuilding(chunk, ox, oz);
      }
      // 生成道路片段
      if (structureRand > 0.7 && structureRand < 0.8) {
        this.generateRoadFragment(chunk, ox, oz);
      }
      // 生成弹坑
      if (structureRand > 0.9) {
        this.generateCrater(chunk, ox, oz);
      }
    } else if (biome === 'snow') {
      // 寒冰实验室：生成冰晶实验室结构
      if (structureRand < 0.2) {
        this.generateIceLab(chunk, ox, oz);
      }
      // 冰柱群
      if (structureRand > 0.5 && structureRand < 0.7) {
        this.generateIcePillars(chunk, ox, oz);
      }
      // 冰墙迷宫片段
      if (structureRand > 0.85) {
        this.generateIceWallMaze(chunk, ox, oz);
      }
    } else if (biome === 'mountains') {
      // 水晶巢穴：生成水晶矿脉和洞穴
      if (structureRand < 0.3) {
        this.generateCrystalCave(chunk, ox, oz);
      }
      // 水晶柱
      if (structureRand > 0.6 && structureRand < 0.8) {
        this.generateCrystalPillars(chunk, ox, oz);
      }
      // 矿道
      if (structureRand > 0.9) {
        this.generateMineTunnel(chunk, ox, oz);
      }
    } else if (biome === 'desert') {
      // 暗影宫殿：生成陵墓和神殿废墟
      if (structureRand < 0.2) {
        this.generateDesertTomb(chunk, ox, oz);
      }
      // 沙岩柱阵
      if (structureRand > 0.5 && structureRand < 0.7) {
        this.generateSandstonePillars(chunk, ox, oz);
      }
      // 残破围墙
      if (structureRand > 0.85) {
        this.generateDesertWalls(chunk, ox, oz);
      }
    }
  }

  // 辅助：安全设置区块内方块
  _setChunkBlock(chunk, lx, y, lz, blockId) {
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT) {
      chunk.blocks[chunk.index(lx, y, lz)] = blockId;
    }
  }

  // ===== 城市废墟：废弃建筑 =====
  generateRuinedBuilding(chunk, ox, oz) {
    const baseX = 2 + Math.floor(this._hashRandom(ox, 1, oz, 101) * (CHUNK_SIZE - 8));
    const baseZ = 2 + Math.floor(this._hashRandom(ox, 2, oz, 102) * (CHUNK_SIZE - 8));
    const buildingW = 4 + Math.floor(this._hashRandom(ox, 3, oz, 103) * 4);
    const buildingD = 4 + Math.floor(this._hashRandom(ox, 4, oz, 104) * 4);
    const buildingH = 5 + Math.floor(this._hashRandom(ox, 5, oz, 105) * 8);

    // 找地表高度
    let groundY = this.getHeight(ox + baseX, oz + baseZ, 0);

    for (let dx = 0; dx < buildingW; dx++) {
      for (let dz = 0; dz < buildingD; dz++) {
        for (let dy = 0; dy < buildingH; dy++) {
          const y = groundY + dy;
          const isEdge = dx === 0 || dx === buildingW - 1 || dz === 0 || dz === buildingD - 1;
          const r = this._hashRandom(ox + baseX + dx, y, oz + baseZ + dz, 200);

          if (isEdge) {
            // 外墙：砖块/裂纹石，部分破损
            if (r > 0.25) {
              this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, r > 0.7 ? BLOCK.BRICK : BLOCK.CRACKED_STONE);
            }
            // 窗户
            if (dy > 0 && dy < buildingH - 1 && r > 0.8) {
              this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, BLOCK.GLASS);
            }
          } else if (dy === 0 || dy === buildingH - 1) {
            // 地板/天花板
            if (r > 0.3) {
              this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, BLOCK.STONE);
            }
          }
          // 内部空间留空（废墟感）
        }
      }
    }

    // 楼梯井
    for (let dy = 1; dy < buildingH - 1; dy++) {
      this._setChunkBlock(chunk, baseX + 1, groundY + dy, baseZ + 1, BLOCK.AIR);
      if (dy % 2 === 0) {
        this._setChunkBlock(chunk, baseX + 1, groundY + dy - 1, baseZ + 1, BLOCK.COBBLESTONE);
      }
    }
  }

  // 城市废墟：道路片段
  generateRoadFragment(chunk, ox, oz) {
    const baseX = Math.floor(this._hashRandom(ox, 10, oz, 110) * CHUNK_SIZE);
    const dir = this._hashRandom(ox, 11, oz, 111) > 0.5 ? 'x' : 'z';
    const roadWidth = 3;

    for (let i = 0; i < CHUNK_SIZE; i++) {
      for (let w = -roadWidth; w <= roadWidth; w++) {
        let lx, lz;
        if (dir === 'x') { lx = i; lz = baseX + w; }
        else { lx = baseX + w; lz = i; }
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

        const height = this.getHeight(ox + lx, oz + lz, 0);
        // 道路：混凝土/砂砾
        const r = this._hashRandom(ox + lx, 0, oz + lz, 112);
        this._setChunkBlock(chunk, lx, height - 1, lz, r > 0.3 ? BLOCK.CONCRETE : BLOCK.COBBLESTONE);
        // 清除路上方方块
        for (let y = height; y < height + 3; y++) {
          this._setChunkBlock(chunk, lx, y, lz, BLOCK.AIR);
        }
      }
    }
  }

  // 城市废墟：弹坑
  generateCrater(chunk, ox, oz) {
    const cx = 4 + Math.floor(this._hashRandom(ox, 20, oz, 120) * (CHUNK_SIZE - 8));
    const cz = 4 + Math.floor(this._hashRandom(ox, 21, oz, 121) * (CHUNK_SIZE - 8));
    const radius = 3 + Math.floor(this._hashRandom(ox, 22, oz, 122) * 3);
    const groundY = this.getHeight(ox + cx, oz + cz, 0);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > radius) continue;
        const depth = Math.floor((1 - dist / radius) * 4);
        for (let dy = 0; dy < depth; dy++) {
          this._setChunkBlock(chunk, cx + dx, groundY - 1 - dy, cz + dz, BLOCK.AIR);
        }
        // 坑底焦黑
        this._setChunkBlock(chunk, cx + dx, groundY - 1 - depth, cz + dz, BLOCK.OBSIDIAN);
      }
    }
  }

  // ===== 寒冰实验室：冰晶实验室 =====
  generateIceLab(chunk, ox, oz) {
    const baseX = 2 + Math.floor(this._hashRandom(ox, 30, oz, 130) * (CHUNK_SIZE - 10));
    const baseZ = 2 + Math.floor(this._hashRandom(ox, 31, oz, 131) * (CHUNK_SIZE - 10));
    const labW = 6 + Math.floor(this._hashRandom(ox, 32, oz, 132) * 4);
    const labD = 6 + Math.floor(this._hashRandom(ox, 33, oz, 133) * 4);
    const labH = 4;
    const groundY = this.getHeight(ox + baseX, oz + baseZ, 0);

    for (let dx = 0; dx < labW; dx++) {
      for (let dz = 0; dz < labD; dz++) {
        for (let dy = 0; dy < labH; dy++) {
          const y = groundY + dy;
          const isEdge = dx === 0 || dx === labW - 1 || dz === 0 || dz === labD - 1;

          if (isEdge) {
            // 冰墙，部分透明（冰窗）
            const r = this._hashRandom(ox + baseX + dx, y, oz + baseZ + dz, 210);
            if (r > 0.2) {
              this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, r > 0.85 ? BLOCK.GLASS : BLOCK.PACKED_ICE);
            }
          } else if (dy === 0) {
            this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, BLOCK.BLUE_ICE);
          } else if (dy === labH - 1) {
            // 天花板：蓝冰
            this._setChunkBlock(chunk, baseX + dx, y, baseZ + dz, BLOCK.PACKED_ICE);
          }
        }
      }
    }

    // 中心实验台
    const midX = baseX + Math.floor(labW / 2);
    const midZ = baseZ + Math.floor(labD / 2);
    this._setChunkBlock(chunk, midX, groundY, midZ, BLOCK.QUARTZ);
    this._setChunkBlock(chunk, midX, groundY + 1, midZ, BLOCK.GLOWSTONE); // 照明

    // 角落冰柱支撑
    for (const [cx, cz] of [[baseX, baseZ], [baseX + labW - 1, baseZ], [baseX, baseZ + labD - 1], [baseX + labW - 1, baseZ + labD - 1]]) {
      for (let dy = 0; dy < labH + 2; dy++) {
        this._setChunkBlock(chunk, cx, groundY + dy, cz, BLOCK.PACKED_ICE);
      }
    }
  }

  // 寒冰实验室：冰柱群
  generateIcePillars(chunk, ox, oz) {
    const count = 3 + Math.floor(this._hashRandom(ox, 40, oz, 140) * 4);
    for (let i = 0; i < count; i++) {
      const lx = 1 + Math.floor(this._hashRandom(ox, 41 + i, oz, 141 + i) * (CHUNK_SIZE - 2));
      const lz = 1 + Math.floor(this._hashRandom(ox, 42 + i, oz, 142 + i) * (CHUNK_SIZE - 2));
      const groundY = this.getHeight(ox + lx, oz + lz, 0);
      const pillarH = 3 + Math.floor(this._hashRandom(ox + lx, 43, oz + lz, 143) * 5);
      for (let dy = 0; dy < pillarH; dy++) {
        this._setChunkBlock(chunk, lx, groundY + dy, lz, BLOCK.PACKED_ICE);
      }
      // 尖顶
      this._setChunkBlock(chunk, lx, groundY + pillarH, lz, BLOCK.BLUE_ICE);
    }
  }

  // 寒冰实验室：冰墙迷宫片段
  generateIceWallMaze(chunk, ox, oz) {
    const groundY = this.getHeight(ox + 8, oz + 8, 0);
    const wallH = 3;
    // 生成 L 型或十字型冰墙
    const shape = Math.floor(this._hashRandom(ox, 50, oz, 150) * 3);
    if (shape === 0) {
      // 横墙
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let dy = 0; dy < wallH; dy++) {
          this._setChunkBlock(chunk, lx, groundY + dy, 8, BLOCK.PACKED_ICE);
        }
      }
    } else if (shape === 1) {
      // 竖墙
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let dy = 0; dy < wallH; dy++) {
          this._setChunkBlock(chunk, 8, groundY + dy, lz, BLOCK.PACKED_ICE);
        }
      }
    } else {
      // 十字
      for (let i = 0; i < CHUNK_SIZE; i++) {
        for (let dy = 0; dy < wallH; dy++) {
          this._setChunkBlock(chunk, i, groundY + dy, 8, BLOCK.PACKED_ICE);
          this._setChunkBlock(chunk, 8, groundY + dy, i, BLOCK.PACKED_ICE);
        }
      }
    }
  }

  // ===== 水晶巢穴：水晶洞穴 =====
  generateCrystalCave(chunk, ox, oz) {
    const cx = 4 + Math.floor(this._hashRandom(ox, 60, oz, 160) * (CHUNK_SIZE - 8));
    const cz = 4 + Math.floor(this._hashRandom(ox, 61, oz, 161) * (CHUNK_SIZE - 8));
    const groundY = this.getHeight(ox + cx, oz + cz, 0);
    const radius = 4 + Math.floor(this._hashRandom(ox, 62, oz, 162) * 3);

    // 挖空地下洞穴
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dy = -radius; dy <= 1; dy++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius) continue;
          const y = groundY + dy;
          if (y < 1) continue;
          this._setChunkBlock(chunk, cx + dx, y, cz + dz, BLOCK.AIR);
        }
      }
    }
    // 洞穴底部铺石英/水晶
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > radius) continue;
        this._setChunkBlock(chunk, cx + dx, groundY - radius - 1, cz + dz, BLOCK.QUARTZ);
      }
    }
    // 随机水晶簇（萤石/海晶灯模拟发光水晶）
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = radius * 0.6;
      const lx = cx + Math.floor(Math.cos(angle) * r);
      const lz = cz + Math.floor(Math.sin(angle) * r);
      this._setChunkBlock(chunk, lx, groundY - 1, lz, BLOCK.SEA_LANTERN);
      this._setChunkBlock(chunk, lx, groundY, lz, BLOCK.QUARTZ);
      this._setChunkBlock(chunk, lx, groundY + 1, lz, BLOCK.QUARTZ);
    }
  }

  // 水晶巢穴：水晶柱
  generateCrystalPillars(chunk, ox, oz) {
    const count = 2 + Math.floor(this._hashRandom(ox, 70, oz, 170) * 3);
    for (let i = 0; i < count; i++) {
      const lx = 2 + Math.floor(this._hashRandom(ox, 71 + i, oz, 171 + i) * (CHUNK_SIZE - 4));
      const lz = 2 + Math.floor(this._hashRandom(ox, 72 + i, oz, 172 + i) * (CHUNK_SIZE - 4));
      const groundY = this.getHeight(ox + lx, oz + lz, 0);
      const pillarH = 6 + Math.floor(this._hashRandom(ox + lx, 73, oz + lz, 173) * 6);

      for (let dy = 0; dy < pillarH; dy++) {
        // 水晶柱：石英为核心，外围安山岩
        this._setChunkBlock(chunk, lx, groundY + dy, lz, BLOCK.QUARTZ);
        if (dy % 3 === 0) {
          this._setChunkBlock(chunk, lx + 1, groundY + dy, lz, BLOCK.ANDESITE);
          this._setChunkBlock(chunk, lx - 1, groundY + dy, lz, BLOCK.ANDESITE);
          this._setChunkBlock(chunk, lx, groundY + dy, lz + 1, BLOCK.ANDESITE);
          this._setChunkBlock(chunk, lx, groundY + dy, lz - 1, BLOCK.ANDESITE);
        }
      }
      // 顶端发光水晶
      this._setChunkBlock(chunk, lx, groundY + pillarH, lz, BLOCK.GLOWSTONE);
    }
  }

  // 水晶巢穴：矿道
  generateMineTunnel(chunk, ox, oz) {
    const groundY = this.getHeight(ox + 8, oz + 8, 0);
    const tunnelY = Math.max(5, groundY - 8);
    const dir = this._hashRandom(ox, 80, oz, 180) > 0.5 ? 'x' : 'z';

    for (let i = 0; i < CHUNK_SIZE; i++) {
      // 3x3 矿道
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          let lx, lz;
          if (dir === 'x') { lx = i; lz = 8 + dx; }
          else { lx = 8 + dx; lz = i; }
          this._setChunkBlock(chunk, lx, tunnelY + dy, lz, BLOCK.AIR);
        }
      }
      // 矿道支撑木架
      if (i % 4 === 0) {
        let lx, lz;
        if (dir === 'x') { lx = i; lz = 8; }
        else { lx = 8; lz = i; }
        this._setChunkBlock(chunk, lx, tunnelY - 2, lz, BLOCK.LOG);
        this._setChunkBlock(chunk, lx + (dir === 'x' ? 0 : 2), tunnelY, lz + (dir === 'x' ? 2 : 0), BLOCK.LOG);
        this._setChunkBlock(chunk, lx + (dir === 'x' ? 0 : -2), tunnelY, lz + (dir === 'x' ? -2 : 0), BLOCK.LOG);
      }
    }
  }

  // ===== 暗影宫殿：沙漠陵墓 =====
  generateDesertTomb(chunk, ox, oz) {
    const baseX = 2 + Math.floor(this._hashRandom(ox, 90, oz, 190) * (CHUNK_SIZE - 10));
    const baseZ = 2 + Math.floor(this._hashRandom(ox, 91, oz, 191) * (CHUNK_SIZE - 10));
    const tombW = 6 + Math.floor(this._hashRandom(ox, 92, oz, 192) * 4);
    const tombD = 6 + Math.floor(this._hashRandom(ox, 93, oz, 193) * 4);
    const tombH = 5 + Math.floor(this._hashRandom(ox, 94, oz, 194) * 4);
    const groundY = this.getHeight(ox + baseX, oz + baseZ, 0);

    // 陵墓基座
    for (let dx = -1; dx < tombW + 1; dx++) {
      for (let dz = -1; dz < tombD + 1; dz++) {
        this._setChunkBlock(chunk, baseX + dx, groundY - 1, baseZ + dz, BLOCK.SANDSTONE);
      }
    }

    // 陵墓墙壁
    for (let dy = 0; dy < tombH; dy++) {
      for (let dx = 0; dx < tombW; dx++) {
        for (let dz = 0; dz < tombD; dz++) {
          const isEdge = dx === 0 || dx === tombW - 1 || dz === 0 || dz === tombD - 1;
          if (isEdge) {
            const r = this._hashRandom(ox + baseX + dx, groundY + dy, oz + baseZ + dz, 220);
            // 砂岩墙，部分破损
            if (r > 0.15) {
              this._setChunkBlock(chunk, baseX + dx, groundY + dy, baseZ + dz,
                r > 0.8 ? BLOCK.RED_SANDSTONE : BLOCK.SANDSTONE);
            }
          }
        }
      }
    }

    // 顶部金字塔阶梯
    const midX = baseX + Math.floor(tombW / 2);
    const midZ = baseZ + Math.floor(tombD / 2);
    for (let layer = 0; layer < 3; layer++) {
      const sz = Math.max(2, tombW - layer * 2);
      for (let dx = -Math.floor(sz / 2); dx <= Math.floor(sz / 2); dx++) {
        for (let dz = -Math.floor(sz / 2); dz <= Math.floor(sz / 2); dz++) {
          this._setChunkBlock(chunk, midX + dx, groundY + tombH + layer, midZ + dz, BLOCK.SANDSTONE);
        }
      }
    }

    // 入口（北侧）
    for (let dy = 0; dy < 3; dy++) {
      this._setChunkBlock(chunk, midX, groundY + dy, baseZ, BLOCK.AIR);
    }
    // 入口两侧火把
    this._setChunkBlock(chunk, midX - 1, groundY, baseZ, BLOCK.TORCH);
    this._setChunkBlock(chunk, midX + 1, groundY, baseZ, BLOCK.TORCH);

    // 中心宝箱台
    this._setChunkBlock(chunk, midX, groundY, midZ, BLOCK.GOLD_BLOCK);
    this._setChunkBlock(chunk, midX, groundY + 1, midZ, BLOCK.OBSIDIAN);
  }

  // 暗影宫殿：沙岩柱阵
  generateSandstonePillars(chunk, ox, oz) {
    const count = 4 + Math.floor(this._hashRandom(ox, 100, oz, 200) * 4);
    for (let i = 0; i < count; i++) {
      const lx = 1 + Math.floor(this._hashRandom(ox, 101 + i, oz, 201 + i) * (CHUNK_SIZE - 2));
      const lz = 1 + Math.floor(this._hashRandom(ox, 102 + i, oz, 202 + i) * (CHUNK_SIZE - 2));
      const groundY = this.getHeight(ox + lx, oz + lz, 0);
      const pillarH = 4 + Math.floor(this._hashRandom(ox + lx, 103, oz + lz, 203) * 4);

      for (let dy = 0; dy < pillarH; dy++) {
        this._setChunkBlock(chunk, lx, groundY + dy, lz, BLOCK.SANDSTONE);
      }
      // 柱顶红砂岩
      this._setChunkBlock(chunk, lx, groundY + pillarH, lz, BLOCK.RED_SANDSTONE);
    }
  }

  // 暗影宫殿：残破围墙
  generateDesertWalls(chunk, ox, oz) {
    const groundY = this.getHeight(ox + 8, oz + 8, 0);
    const wallH = 4;
    const dir = this._hashRandom(ox, 110, oz, 210) > 0.5 ? 'x' : 'z';

    for (let i = 0; i < CHUNK_SIZE; i++) {
      const r = this._hashRandom(ox + i, 0, oz, 211);
      if (r < 0.3) continue; // 残破缺口

      for (let dy = 0; dy < wallH; dy++) {
        let lx, lz;
        if (dir === 'x') { lx = i; lz = 6; }
        else { lx = 6; lz = i; }
        this._setChunkBlock(chunk, lx, groundY + dy, lz, BLOCK.SANDSTONE);
      }
    }
  }

  // 水生植物生成（海草、海带）
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
    // 冒险模式主题覆盖
    if (this.adventureTheme) {
      const biomeMap = {
        plains: BIOME.PLAINS, forest: BIOME.FOREST, desert: BIOME.DESERT,
        mountains: BIOME.MOUNTAINS, snow: BIOME.SNOW, ocean: BIOME.OCEAN, beach: BIOME.BEACH,
      };
      return biomeMap[this.adventureTheme.biome] || BIOME.PLAINS;
    }
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

    // 冒险模式主题覆盖
    if (this.adventureTheme) {
      baseHeight = this.adventureTheme.baseHeight || 28;
      amplitude = this.adventureTheme.amplitude || 8;
    } else if (biome === BIOME.OCEAN) {
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

    // 普通小洞穴：中等频率噪声，产生细小分散的隧道
    const n = this.noiseCave.fbm3D(x * 0.05, y * 0.08, z * 0.05, 3, 0.5, 2);
    if (n > 0.35) return true;

    // 天然大矿洞：极低频率噪声，仅在深层生成，稀疏但空间巨大
    // 中心集中在 y=8~28 之间，使用二次衰减使边缘平滑过渡
    if (y >= 5 && y <= 32) {
      // 低频噪声决定大矿洞中心区域
      const big = this.noiseCave.fbm3D(x * 0.012, y * 0.015, z * 0.012, 2, 0.5, 2);
      // 阈值很高(>0.55)，保证大矿洞非常稀少
      if (big > 0.55) {
        // 中心层(y≈12~24)更容易成为大矿洞，边缘层需要更高阈值
        const centerY = 18;
        const dist = Math.abs(y - centerY);
        const heightFactor = 1.0 - (dist / 14.0) * 0.15; // 中心0.55，边缘约0.567
        if (big > 0.55 * heightFactor + 0.02) {
          return true;
        }
      }
    }

    return false;
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

  // 应用玩家修改的方块（优化：按区块key索引，避免遍历全部修改）
  applyModifications(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    // 尝试使用区块级索引快速查找
    const chunkKey = `${chunk.cx},${chunk.cz}`;
    const mods = this._chunkModIndex?.get(chunkKey);
    if (mods) {
      for (const key of mods) {
        const blockId = this.modifiedBlocks.get(key);
        if (blockId === undefined) continue;
        const comma1 = key.indexOf(',');
        const comma2 = key.indexOf(',', comma1 + 1);
        const x = parseInt(key.substring(0, comma1));
        const y = parseInt(key.substring(comma1 + 1, comma2));
        const z = parseInt(key.substring(comma2 + 1));
        if (y >= 0 && y < CHUNK_HEIGHT) {
          chunk.blocks[chunk.index(x - ox, y, z - oz)] = blockId;
        }
      }
    } else {
      // 首次：全量扫描并建立索引
      for (const [key, blockId] of this.modifiedBlocks) {
        const comma1 = key.indexOf(',');
        const comma2 = key.indexOf(',', comma1 + 1);
        const x = parseInt(key.substring(0, comma1));
        const y = parseInt(key.substring(comma1 + 1, comma2));
        const z = parseInt(key.substring(comma2 + 1));
        if (x >= ox && x < ox + CHUNK_SIZE && z >= oz && z < oz + CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT) {
          chunk.blocks[chunk.index(x - ox, y, z - oz)] = blockId;
          // 建立索引
          if (!this._chunkModIndex) this._chunkModIndex = new Map();
          const ck = `${chunk.cx},${chunk.cz}`;
          if (!this._chunkModIndex.has(ck)) this._chunkModIndex.set(ck, []);
          this._chunkModIndex.get(ck).push(key);
        }
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
    // 按距离排序（使用切比雪夫距离，开销小）
    if (dirtyChunks.length > 1 && this._lastPlayerChunkX !== undefined) {
      dirtyChunks.sort((a, b) => {
        const da = Math.max(Math.abs(a.cx - this._lastPlayerChunkX), Math.abs(a.cz - this._lastPlayerChunkZ));
        const db = Math.max(Math.abs(b.cx - this._lastPlayerChunkX), Math.abs(b.cz - this._lastPlayerChunkZ));
        return da - db;
      });
    }
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
