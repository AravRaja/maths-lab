/**
 * A small multilayer perceptron with SiLU activations, hand-written backprop and Adam.
 * Plumbing for the velocity network v_θ(x, t, c): the maths cores are the path, the loss
 * and its gradient with respect to the prediction, the sampler and guidance. This file only
 * pushes ∂L/∂prediction back into the weights.
 *
 * Layout: params = [W₀ (out×in, row-major), b₀, W₁, b₁, …] as one Float32Array.
 */

import type { Rng } from "./rng";
import { gauss } from "./rng";

export interface MLP {
  sizes: number[];
  params: Float32Array;
}

export function paramCount(sizes: number[]): number {
  let n = 0;
  for (let l = 0; l < sizes.length - 1; l++) n += sizes[l + 1] * sizes[l] + sizes[l + 1];
  return n;
}

export function initMLP(sizes: number[], rng: Rng, lastScale = 0.1): MLP {
  const params = new Float32Array(paramCount(sizes));
  let o = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    const fin = sizes[l];
    const fout = sizes[l + 1];
    const s = (l === sizes.length - 2 ? lastScale : 1) * Math.sqrt(2 / fin);
    for (let i = 0; i < fout * fin; i++) params[o++] = gauss(rng) * s;
    o += fout; // biases start at 0
  }
  return { sizes, params };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export interface Cache {
  B: number;
  /** Pre-activations per layer (z), and activations (a), a[0] = input. */
  z: Float32Array[];
  a: Float32Array[];
}

/** Forward a batch. X is (B × sizes[0]). Returns (B × sizes[last]) and the cache for backward. */
export function forward(net: MLP, X: Float32Array, B: number): { out: Float32Array; cache: Cache } {
  const { sizes, params } = net;
  const a: Float32Array[] = [X];
  const z: Float32Array[] = [];
  let o = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    const fin = sizes[l];
    const fout = sizes[l + 1];
    const W = o;
    const bias = o + fout * fin;
    o = bias + fout;
    const prev = a[l];
    const zl = new Float32Array(B * fout);
    for (let b = 0; b < B; b++) {
      const pi = b * fin;
      const zi = b * fout;
      for (let j = 0; j < fout; j++) {
        let s = params[bias + j];
        const wj = W + j * fin;
        for (let i = 0; i < fin; i++) s += params[wj + i] * prev[pi + i];
        zl[zi + j] = s;
      }
    }
    z.push(zl);
    if (l < sizes.length - 2) {
      const al = new Float32Array(B * fout);
      for (let i = 0; i < al.length; i++) al[i] = zl[i] * sigmoid(zl[i]);
      a.push(al);
    } else a.push(zl);
  }
  return { out: a[a.length - 1], cache: { B, z, a } };
}

/** Backprop dL/dout (B × outDim) to dL/dparams. */
export function backward(net: MLP, cache: Cache, dOut: Float32Array): Float32Array {
  const { sizes, params } = net;
  const grads = new Float32Array(params.length);
  const { B, z, a } = cache;
  const offsets: number[] = [];
  let o = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    offsets.push(o);
    o += sizes[l + 1] * sizes[l] + sizes[l + 1];
  }
  let delta = dOut; // dL/dz for the current layer
  for (let l = sizes.length - 2; l >= 0; l--) {
    const fin = sizes[l];
    const fout = sizes[l + 1];
    const W = offsets[l];
    const bias = W + fout * fin;
    const prev = a[l];
    for (let b = 0; b < B; b++) {
      const di = b * fout;
      const pi = b * fin;
      for (let j = 0; j < fout; j++) {
        const d = delta[di + j];
        if (d === 0) continue;
        grads[bias + j] += d;
        const wj = W + j * fin;
        for (let i = 0; i < fin; i++) grads[wj + i] += d * prev[pi + i];
      }
    }
    if (l === 0) break;
    const zp = z[l - 1];
    const next = new Float32Array(B * fin);
    for (let b = 0; b < B; b++) {
      const di = b * fout;
      const ni = b * fin;
      for (let j = 0; j < fout; j++) {
        const d = delta[di + j];
        if (d === 0) continue;
        const wj = W + j * fin;
        for (let i = 0; i < fin; i++) next[ni + i] += d * params[wj + i];
      }
      for (let i = 0; i < fin; i++) {
        const zz = zp[ni + i];
        const s = sigmoid(zz);
        next[ni + i] *= s * (1 + zz * (1 - s));
      }
    }
    delta = next;
  }
  return grads;
}

export class Adam {
  private m: Float32Array;
  private v: Float32Array;
  private t = 0;
  constructor(n: number, public lr = 2e-3, private b1 = 0.9, private b2 = 0.999, private eps = 1e-8) {
    this.m = new Float32Array(n);
    this.v = new Float32Array(n);
  }
  step(params: Float32Array, grads: Float32Array, clip = 5): void {
    this.t++;
    let norm = 0;
    for (let i = 0; i < grads.length; i++) norm += grads[i] * grads[i];
    norm = Math.sqrt(norm);
    const k = norm > clip ? clip / norm : 1;
    const c1 = 1 - this.b1 ** this.t;
    const c2 = 1 - this.b2 ** this.t;
    for (let i = 0; i < params.length; i++) {
      const g = grads[i] * k;
      this.m[i] = this.b1 * this.m[i] + (1 - this.b1) * g;
      this.v[i] = this.b2 * this.v[i] + (1 - this.b2) * g * g;
      params[i] -= (this.lr * (this.m[i] / c1)) / (Math.sqrt(this.v[i] / c2) + this.eps);
    }
  }
}
