import { gauss, type Rng } from "@/projects/say-and-reach/lib/arm/rng";

/*
 * A FiLM-conditioned MLP (Perez et al., 2018; the trick RT-1 uses to let words steer vision).
 * The state goes up the network; the command never mixes in by concatenation. Instead each
 * hidden layer is scaled and shifted by the words:
 *
 *   h1 = tanh( (W1 s + b1) ⊙ (1 + γ1(w)) + β1(w) )
 *   h2 = tanh( (W2 h1 + b2) ⊙ (1 + γ2(w)) + β2(w) )
 *   out = W3 h2 + b3,        [γ1 β1 γ2 β2] = F w + f
 *
 * Multiplicative gating is what lets "cube" switch on cube-shaped features and "ball" switch
 * them off, which a plain concatenation MLP learns very slowly. Plumbing: hand-written
 * backprop, checked by a finite-difference test in src/projects/say-and-reach/lib/nn/__tests__.
 */

export interface FilmWeights {
  /** [state dim, text dim, hidden, out] */
  dims: [number, number, number, number];
  W1: Float32Array; b1: Float32Array;
  F: Float32Array; f: Float32Array;
  W2: Float32Array; b2: Float32Array;
  W3: Float32Array; b3: Float32Array;
}

const PARAMS = ["W1", "b1", "F", "f", "W2", "b2", "W3", "b3"] as const;
type ParamName = (typeof PARAMS)[number];
export type FilmGrads = Record<ParamName, Float32Array>;

function randn(n: number, scale: number, rng: Rng) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = gauss(rng) * scale;
  return a;
}

export function initFilm(dims: [number, number, number, number], rng: Rng, outScale = 0.1): FilmWeights {
  const [S, T, H, O] = dims;
  return {
    dims,
    W1: randn(H * S, 1 / Math.sqrt(S), rng), b1: new Float32Array(H),
    F: randn(4 * H * T, 0.5 / Math.sqrt(T), rng), f: new Float32Array(4 * H),
    W2: randn(H * H, 1 / Math.sqrt(H), rng), b2: new Float32Array(H),
    W3: randn(O * H, outScale / Math.sqrt(H), rng), b3: new Float32Array(O),
  };
}

export interface FilmForward {
  s: Float32Array; w: Float32Array; B: number;
  film: Float32Array; // B × 4H
  z1: Float32Array; h1: Float32Array;
  z2: Float32Array; h2: Float32Array;
  out: Float32Array;
}

/** y = W x + b for every row. W is nout × nin row-major. Skips zero inputs (word codes are sparse). */
function affine(W: Float32Array, b: Float32Array, x: Float32Array, B: number, nin: number, nout: number): Float32Array {
  const y = new Float32Array(B * nout);
  const idx = new Int32Array(nin);
  for (let n = 0; n < B; n++) {
    const xo = n * nin, yo = n * nout;
    let nz = 0;
    for (let i = 0; i < nin; i++) if (x[xo + i] !== 0) idx[nz++] = i;
    for (let j = 0; j < nout; j++) {
      let acc = b[j];
      const wo = j * nin;
      for (let k = 0; k < nz; k++) acc += W[wo + idx[k]] * x[xo + idx[k]];
      y[yo + j] = acc;
    }
  }
  return y;
}

/** dW += δᵀ x, db += Σ δ, and (optionally) returns δ W. */
function affineBack(W: Float32Array, x: Float32Array, d: Float32Array, B: number, nin: number, nout: number, dW: Float32Array, db: Float32Array, wantDx: boolean) {
  const dx = wantDx ? new Float32Array(B * nin) : null;
  const idx = new Int32Array(nin);
  for (let n = 0; n < B; n++) {
    const xo = n * nin, dofs = n * nout;
    let nz = 0;
    if (!dx) for (let i = 0; i < nin; i++) if (x[xo + i] !== 0) idx[nz++] = i;
    for (let j = 0; j < nout; j++) {
      const g = d[dofs + j];
      if (g === 0) continue;
      db[j] += g;
      const wo = j * nin;
      if (dx) {
        for (let i = 0; i < nin; i++) {
          dW[wo + i] += g * x[xo + i];
          dx[xo + i] += g * W[wo + i];
        }
      } else {
        for (let k = 0; k < nz; k++) dW[wo + idx[k]] += g * x[xo + idx[k]];
      }
    }
  }
  return dx;
}

