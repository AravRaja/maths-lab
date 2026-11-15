/*
 * Central finite differences. The PPO loss is written by the user as plain scalar functions of the
 * policy's logits and the critic's value; their gradient with respect to those few head outputs
 * is taken numerically here, then backprop (plumbing) carries it through the network.
 */
export function numericGrad(f: (x: number[]) => number, x: number[], h = 1e-5): number[] {
  const g = new Array<number>(x.length);
  const y = x.slice();
  for (let i = 0; i < x.length; i++) {
    y[i] = x[i] + h;
    const up = f(y);
    y[i] = x[i] - h;
    const dn = f(y);
    y[i] = x[i];
    g[i] = (up - dn) / (2 * h);
  }
  return g;
}
