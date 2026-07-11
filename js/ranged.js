/**
 * ranged.js — 弓箭/远程武器系统
 * 支持弓、弩、三叉戟、手枪、火箭筒、雪球、末影珍珠等远程武器
 * 包含弹道轨迹渲染、飞行特效与3D实体子弹模型
 */

import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS } from './blocks.js';

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
  BULLET: 'bullet',
  ROCKET: 'rocket',
  GATLING_BULLET: 'gatling_bullet',
  SNIPER_BULLET: 'sniper_bullet',
  QUANTUM_ORB: 'quantum_orb',
  DRAGON_FIRE: 'dragon_fire',
};

// 弹道轨迹颜色
const TRAIL_COLORS = {
  arrow: 0xcccccc,
  spectral_arrow: 0xffff44,
  trident: 0x44aaff,
  snowball: 0xffffff,
  egg: 0xffeecc,
  ender_pearl: 0x00aa44,
  fireball: 0xff6600,
  firework_rocket: 0xff6688,
  wither_skull: 0x444444,
  crossbow_bolt: 0xffcc44,
  bullet: 0xffdd44,
  rocket: 0xff4400,
  gatling_bullet: 0xffaa00,
  sniper_bullet: 0x66ffaa,
  quantum_orb: 0xcc44ff,
  dragon_fire: 0xff4400,
};

// ===== 辅助材质函数 =====
// 使用 MeshBasicMaterial 确保投射物在任何光照条件下都可见
function mat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

/** 递归设置 frustumCulled = false，防止小型投射物被错误剔除 */
function disableCulling(obj) {
  obj.frustumCulled = false;
  obj.traverse(child => { child.frustumCulled = false; });
}

// ===== 3D实体模型构建器 =====
// 所有模型沿 -Z 方向为"前方"（与 Three.js lookAt 非相机对象的 +Z 朝向目标一致，
// 但我们额外在 _orientToVelocity 中处理方向）

/** 箭矢模型：箭杆 + 箭头 + 羽毛 */
function buildArrowModel(spectral) {
  const g = new THREE.Group();
  const shaftColor = spectral ? 0xffff88 : 0xc4985a;
  const headColor = spectral ? 0xffff44 : 0xcccccc;
  const featherColor = spectral ? 0xffff44 : 0xffffff;

  // 箭杆
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6),
    mat(shaftColor)
  );
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);

  // 箭头 — 圆锥
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.15, 6),
    mat(headColor)
  );
  head.position.z = 0.42;
  head.rotation.x = Math.PI / 2;
  g.add(head);

  // 羽毛 — 三片
  for (let i = 0; i < 3; i++) {
    const feather = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.1),
      mat(featherColor)
    );
    feather.position.z = -0.35;
    feather.rotation.z = (i * Math.PI * 2) / 3;
    g.add(feather);
  }

  return g;
}

/** 弩箭模型 */
function buildCrossbowBoltModel() {
  const g = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6),
    mat(0x5a3d1e)
  );
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.12, 4),
    mat(0xffcc44)
  );
  head.position.z = 0.33;
  head.rotation.x = Math.PI / 2;
  g.add(head);

  for (let i = 0; i < 2; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.02, 0.1),
      mat(0xddcc88)
    );
    fin.position.z = -0.27;
    fin.rotation.z = i * Math.PI / 2;
    g.add(fin);
  }

  return g;
}

/** 三叉戟模型 */
function buildTridentProjectileModel() {
  const g = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6),
    mat(0x5a4a3a)
  );
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);

  const headMat = mat(0x4ac8e0);

  // 中央矛头
  const spear = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.03),
    headMat
  );
  spear.position.z = 0.6;
  g.add(spear);

  // 矛尖
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.1, 4),
    headMat
  );
  tip.position.z = 0.74;
  tip.rotation.x = Math.PI / 2;
  g.add(tip);

  // 左右分叉
  const leftProng = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.16, 0.03),
    headMat
  );
  leftProng.position.set(-0.09, 0, 0.55);
  leftProng.rotation.z = 0.25;
  g.add(leftProng);

  const rightProng = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.16, 0.03),
    headMat
  );
  rightProng.position.set(0.09, 0, 0.55);
  rightProng.rotation.z = -0.25;
  g.add(rightProng);

  return g;
}

/** 雪球模型 */
function buildSnowballModel() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    mat(0xffffff)
  );
  g.add(ball);
  return g;
}

/** 鸡蛋模型 */
function buildEggModel() {
  const g = new THREE.Group();
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    mat(0xffeecc)
  );
  egg.scale.set(1, 1.3, 1);
  g.add(egg);
  return g;
}

/** 末影珍珠模型 */
function buildEnderPearlModel() {
  const g = new THREE.Group();
  const pearl = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    mat(0x1a8b4a)
  );
  g.add(pearl);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.01, 4, 12),
      mat(0x2acc55)
    );
    ring.rotation.x = (i * Math.PI) / 4;
    g.add(ring);
  }

  return g;
}

/** 火球模型 */
function buildFireballModel() {
  const g = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    mat(0xffee44)
  );
  g.add(core);

  const outer = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 6),
    mat(0xff4400, { transparent: true, opacity: 0.5 })
  );
  g.add(outer);

  for (let i = 0; i < 5; i++) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.2, 4),
      mat(0xff6600)
    );
    const angle = (i / 5) * Math.PI * 2;
    flame.position.set(Math.cos(angle) * 0.35, Math.sin(angle) * 0.35, 0);
    flame.rotation.z = angle - Math.PI / 2;
    g.add(flame);
  }

  return g;
}

/** 凋零骷髅头模型 */
function buildWitherSkullModel() {
  const g = new THREE.Group();
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    mat(0x222222)
  );
  g.add(skull);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xff0000));
  leftEye.position.set(-0.1, 0.05, 0.25);
  g.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xff0000));
  rightEye.position.set(0.1, 0.05, 0.25);
  g.add(rightEye);

  return g;
}

/** 烟花火箭模型 */
function buildFireworkRocketModel() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
    mat(0xff4488)
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.14, 8),
    mat(0xffcc00)
  );
  nose.position.z = 0.27;
  nose.rotation.x = Math.PI / 2;
  g.add(nose);

  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.02, 0.08),
      mat(0x4488ff)
    );
    fin.position.z = -0.22;
    fin.rotation.z = (i * Math.PI * 2) / 3;
    g.add(fin);
  }

  return g;
}

/** 加特林子弹模型（小型高速弹） */
function buildGatlingBulletModel() {
  const g = new THREE.Group();

  // 弹头（小尖头）
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.1, 6),
    mat(0xffaa00)
  );
  tip.position.z = 0.08;
  tip.rotation.x = Math.PI / 2;
  g.add(tip);

  // 弹体
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6),
    mat(0xcc8800)
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // 尾部微光
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 4),
    mat(0xff6600, { transparent: true, opacity: 0.6 })
  );
  glow.position.z = -0.08;
  g.add(glow);

  return g;
}

/** 狙击枪子弹模型（大型穿甲弹） */
function buildSniperBulletModel() {
  const g = new THREE.Group();

  // 穿甲弹头（铜色尖头）
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.2, 8),
    mat(0xb8860b)
  );
  tip.position.z = 0.16;
  tip.rotation.x = Math.PI / 2;
  g.add(tip);

  // 弹体
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8),
    mat(0xdaa520)
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  // 弹底
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.055, 0.04, 8),
    mat(0x8b7500)
  );
  base.position.z = -0.15;
  base.rotation.x = Math.PI / 2;
  g.add(base);

  // 绿色能量光晕（辨识狙击弹）
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    mat(0x66ffaa, { transparent: true, opacity: 0.3 })
  );
  g.add(aura);

  return g;
}

/** 湮灭炮量子球模型（紫色能量球 + 旋转环） */
function buildQuantumOrbModel() {
  const g = new THREE.Group();

  // 核心能量球
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    mat(0xcc44ff, { transparent: true, opacity: 0.85 })
  );
  g.add(core);

  // 外层光晕
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    mat(0xff66ff, { transparent: true, opacity: 0.25 })
  );
  g.add(aura);

  // 旋转能量环（3个不同角度的环）
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.01, 4, 12),
      mat(0xdd88ff)
    );
    ring.rotation.x = (i / 3) * Math.PI;
    ring.rotation.y = (i / 3) * Math.PI * 0.5;
    g.add(ring);
  }

  return g;
}

