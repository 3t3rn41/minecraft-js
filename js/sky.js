/**
 * sky.js — 天空、太阳、月亮、昼夜循环、雾效和动态光照
 */

import * as THREE from 'three';

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0.25; // 0-1, 0=午夜, 0.25=日出, 0.5=正午, 0.75=日落
    this.dayLength = 600; // 一天的秒数 (10分钟)
    this.timeSpeed = 1;

    // 天空颜色关键帧
    this.skyColors = [
      { time: 0.00, color: new THREE.Color(0x0a0a20) },  // 午夜
      { time: 0.20, color: new THREE.Color(0x1a1a3a) },  // 黎明前
      { time: 0.25, color: new THREE.Color(0xff8c42) },  // 日出
      { time: 0.30, color: new THREE.Color(0x87ceeb) },  // 早晨
      { time: 0.50, color: new THREE.Color(0x87ceeb) },  // 正午
      { time: 0.70, color: new THREE.Color(0xffa500) },  // 傍晚
      { time: 0.75, color: new THREE.Color(0xff6347) },  // 日落
      { time: 0.80, color: new THREE.Color(0x1a1a3a) },  // 黄昏
      { time: 1.00, color: new THREE.Color(0x0a0a20) },  // 午夜
    ];

    this.fogColors = [
      { time: 0.00, color: new THREE.Color(0x0a0a20) },
      { time: 0.25, color: new THREE.Color(0xff8c42) },
      { time: 0.35, color: new THREE.Color(0x87ceeb) },
      { time: 0.65, color: new THREE.Color(0x87ceeb) },
      { time: 0.75, color: new THREE.Color(0xff6347) },
      { time: 0.85, color: new THREE.Color(0x1a1a3a) },
      { time: 1.00, color: new THREE.Color(0x0a0a20) },
    ];

    this.setupLights();
    this.setupSun();
    this.setupSkyDome();
    this.setupFog();
  }

  setupLights() {
    // 环境光
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // 太阳光（方向光）
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(50, 100, 50);
    this.scene.add(this.sunLight);
  }

  setupSun() {
    // 太阳
    const sunGeom = new THREE.PlaneGeometry(20, 20);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
      fog: false,
      depthWrite: false,
    });
    this.sun = new THREE.Mesh(sunGeom, sunMat);
    this.scene.add(this.sun);

    // 月亮
    const moonGeom = new THREE.PlaneGeometry(15, 15);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xddddff,
      transparent: true,
      opacity: 0.8,
      fog: false,
      depthWrite: false,
    });
    this.moon = new THREE.Mesh(moonGeom, moonMat);
    this.scene.add(this.moon);

    // 星星
    this.createStars();
  }

  createStars() {
    const starGeom = new THREE.BufferGeometry();
    const starPositions = [];
    const starColors = [];
    for (let i = 0; i < 500; i++) {
      // 随机分布在半球上
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const r = 300;
      const x = r * Math.cos(theta) * Math.sin(phi);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(theta) * Math.sin(phi);
      starPositions.push(x, y, z);
      const brightness = 0.5 + Math.random() * 0.5;
      starColors.push(brightness, brightness, brightness);
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starGeom.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, starMat);
    this.scene.add(this.stars);
  }

  setupSkyDome() {
    // 天空盒 — 大球体
    const skyGeom = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyDome);
  }

  setupFog() {
    this.fog = new THREE.Fog(0x87ceeb, 30, 80);
    this.scene.fog = this.fog;
  }

  // 颜色插值
  interpolateColor(keyframes, time) {
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
        const t = (time - keyframes[i].time) / (keyframes[i + 1].time - keyframes[i].time);
        return keyframes[i].color.clone().lerp(keyframes[i + 1].color, t);
      }
    }
    return keyframes[0].color.clone();
  }

  update(dt, playerPos) {
    this.time += (dt / this.dayLength) * this.timeSpeed;
    if (this.time >= 1) this.time -= 1;

    // 计算太阳角度
    const sunAngle = (this.time - 0.25) * Math.PI * 2; // 0.25 = 日出 = 0度
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const sunRadius = 200;

    // 更新太阳位置
    this.sun.position.set(
      playerPos.x + sunX * sunRadius,
      playerPos.y + sunHeight * sunRadius,
      playerPos.z + sunRadius * 0.3
    );
    this.sun.lookAt(playerPos.x, playerPos.y, playerPos.z);

    // 月亮在太阳对面
    this.moon.position.set(
      playerPos.x - sunX * sunRadius,
      playerPos.y - sunHeight * sunRadius,
      playerPos.z - sunRadius * 0.3
    );
    this.moon.lookAt(playerPos.x, playerPos.y, playerPos.z);

    // 太阳颜色
    if (sunHeight > 0) {
      this.sun.material.color.setHex(0xffffaa);
      this.sun.material.opacity = 0.9;
    } else {
      this.sun.material.opacity = 0;
    }

    if (sunHeight < 0) {
      this.moon.material.opacity = 0.8;
    } else {
      this.moon.material.opacity = 0;
    }

    // 太阳光方向和强度
    this.sunLight.position.set(
      playerPos.x + sunX * 100,
      playerPos.y + sunHeight * 100,
      playerPos.z + 30
    );
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    // 光照强度随时间变化
    const dayFactor = Math.max(0, Math.min(1, sunHeight * 2 + 0.3));
    this.sunLight.intensity = dayFactor * 0.8;
    this.ambientLight.intensity = 0.2 + dayFactor * 0.3;

    // 天空颜色
    const skyColor = this.interpolateColor(this.skyColors, this.time);
    this.skyDome.material.color.copy(skyColor);

    // 雾颜色
    const fogColor = this.interpolateColor(this.fogColors, this.time);
    this.fog.color.copy(fogColor);

    // 星星可见度（夜晚显示）
    const starOpacity = sunHeight < 0 ? Math.min(1, -sunHeight * 3) : 0;
    this.stars.material.opacity = starOpacity;
    this.stars.position.copy(playerPos);

    // 天空盒跟随玩家
    this.skyDome.position.copy(playerPos);
  }

  // 设置雾距离
  setFogDistance(near, far) {
    this.fog.near = near;
    this.fog.far = far;
  }

  // 设置雾启用/禁用
  setFogEnabled(enabled) {
    this.scene.fog = enabled ? this.fog : null;
  }

  // 获取当前时间字符串
  getTimeString() {
    const totalMinutes = this.time * 24 * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // 判断是否为白天
  isDaytime() {
    return this.time > 0.23 && this.time < 0.77;
  }

  // 设置时间
  setTime(time) {
    this.time = time;
  }
}
