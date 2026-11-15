/** Seeded randomness (mulberry32 + Box–Muller). Plumbing, not a core. Safe in workers. */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard normal draw. */
export function gauss(rng: Rng): number {
  let u = 0;
  while (u <= 1e-12) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** A vector of d standard normal draws: x_0 ~ N(0, I). */
export function gaussVec(rng: Rng, d: number): number[] {
  const out = new Array<number>(d);
  for (let i = 0; i < d; i++) out[i] = gauss(rng);
  return out;
}

export function randInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}
