/**
 * ui.js — 完整游戏 UI 系统
 * 包含：快捷栏、背包、合成、生命值、饥饿值、暂停菜单、设置、死亡画面
 */

import { BLOCK_DEFS, BLOCK, generateBlockIcon, PLACEABLE_BLOCKS } from './blocks.js';
import { GAMEMODE_NAMES, GAMEMODE_ICONS, GAMEMODE, GAMEMODE_CONFIG } from './gamemodes.js';
import { matchRecipeFromInventory, getRecipeList, ITEM_TYPE, TOOL_MATERIAL, ARMOR_MATERIAL } from './crafting.js';

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
    this.initExperiencePanel();
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

  // ===== 手持方块显示（已由3D视图模型取代） =====
  updateHeldBlockDisplay() {
    // 手持物品现由 HeldItemViewModel (3D) 和 PlayerModel.setHeldItem (第三人称) 处理
    // 此方法保留为空以兼容旧调用
    const display = document.getElementById('held-block-display');
    if (display) display.style.display = 'none';
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
    if (!list) return;
    const allRecipes = getRecipeList();
    list.innerHTML = allRecipes.map(r => `<div class="recipe-item">${r.name}</div>`).join('');
  }

  // ===== 体验模式物品面板 =====
  initExperiencePanel() {
    const searchInput = document.getElementById('experience-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this._populateExperienceItems(searchInput.value);
      });
    }
  }

  // 判断当前是否为体验模式
  isExperienceMode() {
    return this.game.player && this.game.player.gamemode === GAMEMODE.EXPERIENCE;
  }

  // 打开背包时根据模式显示/隐藏体验面板
  updateExperiencePanelVisibility() {
    const panel = document.getElementById('experience-panel');
    if (!panel) return;
    const show = this.isExperienceMode();
    panel.classList.toggle('hidden', !show);
    if (show) {
      this._populateExperienceItems('');
    }
  }

  // 获取所有可用的物品列表（合成配方产出 + 所有方块 + 工具/武器/护甲）
  _getExperienceItemlist() {
    const items = [];
    const seen = new Set();

    // 1. 从合成配方中提取所有产出物品
    const recipes = getRecipeList();
    for (const recipe of recipes) {
      const result = recipe.result;
      let blockId = 0;
      let name = recipe.name;
      let category = '合成物品';

      if (result.blockId !== undefined) {
        blockId = result.blockId;
        const def = BLOCK_DEFS[blockId];
        name = def ? def.name : recipe.name;
        category = '方块';
      } else if (result.itemId !== undefined) {
        // 通过 crafting.js 的映射查找
        blockId = this._resolveItemId(result.itemId);
        if (blockId > 0) {
          const def = BLOCK_DEFS[blockId];
          name = def ? def.name : recipe.name;
        }
        category = '物品';
      } else if (result.toolType !== undefined) {
        // 工具/武器 — 使用动态 ID
        blockId = this._getOrCreateToolId(result.toolType, result.material);
        name = recipe.name;
        category = result.toolType === 'sword' ? '武器' : '工具';
      } else if (result.armorType !== undefined) {
        blockId = this._getOrCreateToolId(result.armorType, result.material);
        name = recipe.name;
        category = '护甲';
      }

      if (blockId > 0 && !seen.has(blockId)) {
        seen.add(blockId);
        items.push({ id: blockId, name, count: result.count || 1, category, recipe });
      }
    }

    // 2. 添加所有有定义的方块/物品
    for (const [idStr, def] of Object.entries(BLOCK_DEFS)) {
      const id = parseInt(idStr);
      if (id === 0 || seen.has(id)) continue;
      if (def.name && def.name !== '空气') {
        let category = '方块';
        if (!def.solid && def.transparent && !PLACEABLE_BLOCKS.includes(id)) {
          category = '物品';
        }
        items.push({ id, name: def.name, count: 1, category });
        seen.add(id);
      }
    }

    return items;
  }

  // 工具/护甲动态 ID 映射
  _getOrCreateToolId(type, material) {
    if (!this._toolIdMap) this._toolIdMap = {};
    if (!this._nextToolId) this._nextToolId = 20000;
    const key = `${type}:${material}`;
    if (!this._toolIdMap[key]) {
      this._toolIdMap[key] = this._nextToolId++;
      // 同时记录工具属性供使用
      if (!this.game.player.toolData) this.game.player.toolData = {};
      this.game.player.toolData[this._toolIdMap[key]] = {
        toolType: type,
        material: material,
        name: `${TOOL_MATERIAL[material?.toUpperCase()]?.name || material}${type === 'sword' ? '剑' : type === 'pickaxe' ? '镐' : type === 'axe' ? '斧' : type === 'shovel' ? '锹' : type === 'hoe' ? '锄' : type === 'helmet' ? '头盔' : type === 'chestplate' ? '胸甲' : type === 'leggings' ? '护腿' : type === 'boots' ? '靴子' : type}`,
        durability: (TOOL_MATERIAL[material?.toUpperCase()] || {}).durability || 60,
      };
    }
    return this._toolIdMap[key];
  }

  // 解析 ITEM_TYPE 到 BLOCK ID
  _resolveItemId(itemId) {
    const map = {
      [ITEM_TYPE.STICK]: BLOCK.STICK,
      [ITEM_TYPE.STRING]: BLOCK.STRING_ITEM,
      [ITEM_TYPE.BOW]: BLOCK.BOW,
      [ITEM_TYPE.CROSSBOW]: BLOCK.CROSSBOW,
      [ITEM_TYPE.TRIDENT]: BLOCK.TRIDENT,
      [ITEM_TYPE.ARROW]: BLOCK.ARROW,
      [ITEM_TYPE.SPECTRAL_ARROW]: BLOCK.SPECTRAL_ARROW,
      [ITEM_TYPE.SNOWBALL]: BLOCK.SNOWBALL,
      [ITEM_TYPE.EGG]: BLOCK.EGG_ITEM,
      [ITEM_TYPE.ENDER_PEARL]: BLOCK.ENDER_PEARL,
      [ITEM_TYPE.FIREWORK_ROCKET]: BLOCK.FIREWORK_ROCKET,
      [ITEM_TYPE.FISHING_ROD]: BLOCK.FISHING_ROD,
      [ITEM_TYPE.BUCKET]: BLOCK.BUCKET,
      [ITEM_TYPE.PAPER]: BLOCK.PAPER,
      [ITEM_TYPE.BOOK]: BLOCK.BOOK,
      [ITEM_TYPE.BREAD]: BLOCK.BREAD,
      [ITEM_TYPE.LEATHER]: BLOCK.LEATHER,
      [ITEM_TYPE.IRON_INGOT]: BLOCK.IRON_INGOT,
      [ITEM_TYPE.GOLD_INGOT]: BLOCK.GOLD_INGOT,
      [ITEM_TYPE.DIAMOND]: BLOCK.DIAMOND_GEM,
      [ITEM_TYPE.EMERALD]: BLOCK.EMERALD_GEM,
      [ITEM_TYPE.COAL]: BLOCK.COAL_ITEM,
      [ITEM_TYPE.WHEAT]: BLOCK.WHEAT_ITEM,
      [ITEM_TYPE.APPLE]: BLOCK.APPLE,
    };
    return map[itemId] || 0;
  }

  // 填充体验面板物品列表
  _populateExperienceItems(searchQuery) {
    const container = document.getElementById('experience-items');
    if (!container) return;

    const allItems = this._getExperienceItemlist();
    const query = (searchQuery || '').toLowerCase().trim();
    const filtered = query
      ? allItems.filter(item => item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
      : allItems;

    container.innerHTML = '';
    for (const item of filtered) {
      const slot = document.createElement('div');
      slot.className = 'experience-item';
      slot.title = `${item.name} (${item.category})`;

      const icon = document.createElement('img');
      icon.className = 'inv-slot-icon';
      icon.src = generateBlockIcon(item.id) || '';
      slot.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'experience-item-name';
      label.textContent = item.name;
      slot.appendChild(label);

      slot.addEventListener('click', () => {
        // 直接给予玩家该物品
        this.game.player.addItem(item.id, item.count || 1, true);
        this.updateInventoryDisplay();
        this.showToast(`已获得: ${item.name}`, 800);
      });

      container.appendChild(slot);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="experience-empty">未找到匹配物品</div>';
    }
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

  // 配方匹配 — 使用 crafting.js 的完整配方系统
  matchRecipe(grid) {
    return matchRecipeFromInventory(grid);
  }

  takeCraftingResult() {
    if (!this.currentCraftResult) return;
    const result = this.currentCraftResult;

    // 根据结果类型创建物品
    if (result.resultType === 'tool') {
      // 工具/武器
      this.game.player.addItem(result.id, result.count);
      // 记录工具属性
      if (!this.game.player.toolData) this.game.player.toolData = {};
      this.game.player.toolData[result.id] = {
        toolType: result.toolType,
        material: result.material,
        name: result.name,
        durability: (TOOL_MATERIAL[result.material.toUpperCase()] || {}).durability || 60,
      };
    } else if (result.resultType === 'armor') {
      // 护甲
      this.game.player.addItem(result.id, result.count);
      if (!this.game.player.toolData) this.game.player.toolData = {};
      this.game.player.toolData[result.id] = {
        armorType: result.armorType,
        material: result.material,
        name: result.name,
      };
    } else if (result.recipe && result.recipe.id === 'shield') {
      // 盾牌 — 存入 toolData 以便3D建模系统识别
      this.game.player.addItem(result.id, result.count);
      if (!this.game.player.toolData) this.game.player.toolData = {};
      this.game.player.toolData[result.id] = {
        toolType: 'shield',
        material: 'iron',
        name: result.name,
      };
    } else {
      // 普通方块/物品
      this.game.player.addItem(result.id, result.count);
    }

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
      this.updateExperiencePanelVisibility();
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
