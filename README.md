# Minecraft JS — 我的世界浏览器版

基于 **Three.js** 构建的完整 Minecraft 克隆，运行在浏览器中，无需安装任何客户端。

![Game](https://img.shields.io/badge/Three.js-r160-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Version](https://img.shields.io/badge/version-2.0.0-orange)

## ✨ 特性

### 🎮 游戏模式
- **生存模式** — 采集资源、制作工具、与怪物战斗
- **创造模式** — 无限方块、自由飞行、无伤害
- **极限模式** — 只有一条命，怪物更强
- **旁观模式** — 穿墙飞行、自由观看世界
- **空岛模式** — 在浮空小岛上生存，资源有限
- **体验模式** — 免合成，直接使用所有物品探索

### 🌍 世界与生成
- 基于噪声程序化生成的无限方块世界
- 区块化加载（Chunk），支持地形、洞穴、植被
- 天气系统（雨、雪、雷暴）与昼夜循环
- 天空、太阳、月亮、星空渲染

### ⚔️ 玩法系统
- 完整的方块破坏与放置（60+ 种方块）
- 合成系统（工作台 + 背包合成）
- 附魔与药水酿造系统
- 战斗系统：剑、弓、弩、三叉戟、钓鱼竿等远程武器
- 投掷物（雪球、鸡蛋、末影珍珠）
- 农业、钓鱼与动物养殖
- 红石电路基础
- 装备与护甲系统
- 成就系统

### 👾 生物
- 敌对、中立、友好生物（僵尸、骷髅、苦力怕、末影人、村民等）
- AI 行为：寻路、攻击、逃跑

### 🎨 视觉与音效
- 第一人称 / 第三人称（背后/正面）三种相机模式
- 3D 玩家人形模型（用于第三人称和远程玩家）
- 第一人称手持物品 3D 建模渲染（方块、工具、武器、盾牌等）
- 音效与背景音乐系统

### 🌐 多人联机
- 基于 PeerWebRTC 的 P2P 多人联机
- 局域网房间发现与自动选举 Hub
- 内置小游戏：PvP 竞技场、建造大战、掘雪场、夺旗模式

### 📱 移动端适配
- 触屏虚拟摇杆与操作按钮
- 响应式 UI，适配手机和平板

### 💾 存档
- 本地存档/读档系统（世界与玩家数据）

## 🚀 快速开始

### 运行环境
- Node.js 14+
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 启动

```bash
# 安装依赖
npm install

# 启动本地服务器
npm start
```

打开浏览器访问 `http://localhost:8080` 即可开始游戏。

### 手动启动

如果没有 Node.js，也可以用任意静态服务器托管本项目：

```bash
# Python 3
python -m http.server 8080

# 或 VS Code Live Server 等
```

## 🎯 操作说明

| 操作 | 键盘/鼠标 | 触屏 |
|------|-----------|------|
| 移动 | W A S D | 左摇杆 |
| 跳跃 | 空格 | 跳跃按钮 |
| 飞行上升 | 空格 | 上升按钮 |
| 飞行下降 | Shift | 下降按钮 |
| 视角 | 鼠标移动 | 滑动屏幕 |
| 破坏方块 | 长按左键 | 长按方块 |
| 放置方块 | 右键 | 点击方块 |
| 选择物品栏 | 数字键 1-9 / 滚轮 | 点击物品栏 |
| 切换相机模式 | F5 | 相机按钮 |
| 打开背包 | E | 背包按钮 |

## 🗂 项目结构

```
minecraft/
├── index.html              # 入口 HTML，含所有界面
├── server.js               # 静态文件服务器
├── package.json            # 项目配置
├── css/
│   └── style.css           # 全局样式
└── js/
    ├── main.js             # 应用入口，启动流程
    ├── game.js             # 游戏核心逻辑（主循环、事件）
    ├── world.js            # 世界管理、噪声生成
    ├── chunk.js            # 区块数据与网格构建
    ├── blocks.js           # 方块定义与注册
    ├── player.js           # 玩家、物理、飞行、移动
    ├── playermodel.js      # 3D 玩家人形模型
    ├── helditem.js         # 第一人称手持物品 3D 渲染
    ├── mobs.js             # 生物定义与 AI
    ├── crafting.js         # 合成配方
    ├── enchant.js          # 附魔系统
    ├── brewing.js          # 药水酿造
    ├── ranged.js           # 远程武器与投掷物
    ├── farming.js          # 农业与动物养殖
    ├── fishing.js          # 钓鱼系统
    ├── redstone.js         # 红石电路
    ├── commands.js         # 聊天命令
    ├── effects.js          # 药水效果
    ├── gamemodes.js        # 游戏模式
    ├── achievements.js     # 成就
    ├── ui.js               # 界面逻辑
    ├── input.js            # 输入处理
    ├── mobile.js           # 移动端触控
    ├── sound.js            # 音效与音乐
    ├── music.js            # 背景音乐
    ├── weather.js          # 天气系统
    ├── sky.js              # 天空渲染
    ├── noise.js            # Perlin/Simplex 噪声
    ├── save.js             # 存档系统
    └── multiplayer.js      # 多人联机网络
```

## 🛠 技术栈

- **Three.js** — WebGL 3D 渲染
- **PeerJS** — WebRTC 点对点连接（多人联机）
- **原生 JavaScript (ES Modules)** — 无前端框架
- **Node.js** — 开发用静态服务器

## 📄 协议

[MIT](LICENSE) © 2024 3t3rn41
