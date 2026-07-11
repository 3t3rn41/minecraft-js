/**
 * adventure.js — 冒险模式核心逻辑
 * 包含：WaveManager(波次) / EconomyManager(经济) / EventSystem(随机事件)
 *       GradeSystem(评分) / DailyMissions(每日任务) / AdventureMode(主控)
 */

import * as THREE from 'three';
import { BLOCK } from './blocks.js';
import { GAMEMODE } from './gamemodes.js';

// ===== 地图配置 =====
export const ADVENTURE_MAPS = [
  {
    name: 'City Ruins',
    nameZh: '城市废墟',
    waveCount: 6,
    bossType: 'crystal_guardian',
    theme: { biome: 'plains', baseHeight: 28, amplitude: 5, surfaceBlock: 'grass', fogColor: 0xaaaaaa, fogDensity: 0.008 },
    waves: [
      { count: 12, types: ['normal'],                    interval: 1.5, gold: 6,  hpScale: 1.0 },
      { count: 18, types: ['normal', 'fast_z'],          interval: 1.2, gold: 7,  hpScale: 1.3 },
      { count: 15, types: ['crawler', 'normal'],         interval: 1.0, gold: 8,  hpScale: 1.6 },
      { count: 10, types: ['brute', 'summoner'],         interval: 1.5, gold: 12, hpScale: 2.0 },
      { count: 20, types: ['fast_z', 'brute', 'winter_z'],interval: 0.8, gold: 10, hpScale: 2.5 },
      { boss: 'crystal_guardian' },
    ],
  },
  {
    name: 'Frozen Lab',
    nameZh: '寒冰实验室',
    waveCount: 6,
    bossType: 'crystal_guardian',
    theme: { biome: 'snow', baseHeight: 30, amplitude: 8, surfaceBlock: 'snow', fogColor: 0xccddff, fogDensity: 0.012 },
    waves: [
      { count: 15, types: ['normal', 'winter_z'],        interval: 1.3, gold: 8,  hpScale: 1.2 },
      { count: 20, types: ['winter_z', 'fast_z'],        interval: 1.0, gold: 9,  hpScale: 1.5 },
      { count: 12, types: ['crawler', 'winter_z'],       interval: 0.9, gold: 10, hpScale: 1.8 },
      { count: 15, types: ['bomber', 'brute'],           interval: 1.2, gold: 12, hpScale: 2.0 },
      { count: 25, types: ['winter_z', 'brute', 'bomber'],interval: 0.7, gold: 12, hpScale: 2.8 },
      { boss: 'crystal_guardian' },
    ],
  },
  {
    name: 'Crystal Nest',
    nameZh: '水晶巢穴',
    waveCount: 6,
    bossType: 'crystal_guardian',
    theme: { biome: 'mountains', baseHeight: 32, amplitude: 18, surfaceBlock: 'stone', fogColor: 0xaaccff, fogDensity: 0.01 },
    waves: [
      { count: 18, types: ['fast_z', 'normal'],          interval: 1.0, gold: 8,  hpScale: 1.5 },
      { count: 15, types: ['summoner', 'fast_z'],        interval: 1.0, gold: 10, hpScale: 1.8 },
      { count: 20, types: ['brute', 'crawler'],          interval: 0.8, gold: 12, hpScale: 2.2 },
      { count: 15, types: ['bomber', 'summoner'],        interval: 1.0, gold: 14, hpScale: 2.5 },
      { count: 30, types: ['fast_z', 'brute', 'winter_z', 'bomber'], interval: 0.6, gold: 15, hpScale: 3.0 },
      { boss: 'crystal_guardian' },
    ],
  },
  {
    name: 'Shadow Palace',
    nameZh: '暗影宫殿',
    waveCount: 6,
    bossType: 'zombie_king',
    theme: { biome: 'desert', baseHeight: 26, amplitude: 6, surfaceBlock: 'sand', fogColor: 0x443333, fogDensity: 0.015 },
    waves: [
      { count: 20, types: ['brute', 'fast_z'],           interval: 1.0, gold: 10, hpScale: 2.0 },
      { count: 18, types: ['summoner', 'crawler'],       interval: 0.9, gold: 12, hpScale: 2.3 },
      { count: 25, types: ['bomber', 'brute', 'winter_z'],interval: 0.7, gold: 14, hpScale: 2.6 },
      { count: 20, types: ['fast_z', 'summoner', 'brute'],interval: 0.6, gold: 16, hpScale: 3.0 },
      { count: 35, types: ['fast_z', 'brute', 'bomber', 'winter_z', 'summoner'], interval: 0.5, gold: 18, hpScale: 3.5 },
      { boss: 'zombie_king' },
    ],
  },
];

// ===== 商店配置 =====
export const SHOP_ITEMS = {
  // 武器类
  pistol:   { name: '手枪',     blockId: BLOCK.PISTOL,          price: 800,   ammoId: BLOCK.BULLET_ITEM,    ammoCount: 64,  cat: 'weapons' },
  rifle:    { name: '步枪',     blockId: BLOCK.ROCKET_LAUNCHER, price: 2500,  ammoId: BLOCK.BULLET_ITEM,    ammoCount: 64,  cat: 'weapons' },
  sniper:   { name: '狙击枪',   blockId: BLOCK.BARRETT,         price: 4000,  ammoId: BLOCK.BARRETT_AMMO,   ammoCount: 32,  cat: 'weapons' },
  gatling:  { name: '加特林',   blockId: BLOCK.GATLING,         price: 6000,  ammoId: BLOCK.GATLING_AMMO,   ammoCount: 128, cat: 'weapons' },
  barrett:  { name: '巴雷特',   blockId: BLOCK.DRAGON_BREATH,   price: 8000,  ammoId: BLOCK.BULLET_ITEM,    ammoCount: 64,  cat: 'weapons' },
  hero:     { name: '英雄武器', blockId: null,                  price: 12000, ammoId: BLOCK.BULLET_ITEM,    ammoCount: 128, cat: 'weapons' },
  // 消耗品
  ammo:     { name: '满弹药',   price: 200,   type: 'ammo',    cat: 'consumables' },
  medkit:   { name: '医疗包',   price: 500,   type: 'heal',    cat: 'consumables' },
  // 防御
  armor:    { name: '护甲',     price: 1500,  type: 'armor',   cat: 'defense' },
  // 复活
  revive:   { name: '复活队友', price: 2000,  type: 'revive',  cat: 'revive' },
};

// ===== 英雄武器池（商店购买时随机抽取，不重复） =====
export const HERO_WEAPONS = [
  { blockId: BLOCK.DRAGON_BREATH, name: '龙息炮' },
  { blockId: BLOCK.THUNDER_GUN,   name: '雷霆链枪' },
  { blockId: BLOCK.ANNIHILATOR,   name: '湮灭炮' },
];

// ===== 技能定义 =====
export const SKILL_DEFS = {
  // 红色（战斗）
  damage:    { name: '伤害强化', col: 'combat',  max: 5, desc: '攻击伤害 +10%/级' },
  atkSpeed:  { name: '攻击速度', col: 'combat',  max: 5, desc: '攻击速度 +10%/级' },
  critical:  { name: '暴击概率', col: 'combat',  max: 5, desc: '暴击率 +5%/级' },
  // 绿色（生存）
  vitality:  { name: '生命强化', col: 'survival', max: 5, desc: '最大生命 +5/级' },
  armor:     { name: '护甲精通', col: 'survival', max: 5, desc: '减伤 +5%/级' },
  regen:     { name: '生命回复', col: 'survival', max: 5, desc: '每秒回血 +2/级' },
  dmgReduc:  { name: '伤害减免', col: 'survival', max: 5, desc: '额外减伤 +5%/级' },
  // 蓝色（辅助）
  speed:     { name: '移动速度', col: 'support', max: 5, desc: '移速 +5%/级' },
  goldBonus: { name: '金币加成', col: 'support', max: 5, desc: '金币获取 +15%/级' },
  reviveSpd: { name: '复活加速', col: 'support', max: 5, desc: '复活速度 +20%/级' },
  mechanic:  { name: '机械维护', col: 'support', max: 5, desc: '弹药消耗 -15%/级' },
  scavenger: { name: '拾荒者',   col: 'support', max: 5, desc: '掉落概率 +20%/级' },
  medic:     { name: '医疗专家', col: 'support', max: 5, desc: '治疗效果 +25%/级' },
};

