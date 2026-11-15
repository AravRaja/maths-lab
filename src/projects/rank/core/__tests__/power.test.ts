import { describe, expect, it } from "vitest";
import { deflate, powerIteration } from "../power";
import { svd, factorColumn } from "../../lib/svd";
import { dot, norm, randMatrix, randVec, withSpectrum } from "./helpers";

const sinAngle = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  const c = Math.abs(dot(a, b)) / (norm(a) * norm(b));
  return Math.sqrt(Math.max(0, 1 - c * c));
};

describe("powerIteration", () => {
  it("finds the top singular triple of a random matrix", () => {
    const A = randMatrix(30, 20, 9);
    const s = svd(A);
    const r = powerIteration(A, { iters: 2000, tol: 1e-14 });
    expect(r.sigma).toBeCloseTo(s.S[0], 8);
    expect(norm(r.u)).toBeCloseTo(1, 10);
    expect(norm(r.v)).toBeCloseTo(1, 10);
    expect(r.u.length).toBe(30);
    expect(r.v.length).toBe(20);
    expect(sinAngle(r.v, factorColumn(s.V, 0))).toBeLessThan(1e-5);
    expect(sinAngle(r.u, factorColumn(s.U, 0))).toBeLessThan(1e-5);
    // A v = sigma u
    const Av = new Float64Array(30);
    for (let i = 0; i < 30; i++) for (let j = 0; j < 20; j++) Av[i] += A.data[i * 20 + j] * r.v[j];
    for (let i = 0; i < 30; i++) expect(Av[i]).toBeCloseTo(r.sigma * r.u[i], 8);
  });

  it("runs exactly `iters` with tol = 0, records history, and the estimates never decrease", () => {
    const A = withSpectrum(20, 15, [1, 0.9, 0.5, 0.2], 1);
    const v0 = randVec(15, 4);
    const r = powerIteration(A, { iters: 25, tol: 0, v0 });
    expect(r.iters).toBe(25);
    expect(r.history.length).toBe(25);
    expect(r.history[24]).toBe(r.sigma);
    for (let t = 1; t < 25; t++) expect(r.history[t]).toBeGreaterThanOrEqual(r.history[t - 1] - 1e-13);
    for (const h of r.history) expect(h).toBeLessThanOrEqual(1 + 1e-12);
  });

  it("stops early on an easy problem", () => {
    const A = withSpectrum(10, 10, [1, 0.1], 2);
    const r = powerIteration(A, { iters: 500, tol: 1e-12 });
    expect(r.iters).toBeLessThan(60);
    expect(r.sigma).toBeCloseTo(1, 10);
  });

  it("converges at the rate set by the gap: angle shrinks by (σ2/σ1)^2 per iteration", () => {
    const rho = 0.9;
    const A = withSpectrum(25, 20, [1, rho, 0.3, 0.1], 3);
    const V1 = factorColumn(svd(A).V, 0);
    const v0 = randVec(20, 8);
    const a10 = sinAngle(powerIteration(A, { iters: 10, tol: 0, v0 }).v, V1);
    const a30 = sinAngle(powerIteration(A, { iters: 30, tol: 0, v0 }).v, V1);
    const perStep = Math.pow(a30 / a10, 1 / 20);
    expect(perStep).toBeGreaterThan(rho * rho * 0.97);
    expect(perStep).toBeLessThan(rho * rho * 1.03);
  });

  it("does not mutate A or v0", () => {
    const A = randMatrix(6, 4, 2);
    const v0 = randVec(4, 3);
    const a = Float64Array.from(A.data), b = Float64Array.from(v0);
    powerIteration(A, { iters: 5, v0 });
    expect(Array.from(A.data)).toEqual(Array.from(a));
    expect(Array.from(v0)).toEqual(Array.from(b));
  });
});

describe("deflate", () => {
  it("removes the top triple: the next singular value moves up", () => {
    const sig = [3, 2, 1, 0.5];
    const A = withSpectrum(9, 7, sig, 5);
    const s = svd(A);
    const before = Float64Array.from(A.data);
    const D = deflate(A, s.S[0], factorColumn(s.U, 0), factorColumn(s.V, 0));
    expect(Array.from(A.data)).toEqual(Array.from(before));
    const sd = svd(D).S;
    expect(sd[0]).toBeCloseTo(2, 10);
    expect(sd[1]).toBeCloseTo(1, 10);
    expect(sd[2]).toBeCloseTo(0.5, 10);
    expect(sd[3]).toBeLessThan(1e-10);
    // D v_1 = 0
    const v1 = factorColumn(s.V, 0);
    for (let i = 0; i < 9; i++) {
      let x = 0;
      for (let j = 0; j < 7; j++) x += D.data[i * 7 + j] * v1[j];
      expect(Math.abs(x)).toBeLessThan(1e-10);
    }
  });

  it("power iteration + deflation recovers the top 3 singular values", () => {
    let A = withSpectrum(12, 10, [4, 2.5, 1.2, 0.4, 0.1], 6);
    const got: number[] = [];
    for (let k = 0; k < 3; k++) {
      const r = powerIteration(A, { iters: 3000, tol: 1e-15 });
      got.push(r.sigma);
      A = deflate(A, r.sigma, r.u, r.v);
    }
    expect(got[0]).toBeCloseTo(4, 7);
    expect(got[1]).toBeCloseTo(2.5, 7);
    expect(got[2]).toBeCloseTo(1.2, 7);
  });
});
