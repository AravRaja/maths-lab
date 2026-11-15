import { gaussianNLL, gaussianNLLGrad } from "../core/dynamics";
import { reparameterise } from "../core/reparam";
import { adamInit, adamStep, backward, forward, initParams, type AdamState, type MlpSpec } from "./mlp";
import { gaussVec } from "./rng";
import { N_ACTIONS } from "./world";

/*
 * Latent dynamics plumbing: an MLP that reads (z_t, z_t − z_{t−1}, action) and predicts a diagonal
 * Gaussian over z_{t+1}. The loss and its gradient are the user's gaussianNLL / gaussianNLLGrad;
 * dreaming with noise samples through the user's reparameterise.
 */

const VEL = 4;
const LV_MIN = -9;
const softplus = (x: number) => (x > 20 ? x : Math.log1p(Math.exp(x)));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface DynWeights {
  latent: number;
  hidden: number;
  p: Float32Array;
}

export const dynSpec = (w: { latent: number; hidden: number }): MlpSpec => ({ sizes: [2 * w.latent + N_ACTIONS, w.hidden, w.hidden, 2 * w.latent], act: "tanh" });

export function initDyn(latent: number, hidden: number, r: () => number): DynWeights {
  return { latent, hidden, p: initParams(dynSpec({ latent, hidden }), r, 0.1) };
}

function input(zPrev: ArrayLike<number>, z: ArrayLike<number>, a: number, d: number): Float32Array {
  const x = new Float32Array(2 * d + N_ACTIONS);
  for (let i = 0; i < d; i++) {
    x[i] = z[i];
    x[d + i] = VEL * (z[i] - zPrev[i]);
  }
  x[2 * d + a] = 1;
  return x;
}

export interface Prediction {
  mean: number[];
  logvar: number[];
}

export function predict(w: DynWeights, zPrev: ArrayLike<number>, z: ArrayLike<number>, a: number): Prediction {
  const d = w.latent;
  const out = forward(dynSpec(w), w.p, input(zPrev, z, a, d)).out;
  const mean = new Array<number>(d);
  const logvar = new Array<number>(d);
  for (let i = 0; i < d; i++) {
    mean[i] = z[i] + out[i];
    logvar[i] = LV_MIN + softplus(out[d + i] - LV_MIN);
  }
  return { mean, logvar };
}

/** One dream step: the predicted mean, or a sample from the prediction (temperature scales ε). */
export function dreamStep(w: DynWeights, zPrev: ArrayLike<number>, z: ArrayLike<number>, a: number, noise: number, r: () => number): { z: number[]; pred: Prediction } {
  const pred = predict(w, zPrev, z, a);
  if (noise <= 0) return { z: pred.mean.slice(), pred };
  const eps = gaussVec(r, w.latent).map((e) => e * noise);
  return { z: reparameterise(pred.mean, pred.logvar, eps), pred };
}

export interface Transition {
  zPrev: ArrayLike<number>;
  z: ArrayLike<number>;
  a: number;
  zNext: ArrayLike<number>;
}

export function dynStep(w: DynWeights, opt: AdamState, batch: Transition[], lr: number): number {
  const spec = dynSpec(w);
  const d = w.latent;
  const g = new Float32Array(w.p.length);
  const B = batch.length;
  let total = 0;
  for (const tr of batch) {
    const tape = forward(spec, w.p, input(tr.zPrev, tr.z, tr.a, d));
    const out = tape.out;
    const mean = new Array<number>(d);
    const logvar = new Array<number>(d);
    for (let i = 0; i < d; i++) {
      mean[i] = tr.z[i] + out[i];
      logvar[i] = LV_MIN + softplus(out[d + i] - LV_MIN);
    }
    total += gaussianNLL(tr.zNext, mean, logvar);
    const gr = gaussianNLLGrad(tr.zNext, mean, logvar);
    const dout = new Float32Array(2 * d);
    for (let i = 0; i < d; i++) {
      dout[i] = gr.dmean[i] / B;
      dout[d + i] = (gr.dlogvar[i] * sigmoid(out[d + i] - LV_MIN)) / B;
    }
    backward(spec, w.p, tape, dout, g, false);
  }
  adamStep(w.p, g, opt, lr, 2);
  return total / B;
}

export const dynOpt = (w: DynWeights) => adamInit(w.p.length);

/** A real stretch of latents (the encoder's μ) and the actions between them: z.length = actions.length + 1. */
export interface Segment {
  z: ArrayLike<number>[];
  actions: ArrayLike<number>;
}

/**
 * Multi-step ("overshooting") training: start from two real latents, let the model feed its own
 * predicted means back in for `horizon` steps, score every step with the user's gaussianNLL against
 * the real latent, and backpropagate through the whole rollout. This is what keeps dreams stable:
 * one-step training never sees its own mistakes.
 */
export function dynStepRollout(w: DynWeights, opt: AdamState, batch: Segment[], horizon: number, lr: number): number {
  const spec = dynSpec(w);
  const d = w.latent;
  const g = new Float32Array(w.p.length);
  const scale = 1 / (batch.length * horizon);
  let total = 0;
  for (const seg of batch) {
    const H = Math.min(horizon, seg.z.length - 2);
    const p: number[][] = [Array.from(seg.z[0]), Array.from(seg.z[1])];
    const tapes = [];
    const raws: Float32Array[] = [];
    const grads: { dmean: number[]; dlogvar: number[] }[] = [];
    for (let j = 1; j <= H; j++) {
      const tape = forward(spec, w.p, input(p[j - 1], p[j], seg.actions[j], d));
      const out = tape.out;
      const mean = new Array<number>(d);
      const logvar = new Array<number>(d);
      for (let i = 0; i < d; i++) {
        mean[i] = p[j][i] + out[i];
        logvar[i] = LV_MIN + softplus(out[d + i] - LV_MIN);
      }
      total += gaussianNLL(seg.z[j + 1], mean, logvar) / H;
      grads.push(gaussianNLLGrad(seg.z[j + 1], mean, logvar));
      tapes.push(tape);
      raws.push(out);
      p.push(mean);
    }
    // Backward through time. dp[j] = dLoss/d(prediction j); the two real starts (j = 0, 1) are inputs.
    const dp = p.map(() => new Array<number>(d).fill(0));
    for (let j = H; j >= 1; j--) {
      const gr = grads[j - 1];
      const out = raws[j - 1];
      const dout = new Float32Array(2 * d);
      for (let i = 0; i < d; i++) {
        dout[i] = (gr.dmean[i] * scale * horizon) / H + dp[j + 1][i];
        dout[d + i] = ((gr.dlogvar[i] * scale * horizon) / H) * sigmoid(out[d + i] - LV_MIN);
      }
      const din = backward(spec, w.p, tapes[j - 1], dout, g, j > 1);
      if (j > 1) {
        for (let i = 0; i < d; i++) {
          // mean_j = p_j + out  and  input = [p_j, VEL (p_j − p_{j−1}), a]
          dp[j][i] += dout[i] + din[i] + VEL * din[d + i];
          dp[j - 1][i] -= VEL * din[d + i];
        }
      }
    }
  }
  adamStep(w.p, g, opt, lr, 2);
  return total / batch.length;
}
