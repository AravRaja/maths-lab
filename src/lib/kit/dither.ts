/** Ordered (Bayer) dithering and cheap noise for monochrome texture. Pure functions; safe in workers. */

function bayer(n: number): number[] {
  // Recursive Bayer matrix of size n x n (n power of 2), values 0..n*n-1.
  if (n === 1) return [0];
  const h = n / 2;
  const m = bayer(h);
  const out = new Array<number>(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = m[(y % h) * h + (x % h)];
      const q = (y < h ? 0 : 2) + (x < h ? 0 : 1);
      out[y * n + x] = 4 * v + [0, 2, 3, 1][q];
    }
  return out;
}

/** Threshold matrices normalised to (0,1). */
export const BAYER4 = bayer(4).map((v) => (v + 0.5) / 16);
export const BAYER8 = bayer(8).map((v) => (v + 0.5) / 64);

/**
 * Quantise a field of values in [0,1] to `levels` grey tones with Bayer-8 ordered dithering.
 * Writes RGBA into `out` (length w*h*4). `tones` are the grey levels (0..1), dark to light.
 */
export function ditherField(
  field: Float32Array,
  w: number,
  h: number,
  out: Uint8ClampedArray,
  tones: number[] = [0, 0.55, 1],
): void {
  const n = tones.length - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = Math.max(0, Math.min(1, field[i])) * n;
      const lo = Math.floor(v);
      const t = BAYER8[(y & 7) * 8 + (x & 7)];
      const k = Math.min(n, lo + (v - lo > t ? 1 : 0));
      const g = Math.round(tones[k] * 255);
      const p = i * 4;
      out[p] = out[p + 1] = out[p + 2] = g;
      out[p + 3] = 255;
    }
  }
}

function hash(x: number, y: number, z: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683);
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1]. */
export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Three-octave fractal noise in [0,1]. */
export function fbm(x: number, y: number, seed = 0): number {
  return valueNoise(x, y, seed) * 0.55 + valueNoise(x * 2.13, y * 2.13, seed + 11) * 0.28 + valueNoise(x * 4.31, y * 4.31, seed + 23) * 0.17;
}
