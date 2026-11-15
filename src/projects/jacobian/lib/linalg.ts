/*
 * Small dense linear algebra on plain nested arrays (row-major number[][]).
 * Plumbing, not a core: the cores may use these freely. Pure and worker-safe.
 */

export type Vec = number[];
export type Mat = number[][];

export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0));
export const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const clone = (A: Mat): Mat => A.map((r) => r.slice());

export function transpose(A: Mat): Mat {
  const r = A.length;
  const c = r ? A[0].length : 0;
  const out = zeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = A[i][j];
  return out;
}

export function matMul(A: Mat, B: Mat): Mat {
  const n = A.length;
  const k = B.length;
  const m = k ? B[0].length : 0;
  if (n && A[0].length !== k) throw new Error(`matMul: ${n}x${A[0].length} times ${k}x${m}`);
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i];
    const Oi = out[i];
    for (let p = 0; p < k; p++) {
      const a = Ai[p];
      if (a === 0) continue;
      const Bp = B[p];
      for (let j = 0; j < m; j++) Oi[j] += a * Bp[j];
    }
  }
  return out;
}

/** A B C ... left to right. */
export const chain = (...Ms: Mat[]): Mat => Ms.reduce((acc, M) => matMul(acc, M));

export function matVec(A: Mat, x: Vec): Vec {
  return A.map((row) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    return s;
  });
}

export const matAdd = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v + B[i][j]));
export const matSub = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((v, j) => v - B[i][j]));
export const matScale = (A: Mat, s: number): Mat => A.map((r) => r.map((v) => v * s));
/** (A + Aᵀ) / 2 */
export const symmetrize = (A: Mat): Mat => A.map((r, i) => r.map((v, j) => 0.5 * (v + A[j][i])));

export const add = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]);
export const sub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]);
export const scale = (a: Vec, s: number): Vec => a.map((v) => v * s);
export const dot = (a: Vec, b: Vec): number => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a: Vec): number => Math.sqrt(dot(a, a));
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec): Vec => {
  const n = norm(a);
  return n > 0 ? scale(a, 1 / n) : a.slice();
};
export const lerp = (a: Vec, b: Vec, t: number): Vec => a.map((v, i) => v + (b[i] - v) * t);

/** Frobenius norm of A - B. */
export function matDist(A: Mat, B: Mat): number {
  let s = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) s += (A[i][j] - B[i][j]) ** 2;
  return Math.sqrt(s);
}

export function frob(A: Mat): number {
  let s = 0;
  for (const r of A) for (const v of r) s += v * v;
  return Math.sqrt(s);
}

/** Solve A X = B (B is a matrix) by Gaussian elimination with partial pivoting. Throws if singular. */
export function solveMat(A: Mat, B: Mat): Mat {
  const n = A.length;
  const M = clone(A);
  const X = clone(B);
  const m = X[0]?.length ?? 0;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) throw new Error("solve: matrix is singular");
    [M[c], M[p]] = [M[p], M[c]];
    [X[c], X[p]] = [X[p], X[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
      for (let k = 0; k < m; k++) X[r][k] -= f * X[c][k];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    for (let k = 0; k < m; k++) {
      let s = X[r][k];
      for (let j = r + 1; j < n; j++) s -= M[r][j] * X[j][k];
      X[r][k] = s / M[r][r];
    }
  }
  return X;
}

/** Solve A x = b. */
export const solve = (A: Mat, b: Vec): Vec => solveMat(A, b.map((v) => [v])).map((r) => r[0]);

export const inverse = (A: Mat): Mat => solveMat(A, eye(A.length));

/** Determinant by LU with partial pivoting. */
export function det(A: Mat): number {
  const n = A.length;
  const M = clone(A);
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (M[p][c] === 0) return 0;
    if (p !== c) {
      [M[c], M[p]] = [M[p], M[c]];
      d = -d;
    }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return d;
}

