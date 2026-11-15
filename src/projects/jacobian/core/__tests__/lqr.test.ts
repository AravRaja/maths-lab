import { describe, expect, it } from "vitest";
import { dlqr, riccatiStep } from "../lqr";
import { cartPoleLinear, CARTPOLE } from "../../lib/cartpole";
import { eye, matAdd, matMul, matSub, matVec, spectralRadius, symEig, dot, type Mat, type Vec } from "../../lib/linalg";
import { expectMatClose, rng } from "./helpers";

/*
 * LQR is checked from its definition, not its formula:
 *  - riccatiStep's u = −Kx really minimises the one-step cost, and its P' is the minimum value.
 *  - dlqr's K beats nearby gains on the true infinite-horizon cost (found by simulation), and
 *    in the scalar case it matches a brute-force search over k.
 */

const u = rng(31);
const quad = (x: Vec, M: Mat) => dot(x, matVec(M, x));

/** One-step cost  xᵀQx + uᵀRu + (Ax+Bu)ᵀ P (Ax+Bu). */
function stepCost(x: Vec, uu: Vec, P: Mat, A: Mat, B: Mat, Q: Mat, R: Mat) {
  const y = matAdd(matVec(A, x).map((v) => [v]), matVec(B, uu).map((v) => [v])).map((r) => r[0]);
  return quad(x, Q) + quad(uu, R) + quad(y, P);
}

/** Infinite-horizon cost of u = −Kx from x0, by simulation (stable closed loop only). */
function closedLoopCost(K: Mat, A: Mat, B: Mat, Q: Mat, R: Mat, x0: Vec, steps = 4000) {
  let x = x0.slice();
  let J = 0;
  for (let k = 0; k < steps; k++) {
    const uu = matVec(K, x).map((v) => -v);
    J += quad(x, Q) + quad(uu, R);
    x = matVec(A, x).map((v, i) => v + matVec(B, uu)[i]);
    if (!x.every(Number.isFinite) || Math.abs(J) > 1e12) return Infinity;
  }
  return J;
}

// A double integrator, dt = 0.1.
const A2 = [
  [1, 0.1],
  [0, 1],
];
const B2 = [[0.005], [0.1]];
const Q2 = [
  [1, 0],
  [0, 0.1],
];
const R2 = [[0.05]];

describe("riccatiStep", () => {
  it("returns K that minimises the one-step cost, and P' as that minimum", () => {
    const P = [
      [3, 0.4],
      [0.4, 1.5],
    ];
    const { K, P: Pn } = riccatiStep(P, A2, B2, Q2, R2);
    expect(K).toHaveLength(1);
    expect(K[0]).toHaveLength(2);
    for (let s = 0; s < 10; s++) {
      const x = [u() * 2 - 1, u() * 2 - 1];
      const ustar = matVec(K, x).map((v) => -v);
      const c = stepCost(x, ustar, P, A2, B2, Q2, R2);
      for (const d of [-1e-3, 1e-3, -0.1, 0.1]) expect(stepCost(x, [ustar[0] + d], P, A2, B2, Q2, R2)).toBeGreaterThan(c);
      expect(quad(x, Pn)).toBeCloseTo(c, 10);
    }
  });

  it("works with two inputs, and keeps P symmetric", () => {
    const A = [
      [1.02, 0.1, 0],
      [0, 0.98, 0.1],
      [0.05, 0, 1],
    ];
    const B = [
      [0.1, 0],
      [0, 0.05],
      [0.02, 0.1],
    ];
    const Q = eye(3);
    const R = [
      [0.2, 0.05],
      [0.05, 0.3],
    ];
    const P = matAdd(eye(3), [
      [0.5, 0.1, 0],
      [0.1, 0.2, 0.05],
      [0, 0.05, 0.4],
    ]);
    const { K, P: Pn } = riccatiStep(P, A, B, Q, R);
    expect(K).toHaveLength(2);
    expectMatClose(Pn, Pn.map((r, i) => r.map((_, j) => Pn[j][i])), 1e-12, "P symmetric");
    const x = [0.3, -0.7, 0.2];
    const ustar = matVec(K, x).map((v) => -v);
    const c = stepCost(x, ustar, P, A, B, Q, R);
    for (const d of [[0.01, 0], [0, 0.01], [-0.01, 0.01]]) expect(stepCost(x, [ustar[0] + d[0], ustar[1] + d[1]], P, A, B, Q, R)).toBeGreaterThan(c);
    expect(quad(x, Pn)).toBeCloseTo(c, 10);
  });
});

describe("dlqr", () => {
  it("matches a brute-force search over k for a scalar unstable system", () => {
    const [a, b, q, r] = [1.3, 0.5, 1, 0.4];
    // Cost of u = −kx from x0 = 1 is a geometric series: (q + r k²) / (1 − (a − bk)²) when |a − bk| < 1.
    const cost = (k: number) => (Math.abs(a - b * k) < 1 ? (q + r * k * k) / (1 - (a - b * k) ** 2) : Infinity);
    let lo = (a - 1) / b + 1e-9;
    let hi = (a + 1) / b - 1e-9;
    for (let i = 0; i < 200; i++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (cost(m1) < cost(m2)) hi = m2;
      else lo = m1;
    }
    const kBest = (lo + hi) / 2;
    const { K, P } = dlqr([[a]], [[b]], [[q]], [[r]]);
    expect(K[0][0]).toBeCloseTo(kBest, 6);
    expect(P[0][0]).toBeCloseTo(cost(kBest), 6);
  });

  it("is a fixed point of riccatiStep (the DARE), with P symmetric positive definite", () => {
    const { K, P, iterations } = dlqr(A2, B2, Q2, R2);
    expect(iterations).toBeGreaterThan(0);
    const s = riccatiStep(P, A2, B2, Q2, R2);
    expectMatClose(s.P, P, 1e-7, "P = riccati(P)");
    expectMatClose(s.K, K, 1e-7, "K = gain(P)");
    expect(symEig(P).values.every((v) => v > 0)).toBe(true);
  });

  it("stabilises the double integrator and beats nearby gains on the true cost", () => {
    const { K, P } = dlqr(A2, B2, Q2, R2);
    expect(spectralRadius(matSub(A2, matMul(B2, K)))).toBeLessThan(1);
    const x0 = [1, -0.5];
    const best = closedLoopCost(K, A2, B2, Q2, R2, x0);
    expect(best).toBeCloseTo(quad(x0, P), 4);
    for (let s = 0; s < 10; s++) {
      const Kp = [K[0].map((k) => k * (1 + (u() * 2 - 1) * 0.1))];
      expect(closedLoopCost(Kp, A2, B2, Q2, R2, x0)).toBeGreaterThan(best - 1e-9);
    }
  });

  it("balances the linearised cart-pole (open loop unstable, closed loop stable)", () => {
    const { A, B } = cartPoleLinear(CARTPOLE, 0.02);
    expect(spectralRadius(A)).toBeGreaterThan(1);
    const Q = [
      [1, 0, 0, 0],
      [0, 0.1, 0, 0],
      [0, 0, 10, 0],
      [0, 0, 0, 0.1],
    ];
    const { K } = dlqr(A, B, Q, [[0.1]]);
    expect(spectralRadius(matSub(A, matMul(B, K)))).toBeLessThan(1);
  });

  it("stops at maxIter", () => {
    expect(dlqr(A2, B2, Q2, R2, { maxIter: 3, tol: 0 }).iterations).toBe(3);
  });
});
