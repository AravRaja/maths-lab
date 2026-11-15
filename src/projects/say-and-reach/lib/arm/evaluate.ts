import { discountedReturn, shapedRewards } from "@/projects/say-and-reach/core/reward";
import type { PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { EPISODE_STEPS } from "./config";
import { expertController, flowController, gaussianController, type Controller, type Mode } from "./controllers";
import { embed, sampleCommand, type Task } from "./language";
import { makeRng } from "./rng";
import { potential, succeeded } from "./score";
import { cloneScene, randomScene, step, type Scene } from "./world";

export const GAMMA = 0.98;

export interface Rollout {
  success: boolean;
  /** Step at which the task first succeeded, or -1. */
  hitAt: number;
  rewards: number[];
  potentials: number[];
}

export function rollout(start: Scene, task: Task, ctrl: Controller, steps = EPISODE_STEPS): Rollout {
  const s = cloneScene(start);
  const rewards: number[] = [];
  const potentials = [potential(start, s, task)];
  let hitAt = -1;
  for (let t = 0; t < steps; t++) {
    step(s, ctrl.act(s).action);
    const ok = succeeded(start, s, task);
    // Sparse reward: 1 on the step the task is first done.
    rewards.push(ok && hitAt < 0 ? 1 : 0);
    if (ok && hitAt < 0) hitAt = t;
    potentials.push(potential(start, s, task));
  }
  return { success: hitAt >= 0, hitAt, rewards, potentials };
}

export interface EvalRow {
  mode: Mode;
  episodes: number;
  successRate: number;
  /** Mean discounted sparse return. */
  ret: number;
  /** Mean discounted shaped return. */
  shaped: number;
  /** Shaped reward trace of the first episode (for the chart). */
  trace: number[];
  /** Telescoping check on the first episode: G' − G should equal γ^T Φ(s_T) − Φ(s_0). */
  check: { G: number; Gs: number; boundary: number };
  /** Per-episode: did it, with the command text. */
  results: { text: string; success: boolean }[];
}

export function evaluate(
  weights: { gaussian?: PolicyNet; flow?: PolicyNet },
  episodes: number,
  seed: number,
  onProgress?: (frac: number) => void,
  split: "train" | "heldout" = "heldout",
): EvalRow[] {
  const modes: Mode[] = ["expert", ...(weights.gaussian ? (["gaussian"] as const) : []), ...(weights.flow ? (["flow"] as const) : [])];
  const rng = makeRng(seed);
  const cases = Array.from({ length: episodes }, () => {
    const scene = randomScene(rng);
    const cmd = sampleCommand(rng, split);
    return { scene, ...cmd, side: 1 as const };
  });
  const rows: EvalRow[] = [];
  let done = 0;
  for (const mode of modes) {
    let wins = 0, ret = 0, shaped = 0;
    let trace: number[] = [];
    let check = { G: 0, Gs: 0, boundary: 0 };
    const results: EvalRow["results"] = [];
    cases.forEach((c, i) => {
      const tv = embed(c.text);
      const ctrl =
        mode === "expert" ? expertController(c.task, c.side)
        : mode === "gaussian" ? gaussianController(weights.gaussian!, tv)
        : flowController(weights.flow!, tv, makeRng(seed + i));
      const r = rollout(c.scene, c.task, ctrl);
      const sr = shapedRewards(r.rewards, r.potentials, GAMMA);
      if (i === 0) {
        trace = sr;
        const T = r.rewards.length;
        check = { G: discountedReturn(r.rewards, GAMMA), Gs: discountedReturn(sr, GAMMA), boundary: GAMMA ** T * r.potentials[T] - r.potentials[0] };
      }
      wins += r.success ? 1 : 0;
      ret += discountedReturn(r.rewards, GAMMA) / episodes;
      shaped += discountedReturn(sr, GAMMA) / episodes;
      results.push({ text: c.text, success: r.success });
      done++;
      onProgress?.(done / (episodes * modes.length));
    });
    rows.push({ mode, episodes, successRate: wins / episodes, ret, shaped, trace, check, results });
  }
  return rows;
}
