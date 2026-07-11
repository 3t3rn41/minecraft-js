/**
 * adventureUI.js — 冒险模式 HUD 渲染
 * 动态创建 DOM 元素，不依赖 index.html 预定义
 */

import { SHOP_ITEMS, SKILL_DEFS, HERO_WEAPONS } from './adventure.js';

export class AdventureUI {
  constructor(adventure) {
    this.adv = adventure;
    this.game = adventure.game;
    this.root = null;
    this._shopOpen = false;
    this._skillsOpen = false;
    this._shopCategory = 'weapons';
    this._shopItemIndex = 0;
    this._shopCatIndex = 0;
    this._shopCategories = ['weapons', 'consumables', 'defense', 'revive'];
    this._shopKeyHandler = null;
    this._deathOverlay = null;
    this._init();
  }

  _init() {
    // 如果已存在则先移除
    const existing = document.getElementById('adventure-hud');
    if (existing) existing.remove();

    this.root = document.createElement('div');
    this.root.id = 'adventure-hud';
    this.root.className = 'adventure-hud';
    this.root.innerHTML = `
      <!-- 顶部中央：波次信息 -->
      <div id="adv-wave-banner" class="adv-wave-banner"></div>
      <div id="adv-map-name" class="adv-map-name"></div>
      <div id="adv-mob-counter" class="adv-mob-counter">剩余: 0</div>

      <!-- 波次间倒计时 -->
      <div id="adv-intermission" class="adv-intermission hidden"></div>

      <!-- 左下：个人状态 -->
      <div class="adv-player-status">
        <div id="adv-gold" class="adv-gold">🪙 0</div>
        <div id="adv-skill-pts" class="adv-skill-pts"></div>
      </div>

      <!-- 右下：队友条 -->
      <div id="adv-teammates" class="adv-teammates"></div>

      <!-- 底中央：Boss血条 -->
      <div id="adv-bossbar" class="adv-bossbar hidden">
        <div id="adv-boss-name" class="adv-boss-name"></div>
        <div class="boss-hp-track"><div id="adv-boss-hp-fill" class="boss-hp-fill"></div></div>
        <div id="adv-boss-phase" class="adv-boss-phase"></div>
      </div>

      <!-- 商店面板 (B键) -->
      <div id="adv-shop" class="adv-shop hidden">
        <div class="adv-shop-header">
          <h2>🛒 武器商店</h2>
          <button class="adv-close-btn" data-action="close-shop">✕</button>
        </div>
        <div class="shop-categories">
          <button class="shop-cat-btn active" data-cat="weapons" data-cat-idx="0">武器 <span class="cat-key-hint">1</span></button>
          <button class="shop-cat-btn" data-cat="consumables" data-cat-idx="1">消耗品 <span class="cat-key-hint">2</span></button>
          <button class="shop-cat-btn" data-cat="defense" data-cat-idx="2">防御 <span class="cat-key-hint">3</span></button>
          <button class="shop-cat-btn" data-cat="revive" data-cat-idx="3">复活 <span class="cat-key-hint">4</span></button>
        </div>
        <div class="shop-list" id="adv-shop-list"></div>
        <div class="shop-my-gold">我的金币: <span id="adv-shop-gold">0</span></div>
        <div class="shop-keyboard-hint">⌨ ↑↓选择 ←→/1-4切换分类 Enter购买 Esc关闭</div>
      </div>

      <!-- 技能树面板 (N键) -->
      <div id="adv-skills" class="adv-skills hidden">
        <div class="adv-skills-header">
          <h2>🌟 技能树</h2>
          <button class="adv-close-btn" data-action="close-skills">✕</button>
        </div>
        <div class="adv-skill-points">可用技能点: <span id="adv-avail-sp">0</span></div>
        <div class="skill-tree-cols" id="adv-skill-tree"></div>
      </div>

      <!-- 排行榜 (K键) -->
      <div id="adv-leaderboard" class="adv-leaderboard hidden">
        <div class="adv-leaderboard-header">
          <h2>🏆 周排行榜</h2>
          <button class="adv-close-btn" data-action="close-leaderboard">✕</button>
        </div>
        <div class="leaderboard-week" id="adv-lb-week"></div>
        <div class="leaderboard-list" id="adv-lb-list"></div>
      </div>

      <!-- 每日任务 -->
      <div id="adv-daily" class="adv-daily hidden">
        <div class="adv-daily-header">
          <h2>📋 每日任务</h2>
          <button class="adv-close-btn" data-action="close-daily">✕</button>
        </div>
        <div id="adv-daily-list"></div>
      </div>

      <!-- 结算弹窗 -->
      <div id="adv-grade" class="adv-grade hidden">
        <div class="grade-content">
          <div class="grade-badge" id="adv-grade-badge"></div>
          <div class="grade-detail" id="adv-grade-detail"></div>
          <div class="grade-reward" id="adv-grade-reward"></div>
          <div class="grade-buttons">
            <button class="menu-btn primary" id="adv-grade-next">继续下一关</button>
            <button class="menu-btn" id="adv-grade-menu">返回主菜单</button>
          </div>
        </div>
      </div>

      <!-- 死亡覆盖层 -->
      <div id="adv-death-overlay" class="adv-death-overlay hidden">
        <div class="death-text">你阵亡了</div>
        <div class="respawn-timer" id="adv-respawn-timer">5</div>
        <div class="death-hint">等待复活...</div>
      </div>

      <!-- 提示信息 -->
      <div id="adv-toast" class="adv-toast"></div>
    `;

    // 挂载到游戏容器
    const container = document.getElementById('game-container') || document.body;
    container.appendChild(this.root);

    this._bindEvents();
    console.log('[ADV-UI] AdventureUI initialized');
  }

