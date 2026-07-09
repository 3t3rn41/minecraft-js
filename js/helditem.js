/**
 * helditem.js — 手持物品3D建模与渲染系统
 * 包含：
 *   - createItemModel(): 根据物品ID生成3D模型
 *   - HeldItemViewModel: 第一人称右下角3D手持物品渲染器
 *
 * 支持的物品类型：
 *   方块、剑、镐、斧、锹、锄、弓、弩、三叉戟、钓鱼竿、
 *   盾牌、箭矢、雪球、鸡蛋、末影珍珠、火把、木棍、桶、护甲
 */

import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS, getFaceUV } from './blocks.js';

// ===== 材质颜色定义 =====
const MAT = {
  wood:      { head: 0xc4985a, accent: 0xa87c4a },
  stone:     { head: 0x909090, accent: 0x707070 },
  iron:      { head: 0xe8e8e8, accent: 0xc8c8c8 },
  gold:      { head: 0xffe55c, accent: 0xffd700 },
  diamond:   { head: 0x5ff5e8, accent: 0x3ae0d0 },
  netherite: { head: 0x555555, accent: 0x3a3a3a },
};

const HANDLE_COLOR = 0x6b4a25;
const STRING_COLOR = 0xeeeeee;

const ARMOR_COLOR = {
  leather: 0x8b4513,
  iron: 0xd8d8d8,
  gold: 0xffe55c,
  diamond: 0x5ff5e8,
  netherite: 0x4a4a4a,
};

// ===== 辅助：设置方块纹理UV =====
function setBlockUVs(geom, blockId) {
  const topUV = getFaceUV(blockId, 0);
  const botUV = getFaceUV(blockId, 1);
  const sideUV = getFaceUV(blockId, 2);
  if (!sideUV) return;

  const uv = geom.attributes.uv;
  // BoxGeometry 面顺序: +X, -X, +Y, -Y, +Z, -Z
  const faces = [sideUV, sideUV, topUV || sideUV, botUV || sideUV, sideUV, sideUV];
  for (let f = 0; f < 6; f++) {
    const t = faces[f];
    const b = f * 4;
    uv.setXY(b + 0, t.u0, t.v1);
    uv.setXY(b + 1, t.u1, t.v1);
    uv.setXY(b + 2, t.u0, t.v0);
    uv.setXY(b + 3, t.u1, t.v0);
  }
  uv.needsUpdate = true;
}

// ===== 辅助：创建带颜色的材质 =====
function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

// ===== 方块模型 =====
// 角色手掌宽 0.2，方块略大于手掌
function createBlockCube(blockId, atlasTexture) {
  const geom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  setBlockUVs(geom, blockId);
  const m = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: false,
    alphaTest: 0.5,
    transparent: false,
  });
  const mesh = new THREE.Mesh(geom, m);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

// ===== 剑 =====
// 总长约 0.65，与手臂(0.6+0.15=0.75)相当
function createSword(material) {
  const c = MAT[material] || MAT.iron;
  const g = new THREE.Group();

  // 手柄
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), mat(HANDLE_COLOR));
  handle.position.y = -0.18;
  g.add(handle);

  // 护手
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.06), mat(c.accent));
  guard.position.y = -0.1;
  g.add(guard);

  // 刀刃
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.38, 0.02), mat(c.head, { emissive: c.head, emissiveIntensity: 0.05 }));
  blade.position.y = 0.11;
  g.add(blade);

  // 刀尖（收窄）
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), mat(c.head));
  tip.position.y = 0.33;
  g.add(tip);

  return g;
}

// ===== 镐 =====
function createPickaxe(material) {
  const c = MAT[material] || MAT.iron;
  const g = new THREE.Group();

  // 手柄
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), mat(HANDLE_COLOR));
  handle.position.y = -0.05;
  g.add(handle);

  // 镐头（左右两瓣）
  const headMat = mat(c.head);
  const leftProng = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), headMat);
  leftProng.position.set(-0.11, 0.22, 0);
  leftProng.rotation.z = 0.4;
  g.add(leftProng);

  const rightProng = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), headMat);
  rightProng.position.set(0.11, 0.22, 0);
  rightProng.rotation.z = -0.4;
  g.add(rightProng);

  // 中心连接
  const center = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), headMat);
  center.position.y = 0.22;
  g.add(center);

  return g;
}

// ===== 斧 =====
function createAxe(material) {
  const c = MAT[material] || MAT.iron;
  const g = new THREE.Group();

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), mat(HANDLE_COLOR));
  handle.position.y = -0.05;
  g.add(handle);

  const headMat = mat(c.head);
  // 斧刃主体
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.035), headMat);
  blade.position.set(0.08, 0.22, 0);
  g.add(blade);

  // 斧刃尖端
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.035), headMat);
  edge.position.set(0.16, 0.22, 0);
  g.add(edge);

  // 连接处
  const conn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), headMat);
  conn.position.set(0.025, 0.22, 0);
  g.add(conn);

  return g;
}

// ===== 锹 =====
function createShovel(material) {
  const c = MAT[material] || MAT.iron;
  const g = new THREE.Group();

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), mat(HANDLE_COLOR));
  handle.position.y = -0.07;
  g.add(handle);

  const headMat = mat(c.head);
  // 铲头
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.025), headMat);
  head.position.y = 0.22;
  g.add(head);

  // 铲尖
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.025), headMat);
  tip.position.y = 0.3;
  g.add(tip);

  return g;
}

