/**
 * main.js — 入口文件
 * 处理启动菜单、游戏初始化和场景切换
 */

import { Game } from './game.js';
import { SaveManager } from './save.js';
import { GAMEMODE, GAMEMODE_NAMES, GAMEMODE_ICONS } from './gamemodes.js';
import { isMobileDevice } from './mobile.js';
import { RoomDiscovery } from './roomDiscovery.js';

let game = null;
let selectedGamemode = GAMEMODE.SURVIVAL;

// 多人联机待定状态（创建房间后、进入游戏前）
let pendingPeer = null;
let pendingRoomId = null;
let pendingConnections = []; // [{ conn, bufferedMessages }]
let pendingClientConn = null;

// 房间发现服务
let roomDiscovery = null;

// 检测移动端并添加 body 类
if (isMobileDevice()) {
  document.body.classList.add('mobile');
}

// ===== 移动端全屏请求 =====
// 浏览器要求全屏必须在用户交互内触发
function requestBrowserFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {});
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.webkitEnterFullscreen) {
    elem.webkitEnterFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

if (isMobileDevice()) {
  // 尝试在首次触摸/点击时进入全屏
  const fsHandler = () => {
    requestBrowserFullscreen();
    document.removeEventListener('touchend', fsHandler);
    document.removeEventListener('click', fsHandler);
  };
  document.addEventListener('touchend', fsHandler);
  document.addEventListener('click', fsHandler);
}

// ===== 动态加载 PeerJS =====
async function loadPeerJS() {
  if (window.Peer) return window.Peer;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    script.onload = () => resolve(window.Peer);
    script.onerror = () => reject(new Error('无法加载 PeerJS'));
    document.head.appendChild(script);
  });
}

// ===== 清理待定的 Peer 连接 =====
function cleanupPendingPeer() {
  if (roomDiscovery && roomDiscovery.myRoomId) {
    roomDiscovery.unregisterRoom();
  }
  if (pendingPeer) {
    try { pendingPeer.destroy(); } catch (e) {}
    pendingPeer = null;
  }
  pendingRoomId = null;
  pendingConnections = [];
  pendingClientConn = null;
}

// ===== 重置多人联机界面 =====
function resetMultiplayerUI() {
  const createBtn = document.getElementById('create-room-btn');
  const enterHostBtn = document.getElementById('enter-host-game-btn');
  const copyBtn = document.getElementById('copy-room-btn');
  const roomIdWrapper = document.getElementById('room-id-wrapper');
  const roomIdLabel = document.getElementById('room-id-label');
  const hostHint = document.getElementById('host-hint');
  const joinBtn = document.getElementById('join-room-btn');
  const enterClientBtn = document.getElementById('enter-client-game-btn');
  const joinStatus = document.getElementById('join-status');
  const joinInput = document.getElementById('join-room-input');

  if (createBtn) { createBtn.textContent = '创建房间'; createBtn.disabled = false; createBtn.classList.remove('hidden'); }
  if (enterHostBtn) { enterHostBtn.textContent = '进入游戏'; enterHostBtn.disabled = false; enterHostBtn.classList.add('hidden'); }
  if (copyBtn) copyBtn.classList.add('hidden');
  if (roomIdWrapper) roomIdWrapper.classList.add('hidden');
  if (roomIdLabel) roomIdLabel.textContent = '点击下方按钮创建房间，同一网络下的其他玩家可自动发现';
  if (hostHint) hostHint.textContent = '创建房间后，其他玩家可在下方房间列表中看到并加入。5分钟内无人加入将自动销毁。';
  if (joinBtn) { joinBtn.textContent = '加入'; joinBtn.disabled = false; }
  if (joinInput) joinInput.value = '';
  if (enterClientBtn) { enterClientBtn.textContent = '进入游戏'; enterClientBtn.disabled = false; enterClientBtn.classList.add('hidden'); }
  if (joinStatus) { joinStatus.textContent = ''; joinStatus.classList.add('hidden'); }
}

