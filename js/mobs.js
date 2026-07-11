/**
 * mobs.js — 生物实体、基础 AI 和方块掉落物
 * 包含：猪（被动）、僵尸（敌对）、掉落物实体
 */

import * as THREE from 'three';
import { BLOCK_DEFS, BLOCK, generateBlockIcon, WATER_LEVEL } from './blocks.js';
import { generateTextureAtlas } from './blocks.js';

// 生物基类
class Entity {
  constructor(world, x, y, z) {
    this.world = world;
    this.position = { x, y, z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.health = 10;
    this.maxHealth = 10;
    this.dead = false;
    this.onGround = false;
    this._speedScale = 1.0; // 冒险模式速度缩放
    this.width = 0.5;
    this.height = 1.4;
    this.mesh = null;
    this.id = Math.random().toString(36).substring(7);
    this.hurtTimer = 0;
    this.dying = false;
    this.deathTimer = 0;

    // 方块交互能力（僵尸专用）
    this.canBreakBlocks = false;
    this._blockPlaceCooldown = 0;
    this._blocksPlaced = 0; // 已放置方块计数
    this._maxBlocks = 5;   // 每只僵尸最多放置5个方块

    // 卡住检测
    this._stuckTimer = 0;
    this._stuckLastX = x;
    this._stuckLastZ = z;
  }

  getAABB() {
    return {
      minX: this.position.x - this.width / 2,
      maxX: this.position.x + this.width / 2,
      minY: this.position.y,
      maxY: this.position.y + this.height,
      minZ: this.position.z - this.width / 2,
      maxZ: this.position.z + this.width / 2,
    };
  }

  checkCollision(pos) {
    const aabb = {
      minX: pos.x - this.width / 2,
      maxX: pos.x + this.width / 2,
      minY: pos.y,
      maxY: pos.y + this.height,
      minZ: pos.z - this.width / 2,
      maxZ: pos.z + this.width / 2,
    };
    const minX = Math.floor(aabb.minX);
    const maxX = Math.floor(aabb.maxX);
    const minY = Math.floor(aabb.minY);
    const maxY = Math.floor(aabb.maxY);
    const minZ = Math.floor(aabb.minZ);
    const maxZ = Math.floor(aabb.maxZ);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const blockId = this.world.getBlock(x, y, z);
          const def = BLOCK_DEFS[blockId];
          if (def && def.solid) return true;
        }
      }
    }
    return false;
  }

  updatePhysics(dt) {
    // 冒险模式速度缩放（仅影响水平移动，不影响重力）
    const scale = this._speedScale || 1.0;
    // 重力
    this.velocity.y -= 28 * dt;
    if (this.velocity.y < -30) this.velocity.y = -30;

    // 分轴碰撞（水平速度受缩放影响）
    this.moveAxis('x', this.velocity.x * dt * scale);
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('z', this.velocity.z * dt * scale);

    // 防止掉出世界
    if (this.position.y < -10) {
      this.dead = true;
    }
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const newPos = { ...this.position };
    newPos[axis] += amount;

    if (!this.checkCollision(newPos)) {
      this.position[axis] = newPos[axis];
    } else {
      if (axis === 'y') {
        if (amount < 0) this.onGround = true;
        this.velocity.y = 0;
      } else {
        this.velocity[axis] = 0;
      }
    }
    if (axis === 'y' && amount > 0) this.onGround = false;
  }

  takeDamage(amount, attackerX, attackerZ) {
    if (this.dying || this.dead) return;
    this.health -= amount;
    this.hurtTimer = 0.3;
    // 击飞
    if (attackerX !== undefined && attackerZ !== undefined) {
      const dx = this.position.x - attackerX;
      const dz = this.position.z - attackerZ;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 5;
        this.velocity.z = (dz / len) * 5;
        this.velocity.y = 4;
      }
    }
    if (this.health <= 0) {
      this.health = 0;
      this.dying = true;
      this.deathTimer = 2.0;
    }
  }

  // 受击红色闪烁
  updateHurtFlash(dt) {
    if (!this.mesh) return;
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      const flash = this.hurtTimer > 0;
      this.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (flash) {
            // 保存原始颜色（仅第一次）
            if (child.userData._origColor === undefined) {
              child.userData._origColor = child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff);
            }
            // 将材质颜色混合为红色
            if (child.material.color) {
              child.material.color.setRGB(1, 0.15, 0.15);
            }
          }
        }
      });
    } else {
      // 恢复原始颜色
      this.mesh.traverse(child => {
        if (child.isMesh && child.material && child.userData._origColor !== undefined) {
          if (child.material.color) {
            child.material.color.copy(child.userData._origColor);
          }
          delete child.userData._origColor;
        }
      });
    }
  }

  // 倒地死亡动画
  updateDying(dt) {
    this.deathTimer -= dt;
    // 停止水平移动，保留重力
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      // 倒地旋转动画（0.5秒内倒地）
      const fallProgress = Math.min(1, (2.0 - this.deathTimer) / 0.5);
      this.mesh.rotation.z = fallProgress * (Math.PI / 2);
      // 最后0.5秒淡出
      if (this.deathTimer < 0.5) {
        const opacity = Math.max(0, this.deathTimer / 0.5);
        this.mesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = opacity;
          }
        });
      }
    }
    if (this.deathTimer <= 0) {
      this.dead = true;
    }
  }

  distanceTo(x, y, z) {
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    const dz = this.position.z - z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ===== 方块交互系统（僵尸仅放置方块） =====

  // 僵尸在指定坐标放置方块
  _placeBlockAt(bx, by, bz, blockId) {
    if (by < 0 || by >= 128) return false;
    const existing = this.world.getBlock(bx, by, bz);
    if (existing !== 0) return false; // 已有方块

    this.world.setBlock(bx, by, bz, blockId);

    // 粒子特效
    if (this.game && this.game.effects) {
      this.game.effects.createBlockBreakParticles(bx, by, bz, blockId);
    }
    // 多人同步
    if (this.game && this.game.multiplayer) {
      this.game.multiplayer.sendBlockChange(bx, by, bz, blockId);
    }
    return true;
  }

  // 方块行为主逻辑：每帧由 MobManager 调用（仅放置方块，不破坏）
  updateBlockBehavior(dt, player) {
    if (!this.canBreakBlocks || this.dying || this.dead || !player || player.dead) return;
    if (this._blocksPlaced >= this._maxBlocks) return; // 达到放置上限

    this._blockPlaceCooldown -= dt;

    const dx = player.position.x - this.position.x;
    const dy = player.position.y - this.position.y;
    const dz = player.position.z - this.position.z;
    const distH = Math.sqrt(dx * dx + dz * dz);

    // 玩家在高处且僵尸在地面上 → 放置方块垫高自己
    if (dy > 2.0 && distH < 15 && this.onGround && this._blockPlaceCooldown <= 0) {
      const bx = Math.floor(this.position.x);
      const bz = Math.floor(this.position.z);
      const footY = Math.floor(this.position.y - 0.1);
      // 使用圆石作为放置方块
      if (this._placeBlockAt(bx, footY, bz, BLOCK.COBBLESTONE)) {
        this._blocksPlaced++;
        this.velocity.y = 6;
        this.onGround = false;
        this._blockPlaceCooldown = 0.8;
      }
    }
  }

  // ===== 血量条显示系统 =====

  // 创建头顶血量条
  createHealthBar() {
    if (this._healthBarMesh) return;

    // 背景（黑色）
    const bgGeom = new THREE.PlaneGeometry(1.0, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
    this._healthBarBg = new THREE.Mesh(bgGeom, bgMat);
    this._healthBarBg.renderOrder = 999;

    // 前景（绿色血量）
    const fgGeom = new THREE.PlaneGeometry(0.96, 0.08);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.85, depthTest: false });
    this._healthBarMesh = new THREE.Mesh(fgGeom, fgMat);
    this._healthBarMesh.renderOrder = 1000;

    // 放在头顶上方
    const barY = this.height + 0.3;
    this._healthBarBg.position.set(0, barY, 0);
    this._healthBarMesh.position.set(0, barY, 0);

    if (this.mesh) {
      this.mesh.add(this._healthBarBg);
      this.mesh.add(this._healthBarMesh);
    }

    this._healthBarBaseWidth = 0.96;
  }

  // 更新血量条显示
  updateHealthBar(camera) {
    if (!this._healthBarMesh) return;

    const ratio = Math.max(0, this.health / this.maxHealth);

    // 缩放血量条宽度
    this._healthBarMesh.scale.x = ratio;
    // 调整位置使其从左对齐
    this._healthBarMesh.position.x = -(this._healthBarBaseWidth * (1 - ratio)) / 2;

    // 颜色随血量变化
    if (ratio > 0.6) {
      this._healthBarMesh.material.color.setHex(0x00ff00); // 绿
    } else if (ratio > 0.3) {
      this._healthBarMesh.material.color.setHex(0xffff00); // 黄
    } else {
      this._healthBarMesh.material.color.setHex(0xff0000); // 红
    }

    // 始终面向相机
    if (camera) {
      this._healthBarBg.lookAt(camera.position);
      this._healthBarMesh.lookAt(camera.position);
    }
  }

  serialize() {
    return {
      type: this.type,
      position: { ...this.position },
      health: this.health,
      yaw: this.yaw,
      id: this.id,
    };
  }
}

// 猪 — 被动生物
class Pig extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'pig';
    this.health = 40;
    this.maxHealth = 40;
    this.width = 0.8;
    this.height = 0.8;
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, z: 0 };
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();

    // 身体
    const bodyGeom = new THREE.BoxGeometry(0.7, 0.5, 0.9);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe0a0a0 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.4;
    group.add(body);

    // 头
    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xe0a0a0 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(0, 0.45, 0.6);
    group.add(head);

    // 鼻子
    const noseGeom = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const noseMat = new THREE.MeshLambertMaterial({ color: 0xc08080 });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.set(0, 0.4, 0.82);
    group.add(nose);

    // 腿
    const legGeom = new THREE.BoxGeometry(0.2, 0.3, 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xc08080 });
    const legPositions = [[-0.2, 0.15, 0.3], [0.2, 0.15, 0.3], [-0.2, 0.15, -0.3], [0.2, 0.15, -0.3]];
    this.legs = [];
    for (const pos of legPositions) {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    // 漫游AI
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 4;
      if (Math.random() > 0.4) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir.x = Math.cos(angle) * 1.5;
        this.wanderDir.z = Math.sin(angle) * 1.5;
        this.yaw = angle;
      } else {
        this.wanderDir.x = 0;
        this.wanderDir.z = 0;
      }
    }

    this.velocity.x = this.wanderDir.x;
    this.velocity.z = this.wanderDir.z;

    // 检查前方是否有方块阻挡，跳跃
    if (this.onGround && (Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.z) > 0)) {
      const ahead = {
        x: this.position.x + this.velocity.x * 0.5,
        y: this.position.y,
        z: this.position.z + this.velocity.z * 0.5,
      };
      const blockAhead = this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z));
      if (BLOCK_DEFS[blockAhead]?.solid) {
        this.velocity.y = 7;
        this.onGround = false;
      }
    }

    // 避开玩家
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (distToPlayer < 2 && (player.velocity.x !== 0 || player.velocity.z !== 0)) {
      // 逃跑
      const dx = this.position.x - player.position.x;
      const dz = this.position.z - player.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 3;
        this.velocity.z = (dz / len) * 3;
      }
    }

    this.updatePhysics(dt);

    // 更新网格
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;

      // 腿部摆动动画
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.008;
        for (let i = 0; i < this.legs.length; i++) {
          this.legs[i].rotation.x = Math.sin(t + i * Math.PI / 2) * 0.3;
        }
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.RAW_PORKCHOP, count: 1 + Math.floor(Math.random() * 2) }];
  }
}