// ===== 锄 =====
function createHoe(material) {
  const c = MAT[material] || MAT.iron;
  const g = new THREE.Group();

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), mat(HANDLE_COLOR));
  handle.position.y = -0.05;
  g.add(handle);

  const headMat = mat(c.head);
  // 锄头横杆
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.035), headMat);
  bar.position.set(0.07, 0.22, 0);
  g.add(bar);

  // 连接
  const conn = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.05), headMat);
  conn.position.set(0.01, 0.22, 0);
  g.add(conn);

  return g;
}

// ===== 弓 =====
function createBow() {
  const g = new THREE.Group();
  const woodMat = mat(0x8b5a2b);

  // 弓身 — 使用 TorusGeometry 的一部分
  const bowGeom = new THREE.TorusGeometry(0.24, 0.022, 6, 16, Math.PI * 1.3);
  const bow = new THREE.Mesh(bowGeom, woodMat);
  bow.rotation.z = Math.PI * 0.35;
  g.add(bow);

  // 弓弦
  const stringGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.38, 4);
  const string = new THREE.Mesh(stringGeom, mat(STRING_COLOR));
  string.position.set(-0.05, 0, 0);
  g.add(string);

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.035), mat(0x5a3d1e));
  grip.position.set(0.22, 0, 0);
  g.add(grip);

  return g;
}

// ===== 弩 =====
function createCrossbow() {
  const g = new THREE.Group();
  const woodMat = mat(0x6b4a25);
  const ironMat = mat(0xc0c0c0);

  // 弩身
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), woodMat);
  body.position.y = 0;
  g.add(body);

  // 弩臂
  const limb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.26), woodMat);
  limb.position.set(-0.08, 0, 0);
  g.add(limb);

  // 弩弦
  const stringGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4);
  const string = new THREE.Mesh(stringGeom, mat(STRING_COLOR));
  string.position.set(-0.15, 0, 0);
  string.rotation.x = Math.PI / 2;
  g.add(string);

  // 箭槽（铁制）
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.025), ironMat);
  slot.position.set(0.07, 0.035, 0);
  g.add(slot);

  // 扳机
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.025), ironMat);
  trigger.position.set(0.13, -0.04, 0);
  g.add(trigger);

  return g;
}

// ===== 三叉戟 =====
function createTrident() {
  const g = new THREE.Group();

  // 杆
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.55, 0.035), mat(0x5a4a3a));
  shaft.position.y = -0.03;
  g.add(shaft);

  const headMat = mat(0x4ac8e0, { emissive: 0x2a8ca0, emissiveIntensity: 0.15 });

  // 中央矛头
  const spear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.018), headMat);
  spear.position.y = 0.3;
  g.add(spear);

  // 矛尖
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), headMat);
  tip.position.y = 0.42;
  g.add(tip);

  // 左右分叉
  const leftProng = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.018), headMat);
  leftProng.position.set(-0.07, 0.27, 0);
  leftProng.rotation.z = 0.25;
  g.add(leftProng);

  const rightProng = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.018), headMat);
  rightProng.position.set(0.07, 0.27, 0);
  rightProng.rotation.z = -0.25;
  g.add(rightProng);

  return g;
}

// ===== 钓鱼竿 =====
function createFishingRod() {
  const g = new THREE.Group();

  // 竿身
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.026, 0.55, 6), mat(0x8b5a2b));
  rod.position.y = 0.08;
  g.add(rod);

  // 卷线轮
  const reel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.035), mat(0xc0c0c0));
  reel.position.set(0, -0.07, 0.025);
  g.add(reel);

  // 鱼线
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.17, 3), mat(0xffffff, { transparent: true, opacity: 0.6 }));
  line.position.set(0, -0.2, 0);
  g.add(line);

  // 浮标
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xff0000));
  bobber.position.set(0, -0.3, 0);
  g.add(bobber);

  return g;
}

// ===== 盾牌 =====
function createShield(material) {
  const g = new THREE.Group();
  const baseColor = (material && ARMOR_COLOR[material]) || 0x8b4513;
  const boardMat = mat(baseColor);

  // 盾面
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.035), boardMat);
  g.add(board);

  // 边框
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.018), mat(0xc0c0c0));
  trim.position.z = -0.01;
  g.add(trim);

  // 中心装饰
  const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.025), mat(0xffcc00));
  emblem.position.z = 0.025;
  g.add(emblem);

  return g;
}

// ===== 箭矢 =====
function createArrow(spectral) {
  const g = new THREE.Group();

  // 箭杆
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 5), mat(0xc4985a));
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);

  // 箭头
  const headColor = spectral ? 0xffff88 : 0x808080;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 4), mat(headColor, spectral ? { emissive: 0xffff44, emissiveIntensity: 0.3 } : {}));
  head.position.x = 0.21;
  head.rotation.z = -Math.PI / 2;
  g.add(head);

  // 羽毛
  const featherMat = mat(spectral ? 0xffff44 : 0xffffff);
  for (const sz of [-0.018, 0.018]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.05), featherMat);
    f.position.set(-0.17, sz, 0);
    g.add(f);
  }

  return g;
}