// ===== 启动画面按钮 =====
document.addEventListener('DOMContentLoaded', () => {
  // 检查存档
  const save = new SaveManager();
  const loadBtn = document.getElementById('load-btn');
  if (!save.hasSave) {
    loadBtn.disabled = true;
    loadBtn.style.opacity = '0.5';
    loadBtn.textContent = '暂无存档';
  }

  // 单人游戏
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('gamemode-screen').classList.remove('hidden');
  });

  // 游戏模式选择
  document.querySelectorAll('.gamemode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.gamemode-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedGamemode = parseInt(card.dataset.gamemode);
    });
  });

  document.getElementById('gamemode-start-btn').addEventListener('click', () => {
    startSinglePlayer(false, selectedGamemode);
  });

  document.getElementById('gamemode-back-btn').addEventListener('click', () => {
    document.getElementById('gamemode-screen').classList.add('hidden');
    document.getElementById('splash-screen').classList.remove('hidden');
  });

  // 读取存档
  loadBtn.addEventListener('click', () => {
    if (save.hasSave) startSinglePlayer(true);
  });

  // 多人联机
  document.getElementById('multiplayer-btn').addEventListener('click', () => {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('multiplayer-screen').classList.remove('hidden');
    startRoomDiscovery();
  });

  // 设置
  document.getElementById('settings-btn-splash').addEventListener('click', () => {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('settings-screen-splash').classList.remove('hidden');
  });

  document.getElementById('settings-back-btn').addEventListener('click', () => {
    document.getElementById('settings-screen-splash').classList.add('hidden');
    document.getElementById('splash-screen').classList.remove('hidden');
  });

  // 多人联机界面 - 返回（清理待定连接）
  document.getElementById('mp-back-btn').addEventListener('click', () => {
    cleanupPendingPeer();
    resetMultiplayerUI();
    if (roomDiscovery) {
      roomDiscovery.destroy();
      roomDiscovery = null;
    }
    document.getElementById('multiplayer-screen').classList.add('hidden');
    document.getElementById('splash-screen').classList.remove('hidden');
  });

  // ===== 创建房间（仅生成房间ID，不进入游戏） =====
  document.getElementById('create-room-btn').addEventListener('click', async () => {
    const btn = document.getElementById('create-room-btn');
    btn.textContent = '正在创建房间...';
    btn.disabled = true;
    try {
      const roomId = await createRoom();
      // 显示房间ID
      document.getElementById('room-id-wrapper').classList.remove('hidden');
      document.getElementById('room-id-display').textContent = roomId;
      document.getElementById('copy-room-btn').classList.remove('hidden');
      document.getElementById('room-id-label').textContent = '房间已创建！分享ID给其他玩家：';
      document.getElementById('host-hint').textContent = '其他玩家可使用此ID加入房间，准备好后点击"进入游戏"';
      // 隐藏创建按钮，显示进入游戏按钮
      btn.classList.add('hidden');
      document.getElementById('enter-host-game-btn').classList.remove('hidden');
    } catch (e) {
      btn.textContent = '创建房间';
      btn.disabled = false;
      alert('创建房间失败: ' + e.message);
    }
  });

  // ===== 主机进入游戏 =====
  document.getElementById('enter-host-game-btn').addEventListener('click', async () => {
    const btn = document.getElementById('enter-host-game-btn');
    btn.textContent = '正在进入...';
    btn.disabled = true;
    try {
      await enterMultiplayerHostGame();
    } catch (e) {
      btn.textContent = '进入游戏';
      btn.disabled = false;
      alert('进入游戏失败: ' + e.message);
    }
  });

  // 复制ID
  document.getElementById('copy-room-btn').addEventListener('click', () => {
    const text = document.getElementById('room-id-display').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-room-btn');
      const orig = btn.textContent;
      btn.textContent = '已复制!';
      setTimeout(() => btn.textContent = orig, 1500);
    });
  });

  // ===== 加入房间（仅连接，不进入游戏） =====
  document.getElementById('join-room-btn').addEventListener('click', async () => {
    const hostId = document.getElementById('join-room-input').value.trim();
    if (!hostId) {
      alert('请输入主机ID');
      return;
    }
    const btn = document.getElementById('join-room-btn');
    btn.textContent = '正在连接...';
    btn.disabled = true;
    const statusEl = document.getElementById('join-status');
    statusEl.textContent = '正在连接到主机...';
    statusEl.style.color = '#ffd700';
    statusEl.classList.remove('hidden');
    try {
      await connectToRoom(hostId);
      statusEl.textContent = '连接成功！点击"进入游戏"';
      statusEl.style.color = '#5a9c3d';
      // 隐藏加入按钮，显示进入游戏按钮
      btn.classList.add('hidden');
      document.getElementById('enter-client-game-btn').classList.remove('hidden');
    } catch (e) {
      btn.textContent = '加入';
      btn.disabled = false;
      statusEl.textContent = '连接失败: ' + e.message;
      statusEl.style.color = '#cc3333';
    }
  });

  // ===== 客户端进入游戏 =====
  document.getElementById('enter-client-game-btn').addEventListener('click', async () => {
    const btn = document.getElementById('enter-client-game-btn');
    btn.textContent = '正在进入...';
    btn.disabled = true;
    try {
      await enterMultiplayerClientGame();
    } catch (e) {
      btn.textContent = '进入游戏';
      btn.disabled = false;
      alert('进入游戏失败: ' + e.message);
    }
  });

  // 刷新房间列表
  document.getElementById('refresh-rooms-btn').addEventListener('click', () => {
    if (roomDiscovery) {
      if (roomDiscovery.isHub) {
        updateRoomListUI(roomDiscovery._getRoomList());
      } else if (roomDiscovery.hubConn && roomDiscovery.hubConn.open) {
        roomDiscovery.hubConn.send({ type: 'get_rooms' });
      } else {
        // 未连接，尝试重新启动
        startRoomDiscovery();
      }
    } else {
      startRoomDiscovery();
    }
  });
});

// ===== 启动房间发现服务 =====
async function startRoomDiscovery() {
  if (roomDiscovery && roomDiscovery.isConnected) return;
  if (roomDiscovery) {
    roomDiscovery.destroy();
    roomDiscovery = null;
  }

  roomDiscovery = new RoomDiscovery();
  roomDiscovery.onRoomListUpdate = updateRoomListUI;
  roomDiscovery.onRoomExpired = handleRoomExpired;
  roomDiscovery.onHubConnected = () => {
    const status = document.getElementById('discovery-status');
    if (status) {
      status.textContent = roomDiscovery.isHub ? '已就绪（房间协调者）' : '已连接，正在搜索房间...';
      status.className = 'hint discovery-status connected';
    }
  };
  roomDiscovery.onHubDisconnected = () => {
    const status = document.getElementById('discovery-status');
    if (status) {
      status.textContent = '与服务器断开，正在重连...';
      status.className = 'hint discovery-status error';
    }
  };

  const status = document.getElementById('discovery-status');
  if (status) {
    status.textContent = '正在连接房间发现服务...';
    status.className = 'hint discovery-status';
    status.classList.remove('hidden');
  }

  try {
    const role = await roomDiscovery.start();
    if (status) {
      status.textContent = role === 'hub' ? '已就绪（房间协调者）' : '已连接，正在搜索房间...';
      status.className = 'hint discovery-status connected';
    }
  } catch (e) {
    console.error('房间发现服务启动失败:', e);
    if (status) {
      status.textContent = '房间发现服务不可用（可使用手动加入）';
      status.className = 'hint discovery-status error';
    }
  }
}

// ===== 更新房间列表UI =====
function updateRoomListUI(rooms) {
  const listEl = document.getElementById('room-list');
  const emptyEl = document.getElementById('room-list-empty');
  const badgeEl = document.getElementById('room-count-badge');
  if (!listEl) return;

  // 过滤掉自己的房间
  const displayRooms = rooms.filter(r => r.hostId !== pendingRoomId);

  if (badgeEl) badgeEl.textContent = displayRooms.length;

  if (displayRooms.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  listEl.innerHTML = '';

  for (const room of displayRooms) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.dataset.hostId = room.hostId;

    const elapsed = Math.floor((Date.now() - room.createdAt) / 1000);
    const timeStr = elapsed < 60 ? `${elapsed}秒前` : `${Math.floor(elapsed / 60)}分钟前`;

    card.innerHTML = `
      <div class="room-card-info">
        <div class="room-card-name">${escapeHtml(room.hostName)}</div>
        <div class="room-card-meta">
          <span class="room-card-players">👥 ${room.playerCount}人</span>
          <span class="room-card-time">🕒 ${timeStr}</span>
        </div>
      </div>
      <button class="room-card-join-btn">加入</button>
    `;

    card.querySelector('.room-card-join-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      joinRoomFromList(room.hostId, card);
    });

    listEl.appendChild(card);
  }
}

