import { describe, expect, it } from "vitest";
import { geometricJacobian, manipulability } from "../jacobian";
import { forwardKinematics } from "../kinematics";
import type { ArmSpec } from "../types";
import { ARM } from "../../lib/arm";
import { Rz, matMul, matScale, matSub, posOf, rotOf, transpose, type Mat } from "../../lib/linalg";
import { expectMatClose, rng, rotAbout, randomUnit } from "./helpers";

/*
 * The Jacobian is checked against central finite differences of YOUR forwardKinematics,
 * for both the linear rows (d tool / dq) and the angular rows (dR/dq Rᵀ = [ω]×).
 */

const u = rng(23);
const randomQ = () => ARM.joints.map((j) => j.limits[0] + u() * (j.limits[1] - j.limits[0]));
const tool = (q: number[], arm: ArmSpec = ARM) => forwardKinematics(q, arm)[arm.joints.length];

function finiteDifferenceJacobian(q: number[], arm: ArmSpec = ARM, h = 1e-6): Mat {
  const n = arm.joints.length;
  const J: Mat = Array.from({ length: 6 }, () => new Array(n).fill(0));
  const R0t = transpose(rotOf(tool(q, arm)));
  for (let i = 0; i < n; i++) {
    const qp = q.slice();
    const qm = q.slice();
    qp[i] += h;
    qm[i] -= h;
    const Tp = tool(qp, arm);
    const Tm = tool(qm, arm);
    const dp = posOf(Tp).map((v, k) => (v - posOf(Tm)[k]) / (2 * h));
    const W = matMul(matScale(matSub(rotOf(Tp), rotOf(Tm)), 1 / (2 * h)), R0t); // ≈ [ω]×
    const w = [W[2][1], W[0][2], W[1][0]];
    for (let r = 0; r < 3; r++) {
      J[r][i] = dp[r];
      J[r + 3][i] = w[r];
    }
  }
  return J;
}

describe("geometricJacobian", () => {
  it("is 6 × n", () => {
    const q = randomQ();
    const J = geometricJacobian(forwardKinematics(q, ARM), ARM);
    expect(J).toHaveLength(6);
    J.forEach((row) => expect(row).toHaveLength(ARM.joints.length));
  });

  it("matches finite differences of forwardKinematics (linear and angular rows)", () => {
    for (let s = 0; s < 15; s++) {
      const q = randomQ();
      const J = geometricJacobian(forwardKinematics(q, ARM), ARM);
      expectMatClose(J, finiteDifferenceJacobian(q), 1e-6, `pose ${s}`);
    }
  });

  it("matches the planar two-link Jacobian you can write by hand", () => {
    const planar: ArmSpec = {
      joints: [
        { name: "a", offset: [0, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
        { name: "b", offset: [1, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
      ],
      tool: [0.5, 0, 0],
    };
    const [q1, q2] = [0.6, -1.1];
    const s1 = Math.sin(q1), c1 = Math.cos(q1), s12 = Math.sin(q1 + q2), c12 = Math.cos(q1 + q2);
    const want = [
      [-s1 - 0.5 * s12, -0.5 * s12],
      [c1 + 0.5 * c12, 0.5 * c12],
      [0, 0],
      [0, 0],
      [0, 0],
      [1, 1],
    ];
    expectMatClose(geometricJacobian(forwardKinematics([q1, q2], planar), planar), want, 1e-12);
  });

  it("columns of joints with axes not along z work (wrist roll is about x)", () => {
    const q = [0.3, 0.4, 0.5, -0.6, 0.7, 0.8];
    const J = geometricJacobian(forwardKinematics(q, ARM), ARM);
    const F = finiteDifferenceJacobian(q);
    expectMatClose(J.map((r) => [r[5]]), F.map((r) => [r[5]]), 1e-6, "column 6");
  });
});

describe("manipulability", () => {
  it("is the product of the scales of a diagonal Jacobian", () => {
    expect(manipulability([
      [2, 0, 0],
      [0, 3, 0],
    ])).toBeCloseTo(6, 12);
    expect(manipulability([[0.5, 0], [0, 4]])).toBeCloseTo(2, 12);
  });

  it("is zero (not NaN) for a rank-deficient Jacobian", () => {
    const w = manipulability([
      [1, 2, 3],
      [2, 4, 6],
    ]);
    expect(Number.isNaN(w)).toBe(false);
    expect(w).toBeGreaterThanOrEqual(0);
    expect(w).toBeLessThan(1e-6);
  });

  it("ignores a rotation of task space and scales as c^m", () => {
    const J = [
      [0.3, -1.2, 0.5, 0.9],
      [1.1, 0.2, -0.4, 0.3],
      [-0.2, 0.7, 0.8, -1.0],
    ];
    const U = rotAbout(randomUnit(u), 1.234);
    expect(manipulability(matMul(U, J))).toBeCloseTo(manipulability(J), 10);
    expect(manipulability(matScale(J, 2))).toBeCloseTo(8 * manipulability(J), 10);
    expect(manipulability(matMul(Rz(0.4), J))).toBeCloseTo(manipulability(J), 10);
  });

  it("gives l1 l2 |sin q2| for the planar two-link arm (zero when stretched or folded)", () => {
    const planar: ArmSpec = {
      joints: [
        { name: "a", offset: [0, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
        { name: "b", offset: [1, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
      ],
      tool: [0.5, 0, 0],
    };
    for (const q2 of [0, 0.4, 1.2, Math.PI / 2, 2.5, Math.PI]) {
      const J = geometricJacobian(forwardKinematics([0.3, q2], planar), planar);
      expect(manipulability(J.slice(0, 2))).toBeCloseTo(0.5 * Math.abs(Math.sin(q2)), 7);
    }
  });

  it("finds the page's arm singular when it stands straight up", () => {
    const J = geometricJacobian(forwardKinematics([0, 0, 0, 0, 0, 0], ARM), ARM);
    expect(manipulability(J.slice(0, 3))).toBeLessThan(1e-9);
    const Jb = geometricJacobian(forwardKinematics([0.2, 0.5, 1.0, 0.7, 0.3, 0.4], ARM), ARM);
    expect(manipulability(Jb.slice(0, 3))).toBeGreaterThan(1e-3);
  });
});