// ================================================================
//  WaveManager — 波次管理
// ================================================================
class WaveManager {
  constructor(adventure) {
    this.adv = adventure;
    this.game = adventure.game;
    this.mapIndex = 0;
    this.waveIndex = 0;
    this.waveState = 'intermission'; // intermission | spawning | fighting | cleared | gameover
    this.intermissionTimer = 5;       // 首次准备时间
    this.spawnTimer = 0;
    this.spawnedThisWave = 0;
    this.aliveInWave = 0;
    this.bossActive = false;
    this.bossEntity = null;
    this.cleared = false;
  }

  get currentMap() { return ADVENTURE_MAPS[this.mapIndex]; }
  get currentWave() { return this.currentMap.waves[this.waveIndex]; }
  get totalWaves() { return this.currentMap.waveCount; }

  // 按玩家人数缩放
  get playerCount() {
    if (this.game.multiplayer && this.game.multiplayer.isConnected) {
      return Math.min(4, this.game.multiplayer.remotePlayers.size + 1);
    }
    return 1;
  }

  startWave(index) {
    this.waveIndex = index;
    this.waveState = 'spawning';
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
    this.aliveInWave = 0;
    this.bossActive = false;
    this.cleared = false;

    const wave = this.currentWave;
    if (wave.boss) {
      this.bossActive = true;
      this.spawnBoss(wave.boss);
      this.aliveInWave = 1;
    } else {
      const n = this.playerCount;
      this.scaledCount = Math.ceil(wave.count * (0.7 + 0.3 * n));
      this.aliveInWave = this.scaledCount;
    }

    // 通知 UI
    if (this.adv.ui) {
      this.adv.ui.renderWaveBanner(this.waveIndex + 1, this.totalWaves, this.waveState);
    }
    // 音效
    if (this.game.sound) this.game.sound.waveStart();
    console.log(`[ADV] wave ${this.waveIndex + 1}/${this.totalWaves} started — state=${this.waveState}`);
  }

  spawnBoss(bossType) {
    const p = this.game.player.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = 15;
    const x = p.x + Math.cos(angle) * dist;
    const z = p.z + Math.sin(angle) * dist;
    // 找地面
    let y = p.y;
    for (let checkY = Math.floor(p.y) + 5; checkY > 0; checkY--) {
      if (this.game.world.getBlock(Math.floor(x), checkY, Math.floor(z)) !== 0) {
        y = checkY + 1;
        break;
      }
    }
    this.game.mobs.spawnMob(x, y, z, bossType);
    if (this.game.sound) this.game.sound.bossRoar();

    // 主机广播 Boss 生成
    if (this.adv.isHost && this.game.multiplayer) {
      this.game.multiplayer.sendAdvSpawn(bossType, x, y, z, 1.0);
    }
  }

  spawnNextMob() {
    const wave = this.currentWave;
    if (wave.boss) return; // Boss 波不刷小怪

    const n = this.playerCount;
    const hpMult = 1 + 0.25 * (n - 1);

    const p = this.game.player.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 12;
    const x = p.x + Math.cos(angle) * dist;
    const z = p.z + Math.sin(angle) * dist;

    // 找地面
    let y = p.y;
    for (let checkY = Math.floor(p.y) + 8; checkY > 0; checkY--) {
      const block = this.game.world.getBlock(Math.floor(x), checkY, Math.floor(z));
      if (block !== 0) { y = checkY + 1; break; }
    }

        const type = wave.types[Math.floor(Math.random() * wave.types.length)];
    this.game.mobs.spawnMob(x, y, z, type);

    // 应用血量缩放
    const lastMob = this.game.mobs.mobs[this.game.mobs.mobs.length - 1];
    const finalHpScale = hpMult * (wave.hpScale || 1.0);
    if (lastMob && finalHpScale !== 1.0) {
      lastMob.maxHealth = Math.ceil(lastMob.maxHealth * finalHpScale);
      lastMob.health = lastMob.maxHealth;
    }

    // 应用波次金币奖励（取波次金币和类型默认金币中的较大值）
    if (lastMob && wave.gold) {
      const n = this.playerCount;
      const goldReward = Math.ceil(wave.gold * (0.8 + 0.2 * n));
      lastMob.goldValue = Math.max(lastMob.goldValue || 0, goldReward);
    }

    // 主机广播怪物生成
    if (this.adv.isHost && this.game.multiplayer) {
      this.game.multiplayer.sendAdvSpawn(type, x, y, z, finalHpScale);
    }

    this.spawnedThisWave++; }

  update(dt) {
    if (this.waveState === 'gameover' || this.waveState === 'cleared') return;

    // 准备期倒计时
    if (this.waveState === 'intermission') {
      this.intermissionTimer -= dt;
      if (this.adv.ui) {
        this.adv.ui.updateIntermission(Math.max(0, Math.ceil(this.intermissionTimer)));
      }
      if (this.intermissionTimer <= 0) {
        this.startWave(this.waveIndex);
      }
      return;
    }

    // 刷怪阶段
    if (this.waveState === 'spawning') {
      const wave = this.currentWave;
      if (wave.boss) {
        // Boss 波：Boss 已刷出，进入战斗
        this.waveState = 'fighting';
      } else {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.spawnedThisWave < this.scaledCount) {
          this.spawnNextMob();
          this.spawnTimer = wave.interval || 1.0;
        }
        if (this.spawnedThisWave >= this.scaledCount) {
          this.waveState = 'fighting';
        }
      }
    }

    // 战斗阶段：检查是否清场
    if (this.waveState === 'fighting') {
      // 计算存活怪物数（冒险模式的怪物）
      const alive = this.countAdventureMobs();
      if (this.adv.ui) this.adv.ui.updateMobCounter(alive);

      if (alive === 0) {
        this.onWaveCleared();
      }

      // Boss 血条更新
      if (this.bossActive) {
        this.updateBossBar();
      }
    }
  }

  countAdventureMobs() {
    let count = 0;
    for (const mob of this.game.mobs.mobs) {
      if (!mob.dead && mob.type !== 'fish' && mob.type !== 'ender_dragon') {
        count++;
      }
    }
    return count;
  }

  updateBossBar() {
    // 找到 Boss 实体
    const boss = this.game.mobs.mobs.find(m =>
      m.type === 'crystal_guardian' || m.type === 'zombie_king'
    );
    if (!boss) {
      // Boss 已死亡
      if (this.adv.ui) this.adv.ui.updateBossBar(null, 0, 0);
      return;
    }
    this.bossEntity = boss;
    const pct = boss.health / boss.maxHealth;
    let phase = 1;
    if (boss.type === 'crystal_guardian') {
      phase = pct < 0.5 ? 2 : 1;
    } else if (boss.type === 'zombie_king') {
      if (pct < 0.33) phase = 3;
      else if (pct < 0.66) phase = 2;
      else phase = 1;
    }
    const bossName = boss.type === 'crystal_guardian' ? '水晶守卫' : '僵尸君主';
    if (this.adv.ui) this.adv.ui.updateBossBar(bossName, pct, phase);
  }

  onWaveCleared() {
    this.waveState = 'cleared';
    this.cleared = true;

    // 波次清理奖励
    const n = this.playerCount;
    const clearBonus = Math.ceil(50 * (0.8 + 0.2 * n));
    this.adv.econ.addGold(this.adv.localPlayerId, clearBonus, 'wave_clear');

    // 技能点奖励
    this.game.player.skillPoints = Math.min(30, (this.game.player.skillPoints || 0) + 1);

    console.log(`[ADV] wave ${this.waveIndex + 1} cleared — bonus=${clearBonus}g`);

    // 检查是否全部通关
    if (this.waveIndex + 1 >= this.totalWaves) {
      // 通关结算
      this.waveState = 'gameover';
      this.adv.onMapCleared();
      return;
    }

    // 进入准备期
    this.waveIndex++;
    this.waveState = 'intermission';
    this.intermissionTimer = 15;

    if (this.adv.ui) {
      this.adv.ui.renderWaveBanner(this.waveIndex + 1, this.totalWaves, 'intermission');
      this.adv.ui.updateIntermission(15);
    }
    if (this.game.ui) this.game.ui.showToast(`✅ 第 ${this.waveIndex} 波清理！+${clearBonus} 金币`, 2000);
  }

  // 调试用：跳到指定波次
  startFrom(waveNum) {
    this.waveIndex = waveNum - 1;
    this.waveState = 'intermission';
    this.intermissionTimer = 1;
  }
}

// ================================================================
//  EconomyManager — 金币经济
// ================================================================
class EconomyManager {
  constructor(adventure) {
    this.adv = adventure;
    this.game = adventure.game;
    // teamGold: { [playerId]: number }
    this.teamGold = {};
    // 已拥有的英雄武器（按玩家ID追踪，防止重复获取）
    this.ownedHeroWeapons = {}; // { playerId: Set<blockId> }
    this._lastHeroWeaponId = null; // 最近一次抽取的英雄武器（供联机同步）
  }

