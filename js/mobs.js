/**
 * mobs.js — 生物实体、基础 AI 和方块掉落物
 * 包含：猪（被动）、僵尸（敌对）、掉落物实体
 */

import * as THREE from 'three';
import { BLOCK_DEFS, BLOCK, generateBlockIcon } from './blocks.js';
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
    this.width = 0.5;
    this.height = 1.4;
    this.mesh = null;
    this.id = Math.random().toString(36).substring(7);
    this.hurtTimer = 0;
    this.dying = false;
    this.deathTimer = 0;
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
    // 重力
    this.velocity.y -= 28 * dt;
    if (this.velocity.y < -30) this.velocity.y = -30;

    // 分轴碰撞
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('z', this.velocity.z * dt);

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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
    this.health = 10;
    this.maxHealth = 10;
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
    if (distToPlayer < 2 && player.velocity.x !== 0 || player.velocity.z !== 0) {
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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

    // 追击玩家（距离 < 16）
    if (distToPlayer < 16 && !player.dead) {
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
    this.health = 10;
    this.maxHealth = 10;
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
    this.health = 8;
    this.maxHealth = 8;
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
    this.health = 4;
    this.maxHealth = 4;
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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
      this.mesh.position.copy(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
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

// 生物管理器
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
    } else if (type === 'zombie') {
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
    } else if (type === 'wither') {
      mob = new WitherBoss(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 凋零已召唤！');
    } else if (type === 'ender_dragon') {
      mob = new EnderDragon(this.game.world, x, y, z);
      mob.game = this.game;
      if (this.game.ui) this.game.ui.showToast('⚠️ 末影龙已召唤！');
    }

    if (mob) {
      mob.game = this.game;
      this.mobs.push(mob);
      if (mob.mesh) this.game.scene.add(mob.mesh);
    }
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
      mob.update(dt, player);

      // 移除远离的生物
      const dist = mob.distanceTo(player.position.x, player.position.y, player.position.z);
      if (dist > 80) {
        if (mob.mesh) this.game.scene.remove(mob.mesh);
        this.mobs.splice(i, 1);
        continue;
      }

      // 移除死亡的生物
      if (mob.dead) {
        // 掉落物
        const drops = mob.onDeath();
        for (const drop of drops) {
          this.spawnDrop(mob.position.x, mob.position.y, mob.position.z, drop.id, drop.count);
        }
        if (mob.mesh) this.game.scene.remove(mob.mesh);
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
        if (drop.mesh) this.game.scene.remove(drop.mesh);
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
      if (mob.mesh) this.game.scene.remove(mob.mesh);
    }
    for (const drop of this.drops) {
      if (drop.mesh) this.game.scene.remove(drop.mesh);
    }
    this.mobs = [];
    this.drops = [];
  }

  serialize() {
    return {
      mobs: this.mobs.map(m => m.serialize()),
    };
  }
}
