/**
 * ranged.js — 弓箭/远程武器系统
 * 支持弓、弩、三叉戟、雪球、末影珍珠等远程武器
 */

import * as THREE from 'three';

// 投射物类型
export const PROJECTILE_TYPE = {
  ARROW: 'arrow',
  SPECTRAL_ARROW: 'spectral_arrow',
  TIPPED_ARROW: 'tipped_arrow',
  TRIDENT: 'trident',
  SNOWBALL: 'snowball',
  EGG: 'egg',
  ENDER_PEARL: 'ender_pearl',
  FIREBALL: 'fireball',
  DRAGON_BREATH: 'dragon_breath',
  LLAMA_SPIT: 'llama_spit',
  SHULKER_BULLET: 'shulker_bullet',
  FISHING_BOBBER: 'fishing_bobber',
  CROSSBOW_BOLT: 'crossbow_bolt',
  FIREWORK_ROCKET: 'firework_rocket',
  WITHER_SKULL: 'wither_skull',
};

export class Projectile {
  constructor(game, type, x, y, z, dir, options = {}) {
    this.game = game;
    this.type = type;
    this.position = { x, y, z };
    this.velocity = {
      x: dir.x * (options.speed || 30),
      y: dir.y * (options.speed || 30),
      z: dir.z * (options.speed || 30),
    };
    this.damage = options.damage || 4;
    this.lifetime = 0;
    this.maxLifetime = options.maxLifetime || 10;
    this.dead = false;
    this.owner = options.owner || null; // 谁发射的
    this.inGround = false;
    this.mesh = null;
    this.gravity = options.gravity !== undefined ? options.gravity : 1;
    this.piercing = options.piercing || 0;
    this.hitEntities = new Set();
    this.onHitBlock = options.onHitBlock || null;
    this.onHitEntity = options.onHitEntity || null;
    this.enchantments = options.enchantments || {};
    this.createMesh();
  }

  createMesh() {
    const geom = this.getGeometry();
    const mat = this.getMaterial();
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 朝向运动方向
    const dir = this.velocity;
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (len > 0) {
      this.mesh.lookAt(
        this.position.x + dir.x / len,
        this.position.y + dir.y / len,
        this.position.z + dir.z / len
      );
    }
  }

