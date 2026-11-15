import { reparameterise, reparameteriseBackward } from "../core/reparam";
import { gaussianKLGrad } from "../core/kl";
import { bernoulliLogLikGrad, elbo } from "../core/elbo";
import { adamInit, adamStep, backward, forward, initParams, type AdamState, type MlpSpec } from "./mlp";
import { gaussVec } from "./rng";

/*
 * The VAE's plumbing: two small MLPs and the training step. Every piece of *probability* in here
 * (sampling z, the KL, the reconstruction likelihood, the bound itself and their gradients) is a
 * call into the user's cores; this file only wires them to the weights.
 */

export const LATENT = 2;

export interface VaeShape {
  pixels: number;
  hidden: number;
  latent: number;
}

export interface VaeWeights {
  shape: VaeShape;
  enc: Float32Array;
  dec: Float32Array;
}

export const encSpec = (s: VaeShape): MlpSpec => ({ sizes: [s.pixels, s.hidden, 2 * s.latent], act: "relu" });
export const decSpec = (s: VaeShape): MlpSpec => ({ sizes: [s.latent, s.hidden, s.pixels], act: "relu" });

export function initVae(shape: VaeShape, r: () => number): VaeWeights {
  return { shape, enc: initParams(encSpec(shape), r, 0.1), dec: initParams(decSpec(shape), r) };
}

export function encode(w: VaeWeights, x: ArrayLike<number>): { mu: number[]; logvar: number[] } {
  const out = forward(encSpec(w.shape), w.enc, x).out;
  const d = w.shape.latent;
  return { mu: Array.from(out.subarray(0, d)), logvar: Array.from(out.subarray(d, 2 * d)) };
}

export function decodeLogits(w: VaeWeights, z: ArrayLike<number>): Float32Array {
  return forward(decSpec(w.shape), w.dec, z).out;
}

/** Decoded frame as greys in [0, 1] (σ of the logits). No cores involved. */
export function decode(w: VaeWeights, z: ArrayLike<number>, out?: Float32Array): Float32Array {
  const l = decodeLogits(w, z);
  const o = out ?? new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) o[i] = 1 / (1 + Math.exp(-l[i]));
  return o;
}

export interface VaeOpt {
  enc: AdamState;
  dec: AdamState;
}

export const vaeOpt = (w: VaeWeights): VaeOpt => ({ enc: adamInit(w.enc.length), dec: adamInit(w.dec.length) });

export interface StepStats {
  /** Mean per-frame ELBO over the batch (nats). */
  elbo: number;
  recon: number;
  kl: number;
}

/**
 * One minibatch step of β-VAE training: maximise the mean ELBO (minimise its negative).
 * `frame(i)` returns frame i of the dataset.
 */
export function vaeStep(
  w: VaeWeights,
  opt: VaeOpt,
  batch: number[],
  frame: (i: number) => ArrayLike<number>,
  beta: number,
  lr: number,
  r: () => number,
): StepStats {
  const es = encSpec(w.shape);
  const ds = decSpec(w.shape);
  const d = w.shape.latent;
  const gE = new Float32Array(w.enc.length);
  const gD = new Float32Array(w.dec.length);
  const B = batch.length;
  let sE = 0, sR = 0, sK = 0;
  for (const idx of batch) {
    const x = frame(idx);
    const te = forward(es, w.enc, x);
    const h = te.out;
    const mu = Array.from(h.subarray(0, d));
    const logvar = Array.from(h.subarray(d, 2 * d));
    const eps = gaussVec(r, d);
    const z = reparameterise(mu, logvar, eps);
    const td = forward(ds, w.dec, z);
    const logits = td.out;
    const parts = elbo(x, logits, mu, logvar, beta);
    sE += parts.elbo; sR += parts.recon; sK += parts.kl;

    // Loss = −ELBO / B. Decoder first: d(−recon)/dlogits.
    const gl = bernoulliLogLikGrad(x, logits);
    const dlogits = new Float32Array(gl.length);
    for (let i = 0; i < gl.length; i++) dlogits[i] = -gl[i] / B;
    const dz = backward(ds, w.dec, td, dlogits, gD, true);
    // Through the sample into (μ, log σ²), then add β · the prior's pull.
    const rb = reparameteriseBackward(logvar, eps, dz);
    const kg = gaussianKLGrad(mu, logvar);
    const dh = new Float32Array(2 * d);
    for (let i = 0; i < d; i++) {
      dh[i] = rb.dmu[i] + (beta * kg.dmu[i]) / B;
      dh[d + i] = rb.dlogvar[i] + (beta * kg.dlogvar[i]) / B;
    }
    backward(es, w.enc, te, dh, gE, false);
  }
  adamStep(w.enc, gE, opt.enc, lr);
  adamStep(w.dec, gD, opt.dec, lr);
  return { elbo: sE / B, recon: sR / B, kl: sK / B };
}
