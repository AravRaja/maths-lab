import { gauss, type Rng } from "@/projects/say-and-reach/lib/arm/rng";
import { cloneFilm, FilmAdam, filmBackwardWithInput, filmForward, initFilm, type FilmGrads, type FilmWeights } from "./film";

/*
 * The policy network: word-to-object attention, then a FiLM MLP.
 *
 *  1. Object tokens. Each object on the table is a token e_k = (x, y, x − tip_x, y − tip_y).
 *  2. Attention. The words make a query q = Q w; each object slot has a learned key K_k.
 *       α = softmax(K q / √d),   p = Σ_k α_k e_k
 *     α is "which object the command is about". The page draws it as a glow on the objects.
 *  3. FiLM MLP on [fingertip, extra inputs, p], with the words scaling and shifting hidden layers.
 *     Only the attended token goes up the network, so the policy is object-centric: it cannot be
 *     distracted by the objects the command isn't about.
 *
 * Plumbing, hand-written backprop (checked by finite differences in src/projects/say-and-reach/lib/nn/__tests__).
 */

export const ATTN_DIM = 8;
export const TOKEN_DIM = 4;

export interface PolicyNet {
  /** Number of object tokens, their offset in the state vector, and the state width the caller passes. */
  nTok: number;
  tokOffset: number;
  stateDim: number;
  /** Indices of the state vector passed straight to the MLP (the fingertip, and any extras). */
  keep: number[];
  textDim: number;
  Q: Float32Array; // ATTN_DIM × textDim
  K: Float32Array; // nTok × ATTN_DIM
  film: FilmWeights; // state input = keep.length + TOKEN_DIM
}

export function initPolicyNet(o: { nTok: number; tokOffset: number; stateDim: number; keep: number[]; textDim: number; hidden: number; out: number; outScale?: number }, rng: Rng): PolicyNet {
  const Q = new Float32Array(ATTN_DIM * o.textDim);
  for (let i = 0; i < Q.length; i++) Q[i] = gauss(rng) / Math.sqrt(o.textDim);
  const K = new Float32Array(o.nTok * ATTN_DIM);
  for (let i = 0; i < K.length; i++) K[i] = gauss(rng);
  return { nTok: o.nTok, tokOffset: o.tokOffset, stateDim: o.stateDim, keep: o.keep, textDim: o.textDim, Q, K, film: initFilm([o.keep.length + TOKEN_DIM, o.textDim, o.hidden, o.out], rng, o.outScale ?? 0.1) };
}

export interface NetForward {
  B: number;
  state: Float32Array;
  words: Float32Array;
  q: Float32Array; // B × ATTN_DIM
  alpha: Float32Array; // B × nTok
  filmF: ReturnType<typeof filmForward>;
  out: Float32Array;
}

export function netForward(n: PolicyNet, state: Float32Array, words: Float32Array, B: number): NetForward {
  const { nTok, tokOffset, stateDim, textDim, keep } = n;
  const q = new Float32Array(B * ATTN_DIM);
  const alpha = new Float32Array(B * nTok);
  const P = keep.length;
  const S = P + TOKEN_DIM;
  const fin = new Float32Array(B * S);
  const sc = 1 / Math.sqrt(ATTN_DIM);
  for (let b = 0; b < B; b++) {
    for (let d = 0; d < ATTN_DIM; d++) {
      let acc = 0;
      for (let i = 0; i < textDim; i++) acc += n.Q[d * textDim + i] * words[b * textDim + i];
      q[b * ATTN_DIM + d] = acc;
    }
    let mx = -Infinity;
    const l = new Array<number>(nTok);
    for (let k = 0; k < nTok; k++) {
      let acc = 0;
      for (let d = 0; d < ATTN_DIM; d++) acc += n.K[k * ATTN_DIM + d] * q[b * ATTN_DIM + d];
      l[k] = acc * sc;
      mx = Math.max(mx, l[k]);
    }
    let z = 0;
    for (let k = 0; k < nTok; k++) { l[k] = Math.exp(l[k] - mx); z += l[k]; }
    for (let k = 0; k < nTok; k++) alpha[b * nTok + k] = l[k] / z;
    for (let i = 0; i < P; i++) fin[b * S + i] = state[b * stateDim + keep[i]];
    for (let c = 0; c < TOKEN_DIM; c++) {
      let acc = 0;
      for (let k = 0; k < nTok; k++) acc += alpha[b * nTok + k] * state[b * stateDim + tokOffset + k * TOKEN_DIM + c];
      fin[b * S + P + c] = acc;
    }
  }
  const filmF = filmForward(n.film, fin, words, B);
  return { B, state, words, q, alpha, filmF, out: filmF.out };
}