// 僵尸 — 敌对生物
class Zombie extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'zombie';
    this.health = 100;
    this.maxHealth = 100;
    this.width = 0.5;
    this.height = 1.8;
    this.attackCooldown = 0;
    this.burnTimer = 0;
    this.goldValue = 100; // 冒险模式击杀金币奖励
    this.canBreakBlocks = true; // 僵尸可以破坏和建造方块
    this.createMesh();
    this.createHealthBar();
  }

  createMesh() {
    const group = new THREE.Group();

    // 身体
    const bodyGeom = new THREE.BoxGeometry(0.5, 0.7, 0.25);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 1.0;
    group.add(body);

    // 头
    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x4a7a4a });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.6;
    group.add(head);

    // 手臂
    const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });
    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-0.35, 1.0, 0.3);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(0.35, 1.0, 0.3);
    group.add(rightArm);
    this.arms = [leftArm, rightArm];

    // 腿
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.12, 0.35, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.position.set(0.12, 0.35, 0);
    group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    // 追击玩家（全图追踪）
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 2.5;
        this.velocity.z = (dz / len) * 2.5;
        this.yaw = Math.atan2(dx, dz);
      }

      // 跳跃越障
      if (this.onGround) {
        const ahead = {
          x: this.position.x + this.velocity.x * 0.4,
          y: this.position.y,
          z: this.position.z + this.velocity.z * 0.4,
        };
        const blockAhead = this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z));
        if (BLOCK_DEFS[blockAhead]?.solid) {
          this.velocity.y = 8;
          this.onGround = false;
        }
      }

      // 攻击玩家
      this.attackCooldown -= dt;
      if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
        player.takeDamage(2);
        this.attackCooldown = 1.0;
      }
    } else {
      // 漫游
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 3;
        this.velocity.x = (Math.random() - 0.5) * 1;
        this.velocity.z = (Math.random() - 0.5) * 1;
      }
    }

    // 白天燃烧
    if (this.game && this.game.sky.isDaytime()) {
      this.burnTimer += dt;
      if (this.burnTimer > 1) {
        this.takeDamage(1);
        this.burnTimer = 0;
      }
      if (this.mesh && this.hurtTimer <= 0) {
        this.mesh.children.forEach(child => {
          if (child.material && child.material.color) child.material.color.setHex(0x6a5a2a);
        });
      }
    }

    this.updatePhysics(dt);

    // 更新网格
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;

      // 行走动画
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.006;
        this.legs[0].rotation.x = Math.sin(t) * 0.4;
        this.legs[1].rotation.x = -Math.sin(t) * 0.4;
      }
      // 手臂前伸
      if (this.arms) {
        this.arms[0].rotation.x = -Math.PI / 2;
        this.arms[1].rotation.x = -Math.PI / 2;
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.TNT, count: 1 }];
  }
}

// 掉落物实体
export class ItemDrop {
  constructor(world, x, y, z, blockId, count = 1) {
    this.world = world;
    this.position = { x, y, z };
    this.velocity = { x: (Math.random() - 0.5) * 2, y: 3, z: (Math.random() - 0.5) * 2 };
    this.blockId = blockId;
    this.count = count;
    this.dead = false;
    this.lifetime = 0;
    this.pickupDelay = 0.3;
    this.mesh = null;
    this.id = Math.random().toString(36).substring(7);
    this.attracted = false; // 是否正在被玩家吸引
    this.pickedUp = false;   // 是否被玩家拾取（区分超时消失）
    this.createMesh();
  }

  createMesh() {
    const geom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const def = BLOCK_DEFS[this.blockId];
    const color = def ? 0xaaaaaa : 0xffffff;
    const mat = new THREE.MeshLambertMaterial({ color });
    this.mesh = new THREE.Mesh(geom, mat);

    // 使用纹理
    const atlas = generateTextureAtlas(THREE);
    if (atlas && def && def.textures) {
      const tileIndex = def.textures[2] !== undefined ? def.textures[2] : def.textures[0];
      const col = tileIndex % 16;
      const row = Math.floor(tileIndex / 16);
      const ts = 1 / 16;
      const uvCoords = [
        col * ts, 1 - (row + 1) * ts,
        (col + 1) * ts, 1 - (row + 1) * ts,
        (col + 1) * ts, 1 - row * ts,
        col * ts, 1 - row * ts,
      ];
      const uvAttr = [];
      for (let i = 0; i < 6; i++) {
        uvAttr.push(...uvCoords);
      }
      this.mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvAttr, 2));
      this.mesh.material = new THREE.MeshLambertMaterial({ map: atlas });
    }
  }

  update(dt, player) {
    this.lifetime += dt;
    this.pickupDelay = Math.max(0, this.pickupDelay - dt);

    // 拾取检测（优先级最高）
    if (this.pickupDelay <= 0 && player) {
      const targetY = player.position.y + 0.9;
      const dist = this.distanceTo(player.position.x, targetY, player.position.z);

      // 拾取范围
      if (dist < 3.0) {
        // 金币掉落：特殊处理
        if (this.isGold && this.gold) {
          if (this.world && this.world.game && this.world.game.onGoldPickup) {
            this.world.game.onGoldPickup(this.gold);
          } else if (player.gold !== undefined) {
            player.gold += this.gold;
          }
          this.pickedUp = true;
          this.dead = true;
          return;
        }
        const added = player.addItem(this.blockId, this.count, true);
        console.log('[PICKUP] attempt', { blockId: this.blockId, dist: dist.toFixed(2), added, inventory0: player.inventory[0] });
        if (added) {
          this.pickedUp = true;
          this.dead = true;
          return;
        }
      }

      // 吸引范围：直接移动向玩家（绕过碰撞系统）
      if (dist < 8.0) {
        this.attracted = true;
        const dx = player.position.x - this.position.x;
        const dy = targetY - this.position.y;
        const dz = player.position.z - this.position.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > 0) {
          // 直接用 lerp 移动向玩家，不经过碰撞检测
          const speed = Math.min(15, 8 + (8.0 - dist) * 1.5);
          const moveStep = Math.min(speed * dt, len); // 不超过剩余距离
          this.position.x += (dx / len) * moveStep;
          this.position.y += (dy / len) * moveStep;
          this.position.z += (dz / len) * moveStep;
        }
      } else {
        this.attracted = false;
      }
    }

    // 重力 — 被吸引时不施加重力
    if (!this.attracted) {
      this.velocity.y -= 28 * dt;
      if (this.velocity.y < -20) this.velocity.y = -20;

      // 移动碰撞（仅未被吸引时）
      this.moveWithCollision(dt);
    }

    // 旋转动画
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y + 0.15, this.position.z);
      this.mesh.rotation.y += dt * 2;
      if (!this.attracted) {
        this.mesh.position.y += Math.sin(this.lifetime * 3) * 0.02;
      }
    }

    // 5分钟后消失
    if (this.lifetime > 300) this.dead = true;
  }

  moveWithCollision(dt) {
    const w = 0.15;
    const move = (axis, amount) => {
      if (amount === 0) return;
      const newPos = { ...this.position };
      newPos[axis] += amount;
      const aabb = {
        minX: newPos.x - w, maxX: newPos.x + w,
        minY: newPos.y, maxY: newPos.y + 0.3,
        minZ: newPos.z - w, maxZ: newPos.z + w,
      };
      let collision = false;
      for (let x = Math.floor(aabb.minX); x <= Math.floor(aabb.maxX); x++) {
        for (let y = Math.floor(aabb.minY); y <= Math.floor(aabb.maxY); y++) {
          for (let z = Math.floor(aabb.minZ); z <= Math.floor(aabb.maxZ); z++) {
            const blockId = this.world.getBlock(x, y, z);
            if (BLOCK_DEFS[blockId]?.solid) { collision = true; break; }
          }
          if (collision) break;
        }
        if (collision) break;
      }
      if (!collision) {
        this.position[axis] = newPos[axis];
      } else {
        if (axis === 'y' && amount < 0) this.velocity.y = 0;
        if (axis === 'y' && amount > 0) this.velocity.y = 0;
        if (axis !== 'y') this.velocity[axis] = 0;
      }
    };

    move('x', this.velocity.x * dt);
    move('y', this.velocity.y * dt);
    move('z', this.velocity.z * dt);
  }

  distanceTo(x, y, z) {
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    const dz = this.position.z - z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// 苦力怕 — 会爆炸的敌对生物
class Creeper extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'creeper';
    this.health = 20;
    this.maxHealth = 20;
    this.width = 0.6;
    this.height = 1.7;
    this.fuseTimer = 0;
    this.exploding = false;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const greenMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a });
    const darkGreenMat = new THREE.MeshLambertMaterial({ color: 0x2a5a1a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), greenMat);
    body.position.y = 0.8;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), greenMat);
    head.position.y = 1.6;
    group.add(head);

    // 脸
    const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.05), new THREE.MeshLambertMaterial({ color: 0x000000 }));
    eye1.position.set(-0.12, 1.65, 0.26);
    group.add(eye1);
    const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.05), new THREE.MeshLambertMaterial({ color: 0x000000 }));
    eye2.position.set(0.12, 1.65, 0.26);
    group.add(eye2);

    // 四条腿
    const legGeom = new THREE.BoxGeometry(0.2, 0.3, 0.2);
    this.legs = [];
    for (const pos of [[-0.15, 0.15, 0.15], [0.15, 0.15, 0.15], [-0.15, 0.15, -0.15], [0.15, 0.15, -0.15]]) {
      const leg = new THREE.Mesh(legGeom, darkGreenMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    if (distToPlayer < 16 && !player.dead) {
      if (distToPlayer < 3) {
        // 开始引信
        this.exploding = true;
        this.fuseTimer += dt;
        this.velocity.x = 0;
        this.velocity.z = 0;

        // 闪烁白色
        if (this.mesh) {
          const flash = Math.sin(this.fuseTimer * 15) > 0;
          this.mesh.children.forEach(child => {
            if (child.material && child.material.color) {
              child.material.color.setHex(flash ? 0xffffff : 0x4a7a2a);
            }
          });
        }

        if (this.fuseTimer >= 1.5) {
          // 爆炸！
          if (this.game && this.game.effects) {
            this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 3);
          }
          this.dead = true;
          return;
        }
      } else {
        this.exploding = false;
        this.fuseTimer = 0;
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0) {
          this.velocity.x = (dx / len) * 2.0;
          this.velocity.z = (dz / len) * 2.0;
          this.yaw = Math.atan2(dx, dz);
        }

        if (this.onGround) {
          const ahead = {
            x: this.position.x + this.velocity.x * 0.4,
            y: this.position.y,
            z: this.position.z + this.velocity.z * 0.4,
          };
          const blockAhead = this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z));
          if (BLOCK_DEFS[blockAhead]?.solid) {
            this.velocity.y = 7;
            this.onGround = false;
          }
        }
      }
    } else {
      this.exploding = false;
      this.fuseTimer = 0;
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 3;
        this.velocity.x = (Math.random() - 0.5) * 1;
        this.velocity.z = (Math.random() - 0.5) * 1;
      }
    }

    this.updatePhysics(dt);

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.006;
        this.legs[0].rotation.x = Math.sin(t) * 0.4;
        this.legs[1].rotation.x = -Math.sin(t) * 0.4;
        this.legs[2].rotation.x = -Math.sin(t) * 0.4;
        this.legs[3].rotation.x = Math.sin(t) * 0.4;
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.TNT, count: 1 }];
  }
}