// ===== 球体（雪球、鸡蛋、末影珍珠）=====
function createSphere(color, radius, emissive) {
  const g = new THREE.Group();
  const opts = emissive ? { emissive: color, emissiveIntensity: 0.3 } : {};
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat(color, opts));
  g.add(sphere);
  return g;
}

// ===== 木棍 =====
function createStickModel() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 6), mat(HANDLE_COLOR));
  g.add(stick);
  return g;
}

// ===== 火把 =====
function createTorchModel() {
  const g = new THREE.Group();

  // 木棍部分
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.019, 0.24, 6), mat(HANDLE_COLOR));
  stick.position.y = -0.07;
  g.add(stick);

  // 火焰
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), mat(0xffaa00, { emissive: 0xff6600, emissiveIntensity: 0.6 }));
  flame.position.y = 0.09;
  g.add(flame);

  // 光源
  const light = new THREE.PointLight(0xff8800, 0.5, 3);
  light.position.y = 0.09;
  g.add(light);

  return g;
}

// ===== 桶 =====
function createBucketModel() {
  const g = new THREE.Group();
  const ironMat = mat(0xc0c0c0);

  // 桶身
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.16, 8, 1, true), ironMat);
  g.add(body);

  // 桶底
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), ironMat);
  bottom.position.y = -0.08;
  bottom.rotation.x = -Math.PI / 2;
  g.add(bottom);

  // 桶口边缘
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.013, 4, 8), ironMat);
  rim.position.y = 0.08;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  // 提手
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 4, 8, Math.PI), ironMat);
  handle.position.y = 0.09;
  handle.rotation.x = Math.PI / 2;
  g.add(handle);

  return g;
}

// ===== 护甲模型 =====
function createArmorModel(type, material) {
  const g = new THREE.Group();
  const c = ARMOR_COLOR[material] || 0x8b4513;
  const armorMat = mat(c);

  switch (type) {
    case 'helmet': {
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.26), armorMat);
      g.add(dome);
      // 面罩缝隙
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.018), mat(0x222222));
      visor.position.set(0, 0, 0.13);
      g.add(visor);
      break;
    }
    case 'chestplate': {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.35, 0.2), armorMat);
      g.add(chest);
      // 肩部
      const ls = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.16), armorMat);
      ls.position.set(-0.2, 0.12, 0);
      g.add(ls);
      const rs = ls.clone();
      rs.position.x = 0.2;
      g.add(rs);
      break;
    }
    case 'leggings': {
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), armorMat);
      waist.position.y = 0.12;
      g.add(waist);
      const ll = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.27, 0.14), armorMat);
      ll.position.set(-0.08, -0.07, 0);
      g.add(ll);
      const rl = ll.clone();
      rl.position.x = 0.08;
      g.add(rl);
      break;
    }
    case 'boots': {
      const lb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), armorMat);
      lb.position.set(-0.07, 0, 0.03);
      g.add(lb);
      const rb = lb.clone();
      rb.position.x = 0.07;
      g.add(rb);
      break;
    }
  }
  return g;
}

// ===== 手枪模型 =====
function createPistolModel() {
  const g = new THREE.Group();
  const ironMat = mat(0x555555);
  const darkMat = mat(0x333333);
  const woodMat = mat(0x4a3520);

  // 枪管
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.18), ironMat);
  barrel.position.set(0, 0.04, 0.05);
  g.add(barrel);

  // 枪身主体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), ironMat);
  body.position.set(0, 0, 0);
  g.add(body);

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), woodMat);
  grip.position.set(0, -0.09, -0.04);
  grip.rotation.x = -0.25;
  g.add(grip);

  // 扳机护圈
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.008, 4, 8, Math.PI), darkMat);
  trigger.position.set(0, -0.03, -0.01);
  trigger.rotation.x = Math.PI / 2;
  g.add(trigger);

  // 准星
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.01), darkMat);
  sight.position.set(0, 0.08, 0.1);
  g.add(sight);

  return g;
}

// ===== 火箭筒模型 =====
function createRocketLauncherModel() {
  const g = new THREE.Group();
  const metalMat = mat(0x666666);
  const darkMat = mat(0x444444);

  // 发射管主体
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12), metalMat);
  tube.rotation.x = Math.PI / 2;
  g.add(tube);

  // 管口前端
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), darkMat);
  muzzle.position.z = 0.26;
  g.add(muzzle);

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), darkMat);
  grip.position.set(0, -0.1, -0.05);
  grip.rotation.x = -0.2;
  g.add(grip);

  // 瞄准镜
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), darkMat);
  scope.position.set(0, 0.08, -0.02);
  g.add(scope);

  // 支架
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), darkMat);
  stand.position.set(0, 0.05, -0.1);
  g.add(stand);

  return g;
}

// ===== 子弹模型（手持） =====
function createBulletItemModel() {
  const g = new THREE.Group();

  // 弹头
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), mat(0xccaa44));
  tip.position.y = 0.05;
  g.add(tip);

  // 弹壳
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), mat(0xddbb66));
  casing.position.y = -0.03;
  g.add(casing);

  return g;
}

// ===== 火箭弹模型（手持） =====
function createRocketAmmoModel() {
  const g = new THREE.Group();

  // 弹头
  const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), mat(0x444444));
  warhead.position.y = 0.1;
  g.add(warhead);

  // 弹体
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), mat(0x666666));
  body.position.y = -0.03;
  g.add(body);

  // 尾翼
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.04), mat(0x888888));
    fin.position.y = -0.11;
    fin.rotation.y = (i * Math.PI * 2) / 3;
    g.add(fin);
  }

  return g;
}