export interface NetGrads {
  Q: Float32Array;
  K: Float32Array;
  film: FilmGrads;
}

/**
 * Backprop. `attnTarget` (optional, one object index per row) adds a grounding loss
 * aux · CE(α, onehot) / B, so the attention learns which object the words name directly from the
 * demo labels instead of only through the action loss.
 */
export function netBackward(n: PolicyNet, f: NetForward, dOut: Float32Array, attnTarget?: Uint8Array, aux = 1): NetGrads {
  const { nTok, tokOffset, stateDim, textDim } = n;
  const { grads, ds } = filmBackwardWithInput(n.film, f.filmF, dOut);
  const gQ = new Float32Array(n.Q.length), gK = new Float32Array(n.K.length);
  const P = n.keep.length;
  const S = P + TOKEN_DIM;
  const sc = 1 / Math.sqrt(ATTN_DIM);
  for (let b = 0; b < f.B; b++) {
    // dα_k = dp · e_k
    const da = new Array<number>(nTok);
    let dot = 0;
    for (let k = 0; k < nTok; k++) {
      let acc = 0;
      for (let c = 0; c < TOKEN_DIM; c++) acc += ds[b * S + P + c] * f.state[b * stateDim + tokOffset + k * TOKEN_DIM + c];
      da[k] = acc;
      dot += f.alpha[b * nTok + k] * acc;
    }
    // through softmax: dℓ_k = α_k (dα_k − Σ_j α_j dα_j)
    const dq = new Float32Array(ATTN_DIM);
    for (let k = 0; k < nTok; k++) {
      const a = f.alpha[b * nTok + k];
      const ce = attnTarget ? (aux * (a - (attnTarget[b] === k ? 1 : 0))) / f.B : 0;
      const dl = (a * (da[k] - dot) + ce) * sc;
      for (let d = 0; d < ATTN_DIM; d++) {
        gK[k * ATTN_DIM + d] += dl * f.q[b * ATTN_DIM + d];
        dq[d] += dl * n.K[k * ATTN_DIM + d];
      }
    }
    for (let d = 0; d < ATTN_DIM; d++) for (let i = 0; i < textDim; i++) gQ[d * textDim + i] += dq[d] * f.words[b * textDim + i];
  }
  return { Q: gQ, K: gK, film: grads };
}

/** Adam over the attention parameters and the FiLM network. */
export class NetAdam {
  private film: FilmAdam;
  private m: Float32Array[];
  private v: Float32Array[];
  private t = 0;
  constructor(private n: PolicyNet, public lr = 2e-3) {
    this.film = new FilmAdam(n.film, lr);
    this.m = [new Float32Array(n.Q.length), new Float32Array(n.K.length)];
    this.v = [new Float32Array(n.Q.length), new Float32Array(n.K.length)];
  }
  step(g: NetGrads) {
    this.film.lr = this.lr;
    this.film.step(g.film);
    this.t++;
    const c1 = 1 - 0.9 ** this.t, c2 = 1 - 0.999 ** this.t;
    [[this.n.Q, g.Q], [this.n.K, g.K]].forEach(([P, G], p) => {
      const M = this.m[p], V = this.v[p];
      for (let i = 0; i < P.length; i++) {
        const gi = Math.max(-5, Math.min(5, G[i]));
        M[i] = 0.9 * M[i] + 0.1 * gi;
        V[i] = 0.999 * V[i] + 0.001 * gi * gi;
        P[i] -= (this.lr * (M[i] / c1)) / (Math.sqrt(V[i] / c2) + 1e-8);
      }
    });
  }
}

export function cloneNet(n: PolicyNet): PolicyNet {
  return { ...n, keep: n.keep.slice(), Q: n.Q.slice(), K: n.K.slice(), film: cloneFilm(n.film) };
}