  _bindEvents() {
    // 商店分类切换
    this.root.querySelectorAll('.shop-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catIdx = parseInt(btn.dataset.catIdx) || 0;
        this._shopCatIndex = catIdx;
        this._shopCategory = btn.dataset.cat;
        this._shopItemIndex = 0;
        this.renderShop();
      });
    });

    // 关闭按钮
    this.root.querySelector('[data-action="close-shop"]').addEventListener('click', () => this.toggleShop(false));
    this.root.querySelector('[data-action="close-skills"]').addEventListener('click', () => this.toggleSkills(false));
    this.root.querySelector('[data-action="close-daily"]').addEventListener('click', () => this.toggleDaily(false));
    this.root.querySelector('[data-action="close-leaderboard"]').addEventListener('click', () => this.toggleLeaderboard(false));

    // 结算按钮
    const nextBtn = this.root.querySelector('#adv-grade-next');
    const menuBtn = this.root.querySelector('#adv-grade-menu');
    nextBtn.addEventListener('click', () => {
      this.hideGrade();
      this.adv.nextMap();
    });
    menuBtn.addEventListener('click', () => {
      this.hideGrade();
      // 返回主菜单
      if (this.game.ui) this.game.ui.quitToMenu();
    });
  }

  show() {
    this.root.classList.remove('hidden');
    // 更新地图名
    const mapName = this.root.querySelector('#adv-map-name');
    if (mapName && this.adv.wave) {
      mapName.textContent = this.adv.wave.currentMap.nameZh;
    }
  }

  hide() {
    this.root.classList.add('hidden');
  }

  // ===== 波次横幅 =====
  renderWaveBanner(waveNum, totalWaves, state) {
    const banner = this.root.querySelector('#adv-wave-banner');
    const mapName = this.root.querySelector('#adv-map-name');
    if (!banner) return;

    const stateText = state === 'intermission' ? '准备中' : state === 'fighting' ? '战斗中' : state === 'spawning' ? '刷新中' : '';
    banner.textContent = `Wave ${waveNum} / ${totalWaves} — ${stateText}`;

    if (mapName && this.adv.wave) {
      mapName.textContent = this.adv.wave.currentMap.nameZh;
    }

    // 显示动画
    banner.classList.remove('banner-flash');
    void banner.offsetWidth; // 强制重排
    banner.classList.add('banner-flash');
  }

  updateMobCounter(n) {
    const el = this.root.querySelector('#adv-mob-counter');
    if (el) el.textContent = `剩余: ${n}`;
  }

  // ===== 金币显示 =====
  updateGold(amount) {
    const el = this.root.querySelector('#adv-gold');
    if (el) el.textContent = `🪙 ${amount}`;

    const shopGold = this.root.querySelector('#adv-shop-gold');
    if (shopGold) shopGold.textContent = amount;

    // 技能点显示
    const sp = this.root.querySelector('#adv-skill-pts');
    if (sp && this.game.player) {
      const pts = this.game.player.skillPoints || 0;
      sp.textContent = pts > 0 ? `★ 技能 +${pts}` : '';
      sp.style.display = pts > 0 ? '' : 'none';
    }
  }

  // ===== 准备期倒计时 =====
  updateIntermission(seconds) {
    const el = this.root.querySelector('#adv-intermission');
    if (!el) return;
    if (seconds > 0) {
      el.textContent = `下一波 ${seconds}s`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // ===== Boss 血条 =====
  updateBossBar(name, pct, phase) {
    const bar = this.root.querySelector('#adv-bossbar');
    if (!bar) return;
    if (!name || pct <= 0) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    this.root.querySelector('#adv-boss-name').textContent = name;
    this.root.querySelector('#adv-boss-hp-fill').style.width = `${Math.max(0, pct * 100)}%`;
    this.root.querySelector('#adv-boss-phase').textContent = `Phase ${phase}`;
  }

  // ===== 队友条 =====
  renderTeammates(teammates) {
    const el = this.root.querySelector('#adv-teammates');
    if (!el) return;
    el.innerHTML = '';
    if (!teammates || teammates.length === 0) return;

    for (const t of teammates) {
      const div = document.createElement('div');
      div.className = 'teammate-bar';
      div.innerHTML = `
        <span class="teammate-name">${t.name}</span>
        <div class="teammate-hp-track">
          <div class="teammate-hp-fill" style="width:${(t.health / t.maxHealth) * 100}%"></div>
        </div>
        <span class="teammate-gold">🪙${t.gold || 0}</span>
      `;
      el.appendChild(div);
    }
  }

  // ===== 商店面板 =====
  toggleShop(force) {
    this._shopOpen = force !== undefined ? force : !this._shopOpen;
    const shop = this.root.querySelector('#adv-shop');
    if (this._shopOpen) {
      this.toggleSkills(false);
      this.toggleDaily(false);
      this.toggleLeaderboard(false);
      shop.classList.remove('hidden');
      this._shopItemIndex = 0;
      this._shopCatIndex = 0;
      this._shopCategory = 'weapons';
      this.renderShop();
      // 退出指针锁定，允许鼠标和键盘交互
      if (this.game.input && this.game.input.pointerLocked) {
        this.game.input.exitPointerLock();
      }
      // 添加键盘事件监听（PC端键盘导航）
      if (!this.game.isMobile) {
        this._shopKeyHandler = (e) => this._handleShopKeydown(e);
        document.addEventListener('keydown', this._shopKeyHandler);
      }
    } else {
      shop.classList.add('hidden');
      // 移除键盘事件监听
      if (this._shopKeyHandler) {
        document.removeEventListener('keydown', this._shopKeyHandler);
        this._shopKeyHandler = null;
      }
      // 恢复指针锁定
      if (this.game.input && !this.game.isMobile) {
        const uiPaused = this.game.ui && this.game.ui.paused;
        const invOpen = this.game.ui && this.game.ui.inventoryOpen;
        if (!uiPaused && !invOpen) {
          this.game.input.requestPointerLock();
        }
      }
    }
  }

  // ===== 商店键盘导航 =====
  _handleShopKeydown(e) {
    if (!this._shopOpen) return;

    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        this._navigateShopItem(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._navigateShopItem(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this._navigateShopCategory(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._navigateShopCategory(1);
        break;
      case 'Enter':
        e.preventDefault();
        this._purchaseSelectedItem();
        break;
      case 'Escape':
        e.preventDefault();
        this.toggleShop(false);
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4': {
        e.preventDefault();
        const catIdx = parseInt(e.code.replace('Digit', '')) - 1;
        if (catIdx >= 0 && catIdx < this._shopCategories.length) {
          this._shopCatIndex = catIdx;
          this._shopCategory = this._shopCategories[catIdx];
          this._shopItemIndex = 0;
          this.renderShop();
        }
        break;
      }
    }
  }

  _navigateShopItem(direction) {
    const list = this.root.querySelector('#adv-shop-list');
    if (!list) return;
    const itemCount = list.children.length;
    if (itemCount === 0) return;
    this._shopItemIndex = (this._shopItemIndex + direction + itemCount) % itemCount;
    this._updateShopSelection();
  }

  _navigateShopCategory(direction) {
    const count = this._shopCategories.length;
    this._shopCatIndex = (this._shopCatIndex + direction + count) % count;
    this._shopCategory = this._shopCategories[this._shopCatIndex];
    this._shopItemIndex = 0;
    this.renderShop();
  }

  _updateShopSelection() {
    const list = this.root.querySelector('#adv-shop-list');
    if (!list) return;
    Array.from(list.children).forEach((el, i) => {
      el.classList.toggle('keyboard-selected', i === this._shopItemIndex);
    });
    // 滚动到选中项
    const selected = list.children[this._shopItemIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  _updateCategorySelection() {
    this.root.querySelectorAll('.shop-cat-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === this._shopCatIndex);
      btn.classList.toggle('keyboard-selected', i === this._shopCatIndex);
    });
  }

  _purchaseSelectedItem() {
    const list = this.root.querySelector('#adv-shop-list');
    if (!list) return;
    const selected = list.children[this._shopItemIndex];
    if (!selected) return;
    const itemId = selected.dataset.itemId;
    this._purchaseItem(itemId);
  }

  _purchaseItem(itemId) {
    // 英雄武器：提前检查是否已集齐，避免显示"金币不足"的误导提示
    if (itemId === 'hero') {
      const owned = this.adv.econ._getOwnedHeroWeapons(this.adv.localPlayerId);
      this.adv.econ._scanLocalHeroWeapons();
      if (HERO_WEAPONS.every(w => owned.has(w.blockId))) {
        this.showToast('已拥有全部英雄武器！', 1500);
        return;
      }
    }
    const success = this.adv.econ.buyItem(this.adv.localPlayerId, itemId);
    if (success) {
      this.renderShop();
      this.updateGold(this.adv.econ.getGold(this.adv.localPlayerId));
      // 刷新快捷栏显示
      if (this.game.ui) this.game.ui.updateHotbar();
    } else if (!this.adv.isClient) {
      // buyItem 内部已对英雄武器集齐的情况做了提示，这里只处理金币不足
      if (itemId !== 'hero') {
        this.showToast('金币不足！', 1000);
      }
    } else {
      this.showToast('购买请求已发送...', 1000);
    }
  }

  renderShop() {
    const list = this.root.querySelector('#adv-shop-list');
    if (!list) return;
    list.innerHTML = '';

    const myGold = this.adv.econ.getGold(this.adv.localPlayerId);
    // 获取已拥有的英雄武器
    const ownedHeroWeapons = this.adv.econ._getOwnedHeroWeapons(this.adv.localPlayerId);
    let itemIndex = 0;

    for (const [itemId, item] of Object.entries(SHOP_ITEMS)) {
      if (item.cat !== this._shopCategory) continue;
      const canAfford = myGold >= item.price;
      const isSelected = itemIndex === this._shopItemIndex;

      // 英雄武器：检查是否已拥有全部
      let heroInfo = '';
      let heroAllOwned = false;
      if (itemId === 'hero') {
        const ownedCount = HERO_WEAPONS.filter(w => ownedHeroWeapons.has(w.blockId)).length;
        heroAllOwned = ownedCount >= HERO_WEAPONS.length;
        const ownedNames = HERO_WEAPONS.filter(w => ownedHeroWeapons.has(w.blockId)).map(w => w.name);
        if (ownedCount > 0) {
          heroInfo = `<div class="shop-hero-info">已拥有: ${ownedNames.join('、')}${heroAllOwned ? '（全部集齐）' : `（${ownedCount}/${HERO_WEAPONS.length}）`}</div>`;
        } else {
          heroInfo = `<div class="shop-hero-info">随机获得一把英雄武器（${HERO_WEAPONS.length}把可选）</div>`;
        }
      }

      const disabled = !canAfford || heroAllOwned;
      const div = document.createElement('div');
      div.className = `shop-item ${disabled ? 'disabled' : ''} ${isSelected ? 'keyboard-selected' : ''}`;
      div.dataset.itemId = itemId;
      div.innerHTML = `
        <div class="shop-item-info">
          <span class="shop-item-name">${item.name}${heroAllOwned ? ' ✓' : ''}</span>
          <span class="shop-item-price">🪙 ${item.price}</span>
          ${heroInfo}
        </div>
        <button class="shop-buy-btn" ${disabled ? 'disabled' : ''}>${heroAllOwned ? '已集齐' : '购买'}</button>
      `;
      const btn = div.querySelector('.shop-buy-btn');
      if (!disabled) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._purchaseItem(itemId);
        });
      }
      // 鼠标点击行也可以选中
      div.addEventListener('click', () => {
        this._shopItemIndex = itemIndex;
        this._updateShopSelection();
      });
      list.appendChild(div);
      itemIndex++;
    }

    // 更新分类按钮高亮
    this._updateCategorySelection();
  }

  // ===== 技能树面板 =====
  toggleSkills(force) {
    this._skillsOpen = force !== undefined ? force : !this._skillsOpen;
    const panel = this.root.querySelector('#adv-skills');
    if (this._skillsOpen) {
      this.toggleShop(false);
      this.toggleDaily(false);
      this.toggleLeaderboard(false);
      panel.classList.remove('hidden');
      this.renderSkills();
    } else {
      panel.classList.add('hidden');
    }
  }

  renderSkills() {
    const container = this.root.querySelector('#adv-skill-tree');
    const spEl = this.root.querySelector('#adv-avail-sp');
    if (!container) return;

    const player = this.game.player;
    const available = player ? (player.skillPoints || 0) : 0;
    if (spEl) spEl.textContent = available;

    container.innerHTML = '';

    const cols = {
      combat: { title: '⚔️ 战斗', color: '#e74c3c', skills: [] },
      survival: { title: '🛡️ 生存', color: '#2ecc71', skills: [] },
      support: { title: '💎 辅助', color: '#3498db', skills: [] },
    };

    for (const [key, def] of Object.entries(SKILL_DEFS)) {
      if (cols[def.col]) cols[def.col].skills.push({ key, ...def });
    }

    for (const col of Object.values(cols)) {
      const colDiv = document.createElement('div');
      colDiv.className = 'skill-col';
      colDiv.innerHTML = `<h3 style="color:${col.color}">${col.title}</h3>`;

      for (const skill of col.skills) {
        const level = (player && player.skills && player.skills[skill.key]) || 0;
        const maxed = level >= skill.max;
        const canUpgrade = available > 0 && !maxed;

        const skillDiv = document.createElement('div');
        skillDiv.className = `skill-slot ${maxed ? 'maxed' : ''} ${canUpgrade ? 'upgradable' : ''}`;
        skillDiv.innerHTML = `
          <div class="skill-name">${skill.name}</div>
          <div class="skill-level">${'★'.repeat(level)}${'☆'.repeat(skill.max - level)}</div>
          <div class="skill-desc">${skill.desc}</div>
          <button class="skill-upgrade-btn" ${canUpgrade ? '' : 'disabled'}>${maxed ? 'MAX' : '升级'}</button>
        `;
        const btn = skillDiv.querySelector('.skill-upgrade-btn');
        btn.addEventListener('click', () => {
          if (player && player.upgradeSkill(skill.key)) {
            this.renderSkills();
            this.updateGold(this.adv.econ.getGold(this.adv.localPlayerId));
            this.showToast(`技能升级: ${skill.name}`, 1000);
          }
        });
        colDiv.appendChild(skillDiv);
      }
      container.appendChild(colDiv);
    }
  }

  // ===== 每日任务 =====
  toggleDaily(force) {
    const panel = this.root.querySelector('#adv-daily');
    const open = force !== undefined ? force : panel.classList.contains('hidden');
    if (open) {
      this.toggleShop(false);
      this.toggleSkills(false);
      this.toggleLeaderboard(false);
      panel.classList.remove('hidden');
      this.renderDailyMissions();
    } else {
      panel.classList.add('hidden');
    }
  }

  renderDailyMissions() {
    const list = this.root.querySelector('#adv-daily-list');
    if (!list || !this.adv.daily) return;
    this.adv.daily.loadToday();
    list.innerHTML = '';

    for (const m of this.adv.daily.missions) {
      const pct = (m.progress / m.target) * 100;
      const done = m.progress >= m.target;
      const div = document.createElement('div');
      div.className = `daily-mission ${done ? 'completed' : ''}`;
      div.innerHTML = `
        <div class="mission-desc">${m.desc}</div>
        <div class="mission-progress-bar">
          <div class="mission-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="mission-info">
          <span>${m.progress}/${m.target}</span>
          <span>🪙 ${m.reward}</span>
          ${done ? '<span class="mission-done">✅ 已完成</span>' : ''}
        </div>
      `;
      list.appendChild(div);
    }
  }

  // ===== 结算弹窗 =====
  showGrade(grade, rewards) {
    const panel = this.root.querySelector('#adv-grade');
    if (!panel) return;
    panel.classList.remove('hidden');

    const badge = this.root.querySelector('#adv-grade-badge');
    const detail = this.root.querySelector('#adv-grade-detail');
    const reward = this.root.querySelector('#adv-grade-reward');

    const colors = { S: '#ffd700', A: '#9b59b6', B: '#3498db', C: '#2ecc71', F: '#e74c3c' };
    badge.textContent = grade;
    badge.style.color = colors[grade] || '#fff';
    badge.style.textShadow = `0 0 20px ${colors[grade] || '#fff'}`;

    if (rewards.details) {
      let html = '';
      for (const [key, val] of Object.entries(rewards.details)) {
        const labels = {
          timeScore: '时间分',
          damageScore: '受伤分',
          accuracyScore: '命中率',
          goldScore: '金币效率',
          bossNoDeath: 'Boss无伤',
          overall: '综合',
        };
        html += `<div class="grade-row"><span>${labels[key] || key}</span><span>${val}</span></div>`;
      }
      detail.innerHTML = html;
    }

    if (rewards.baseGold !== undefined) {
      reward.innerHTML = `
        <div>基础金币: 🪙 ${rewards.baseGold}</div>
        <div>评级倍率: ×${rewards.multi}</div>
        <div class="reward-total">总奖励: 🪙 ${rewards.rewardGold}</div>
      `;
    }

    // 如果是最后一张图，修改按钮文字
    const nextBtn = this.root.querySelector('#adv-grade-next');
    if (this.adv.wave.mapIndex >= 3) { // 最后一张图
      nextBtn.textContent = '返回主菜单';
      nextBtn.onclick = () => {
        this.hideGrade();
        if (this.game.ui) this.game.ui.quitToMenu();
      };
    }
  }

  hideGrade() {
    const panel = this.root.querySelector('#adv-grade');
    if (panel) panel.classList.add('hidden');
  }

  // ===== 死亡覆盖层 =====
  showDeathOverlay(seconds) {
    if (!this._deathOverlay) {
      this._deathOverlay = this.root.querySelector('#adv-death-overlay');
    }
    if (this._deathOverlay) {
      this._deathOverlay.classList.remove('hidden');
      this.updateRespawnTimer(Math.ceil(seconds));
    }
  }

  hideDeathOverlay() {
    if (this._deathOverlay) {
      this._deathOverlay.classList.add('hidden');
    }
  }

  updateRespawnTimer(seconds) {
    const el = this.root.querySelector('#adv-respawn-timer');
    if (el) el.textContent = seconds;
  }

  // ===== Toast 通知 =====
  showToast(msg, duration = 2000) {
    // 优先使用游戏 UI 的 toast
    if (this.game.ui && this.game.ui.showToast) {
      this.game.ui.showToast(msg, duration);
      return;
    }
    const toast = this.root.querySelector('#adv-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ===== 排行榜 =====
  toggleLeaderboard(force) {
    const panel = this.root.querySelector('#adv-leaderboard');
    if (!panel) return;
    const open = force !== undefined ? force : panel.classList.contains('hidden');
    if (open) {
      this.toggleShop(false);
      this.toggleSkills(false);
      this.toggleDaily(false);
      panel.classList.remove('hidden');
      this.renderLeaderboard();
    } else {
      panel.classList.add('hidden');
    }
  }

  renderLeaderboard() {
    const listEl = this.root.querySelector('#adv-lb-list');
    const weekEl = this.root.querySelector('#adv-lb-week');
    if (!listEl || !this.adv.leaderboard) return;

    // 显示当前周标识
    if (weekEl) {
      weekEl.textContent = `本周: ${this.adv.leaderboard.weekKey}`;
    }

    const entries = this.adv.leaderboard.getTopEntries(20);
    listEl.innerHTML = '';

    if (entries.length === 0) {
      listEl.innerHTML = '<div class="lb-empty">暂无记录，快来挑战吧！</div>';
      return;
    }

    const gradeColors = { S: '#ffd700', A: '#9b59b6', B: '#3498db', C: '#2ecc71', F: '#e74c3c' };

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
      const mins = Math.floor(e.timeSec / 60);
      const secs = e.timeSec % 60;
      const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

      const div = document.createElement('div');
      div.className = `lb-row ${rank <= 3 ? 'lb-top' : ''}`;
      div.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-grade" style="color:${gradeColors[e.grade] || '#fff'};text-shadow:0 0 6px ${gradeColors[e.grade] || '#fff'}">${e.grade}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-map">${e.mapName}</span>
        <span class="lb-time">⏱ ${timeStr}</span>
        <span class="lb-gold">🪙 ${e.gold}</span>
        <span class="lb-players">${e.playerCount}P</span>
      `;
      listEl.appendChild(div);
    }
  }

  // ===== 清理 =====
  destroy() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}
