import { gaussian, type Rng } from "./rng";

/*
 * A tiny fully connected network with tanh hidden layers and a linear output, stored as one flat
 * Float64Array so weights post to and from the worker cheaply. Backprop and Adam are plumbing:
 * the maths the user writes is the per-sample loss these gradients flow from.
 */

export interface Mlp {
  sizes: number[];
  params: Float64Array;
}

export interface MlpCache {
  /** Activations per layer, including the input (acts[0]) and the output (acts[L]). */
  acts: Float64Array[];
}

function layerOffsets(sizes: number[]) {
  const offs: { w: number; b: number; nin: number; nout: number }[] = [];
  let o = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    const nin = sizes[l], nout = sizes[l + 1];
    offs.push({ w: o, b: o + nin * nout, nin, nout });
    o += nin * nout + nout;
  }
  return { offs, total: o };
}

const OFFSETS = new Map<string, ReturnType<typeof layerOffsets>>();
function offsetsFor(sizes: number[]) {
  const k = sizes.join(",");
  let v = OFFSETS.get(k);
  if (!v) OFFSETS.set(k, (v = layerOffsets(sizes)));
  return v;
}

export function paramCount(sizes: number[]): number {
  return offsetsFor(sizes).total;
}

/** Scaled Gaussian init; the last layer is scaled by `outScale` (small for a policy, so it starts uniform). */
export function createMlp(sizes: number[], rng: Rng, outScale = 1): Mlp {
  const { offs, total } = offsetsFor(sizes);
  const params = new Float64Array(total);
  offs.forEach((L, i) => {
    const scale = (i === offs.length - 1 ? outScale : Math.SQRT2) / Math.sqrt(L.nin);
    for (let j = 0; j < L.nin * L.nout; j++) params[L.w + j] = gaussian(rng) * scale;
  });
  return { sizes, params };
}

export function forward(net: Mlp, x: ArrayLike<number>, cache?: MlpCache): Float64Array {
  const { offs } = offsetsFor(net.sizes);
  const p = net.params;
  let a = Float64Array.from(x as ArrayLike<number>);
  if (cache) cache.acts = [a];
  for (let l = 0; l < offs.length; l++) {
    const L = offs[l];
    const out = new Float64Array(L.nout);
    const last = l === offs.length - 1;
    for (let o = 0; o < L.nout; o++) {
      let s = p[L.b + o];
      const row = L.w + o * L.nin;
      for (let i = 0; i < L.nin; i++) s += p[row + i] * a[i];
      out[o] = last ? s : Math.tanh(s);
    }
    a = out;
    if (cache) cache.acts.push(a);
  }
  return a;
}

/** Accumulate dLoss/dparams into `grad` given dLoss/doutput. */
export function backward(net: Mlp, cache: MlpCache, dOut: ArrayLike<number>, grad: Float64Array): void {
  const { offs } = offsetsFor(net.sizes);
  const p = net.params;
  let d = Float64Array.from(dOut as ArrayLike<number>);
  for (let l = offs.length - 1; l >= 0; l--) {
    const L = offs[l];
    const ain = cache.acts[l];
    const dIn = new Float64Array(L.nin);
    for (let o = 0; o < L.nout; o++) {
      const g = d[o];
      if (g === 0) continue;
      grad[L.b + o] += g;
      const row = L.w + o * L.nin;
      for (let i = 0; i < L.nin; i++) {
        grad[row + i] += g * ain[i];
        dIn[i] += g * p[row + i];
      }
    }
    if (l > 0) for (let i = 0; i < L.nin; i++) dIn[i] *= 1 - ain[i] * ain[i]; // tanh'
    d = dIn;
  }
}

/** Adam with optional global-norm clipping. */
export class Adam {
  private m: Float64Array;
  private v: Float64Array;
  private t = 0;
  constructor(n: number, public lr: number, private b1 = 0.9, private b2 = 0.999, private eps = 1e-8) {
    this.m = new Float64Array(n);
    this.v = new Float64Array(n);
  }
  step(params: Float64Array, grad: Float64Array): void {
    this.t++;
    const { b1, b2, eps, lr, m, v } = this;
    const c1 = 1 - b1 ** this.t, c2 = 1 - b2 ** this.t;
    for (let i = 0; i < params.length; i++) {
      m[i] = b1 * m[i] + (1 - b1) * grad[i];
      v[i] = b2 * v[i] + (1 - b2) * grad[i] * grad[i];
      params[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + eps);
    }
  }
}

/** Scale `grads` together so their joint L2 norm is at most maxNorm. Returns the norm before clipping. */
export function clipGlobalNorm(grads: Float64Array[], maxNorm: number): number {
  let s = 0;
  for (const g of grads) for (let i = 0; i < g.length; i++) s += g[i] * g[i];
  const norm = Math.sqrt(s);
  if (norm > maxNorm && norm > 0) {
    const k = maxNorm / norm;
    for (const g of grads) for (let i = 0; i < g.length; i++) g[i] *= k;
  }
  return norm;
}
