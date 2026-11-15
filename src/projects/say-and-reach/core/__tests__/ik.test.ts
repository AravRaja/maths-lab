import { describe, expect, it } from "vitest";
import { dlsStep } from "../ik";
import { forwardKinematics, jacobian } from "../kinematics";

/*
 * Damped least squares. The tests compare against the n×n normal equations
 * (solved here by elimination), check the λ = 0 and λ → ∞ limits, and run
 * the full IK loop on the 3-link arm.
 */

const J0 = [
  [-0.62, 0.31, -0.18],
  [0.44, 0.27, 0.29],
];

/** Solve (JᵀJ + λ²I) x = Jᵀe by Gaussian elimination with partial pivoting. */
function normalEquations(J: number[][], e: number[], lambda: number): number[] {
  const n = J[0].length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J[0][i] * J[0][j] + J[1][i] * J[1][j] + (i === j ? lambda * lambda : 0)));
  const b = Array.from({ length: n }, (_, i) => J[0][i] * e[0] + J[1][i] * e[1]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

const apply = (J: number[][], x: number[]) => [0, 1].map((r) => J[r].reduce((s, v, i) => s + v * x[i], 0));

describe("dlsStep", () => {
  it("returns one joint change per column of J", () => {
    expect(dlsStep(J0, [0.01, -0.02], 0.1)).toHaveLength(3);
  });

  it("solves the damped normal equations (JᵀJ + λ²I) δθ = Jᵀe", () => {
    for (const lambda of [0.01, 0.1, 0.5, 2]) {
      const e = [0.03, -0.05];
      const got = dlsStep(J0, e, lambda);
      normalEquations(J0, e, lambda).forEach((v, i) => expect(got[i]).toBeCloseTo(v, 10));
    }
  });

  it("hits the target exactly with λ = 0, using the minimum-norm δθ", () => {
    const e = [0.04, 0.02];
    const d = dlsStep(J0, e, 0);
    const Jd = apply(J0, d);
    expect(Jd[0]).toBeCloseTo(e[0], 12);
    expect(Jd[1]).toBeCloseTo(e[1], 12);
    // Minimum norm ⇔ δθ lies in the row space of J ⇔ δθ ⟂ null(J). null(J) is spanned by row0 × row1.
    const [a, b] = J0;
    const nul = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    expect(d.reduce((s, v, i) => s + v * nul[i], 0)).toBeCloseTo(0, 12);
  });

  it("tends to Jᵀe / λ² for heavy damping", () => {
    const e = [0.3, -0.1];
    const lambda = 1e3;
    const d = dlsStep(J0, e, lambda);
    const jte = [0, 1, 2].map((i) => J0[0][i] * e[0] + J0[1][i] * e[1]);
    d.forEach((v, i) => expect(v * lambda * lambda).toBeCloseTo(jte[i], 5));
  });

  it("stays finite at a singular pose when damped", () => {
    const J = jacobian([0.6, 0, 0], [0.55, 0.45, 0.3]);
    const d = dlsStep(J, [-0.2, 0.5], 0.05);
    d.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it("drives the 3-link arm onto a reachable target (full IK loop)", () => {
    const L = [0.55, 0.45, 0.3];
    let th = [2.0, -1.3, -1.1];
    const goal = [-0.35, 0.95];
    let err = Infinity;
    for (let k = 0; k < 200 && err > 1e-6; k++) {
      const tip = forwardKinematics(th, L)[3];
      const e = [goal[0] - tip[0], goal[1] - tip[1]];
      err = Math.hypot(e[0], e[1]);
      const d = dlsStep(jacobian(th, L), e, 0.05);
      th = th.map((v, i) => v + d[i]);
    }
    expect(err).toBeLessThan(1e-6);
  });
});
