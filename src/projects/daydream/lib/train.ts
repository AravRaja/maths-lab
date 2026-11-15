import { collect, PIXELS, type Episode } from "./world";
import { encode, decode, initVae, vaeOpt, vaeStep, LATENT, type VaeWeights } from "./vae";
import { dynOpt, dynStepRollout, initDyn, predict, type DynWeights, type Segment } from "./dynamics";
import { rng } from "./rng";

/*
 * Training loops as plain stepping objects, so the worker can stream them and the
 * integration test can run them headless. Plumbing only; the maths is in core/.
 */

export interface Dataset {
  episodes: Episode[];
  /** Flat views of every frame. */
  frames: Float32Array[];
  /** True ball position (x, y) for each frame, for shading plots. */
  pos: Float32Array;
}

export function makeDataset(episodes = 30, T = 160, seed = 1, side?: number): Dataset {
  const eps = collect(episodes, T, seed, side);
  const P = side ? side * side : PIXELS;
  const frames: Float32Array[] = [];
  const pos: number[] = [];
  for (const e of eps) {
    for (let t = 0; t <= e.actions.length; t++) {
      frames.push(e.frames.subarray(t * P, (t + 1) * P));
      pos.push(e.states[t * 4], e.states[t * 4 + 1]);
    }
  }
  return { episodes: eps, frames, pos: Float32Array.from(pos) };
}

export interface VaeConfig {
  hidden: number;
  beta: number;
  steps: number;
  batch: number;
  lr: number;
  seed: number;
}

export const VAE_DEFAULTS: VaeConfig = { hidden: 128, beta: 1, steps: 1600, batch: 48, lr: 1.5e-3, seed: 5 };

export function vaeTrainer(data: Dataset, cfg: VaeConfig, init?: VaeWeights) {
  const r = rng(cfg.seed);
  const pixels = data.frames[0].length;
  const w = init ?? initVae({ pixels, hidden: cfg.hidden, latent: LATENT }, r);
  const opt = vaeOpt(w);
  let step = 0;
  const ema = { elbo: NaN, recon: NaN, kl: NaN };
  return {
    weights: w,
    get step() { return step; },
    ema,
    next() {
      step++;
      const batch = Array.from({ length: cfg.batch }, () => Math.floor(r() * data.frames.length));
      // Warm β up from 0 over the first quarter so the decoder learns to use z before the prior squeezes it.
      const beta = cfg.beta * Math.min(1, step / Math.max(1, cfg.steps * 0.25));
      const lr = step < cfg.steps * 0.75 ? cfg.lr : cfg.lr / 3;
      const s = vaeStep(w, opt, batch, (i) => data.frames[i], beta, lr, r);
      const k = Number.isNaN(ema.elbo) ? 1 : 0.06;
      ema.elbo = Number.isNaN(ema.elbo) ? s.elbo : ema.elbo + k * (s.elbo - ema.elbo);
      ema.recon = Number.isNaN(ema.recon) ? s.recon : ema.recon + k * (s.recon - ema.recon);
      ema.kl = Number.isNaN(ema.kl) ? s.kl : ema.kl + k * (s.kl - ema.kl);
      return { ...s, beta };
    },
  };
}

/** Encode every frame of every episode to its posterior mean. */
export function encodeEpisodes(w: VaeWeights, eps: Episode[]): number[][][] {
  const P = w.shape.pixels;
  return eps.map((e) => {
    const z: number[][] = [];
    for (let t = 0; t <= e.actions.length; t++) z.push(encode(w, e.frames.subarray(t * P, (t + 1) * P)).mu);
    return z;
  });
}

export interface DynConfig {
  hidden: number;
  steps: number;
  batch: number;
  lr: number;
  /** Longest open-loop training horizon (curriculum grows to this). */
  horizon: number;
  seed: number;
}

export const DYN_DEFAULTS: DynConfig = { hidden: 64, steps: 2400, batch: 20, lr: 2e-3, horizon: 12, seed: 9 };

export function dynTrainer(vae: VaeWeights, data: Dataset, cfg: DynConfig, init?: DynWeights) {
  const r = rng(cfg.seed);
  const zs = encodeEpisodes(vae, data.episodes);
  const L = cfg.horizon + 2;
  const segs: Segment[] = [];
  zs.forEach((z, k) => {
    const acts = data.episodes[k].actions;
    for (let t = 0; t + L <= z.length; t += 2) segs.push({ z: z.slice(t, t + L), actions: acts.subarray(t, t + L - 1) });
  });
  const w = init ?? initDyn(LATENT, cfg.hidden, r);
  const opt = dynOpt(w);
  let step = 0;
  let ema = NaN;
  return {
    weights: w,
    latents: zs,
    get step() { return step; },
    get ema() { return ema; },
    next() {
      step++;
      const H = Math.min(cfg.horizon, 1 + Math.floor((step / cfg.steps) * cfg.horizon * 1.6));
      const batch = Array.from({ length: cfg.batch }, () => segs[Math.floor(r() * segs.length)]);
      const lr = step < cfg.steps * 0.7 ? cfg.lr : cfg.lr / 3;
      const loss = dynStepRollout(w, opt, batch, H, lr);
      ema = Number.isNaN(ema) ? loss : ema + 0.05 * (loss - ema);
      return { loss, horizon: H };
    },
  };
}

/** Open-loop dream of a real episode from its first two latents, using its real actions. */
export function dreamAlong(dyn: DynWeights, z: ArrayLike<number>[], actions: ArrayLike<number>, steps: number): number[][] {
  const out: number[][] = [Array.from(z[0]), Array.from(z[1])];
  for (let t = 1; t < Math.min(steps, actions.length); t++) out.push(predict(dyn, out[t - 1], out[t], actions[t]).mean);
  return out;
}

/** Mean absolute pixel error between decoded latents and real frames, per step. */
export function pixelDrift(vae: VaeWeights, dream: number[][], ep: Episode): number[] {
  const P = vae.shape.pixels;
  const buf = new Float32Array(P);
  return dream.map((z, t) => {
    decode(vae, z, buf);
    let e = 0;
    for (let i = 0; i < P; i++) e += Math.abs(buf[i] - ep.frames[t * P + i]);
    return e / P;
  });
}
