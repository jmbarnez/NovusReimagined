function hash(p: number): number {
  let h = p * 374761393 + 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

const GRAD: [number, number][] = [];
for (let i = 0; i < 256; i++) {
  const angle = (i / 256) * Math.PI * 2;
  GRAD.push([Math.cos(angle), Math.sin(angle)]);
}

let perm = new Uint16Array(512);

export function initNoise(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const rng = mulberry32(h >>> 0);
  const p = new Uint16Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number): number { return a + t * (b - a); }

function dotGrad(ix: number, iy: number, x: number, y: number): number {
  const g = GRAD[perm[perm[ix & 255] + (iy & 255)] & 255];
  return g[0] * x + g[1] * y;
}

export function noise2D(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const n00 = dotGrad(xi, yi, xf, yf);
  const n10 = dotGrad(xi + 1, yi, xf - 1, yf);
  const n01 = dotGrad(xi, yi + 1, xf, yf - 1);
  const n11 = dotGrad(xi + 1, yi + 1, xf - 1, yf - 1);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v) * 0.5 + 0.5;
}

export function fbm(x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
  let value = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq);
    maxAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return value / maxAmp;
}