// 骷髅 — 远程攻击
class Skeleton extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'skeleton';
    this.health = 20;
    this.maxHealth = 20;
    this.width = 0.5;
    this.height = 1.8;
    this.attackCooldown = 0;
    this.burnTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const boneMat = new THREE.MeshLambertMaterial({ color: 0xe8e8d0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), boneMat);
    body.position.y = 1.0;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), boneMat);
    head.position.y = 1.6;
    group.add(head);

    // 弓
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x8b6235 }));
    bow.position.set(0.4, 1.0, 0.2);
    group.add(bow);

    this.arms = [];
    const armGeom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    for (const pos of [[-0.35, 1.0, 0], [0.35, 1.0, 0]]) {
      const arm = new THREE.Mesh(armGeom, boneMat);
      arm.position.set(...pos);
      group.add(arm);
      this.arms.push(arm);
    }

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    for (const pos of [[-0.12, 0.35, 0], [0.12, 0.35, 0]]) {
      const leg = new THREE.Mesh(legGeom, boneMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    if (distToPlayer < 16 && !player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len > 8) {
        if (len > 0) {
          this.velocity.x = (dx / len) * 2.0;
          this.velocity.z = (dz / len) * 2.0;
        }
        this.yaw = Math.atan2(dx, dz);
      } else if (len < 5) {
        // 后退
        if (len > 0) {
          this.velocity.x = -(dx / len) * 1.5;
          this.velocity.z = -(dz / len) * 1.5;
        }
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
      this.yaw = Math.atan2(dx, dz);

      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.4, y: this.position.y, z: this.position.z + this.velocity.z * 0.4 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 8;
          this.onGround = false;
        }
      }

      this.attackCooldown -= dt;
      if (distToPlayer < 12 && this.attackCooldown <= 0) {
        // 射箭
        this.attackCooldown = 2.0;
        if (this.game && this.game.effects) {
          // 简化版：直接伤害
          player.takeDamage(3);
          this.game.effects.showDamageNumber(player.position.x, player.position.y + 1, player.position.z, 3);
        }
      }
    } else {
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 3;
        this.velocity.x = (Math.random() - 0.5) * 1;
        this.velocity.z = (Math.random() - 0.5) * 1;
      }
    }

    if (this.game && this.game.sky.isDaytime()) {
      this.burnTimer += dt;
      if (this.burnTimer > 1) {
        this.takeDamage(1);
        this.burnTimer = 0;
      }
    }

    this.updatePhysics(dt);

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.006;
        this.legs[0].rotation.x = Math.sin(t) * 0.4;
        this.legs[1].rotation.x = -Math.sin(t) * 0.4;
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() { return [{ id: BLOCK.BONE, count: 2 }, { id: BLOCK.ARROW, count: 2 }]; }
}

// 牛 — 被动生物
class Cow extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'cow';
    this.health = 40;
    this.maxHealth = 40;
    this.width = 0.8;
    this.height = 1.2;
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, z: 0 };
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const brownMat = new THREE.MeshLambertMaterial({ color: 0x6b4a25 });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), brownMat);
    body.position.y = 0.7;
    group.add(body);
    // 斑点
    for (let i = 0; i < 3; i++) {
      const spot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), whiteMat);
      spot.position.set((Math.random() - 0.5) * 0.6, 1.0, (Math.random() - 0.5) * 0.8);
      group.add(spot);
    }

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), brownMat);
    head.position.set(0, 0.7, 0.8);
    group.add(head);

    // 角
    for (const pos of [[-0.15, 0.95, 0.85], [0.15, 0.95, 0.85]]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), whiteMat);
      horn.position.set(...pos);
      group.add(horn);
    }

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    for (const pos of [[-0.25, 0.2, 0.4], [0.25, 0.2, 0.4], [-0.25, 0.2, -0.4], [0.25, 0.2, -0.4]]) {
      const leg = new THREE.Mesh(legGeom, brownMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 3 + Math.random() * 5;
      if (Math.random() > 0.5) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir.x = Math.cos(angle) * 1.2;
        this.wanderDir.z = Math.sin(angle) * 1.2;
        this.yaw = angle;
      } else {
        this.wanderDir.x = 0;
        this.wanderDir.z = 0;
      }
    }
    this.velocity.x = this.wanderDir.x;
    this.velocity.z = this.wanderDir.z;
    if (this.onGround && (Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.z) > 0)) {
      const ahead = { x: this.position.x + this.velocity.x * 0.5, y: this.position.y, z: this.position.z + this.velocity.z * 0.5 };
      if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
        this.velocity.y = 7;
        this.onGround = false;
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.006;
        this.legs[0].rotation.x = Math.sin(t) * 0.3;
        this.legs[1].rotation.x = -Math.sin(t) * 0.3;
        this.legs[2].rotation.x = -Math.sin(t) * 0.3;
        this.legs[3].rotation.x = Math.sin(t) * 0.3;
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() { return [{ id: BLOCK.RAW_BEEF, count: 1 + Math.floor(Math.random() * 2) }, { id: BLOCK.LEATHER, count: 1 + Math.floor(Math.random() * 2) }]; }
}

// 羊 — 可剪毛
class Sheep extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'sheep';
    this.health = 32;
    this.maxHealth = 32;
    this.width = 0.7;
    this.height = 1.0;
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, z: 0 };
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const woolMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8c4a0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.0), woolMat);
    body.position.y = 0.7;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
    head.position.set(0, 0.75, 0.65);
    group.add(head);

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.15, 0.35, 0.15);
    for (const pos of [[-0.2, 0.18, 0.3], [0.2, 0.18, 0.3], [-0.2, 0.18, -0.3], [0.2, 0.18, -0.3]]) {
      const leg = new THREE.Mesh(legGeom, skinMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 3 + Math.random() * 5;
      if (Math.random() > 0.5) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir.x = Math.cos(angle) * 1.0;
        this.wanderDir.z = Math.sin(angle) * 1.0;
        this.yaw = angle;
      } else { this.wanderDir.x = 0; this.wanderDir.z = 0; }
    }
    this.velocity.x = this.wanderDir.x;
    this.velocity.z = this.wanderDir.z;
    if (this.onGround && (Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.z) > 0)) {
      const ahead = { x: this.position.x + this.velocity.x * 0.5, y: this.position.y, z: this.position.z + this.velocity.z * 0.5 };
      if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
        this.velocity.y = 6;
        this.onGround = false;
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.008;
        this.legs[0].rotation.x = Math.sin(t) * 0.3;
        this.legs[1].rotation.x = -Math.sin(t) * 0.3;
        this.legs[2].rotation.x = -Math.sin(t) * 0.3;
        this.legs[3].rotation.x = Math.sin(t) * 0.3;
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return [{ id: BLOCK.RAW_MUTTON, count: 1 + Math.floor(Math.random() * 2) }, { id: BLOCK.LEATHER, count: 1 }]; }
}

// 鸡 — 小型飞行生物
class Chicken extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'chicken';
    this.health = 16;
    this.maxHealth = 16;
    this.width = 0.4;
    this.height = 0.6;
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, z: 0 };
    this.flapTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    const yellowMat = new THREE.MeshLambertMaterial({ color: 0xffdd00 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.5), whiteMat);
    body.position.y = 0.3;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), whiteMat);
    head.position.set(0, 0.55, 0.3);
    group.add(head);

    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), yellowMat);
    beak.position.set(0, 0.55, 0.42);
    group.add(beak);

    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.15), redMat);
    comb.position.set(0, 0.68, 0.3);
    group.add(comb);

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.05, 0.2, 0.05);
    for (const pos of [[-0.1, 0.1, 0], [0.1, 0.1, 0]]) {
      const leg = new THREE.Mesh(legGeom, yellowMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 4;
      if (Math.random() > 0.4) {
        const angle = Math.random() * Math.PI * 2;
        this.wanderDir.x = Math.cos(angle) * 0.8;
        this.wanderDir.z = Math.sin(angle) * 0.8;
        this.yaw = angle;
        // 随机跳跃
        if (this.onGround && Math.random() > 0.5) {
          this.velocity.y = 4;
          this.onGround = false;
        }
      } else { this.wanderDir.x = 0; this.wanderDir.z = 0; }
    }
    this.velocity.x = this.wanderDir.x;
    this.velocity.z = this.wanderDir.z;
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      this.flapTimer += dt;
      if (!this.onGround || Math.abs(this.velocity.x) > 0.1) {
        // 翅膀拍动
        this.mesh.rotation.z = Math.sin(this.flapTimer * 10) * 0.1;
      } else {
        this.mesh.rotation.z = 0;
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return [{ id: BLOCK.RAW_CHICKEN, count: 1 }, { id: BLOCK.FEATHER, count: 1 + Math.floor(Math.random() * 2) }]; }
}

// 蜘蛛 — 会爬墙的敌对生物
class Spider extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'spider';
    this.health = 16;
    this.maxHealth = 16;
    this.width = 0.7;
    this.height = 0.5;
    this.attackCooldown = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xaa0000 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.8), blackMat);
    body.position.y = 0.25;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), blackMat);
    head.position.set(0, 0.25, 0.5);
    group.add(head);

    // 红眼
    for (const pos of [[-0.1, 0.3, 0.6], [0.1, 0.3, 0.6]]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), redMat);
      eye.position.set(...pos);
      group.add(eye);
    }

    // 腿
    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    for (let i = 0; i < 8; i++) {
      const leg = new THREE.Mesh(legGeom, blackMat);
      const side = i < 4 ? -1 : 1;
      const offset = (i % 4) * 0.2 - 0.3;
      leg.position.set(side * 0.35, 0.15, offset);
      leg.rotation.z = side * 0.5;
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    if (distToPlayer < 12 && !player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 3.0;
        this.velocity.z = (dz / len) * 3.0;
        this.yaw = Math.atan2(dx, dz);
      }
      // 爬墙
      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.4, y: this.position.y, z: this.position.z + this.velocity.z * 0.4 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 6;
          this.onGround = false;
        }
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
        player.takeDamage(2);
        this.attackCooldown = 1.0;
      }
    } else {
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 3;
        this.velocity.x = (Math.random() - 0.5) * 1.5;
        this.velocity.z = (Math.random() - 0.5) * 1.5;
      }
    }

    this.updatePhysics(dt);

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.012;
        for (let i = 0; i < this.legs.length; i++) {
          this.legs[i].rotation.x = Math.sin(t + i * 0.5) * 0.3;
        }
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return [{ id: BLOCK.STRING_ITEM, count: 2 }]; }
}

// 末影人 — 会瞬移、怕水的敌对生物
class Enderman extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'enderman';
    this.health = 40;
    this.maxHealth = 40;
    this.width = 0.6;
    this.height = 2.9;
    this.attackCooldown = 0;
    this.teleportTimer = 0;
    this.aggro = false;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
    const purpleMat = new THREE.MeshLambertMaterial({ color: 0xaa00ff, emissive: 0x550066 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 0.3), blackMat);
    body.position.y = 1.5;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), blackMat);
    head.position.y = 2.7;
    group.add(head);

    // 紫色眼睛
    for (const pos of [[-0.12, 2.7, 0.26], [0.12, 2.7, 0.26]]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), purpleMat);
      eye.position.set(...pos);
      group.add(eye);
    }

    // 长手臂
    this.arms = [];
    const armGeom = new THREE.BoxGeometry(0.2, 1.4, 0.2);
    for (const pos of [[-0.4, 1.2, 0], [0.4, 1.2, 0]]) {
      const arm = new THREE.Mesh(armGeom, blackMat);
      arm.position.set(...pos);
      group.add(arm);
      this.arms.push(arm);
    }

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.2, 1.0, 0.2);
    for (const pos of [[-0.15, 0.5, 0], [0.15, 0.5, 0]]) {
      const leg = new THREE.Mesh(legGeom, blackMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    // 瞬移
    this.teleportTimer -= dt;
    if (this.teleportTimer <= 0 && distToPlayer < 20) {
      this.teleportTimer = 2 + Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 10;
      const tx = player.position.x + Math.cos(angle) * dist;
      const tz = player.position.z + Math.sin(angle) * dist;
      // 找安全Y坐标
      for (let ty = 60; ty > 0; ty--) {
        const block = this.world.getBlock(Math.floor(tx), ty, Math.floor(tz));
        const above = this.world.getBlock(Math.floor(tx), ty + 1, Math.floor(tz));
        if (BLOCK_DEFS[block]?.solid && above === 0) {
          this.position.x = tx;
          this.position.y = ty + 1;
          this.position.z = tz;
          // 粒子效果
          if (this.game?.effects) {
            this.game.effects.createBlockBreakParticles(Math.floor(tx), ty, Math.floor(tz), 0xaa00ff);
          }
          break;
        }
      }
    }

    // 追击玩家
    if (distToPlayer < 16 && !player.dead) {
      this.aggro = true;
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 3.5;
        this.velocity.z = (dz / len) * 3.5;
        this.yaw = Math.atan2(dx, dz);
      }
      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.4, y: this.position.y, z: this.position.z + this.velocity.z * 0.4 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 10;
          this.onGround = false;
        }
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 2 && this.attackCooldown <= 0) {
        player.takeDamage(4);
        this.attackCooldown = 1.0;
        // 攻击后瞬移
        this.teleportTimer = 0;
      }
    } else {
      this.aggro = false;
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 3 + Math.random() * 4;
        this.velocity.x = (Math.random() - 0.5) * 1.5;
        this.velocity.z = (Math.random() - 0.5) * 1.5;
      }
    }

    // 遇水伤害
    const blockBelow = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.1), Math.floor(this.position.z));
    if (blockBelow === BLOCK.WATER) {
      this.takeDamage(1);
    }

    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      // 手臂前伸（攻击姿态）
      if (this.aggro && this.arms) {
        this.arms[0].rotation.x = -Math.PI / 2.5;
        this.arms[1].rotation.x = -Math.PI / 2.5;
      } else if (this.arms) {
        this.arms[0].rotation.x = 0;
        this.arms[1].rotation.x = 0;
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.END_STONE, count: 1 }];
  }
}