/** 龙息炮火焰球模型（火球 + 拖尾翼 + 能量光晕） */
function buildDragonFireModel() {
  const g = new THREE.Group();

  // 核心火球
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    mat(0xff4400, { transparent: true, opacity: 0.9 })
  );
  g.add(core);

  // 内层亮焰
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    mat(0xffaa00, { transparent: true, opacity: 0.7 })
  );
  g.add(inner);

  // 外层光晕
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    mat(0xff6600, { transparent: true, opacity: 0.25 })
  );
  g.add(aura);

  // 拖尾翼片（3片，向后延伸）
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.18, 4),
      mat(0xff8800, { transparent: true, opacity: 0.6 })
    );
    fin.position.z = -0.15;
    fin.rotation.x = -Math.PI / 2;
    fin.rotation.y = (i / 3) * Math.PI * 2;
    fin.rotation.z = Math.PI / 2;
    g.add(fin);
  }

  return g;
}

/** 子弹模型 */
function buildBulletModel() {
  const g = new THREE.Group();

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 8),
    mat(0xffdd44)
  );
  tip.position.z = 0.12;
  tip.rotation.x = Math.PI / 2;
  g.add(tip);

  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8),
    mat(0xddbb66)
  );
  casing.rotation.x = Math.PI / 2;
  g.add(casing);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.05, 0.03, 8),
    mat(0xaa8844)
  );
  base.position.z = -0.11;
  base.rotation.x = Math.PI / 2;
  g.add(base);

  return g;
}

/** 火箭弹模型 */
function buildRocketModel() {
  const g = new THREE.Group();

  const warhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.25, 8),
    mat(0x444444)
  );
  warhead.position.z = 0.3;
  warhead.rotation.x = Math.PI / 2;
  g.add(warhead);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8),
    mat(0x666666)
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.12),
      mat(0x888888)
    );
    fin.position.z = -0.24;
    fin.rotation.z = (i * Math.PI) / 2;
    g.add(fin);
  }

  // 推进火焰
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.3, 6),
    mat(0xff6600, { transparent: true, opacity: 0.7 })
  );
  flame.position.z = -0.4;
  flame.rotation.x = -Math.PI / 2;
  g.add(flame);

  return g;
}

// ===== 投射物类 =====
export class Projectile {
  constructor(game, type, x, y, z, dir, options = {}) {
    this.game = game;
    this.type = type;

    // 验证生成位置 — 如果在方块内，沿视线方向前移直到找到空气
    if (game && game.world) {
      for (let i = 0; i < 6; i++) {
        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);
        const block = game.world.getBlock(bx, by, bz);
        if (block === 0) break;
        // 沿视线方向前移0.5格
        x += dir.x * 0.5;
        y += dir.y * 0.5;
        z += dir.z * 0.5;
      }
    }

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
    this.owner = options.owner || null;
    this.inGround = false;
    this.mesh = null;
    this.gravity = options.gravity !== undefined ? options.gravity : 1;
    this.piercing = options.piercing || 0;
    this.hitEntities = new Set();
    this.onHitBlock = options.onHitBlock || null;
    this.onHitEntity = options.onHitEntity || null;
    this.enchantments = options.enchantments || {};

    // 弹道轨迹
    this.trail = null;
    this.trailPoints = [];
    this.maxTrailPoints = 30;
    this.particleTimer = 0;

    // 卡在方块中的计时
    this.stuckTimer = 0;
    this.stuckDuration = 5; // 卡在方块中5秒后消失

    // 旋转动画参数
    this._spinSpeed = options.spinSpeed || 0;

