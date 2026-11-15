import { ENV, physics, resetState, terminalReason, type CartState } from "./env";
import { gaussian, mulberry32, type Rng } from "./rng";

/*
 * A hand-tuned linear controller: not learnt, not a core. It flies the hero until the user's
 * PPO agent exists, and its noisy version makes the rollouts the M1 and M2 labs replay.
 */

/** Bang-bang on a linear score of the state. Returns action 0 (left) or 1 (right). */
export function pilotAction(s: CartState, shaky = 0, rng?: Rng): number {
  let score = 0.15 * s.x + 0.6 * s.v + 12 * s.theta + 2.2 * s.omega;
  if (shaky && rng) score += shaky * gaussian(rng);
  return score > 0 ? 1 : 0;
}

export interface Rollout {
  states: CartState[];
  actions: number[];
  rewards: number[];
  dones: boolean[];
  /** Step indices where an episode starts. */
  starts: number[];
}

/**
 * Several shaky-pilot episodes back to back, `total` steps in all (the last one may be cut off,
 * which is what lastValue is for). Episodes are made to fall by drift so the trace has ends.
 */
export function pilotRollout(total: number, seed: number, shaky = 4): Rollout {
  const rng = mulberry32(seed);
  const out: Rollout = { states: [], actions: [], rewards: [], dones: [], starts: [0] };
  let s = resetState(rng);
  let steps = 0;
  let drift = (rng() - 0.5) * 3;
  for (let t = 0; t < total; t++) {
    const a = pilotAction(s, shaky, rng);
    out.states.push(s);
    out.actions.push(a);
    s = physics(s, (a ? ENV.forceMag : -ENV.forceMag) + drift);
    steps++;
    drift += (rng() - 0.5) * 0.4;
    const end = terminalReason(s, steps) !== null;
    out.rewards.push(1);
    out.dones.push(end);
    if (end && t < total - 1) {
      s = resetState(rng);
      steps = 0;
      drift = (rng() - 0.5) * 3;
      out.starts.push(t + 1);
    }
  }
  return out;
}
