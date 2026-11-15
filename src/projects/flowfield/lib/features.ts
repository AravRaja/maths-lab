/**
 * Network inputs. Plumbing: how x, t and the context are fed to the MLP.
 * t goes in raw plus a few sin/cos features so the net can bend sharply near t = 1.
 */

export const TIME_FEATURES = 7;

export function timeFeatures(t: number, out: Float32Array, o: number): void {
  out[o] = t * 2 - 1;
  for (let k = 1; k <= 3; k++) {
    out[o + 2 * k - 1] = Math.sin(Math.PI * k * t);
    out[o + 2 * k] = Math.cos(Math.PI * k * t);
  }
}

/** Write [x, γ(t), ctx] into row `row` of a (B × inDim) Float32Array. */
export function writeInput(
  X: Float32Array,
  row: number,
  inDim: number,
  x: ArrayLike<number>,
  t: number,
  ctx: ArrayLike<number> | null,
): void {
  const o = row * inDim;
  for (let i = 0; i < x.length; i++) X[o + i] = x[i];
  timeFeatures(t, X, o + x.length);
  if (ctx) for (let i = 0; i < ctx.length; i++) X[o + x.length + TIME_FEATURES + i] = ctx[i];
}
