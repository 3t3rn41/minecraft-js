/**
 * achievements.js — 成就系统 + 经验/等级
 */

export const ACHIEVEMENTS = [
  { id: 'first_block', name: '第一次挖掘', desc: '挖掘你的第一个方块', icon: '⛏️', xp: 10 },
  { id: 'first_tree', name: '伐木工', desc: '砍倒一棵树', icon: '🌳', xp: 20 },
  { id: 'first_stone', name: '石器时代', desc: '挖掘第一块石头', icon: '🪨', xp: 15 },
  { id: 'first_craft', name: '工匠', desc: '合成你的第一个物品', icon: '🔨', xp: 25 },
  { id: 'first_kill', name: '战士', desc: '击杀第一个生物', icon: '⚔️', xp: 30 },
  { id: 'first_death', name: '阵亡', desc: '第一次死亡', icon: '💀', xp: 5 },
  { id: 'survive_night', name: '夜猫子', desc: '在夜晚存活', icon: '🌙', xp: 50 },
  { id: 'diamonds', name: '钻石！', desc: '挖掘到钻石矿石', icon: '💎', xp: 100 },
  { id: 'build_house', name: '建筑师', desc: '放置 100 个方块', icon: '🏠', xp: 50 },
  { id: 'explore', name: '探险家', desc: '走到距离出生点 100 格外', icon: '🧭', xp: 40 },
  { id: 'deep_dive', name: '深海探险', desc: '到达 Y=5 以下', icon: '🕳️', xp: 60 },
  { id: 'sky_high', name: '冲上云霄', desc: '到达 Y=50 以上', icon: '☁️', xp: 40 },
  { id: 'tnt_master', name: '爆破专家', desc: '引爆 TNT', icon: '🧨', xp: 50 },
  { id: 'mob_slayer', name: '屠夫', desc: '击杀 10 个生物', icon: '🗡️', xp: 80 },
  { id: 'full_inventory', name: '收藏家', desc: '填满整个背包', icon: '🎒', xp: 60 },
  { id: 'eat_food', name: '美食家', desc: '吃第一口食物', icon: '🍖', xp: 15 },
  { id: 'multijoin', name: '社交达人', desc: '加入多人游戏', icon: '🤝', xp: 30 },
  { id: 'weather', name: '风雨无阻', desc: '在雷暴中存活', icon: '⛈️', xp: 40 },
  { id: 'speedrun', name: '速通', desc: '5分钟内挖到钻石', icon: '⏱️', xp: 200 },
  { id: 'pvp_win', name: 'PvP冠军', desc: '在PvP中击败一名玩家', icon: '🏆', xp: 100 },
];

export class AchievementSystem {
  constructor(game) {
    this.game = game;
    this.unlocked = new Set();
    this.xp = 0;
    this.level = 0;
    this.killCount = 0;
    this.blocksPlaced = 0;
    this.blocksBroken = 0;
    this.gameStartTime = Date.now();
    this.foundDiamonds = false;

    // 从存档加载
    if (game.save) {
      const data = game.save.load();
      if (data && data.achievements) {
        this.unlocked = new Set(data.achievements.unlocked || []);
        this.xp = data.achievements.xp || 0;
        this.level = data.achievements.level || 0;
        this.killCount = data.achievements.killCount || 0;
      }
    }

    this.updateLevel();
  }

  unlock(id) {
    if (this.unlocked.has(id)) return;
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;

    this.unlocked.add(id);
    this.addXP(ach.xp);
    this.showAchievement(ach);
  }

  showAchievement(ach) {
    // 创建成就通知
    const container = document.getElementById('achievement-notifications') || this.createNotificationContainer();
    const div = document.createElement('div');
    div.className = 'achievement-notification';
    div.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-text">
        <div class="achievement-title">${ach.name}</div>
        <div class="achievement-desc">${ach.desc}</div>
        <div class="achievement-xp">+${ach.xp} XP</div>
      </div>
    `;
    container.appendChild(div);

    // 动画
    setTimeout(() => div.classList.add('show'), 10);
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 500);
    }, 4000);
  }

  createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'achievement-notifications';
    container.style.cssText = 'position:fixed;top:60px;right:20px;z-index:1500;pointer-events:none;';
    document.body.appendChild(container);
    return container;
  }

  addXP(amount) {
    this.xp += amount;
    this.updateLevel();
  }

  updateLevel() {
    // 等级公式：每级需要 level * 100 + 100 XP
    let total = 0;
    let level = 0;
    while (total + (level * 100 + 100) <= this.xp) {
      total += level * 100 + 100;
      level++;
    }
    this.level = level;
    this.xpToNext = (level * 100 + 100) - (this.xp - total);
    this.xpInCurrentLevel = this.xp - total;
    this.xpForCurrentLevel = level * 100 + 100;
  }

  // 事件触发
  onBlockBroken(blockId) {
    this.blocksBroken++;
    this.unlock('first_block');
    if (blockId === 5 || blockId === 6) this.unlock('first_tree'); // LOG/LEAVES
    if (blockId === 3 || blockId === 8) this.unlock('first_stone'); // STONE/COBBLESTONE
    if (blockId === 14) {
      this.unlock('diamonds');
      this.foundDiamonds = true;
      if (Date.now() - this.gameStartTime < 300000) {
        this.unlock('speedrun');
      }
    }
    if (this.game.player.position.y < 5) this.unlock('deep_dive');
  }

  onBlockPlaced() {
    this.blocksPlaced++;
    if (this.blocksPlaced >= 100) this.unlock('build_house');
  }

  onKill(mobType) {
    this.killCount++;
    this.unlock('first_kill');
    if (this.killCount >= 10) this.unlock('mob_slayer');
  }

  onDeath() {
    this.unlock('first_death');
  }

  onCraft() {
    this.unlock('first_craft');
  }

  onEat() {
    this.unlock('eat_food');
  }

  onPositionUpdate(pos) {
    const distFromSpawn = Math.sqrt(pos.x ** 2 + pos.z ** 2);
    if (distFromSpawn > 100) this.unlock('explore');
    if (pos.y > 50) this.unlock('sky_high');
    if (pos.y < 5) this.unlock('deep_dive');
  }

  onNightSurvive() {
    this.unlock('survive_night');
  }

  onTNT() {
    this.unlock('tnt_master');
  }

  onWeatherSurvive(weather) {
    if (weather === 'thunder') this.unlock('weather');
  }

  onPvPWin() {
    this.unlock('pvp_win');
  }

  onMultiplayerJoin() {
    this.unlock('multijoin');
  }

  serialize() {
    return {
      unlocked: Array.from(this.unlocked),
      xp: this.xp,
      level: this.level,
      killCount: this.killCount,
      blocksPlaced: this.blocksPlaced,
      blocksBroken: this.blocksBroken,
    };
  }

  getProgress() {
    return {
      level: this.level,
      xp: this.xp,
      xpInCurrentLevel: this.xpInCurrentLevel,
      xpForCurrentLevel: this.xpForCurrentLevel,
      achievementsUnlocked: this.unlocked.size,
      totalAchievements: ACHIEVEMENTS.length,
    };
  }
}
