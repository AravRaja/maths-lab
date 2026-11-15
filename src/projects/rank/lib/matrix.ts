import type { Matrix } from "../core/types";

/*
 * Plain dense-matrix plumbing. Not a core: use these freely inside your cores.
 * Row-major everywhere: (i, j) -> data[i * cols + j].
 */

export function zeros(rows: number, cols: number): Matrix {
  return { rows, cols, data: new Float64Array(rows * cols) };
}

export function fromRows(rows: number[][]): Matrix {
  const m = rows.length;
  const n = m ? rows[0].length : 0;
  const out = zeros(m, n);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out.data[i * n + j] = rows[i][j];
  return out;
}

export function toRows(A: Matrix): number[][] {
  return Array.from({ length: A.rows }, (_, i) => Array.from(A.data.subarray(i * A.cols, (i + 1) * A.cols)));
}

export function clone(A: Matrix): Matrix {
  return { rows: A.rows, cols: A.cols, data: new Float64Array(A.data) };
}

export function get(A: Matrix, i: number, j: number): number {
  return A.data[i * A.cols + j];
}

export function transpose(A: Matrix): Matrix {
  const out = zeros(A.cols, A.rows);
  for (let i = 0; i < A.rows; i++) for (let j = 0; j < A.cols; j++) out.data[j * A.rows + i] = A.data[i * A.cols + j];
  return out;
}

export function matmul(A: Matrix, B: Matrix): Matrix {
  if (A.cols !== B.rows) throw new Error(`matmul: ${A.rows}x${A.cols} times ${B.rows}x${B.cols}`);
  const out = zeros(A.rows, B.cols);
  const n = B.cols;
  for (let i = 0; i < A.rows; i++) {
    for (let k = 0; k < A.cols; k++) {
      const a = A.data[i * A.cols + k];
      if (a === 0) continue;
      const bo = k * n, oo = i * n;
      for (let j = 0; j < n; j++) out.data[oo + j] += a * B.data[bo + j];
    }
  }
  return out;
}

/** A x, x of length A.cols. */
export function matvec(A: Matrix, x: ArrayLike<number>): Float64Array {
  const out = new Float64Array(A.rows);
  for (let i = 0; i < A.rows; i++) {
    let s = 0;
    const o = i * A.cols;
    for (let j = 0; j < A.cols; j++) s += A.data[o + j] * x[j];
    out[i] = s;
  }
  return out;
}

/** Aᵀ y, y of length A.rows. */
export function matTvec(A: Matrix, y: ArrayLike<number>): Float64Array {
  const out = new Float64Array(A.cols);
  for (let i = 0; i < A.rows; i++) {
    const yi = y[i];
    if (yi === 0) continue;
    const o = i * A.cols;
    for (let j = 0; j < A.cols; j++) out[j] += A.data[o + j] * yi;
  }
  return out;
}

/** Column j as a fresh vector. */
export function column(A: Matrix, j: number): Float64Array {
  const out = new Float64Array(A.rows);
  for (let i = 0; i < A.rows; i++) out[i] = A.data[i * A.cols + j];
  return out;
}

/** Row i as a view (no copy). */
export function row(A: Matrix, i: number): Float64Array {
  return A.data.subarray(i * A.cols, (i + 1) * A.cols);
}

export function dotv(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function normv(a: ArrayLike<number>): number {
  return Math.sqrt(dotv(a, a));
}

/** Matrix from its columns (each of length rows). */
export function fromColumns(cols: ArrayLike<number>[], rows: number): Matrix {
  const out = zeros(rows, cols.length);
  for (let j = 0; j < cols.length; j++) for (let i = 0; i < rows; i++) out.data[i * cols.length + j] = cols[j][i];
  return out;
}

/** Plain-object copy that survives postMessage (typed arrays clone fine; this just documents intent). */
export function serial(A: Matrix): Matrix {
  return { rows: A.rows, cols: A.cols, data: A.data };
}
