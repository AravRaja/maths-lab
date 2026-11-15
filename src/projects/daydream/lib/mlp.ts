/*
 * A tiny dense network with a hand-written backward pass and Adam. Plumbing, not a core:
 * the cores decide the *losses* and their gradients; this just moves gradients through weights.
 *
 * Layout: params is one Float32Array; layer l has W (out × in, row-major) then b (out).
 */

export type Act = "tanh" | "relu" | "linear";

export interface MlpSpec {
  sizes: number[];
  /** Activation after each hidden layer; the last layer is always linear. */
  act: Act;
}

export function paramCount(spec: MlpSpec): number {
  let n = 0;
  for (let l = 0; l + 1 < spec.sizes.length; l++) n += spec.sizes[l] * spec.sizes[l + 1] + spec.sizes[l + 1];
  return n;
}

export function initParams(spec: MlpSpec, r: () => number, lastScale = 1): Float32Array {
  const p = new Float32Array(paramCount(spec));
  let o = 0;
  const L = spec.sizes.length - 1;
  for (let l = 0; l < L; l++) {
    const fin = spec.sizes[l];
    const fout = spec.sizes[l + 1];
    const s = Math.sqrt((spec.act === "relu" ? 2 : 1) / fin) * (l === L - 1 ? lastScale : 1);
    for (let i = 0; i < fin * fout; i++) {
      const u = Math.max(r(), 1e-12);
      p[o++] = s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
    }
    o += fout; // biases start at 0
  }
  return p;
}

/** Cached activations for one input, needed by backward. */
export interface Tape {
  /** a[0] = input, a[l] = post-activation of layer l (a[L] = output). */
  a: Float32Array[];
  /** The network output (same array as a[a.length − 1]). */
  out: Float32Array;
}

export function forward(spec: MlpSpec, p: Float32Array, x: ArrayLike<number>): Tape {
  const { sizes, act } = spec;
  const L = sizes.length - 1;
  const a: Float32Array[] = [Float32Array.from(x as ArrayLike<number>)];
  let o = 0;
  for (let l = 0; l < L; l++) {
    const fin = sizes[l];
    const fout = sizes[l + 1];
    const inp = a[l];
    const out = new Float32Array(fout);
    const bo = o + fin * fout;
    for (let j = 0; j < fout; j++) {
      let s = p[bo + j];
      const row = o + j * fin;
      for (let i = 0; i < fin; i++) s += p[row + i] * inp[i];
      out[j] = l === L - 1 || act === "linear" ? s : act === "tanh" ? Math.tanh(s) : s > 0 ? s : 0;
    }
    a.push(out);
    o = bo + fout;
  }
  return { a, out: a[a.length - 1] };
}

/**
 * Accumulate dLoss/dparams into `grad` given dLoss/doutput; returns dLoss/dinput.
 * Set `needInput` false to skip the last (input) gradient.
 */
export function backward(spec: MlpSpec, p: Float32Array, tape: Tape, dout: ArrayLike<number>, grad: Float32Array, needInput = true): Float32Array {
  const { sizes, act } = spec;
  const L = sizes.length - 1;
  const offs: number[] = [];
  let o = 0;
  for (let l = 0; l < L; l++) {
    offs.push(o);
    o += sizes[l] * sizes[l + 1] + sizes[l + 1];
  }
  let d = Float32Array.from(dout as ArrayLike<number>);
  for (let l = L - 1; l >= 0; l--) {
    const fin = sizes[l];
    const fout = sizes[l + 1];
    const out = tape.a[l + 1];
    if (l !== L - 1 && act !== "linear") {
      for (let j = 0; j < fout; j++) d[j] *= act === "tanh" ? 1 - out[j] * out[j] : out[j] > 0 ? 1 : 0;
    }
    const inp = tape.a[l];
    const w = offs[l];
    const bo = w + fin * fout;
    const needD = l > 0 || needInput;
    const din = needD ? new Float32Array(fin) : null;
    for (let j = 0; j < fout; j++) {
      const dj = d[j];
      if (dj === 0) continue;
      grad[bo + j] += dj;
      const row = w + j * fin;
      for (let i = 0; i < fin; i++) {
        grad[row + i] += dj * inp[i];
        if (din) din[i] += dj * p[row + i];
      }
    }
    d = din ?? new Float32Array(0);
  }
  return d;
}

export interface AdamState {
  m: Float32Array;
  v: Float32Array;
  t: number;
}

export function adamInit(n: number): AdamState {
  return { m: new Float32Array(n), v: new Float32Array(n), t: 0 };
}

/** In-place Adam step on params, with global-norm clipping. */
export function adamStep(p: Float32Array, g: Float32Array, s: AdamState, lr: number, clip = 5, b1 = 0.9, b2 = 0.999): void {
  let nrm = 0;
  for (let i = 0; i < g.length; i++) nrm += g[i] * g[i];
  nrm = Math.sqrt(nrm);
  const scale = nrm > clip ? clip / nrm : 1;
  s.t++;
  const c1 = 1 - b1 ** s.t;
  const c2 = 1 - b2 ** s.t;
  for (let i = 0; i < p.length; i++) {
    const gi = g[i] * scale;
    s.m[i] = b1 * s.m[i] + (1 - b1) * gi;
    s.v[i] = b2 * s.v[i] + (1 - b2) * gi * gi;
    p[i] -= (lr * (s.m[i] / c1)) / (Math.sqrt(s.v[i] / c2) + 1e-8);
  }
}
