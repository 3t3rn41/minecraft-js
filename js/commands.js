/**
 * commands.js — 聊天指令系统
 * 支持：/gamemode /time /weather /give /tp /kill /heal /spawn /fly /speed /setspawn /difficulty
 *       /enchant /effect /summon /brew /potion /clear /home /back /tnt /nuke /minigame /help
 */

import { GAMEMODE, GAMEMODE_NAMES } from './gamemodes.js';
import { BLOCK, BLOCK_DEFS } from './blocks.js';
import { ENCHANTMENT, getEnchantName } from './enchant.js';
import { POTION_EFFECT } from './brewing.js';

export class CommandSystem {
  constructor(game) {
    this.game = game;
    this.commands = new Map();
    this.registerCommands();
  }

  registerCommands() {
    // /gamemode <mode> — 切换游戏模式
    this.register('gamemode', (args) => {
      const mode = this.parseGamemode(args[0]);
      if (mode === null) return '用法: /gamemode <survival|creative|hardcore|spectator|skyblock|experience>';
      this.game.setGamemode(mode);
      return `游戏模式已切换为: ${GAMEMODE_NAMES[mode]}`;
    }, 'gm');

    // /time <set|add> <value|day|night|noon|midnight>
    this.register('time', (args) => {
      if (args[0] === 'set') {
        let time;
        switch (args[1]) {
          case 'day': time = 0.3; break;
          case 'noon': time = 0.5; break;
          case 'night': time = 0.0; break;
          case 'midnight': time = 0.0; break;
          default: time = parseFloat(args[1]) / 24000; break;
        }
        if (isNaN(time)) return '用法: /time set <day|night|noon|midnight|数值>';
        this.game.sky.setTime(time);
        // 多人同步
        if (this.game.multiplayer) this.game.multiplayer.sendTimeChange(time);
        return `时间已设置为: ${this.game.sky.getTimeString()}`;
      } else if (args[0] === 'add') {
        const add = parseFloat(args[1]) / 24000;
        if (isNaN(add)) return '用法: /time add <数值>';
        this.game.sky.setTime(this.game.sky.time + add);
        // 多人同步
        if (this.game.multiplayer) this.game.multiplayer.sendTimeChange(this.game.sky.time);
        return `时间已前进 ${args[1]} ticks`;
      }
      return '用法: /time <set|add> <值>';
    });

    // /weather <clear|rain|thunder|snow> [时长]
    this.register('weather', (args) => {
      if (!this.game.weather) return '天气系统未加载';
      const type = args[0];
      const duration = args[1] ? parseFloat(args[1]) : 60;
      if (type === 'clear') {
        this.game.weather.setWeather('clear', duration);
        if (this.game.multiplayer) this.game.multiplayer.sendWeatherChange('clear', duration);
        return '天气已设为: 晴朗';
      } else if (type === 'rain') {
        this.game.weather.setWeather('rain', duration);
        if (this.game.multiplayer) this.game.multiplayer.sendWeatherChange('rain', duration);
        return '天气已设为: 降雨';
      } else if (type === 'thunder') {
        this.game.weather.setWeather('thunder', duration);
        if (this.game.multiplayer) this.game.multiplayer.sendWeatherChange('thunder', duration);
        return '天气已设为: 雷暴';
      } else if (type === 'snow') {
        this.game.weather.setWeather('snow', duration);
        if (this.game.multiplayer) this.game.multiplayer.sendWeatherChange('snow', duration);
        return '天气已设为: 降雪';
      }
      return '用法: /weather <clear|rain|thunder|snow>';
    });

    // /give <blockId|name> [count]
    this.register('give', (args) => {
      const id = this.parseBlockId(args[0]);
      if (id === null) return `未知方块: ${args[0]}`;
      const count = args[1] ? parseInt(args[1]) : 1;
      this.game.player.addItem(id, count, true);
      const name = BLOCK_DEFS[id]?.name || id;
      return `已给予: ${name} x${count}`;
    });

    // /tp <x> <y> <z> 或 /tp <player>
    this.register('tp', (args) => {
      if (args.length >= 3) {
        const x = parseFloat(args[0]);
        const y = parseFloat(args[1]);
        const z = parseFloat(args[2]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) return '用法: /tp <x> <y> <z>';
        this.game.player.position = { x, y, z };
        this.game.player.velocity = { x: 0, y: 0, z: 0 };
        return `已传送到: ${x}, ${y}, ${z}`;
      }
      return '用法: /tp <x> <y> <z>';
    }, 'teleport');

    // /kill — 自杀
    this.register('kill', () => {
      this.game.player.takeDamage(1000);
      return '你已自杀';
    });

    // /heal — 恢复满血
    this.register('heal', () => {
      this.game.player.health = this.game.player.maxHealth;
      this.game.player.hunger = this.game.player.maxHunger;
      return '已恢复全部生命值和饥饿值';
    });

    // /fly — 切换飞行
    this.register('fly', () => {
      this.game.player.toggleFly();
      return this.game.player.flying ? '飞行已开启' : '飞行已关闭';
    });

    // /speed <数值> — 设置移动速度
    this.register('speed', (args) => {
      const speed = parseFloat(args[0]);
      if (isNaN(speed)) return '用法: /speed <1-10>';
      this.game.player.flySpeedMultiplier = speed;
      return `速度已设置为: ${speed}x`;
    });

    // /spawn <mob> [count] — 生成生物
    this.register('spawn', (args) => {
      const type = args[0];
      const count = args[1] ? parseInt(args[1]) : 1;
      if (!type) return '用法: /spawn <pig|zombie|cow|sheep|chicken|creeper|skeleton|spider|enderman|slime|iron_golem|wither|ender_dragon> [数量]';
      for (let i = 0; i < count; i++) {
        const px = this.game.player.position.x + (Math.random() - 0.5) * 6;
        const pz = this.game.player.position.z + (Math.random() - 0.5) * 6;
        this.game.mobs.spawnMob(px, this.game.player.position.y, pz, type);
        // 多人同步
        if (this.game.multiplayer) this.game.multiplayer.sendMobSpawn(px, this.game.player.position.y, pz, type);
      }
      return `已生成 ${count} 个 ${type}`;
    });

    // /setspawn — 设置出生点
    this.register('setspawn', () => {
      this.game.spawnPoint = { ...this.game.player.position };
      return `出生点已设置为: ${this.game.player.position.x.toFixed(1)}, ${this.game.player.position.y.toFixed(1)}, ${this.game.player.position.z.toFixed(1)}`;
    });

    // /difficulty <peaceful|easy|normal|hard>
    this.register('difficulty', (args) => {
      const levels = { peaceful: 0, easy: 1, normal: 2, hard: 3 };
      const level = levels[args[0]];
      if (level === undefined) return '用法: /difficulty <peaceful|easy|normal|hard>';
      this.game.difficulty = level;
      return `难度已设为: ${args[0]}`;
    });

    // /xp <amount> — 给予经验
    this.register('xp', (args) => {
      const amount = parseInt(args[0]);
      if (isNaN(amount)) return '用法: /xp <数值>';
      this.game.player.addXP(amount);
      return `已获得 ${amount} 经验值`;
    });

    // /god — 无敌模式
    this.register('god', () => {
      this.game.player.godMode = !this.game.player.godMode;
      return this.game.player.godMode ? '无敌模式: 开启' : '无敌模式: 关闭';
    });

    // /fill <x1> <y1> <z1> <x2> <y2> <z2> <block>
    this.register('fill', (args) => {
      if (args.length < 7) return '用法: /fill <x1> <y1> <z1> <x2> <y2> <z2> <block>';
      const x1 = parseInt(args[0]), y1 = parseInt(args[1]), z1 = parseInt(args[2]);
      const x2 = parseInt(args[3]), y2 = parseInt(args[4]), z2 = parseInt(args[5]);
      const id = this.parseBlockId(args[6]);
      if (id === null) return `未知方块: ${args[6]}`;
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
      let count = 0;
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            this.game.world.setBlock(x, y, z, id);
            count++;
          }
        }
      }
      return `已填充 ${count} 个方块`;
    });

    // /help — 显示帮助
    this.register('help', () => {
      const cmds = [
        '=== 基础指令 ===',
        '/gamemode <mode> — 切换游戏模式',
        '/time set <day|night|noon> — 设置时间',
        '/weather <clear|rain|thunder|snow> — 设置天气',
        '/give <block> [count] — 给予物品',
        '/tp <x> <y> <z> — 传送',
        '/kill — 自杀',
        '/heal — 恢复生命',
        '/fly — 切换飞行',
        '/speed <1-10> — 设置速度',
        '/difficulty <level> — 设置难度',
        '/xp <amount> — 获得经验',
        '/god — 无敌模式',
        '=== 世界指令 ===',
        '/setspawn — 设置出生点',
        '/home — 传送至出生点',
        '/back — 返回上次死亡位置',
        '/fill <x1> <y1> <z1> <x2> <y2> <z2> <block> — 填充区域',
        '/tnt [power] — 引爆TNT',
        '/nuke — 超级爆炸',
        '/clear — 清空背包',
        '=== 生物与Boss ===',
        '/spawn <mob> [count] — 生成生物',
        '/summon <wither|ender_dragon|iron_golem|enderman|slime> [count] — 召唤Boss',
        '=== 附魔与药水 ===',
        '/enchant <enchant_id> [level] — 附魔手持物品',
        '/effect <effect_id> [duration] [level] — 给予药水效果',
        '/potion <effect_id> — 直接饮用药水',
        '=== 小游戏 ===',
        '/minigame <pvp_arena|build_battle|spleef|capture_flag|parkour_race|tnt_parkour|bed_wars|skywars|hide_and_seek|stop>',
      ];
      return cmds.join('\n');
    }, '?');

    // /tnt <power> — 在玩家位置引爆TNT
    this.register('tnt', (args) => {
      const power = args[0] ? parseInt(args[0]) : 4;
      const pos = this.game.player.position;
      if (this.game.effects) {
        this.game.effects.createExplosion(pos.x, pos.y, pos.z, power);
      }
      return `BOOM! 威力: ${power}`;
    });

    // /nuke — 超级爆炸
    this.register('nuke', () => {
      const pos = this.game.player.position;
      if (this.game.effects) {
        this.game.effects.createExplosion(pos.x, pos.y, pos.z, 20);
      }
      return '☢️ 核弹引爆！';
    });

    // /minigame <type> — 启动小游戏
    this.register('minigame', (args) => {
      const type = args[0];
      if (!type) return '用法: /minigame <pvp_arena|build_battle|spleef|capture_flag|parkour_race|tnt_parkour|bed_wars|skywars|hide_and_seek|stop>';
      if (type === 'stop') {
        if (this.game.minigames) this.game.minigames.stopMinigame();
        return '小游戏已停止';
      }
      if (!this.game.minigames) return '小游戏系统未加载';
      const validTypes = ['pvp_arena', 'build_battle', 'spleef', 'capture_flag', 'parkour_race', 'tnt_parkour', 'bed_wars', 'skywars', 'hide_and_seek'];
      if (!validTypes.includes(type)) return `未知小游戏: ${type}。可选: ${validTypes.join(', ')}`;
      this.game.minigames.startMinigame(type);
      return `小游戏已启动: ${type}`;
    }, 'mg');

    // /enchant <enchant_id> [level] — 附魔手持物品
    this.register('enchant', (args) => {
      const enchId = args[0];
      if (!enchId) {
        const enchList = Object.values(ENCHANTMENT).map(e => `${e.id}(${e.name})`).join(', ');
        return `可用附魔: ${enchList}`;
      }
      const ench = Object.values(ENCHANTMENT).find(e => e.id === enchId);
      if (!ench) return `未知附魔: ${enchId}`;
      const level = args[1] ? parseInt(args[1]) : ench.maxLevel;
      if (isNaN(level) || level < 1 || level > ench.maxLevel) return `等级无效，范围: 1-${ench.maxLevel}`;
      const item = this.game.player.getSelectedItem();
      if (!item) return '请先选择一个物品';
      // 直接在物品上附魔
      if (!item.enchantments) item.enchantments = {};
      item.enchantments[enchId] = level;
      return `已附魔: ${getEnchantName(enchId, level)}`;
    }, 'ench');

    // /effect <effect_id> [duration] [level] — 给予药水效果
    this.register('effect', (args) => {
 const effectId = args[0];
      if (!effectId) {
        const effList = Object.values(POTION_EFFECT).map(e => `${e.id}(${e.name})`).join(', ');
        return `可用效果: ${effList}`;
      }
      const effect = Object.values(POTION_EFFECT).find(e => e.id === effectId);
      if (!effect) return `未知效果: ${effectId}`;
      const duration = args[1] ? parseInt(args[1]) : effect.duration;
      const level = args[2] ? parseInt(args[2]) : 1;
      if (!this.game.player.activeEffects) this.game.player.activeEffects = [];
      this.game.player.activeEffects.push({
        id: effect.id,
        name: effect.name,
        duration: duration,
        level: level,
        color: effect.color,
      });
      // 瞬间效果
      if (effect.id === 'instant_health') this.game.player.health = Math.min(this.game.player.maxHealth, this.game.player.health + level * 4);
      else if (effect.id === 'instant_damage') this.game.player.takeDamage(level * 6);
      else if (effect.id === 'saturation') this.game.player.hunger = Math.min(this.game.player.maxHunger, this.game.player.hunger + level * 4);
      return `已给予效果: ${effect.name} ${level}级 ${duration}秒`;
    }, 'eff');

    // /summon boss <wither|ender_dragon> — 召唤Boss
    this.register('summon', (args) => {
      const type = args[0];
      if (!type) return '用法: /summon <wither|ender_dragon|iron_golem|enderman|slime> [数量]';
      const bossTypes = ['wither', 'ender_dragon', 'iron_golem', 'enderman', 'slime'];
      if (!bossTypes.includes(type)) return `可用类型: ${bossTypes.join(', ')}`;
      const count = args[1] ? parseInt(args[1]) : 1;
      const px = this.game.player.position.x;
      const py = this.game.player.position.y;
      const pz = this.game.player.position.z;
      for (let i = 0; i < count; i++) {
        const ox = px + (Math.random() - 0.5) * 6;
        const oz = pz + (Math.random() - 0.5) * 6;
        this.game.mobs.spawnMob(ox, py + 2, oz, type);
        if (this.game.multiplayer) this.game.multiplayer.sendMobSpawn(ox, py + 2, oz, type);
      }
      return `已召唤 ${count} 个 ${type}`;
    }, 'sm');

    // /clear — 清空背包
    this.register('clear', () => {
      this.game.player.inventory = new Array(36).fill(null);
      return '背包已清空';
    });

    // /home — 传送到出生点
    this.register('home', () => {
      const sp = this.game.spawnPoint;
      this.game.player.position = { x: sp.x, y: sp.y, z: sp.z };
      this.game.player.velocity = { x: 0, y: 0, z: 0 };
      return '已传送到出生点';
    });

    // /back — 返回上次死亡位置
    this.register('back', () => {
      if (!this.game.lastDeathPos) return '没有上次死亡位置记录';
      this.game.player.position = { ...this.game.lastDeathPos };
      this.game.player.velocity = { x: 0, y: 0, z: 0 };
      return '已返回上次死亡位置';
    });

    // /potion <effect_id> — 直接饮用药水
    this.register('potion', (args) => {
      const effectId = args[0];
      if (!effectId) return '用法: /potion <speed|strength|night_vision|fire_resistance|water_breathing|regeneration|...>';
      const effect = Object.values(POTION_EFFECT).find(e => e.id === effectId);
      if (!effect) return `未知效果: ${effectId}`;
      if (!this.game.player.activeEffects) this.game.player.activeEffects = [];
      this.game.player.activeEffects.push({
        id: effect.id,
        name: effect.name,
        duration: effect.duration,
        level: 1,
        color: effect.color,
      });
      return `饮用了: ${effect.name}`;
    });
  }

  register(name, handler, ...aliases) {
    this.commands.set(name, handler);
    for (const alias of aliases) {
      this.commands.set(alias, handler);
    }
  }

  parseGamemode(str) {
    const map = {
      '0': GAMEMODE.SURVIVAL, 'survival': GAMEMODE.SURVIVAL, 's': GAMEMODE.SURVIVAL,
      '1': GAMEMODE.CREATIVE, 'creative': GAMEMODE.CREATIVE, 'c': GAMEMODE.CREATIVE,
      '2': GAMEMODE.HARDCORE, 'hardcore': GAMEMODE.HARDCORE, 'h': GAMEMODE.HARDCORE,
      '3': GAMEMODE.SPECTATOR, 'spectator': GAMEMODE.SPECTATOR, 'sp': GAMEMODE.SPECTATOR,
      '4': GAMEMODE.SKYBLOCK, 'skyblock': GAMEMODE.SKYBLOCK, 'sb': GAMEMODE.SKYBLOCK,
      '5': GAMEMODE.EXPERIENCE, 'experience': GAMEMODE.EXPERIENCE, 'exp': GAMEMODE.EXPERIENCE, 'e': GAMEMODE.EXPERIENCE,
    };
    return map[str?.toLowerCase()] ?? null;
  }

  parseBlockId(str) {
    if (!str) return null;
    // 尝试解析为数字
    const num = parseInt(str);
    if (!isNaN(num) && BLOCK_DEFS[num]) return num;
    // 尝试按名称查找
    const lower = str.toLowerCase();
    for (const [id, def] of Object.entries(BLOCK_DEFS)) {
      if (def.name === str || def.name.toLowerCase().includes(lower)) {
        return parseInt(id);
      }
    }
    return null;
  }

  execute(input) {
    if (!input.startsWith('/')) return null;
    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);
    const handler = this.commands.get(cmdName);
    if (!handler) {
      return `未知指令: /${cmdName} — 输入 /help 查看帮助`;
    }
    try {
      return handler(args);
    } catch (e) {
      return `指令执行错误: ${e.message}`;
    }
  }
}
