import { describe, expect, it } from "vitest";
import { Adam, backward, forward, initMLP } from "../mlp";
import { mulberry32 } from "../rng";

/** Plumbing check: the MLP's hand-written backprop matches finite differences. */
describe("mlp backprop", () => {
  it("matches central differences on a random net", () => {
    const rng = mulberry32(3);
    const net = initMLP([3, 5, 4, 2], rng, 1);
    // use float64 copies for the numeric side by evaluating with small h on float32 params
    const B = 4;
    const X = new Float32Array(B * 3).map(() => rng() * 2 - 1);
    const W = new Float32Array(B * 2).map(() => rng() * 2 - 1);
    const lossOf = () => {
      const { out } = forward(net, X, B);
      let s = 0;
      for (let i = 0; i < out.length; i++) s += out[i] * W[i];
      return s;
    };
    const { cache } = forward(net, X, B);
    const g = backward(net, cache, W);
    const h = 1e-2;
    for (let k = 0; k < net.params.length; k += 3) {
      const p = net.params[k];
      net.params[k] = p + h;
      const up = lossOf();
      net.params[k] = p - h;
      const dn = lossOf();
      net.params[k] = p;
      const num = (up - dn) / (2 * h);
      expect(Math.abs(num - g[k])).toBeLessThan(2e-3 + 2e-2 * Math.abs(num));
    }
  });

  it("Adam fits a line", () => {
    const rng = mulberry32(1);
    const net = initMLP([1, 16, 1], rng);
    const opt = new Adam(net.params.length, 1e-2);
    const B = 32;
    const X = new Float32Array(B).map((_, i) => i / (B - 1) * 2 - 1);
    let loss = 0;
    for (let s = 0; s < 800; s++) {
      const { out, cache } = forward(net, X, B);
      const d = new Float32Array(B);
      loss = 0;
      for (let i = 0; i < B; i++) {
        const e = out[i] - (0.7 * X[i] + 0.2);
        loss += (e * e) / B;
        d[i] = (2 * e) / B;
      }
      opt.step(net.params, backward(net, cache, d));
    }
    expect(loss).toBeLessThan(1e-3);
  });
});
