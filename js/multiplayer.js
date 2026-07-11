/**
 * multiplayer.js — 局域网多人联机（基于 PeerJS WebRTC）
 * 支持主机/客户端模式，同步玩家位置、方块变化、天气、时间、小游戏等
 */

import * as THREE from 'three';
import { BLOCK_DEFS } from './blocks.js';
import { GAMEMODE, GAMEMODE_NAMES } from './gamemodes.js';
import { PlayerModel } from './playermodel.js';
import { AdventureMode } from './adventure.js';

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

    // 冒险模式状态同步
    this.advStateSyncTimer = 0;
    this.advStateSyncInterval = 0.05; // 20次/秒

    // 防爆发校验：记录每个玩家上次击杀时间
    this._advLastKillT = {};
  }

  // 初始化 PeerJS（动态加载）
  async initPeerJS() {
    if (window.Peer) return window.Peer;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'lib/peerjs.min.js';
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
      // 通知房间发现服务更新人数
      if (this.isHost && this.game.roomDiscovery) {
        this.game.roomDiscovery.notifyPlayerJoined(this.connections.size + 1);
      }
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
      // 通知房间发现服务更新人数
      if (this.isHost && this.game.roomDiscovery) {
        this.game.roomDiscovery.notifyPlayerJoined(this.connections.size + 1);
      }
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
        // 主机切换模式时，客户端同步切换自身模式（skipSync 避免重复广播）
        if (data.hostSync && !this.isHost) {
          this.game.setGamemode(data.gamemode, true);
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

      case 'player_attack': {
        // PvP 攻击
        // 触发攻击者的挥臂动画
        const attacker = this.remotePlayers.get(data.attackerId || conn.peer);
        if (attacker) {
          attacker.attackAnimTimer = 0.3;
        }
        if (data.targetId === this.playerId) {
          // 受到 PvP 攻击
          this.game.player.takeDamage(data.damage, 'pvp');
          // 击退效果
          if (data.knockback) {
            const kb = data.knockback;
            this.game.player.velocity.x += kb.x;
            this.game.player.velocity.y += kb.y;
            this.game.player.velocity.z += kb.z;
          }
          // 伤害闪屏
          const overlay = document.getElementById('damage-overlay');
          if (overlay) {
            overlay.classList.add('flash');
            setTimeout(() => overlay.classList.remove('flash'), 200);
          }
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
      }

      case 'chat':
        this.game.chat.addMessage(data.name, data.text);
        if (this.isHost) {
          this.broadcast(data, conn.peer);
        }
        break;

      case 'world_data':
        // 客户端接收世界数据
        if (data.seed) {
          // 清除用错误种子生成的所有区块
          this.game.world.clearAllChunks(this.game.scene);
          // 设置正确的种子
          this.game.world.seed = data.seed;
          this.game.seed = data.seed;
          // 重新初始化噪声生成器
          this.game.world.noiseHeight = new this.game.world.noiseHeight.constructor(data.seed);
          this.game.world.noiseBiome = new this.game.world.noiseBiome.constructor(data.seed + 1000);
          this.game.world.noiseCave = new this.game.world.noiseCave.constructor(data.seed + 2000);
          this.game.world.noiseTree = new this.game.world.noiseTree.constructor(data.seed + 3000);
          this.game.world.noiseOre = new this.game.world.noiseOre.constructor(data.seed + 4000);
        }
        if (data.modifiedBlocks) {
          this.game.world.modifiedBlocks.clear();
          for (const [key, blockId] of data.modifiedBlocks) {
            this.game.world.modifiedBlocks.set(key, blockId);
          }
        }
        // 设置出生点（与主机一致）
        if (data.spawnPoint) {
          this.game.spawnPoint = { ...data.spawnPoint };
          this.game.player.position = { ...data.spawnPoint };
        }
        // 如果客户端跳过了 preloadChunks，现在用正确的种子生成区块
        if (this.game._waitingForWorldData) {
          this.game._waitingForWorldData = false;
          this.game.preloadChunks().then(() => {
            console.log('客户端世界数据同步完成，区块已生成');
          });
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
          // 主机指定的游戏模式（skipSync 避免重复广播）
          // 冒险模式需要特殊处理：初始化 AdventureMode
          if (data.gamemode === GAMEMODE.ADVENTURE && !this.game.adventure) {
            this.game._adventureMapIndex = data.adventureMapIndex || 0;
            this.game.adventure = new AdventureMode(this.game);
            this.game.adventure.init(false);
            // 设置游戏模式（初始化 AdventureMode 后再设置，确保 player 配置正确）
            this.game.setGamemode(GAMEMODE.ADVENTURE, true);
            console.log('[ADV-NET] 客户端初始化冒险模式, 地图索引:', this.game._adventureMapIndex);
          } else {
            this.game.setGamemode(data.gamemode, true);
          }
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
        // 远程玩家受到伤害（投射物命中）
        if (data.targetId === this.playerId) {
          this.game.player.takeDamage(data.damage, 'pvp');
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

      // ===== 冒险模式协议 (10条 adv_) =====

      case 'adv_state':
        // host→所有：权威状态快照
        if (this.game.adventure) {
          this.game.adventure.applyHostState(data);
        }
        break;

      case 'adv_spawn':
        // host→所有：怪物生成同步
        if (this.game.adventure && !this.isHost) {
          this.game.mobs.spawnMob(data.x, data.y, data.z, data.mobType);
          // 应用血量缩放（如果提供）
          if (data.hpScale) {
            const lastMob = this.game.mobs.mobs[this.game.mobs.mobs.length - 1];
            if (lastMob) {
              lastMob.maxHealth = Math.ceil(lastMob.maxHealth * data.hpScale);
              lastMob.health = lastMob.maxHealth;
            }
          }
        }
        break;

      case 'adv_kill':
        // 任意→host：击杀上报（host校验防爆发）
        if (this.isHost && this.game.adventure) {
          const now = performance.now() / 1000;
          const pid = data.playerId || conn.peer;
          // 防爆发校验：同一玩家50ms内多次击杀忽略
          if (this._advLastKillT[pid] && now - this._advLastKillT[pid] < 0.05) {
            console.warn(`[ADV-NET] kill burst from ${pid}, ignored`);
            break;
          }
          this._advLastKillT[pid] = now;
          // 校验怪物是否存在
          if (data.mobId !== undefined) {
            const mob = this.game.mobs.mobs.find(m => m.id === data.mobId && !m.dead);
            if (!mob) break; // 怪物不存在，忽略
          }
          // host 处理击杀
          this.game.adventure.onClientKill(pid, data);
        }
        break;

      case 'adv_pickup':
        // 任意→host：拾取金币上报
        if (this.isHost && this.game.adventure) {
          const pid = data.playerId || conn.peer;
          this.game.adventure.onClientPickup(pid, data.amount, data.reason || 'pickup');
        }
        break;

      case 'adv_buy':
        // 任意→host：购买请求
        if (this.isHost && this.game.adventure) {
          const pid = data.playerId || conn.peer;
          const success = this.game.adventure.econ.buyItem(pid, data.itemId);
          // 返回购买结果给请求者（包含主机抽取的英雄武器ID）
          conn.send({
            type: 'adv_buy_result',
            playerId: pid,
            itemId: data.itemId,
            success: success,
            gold: this.game.adventure.econ.getGold(pid),
            heroWeaponId: success ? this.game.adventure.econ._lastHeroWeaponId : null,
            heroAllOwned: !success && data.itemId === 'hero',
          });
        }
        break;

      case 'adv_buy_result':
        // host→某：购买结果
        if (this.game.adventure && !this.isHost) {
          this.game.adventure.handleBuyResult(data);
        }
        break;

      case 'adv_death':
        // 任意→host：死亡通知（host判断团灭）
        if (this.isHost && this.game.adventure) {
          const pid = data.playerId || conn.peer;
          this.game.adventure.onClientDeath(pid);
        }
        break;

      case 'adv_event':
        // host→所有：随机事件触发
        if (this.game.adventure && !this.isHost) {
          this.game.adventure.handleEvent(data.eventName, data.payload || {});
        }
        break;

      case 'adv_grade':
        // host→所有：结算数据
        if (this.game.adventure) {
          this.game.adventure.handleGradeData(data);
        }
        break;

      case 'adv_revive':
        // 双向：复活通知
        if (this.game.adventure) {
          if (this.isHost) {
            // host 收到复活请求/通知
            this.game.adventure.onClientRevive(data.reviverId || conn.peer, data.targetId);
            // 转发给其他玩家
            this.broadcast(data, conn.peer);
          } else {
            // 客户端收到复活通知
            this.game.adventure.handleRevive(data);
          }
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
      spawnPoint: { ...this.game.spawnPoint },
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
    // 冒险模式：同步地图索引
    if (this.game.gamemode === GAMEMODE.ADVENTURE && this.game._adventureMapIndex !== undefined) {
      data.adventureMapIndex = this.game._adventureMapIndex;
    }
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

    const model = new PlayerModel(name || 'Player');
    this.game.scene.add(model.group);

    this.remotePlayers.set(peerId, {
      model: model,
      mesh: model.group,        // 兼容旧代码
      body: model.body,         // 兼容旧代码
      head: model.head,
      leftArm: model.leftArm,
      rightArm: model.rightArm,
      leftLeg: model.leftLeg,
      rightLeg: model.rightLeg,
      nameSprite: model.nameSprite,
      name: name || 'Player',
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      bodyYaw: 0,              // 身体朝向（延迟跟随头部）
      pitch: 0,
      health: 20,
      maxHealth: 20,
      gamemode: 0,
      sneaking: false,
      sprinting: false,
      attackAnimTimer: 0,
      heldItemId: null,         // 手持物品ID
      toolData: {},             // 远程玩家的工具属性
      lastUpdate: Date.now(),
    });
  }

  // 更新远程玩家外观（根据游戏模式/生命值）
  updateRemotePlayerMesh(rp) {
    if (!rp || !rp.model) return;
    // 旁观模式：半透明
    if (rp.gamemode === 3) {
      rp.model.setOpacity(0.3);
    } else {
      rp.model.setOpacity(1);
    }
    // 低生命值：身体变红
    if (rp.health < 10 && rp.gamemode !== 3) {
      const redness = 1 - rp.health / 20;
      rp.model.setHurtFlash(redness);
    } else {
      rp.model.setHurtFlash(0);
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
      rp.velocityX = data.velocityX !== undefined ? data.velocityX : (rp.velocityX || 0);
      rp.velocityZ = data.velocityZ !== undefined ? data.velocityZ : (rp.velocityZ || 0);
      rp.yaw = data.yaw !== undefined ? data.yaw : rp.yaw;
      rp.pitch = data.pitch !== undefined ? data.pitch : rp.pitch;
      rp.health = data.health !== undefined ? data.health : rp.health;
      rp.maxHealth = data.maxHealth !== undefined ? data.maxHealth : (rp.maxHealth || 20);
      rp.gamemode = data.gamemode !== undefined ? data.gamemode : rp.gamemode;
      rp.sneaking = data.sneaking !== undefined ? data.sneaking : rp.sneaking;
      rp.sprinting = data.sprinting !== undefined ? data.sprinting : rp.sprinting;
      rp.lastUpdate = Date.now();

      // 同步手持物品
      const newHeldItemId = data.heldItemId !== undefined ? data.heldItemId : null;
      if (newHeldItemId !== rp.heldItemId) {
        rp.heldItemId = newHeldItemId;
        // 构建远程玩家的 toolData
        if (!rp.toolData) rp.toolData = {};
        if (newHeldItemId && data.heldToolType) {
          // 为远程工具/护甲创建 toolData 条目
          if (!rp.toolData[newHeldItemId]) {
            const isArmor = ['helmet', 'chestplate', 'leggings', 'boots'].includes(data.heldToolType);
            rp.toolData[newHeldItemId] = isArmor
              ? { armorType: data.heldToolType, material: data.heldMaterial }
              : { toolType: data.heldToolType, material: data.heldMaterial };
          }
        }
        // 更新远程玩家模型的手持物品
        if (rp.model) {
          const atlasTexture = this.game.blockMaterial ? this.game.blockMaterial.map : null;
          rp.model.setHeldItem(newHeldItemId, rp.toolData, atlasTexture);
        }
      }

      // 更新外观
      this.updateRemotePlayerMesh(rp);
    }
  }

  // 移除远程玩家
  removeRemotePlayer(peerId) {
    const rp = this.remotePlayers.get(peerId);
    if (rp && rp.mesh) {
      this.game.scene.remove(rp.mesh);
      if (rp.model) rp.model.dispose();
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
      // 同步手持物品信息
      const heldItem = player.getSelectedItem();
      const heldItemId = heldItem ? heldItem.id : null;
      const heldToolData = (heldItemId && player.toolData && player.toolData[heldItemId])
        ? player.toolData[heldItemId] : null;

      this.sendToAll({
        type: 'player_state',
        id: this.playerId,
        name: this.playerName,
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        velocityX: player.velocity.x,
        velocityZ: player.velocity.z,
        yaw: player.yaw,
        pitch: player.pitch,
        health: player.health,
        maxHealth: player.maxHealth,
        gamemode: player.gamemode,
        sneaking: player.sneaking,
        sprinting: player.sprinting,
        heldItemId: heldItemId,
        heldToolType: heldToolData ? (heldToolData.toolType || heldToolData.armorType) : null,
        heldMaterial: heldToolData ? heldToolData.material : null,
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

    // 主机定期同步冒险模式状态（20次/秒）
    if (this.isHost && this.game.adventure && this.game.adventure.active) {
      this.advStateSyncTimer -= dt;
      if (this.advStateSyncTimer <= 0) {
        this.advStateSyncTimer = this.advStateSyncInterval;
        this.sendAdvState();
      }
    }

    // 更新远程玩家网格位置和动画
    const now = Date.now();
    for (const [peerId, rp] of this.remotePlayers) {
      if (rp.mesh) {
        rp.mesh.position.lerp(new THREE.Vector3(rp.position.x, rp.position.y, rp.position.z), 0.2);

        // === 头部/身体分离扭动逻辑 ===
        const maxHeadYaw = Math.PI / 3; // 60°
        const isMoving = rp.sprinting || (now - rp.lastUpdate < 200 &&
          (Math.abs(rp.velocityX || 0) > 0.1 || Math.abs(rp.velocityZ || 0) > 0.1));

        if (isMoving) {
          // 行走时身体立刻对齐视线方向
          rp.bodyYaw = rp.yaw;
        } else {
          // 静止时：正常范围内仅头部转，超出范围后身体平滑跟随
          let yawDiff = rp.yaw - rp.bodyYaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

          if (Math.abs(yawDiff) > maxHeadYaw) {
            const targetBodyYaw = rp.yaw - Math.sign(yawDiff) * maxHeadYaw;
            let bodyDiff = targetBodyYaw - rp.bodyYaw;
            while (bodyDiff > Math.PI) bodyDiff -= Math.PI * 2;
            while (bodyDiff < -Math.PI) bodyDiff += Math.PI * 2;
            rp.bodyYaw += bodyDiff * 0.12;
          }
          while (rp.bodyYaw > Math.PI) rp.bodyYaw -= Math.PI * 2;
          while (rp.bodyYaw < -Math.PI) rp.bodyYaw += Math.PI * 2;
        }

        // 模型正面(+Z)与视线(-Z)相差180°
        rp.mesh.rotation.y = rp.bodyYaw + Math.PI;

        // 头部 Y轴 = 视线与身体差值，X轴 = 俯仰角
        let headYawRel = rp.yaw - rp.bodyYaw;
        while (headYawRel > Math.PI) headYawRel -= Math.PI * 2;
        while (headYawRel < -Math.PI) headYawRel += Math.PI * 2;
        if (rp.model && rp.model.head) {
          rp.model.head.rotation.y = headYawRel;
          rp.model.head.rotation.x = -(rp.pitch || 0);
        }

        // 攻击动画计时器
        if (rp.attackAnimTimer > 0) {
          rp.attackAnimTimer -= dt;
        }

        // 使用新的动画系统
        if (rp.model) {
          const isMoving = rp.sprinting || (now - rp.lastUpdate < 200 &&
            (Math.abs(rp.velocityX || 0) > 0.1 || Math.abs(rp.velocityZ || 0) > 0.1));
          rp.model.updateAnimation(dt, {
            moving: isMoving,
            sprinting: rp.sprinting,
            sneaking: rp.sneaking,
            attacking: rp.attackAnimTimer > 0,
          });
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

  // 发送游戏模式切换（主机切换时带 hostSync 标记，客户端同步跟随）
  sendGamemodeChange(gamemode) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'gamemode_change', name: this.playerName, playerId: this.playerId, gamemode, hostSync: this.isHost });
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
  sendPlayerAttack(targetId, damage, attackerPos, targetPos) {
    if (!this.isConnected) return;
    // 计算击退方向
    let knockback = null;
    if (attackerPos && targetPos) {
      const dx = targetPos.x - attackerPos.x;
      const dz = targetPos.z - attackerPos.z;
      const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
      knockback = {
        x: (dx / len) * 4,
        y: 3,
        z: (dz / len) * 4,
      };
    }
    this.sendToAll({
      type: 'player_attack',
      attackerId: this.playerId,
      targetId,
      damage,
      knockback,
    });
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

  // ===== 冒险模式发送方法 (10条 adv_) =====

  // host→所有：权威状态快照
  sendAdvState() {
    if (!this.isConnected || !this.game.adventure) return;
    const state = this.game.adventure.serializeState();
    this.sendToAll({ type: 'adv_state', ...state });
  }

  // host→所有：怪物生成同步
  sendAdvSpawn(mobType, x, y, z, hpScale = 1.0) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'adv_spawn', mobType, x, y, z, hpScale });
  }

  // 任意→host：击杀上报
  sendAdvKill(mobId, mobType, flags = {}) {
    if (!this.isConnected) return;
    if (this.isHost) return; // host 自己处理，不需要发送
    // 发送给 host（客户端只有一条到 host 的连接）
    for (const conn of this.connections.values()) {
      conn.send({ type: 'adv_kill', playerId: this.playerId, mobId, mobType, flags });
      break;
    }
  }

  // 任意→host：拾取金币上报
  sendAdvPickup(amount, reason = 'pickup') {
    if (!this.isConnected) return;
    if (this.isHost) return; // host 自己处理
    for (const conn of this.connections.values()) {
      conn.send({ type: 'adv_pickup', playerId: this.playerId, amount, reason });
      break;
    }
  }

  // 任意→host：购买请求
  sendAdvBuy(itemId) {
    if (!this.isConnected) return;
    if (this.isHost) return; // host 自己处理
    for (const conn of this.connections.values()) {
      conn.send({ type: 'adv_buy', playerId: this.playerId, itemId });
      break;
    }
  }

  // 任意→host：死亡通知
  sendAdvDeath() {
    if (!this.isConnected) return;
    if (this.isHost) return; // host 自己处理
    for (const conn of this.connections.values()) {
      conn.send({ type: 'adv_death', playerId: this.playerId });
      break;
    }
  }

  // host→所有：随机事件触发
  sendAdvEvent(eventName, payload = {}) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'adv_event', eventName, payload });
  }

  // host→所有：结算数据
  sendAdvGrade(gradeData) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'adv_grade', ...gradeData });
  }

  // 双向：复活通知
  sendAdvRevive(targetId) {
    if (!this.isConnected) return;
    this.sendToAll({ type: 'adv_revive', reviverId: this.playerId, targetId });
  }

  // 尝试攻击附近的远程玩家（PvP）
  tryAttackRemotePlayers(player, reach = 2.5, damage = 1) {
    if (!this.isConnected) return false;
    const eyePos = player.getEyePosition();
    const dir = player.getLookDirection();
    // 扩大检测范围，使 PvP 更容易命中
    const pvpReach = Math.max(reach, 3.5);

    for (const [peerId, rp] of this.remotePlayers) {
      // 旁观/创造模式不可被攻击
      if (rp.gamemode === 3 || rp.gamemode === 1) continue;

      const dx = rp.position.x - eyePos.x;
      const dy = (rp.position.y + 0.9) - eyePos.y; // 身体中心
      const dz = rp.position.z - eyePos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < pvpReach) {
        // 检查是否在视线方向上（放宽角度要求）
        const len = Math.max(0.001, dist);
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / len;
        if (dot > 0.3) {
          // 命中！发送攻击消息（含击退方向）
          const kdx = rp.position.x - player.position.x;
          const kdz = rp.position.z - player.position.z;
          const klen = Math.max(0.001, Math.sqrt(kdx * kdx + kdz * kdz));
          const knockback = {
            x: (kdx / klen) * 4,
            y: 3,
            z: (kdz / klen) * 4,
          };
          this.sendToAll({
            type: 'player_attack',
            attackerId: this.playerId,
            targetId: peerId,
            damage: damage,
            knockback,
          });
          // 显示伤害数字
          if (this.game.effects) {
            this.game.effects.showDamageNumber(rp.position.x, rp.position.y + 1, rp.position.z, damage);
          }
          // 攻击音效
          if (this.game.sound) {
            this.game.sound.attack();
          }
          return true;
        }
      }
    }
    return false;
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
      if (rp.model) rp.model.dispose();
    }
    this.remotePlayers.clear();
  }
}
