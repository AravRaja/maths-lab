import { isNotYoursYet } from "@/kit/not-yours-yet";
import { act, actorFrom, type AgentWeights } from "../lib/agent";
import { observe } from "../lib/env";
import { pilotAction } from "../lib/pilot";
import type { Rng } from "../lib/rng";
import type { Decide } from "./scene";

/*
 * Controllers for the display runners. The agent decider samples (or takes the argmax) through
 * the user's logProb(); if that is still a stub it returns null and the caller falls back.
 */

export const pilotDecide: Decide = (s) => ({ action: pilotAction(s) });

export function agentDecide(weights: AgentWeights, rng: Rng, greedy: boolean): Decide | null {
  const actor = actorFrom(weights.actor);
  try {
    act(actor, [0, 0, 0, 0], rng, greedy);
  } catch (e) {
    if (isNotYoursYet(e)) return null;
    throw e;
  }
  return (s) => {
    const { action, probs } = act(actor, observe(s), rng, greedy);
    return { action, probs };
  };
}
