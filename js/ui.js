/**
 * ui.js — 完整游戏 UI 系统
 * 包含：快捷栏、背包、合成、生命值、饥饿值、暂停菜单、设置、死亡画面
 */

import { BLOCK_DEFS, BLOCK, generateBlockIcon, PLACEABLE_BLOCKS } from './blocks.js';
import { GAMEMODE_NAMES, GAMEMODE_ICONS } from './gamemodes.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.inventoryOpen = false;
    this.paused = false;
    this.settingsOpen = false;

    this.draggedSlot = null; // 拖拽中的物品
    this.draggedFrom = null;

    this._lastHeldBlockId = null;
    this._tooltipTimer = null;

    this.initTooltip();
    this.initHotbar();
    this.initInventory();
    this.initMenu();
    this.initSettings();
    this.initDeath();
  }

  // ===== 方块名称提示框 =====
  initTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'block-tooltip hidden';
    document.getElementById('game-container').appendChild(this.tooltip);
  }

  showTooltip(text, x, y) {
    this.tooltip.textContent = text;
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
    this.tooltip.classList.remove('hidden');
  }

  hideTooltip() {
    this.tooltip.classList.add('hidden');
  }

  // 为槽位添加提示框（鼠标悬停 + 触摸长按）
  attachSlotTooltip(slot, getItem) {
    // 鼠标悬停
    slot.addEventListener('mouseenter', () => {
      const item = getItem();
      if (item) {
        const def = BLOCK_DEFS[item.id];
        if (def) {
          const rect = slot.getBoundingClientRect();
          this.showTooltip(def.name, rect.left + rect.width / 2, rect.top - 5);
        }
      }
    });
    slot.addEventListener('mouseleave', () => this.hideTooltip());

    // 触摸长按
    let touchTimer = null;
    slot.addEventListener('touchstart', (e) => {
      const item = getItem();
      if (item) {
        const def = BLOCK_DEFS[item.id];
        if (def) {
          touchTimer = setTimeout(() => {
            const rect = slot.getBoundingClientRect();
            this.showTooltip(def.name, rect.left + rect.width / 2, rect.top - 5);
            setTimeout(() => this.hideTooltip(), 2000);
          }, 500);
        }
      }
    });
    const cancelTouch = () => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
    };
    slot.addEventListener('touchend', cancelTouch);
    slot.addEventListener('touchmove', cancelTouch);
    slot.addEventListener('touchcancel', cancelTouch);
  }

  // ===== 手持方块显示（右下角） =====
  updateHeldBlockDisplay() {
    const display = document.getElementById('held-block-display');
    if (!display) return;
    const item = this.game.player.getSelectedItem();
    if (item) {
      const def = BLOCK_DEFS[item.id];
      const iconSrc = generateBlockIcon(item.id);
      if (item.id !== this._lastHeldBlockId) {
        this._lastHeldBlockId = item.id;
        display.innerHTML = '';
        if (iconSrc) {
          const img = document.createElement('img');
          img.src = iconSrc;
          img.alt = def ? def.name : '';
          display.appendChild(img);
        }
        // 重新触发动画
        display.classList.remove('animate');
        void display.offsetWidth; // 强制回流
        display.classList.add('animate');
      }
      display.style.display = 'block';
    } else {
      display.style.display = 'none';
      this._lastHeldBlockId = null;
    }
  }

  // ===== 快捷栏 =====
  initHotbar() {
    const container = document.getElementById('hotbar-slots');
    container.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === 0 ? ' active' : '');
      slot.dataset.index = i;
      slot.innerHTML = `<span class="hotbar-slot-key">${i + 1}</span>`;
      slot.addEventListener('click', () => {
        this.game.player.hotbarIndex = i;
        this.updateHotbar();
      });
      // 移动端触摸直接选中
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.player.hotbarIndex = i;
        this.updateHotbar();
      }, { passive: false });
      // 方块名称提示框
      this.attachSlotTooltip(slot, () => this.game.player.inventory[i]);
      container.appendChild(slot);
    }
    this.updateHotbar();
  }

  updateHotbar() {
    const slots = document.querySelectorAll('.hotbar-slot');
    const player = this.game.player;
    for (let i = 0; i < 9; i++) {
      const slot = slots[i];
      if (!slot) continue;
      slot.classList.toggle('active', i === player.hotbarIndex);

      // 清除旧内容
      const oldIcon = slot.querySelector('.hotbar-slot-icon');
      const oldCount = slot.querySelector('.hotbar-slot-count');
      if (oldIcon) oldIcon.remove();
      if (oldCount) oldCount.remove();

      const item = player.inventory[i];
      if (item) {
        const icon = document.createElement('img');
        icon.className = 'hotbar-slot-icon';
        icon.src = generateBlockIcon(item.id) || '';
        icon.alt = BLOCK_DEFS[item.id]?.name || '';
        slot.appendChild(icon);

        if (item.count > 1) {
          const count = document.createElement('span');
          count.className = 'hotbar-slot-count';
          count.textContent = item.count;
          slot.appendChild(count);
        }
      }
    }
  }

  // ===== 生命值/饥饿值 =====
  updateStatusBars() {
    const healthBar = document.getElementById('health-bar');
    const hungerBar = document.getElementById('hunger-bar');
    const oxygenBar = document.getElementById('oxygen-bar');
    const player = this.game.player;

    healthBar.innerHTML = '';
    hungerBar.innerHTML = '';

    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('span');
      heart.className = 'stat-icon heart' + (i < Math.ceil(player.health / 2) ? '' : ' empty');
      heart.textContent = i < Math.ceil(player.health / 2) ? '♥' : '♡';
      healthBar.appendChild(heart);

      const hunger = document.createElement('span');
      hunger.className = 'stat-icon hunger' + (i < Math.ceil(player.hunger / 2) ? '' : ' empty');
      hunger.textContent = i < Math.ceil(player.hunger / 2) ? '●' : '○';
      hungerBar.appendChild(hunger);
    }

    // 氧气条 — 仅在水下或氧气不满时显示
    if (oxygenBar) {
      const showOxygen = player.oxygen < player.maxOxygen || player.isHeadInWater();
      if (showOxygen) {
        oxygenBar.classList.remove('hidden');
        oxygenBar.innerHTML = '';
        const totalBubbles = 10;
        const filled = Math.ceil(player.oxygen / player.maxOxygen * totalBubbles);
        for (let i = 0; i < totalBubbles; i++) {
          const bubble = document.createElement('span');
          bubble.className = 'stat-icon oxygen' + (i < filled ? '' : ' empty');
          bubble.textContent = i < filled ? '○' : '·';
          oxygenBar.appendChild(bubble);
        }
      } else {
        oxygenBar.classList.add('hidden');
      }
    }
  }

  // ===== 背包界面 =====
  initInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';

    // 27 个背包槽 + 9 个快捷栏槽 = 36
    for (let i = 0; i < 36; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.index = i;

      // 鼠标拖拽逻辑
      slot.addEventListener('mousedown', (e) => this.onSlotMouseDown(e, i));
      slot.addEventListener('mouseenter', (e) => this.onSlotMouseEnter(e, i));
      // 方块名称提示框
      this.attachSlotTooltip(slot, () => this.game.player.inventory[i]);

      grid.appendChild(slot);
    }

    // 合成网格 3x3
    const craftGrid = document.getElementById('crafting-grid');
    craftGrid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot crafting-input';
      slot.dataset.craftIndex = i;
      slot.addEventListener('mousedown', (e) => this.onCraftSlotMouseDown(e, i));
      slot.addEventListener('mouseenter', (e) => this.onCraftSlotEnter(e, i));
      // 合成格方块名称提示框
      this.attachSlotTooltip(slot, () => this.craftingGrid ? this.craftingGrid[i] : null);
      craftGrid.appendChild(slot);
    }

    // 合成输出
    const output = document.getElementById('crafting-output');
    output.addEventListener('click', () => this.takeCraftingResult());

    // 关闭按钮
    document.getElementById('inv-close-btn').addEventListener('click', () => this.closeInventory());

    // 显示合成配方
    this.showRecipeList();
  }

  showRecipeList() {
    const list = document.getElementById('recipe-list');
    const recipes = [
      '木板 x4: 1x 原木',
      '工作台: 2x2 木板',
      '圆石: 挖掘石头获得',
      '砖块: 4x 红砖 (需烧炼)',
      '书架: 6x 木板 + 3x 书',
    ];
    list.innerHTML = recipes.map(r => `<div class="recipe-item">${r}</div>`).join('');
  }

  updateInventoryDisplay() {
    const slots = document.querySelectorAll('#inventory-grid .inv-slot');
    const player = this.game.player;

    for (let i = 0; i < 36; i++) {
      const slot = slots[i];
      if (!slot) continue;
      this.renderSlot(slot, player.inventory[i]);
    }

    // 更新合成网格
    const craftSlots = document.querySelectorAll('#crafting-grid .inv-slot');
    for (let i = 0; i < 9; i++) {
      this.renderSlot(craftSlots[i], this.craftingGrid?.[i] || null);
    }

    // 检查合成结果
    this.checkCrafting();

    // 同步更新快捷栏
    this.updateHotbar();
  }

  renderSlot(slot, item) {
    const oldIcon = slot.querySelector('.inv-slot-icon');
    const oldCount = slot.querySelector('.inv-slot-count');
    if (oldIcon) oldIcon.remove();
    if (oldCount) oldCount.remove();

    if (item) {
      const icon = document.createElement('img');
      icon.className = 'inv-slot-icon';
      icon.src = generateBlockIcon(item.id) || '';
      icon.alt = BLOCK_DEFS[item.id]?.name || '';
      slot.appendChild(icon);

      if (item.count > 1) {
        const count = document.createElement('span');
        count.className = 'inv-slot-count';
        count.textContent = item.count;
        slot.appendChild(count);
      }
    }
  }

  // 拖拽逻辑
  onSlotMouseDown(e, index) {
    e.preventDefault();
    const player = this.game.player;
    const item = player.inventory[index];

    if (e.button === 0) {
      // 左键 — 拾取/放置
      if (this.draggedSlot) {
        // 放下拖拽的物品
        if (item && item.id === this.draggedSlot.id) {
          // 合并
          const total = item.count + this.draggedSlot.count;
          if (total <= 64) {
            item.count = total;
            this.draggedSlot = null;
          } else {
            item.count = 64;
            this.draggedSlot.count = total - 64;
          }
        } else {
          // 交换
          player.inventory[index] = this.draggedSlot;
          this.draggedSlot = item;
        }
      } else {
        this.draggedSlot = item;
        player.inventory[index] = null;
      }
    } else if (e.button === 2) {
      // 右键 — 放一个
      if (this.draggedSlot) {
        if (!item) {
          player.inventory[index] = { id: this.draggedSlot.id, count: 1 };
          this.draggedSlot.count--;
          if (this.draggedSlot.count <= 0) this.draggedSlot = null;
        } else if (item.id === this.draggedSlot.id && item.count < 64) {
          item.count++;
          this.draggedSlot.count--;
          if (this.draggedSlot.count <= 0) this.draggedSlot = null;
        }
      } else if (item) {
        // 拿走一半
        const half = Math.ceil(item.count / 2);
        this.draggedSlot = { id: item.id, count: half };
        item.count -= half;
        if (item.count <= 0) player.inventory[index] = null;
      }
    }

    this.updateInventoryDisplay();
  }

  onSlotMouseEnter(e, index) {
    // Shift+点击快速移动到背包/快捷栏
    // 暂不实现复杂的Shift移动
  }

  // 合成相关
  onCraftSlotMouseDown(e, craftIndex) {
    e.preventDefault();
    if (!this.craftingGrid) this.craftingGrid = new Array(9).fill(null);
    const item = this.craftingGrid[craftIndex];

    if (e.button === 0) {
      if (this.draggedSlot) {
        if (!item) {
          this.craftingGrid[craftIndex] = { id: this.draggedSlot.id, count: 1 };
          this.draggedSlot.count--;
          if (this.draggedSlot.count <= 0) this.draggedSlot = null;
        }
      } else if (item) {
        this.draggedSlot = item;
        this.craftingGrid[craftIndex] = null;
      }
    } else if (e.button === 2) {
      if (this.draggedSlot && (!item || (item.id === this.draggedSlot.id && item.count < 64))) {
        if (!item) {
          this.craftingGrid[craftIndex] = { id: this.draggedSlot.id, count: 1 };
        } else {
          item.count++;
        }
        this.draggedSlot.count--;
        if (this.draggedSlot.count <= 0) this.draggedSlot = null;
      } else if (item) {
        const half = Math.ceil(item.count / 2);
        this.draggedSlot = { id: item.id, count: half };
        item.count -= half;
        if (item.count <= 0) this.craftingGrid[craftIndex] = null;
      }
    }

    this.updateInventoryDisplay();
  }

  onCraftSlotEnter(e, index) {}

  // 检查合成结果
  checkCrafting() {
    if (!this.craftingGrid) this.craftingGrid = new Array(9).fill(null);

    const result = this.matchRecipe(this.craftingGrid);
    const output = document.getElementById('crafting-output');
    const oldIcon = output.querySelector('.inv-slot-icon');
    const oldCount = output.querySelector('.inv-slot-count');
    if (oldIcon) oldIcon.remove();
    if (oldCount) oldCount.remove();

    if (result) {
      this.currentCraftResult = result;
      const icon = document.createElement('img');
      icon.className = 'inv-slot-icon';
      icon.src = generateBlockIcon(result.id) || '';
      output.appendChild(icon);
      if (result.count > 1) {
        const count = document.createElement('span');
        count.className = 'inv-slot-count';
        count.textContent = result.count;
        output.appendChild(count);
      }
      output.style.cursor = 'pointer';
    } else {
      this.currentCraftResult = null;
      output.style.cursor = 'default';
    }
  }

  // 配方匹配
  matchRecipe(grid) {
    // 获取非空格子（归一化为左上对齐的图案）
    const items = grid.filter(i => i !== null);

    // 检查所有物品是否相同
    if (items.length === 0) return null;
    const firstId = items[0].id;

    // 简化：只检查数量和类型
    // 1 原木 -> 4 木板
    if (items.length === 1 && items[0].id === BLOCK.LOG) {
      return { id: BLOCK.PLANKS, count: 4 };
    }

    // 4 木板 (2x2) -> 1 工作台
    if (items.length === 4 && items.every(i => i.id === BLOCK.PLANKS)) {
      // 检查是否 2x2
      const indices = [];
      for (let i = 0; i < 9; i++) {
        if (grid[i]) indices.push(i);
      }
      // 2x2 检查：索引在 0,1,3,4 或其他 2x2 位置
      if (this.is2x2(indices)) {
        return { id: BLOCK.CRAFTING_TABLE, count: 1 };
      }
    }

    // 6 木板 -> 书架 (简化为6个木板)
    if (items.length === 6 && items.every(i => i.id === BLOCK.PLANKS)) {
      return { id: BLOCK.BOOKSHELF, count: 1 };
    }

    // 4 圆石 -> 砖块 (简化)
    if (items.length === 4 && items.every(i => i.id === BLOCK.COBBLESTONE)) {
      return { id: BLOCK.BRICK, count: 2 };
    }

    // 9 石头 -> 1 石头 (不消耗, 只做测试) — 实际不需要

    return null;
  }

  is2x2(indices) {
    // 检查是否构成 2x2 方形
    const set = new Set(indices);
    for (const start of [0, 1, 3, 4]) {
      if (set.has(start) && set.has(start + 1) && set.has(start + 3) && set.has(start + 4)) {
        return true;
      }
    }
    return false;
  }

  takeCraftingResult() {
    if (!this.currentCraftResult) return;
    const result = this.currentCraftResult;
    this.game.player.addItem(result.id, result.count);

    // 消耗合成材料
    for (let i = 0; i < 9; i++) {
      if (this.craftingGrid[i]) {
        this.craftingGrid[i].count--;
        if (this.craftingGrid[i].count <= 0) {
          this.craftingGrid[i] = null;
        }
      }
    }

    this.updateInventoryDisplay();
  }

  toggleInventory() {
    if (this.paused) return;
    this.inventoryOpen = !this.inventoryOpen;
    const screen = document.getElementById('inventory-screen');
    screen.classList.toggle('hidden', !this.inventoryOpen);

    if (this.inventoryOpen) {
      this.game.input.exitPointerLock();
      this.updateInventoryDisplay();
    } else {
      // 返回拖拽中的物品
      if (this.draggedSlot) {
        this.game.player.addItem(this.draggedSlot.id, this.draggedSlot.count);
        this.draggedSlot = null;
      }
      // 返回合成格中的物品
      if (this.craftingGrid) {
        for (let i = 0; i < 9; i++) {
          if (this.craftingGrid[i]) {
            this.game.player.addItem(this.craftingGrid[i].id, this.craftingGrid[i].count);
            this.craftingGrid[i] = null;
          }
        }
      }
      this.game.input.requestPointerLock();
    }
  }

  closeInventory() {
    if (this.inventoryOpen) this.toggleInventory();
  }

  // ===== 暂停菜单 =====
  initMenu() {
    document.getElementById('resume-btn').addEventListener('click', () => this.resume());
    document.getElementById('pause-settings-btn').addEventListener('click', () => this.showPauseSettings());
    document.getElementById('save-btn').addEventListener('click', () => {
      this.game.saveGame();
      this.showToast('游戏已保存');
    });
    document.getElementById('quit-btn').addEventListener('click', () => this.quitToMenu());
    document.getElementById('pause-settings-back').addEventListener('click', () => this.hidePauseSettings());
  }

  pause() {
    if (this.inventoryOpen) this.closeInventory();
    this.paused = true;
    this.game.input.exitPointerLock();
    document.getElementById('pause-menu').classList.remove('hidden');
  }

  resume() {
    this.paused = false;
    this.settingsOpen = false;
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('pause-settings').classList.add('hidden');
    this.game.input.requestPointerLock();
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  showPauseSettings() {
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('pause-settings').classList.remove('hidden');
    this.settingsOpen = true;
    this.syncSettingsToPause();
  }

  hidePauseSettings() {
    document.getElementById('pause-settings').classList.add('hidden');
    document.getElementById('pause-menu').classList.remove('hidden');
    this.settingsOpen = false;
  }

  quitToMenu() {
    this.paused = false;
    this.game.quitToMenu();
  }

  // ===== 设置 =====
  initSettings() {
    // 启动画面设置
    const sd = document.getElementById('set-render-distance');
    const ss = document.getElementById('set-sensitivity');
    const sf = document.getElementById('set-fog');
    const sfov = document.getElementById('set-fov');
    const sfps = document.getElementById('set-show-fps');

    ss.addEventListener('input', () => {
      document.getElementById('sensitivity-val').textContent = ss.value;
    });
    sfov.addEventListener('input', () => {
      document.getElementById('fov-val').textContent = sfov.value;
    });

    // 暂停菜单设置
    const sd2 = document.getElementById('set-render-distance-2');
    const ss2 = document.getElementById('set-sensitivity-2');
    const sf2 = document.getElementById('set-fog-2');
    const sfov2 = document.getElementById('set-fov-2');
    const sfps2 = document.getElementById('set-show-fps-2');

    ss2.addEventListener('input', () => {
      document.getElementById('sensitivity-val-2').textContent = ss2.value;
    });
    sfov2.addEventListener('input', () => {
      document.getElementById('fov-val-2').textContent = sfov2.value;
    });

    // 应用设置
    sd2.addEventListener('change', () => this.applySettings());
    ss2.addEventListener('change', () => this.applySettings());
    sf2.addEventListener('change', () => this.applySettings());
    sfov2.addEventListener('change', () => this.applySettings());
    sfps2.addEventListener('change', () => this.applySettings());
  }

  syncSettingsToPause() {
    const settings = this.game.settings;
    document.getElementById('set-render-distance-2').value = settings.renderDistance;
    document.getElementById('set-sensitivity-2').value = settings.sensitivity;
    document.getElementById('set-fog-2').checked = settings.fog;
    document.getElementById('set-fov-2').value = settings.fov;
    document.getElementById('set-show-fps-2').checked = settings.showFPS;
    document.getElementById('sensitivity-val-2').textContent = settings.sensitivity;
    document.getElementById('fov-val-2').textContent = settings.fov;
  }

  getSettingsFromSplash() {
    return {
      renderDistance: parseInt(document.getElementById('set-render-distance').value),
      sensitivity: parseFloat(document.getElementById('set-sensitivity').value),
      fog: document.getElementById('set-fog').checked,
      fov: parseInt(document.getElementById('set-fov').value),
      showFPS: document.getElementById('set-show-fps').checked,
    };
  }

  applySettings() {
    const settings = {
      renderDistance: parseInt(document.getElementById('set-render-distance-2').value),
      sensitivity: parseFloat(document.getElementById('set-sensitivity-2').value),
      fog: document.getElementById('set-fog-2').checked,
      fov: parseInt(document.getElementById('set-fov-2').value),
      showFPS: document.getElementById('set-show-fps-2').checked,
    };
    this.game.applySettings(settings);
  }

  // ===== 死亡画面 =====
  initDeath() {
    document.getElementById('respawn-btn').addEventListener('click', () => {
      this.game.respawnPlayer();
      document.getElementById('death-screen').classList.add('hidden');
    });
  }

  showDeath() {
    document.getElementById('death-screen').classList.remove('hidden');
    this.game.input.exitPointerLock();
  }

  // ===== 工具方法 =====
  showToast(msg, duration = 2000) {
    const toast = document.getElementById('toast-message');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  updateInfo(fps, coords, time) {
    const settings = this.game.settings;
    if (settings.showFPS) {
      document.getElementById('fps-display').textContent = `FPS: ${fps}`;
    } else {
      document.getElementById('fps-display').textContent = '';
    }
    document.getElementById('coords-display').textContent =
      `XYZ: ${coords.x.toFixed(1)} / ${coords.y.toFixed(1)} / ${coords.z.toFixed(1)}`;
    document.getElementById('time-display').textContent = `🕒 ${time}`;

    // 游戏模式显示
    const gmDisplay = document.getElementById('gamemode-display');
    if (gmDisplay) {
      const gm = this.game.gamemode;
      gmDisplay.textContent = `${GAMEMODE_ICONS[gm] || ''} ${GAMEMODE_NAMES[gm] || ''}`;
    }

    // 天气显示
    const wDisplay = document.getElementById('weather-display');
    if (wDisplay && this.game.weather) {
      wDisplay.textContent = this.game.weather.getWeatherName();
    }

    // 小游戏记分牌
    const sb = document.getElementById('minigame-scoreboard');
    if (sb && this.game.minigames) {
      if (this.game.minigames.isActive) {
        sb.classList.remove('hidden');
        const timeRem = this.game.minigames.getTimeRemaining();
        const scoreboard = this.game.minigames.getScoreboard();
        sb.textContent = `⏱️ ${timeRem}s\n${scoreboard || '暂无得分'}`;
      } else {
        sb.classList.add('hidden');
      }
    }
  }

  isAnyMenuOpen() {
    return this.paused || this.inventoryOpen || this.settingsOpen;
  }
}
