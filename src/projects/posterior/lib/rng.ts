/** Seeded randomness. Plumbing, not a core: every sampler on the page draws from here so runs are repeatable. */

export type Rng = () => number;

/** mulberry32: tiny, fast, good enough for pictures and tests. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sampler (Box-Muller, caches the second value). */
export function normalSampler(rng: Rng): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Bernoulli(p) coin stream: 1 = heads. */
export function coinFlips(rng: Rng, p: number, n: number): number[] {
  return Array.from({ length: n }, () => (rng() < p ? 1 : 0));
}
