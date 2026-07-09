/**
 * effects.js — 视觉特效系统
 * 包含：爆炸、粒子效果、伤害数字、TNT 引爆、方块破坏特效
 */

import * as THREE from 'three';
import { BLOCK_DEFS } from './blocks.js';

export class EffectsManager {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this.damageNumbers = [];
    this.tntEntities = [];
    this.scene = game.scene;

    // 伤害数字的 DOM 容器
    this.damageNumberContainer = document.createElement('div');
    this.damageNumberContainer.id = 'damage-numbers';
    this.damageNumberContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1000;';
    document.body.appendChild(this.damageNumberContainer);
  }

  // ===== 爆炸 =====
  createExplosion(x, y, z, power = 4) {
    const radius = power;

    // 1. 破坏方块
    try {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > radius) continue;
            const bx = Math.floor(x + dx);
            const by = Math.floor(y + dy);
            const bz = Math.floor(z + dz);
            const block = this.game.world.getBlock(bx, by, bz);
            if (block === 0) continue;
            const def = BLOCK_DEFS[block];
            if (def && def.name === '基岩') continue;
            // 越近破坏概率越高
            if (Math.random() > dist / radius * 0.5) {
              this.game.world.setBlock(bx, by, bz, 0);
            }
          }
        }
      }
    } catch (e) { /* 忽略 */ }

    // 2. 伤害附近生物和玩家
    // 2a. 伤害生物
    try {
      if (this.game.mobs && this.game.mobs.mobs) {
        for (const mob of this.game.mobs.mobs) {
          const mobDist = Math.sqrt(
            (mob.position.x - x) ** 2 +
            (mob.position.y - y) ** 2 +
            (mob.position.z - z) ** 2
          );
          if (mobDist < radius * 2) {
            const damage = Math.floor((1 - mobDist / (radius * 2)) * power * 5);
            if (damage > 0) {
              mob.takeDamage(damage);
              // 击退
              const dx = mob.position.x - x;
              const dy = mob.position.y - y + 0.5;
              const dz = mob.position.z - z;
              const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (len > 0) {
                mob.velocity.x += (dx / len) * power * 3;
                mob.velocity.y += (dy / len) * power * 3;
                mob.velocity.z += (dz / len) * power * 3;
              }
              this.showDamageNumber(mob.position.x, mob.position.y + 1, mob.position.z, damage);
            }
          }
        }
      }
    } catch (e) { /* 忽略 */ }

    // 2b. 伤害玩家
    try {
      const player = this.game.player;
      if (player) {
        const playerDist = Math.sqrt(
          (player.position.x - x) ** 2 +
          (player.position.y - y) ** 2 +
          (player.position.z - z) ** 2
        );
        if (playerDist < radius * 2) {
          const damage = Math.floor((1 - playerDist / (radius * 2)) * power * 5);
          if (damage > 0) {
            player.takeDamage(damage);
            // 击退
            const dx = player.position.x - x;
            const dy = player.position.y - y + 0.5;
            const dz = player.position.z - z;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len > 0) {
              player.velocity.x += (dx / len) * power * 3;
              player.velocity.y += (dy / len) * power * 3;
              player.velocity.z += (dz / len) * power * 3;
            }
          }
        }
      }
    } catch (e) { /* 忽略 */ }

    // 3. 爆炸粒子
    try {
      this.createExplosionParticles(x, y, z, power);
    } catch (e) { /* 忽略 */ }

    // 4. 闪光
    try {
      this.createFlash(x, y, z, power);
    } catch (e) { /* 忽略 */ }

    // 5. 屏幕震动
    this.screenShake = power * 0.3;

    // 6. 声效模拟（toast）
    try {
      if (this.game.ui && this.game.ui.showToast) {
        this.game.ui.showToast('💥 BOOM!');
      }
    } catch (e) { /* 忽略 */ }

    // 多人同步
    try {
      if (this.game.multiplayer) {
        this.game.multiplayer.sendExplosion(x, y, z, power);
      }
    } catch (e) { /* 忽略 */ }
  }

  createExplosionParticles(x, y, z, power) {
    const count = Math.min(100, power * 20);
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3 + Math.random() * power * 3;
      velocities.push({
        x: Math.sin(phi) * Math.cos(theta) * speed,
        y: Math.cos(phi) * speed + 2,
        z: Math.sin(phi) * Math.sin(theta) * speed,
      });
      // 爆炸颜色：橙红黄
      const c = Math.random();
      if (c < 0.4) { colors[i * 3] = 1; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0; }
      else if (c < 0.7) { colors[i * 3] = 1; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0; }
      else { colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.3; }
      sizes[i] = 0.2 + Math.random() * 0.4;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: 1.5,
      gravity: true,
    });
  }

  // ===== 闪光 =====
  createFlash(x, y, z, power) {
    const light = new THREE.PointLight(0xffaa00, power * 3, power * 15);
    light.position.set(x, y, z);
    this.scene.add(light);

    this.particles.push({
      mesh: null,
      light: light,
      life: 0,
      maxLife: 0.3,
      isLight: true,
    });
  }

  // ===== 方块破坏粒子 =====
  // blockId 可以是方块ID（从定义取颜色）或直接传颜色数值
  createBlockBreakParticles(x, y, z, blockId) {
    let particleColor = 0x888888;
    const def = BLOCK_DEFS[blockId];
    if (def) {
      // 有方块定义，使用方块相关颜色
      particleColor = def.color || 0x888888;
    } else if (typeof blockId === 'number' && blockId > 255) {
      // 传入的是颜色值（hex），直接使用
      particleColor = blockId;
    }

    const count = 12;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + 0.5 + (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 1] = y + 0.5 + (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 2] = z + 0.5 + (Math.random() - 0.5) * 0.6;
      velocities.push({
        x: (Math.random() - 0.5) * 4,
        y: 2 + Math.random() * 3,
        z: (Math.random() - 0.5) * 4,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: particleColor,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      fog: false,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: 0.8,
      gravity: true,
    });
  }

  // ===== 伤害数字 =====
  showDamageNumber(x, y, z, amount, color = '#ff4444') {
    const div = document.createElement('div');
    div.textContent = `-${amount}`;
    div.style.cssText = `
      position: absolute;
      color: ${color};
      font-size: ${Math.min(24, 12 + amount * 2)}px;
      font-weight: bold;
      text-shadow: 1px 1px 2px #000, -1px -1px 2px #000;
      transition: all 1s ease-out;
      pointer-events: none;
      z-index: 1000;
    `;

    // 将3D坐标投影到屏幕
    const vec = new THREE.Vector3(x, y, z);
    vec.project(this.game.camera);
    const screenX = (vec.x + 1) / 2 * window.innerWidth;
    const screenY = (-vec.y + 1) / 2 * window.innerHeight;
    div.style.left = screenX + 'px';
    div.style.top = screenY + 'px';

    this.damageNumberContainer.appendChild(div);

    // 动画
    requestAnimationFrame(() => {
      div.style.transform = `translateY(-40px)`;
      div.style.opacity = '0';
    });

    setTimeout(() => div.remove(), 1000);
  }

  // ===== TNT =====
  spawnTNT(x, y, z) {
    const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.tntEntities.push({
      mesh,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      fuse: 3.0, // 3秒引信
      power: 4,
    });
  }

  updateTNT(dt) {
    for (let i = this.tntEntities.length - 1; i >= 0; i--) {
      const tnt = this.tntEntities[i];
      tnt.fuse -= dt;

      // 重力
      tnt.velocity.y -= 28 * dt;
      tnt.position.y += tnt.velocity.y * dt;

      // 简单地面碰撞
      const blockBelow = this.game.world.getBlock(
        Math.floor(tnt.position.x),
        Math.floor(tnt.position.y - 0.5),
        Math.floor(tnt.position.z)
      );
      if (blockBelow !== 0 && BLOCK_DEFS[blockBelow]?.solid) {
        tnt.position.y = Math.floor(tnt.position.y) + 0.5;
        tnt.velocity.y = 0;
      }

      // 闪烁效果
      const flash = Math.sin(tnt.fuse * 10) > 0;
      tnt.mesh.material.color.setHex(flash ? 0xffffff : 0xff0000);
      tnt.mesh.position.copy(new THREE.Vector3(tnt.position.x, tnt.position.y, tnt.position.z));

      // 引信结束 — 爆炸！
      if (tnt.fuse <= 0) {
        this.scene.remove(tnt.mesh);
        this.tntEntities.splice(i, 1);
        this.createExplosion(tnt.position.x, tnt.position.y, tnt.position.z, tnt.power);
      }
    }
  }

  // ===== 攻击挥砍特效 =====
  createSlashEffect(x, y, z, dir, color = 0xffffff, weaponType = 'fist') {
    const count = weaponType === 'sword' ? 16 : weaponType === 'trident' ? 20 : 10;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    const c = new THREE.Color(color);

    // 计算垂直于视线方向的平面
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    const arcSpread = weaponType === 'sword' ? 1.2 : 0.6;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 沿弧形方向喷射粒子
      const angle = (i / count - 0.5) * arcSpread * 2;
      const speed = 3 + Math.random() * 4;
      const v = new THREE.Vector3()
        .addScaledVector(forward, speed * 0.3)
        .addScaledVector(right, Math.sin(angle) * speed)
        .addScaledVector(realUp, Math.cos(angle) * speed * 0.5);

      velocities.push({ x: v.x, y: v.y, z: v.z });

      // 颜色变化
      const brightness = 0.7 + Math.random() * 0.3;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: weaponType === 'sword' ? 0.18 : 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: 0.35,
      gravity: false,
    });
  }

  // ===== 更新所有粒子 =====
  update(dt) {
    // TNT
    this.updateTNT(dt);

    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.isLight) {
        // 闪光衰减
        const t = p.life / p.maxLife;
        p.light.intensity = (1 - t) * 10;
        if (p.life >= p.maxLife) {
          this.scene.remove(p.light);
          this.particles.splice(i, 1);
        }
        continue;
      }

      if (!p.mesh) continue;

      // 漩涡核心：脉动缩放
      if (p.isVortexCore) {
        const t = p.life / p.maxLife;
        const pulse = 1 + Math.sin(p.life * 8) * 0.3;
        p.mesh.scale.setScalar(pulse * (1 + t * 0.5));
        p.mesh.material.opacity = 0.6 * (1 - t);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      // 漩涡粒子：轨道运动 + 向心收缩
      if (p.isVortex) {
        const positions = p.mesh.geometry.attributes.position.array;
        const center = p.vortexCenter;
        for (let j = 0; j < p.velocities.length; j++) {
          const v = p.velocities[j];
          v.angle += v.orbitSpeed * dt;
          v.radius = Math.max(0.1, v.radius - v.inwardSpeed * dt);
          positions[j * 3] = center.x + Math.cos(v.angle) * v.radius;
          positions[j * 3 + 1] = center.y + Math.sin(v.angle * 2) * v.radius * 0.3;
          positions[j * 3 + 2] = center.z + Math.sin(v.angle) * v.radius;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        const t = p.life / p.maxLife;
        p.mesh.material.opacity = 0.8 * (1 - t * 0.5);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      // 闪电：仅淡出
      if (p.isLightning) {
        p.mesh.material.opacity = 1 - (p.life / p.maxLife);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      // 地面火：循环重置粒子位置，闪烁透明度
      if (p.isGroundFire) {
        const positions = p.mesh.geometry.attributes.position.array;
        const c = p.fireCenter;
        for (let j = 0; j < p.velocities.length; j++) {
          positions[j * 3] += p.velocities[j].x * dt;
          positions[j * 3 + 1] += p.velocities[j].y * dt;
          positions[j * 3 + 2] += p.velocities[j].z * dt;
          // 粒子飞到一定高度后重置回地面
          if (positions[j * 3 + 1] > c.y + 1.2) {
            positions[j * 3] = c.x + (Math.random() - 0.5) * 0.7;
            positions[j * 3 + 1] = c.y + 0.1;
            positions[j * 3 + 2] = c.z + (Math.random() - 0.5) * 0.7;
          }
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        // 闪烁效果
        const flicker = 0.5 + Math.sin(p.life * 15) * 0.2;
        p.mesh.material.opacity = flicker * (1 - p.life / p.maxLife * 0.5);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      // 电力冲击波：扩散环
      if (p.isShockwave) {
        const t = p.life / p.maxLife;
        const r = t * p.maxRadius;
        const positions = p.mesh.geometry.attributes.position.array;
        const c = p.center;
        const segs = positions.length / 3 - 1;
        for (let j = 0; j <= segs; j++) {
          const ang = (j / segs) * Math.PI * 2;
          positions[j * 3] = c.x + Math.cos(ang) * r;
          positions[j * 3 + 1] = c.y + Math.sin(p.life * 20 + j) * 0.15;
          positions[j * 3 + 2] = c.z + Math.sin(ang) * r;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        p.mesh.material.opacity = 0.8 * (1 - t);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      // 残留电场：粒子轨道运动 + 闪烁
      if (p.isElectricField) {
        const positions = p.mesh.geometry.attributes.position.array;
        const c = p.fieldCenter;
        for (let j = 0; j < p.velocities.length; j++) {
          const v = p.velocities[j];
          v.angle += v.orbitSpeed * dt;
          // 随机改变轨道半径，模拟放电
          v.radius += (Math.random() - 0.5) * 0.3;
          v.radius = Math.max(0.2, Math.min(p.fieldRadius, v.radius));
          positions[j * 3] = c.x + Math.cos(v.angle) * v.radius;
          positions[j * 3 + 1] = c.y + 0.05 + Math.sin(p.life * 10 + j) * 0.1;
          positions[j * 3 + 2] = c.z + Math.sin(v.angle) * v.radius;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        // 闪烁透明度
        const flicker = 0.4 + Math.sin(p.life * 12) * 0.3;
        p.mesh.material.opacity = flicker * (1 - p.life / p.maxLife * 0.3);
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
        continue;
      }

      const positions = p.mesh.geometry.attributes.position.array;
      const velocities = p.velocities;
      const count = positions.length / 3;

      for (let j = 0; j < count; j++) {
        if (p.gravity) {
          velocities[j].y -= 10 * dt;
        }
        if (p.drag) {
          // 火焰空气阻力减速
          velocities[j].x *= (1 - p.drag * dt);
          velocities[j].y *= (1 - p.drag * dt);
          velocities[j].z *= (1 - p.drag * dt);
        }
        positions[j * 3] += velocities[j].x * dt;
        positions[j * 3 + 1] += velocities[j].y * dt;
        positions[j * 3 + 2] += velocities[j].z * dt;
      }

      p.mesh.geometry.attributes.position.needsUpdate = true;
      p.mesh.material.opacity = 1 - (p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // 屏幕震动（仅记录偏移量，由 updateCamera 应用，避免相机位置漂移）
    if (this.screenShake && this.screenShake > 0) {
      this.screenShake -= dt * 2;
      if (this.screenShake < 0) this.screenShake = 0;
    }
  }

  // 获取屏幕震动偏移量（供 updateCamera 使用）
  getShakeOffset() {
    if (!this.screenShake || this.screenShake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.screenShake * 0.1,
      y: (Math.random() - 0.5) * this.screenShake * 0.1,
    };
  }

  // ===== 龙息炮：火焰流喷射 =====
  // 从枪口到命中点生成分层火焰流：核心白热 + 中层橙焰 + 外层红火 + 烟雾 + 余烬
  createDragonFireStream(origin, dir, impactDist, range = 10) {
    const forward = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    // 实际火焰到达距离（射线命中点或最大射程）
    const fireDist = Math.min(impactDist > 0 ? impactDist : range, range);
    const nozzleOffset = 1.2; // 枪口偏移，避免遮挡视线
    const startX = origin.x + forward.x * nozzleOffset;
    const startY = origin.y + forward.y * nozzleOffset;
    const startZ = origin.z + forward.z * nozzleOffset;

    // --- 第1层：核心白热流（细而亮，沿轴线流动）---
    const coreCount = 14;
    const coreGeom = new THREE.BufferGeometry();
    const corePos = new Float32Array(coreCount * 3);
    const coreVel = [];
    const coreCol = new Float32Array(coreCount * 3);
    for (let i = 0; i < coreCount; i++) {
      const t = Math.random();
      corePos[i * 3] = startX + forward.x * t * fireDist;
      corePos[i * 3 + 1] = startY + forward.y * t * fireDist;
      corePos[i * 3 + 2] = startZ + forward.z * t * fireDist;
      // 核心粒子向前流动 + 轻微抖动
      const wob = 0.06;
      coreVel.push({
        x: forward.x * (10 + Math.random() * 4) + (Math.random() - 0.5) * wob,
        y: forward.y * (10 + Math.random() * 4) + (Math.random() - 0.5) * wob,
        z: forward.z * (10 + Math.random() * 4) + (Math.random() - 0.5) * wob,
      });
      // 白 → 浅黄
      coreCol[i * 3] = 1;
      coreCol[i * 3 + 1] = 0.95 - t * 0.15;
      coreCol[i * 3 + 2] = 0.7 - t * 0.3;
    }
    coreGeom.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
    coreGeom.setAttribute('color', new THREE.BufferAttribute(coreCol, 3));
    const coreMat = new THREE.PointsMaterial({
      size: 0.18, vertexColors: true, transparent: true, opacity: 0.95,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const corePoints = new THREE.Points(coreGeom, coreMat);
    this.scene.add(corePoints);
    this.particles.push({ mesh: corePoints, velocities: coreVel, life: 0, maxLife: 0.3, gravity: false, drag: 2 });

    // --- 第2层：中层橙焰（散布较大，锥形扩散）---
    const midCount = 22;
    const midGeom = new THREE.BufferGeometry();
    const midPos = new Float32Array(midCount * 3);
    const midVel = [];
    const midCol = new Float32Array(midCount * 3);
    for (let i = 0; i < midCount; i++) {
      const t = 0.1 + Math.random() * 0.9;
      const spreadR = t * 0.22; // 越远散布越大
      const ang = Math.random() * Math.PI * 2;
      midPos[i * 3] = startX + forward.x * t * fireDist + right.x * Math.cos(ang) * spreadR + realUp.x * Math.sin(ang) * spreadR;
      midPos[i * 3 + 1] = startY + forward.y * t * fireDist + right.y * Math.cos(ang) * spreadR + realUp.y * Math.sin(ang) * spreadR;
      midPos[i * 3 + 2] = startZ + forward.z * t * fireDist + right.z * Math.cos(ang) * spreadR + realUp.z * Math.sin(ang) * spreadR;
      const spd = 7 + Math.random() * 4;
      midVel.push({
        x: forward.x * spd + Math.cos(ang) * spd * 0.18,
        y: forward.y * spd + Math.sin(ang) * spd * 0.18 + 0.5, // 火焰略上浮
        z: forward.z * spd + Math.cos(ang) * spd * 0.18,
      });
      midCol[i * 3] = 1;
      midCol[i * 3 + 1] = 0.55 - t * 0.2;
      midCol[i * 3 + 2] = 0.05;
    }
    midGeom.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
    midGeom.setAttribute('color', new THREE.BufferAttribute(midCol, 3));
    const midMat = new THREE.PointsMaterial({
      size: 0.3, vertexColors: true, transparent: true, opacity: 0.8,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const midPoints = new THREE.Points(midGeom, midMat);
    this.scene.add(midPoints);
    this.particles.push({ mesh: midPoints, velocities: midVel, life: 0, maxLife: 0.45, gravity: false, drag: 3 });

    // --- 第3层：余烬火花（亮色小粒子飞溅）---
    const emberCount = 10;
    const emberGeom = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberVel = [];
    const emberCol = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      const t = 0.3 + Math.random() * 0.7;
      emberPos[i * 3] = startX + forward.x * t * fireDist;
      emberPos[i * 3 + 1] = startY + forward.y * t * fireDist;
      emberPos[i * 3 + 2] = startZ + forward.z * t * fireDist;
      const ang = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 6;
      emberVel.push({
        x: Math.cos(ang) * spd,
        y: Math.random() * 4 + 1,
        z: Math.sin(ang) * spd,
      });
      emberCol[i * 3] = 1;
      emberCol[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      emberCol[i * 3 + 2] = 0.2;
    }
    emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    emberGeom.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));
    const emberMat = new THREE.PointsMaterial({
      size: 0.08, vertexColors: true, transparent: true, opacity: 1,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const emberPoints = new THREE.Points(emberGeom, emberMat);
    this.scene.add(emberPoints);
    this.particles.push({ mesh: emberPoints, velocities: emberVel, life: 0, maxLife: 0.6, gravity: true });

    // --- 命中点火焰溅射 ---
    if (impactDist > 0 && impactDist < range) {
      const impactX = startX + forward.x * fireDist;
      const impactY = startY + forward.y * fireDist;
      const impactZ = startZ + forward.z * fireDist;
      this._createFireSplash(impactX, impactY, impactZ, forward);
    }
  }

  // 命中点火焰溅射（向四周扩散的火焰粒子）
  _createFireSplash(x, y, z, forward) {
    const count = 16;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // 上半球
      const spd = 3 + Math.random() * 5;
      velocities.push({
        x: Math.sin(phi) * Math.cos(theta) * spd - forward.x * 2,
        y: Math.cos(phi) * spd + 1,
        z: Math.sin(phi) * Math.sin(theta) * spd - forward.z * 2,
      });
      const t = Math.random();
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.5 + t * 0.3;
      colors[i * 3 + 2] = t * 0.1;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.9,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.particles.push({ mesh: points, velocities, life: 0, maxLife: 0.5, gravity: true, drag: 2 });
  }

  // 地面残留火焰（持续燃烧，伤害路过的实体）
  createGroundFire(x, y, z, duration = 4) {
    const count = 8;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const offX = (Math.random() - 0.5) * 0.7;
      const offZ = (Math.random() - 0.5) * 0.7;
      positions[i * 3] = x + offX;
      positions[i * 3 + 1] = y + 0.1 + Math.random() * 0.2;
      positions[i * 3 + 2] = z + offZ;
      velocities.push({
        x: (Math.random() - 0.5) * 0.5,
        y: 1 + Math.random() * 2,
        z: (Math.random() - 0.5) * 0.5,
      });
      const t = Math.random();
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.4 + t * 0.3;
      colors[i * 3 + 2] = 0.05;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.25, vertexColors: true, transparent: true, opacity: 0.7,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    // 地面火使用 isGroundFire 标记，持续时间内循环粒子
    this.particles.push({
      mesh: points, velocities, life: 0, maxLife: duration,
      gravity: false, drag: 1, isGroundFire: true,
      fireCenter: { x, y, z },
    });
  }

  // ===== 雷霆链枪：闪电链（改进版 — 分支闪电 + 双层光晕）=====
  // 在多个目标之间画锯齿状闪电线，含分支叉
  createLightningChain(points) {
    if (!points || points.length < 2) return;

    // --- 第1层：外层光晕（粗、半透明蓝色）---
    const glowPositions = [];
    const glowColors = [];
    // --- 第2层：核心亮线（细、亮白蓝色）---
    const corePositions = [];
    const coreColors = [];

    for (let s = 0; s < points.length - 1; s++) {
      const p1 = points[s];
      const p2 = points[s + 1];
      const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const segments = Math.max(8, Math.floor(dist * 4));

      let prevX = p1.x, prevY = p1.y, prevZ = p1.z;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        let x = p1.x + dx * t;
        let y = p1.y + dy * t;
        let z = p1.z + dz * t;
        if (i < segments) {
          // 核心线：小抖动
          const coreJitter = 0.18;
          x += (Math.random() - 0.5) * coreJitter;
          y += (Math.random() - 0.5) * coreJitter;
          z += (Math.random() - 0.5) * coreJitter;
        }
        // 核心线
        corePositions.push(prevX, prevY, prevZ, x, y, z);
        const cb = 0.85 + Math.random() * 0.15;
        coreColors.push(0.7 * cb, 0.95 * cb, 1.0 * cb, 0.7 * cb, 0.95 * cb, 1.0 * cb);

        // 外层光晕：更大偏移
        const glowJitter = 0.45;
        let gx = x + (Math.random() - 0.5) * glowJitter;
        let gy = y + (Math.random() - 0.5) * glowJitter;
        let gz = z + (Math.random() - 0.5) * glowJitter;
        let gpx = prevX + (Math.random() - 0.5) * glowJitter;
        let gpy = prevY + (Math.random() - 0.5) * glowJitter;
        let gpz = prevZ + (Math.random() - 0.5) * glowJitter;
        glowPositions.push(gpx, gpy, gpz, gx, gy, gz);
        const gb = 0.4 + Math.random() * 0.3;
        glowColors.push(0.3 * gb, 0.7 * gb, 1.0 * gb, 0.3 * gb, 0.7 * gb, 1.0 * gb);

        // 随机生成分支叉（20%概率，从中间点向随机方向延伸短距离）
        if (i < segments && i > 1 && Math.random() < 0.2) {
          const branchLen = 0.3 + Math.random() * 0.8;
          const bang = Math.random() * Math.PI * 2;
          const bphi = (Math.random() - 0.5) * Math.PI;
          const bx = x + Math.cos(bang) * Math.cos(bphi) * branchLen;
          const by = y + Math.sin(bphi) * branchLen;
          const bz = z + Math.sin(bang) * Math.cos(bphi) * branchLen;
          corePositions.push(x, y, z, bx, by, bz);
          coreColors.push(0.6, 0.9, 1.0, 0.3, 0.5, 0.8);
          glowPositions.push(x, y, z, bx, by, bz);
          glowColors.push(0.2, 0.5, 0.8, 0.1, 0.3, 0.5);
        }

        prevX = x; prevY = y; prevZ = z;
      }
    }

    // 外层光晕线
    const glowGeom = new THREE.BufferGeometry();
    glowGeom.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
    glowGeom.setAttribute('color', new THREE.Float32BufferAttribute(glowColors, 3));
    const glowMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.4,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const glowLines = new THREE.LineSegments(glowGeom, glowMat);
    this.scene.add(glowLines);
    this.particles.push({ mesh: glowLines, velocities: [], life: 0, maxLife: 0.35, gravity: false, isLightning: true });

    // 核心亮线
    const coreGeom = new THREE.BufferGeometry();
    coreGeom.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
    coreGeom.setAttribute('color', new THREE.Float32BufferAttribute(coreColors, 3));
    const coreMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 1,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const coreLines = new THREE.LineSegments(coreGeom, coreMat);
    this.scene.add(coreLines);
    this.particles.push({ mesh: coreLines, velocities: [], life: 0, maxLife: 0.35, gravity: false, isLightning: true });

    // 在每个目标点生成火花粒子
    for (const pt of points) {
      this.createLightningSparks(pt.x, pt.y, pt.z);
    }
  }

  // 闪电火花
  createLightningSparks(x, y, z) {
    const count = 16;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 4 + Math.random() * 6;
      velocities.push({
        x: Math.sin(phi) * Math.cos(theta) * speed,
        y: Math.cos(phi) * speed,
        z: Math.sin(phi) * Math.sin(theta) * speed,
      });
      const t = Math.random();
      if (t < 0.5) { colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; }
      else { colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0; }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, transparent: true, opacity: 1,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.particles.push({ mesh: points, velocities, life: 0, maxLife: 0.6, gravity: true });
  }

  // 电力冲击波（命中点扩散的电磁环）
  createElectricShockwave(x, y, z, maxRadius = 4) {
    const segments = 32;
    const positions = new Float32Array((segments + 1) * 3);
    const colors = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      colors[i * 3] = 0.5;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 1.0;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.8,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.LineLoop(geom, mat);
    this.scene.add(ring);
    this.particles.push({
      mesh: ring, velocities: [], life: 0, maxLife: 0.5,
      gravity: false, isShockwave: true,
      center: { x, y, z }, maxRadius,
    });
  }

  // 残留电场（地面持续放电效果，眩晕附近的实体）
  createElectricField(x, y, z, duration = 3, radius = 3) {
    const count = 12;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      positions[i * 3] = x + Math.cos(ang) * r;
      positions[i * 3 + 1] = y + 0.05;
      positions[i * 3 + 2] = z + Math.sin(ang) * r;
      velocities.push({ angle: ang, radius: r, orbitSpeed: 3 + Math.random() * 4 });
      colors[i * 3] = 0.3 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 1.0;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.15, vertexColors: true, transparent: true, opacity: 0.7,
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.particles.push({
      mesh: points, velocities, life: 0, maxLife: duration,
      gravity: false, isElectricField: true,
      fieldCenter: { x, y, z }, fieldRadius: radius,
    });
  }

  // ===== 湮灭炮：引力漩涡 =====
  // 在目标位置创建持续3秒的紫色漩涡，吸引周围粒子
  createQuantumVortex(x, y, z, duration = 3, radius = 5) {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // 粒子从外围开始
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.6 + Math.random() * 0.4);
      positions[i * 3] = x + Math.cos(angle) * r;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * r;
      positions[i * 3 + 2] = z + Math.sin(angle) * r;
      velocities.push({
        x: 0, y: 0, z: 0,
        angle: angle,
        radius: r,
        orbitSpeed: 2 + Math.random() * 3,
        inwardSpeed: 0.5 + Math.random() * 1,
      });

      // 紫色到品红渐变
      const t = Math.random();
      if (t < 0.4) { colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 1.0; }
      else if (t < 0.7) { colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 1.0; }
      else { colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.1; colors[i * 3 + 2] = 0.8; }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: duration,
      gravity: false,
      isVortex: true,
      vortexCenter: { x, y, z },
      vortexRadius: radius,
    });

    // 中心紫色光球
    const coreGeom = new THREE.SphereGeometry(0.3, 8, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xcc44ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.set(x, y, z);
    this.scene.add(core);

    this.particles.push({
      mesh: core,
      velocities: [],
      life: 0,
      maxLife: duration,
      gravity: false,
      isVortexCore: true,
    });
  }

  // 湮灭炮最终爆炸（小型内爆）
  createImplosion(x, y, z, radius = 4) {
    const count = 30;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // 粒子从外向中心收缩
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = radius * (0.5 + Math.random() * 0.5);
      positions[i * 3] = x + Math.sin(phi) * Math.cos(angle) * r;
      positions[i * 3 + 1] = y + Math.cos(phi) * r;
      positions[i * 3 + 2] = z + Math.sin(phi) * Math.sin(angle) * r;
      // 向中心收缩
      const dx = x - positions[i * 3];
      const dy = y - positions[i * 3 + 1];
      const dz = z - positions[i * 3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      velocities.push({
        x: (dx / len) * 8,
        y: (dy / len) * 8,
        z: (dz / len) * 8,
      });
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.3 + Math.random() * 0.3;
      colors[i * 3 + 2] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: 0.5,
      gravity: false,
    });

    // 中心闪光
    this.createFlash(x, y, z, 3);
    this.screenShake = Math.max(this.screenShake || 0, 2);
  }

  // ===== 湮灭炮弹飞行轨迹（紫色拖尾）=====
  createQuantumTrail(x, y, z) {
    const count = 6;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      velocities.push({
        x: (Math.random() - 0.5) * 1,
        y: (Math.random() - 0.5) * 1,
        z: (Math.random() - 0.5) * 1,
      });
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.2 + Math.random() * 0.2;
      colors[i * 3 + 2] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.particles.push({
      mesh: points,
      velocities,
      life: 0,
      maxLife: 0.6,
      gravity: false,
    });
  }

  clear() {
    for (const p of this.particles) {
      if (p.mesh) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      if (p.light) this.scene.remove(p.light);
    }
    this.particles = [];
    for (const tnt of this.tntEntities) {
      this.scene.remove(tnt.mesh);
    }
    this.tntEntities = [];
  }
}
