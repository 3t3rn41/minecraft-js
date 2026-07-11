/**
 * roomDiscovery.js — 局域网房间发现服务
 * 基于 PeerJS 的 Hub 发现机制：
 *   - 第一个打开多人联机页面的用户自动成为 Hub（lobby协调者）
 *   - 主机创建房间后向 Hub 注册，Hub 维护房间列表
 *   - 客户端连接 Hub 获取房间列表，点击即可加入
 *   - 5分钟无人加入的房间自动销毁
 *   - Hub 断线时自动重新选举
 */

// ===== 常量 =====
const LOBBY_HUB_ID = 'mcjs-lobby-hub-v3';
const HEARTBEAT_INTERVAL = 15000;       // 15秒发送一次心跳
const HUB_CLEANUP_INTERVAL = 10000;     // Hub 每10秒清理过期房间
const ROOM_NO_JOIN_EXPIRY = 5 * 60 * 1000;  // 5分钟无人加入则过期
const HEARTBEAT_TIMEOUT = 45000;        // 45秒无心跳认为主机离线

// ===== 动态加载 PeerJS =====
async function loadPeerJS() {
  if (window.Peer) return window.Peer;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'lib/peerjs.min.js';
    script.onload = () => resolve(window.Peer);
    script.onerror = () => reject(new Error('无法加载 PeerJS'));
    document.head.appendChild(script);
  });
}

export class RoomDiscovery {
  constructor() {
    this.peer = null;
    this.isHub = false;
    this.isConnected = false;

    // Hub 模式数据
    this.rooms = new Map();           // roomId -> { hostId, hostName, playerCount, createdAt, lastJoinAt, lastHeartbeat, hubConnPeerId }
    this.hubConns = new Map();        // peerId -> conn (连接到Hub的所有连接)

    // 客户端/主机模式数据
    this.hubConn = null;              // 到 Hub 的连接
    this.myRoomId = null;             // 主机注册的房间ID（即游戏Peer ID）
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    this.localExpiryTimer = null;     // 本地5分钟过期计时器（主机侧兜底）

    // 回调
    this.onRoomListUpdate = null;     // (rooms[]) => void
    this.onRoomExpired = null;        // (roomId) => void
    this.onHubConnected = null;       // () => void
    this.onHubDisconnected = null;    // () => void

    this._destroyed = false;
    this._registeredHostName = null;  // 存储主机名用于重连后重新注册
  }

  // ===== 启动发现服务 =====
  async start() {
    if (this._destroyed) return;
    const Peer = await loadPeerJS();

    return new Promise((resolve, reject) => {
      // 尝试成为 Hub（创建带有固定ID的Peer）
      this.peer = new Peer(LOBBY_HUB_ID);
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          // 超时后尝试作为客户端
          this._tryFallbackToClient(Peer, resolve, reject);
        }
      }, 8000);

