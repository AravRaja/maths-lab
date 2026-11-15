import { describe, expect, it } from "vitest";
import { ENV, physics, resetState, terminalReason, TorchEnv } from "../env";
import { backward, createMlp, forward, paramCount, Adam, clipGlobalNorm, type MlpCache } from "../mlp";
import { numericGrad } from "../numeric-grad";
import { pilotAction, pilotRollout } from "../pilot";
import { mulberry32 } from "../rng";

describe("numericGrad", () => {
  it("matches an analytic gradient", () => {
    const f = (x: number[]) => x[0] ** 2 * x[1] + Math.sin(x[1]);
    const g = numericGrad(f, [1.3, -0.4]);
    expect(g[0]).toBeCloseTo(2 * 1.3 * -0.4, 6);
    expect(g[1]).toBeCloseTo(1.3 ** 2 + Math.cos(-0.4), 6);
  });
});

describe("mlp", () => {
  it("has the right parameter count", () => {
    expect(paramCount([4, 3, 2])).toBe(4 * 3 + 3 + 3 * 2 + 2);
  });

  it("backprop matches finite differences", () => {
    const net = createMlp([3, 5, 4, 2], mulberry32(2), 1);
    const x = [0.3, -0.7, 0.2];
    const w = [0.8, -1.1];
    const loss = () => { const y = forward(net, x); return w[0] * y[0] + w[1] * y[1]; };
    const cache: MlpCache = { acts: [] };
    forward(net, x, cache);
    const grad = new Float64Array(net.params.length);
    backward(net, cache, w, grad);
    for (let i = 0; i < net.params.length; i += 3) {
      const p = net.params[i], h = 1e-6;
      net.params[i] = p + h; const up = loss();
      net.params[i] = p - h; const dn = loss();
      net.params[i] = p;
      expect(grad[i]).toBeCloseTo((up - dn) / (2 * h), 6);
    }
  });

  it("Adam fits a line", () => {
    const net = createMlp([1, 1], mulberry32(3), 1);
    const opt = new Adam(net.params.length, 0.05);
    for (let k = 0; k < 600; k++) {
      const g = new Float64Array(net.params.length);
      for (const x of [-1, 0, 1, 2]) {
        const c: MlpCache = { acts: [] };
        const y = forward(net, [x], c)[0];
        backward(net, c, [(y - (2 * x + 1)) / 4], g);
      }
      opt.step(net.params, g);
    }
    expect(forward(net, [3])[0]).toBeCloseTo(7, 1);
  });

  it("clips the global norm", () => {
    const a = new Float64Array([3, 4]);
    expect(clipGlobalNorm([a], 1)).toBeCloseTo(5, 12);
    expect(Math.hypot(a[0], a[1])).toBeCloseTo(1, 12);
  });
});

describe("env", () => {
  it("falls over with no control", () => {
    let s = { x: 0, v: 0, theta: 0.02, omega: 0 };
    let n = 0;
    while (terminalReason(s, n) === null && n < 1000) { s = physics(s, 0); n++; }
    expect(terminalReason(s, n)).toBe("fell");
    expect(n).toBeLessThan(200);
  });

  it("starts small and rewards +1 per step", () => {
    const env = new TorchEnv(mulberry32(1));
    const s = resetState(mulberry32(5));
    for (const v of Object.values(s)) expect(Math.abs(v)).toBeLessThanOrEqual(0.05);
    expect(env.step(1).reward).toBe(1);
  });

  it("the pilot balances to the time limit without noise", () => {
    const env = new TorchEnv(mulberry32(4));
    env.reset();
    let r = env.step(pilotAction(env.state));
    while (!r.done) r = env.step(pilotAction(env.state));
    expect(r.reason).toBe("time");
    expect(env.steps).toBe(ENV.maxSteps);
  });

  it("the shaky pilot rollout has several episodes", () => {
    const ro = pilotRollout(300, 7);
    expect(ro.rewards).toHaveLength(300);
    expect(ro.starts.length).toBeGreaterThanOrEqual(2);
    expect(ro.dones.filter(Boolean).length).toBeGreaterThanOrEqual(1);
  });
});