  get localPlayerId() {
    return this.adv.localPlayerId;
  }

  addGold(playerId, amount, reason = 'kill') {
    // 金币倍率
    let mul = 1;
    const p = this.game.player;
    if (p && p.getSkillBonus) {
      mul *= p.getSkillBonus('goldMul');
    }
    // 事件倍率
    if (this.adv.events) {
      if (this.adv.events.activeEvents.gold_rush) mul *= 3;
      if (this.adv.events.activeEvents.dark_hour) mul *= 2;
    }
    const final = Math.ceil(amount * mul);
    this.teamGold[playerId] = (this.teamGold[playerId] || 0) + final;

    // 同步到 player.gold（本地玩家）
    if (playerId === this.localPlayerId && p) {
      p.gold = this.teamGold[playerId];
    }

    console.log(`[ADV-ECON] ${playerId} +${final} (${reason}) -> ${this.teamGold[playerId]}`);
    if (this.adv.ui) this.adv.ui.updateGold(this.teamGold[playerId]);
    return final;
  }

  spendGold(playerId, amount, reason = 'buy') {
    // 开发者模式：无限金币，购买不扣费
    if (this.adv.devMode) {
      const p = this.game.player;
      if (playerId === this.localPlayerId && p) {
        p.gold = 9999999;
      }
      if (this.adv.ui) this.adv.ui.updateGold(9999999);
      return true;
    }
    const current = this.teamGold[playerId] || 0;
    if (current < amount) return false;
    this.teamGold[playerId] = current - amount;
    const p = this.game.player;
    if (playerId === this.localPlayerId && p) {
      p.gold = this.teamGold[playerId];
    }
    console.log(`[ADV-ECON] ${playerId} -${amount} (${reason}) -> ${this.teamGold[playerId]}`);
    if (this.adv.ui) this.adv.ui.updateGold(this.teamGold[playerId]);
    return true;
  }

  getGold(playerId) {
    // 开发者模式：返回巨额金币
    if (this.adv.devMode) return 9999999;
    return this.teamGold[playerId] || 0;
  }

  // 获取指定玩家已拥有的英雄武器集合
  _getOwnedHeroWeapons(playerId) {
    if (!this.ownedHeroWeapons[playerId]) {
      this.ownedHeroWeapons[playerId] = new Set();
    }
    return this.ownedHeroWeapons[playerId];
  }

  // 扫描本地玩家背包，将已有英雄武器加入追踪集合
  _scanLocalHeroWeapons() {
    const p = this.game.player;
    if (!p || !p.inventory) return;
    const owned = this._getOwnedHeroWeapons(this.localPlayerId);
    for (const w of HERO_WEAPONS) {
      for (let i = 0; i < p.inventory.length; i++) {
        if (p.inventory[i] && p.inventory[i].id === w.blockId) {
          owned.add(w.blockId);
          break;
        }
      }
    }
  }

  // 随机挑选一把玩家尚未拥有的英雄武器，返回 { blockId, name } 或 null
  _pickRandomHeroWeapon(playerId) {
    const owned = this._getOwnedHeroWeapons(playerId);
    // 同时扫描本地玩家背包以防遗漏
    if (playerId === this.localPlayerId) {
      this._scanLocalHeroWeapons();
    }
    const unowned = HERO_WEAPONS.filter(w => !owned.has(w.blockId));
    if (unowned.length === 0) return null;
    return unowned[Math.floor(Math.random() * unowned.length)];
  }

  onKill(playerId, mobType, flags = {}) {
    // 金币产出已在 MobManager.spawnGoldDrop 中通过 goldValue 处理
    // 这里处理额外奖励（暴击等）
    if (flags.headshot || flags.longRange || flags.noDamage) {
      const bonus = 10;
      this.addGold(playerId, bonus, 'crit_bonus');
    }
  }

  buyItem(playerId, itemId) {
    // 客户端：发送购买请求给主机
    if (this.adv.isClient && playerId === this.localPlayerId) {
      if (this.game.multiplayer) {
        this.game.multiplayer.sendAdvBuy(itemId);
        console.log(`[ADV-NET] buy request: ${itemId}`);
      }
      return false; // 等待主机结果
    }

    const item = SHOP_ITEMS[itemId];
    if (!item) return false;

    // 英雄武器：随机抽取一把未拥有的，全部拥有则拒绝购买
    let heroWeaponId = null;
    if (itemId === 'hero') {
      const chosen = this._pickRandomHeroWeapon(playerId);
      if (!chosen) {
        if (playerId === this.localPlayerId && this.adv.ui) {
          this.adv.ui.showToast('已拥有全部英雄武器！', 1500);
        }
        return false;
      }
      heroWeaponId = chosen.blockId;
      this._lastHeroWeaponId = heroWeaponId;
    } else {
      this._lastHeroWeaponId = null;
    }

    if (!this.spendGold(playerId, item.price, `buy:${itemId}`)) return false;

    // 金币扣除成功后，才标记英雄武器为已拥有
    if (heroWeaponId) {
      this._getOwnedHeroWeapons(playerId).add(heroWeaponId);
    }

    // 仅本地玩家获得物品（主机为自己购买时）
    // 远程客户端的物品由 handleBuyResult 在客户端本地发放
    if (playerId === this.localPlayerId) {
      this._grantBuyRewards(itemId, heroWeaponId);
    }
    return true;
  }

  // 发放购买奖励到本地玩家
  // heroWeaponId: 由主机指定的英雄武器ID（联机时），单人时为 null 由本地随机
  _grantBuyRewards(itemId, heroWeaponId = null) {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;
    const p = this.game.player;
    if (itemId === 'hero') {
      // 英雄武器：使用主机指定的ID，或本地随机抽取
      let weaponBlockId = heroWeaponId;
      let weaponName = '';
      if (!weaponBlockId) {
        const chosen = this._pickRandomHeroWeapon(this.localPlayerId);
        if (!chosen) {
          if (this.game.ui) this.game.ui.showToast('已拥有全部英雄武器！', 1500);
          return;
        }
        weaponBlockId = chosen.blockId;
        weaponName = chosen.name;
      } else {
        const def = HERO_WEAPONS.find(w => w.blockId === weaponBlockId);
        weaponName = def ? def.name : '英雄武器';
      }
      // 记录已拥有
      this._getOwnedHeroWeapons(this.localPlayerId).add(weaponBlockId);
      // 再次检查背包中是否已存在（双重保险）
      let alreadyHas = false;
      for (let i = 0; i < p.inventory.length; i++) {
        if (p.inventory[i] && p.inventory[i].id === weaponBlockId) {
          alreadyHas = true;
          break;
        }
      }
      if (alreadyHas) {
        if (this.game.ui) this.game.ui.showToast('已拥有该英雄武器', 1500);
        return;
      }
      this._addItemToHotbarFirst(weaponBlockId, 1);
      // 英雄武器不附带子弹（英雄武器为无限弹药/特殊弹药机制）
      if (this.game.ui) {
        this.game.ui.updateHotbar();
        this.game.ui.showToast(`获得英雄武器: ${weaponName}！`, 2000);
      }
    } else if (item.blockId) {
      // 其他武器类：给武器 + 弹药（武器不堆叠，每个武器占独立槽位）
      this._addItemToHotbarFirst(item.blockId, 1);
      if (item.ammoId && item.ammoCount) {
        p.addItem(item.ammoId, item.ammoCount, true);
      }
      if (this.game.ui) {
        this.game.ui.updateHotbar();
        this.game.ui.showToast(`购买成功: ${item.name}`, 1500);
      }
    } else if (item.type === 'ammo') {
      // 满弹药：补充所有弹药类型
      p.addItem(BLOCK.BULLET_ITEM, 64, true);
      p.addItem(BLOCK.GATLING_AMMO, 64, true);
      p.addItem(BLOCK.BARRETT_AMMO, 32, true);
      if (this.game.ui) {
        this.game.ui.updateHotbar();
        this.game.ui.showToast('弹药已补充', 1500);
      }
    } else if (item.type === 'heal') {
      // 医疗包
      const medicBonus = p.getSkillBonus ? 1 + (p.skills.medic || 0) * 0.25 : 1;
      p.heal(Math.ceil(20 * medicBonus));
      if (this.game.ui) this.game.ui.showToast('生命值已恢复', 1500);
    } else if (item.type === 'armor') {
      // 护甲
      p.armor.chestplate = 'iron';
      if (this.game.ui) this.game.ui.showToast('已装备铁甲', 1500);
    } else if (item.type === 'revive') {
      // 复活队友（多人模式中）
      if (this.game.multiplayer && this.game.multiplayer.players) {
        if (this.game.ui) this.game.ui.showToast('复活队友功能已激活', 1500);
      } else {
        if (this.game.ui) this.game.ui.showToast('单人模式无需复活', 1500);
      }
    }
  }