  getGeometry() {
    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
        return new THREE.ConeGeometry(0.05, 0.5, 4);
      case PROJECTILE_TYPE.TRIDENT:
        return new THREE.ConeGeometry(0.08, 1.2, 4);
      case PROJECTILE_TYPE.SNOWBALL:
      case PROJECTILE_TYPE.EGG:
        return new THREE.SphereGeometry(0.12, 6, 6);
      case PROJECTILE_TYPE.ENDER_PEARL:
        return new THREE.SphereGeometry(0.15, 8, 8);
      case PROJECTILE_TYPE.FIREBALL:
        return new THREE.SphereGeometry(0.3, 8, 8);
      case PROJECTILE_TYPE.WITHER_SKULL:
        return new THREE.SphereGeometry(0.25, 8, 8);
      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        return new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4);
      default:
        return new THREE.SphereGeometry(0.1, 6, 6);
    }
  }

  getMaterial() {
    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
        return new THREE.MeshLambertMaterial({ color: 0x888888 });
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
        return new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
      case PROJECTILE_TYPE.TRIDENT:
        return new THREE.MeshLambertMaterial({ color: 0x44aaff });
      case PROJECTILE_TYPE.SNOWBALL:
        return new THREE.MeshLambertMaterial({ color: 0xffffff });
      case PROJECTILE_TYPE.EGG:
        return new THREE.MeshLambertMaterial({ color: 0xffeecc });
      case PROJECTILE_TYPE.ENDER_PEARL:
        return new THREE.MeshLambertMaterial({ color: 0x00aa44, emissive: 0x004422, emissiveIntensity: 0.3 });
      case PROJECTILE_TYPE.FIREBALL:
        return new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 0.8 });
      case PROJECTILE_TYPE.WITHER_SKULL:
        return new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0x444444, emissiveIntensity: 0.3 });
      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        return new THREE.MeshLambertMaterial({ color: 0xff6688 });
      default:
        return new THREE.MeshLambertMaterial({ color: 0x888888 });
    }
  }

  update(dt) {
    if (this.dead) return;
    this.lifetime += dt;
    if (this.lifetime > this.maxLifetime) {
      this.dead = true;
      return;
    }

    if (this.inGround) {
      // 插在方块中的箭会逐渐消失
      if (this.lifetime > this.maxLifetime * 0.5) {
        this.dead = true;
      }
      return;
    }

    // 重力
    if (this.gravity > 0) {
      this.velocity.y -= 15 * this.gravity * dt;
    }

    // 火球/凋零骷髅头不受重力影响
    if (this.type === PROJECTILE_TYPE.FIREBALL || this.type === PROJECTILE_TYPE.WITHER_SKULL) {
      this.velocity.y += 0; // 保持直线
    }

    // 移动
    const oldX = this.position.x;
    const oldY = this.position.y;
    const oldZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // 更新网格
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      // 朝向运动方向
      const dir = this.velocity;
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      if (len > 0.01) {
        this.mesh.lookAt(
          this.position.x + dir.x / len,
          this.position.y + dir.y / len,
          this.position.z + dir.z / len
        );
      }
    }

    // 方块碰撞检测
    const blockX = Math.floor(this.position.x);
    const blockY = Math.floor(this.position.y);
    const blockZ = Math.floor(this.position.z);
    const block = this.game.world.getBlock(blockX, blockY, blockZ);
    if (block !== 0) {
      this.onBlockHit(blockX, blockY, blockZ);
    }

    // 实体碰撞检测
    this.checkEntityCollision();

    // 特殊效果
    this.updateSpecial(dt);
  }

  onBlockHit(x, y, z) {
    if (this.onHitBlock) {
      this.onHitBlock(x, y, z, this);
      return;
    }

    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
      case PROJECTILE_TYPE.TRIDENT:
        this.inGround = true;
        this.velocity = { x: 0, y: 0, z: 0 };
        break;

      case PROJECTILE_TYPE.SNOWBALL:
      case PROJECTILE_TYPE.EGG:
        // 碎裂效果
        if (this.game.effects) {
          this.game.effects.createBlockBreakParticles(x, y, z, 0xffffff);
        }
        if (this.type === PROJECTILE_TYPE.EGG && Math.random() < 0.125) {
          // 鸡蛋有1/8几率孵化小鸡
          if (this.game.mobs) {
            this.game.mobs.spawnMob(x + 0.5, y + 1, z + 0.5, 'chicken');
          }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.ENDER_PEARL:
        // 传送玩家
        if (this.owner && this.owner.position) {
          this.owner.position = { x: this.position.x, y: this.position.y + 1, z: this.position.z };
          this.owner.velocity = { x: 0, y: 0, z: 0 };
          if (this.owner.takeDamage) {
            this.owner.takeDamage(5); // 末影珍珠造成5点伤害
          }
          if (this.game.effects) {
            this.game.effects.createBlockBreakParticles(x, y, z, 0x00aa44);
          }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.FIREBALL:
        // 爆炸 + 火焰
        if (this.game.effects) {
          this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 2);
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.WITHER_SKULL:
        // 凋零爆炸
        if (this.game.effects) {
          this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 1);
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        // 烟花爆炸
        if (this.game.effects) {
          this.game.effects.createBlockBreakParticles(x, y, z, 0xff6688);
        }
        this.dead = true;
        break;

      default:
        this.dead = true;
    }
  }

  checkEntityCollision() {
    if (!this.game.mobs) return;

    for (const mob of this.game.mobs.mobs) {
      if (this.hitEntities.has(mob.id)) continue;
      if (this.owner === mob) continue;

      const dx = mob.position.x - this.position.x;
      const dy = (mob.position.y + mob.height / 2) - this.position.y;
      const dz = mob.position.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < mob.width + 0.3) {
        this.onEntityHit(mob);
        this.hitEntities.add(mob.id);
        if (this.piercing <= 0) {
          this.dead = true;
          break;
        }
        this.piercing--;
      }
    }

    // 检查远程玩家碰撞
    if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
      for (const [id, rp] of this.game.multiplayer.remotePlayers) {
        if (this.owner === rp) continue;
        const dx = rp.position.x - this.position.x;
        const dy = (rp.position.y + 0.9) - this.position.y;
        const dz = rp.position.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.8) {
          // 命中远程玩家
          if (this.game.multiplayer) {
            this.game.multiplayer.sendPlayerDamage(id, this.damage);
          }
          if (this.piercing <= 0) {
            this.dead = true;
            break;
          }
          this.piercing--;
        }
      }
    }
  }

  onEntityHit(mob) {
    if (this.onHitEntity) {
      this.onHitEntity(mob, this);
      return;
    }

    let damage = this.damage;

    // 附魔加成
    if (this.enchantments.power) {
      damage += this.enchantments.power * 0.5;
    }

    // 火矢附魔
    if (this.enchantments.flame) {
      mob.burning = 5; // 燃烧5秒
    }

    // 冲击附魔
    if (this.enchantments.punch) {
      const dx = mob.position.x - this.position.x;
      const dz = mob.position.z - this.position.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0) {
        const kb = this.enchantments.punch * 3;
        mob.velocity.x += (dx / len) * kb;
        mob.velocity.z += (dz / len) * kb;
      }
    }

    mob.takeDamage(damage);

    // 击退
    const dx = mob.position.x - this.position.x;
    const dz = mob.position.z - this.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      mob.velocity.x += (dx / len) * 2;
      mob.velocity.z += (dz / len) * 2;
      mob.velocity.y = 3;
    }

    // 伤害数字
    if (this.game.effects) {
      this.game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, damage);
    }
  }

  updateSpecial(dt) {
    // 火球留下火焰轨迹
    if (this.type === PROJECTILE_TYPE.FIREBALL && this.game.effects) {
      if (Math.random() < 0.5) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x),
          Math.floor(this.position.y),
          Math.floor(this.position.z),
          0xff6600
        );
      }
    }

    // 末影珍珠粒子
    if (this.type === PROJECTILE_TYPE.ENDER_PEARL && this.game.effects) {
      if (Math.random() < 0.3) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x),
          Math.floor(this.position.y),
          Math.floor(this.position.z),
          0x00aa44
        );
      }
    }
  }
}

