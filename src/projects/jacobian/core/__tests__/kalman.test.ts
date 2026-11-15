import { describe, expect, it } from "vitest";
import { kalmanPredict, kalmanUpdate } from "../kalman";
import { constantVelocity } from "../../lib/tracker";
import { eye, inverse, matAdd, matMul, matScale, matVec, solve, symEig, transpose, add, sub, dot, type Mat, type Vec } from "../../lib/linalg";
import { expectMatClose, expectVecClose, gaussian, rng, sampleGaussian, sampleMeanCov } from "./helpers";

/*
 * The Kalman filter is checked against sampling (push 40k Gaussian samples through the model and
 * measure), against batch least squares for a static state, and for statistical consistency (NEES).
 */

const u = rng(41);

const P0 = [
  [0.8, 0.3],
  [0.3, 0.5],
];
const F0 = [
  [1, 0.5],
  [-0.2, 0.9],
];
const Q0 = [
  [0.05, 0.01],
  [0.01, 0.1],
];

describe("kalmanPredict", () => {
  it("returns the mean and covariance of F x + w (checked by sampling)", () => {
    const x = [1, -2];
    const { x: xp, P: Pp } = kalmanPredict(x, P0, F0, Q0);
    const N = 40000;
    const xs = sampleGaussian(x, P0, N, u);
    const ws = sampleGaussian([0, 0], Q0, N, u);
    const ys = xs.map((s, i) => add(matVec(F0, s), ws[i]));
    const { mean, cov } = sampleMeanCov(ys);
    expectVecClose(xp, mean, 0.03, "mean");
    expectMatClose(Pp, cov, 0.04, "covariance");
  });

  it("changes nothing with F = I and Q = 0, and doesn't touch its inputs", () => {
    const x = [0.3, 0.4];
    const P = P0.map((r) => r.slice());
    const out = kalmanPredict(x, P, eye(2), [[0, 0], [0, 0]]);
    expectVecClose(out.x, x, 1e-15);
    expectMatClose(out.P, P0, 1e-15);
    expect(P).toEqual(P0);
  });

  it("grows the position uncertainty of a constant-velocity model without bound", () => {
    const { F, Q } = constantVelocity(1, 0.1, 1e-3);
    let s = { x: [0, 0], P: [[0.01, 0], [0, 0.01]] };
    const vars: number[] = [];
    for (let k = 0; k < 50; k++) {
      s = kalmanPredict(s.x, s.P, F, Q);
      vars.push(s.P[0][0]);
    }
    for (let k = 1; k < vars.length; k++) expect(vars[k]).toBeGreaterThan(vars[k - 1]);
  });
});