  // 将物品加入玩家背包：优先快捷栏(0-8)空槽，快捷栏满则加入背包(9-35)
  // 武器类不堆叠，每个武器占独立槽位
  _addItemToHotbarFirst(blockId, count = 1) {
    const p = this.game.player;
    if (!p) return false;

    // 先找快捷栏空槽 (0-8)
    for (let i = 0; i < 9; i++) {
      if (!p.inventory[i]) {
        p.inventory[i] = { id: blockId, count: count };
        return true;
      }
    }
    // 快捷栏满了 → 找背包空槽 (9-35)
    for (let i = 9; i < p.inventory.length; i++) {
      if (!p.inventory[i]) {
        p.inventory[i] = { id: blockId, count: count };
        return true;
      }
    }
    // 背包也满了 → 尝试堆叠（非武器类）
    for (let i = 0; i < p.inventory.length; i++) {
      if (p.inventory[i] && p.inventory[i].id === blockId && p.inventory[i].count < 64) {
        p.inventory[i].count += count;
        return true;
      }
    }
    return false;
  }
}

// ================================================================
//  EventSystem — 随机事件
// ================================================================
class EventSystem {
  constructor(adventure) {
    this.adv = adventure;
    this.game = adventure.game;
    this.eventTimer = 20 + Math.random() * 25; // 20~45秒
    this.activeEvents = {
      dark_hour: false,
      gold_rush: false,
    };
    this._darkHourTimer = 0;
    this._goldRushTimer = 0;
    this.supplyDrops = []; // 空投实体列表
  }

  update(dt) {
    // 事件计时（仅主机触发随机事件）
    if (this.adv.isHost) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        this.eventTimer = 20 + Math.random() * 25;
        this.triggerRandom();
      }
    }

    // 暗夜事件倒计时
    if (this.activeEvents.dark_hour) {
      this._darkHourTimer -= dt;
      if (this._darkHourTimer <= 0) {
        this.activeEvents.dark_hour = false;
        if (this.adv.ui) this.adv.ui.showToast('光明恢复了', 2000);
      }
    }

    // 金币狂欢倒计时
    if (this.activeEvents.gold_rush) {
      this._goldRushTimer -= dt;
      if (this._goldRushTimer <= 0) {
        this.activeEvents.gold_rush = false;
        if (this.adv.ui) this.adv.ui.showToast('金币狂欢结束', 2000);
      }
    }

    // 空投更新
    this.updateSupplyDrops(dt);
  }

  triggerRandom() {
    const events = ['supply_drop', 'dark_hour', 'airstrike', 'gold_rush', 'healing_wave', 'zombie_horde'];
    const event = events[Math.floor(Math.random() * events.length)];
    this.trigger(event);
  }

  trigger(eventName) {
    console.log(`[ADV-EVENT] triggered: ${eventName}`);

    // 主机广播事件给客户端
    if (this.adv.isHost && this.game.multiplayer) {
      this.game.multiplayer.sendAdvEvent(eventName);
    }

    switch (eventName) {
      case 'supply_drop':
        this.spawnSupplyDrop();
        break;
      case 'dark_hour':
        this.activeEvents.dark_hour = true;
        this._darkHourTimer = 10;
        if (this.adv.ui) this.adv.ui.showToast('🌙 暗夜降临！击杀金币×2', 3000);
        if (this.game.sound) this.game.sound.supplyDrop();
        break;
      case 'gold_rush':
        this.activeEvents.gold_rush = true;
        this._goldRushTimer = 10;
        if (this.adv.ui) this.adv.ui.showToast('💰 金币狂欢！击杀金币×3', 3000);
        break;
      case 'healing_wave':
        this.game.player.heal(this.game.player.maxHealth);
        if (this.game.multiplayer) {
          // TODO: 同步其他玩家治疗
        }
        if (this.adv.ui) this.adv.ui.showToast('💚 治疗波涌！全员回满血', 3000);
        if (this.game.effects) this.game.effects.createHealingEffect(this.game.player.position);
        break;
      case 'zombie_horde':
        this.spawnZombieHorde();
        if (this.adv.ui) this.adv.ui.showToast('⚠️ 尸潮来袭！', 3000);
        break;
      case 'airstrike':
        this.callAirstrike();
        if (this.adv.ui) this.adv.ui.showToast('💥 空袭已标记！3秒后打击', 3000);
        break;
    }
  }

  spawnSupplyDrop() {
    const p = this.game.player.position;

    // 尝试多个位置，避免空投生成在水中
    let x = 0, z = 0, y = 0;
    let found = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 8;
      const tryX = p.x + Math.cos(angle) * dist;
      const tryZ = p.z + Math.sin(angle) * dist;

      // 找地面（跳过水和空气）
      let tryY = 0;
      let groundFound = false;
      for (let checkY = Math.floor(p.y) + 10; checkY > 0; checkY--) {
        const block = this.game.world.getBlock(Math.floor(tryX), checkY, Math.floor(tryZ));
        if (block !== 0 && block !== BLOCK.WATER) {
          // 确认落脚点上方不是水（避免水下着陆）
          const above = this.game.world.getBlock(Math.floor(tryX), checkY + 1, Math.floor(tryZ));
          if (above === BLOCK.WATER) continue; // 落脚点被水覆盖，跳过
          tryY = checkY + 1;
          groundFound = true;
          break;
        }
      }

      if (groundFound) {
        x = tryX;
        z = tryZ;
        y = tryY;
        found = true;
        break;
      }
    }

    if (!found) {
      // 所有尝试都失败（极端情况）， fallback 到原逻辑
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 8;
      x = p.x + Math.cos(angle) * dist;
      z = p.z + Math.sin(angle) * dist;
      for (let checkY = Math.floor(p.y) + 10; checkY > 0; checkY--) {
        if (this.game.world.getBlock(Math.floor(x), checkY, Math.floor(z)) !== 0) {
          y = checkY + 1;
          break;
        }
      }
    }

    const drop = {
      x, y: y + 20, z, // 从空中落下
      targetY: y,
      landed: false,
      lifetime: 30,
      mesh: null,
    };

    // 创建简易网格
    if (this.game.effects) {
      this.game.effects.spawnAirdrop(x, y, z);
    }

    this.supplyDrops.push(drop);
    if (this.adv.ui) this.adv.ui.showToast('📦 空投补给已投放！', 3000);
    if (this.game.sound) this.game.sound.supplyDrop();
  }

  updateSupplyDrops(dt) {
    const p = this.game.player.position;
    for (let i = this.supplyDrops.length - 1; i >= 0; i--) {
      const drop = this.supplyDrops[i];
      drop.lifetime -= dt;

      // 下落动画
      if (!drop.landed) {
        drop.y -= dt * 8;
        if (drop.y <= drop.targetY) {
          drop.y = drop.targetY;
          drop.landed = true;
          // 爆炸特效
          if (this.game.effects) this.game.effects.spawnSupplyExplosion(drop.x, drop.y, drop.z);
        }
      }

      // 拾取检测
      if (drop.landed) {
        const dx = p.x - drop.x;
        const dz = p.z - drop.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 4) {
          // 随机奖励
          if (Math.random() < 0.5) {
            // 随机武器
            const weapons = ['pistol', 'rifle', 'sniper', 'gatling'];
            const w = weapons[Math.floor(Math.random() * weapons.length)];
            const item = SHOP_ITEMS[w];
            if (item && item.blockId) {
              this.game.player.addItem(item.blockId, 1, true);
              if (item.ammoId) this.game.player.addItem(item.ammoId, item.ammoCount || 32, true);
              if (this.adv.ui) this.adv.ui.showToast(`📦 获得武器: ${item.name}`, 2000);
            }
          } else {
            // 500 金币
            if (this.adv.isClient && this.game.multiplayer) {
              // 客户端：上报给主机
              this.game.multiplayer.sendAdvPickup(500, 'supply_drop');
            } else {
              this.adv.econ.addGold(this.adv.localPlayerId, 500, 'supply_drop');
            }
            if (this.adv.ui) this.adv.ui.showToast('📦 获得 500 金币', 2000);
          }
          this.supplyDrops.splice(i, 1);
          continue;
        }
      }

      // 过期
      if (drop.lifetime <= 0) {
        this.supplyDrops.splice(i, 1);
      }
    }
  }

  spawnZombieHorde() {
    const p = this.game.player.position;
    const angle = Math.random() * Math.PI * 2;
    for (let i = 0; i < 15; i++) {
      const offset = (i - 7) * 1.5;
      const x = p.x + Math.cos(angle) * 25 + Math.sin(angle) * offset;
      const z = p.z + Math.sin(angle) * 25 - Math.cos(angle) * offset;
      let y = p.y;
      for (let checkY = Math.floor(p.y) + 8; checkY > 0; checkY--) {
        if (this.game.world.getBlock(Math.floor(x), checkY, Math.floor(z)) !== 0) {
          y = checkY + 1; break;
        }
      }
      this.game.mobs.spawnMob(x, y, z, 'fast_z');
      // 主机广播尸潮生成
      if (this.adv.isHost && this.game.multiplayer) {
        this.game.multiplayer.sendAdvSpawn('fast_z', x, y, z, 1.0);
      }
    }
  }

  callAirstrike() {
    // 3秒后在玩家准星位置爆炸
    const target = { ...this.game.player.position };
    // 偏移一点，不要炸到自己脚下
    const look = this.game.player.getLookDirection();
    target.x += look.x * 10;
    target.z += look.z * 10;

    setTimeout(() => {
      if (this.game.effects) {
        this.game.effects.createExplosion(target.x, target.y, target.z, 4);
        this.game.effects.spawnSupplyExplosion(target.x, target.y, target.z);
      }
      // 对附近怪物造成伤害
      if (this.game.mobs) {
        for (const mob of this.game.mobs.mobs) {
          if (mob.dead) continue;
          const dx = mob.position.x - target.x;
          const dy = mob.position.y - target.y;
          const dz = mob.position.z - target.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 8) {
            mob.takeDamage(50);
          }
        }
      }
      if (this.adv.ui) this.adv.ui.showToast('💥 空袭完成！', 1500);
    }, 3000);
  }
}