// 史莱姆 — 可分裂的弹跳生物
class Slime extends Entity {
  constructor(world, x, y, z, size = 2) {
    super(world, x, y, z);
    this.type = 'slime';
    this.size = size; // 1=small, 2=medium, 3=large
    this.health = 4 * size;
    this.maxHealth = this.health;
    this.width = 0.5 * size;
    this.height = 0.5 * size;
    this.jumpTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const greenMat = new THREE.MeshLambertMaterial({ color: 0x55aa33, transparent: true, opacity: 0.85 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, this.width), greenMat);
    body.position.y = this.height / 2;
    group.add(body);

    // 眼睛
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    for (const pos of [[-0.08 * this.size, this.height * 0.7, this.width * 0.4], [0.08 * this.size, this.height * 0.7, this.width * 0.4]]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
      eye.position.set(pos[0] + 0, pos[1], pos[2] - 0);
      group.add(eye);
    }

    this.mesh = group;
    this.bodyMesh = body;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0 && this.onGround) {
      this.jumpTimer = 1 + Math.random() * 2;
      // 跳向玩家
      if (distToPlayer < 16 && !player.dead) {
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0) {
          this.velocity.x = (dx / len) * 3;
          this.velocity.z = (dz / len) * 3;
        }
        this.yaw = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
      } else {
        const angle = Math.random() * Math.PI * 2;
        this.velocity.x = Math.cos(angle) * 2;
        this.velocity.z = Math.sin(angle) * 2;
      }
      this.velocity.y = 6 + this.size * 2;
      this.onGround = false;
    }

    // 攻击
    if (distToPlayer < 1.5 && this.attackCooldown <= 0 && !player.dead) {
      player.takeDamage(this.size * 2);
      this.attackCooldown = 1.0;
    }
    this.attackCooldown = Math.max(0, (this.attackCooldown || 0) - dt);

    this.updatePhysics(dt);

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      // 弹跳压缩动画
      if (this.bodyMesh) {
        if (!this.onGround) {
          this.bodyMesh.scale.y = 0.7;
          this.bodyMesh.scale.x = 1.2;
          this.bodyMesh.scale.z = 1.2;
        } else {
          this.bodyMesh.scale.y = 1.0;
          this.bodyMesh.scale.x = 1.0;
          this.bodyMesh.scale.z = 1.0;
        }
      }
    }
    this.updateHurtFlash(dt);
  }

  takeDamage(amount) {
    super.takeDamage(amount);
    if (this.dying) {
      // 分裂
      if (this.size > 1) {
        const newSize = this.size - 1;
        if (this.game?.mobs) {
          for (let i = 0; i < 2; i++) {
            const slime = new Slime(this.world, this.position.x + (Math.random() - 0.5) * 2, this.position.y, this.position.z + (Math.random() - 0.5) * 2, newSize);
            slime.game = this.game;
            this.game.mobs.mobs.push(slime);
            if (slime.mesh) this.game.scene.add(slime.mesh);
          }
        }
      }
    }
  }

  onDeath() {
    return this.size === 1 ? [{ id: BLOCK.SLIME_BLOCK, count: 1 }] : [];
  }
}

// 铁傀儡 — 守护型中立生物
class IronGolem extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'iron_golem';
    this.health = 100;
    this.maxHealth = 100;
    this.width = 1.4;
    this.height = 2.7;
    this.attackCooldown = 0;
    this.wanderTimer = 0;
    this.hostile = false; // 是否对玩家敌对
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const ironMat = new THREE.MeshLambertMaterial({ color: 0xccccdd });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x888899 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), ironMat);
    body.position.y = 1.6;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), ironMat);
    head.position.y = 2.7;
    group.add(head);

    // 大手臂
    this.arms = [];
    const armGeom = new THREE.BoxGeometry(0.4, 1.5, 0.4);
    for (const pos of [[-0.8, 1.6, 0], [0.8, 1.6, 0]]) {
      const arm = new THREE.Mesh(armGeom, ironMat);
      arm.position.set(...pos);
      group.add(arm);
      this.arms.push(arm);
    }

    this.legs = [];
    const legGeom = new THREE.BoxGeometry(0.5, 1.0, 0.5);
    for (const pos of [[-0.35, 0.5, 0], [0.35, 0.5, 0]]) {
      const leg = new THREE.Mesh(legGeom, darkMat);
      leg.position.set(...pos);
      group.add(leg);
      this.legs.push(leg);
    }

    // 蔓藤装饰
    const vineMat = new THREE.MeshLambertMaterial({ color: 0x3a7a25 });
    for (let i = 0; i < 3; i++) {
      const vine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), vineMat);
      vine.position.set(-0.4 + i * 0.4, 1.2, 0.41);
      group.add(vine);
    }

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    if (this.hostile && distToPlayer < 20 && !player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 2.0;
        this.velocity.z = (dz / len) * 2.0;
        this.yaw = Math.atan2(dx, dz);
      }
      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.4, y: this.position.y, z: this.position.z + this.velocity.z * 0.4 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 8;
          this.onGround = false;
        }
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 2.5 && this.attackCooldown <= 0) {
        player.takeDamage(7);
        // 强击退
        const kdx = player.position.x - this.position.x;
        const kdz = player.position.z - this.position.z;
        const klen = Math.sqrt(kdx * kdx + kdz * kdz);
        if (klen > 0) {
          player.velocity.x = (kdx / klen) * 8;
          player.velocity.z = (kdz / klen) * 8;
          player.velocity.y = 5;
        }
        this.attackCooldown = 1.5;
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 4 + Math.random() * 6;
        this.velocity.x = (Math.random() - 0.5) * 1;
        this.velocity.z = (Math.random() - 0.5) * 1;
      }
    }

    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.004;
        this.legs[0].rotation.x = Math.sin(t) * 0.3;
        this.legs[1].rotation.x = -Math.sin(t) * 0.3;
        if (this.attackCooldown > 1.0) {
          this.arms[0].rotation.x = -Math.PI / 3;
          this.arms[1].rotation.x = -Math.PI / 3;
        } else {
          this.arms[0].rotation.x = Math.sin(t) * 0.2;
          this.arms[1].rotation.x = -Math.sin(t) * 0.2;
        }
      }
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.IRON_INGOT, count: 3 }, { id: BLOCK.IRON_BLOCK, count: 1 }];
  }
}

// 凋零Boss — 三头Boss
class WitherBoss extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'wither';
    this.health = 300;
    this.maxHealth = 300;
    this.width = 0.9;
    this.height = 3.5;
    this.attackCooldown = 0;
    this.phase = 1; // 1=护甲, 2=无护甲
    this.flyHeight = y;
    this.witherTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const soulMat = new THREE.MeshLambertMaterial({ color: 0x444444 });

    // 中心身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), darkMat);
    body.position.y = 1.8;
    group.add(body);

    // 三个头
    this.heads = [];
    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    for (const pos of [[-0.6, 2.2, 0], [0, 2.5, 0], [0.6, 2.2, 0]]) {
      const head = new THREE.Mesh(headGeom, darkMat);
      head.position.set(...pos);
      group.add(head);
      this.heads.push(head);
    }

    // 翅膀
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const wingGeom = new THREE.BoxGeometry(0.1, 0.6, 1.0);
    for (const pos of [[-0.5, 1.8, 0], [0.5, 1.8, 0]]) {
      const wing = new THREE.Mesh(wingGeom, wingMat);
      wing.position.set(...pos);
      group.add(wing);
    }

    this.mesh = group;
    this.bodyMesh = body;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    // 飞行（无重力）
    this.velocity.y = 0;
    // 在玩家上方盘旋
    if (distToPlayer < 30) {
      const targetY = player.position.y + 5;
      this.position.y += (targetY - this.position.y) * dt * 0.5;

      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 8) {
        this.velocity.x = (dx / len) * 3;
        this.velocity.z = (dz / len) * 3;
      } else if (len < 4) {
        this.velocity.x = -(dx / len) * 2;
        this.velocity.z = -(dz / len) * 2;
      } else {
        // 盘旋
        const angle = Date.now() * 0.0005;
        this.velocity.x = Math.cos(angle) * 3;
        this.velocity.z = Math.sin(angle) * 3;
      }
      this.yaw = Math.atan2(dx, dz);
    }

    // 攻击：发射凋零骷髅头
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && distToPlayer < 20 && !player.dead) {
      this.attackCooldown = 2.0;
      const eye = { x: this.position.x, y: this.position.y + 2.5, z: this.position.z };
      const dir = {
        x: player.position.x - eye.x,
        y: player.position.y + 1 - eye.y,
        z: player.position.z - eye.z,
      };
      const dlen = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      if (dlen > 0 && this.game?.ranged) {
        this.game.ranged.shootWitherSkull(eye.x, eye.y, eye.z, { x: dir.x / dlen, y: dir.y / dlen, z: dir.z / dlen }, this, 8);
      }
    }

    // 凋零效果（持续伤害附近玩家）
    this.witherTimer += dt;
    if (this.witherTimer > 1 && distToPlayer < 3) {
      this.witherTimer = 0;
      player.takeDamage(2);
    }

    // 阶段切换
    if (this.phase === 1 && this.health < this.maxHealth / 2) {
      this.phase = 2;
      if (this.game?.ui) this.game.ui.showToast('凋零进入了第二阶段！');
      if (this.bodyMesh) {
        this.bodyMesh.material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
      }
    }

    // 自由移动（无碰撞）
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      // 头部转动
      for (let i = 0; i < this.heads.length; i++) {
        this.heads[i].rotation.y = Math.sin(Date.now() * 0.003 + i) * 0.3;
      }
    }
    this.updateHurtFlash(dt);
  }

  takeDamage(amount) {
    if (this.phase === 1) {
      // 第一阶段减少伤害
      amount *= 0.2;
    }
    super.takeDamage(amount);
  }

  onDeath() {
    return [
      { id: BLOCK.NETHER_STAR, count: 1 },
      { id: BLOCK.BONE, count: 3 },
    ];
  }
}

