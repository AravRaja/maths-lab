/** Bin raw samples into `bins` equal-width buckets over [lo, hi]. */
export function binSamples(samples: ArrayLike<number>, bins: number, range?: [number, number]) {
  let lo = range?.[0] ?? Infinity;
  let hi = range?.[1] ?? -Infinity;
  if (!range) for (let i = 0; i < samples.length; i++) { lo = Math.min(lo, samples[i]); hi = Math.max(hi, samples[i]); }
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  const counts = new Array<number>(bins).fill(0);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (v < lo || v > hi) continue;
    counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  }
  return { counts, lo, hi };
}