export function filmForward(m: FilmWeights, s: Float32Array, w: Float32Array, B: number): FilmForward {
  const [S, T, H, O] = m.dims;
  const film = affine(m.F, m.f, w, B, T, 4 * H);
  const z1 = affine(m.W1, m.b1, s, B, S, H);
  const h1 = new Float32Array(B * H);
  for (let n = 0; n < B; n++)
    for (let j = 0; j < H; j++) h1[n * H + j] = Math.tanh(z1[n * H + j] * (1 + film[n * 4 * H + j]) + film[n * 4 * H + H + j]);
  const z2 = affine(m.W2, m.b2, h1, B, H, H);
  const h2 = new Float32Array(B * H);
  for (let n = 0; n < B; n++)
    for (let j = 0; j < H; j++) h2[n * H + j] = Math.tanh(z2[n * H + j] * (1 + film[n * 4 * H + 2 * H + j]) + film[n * 4 * H + 3 * H + j]);
  const out = affine(m.W3, m.b3, h2, B, H, O);
  return { s, w, B, film, z1, h1, z2, h2, out };
}

export function filmBackward(m: FilmWeights, f: FilmForward, dOut: Float32Array): FilmGrads {
  return filmBackwardWithInput(m, f, dOut).grads;
}

/** Backprop that also returns ∂loss/∂s, for layers that feed the state input (attention). */
export function filmBackwardWithInput(m: FilmWeights, f: FilmForward, dOut: Float32Array): { grads: FilmGrads; ds: Float32Array } {
  const [S, T, H, O] = m.dims;
  const B = f.B;
  const g = Object.fromEntries(PARAMS.map((p) => [p, new Float32Array(m[p].length)])) as FilmGrads;
  const dFilm = new Float32Array(B * 4 * H);
  const dh2 = affineBack(m.W3, f.h2, dOut, B, H, O, g.W3, g.b3, true)!;
  const dz2 = new Float32Array(B * H);
  for (let n = 0; n < B; n++)
    for (let j = 0; j < H; j++) {
      const k = n * H + j, fo = n * 4 * H;
      const da = dh2[k] * (1 - f.h2[k] * f.h2[k]); // through tanh
      dz2[k] = da * (1 + f.film[fo + 2 * H + j]);
      dFilm[fo + 2 * H + j] = da * f.z2[k];
      dFilm[fo + 3 * H + j] = da;
    }
  const dh1 = affineBack(m.W2, f.h1, dz2, B, H, H, g.W2, g.b2, true)!;
  const dz1 = new Float32Array(B * H);
  for (let n = 0; n < B; n++)
    for (let j = 0; j < H; j++) {
      const k = n * H + j, fo = n * 4 * H;
      const da = dh1[k] * (1 - f.h1[k] * f.h1[k]);
      dz1[k] = da * (1 + f.film[fo + j]);
      dFilm[fo + j] = da * f.z1[k];
      dFilm[fo + H + j] = da;
    }
  const ds = affineBack(m.W1, f.s, dz1, B, S, H, g.W1, g.b1, true)!;
  affineBack(m.F, f.w, dFilm, B, T, 4 * H, g.F, g.f, false);
  return { grads: g, ds };
}

export class FilmAdam {
  private m: Float32Array[];
  private v: Float32Array[];
  private t = 0;
  constructor(private w: FilmWeights, public lr = 2e-3, private b1 = 0.9, private b2 = 0.999, private eps = 1e-8) {
    this.m = PARAMS.map((p) => new Float32Array(w[p].length));
    this.v = PARAMS.map((p) => new Float32Array(w[p].length));
  }
  step(g: FilmGrads, clip = 5) {
    this.t++;
    let norm = 0;
    for (const p of PARAMS) for (const x of g[p]) norm += x * x;
    const scale = Math.sqrt(norm) > clip ? clip / Math.sqrt(norm) : 1;
    const c1 = 1 - this.b1 ** this.t, c2 = 1 - this.b2 ** this.t;
    PARAMS.forEach((p, k) => {
      const P = this.w[p], G = g[p], M = this.m[k], V = this.v[k];
      for (let i = 0; i < P.length; i++) {
        const gi = G[i] * scale;
        M[i] = this.b1 * M[i] + (1 - this.b1) * gi;
        V[i] = this.b2 * V[i] + (1 - this.b2) * gi * gi;
        P[i] -= (this.lr * (M[i] / c1)) / (Math.sqrt(V[i] / c2) + this.eps);
      }
    });
  }
}

export function cloneFilm(m: FilmWeights): FilmWeights {
  const out = { dims: [...m.dims] } as FilmWeights;
  for (const p of PARAMS) out[p] = m[p].slice();
  return out;
}

/** Single-row forward for rollouts. */
export function filmForward1(m: FilmWeights, s: Float32Array, w: Float32Array): Float32Array {
  return filmForward(m, s, w, 1).out;
}
