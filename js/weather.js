/**
 * weather.js — 天气系统
 * 天气类型：晴朗 / 降雨 / 降雪 / 雷暴（带闪电）
 */

import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS, CHUNK_SIZE } from './blocks.js';

export const WEATHER = {
  CLEAR: 'clear',
  RAIN: 'rain',
  SNOW: 'snow',
  THUNDER: 'thunder',
};

export class WeatherSystem {
  constructor(scene, sky, game = null) {
    this.scene = scene;
    this.sky = sky;
    this.game = game;
    this.currentWeather = WEATHER.CLEAR;
    this.weatherTimer = 0;
    this.weatherDuration = 120; // 默认天气持续秒数
    this.autoWeather = true; // 自动天气循环
    this.autoTimer = 60; // 自动切换倒计时

    // 闪电
    this.lightning = null;
    this.lightningTimer = 0;
    this.lightningFlash = 0;

    // 降雪积雪
    this.snowAccumulationTimer = 0;
    this.snowAccumulationInterval = 8; // 每8秒积雪一次

    // 粒子系统
    this.rainParticles = null;
    this.snowParticles = null;

    this.initParticles();
    this.initLightning();
  }

  initParticles() {
    // 雨粒子
    const rainCount = 3000;
    const rainGeom = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      rainPositions[i * 3 + 1] = Math.random() * 40;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      rainVelocities[i] = 20 + Math.random() * 10;
    }
    rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaaaff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      fog: false,
      depthWrite: false,
    });
    this.rainParticles = new THREE.Points(rainGeom, rainMat);
    this.rainParticles.visible = false;
    this.rainParticles.userData.velocities = rainVelocities;
    this.scene.add(this.rainParticles);

    // 雪粒子
    const snowCount = 2000;
    const snowGeom = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount);
    const snowDrift = new Float32Array(snowCount * 2);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 60;
      snowPositions[i * 3 + 1] = Math.random() * 40;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      snowVelocities[i] = 2 + Math.random() * 3;
      snowDrift[i * 2] = Math.random() * Math.PI * 2;
      snowDrift[i * 2 + 1] = 0.5 + Math.random();
    }
    snowGeom.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
      fog: false,
      depthWrite: false,
    });
    this.snowParticles = new THREE.Points(snowGeom, snowMat);
    this.snowParticles.visible = false;
    this.snowParticles.userData.velocities = snowVelocities;
    this.snowParticles.userData.drift = snowDrift;
    this.scene.add(this.snowParticles);
  }

  initLightning() {
    // 闪电光源
    this.lightning = new THREE.PointLight(0xffffff, 0, 100);
    this.scene.add(this.lightning);
  }

  setWeather(type, duration = 120) {
    this.currentWeather = type;
    this.weatherTimer = 0;
    this.weatherDuration = duration;
    this.autoWeather = false; // 手动设置后暂停自动循环

    this.rainParticles.visible = (type === WEATHER.RAIN || type === WEATHER.THUNDER);
    this.snowParticles.visible = (type === WEATHER.SNOW);

    // 调整天空亮度
    if (type === WEATHER.CLEAR) {
      this.sky.sunLight.intensity = Math.max(0.5, this.sky.sunLight.intensity);
    } else {
      // 降雨/雷暴时天空变暗
      this.sky.sunLight.intensity *= 0.6;
    }
  }

  update(dt, playerPos) {
    // 自动天气循环
    if (this.autoWeather) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = 120 + Math.random() * 180;
        // 根据群系选择天气
        const r = Math.random();
        if (r < 0.5) {
          this.setWeather(WEATHER.CLEAR, this.autoTimer);
        } else if (r < 0.75) {
          this.setWeather(WEATHER.RAIN, 60 + Math.random() * 60);
        } else if (r < 0.9) {
          this.setWeather(WEATHER.SNOW, 60 + Math.random() * 60);
        } else {
          this.setWeather(WEATHER.THUNDER, 30 + Math.random() * 30);
        }
        this.autoWeather = true;
      }
    }

    // 天气持续时间
    this.weatherTimer += dt;
    if (this.weatherTimer >= this.weatherDuration && !this.autoWeather) {
      this.setWeather(WEATHER.CLEAR);
      this.autoWeather = true;
      this.autoTimer = 120 + Math.random() * 180;
      this.snowAccumulationTimer = 0;
    }

    // 降雪积雪逻辑
    if (this.currentWeather === WEATHER.SNOW) {
      this.snowAccumulationTimer += dt;
      if (this.snowAccumulationTimer >= this.snowAccumulationInterval) {
        this.snowAccumulationTimer = 0;
        this.accumulateSnow(playerPos);
      }
    }

    // 更新粒子位置
    if (this.rainParticles.visible) {
      this.updateRain(dt, playerPos);
    }
    if (this.snowParticles.visible) {
      this.updateSnow(dt, playerPos);
    }

    // 雷暴闪电
    if (this.currentWeather === WEATHER.THUNDER) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.triggerLightning(playerPos);
        this.lightningTimer = 3 + Math.random() * 7;
      }
    }

    // 闪电衰减
    if (this.lightningFlash > 0) {
      this.lightningFlash -= dt * 3;
      this.lightning.intensity = Math.max(0, this.lightningFlash * 5);
    }
  }

  updateRain(dt, playerPos) {
    const positions = this.rainParticles.geometry.attributes.position.array;
    const velocities = this.rainParticles.userData.velocities;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= velocities[i] * dt;
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3] = (Math.random() - 0.5) * 60 + playerPos.x;
        positions[i * 3 + 1] = 30 + Math.random() * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 60 + playerPos.z;
      }
    }
    this.rainParticles.geometry.attributes.position.needsUpdate = true;
    this.rainParticles.position.set(playerPos.x, 0, playerPos.z);
  }

  updateSnow(dt, playerPos) {
    const positions = this.snowParticles.geometry.attributes.position.array;
    const velocities = this.snowParticles.userData.velocities;
    const drift = this.snowParticles.userData.drift;
    const count = positions.length / 3;
    const t = Date.now() * 0.001;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= velocities[i] * dt;
      positions[i * 3] += Math.sin(t + drift[i * 2]) * drift[i * 2 + 1] * dt;
      positions[i * 3 + 2] += Math.cos(t + drift[i * 2]) * drift[i * 2 + 1] * dt;
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3] = (Math.random() - 0.5) * 60 + playerPos.x;
        positions[i * 3 + 1] = 30 + Math.random() * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 60 + playerPos.z;
      }
    }
    this.snowParticles.geometry.attributes.position.needsUpdate = true;
    this.snowParticles.position.set(playerPos.x, 0, playerPos.z);
  }

  // 降雪积雪 — 在玩家附近的固体方块上方放置雪方块
  accumulateSnow(playerPos) {
    if (!this.game || !this.game.world) return;
    const world = this.game.world;
    const px = Math.floor(playerPos.x);
    const pz = Math.floor(playerPos.z);
    const radius = 16;

    let placed = 0;
    for (let i = 0; i < 20 && placed < 6; i++) {
      const dx = Math.floor((Math.random() - 0.5) * radius * 2);
      const dz = Math.floor((Math.random() - 0.5) * radius * 2);
      const x = px + dx;
      const z = pz + dz;

      // 从上往下查找最高非空气方块
      for (let y = 62; y >= 1; y--) {
        const block = world.getBlock(x, y, z);
        if (block === 0) continue;

        const def = BLOCK_DEFS[block];
        if (!def) break;

        // 不在非固体、雷、冰、雪块上积雪
        if (!def.solid || block === BLOCK.SNOW || block === BLOCK.ICE ||
            block === BLOCK.PACKED_ICE || block === BLOCK.BLUE_ICE ||
            block === BLOCK.WATER || block === BLOCK.LAVA ||
            block === BLOCK.LEAVES || block === BLOCK.TALL_GRASS) break;

        // 检查上方是否为空气
        const above = world.getBlock(x, y + 1, z);
        if (above === 0) {
          world.setBlock(x, y + 1, z, BLOCK.SNOW);
          const cx = Math.floor(x / CHUNK_SIZE);
          const cz = Math.floor(z / CHUNK_SIZE);
          world.markChunkDirty(cx, cz);
          // 多人同步
          if (this.game.multiplayer) {
            this.game.multiplayer.sendBlockChange(x, y + 1, z, BLOCK.SNOW);
          }
          placed++;
        }
        break;
      }
    }
  }

  triggerLightning(playerPos) {
    // 随机闪电位置
    const offsetX = (Math.random() - 0.5) * 50;
    const offsetZ = (Math.random() - 0.5) * 50;
    this.lightning.position.set(
      playerPos.x + offsetX,
      playerPos.y + 20,
      playerPos.z + offsetZ
    );
    this.lightningFlash = 1;

    // 检查是否击中玩家附近
    const dist = Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
    if (dist < 5 && this.game) {
      this.game.player.takeDamage(5);
      this.game.ui.showToast('⚡ 被闪电击中！');
    }
  }

  getWeatherName() {
    const names = {
      clear: '☀️ 晴朗',
      rain: '🌧️ 降雨',
      snow: '❄️ 降雪',
      thunder: '⛈️ 雷暴',
    };
    return names[this.currentWeather] || '☀️ 晴朗';
  }
}