// ===== 加特林机枪模型 =====
function createGatlingModel() {
  const g = new THREE.Group();
  const steelMat = mat(0x555555);
  const darkMat = mat(0x333333);
  const woodMat = mat(0x4a3520);

  // 六根旋转枪管（前部组件）
  const barrelGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(Math.cos(angle) * 0.035, Math.sin(angle) * 0.035, 0.1);
    barrelGroup.add(barrel);
  }
  // 枪管前端环
  const frontRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12), darkMat);
  frontRing.position.z = 0.25;
  frontRing.rotation.x = Math.PI / 2;
  barrelGroup.add(frontRing);
  // 枪管后端环
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12), darkMat);
  backRing.position.z = -0.05;
  backRing.rotation.x = Math.PI / 2;
  barrelGroup.add(backRing);
  g.add(barrelGroup);

  // 枪身主体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.14), steelMat);
  body.position.set(0, -0.01, -0.08);
  g.add(body);

  // 弹鼓（圆盘）
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.05, 12), darkMat);
  drum.position.set(0.05, -0.04, -0.06);
  drum.rotation.z = Math.PI / 2;
  g.add(drum);

  // 前握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.04), woodMat);
  grip.position.set(0, -0.07, 0.05);
  grip.rotation.x = -0.15;
  g.add(grip);

  // 后握把
  const rearGrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), woodMat);
  rearGrip.position.set(0, -0.08, -0.14);
  rearGrip.rotation.x = -0.25;
  g.add(rearGrip);

  // 准星
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.008), darkMat);
  sight.position.set(0, 0.05, -0.02);
  g.add(sight);

  return g;
}

// ===== 巴雷特狙击枪模型 =====
function createBarrettModel() {
  const g = new THREE.Group();
  const steelMat = mat(0x3a3a3a);
  const darkMat = mat(0x222222);
  const woodMat = mat(0x5a4a2a);
  const scopeMat = mat(0x1a1a1a);

  // 长枪管
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.45, 12), steelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.15;
  g.add(barrel);

  // 枪口消焰器
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.06, 8), darkMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = 0.38;
  g.add(muzzle);

  // 枪身主体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.2), steelMat);
  body.position.set(0, -0.01, -0.05);
  g.add(body);

  // 瞄准镜主体
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10), scopeMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.05, -0.02);
  g.add(scope);

  // 瞄准镜前镜头
  const scopeFront = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), mat(0x4488aa, { emissive: 0x224466, emissiveIntensity: 0.3 }));
  scopeFront.position.set(0, 0.05, 0.06);
  scopeFront.rotation.y = 0;
  g.add(scopeFront);

  // 瞄准镜后镜头
  const scopeRear = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), mat(0x111111));
  scopeRear.position.set(0, 0.05, -0.1);
  g.add(scopeRear);

  // 瞄准镜支架
  const scopeMount1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.015), darkMat);
  scopeMount1.position.set(0, 0.02, 0.03);
  g.add(scopeMount1);
  const scopeMount2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.015), darkMat);
  scopeMount2.position.set(0, 0.02, -0.07);
  g.add(scopeMount2);

  // 枪托
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.12), woodMat);
  stock.position.set(0, -0.02, -0.2);
  g.add(stock);

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), darkMat);
  grip.position.set(0, -0.07, -0.1);
  grip.rotation.x = -0.2;
  g.add(grip);

  // 扳机护圈
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.006, 4, 8, Math.PI), darkMat);
  trigger.position.set(0, -0.04, -0.08);
  trigger.rotation.x = Math.PI / 2;
  g.add(trigger);

  // 弹匣
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), darkMat);
  mag.position.set(0, -0.07, 0.0);
  g.add(mag);

  return g;
}

// ===== 加特林子弹模型（手持） =====
function createGatlingAmmoModel() {
  const g = new THREE.Group();

  // 弹链（多颗小子弹串联）
  for (let i = 0; i < 3; i++) {
    const bullet = new THREE.Group();
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), mat(0xccaa44));
    tip.position.y = 0.03;
    bullet.add(tip);
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), mat(0xddbb66));
    casing.position.y = -0.02;
    bullet.add(casing);
    bullet.position.set(0, -i * 0.08, 0);
    g.add(bullet);
  }

  return g;
}

// ===== 巴雷特子弹模型（手持） =====
function createBarrettAmmoModel() {
  const g = new THREE.Group();

  // 大型穿甲弹头
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 8), mat(0xb8860b));
  tip.position.y = 0.08;
  g.add(tip);

  // 弹壳
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8), mat(0xdaa520));
  casing.position.y = -0.02;
  g.add(casing);

  // 弹底
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.02, 8), mat(0x8b7500));
  base.position.y = -0.08;
  g.add(base);

  return g;
}

