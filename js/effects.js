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
    console.log('[Effects] createExplosion called at', x, y, z, 'power:', power, 'world:', !!this.game.world, 'scene:', !!this.scene);

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
    } catch (e) {
      console.error('[Effects] Block destruction error:', e);
    }

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
    } catch (e) {
      console.error('[Effects] Mob damage error:', e);
    }

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
    } catch (e) {
      console.error('[Effects] Player damage error:', e);
    }

    // 3. 爆炸粒子
    try {
      this.createExplosionParticles(x, y, z, power);
    } catch (e) {
      console.error('[Effects] Explosion particles error:', e);
    }

    // 4. 闪光
    try {
      this.createFlash(x, y, z, power);
    } catch (e) {
      console.error('[Effects] Flash error:', e);
    }

    // 5. 屏幕震动
    this.screenShake = power * 0.3;

    // 6. 声效模拟（toast）
    try {
      if (this.game.ui && this.game.ui.showToast) {
        this.game.ui.showToast('💥 BOOM!');
      }
    } catch (e) {
      console.error('[Effects] Toast error:', e);
    }

    // 多人同步
    try {
      if (this.game.multiplayer) {
        this.game.multiplayer.sendExplosion(x, y, z, power);
      }
    } catch (e) {
      console.error('[Effects] Multiplayer sync error:', e);
    }

    console.log('[Effects] createExplosion completed');
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

      const positions = p.mesh.geometry.attributes.position.array;
      const velocities = p.velocities;
      const count = positions.length / 3;

      for (let j = 0; j < count; j++) {
        if (p.gravity) {
          velocities[j].y -= 10 * dt;
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
