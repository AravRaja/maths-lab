import { describe, expect, it } from "vitest";
import { cfmLoss, cfmLossGrad } from "../loss";

describe("cfmLoss (M4)", () => {
  it("is zero when the prediction is the target", () => {
    expect(cfmLoss([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(0);
  });

  it("sums over coordinates and averages over the batch", () => {
    // ‖(1, 2)‖² = 5 and ‖(0, 3)‖² = 9 → mean 7
    expect(cfmLoss([[1, 2], [0, 3]], [[0, 0], [0, 0]])).toBeCloseTo(7, 12);
  });

  it("does not change when the batch is repeated", () => {
    const p = [[0.3, -0.2], [1, 1]];
    const q = [[0, 0.1], [0.5, -1]];
    expect(cfmLoss([...p, ...p], [...q, ...q])).toBeCloseTo(cfmLoss(p, q), 12);
  });
});

describe("cfmLossGrad (M4)", () => {
  it("has the shape of pred", () => {
    const g = cfmLossGrad([[1, 2, 3], [4, 5, 6]], [[0, 0, 0], [0, 0, 0]]);
    expect(g).toHaveLength(2);
    g.forEach((r) => expect(r).toHaveLength(3));
  });

  it("matches central differences of your cfmLoss", () => {
    const pred = [[0.3, -1.2], [0.8, 0.1], [-0.5, 2]];
    const target = [[1, 0], [0, -0.4], [0.2, 0.9]];
    const g = cfmLossGrad(pred, target);
    const h = 1e-5;
    for (let b = 0; b < pred.length; b++)
      for (let i = 0; i < 2; i++) {
        const up = pred.map((r) => [...r]);
        const dn = pred.map((r) => [...r]);
        up[b][i] += h;
        dn[b][i] -= h;
        const num = (cfmLoss(up, target) - cfmLoss(dn, target)) / (2 * h);
        expect(Math.abs(g[b][i] - num)).toBeLessThan(1e-6);
      }
  });

  it("gradient descent on pred converges to the target", () => {
    let pred = [[3, -2], [0, 5]];
    const target = [[1, 1], [-1, 0]];
    for (let s = 0; s < 200; s++) {
      const g = cfmLossGrad(pred, target);
      pred = pred.map((r, b) => r.map((v, i) => v - 0.5 * g[b][i]));
    }
    expect(cfmLoss(pred, target)).toBeLessThan(1e-10);
  });

  it("the best single prediction for many targets is their mean", () => {
    // One x_t, many possible targets: minimise over a shared v by descending the summed gradient.
    const targets = [[1, 0], [0, 1], [-1, 2], [3, 3]];
    let v = [0, 0];
    for (let s = 0; s < 500; s++) {
      const g = cfmLossGrad(targets.map(() => v), targets);
      const sum = g.reduce((a, r) => [a[0] + r[0], a[1] + r[1]], [0, 0]);
      v = [v[0] - 0.1 * sum[0], v[1] - 0.1 * sum[1]];
    }
    expect(v[0]).toBeCloseTo(0.75, 6);
    expect(v[1]).toBeCloseTo(1.5, 6);
  });
});