// 末影龙Boss — 终极Boss
class EnderDragon extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'ender_dragon';
    this.health = 200;
    this.maxHealth = 200;
    this.width = 4.0;
    this.height = 3.0;
    this.attackCooldown = 0;
    this.flyTimer = 0;
    this.phase = 1;
    this.healTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const dragonMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2a });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff00ff, emissive: 0x660066 });

    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 3.0), dragonMat);
    body.position.y = 1.5;
    group.add(body);

    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), dragonMat);
    head.position.set(0, 1.8, 2.0);
    group.add(head);
    this.head = head;

    // 眼睛
    for (const pos of [[-0.2, 2.0, 2.5], [0.2, 2.0, 2.5]]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), eyeMat);
      eye.position.set(...pos);
      group.add(eye);
    }

    // 翅膀
    this.wings = [];
    const wingGeom = new THREE.BoxGeometry(3.0, 0.2, 1.5);
    for (const pos of [[-2.0, 1.8, 0], [2.0, 1.8, 0]]) {
      const wing = new THREE.Mesh(wingGeom, dragonMat);
      wing.position.set(...pos);
      group.add(wing);
      this.wings.push(wing);
    }

    // 尾巴
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.0), dragonMat);
    tail.position.set(0, 1.5, -2.0);
    group.add(tail);
    this.tail = tail;

    this.mesh = group;
    this.bodyMesh = body;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);

    // 飞行模式：围绕玩家盘旋
    this.velocity.y = 0;
    this.flyTimer += dt;

    if (distToPlayer < 40) {
      const angle = this.flyTimer * 0.3;
      const radius = 12;
      const targetX = player.position.x + Math.cos(angle) * radius;
      const targetZ = player.position.z + Math.sin(angle) * radius;
      const targetY = player.position.y + 8 + Math.sin(this.flyTimer * 0.5) * 3;

      this.velocity.x = (targetX - this.position.x) * 2;
      this.velocity.z = (targetZ - this.position.z) * 2;
      this.velocity.y = (targetY - this.position.y) * 2;
      this.yaw = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    }

    // 俯冲攻击
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && distToPlayer < 20 && !player.dead) {
      this.attackCooldown = 5.0;
      // 发射火球
      const eye = { x: this.position.x, y: this.position.y + 2, z: this.position.z };
      const dir = {
        x: player.position.x - eye.x,
        y: player.position.y + 1 - eye.y,
        z: player.position.z - eye.z,
      };
      const dlen = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      if (dlen > 0 && this.game?.ranged) {
        this.game.ranged.shootFireball(eye.x, eye.y, eye.z, { x: dir.x / dlen, y: dir.y / dlen, z: dir.z / dlen }, this, 8);
      }
    }

    // 近战伤害
    if (distToPlayer < 3) {
      player.takeDamage(10);
      const kdx = player.position.x - this.position.x;
      const kdz = player.position.z - this.position.z;
      const klen = Math.sqrt(kdx * kdx + kdz * kdz);
      if (klen > 0) {
        player.velocity.x = (kdx / klen) * 10;
        player.velocity.z = (kdz / klen) * 10;
        player.velocity.y = 6;
      }
    }

    // 自由移动
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      // 翅膀拍动
      if (this.wings) {
        const flap = Math.sin(this.flyTimer * 4) * 0.4;
        this.wings[0].rotation.z = flap;
        this.wings[1].rotation.z = -flap;
      }
      // 尾巴摆动
      if (this.tail) {
        this.tail.rotation.y = Math.sin(this.flyTimer * 2) * 0.2;
      }
    }
    this.updateHurtFlash(dt);
  }

  takeDamage(amount) {
    super.takeDamage(amount);
    if (this.health < this.maxHealth / 2 && this.phase === 1) {
      this.phase = 2;
      if (this.game?.ui) this.game.ui.showToast('末影龙愤怒了！');
    }
  }

  onDeath() {
    if (this.game?.achievements) {
      this.game.achievements.unlock('dragon_slayer');
    }
    if (this.game?.ui) {
      this.game.ui.showToast('🏆 你击败了末影龙！');
    }
    return [
      { id: BLOCK.DRAGON_EGG, count: 1 },
      { id: BLOCK.NETHER_STAR, count: 1 },
    ];
  }
}

// 鱼 — 水生被动生物
class Fish extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'fish';
    this.health = 3;
    this.maxHealth = 3;
    this.width = 0.3;
    this.height = 0.3;
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, y: 0, z: 0 };
    this.outOfWaterTimer = 0;
    this.createMesh();
  }

  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xc0c0e0 });
    const finMat = new THREE.MeshLambertMaterial({ color: 0x8080a0 });

    // 鱼身（纺样形）
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), bodyMat);
    body.position.y = 0.15;
    group.add(body);

    // 尾巴
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.15), finMat);
    tail.position.set(0, 0.15, -0.3);
    group.add(tail);

    // 背鳍
    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.15), finMat);
    dorsal.position.set(0, 0.25, 0);
    group.add(dorsal);

    // 眼睛
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), eyeMat);
    eyeL.position.set(-0.08, 0.2, 0.2);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), eyeMat);
    eyeR.position.set(0.08, 0.2, 0.2);
    group.add(eyeR);

    this.mesh = group;
  }

  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }

    // 检查是否在水中
    const blockAt = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.15),
      Math.floor(this.position.z)
    );
    const inWater = blockAt === BLOCK.WATER;

    if (!inWater) {
      this.outOfWaterTimer += dt;
      // 离水太久受伤
      if (this.outOfWaterTimer > 3) {
        this.takeDamage(1);
        this.outOfWaterTimer = 0;
      }
      // 扑跳
      if (this.onGround && Math.random() < 0.1) {
        this.velocity.y = 4;
      }
    } else {
      this.outOfWaterTimer = 0;
    }

    // 漫游AI
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1 + Math.random() * 3;
      if (inWater) {
        // 在水中三维方向漫游
        const angle = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * 0.5;
        this.wanderDir.x = Math.cos(angle) * 2;
        this.wanderDir.z = Math.sin(angle) * 2;
        this.wanderDir.y = pitch * 2;
        this.yaw = angle;
      } else {
        this.wanderDir.x = 0;
        this.wanderDir.y = 0;
        this.wanderDir.z = 0;
      }
    }

    if (inWater) {
      // 水中游泳：不施加重力，自由移动
      this.velocity.x = this.wanderDir.x;
      this.velocity.y = this.wanderDir.y;
      this.velocity.z = this.wanderDir.z;
      // 水中阻力
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
      this.velocity.y *= 0.9;
      // 微浮力
      this.velocity.y += 2 * dt;

      // 直接更新位置（水中不检查碰撞）
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;
      this.onGround = false;
    } else {
      // 地面物理
      this.velocity.x = this.wanderDir.x;
      this.velocity.z = this.wanderDir.z;
      this.updatePhysics(dt);
    }

    // 避开玩家
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (distToPlayer < 2) {
      const dx = this.position.x - player.position.x;
      const dz = this.position.z - player.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 3;
        this.velocity.z = (dz / len) * 3;
      }
    }

    // 更新网格
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
    }
    this.updateHurtFlash(dt);
  }

  onDeath() {
    return [{ id: BLOCK.RAW_BEEF, count: 1 }];
  }
}

// 生物管理器
// ===== 冒险模式新增怪物 =====

// 疾跑僵尸 — 2×移动速度，低血
class FastZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'fast_z';
    this.health = 60;
    this.maxHealth = 60;
this.goldValue = 10;
this.createMesh();
}
createMesh() {
const group = new THREE.Group();
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), bodyMat);
    body.position.y = 1.0; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0xaa3a3a }));
    head.position.y = 1.6; group.add(head);
    const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftArm = new THREE.Mesh(armGeom, bodyMat); leftArm.position.set(-0.35, 1.0, 0.3); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat); rightArm.position.set(0.35, 1.0, 0.3); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x5a1a1a })); leftLeg.position.set(-0.12, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x5a1a1a })); rightLeg.position.set(0.12, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 5.0;
        this.velocity.z = (dz / len) * 5.0;
        this.yaw = Math.atan2(dx, dz);
      }
      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.3, y: this.position.y, z: this.position.z + this.velocity.z * 0.3 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 8; this.onGround = false;
        }
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
        player.takeDamage(2); this.attackCooldown = 0.8;
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.012;
        this.legs[0].rotation.x = Math.sin(t) * 0.6;
        this.legs[1].rotation.x = -Math.sin(t) * 0.6;
      }
      if (this.arms) { this.arms[0].rotation.x = -Math.PI / 2; this.arms[1].rotation.x = -Math.PI / 2; }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// 爬行者 — 贴地爬行，从下方攻击
class CrawlerZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'crawler';
    this.health = 80;
    this.maxHealth = 80;
this.height = 0.5;
this.width = 0.5;
this.goldValue = 10;
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a6a2a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), bodyMat);
    body.position.y = 0.25; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), new THREE.MeshLambertMaterial({ color: 0x6a8a4a }));
    head.position.set(0, 0.3, 0.35); group.add(head);
    const legGeom = new THREE.BoxGeometry(0.15, 0.15, 0.3);
    const positions = [[-0.2, 0.1, 0.2], [0.2, 0.1, 0.2], [-0.2, 0.1, -0.2], [0.2, 0.1, -0.2]];
    this.legs = [];
    for (const pos of positions) {
      const leg = new THREE.Mesh(legGeom, bodyMat);
      leg.position.set(...pos); group.add(leg); this.legs.push(leg);
    }
    this.mesh = group;
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 2.0;
        this.velocity.z = (dz / len) * 2.0;
        this.yaw = Math.atan2(dx, dz);
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.2 && this.attackCooldown <= 0) {
        player.takeDamage(2); this.attackCooldown = 1.2;
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.008;
        this.legs[0].rotation.x = Math.sin(t) * 0.3;
        this.legs[1].rotation.x = -Math.sin(t) * 0.3;
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// 肉盾僵尸 — 高血量，击退免疫，攻击7点
class BruteZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'brute';
    this.health = 300;
    this.maxHealth = 300;
this.width = 0.8;
this.height = 2.0;
this.goldValue = 35;
    this.knockbackImmune = true;
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), bodyMat);
    body.position.y = 1.1; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), new THREE.MeshLambertMaterial({ color: 0x3a3a5a }));
    head.position.y = 1.85; group.add(head);
    const armGeom = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const leftArm = new THREE.Mesh(armGeom, bodyMat); leftArm.position.set(-0.55, 1.1, 0.3); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat); rightArm.position.set(0.55, 1.1, 0.3); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    const legGeom = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a1a3a })); leftLeg.position.set(-0.2, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a1a3a })); rightLeg.position.set(0.2, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  takeDamage(amount, attackerX, attackerZ) {
    if (this.dying || this.dead) return;
    this.health -= amount;
    this.hurtTimer = 0.3;
    // 击退免疫：不施加击飞
    if (this.health <= 0) { this.health = 0; this.dying = true; this.deathTimer = 2.0; }
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 1.8;
        this.velocity.z = (dz / len) * 1.8;
        this.yaw = Math.atan2(dx, dz);
      }
      if (this.onGround) {
        const ahead = { x: this.position.x + this.velocity.x * 0.4, y: this.position.y, z: this.position.z + this.velocity.z * 0.4 };
        if (BLOCK_DEFS[this.world.getBlock(Math.floor(ahead.x), Math.floor(ahead.y), Math.floor(ahead.z))]?.solid) {
          this.velocity.y = 8; this.onGround = false;
        }
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
        player.takeDamage(7); this.attackCooldown = 1.5;
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
        const t = Date.now() * 0.005;
        this.legs[0].rotation.x = Math.sin(t) * 0.3;
        this.legs[1].rotation.x = -Math.sin(t) * 0.3;
      }
      if (this.arms) { this.arms[0].rotation.x = -Math.PI / 2.5; this.arms[1].rotation.x = -Math.PI / 2.5; }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// 爆炸僵尸 — 靠近玩家2格内自爆
class BomberZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'bomber';
    this.health = 80;
    this.maxHealth = 80;
this.goldValue = 15;
this.fuseTime = 0;
    this.exploding = false;
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6a4a1a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), bodyMat);
    body.position.y = 1.0; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
    head.position.y = 1.6; group.add(head);
    // 引信（红色小方块在头顶）
    const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000 }));
    fuse.position.y = 1.9; group.add(fuse);
    this.fuseMesh = fuse;
    const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftArm = new THREE.Mesh(armGeom, bodyMat); leftArm.position.set(-0.35, 1.0, 0.3); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat); rightArm.position.set(0.35, 1.0, 0.3); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x3a2a0a })); leftLeg.position.set(-0.12, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x3a2a0a })); rightLeg.position.set(0.12, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 3.0;
        this.velocity.z = (dz / len) * 3.0;
        this.yaw = Math.atan2(dx, dz);
      }
      // 2格内自爆
      if (distToPlayer < 2.0 && !this.exploding) {
        this.exploding = true;
        this.fuseTime = 0.5;
      }
      if (this.exploding) {
        this.fuseTime -= dt;
        // 引信闪烁
        if (this.fuseMesh) {
          this.fuseMesh.material.color.setRGB(1, Math.random() * 0.5, 0);
        }
        this.velocity.x = 0;
        this.velocity.z = 0;
        if (this.fuseTime <= 0) {
          // 自爆
          if (this.game && this.game.effects) {
            this.game.effects.createExplosion(this.position.x, this.position.y + 0.5, this.position.z, 2);
          }
          this.health = 0;
          this.dying = true;
          this.deathTimer = 0.1;
          this.dead = true;
          return;
        }
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// 召唤僵尸 — 每6秒召唤2个普通僵尸
class SummonerZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'summoner';
    this.health = 150;
    this.maxHealth = 150;
this.goldValue = 25;
this.summonTimer = 6;
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a2a8a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), bodyMat);
    body.position.y = 1.0; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x7a4aaa }));
    head.position.y = 1.6; group.add(head);
    // 紫色光环
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.2 }));
    aura.position.y = 1.0; group.add(aura);
    this.auraMesh = aura;
    const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftArm = new THREE.Mesh(armGeom, bodyMat); leftArm.position.set(-0.35, 1.0, 0.3); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat); rightArm.position.set(0.35, 1.0, 0.3); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x3a1a5a })); leftLeg.position.set(-0.12, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x3a1a5a })); rightLeg.position.set(0.12, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 1.5;
        this.velocity.z = (dz / len) * 1.5;
        this.yaw = Math.atan2(dx, dz);
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
        player.takeDamage(3); this.attackCooldown = 1.0;
      }
      // 召唤
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = 6;
        if (this.game && this.game.mobs && this.game.mobs.mobs.length < 40) {
          for (let i = 0; i < 2; i++) {
            const sx = this.position.x + (Math.random() - 0.5) * 2;
            const sz = this.position.z + (Math.random() - 0.5) * 2;
            this.game.mobs.spawnMob(sx, this.position.y, sz, 'zombie');
            const mob = this.game.mobs.mobs[this.game.mobs.mobs.length - 1];
            if (mob) { mob.game = this.game; mob.goldValue = 100; }
          }
          if (this.game.ui) this.game.ui.showToast('⚠️ 召唤者召唤了僵尸！', 800);
        }
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (this.auraMesh) {
        this.auraMesh.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.1);
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// 寒冰僵尸 — 3格内减速光环
class WinterZombie extends Zombie {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'winter_z';
    this.health = 120;
    this.maxHealth = 120;
this.goldValue = 15;
this.slowRadius = 3;
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a8aaa });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), bodyMat);
    body.position.y = 1.0; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x4aaacc }));
    head.position.y = 1.6; group.add(head);
    // 冰晶光环
    const aura = new THREE.Mesh(new THREE.SphereGeometry(this.slowRadius, 8, 6), new THREE.MeshBasicMaterial({ color: 0x44ccff, transparent: true, opacity: 0.1, wireframe: true }));
    aura.position.y = 1.0; group.add(aura);
    this.auraMesh = aura;
    const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftArm = new THREE.Mesh(armGeom, bodyMat); leftArm.position.set(-0.35, 1.0, 0.3); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, bodyMat); rightArm.position.set(0.35, 1.0, 0.3); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a5a7a })); leftLeg.position.set(-0.12, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a5a7a })); rightLeg.position.set(0.12, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (!player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        this.velocity.x = (dx / len) * 2.2;
        this.velocity.z = (dz / len) * 2.2;
        this.yaw = Math.atan2(dx, dz);
      }
      this.attackCooldown -= dt;
      if (distToPlayer < 1.5 && this.attackCooldown <= 0) {
        player.takeDamage(2); this.attackCooldown = 1.0;
      }
      // 减速光环
      if (distToPlayer < this.slowRadius) {
        player.applySlow(this, 1.0);
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (this.auraMesh) {
        this.auraMesh.rotation.y += dt * 0.5;
      }
    }
    this.updateHurtFlash(dt);
  }
  onDeath() { return []; }
}

