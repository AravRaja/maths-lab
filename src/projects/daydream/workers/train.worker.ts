/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import { makeDataset, vaeTrainer, dynTrainer, dreamAlong, pixelDrift, VAE_DEFAULTS, DYN_DEFAULTS, type Dataset } from "../lib/train";
import { encode, decode, type VaeWeights } from "../lib/vae";
import type { DynWeights } from "../lib/dynamics";

/*
 * Both training loops, off the main thread. Every gradient that involves probability goes through
 * the user's cores (see lib/vae.ts, lib/dynamics.ts); a NotYoursYet thrown here reaches the page.
 */

/** Frames the page shows while the VAE trains. */
export interface VaeFrame {
  step: number;
  steps: number;
  elbo: number;
  recon: number;
  kl: number;
  beta: number;
  stepsPerSec: number;
  /** Six fixed frames, then their reconstructions (each PIXELS long), flattened. */
  strip?: Float32Array;
  /** Posterior means of a fixed subset of frames, [z1, z2]... */
  cloud?: Float32Array;
  /** True ball position of the same subset, [x, y]... */
  cloudPos?: Float32Array;
  /** Current weights, sent about once a second (and on the last frame). */
  weights?: VaeWeights;
}

export interface DynFrame {
  step: number;
  steps: number;
  loss: number;
  horizon: number;
  stepsPerSec: number;
  /** Real latents of a held-out episode and the model's open-loop dream of it. */
  real?: number[][];
  dream?: number[][];
  drift?: number[];
  weights?: DynWeights;
}

let data: Dataset | null = null;
const getData = () => (data ??= makeDataset());
const STRIP = [11, 503, 1207, 2290, 3333, 4410];
const CLOUD = 700;
const sleep = () => new Promise((r) => setTimeout(r, 0));

function strip(w: VaeWeights, d: Dataset): Float32Array {
  const P = w.shape.pixels;
  const out = new Float32Array(STRIP.length * 2 * P);
  STRIP.forEach((i, k) => {
    const f = d.frames[i % d.frames.length];
    out.set(f, k * P);
    out.set(decode(w, encode(w, f).mu), (STRIP.length + k) * P);
  });
  return out;
}

function cloud(w: VaeWeights, d: Dataset): { cloud: Float32Array; cloudPos: Float32Array } {
  const c = new Float32Array(CLOUD * 2);
  const p = new Float32Array(CLOUD * 2);
  const stride = Math.floor(d.frames.length / CLOUD);
  for (let k = 0; k < CLOUD; k++) {
    const i = k * stride;
    const { mu } = encode(w, d.frames[i]);
    c[2 * k] = mu[0];
    c[2 * k + 1] = mu[1];
    p[2 * k] = d.pos[2 * i];
    p[2 * k + 1] = d.pos[2 * i + 1];
  }
  return { cloud: c, cloudPos: p };
}

const clone = (w: VaeWeights): VaeWeights => ({ shape: { ...w.shape }, enc: w.enc.slice(), dec: w.dec.slice() });

export const handlers = {
  async trainVae(args: { beta?: number; steps?: number }, progress: (v: unknown) => void) {
    const d = getData();
    const cfg = { ...VAE_DEFAULTS, beta: args.beta ?? VAE_DEFAULTS.beta, steps: args.steps ?? VAE_DEFAULTS.steps };
    const tr = vaeTrainer(d, cfg);
    let last = performance.now();
    let lastHeavy = 0;
    let lastWeights = 0;
    let since = 0;
    for (let s = 1; s <= cfg.steps; s++) {
      const st = tr.next();
      since++;
      const now = performance.now();
      const end = s === cfg.steps;
      if (now - last > 90 || end || s === 1) {
        const f: VaeFrame = { step: s, steps: cfg.steps, elbo: tr.ema.elbo, recon: tr.ema.recon, kl: tr.ema.kl, beta: st.beta, stepsPerSec: (since * 1000) / Math.max(1, now - last) };
        if (now - lastHeavy > 350 || end || s === 1) {
          f.strip = strip(tr.weights, d);
          Object.assign(f, cloud(tr.weights, d));
          lastHeavy = now;
        }
        if (now - lastWeights > 1200 || end) {
          f.weights = clone(tr.weights);
          lastWeights = now;
        }
        progress(f);
        last = now;
        since = 0;
        await sleep();
      }
    }
    return clone(tr.weights);
  },

  async trainDyn(args: { vae: VaeWeights; steps?: number }, progress: (v: unknown) => void) {
    const d = getData();
    const cfg = { ...DYN_DEFAULTS, steps: args.steps ?? DYN_DEFAULTS.steps };
    const tr = dynTrainer(args.vae, d, cfg);
    // Held-out episode for the live preview.
    const test = makeDataset(1, 90, 77);
    const realZ = encodeAll(args.vae, test);
    let last = performance.now();
    let lastHeavy = 0;
    let since = 0;
    for (let s = 1; s <= cfg.steps; s++) {
      const st = tr.next();
      since++;
      const now = performance.now();
      const end = s === cfg.steps;
      if (now - last > 90 || end || s === 1) {
        const f: DynFrame = { step: s, steps: cfg.steps, loss: tr.ema, horizon: st.horizon, stepsPerSec: (since * 1000) / Math.max(1, now - last) };
        if (now - lastHeavy > 300 || end) {
          const dream = dreamAlong(tr.weights, realZ, test.episodes[0].actions, 60);
          f.real = realZ.slice(0, dream.length);
          f.dream = dream;
          f.drift = pixelDrift(args.vae, dream, test.episodes[0]);
          lastHeavy = now;
        }
        if (end) f.weights = { ...tr.weights, p: tr.weights.p.slice() };
        progress(f);
        last = now;
        since = 0;
        await sleep();
      }
    }
    return { ...tr.weights, p: tr.weights.p.slice() };
  },
};

function encodeAll(w: VaeWeights, d: Dataset): number[][] {
  return d.frames.map((f) => encode(w, f).mu);
}

exposeWorker(handlers);
