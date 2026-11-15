import type { Matrix, SVD } from "../core/types";
import { zeros } from "./matrix";

/*
 * The "library" SVD: one-sided Jacobi (Hestenes). This is plumbing, not a core. Your cores take
 * its output as given, the same way you would call numpy.linalg.svd. Milestone 4 has you build
 * your own top-k SVD with power iteration and compare against this.
 *
 * Idea (for the curious): rotate pairs of columns of A until every pair is orthogonal. Each
 * rotation is orthogonal, so A V = W with V orthogonal and W's columns mutually orthogonal;
 * then σ_j = ‖w_j‖ and u_j = w_j / σ_j.
 */

export interface SvdOptions {
  /** Called after each sweep with (sweep, off-diagonal measure). */
  onSweep?: (sweep: number, off: number) => void;
  maxSweeps?: number;
  tol?: number;
}

/** Thin SVD of any m × n matrix. U: m × r, S: r (descending), V: n × r, r = min(m, n). */
export function svd(A: Matrix, opts: SvdOptions = {}): SVD {
  if (A.rows >= A.cols) return jacobi(A, opts);
  // Work on Aᵀ = V Σ Uᵀ and swap.
  const At = zeros(A.cols, A.rows);
  for (let i = 0; i < A.rows; i++) for (let j = 0; j < A.cols; j++) At.data[j * A.rows + i] = A.data[i * A.cols + j];
  const t = jacobi(At, opts);
  return { U: t.V, S: t.S, V: t.U };
}

function jacobi(A: Matrix, { onSweep, maxSweeps = 40, tol = 1e-12 }: SvdOptions): SVD {
  const m = A.rows, n = A.cols;
  // Column-major working copies.
  const W: Float64Array[] = Array.from({ length: n }, (_, j) => {
    const c = new Float64Array(m);
    for (let i = 0; i < m; i++) c[i] = A.data[i * n + j];
    return c;
  });
  const Vc: Float64Array[] = Array.from({ length: n }, (_, j) => {
    const c = new Float64Array(n);
    c[j] = 1;
    return c;
  });
  const norms = W.map((c) => sq(c));

  for (let sweep = 1; sweep <= maxSweeps; sweep++) {
    let off = 0;
    let rotated = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const a = norms[p], b = norms[q];
        if (a === 0 || b === 0) continue;
        const wp = W[p], wq = W[q];
        let g = 0;
        for (let i = 0; i < m; i++) g += wp[i] * wq[i];
        const rel = Math.abs(g) / Math.sqrt(a * b);
        if (rel > off) off = rel;
        if (rel <= tol) continue;
        rotated++;
        const zeta = (b - a) / (2 * g);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < m; i++) {
          const x = wp[i], y = wq[i];
          wp[i] = c * x - s * y;
          wq[i] = s * x + c * y;
        }
        const vp = Vc[p], vq = Vc[q];
        for (let i = 0; i < n; i++) {
          const x = vp[i], y = vq[i];
          vp[i] = c * x - s * y;
          vq[i] = s * x + c * y;
        }
        norms[p] = sq(wp);
        norms[q] = sq(wq);
      }
    }
    onSweep?.(sweep, off);
    if (rotated === 0) break;
  }

  const order = Array.from({ length: n }, (_, j) => j).sort((x, y) => norms[y] - norms[x]);
  const r = n;
  const U = zeros(m, r), V = zeros(n, r), S = new Float64Array(r);
  const smax = Math.sqrt(norms[order[0]] ?? 0);
  const us: Float64Array[] = [];
  for (let k = 0; k < r; k++) {
    const j = order[k];
    const sigma = Math.sqrt(norms[j]);
    let u: Float64Array;
    if (sigma > Math.max(1e-300, smax * 1e-13)) {
      u = W[j].map((x) => x / sigma);
      S[k] = sigma;
    } else {
      u = completeBasis(us, m, k);
      S[k] = 0;
    }
    let v = Vc[j];
    // Sign convention: make u's entries sum to ≥ 0 (so layer 1 of a photo is a positive image).
    let su = 0;
    for (let i = 0; i < m; i++) su += u[i];
    if (su < 0) {
      u = u.map((x) => -x);
      v = v.map((x) => -x);
    }
    us.push(u);
    for (let i = 0; i < m; i++) U.data[i * r + k] = u[i];
    for (let i = 0; i < n; i++) V.data[i * r + k] = v[i];
  }
  return { U, S, V };
}

function sq(c: Float64Array): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) s += c[i] * c[i];
  return s;
}

/** A unit vector orthogonal to `basis` (for zero singular values), via Gram–Schmidt on e_i. */
function completeBasis(basis: Float64Array[], m: number, start: number): Float64Array {
  for (let e = 0; e < m; e++) {
    const v = new Float64Array(m);
    v[(e + start) % m] = 1;
    for (let pass = 0; pass < 2; pass++)
      for (const b of basis) {
        let d = 0;
        for (let i = 0; i < m; i++) d += b[i] * v[i];
        for (let i = 0; i < m; i++) v[i] -= d * b[i];
      }
    const nn = Math.sqrt(sq(v));
    if (nn > 1e-6) return v.map((x) => x / nn);
  }
  return new Float64Array(m);
}

/** Column j of U (or V) as a vector. */
export function factorColumn(F: Matrix, j: number): Float64Array {
  const out = new Float64Array(F.rows);
  for (let i = 0; i < F.rows; i++) out[i] = F.data[i * F.cols + j];
  return out;
}

/**
 * The i-th rank-one layer σ_i u_i v_iᵀ, for display (the layers strip and the hero). Your
 * rankK() is the part that decides which layers to keep and adds them up.
 */
export function layer(s: SVD, i: number): Matrix {
  const m = s.U.rows, n = s.V.rows, r = s.S.length;
  const out = zeros(m, n);
  const sig = s.S[i];
  for (let a = 0; a < m; a++) {
    const ua = s.U.data[a * r + i] * sig;
    const o = a * n;
    for (let b = 0; b < n; b++) out.data[o + b] = ua * s.V.data[b * r + i];
  }
  return out;
}
