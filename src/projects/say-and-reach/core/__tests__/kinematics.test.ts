import { describe, expect, it } from "vitest";
import { forwardKinematics, jacobian } from "../kinematics";

/*
 * Forward kinematics and the Jacobian: closed forms, invariants, and a central
 * finite-difference check that J really is the derivative of FK.
 */

const L = [0.55, 0.45, 0.3];
const close = (a: number[], b: number[], digits = 10) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe("forwardKinematics", () => {
  it("returns the base, every joint and the fingertip", () => {
    const p = forwardKinematics([0.1, 0.2, 0.3], L);
    expect(p).toHaveLength(4);
    close(p[0], [0, 0], 14);
  });

  it("stretches straight along +x when every angle is zero", () => {
    const p = forwardKinematics([0, 0, 0], L);
    close(p[1], [0.55, 0], 12);
    close(p[2], [1.0, 0], 12);
    close(p[3], [1.3, 0], 12);
  });

  it("matches a hand-worked 2-link pose: θ = (π/2, −π/2)", () => {
    const p = forwardKinematics([Math.PI / 2, -Math.PI / 2], [1, 2]);
    close(p[1], [0, 1], 12);
    close(p[2], [2, 1], 12);
  });

  it("keeps every link at its length", () => {
    const th = [2.1, -1.4, 0.9];
    const p = forwardKinematics(th, L);
    for (let i = 0; i < L.length; i++) expect(Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])).toBeCloseTo(L[i], 12);
  });

  it("rotates rigidly about the base when θ₁ changes", () => {
    const th = [0.4, -0.8, 1.2];
    const c = 0.7;
    const a = forwardKinematics(th, L);
    const b = forwardKinematics([th[0] + c, th[1], th[2]], L);
    a.forEach(([x, y], i) => close(b[i], [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)], 12));
  });

  it("never reaches beyond the sum of the link lengths", () => {
    for (let k = 0; k < 50; k++) {
      const th = [Math.sin(k) * 3, Math.cos(k * 1.7) * 3, Math.sin(k * 0.3) * 3];
      const tip = forwardKinematics(th, L)[3];
      expect(Math.hypot(tip[0], tip[1])).toBeLessThanOrEqual(1.3 + 1e-12);
    }
  });
});

describe("jacobian", () => {
  it("is 2 × n", () => {
    const J = jacobian([0.1, 0.2, 0.3], L);
    expect(J).toHaveLength(2);
    J.forEach((row) => expect(row).toHaveLength(3));
  });

  it("matches central finite differences of the fingertip", () => {
    const h = 1e-6;
    for (const th of [[0.3, -0.5, 1.1], [2.0, -1.3, -1.1], [-0.7, 2.2, 0.4]]) {
      const J = jacobian(th, L);
      for (let i = 0; i < th.length; i++) {
        const up = th.slice(); up[i] += h;
        const dn = th.slice(); dn[i] -= h;
        const a = forwardKinematics(up, L)[3], b = forwardKinematics(dn, L)[3];
        expect(J[0][i]).toBeCloseTo((a[0] - b[0]) / (2 * h), 7);
        expect(J[1][i]).toBeCloseTo((a[1] - b[1]) / (2 * h), 7);
      }
    }
  });

  it("has a last column of length ℓ_n, perpendicular to the last link", () => {
    const th = [0.9, 0.4, -1.3];
    const J = jacobian(th, L);
    const p = forwardKinematics(th, L);
    const link = [p[3][0] - p[2][0], p[3][1] - p[2][1]];
    expect(Math.hypot(J[0][2], J[1][2])).toBeCloseTo(L[2], 12);
    expect(J[0][2] * link[0] + J[1][2] * link[1]).toBeCloseTo(0, 12);
  });

  it("loses rank when the arm is fully stretched", () => {
    const J = jacobian([0.6, 0, 0], L);
    // det(J Jᵀ) = 0 for a singular pose.
    let a = 0, b = 0, d = 0;
    for (let i = 0; i < 3; i++) { a += J[0][i] ** 2; b += J[0][i] * J[1][i]; d += J[1][i] ** 2; }
    expect(a * d - b * b).toBeCloseTo(0, 10);
  });
});
