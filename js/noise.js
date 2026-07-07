/**
 * noise.js — 简化版 Simplex/Perlin 噪声实现
 * 用于程序化地形生成
 */

// ===== Perlin 噪声实现 =====
class PerlinNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.permutation = new Uint8Array(512);
    this.gradients = new Float32Array(512 * 3);
    this.init();
  }

  init() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // 基于种子的洗牌
    let s = this.seed || 1;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i & 255];
      // 预计算梯度向量
      const angle = rand() * Math.PI * 2;
      this.gradients[i * 3] = Math.cos(angle);
      this.gradients[i * 3 + 1] = Math.sin(angle);
      this.gradients[i * 3 + 2] = rand() * 2 - 1;
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // 2D Perlin 噪声
  noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.permutation[this.permutation[xi] + yi];
    const ab = this.permutation[this.permutation[xi] + yi + 1];
    const ba = this.permutation[this.permutation[xi + 1] + yi];
    const bb = this.permutation[this.permutation[xi + 1] + yi + 1];

    const g = (idx) => {
      const i = (idx & 511) * 3;
      return this.gradients[i] * (idx & 1 ? xf - 1 : xf) + this.gradients[i + 1] * (idx & 2 ? yf - 1 : yf);
    };

    const x1 = this.lerp(g(aa), g(ba), u);
    const x2 = this.lerp(g(ab), g(bb), u);
    return this.lerp(x1, x2, v);
  }

  // 3D Perlin 噪声（用于洞穴）
  noise3D(x, y, z) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const p = this.permutation;
    const aaa = p[p[p[xi] + yi] + zi];
    const aab = p[p[p[xi] + yi] + zi + 1];
    const aba = p[p[p[xi] + yi + 1] + zi];
    const abb = p[p[p[xi] + yi + 1] + zi + 1];
    const baa = p[p[p[xi + 1] + yi] + zi];
    const bab = p[p[p[xi + 1] + yi] + zi + 1];
    const bba = p[p[p[xi + 1] + yi + 1] + zi];
    const bbb = p[p[p[xi + 1] + yi + 1] + zi + 1];

    const grad = (hash, x, y, z) => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const x1 = this.lerp(grad(aaa, xf, yf, zf), grad(baa, xf - 1, yf, zf), u);
    const x2 = this.lerp(grad(aba, xf, yf - 1, zf), grad(bba, xf - 1, yf - 1, zf), u);
    const y1 = this.lerp(x1, x2, v);
    const x3 = this.lerp(grad(aab, xf, yf, zf - 1), grad(bab, xf - 1, yf, zf - 1), u);
    const x4 = this.lerp(grad(abb, xf, yf - 1, zf - 1), grad(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = this.lerp(x3, x4, v);
    return this.lerp(y1, y2, w);
  }

  // 分形布朗运动 (fBm) — 多层叠加噪声
  fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  fbm3D(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }
}

export { PerlinNoise };
