/**
 * Shared shapes for the rank cores. These are types, not maths: nothing here is yours to write.
 *
 * A Matrix is dense and row-major: entry (i, j) lives at data[i * cols + j].
 * A vector is a plain Float64Array.
 */
export interface Matrix {
  rows: number;
  cols: number;
  /** Row-major, length rows * cols. */
  data: Float64Array;
}

/**
 * A thin singular value decomposition A = U Σ Vᵀ, as returned by the library `svd()` in
 * src/projects/rank/lib/svd.ts.
 *
 *   A: m × n,  r = min(m, n)
 *   U: m × r   orthonormal columns u_1 … u_r   (U.data[i * r + j] = (u_j)_i)
 *   S: r       σ_1 ≥ σ_2 ≥ … ≥ σ_r ≥ 0
 *   V: n × r   orthonormal columns v_1 … v_r
 */
export interface SVD {
  U: Matrix;
  S: Float64Array;
  V: Matrix;
}

/** Result of power iteration for the top singular triple of A. */
export interface PowerResult {
  /** Estimate of σ_1. */
  sigma: number;
  /** Unit vector, length A.rows: estimate of u_1. */
  u: Float64Array;
  /** Unit vector, length A.cols: estimate of v_1. */
  v: Float64Array;
  /** Iterations actually run. */
  iters: number;
  /** The σ estimate after each iteration, history[t - 1] after iteration t. Length = iters. */
  history: number[];
}

/** Principal components of a data matrix whose rows are samples. */
export interface PCA {
  /** Mean sample, length d. */
  mean: Float64Array;
  /** k unit vectors of length d, most important first (the "eigenfaces"). */
  components: Float64Array[];
  /** Variance of the data along each component, length k, descending. */
  variances: number[];
}
