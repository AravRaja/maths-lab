/** Sample-quality numbers for the 2D views. Plumbing. */

/** Mean distance from each sample to its nearest data point. */
export function meanNearest(samples: ArrayLike<number>[], data: ArrayLike<number>[]): number {
  if (!samples.length) return 0;
  let tot = 0;
  for (const s of samples) {
    let best = Infinity;
    for (const d of data) best = Math.min(best, (s[0] - d[0]) ** 2 + (s[1] - d[1]) ** 2);
    tot += Math.sqrt(best);
  }
  return tot / samples.length;
}

/** Mean of (path length / straight-line distance): 1 means perfectly straight paths. */
export function straightness(paths: ArrayLike<number>[][]): number {
  let tot = 0;
  let n = 0;
  for (const p of paths) {
    let len = 0;
    for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const chord = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]);
    if (chord > 1e-6) { tot += len / chord; n++; }
  }
  return n ? tot / n : 1;
}

/** Unflatten a P × (S+1) × 2 Float32Array of paths. */
export function unflattenPaths(flat: Float32Array, P: number, S: number): [number, number][][] {
  const out: [number, number][][] = [];
  for (let p = 0; p < P; p++) {
    const path: [number, number][] = [];
    for (let k = 0; k <= S; k++) path.push([flat[(p * (S + 1) + k) * 2], flat[(p * (S + 1) + k) * 2 + 1]]);
    out.push(path);
  }
  return out;
}