// ===== 龙息炮模型（火焰喷射器）=====
function createDragonBreathModel() {
  const g = new THREE.Group();
  const darkMat = mat(0x8b0000);
  const redMat = mat(0xcc2200);
  const steelMat = mat(0x444444);
  const fireMat = mat(0xff6600, { emissive: 0xff3300, emissiveIntensity: 0.4 });

  // 喷射管（粗短管）
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 10), steelMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 0.1;
  g.add(nozzle);

  // 管口火焰指示器（发光小锥）
  const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.05, 6), fireMat);
  flameTip.rotation.x = -Math.PI / 2;
  flameTip.position.z = 0.22;
  g.add(flameTip);

  // 燃料罐主体（圆筒）
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12), darkMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0, -0.05);
  g.add(tank);

  // 燃料罐装饰环
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 4, 10), redMat);
  ring1.position.z = 0.02;
  ring1.rotation.x = Math.PI / 2;
  g.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 4, 10), redMat);
  ring2.position.z = -0.12;
  ring2.rotation.x = Math.PI / 2;
  g.add(ring2);

  // 前握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.04), mat(0x3a1a00));
  grip.position.set(0, -0.07, 0.06);
  grip.rotation.x = -0.15;
  g.add(grip);

  // 后握把
  const rearGrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), mat(0x3a1a00));
  rearGrip.position.set(0, -0.08, -0.12);
  rearGrip.rotation.x = -0.25;
  g.add(rearGrip);

  // 顶部燃料指示灯（发光）
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), fireMat);
  indicator.position.set(0, 0.06, -0.05);
  g.add(indicator);

  return g;
}

// ===== 雷霆链枪模型（科幻电击枪）=====
function createThunderGunModel() {
  const g = new THREE.Group();
  const blueMat = mat(0x1a6aaa);
  const darkBlueMat = mat(0x0a3a6a);
  const glowMat = mat(0x66ddff, { emissive: 0x3399ff, emissiveIntensity: 0.5 });
  const steelMat = mat(0x555555);

  // 枪管（方形蓝色金属管）
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), blueMat);
  barrel.position.z = 0.08;
  g.add(barrel);

  // 管口电极（发光）
  const electrode = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.04, 6), glowMat);
  electrode.rotation.x = -Math.PI / 2;
  electrode.position.z = 0.21;
  g.add(electrode);

  // 能量核心主体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.14), darkBlueMat);
  body.position.set(0, -0.01, -0.06);
  g.add(body);

  // 能量核心发光体（中心球）
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowMat);
  core.position.set(0, 0.01, -0.06);
  g.add(core);

  // 能量管（两侧细管）
  for (const sx of [-0.035, 0.035]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), steelMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx, 0.02, -0.04);
    g.add(pipe);
  }

  // 顶部电极尖
  const topElectrode = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 6), glowMat);
  topElectrode.position.set(0, 0.05, -0.02);
  g.add(topElectrode);

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), darkBlueMat);
  grip.position.set(0, -0.08, -0.08);
  grip.rotation.x = -0.2;
  g.add(grip);

  // 扳机护圈
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.006, 4, 8, Math.PI), darkBlueMat);
  trigger.position.set(0, -0.04, -0.04);
  trigger.rotation.x = Math.PI / 2;
  g.add(trigger);

  // 枪管散热条
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.008), steelMat);
    fin.position.set(0, 0.025, 0.04 + i * 0.04);
    g.add(fin);
  }

  return g;
}

// ===== 湮灭炮模型（紫色科幻炮）=====
function createAnnihilatorModel() {
  const g = new THREE.Group();
  const purpleMat = mat(0x5a1a7a);
  const darkPurpleMat = mat(0x2a0a3a);
  const glowMat = mat(0xcc44ff, { emissive: 0x8822cc, emissiveIntensity: 0.5 });
  const steelMat = mat(0x444444);

  // 枪管（宽粗管）
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.18, 10), purpleMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.08;
  g.add(barrel);

  // 管口能量环（发光）
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 6, 12), glowMat);
  muzzleRing.position.z = 0.17;
  muzzleRing.rotation.x = Math.PI / 2;
  g.add(muzzleRing);

  // 能量核心主体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.14), darkPurpleMat);
  body.position.set(0, -0.01, -0.06);
  g.add(body);

  // 中心能量球（发光）
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glowMat);
  core.position.set(0, 0.01, -0.04);
  g.add(core);

  // 旋转能量环（3个环装饰）
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 4, 12), glowMat);
    ring.position.set(0, 0.01, -0.04);
    ring.rotation.x = (i / 3) * Math.PI;
    ring.rotation.y = (i / 3) * Math.PI * 0.5;
    g.add(ring);
  }

  // 侧面能量条
  for (const sx of [-0.04, 0.04]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.1), glowMat);
    stripe.position.set(sx, 0, -0.04);
    g.add(stripe);
  }

  // 握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.045), darkPurpleMat);
  grip.position.set(0, -0.09, -0.08);
  grip.rotation.x = -0.2;
  g.add(grip);

  // 扳机护圈
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 4, 8, Math.PI), darkPurpleMat);
  trigger.position.set(0, -0.05, -0.04);
  trigger.rotation.x = Math.PI / 2;
  g.add(trigger);

  // 顶部能量条
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.06), glowMat);
  topBar.position.set(0, 0.05, -0.02);
  g.add(topBar);

  return g;
}

