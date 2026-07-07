/**
 * input.js — 输入处理：键盘、鼠标、指针锁定
 */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseButtons = { left: false, right: false, middle: false };
    this.pointerLocked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;

    // 单次触发按键（用于背包等UI切换）
    this.justPressed = {};

    // 鼠标左键/右键单次点击
    this.leftClick = false;
    this.rightClick = false;

    this.setupListeners();
  }

  setupListeners() {
    // 键盘事件
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys[e.code]) {
        this.justPressed[e.code] = true;
      }
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // 鼠标移动（指针锁定时）
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });

    // 鼠标按键
    document.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) { this.mouseButtons.left = true; this.leftClick = true; }
      if (e.button === 1) { this.mouseButtons.middle = true; }
      if (e.button === 2) { this.mouseButtons.right = true; this.rightClick = true; }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseButtons.left = false;
      if (e.button === 1) this.mouseButtons.middle = false;
      if (e.button === 2) this.mouseButtons.right = false;
    });

    // 阻止右键菜单
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // 滚轮
    document.addEventListener('wheel', (e) => {
      if (this.pointerLocked) {
        this.wheelDelta += Math.sign(e.deltaY);
        e.preventDefault();
      }
    }, { passive: false });

    // 指针锁定变化
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  // 请求指针锁定
  requestPointerLock() {
    this.canvas.requestPointerLock();
  }

  // 退出指针锁定
  exitPointerLock() {
    document.exitPointerLock();
  }

  // 消耗鼠标增量
  consumeMouseDelta() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  // 消耗滚轮
  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  // 消耗点击
  consumeLeftClick() {
    const c = this.leftClick;
    this.leftClick = false;
    return c;
  }

  consumeRightClick() {
    const c = this.rightClick;
    this.rightClick = false;
    return c;
  }

  // 检查单次触发按键
  consumeKey(code) {
    if (this.justPressed[code]) {
      this.justPressed[code] = false;
      return true;
    }
    return false;
  }

  // 清除单次触发
  clearJustPressed() {
    this.justPressed = {};
  }
}