export class RangedSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.bowChargeTime = 0;
    this.isCharging = false;
  }

  // 射箭
  shootArrow(power = 1, enchantments = {}) {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 20 + power * 30;
    const damage = 2 + power * 4;

    const arrow = new Projectile(this.game, PROJECTILE_TYPE.ARROW, eye.x, eye.y, eye.z, dir, {
      speed,
      damage,
      owner: this.game.player,
      enchantments,
      maxLifetime: 60,
    });

    this.projectiles.push(arrow);
    if (arrow.mesh) this.game.scene.add(arrow.mesh);

    // 无限附魔不消耗箭矢
    if (!enchantments.infinity && this.game.player.gamemodeConfig && !this.game.player.gamemodeConfig.infiniteBlocks) {
      this.game.player.consumeSelectedItem();
    }

    // 多人同步
    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.ARROW, eye, dir, { speed, damage });
    }

    return arrow;
  }

  // 投掷物品
  throwItem(type, options = {}) {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const proj = new Projectile(this.game, type, eye.x, eye.y, eye.z, dir, {
      speed: options.speed || 20,
      damage: options.damage || 0,
      owner: this.game.player,
      gravity: options.gravity !== undefined ? options.gravity : 1,
      maxLifetime: options.maxLifetime || 10,
    });

    this.projectiles.push(proj);
    if (proj.mesh) this.game.scene.add(proj.mesh);

    // 多人同步
    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(type, eye, dir, options);
    }

    return proj;
  }

  // 投掷雪球
  throwSnowball() {
    this.throwItem(PROJECTILE_TYPE.SNOWBALL, { damage: 0, gravity: 1 });
    if (!this.game.player.gamemodeConfig?.infiniteBlocks) {
      this.game.player.consumeSelectedItem();
    }
  }

  // 投掷鸡蛋
  throwEgg() {
    this.throwItem(PROJECTILE_TYPE.EGG, { damage: 0, gravity: 1 });
    if (!this.game.player.gamemodeConfig?.infiniteBlocks) {
      this.game.player.consumeSelectedItem();
    }
  }

  // 投掷末影珍珠
  throwEnderPearl() {
    this.throwItem(PROJECTILE_TYPE.ENDER_PEARL, { damage: 0, gravity: 1, maxLifetime: 30 });
    if (!this.game.player.gamemodeConfig?.infiniteBlocks) {
      this.game.player.consumeSelectedItem();
    }
  }

  // 射击火球（凋零/恶魂）
  shootFireball(x, y, z, dir, owner = null, damage = 6) {
    const proj = new Projectile(this.game, PROJECTILE_TYPE.FIREBALL, x, y, z, dir, {
      speed: 10,
      damage,
      owner,
      gravity: 0,
      maxLifetime: 20,
    });
    this.projectiles.push(proj);
    if (proj.mesh) this.game.scene.add(proj.mesh);
    return proj;
  }

  // 射击凋零骷髅头
  shootWitherSkull(x, y, z, dir, owner = null, damage = 8) {
    const proj = new Projectile(this.game, PROJECTILE_TYPE.WITHER_SKULL, x, y, z, dir, {
      speed: 8,
      damage,
      owner,
      gravity: 0,
      maxLifetime: 20,
    });
    this.projectiles.push(proj);
    if (proj.mesh) this.game.scene.add(proj.mesh);
    return proj;
  }

  // 弓蓄力
  startCharging() {
    this.isCharging = true;
    this.bowChargeTime = 0;
  }

  // 释放弓
  releaseBow(enchantments = {}) {
    if (!this.isCharging) return;
    this.isCharging = false;
    const power = Math.min(1, this.bowChargeTime / 1.5); // 1.5秒满蓄力
    if (power > 0.1) {
      this.shootArrow(power, enchantments);
    }
    this.bowChargeTime = 0;
  }

  // 每帧更新
  update(dt) {
    // 弓蓄力
    if (this.isCharging) {
      this.bowChargeTime += dt;
    }

    // 更新投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      if (proj.dead) {
        if (proj.mesh) this.game.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  // 清除所有投射物
  clear() {
    for (const proj of this.projectiles) {
      if (proj.mesh) this.game.scene.remove(proj.mesh);
    }
    this.projectiles = [];
  }

  // 接收远程投射物（多人模式）
  receiveProjectile(type, pos, dir, options = {}) {
    const proj = new Projectile(this.game, type, pos.x, pos.y, pos.z, dir, options);
    this.projectiles.push(proj);
    if (proj.mesh) this.game.scene.add(proj.mesh);
  }
}