// ===== 默认平面图标（无3D模型的物品）=====
function createFlatIcon(blockId, atlasTexture) {
  const g = new THREE.Group();
  const geom = new THREE.PlaneGeometry(0.25, 0.25);
  // PlaneGeometry 只有1个面（4个顶点），手动设置UV
  const sideUV = getFaceUV(blockId, 2);
  if (sideUV) {
    const uv = geom.attributes.uv;
    uv.setXY(0, sideUV.u0, sideUV.v1);
    uv.setXY(1, sideUV.u1, sideUV.v1);
    uv.setXY(2, sideUV.u0, sideUV.v0);
    uv.setXY(3, sideUV.u1, sideUV.v0);
    uv.needsUpdate = true;
  }
  const m = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    alphaTest: 0.5,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, m);
  g.add(mesh);
  return g;
}

// ===== 主工厂函数 =====
/**
 * 根据物品ID和工具数据创建3D模型
 * @param {number} itemId - 物品/方块ID
 * @param {object} toolData - 玩家的 toolData 对象
 * @param {THREE.Texture} atlasTexture - 方块纹理图集
 * @returns {THREE.Group|null}
 */
export function createItemModel(itemId, toolData, atlasTexture) {
  if (!itemId) return null;

  // 检查是否是工具/护甲（动态ID >= 10000）
  if (toolData && toolData[itemId]) {
    const td = toolData[itemId];
    if (td.toolType) {
      switch (td.toolType) {
        case 'sword':   return createSword(td.material);
        case 'pickaxe': return createPickaxe(td.material);
        case 'axe':     return createAxe(td.material);
        case 'shovel':  return createShovel(td.material);
        case 'hoe':     return createHoe(td.material);
        case 'shield':  return createShield(td.material);
      }
    } else if (td.armorType) {
      return createArmorModel(td.armorType, td.material);
    }
  }

  // 固定ID物品
  switch (itemId) {
    case BLOCK.BOW:         return createBow();
    case BLOCK.CROSSBOW:    return createCrossbow();
    case BLOCK.TRIDENT:     return createTrident();
    case BLOCK.FISHING_ROD: return createFishingRod();
    case BLOCK.ARROW:       return createArrow(false);
    case BLOCK.SPECTRAL_ARROW: return createArrow(true);
    case BLOCK.SNOWBALL:    return createSphere(0xffffff, 0.11);
    case BLOCK.EGG_ITEM:    return createSphere(0xfff8dc, 0.11);
    case BLOCK.ENDER_PEARL: return createSphere(0x1a8b4a, 0.11, true);
    case BLOCK.FIREWORK_ROCKET: {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 6), mat(0xff4444));
      g.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.05, 6), mat(0xffcc00));
      tip.position.y = 0.12;
      g.add(tip);
      return g;
    }
    case BLOCK.STICK:       return createStickModel();
    case BLOCK.TORCH:       return createTorchModel();
    case BLOCK.BUCKET:      return createBucketModel();
    case BLOCK.BREAD: {
      const g = new THREE.Group();
      const loaf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), mat(0xc4985a));
      g.add(loaf);
      return g;
    }
    case BLOCK.APPLE:       return createSphere(0xcc2222, 0.1);
    case BLOCK.PISTOL:        return createPistolModel();
    case BLOCK.ROCKET_LAUNCHER: return createRocketLauncherModel();
    case BLOCK.BULLET_ITEM:   return createBulletItemModel();
    case BLOCK.ROCKET_AMMO:   return createRocketAmmoModel();
    case BLOCK.GATLING:       return createGatlingModel();
    case BLOCK.BARRETT:       return createBarrettModel();
    case BLOCK.GATLING_AMMO:  return createGatlingAmmoModel();
    case BLOCK.BARRETT_AMMO:  return createBarrettAmmoModel();
    case BLOCK.DRAGON_BREATH: return createDragonBreathModel();
    case BLOCK.THUNDER_GUN:   return createThunderGunModel();
    case BLOCK.ANNIHILATOR:   return createAnnihilatorModel();
    default: {
      // 普通方块
      const def = BLOCK_DEFS[itemId];
      if (!def) return null;
      if (atlasTexture) {
        return createBlockCube(itemId, atlasTexture);
      }
      // 无纹理时用颜色方块
      const g = new THREE.Group();
      const color = def.color || 0x888888;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat(color));
      g.add(cube);
      return g;
    }
  }
}

// ===== 第一人称视图模型渲染器 =====
export class HeldItemViewModel {
  constructor(game) {
    this.game = game;
    this.enabled = false;

    // 独立场景 — 背景设为 null（透明，不清除颜色缓冲）
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 独立相机 — 较窄 FOV 模拟手持视角
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);

