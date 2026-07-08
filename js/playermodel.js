/**
 * playermodel.js — 可复用的玩家3D人形模型
 * 用于本地玩家第三人称视角和多人联机远程玩家渲染
 */

import * as THREE from 'three';
import { createItemModel } from './helditem.js';
import { BLOCK } from './blocks.js';

export class PlayerModel {
  /**
   * @param {string} name - 玩家名牌文本
   * @param {object} colors - 自定义颜色 { skin, shirt, pants }
   * @param {number} scale - 模型缩放比例 (默认 0.7)
   */
  constructor(name = 'Player', colors = {}, scale = 0.7) {
    this.group = new THREE.Group();
    this._scale = scale;
    this.group.scale.setScalar(scale);

    const skinColor = colors.skin ?? 0xffcc88;
    const shirtColor = colors.shirt ?? 0x4466cc;
    const pantsColor = colors.pants ?? 0x2a2a55;

    // --- 头部组（含眼睛） ---
    const headGroup = new THREE.Group();

    const headGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeom, headMat);
    headGroup.add(head);

    // 头发
    const hairGeom = new THREE.BoxGeometry(0.52, 0.15, 0.52);
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
    const hair = new THREE.Mesh(hairGeom, hairMat);
    hair.position.y = 0.2;
    headGroup.add(hair);

