/**
 * player.js — 玩家状态、物理引擎和碰撞检测
 * AABB碰撞、重力、跳跃、行走、掉落伤害
 */

import { CHUNK_HEIGHT, BLOCK_DEFS, PLACEABLE_BLOCKS } from './blocks.js';
import { GAMEMODE, GAMEMODE_CONFIG } from './gamemodes.js';

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const PLAYER_EYE = 1.62;
const GRAVITY = 28;
const JUMP_VELOCITY = 9.5;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 7.5;
const FLY_SPEED = 10;
const MAX_FALL_SPEED = 50;

export class Player {
  constructor(world) {
    this.world = world;
    this.position = { x: 0, y: 40, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;   // 水平旋转角
    this.pitch = 0; // 垂直旋转角
    this.onGround = false;
    this.flying = false;
    this.sprinting = false;
    this.sneaking = false;

    // 生存属性
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.dead = false;

    // 氧气系统
    this.oxygen = 10;
    this.maxOxygen = 10;
    this.oxygenDamageTimer = 0;

    // 掉落伤害追踪
    this.fallStartY = null;
    this.lastGroundY = 40;

    // 游戏模式
    this.gamemode = GAMEMODE.SURVIVAL;
    this.gamemodeConfig = GAMEMODE_CONFIG[GAMEMODE.SURVIVAL];
    this.godMode = false;
    this.flySpeedMultiplier = 1;

    // 护甲
    this.armor = { helmet: 0, chestplate: 0, leggings: 0, boots: 0 };
    this.armorValues = { leather: 1, iron: 2, diamond: 3 };

    // 经验
    this.xp = 0;
    this.xpLevel = 0;

    // 多人同步
    this.needsSync = false;

    // 音效系统
    this.sound = null;

    // 背包系统
    this.inventory = new Array(36).fill(null); // 27 背包 + 9 快捷栏
    this.hotbarIndex = 0;

    // 初始物品
    this.giveStarterItems();
  }

  giveStarterItems() {
    const items = [
      { id: 1, count: 64 }, // 草方块
      { id: 3, count: 64 }, // 石头
      { id: 5, count: 32 }, // 原木
      { id: 7, count: 32 }, // 木板
      { id: 8, count: 32 }, // 圆石
      { id: 15, count: 1 }, // 工作台
      { id: 16, count: 16 },// 玻璃
      { id: 18, count: 16 },// 砖块
      { id: 4, count: 32 }, // 沙子
      { id: 155, count: 16 },// 种子
      { id: 141, count: 8 },// 面包
      { id: 142, count: 4 },// 苹果
    ];
    for (let i = 0; i < items.length; i++) {
      this.inventory[i] = { ...items[i] };
    }
  }

  // 设置游戏模式
  setGamemode(mode) {
    this.gamemode = mode;
    this.gamemodeConfig = GAMEMODE_CONFIG[mode] || GAMEMODE_CONFIG[GAMEMODE.SURVIVAL];
    if (this.gamemodeConfig.canFly) {
      // 不自动开启飞行，但允许切换
    } else {
      this.flying = false;
    }
    if (this.gamemodeConfig.infiniteBlocks) {
      // 创造模式填充所有方块
      this.fillCreativeInventory();
    }
    if (this.gamemodeConfig.noclip) {
      this.flying = true;
    }
    // 体验模式：给予初始物品（基础工具+武器+食物）
    if (this.gamemodeConfig.experienceMode) {
      this.fillExperienceInventory();
    }
  }

  fillCreativeInventory() {
    this.inventory = new Array(36).fill(null);
    for (let i = 0; i < PLACEABLE_BLOCKS.length && i < 36; i++) {
      this.inventory[i] = { id: PLACEABLE_BLOCKS[i], count: 64 };
    }
  }

  // 体验模式初始背包：基础工具、武器、食物
  fillExperienceInventory() {
    this.inventory = new Array(36).fill(null);
    // 快捷栏：基础工具和武器
    this.inventory[0] = { id: 148, count: 1 };  // 弓
    this.inventory[1] = { id: 149, count: 64 }; // 箭矢
    this.inventory[2] = { id: 164, count: 1 };  // 弩
    this.inventory[3] = { id: 165, count: 1 };  // 三叉戟
    this.inventory[4] = { id: 166, count: 64 }; // 雪球
    this.inventory[5] = { id: 141, count: 32 }; // 面包
    this.inventory[6] = { id: 142, count: 16 }; // 苹果
    this.inventory[7] = { id: 15, count: 1 };   // 工作台
    this.inventory[8] = { id: 5, count: 64 };   // 原木
  }

  // 获取护甲值
  getArmorValue() {
    let total = 0;
    for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
      const mat = this.armor[slot];
      if (mat && this.armorValues[mat]) total += this.armorValues[mat];
    }
    return total;
  }

