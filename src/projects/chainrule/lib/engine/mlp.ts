import { addBackward, mulBackward, powBackward, reluBackward, tanhBackward } from "@/projects/chainrule/core/ops";
import { matmulBackward, type Matrix } from "@/projects/chainrule/core/matmul";
import { Value, runBackward, sumValues } from "./value";
import { gauss, rng } from "./rng";
import type { Dataset } from "./data";

/*
 * A tiny MLP: 2 → H → … → 1, tanh hidden units, linear score s, hinge loss
 *   L = (1/N) Σₙ relu(1 − yₙ sₙ) + α Σ θ²
 * Each layer's weights are one (in+1)×out matrix whose last row is the bias, so both engines
 * (scalar graph and matmul-lite) share the exact same flat parameter vector.
 *
 * Scaffolding only: the forward pass is plain arithmetic. Every derivative comes from the
 * user's cores (ops.ts, backprop.ts, matmul.ts).
 */

export interface LayerShape { rows: number; cols: number; offset: number }

export function layout(sizes: number[]): { layers: LayerShape[]; count: number } {
  const layers: LayerShape[] = [];
  let offset = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    const rows = sizes[l] + 1, cols = sizes[l + 1];
    layers.push({ rows, cols, offset });
    offset += rows * cols;
  }
  return { layers, count: offset };
}

export function initParams(sizes: number[], seed = 1): number[] {
  const r = rng(seed);
  const { layers, count } = layout(sizes);
  const p = new Array<number>(count).fill(0);
  for (const L of layers) {
    const scale = 1 / Math.sqrt(L.rows - 1);
    for (let i = 0; i < L.rows - 1; i++) for (let j = 0; j < L.cols; j++) p[L.offset + i * L.cols + j] = gauss(r) * scale;
  }
  return p;
}

/** Plain-number forward pass: the score s(x). */
export function score(params: ArrayLike<number>, sizes: number[], x0: number, x1: number, scratch?: Float64Array[]): number {
  const { layers } = layout(sizes);
  let h: ArrayLike<number> = [x0, x1];
  for (let l = 0; l < layers.length; l++) {
    const L = layers[l];
    const out = scratch?.[l] ?? new Float64Array(L.cols);
    const inN = L.rows - 1;
    for (let j = 0; j < L.cols; j++) {
      let z = params[L.offset + inN * L.cols + j];
      for (let i = 0; i < inN; i++) z += h[i] * params[L.offset + i * L.cols + j];
      out[j] = l < layers.length - 1 ? Math.tanh(z) : z;
    }
    h = out;
  }
  return h[0];
}

/** Scores on a g×g grid over [-lim, lim]², row-major from the top (y = +lim) down. */
export function scoreGrid(params: ArrayLike<number>, sizes: number[], g: number, lim = 1.6): Float32Array {
  const { layers } = layout(sizes);
  const scratch = layers.map((L) => new Float64Array(L.cols));
  const out = new Float32Array(g * g);
  for (let r = 0; r < g; r++) {
    const y = lim - (2 * lim * (r + 0.5)) / g;
    for (let c = 0; c < g; c++) {
      const x = -lim + (2 * lim * (c + 0.5)) / g;
      out[r * g + c] = score(params, sizes, x, y, scratch);
    }
  }
  return out;
}

export function accuracy(params: ArrayLike<number>, sizes: number[], data: Dataset): number {
  let ok = 0;
  data.x.forEach(([a, b], n) => { if (Math.sign(score(params, sizes, a, b)) === data.y[n]) ok++; });
  return ok / data.x.length;
}

export interface LossGrad { loss: number; grads: number[]; nodes?: number }

