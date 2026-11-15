import { gauss, rng } from "./rng";

export type DatasetName = "moons" | "circles" | "spiral" | "xor";
export const DATASETS: DatasetName[] = ["moons", "circles", "spiral", "xor"];

export interface Dataset {
  /** Points in roughly [-1.5, 1.5]². */
  x: [number, number][];
  /** Labels in {−1, +1}. */
  y: number[];
}

/** 2D toy classification sets. Deterministic for a given seed. */
export function makeDataset(name: DatasetName, n = 120, seed = 7, noise = 0.1): Dataset {
  const r = rng(seed);
  const x: [number, number][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const cls = i % 2 === 0 ? 1 : -1;
    let px = 0, py = 0;
    if (name === "moons") {
      const t = Math.PI * r();
      if (cls > 0) { px = Math.cos(t); py = Math.sin(t) - 0.25; }
      else { px = 1 - Math.cos(t); py = 0.25 - Math.sin(t); }
      px = (px - 0.5) * 1.1;
      py *= 1.1;
    } else if (name === "circles") {
      const t = 2 * Math.PI * r();
      const rad = cls > 0 ? 0.45 : 1.15;
      px = rad * Math.cos(t); py = rad * Math.sin(t);
    } else if (name === "spiral") {
      const t = 0.25 + 2.6 * Math.PI * (i / n);
      const rad = 0.13 * t;
      const ph = cls > 0 ? 0 : Math.PI;
      px = rad * Math.cos(t + ph); py = rad * Math.sin(t + ph);
    } else {
      px = r() * 2.4 - 1.2; py = r() * 2.4 - 1.2;
      y.push(Math.sign(px * py) || 1);
      x.push([px, py]);
      continue;
    }
    x.push([px + noise * gauss(r), py + noise * gauss(r)]);
    y.push(cls);
  }
  return { x, y };
}
