/**
 * mobile.js — 移动端检测、触摸控制系统
 * 摇杆移动、触摸视角、按钮操作（跳跃/潜行/飞行/挖掘/放置/背包/聊天）
 */

// ===== 移动端检测 =====
export function isMobileDevice() {
  // 多重检测：触摸屏 + 移动端UA + 屏幕尺寸
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent);
  const smallScreen = window.innerWidth <= 900 || window.innerHeight <= 500;
  // 触摸 + 移动UA => 移动端；触摸 + 小屏 => 也算移动端
  return (hasTouch && mobileUA) || (hasTouch && smallScreen);
}

export function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

// 监听屏幕旋转
export function onOrientationChange(callback) {
  window.addEventListener('orientationchange', () => {
    setTimeout(callback, 100);
  });
  window.addEventListener('resize', () => callback());
}

// ===== 移动端触摸控制 =====
export class MobileControls {
  constructor(game) {
    this.game = game;
    this.isActive = isMobileDevice();
    if (!this.isActive) return;

    // 摇杆状态
    this.joystick = {
      active: false,
      cx: 0, cy: 0,      // 摇杆中心（屏幕坐标）
      dx: 0, dy: 0,       // 摇杆偏移量（-1 到 1）
      touchId: null,
      maxRadius: 60,
    };

    // 视角拖拽状态
    this.look = {
      active: false,
      touchId: null,
      lastX: 0,
      lastY: 0,
    };

    // 按钮状态
    this.buttons = {}; // id -> { pressed, el }

    // 挖掘/放置状态
    this.mining = false;
    this.placeRequested = false;

    this.createUI();
    this.setupListeners();
    this.handleOrientation();

    // 监听旋转
    onOrientationChange(() => this.handleOrientation());
  }

  // 创建移动端UI
  createUI() {
    const container = document.getElementById('game-container');

    // 横屏提示
    const rotateHint = document.createElement('div');
    rotateHint.id = 'rotate-hint';
    rotateHint.innerHTML = '<div class="rotate-icon">📱</div><p>请横屏游玩</p>';
    container.appendChild(rotateHint);

    // 移动端控制层
    const ctrl = document.createElement('div');
    ctrl.id = 'mobile-controls';
    ctrl.innerHTML = `
      <!-- 左侧摇杆区 -->
      <div id="joystick-area">
        <div id="joystick-base">
          <div id="joystick-thumb"></div>
        </div>
      </div>

      <!-- 右侧操作按钮 -->
      <div id="mobile-buttons">
        <div id="mb-jump" class="mobile-btn round mb-jump">⤴<span>跳</span></div>
        <div id="mb-sneak" class="mobile-btn round mb-sneak">⬇<span>潜行</span></div>
        <div id="mb-fly" class="mobile-btn round mb-fly">🪽<span>飞行</span></div>
        <div id="mb-cam" class="mobile-btn round mb-cam">👁<span>视角</span></div>
        <div id="mb-inv" class="mobile-btn round mb-inv">🎒<span>背包</span></div>
        <div id="mb-chat" class="mobile-btn round mb-chat">💬<span>聊天</span></div>
      </div>

      <!-- 快捷栏切换（左右按钮） -->
      <div id="mb-hotbar-controls" class="hidden">
        <div id="mb-slot-prev" class="mobile-btn small">◀</div>
        <div id="mb-slot-next" class="mobile-btn small">▶</div>
      </div>
    `;
    container.appendChild(ctrl);

    // 存储按钮引用
    ['mb-jump', 'mb-sneak', 'mb-fly', 'mb-cam', 'mb-inv', 'mb-chat',
     'mb-slot-prev', 'mb-slot-next'].forEach(id => {
      this.buttons[id] = { pressed: false, el: document.getElementById(id) };
    });
  }

