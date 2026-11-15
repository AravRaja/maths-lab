import { describe, expect, it } from "vitest";
import { det, eye, expm, inverse, matDist, matMul, solve, spectralRadius, symEig, transpose, matVec } from "../linalg";
import { CARTPOLE, cartPoleDeriv, cartPoleLinear, cartPoleStep } from "../cartpole";
import { constantVelocity, firefly } from "../tracker";
import { velocityEllipsoid } from "../ellipsoid";
import { REACH } from "../arm";
import { rng } from "../rng";

/* Plumbing tests (not cores): these must pass. */

const u = rng(3);
const rand = (r: number, c: number) => Array.from({ length: r }, () => Array.from({ length: c }, () => u() * 2 - 1));

describe("linalg", () => {
  it("solves, inverts and takes determinants", () => {
    const A = rand(4, 4);
    const b = [1, 2, 3, 4];
    const x = solve(A, b);
    matVec(A, x).forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
    expect(matDist(matMul(A, inverse(A)), eye(4))).toBeLessThan(1e-10);
    expect(det([[2, 1], [1, 3]])).toBeCloseTo(5, 12);
    expect(det(matMul(A, A))).toBeCloseTo(det(A) ** 2, 10);
  });

  it("diagonalises symmetric matrices", () => {
    const M = rand(3, 3);
    const S = matMul(M, transpose(M));
    const { values, vectors } = symEig(S);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    const back = matMul(matMul(vectors, values.map((v, i) => values.map((_, j) => (i === j ? v : 0)))), transpose(vectors));
    expect(matDist(back, S)).toBeLessThan(1e-9);
  });

  it("matrix exponential and spectral radius", () => {
    const E = expm([[0, -1], [1, 0]]);
    expect(E[0][0]).toBeCloseTo(Math.cos(1), 10);
    expect(E[1][0]).toBeCloseTo(Math.sin(1), 10);
    expect(spectralRadius([[0.5, 10], [0, 0.9]])).toBeCloseTo(0.9, 2);
  });
});

describe("cart-pole", () => {
  it("is at rest upright with no force, and falls the way it leans", () => {
    expect(cartPoleDeriv(CARTPOLE, [0, 0, 0, 0], 0).every((v) => Math.abs(v) < 1e-12)).toBe(true);
    let x = [0, 0, 0.05, 0];
    for (let k = 0; k < 50; k++) x = cartPoleStep(CARTPOLE, x, 0, 0.01);
    expect(x[2]).toBeGreaterThan(0.05);
  });

  it("linearises to an unstable discrete system", () => {
    const { A, B } = cartPoleLinear(CARTPOLE, 0.02);
    expect(A).toHaveLength(4);
    expect(B[1][0]).toBeGreaterThan(0);
    expect(spectralRadius(A)).toBeGreaterThan(1);
  });
});

describe("tracker and arm plumbing", () => {
  it("builds constant-velocity matrices", () => {
    const { F, Q, H } = constantVelocity(2, 0.1, 1);
    expect(F[0][2]).toBeCloseTo(0.1);
    expect(Q[0][0]).toBeCloseTo(0.001 / 3);
    expect(H).toEqual([[1, 0, 0, 0], [0, 1, 0, 0]]);
  });

  it("keeps the firefly inside the arm's reach", () => {
    for (let t = 0; t < 200; t += 0.37) {
      const p = firefly(t);
      expect(Math.hypot(p[0], p[1], p[2] - 0.38)).toBeLessThan(REACH);
      expect(p[2]).toBeGreaterThan(0);
    }
  });

  it("velocity ellipsoid axes have the singular values as lengths", () => {
    const { axes, sigma } = velocityEllipsoid([[2, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0.5, 0]]);
    expect(sigma[0]).toBeCloseTo(2);
    expect(Math.hypot(...axes[2])).toBeCloseTo(0.5);
  });
});