// ===== Boss: 水晶守卫 =====
class CrystalGuardian extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'crystal_guardian';
    this.health = 400;
    this.maxHealth = 400;
    this.width = 1.2;
    this.height = 2.5;
    this.goldValue = 1000;
    this.attackCooldown = 0;
    this.barrageTimer = 2;
    this.summonTimer = 8;
    this.phase = 1;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.crystalPillars = [];
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const crystalMat = new THREE.MeshLambertMaterial({ color: 0x44aaff, emissive: 0x224488 });
    // 身体 — 大水晶柱
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), crystalMat);
    body.position.y = 1.3; body.scale.set(1, 1.5, 1); group.add(body); this.bodyMesh = body;
    // 头部 — 小水晶
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshLambertMaterial({ color: 0x66ccff, emissive: 0x336699 }));
    head.position.y = 2.2; group.add(head); this.headMesh = head;
    // 底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x224466 }));
    base.position.y = 0.15; group.add(base);
    // 光环
    const aura = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.5, 16), new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.2; group.add(aura); this.auraMesh = aura;
    this.mesh = group;
  }
  takeDamage(amount, attackerX, attackerZ) {
    if (this.dying || this.dead) return;
    // Phase2护盾激活时减伤
    if (this.shieldActive) {
      amount *= 0.2;
    }
    this.health -= amount;
    this.hurtTimer = 0.3;
    if (this.health <= 0) { this.health = 0; this.dying = true; this.deathTimer = 3.0; }
    // 阶段切换
    if (this.phase === 1 && this.health < this.maxHealth * 0.5) {
      this.enterPhase2();
    }
  }
  enterPhase2() {
    this.phase = 2;
    this.shieldActive = true;
    this.shieldTimer = 10;
    if (this.game && this.game.ui) this.game.ui.showToast('⚠️ 水晶守卫进入第二阶段！', 2000);
    if (this.game && this.game.sound) this.game.sound.bossRoar();
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    // 追踪玩家
    if (distToPlayer < 30 && !player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 2) {
        const speed = this.phase === 2 ? 4.0 : 2.0;
        this.velocity.x = (dx / len) * speed;
        this.velocity.z = (dz / len) * speed;
        this.yaw = Math.atan2(dx, dz);
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
      // 近战攻击
      this.attackCooldown -= dt;
      if (distToPlayer < 2.5 && this.attackCooldown <= 0) {
        player.takeDamage(5); this.attackCooldown = 1.5;
      }
      // 水晶弹幕
      this.barrageTimer -= dt;
      if (this.barrageTimer <= 0) {
        this.barrageTimer = this.phase === 2 ? 1.5 : 2;
        this.fireCrystalBarrage(player);
      }
      // 召唤护卫
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = this.phase === 2 ? 10 : 8;
        this.summonGuards();
      }
    }
    // Phase2护盾计时
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldTimer = 15;
        if (this.game && this.game.ui) this.game.ui.showToast('水晶护盾暂时解除！', 1500);
      } else {
        // 护盾恢复期
        this.health = Math.min(this.maxHealth * 0.5, this.health + 2 * dt);
      }
    } else if (this.phase === 2) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = true;
        this.shieldTimer = 10;
        if (this.game && this.game.ui) this.game.ui.showToast('⚠️ 水晶守卫激活护盾！', 1500);
      }
    }
    this.updateCrystalShards(dt, player);
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      if (this.bodyMesh) this.bodyMesh.rotation.y += dt * 2;
      if (this.headMesh) this.headMesh.rotation.y -= dt * 3;
      if (this.auraMesh) {
        this.auraMesh.rotation.z += dt * 0.5;
        this.auraMesh.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.15);
      }
    }
    this.updateHurtFlash(dt);
  }
  fireCrystalBarrage(player) {
    if (!this.game) return;
    if (!this._crystalShards) this._crystalShards = [];
    const count = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (this.phase === 2 ? Date.now() * 0.001 : 0);
      let dir;
      if (this.phase === 2) {
        dir = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
      } else {
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const spread = (i - 1) * 0.3;
        dir = {
          x: dx / len * Math.cos(spread) - dz / len * Math.sin(spread),
          y: 0,
          z: dx / len * Math.sin(spread) + dz / len * Math.cos(spread),
        };
      }
      // 创建水晶弹射物（自管理）
      const geom = new THREE.OctahedronGeometry(0.2);
      const mat = new THREE.MeshLambertMaterial({ color: 0x44aaff, emissive: 0x224488 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(this.position.x, this.position.y + 1.5, this.position.z);
      this.game.scene.add(mesh);
      this._crystalShards.push({
        mesh, dir,
        velocity: { x: dir.x * 15, y: dir.y * 15, z: dir.z * 15 },
        life: 0, maxLife: 5, damage: 4,
      });
    }
    if (this.game && this.game.sound) this.game.sound.tone(600, 0.1, 'sine', 0.15);
  }
  updateCrystalShards(dt, player) {
    if (!this._crystalShards) return;
    for (let i = this._crystalShards.length - 1; i >= 0; i--) {
      const s = this._crystalShards[i];
      s.life += dt;
      s.mesh.position.x += s.velocity.x * dt;
      s.mesh.position.y += s.velocity.y * dt;
      s.mesh.position.z += s.velocity.z * dt;
      s.mesh.rotation.y += dt * 5;
      // 碰撞检测
      const dist = Math.sqrt(
        (s.mesh.position.x - player.position.x) ** 2 +
        (s.mesh.position.y - (player.position.y + 0.9)) ** 2 +
        (s.mesh.position.z - player.position.z) ** 2
      );
      if (dist < 1.0) {
        player.takeDamage(s.damage);
        this.game.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this._crystalShards.splice(i, 1);
        continue;
      }
      if (s.life >= s.maxLife) {
        this.game.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this._crystalShards.splice(i, 1);
      }
    }
  }
  summonGuards() {
    if (!this.game || !this.game.mobs) return;
    const count = this.phase === 2 ? 1 : 2; // Phase2召唤爆炸僵尸
    for (let i = 0; i < count; i++) {
      const sx = this.position.x + (Math.random() - 0.5) * 3;
      const sz = this.position.z + (Math.random() - 0.5) * 3;
      const type = this.phase === 2 ? 'bomber' : 'crawler';
      this.game.mobs.spawnMob(sx, this.position.y, sz, type);
    }
    if (this.game && this.game.ui) this.game.ui.showToast('水晶守卫召唤了护卫！', 1000);
  }
  onDeath() { return []; }
}

