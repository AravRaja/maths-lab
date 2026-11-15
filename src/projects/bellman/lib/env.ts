import type { MDP } from "../core/types";

/** Sample s' ~ P(· | s, a) from the MDP. Returns the step a learning agent sees. */
export function sampleStep(mdp: MDP, s: number, a: number, rand: () => number): { s2: number; r: number; done: boolean } {
  const outs = mdp.outcomes[s * mdp.nA + a];
  let u = rand();
  for (const o of outs) {
    u -= o.p;
    if (u <= 0) return { s2: o.next, r: o.reward, done: mdp.terminal[o.next] === 1 };
  }
  const o = outs[outs.length - 1];
  return { s2: o.next, r: o.reward, done: mdp.terminal[o.next] === 1 };
}

/** Every non-absorbing state, for exploring starts. */
export function liveStates(mdp: MDP): number[] {
  const out: number[] = [];
  for (let s = 0; s < mdp.nS; s++) if (!mdp.terminal[s]) out.push(s);
  return out;
}