  // 添加经验
  addXP(amount) {
    this.xp += amount;
    let needed = (this.xpLevel + 1) * 100;
    while (this.xp >= needed) {
      this.xp -= needed;
      this.xpLevel++;
      needed = (this.xpLevel + 1) * 100;
    }
  }

  // 检查是否能瞬间破坏
  canBreakInstantly() {
    return this.gamemodeConfig.canBreakInstantly || this.godMode;
  }

  // 检查是否能受到伤害
  canTakeDamage() {
    if (this.godMode) return false;
    if (!this.gamemodeConfig.canTakeDamage) return false;
    return true;
  }

  // 获取眼睛位置
  getEyePosition() {
    return {
      x: this.position.x,
      y: this.position.y + PLAYER_EYE,
      z: this.position.z,
    };
  }

  // 获取视线方向
  getLookDirection() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
  }

  // 获取玩家AABB
  getAABB(pos = this.position) {
    return {
      minX: pos.x - PLAYER_WIDTH / 2,
      maxX: pos.x + PLAYER_WIDTH / 2,
      minY: pos.y,
      maxY: pos.y + PLAYER_HEIGHT,
      minZ: pos.z - PLAYER_WIDTH / 2,
      maxZ: pos.z + PLAYER_WIDTH / 2,
    };
  }

  // 检查位置是否碰撞
  checkCollision(pos) {
    // 旁观模式穿墙
    if (this.gamemodeConfig && this.gamemodeConfig.noclip) return false;
    const aabb = this.getAABB(pos);
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
          if (blockId === 0) continue;
          const def = BLOCK_DEFS[blockId];
          if (!def || !def.solid) continue;
          // 方块AABB是 1x1x1
          if (aabb.maxX > x && aabb.minX < x + 1 &&
              aabb.maxY > y && aabb.minY < y + 1 &&
              aabb.maxZ > z && aabb.minZ < z + 1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 更新物理
  update(dt, input) {
    if (this.dead) return;

    // 处理输入移动
    this.handleMovement(dt, input);

    // 应用重力
    if (!this.flying) {
      const inWater = this.isInWater();
      if (inWater) {
        // 水中重力大幅减弱，模拟浮力
        this.velocity.y -= GRAVITY * 0.15 * dt;
        // 限制水中下沉速度
        if (this.velocity.y < -3.0) this.velocity.y = -3.0;
      } else {
        this.velocity.y -= GRAVITY * dt;
        if (this.velocity.y < -MAX_FALL_SPEED) {
          this.velocity.y = -MAX_FALL_SPEED;
        }
      }
    }

    // 移动并处理碰撞（分轴检测）
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('z', this.velocity.z * dt);

    // 掉落伤害追踪
    if (this.onGround) {
      if (this.fallStartY !== null) {
        const fallDistance = this.fallStartY - this.position.y;
        if (fallDistance > 3) {
          const damage = Math.floor(fallDistance - 3);
          this.takeDamage(damage);
        }
        this.fallStartY = null;
      }
      this.lastGroundY = this.position.y;
    } else if (this.velocity.y < 0 && this.fallStartY === null) {
      this.fallStartY = this.position.y;
    } else if (this.velocity.y < 0 && this.fallStartY !== null) {
      // 更新最高点
      if (this.position.y > this.fallStartY) {
        this.fallStartY = this.position.y;
      }
    }

    // 饥饿系统
    this.updateHunger(dt);

    // 氧气系统
    this.updateOxygen(dt);

    // 防止掉出世界
    if (this.position.y < -10) {
      this.takeDamage(20);
    }

    this.needsSync = true;
  }

  handleMovement(dt, input) {
    let speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (this.flying) speed = FLY_SPEED * (this.flySpeedMultiplier || 1);
    if (this.sneaking && !this.flying) speed *= 0.5;
    // 旁观模式更快
    if (this.gamemode === GAMEMODE.SPECTATOR) speed *= 1.5;

    // 水中减速
    const inWater = this.isInWater();
    if (inWater && !this.flying) speed *= 0.6;

    let forward = 0, strafe = 0;

    if (input.keys['KeyW']) forward += 1;
    if (input.keys['KeyS']) forward -= 1;
    if (input.keys['KeyA']) strafe -= 1;
    if (input.keys['KeyD']) strafe += 1;

    // 归一化对角线移动
    const len = Math.sqrt(forward * forward + strafe * strafe);
    if (len > 0) {
      forward /= len;
      strafe /= len;
    }

    const yaw = this.yaw;
    // 前进方向
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    // Minecraft 风格: W前进 = -Z方向
    const moveX = (-sinY * forward + cosY * strafe) * speed;
    const moveZ = (-cosY * forward - sinY * strafe) * speed;

    this.velocity.x = moveX;
    this.velocity.z = moveZ;

    // 跳跃
    if (input.keys['Space'] && this.onGround && !this.flying) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
    }

    // 水中物理：长按跳跃上浮，否则缓慢下沉
    if (inWater && !this.flying) {
      if (input.keys['Space']) {
        // 上浮
        this.velocity.y = 4.0;
      } else {
        // 自动缓慢下沉（比重力慢）
        this.velocity.y = Math.max(this.velocity.y, -3.0);
      }
    }

    // 飞行模式：视角决定飞行方向，Space/Shift 纯垂直升降
    if (this.flying) {
      // 计算视线方向（含俯仰角）
      const cp = Math.cos(this.pitch);
      const lookX = -sinY * cp;
      const lookY = Math.sin(this.pitch);
      const lookZ = -cosY * cp;
      // 右方向（水平面内垂直于视线）
      const rightX = cosY;
      const rightZ = -sinY;

      // 前进方向 = 视线方向 * forward + 右方向 * strafe
      this.velocity.x = (lookX * forward + rightX * strafe) * speed;
      this.velocity.z = (lookZ * forward + rightZ * strafe) * speed;
      // 垂直：视角俯仰 + Space/Shift 覆盖
      let vy = lookY * forward * speed;
      if (input.keys['Space']) vy = FLY_SPEED;
      else if (input.keys['ShiftLeft']) vy = -FLY_SPEED;
      this.velocity.y = vy;
    }
  }

  // 分轴移动碰撞
  moveAxis(axis, amount) {
    if (amount === 0) return;

    const newPos = { ...this.position };
    newPos[axis] += amount;

    if (!this.checkCollision(newPos)) {
      this.position[axis] = newPos[axis];
    } else {
      // 自动爬坡：水平移动被阻挡时，尝试向上跨1格
      if (axis !== 'y' && this.onGround && !this.sneaking && !this.flying) {
        const stepUpPos = { ...this.position };
        stepUpPos.y = this.position.y + 1.0;
        stepUpPos[axis] += amount;
        // 检查升高后前方是否有空间（含头顶空间）
        if (!this.checkCollision(stepUpPos)) {
          this.position.y = stepUpPos.y;
          this.position[axis] = newPos[axis];
          this.onGround = false; // 防止同一帧双重爬坡
          return;
        }
      }

      // 碰撞了，逐步逼近
      const step = amount > 0 ? 0.05 : -0.05;
      let remaining = Math.abs(amount);
      while (remaining > 0.05) {
        const testPos = { ...this.position };
        testPos[axis] += step;
        if (this.checkCollision(testPos)) break;
        this.position[axis] = testPos[axis];
        remaining -= 0.05;
      }
      // 停止该轴速度
      if (axis === 'y') {
        if (amount < 0) {
          this.onGround = true;
        }
        this.velocity.y = 0;
      } else {
        this.velocity[axis] = 0;
      }
    }

    // Y轴向下移动时检查地面
    if (axis === 'y' && amount > 0) {
      this.onGround = false;
    }
  }

  takeDamage(amount) {
    if (!this.canTakeDamage() || this.dead) return;
    // 护甲减伤
    const armor = this.getArmorValue();
    const reducedDamage = Math.max(1, amount - armor * 0.5);
    this.health -= Math.floor(reducedDamage);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    // 触发伤害闪屏
    const overlay = document.getElementById('damage-overlay');
    if (overlay) {
      overlay.classList.add('flash');
      setTimeout(() => overlay.classList.remove('flash'), 200);
    }
    // 受伤音效
    if (this.sound) this.sound.hurt();
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  updateHunger(dt) {
    // 消耗饱和度
    this.exhaustion += dt * (this.sprinting ? 0.4 : 0.1);
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) {
        this.saturation = Math.max(0, this.saturation - 1);
      } else if (this.hunger > 0) {
        this.hunger--;
      }
    }

    // 饱和度恢复生命
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.healTimer = (this.healTimer || 0) + dt;
      if (this.healTimer >= 4) {
        this.heal(1);
        this.healTimer = 0;
        this.saturation = Math.max(0, this.saturation - 1);
      }
    }

    // 饥饿伤害
    if (this.hunger <= 0) {
      this.starveTimer = (this.starveTimer || 0) + dt;
      if (this.starveTimer >= 4) {
        if (this.health > 10 || this.health <= 0) {
          this.takeDamage(1);
        }
        this.starveTimer = 0;
      }
    }
  }

  // 吃食物恢复饥饿
  eat(amount) {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    this.saturation = Math.min(this.maxHunger, this.saturation + amount * 0.5);
  }

  // 检查玩家是否在水中（身体任一部分）
  isInWater() {
    const px = Math.floor(this.position.x);
    const py = Math.floor(this.position.y + 0.5);
    const pz = Math.floor(this.position.z);
    return this.world.getBlock(px, py, pz) === 9; // BLOCK.WATER
  }

  // 检查头部是否在水中
  isHeadInWater() {
    const eye = this.getEyePosition();
    const blockId = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    return blockId === 9; // BLOCK.WATER
  }

  // 氧气系统更新
  updateOxygen(dt) {
    if (this.isHeadInWater()) {
      // 水下：逐步消耗氧气
      this.oxygen -= dt * 1.5; // 约6.7秒耗尽
      if (this.oxygen <= 0) {
        this.oxygen = 0;
        // 氧气不足时扣血
        this.oxygenDamageTimer += dt;
        if (this.oxygenDamageTimer >= 2) {
          this.takeDamage(2);
          this.oxygenDamageTimer = 0;
        }
      }
    } else {
      // 岸上：快速回复氧气
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 5);
      this.oxygenDamageTimer = 0;
    }
  }

  // 切换飞行模式
  toggleFly() {
    // 允许所有游戏模式飞行
    this.flying = !this.flying;
    this.velocity.y = 0;
    if (!this.flying) {
      // 关闭飞行时重置掉落追踪，防止瞬间坠落伤害
      this.fallStartY = null;
      this.onGround = false;
    }
  }

  // 检查是否可以使用方块（创造模式无限）
  consumeBlockForPlace() {
    if (this.gamemodeConfig.infiniteBlocks) return true;
    return this.consumeSelectedItem() !== null;
  }

  // 获取当前手持物品
  getSelectedItem() {
    return this.inventory[this.hotbarIndex];
  }

  // 添加物品到背包
  // preferHotbar=true 时优先放入快捷栏(0-8)的空槽，再放背包(9-35)
  addItem(blockId, count = 1, preferHotbar = false) {
    // 先尝试堆叠（所有槽位）
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i] && this.inventory[i].id === blockId && this.inventory[i].count < 64) {
        const canAdd = Math.min(64 - this.inventory[i].count, count);
        this.inventory[i].count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }
    // 放入空槽
    if (preferHotbar) {
      // 先找快捷栏空槽 (0-8)
      for (let i = 0; i < 9; i++) {
        if (!this.inventory[i]) {
          this.inventory[i] = { id: blockId, count: Math.min(64, count) };
          count -= this.inventory[i].count;
          if (count <= 0) return true;
        }
      }
    }
    // 再找所有空槽
    for (let i = 0; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = { id: blockId, count: Math.min(64, count) };
        count -= this.inventory[i].count;
        if (count <= 0) return true;
      }
    }
    return count <= 0;
  }

  // 消耗手持物品
  consumeSelectedItem() {
    const item = this.inventory[this.hotbarIndex];
    if (!item) return null;
    item.count--;
    if (item.count <= 0) {
      this.inventory[this.hotbarIndex] = null;
    }
    return item;
  }

  // 传送/重生
  respawn(x, y, z) {
    this.position = { x, y, z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.saturation = 5;
    this.oxygen = this.maxOxygen;
    this.dead = false;
    this.fallStartY = null;
    this.flying = false;
  }

  // 序列化（用于存档和多人同步）
  serialize() {
    return {
      position: { ...this.position },
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      inventory: this.inventory,
      hotbarIndex: this.hotbarIndex,
    };
  }

  deserialize(data) {
    this.position = data.position;
    this.yaw = data.yaw;
    this.pitch = data.pitch;
    this.health = data.health;
    this.hunger = data.hunger;
    this.inventory = data.inventory;
    this.hotbarIndex = data.hotbarIndex;
  }
}

export { PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE };
