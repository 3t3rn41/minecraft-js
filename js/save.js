/**
 * save.js — 世界存档与读取
 * 使用 localStorage 存储玩家数据和修改的方块
 */

const SAVE_KEY = 'minecraft_js_save';
const SAVE_VERSION = 1;

export class SaveManager {
  constructor() {
    this.hasSave = this.checkSave();
  }

  checkSave() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      return data !== null;
    } catch (e) {
      return false;
    }
  }

  save(world, player, sky, settings, seed) {
    try {
      const data = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        seed: seed,
        settings: settings,
        player: player.serialize(),
        sky: { time: sky.time },
        modifiedBlocks: Array.from(world.modifiedBlocks.entries()),
      };

      // 存储到 localStorage
      // 如果数据太大，尝试压缩（只存修改的方块）
      const json = JSON.stringify(data);

      // 检查大小（localStorage 通常限制 5-10MB）
      if (json.length > 4 * 1024 * 1024) {
        console.warn('存档数据过大，可能无法完整保存');
      }

      localStorage.setItem(SAVE_KEY, json);
      this.hasSave = true;
      return true;
    } catch (e) {
      console.error('保存失败:', e);
      // 尝试使用 IndexedDB 作为后备
      return this.saveToIndexedDB(world, player, sky, settings, seed);
    }
  }

  load() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return null;

      const data = JSON.parse(json);
      if (data.version !== SAVE_VERSION) {
        console.warn('存档版本不匹配');
      }

      return data;
    } catch (e) {
      console.error('读取失败:', e);
      return null;
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
    this.hasSave = false;
  }

  // IndexedDB 后备方案
  async saveToIndexedDB(world, player, sky, settings, seed) {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('minecraft_js', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.createObjectStore('saves', { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['saves'], 'readwrite');
          const store = tx.objectStore('saves');
          const data = {
            id: 'main',
            version: SAVE_VERSION,
            timestamp: Date.now(),
            seed: seed,
            settings: settings,
            player: player.serialize(),
            sky: { time: sky.time },
            modifiedBlocks: Array.from(world.modifiedBlocks.entries()),
          };
          store.put(data);
          tx.oncomplete = () => { this.hasSave = true; resolve(true); };
          tx.onerror = () => resolve(false);
        };
        request.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}