    // 灯光 — 模拟环境光 + 前方主光
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0.3, 0.8, 0.6);
    this.scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(0xaaccff, 0.2);
    rimLight.position.set(-0.3, 0.1, -0.4);
    this.scene.add(rimLight);

    // 当前物品模型
    this._model = null;
    this._modelPivot = new THREE.Group(); // 用于动画偏移
    this.scene.add(this._modelPivot);

    // 动画状态
    this._swingTimer = 0;
    this._swingDuration = 0.35;
    this._switchTimer = 0;
    this._idlePhase = 0;
    this._currentItemId = null;

    // 视口尺寸
    this._vpSize = 200;
    this._vpMargin = 20;
  }

  /**
   * 设置当前手持物品
   */
  setItem(itemId, toolData, atlasTexture) {
    if (itemId === this._currentItemId) return;
    this._currentItemId = itemId;

    // 移除旧模型
    if (this._model) {
      this._modelPivot.remove(this._model);
      this._disposeModel(this._model);
      this._model = null;
    }

    if (itemId) {
      this._model = createItemModel(itemId, toolData, atlasTexture);
      if (this._model) {
        // 应用第一人称持握变换
        this._applyHoldPose(this._model, itemId, toolData);
        this._modelPivot.add(this._model);
        this._switchTimer = 0.2; // 切换动画
      }
    }
  }

  /**
   * 根据物品类型应用第一人称持握姿态
   * 相机在原点看向 -Z 方向
   * 物品应位于右下方，模拟右手持握
   */
  _applyHoldPose(model, itemId, toolData) {
    // 判断物品类型
    let type = 'block';
    if (toolData && toolData[itemId]) {
      type = toolData[itemId].toolType || toolData[itemId].armorType || 'block';
    } else if (itemId === BLOCK.BOW || itemId === BLOCK.CROSSBOW) {
      type = 'bow';
    } else if (itemId === BLOCK.TRIDENT) {
      type = 'trident';
    } else if (itemId === BLOCK.FISHING_ROD) {
      type = 'rod';
    } else if (itemId === BLOCK.ARROW || itemId === BLOCK.SPECTRAL_ARROW) {
      type = 'arrow';
    } else if (itemId === BLOCK.SNOWBALL || itemId === BLOCK.EGG_ITEM || itemId === BLOCK.ENDER_PEARL) {
      type = 'throwable';
    } else if (itemId === BLOCK.STICK || itemId === BLOCK.TORCH) {
      type = 'stick';
    } else if (toolData && toolData[itemId] && toolData[itemId].toolType === 'shield') {
      type = 'shield';
    } else if (itemId === BLOCK.PISTOL) {
      type = 'pistol';
    } else if (itemId === BLOCK.ROCKET_LAUNCHER) {
      type = 'rocket_launcher';
    } else if (itemId === BLOCK.GATLING) {
      type = 'gatling';
    } else if (itemId === BLOCK.BARRETT) {
      type = 'barrett';
    } else if (itemId === BLOCK.DRAGON_BREATH) {
      type = 'dragon_breath';
    } else if (itemId === BLOCK.THUNDER_GUN) {
      type = 'thunder_gun';
    } else if (itemId === BLOCK.ANNIHILATOR) {
      type = 'annihilator';
    } else if (itemId === BLOCK.BULLET_ITEM || itemId === BLOCK.ROCKET_AMMO ||
               itemId === BLOCK.GATLING_AMMO || itemId === BLOCK.BARRETT_AMMO) {
      type = 'throwable';
    }

    // 通用基准：右下方，前方
    // X: +0.25~0.35 右偏
    // Y: -0.2~-0.3 下偏（模拟手持高度）
    // Z: -0.55~-0.7 前方（相机看向-Z）
    const baseX = 0.28, baseY = -0.22, baseZ = -0.6;
    model.position.set(baseX, baseY, baseZ);
    model.rotation.set(0, 0, 0);

    switch (type) {
      case 'sword':
        // 剑：竖直略前倾，刃尖朝上前方
        model.position.set(0.3, -0.18, -0.65);
        model.rotation.set(-0.15, -0.35, 0.05);
        break;
      case 'pickaxe':
        // 镐：斜持，镐头朝右上前方
        model.position.set(0.3, -0.15, -0.6);
        model.rotation.set(-0.1, -0.4, -0.25);
        break;
      case 'axe':
        // 斧：斜持，斧头朝右前方
        model.position.set(0.3, -0.15, -0.6);
        model.rotation.set(-0.1, -0.4, -0.2);
        break;
      case 'hoe':
        // 锄：类似镐
        model.position.set(0.3, -0.15, -0.6);
        model.rotation.set(-0.1, -0.4, -0.2);
        break;
      case 'shovel':
        // 锹：竖直略前倾
        model.position.set(0.3, -0.18, -0.6);
        model.rotation.set(-0.12, -0.35, -0.05);
        break;
      case 'bow':
        // 弓：竖直持握，弓身朝前
        model.position.set(0.25, -0.1, -0.6);
        model.rotation.set(0, -0.3, 0.05);
        break;
      case 'trident':
        // 三叉戟：向前平举
        model.position.set(0.28, -0.1, -0.7);
        model.rotation.set(-0.8, -0.3, 0);
        break;
      case 'rod':
        // 钓鱼竿：斜向前
        model.position.set(0.3, -0.12, -0.6);
        model.rotation.set(-0.2, -0.5, -0.1);
        break;
      case 'arrow':
        // 箭矢：横向持握
        model.position.set(0.25, -0.1, -0.55);
        model.rotation.set(0.1, -0.3, 0);
        break;
      case 'throwable':
        // 投掷物：小物件在手
        model.position.set(0.25, -0.12, -0.55);
        model.rotation.set(0, -0.3, 0);
        break;
      case 'shield':
        // 盾牌：竖直在左侧前方
        model.position.set(0.18, -0.15, -0.55);
        model.rotation.set(0, -0.2, 0.05);
        break;
      case 'helmet':
      case 'chestplate':
      case 'leggings':
      case 'boots':
        // 护甲：正面展示
        model.position.set(0.25, -0.12, -0.55);
        model.rotation.set(0, -0.35, 0);
        break;
      case 'stick':
        // 木棍/火把：斜持
        model.position.set(0.28, -0.12, -0.55);
        model.rotation.set(-0.15, -0.3, -0.05);
        break;
      case 'pistol':
        // 手枪：平举瞄准
        model.position.set(0.25, -0.12, -0.5);
        model.rotation.set(-1.4, -0.1, 0);
        break;
      case 'rocket_launcher':
        // 火箭筒：扛在肩上
        model.position.set(0.3, -0.1, -0.6);
        model.rotation.set(-1.45, -0.15, -0.05);
        break;
      case 'gatling':
        // 加特林：双手持枪，略向下倾斜
        model.position.set(0.28, -0.15, -0.55);
        model.rotation.set(-1.35, -0.08, 0.02);
        break;
      case 'barrett':
        // 巴雷特：狙击姿势，枪身水平
        model.position.set(0.26, -0.14, -0.58);
        model.rotation.set(-1.45, -0.05, 0);
        break;
      case 'dragon_breath':
        // 龙息炮：低位平举，略向下倾斜
        model.position.set(0.28, -0.16, -0.52);
        model.rotation.set(-1.35, -0.08, 0.02);
        break;
      case 'thunder_gun':
        // 雷霆链枪：平举瞄准
        model.position.set(0.26, -0.13, -0.52);
        model.rotation.set(-1.42, -0.05, 0);
        break;
      case 'annihilator':
        // 湮灭炮：双手持枪，略向下
        model.position.set(0.27, -0.15, -0.54);
        model.rotation.set(-1.38, -0.06, 0.01);
        break;
      default:
        // 方块：略倾斜展示
        model.position.set(0.28, -0.18, -0.55);
        model.rotation.set(-0.15, -0.4, 0.08);
        break;
    }
  }

  /**
   * 触发攻击挥动动画
   */
  triggerSwing() {
    this._swingTimer = this._swingDuration;
  }

  /**
   * 每帧更新动画
   */
  update(dt) {
    this._idlePhase += dt;

    // 切换弹出动画
    if (this._switchTimer > 0) {
      this._switchTimer -= dt;
    }

    // 挥动动画
    if (this._swingTimer > 0) {
      this._swingTimer -= dt;
    }

    // 计算动画变换
    let offsetX = 0, offsetY = 0, offsetZ = 0;
    let rotX = 0, rotY = 0, rotZ = 0;
    let scale = 1;

    // 闲置浮动
    const idleBob = Math.sin(this._idlePhase * 1.8) * 0.01;
    const idleSway = Math.sin(this._idlePhase * 1.2) * 0.006;
    offsetY += idleBob;
    offsetX += idleSway;
    rotZ += idleSway * 0.2;

    // 切换弹出
    if (this._switchTimer > 0) {
      const t = 1 - (this._switchTimer / 0.2); // 0→1
      scale = 0.3 + t * 0.7;
      rotX -= (1 - t) * 0.4;
    }

    // 挥动 — 从右下向左上挥
    if (this._swingTimer > 0) {
      const t = 1 - (this._swingTimer / this._swingDuration); // 0→1
      const swing = Math.sin(t * Math.PI);
      rotX -= swing * 0.9;
      rotZ += swing * 0.6;
      offsetY += swing * 0.04;
      offsetX -= swing * 0.02;
    }

    this._modelPivot.position.set(offsetX, offsetY, offsetZ);
    this._modelPivot.rotation.set(rotX, rotY, rotZ);
    this._modelPivot.scale.setScalar(scale);
  }

  /**
   * 渲染到主渲染器的右下角（使用 scissor + viewport）
   * 关键：不清除颜色缓冲，仅清除深度缓冲，使主场景透过来
   */
  render() {
    if (!this.enabled || !this._model) return;

    const renderer = this.game.renderer;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 移动端缩小视口
    const isMobile = this.game.isMobile;
    const vpW = isMobile ? 130 : this._vpSize;
    const vpH = isMobile ? 130 : this._vpSize;
    const vpX = width - vpW - (isMobile ? 8 : this._vpMargin);
    const vpY = isMobile ? 80 : this._vpMargin; // WebGL Y 从底部开始

    // 保存渲染器状态
    const oldAutoClear = renderer.autoClear;
    const oldVp = renderer.getViewport(new THREE.Vector4());

    // 关键：禁用自动清除（保留主场景画面）
    renderer.autoClear = false;

    // 设置视口和裁剪
    renderer.setViewport(vpX, vpY, vpW, vpH);
    renderer.setScissor(vpX, vpY, vpW, vpH);
    renderer.setScissorTest(true);

    // 仅清除深度缓冲，不清除颜色缓冲
    renderer.clearDepth();

    // 更新相机宽高比
    this.camera.aspect = vpW / vpH;
    this.camera.updateProjectionMatrix();

    // 渲染（不清除颜色，叠加在主场景上）
    renderer.render(this.scene, this.camera);

    // 恢复
    renderer.setScissorTest(false);
    renderer.autoClear = oldAutoClear;
    renderer.setViewport(oldVp.x, oldVp.y, oldVp.z, oldVp.w);
  }

  _disposeModel(model) {
    model.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  dispose() {
    if (this._model) {
      this._disposeModel(this._model);
      this._model = null;
    }
  }
}