  // 设置触摸事件监听
  setupListeners() {
    const joystickArea = document.getElementById('joystick-area');
    const joystickBase = document.getElementById('joystick-base');
    const joystickThumb = document.getElementById('joystick-thumb');
    const canvas = this.game.canvas;

    // ===== 摇杆触摸 =====
    joystickArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joystick.active) return;
      const touch = e.changedTouches[0];
      this.joystick.active = true;
      this.joystick.touchId = touch.identifier;
      this.joystick.cx = touch.clientX;
      this.joystick.cy = touch.clientY;
      // 摇杆基座跟随触摸点
      joystickBase.style.left = (this.joystick.cx) + 'px';
      joystickBase.style.top = (this.joystick.cy) + 'px';
      joystickBase.style.transform = 'translate(-50%, -50%)';
      joystickBase.classList.add('active');
      joystickThumb.style.transform = 'translate(-50%, -50%)';
    }, { passive: false });

    joystickArea.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.joystick.touchId) continue;
        let dx = touch.clientX - this.joystick.cx;
        let dy = touch.clientY - this.joystick.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.joystick.maxRadius) {
          dx = (dx / dist) * this.joystick.maxRadius;
          dy = (dy / dist) * this.joystick.maxRadius;
        }
        this.joystick.dx = dx / this.joystick.maxRadius;
        this.joystick.dy = dy / this.joystick.maxRadius;
        // 更新摇杆拇指位置
        joystickThumb.style.left = (this.joystick.cx + dx) + 'px';
        joystickThumb.style.top = (this.joystick.cy + dy) + 'px';
        joystickThumb.style.transform = 'translate(-50%, -50%)';
      }
    }, { passive: false });

    const joystickEnd = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.joystick.touchId) continue;
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
        joystickBase.classList.remove('active');
        joystickThumb.style.transform = 'translate(-50%, -50%)';
        joystickThumb.style.left = this.joystick.cx + 'px';
        joystickThumb.style.top = this.joystick.cy + 'px';
      }
    };
    joystickArea.addEventListener('touchend', joystickEnd, { passive: false });
    joystickArea.addEventListener('touchcancel', joystickEnd, { passive: false });

    // ===== 视角触摸 + 点击放置 + 长按拆除 =====
    // 右半屏：拖拽视角，短按放置方块，长按拆除方块
    canvas.addEventListener('touchstart', (e) => {
      if (!this.game.input.pointerLocked && !this._uiOpen()) {
        for (const touch of e.changedTouches) {
          // 只处理右半屏的触摸（左半屏是摇杆）
          if (touch.clientX > window.innerWidth / 2 && !this.look.active && !this._isOnButton(touch.clientX, touch.clientY)) {
            this.look.active = true;
            this.look.touchId = touch.identifier;
            this.look.lastX = touch.clientX;
            this.look.lastY = touch.clientY;
            // 记录触摸起始信息（用于判断点击 vs 拖拽 vs 长按）
            this.look.startX = touch.clientX;
            this.look.startY = touch.clientY;
            this.look.startTime = performance.now();
            this.look.moved = false;
            this.look.longPressTriggered = false;
            this.look.longPressTimer = null;
            // 250ms 后触发长按拆除
            this.look.longPressTimer = setTimeout(() => {
              if (!this.look.moved && this.look.active) {
                this.look.longPressTriggered = true;
                this.game.input.mouseButtons.left = true;
              }
            }, 250);
          }
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this.look.touchId) continue;
        const dx = touch.clientX - this.look.lastX;
        const dy = touch.clientY - this.look.lastY;
        this.look.lastX = touch.clientX;
        this.look.lastY = touch.clientY;
        // 模拟鼠标移动
        this.game.input.mouseDX += dx * 2.0;
        this.game.input.mouseDY += dy * 2.0;
        // 检测是否移动超过阈值
        const moveDist = Math.sqrt(
          (touch.clientX - this.look.startX) ** 2 +
          (touch.clientY - this.look.startY) ** 2
        );
        if (moveDist > 10) {
          this.look.moved = true;
          // 如果已触发长按但用户移动了，取消挖掘
          if (this.look.longPressTriggered) {
            this.look.longPressTriggered = false;
            this.game.input.mouseButtons.left = false;
            this.game.input.miningTarget = null;
          }
          // 清除长按定时器
          if (this.look.longPressTimer) {
            clearTimeout(this.look.longPressTimer);
            this.look.longPressTimer = null;
          }
        }
      }
    }, { passive: false });

    const lookEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.look.touchId) {
          // 清除长按定时器
          if (this.look.longPressTimer) {
            clearTimeout(this.look.longPressTimer);
            this.look.longPressTimer = null;
          }
          const duration = performance.now() - this.look.startTime;
          // 如果是长按拆除，停止挖掘
          if (this.look.longPressTriggered) {
            this.game.input.mouseButtons.left = false;
            this.game.input.miningTarget = null;
            // 释放时触发单次点击（攻击生物/红石交互）
            this.game.input.leftClick = true;
          } else if (!this.look.moved && duration < 250) {
            // 短按：放置方块
            this.game.input.rightClick = true;
          }
          this.look.active = false;
          this.look.touchId = null;
          this.look.longPressTriggered = false;
        }
      }
    };
    canvas.addEventListener('touchend', lookEnd, { passive: false });
    canvas.addEventListener('touchcancel', lookEnd, { passive: false });

    // ===== 按钮触摸 =====
    this.setupButton('mb-jump', () => {
      // 跳跃：模拟空格按下
      this.game.input.keys['Space'] = true;
    }, () => {
      this.game.input.keys['Space'] = false;
    });

    this.setupButton('mb-sneak', () => {
      this.game.input.keys['ShiftLeft'] = true;
    }, () => {
      this.game.input.keys['ShiftLeft'] = false;
    });

    // 飞行按钮：单次点击
    this.setupButton('mb-fly', null, () => {
      if (this.game.player.toggleFly()) {
        if (this.game.ui) this.game.ui.showToast(this.game.player.flying ? '飞行: 开启' : '飞行: 关闭');
      }
    });

    // 背包按钮：单次点击
    this.setupButton('mb-inv', null, () => {
      this.game.input.justPressed['KeyE'] = true;
    });

    // 聊天按钮：单次点击
    this.setupButton('mb-chat', null, () => {
      this.game.openChat();
    });

    // 视角切换按钮：单次点击
    this.setupButton('mb-cam', null, () => {
      this.game.cameraMode = (this.game.cameraMode + 1) % 3;
      const modeNames = ['第一人称', '第三人称', '正面视角'];
      if (this.game.ui) this.game.ui.showToast(`视角: ${modeNames[this.game.cameraMode]}`);
      if (this.game.localPlayerModel) {
        this.game.localPlayerModel.group.visible = this.game.cameraMode !== 0;
      }
    });

    // 快捷栏切换（隐藏，改用直接点击）
    this.setupButton('mb-slot-prev', null, () => {
      this.game.player.hotbarIndex = (this.game.player.hotbarIndex - 1 + 9) % 9;
    });
    this.setupButton('mb-slot-next', null, () => {
      this.game.player.hotbarIndex = (this.game.player.hotbarIndex + 1) % 9;
    });

    // 移动端快捷栏直接点击选中（额外保障，ui.js 中也有处理）
    const hotbarSlots = document.querySelectorAll('.hotbar-slot');
    hotbarSlots.forEach((slot, i) => {
      slot.style.pointerEvents = 'auto';
      slot.style.touchAction = 'manipulation';
    });
  }

  // 设置按钮的触摸事件
  setupButton(id, onPress, onRelease) {
    const btn = this.buttons[id];
    if (!btn || !btn.el) return;

    const start = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.pressed = true;
      btn.el.classList.add('pressed');
      if (onPress) onPress();
    };

    const end = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.pressed = false;
      btn.el.classList.remove('pressed');
      if (onRelease) onRelease();
    };

    btn.el.addEventListener('touchstart', start, { passive: false });
    btn.el.addEventListener('touchend', end, { passive: false });
    btn.el.addEventListener('touchcancel', end, { passive: false });
  }

  // 检测坐标是否在按钮上
  _isOnButton(x, y) {
    for (const id in this.buttons) {
      const el = this.buttons[id].el;
      if (!el || el.classList.contains('hidden')) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;
      }
    }
    return false;
  }

  // 检测UI是否打开
  _uiOpen() {
    return this.game.ui && this.game.ui.isAnyMenuOpen();
  }

  // 横屏检测与提示
  handleOrientation() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;
    if (!isLandscape()) {
      hint.classList.add('show');
    } else {
      hint.classList.remove('show');
    }
  }

  // 每帧更新：将摇杆值转换为移动输入
  update(dt) {
    if (!this.isActive) return;

    // 摇杆控制移动方向
    // 摇杆向上(dy<0) => W, 向下(dy>0) => S, 向左(dx<0) => A, 向右(dx>0) => D
    const deadzone = 0.15;
    const jx = Math.abs(this.joystick.dx) > deadzone ? this.joystick.dx : 0;
    const jy = Math.abs(this.joystick.dy) > deadzone ? this.joystick.dy : 0;

    // 设置移动键状态（与 player.js handleMovement 配合）
    this.game.input.keys['KeyW'] = jy < -deadzone;
    this.game.input.keys['KeyS'] = jy > deadzone;
    this.game.input.keys['KeyA'] = jx < -deadzone;
    this.game.input.keys['KeyD'] = jx > deadzone;

    // 摇杆推到底 = 冲刺
    const mag = Math.sqrt(jx * jx + jy * jy);
    if (mag > 0.85) {
      this.game.input.keys['ControlLeft'] = true;
      this.game.input.keys['KeyW'] = jy < 0; // 确保有W
    } else {
      this.game.input.keys['ControlLeft'] = false;
    }
  }

  // 显示/隐藏移动端控件
  setVisible(visible) {
    const ctrl = document.getElementById('mobile-controls');
    if (ctrl) {
      ctrl.style.display = visible ? 'block' : 'none';
    }
  }

  // 在UI打开时隐藏触摸控件
  onMenuToggle(menuOpen) {
    this.setVisible(!menuOpen);
  }
}