/**
 * Eigen-decomposition of a symmetric matrix by cyclic Jacobi rotations.
 * Returns eigenvalues (descending) and eigenvectors as the COLUMNS of `vectors`.
 */
export function symEig(S: Mat, sweeps = 30): { values: number[]; vectors: Mat } {
  const n = S.length;
  const A = symmetrize(S);
  const V = eye(n);
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
  return {
    values: order.map((i) => A[i][i]),
    vectors: V.map((row) => order.map((i) => row[i])),
  };
}

/** Spectral radius (largest |eigenvalue|) of a square matrix, via Gelfand's formula with repeated squaring. */
export function spectralRadius(A: Mat, iters = 200): number {
  // Gelfand: rho(A) = lim ||A^k||^(1/k). Repeated squaring with renormalisation.
  let M = clone(A);
  let logScale = 0;
  let k = 1;
  for (let i = 0; i < Math.min(iters, 40); i++) {
    const f = frob(M);
    if (f === 0) return 0;
    M = matScale(M, 1 / f);
    logScale = 2 * (logScale + Math.log(f));
    M = matMul(M, M);
    k *= 2;
  }
  return Math.exp((logScale + Math.log(frob(M) || 1e-300)) / k);
}

/** Matrix exponential by scaling and squaring with a Taylor series. Fine for the small, well-scaled systems here. */
export function expm(A: Mat): Mat {
  const n = A.length;
  const f = frob(A);
  const s = Math.max(0, Math.ceil(Math.log2(f || 1)) + 1);
  const As = matScale(A, 1 / 2 ** s);
  let term = eye(n);
  let sum = eye(n);
  for (let k = 1; k < 18; k++) {
    term = matScale(matMul(term, As), 1 / k);
    sum = matAdd(sum, term);
  }
  for (let i = 0; i < s; i++) sum = matMul(sum, sum);
  return sum;
}

// ---- 4x4 homogeneous helpers ------------------------------------------------------------

/** 3x3 rotation block of a 4x4 transform. */
export const rotOf = (T: Mat): Mat => [T[0].slice(0, 3), T[1].slice(0, 3), T[2].slice(0, 3)];
/** Translation column of a 4x4 transform. */
export const posOf = (T: Mat): Vec => [T[0][3], T[1][3], T[2][3]];

/** Pack R (3x3) and p (3) into a 4x4 homogeneous transform. */
export function fromRp(R: Mat, p: Vec): Mat {
  return [
    [R[0][0], R[0][1], R[0][2], p[0]],
    [R[1][0], R[1][1], R[1][2], p[1]],
    [R[2][0], R[2][1], R[2][2], p[2]],
    [0, 0, 0, 1],
  ];
}

export const translation = (p: Vec): Mat => fromRp(eye(3), p);

/** Apply a 4x4 transform to a 3D point. */
export function transformPoint(T: Mat, p: Vec): Vec {
  return [0, 1, 2].map((i) => T[i][0] * p[0] + T[i][1] * p[1] + T[i][2] * p[2] + T[i][3]);
}

/** Skew-symmetric (hat) matrix of a 3-vector: hat(a) b = a × b. */
export const hat = (a: Vec): Mat => [
  [0, -a[2], a[1]],
  [a[2], 0, -a[0]],
  [-a[1], a[0], 0],
];

// Elementary rotations (used for camera maths, scripted targets and tests).
export const Rx = (t: number): Mat => [
  [1, 0, 0],
  [0, Math.cos(t), -Math.sin(t)],
  [0, Math.sin(t), Math.cos(t)],
];
export const Ry = (t: number): Mat => [
  [Math.cos(t), 0, Math.sin(t)],
  [0, 1, 0],
  [-Math.sin(t), 0, Math.cos(t)],
];
export const Rz = (t: number): Mat => [
  [Math.cos(t), -Math.sin(t), 0],
  [Math.sin(t), Math.cos(t), 0],
  [0, 0, 1],
];