/** Loss and gradient through the scalar autograd graph (user's op rules + user's backprop). */
export function lossGradScalar(params: number[], sizes: number[], data: Dataset, alpha: number): LossGrad {
  const { layers } = layout(sizes);
  const P = params.map((p) => Value.leaf(p));
  const margins: Value[] = [];
  data.x.forEach(([a, b], n) => {
    let h: Value[] = [Value.const(a), Value.const(b)];
    layers.forEach((L, l) => {
      const inN = L.rows - 1;
      const next: Value[] = [];
      for (let j = 0; j < L.cols; j++) {
        const terms = h.map((hi, i) => hi.mul(P[L.offset + i * L.cols + j]));
        terms.push(P[L.offset + inN * L.cols + j]);
        const z = sumValues(terms);
        next.push(l < layers.length - 1 ? z.tanh() : z);
      }
      h = next;
    });
    margins.push(h[0].mul(-data.y[n]).add(1).relu());
  });
  const dataLoss = sumValues(margins).mul(1 / data.x.length);
  const loss = alpha > 0 ? dataLoss.add(sumValues(P.map((p) => p.pow(2))).mul(alpha)) : dataLoss;
  const order = runBackward(loss);
  return { loss: loss.data, grads: P.map((p) => p.grad), nodes: order.length };
}

const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => new Array<number>(c).fill(0));

/**
 * Loss and gradient with whole-layer matrix ops. The chain of rules is assembled here, but every
 * derivative in it is the user's: matmulBackward for each layer (the bias rides along as a column
 * of ones), tanhBackward elementwise, and add/mul/relu/pow for the loss.
 */
export function lossGradMatmul(params: number[], sizes: number[], data: Dataset, alpha: number): LossGrad & { layerGrads: Matrix[] } {
  const { layers, count } = layout(sizes);
  const N = data.x.length;
  const W: Matrix[] = layers.map((L) => Array.from({ length: L.rows }, (_, i) => params.slice(L.offset + i * L.cols, L.offset + (i + 1) * L.cols)));

  // Forward, keeping every activation.
  const Ha: Matrix[] = []; // inputs to each layer, with a ones column
  const Z: Matrix[] = [];
  const Hs: Matrix[] = [];
  let H: Matrix = data.x.map(([a, b]) => [a, b]);
  layers.forEach((L, l) => {
    const A = H.map((row) => [...row, 1]);
    Ha.push(A);
    const z = zeros(N, L.cols);
    for (let n = 0; n < N; n++) for (let j = 0; j < L.cols; j++) {
      let s = 0;
      for (let i = 0; i < L.rows; i++) s += A[n][i] * W[l][i][j];
      z[n][j] = s;
    }
    Z.push(z);
    H = l < layers.length - 1 ? z.map((row) => row.map(Math.tanh)) : z;
    Hs.push(H);
  });

  // Loss: m = 1 + (−y)·s, L = (1/N) Σ relu(m) + α Σ θ².
  let loss = 0;
  let G: Matrix = zeros(N, 1);
  for (let n = 0; n < N; n++) {
    const s = H[n][0], ny = -data.y[n];
    const m = 1 + ny * s;
    loss += Math.max(0, m) / N;
    const gm = reluBackward(m, 1 / N);
    const [, gProd] = addBackward(1, ny * s, gm);
    const [, gs] = mulBackward(ny, s, gProd);
    G[n][0] = gs;
  }
  for (const p of params) loss += alpha * p * p;

  // Backward through the layers.
  const layerGrads: Matrix[] = new Array(layers.length);
  for (let l = layers.length - 1; l >= 0; l--) {
    const { dA, dB } = matmulBackward(Ha[l], W[l], G);
    layerGrads[l] = dB.map((row, i) => row.map((v, j) => v + (alpha > 0 ? powBackward(W[l][i][j], 2, alpha) : 0)));
    if (l > 0) {
      const inN = layers[l].rows - 1;
      const prevZ = Z[l - 1], prevH = Hs[l - 1];
      G = dA.map((row, n) => row.slice(0, inN).map((g, i) => tanhBackward(prevZ[n][i], prevH[n][i], g)));
    }
  }

  const grads = new Array<number>(count);
  layers.forEach((L, l) => {
    for (let i = 0; i < L.rows; i++) for (let j = 0; j < L.cols; j++) grads[L.offset + i * L.cols + j] = layerGrads[l][i][j];
  });
  return { loss, grads, layerGrads };
}

/** Split a flat gradient into per-layer matrices (for heatmaps). */
export function splitLayers(flat: number[], sizes: number[]): { rows: number; cols: number; values: number[] }[] {
  return layout(sizes).layers.map((L) => ({ rows: L.rows, cols: L.cols, values: flat.slice(L.offset, L.offset + L.rows * L.cols) }));
}
