/**
 * The 2D reacher: a two-link arm whose fingertip must get from the start to a target without
 * touching the post in between. The expert goes round the post on the left or on the right with
 * equal probability, so the demonstrations are bimodal: that is what a flow policy can represent and
 * an L2 regressor cannot. Kinematics, the expert and the rollout loop are plumbing.
 */

import { mulberry32, type Rng } from "./rng";

export const L1 = 1.0;
export const L2 = 0.8;
export const POST = { x: 1.0, y: 0, r: 0.3 };
/** Control steps in one expert demonstration. */
export const EPISODE = 30;
/** Actions per chunk (the policy's horizon H). */
export const H = 8;
/** Joint-space action dims. */
export const ADIM = 2;
/** Chunk vector length: H × ADIM. */
export const CHUNK = H * ADIM;
/** Context: cos q1, sin q1, cos q2, sin q2, target x, target y. */
export const CTX = 6;
/** Joint deltas are multiplied by this so chunks are O(1), like the N(0, I) noise. */
export const ACTION_SCALE = 10;
/** Largest joint step the arm will take per control step (rad). */
export const MAX_STEP = 0.16;

export type Q = [number, number];
export type P2 = [number, number];

export function fk(q: Q): { elbow: P2; tip: P2 } {
  const elbow: P2 = [L1 * Math.cos(q[0]), L1 * Math.sin(q[0])];
  const a = q[0] + q[1];
  return { elbow, tip: [elbow[0] + L2 * Math.cos(a), elbow[1] + L2 * Math.sin(a)] };
}

/** Analytic two-link IK, fixed elbow branch. */
export function ik(p: P2, elbow = 1): Q {
  const r2 = p[0] * p[0] + p[1] * p[1];
  const c2 = Math.max(-1, Math.min(1, (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
  const q2 = elbow * Math.acos(c2);
  const q1 = Math.atan2(p[1], p[0]) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
  return [q1, q2];
}

export interface Scene {
  start: P2;
  target: P2;
}

export function randomScene(rng: Rng): Scene {
  return {
    start: [0.95 + (rng() - 0.5) * 0.3, -0.95 + (rng() - 0.5) * 0.2],
    target: [0.95 + (rng() - 0.5) * 0.3, 0.95 + (rng() - 0.5) * 0.2],
  };
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Expert fingertip path round the post on one side (−1 left / inside, +1 right / outside). */
export function expertTips(s: Scene, side: -1 | 1): P2[] {
  const C: P2 = [POST.x + side * 1.05, (s.start[1] + s.target[1]) / 2];
  const out: P2[] = [];
  for (let k = 0; k <= EPISODE; k++) {
    const u = smooth(k / EPISODE);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    out.push([a * s.start[0] + b * C[0] + c * s.target[0], a * s.start[1] + b * C[1] + c * s.target[1]]);
  }
  return out;
}

export function context(q: Q, target: P2): number[] {
  return [Math.cos(q[0]), Math.sin(q[0]), Math.cos(q[1]), Math.sin(q[1]), target[0], target[1]];
}

export interface Demo {
  scene: Scene;
  side: -1 | 1;
  qs: Q[];
  tips: P2[];
}

export function expertDemo(s: Scene, side: -1 | 1): Demo {
  const tips = expertTips(s, side);
  const qs = tips.map((p) => ik(p));
  return { scene: s, side, qs, tips };
}

/** Training pairs: (context at step k, the next H joint deltas, scaled and flattened). */
export function demoDataset(n: number, seed: number): { ctx: number[][]; chunks: number[][]; demos: Demo[] } {
  const rng = mulberry32(seed);
  const ctx: number[][] = [];
  const chunks: number[][] = [];
  const demos: Demo[] = [];
  for (let e = 0; e < n; e++) {
    const d = expertDemo(randomScene(rng), rng() < 0.5 ? -1 : 1);
    demos.push(d);
    for (let k = 0; k < EPISODE; k++) {
      const ch: number[] = [];
      for (let h = 0; h < H; h++) {
        const i = Math.min(k + h, EPISODE - 1);
        const j = Math.min(k + h + 1, EPISODE);
        const moving = k + h < EPISODE;
        ch.push(moving ? (d.qs[j][0] - d.qs[i][0]) * ACTION_SCALE : 0, moving ? (d.qs[j][1] - d.qs[i][1]) * ACTION_SCALE : 0);
      }
      ctx.push(context(d.qs[k], d.scene.target));
      chunks.push(ch);
    }
  }
  return { ctx, chunks, demos };
}

/** Unflatten a chunk vector into H joint deltas (radians). */
export function chunkActions(v: ArrayLike<number>): number[][] {
  const out: number[][] = [];
  for (let h = 0; h < H; h++) out.push([v[h * 2] / ACTION_SCALE, v[h * 2 + 1] / ACTION_SCALE]);
  return out;
}

/** Fingertip positions if the arm at q played these actions. */
export function ribbon(q: Q, actions: number[][]): P2[] {
  let c: Q = [q[0], q[1]];
  const out: P2[] = [fk(c).tip];
  for (const a of actions) {
    c = [c[0] + a[0], c[1] + a[1]];
    out.push(fk(c).tip);
  }
  return out;
}

export function hitsPost(p: P2): boolean {
  return Math.hypot(p[0] - POST.x, p[1] - POST.y) < POST.r;
}

export function clampStep(a: number[]): Q {
  const n = Math.hypot(a[0], a[1]);
  const k = n > MAX_STEP ? MAX_STEP / n : 1;
  return [a[0] * k, a[1] * k];
}