// ===== Boss: 僵尸君主 =====
class ZombieKing extends Entity {
  constructor(world, x, y, z) {
    super(world, x, y, z);
    this.type = 'zombie_king';
    this.health = 500;
    this.maxHealth = 500;
    this.width = 1.0;
    this.height = 2.8;
    this.goldValue = 2000;
    this.attackCooldown = 0;
    this.slamTimer = 4;
    this.summonTimer = 10;
    this.chargeTimer = 8;
    this.phase = 1;
    this.invulnerable = false;
    this.invulnTimer = 0;
    this.stormTimer = 0;
    this.isCharging = false;
    this.chargeDir = { x: 0, z: 0 };
    this.createMesh();
  }
  createMesh() {
    const group = new THREE.Group();
    const robeMat = new THREE.MeshLambertMaterial({ color: 0x2a1a3a });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0x554400 });
    // 身体 — 黑色长袍
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.4), robeMat);
    body.position.y = 1.2; group.add(body); this.bodyMesh = body;
    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x3a2a4a }));
    head.position.y = 2.2; group.add(head); this.headMesh = head;
    // 王冠
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 5), crownMat);
    crown.position.y = 2.55; group.add(crown);
    // 肩甲
    const shoulderGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const leftShoulder = new THREE.Mesh(shoulderGeom, crownMat); leftShoulder.position.set(-0.55, 1.8, 0); group.add(leftShoulder);
    const rightShoulder = new THREE.Mesh(shoulderGeom, crownMat); rightShoulder.position.set(0.55, 1.8, 0); group.add(rightShoulder);
    // 手臂
    const armGeom = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const leftArm = new THREE.Mesh(armGeom, robeMat); leftArm.position.set(-0.55, 1.2, 0.2); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, robeMat); rightArm.position.set(0.55, 1.2, 0.2); group.add(rightArm);
    this.arms = [leftArm, rightArm];
    // 腿
    const legGeom = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const leftLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a0a2a })); leftLeg.position.set(-0.2, 0.35, 0); group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, new THREE.MeshLambertMaterial({ color: 0x1a0a2a })); rightLeg.position.set(0.2, 0.35, 0); group.add(rightLeg);
    this.legs = [leftLeg, rightLeg];
    this.mesh = group;
  }
  takeDamage(amount, attackerX, attackerZ) {
    if (this.dying || this.dead) return;
    if (this.invulnerable) {
      if (this.game && this.game.ui) this.game.ui.showToast('僵尸君主无敌中！', 500);
      return;
    }
    this.health -= amount;
    this.hurtTimer = 0.3;
    if (this.health <= 0) { this.health = 0; this.dying = true; this.deathTimer = 3.0; }
    // 阶段切换
    if (this.phase === 1 && this.health < this.maxHealth * 0.66) this.enterPhase2();
    if (this.phase === 2 && this.health < this.maxHealth * 0.33) this.enterPhase3();
  }
  enterPhase2() {
    this.phase = 2;
    if (this.game && this.game.ui) this.game.ui.showToast('⚠️ 僵尸君主进入第二阶段！', 2000);
    if (this.game && this.game.sound) this.game.sound.bossRoar();
    this.summonTimer = 1;
  }
  enterPhase3() {
    this.phase = 3;
    this.stormTimer = 0;
    this.invulnTimer = 5;
    if (this.game && this.game.ui) this.game.ui.showToast('⚠️ 僵尸君主进入最终阶段！僵尸风暴！', 2000);
    if (this.game && this.game.sound) this.game.sound.bossRoar();
  }
  update(dt, player) {
    if (this.dying) { this.updateDying(dt); return; }
    // 无敌护盾计时
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.invulnerable = true;
      if (this.mesh) this.mesh.children.forEach(c => { if (c.material) c.material.emissive = c.material.emissive || new THREE.Color(0); });
    } else if (this.phase === 3) {
      this.invulnerable = false;
      this.invulnTimer = 5; // 5s间隔无敌
    } else {
      this.invulnerable = false;
    }
    const distToPlayer = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (distToPlayer < 35 && !player.dead) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      // 移动
      if (this.isCharging) {
        // 冲锋
        this.velocity.x = this.chargeDir.x * 12;
        this.velocity.z = this.chargeDir.z * 12;
        this.chargeTime -= dt;
        if (this.chargeTime <= 0) {
          this.isCharging = false;
        }
        // 冲锋路径上玩家击退+伤害
        if (distToPlayer < 2.0) {
          player.takeDamage(6);
          player.velocity.x = this.chargeDir.x * 10;
          player.velocity.z = this.chargeDir.z * 10;
          player.velocity.y = 5;
        }
      } else if (len > 2) {
        const speed = this.phase >= 2 ? 4.0 : 2.5;
        this.velocity.x = (dx / len) * speed;
        this.velocity.z = (dz / len) * speed;
        this.yaw = Math.atan2(dx, dz);
      } else {
        this.velocity.x = 0; this.velocity.z = 0;
      }
      // 近战
      this.attackCooldown -= dt;
      if (distToPlayer < 2.5 && this.attackCooldown <= 0) {
        player.takeDamage(6); this.attackCooldown = 1.5;
      }
      // 捶地AOE
      this.slamTimer -= dt;
      if (this.slamTimer <= 0) {
        this.slamTimer = this.phase === 3 ? 2 : 4;
        this.slamAttack(player);
      }
      // Phase2: 召唤+冲锋
      if (this.phase >= 2) {
        this.summonTimer -= dt;
        if (this.summonTimer <= 0) {
          this.summonTimer = 15;
          this.summonBrutes();
        }
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0 && !this.isCharging) {
          this.chargeTimer = 10;
          this.startCharge(dx, dz, len);
        }
      }
      // Phase3: 僵尸风暴
      if (this.phase === 3) {
        this.stormTimer -= dt;
        if (this.stormTimer <= 0) {
          this.stormTimer = 2;
          if (this.game && this.game.mobs && this.game.mobs.mobs.length < 40) {
            this.game.mobs.spawnMob(
              this.position.x + (Math.random() - 0.5) * 4,
              this.position.y,
              this.position.z + (Math.random() - 0.5) * 4,
              'fast_z'
            );
          }
        }
      }
    }
    this.updatePhysics(dt);
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.yaw;
      // 无敌时闪烁
      if (this.invulnerable && this.bodyMesh) {
        this.bodyMesh.material.emissive = new THREE.Color(0x444446);
      }
    }
    this.updateHurtFlash(dt);
  }
  slamAttack(player) {
    const dist = this.distanceTo(player.position.x, player.position.y, player.position.z);
    if (dist < 5) {
      player.takeDamage(4);
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      player.velocity.x = (dx / len) * 10;
      player.velocity.z = (dz / len) * 10;
      player.velocity.y = 6;
    }
    // AOE特效
    if (this.game && this.game.effects) {
      this.game.effects.createBlockBreakParticles(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0x884422);
    }
    if (this.game && this.game.sound) {
      this.game.sound.noise(0.3, 0.3, 200);
    }
  }
  summonBrutes() {
    if (!this.game || !this.game.mobs) return;
    for (let i = 0; i < 4; i++) {
      const sx = this.position.x + (Math.random() - 0.5) * 5;
      const sz = this.position.z + (Math.random() - 0.5) * 5;
      this.game.mobs.spawnMob(sx, this.position.y, sz, 'brute');
    }
    if (this.game && this.game.ui) this.game.ui.showToast('僵尸君主召唤了肉盾僵尸！', 1500);
  }
  startCharge(dx, dz, len) {
    this.isCharging = true;
    this.chargeTime = 1.5;
    if (len > 0) {
      this.chargeDir = { x: dx / len, z: dz / len };
    }
    if (this.game && this.game.ui) this.game.ui.showToast('僵尸君主开始冲锋！', 800);
  }
  onDeath() { return []; }
}

export class MobManager {
  constructor(game) {
    this.game = game;
    this.mobs = [];
    this.drops = [];
    this.spawnTimer = 0;
    this.maxMobs = 15;
  }

