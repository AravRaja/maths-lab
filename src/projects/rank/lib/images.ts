import type { Matrix } from "../core/types";
import { randomFace, renderFace } from "./faces";
import { rng } from "./rng";

/*
 * Built-in test images for the compressor, as greyscale matrices in [0, 1]. Each one teaches
 * something about rank: the checkerboard and plaid are exactly low rank, the triangle looks
 * simple but is full rank, noise has nothing to compress.
 */

export type PresetId = "portrait" | "plaid" | "checker" | "triangle" | "rings" | "noise";

export const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: "portrait", label: "Portrait", hint: "A drawn face: most of it lives in a few dozen layers." },
  { id: "plaid", label: "Plaid", hint: "Built from three outer products. What is its rank?" },
  { id: "checker", label: "Checker", hint: "A chessboard. Guess the rank before you scrub." },
  { id: "triangle", label: "Triangle", hint: "Half black, half white along the diagonal. Looks simple; is it low rank?" },
  { id: "rings", label: "Rings", hint: "Concentric circles: no axis-aligned structure at all." },
  { id: "noise", label: "Noise", hint: "Random pixels. Nothing to compress." },
];

export const IMG = 160;

export function presetImage(id: PresetId, size = IMG): Matrix {
  const m = size, n = size;
  const A: Matrix = { rows: m, cols: n, data: new Float64Array(m * n) };
  const set = (f: (i: number, j: number) => number) => {
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) A.data[i * n + j] = f(i, j);
  };
  switch (id) {
    case "portrait": {
      const p = randomFace(rng(42));
      Object.assign(p, { lx: -0.55, ly: -0.4, smile: 0.09, glasses: 1, hair: 0.05, skin: 0.78, bg: 0.34 });
      renderFace(p, n, m, A.data, 0.05, 9);
      break;
    }
    case "plaid": {
      const a = (t: number) => 0.5 + 0.5 * Math.sin(t * 0.21);
      const b = (t: number) => (Math.floor(t / 20) % 2 ? 1 : 0.2);
      const c = (t: number) => Math.exp(-(((t - n / 2) / 28) ** 2));
      set((i, j) => 0.45 * a(i) * b(j) + 0.35 * b(i) * c(j) + 0.2 * c(i) * a(j));
      break;
    }
    case "checker":
      set((i, j) => ((Math.floor(i / 20) + Math.floor(j / 20)) % 2 ? 0.92 : 0.08));
      break;
    case "triangle":
      set((i, j) => (j <= i ? 0.92 : 0.08));
      break;
    case "rings":
      set((i, j) => {
        const r = Math.hypot(i - m / 2 + 0.5, j - n / 2 + 0.5);
        return 0.5 + 0.5 * Math.cos(r * 0.42);
      });
      break;
    case "noise": {
      const r = rng(5);
      set(() => r());
      break;
    }
  }
  return A;
}

/** Luminance of an RGBA buffer as a matrix in [0, 1]. */
export function fromImageData(img: { width: number; height: number; data: Uint8ClampedArray }): Matrix {
  const { width: n, height: m, data } = img;
  const A: Matrix = { rows: m, cols: n, data: new Float64Array(m * n) };
  for (let i = 0; i < m * n; i++) A.data[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  return A;
}