      this.peer.on('open', (id) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        // 成功成为 Hub
        this.isHub = true;
        this.isConnected = true;
        this._setupHub();
        console.log('[RoomDiscovery] 已成为 Hub (lobby协调者)');
        // 如果之前注册过房间，重新注册
        this._tryReRegister();
        resolve('hub');
      });

      this.peer.on('error', (err) => {
        if (settled) return;
        if (err.type === 'unavailable-id') {
          // ID已被占用，说明已有 Hub，切换为客户端模式
          settled = true;
          clearTimeout(timeout);
          this.peer.destroy();
          this.peer = null;
          this._startAsClient(Peer).then(() => resolve('client')).catch(reject);
        }
      });
    });
  }

  // 超时兜底：销毁当前Peer并以客户端模式启动
  async _tryFallbackToClient(Peer, resolve, reject) {
    try {
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      await this._startAsClient(Peer);
      resolve('client');
    } catch (e) {
      reject(e);
    }
  }

  // ===== 以客户端模式启动（连接到Hub） =====
  async _startAsClient(Peer) {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      let settled = false;

      this.peer.on('open', (id) => {
        // 连接到 Hub
        const conn = this.peer.connect(LOBBY_HUB_ID, { reliable: true });

        const connTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            // Hub 不可达，尝试自己成为 Hub
            this._retryAsHub(Peer).then(resolve).catch(reject);
          }
        }, 8000);

        conn.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(connTimeout);
          this.hubConn = conn;
          this.isConnected = true;
          this._setupHubClientConnection();
          // 请求房间列表
          conn.send({ type: 'get_rooms' });
          console.log('[RoomDiscovery] 已连接到 Hub');
          // 如果之前注册过房间，重新注册
          this._tryReRegister();
          if (this.onHubConnected) this.onHubConnected();
          resolve('client');
        });

        conn.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(connTimeout);
            this._retryAsHub(Peer).then(resolve).catch(reject);
          }
        });
      });

      this.peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }

  // Hub不可达时，尝试自己成为Hub
  async _retryAsHub(Peer) {
    if (this._destroyed) return;
    return new Promise((resolve, reject) => {
      this.peer = new Peer(LOBBY_HUB_ID);
      let settled = false;

      this.peer.on('open', () => {
        if (settled) return;
        settled = true;
        this.isHub = true;
        this.isConnected = true;
        this._setupHub();
        console.log('[RoomDiscovery] Hub不可达，已成为新 Hub');
        this._tryReRegister();
        resolve('hub');
      });

      this.peer.on('error', (err) => {
        if (settled) return;
        if (err.type === 'unavailable-id') {
          // 又被占了，再试客户端
          settled = true;
          this.peer.destroy();
          this.peer = new Peer();
          this.peer.on('open', () => {
            const conn = this.peer.connect(LOBBY_HUB_ID, { reliable: true });
            conn.on('open', () => {
              this.hubConn = conn;
              this.isConnected = true;
              this._setupHubClientConnection();
              conn.send({ type: 'get_rooms' });
              this._tryReRegister();
              resolve('client');
            });
            conn.on('error', reject);
          });
          this.peer.on('error', reject);
        } else {
          settled = true;
          reject(err);
        }
      });
    });
  }

  // ===== Hub 模式设置 =====
  _setupHub() {
    this.peer.on('connection', (conn) => {
      let peerId = conn.peer;

      conn.on('open', () => {
        this.hubConns.set(peerId, conn);
      });

      conn.on('data', (data) => {
        this._handleHubMessage(data, conn);
      });

      conn.on('close', () => {
        this.hubConns.delete(peerId);
        // 移除该连接注册的房间
        let changed = false;
        for (const [roomId, room] of this.rooms) {
          if (room.hubConnPeerId === peerId) {
            this.rooms.delete(roomId);
            changed = true;
          }
        }
        if (changed) this._broadcastRoomList();
      });

      conn.on('error', () => {
        this.hubConns.delete(peerId);
      });
    });

    // 启动清理定时器
    this.cleanupTimer = setInterval(() => this._cleanupRooms(), HUB_CLEANUP_INTERVAL);
  }

  // ===== Hub 处理消息 =====
  _handleHubMessage(data, conn) {
    switch (data.type) {
      case 'register_room': {
        const now = Date.now();
        this.rooms.set(data.roomId, {
          hostId: data.roomId,
          hostName: data.hostName || '未知主机',
          playerCount: data.playerCount || 1,
          createdAt: data.createdAt || now,
          lastJoinAt: null,
          lastHeartbeat: now,
          hubConnPeerId: conn.peer,
        });
        conn.send({ type: 'room_registered', roomId: data.roomId });
        this._broadcastRoomList();
        break;
      }
      case 'unregister_room': {
        if (this.rooms.has(data.roomId)) {
          this.rooms.delete(data.roomId);
          this._broadcastRoomList();
        }
        break;
      }
      case 'get_rooms': {
        conn.send({ type: 'room_list', rooms: this._getRoomList() });
        break;
      }
      case 'heartbeat': {
        const room = this.rooms.get(data.roomId);
        if (room) {
          room.lastHeartbeat = Date.now();
        }
        break;
      }
      case 'room_joined': {
        const room = this.rooms.get(data.roomId);
        if (room) {
          room.playerCount = data.playerCount;
          if (!room.lastJoinAt) {
            room.lastJoinAt = Date.now();
          }
        }
        this._broadcastRoomList();
        break;
      }
    }
  }

  // ===== Hub: 获取房间列表（仅返回有效房间） =====
  _getRoomList() {
    const now = Date.now();
    const list = [];
    for (const [id, room] of this.rooms) {
      // 过滤掉已过期但还未清理的房间
      if (now - room.lastHeartbeat > HEARTBEAT_TIMEOUT) continue;
      if (!room.lastJoinAt && now - room.createdAt > ROOM_NO_JOIN_EXPIRY) continue;
      list.push({
        roomId: id,
        hostId: room.hostId,
        hostName: room.hostName,
        playerCount: room.playerCount,
        createdAt: room.createdAt,
      });
    }
    return list;
  }

  // ===== Hub: 广播房间列表给所有连接的客户端 =====
  _broadcastRoomList() {
    const roomList = this._getRoomList();
    for (const conn of this.hubConns.values()) {
      if (conn.open) {
        try {
          conn.send({ type: 'room_list', rooms: roomList });
        } catch (e) {}
      }
    }
  }

  // ===== Hub: 清理过期房间 =====
  _cleanupRooms() {
    const now = Date.now();
    let changed = false;

    for (const [roomId, room] of this.rooms) {
      // 心跳超时：主机离线
      if (now - room.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log('[RoomDiscovery] 房间心跳超时，移除:', roomId);
        this.rooms.delete(roomId);
        changed = true;
        continue;
      }
      // 5分钟无人加入：自动销毁
      if (!room.lastJoinAt && now - room.createdAt > ROOM_NO_JOIN_EXPIRY) {
        console.log('[RoomDiscovery] 房间5分钟无人加入，自动销毁:', roomId);
        // 通知主机
        const conn = this.hubConns.get(room.hubConnPeerId);
        if (conn && conn.open) {
          try { conn.send({ type: 'room_expired', roomId }); } catch (e) {}
        }
        this.rooms.delete(roomId);
        changed = true;
      }
    }

    if (changed) this._broadcastRoomList();
  }

  // ===== 客户端模式：设置 Hub 连接监听 =====
  _setupHubClientConnection() {
    this.hubConn.on('data', (data) => {
      if (data.type === 'room_list') {
        if (this.onRoomListUpdate) {
          this.onRoomListUpdate(data.rooms || []);
        }
      } else if (data.type === 'room_expired') {
        if (this.onRoomExpired) {
          this.onRoomExpired(data.roomId);
        }
      }
    });

    this.hubConn.on('close', () => {
      console.log('[RoomDiscovery] 与 Hub 的连接断开，尝试重新连接...');
      this.isConnected = false;
      if (this.onHubDisconnected) this.onHubDisconnected();
      // 清理心跳
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      // 尝试重新启动（可能成为新Hub）
      if (!this._destroyed) {
        setTimeout(() => {
          if (!this._destroyed) this.start().catch(() => {});
        }, 2000);
      }
    });

    this.hubConn.on('error', () => {
      // close 事件会随后触发
    });
  }

  // ===== 主机：注册房间 =====
  registerRoom(gamePeerId, hostName) {
    this.myRoomId = gamePeerId;
    this._registeredHostName = hostName || '未知主机';
    const now = Date.now();

    if (this.isHub) {
      // 自己是Hub，直接添加
      this.rooms.set(gamePeerId, {
        hostId: gamePeerId,
        hostName: this._registeredHostName,
        playerCount: 1,
        createdAt: now,
        lastJoinAt: null,
        lastHeartbeat: now,
        hubConnPeerId: null, // 本地
      });
      this._broadcastRoomList();
    } else if (this.hubConn && this.hubConn.open) {
      this.hubConn.send({
        type: 'register_room',
        roomId: gamePeerId,
        hostName: this._registeredHostName,
        playerCount: 1,
        createdAt: now,
      });
      // 启动心跳
      this._startHeartbeat();
    }

    // 启动本地5分钟过期计时器（兜底）
    this._startLocalExpiryTimer();
  }

  // ===== 重连后重新注册房间 =====
  _tryReRegister() {
    if (this.myRoomId && this._registeredHostName) {
      console.log('[RoomDiscovery] 重连后重新注册房间:', this.myRoomId);
      if (this.isHub) {
        const now = Date.now();
        this.rooms.set(this.myRoomId, {
          hostId: this.myRoomId,
          hostName: this._registeredHostName,
          playerCount: 1,
          createdAt: now,
          lastJoinAt: null,
          lastHeartbeat: now,
          hubConnPeerId: null,
        });
        this._broadcastRoomList();
      } else if (this.hubConn && this.hubConn.open) {
        this.hubConn.send({
          type: 'register_room',
          roomId: this.myRoomId,
          hostName: this._registeredHostName,
          playerCount: 1,
          createdAt: Date.now(),
        });
        this._startHeartbeat();
      }
      this._startLocalExpiryTimer();
    }
  }

  // ===== 主机：注销房间 =====
  unregisterRoom() {
    if (this.myRoomId) {
      if (this.isHub) {
        this.rooms.delete(this.myRoomId);
        this._broadcastRoomList();
      } else if (this.hubConn && this.hubConn.open) {
        this.hubConn.send({ type: 'unregister_room', roomId: this.myRoomId });
      }
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.localExpiryTimer) {
      clearTimeout(this.localExpiryTimer);
      this.localExpiryTimer = null;
    }
    this.myRoomId = null;
  }

  // ===== 主机：通知有人加入（更新人数） =====
  notifyPlayerJoined(playerCount) {
    if (!this.myRoomId) return;
    if (this.isHub) {
      const room = this.rooms.get(this.myRoomId);
      if (room) {
        room.playerCount = playerCount;
        if (!room.lastJoinAt) room.lastJoinAt = Date.now();
      }
      this._broadcastRoomList();
    } else if (this.hubConn && this.hubConn.open) {
      this.hubConn.send({
        type: 'room_joined',
        roomId: this.myRoomId,
        playerCount,
      });
    }
    // 有人加入了，取消本地过期计时
    if (this.localExpiryTimer) {
      clearTimeout(this.localExpiryTimer);
      this.localExpiryTimer = null;
    }
  }

  // ===== 心跳 =====
  _startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.myRoomId && this.hubConn && this.hubConn.open) {
        this.hubConn.send({ type: 'heartbeat', roomId: this.myRoomId });
      }
    }, HEARTBEAT_INTERVAL);
  }

  // ===== 本地5分钟过期计时器（主机侧兜底） =====
  _startLocalExpiryTimer() {
    if (this.localExpiryTimer) clearTimeout(this.localExpiryTimer);
    this.localExpiryTimer = setTimeout(() => {
      // 5分钟到了，如果还没人加入
      if (this.myRoomId && this.onRoomExpired) {
        console.log('[RoomDiscovery] 本地计时器：房间5分钟无人加入');
        this.onRoomExpired(this.myRoomId);
      }
    }, ROOM_NO_JOIN_EXPIRY);
  }

  // ===== 销毁 =====
  destroy() {
    this._destroyed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.localExpiryTimer) {
      clearTimeout(this.localExpiryTimer);
      this.localExpiryTimer = null;
    }
    // 尝试注销房间
    if (this.myRoomId) {
      this.unregisterRoom();
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.isHub = false;
  }
}