// ================================================================
//  GradeSystem — 评分系统
// ================================================================
class GradeSystem {
  constructor(adventure) {
    this.adv = adventure;
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.totalDamageTaken = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.totalGoldEarned = 0;
    this.bossDeaths = 0;       // Boss战期间死亡人数
    this.waveDeaths = 0;       // 总死亡次数
    this.wipeCount = 0;        // 团灭次数
  }

  recordShot(hit) {
    this.shotsFired++;
    if (hit) this.shotsHit++;
  }

  recordDamageTaken(amount) {
    this.totalDamageTaken += amount;
  }

  recordDeath() {
    this.waveDeaths++;
  }

  recordWipe() {
    this.wipeCount++;
  }

  calculateGrade() {
    if (this.wipeCount >= 3) {
      return { grade: 'F', multi: 1.0, details: { reason: '团灭超过3次' } };
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    const theoreticalMin = 180; // 3分钟理论最短
    const timeScore = Math.min(1.0, theoreticalMin / elapsed);

    const n = this.adv.wave.playerCount;
    const damageScore = Math.max(0, 1 - this.totalDamageTaken / (n * 100));

    const accuracyScore = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0.5;

    const goldBaseline = 500 * this.adv.wave.totalWaves;
    const goldScore = Math.min(1.0, this.totalGoldEarned / goldBaseline);

    const bossNoDeath = this.bossDeaths === 0 ? 1.0 : 0.5;

    const overall = (timeScore + damageScore + accuracyScore + goldScore + bossNoDeath) / 5;

    let grade, multi;
    if (overall > 0.9) { grade = 'S'; multi = 2.0; }
    else if (overall > 0.75) { grade = 'A'; multi = 1.5; }
    else if (overall > 0.6) { grade = 'B'; multi = 1.2; }
    else { grade = 'C'; multi = 1.0; }

    return {
      grade, multi,
      details: {
        timeScore: (timeScore * 100).toFixed(0) + '%',
        damageScore: (damageScore * 100).toFixed(0) + '%',
        accuracyScore: (accuracyScore * 100).toFixed(0) + '%',
        goldScore: (goldScore * 100).toFixed(0) + '%',
        bossNoDeath: bossNoDeath === 1.0 ? '无伤' : '有死亡',
        overall: (overall * 100).toFixed(0) + '%',
      },
    };
  }
}

// ================================================================
//  DailyMissions — 每日任务
// ================================================================
class DailyMissions {
  constructor() {
    this.missions = [];
    this.dateKey = '';
    this.loadToday();
  }

  get todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  loadToday() {
    const key = this.todayKey;
    if (key === this.dateKey && this.missions.length > 0) return;
    this.dateKey = key;

    const storageKey = `adventure_daily_${key}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        this.missions = JSON.parse(saved);
        return;
      }
    } catch (e) {}

    // 生成新任务
    this.generateMissions();
    this.save();
  }

  generateMissions() {
    const pool = [
      { id: 'kill_zombies',  desc: '击杀50个僵尸',      target: 50,  reward: 1000, progress: 0 },
      { id: 'clear_run',     desc: '通关1次冒险模式',    target: 1,   reward: 2000, progress: 0 },
      { id: 'no_damage_wave',desc: '无伤通关一波',      target: 1,   reward: 1500, progress: 0 },
      { id: 'sniper_kills',  desc: '用狙击枪击杀10个',  target: 10,  reward: 1200, progress: 0 },
      { id: 'revive_ally',   desc: '复活队友1次',       target: 1,   reward: 1500, progress: 0 },
      { id: 'grade_s',       desc: '获得S评分1次',      target: 1,   reward: 3000, progress: 0 },
    ];
    // 随机选3个
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.missions = shuffled.slice(0, 3);
  }

  save() {
    const storageKey = `adventure_daily_${this.dateKey}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.missions));
    } catch (e) {}
  }

  updateProgress(missionId, amount = 1) {
    this.loadToday(); // 确保加载今日任务
    const m = this.missions.find(m => m.id === missionId);
    if (!m || m.progress >= m.target) return false;
    m.progress = Math.min(m.target, m.progress + amount);
    this.save();
    if (m.progress >= m.target) {
      console.log(`[ADV-DAILY] mission completed: ${m.desc}`);
      return true; // 完成
    }
    return false;
  }

  getProgress(missionId) {
    this.loadToday();
    const m = this.missions.find(m => m.id === missionId);
    return m ? m.progress : 0;
  }
}

// ================================================================
//  Leaderboard — 周轮换排行榜（localStorage）
// ================================================================
class Leaderboard {
  constructor() {
    this.entries = [];
    this.weekKey = '';
    this.loadWeek();
  }

  // 计算当前周标识（ISO 周年-周数）
  get currentWeekKey() {
    const d = new Date();
    const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // 找到本周的周四（ISO 8601 基准）
    const day = tmp.getDay() || 7; // 周日=7
    tmp.setDate(tmp.getDate() + (4 - day));
    const yearStart = new Date(tmp.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
    return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  loadWeek() {
    const key = this.currentWeekKey;
    if (key === this.weekKey && this.entries.length >= 0) {
      // 已加载本周
    }
    this.weekKey = key;
    const storageKey = `adventure_leaderboard_${key}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        this.entries = JSON.parse(saved);
        return;
      }
    } catch (e) {}
    this.entries = [];
  }

  save() {
    const storageKey = `adventure_leaderboard_${this.weekKey}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.entries));
    } catch (e) {}
  }

  // 清理过期周数据（保留最近 2 周）
  cleanupOldWeeks() {
    try {
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith('adventure_leaderboard_')
      );
      // 按键名排序（周标识天然有序），保留最近 2 个
      keys.sort().reverse();
      for (let i = 2; i < keys.length; i++) {
        localStorage.removeItem(keys[i]);
      }
    } catch (e) {}
  }

  // 添加一条记录
  addEntry(entry) {
    this.loadWeek(); // 确保加载本周
    this.cleanupOldWeeks();

    const record = {
      name: entry.name || 'Player',
      grade: entry.grade || 'C',
      mapName: entry.mapName || '',
      mapIndex: entry.mapIndex || 0,
      timeSec: entry.timeSec || 0,
      gold: entry.gold || 0,
      rewardGold: entry.rewardGold || 0,
      multi: entry.multi || 1.0,
      playerCount: entry.playerCount || 1,
      timestamp: Date.now(),
    };

    this.entries.push(record);

    // 按评级权重 + 金币排序
    const gradeWeight = { S: 5, A: 4, B: 3, C: 2, F: 1 };
    this.entries.sort((a, b) => {
      const wa = (gradeWeight[a.grade] || 0) * 10000 + a.gold;
      const wb = (gradeWeight[b.grade] || 0) * 10000 + b.gold;
      return wb - wa;
    });

    // 只保留前 50 条
    if (this.entries.length > 50) {
      this.entries = this.entries.slice(0, 50);
    }

    this.save();
    console.log(`[ADV-LB] entry added: ${record.name} ${record.grade} ${record.gold}g`);
    return record;
  }

  // 获取排行榜（最多 n 条）
  getTopEntries(n = 20) {
    this.loadWeek();
    return this.entries.slice(0, n);
  }

  // 获取本周最佳记录
  getBestEntry() {
    this.loadWeek();
    return this.entries.length > 0 ? this.entries[0] : null;
  }
}

