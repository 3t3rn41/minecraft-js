/**
 * chunk.js — 区块类：存储方块数据 + 生成渲染网格
 * 区块尺寸: 16(x) × 64(y) × 16(z)
 */

import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, BLOCK_DEFS, getFaceUV } from './blocks.js';

// 十字交叉面定义（用于花草等植物方块）
// 两对交叉的对角面，从方块中心穿过
const CROSS_FACES = [
  // 第一对：从 (0,0,0)-(1,1,1) 方向
  {
    corners: [[0,0,0],[1,0,1],[1,1,1],[0,1,0]],
    normal: [0.707, 0, 0.707],
  },
  {
    corners: [[0,0,1],[1,0,0],[1,1,0],[0,1,1]],
    normal: [-0.707, 0, 0.707],
  },
];

// 面方向定义: corners 按逆时针排列（从外部观察），使三角形正面朝外
// corner 0=左下(UV u0,v0), 1=右下(UV u1,v0), 2=右上(UV u1,v1), 3=左上(UV u0,v1)
const FACES = [
  { dir: [0, 1, 0], uvFace: 0, corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], normal: [0,1,0] },   // top
  { dir: [0,-1, 0], uvFace: 1, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], normal: [0,-1,0] },  // bottom
  { dir: [0, 0, 1], uvFace: 2, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], normal: [0,0,1] },   // front (+z)
  { dir: [0, 0,-1], uvFace: 2, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], normal: [0,0,-1] },  // back (-z)
  { dir: [1, 0, 0], uvFace: 2, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], normal: [1,0,0] },   // right (+x)
  { dir: [-1,0, 0], uvFace: 2, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], normal: [-1,0,0] },  // left (-x)
];

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    // 使用 Uint8Array 存储方块ID (16*64*16 = 16384 字节)
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh = null;
    this.waterMesh = null;
    this.dirty = true;
    this.generated = false;
  }

  // 预分配的网格构建数组（类级别共享，避免每次GC）
  static _buildArrays = null;

  static getBuildArrays() {
    if (!Chunk._buildArrays) {
      Chunk._buildArrays = {
        positions: [], normals: [], uvs: [], indices: [], colors: [],
        waterPositions: [], waterNormals: [], waterUvs: [], waterIndices: [], waterColors: [],
      };
    }
    // 清空但不释放内存
    const a = Chunk._buildArrays;
    a.positions.length = 0; a.normals.length = 0; a.uvs.length = 0; a.indices.length = 0; a.colors.length = 0;
    a.waterPositions.length = 0; a.waterNormals.length = 0; a.waterUvs.length = 0; a.waterIndices.length = 0; a.waterColors.length = 0;
    return a;
  }

  // 坐标转索引
  index(x, y, z) {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  // 获取方块（局部坐标）
  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0; // AIR
    }
    return this.blocks[this.index(x, y, z)];
  }

  // 设置方块（局部坐标）
  setBlock(x, y, z, blockId) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return false;
    }
    this.blocks[this.index(x, y, z)] = blockId;
    this.dirty = true;
    return true;
  }

  // 是否需要渲染此面（邻居是透明方块）
  shouldRenderFace(neighborBlock, currentBlock) {
    const neighborDef = BLOCK_DEFS[neighborBlock];
    const currentDef = BLOCK_DEFS[currentBlock];
    if (!neighborDef || !currentDef) return false;
    if (neighborBlock === 0) return true; // 空气
    if (neighborDef.transparent && !neighborDef.liquid) return true; // 玻璃、树叶等透明非液体
    if (neighborDef.liquid && !currentDef.liquid) return true; // 固体方块紧邻水时需要渲染面
    if (currentDef.liquid && neighborDef.liquid) return false; // 水与水之间不渲染
    return false;
  }

  // 生成网格
  buildMesh(scene, world, material, waterMaterial) {
    const arr = Chunk.getBuildArrays();
    const positions = arr.positions;
    const normals = arr.normals;
    const uvs = arr.uvs;
    const indices = arr.indices;
    const colors = arr.colors;

    const waterPositions = arr.waterPositions;
    const waterNormals = arr.waterNormals;
    const waterUvs = arr.waterUvs;
    const waterIndices = arr.waterIndices;
    const waterColors = arr.waterColors;

    const offsetX = this.cx * CHUNK_SIZE;
    const offsetZ = this.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const blockId = this.getBlock(x, y, z);
          if (blockId === 0) continue; // 空气跳过

          const def = BLOCK_DEFS[blockId];
          if (!def) continue;

          // 十字交叉方块（花草等）特殊渲染
          if (def.cross) {
            // 检查下方是否有支撑方块
            const belowBlock = y > 0 ? this.getBlock(x, y - 1, z) : 0;
            if (belowBlock === 0 && y > 0) {
              const worldBelow = world.getBlock(offsetX + x, y - 1, offsetZ + z);
              if (worldBelow === 0) continue; // 无支撑不渲染
            }
            const uvData = getFaceUV(blockId, 0);
            const ao = this.calcAO(world, x, y, z, offsetX, offsetZ);
            for (const cf of CROSS_FACES) {
              const startIdx = positions.length / 3;
              for (let i = 0; i < 4; i++) {
                const cx = cf.corners[i][0];
                const cy = cf.corners[i][1];
                const cz = cf.corners[i][2];
                positions.push(x + cx + offsetX, y + cy, z + cz + offsetZ);
                normals.push(cf.normal[0], cf.normal[1], cf.normal[2]);
                if (i === 0) uvs.push(uvData.u0, uvData.v0);
                else if (i === 1) uvs.push(uvData.u1, uvData.v0);
                else if (i === 2) uvs.push(uvData.u1, uvData.v1);
                else uvs.push(uvData.u0, uvData.v1);
                const light = 0.85 * ao;
                colors.push(light, light, light);
              }
              // 正面
              indices.push(startIdx, startIdx + 1, startIdx + 2);
              indices.push(startIdx, startIdx + 2, startIdx + 3);
              // 背面（反向缠绕，使双面可见）
              indices.push(startIdx, startIdx + 2, startIdx + 1);
              indices.push(startIdx, startIdx + 3, startIdx + 2);
            }
            continue; // 跳过正常面渲染
          }

          const targetArrays = def.liquid ? {
            pos: waterPositions, nor: waterNormals, uv: waterUvs, idx: waterIndices, col: waterColors
          } : {
            pos: positions, nor: normals, uv: uvs, idx: indices, col: colors
          };

          for (const face of FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            // 获取邻居方块（可能跨区块）
            let neighborBlock;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT) {
              neighborBlock = world.getBlock(offsetX + nx, ny, offsetZ + nz);
            } else {
              neighborBlock = this.getBlock(nx, ny, nz);
            }

            if (!this.shouldRenderFace(neighborBlock, blockId)) continue;

            // 添加面的4个顶点
            const startIdx = targetArrays.pos.length / 3;
            const uvData = getFaceUV(blockId, face.uvFace);

            // 根据方块位置添加轻微的颜色变化（模拟环境光遮蔽）
            const ao = this.calcAO(world, x, y, z, offsetX, offsetZ);

            for (let i = 0; i < 4; i++) {
              const cx = face.corners[i][0];
              const cy = face.corners[i][1];
              const cz = face.corners[i][2];
              targetArrays.pos.push(x + cx + offsetX, y + cy, z + cz + offsetZ);
              targetArrays.nor.push(face.normal[0], face.normal[1], face.normal[2]);

              // UV
              if (i === 0) targetArrays.uv.push(uvData.u0, uvData.v0);
              else if (i === 1) targetArrays.uv.push(uvData.u1, uvData.v0);
              else if (i === 2) targetArrays.uv.push(uvData.u1, uvData.v1);
              else targetArrays.uv.push(uvData.u0, uvData.v1);

              // 顶点颜色（AO + 面光照）
              const faceLight = face.uvFace === 0 ? 1.0 : face.uvFace === 1 ? 0.5 : 0.8;
              const finalLight = faceLight * ao;
              targetArrays.col.push(finalLight, finalLight, finalLight);
            }

            // 两个三角形
            targetArrays.idx.push(startIdx, startIdx + 1, startIdx + 2);
            targetArrays.idx.push(startIdx, startIdx + 2, startIdx + 3);
          }
        }
      }
    }

    // 删除旧网格
    this.disposeMesh(scene);

    // 创建实体方块网格
    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setIndex(indices);
      geom.computeBoundingSphere();
      this.mesh = new THREE.Mesh(geom, material);
      this.mesh.frustumCulled = true;
      scene.add(this.mesh);
    }

    // 创建水面网格
    if (waterPositions.length > 0) {
      const wgeom = new THREE.BufferGeometry();
      wgeom.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
      wgeom.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
      wgeom.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
      wgeom.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
      wgeom.setIndex(waterIndices);
      wgeom.computeBoundingSphere();
      this.waterMesh = new THREE.Mesh(wgeom, waterMaterial);
      this.waterMesh.frustumCulled = true;
      scene.add(this.waterMesh);
    }

    this.dirty = false;
  }

  // 简单的环境光遮蔽计算
  calcAO(world, x, y, z, ox, oz) {
    // 基础亮度，略受高度影响
    const heightFactor = 0.85 + Math.min(y / CHUNK_HEIGHT, 1) * 0.15;
    return heightFactor;
  }

  disposeMesh(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }
}