describe("kalmanUpdate", () => {
  const H = [[1, 0]];

  it("returns the innovation, and an innovation covariance S that matches sampling", () => {
    const x = [0.5, 0.1];
    const R = [[0.2]];
    const z = [0.9];
    const { y, S } = kalmanUpdate(x, P0, z, H, R);
    expectVecClose(y, [0.4], 1e-12, "innovation");
    const N = 40000;
    const xs = sampleGaussian(x, P0, N, u);
    const g = gaussian(u);
    const ys = xs.map((s) => [s[0] + Math.sqrt(0.2) * g() - x[0]]);
    expect(S[0][0]).toBeCloseTo(sampleMeanCov(ys).cov[0][0], 1);
  });

  it("lands between the prior and the measurement, and shrinks the variance", () => {
    const out = kalmanUpdate([0], [[2]], [1], [[1]], [[1]]);
    expect(out.x[0]).toBeGreaterThan(0);
    expect(out.x[0]).toBeLessThan(1);
    expect(out.P[0][0]).toBeLessThan(1);
    expect(out.P[0][0]).toBeGreaterThan(0);
  });

  it("trusts a perfect sensor completely and ignores a useless one", () => {
    const x = [0.5, -0.5];
    const z = [1.5, 2.5];
    const sharp = kalmanUpdate(x, P0, z, eye(2), matScale(eye(2), 1e-12));
    expectVecClose(sharp.x, z, 1e-6, "R → 0");
    expect(Math.abs(sharp.P[0][0]) + Math.abs(sharp.P[1][1])).toBeLessThan(1e-6);
    const blind = kalmanUpdate(x, P0, z, eye(2), matScale(eye(2), 1e12));
    expectVecClose(blind.x, x, 1e-6, "R → ∞");
    expectMatClose(blind.P, P0, 1e-6, "R → ∞");
  });

  it("matches batch least squares for a static state", () => {
    // x is constant (F = I, Q = 0). After k scalar measurements z_i = h_i x + v_i the filter's
    // posterior must equal the regularised least-squares answer, whatever order they come in.
    const prior = [0.2, -0.1];
    const Pprior = [
      [4, 0.5],
      [0.5, 3],
    ];
    const truth = [1.3, -0.7];
    const g = gaussian(u);
    let s = { x: prior, P: Pprior };
    let info: Mat = inverse(Pprior);
    let infoVec: Vec = matVec(inverse(Pprior), prior);
    for (let k = 0; k < 25; k++) {
      const h = [u() * 2 - 1, u() * 2 - 1];
      const r = 0.05 + u() * 0.2;
      const z = dot(h, truth) + Math.sqrt(r) * g();
      s = kalmanUpdate(s.x, s.P, [z], [h], [[r]]);
      info = matAdd(info, matScale([[h[0] * h[0], h[0] * h[1]], [h[1] * h[0], h[1] * h[1]]], 1 / r));
      infoVec = add(infoVec, h.map((v) => (v * z) / r));
    }
    expectVecClose(s.x, solve(info, infoVec), 1e-9, "posterior mean");
    expectMatClose(s.P, inverse(info), 1e-9, "posterior covariance");
  });

  it("keeps P symmetric positive definite over a long run with a 2-D sensor", () => {
    const { F, Q } = constantVelocity(2, 0.05, 0.5);
    const Hpos = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
    const R = matScale(eye(2), 1e-6); // a very sharp sensor makes the naive update lose PD-ness
    let s = { x: [0, 0, 0, 0], P: matScale(eye(4), 100) };
    for (let k = 0; k < 500; k++) {
      s = kalmanPredict(s.x, s.P, F, Q);
      s = kalmanUpdate(s.x, s.P, [Math.sin(k * 0.05), Math.cos(k * 0.05)], Hpos, R);
    }
    expectMatClose(s.P, transpose(s.P), 1e-12, "symmetric");
    expect(symEig(s.P).values.every((v) => v > 0)).toBe(true);
  });

  it("is statistically consistent on a simulated constant-velocity target (NEES ≈ state dimension)", () => {
    const dt = 0.05;
    const { F, Q } = constantVelocity(1, dt, 2.0);
    const Hp = [[1, 0]];
    const R = [[0.04]];
    const g = gaussian(u);
    let nees = 0;
    let count = 0;
    for (let run = 0; run < 60; run++) {
      let truth = sampleGaussian([0, 0], eye(2), 1, u)[0];
      let s = { x: [0, 0], P: eye(2) };
      for (let k = 0; k < 120; k++) {
        truth = add(matVec(F, truth), sampleGaussian([0, 0], Q, 1, u)[0]);
        s = kalmanPredict(s.x, s.P, F, Q);
        s = kalmanUpdate(s.x, s.P, [truth[0] + 0.2 * g()], Hp, R);
        if (k > 20) {
          const e = sub(truth, s.x);
          nees += dot(e, solve(s.P, e));
          count++;
        }
      }
    }
    expect(nees / count).toBeGreaterThan(1.8);
    expect(nees / count).toBeLessThan(2.2);
  });

  it("does not need an explicit S⁻¹ to be well behaved for a 3-D position sensor", () => {
    const { F, Q } = constantVelocity(3, 0.05, 1);
    const Hp = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
    ];
    let s = { x: new Array(6).fill(0), P: eye(6) };
    s = kalmanPredict(s.x, s.P, F, Q);
    const out = kalmanUpdate(s.x, s.P, [1, 2, 3], Hp, matScale(eye(3), 0.01));
    expect(out.K).toHaveLength(6);
    expect(out.K[0]).toHaveLength(3);
    // The position part of the gain is close to I for a sharp sensor and a vague prior.
    expectMatClose(matMul(Hp, out.K), eye(3), 0.02, "H K ≈ I");
  });
});
