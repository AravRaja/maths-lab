/* Test-only helpers. Not a test file (vitest only runs *.test.ts). */
import { matMul, transpose, Rz, Ry, det, eye, matDist, type Mat, type Vec } from "../../lib/linalg";
import { rng, gaussian } from "../../lib/rng";

export { rng, gaussian };

/** An orthonormal Q whose third column is the unit vector k (k must be unit). */
export function frameWithZ(k: Vec): Mat {
  const b = Math.acos(Math.max(-1, Math.min(1, k[2])));
  const a = Math.atan2(k[1], k[0]);
  return matMul(Rz(a), Ry(b));
}

/** The rotation by θ about unit axis k, built without Rodrigues: conjugate a z-rotation. */
export function rotAbout(k: Vec, theta: number): Mat {
  const Q = frameWithZ(k);
  return matMul(matMul(Q, Rz(theta)), transpose(Q));
}

export function randomUnit(u: () => number): Vec {
  const g = gaussian(u);
  const v = [g(), g(), g()];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / n);
}

export function expectRotation(R: Mat, tol = 1e-9) {
  const err = matDist(matMul(transpose(R), R), eye(3));
  if (err > tol) throw new Error(`RᵀR is not I (‖RᵀR − I‖ = ${err})`);
  const d = det(R);
  if (Math.abs(d - 1) > tol) throw new Error(`det R = ${d}, expected 1`);
}

/** Lower Cholesky factor of an SPD matrix. */
export function cholesky(A: Mat): Mat {
  const n = A.length;
  const L: Mat = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
    }
  return L;
}

/** Draw N samples from N(mu, Sigma). */
export function sampleGaussian(mu: Vec, Sigma: Mat, N: number, u: () => number): Vec[] {
  const L = cholesky(Sigma);
  const g = gaussian(u);
  const out: Vec[] = [];
  for (let s = 0; s < N; s++) {
    const e = mu.map(() => g());
    out.push(mu.map((m, i) => m + L[i].reduce((acc, l, k) => acc + l * e[k], 0)));
  }
  return out;
}

export function sampleMeanCov(xs: Vec[]): { mean: Vec; cov: Mat } {
  const n = xs[0].length;
  const mean = new Array(n).fill(0);
  for (const x of xs) for (let i = 0; i < n; i++) mean[i] += x[i] / xs.length;
  const cov: Mat = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const x of xs) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cov[i][j] += ((x[i] - mean[i]) * (x[j] - mean[j])) / (xs.length - 1);
  return { mean, cov };
}

export function expectMatClose(A: Mat, B: Mat, tol: number, what = "matrix") {
  const d = matDist(A, B);
  if (!(d <= tol)) throw new Error(`${what}: ‖A − B‖ = ${d} > ${tol}`);
}

export function expectVecClose(a: Vec, b: Vec, tol: number, what = "vector") {
  const d = Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  if (!(d <= tol)) throw new Error(`${what}: ‖a − b‖ = ${d} > ${tol} (got [${a.map((v) => v.toFixed(6))}], want [${b.map((v) => v.toFixed(6))}])`);
}