    // 眼睛
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const sx of [-0.12, 0.12]) {
      const eyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), eyeMat);
      eyeWhite.position.set(sx, 0.02, 0.26);
      headGroup.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.01), pupilMat);
      pupil.position.set(sx, 0.02, 0.27);
      headGroup.add(pupil);
    }

    // 头部位于身体顶部（y=1.5 是身体顶部）
    headGroup.position.y = 1.6875; // 1.45(身体顶) + 0.25(头半径) - 偏移
    this.group.add(headGroup);
    this.head = headGroup;

    // --- 身体 ---
    const bodyGeom = new THREE.BoxGeometry(0.5, 0.7, 0.28);
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 1.0;
    this.group.add(body);
    this.body = body;

    // --- 手臂（枢轴在肩膀） ---
    const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const handMat = new THREE.MeshLambertMaterial({ color: skinColor });

    // 左臂
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.375, 1.35, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), armMat);
    leftArmMesh.position.y = -0.3;
    leftArmPivot.add(leftArmMesh);
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), handMat);
    leftHand.position.y = -0.675;
    leftArmPivot.add(leftHand);
    this.group.add(leftArmPivot);
    this.leftArm = leftArmPivot;

    // 右臂
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.375, 1.35, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), armMat);
    rightArmMesh.position.y = -0.3;
    rightArmPivot.add(rightArmMesh);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), handMat);
    rightHand.position.y = -0.675;
    rightArmPivot.add(rightHand);
    this.group.add(rightArmPivot);
    this.rightArm = rightArmPivot;

    // --- 腿（枢轴在胯部） ---
    const legMat = new THREE.MeshLambertMaterial({ color: pantsColor });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // 左腿
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.13, 0.65, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), legMat);
    leftLegMesh.position.y = -0.3;
    leftLegPivot.add(leftLegMesh);
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), shoeMat);
    leftShoe.position.set(0, -0.65, 0.04);
    leftLegPivot.add(leftShoe);
    this.group.add(leftLegPivot);
    this.leftLeg = leftLegPivot;

    // 右腿
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.13, 0.65, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), legMat);
    rightLegMesh.position.y = -0.3;
    rightLegPivot.add(rightLegMesh);
    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), shoeMat);
    rightShoe.position.set(0, -0.65, 0.04);
    rightLegPivot.add(rightShoe);
    this.group.add(rightLegPivot);
    this.rightLeg = rightLegPivot;

    // --- 名牌 ---
    this.nameSprite = this._createNameSprite(name);
    this.nameSprite.position.y = 2.15 / this._scale; // 补偿缩放，使名牌在正确高度
    this.group.add(this.nameSprite);

    // 动画状态
    this._walkPhase = 0;
    this._armSwingPhase = 0;
    this._attackTimer = 0;

    // 手持物品（挂在右臂枢轴上）
    this._heldItem = null; // THREE.Group
    this._heldItemId = null;

    // 存储所有 mesh 用于透明度/颜色修改
    this._allMeshes = [];
    this.group.traverse(child => {
      if (child.isMesh) this._allMeshes.push(child);
    });
  }

  /**
   * 设置手持物品（第三人称展示在右手）
   * @param {number} itemId - 物品/方块 ID
   * @param {object} toolData - 玩家的 toolData
   * @param {THREE.Texture} atlasTexture - 方块纹理图集
   */
  setHeldItem(itemId, toolData, atlasTexture) {
    // 移除旧物品
    if (this._heldItem) {
      this.rightArm.remove(this._heldItem);
      this._heldItem.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this._heldItem = null;
    }
    this._heldItemId = itemId;

    if (!itemId) return;

    const model = createItemModel(itemId, toolData, atlasTexture);
    if (!model) return;

    // 第三人称持握位置和旋转
    this._applyThirdPersonHoldPose(model, itemId, toolData);
    this.rightArm.add(model);
    this._heldItem = model;
  }

  /**
   * 根据物品类型应用第三人称持握姿态
   * 右臂枢轴在肩膀，手在 y=-0.675
   */
  _applyThirdPersonHoldPose(model, itemId, toolData) {
    // 默认：在手前方
    model.position.set(0, -0.7, 0.05);
    model.rotation.set(0, 0, 0);

    let type = 'block';
    if (toolData && toolData[itemId]) {
      type = toolData[itemId].toolType || toolData[itemId].armorType || 'block';
    } else if (itemId === BLOCK.BOW || itemId === BLOCK.CROSSBOW) {
      type = 'bow';
    } else if (itemId === BLOCK.TRIDENT) {
      type = 'trident';
    } else if (itemId === BLOCK.FISHING_ROD) {
      type = 'rod';
    } else if (itemId === BLOCK.SNOWBALL || itemId === BLOCK.EGG_ITEM || itemId === BLOCK.ENDER_PEARL) {
      type = 'throwable';
    } else if (itemId === BLOCK.TORCH) {
      type = 'torch';
    } else if (itemId === BLOCK.PISTOL) {
      type = 'pistol';
    } else if (itemId === BLOCK.ROCKET_LAUNCHER) {
      type = 'rocket_launcher';
    } else if (itemId === BLOCK.BULLET_ITEM || itemId === BLOCK.ROCKET_AMMO) {
      type = 'throwable';
    }

    switch (type) {
      case 'sword':
        model.position.set(0, -0.72, 0.06);
        model.rotation.set(-0.3, 0, 0);
        break;
      case 'pickaxe':
      case 'axe':
      case 'hoe':
        model.position.set(0, -0.72, 0.06);
        model.rotation.set(-0.5, 0, 0.3);
        break;
      case 'shovel':
        model.position.set(0, -0.72, 0.06);
        model.rotation.set(-0.4, 0, 0);
        break;
      case 'bow':
        model.position.set(0, -0.68, 0.08);
        model.rotation.set(0, Math.PI / 2, 0);
        break;
      case 'trident':
        model.position.set(0, -0.75, 0.05);
        model.rotation.set(-0.6, 0, 0);
        break;
      case 'rod':
        model.position.set(0, -0.72, 0.06);
        model.rotation.set(-0.5, 0.2, 0);
        break;
      case 'throwable':
        model.position.set(0, -0.7, 0.08);
        model.rotation.set(0, 0, 0);
        break;
      case 'torch':
        model.position.set(0, -0.7, 0.05);
        model.rotation.set(0, 0, 0);
        break;
      case 'pistol':
        // 手枪：平举
        model.position.set(0, -0.72, 0.1);
        model.rotation.set(-1.4, 0, 0);
        break;
      case 'rocket_launcher':
        // 火箭筒：斜扛
        model.position.set(0, -0.72, 0.08);
        model.rotation.set(-1.45, 0, -0.2);
        break;
      default:
        // 方块：在手前方，略微倾斜
        model.position.set(0, -0.7, 0.08);
        model.rotation.set(-0.2, 0.4, 0.1);
        break;
    }
  }

  _createNameSprite(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name || 'Player', 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5 / this._scale, 0.375 / this._scale, 1);
    return sprite;
  }

  /**
   * 更新模型动画
   * @param {number} dt - 帧间隔
   * @param {object} state - { moving, sprinting, sneaking, attacking, yaw, pitch }
   */
  updateAnimation(dt, state = {}) {
    const { moving = false, sprinting = false, sneaking = false, attacking = false } = state;

    // 潜行 — 整体下蹲
    const targetBodyY = sneaking ? 0.85 : 1.0;
    this.body.position.y += (targetBodyY - this.body.position.y) * 0.15;
    const targetHeadY = sneaking ? 1.54 : 1.6875;
    this.head.position.y += (targetHeadY - this.head.position.y) * 0.15;

    // 行走 / 跑步动画
    if (moving) {
      const speed = sprinting ? 0.014 : 0.009;
      this._walkPhase += dt * 60 * speed * 10;
      const swing = Math.sin(this._walkPhase) * (sprinting ? 0.55 : 0.4);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
    } else {
      // 回到静止
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
    }

    // 攻击挥臂动画
    if (attacking) {
      this._attackTimer = 0.3;
    }
    if (this._attackTimer > 0) {
      this._attackTimer -= dt;
      const phase = 1 - (this._attackTimer / 0.3); // 0→1
      // 挥臂：抬起→劈下
      const swingAngle = Math.sin(phase * Math.PI) * (Math.PI * 0.6);
      this.rightArm.rotation.x = -swingAngle;
    }
  }

  /** 设置透明度（旁观模式等） */
  setOpacity(opacity) {
    for (const mesh of this._allMeshes) {
      mesh.material.transparent = opacity < 1;
      mesh.material.opacity = opacity;
    }
    this.nameSprite.material.opacity = opacity;
  }

  /** 设置低生命值红色闪烁 */
  setHurtFlash(intensity) {
    // intensity: 0~1
    const r = 0.3 + intensity * 0.7;
    const g = 0.3;
    const b = 0.8 - intensity * 0.8;
    this.body.material.color.setRGB(r, g, b);
  }

  /** 释放资源 */
  dispose() {
    // 先释放手持物品
    if (this._heldItem) {
      this._heldItem.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this._heldItem = null;
    }
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