    this.createMesh();
    this.createTrail();
  }

  /** 创建3D实体模型并添加到场景 */
  createMesh() {
    const model = this._buildModel();
    this.mesh = model;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 关键：禁用 frustum culling，防止小投射物被错误剔除导致不可见
    disableCulling(this.mesh);

    // 朝向运动方向
    this._orientToVelocity();

    // 为发光投射物添加点光源
    const glowTypes = [
      PROJECTILE_TYPE.FIREBALL,
      PROJECTILE_TYPE.SPECTRAL_ARROW,
      PROJECTILE_TYPE.ENDER_PEARL,
      PROJECTILE_TYPE.ROCKET,
    ];
    if (glowTypes.includes(this.type)) {
      const lightColor = this._getTrailColor();
      const light = new THREE.PointLight(lightColor, 1.0, 6);
      this.mesh.add(light);
    }

    // 立即添加到场景
    if (this.game.scene) {
      this.game.scene.add(this.mesh);
    }
  }

  /** 根据类型构建3D模型 */
  _buildModel() {
    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
        return buildArrowModel(false);
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
        return buildArrowModel(true);
      case PROJECTILE_TYPE.CROSSBOW_BOLT:
        return buildCrossbowBoltModel();
      case PROJECTILE_TYPE.TRIDENT:
        return buildTridentProjectileModel();
      case PROJECTILE_TYPE.SNOWBALL:
        return buildSnowballModel();
      case PROJECTILE_TYPE.EGG:
        return buildEggModel();
      case PROJECTILE_TYPE.ENDER_PEARL:
        return buildEnderPearlModel();
      case PROJECTILE_TYPE.FIREBALL:
        return buildFireballModel();
      case PROJECTILE_TYPE.WITHER_SKULL:
        return buildWitherSkullModel();
      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        return buildFireworkRocketModel();
      case PROJECTILE_TYPE.BULLET:
        return buildBulletModel();
      case PROJECTILE_TYPE.ROCKET:
        return buildRocketModel();
      case PROJECTILE_TYPE.GATLING_BULLET:
        return buildGatlingBulletModel();
      case PROJECTILE_TYPE.SNIPER_BULLET:
        return buildSniperBulletModel();
      case PROJECTILE_TYPE.QUANTUM_ORB:
        return buildQuantumOrbModel();
      case PROJECTILE_TYPE.DRAGON_FIRE:
        return buildDragonFireModel();
      default:
        return new THREE.Group();
    }
  }

  /** 朝向运动方向 */
  _orientToVelocity() {
    const dir = this.velocity;
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (len > 0.001) {
      // lookAt 对非相机对象：使 +Z 轴朝向目标点
      this.mesh.lookAt(
        this.position.x + dir.x / len,
        this.position.y + dir.y / len,
        this.position.z + dir.z / len
      );
    }
  }

  createTrail() {
    const color = this._getTrailColor();
    const trailMat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const trailGeom = new THREE.BufferGeometry();
    trailGeom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.maxTrailPoints * 3), 3));
    trailGeom.setDrawRange(0, 0);
    this.trail = new THREE.Line(trailGeom, trailMat);
    this.trail.frustumCulled = false;
    if (this.game.scene) this.game.scene.add(this.trail);
  }

  _getTrailColor() {
    return TRAIL_COLORS[this.type] || 0xffffff;
  }

  update(dt) {
    if (this.dead) return;

    // 确保 dt 有效
    if (!dt || dt <= 0) dt = 0.016;
    this._dt = dt;

    this.lifetime += dt;
    if (this.lifetime > this.maxLifetime) {
      this.dead = true;
      return;
    }

    if (this.inGround) {
      this.stuckTimer += dt;
      // 渐隐轨迹线 — 0.4秒内消失
      if (this.trail && this.trail.material.opacity > 0) {
        this.trail.material.opacity = Math.max(0, 0.8 - this.stuckTimer * 2);
        if (this.trail.material.opacity <= 0) {
          this.trail.visible = false;
        }
      }
      // stuckDuration秒后消失
      if (this.stuckTimer > this.stuckDuration) {
        this.dead = true;
      }
      return;
    }

    // 重力
    if (this.gravity > 0) {
      this.velocity.y -= 15 * this.gravity * dt;
    }

    // 移动
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // 更新网格位置和朝向
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this._orientToVelocity();

      if (this._spinSpeed > 0) {
        this.mesh.rotateZ(this._spinSpeed * dt);
      }
    }

    // 更新弹道轨迹
    this._updateTrail();

    // 飞行粒子特效
    this._updateFlightParticles(dt);

    // 方块碰撞检测 — 使用扫掠检测，避免高速穿透
    if (this.lifetime > 0.05) {
      const moveX = this.velocity.x * dt;
      const moveY = this.velocity.y * dt;
      const moveZ = this.velocity.z * dt;
      const moveDist = Math.sqrt(moveX * moveX + moveY * moveY + moveZ * moveZ);
      const numSteps = Math.max(1, Math.ceil(moveDist * 2)); // 每0.5格检查一次
      const oldX = this.position.x - moveX;
      const oldY = this.position.y - moveY;
      const oldZ = this.position.z - moveZ;

      for (let s = 1; s <= numSteps; s++) {
        const t = s / numSteps;
        const cx = Math.floor(oldX + moveX * t);
        const cy = Math.floor(oldY + moveY * t);
        const cz = Math.floor(oldZ + moveZ * t);
        const block = this.game.world.getBlock(cx, cy, cz);
        if (block !== 0) {
          // 回退到碰撞点
          this.position.x = oldX + moveX * t;
          this.position.y = oldY + moveY * t;
          this.position.z = oldZ + moveZ * t;
          if (this.mesh) {
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);
          }
          this.onBlockHit(cx, cy, cz);
          break;
        }
      }
    }

    // 实体碰撞检测
    this.checkEntityCollision(dt);

    // 特殊效果
    this.updateSpecial(dt);
  }

  _updateTrail() {
    this.trailPoints.unshift({
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    });

    if (this.trailPoints.length > this.maxTrailPoints) {
      this.trailPoints.pop();
    }

    if (!this.trail || this.trailPoints.length < 2) return;

    const positions = this.trail.geometry.attributes.position.array;
    for (let i = 0; i < this.trailPoints.length; i++) {
      positions[i * 3] = this.trailPoints[i].x;
      positions[i * 3 + 1] = this.trailPoints[i].y;
      positions[i * 3 + 2] = this.trailPoints[i].z;
    }

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.trailPoints.length);
  }

  _updateFlightParticles(dt) {
    this.particleTimer += dt;
    if (this.particleTimer < 0.02) return;
    this.particleTimer = 0;

    if (!this.game.effects) return;

    const px = Math.floor(this.position.x);
    const py = Math.floor(this.position.y);
    const pz = Math.floor(this.position.z);

    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
        if (Math.random() < 0.3) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xaaaaaa);
        }
        break;
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xffff44);
        break;
      case PROJECTILE_TYPE.TRIDENT:
        if (Math.random() < 0.4) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0x44aaff);
        }
        break;
      case PROJECTILE_TYPE.FIREBALL:
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xff6600);
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xffaa00);
        break;
      case PROJECTILE_TYPE.ENDER_PEARL:
        this.game.effects.createBlockBreakParticles(px, py, pz, 0x00aa44);
        break;
      case PROJECTILE_TYPE.CROSSBOW_BOLT:
        if (Math.random() < 0.3) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xffcc44);
        }
        break;
      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        const fwColors = [0xff4444, 0xffcc00, 0x44ff44, 0x4488ff];
        this.game.effects.createBlockBreakParticles(px, py, pz, fwColors[Math.floor(Math.random() * fwColors.length)]);
        break;
      case PROJECTILE_TYPE.BULLET:
        if (Math.random() < 0.2) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xffdd44);
        }
        break;
      case PROJECTILE_TYPE.GATLING_BULLET:
        if (Math.random() < 0.04) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xffaa00);
        }
        break;
      case PROJECTILE_TYPE.SNIPER_BULLET:
        this.game.effects.createBlockBreakParticles(px, py, pz, 0x66ffaa);
        break;
      case PROJECTILE_TYPE.QUANTUM_ORB:
        if (this.game.effects) {
          this.game.effects.createQuantumTrail(this.position.x, this.position.y, this.position.z);
        }
        break;
      case PROJECTILE_TYPE.DRAGON_FIRE:
        // 火焰投射物拖尾粒子
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xff4400);
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xffaa00);
        if (Math.random() < 0.3) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xff8800);
        }
        break;
      case PROJECTILE_TYPE.ROCKET:
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xff6600);
        this.game.effects.createBlockBreakParticles(px, py, pz, 0xffaa00);
        this.game.effects.createBlockBreakParticles(px, py, pz, 0x444444);
        break;
      case PROJECTILE_TYPE.SNOWBALL:
      case PROJECTILE_TYPE.EGG:
        if (Math.random() < 0.2) {
          this.game.effects.createBlockBreakParticles(px, py, pz, 0xffffff);
        }
        break;
    }
  }

  onBlockHit(x, y, z) {
    // 检查是否击中TNT方块 — 射击引爆TNT
    const hitBlockId = this.game.world.getBlock(x, y, z);
    if (hitBlockId === BLOCK.TNT) {
      // 移除TNT方块
      this.game.world.setBlock(x, y, z, 0);
      // 立即触发爆炸（破坏方块 + 范围伤害）
      if (this.game.effects) {
        try {
          this.game.effects.createExplosion(x + 0.5, y + 0.5, z + 0.5, 4);
        } catch (e) { /* 忽略 */ }
      }
      // 音效
      if (this.game.sound && this.game.sound.explosion) {
        this.game.sound.explosion();
      }
      this.dead = true;
      return;
    }

    if (this.onHitBlock) {
      this.onHitBlock(x, y, z, this);
      return;
    }

    switch (this.type) {
      case PROJECTILE_TYPE.ARROW:
      case PROJECTILE_TYPE.SPECTRAL_ARROW:
      case PROJECTILE_TYPE.TRIDENT:
      case PROJECTILE_TYPE.CROSSBOW_BOLT:
        this.inGround = true;
        this.stuckTimer = 0;
        this.velocity = { x: 0, y: 0, z: 0 };
        if (this.game.effects) {
          try {
            this.game.effects.createBlockBreakParticles(x, y, z, this._getTrailColor());
          } catch (e) { /* 忽略 */ }
        }
        break;

      case PROJECTILE_TYPE.BULLET:
        if (this.game.effects) {
          try {
            for (let i = 0; i < 3; i++) {
              this.game.effects.createBlockBreakParticles(x, y, z, 0xffdd44);
            }
          } catch (e) { /* 忽略 */ }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.GATLING_BULLET:
        if (this.game.effects) {
          try {
            this.game.effects.createBlockBreakParticles(x, y, z, 0xffaa00);
          } catch (e) { /* 忽略 */ }
        }
        // 累积伤害破坏方块
        this._gatlingDamageBlock(x, y, z);
        this.dead = true;
        break;

      case PROJECTILE_TYPE.SNIPER_BULLET:
        if (this.game.effects) {
          try {
            // 狙击弹击中产生大量火花
            for (let i = 0; i < 8; i++) {
              this.game.effects.createBlockBreakParticles(x, y, z, 0x66ffaa);
            }
            // 额外闪光
            this.game.effects.createFlash(x + 0.5, y + 0.5, z + 0.5, 2);
          } catch (e) { /* 忽略 */ }
        }
        // 狙击弹范围破坏方块
        this._sniperDestroyArea(x, y, z);
        this.dead = true;
        break;

      case PROJECTILE_TYPE.QUANTUM_ORB:
        // 量子球击中：创建引力漩涡
        if (this.game.effects) {
          try {
            this.game.effects.createQuantumVortex(x + 0.5, y + 0.5, z + 0.5, 3, 5);
          } catch (e) { /* 忽略 */ }
        }
        // 漩涡吸引并伤害附近实体
        this._quantumVortexPull(x + 0.5, y + 0.5, z + 0.5);
        this.dead = true;
        break;

      case PROJECTILE_TYPE.ROCKET:
        if (this.game.effects) {
          try {
            this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 4);
          } catch (e) { /* 忽略 */ }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.SNOWBALL:
      case PROJECTILE_TYPE.EGG:
        if (this.game.effects) {
          try {
            this.game.effects.createBlockBreakParticles(x, y, z, 0xffffff);
          } catch (e) { /* 忽略 */ }
        }
        if (this.type === PROJECTILE_TYPE.EGG && Math.random() < 0.125) {
          if (this.game.mobs) {
            this.game.mobs.spawnMob(x + 0.5, y + 1, z + 0.5, 'chicken');
          }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.ENDER_PEARL:
        if (this.owner && this.owner.position) {
          this.owner.position = { x: this.position.x, y: this.position.y + 1, z: this.position.z };
          this.owner.velocity = { x: 0, y: 0, z: 0 };
          if (this.owner.takeDamage) {
            this.owner.takeDamage(5);
          }
          if (this.game.effects) {
            try {
              this.game.effects.createBlockBreakParticles(x, y, z, 0x00aa44);
              this.game.effects.createBlockBreakParticles(
                Math.floor(this.owner.position.x), Math.floor(this.owner.position.y), Math.floor(this.owner.position.z), 0x00aa44
              );
            } catch (e) { /* 忽略 */ }
          }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.FIREBALL:
        if (this.game.effects) {
          try {
            this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 2);
          } catch (e) { /* 忽略 */ }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.WITHER_SKULL:
        if (this.game.effects) {
          try {
            this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 1);
          } catch (e) { /* 忽略 */ }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.FIREWORK_ROCKET:
        if (this.game.effects) {
          try {
            this.game.effects.createBlockBreakParticles(x, y, z, 0xff6688);
            this.game.effects.createBlockBreakParticles(x, y, z, 0xffcc00);
            this.game.effects.createBlockBreakParticles(x, y, z, 0x44ff44);
          } catch (e) { /* 忽略 */ }
        }
        this.dead = true;
        break;

      case PROJECTILE_TYPE.DRAGON_FIRE:
        // 火焰投射物命中方块：火焰爆炸
        this._dragonFireExplode(x + 0.5, y + 0.5, z + 0.5);
        this.dead = true;
        break;

      default:
        this.dead = true;
    }
  }

  // 检查点是否在生物的 AABB 盒内（带边距扩展）
  _pointInMobAABB(px, py, pz, mob, padding) {
    return px >= mob.position.x - mob.width / 2 - padding &&
           px <= mob.position.x + mob.width / 2 + padding &&
           py >= mob.position.y - padding &&
           py <= mob.position.y + mob.height + padding &&
           pz >= mob.position.z - mob.width / 2 - padding &&
           pz <= mob.position.z + mob.width / 2 + padding;
  }

  checkEntityCollision(dt) {
    if (!this.game.mobs || !this.game.mobs.mobs) return;

    if (!dt) dt = this._dt || 0.016;

    // 计算本帧位移用于扫掠检测（防止高速弹穿透实体）
    const moveX = this.velocity.x * dt;
    const moveY = this.velocity.y * dt;
    const moveZ = this.velocity.z * dt;
    const moveDist = Math.sqrt(moveX * moveX + moveY * moveY + moveZ * moveZ);
    const numSteps = Math.max(1, Math.ceil(moveDist * 2)); // 每0.5格检查一次
    const oldX = this.position.x - moveX;
    const oldY = this.position.y - moveY;
    const oldZ = this.position.z - moveZ;
    const padding = 0.25;

    for (const mob of this.game.mobs.mobs) {
      if (this.hitEntities.has(mob.id)) continue;
      if (this.owner === mob) continue;

      // AABB 盒检测 + 扫掠检测
      let hit = false;
      let hitY = this.position.y; // 记录命中时的 y 坐标用于爆头判定
      for (let s = 1; s <= numSteps; s++) {
        const t = s / numSteps;
        const px = oldX + moveX * t;
        const py = oldY + moveY * t;
        const pz = oldZ + moveZ * t;
        if (this._pointInMobAABB(px, py, pz, mob, padding)) {
          hit = true;
          hitY = py;
          // 将投射物位置回退到命中点
          this.position.x = px;
          this.position.y = py;
          this.position.z = pz;
          if (this.mesh) {
            this.mesh.position.set(px, py, pz);
          }
          break;
        }
      }

      if (hit) {
        // 爆头判定：命中点在生物高度的上 25% 区域
        const isHeadshot = hitY >= mob.position.y + mob.height * 0.75;
        this.onEntityHit(mob, isHeadshot);
        this.hitEntities.add(mob.id);
        if (this.piercing <= 0) {
          this.dead = true;
          break;
        }
        this.piercing--;
      }
    }

    if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
      for (const [id, rp] of this.game.multiplayer.remotePlayers) {
        if (this.owner === rp) continue;
        const dx = rp.position.x - this.position.x;
        const dy = (rp.position.y + 0.9) - this.position.y;
        const dz = rp.position.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.8) {
          if (this.game.multiplayer) {
            this.game.multiplayer.sendPlayerDamage(id, this.damage);
          }
          if (this.game.effects) {
            this.game.effects.createBlockBreakParticles(
              Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z),
              this._getTrailColor()
            );
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

  onEntityHit(mob, isHeadshot = false) {
    if (this.onHitEntity) {
      this.onHitEntity(mob, this);
      return;
    }

    let damage = this.damage;
    let isCritical = false;

    // 暴击：15%概率造成2倍伤害（不包括爆头，爆头与暴击互斥）
    if (!isHeadshot && Math.random() < 0.15) {
      isCritical = true;
      damage = Math.floor(damage * 2);
    }

    // 爆头加成：伤害 ×1.5
    if (isHeadshot) {
      damage = Math.floor(damage * 1.5);
    }

    if (this.enchantments.power) {
      damage += this.enchantments.power * 0.5;
    }
    if (this.enchantments.flame) {
      mob.burning = 5;
    }
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

    // 命中粒子：减少粒子数量以降低卡顿（仅1个粒子）
    if (this.game.effects) {
      this.game.effects.createBlockBreakParticles(
        Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z),
        isCritical ? 0xff00ff : this._getTrailColor()
      );
    }

    if (this.type === PROJECTILE_TYPE.ROCKET && this.game.effects) {
      this.game.effects.createExplosion(this.position.x, this.position.y, this.position.z, 4);
    }

    // 狙击弹命中实体产生冲击波粒子（减少为3个）
    if (this.type === PROJECTILE_TYPE.SNIPER_BULLET && this.game.effects) {
      for (let i = 0; i < 3; i++) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0x66ffaa
        );
      }
    }

    // 龙息炮命中实体：火焰爆炸 + 灼烧
    if (this.type === PROJECTILE_TYPE.DRAGON_FIRE) {
      this._dragonFireExplode(this.position.x, this.position.y, this.position.z);
      mob._burnTimer = 5; // 灼烧 5 秒
    }

    // 湮灭炮命中实体：引力漩涡爆炸（对范围内僵尸造成伤害）
    if (this.type === PROJECTILE_TYPE.QUANTUM_ORB) {
      if (this.game.effects) {
        try {
          this.game.effects.createQuantumVortex(this.position.x, this.position.y, this.position.z, 3, 5);
        } catch (e) { /* 忽略 */ }
      }
      this._quantumVortexPull(this.position.x, this.position.y, this.position.z);
    }

    // 击退效果（尊重 knockbackImmune 属性）
    const dx = mob.position.x - this.position.x;
    const dz = mob.position.z - this.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0 && !mob.knockbackImmune) {
      let knockback = 2;
      let knockup = 3;
      let stunTime = 0;
      if (this.type === PROJECTILE_TYPE.ROCKET) { knockback = 8; knockup = 5; stunTime = 0.3; }
      else if (this.type === PROJECTILE_TYPE.BULLET) { knockback = 4; knockup = 2.5; stunTime = 0.15; }
      else if (this.type === PROJECTILE_TYPE.GATLING_BULLET) { knockback = 3; knockup = 2; stunTime = 0.1; }
      else if (this.type === PROJECTILE_TYPE.SNIPER_BULLET) { knockback = 6; knockup = 4; stunTime = 0.4; }
      else if (this.type === PROJECTILE_TYPE.DRAGON_FIRE) { knockback = 3; knockup = 3; stunTime = 0.2; }
      // 爆头额外击退
      if (isHeadshot) { knockback *= 1.5; stunTime += 0.1; }
      mob.velocity.x += (dx / len) * knockback;
      mob.velocity.z += (dz / len) * knockback;
      mob.velocity.y = knockup;
      // 短暂眩晕：被击中的僵尸暂停移动和攻击
      if (stunTime > 0) {
        mob._stunTimer = Math.max(mob._stunTimer || 0, stunTime);
      }
    }

    if (this.game.effects) {
      // 暴击用金色，爆头用红色，其他用白色
      let dmgColor = '#ffffff';
      if (isCritical) dmgColor = '#ff00ff';
      else if (isHeadshot) dmgColor = '#ff4444';
      this.game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, damage, dmgColor);
      // 暴击额外特效：紫色火花（仅2个粒子）
      if (isCritical && this.game.effects.createBlockBreakParticles) {
        for (let i = 0; i < 2; i++) {
          this.game.effects.createBlockBreakParticles(
            Math.floor(mob.position.x), Math.floor(mob.position.y + mob.height * 0.8), Math.floor(mob.position.z),
            0xff00ff
          );
        }
      }
      // 爆头额外特效（仅2个粒子）
      else if (isHeadshot && this.game.effects.createBlockBreakParticles) {
        for (let i = 0; i < 2; i++) {
          this.game.effects.createBlockBreakParticles(
            Math.floor(mob.position.x), Math.floor(mob.position.y + mob.height * 0.8), Math.floor(mob.position.z),
            0xff4444
          );
        }
      }
    }
  }

  updateSpecial(dt) {
    if (this.type === PROJECTILE_TYPE.FIREBALL && this.game.effects) {
      if (Math.random() < 0.5) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0xff6600
        );
      }
    }

    if (this.type === PROJECTILE_TYPE.ENDER_PEARL && this.game.effects) {
      if (Math.random() < 0.3) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0x00aa44
        );
      }
    }

    if (this.type === PROJECTILE_TYPE.ROCKET && this.game.effects) {
      if (Math.random() < 0.8) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0xff4400
        );
      }
    }

    // 加特林子弹飞行轨迹火花 — 大幅降低概率避免连发时卡顿
    if (this.type === PROJECTILE_TYPE.GATLING_BULLET && this.game.effects) {
      if (Math.random() < 0.06) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0xffaa00
        );
      }
    }

    // 狙击弹飞行轨迹光带
    if (this.type === PROJECTILE_TYPE.SNIPER_BULLET && this.game.effects) {
      if (Math.random() < 0.5) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z), 0x66ffaa
        );
      }
    }
  }

  // 加特林累积伤害破坏方块
  _gatlingDamageBlock(x, y, z) {
    if (!this.game.world || !this.game.destroyBlock) return;

    const blockId = this.game.world.getBlock(x, y, z);
    if (blockId === 0) return;

    // 基岩不可破坏
    if (blockId === BLOCK.BEDROCK) return;

    // 根据方块硬度决定需要的击中次数
    const def = BLOCK_DEFS[blockId];
    let requiredHits = 5; // 默认5发
    if (def) {
      if (def.hardness) {
        requiredHits = Math.ceil(def.hardness / 3);
      } else if (def.name) {
        // 软方块（泥土、沙子等）3发
        if (def.name.includes('泥') || def.name.includes('草') || def.name.includes('沙') ||
            def.name.includes('雪') || def.name.includes('叶') || def.name.includes('花') ||
            def.name.includes('木板') || def.name.includes('原木')) {
          requiredHits = 3;
        }
        // 硬方块（石头、矿石等）8发
        if (def.name.includes('石') || def.name.includes('铁') || def.name.includes('砖') ||
            def.name.includes('钻') || def.name.includes('绿')) {
          requiredHits = 8;
        }
        // 黑曜石不可破坏
        if (def.name.includes('黑曜石')) return;
      }
    }
    requiredHits = Math.max(2, Math.min(20, requiredHits));

    const key = `${x},${y},${z}`;
    const damageMap = this.game._gatlingBlockDamage;
    const current = damageMap.get(key) || 0;
    const newDamage = current + 1;

    if (newDamage >= requiredHits) {
      // 达到阈值，破坏方块
      this.game.destroyBlock(x, y, z, true);
      damageMap.delete(key);
    } else {
      damageMap.set(key, newDamage);
      // 清理过期的伤害记录（5秒后自动清除）
      if (!this.game._gatlingCleanupTimer) {
        this.game._gatlingCleanupTimer = 0;
      }
    }
  }

  // 巴雷特范围破坏方块（十字形 3x1x3）
  _sniperDestroyArea(x, y, z) {
    if (!this.game.world || !this.game.destroyBlock) return;

    // 直接命中的方块
    this.game.destroyBlock(x, y, z, false);

    // 周围方块（水平十字方向 + 上下各一层），形成小范围破坏
    const offsets = [
      [1, 0, 0], [-1, 0, 0],   // 东西
      [0, 0, 1], [0, 0, -1],   // 南北
      [0, 1, 0], [0, -1, 0],   // 上下
      // 对角扩展（形成 3x3x3 去心 = 26格中的部分）
      [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
      [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1],
    ];

    for (const [dx, dy, dz] of offsets) {
      const bx = x + dx, by = y + dy, bz = z + dz;
      const blockId = this.game.world.getBlock(bx, by, bz);
      if (blockId === 0 || blockId === BLOCK.BEDROCK) continue;

      const def = BLOCK_DEFS[blockId];
      // 黑曜石不被狙击弹破坏
      if (def && def.name && def.name.includes('黑曜石')) continue;

      this.game.destroyBlock(bx, by, bz, false);
    }
  }

  // 判断方块是否可燃
  _isFlammable(blockId) {
    if (blockId === 0 || blockId === BLOCK.BEDROCK) return false;
    const def = BLOCK_DEFS[blockId];
    if (!def || !def.name) return false;
    const name = def.name;
    // 可燃方块：原木、木板、树叶、草、花、干草、书架、工作台、蘑菇等
    return name.includes('木') || name.includes('叶') || name.includes('草') ||
           name.includes('花') || name.includes('干草') || name.includes('书') ||
           name.includes('工作台') || name.includes('蘑菇') || name.includes('海草') ||
           name.includes('海带') || name.includes('藤蔓') || name.includes('苔藓');
  }

  // 龙息炮火焰爆炸：范围伤害 + 灼烧 + 粒子 + 地面残留火 + 点燃可燃方块（可蔓延）
  _dragonFireExplode(cx, cy, cz) {
    const explodeRadius = 3;
    const damage = 25;
    const burnDuration = 5;

    // 火焰爆炸粒子
    if (this.game.effects) {
      try {
        // 大量火焰粒子
        for (let i = 0; i < 12; i++) {
          this.game.effects.createBlockBreakParticles(
            Math.floor(cx), Math.floor(cy), Math.floor(cz), 0xff4400
          );
          this.game.effects.createBlockBreakParticles(
            Math.floor(cx), Math.floor(cy), Math.floor(cz), 0xffaa00
          );
        }
        // 闪光
        if (this.game.effects.createFlash) {
          this.game.effects.createFlash(cx, cy, cz, 3);
        }
        // 地面残留火
        if (this.game.effects.createGroundFire) {
          this.game.effects.createGroundFire(cx, cy - 0.5, cz, burnDuration);
        }
      } catch (e) { /* 忽略 */ }
    }

    // 范围伤害 + 灼烧 + 击退
    if (this.game.mobs && this.game.mobs.mobs) {
      for (const mob of this.game.mobs.mobs) {
        const dx = mob.position.x - cx;
        const dy = (mob.position.y + 0.5) - cy;
        const dz = mob.position.z - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < explodeRadius && dist > 0.1) {
          // 距离越近伤害越高
          const dmg = Math.floor(damage * (1 - dist / explodeRadius * 0.4));
          mob.takeDamage(dmg);
          // 灼烧效果
          mob._burnTimer = burnDuration;
          // 击退
          const force = (1 - dist / explodeRadius) * 3;
          mob.velocity.x += (dx / dist) * force;
          mob.velocity.y += 0.5;
          mob.velocity.z += (dz / dist) * force;
          // 伤害数字
          if (this.game.effects && this.game.effects.showDamageNumber) {
            this.game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, dmg, '#ff6600');
          }
        }
      }
    }

    // 点燃爆炸范围内的可燃方块（启动火焰蔓延系统）
    if (this.game.world && this.game.destroyBlock) {
      const bx = Math.floor(cx);
      const by = Math.floor(cy);
      const bz = Math.floor(cz);
      // 点燃半径2格内的可燃方块
      const igniteRadius = 2;
      const toIgnite = [];
      for (let dx = -igniteRadius; dx <= igniteRadius; dx++) {
        for (let dy = -igniteRadius; dy <= igniteRadius; dy++) {
          for (let dz = -igniteRadius; dz <= igniteRadius; dz++) {
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > igniteRadius) continue;
            const nx = bx + dx, ny = by + dy, nz = bz + dz;
            const nid = this.game.world.getBlock(nx, ny, nz);
            if (this._isFlammable(nid)) {
              toIgnite.push({ x: nx, y: ny, z: nz });
            }
          }
        }
      }
      // 启动火焰蔓延
      if (toIgnite.length > 0) {
        this._startFireSpread(toIgnite);
      }
    }
  }

  // 火焰蔓延系统：定时燃烧可燃方块并扩散到相邻方块
  _startFireSpread(initialBlocks) {
    const game = this.game;
    if (!game.world || !game.destroyBlock) return;

    // 已燃烧的方块坐标集合（防止重复燃烧）
    const burned = new Set();
    // 待燃烧队列：{x, y, z, delay} — delay 为燃烧延迟（秒）
    const queue = [];
    for (const b of initialBlocks) {
      const key = `${b.x},${b.y},${b.z}`;
      if (!burned.has(key)) {
        burned.add(key);
        queue.push({ x: b.x, y: b.y, z: b.z, delay: 0.3 + Math.random() * 0.5 });
      }
    }

    // 最大蔓延数量限制（防止烧毁整个世界）
    const maxSpread = 80;
    let spreadCount = 0;
    let elapsed = 0;

    const tick = setInterval(() => {
      elapsed += 0.4;
      // 安全检查：游戏已退出或世界已卸载
      if (!game.world || !game.destroyBlock) {
        clearInterval(tick);
        return;
      }

      // 处理本 tick 应该燃烧的方块
      const toBurn = [];
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].delay <= elapsed) {
          toBurn.push(queue[i]);
          queue.splice(i, 1);
        }
      }

      for (const b of toBurn) {
        const blockId = game.world.getBlock(b.x, b.y, b.z);
        // 方块可能已被其他方式破坏
        if (blockId === 0) continue;

        // 火焰粒子
        if (game.effects) {
          try {
            game.effects.createBlockBreakParticles(b.x, b.y, b.z, 0xff4400);
            game.effects.createBlockBreakParticles(b.x, b.y, b.z, 0xffaa00);
            if (Math.random() < 0.3) {
              game.effects.createBlockBreakParticles(b.x, b.y, b.z, 0xff8800);
            }
          } catch (e) { /* 忽略 */ }
        }

        // 破坏方块
        game.destroyBlock(b.x, b.y, b.z, false);
        spreadCount++;

        // 蔓延到相邻可燃方块
        if (spreadCount < maxSpread) {
          const neighbors = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
          ];
          for (const [dx, dy, dz] of neighbors) {
            const nx = b.x + dx, ny = b.y + dy, nz = b.z + dz;
            const key = `${nx},${ny},${nz}`;
            if (burned.has(key)) continue;
            const nid = game.world.getBlock(nx, ny, nz);
            if (this._isFlammable(nid)) {
              burned.add(key);
              // 蔓延延迟：树叶/草/花快速蔓延，木头慢速蔓延
              const ndef = BLOCK_DEFS[nid];
              let spreadDelay = 1.0 + Math.random() * 1.5;
              if (ndef && ndef.name) {
                if (ndef.name.includes('叶') || ndef.name.includes('草') || ndef.name.includes('花')) {
                  spreadDelay = 0.4 + Math.random() * 0.6; // 快速蔓延
                }
              }
              queue.push({ x: nx, y: ny, z: nz, delay: elapsed + spreadDelay });
            }
          }
        }
      }

      // 队列空或达到上限时停止
      if (queue.length === 0 || spreadCount >= maxSpread || elapsed > 15) {
        clearInterval(tick);
      }
    }, 400);
  }

  // 湮灭炮引力漩涡吸引实体 + 延迟爆炸
  _quantumVortexPull(cx, cy, cz) {
    if (!this.game.mobs || !this.game.mobs.mobs) return;
    if (!this.game.effects) return;

    const pullRadius = 6;
    const damage = 30;
    const game = this.game;

    // 立即吸引并伤害附近实体
    for (const mob of game.mobs.mobs) {
      const dx = cx - mob.position.x;
      const dy = cy - mob.position.y;
      const dz = cz - mob.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < pullRadius && dist > 0.1) {
        // 吸引力
        const force = (1 - dist / pullRadius) * 6;
        mob.velocity.x += (dx / dist) * force;
        mob.velocity.y += (dy / dist) * force * 0.5;
        mob.velocity.z += (dz / dist) * force;
        // 伤害
        mob.takeDamage(damage);
        if (game.effects.showDamageNumber) {
          game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, damage);
        }
      }
    }

    // 漩涡持续期间每0.5秒吸引一次，3秒后内爆
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.5;
      // 持续吸引
      if (game.mobs && game.mobs.mobs) {
        for (const mob of game.mobs.mobs) {
          const dx = cx - mob.position.x;
          const dy = cy - mob.position.y;
          const dz = cz - mob.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < pullRadius && dist > 0.1) {
            const force = (1 - dist / pullRadius) * 3;
            mob.velocity.x += (dx / dist) * force;
            mob.velocity.y += (dy / dist) * force * 0.3;
            mob.velocity.z += (dz / dist) * force;
            if (elapsed < 3) {
              mob.takeDamage(8);
            }
          }
        }
      }
      // 漩涡嗡嗡声
      if (game.sound && game.sound.vortexHum) {
        game.sound.vortexHum();
      }
      // 内爆
      if (elapsed >= 3) {
        clearInterval(interval);
        if (game.effects) {
          game.effects.createImplosion(cx, cy, cz, 4);
        }
        if (game.sound && game.sound.implosion) {
          game.sound.implosion();
        }
        // 内爆时范围伤害 + 破坏方块
        if (game.mobs && game.mobs.mobs) {
          for (const mob of game.mobs.mobs) {
            const dx = mob.position.x - cx;
            const dy = mob.position.y - cy;
            const dz = mob.position.z - cz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 5) {
              const dmg = Math.floor((1 - dist / 5) * 50);
              if (dmg > 0) {
                mob.takeDamage(dmg);
                if (game.effects.showDamageNumber) {
                  game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, dmg);
                }
              }
            }
          }
        }
        // 破坏附近方块
        if (game.world && game.destroyBlock) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              for (let dz = -2; dz <= 2; dz++) {
                const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (d > 2.5) continue;
                const bx = Math.floor(cx + dx);
                const by = Math.floor(cy + dy);
                const bz = Math.floor(cz + dz);
                const blockId = game.world.getBlock(bx, by, bz);
                if (blockId === 0 || blockId === BLOCK.BEDROCK) continue;
                const def = BLOCK_DEFS[blockId];
                if (def && def.name && def.name.includes('黑曜石')) continue;
                game.destroyBlock(bx, by, bz, false);
              }
            }
          }
        }
      }
    }, 500);
  }

  destroy() {
    if (this.mesh && this.game.scene) {
      this.game.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    if (this.trail && this.game.scene) {
      this.game.scene.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail.material.dispose();
    }
  }
}

