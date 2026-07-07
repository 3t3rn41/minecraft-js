/**
 * multiplayer.js — 局域网多人联机（基于 PeerJS WebRTC）
 * 支持主机/客户端模式，同步玩家位置、方块变化、天气、时间、小游戏等
 */

import * as THREE from 'three';
import { BLOCK_DEFS } from './blocks.js';
import { GAMEMODE_NAMES } from './gamemodes.js';

export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.isHost = false;
    this.isConnected = false;
    this.peer = null;
    this.connections = new Map(); // peerId -> connection
    this.playerId = null;
    this.playerName = '玩家' + Math.floor(Math.random() * 1000);

    // 其他玩家的远程状态
    this.remotePlayers = new Map(); // peerId -> { mesh, position, rotation, ... }

    // 网络缓冲
    this.pendingBlockChanges = [];
    this.sendTimer = 0;
    this.sendInterval = 0.05; // 20次/秒

    // 时间同步
    this.timeSyncTimer = 0;
    this.timeSyncInterval = 5; // 每5秒同步一次时间
  }

  // 初始化 PeerJS（动态加载）
  async initPeerJS() {
    if (window.Peer) return window.Peer;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      script.onload = () => resolve(window.Peer);
      script.onerror = () => reject(new Error('无法加载 PeerJS'));
      document.head.appendChild(script);
    });
  }

  // 创建房间（主机）
  // 支持传入已有的 Peer 连接（两阶段流程：先创建房间获取ID，再进入游戏）
  async hostRoom(existingPeer = null, existingId = null, pendingConns = []) {
    try {
      // 使用已有的 Peer 连接
      if (existingPeer) {
        this.peer = existingPeer;
        this.playerId = existingId;
        this.isHost = true;
        this.isConnected = true;
        console.log('使用已有Peer连接，房间ID:', existingId);

        // 处理新的传入连接
        this.peer.on('connection', (conn) => {
          this.handleNewConnection(conn);
        });

        // 处理在主机进入游戏前已连接的客户端
        for (const item of pendingConns) {
          const conn = item.conn;
          const bufferedMessages = item.bufferedMessages || [];
          // 移除缓冲数据监听器
          conn.removeAllListeners('data');
          // 设置正式的数据处理
          this.handleNewConnection(conn);
          // 处理缓冲的消息
          for (const msg of bufferedMessages) {
            this.handleMessage(msg, conn);
          }
          console.log('处理待定连接:', conn.peer, `(${bufferedMessages.length}条缓冲消息)`);
        }

        return existingId;
      }

      // 标准流程：创建新的 Peer
      const Peer = await this.initPeerJS();
      this.peer = new Peer();
      this.isHost = true;

      return new Promise((resolve, reject) => {
        this.peer.on('open', (id) => {
          this.playerId = id;
          this.isConnected = true;
          console.log('主机房间ID:', id);
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.handleNewConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS 错误:', err);
          reject(err);
        });

        // 超时
        setTimeout(() => {
          if (!this.playerId) reject(new Error('连接超时'));
        }, 10000);
      });
    } catch (e) {
      console.error('创建房间失败:', e);
      throw e;
    }
  }

  // 使用已有连接加入房间（客户端两阶段流程）
  async joinRoomWithExistingConn(existingPeer, existingId, existingConn) {
    this.peer = existingPeer;
    this.playerId = existingId;
    this.isHost = false;

    // 设置正式的连接处理
    this.handleNewConnection(existingConn);

    this.isConnected = true;
    console.log('已连接到主机（使用已有连接）');

    // 发送加入消息
    existingConn.send({ type: 'player_join', name: this.playerName, id: this.playerId });
  }

  // 加入房间（客户端）
  async joinRoom(hostId) {
    try {
      const Peer = await this.initPeerJS();
      this.peer = new Peer();
      this.isHost = false;

      return new Promise((resolve, reject) => {
        this.peer.on('open', (id) => {
          this.playerId = id;
          const conn = this.peer.connect(hostId, { reliable: true });
          this.handleNewConnection(conn);

          conn.on('open', () => {
            this.isConnected = true;
            console.log('已连接到主机');
            // 发送加入消息
            conn.send({ type: 'player_join', name: this.playerName, id: this.playerId });
            resolve();
          });

          conn.on('error', (err) => reject(err));
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS 错误:', err);
          reject(err);
        });

        setTimeout(() => {
          if (!this.isConnected) reject(new Error('连接超时'));
        }, 10000);
      });
    } catch (e) {
      console.error('加入房间失败:', e);
      throw e;
    }
  }

  handleNewConnection(conn) {
    const onOpen = () => {
      this.connections.set(conn.peer, conn);
      console.log('新连接:', conn.peer);
      // 世界数据在 player_join 时发送，确保客户端已准备好接收
    };

    // 如果连接已打开，直接执行；否则等待 open 事件
    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (data) => {
      this.handleMessage(data, conn);
    });

    conn.on('close', () => {
      console.log('连接关闭:', conn.peer);
      this.connections.delete(conn.peer);
      this.removeRemotePlayer(conn.peer);
      this.game.ui.showToast(`${conn.peer.substring(0, 6)} 离开了游戏`);
    });

    conn.on('error', (err) => {
      console.error('连接错误:', err);
    });
  }

  handleMessage(data, conn) {
    switch (data.type) {
      case 'player_join':
        // 新玩家加入
        this.addRemotePlayer(conn.peer, data.name);
        this.game.ui.showToast(`${data.name} 加入了游戏`);

        if (this.isHost) {
          // 广播给其他玩家
          this.broadcast({ type: 'player_join', id: conn.peer, name: data.name }, conn.peer);
          // 通知新玩家已有玩家
          for (const [peerId, rp] of this.remotePlayers) {
            conn.send({ type: 'player_join', id: peerId, name: rp.name });
          }
          // 发送世界数据（种子+方块）和世界状态（时间+天气）
          this.sendWorldData(conn);
          this.sendWorldState(conn);
        }
        break;

      case 'player_state':
        this.updateRemotePlayer(data.id || conn.peer, data);
        // 主机转发给其他玩家
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'block_change':
        // 应用方块变化
        this.game.world.setBlock(data.x, data.y, data.z, data.blockId, false);
        this.game.world.markChunkDirty(
          Math.floor(data.x / 16), Math.floor(data.z / 16)
        );
        // 主机转发
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'explosion':
        // 远程爆炸 — 破坏方块 + 播放特效
        if (this.game.effects) {
          // 直接破坏方块（不触发递归同步）
          const radius = data.power;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dz = -radius; dz <= radius; dz++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > radius) continue;
                const bx = Math.floor(data.x + dx);
                const by = Math.floor(data.y + dy);
                const bz = Math.floor(data.z + dz);
                const block = this.game.world.getBlock(bx, by, bz);
                if (block === 0) continue;
                const def = BLOCK_DEFS[block];
                if (def && def.name === '基岩') continue;
                if (Math.random() > dist / radius * 0.5) {
                  this.game.world.setBlock(bx, by, bz, 0, false);
                }
              }
            }
          }
          this.game.world.markChunkDirty(Math.floor(data.x / 16), Math.floor(data.z / 16));
          // 播放特效
          this.game.effects.createExplosionParticles(data.x, data.y, data.z, data.power);
          this.game.effects.createFlash(data.x, data.y, data.z, data.power);
          this.game.effects.screenShake = data.power * 0.3;
        }
        break;

      case 'gamemode_change':
        // 远程玩家切换模式
        this.game.ui.showToast(`${data.name} 切换为: ${GAMEMODE_NAMES[data.gamemode] || data.gamemode}`);
        // 更新远程玩家显示
        const rp = this.remotePlayers.get(data.playerId);
        if (rp) {
          rp.gamemode = data.gamemode;
          this.updateRemotePlayerMesh(rp);
        }
        break;

      case 'weather_change':
        // 天气同步
        if (this.game.weather) {
          this.game.weather.setWeather(data.weather, data.duration);
          this.game.ui.showToast(`天气: ${this.game.weather.getWeatherName()}`);
        }
        break;

      case 'time_change':
        // 时间同步
        if (this.game.sky) {
          this.game.sky.setTime(data.time);
        }
        break;

      case 'mob_spawn':
        // 生物生成同步
        if (this.game.mobs) {
          this.game.mobs.spawnMob(data.x, data.y, data.z, data.mobType);
        }
        break;

      case 'minigame_start':
        // 小游戏开始
        if (this.game.minigames) {
          this.game.minigames.startMinigame(data.minigame, data.options || {});
        }
        break;

      case 'minigame_stop':
        // 小游戏结束
        if (this.game.minigames) {
          this.game.minigames.isActive = false;
          this.game.minigames.currentGame = 'none';
          this.game.ui.showToast(`小游戏结束！胜者: ${data.winner || '无人'}`);
        }
        break;

      case 'minigame_score':
        // 小游戏得分
        if (this.game.minigames) {
          this.game.minigames.scores.set(data.player, data.score);
        }
        break;

      case 'player_attack':
        // PvP 攻击
        if (data.targetId === this.playerId) {
          this.game.player.takeDamage(data.damage);
          if (this.game.effects) {
            this.game.effects.showDamageNumber(
              this.game.player.position.x,
              this.game.player.position.y + 1,
              this.game.player.position.z,
              data.damage
            );
          }
        }
        // 主机转发
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'chat':
        this.game.chat.addMessage(data.name, data.text);
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'world_data':
        // 客户端接收世界数据
        if (data.seed) {
          this.game.world.seed = data.seed;
          // 重新初始化噪声生成器
          this.game.world.noiseHeight = new this.game.world.noiseHeight.constructor(data.seed);
          this.game.world.noiseBiome = new this.game.world.noiseBiome.constructor(data.seed + 1000);
          this.game.world.noiseCave = new this.game.world.noiseCave.constructor(data.seed + 2000);
          this.game.world.noiseTree = new this.game.world.noiseTree.constructor(data.seed + 3000);
          this.game.world.noiseOre = new this.game.world.noiseOre.constructor(data.seed + 4000);
        }
        if (data.modifiedBlocks) {
          for (const [key, blockId] of data.modifiedBlocks) {
            this.game.world.modifiedBlocks.set(key, blockId);
          }
        }
        break;

      case 'world_state':
        // 客户端接收主机当前世界状态（天气、时间等）
        if (data.time !== undefined && this.game.sky) {
          this.game.sky.setTime(data.time);
        }
        if (data.weather && this.game.weather) {
          this.game.weather.setWeather(data.weather, data.weatherDuration || 120);
        }
        if (data.gamemode !== undefined) {
          // 主机指定的游戏模式
          this.game.setGamemode(data.gamemode);
        }
        if (data.difficulty !== undefined) {
          this.game.difficulty = data.difficulty;
        }
        break;

      case 'player_leave':
        this.removeRemotePlayer(data.id);
        break;

      case 'redstone_update':
        // 红石状态同步（拉杆/按钮）
        if (this.game.redstone) {
          const key = `${data.x},${data.y},${data.z}`;
          if (data.state !== undefined) {
            this.game.redstone.leverStates.set(key, data.state);
          }
          if (data.buttonTime !== undefined && data.buttonTime > 0) {
            this.game.redstone.buttonTimers.set(key, data.buttonTime);
          }
          this.game.redstone.markForUpdate(data.x, data.y, data.z);
        }
        break;

      case 'boss_spawn':
        // Boss 召唤同步
        if (this.game.mobs) {
          this.game.mobs.spawnMob(data.x, data.y, data.z, data.bossType);
        }
        break;

      case 'projectile':
        // 投射物同步
        if (this.game.ranged) {
          this.game.ranged.receiveProjectile(data.projType, data.pos, data.dir, data.options || {});
        }
        break;

      case 'player_damage':
        // 远程玩家受到伤害
        if (data.targetId === this.playerId) {
          this.game.player.takeDamage(data.damage);
          if (this.game.effects) {
            this.game.effects.showDamageNumber(
              this.game.player.position.x,
              this.game.player.position.y + 1,
              this.game.player.position.z,
              data.damage
            );
          }
        }
        // 主机转发
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'potion_effect':
        // 药水效果同步
        if (data.targetId === this.playerId || data.targetId === 'all') {
          if (!this.game.player.activeEffects) this.game.player.activeEffects = [];
          this.game.player.activeEffects.push({
            id: data.effectId,
            name: data.name,
            duration: data.duration,
            level: data.level,
            color: data.color,
          });
        }
        // 主机转发
        if (this.isHost && data.targetId !== this.playerId) {
          this.broadcast(data, conn.peer);
        }
        break;
    }
  }

  // 主机发送世界数据给新玩家
  sendWorldData(conn) {
    const data = {
      type: 'world_data',
      seed: this.game.world.seed,
      modifiedBlocks: Array.from(this.game.world.modifiedBlocks.entries()),
    };
    conn.send(data);
  }

  // 主机发送当前世界状态给新玩家（天气、时间等）
  sendWorldState(conn) {
    const data = {
      type: 'world_state',
      time: this.game.sky ? this.game.sky.time : 0.25,
      weather: this.game.weather ? this.game.weather.currentWeather : 'clear',
      weatherDuration: this.game.weather ? this.game.weather.weatherDuration : 120,
      gamemode: this.game.gamemode,
      difficulty: this.game.difficulty,
    };
    // 同步红石拉杆状态
    if (this.game.redstone && this.game.redstone.leverStates.size > 0) {
      data.redstoneLevers = Array.from(this.game.redstone.leverStates.entries());
    }
    conn.send(data);
  }

  // 广播消息给所有连接（主机转发时排除来源）
  broadcast(data, excludePeer = null) {
    for (const [peerId, conn] of this.connections) {
      if (peerId !== excludePeer) {
        try {
          conn.send(data);
        } catch (e) {
          console.error('发送失败:', e);
        }
      }
    }
  }

  // 发送数据给所有人
  sendToAll(data) {
    for (const conn of this.connections.values()) {
      try {
        conn.send(data);
      } catch (e) {}
    }
  }

  // 添加远程玩家
  addRemotePlayer(peerId, name) {
    if (this.remotePlayers.has(peerId)) return;

    const group = new THREE.Group();

    // 身体
    const bodyGeom = new THREE.BoxGeometry(0.5, 0.7, 0.25);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4444ff });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 1.0;
    group.add(body);

    // 头
    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc88 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.6;
    group.add(head);

    // 手臂
    const armGeom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x4444ff });
    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-0.35, 1.0, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(0.35, 1.0, 0);
    group.add(rightArm);

    // 腿
    const legGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a5a });
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.12, 0.35, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.position.set(0.12, 0.35, 0);
    group.add(rightLeg);

    // 名牌
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const nameCtx = nameCanvas.getContext('2d');
    nameCtx.fillStyle = 'rgba(0,0,0,0.5)';
    nameCtx.fillRect(0, 0, 256, 64);
    nameCtx.fillStyle = '#fff';
    nameCtx.font = 'bold 28px sans-serif';
    nameCtx.textAlign = 'center';
    nameCtx.fillText(name || 'Player', 128, 42);
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    const nameMat = new THREE.SpriteMaterial({ map: nameTexture, depthTest: false });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.position.y = 2.3;
    nameSprite.scale.set(1.5, 0.4, 1);
    group.add(nameSprite);

    this.game.scene.add(group);

    this.remotePlayers.set(peerId, {
      mesh: group,
      body: body,
      head: head,
      leftArm: leftArm,
      rightArm: rightArm,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      nameSprite: nameSprite,
      name: name || 'Player',
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      health: 20,
      gamemode: 0,
      sneaking: false,
      sprinting: false,
      lastUpdate: Date.now(),
    });
  }

  // 更新远程玩家外观（根据游戏模式/生命值）
  updateRemotePlayerMesh(rp) {
    if (!rp || !rp.body) return;
    // 旁观模式：半透明
    if (rp.gamemode === 3) {
      rp.body.material.transparent = true;
      rp.body.material.opacity = 0.3;
      rp.head.material.transparent = true;
      rp.head.material.opacity = 0.3;
    } else {
      rp.body.material.transparent = false;
      rp.body.material.opacity = 1;
      rp.head.material.transparent = false;
      rp.head.material.opacity = 1;
    }
    // 低生命值：身体变红
    if (rp.health < 10 && rp.gamemode !== 3) {
      const redness = 1 - rp.health / 20;
      rp.body.material.color.setRGB(0.3 + redness * 0.7, 0.3, 0.8 - redness * 0.8);
    } else {
      rp.body.material.color.setHex(0x4444ff);
    }
  }

  // 更新远程玩家
  updateRemotePlayer(peerId, data) {
    let rp = this.remotePlayers.get(peerId);

    // 如果是主机转发的其他玩家状态
    if (data.id && data.id !== peerId) {
      peerId = data.id;
      rp = this.remotePlayers.get(peerId);
      if (!rp) {
        this.addRemotePlayer(peerId, data.name || 'Player');
        rp = this.remotePlayers.get(peerId);
      }
    } else if (!rp) {
      this.addRemotePlayer(peerId, data.name || 'Player');
      rp = this.remotePlayers.get(peerId);
    }

    if (rp) {
      rp.position = data.position || rp.position;
      rp.yaw = data.yaw !== undefined ? data.yaw : rp.yaw;
      rp.pitch = data.pitch !== undefined ? data.pitch : rp.pitch;
      rp.health = data.health !== undefined ? data.health : rp.health;
      rp.gamemode = data.gamemode !== undefined ? data.gamemode : rp.gamemode;
      rp.sneaking = data.sneaking !== undefined ? data.sneaking : rp.sneaking;
      rp.sprinting = data.sprinting !== undefined ? data.sprinting : rp.sprinting;
      rp.lastUpdate = Date.now();

      // 更新外观
      this.updateRemotePlayerMesh(rp);
    }
  }

  // 移除远程玩家
  removeRemotePlayer(peerId) {
    const rp = this.remotePlayers.get(peerId);
    if (rp && rp.mesh) {
      this.game.scene.remove(rp.mesh);
    }
    this.remotePlayers.delete(peerId);
  }

  // 每帧更新
  update(dt) {
    if (!this.isConnected) return;

    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = this.sendInterval;

      // 发送自己的位置和状态
      const player = this.game.player;
      this.sendToAll({
        type: 'player_state',
        id: this.playerId,
        name: this.playerName,
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        yaw: player.yaw,
        pitch: player.pitch,
        health: player.health,
        gamemode: player.gamemode,
        sneaking: player.sneaking,
        sprinting: player.sprinting,
      });
    }

    // 主机定期同步时间
    if (this.isHost) {
      this.timeSyncTimer -= dt;
      if (this.timeSyncTimer <= 0) {
        this.timeSyncTimer = this.timeSyncInterval;
        if (this.game.sky) {
          this.sendToAll({
            type: 'time_change',
            time: this.game.sky.time,
          });
        }
      }
    }

    // 更新远程玩家网格位置和动画
    const now = Date.now();
    for (const [peerId, rp] of this.remotePlayers) {
      if (rp.mesh) {
        rp.mesh.position.lerp(new THREE.Vector3(rp.position.x, rp.position.y, rp.position.z), 0.2);
        rp.mesh.rotation.y = rp.yaw;

        // 潜行时身体降低
        if (rp.body) {
          const targetY = rp.sneaking ? 0.85 : 1.0;
          rp.body.position.y += (targetY - rp.body.position.y) * 0.1;
        }

        // 行走动画
        const isMoving = rp.sprinting || (now - rp.lastUpdate < 200);
        if (isMoving && rp.leftLeg && rp.rightLeg) {
          const t = now * (rp.sprinting ? 0.012 : 0.008);
          rp.leftLeg.rotation.x = Math.sin(t) * 0.4;
          rp.rightLeg.rotation.x = -Math.sin(t) * 0.4;
          if (rp.leftArm && rp.rightArm) {
            rp.leftArm.rotation.x = -Math.sin(t) * 0.3;
            rp.rightArm.rotation.x = Math.sin(t) * 0.3;
          }
        } else if (rp.leftLeg && rp.rightLeg) {
          rp.leftLeg.rotation.x *= 0.8;
          rp.rightLeg.rotation.x *= 0.8;
          if (rp.leftArm && rp.rightArm) {
            rp.leftArm.rotation.x *= 0.8;
            rp.rightArm.rotation.x *= 0.8;
          }
        }
      }

      // 超时移除
      if (now - rp.lastUpdate > 10000) {
        this.removeRemotePlayer(peerId);
      }
    }
  }

  // ===== 发送方法 =====

  // 发送方块变化
  sendBlockChange(x, y, z, blockId) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'block_change', x, y, z, blockId });
  }

  // 发送爆炸（含方块破坏）
  sendExplosion(x, y, z, power) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'explosion', x, y, z, power });
  }

  // 发送游戏模式切换
  sendGamemodeChange(gamemode) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'gamemode_change', name: this.playerName, playerId: this.playerId, gamemode });
  }

  // 发送天气变化
  sendWeatherChange(weather, duration) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'weather_change', weather, duration });
  }

  // 发送时间变化
  sendTimeChange(time) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'time_change', time });
  }

  // 发送生物生成
  sendMobSpawn(x, y, z, mobType) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'mob_spawn', x, y, z, mobType });
  }

  // 发送小游戏开始
  sendMinigameStart(minigame, options = {}) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'minigame_start', minigame, options });
  }

  // 发送小游戏结束
  sendMinigameStop(winner = null) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'minigame_stop', winner });
  }

  // 发送小游戏得分
  sendMinigameScore(player, score) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'minigame_score', player, score });
  }

  // 发送 PvP 攻击
  sendPlayerAttack(targetId, damage) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'player_attack', targetId, damage });
  }

  // 发送伤害数字（供其他玩家看到）
  sendDamageNumber(x, y, z, damage) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'player_damage', x, y, z, damage });
  }

  // 发送聊天消息
  sendChat(text) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'chat', name: this.playerName, text });
  }

  // 发送红石状态更新
  sendRedstoneUpdate(x, y, z, state, buttonTime = 0) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'redstone_update', x, y, z, state, buttonTime });
  }

  // 发送 Boss 召唤
  sendBossSpawn(bossType, x, y, z) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'boss_spawn', bossType, x, y, z });
  }

  // 发送投射物
  sendProjectile(projType, pos, dir, options = {}) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'projectile', projType, pos, dir, options });
  }

  // 发送玩家伤害（投射物命中）
  sendPlayerDamage(targetId, damage) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'player_damage', targetId, damage });
  }

  // 发送药水效果
  sendPotionEffect(targetId, effectId, name, duration, level, color) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'potion_effect', targetId, effectId, name, duration, level, color });
  }

  // 断开连接
  disconnect() {
    if (this.peer) {
      this.sendToAll({ type: 'player_leave', id: this.playerId });
      for (const conn of this.connections.values()) {
        conn.close();
      }
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.connections.clear();
    for (const rp of this.remotePlayers.values()) {
      if (rp.mesh) this.game.scene.remove(rp.mesh);
    }
    this.remotePlayers.clear();
  }
}