  spawnMob(x, y, z, type = null) {
    if (this.mobs.length >= this.maxMobs) return;

    const isNight = !this.game.sky.isDaytime();
    // 夜晚生成僵尸/苦力怕/骷髅/蜘蛛，白天生成猪/牛/羊/鸡
    if (!type) {
      if (isNight) {
        const hostileTypes = ['zombie', 'creeper', 'skeleton', 'spider'];
        type = hostileTypes[Math.floor(Math.random() * hostileTypes.length)];
      } else {
        const passiveTypes = ['pig', 'cow', 'sheep', 'chicken'];
        type = passiveTypes[Math.floor(Math.random() * passiveTypes.length)];
      }
    }

    let mob;
    if (type === 'pig') {
      mob = new Pig(this.game.world, x, y, z);
    } else if (type === 'zombie' || type === 'normal') {
      mob = new Zombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'creeper') {
      mob = new Creeper(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'skeleton') {
      mob = new Skeleton(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'cow') {
      mob = new Cow(this.game.world, x, y, z);
    } else if (type === 'sheep') {
      mob = new Sheep(this.game.world, x, y, z);
    } else if (type === 'chicken') {
      mob = new Chicken(this.game.world, x, y, z);
    } else if (type === 'spider') {
      mob = new Spider(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'enderman') {
      mob = new Enderman(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'slime') {
      mob = new Slime(this.game.world, x, y, z, 3);
      mob.game = this.game;
    } else if (type === 'iron_golem') {
      mob = new IronGolem(this.game.world, x, y, z);
    } else if (type === 'fish') {
      mob = new Fish(this.game.world, x, y, z);
    } else if (type === 'wither') {
      mob = new WitherBoss(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 凋零已召唤！');
    } else if (type === 'ender_dragon') {
      mob = new EnderDragon(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 末影龙已召唤！');
    } else if (type === 'fast_z') {
      mob = new FastZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'crawler') {
      mob = new CrawlerZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'brute') {
      mob = new BruteZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'bomber') {
      mob = new BomberZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'summoner') {
      mob = new SummonerZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'winter_z') {
      mob = new WinterZombie(this.game.world, x, y, z);
      mob.game = this.game;
    } else if (type === 'crystal_guardian') {
      mob = new CrystalGuardian(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 水晶守卫出现了！');
    } else if (type === 'zombie_king') {
      mob = new ZombieKing(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 僵尸君主降临了！');
    }

    if (mob) {
      mob.game = this.game;
      // 冒险模式：应用速度缩放
      if (this._speedScale !== undefined) {
        mob._speedScale = this._speedScale;
      }
      this.mobs.push(mob);
      if (mob.mesh) this.game.scene.add(mob.mesh);
    }
  }

  // 冒险模式：金币掉落
  spawnGoldDrop(x, y, z, amount) {
    // 使用 ItemDrop 实体，blockId=GOLD_BLOCK(41) 作为金币外观
    const drop = new ItemDrop(this.game.world, x, y, z, 41, 1);
    drop.gold = amount;
    drop.isGold = true;
    this.drops.push(drop);
    if (drop.mesh) this.game.scene.add(drop.mesh);
  }

  // 冒险模式：怪物死亡钩子
  onMobKilled(mob) {
    if (this.game.onMobKilled) {
      this.game.onMobKilled(mob, mob._killerId || null);
    }
  }

  // 查找最近的玩家（支持多人模式）
  _findNearestPlayer(mob) {
    const localPlayer = this.game.player;
    if (!localPlayer) return null;

    let nearest = localPlayer;
    let nearestDist = mob.distanceTo(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z);

    // 检查远程玩家
    if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
      for (const [id, rp] of this.game.multiplayer.remotePlayers) {
        if (!rp.position) continue;
        const dist = mob.distanceTo(rp.position.x, rp.position.y, rp.position.z);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = rp;
        }
      }
    }

    return nearest;
  }

  // 设置冒险模式（禁用常规刷怪 + 削减移速）
  setAdventureMode(enabled) {
    this._adventureMode = enabled;
    this._speedScale = enabled ? 0.6 : 1.0; // 冒险模式：僵尸移速降至60%
  }

  spawnDrop(x, y, z, blockId, count = 1) {
    const drop = new ItemDrop(this.game.world, x, y, z, blockId, count);
    this.drops.push(drop);
    if (drop.mesh) this.game.scene.add(drop.mesh);
    console.log('[DROP] created', { blockId, x, y, z, totalDrops: this.drops.length });
  }

  update(dt) {
    const player = this.game.player;

    // 更新生物
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];

      // 眩晕效果 — 被眩晕时无法移动和攻击
      if (mob._stunTimer && mob._stunTimer > 0) {
        mob._stunTimer -= dt;
        mob.velocity.x = 0;
        mob.velocity.z = 0;
        // 眩晕时仍应用物理（重力），但不执行AI
        if (!mob.dying) {
          mob.updatePhysics(dt);
          if (mob.mesh) {
            mob.mesh.position.set(mob.position.x, mob.position.y, mob.position.z);
            // 眩晕颤抖动画
            mob.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.1;
          }
          mob.updateHurtFlash(dt);
          // 跳过正常AI更新
          continue;
        }
      } else if (mob.mesh) {
        mob.mesh.rotation.z = 0; // 恢复
      }

      // 灼烧效果 — 持续火焰伤害
      if (mob._burnTimer && mob._burnTimer > 0) {
        mob._burnTimer -= dt;
        mob._burnTickTimer = (mob._burnTickTimer || 0) + dt;
        if (mob._burnTickTimer >= 0.5) {
          mob._burnTickTimer = 0;
          const burnDmg = 5;
          mob.takeDamage(burnDmg);
          // 火焰粒子
          if (this.game.effects) {
            this.game.effects.createBlockBreakParticles(
              Math.floor(mob.position.x), Math.floor(mob.position.y + 0.5), Math.floor(mob.position.z), 0xff6600
            );
            // 灼烧伤害数字
            if (this.game.effects.showDamageNumber) {
              this.game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, burnDmg, '#ff6600');
            }
          }
        }
      }

      // 查找最近的玩家（支持多人模式）
      const nearestPlayer = this._findNearestPlayer(mob) || player;

      // === 卡住检测：周期性检查位移，3秒未有效移动则传送 ===
      if (!mob.dying && !mob.dead) {
        mob._stuckCheckTimer = (mob._stuckCheckTimer || 0) + dt;

        // 每0.5秒检查一次位移（避免帧间抖动误判）
        if (mob._stuckCheckTimer >= 0.5) {
          mob._stuckCheckTimer = 0;
          const movedX = mob.position.x - mob._stuckLastX;
          const movedZ = mob.position.z - mob._stuckLastZ;
          const movedDist = Math.sqrt(movedX * movedX + movedZ * movedZ);
          // 降低速度阈值到0.1，检测更多慢速移动的僵尸
          const tryingToMove = Math.abs(mob.velocity.x) > 0.1 || Math.abs(mob.velocity.z) > 0.1;
          const hasTarget = nearestPlayer && !nearestPlayer.dead &&
            mob.distanceTo(nearestPlayer.position.x, mob.position.y, nearestPlayer.position.z) < 40;

          // 检查僵尸是否在水中
          const blockAtFeet = this.game.world.getBlock(
            Math.floor(mob.position.x), Math.floor(mob.position.y + 0.5), Math.floor(mob.position.z)
          );
          const inWater = blockAtFeet === BLOCK.WATER;

          // 需要移动但0.5秒内位移不足0.5格 → 累积卡住计时
          // 水中僵尸也累积（更短阈值，因为水中移动慢）
          const stuckThreshold = inWater ? 0.3 : 0.5;
          if ((tryingToMove || hasTarget) && movedDist < stuckThreshold) {
            mob._stuckTimer += 0.5;
          } else {
            mob._stuckTimer = 0;
          }
          // 更新参考位置
          mob._stuckLastX = mob.position.x;
          mob._stuckLastZ = mob.position.z;
        }

        // 超过3秒卡住 → 传送到安全位置
        if (mob._stuckTimer >= 3.0) {
          const dx = nearestPlayer.position.x - mob.position.x;
          const dz = nearestPlayer.position.z - mob.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);

          // 尝试多个方向和距离，找到安全位置
          const directions = [];
          if (len > 0) {
            // 朝玩家方向
            directions.push({ cos: dx / len, sin: dz / len });
            // 左偏45度
            directions.push({ cos: (dx - dz) / len * 0.707, sin: (dz + dx) / len * 0.707 });
            // 右偏45度
            directions.push({ cos: (dx + dz) / len * 0.707, sin: (dz - dx) / len * 0.707 });
          }
          // 随机方向
          for (let r = 0; r < 4; r++) {
            const ang = Math.random() * Math.PI * 2;
            directions.push({ cos: Math.cos(ang), sin: Math.sin(ang) });
          }

          const distances = [3, 4, 2, 5];
          let teleported = false;

          for (const dir of directions) {
            if (teleported) break;
            for (const dist of distances) {
              const tx = mob.position.x + dir.cos * dist;
              const tz = mob.position.z + dir.sin * dist;
              const bx = Math.floor(tx);
              const bz = Math.floor(tz);

              // 检查目标位置是否安全：脚下有固体方块、身体位置是空气、不在水中
              let safeY = -1;
              for (let yOff = -2; yOff <= 3; yOff++) {
                const checkY = Math.floor(mob.position.y) + yOff;
                if (checkY < 0 || checkY >= 128) continue;
                const blockFeet = this.game.world.getBlock(bx, checkY, bz);
                const blockHead = this.game.world.getBlock(bx, checkY + 1, bz);
                const blockBelow = this.game.world.getBlock(bx, checkY - 1, bz);
                const defFeet = BLOCK_DEFS[blockFeet];
                const defHead = BLOCK_DEFS[blockHead];
                const defBelow = BLOCK_DEFS[blockBelow];
                // 脚下和头部是空气（非固体），且下方有固体方块支撑，且不在水中
                if ((!defFeet || !defFeet.solid) && (!defHead || !defHead.solid) &&
                    defBelow && defBelow.solid &&
                    blockFeet !== BLOCK.WATER && blockHead !== BLOCK.WATER) {
                  safeY = checkY;
                  break;
                }
              }

              if (safeY >= 0) {
                mob.position.x = tx;
                mob.position.z = tz;
                mob.position.y = safeY;
                if (mob.mesh) {
                  mob.mesh.position.set(mob.position.x, mob.position.y, mob.position.z);
                }
                // 粒子特效
                if (this.game.effects) {
                  this.game.effects.createBlockBreakParticles(
                    Math.floor(mob.position.x), Math.floor(mob.position.y + 0.5),
                    Math.floor(mob.position.z), 0xaa00ff
                  );
                }
                teleported = true;
                break;
              }
            }
          }

          // 如果所有方向都找不到安全位置，强制原地向上传送（最后手段）
          if (!teleported) {
            const bx = Math.floor(mob.position.x);
            const bz = Math.floor(mob.position.z);
            for (let yOff = 1; yOff <= 5; yOff++) {
              const checkY = Math.floor(mob.position.y) + yOff;
              const blockFeet = this.game.world.getBlock(bx, checkY, bz);
              const blockHead = this.game.world.getBlock(bx, checkY + 1, bz);
              const defFeet = BLOCK_DEFS[blockFeet];
              const defHead = BLOCK_DEFS[blockHead];
              if ((!defFeet || !defFeet.solid) && (!defHead || !defHead.solid)) {
                mob.position.y = checkY;
                if (mob.mesh) {
                  mob.mesh.position.set(mob.position.x, mob.position.y, mob.position.z);
                }
                if (this.game.effects) {
                  this.game.effects.createBlockBreakParticles(
                    bx, Math.floor(mob.position.y + 0.5), bz, 0xaa00ff
                  );
                }
                break;
              }
            }
          }

          mob._stuckTimer = 0;
          mob._stuckLastX = mob.position.x;
          mob._stuckLastZ = mob.position.z;
        }
      }

      mob.update(dt, nearestPlayer);

      // 方块交互行为（僵尸破坏/建造方块）
      if (mob.updateBlockBehavior) {
        mob.updateBlockBehavior(dt, nearestPlayer);
      }

      // 更新血量条
      if (mob.updateHealthBar) {
        mob.updateHealthBar(this.game.camera);
      }

      // 移除远离的生物（扩大到120格以支持全图追踪）
      const dist = mob.distanceTo(player.position.x, player.position.y, player.position.z);
      if (dist > 120) {
        if (mob.mesh) {
          this.game.scene.remove(mob.mesh);
          this._disposeMobMesh(mob);
        }
        this.mobs.splice(i, 1);
        continue;
      }

      // 移除死亡的生物
      if (mob.dead) {
        // 冒险模式：金币掉落 + 击杀钩子
        if (mob.goldValue && mob.goldValue > 0) {
          this.spawnGoldDrop(mob.position.x, mob.position.y, mob.position.z, mob.goldValue);
        }
        this.onMobKilled(mob);
        // 掉落物
        const drops = mob.onDeath();
        for (const drop of drops) {
          this.spawnDrop(mob.position.x, mob.position.y, mob.position.z, drop.id, drop.count);
        }
        // 清理 Boss 的水晶弹
        if (mob._crystalShards) {
          for (const s of mob._crystalShards) {
            this.game.scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
          }
          mob._crystalShards = [];
        }
        if (mob.mesh) {
          this.game.scene.remove(mob.mesh);
          this._disposeMobMesh(mob);
        }
        this.mobs.splice(i, 1);
        continue;
      }
    }

    // 更新掉落物
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.update(dt, player);
      // 清理距离过远的掉落物
      const dropDist = drop.distanceTo(player.position.x, player.position.y + 0.9, player.position.z);
      if (dropDist > 100) {
        drop.dead = true;
      }
      if (drop.dead) {
        if (drop.mesh) {
          this.game.scene.remove(drop.mesh);
          if (drop.mesh.geometry) drop.mesh.geometry.dispose();
          if (drop.mesh.material) {
            if (Array.isArray(drop.mesh.material)) drop.mesh.material.forEach(m => m.dispose());
            else drop.mesh.material.dispose();
          }
        }
        this.drops.splice(i, 1);
        // 拾取提示
        if (drop.pickedUp && this.game.ui) {
          const def = BLOCK_DEFS[drop.blockId];
          const name = def ? def.name : '未知物品';
          this.game.ui.showToast(`+${drop.count} ${name}`, 1000);
        }
      }
    }

    // 定时生成生物（仅主机生成，客户端通过同步接收）
    // 冒险模式禁用常规刷怪
    if (this._adventureMode) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 5 + Math.random() * 5;
      // 只有主机在联机模式下负责生成生物
      if (this.game.multiplayer && this.game.multiplayer.isHost) {
        this.trySpawnNearPlayer();
      } else if (!this.game.multiplayer) {
        // 单人模式正常生成
        this.trySpawnNearPlayer();
      }
    }
  }

  trySpawnNearPlayer() {
    if (this.mobs.length >= this.maxMobs) return;

    const player = this.game.player;
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    const x = Math.floor(player.position.x + Math.cos(angle) * dist);
    const z = Math.floor(player.position.z + Math.sin(angle) * dist);

    // 尝试在水中生成鱼
    for (let y = WATER_LEVEL; y > 0; y--) {
      const block = this.game.world.getBlock(x, y, z);
      if (block === BLOCK.WATER) {
        // 检查是否是较深水域（至少3格深）
        let depth = 0;
        for (let dy = y; dy > 0; dy--) {
          if (this.game.world.getBlock(x, dy, z) === BLOCK.WATER) depth++;
          else break;
        }
        if (depth >= 3 && Math.random() < 0.4) {
          this.spawnMob(x + 0.5, y + 0.5, z + 0.5, 'fish');
          if (this.game.multiplayer && this.game.multiplayer.isHost) {
            this.game.multiplayer.sendMobSpawn(x + 0.5, y + 0.5, z + 0.5, 'fish');
          }
          return;
        }
        break;
      }
      if (BLOCK_DEFS[block]?.solid) break;
    }

    // 找到地面高度
    for (let y = 60; y > 0; y--) {
      const block = this.game.world.getBlock(x, y, z);
      if (BLOCK_DEFS[block]?.solid) {
        const above = this.game.world.getBlock(x, y + 1, z);
        const above2 = this.game.world.getBlock(x, y + 2, z);
        if (above === 0 && above2 === 0) {
          // 确定生物类型（在生成前确定，用于同步）
          const isNight = !this.game.sky.isDaytime();
          let mobType = null;
          if (isNight) {
            const hostileTypes = ['zombie', 'creeper', 'skeleton', 'spider'];
            mobType = hostileTypes[Math.floor(Math.random() * hostileTypes.length)];
          } else {
            const passiveTypes = ['pig', 'cow', 'sheep', 'chicken'];
            mobType = passiveTypes[Math.floor(Math.random() * passiveTypes.length)];
          }
          this.spawnMob(x + 0.5, y + 1, z + 0.5, mobType);
          // 联机模式下同步给客户端
          if (this.game.multiplayer && this.game.multiplayer.isHost) {
            this.game.multiplayer.sendMobSpawn(x + 0.5, y + 1, z + 0.5, mobType);
          }
          return;
        }
        break;
      }
    }
  }

  // 攻击附近的生物
  attackMobs(player, reach = 2.5, damage = 1) {
    const eyePos = player.getEyePosition();
    const dir = player.getLookDirection();
    let closestMob = null;
    let closestDist = reach;

    for (const mob of this.mobs) {
      const dx = mob.position.x - eyePos.x;
      const dy = (mob.position.y + mob.height / 2) - eyePos.y;
      const dz = mob.position.z - eyePos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < closestDist) {
        // 检查是否在视线方向上
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / len;
        if (dot > 0.5) {
          closestMob = mob;
          closestDist = dist;
        }
      }
    }

    if (closestMob) {
      closestMob.takeDamage(damage, player.position.x, player.position.z);
      return true;
    }
    return false;
  }

  clear() {
    for (const mob of this.mobs) {
      if (mob.mesh) {
        this.game.scene.remove(mob.mesh);
        this._disposeMobMesh(mob);
      }
    }
    for (const drop of this.drops) {
      if (drop.mesh) {
        this.game.scene.remove(drop.mesh);
        if (drop.mesh.geometry) drop.mesh.geometry.dispose();
        if (drop.mesh.material) {
          if (Array.isArray(drop.mesh.material)) drop.mesh.material.forEach(m => m.dispose());
          else drop.mesh.material.dispose();
        }
      }
    }
    this.mobs = [];
    this.drops = [];
  }

  // 释放生物 mesh 的 geometry 和 material
  _disposeMobMesh(mob) {
    if (!mob.mesh) return;
    mob.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  serialize() {
    return {
      mobs: this.mobs.map(m => m.serialize()),
    };
  }
}
