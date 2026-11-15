import { describe, expect, it } from "vitest";
import { decode, encode, meanCenter, pca } from "../pca";
import { dot, norm, randVec } from "./helpers";
import { gaussian, rng } from "../../lib/rng";
import type { Matrix, PCA } from "../types";

/** n samples in ℝᵈ with very different spreads along random orthogonal directions. */
function dataset(n: number, d: number, seed: number): { X: Matrix; dirs: Float64Array[]; mu: Float64Array } {
  const g = gaussian(rng(seed));
  const dirs: Float64Array[] = [];
  for (let k = 0; k < d; k++) {
    const v = randVec(d, seed * 13 + k);
    for (let pass = 0; pass < 2; pass++) for (const q of dirs) { const t = dot(q, v); for (let i = 0; i < d; i++) v[i] -= t * q[i]; }
    const nv = norm(v);
    dirs.push(v.map((x) => x / nv));
  }
  const spreads = Array.from({ length: d }, (_, k) => 4 / (k + 1) ** 1.5);
  const mu = randVec(d, seed + 999).map((x) => 3 * x);
  const X: Matrix = { rows: n, cols: d, data: new Float64Array(n * d) };
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < d; k++) {
      const c = spreads[k] * g();
      for (let j = 0; j < d; j++) X.data[i * d + j] += c * dirs[k][j];
    }
    for (let j = 0; j < d; j++) X.data[i * d + j] += mu[j];
  }
  return { X, dirs, mu };
}

function covariance(X: Matrix): Float64Array {
  const { rows: n, cols: d } = X;
  const mean = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) mean[j] += X.data[i * d + j] / n;
  const C = new Float64Array(d * d);
  for (let i = 0; i < n; i++)
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a * d + b] += ((X.data[i * d + a] - mean[a]) * (X.data[i * d + b] - mean[b])) / (n - 1);
  return C;
}

describe("meanCenter", () => {
  it("subtracts the column means without mutating X", () => {
    const X: Matrix = { rows: 3, cols: 2, data: Float64Array.from([1, 10, 2, 20, 6, 60]) };
    const before = Float64Array.from(X.data);
    const { mean, centered } = meanCenter(X);
    expect(Array.from(mean)).toEqual([3, 30].map((x) => expect.closeTo(x, 12)));
    expect(Array.from(centered.data)).toEqual([-2, -20, -1, -10, 3, 30].map((x) => expect.closeTo(x, 12)));
    expect([centered.rows, centered.cols]).toEqual([3, 2]);
    expect(Array.from(X.data)).toEqual(Array.from(before));
  });
});

describe("pca", () => {
  const { X, dirs, mu } = dataset(400, 6, 3);

  it("components are orthonormal and variances descend", () => {
    const p = pca(X, 4);
    expect(p.components.length).toBe(4);
    expect(p.variances.length).toBe(4);
    expect(p.mean.length).toBe(6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) expect(dot(p.components[i], p.components[j])).toBeCloseTo(i === j ? 1 : 0, 10);
    for (let i = 1; i < 4; i++) expect(p.variances[i]).toBeLessThanOrEqual(p.variances[i - 1]);
  });

  it("components are eigenvectors of the sample covariance, variances its eigenvalues", () => {
    const p = pca(X, 6);
    const C = covariance(X);
    for (let k = 0; k < 6; k++) {
      const q = p.components[k];
      for (let a = 0; a < 6; a++) {
        let Cq = 0;
        for (let b = 0; b < 6; b++) Cq += C[a * 6 + b] * q[b];
        expect(Cq).toBeCloseTo(p.variances[k] * q[a], 8);
      }
    }
    const trace = Array.from({ length: 6 }, (_, i) => C[i * 7]).reduce((a, b) => a + b, 0);
    expect(p.variances.reduce((a, b) => a + b, 0)).toBeCloseTo(trace, 8);
  });

  it("finds the planted direction and the mean", () => {
    const p = pca(X, 1);
    expect(Math.abs(dot(p.components[0], dirs[0]))).toBeGreaterThan(0.99);
    for (let j = 0; j < 6; j++) expect(p.mean[j]).toBeCloseTo(mu[j], 0);
  });

  it("works when there are fewer samples than dimensions", () => {
    const small = dataset(5, 6, 8).X;
    const p = pca(small, 3);
    expect(p.components[0].length).toBe(6);
    for (let i = 0; i < 3; i++) expect(norm(p.components[i])).toBeCloseTo(1, 10);
  });
});

describe("encode / decode", () => {
  const { X } = dataset(200, 5, 11);
  let cached: PCA | undefined;
  const fit = () => (cached ??= pca(X, 5));
  const row = (i: number) => X.data.subarray(i * 5, i * 5 + 5);

  it("full basis round-trips every sample", () => {
    const full = fit();
    for (const i of [0, 17, 199]) {
      const back = decode(encode(row(i), full), full);
      for (let j = 0; j < 5; j++) expect(back[j]).toBeCloseTo(row(i)[j], 10);
    }
  });

  it("the mean encodes to zero and zero decodes to the mean", () => {
    const full = fit();
    const c = encode(full.mean, full);
    expect(c.length).toBe(5);
    for (const v of c) expect(v).toBeCloseTo(0, 10);
    const m = decode([0, 0], full);
    for (let j = 0; j < 5; j++) expect(m[j]).toBeCloseTo(full.mean[j], 12);
  });

  it("uses only the first k components, and error never grows with k", () => {
    const full = fit();
    const x = row(3);
    expect(encode(x, full, 2).length).toBe(2);
    let prev = Infinity;
    for (let k = 0; k <= 5; k++) {
      const back = decode(encode(x, full, k), full);
      const e = norm(back.map((v, j) => v - x[j]));
      expect(e).toBeLessThanOrEqual(prev + 1e-12);
      prev = e;
    }
  });

  it("coefficients have the component variances across the data", () => {
    const full = fit();
    const n = 200;
    const sums = new Float64Array(2);
    for (let i = 0; i < n; i++) {
      const c = encode(row(i), full, 2);
      sums[0] += c[0] * c[0];
      sums[1] += c[1] * c[1];
    }
    expect(sums[0] / (n - 1)).toBeCloseTo(full.variances[0], 8);
    expect(sums[1] / (n - 1)).toBeCloseTo(full.variances[1], 8);
  });
});
