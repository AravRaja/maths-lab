import { describe, expect, it } from "vitest";
import { dlsStep } from "../ik";
import { forwardKinematics } from "../kinematics";
import { geometricJacobian } from "../jacobian";
import { so3Log } from "../se3";
import { ARM, HOME, clampToLimits } from "../../lib/arm";
import { matMul, matVec, norm, posOf, rotOf, sub, transpose, Ry, Rz, type Mat, type Vec } from "../../lib/linalg";
import { expectVecClose, rng } from "./helpers";

/*
 * Damped least squares. Checked against the n×n normal equations solved by plain elimination,
 * the λ = 0 and λ → ∞ limits, a singular Jacobian, and full IK loops on the six-joint arm.
 */

const u = rng(5);
const randomJ = (m: number, n: number): Mat => Array.from({ length: m }, () => Array.from({ length: n }, () => u() * 2 - 1));

/** Solve (JᵀJ + λ²I) x = Jᵀe by Gaussian elimination with partial pivoting. */
function normalEquations(J: Mat, e: Vec, lambda: number): Vec {
  const n = J[0].length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J.reduce((s, row) => s + row[i] * row[j], 0) + (i === j ? lambda * lambda : 0)));
  const b = Array.from({ length: n }, (_, i) => J.reduce((s, row, r) => s + row[i] * e[r], 0));
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

describe("dlsStep", () => {
  it("returns one joint change per column of J", () => {
    expect(dlsStep(randomJ(3, 6), [0.01, -0.02, 0.03], 0.1)).toHaveLength(6);
    expect(dlsStep(randomJ(6, 6), [0, 0, 0, 0, 0, 0.1], 0.1)).toHaveLength(6);
  });

  it("solves the damped normal equations for 3×6 and 6×6 Jacobians", () => {
    for (const [m, n] of [[3, 6], [6, 6], [2, 5]]) {
      const J = randomJ(m, n);
      const e = Array.from({ length: m }, () => u() * 0.2 - 0.1);
      for (const lambda of [0.01, 0.1, 0.5, 2]) {
        expectVecClose(dlsStep(J, e, lambda), normalEquations(J, e, lambda), 1e-10, `${m}×${n}, λ = ${lambda}`);
      }
    }
  });

  it("hits e exactly with λ = 0, using the minimum-norm δq", () => {
    const J = randomJ(3, 6);
    const e = [0.04, 0.02, -0.03];
    const d = dlsStep(J, e, 0);
    expectVecClose(matVec(J, d), e, 1e-10, "J δq = e");
    // Minimum norm: δq lies in the row space of J, so it is orthogonal to the null space.
    // Adding any null-space direction must make it longer.
    const r = randomJ(1, 6)[0];
    const z = sub(r, dlsStep(J, matVec(J, r), 0)); // r minus its row-space part: a null-space direction
    expect(norm(matVec(J, z))).toBeLessThan(1e-9);
    expect(norm(d)).toBeLessThan(norm(d.map((v, i) => v + 0.3 * z[i])));
  });

  it("tends to Jᵀe / λ² as λ grows (a tiny gradient step)", () => {
    const J = randomJ(3, 6);
    const e = [0.1, -0.2, 0.05];
    const lambda = 1e3;
    const d = dlsStep(J, e, lambda).map((v) => v * lambda * lambda);
    expectVecClose(d, matVec(transpose(J), e), 1e-4);
  });

  it("stays finite and small on a singular Jacobian when damped", () => {
    const J = [
      [1, 2, 3],
      [2, 4, 6],
      [0, 0, 0],
    ];
    const d = dlsStep(J, [0.1, -0.1, 0.5], 0.05);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(norm(d)).toBeLessThan(10);
  });
});

describe("IK on the six-joint arm (uses your forwardKinematics and geometricJacobian)", () => {
  const tool = (q: number[]) => forwardKinematics(q, ARM)[ARM.joints.length];

  it("reaches a position target from HOME", () => {
    const target = [0.45, -0.35, 0.6];
    let q = HOME.slice();
    for (let k = 0; k < 300; k++) {
      const F = forwardKinematics(q, ARM);
      const e = sub(target, posOf(F[ARM.joints.length]));
      if (norm(e) < 1e-6) break;
      const step = norm(e) > 0.1 ? e.map((v) => (v * 0.1) / norm(e)) : e;
      const J = geometricJacobian(F, ARM).slice(0, 3);
      q = clampToLimits(q.map((v, i) => v + dlsStep(J, step, 0.02)[i]));
    }
    expect(norm(sub(target, posOf(tool(q))))).toBeLessThan(1e-4);
  });

  it("reaches a full pose (position and orientation) with so3Log", () => {
    const Rgoal = matMul(Rz(0.4), Ry(Math.PI * 0.9)); // tool pointing nearly straight down
    const pgoal = [0.55, 0.2, 0.35];
    let q = HOME.slice();
    for (let k = 0; k < 400; k++) {
      const F = forwardKinematics(q, ARM);
      const T = F[ARM.joints.length];
      const ep = sub(pgoal, posOf(T));
      const eo = so3Log(matMul(Rgoal, transpose(rotOf(T))));
      const e = [...ep, ...eo];
      if (norm(e) < 1e-7) break;
      const s = Math.min(1, 0.2 / norm(e));
      q = clampToLimits(q.map((v, i) => v + dlsStep(geometricJacobian(F, ARM), e.map((x) => x * s), 0.02)[i]));
    }
    const T = tool(q);
    expect(norm(sub(pgoal, posOf(T)))).toBeLessThan(1e-4);
    expect(norm(so3Log(matMul(Rgoal, transpose(rotOf(T)))))).toBeLessThan(1e-4);
  });
});
