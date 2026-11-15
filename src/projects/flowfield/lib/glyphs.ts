/**
 * Point clouds from glyphs, sampled from text drawn on an offscreen canvas.
 * Client-only (needs a canvas); falls back to a spiral where there is none.
 */

import { mulberry32, gauss } from "./rng";
import { normalise, spiral, type Pt } from "./shapes";

export const GLYPHS = ["∇", "π", "∂", "∞", "λ"] as const;
export type Glyph = (typeof GLYPHS)[number];

const cache = new Map<string, Pt[]>();

export function glyphPoints(ch: string, n: number, seed = 11): Pt[] {
  const key = `${ch}|${n}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return spiral(n, seed);
  const S = 160;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return spiral(n, seed);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(S * 0.8)}px "Times New Roman", Georgia, serif`;
  ctx.fillText(ch, S / 2, S / 2 + S * 0.04);
  const img = ctx.getImageData(0, 0, S, S).data;
  const on: Pt[] = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img[(y * S + x) * 4] > 140) on.push([x, -y]);
  if (on.length < 10) return spiral(n, seed);
  const rng = mulberry32(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = on[Math.floor(rng() * on.length)];
    pts.push([p[0] + gauss(rng) * 0.6, p[1] + gauss(rng) * 0.6]);
  }
  const out = normalise(pts, 1.45);
  cache.set(key, out);
  return out;
}
