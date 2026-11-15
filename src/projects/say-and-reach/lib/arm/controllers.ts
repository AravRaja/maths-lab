import type { PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { expertAction } from "./expert";
import type { Task } from "./language";
import { gaussianAct, flowPaths } from "./policy";
import { gauss, type Rng } from "./rng";
import { observe, OBS_DIM, type Scene } from "./world";

/*
 * A controller turns (scene, command) into an action each step. One interface for the
 * expert and both learned heads, so the page, the evaluator and the hero all share it.
 */

export type Mode = "expert" | "gaussian" | "flow";

export interface StepInfo {
  action: [number, number];
  /** Gaussian head: μ and σ of the action. */
  mu?: [number, number];
  std?: [number, number];
  /** Flow head: the noise-to-action paths for every particle. */
  paths?: number[][][];
  /** Learned heads: attention over objects (cube, ball, wedge). */
  attention?: number[];
}

export interface Controller {
  mode: Mode;
  act(scene: Scene): StepInfo;
}

export function expertController(task: Task, side: 1 | -1): Controller {
  return { mode: "expert", act: (s) => ({ action: expertAction(s, task, side) }) };
}

export function gaussianController(w: PolicyNet, text: Float32Array): Controller {
  const obs = new Float32Array(OBS_DIM);
  return {
    mode: "gaussian",
    act(s) {
      const { mu, logStd, attention } = gaussianAct(w, observe(s, text, obs));
      return { action: mu, mu, std: [Math.exp(logStd[0]), Math.exp(logStd[1])], attention };
    },
  };
}

/**
 * Flow controller. Particle 0 is the one executed. Its noise is held fixed for the episode
 * (re-drawn only when asked), so the arm commits to one way round instead of flickering
 * between modes from step to step.
 */
export function flowController(w: PolicyNet, text: Float32Array, rng: Rng, particles = 1): Controller & { reseed(): void } {
  const obs = new Float32Array(OBS_DIM);
  let noises: number[][] = [];
  const reseed = () => {
    noises = Array.from({ length: particles }, () => [gauss(rng), gauss(rng)]);
  };
  reseed();
  return {
    mode: "flow",
    reseed,
    act(s) {
      let attention: number[] | undefined;
      const paths = flowPaths(w, observe(s, text, obs), noises, undefined, (a) => (attention = a));
      const last = paths[0][paths[0].length - 1];
      return { action: [last[0], last[1]], paths, attention };
    },
  };
}
