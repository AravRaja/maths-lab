import { eulerSample } from "@/projects/say-and-reach/core/flow";
import { initPolicyNet, netForward, type PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { EMBED_DIM, OBJECTS } from "./language";
import type { Rng } from "./rng";
import { STATE_DIM } from "./world";

/*
 * The two policy heads. Both use the same network shape (word-to-object attention, then a
 * FiLM MLP; see src/projects/say-and-reach/lib/nn/policy-net.ts).
 *  - Gaussian (behaviour cloning): outputs μ and log σ of the fingertip velocity.
 *  - Flow: a velocity field v(x, t | scene, words) whose flow carries noise to an action.
 */

export const HIDDEN = 96;
export const FLOW_EXTRA = 5; // x_t (2) + features of t (3)
export const FLOW_STEPS = 8;

export type PolicyWeights = PolicyNet;

export function initGaussianNet(rng: Rng): PolicyNet {
  return initPolicyNet({ nTok: OBJECTS.length, tokOffset: 2, stateDim: STATE_DIM, keep: [0, 1], textDim: EMBED_DIM, hidden: HIDDEN, out: 4 }, rng);
}
export function initFlowNet(rng: Rng): PolicyNet {
  const keep = [0, 1, ...Array.from({ length: FLOW_EXTRA }, (_, i) => STATE_DIM + i)];
  return initPolicyNet({ nTok: OBJECTS.length, tokOffset: 2, stateDim: STATE_DIM + FLOW_EXTRA, keep, textDim: EMBED_DIM, hidden: HIDDEN, out: 2, outScale: 0.5 }, rng);
}

/** Split an observation (state then words) into the two network inputs. */
export const stateOf = (obs: Float32Array) => obs.subarray(0, STATE_DIM);
export const wordsOf = (obs: Float32Array) => obs.subarray(STATE_DIM, STATE_DIM + EMBED_DIM);

/** Only for display and sampling; the loss sees the raw output. */
export const clampLogStd = (s: number) => Math.max(-5, Math.min(2, s));

export interface GaussianOut {
  mu: [number, number];
  logStd: [number, number];
  /** Attention over objects (cube, ball, wedge). */
  attention: number[];
}

export function gaussianAct(w: PolicyNet, obs: Float32Array): GaussianOut {
  const f = netForward(w, stateOf(obs), wordsOf(obs), 1);
  const o = f.out;
  return { mu: [o[0], o[1]], logStd: [clampLogStd(o[2]), clampLogStd(o[3])], attention: Array.from(f.alpha) };
}

/** Flow network's state input: scene state, the current point x_t, and features of t. */
export function flowState(obs: ArrayLike<number>, x: ArrayLike<number>, t: number, out = new Float32Array(STATE_DIM + FLOW_EXTRA)): Float32Array {
  for (let i = 0; i < STATE_DIM; i++) out[i] = obs[i];
  out[STATE_DIM] = x[0];
  out[STATE_DIM + 1] = x[1];
  out[STATE_DIM + 2] = t;
  out[STATE_DIM + 3] = Math.sin(Math.PI * t);
  out[STATE_DIM + 4] = Math.cos(Math.PI * t);
  return out;
}

export function flowVelocity(w: PolicyNet, obs: Float32Array, onAttention?: (a: number[]) => void) {
  const buf = new Float32Array(STATE_DIM + FLOW_EXTRA);
  const words = wordsOf(obs);
  return (x: number[], t: number): number[] => {
    const f = netForward(w, flowState(obs, x, t, buf), words, 1);
    onAttention?.(Array.from(f.alpha));
    return [f.out[0], f.out[1]];
  };
}

/** Integrate each noise sample with the user's eulerSample. Returns one path per sample. */
export function flowPaths(w: PolicyNet, obs: Float32Array, noises: number[][], steps = FLOW_STEPS, onAttention?: (a: number[]) => void): number[][][] {
  const v = flowVelocity(w, obs, onAttention);
  return noises.map((z) => eulerSample(v, z, steps));
}