// ===== 从房间列表加入房间 =====
async function joinRoomFromList(hostId, card) {
  if (card) card.classList.add('joining');
  const statusEl = document.getElementById('join-status');
  statusEl.textContent = '正在连接到主机...';
  statusEl.style.color = '#ffd700';
  statusEl.classList.remove('hidden');

  try {
    await connectToRoom(hostId);
    statusEl.textContent = '连接成功！点击"进入游戏"';
    statusEl.style.color = '#5a9c3d';
    document.getElementById('enter-client-game-btn').classList.remove('hidden');
    document.querySelectorAll('.room-card').forEach(c => c.classList.remove('joining'));
  } catch (e) {
    if (card) card.classList.remove('joining');
    statusEl.textContent = '连接失败: ' + e.message;
    statusEl.style.color = '#cc3333';
  }
}

// ===== 房间过期处理（5分钟无人加入） =====
function handleRoomExpired(roomId) {
  alert('房间已超过5分钟无人加入，自动销毁。请重新创建房间。');
  cleanupPendingPeer();
  resetMultiplayerUI();
}

// ===== HTML转义工具 =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 获取设置 =====
function getSettingsFromUI() {
  return {
    renderDistance: parseInt(document.getElementById('set-render-distance').value),
    sensitivity: parseFloat(document.getElementById('set-sensitivity').value),
    fog: document.getElementById('set-fog').checked,
    fov: parseInt(document.getElementById('set-fov').value),
    showFPS: document.getElementById('set-show-fps').checked,
  };
}

