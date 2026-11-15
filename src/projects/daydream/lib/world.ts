import { rng } from "./rng";

/*
 * The world Daydream watches: one heavy ball in a box, with gravity, bouncy walls and four
 * actions (coast, push left, push right, jump). It is seen only as a small grey frame.
 * Pure plumbing (no cores), shared by the page and the training worker.
 */

/** Frame side in pixels. Frames are row-major Float32Array(SIDE * SIDE) of greys in [0, 1]. */
export const SIDE = 20;
export const PIXELS = SIDE * SIDE;
/** Number of discrete actions. */
export const N_ACTIONS = 4;
export type Action = 0 | 1 | 2 | 3;
export const ACTION_NAMES = ["coast", "left", "right", "jump"] as const;

export interface BallState {
  /** Centre, in box units: [R, 1 − R] on both axes, y grows downwards. */
  x: number;
  y: number;
  /** Velocity, box units per step. */
  vx: number;
  vy: number;
}

/** Ball radius in box units. */
export const R = 0.16;
const GRAVITY = 0.0045;
const PUSH = 0.006;
const JUMP = 0.016;
const BOUNCE = 0.82;
const DRAG = 0.992;
const VMAX = 0.07;

const clampV = (v: number) => Math.max(-VMAX, Math.min(VMAX, v));

/** One physics step. `kick` is an extra impulse the model never sees as an action (for surprise). */
export function step(s: BallState, a: Action, kick: { vx: number; vy: number } = { vx: 0, vy: 0 }): BallState {
  let vx = s.vx * DRAG + (a === 1 ? -PUSH : a === 2 ? PUSH : 0) + kick.vx;
  let vy = s.vy * DRAG + GRAVITY - (a === 3 ? JUMP : 0) + kick.vy;
  vx = clampV(vx);
  vy = clampV(vy);
  let x = s.x + vx;
  let y = s.y + vy;
  if (x < R) { x = 2 * R - x; vx = -vx * BOUNCE; }
  if (x > 1 - R) { x = 2 * (1 - R) - x; vx = -vx * BOUNCE; }
  if (y < R) { y = 2 * R - y; vy = -vy * BOUNCE; }
  if (y > 1 - R) { y = 2 * (1 - R) - y; vy = -vy * BOUNCE; }
  return { x, y, vx, vy };
}

const smooth = (d: number, w: number) => Math.max(0, Math.min(1, 0.5 - d / w));

/** Soft-rasterise the ball: an anti-aliased disc with a slightly darker core ring, nothing else. */
export function render(s: { x: number; y: number }, side = SIDE, out = new Float32Array(side * side)): Float32Array {
  const cx = s.x * side - 0.5;
  const cy = s.y * side - 0.5;
  const r = R * side;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const d = Math.hypot(x - cx, y - cy) - r;
      out[y * side + x] = smooth(d, 3);
    }
  }
  return out;
}

export interface Episode {
  /** Frames, (T + 1) * side². */
  frames: Float32Array;
  /** True state at each frame, (T + 1) * 4 as [x, y, vx, vy]. */
  states: Float32Array;
  /** Action taken between frame t and t + 1, length T. */
  actions: Uint8Array;
}

/** A "babbling" policy: hold a random action for a random few steps. Covers arcs, rolls and bounces. */
export function babble(seed: number) {
  const r = rng(seed);
  let a: Action = 0;
  let left = 0;
  return (): Action => {
    if (left <= 0) {
      const u = r();
      a = (u < 0.4 ? 0 : u < 0.6 ? 1 : u < 0.8 ? 2 : 3) as Action;
      left = a === 3 ? 1 + Math.floor(r() * 4) : 3 + Math.floor(r() * 14);
    }
    left--;
    return a;
  };
}

export function randomState(r: () => number): BallState {
  return { x: R + r() * (1 - 2 * R), y: R + r() * (1 - 2 * R), vx: (r() * 2 - 1) * 0.04, vy: (r() * 2 - 1) * 0.04 };
}

export function rollEpisode(seed: number, T: number, side = SIDE): Episode {
  const r = rng(seed * 7919 + 1);
  const policy = babble(seed);
  const P = side * side;
  const frames = new Float32Array((T + 1) * P);
  const states = new Float32Array((T + 1) * 4);
  const actions = new Uint8Array(T);
  let s = randomState(r);
  for (let t = 0; t <= T; t++) {
    states.set([s.x, s.y, s.vx, s.vy], t * 4);
    render(s, side, frames.subarray(t * P, (t + 1) * P));
    if (t < T) {
      const a = policy();
      actions[t] = a;
      s = step(s, a);
    }
  }
  return { frames, states, actions };
}

export function collect(episodes: number, T: number, seed = 1, side = SIDE): Episode[] {
  return Array.from({ length: episodes }, (_, i) => rollEpisode(seed * 1000 + i, T, side));
}