// ===== 远程武器系统 =====
export class RangedSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.bowChargeTime = 0;
    this.isCharging = false;
    this.trajectoryLine = null;
  }

  // 射箭 — 无限箭矢
  shootArrow(power = 1, enchantments = {}) {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 30 + power * 40;
    const damage = 2 + power * 5;
    const maxLifetime = 120;

    // 在视线方向偏移1格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const arrow = new Projectile(this.game, PROJECTILE_TYPE.ARROW, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      enchantments,
      maxLifetime,
      gravity: 0.3,
    });

    this.projectiles.push(arrow);

    if (this.game.sound) this.game.sound.bow();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.ARROW, eye, dir, { speed, damage, maxLifetime, gravity: 0.3 });
    }

    return arrow;
  }

  // 射击子弹（手枪）— 无限子弹
  shootBullet() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 120;
    const damage = 6;
    const maxLifetime = 10;

    // 在视线方向偏移1格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const bullet = new Projectile(this.game, PROJECTILE_TYPE.BULLET, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0,
      piercing: 1,
      spinSpeed: 30,
    });

    this.projectiles.push(bullet);

    if (this.game.sound) this.game.sound.crossbow();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.BULLET, eye, dir, { speed, damage, maxLifetime, gravity: 0, piercing: 1 });
    }

    return bullet;
  }

  // 射击火箭弹（火箭筒）— 无限火箭弹
  shootRocket() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 40;
    const damage = 15;
    const maxLifetime = 20;

    // 在视线方向偏移1格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const rocket = new Projectile(this.game, PROJECTILE_TYPE.ROCKET, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0.1,
      spinSpeed: 5,
    });

    this.projectiles.push(rocket);

    if (this.game.sound) this.game.sound.explosion();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.ROCKET, eye, dir, { speed, damage, maxLifetime, gravity: 0.1 });
    }

    return rocket;
  }

  // 射击加特林子弹 — 高速连发，带散布
  shootGatling() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 100;
    const damage = 4;
    const maxLifetime = 8;

    // 加特林散布：随机偏移方向
    const spread = 0.04;
    const sDir = {
      x: dir.x + (Math.random() - 0.5) * spread,
      y: dir.y + (Math.random() - 0.5) * spread,
      z: dir.z + (Math.random() - 0.5) * spread,
    };
    // 归一化
    const sLen = Math.sqrt(sDir.x * sDir.x + sDir.y * sDir.y + sDir.z * sDir.z);
    sDir.x /= sLen; sDir.y /= sLen; sDir.z /= sLen;

    const spawnX = eye.x + sDir.x * 1.0;
    const spawnY = eye.y + sDir.y * 1.0;
    const spawnZ = eye.z + sDir.z * 1.0;

    const bullet = new Projectile(this.game, PROJECTILE_TYPE.GATLING_BULLET, spawnX, spawnY, spawnZ, sDir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0,
      piercing: 1,
      spinSpeed: 40,
    });

    this.projectiles.push(bullet);

    // 枪口火花 — 加特林使用轻量版（无粒子、无光源），避免连发时大量GC和遮挡视线
    this.createMuzzleFlash(eye, dir, 0xffaa00, 0.05, 0, false);

    if (this.game.sound) this.game.sound.gatling();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.GATLING_BULLET, eye, sDir, { speed, damage, maxLifetime, gravity: 0, piercing: 1 });
    }

    return bullet;
  }

  // 射击巴雷特狙击弹 — 超高速、高伤害、穿透
  shootSniper() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 200;
    const damage = 25;
    const maxLifetime = 15;

    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const bullet = new Projectile(this.game, PROJECTILE_TYPE.SNIPER_BULLET, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0,
      piercing: 3, // 穿透多个目标
      spinSpeed: 20,
    });

    this.projectiles.push(bullet);

    // 枪口大型闪光
    this.createMuzzleFlash(eye, dir, 0x66ffaa, 0.15);

    // 屏幕震动
    if (this.game.effects) {
      this.game.effects.screenShake = Math.max(this.game.effects.screenShake || 0, 1.5);
    }

    if (this.game.sound) this.game.sound.sniper();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.SNIPER_BULLET, eye, dir, { speed, damage, maxLifetime, gravity: 0, piercing: 3 });
    }

    return bullet;
  }

  // 枪口闪光特效
  // particleCount: 粒子数量（0=不生成粒子）  useLight: 是否添加点光源
  createMuzzleFlash(eye, dir, color, size = 0.08, particleCount = 5, useLight = true) {
    if (!this.game.effects || !this.game.scene) return;

    const flashPos = {
      x: eye.x + dir.x * 1.2,
      y: eye.y + dir.y * 1.2,
      z: eye.z + dir.z * 1.2,
    };

    // 闪光球
    const flashGeom = new THREE.SphereGeometry(size, 8, 6);
    const flashMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeom, flashMat);
    flash.position.set(flashPos.x, flashPos.y, flashPos.z);
    flash.frustumCulled = false;
    this.game.scene.add(flash);

    // 点光源（可选 — 加特林连发时跳过以减少开销）
    let light = null;
    if (useLight) {
      light = new THREE.PointLight(color, 3, 5);
      light.position.set(flashPos.x, flashPos.y, flashPos.z);
      this.game.scene.add(light);
    }

    // 粒子（可选）
    if (particleCount > 0 && this.game.effects.createBlockBreakParticles) {
      for (let i = 0; i < particleCount; i++) {
        this.game.effects.createBlockBreakParticles(
          Math.floor(flashPos.x), Math.floor(flashPos.y), Math.floor(flashPos.z), color
        );
      }
    }

    // 0.08秒后移除闪光
    setTimeout(() => {
      this.game.scene.remove(flash);
      if (light) this.game.scene.remove(light);
      flashGeom.dispose();
      flashMat.dispose();
    }, 80);
  }

  // 射击湮灭炮量子球 — 慢速、重力影响、命中后引力漩涡
  shootAnnihilator() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 35;
    const damage = 40;
    const maxLifetime = 20;

    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const orb = new Projectile(this.game, PROJECTILE_TYPE.QUANTUM_ORB, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0.2,
      piercing: 0,
      spinSpeed: 10,
    });

    this.projectiles.push(orb);

    // 枪口紫色能量闪光
    this.createMuzzleFlash(eye, dir, 0xcc44ff, 0.12, 3, true);

    // 屏幕震动
    if (this.game.effects) {
      this.game.effects.screenShake = Math.max(this.game.effects.screenShake || 0, 1.0);
    }

    if (this.game.sound) this.game.sound.annihilator();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.QUANTUM_ORB, eye, dir, { speed, damage, maxLifetime, gravity: 0.2, piercing: 0 });
    }

    return orb;
  }

  // 龙息炮：发射火焰投射物 — 远程射击，命中后产生火焰爆炸
  shootDragonBreath() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const speed = 55;
    const damage = 20;
    const maxLifetime = 8;

    const spawnX = eye.x + dir.x * 1.0;
    const spawnY = eye.y + dir.y * 1.0;
    const spawnZ = eye.z + dir.z * 1.0;

    const fire = new Projectile(this.game, PROJECTILE_TYPE.DRAGON_FIRE, spawnX, spawnY, spawnZ, dir, {
      speed, damage,
      owner: this.game.player,
      maxLifetime,
      gravity: 0,
      piercing: 1,
    });

    this.projectiles.push(fire);

    // 枪口火焰闪光
    this.createMuzzleFlash(eye, dir, 0xff6600, 0.08, 3, true);

    if (this.game.sound) this.game.sound.dragonBreath();

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(PROJECTILE_TYPE.DRAGON_FIRE, eye, dir, { speed, damage, maxLifetime, gravity: 0, piercing: 1 });
    }

    return fire;
  }

  // 雷霆链枪：即时闪电链攻击 — 射线检测 + 链式跳跃
  shootThunderGun() {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    const maxRange = 50;
    const chainRange = 8;
    const maxChains = 4;
    const initialDamage = 40;
    const chainDamages = [25, 20, 15, 10];

    // 射线检测：找第一个命中的实体或方块
    let hitPoint = null;
    let hitMob = null;
    let hitBlock = null;

    // 先做方块射线检测（50格远程）
    let blockHitDist = maxRange;
    if (this.game.world) {
      const rayOrigin = new THREE.Vector3(eye.x, eye.y, eye.z);
      const rayDir = new THREE.Vector3(dir.x, dir.y, dir.z);
      const hit = this.game.world.raycast(rayOrigin, rayDir, maxRange);
      if (hit) {
        hitBlock = hit;
        blockHitDist = hit.distance || Math.sqrt(
          (hit.x + 0.5 - eye.x) ** 2 + (hit.y + 0.5 - eye.y) ** 2 + (hit.z + 0.5 - eye.z) ** 2
        );
      }
    }

    // 检测实体命中（取比方块更近的实体）
    let mobHitDist = maxRange;
    if (this.game.mobs && this.game.mobs.mobs) {
      for (const mob of this.game.mobs.mobs) {
        const dx = mob.position.x - eye.x;
        const dy = (mob.position.y + 0.5) - eye.y;
        const dz = mob.position.z - eye.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxRange) continue;
        if (dist > blockHitDist) continue; // 方块更近，跳过此实体
        // 检查方向
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (dist || 1);
        if (dot < 0.98) continue; // 窄锥检测
        if (dist < mobHitDist) {
          mobHitDist = dist;
          hitMob = mob;
        }
      }
    }

    // 确定最终命中点
    if (hitMob) {
      hitPoint = { x: hitMob.position.x, y: hitMob.position.y + 0.5, z: hitMob.position.z };
    } else if (hitBlock) {
      hitPoint = { x: hitBlock.x + 0.5, y: hitBlock.y + 0.5, z: hitBlock.z + 0.5 };
    } else {
      // 如果什么都没命中，在视线末端生成效果
      hitPoint = { x: eye.x + dir.x * maxRange, y: eye.y + dir.y * maxRange, z: eye.z + dir.z * maxRange };
    }

    // 命中方块时：小范围方块破坏（3x1x3 十字形）
    if (hitBlock && this.game.world && this.game.destroyBlock) {
      const bx = hitBlock.x;
      const by = hitBlock.y;
      const bz = hitBlock.z;
      // 直接命中的方块
      const blockId = this.game.world.getBlock(bx, by, bz);
      if (blockId !== 0 && blockId !== BLOCK.BEDROCK) {
        const def = BLOCK_DEFS[blockId];
        if (!def || !def.name || !def.name.includes('黑曜石')) {
          this.game.destroyBlock(bx, by, bz, false);
        }
      }
      // 周围十字形方块（水平 4 方向 + 上下），形成小范围破坏
      const offsets = [
        [1, 0, 0], [-1, 0, 0],   // 东西
        [0, 0, 1], [0, 0, -1],   // 南北
        [0, 1, 0], [0, -1, 0],   // 上下
      ];
      for (const [dx, dy, dz] of offsets) {
        const nx = bx + dx, ny = by + dy, nz = bz + dz;
        const nid = this.game.world.getBlock(nx, ny, nz);
        if (nid === 0 || nid === BLOCK.BEDROCK) continue;
        const ndef = BLOCK_DEFS[nid];
        if (ndef && ndef.name && ndef.name.includes('黑曜石')) continue;
        this.game.destroyBlock(nx, ny, nz, false);
      }
    }

    // 构建闪电链路点列表
    const chainPoints = [
      { x: eye.x + dir.x * 1.5, y: eye.y + dir.y * 1.5, z: eye.z + dir.z * 1.5 }, // 枪口
      hitPoint, // 第一个命中点
    ];

    // 闪电链跳跃
    const chainedMobs = new Set();
    if (hitMob) {
      hitMob.takeDamage(initialDamage);
      chainedMobs.add(hitMob);
      if (this.game.effects && this.game.effects.showDamageNumber) {
        this.game.effects.showDamageNumber(hitMob.position.x, hitMob.position.y + 1, hitMob.position.z, initialDamage, '#66ddff');
      }

      // 链式跳跃
      let currentPos = hitPoint;
      let currentMob = hitMob;
      for (let c = 0; c < maxChains; c++) {
        let nextMob = null;
        let nextDist = chainRange;
        for (const mob of this.game.mobs.mobs) {
          if (chainedMobs.has(mob)) continue;
          const dx = mob.position.x - currentPos.x;
          const dy = (mob.position.y + 0.5) - currentPos.y;
          const dz = mob.position.z - currentPos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < nextDist) {
            nextDist = dist;
            nextMob = mob;
          }
        }
        if (!nextMob) break;

        // 添加到链路
        chainPoints.push({ x: nextMob.position.x, y: nextMob.position.y + 0.5, z: nextMob.position.z });
        nextMob.takeDamage(chainDamages[c] || 3);
        chainedMobs.add(nextMob);
        if (this.game.effects && this.game.effects.showDamageNumber) {
          this.game.effects.showDamageNumber(nextMob.position.x, nextMob.position.y + 1, nextMob.position.z, chainDamages[c] || 3, '#66ddff');
        }
        currentPos = { x: nextMob.position.x, y: nextMob.position.y + 0.5, z: nextMob.position.z };
      }
    }

    // 生成闪电链特效
    if (this.game.effects) {
      this.game.effects.createLightningChain(chainPoints);
      // 在命中点生成电击冲击波（扩散环形特效）
      if (this.game.effects.createElectricShockwave) {
        this.game.effects.createElectricShockwave(hitPoint.x, hitPoint.y, hitPoint.z, 4);
      }
      // 在命中点生成地面电场（持续伤害区域）
      if (this.game.effects.createElectricField) {
        this.game.effects.createElectricField(hitPoint.x, hitPoint.y - 0.5, hitPoint.z, 3, 3);
      }
    }

    // 对链式命中的实体施加眩晕效果
    for (const mob of chainedMobs) {
      mob._stunTimer = 2; // 眩晕2秒
    }

    // 电场区域持续伤害（3秒内每0.5秒对范围内实体造成伤害）
    if (this.game.mobs && this.game.mobs.mobs) {
      let fieldElapsed = 0;
      const fieldInterval = setInterval(() => {
        fieldElapsed += 0.5;
        if (fieldElapsed > 3 || !this.game.mobs || !this.game.mobs.mobs) {
          clearInterval(fieldInterval);
          return;
        }
        for (const mob of this.game.mobs.mobs) {
          const fdx = mob.position.x - hitPoint.x;
          const fdy = (mob.position.y + 0.5) - hitPoint.y;
          const fdz = mob.position.z - hitPoint.z;
          const fdist = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz);
          if (fdist < 3) {
            mob.takeDamage(2);
            if (this.game.effects && this.game.effects.showDamageNumber) {
              this.game.effects.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, 2, '#66ddff');
            }
          }
        }
      }, 500);
    }

    // 轻量枪口闪光
    this.createMuzzleFlash(eye, dir, 0x66ddff, 0.1, 2, true);

    // 屏幕震动
    if (this.game.effects) {
      this.game.effects.screenShake = Math.max(this.game.effects.screenShake || 0, 0.8);
    }

    if (this.game.sound) this.game.sound.thunderGun();
  }

  // 投掷物品 — 无限弹药
  throwItem(type, options = {}) {
    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();

    // 在视线方向偏移0.5格生成，避免被相机近平面裁剪
    const spawnX = eye.x + dir.x * 0.5;
    const spawnY = eye.y + dir.y * 0.5;
    const spawnZ = eye.z + dir.z * 0.5;

    const proj = new Projectile(this.game, type, spawnX, spawnY, spawnZ, dir, {
      speed: options.speed || 25,
      damage: options.damage || 0,
      owner: this.game.player,
      gravity: options.gravity !== undefined ? options.gravity : 1,
      maxLifetime: options.maxLifetime || 30,
    });

    this.projectiles.push(proj);

    if (this.game.multiplayer) {
      this.game.multiplayer.sendProjectile(type, eye, dir, options);
    }

    return proj;
  }

  throwSnowball() {
    this.throwItem(PROJECTILE_TYPE.SNOWBALL, { damage: 0, gravity: 1, maxLifetime: 15 });
  }

  throwEgg() {
    this.throwItem(PROJECTILE_TYPE.EGG, { damage: 0, gravity: 1, maxLifetime: 15 });
  }

  throwEnderPearl() {
    this.throwItem(PROJECTILE_TYPE.ENDER_PEARL, { damage: 0, gravity: 1, maxLifetime: 60 });
  }

  shootFireball(x, y, z, dir, owner = null, damage = 6) {
    const proj = new Projectile(this.game, PROJECTILE_TYPE.FIREBALL, x, y, z, dir, {
      speed: 12, damage, owner, gravity: 0, maxLifetime: 30,
    });
    this.projectiles.push(proj);
    return proj;
  }

  shootWitherSkull(x, y, z, dir, owner = null, damage = 8) {
    const proj = new Projectile(this.game, PROJECTILE_TYPE.WITHER_SKULL, x, y, z, dir, {
      speed: 10, damage, owner, gravity: 0, maxLifetime: 30,
    });
    this.projectiles.push(proj);
    return proj;
  }

  startCharging() {
    this.isCharging = true;
    this.bowChargeTime = 0;
  }

  releaseBow(enchantments = {}) {
    if (!this.isCharging) return;
    this.isCharging = false;
    const power = Math.min(1, this.bowChargeTime / 1.5);
    if (power > 0.1) {
      this.shootArrow(power, enchantments);
    }
    this.bowChargeTime = 0;
    this._hideTrajectory();
  }

  // ===== 弹道预测线 =====
  updateTrajectoryPreview() {
    if (!this.isCharging) {
      this._hideTrajectory();
      return;
    }

    const item = this.game.player.getSelectedItem();
    if (!item) { this._hideTrajectory(); return; }

    const isRanged = (item.id === BLOCK.BOW || item.id === BLOCK.CROSSBOW || item.id === BLOCK.TRIDENT);
    if (!isRanged) { this._hideTrajectory(); return; }

    const eye = this.game.player.getEyePosition();
    const dir = this.game.player.getLookDirection();
    const power = Math.min(1, this.bowChargeTime / 1.5);

    let speed, gravity;
    if (item.id === BLOCK.BOW) {
      speed = 30 + power * 40;
      gravity = 0.3;
    } else if (item.id === BLOCK.CROSSBOW) {
      speed = 60;
      gravity = 0.15;
    } else {
      speed = 35;
      gravity = 0.5;
    }

    const points = this._calculateTrajectory(eye, dir, speed, gravity, 60);
    this._showTrajectory(points);
  }

  _calculateTrajectory(start, dir, speed, gravity, steps) {
    const points = [];
    let x = start.x, y = start.y, z = start.z;
    let vx = dir.x * speed, vy = dir.y * speed, vz = dir.z * speed;
    const dt = 0.05;

    for (let i = 0; i < steps; i++) {
      points.push(new THREE.Vector3(x, y, z));
      vy -= 15 * gravity * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      const block = this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (block !== 0) {
        points.push(new THREE.Vector3(x, y, z));
        break;
      }
    }
    return points;
  }

  _showTrajectory(points) {
    if (points.length < 2) return;

    if (!this.trajectoryLine) {
      const m = new THREE.LineDashedMaterial({
        color: 0xffff00, transparent: true, opacity: 0.5,
        dashSize: 0.15, gapSize: 0.1, depthWrite: false,
      });
      const geom = new THREE.BufferGeometry();
      this.trajectoryLine = new THREE.Line(geom, m);
      this.trajectoryLine.frustumCulled = false;
      this.game.scene.add(this.trajectoryLine);
    }

    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }

    this.trajectoryLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trajectoryLine.geometry.computeBoundingSphere();
    this.trajectoryLine.computeLineDistances();
    this.trajectoryLine.visible = true;
  }

  _hideTrajectory() {
    if (this.trajectoryLine) {
      this.trajectoryLine.visible = false;
    }
  }

  update(dt) {
    if (this.isCharging) {
      this.bowChargeTime += dt;
      this.updateTrajectoryPreview();
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      try {
        proj.update(dt);
      } catch (e) { proj.dead = true; }
      if (proj.dead) {
        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const proj of this.projectiles) {
      proj.destroy();
    }
    this.projectiles = [];
    this._hideTrajectory();
  }

  receiveProjectile(type, pos, dir, options = {}) {
    const proj = new Projectile(this.game, type, pos.x, pos.y, pos.z, dir, options);
    this.projectiles.push(proj);
  }
}