// ===== 启动单人游戏 =====
async function startSinglePlayer(loadSave, gamemode = GAMEMODE.SURVIVAL) {
  document.getElementById('gamemode-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('loading-overlay').classList.remove('hidden');

  game = new Game();
  game.settings = getSettingsFromUI();
  await game.init(loadSave, null, gamemode);
}

// ===== 多人联机 - 主机阶段1：创建房间（仅生成ID） =====
async function createRoom() {
  const Peer = await loadPeerJS();
  pendingPeer = new Peer();

  return new Promise((resolve, reject) => {
    pendingPeer.on('open', (id) => {
      pendingRoomId = id;
      console.log('房间已创建，ID:', id);

      // 向房间发现服务注册
      if (roomDiscovery && roomDiscovery.isConnected) {
        const hostName = '玩家' + Math.floor(Math.random() * 1000);
        roomDiscovery.registerRoom(id, hostName);
        roomDiscovery.onRoomExpired = handleRoomExpired;
      } else {
        // 如果发现服务未连接，先启动再注册
        startRoomDiscovery().then(() => {
          if (roomDiscovery && roomDiscovery.isConnected) {
            const hostName = '玩家' + Math.floor(Math.random() * 1000);
            roomDiscovery.registerRoom(id, hostName);
            roomDiscovery.onRoomExpired = handleRoomExpired;
          }
        }).catch(() => {});
      }

      // 监听传入连接，缓冲消息直到游戏启动
      pendingPeer.on('connection', (conn) => {
        const bufferedMessages = [];
        conn.on('data', (data) => {
          bufferedMessages.push(data);
        });
        conn.on('close', () => {
          pendingConnections = pendingConnections.filter(p => p.conn !== conn);
          // 更新房间人数
          if (roomDiscovery) {
            roomDiscovery.notifyPlayerJoined(pendingConnections.length + 1);
          }
        });
        pendingConnections.push({ conn, bufferedMessages });
        console.log('玩家连接（等待主机进入游戏）:', conn.peer);
        // 更新房间人数
        if (roomDiscovery) {
          roomDiscovery.notifyPlayerJoined(pendingConnections.length + 1);
        }
      });

      resolve(id);
    });

    pendingPeer.on('error', (err) => {
      console.error('PeerJS 错误:', err);
      reject(err);
    });

    // 超时
    setTimeout(() => {
      if (!pendingRoomId) reject(new Error('连接超时'));
    }, 10000);
  });
}

// ===== 多人联机 - 主机阶段2：进入游戏 =====
async function enterMultiplayerHostGame() {
  document.getElementById('multiplayer-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('loading-overlay').classList.remove('hidden');

  // 读取主机选择的游戏模式
  const gmSelect = document.getElementById('mp-host-gamemode');
  const hostGamemode = gmSelect ? parseInt(gmSelect.value) : GAMEMODE.SURVIVAL;

  game = new Game();
  game.settings = getSettingsFromUI();
  game.roomDiscovery = roomDiscovery; // 传递给游戏，用于人数更新和退出时清理
  await game.init(false, 'multiplayer', hostGamemode);

  // 使用已有的 Peer 连接和待处理的客户端连接
  const roomId = await game.multiplayer.hostRoom(pendingPeer, pendingRoomId, pendingConnections);

  // 清理待定状态（但不销毁 roomDiscovery，游戏内仍需保持心跳）
  pendingPeer = null;
  pendingRoomId = null;
  pendingConnections = [];

  console.log('主机进入游戏完成，房间ID:', roomId);
}

// ===== 多人联机 - 客户端阶段1：连接到主机 =====
async function connectToRoom(hostId) {
  const Peer = await loadPeerJS();
  pendingPeer = new Peer();

  return new Promise((resolve, reject) => {
    pendingPeer.on('open', (id) => {
      pendingRoomId = id;
      const conn = pendingPeer.connect(hostId, { reliable: true });

      conn.on('open', () => {
        pendingClientConn = conn;
        console.log('已连接到主机');
        resolve();
      });

      conn.on('error', (err) => reject(err));
    });

    pendingPeer.on('error', (err) => {
      console.error('PeerJS 错误:', err);
      reject(err);
    });

    setTimeout(() => {
      if (!pendingClientConn) reject(new Error('连接超时，请确认主机ID正确且主机已创建房间'));
    }, 10000);
  });
}

// ===== 多人联机 - 客户端阶段2：进入游戏 =====
async function enterMultiplayerClientGame() {
  document.getElementById('multiplayer-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('loading-overlay').classList.remove('hidden');

  game = new Game();
  game.settings = getSettingsFromUI();
  game.roomDiscovery = roomDiscovery;
  game._isMultiplayerClient = true; // 标记为客户端，跳过区块生成直到收到主机种子
  await game.init(false, 'multiplayer', GAMEMODE.SURVIVAL);

  // 使用已有的 Peer 连接
  await game.multiplayer.joinRoomWithExistingConn(pendingPeer, pendingRoomId, pendingClientConn);

  // 清理待定状态
  pendingPeer = null;
  pendingRoomId = null;
  pendingClientConn = null;
}

// 窗口关闭时保存和断开连接
window.addEventListener('beforeunload', () => {
  if (game) {
    if (game.multiplayer) game.multiplayer.disconnect();
    if (game.saveGame) game.saveGame();
    if (game.roomDiscovery) game.roomDiscovery.destroy();
  }
  cleanupPendingPeer();
  if (roomDiscovery) {
    roomDiscovery.destroy();
    roomDiscovery = null;
  }
});

// ===== 快速小游戏 =====
window.startMinigame = async function(minigameType) {
  document.getElementById('multiplayer-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  document.getElementById('loading-overlay').classList.remove('hidden');

  game = new Game();
  game.settings = getSettingsFromUI();
  await game.init(false, null, GAMEMODE.CREATIVE);

  // 延迟一帧后启动小游戏
  setTimeout(() => {
    if (game && game.minigames) {
      game.minigames.startMinigame(minigameType);
    }
  }, 500);
};
