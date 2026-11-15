/** Test helpers shared by the Daydream core tests (not cores themselves). */

/** Central finite difference of a scalar f at x in coordinate i. */
export function fd(f: (x: number[]) => number, x: number[], i: number, h = 1e-5): number {
  const a = x.slice();
  const b = x.slice();
  a[i] += h;
  b[i] -= h;
  return (f(a) - f(b)) / (2 * h);
}

/** Deterministic pseudo-random numbers in [lo, hi). */
export function rand(seed: number) {
  let s = seed >>> 0;
  return (lo = -1, hi = 1) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return lo + ((s >>> 8) / 16777216) * (hi - lo);
  };
}

export function vec(r: ReturnType<typeof rand>, n: number, lo = -1, hi = 1): number[] {
  return Array.from({ length: n }, () => r(lo, hi));
}

/** Standard normals from a seeded uniform source. */
export function normals(r: ReturnType<typeof rand>, n: number): number[] {
  return Array.from({ length: n }, () => {
    const u = Math.max(1e-12, r(0, 1));
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r(0, 1));
  });
}

/** ∫ f over [a, b] by composite Simpson's rule. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

export const normPdf = (x: number, m: number, v: number) => Math.exp(-((x - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);
