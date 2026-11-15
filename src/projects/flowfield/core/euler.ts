import { notYoursYet } from "@/kit/not-yours-yet";
import type { Velocity } from "./types";

const FILE = "src/projects/flowfield/core/euler.ts";

/**
 * One forward-Euler step of the ODE dx/dt = v(x, t).
 *
 *   Maths:   x(t + Δt) ≈ x(t) + Δt · v(x(t), t)
 *
 * Signature: eulerStep(v: Velocity, x: number[], t: number, dt: number) => number[]   (new array, length d)
 *   dt may be negative: the hero runs the flow backwards to dissolve shapes into noise.
 *
 * On paper first:
 *  - Where does this come from? Write the first-order Taylor expansion of x(t + Δt).
 *  - What is the local error of one step, in powers of Δt?
 */
export function eulerStep(v: Velocity, x: number[], t: number, dt: number): number[] {
  void v;
  void x;
  void t;
  void dt;
  throw notYoursYet({
    file: FILE,
    fn: "eulerStep",
    milestone: "m3-integrate",
    summary: "Moves a point one small step along the velocity field.",
  });
}

/**
 * Sample by integrating from t = 0 (noise) to t = 1 (data) in `steps` equal Euler steps.
 *
 *   Maths:   Δt = 1 / N,    x_{k+1} = x_k + Δt · v(x_k, k Δt),    k = 0 … N − 1
 *
 * Signature: sampleODE(v: Velocity, x0: number[], steps: number) => number[][]
 *   Returns the whole trajectory: steps + 1 points, x0 (a copy) first and the sample last.
 *   The page draws every trajectory, so you will see whether the paths are straight or curved.
 *   v must be called exactly `steps` times.
 *
 * On paper first:
 *  - For v(x, t) = −x, solve the ODE exactly from x(0) = x₀, then write Euler's answer after N steps.
 *    Show the gap closes like 1/N (take logs, expand).
 *  - Suppose every trajectory of v is a straight line travelled at constant speed. How many Euler steps
 *    do you need to land exactly? The exact marginal field from milestone 2 is not like that. Why not?
 *  - Is it possible for two trajectories of a smooth ODE to cross? What does that say about the
 *    straight lines of milestone 1, which cross all the time?
 */
export function sampleODE(v: Velocity, x0: number[], steps: number): number[][] {
  void v;
  void x0;
  void steps;
  throw notYoursYet({
    file: FILE,
    fn: "sampleODE",
    milestone: "m3-integrate",
    summary: "Integrates the field from noise at t = 0 to a sample at t = 1, keeping the path.",
  });
}
