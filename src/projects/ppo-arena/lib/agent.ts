import { logProb } from "../core/policy";
import { N_ACTIONS, OBS_DIM } from "./env";
import { createMlp, forward, type Mlp } from "./mlp";
import { mulberry32, type Rng } from "./rng";

/*
 * Actor and critic: two separate tanh MLPs. The actor outputs one logit per action; the user's
 * logProb() turns logits into probabilities, so sampling, the old log-probs and the ratio all
 * run through their core.
 */

export const HIDDEN = 32;
export const ACTOR_SIZES = [OBS_DIM, HIDDEN, HIDDEN, N_ACTIONS];
export const CRITIC_SIZES = [OBS_DIM, HIDDEN, HIDDEN, 1];

export interface AgentWeights {
  actor: Float64Array;
  critic: Float64Array;
}

export function createAgent(seed: number): { actor: Mlp; critic: Mlp } {
  const rng = mulberry32(seed);
  return { actor: createMlp(ACTOR_SIZES, rng, 0.01), critic: createMlp(CRITIC_SIZES, rng, 1) };
}

export function actorFrom(w: Float64Array): Mlp {
  return { sizes: ACTOR_SIZES, params: w };
}

export function criticFrom(w: Float64Array): Mlp {
  return { sizes: CRITIC_SIZES, params: w };
}

export function logitsOf(actor: Mlp, obs: number[]): number[] {
  return Array.from(forward(actor, obs));
}

/** π(·|s) through the user's logProb(). */
export function actionProbs(logits: number[]): number[] {
  const ps = logits.map((_, a) => Math.exp(logProb(logits, a)));
  const z = ps.reduce((s, p) => s + p, 0) || 1;
  return ps.map((p) => p / z);
}

export function sampleFrom(probs: number[], rng: Rng): number {
  let u = rng();
  for (let a = 0; a < probs.length - 1; a++) {
    if ((u -= probs[a]) < 0) return a;
  }
  return probs.length - 1;
}

export function act(actor: Mlp, obs: number[], rng: Rng, greedy = false): { action: number; probs: number[]; logits: number[] } {
  const logits = logitsOf(actor, obs);
  const probs = actionProbs(logits);
  const action = greedy ? (probs[1] > probs[0] ? 1 : 0) : sampleFrom(probs, rng);
  return { action, probs, logits };
}