// ================================================================
//  AdventureMode — 主控制器
// ================================================================
export class AdventureMode {
  constructor(game) {
    this.game = game;
    this.wave = null;
    this.econ = null;
    this.events = null;
    this.grade = null;
    this.daily = null;
    this.leaderboard = null;
    this.ui = null;
this.active = false;
this._respawnTimer = 0;
this._deathCount = 0;
this.devMode = false; // 开发者模式（按P键输入密码解锁）
// 多人模式：已死亡玩家集合（host 用于判断团灭）
    this._deadPlayers = new Set();
  }

  get localPlayerId() {
    if (this.game.multiplayer && this.game.multiplayer.playerId) {
      return this.game.multiplayer.playerId;
    }
    return 'local';
  }

  // 是否为主机（或单人模式）
  get isHost() {
    if (!this.game.multiplayer || !this.game.multiplayer.isConnected) return true;
    return this.game.multiplayer.isHost;
  }

  // 是否为客户端
  get isClient() {
    if (!this.game.multiplayer || !this.game.multiplayer.isConnected) return false;
    return !this.game.multiplayer.isHost;
  }

  init(loadSave = false) {
    this.active = true;

    // 初始化子系统
    this.wave = new WaveManager(this);
    this.econ = new EconomyManager(this);
    this.events = new EventSystem(this);
    this.grade = new GradeSystem(this);
    this.daily = new DailyMissions();
    this.leaderboard = new Leaderboard();

    // 禁用常规刷怪
    if (this.game.mobs) {
      this.game.mobs.setAdventureMode(true);
    }

    // 显示雷达地图
    if (this.game.ui) {
      this.game.ui.showRadar();
    }

    // 设置玩家
    const p = this.game.player;
    if (p) {
      p._advPid = this.localPlayerId;
      p.skills = p.loadAdventureSkills();
      p.gold = 0;
      p.skillPoints = 2; // 初始2点技能点
      p.maxHealth = p.getSkillBonus('maxHealth');
      p.health = p.maxHealth;

// 冒险模式：清空背包，仅给一把手枪
p.inventory = new Array(36).fill(null);
p.inventory[0] = { id: BLOCK.PISTOL, count: 1 };
p.hotbarIndex = 0; // 选中手枪
console.log('[ADV] starter items: pistol only (inventory cleared)');
    }

    // 初始化金币
    this.econ.teamGold[this.localPlayerId] = 0;

    // 设置 world.game 引用（供 ItemDrop 金币拾取使用）
    this.game.world.game = this.game;

    // 初始化 UI（延迟到 DOM 就绪后）
    this.initUI();

    // 从选定地图开始（或第一张图）
    const startMapIndex = (this.game._adventureMapIndex !== undefined) ? this.game._adventureMapIndex : 0;
    this.wave.mapIndex = startMapIndex;
    this.wave.waveIndex = 0;
    this.wave.waveState = 'intermission';
    this.wave.intermissionTimer = 5;

    // 应用地图主题
    this.applyMapTheme();

    // 弹药包定时器
    this._ammoDropTimer = 15; // 15秒后开始投放弹药包

    // URL 参数调试
    this.applyDebugParams();

    console.log('[ADV] Adventure Mode initialized — map:', this.wave.currentMap.nameZh);
  }

  initUI() {
    // 延迟导入 UI 模块
    import('./adventureUI.js').then(({ AdventureUI }) => {
      this.ui = new AdventureUI(this);
      this.ui.show();
      this.ui.renderWaveBanner(1, this.wave.totalWaves, 'intermission');
      this.ui.updateGold(0);
      this.ui.updateIntermission(5);
      this.ui.renderDailyMissions();
      console.log('[ADV] AdventureUI initialized');
    }).catch(e => {
      console.warn('[ADV] Failed to load AdventureUI:', e);
    });
  }

  applyDebugParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1' || window.__DEV) {
      // 暴露调试钩子
      window.__adv = {
        skipToWave: (n) => this.wave.startFrom(n),
        giveGold: (g) => this.econ.addGold(this.localPlayerId, g, 'debug'),
        triggerEvent: (e) => this.events.trigger(e),
        killAllMobs: () => this.game.mobs.mobs.forEach(m => m.takeDamage(9999)),
        setGrade: (g) => this.showGrade(g, { multi: 2.0 }),
        nextMap: () => this.nextMap(),
        dumpState: () => console.log(JSON.stringify(this.serializeState(), null, 2)),
        showLeaderboard: () => this.ui && this.ui.toggleLeaderboard(true),
        clearLeaderboard: () => { this.leaderboard.entries = []; this.leaderboard.save(); console.log('[ADV-LB] cleared'); },
      };
      console.log('[ADV] Debug hooks exposed at window.__adv');
    }
    const wave = parseInt(params.get('wave'));
    if (wave > 0) this.wave.startFrom(wave - 1);
    const gold = parseInt(params.get('gold'));
    if (gold > 0) this.econ.addGold(this.localPlayerId, gold, 'debug');
  }

  update(dt) {
    if (!this.active) return;

    // 客户端：不运行波次逻辑，由主机 adv_state 驱动
    // 但事件系统需要运行（处理事件倒计时和空投更新）
    if (!this.isClient) {
      // 波次系统（仅主机/单人）
      if (this.wave) this.wave.update(dt);
    }
    // 事件系统（主机和客户端都需要，但只有主机会触发随机事件）
    if (this.events) this.events.update(dt);

    // 弹药包定时生成（仅主机/单人）
    if (!this.isClient && this._ammoDropTimer !== undefined) {
      this._ammoDropTimer -= dt;
      if (this._ammoDropTimer <= 0) {
        this._ammoDropTimer = 20 + Math.random() * 15; // 20~35秒
        this.spawnAmmoDrop();
      }
    }

    // 复活倒计时（主机和客户端都运行）
    if (this._respawnTimer > 0) {
      this._respawnTimer -= dt;
      if (this.ui) {
        this.ui.updateRespawnTimer(Math.max(0, Math.ceil(this._respawnTimer)));
      }
      if (this._respawnTimer <= 0) {
        this.respawnPlayer();
      }
    }
  }

  // 击杀钩子
  onKill(killerId, mob) {
    if (!this.active) return;

    // 客户端：上报击杀给主机
    if (this.isClient) {
      if (this.game.multiplayer) {
        this.game.multiplayer.sendAdvKill(mob.id, mob.type, {});
      }
      return;
    }

    // 主机/单人：处理击杀
    if (this.grade) {
      this.grade.recordShot(true);
    }
    if (this.daily) {
      this.daily.updateProgress('kill_zombies');
    }

    // Boss 死亡
    if (mob.type === 'crystal_guardian' || mob.type === 'zombie_king') {
      this.onBossKilled(mob);
    }

    // 音效
    if (this.game.sound) this.game.sound.zombieDeath();
  }

  onBossKilled(boss) {
    console.log(`[ADV] Boss defeated: ${boss.type}`);
    // Boss 金币奖励（addGold 内部会应用技能和事件倍率）
    this.econ.addGold(this.localPlayerId, boss.goldValue, 'boss_kill');

    // 胜利烟花
    if (this.game.effects) {
      this.game.effects.spawnVictoryFirework(boss.position.x, boss.position.y, boss.position.z);
    }

    if (this.game.sound) this.game.sound.bossRoar();
    if (this.game.ui) this.game.ui.showToast(`🎉 Boss已击败！+${boss.goldValue}金币`, 3000);
  }

  // 地图通关
  onMapCleared() {
    console.log('[ADV] Map cleared!');
    const result = this.grade.calculateGrade();
    const totalGold = this.econ.getGold(this.localPlayerId);
    const rewardGold = Math.ceil(totalGold * result.multi);

    // 每日任务
    this.daily.updateProgress('clear_run');
    if (result.grade === 'S') this.daily.updateProgress('grade_s');

    const gradeData = {
      grade: result.grade,
      multi: result.multi,
      details: result.details,
      baseGold: totalGold,
      rewardGold: rewardGold,
    };

    // 主机广播结算数据给客户端
    if (this.isHost && this.game.multiplayer) {
      this.game.multiplayer.sendAdvGrade(gradeData);
    }

    if (this.ui) {
      this.ui.showGrade(result.grade, gradeData);
    }

    // 记录到排行榜
    if (this.leaderboard) {
      const elapsed = (Date.now() - this.grade.startTime) / 1000;
      const playerName = (this.game.multiplayer && this.game.multiplayer.playerName) || 'Player';
      this.leaderboard.addEntry({
        name: playerName,
        grade: result.grade,
        mapName: this.wave.currentMap.nameZh,
        mapIndex: this.wave.mapIndex,
        timeSec: Math.round(elapsed),
        gold: totalGold,
        rewardGold: rewardGold,
        multi: result.multi,
        playerCount: this.wave.playerCount,
      });
    }

    if (this.game.effects) {
      this.game.effects.spawnVictoryFirework(
        this.game.player.position.x,
        this.game.player.position.y,
        this.game.player.position.z
      );
    }
  }

  // 本地玩家死亡
  onLocalDeath() {
    if (!this.active) return;
    this._deathCount++;
    if (this.grade) this.grade.recordDeath();

    const n = this.wave.playerCount;
    if (n === 1) {
      // 单人：5秒复活
      this._respawnTimer = 5;
    } else {
      // 多人：需要队友复活，基础10秒，技能加速
      const reviveMul = this.game.player.getSkillBonus('reviveMul');
      this._respawnTimer = 10 / reviveMul;
    }

    if (this.ui) {
      this.ui.showDeathOverlay(this._respawnTimer);
    }
    console.log(`[ADV] local death — respawn in ${this._respawnTimer}s`);

    // 客户端：上报死亡给主机
    if (this.isClient && this.game.multiplayer) {
      this.game.multiplayer.sendAdvDeath();
    }
  }

  respawnPlayer() {
    const p = this.game.player;
    const spawn = this.game.spawnPoint || { x: 0, y: 40, z: 0 };
    p.respawn(spawn.x, spawn.y, spawn.z);
    p.health = p.maxHealth;
    if (this.ui) this.ui.hideDeathOverlay();
    if (this.game.ui) this.game.ui.showToast('已复活！', 1500);

    // 客户端：通知主机已复活
    if (this.isClient && this.game.multiplayer) {
      this.game.multiplayer.sendAdvRevive(this.localPlayerId);
    }
  }

  // 生成地面弹药包
  spawnAmmoDrop() {
    if (!this.game.mobs || !this.game.player) return;
    const p = this.game.player.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 10;
    const x = p.x + Math.cos(angle) * dist;
    const z = p.z + Math.sin(angle) * dist;

    // 找地面
    let y = p.y;
    for (let checkY = Math.floor(p.y) + 5; checkY > 0; checkY--) {
      if (this.game.world.getBlock(Math.floor(x), checkY, Math.floor(z)) !== 0) {
        y = checkY + 1;
        break;
      }
    }

    // 随机弹药类型
    const ammoTypes = [
      { id: BLOCK.BULLET_ITEM, count: 16 },
      { id: BLOCK.BULLET_ITEM, count: 24 },
      { id: BLOCK.GATLING_AMMO, count: 32 },
      { id: BLOCK.BARRETT_AMMO, count: 8 },
    ];
    const ammo = ammoTypes[Math.floor(Math.random() * ammoTypes.length)];
    this.game.mobs.spawnDrop(x, y + 0.5, z, ammo.id, ammo.count);
    if (this.ui) this.ui.showToast('🔫 地面出现弹药包！', 2000);
    console.log(`[ADV] ammo drop: ${ammo.id} x${ammo.count} at (${x.toFixed(1)}, ${y}, ${z.toFixed(1)})`);
  }

  // 应用地图主题到世界
  applyMapTheme() {
    const map = this.wave.currentMap;
    if (!map || !map.theme || !this.game.world) return;

    // 设置世界的冒险模式主题覆盖
    this.game.world.adventureTheme = map.theme;

    // 设置雾效
    if (this.game.scene && this.game.scene.fog) {
      this.game.scene.fog.color.setHex(map.theme.fogColor || 0xaaaaaa);
      this.game.scene.fog.density = map.theme.fogDensity || 0.008;
    } else if (this.game.scene) {
      this.game.scene.fog = new THREE.FogExp2(map.theme.fogColor || 0xaaaaaa, map.theme.fogDensity || 0.008);
    }

    console.log(`[ADV] map theme applied: ${map.theme.biome}`);
  }

  // 清空世界区块并重新加载（用于地图切换）
  reloadWorldChunks() {
    if (!this.game.world || !this.game.scene) return;
    // 移除所有已加载区块的 mesh
    for (const chunk of this.game.world.chunks.values()) {
      if (chunk.mesh) {
        this.game.scene.remove(chunk.mesh);
        if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
      }
      if (chunk.waterMesh) {
        this.game.scene.remove(chunk.waterMesh);
        if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
      }
    }
    this.game.world.chunks.clear();
    console.log('[ADV] world chunks cleared for map reload');
  }

  // 加载下一张地图
  nextMap() {
    const nextIndex = this.wave.mapIndex + 1;
    if (nextIndex >= ADVENTURE_MAPS.length) {
      // 全部通关
      if (this.game.ui) this.game.ui.showToast('🎉 恭喜通关全部关卡！', 5000);
      return;
    }
    this.loadMap(nextIndex);
  }

  loadMap(index) {
    this.wave.mapIndex = index;
    this.wave.waveIndex = 0;
    this.wave.waveState = 'intermission';
    this.wave.intermissionTimer = 5;
    this.wave.bossActive = false;

    // 清空怪物
    if (this.game.mobs) {
      for (const mob of this.game.mobs.mobs) {
        if (mob.mesh) this.game.scene.remove(mob.mesh);
      }
      this.game.mobs.mobs = [];
    }

    // 应用新地图主题并重载区块
    this.applyMapTheme();
    this.reloadWorldChunks();

    // 重置评分
    if (this.grade) this.grade.reset();

    // 重置弹药包定时器
    this._ammoDropTimer = 15;

    if (this.ui) {
      this.ui.renderWaveBanner(1, this.wave.totalWaves, 'intermission');
      this.ui.updateIntermission(5);
    }
    if (this.game.ui) this.game.ui.showToast(`进入: ${this.wave.currentMap.nameZh}`, 3000);
    console.log(`[ADV] loaded map ${index}: ${this.wave.currentMap.nameZh}`);
  }

  // 序列化状态（用于网络同步）
  serializeState() {
    return {
      mapIndex: this.wave.mapIndex,
      waveIndex: this.wave.waveIndex,
      waveState: this.wave.waveState,
      intermissionTimer: this.wave.intermissionTimer,
      teamGold: this.econ.teamGold,
      aliveInWave: this.wave.aliveInWave,
      boss: this.wave.bossEntity ? {
        type: this.wave.bossEntity.type,
        health: this.wave.bossEntity.health,
        maxHealth: this.wave.bossEntity.maxHealth,
        phase: this.wave.bossEntity.phase || 1,
      } : null,
      darkHour: this.events.activeEvents.dark_hour,
      goldRush: this.events.activeEvents.gold_rush,
    };
  }

  // 显示评分弹窗
  showGrade(grade, rewards) {
    if (this.ui) this.ui.showGrade(grade, rewards);
  }

  // ================================================================
  //  网络同步方法（Phase C）
  // ================================================================

  // ----- 客户端下行：接收主机状态 -----

  applyHostState(state) {
    if (!this.wave || !state) return;

    // 同步波次状态
    const prevWaveState = this.wave.waveState;
    this.wave.mapIndex = state.mapIndex;
    this.wave.waveIndex = state.waveIndex;
    this.wave.waveState = state.waveState;
    this.wave.intermissionTimer = state.intermissionTimer;
    this.wave.aliveInWave = state.aliveInWave;

    // 同步金币
    if (state.teamGold) {
      for (const [pid, gold] of Object.entries(state.teamGold)) {
        this.econ.teamGold[pid] = gold;
        if (pid === this.localPlayerId) {
          this.game.player.gold = gold;
          if (this.ui) this.ui.updateGold(gold);
        }
      }
    }

    // 同步事件状态
    if (this.events) {
      this.events.activeEvents.dark_hour = state.darkHour || false;
      this.events.activeEvents.gold_rush = state.goldRush || false;
    }

    // 更新 UI
    if (this.ui) {
      this.ui.renderWaveBanner(state.waveIndex + 1, this.wave.totalWaves, state.waveState);
      this.ui.updateMobCounter(state.aliveInWave);
      if (state.waveState === 'intermission' && state.intermissionTimer > 0) {
        this.ui.updateIntermission(Math.ceil(state.intermissionTimer));
      } else {
        this.ui.updateIntermission(0);
      }

      // Boss 血条
      if (state.boss) {
        const pct = state.boss.health / state.boss.maxHealth;
        const bossName = state.boss.type === 'crystal_guardian' ? '水晶守卫' : '僵尸君主';
        this.ui.updateBossBar(bossName, pct, state.boss.phase);
      } else {
        this.ui.updateBossBar(null, 0, 0);
      }
    }

    // 波次状态变化时播放音效
    if (prevWaveState !== state.waveState && state.waveState === 'spawning') {
      if (this.game.sound) this.game.sound.waveStart();
    }
  }

  // ----- 客户端下行：接收随机事件 -----

  handleEvent(eventName, payload = {}) {
    if (!this.events) return;
    console.log(`[ADV-NET] received event: ${eventName}`);

    // 客户端只执行 UI/状态/特效，不本地生成怪物（由 adv_spawn 处理）
    switch (eventName) {
      case 'dark_hour':
        this.events.activeEvents.dark_hour = true;
        this.events._darkHourTimer = 10;
        if (this.ui) this.ui.showToast('🌙 暗夜降临！击杀金币×2', 3000);
        if (this.game.sound) this.game.sound.supplyDrop();
        break;
      case 'gold_rush':
        this.events.activeEvents.gold_rush = true;
        this.events._goldRushTimer = 10;
        if (this.ui) this.ui.showToast('💰 金币狂欢！击杀金币×3', 3000);
        break;
      case 'healing_wave':
        this.game.player.heal(this.game.player.maxHealth);
        if (this.ui) this.ui.showToast('💚 治疗波涌！全员回满血', 3000);
        if (this.game.effects) this.game.effects.createHealingEffect(this.game.player.position);
        break;
      case 'supply_drop':
        // 客户端也创建空投视觉（不涉及怪物生成）
        this.events.spawnSupplyDrop();
        break;
      case 'zombie_horde':
        // 仅显示提示，怪物由主机通过 adv_spawn 同步
        if (this.ui) this.ui.showToast('⚠️ 尸潮来袭！', 3000);
        break;
      case 'airstrike':
        // 客户端也执行空袭特效
        this.events.callAirstrike();
        if (this.ui) this.ui.showToast('💥 空袭已标记！3秒后打击', 3000);
        break;
    }
  }

  // ----- 客户端下行：接收结算数据 -----

  handleGradeData(data) {
    console.log('[ADV-NET] received grade:', data.grade);
    if (this.ui) {
      this.ui.showGrade(data.grade, {
        multi: data.multi,
        details: data.details,
        baseGold: data.baseGold,
        rewardGold: data.rewardGold,
      });
    }
    if (this.game.effects) {
      this.game.effects.spawnVictoryFirework(
        this.game.player.position.x,
        this.game.player.position.y,
        this.game.player.position.z
      );
    }
    // 更新每日任务
    if (this.daily) {
      this.daily.updateProgress('clear_run');
      if (data.grade === 'S') this.daily.updateProgress('grade_s');
    }
  }

  // ----- 客户端下行：接收购买结果 -----

  handleBuyResult(data) {
    console.log(`[ADV-NET] buy result: ${data.itemId} success=${data.success}`);
    if (data.success) {
      // 更新本地金币
      this.econ.teamGold[this.localPlayerId] = data.gold;
      this.game.player.gold = data.gold;
      if (this.ui) {
        this.ui.updateGold(data.gold);
        this.ui.renderShop(); // 刷新商店
      }
      // 客户端本地发放购买的物品（使用主机指定的英雄武器ID）
      this.econ._grantBuyRewards(data.itemId, data.heroWeaponId || null);
      // 刷新快捷栏显示
      if (this.game.ui) this.game.ui.updateHotbar();
    } else {
      if (this.ui) this.ui.showToast(data.heroAllOwned ? '已拥有全部英雄武器！' : '购买失败！金币不足', 1500);
    }
  }

  // ----- 客户端下行：接收复活通知 -----

  handleRevive(data) {
    console.log(`[ADV-NET] revive: ${data.reviverId} -> ${data.targetId}`);
    if (data.targetId === this.localPlayerId) {
      // 自己被复活
      this._respawnTimer = 0;
      this.respawnPlayer();
      if (this.ui) this.ui.showToast('队友复活了你！', 2000);
    }
  }

  // ----- 主机下行：处理客户端击杀 -----

  onClientKill(clientId, data) {
    if (!this.active) return;
    console.log(`[ADV-NET] kill from ${clientId}: ${data.mobType}`);

    // 金币奖励
    const goldMap = {
      normal: 6, fast_z: 5, crawler: 6, brute: 20, bomber: 8,
      summoner: 12, winter_z: 8,
      crystal_guardian: 1000, zombie_king: 2000,
    };
    const gold = goldMap[data.mobType] || 6;
    this.econ.addGold(clientId, gold, 'kill');

    // Boss 击杀
    if (data.mobType === 'crystal_guardian' || data.mobType === 'zombie_king') {
      // 找到 Boss 实体处理
      const boss = this.game.mobs.mobs.find(m =>
        m.type === data.mobType && !m.dead
      );
      if (boss) {
        this.onBossKilled(boss);
      }
    }
  }

  // ----- 主机下行：处理客户端金币拾取 -----

  onClientPickup(clientId, amount, reason) {
    if (!this.active) return;
    this.econ.addGold(clientId, amount, reason);
  }

  // ----- 主机下行：处理客户端死亡 + 团灭判断 -----

  onClientDeath(clientId) {
    if (!this.active) return;
    this._deadPlayers.add(clientId);
    console.log(`[ADV-NET] death from ${clientId}, dead=${this._deadPlayers.size}`);

    // 记录评分
    if (this.grade) this.grade.recordDeath();

    // 检查团灭
    this.checkWipe();
  }

  // ----- 主机：检查是否团灭 -----

  checkWipe() {
    if (!this.game.multiplayer) return;

    // 计算总玩家数
    const totalPlayers = this.game.multiplayer.connections.size + 1; // 包含主机
    const deadCount = this._deadPlayers.size + (this._respawnTimer > 0 ? 1 : 0);

    console.log(`[ADV] wipe check: dead=${deadCount}/${totalPlayers}`);

    if (deadCount >= totalPlayers) {
      // 团灭
      if (this.grade) this.grade.recordWipe();
      console.log('[ADV] WIPE! All players dead');

      if (this.ui) this.ui.showToast('💀 团灭！', 3000);

      // 团灭后自动复活所有人
      this._deadPlayers.clear();
      this._respawnTimer = 0;

      // 复活所有客户端
      if (this.game.multiplayer) {
        for (const peerId of this.game.multiplayer.connections.keys()) {
          this.game.multiplayer.connections.get(peerId).send({
            type: 'adv_revive',
            reviverId: 'host',
            targetId: peerId,
          });
        }
      }

      // 复活主机
      this.respawnPlayer();

      // 回退一波
      if (this.wave.waveIndex > 0 && this.wave.waveState === 'fighting') {
        this.wave.waveIndex--;
        this.wave.waveState = 'intermission';
        this.wave.intermissionTimer = 10;
      }
    }
  }

  // ----- 主机下行：处理客户端复活 -----

  onClientRevive(reviverId, targetId) {
    console.log(`[ADV-NET] revive request: ${reviverId} -> ${targetId}`);
    // 从死亡列表移除
    this._deadPlayers.delete(targetId);

    // 如果目标是本地玩家（主机），复活
    if (targetId === this.localPlayerId) {
      this._respawnTimer = 0;
      this.respawnPlayer();
    }

    // 每日任务
    if (this.daily) this.daily.updateProgress('revive_ally');
  }

  // ----- 客户端：请求复活 -----

  requestRevive(targetId) {
    if (this.game.multiplayer) {
      this.game.multiplayer.sendAdvRevive(targetId);
    }
    // 主机/单人模式直接处理
    if (this.isHost) {
      this.onClientRevive(this.localPlayerId, targetId);
    }
  }
}
