import type { Rng } from "./rng";

/*
 * The game: Torchbearer. A cart on a rail carries a torch upright on a hinge; the flame lights
 * the dark. Dynamics are the classic cart-pole (Barto, Sutton and Anderson, 1983), Euler-integrated
 * at 50 Hz, so results compare with every PPO paper's CartPole numbers.
 *
 * Reward: +1 for every step the torch is still up. The episode ends when it tips past 12°, the cart
 * leaves the rail (|x| > 2.4 m), or after 500 steps (treated as terminal here; see LEARNING.md).
 */

export const ENV = {
  gravity: 9.8,
  massCart: 1.0,
  massPole: 0.1,
  /** Half the pole length (m). */
  halfLength: 0.5,
  forceMag: 10,
  tau: 0.02,
  thetaLimit: (12 * Math.PI) / 180,
  xLimit: 2.4,
  maxSteps: 500,
} as const;

export const N_ACTIONS = 2; // 0 = push left, 1 = push right
export const OBS_DIM = 4;

export interface CartState {
  x: number;
  v: number;
  theta: number;
  omega: number;
}

export interface StepResult {
  reward: number;
  done: boolean;
  /** Why it ended: tipped over, ran off the rail, or ran out of time. */
  reason: "fell" | "rail" | "time" | null;
}

export function resetState(rng: Rng): CartState {
  const u = () => (rng() - 0.5) * 0.1; // U(−0.05, 0.05), as in Gym
  return { x: u(), v: u(), theta: u(), omega: u() };
}

/** Advance one tick. `force` overrides the action's ±forceMag (used for shoves and human play). */
export function physics(s: CartState, force: number): CartState {
  const { gravity: g, massCart: mc, massPole: mp, halfLength: l, tau } = ENV;
  const total = mc + mp;
  const cos = Math.cos(s.theta);
  const sin = Math.sin(s.theta);
  const temp = (force + mp * l * s.omega * s.omega * sin) / total;
  const alpha = (g * sin - cos * temp) / (l * (4 / 3 - (mp * cos * cos) / total));
  const acc = temp - (mp * l * alpha * cos) / total;
  return {
    x: s.x + tau * s.v,
    v: s.v + tau * acc,
    theta: s.theta + tau * s.omega,
    omega: s.omega + tau * alpha,
  };
}

/** Network input: the state scaled to roughly unit size. */
export function observe(s: CartState): number[] {
  return [s.x / ENV.xLimit, s.v / 2, s.theta / ENV.thetaLimit, s.omega / 2];
}

export class TorchEnv {
  state: CartState;
  steps = 0;
  episodeReturn = 0;

  constructor(private rng: Rng) {
    this.state = resetState(rng);
  }

  reset(): number[] {
    this.state = resetState(this.rng);
    this.steps = 0;
    this.episodeReturn = 0;
    return observe(this.state);
  }

  obs(): number[] {
    return observe(this.state);
  }

  /** Apply action (0 left, 1 right) plus an optional extra force (a shove). */
  step(action: number, extraForce = 0): StepResult {
    const f = (action === 1 ? ENV.forceMag : -ENV.forceMag) + extraForce;
    this.state = physics(this.state, f);
    this.steps++;
    this.episodeReturn += 1;
    const reason = terminalReason(this.state, this.steps);
    return { reward: 1, done: reason !== null, reason };
  }
}

export function terminalReason(s: CartState, steps: number): StepResult["reason"] {
  if (Math.abs(s.theta) > ENV.thetaLimit) return "fell";
  if (Math.abs(s.x) > ENV.xLimit) return "rail";
  if (steps >= ENV.maxSteps) return "time";
  return null;
}

/** Flame brightness in [0, 1]: 1 upright, 0 at the 12° limit. Used for drawing and the M1 lab. */
export function brightness(s: CartState): number {
  return Math.max(0, 1 - Math.abs(s.theta) / ENV.thetaLimit);
}
