import { describe, expect, it } from "vitest";
import { sgdStep } from "../sgd";

describe("sgdStep", () => {
  it("plain SGD: θ − ηg", () => {
    const { params, velocity } = sgdStep([1, -2, 0.5], [0.5, 1, -4], [0, 0, 0], { lr: 0.1 });
    [0.95, -2.1, 0.9].forEach((v, i) => expect(params[i]).toBeCloseTo(v, 12));
    expect(velocity).toHaveLength(3);
  });

  it("does not mutate its inputs", () => {
    const p = [1, 2], g = [3, 4], v = [0.5, 0.5];
    sgdStep(p, g, v, { lr: 0.1, momentum: 0.9, weightDecay: 0.01 });
    expect(p).toEqual([1, 2]);
    expect(g).toEqual([3, 4]);
    expect(v).toEqual([0.5, 0.5]);
  });

  it("momentum follows v ← μv + g, θ ← θ − ηv", () => {
    let s = { params: [0], velocity: [0] };
    s = sgdStep(s.params, [1], s.velocity, { lr: 0.5, momentum: 0.9 });
    expect(s.velocity[0]).toBeCloseTo(1, 12);
    expect(s.params[0]).toBeCloseTo(-0.5, 12);
    s = sgdStep(s.params, [1], s.velocity, { lr: 0.5, momentum: 0.9 });
    expect(s.velocity[0]).toBeCloseTo(1.9, 12);
    expect(s.params[0]).toBeCloseTo(-1.45, 12);
  });

  it("weight decay adds λθ to the gradient", () => {
    const { params } = sgdStep([2], [0], [0], { lr: 0.1, weightDecay: 0.5 });
    expect(params[0]).toBeCloseTo(2 - 0.1 * 0.5 * 2, 12);
  });

  it("with a constant gradient, velocity settles at g/(1 − μ)", () => {
    let s = { params: [0], velocity: [0] };
    for (let i = 0; i < 400; i++) s = sgdStep(s.params, [2], s.velocity, { lr: 0.01, momentum: 0.95 });
    expect(s.velocity[0]).toBeCloseTo(2 / (1 - 0.95), 6);
  });

  const quadratic = (a: number, lr: number, momentum = 0, steps = 200) => {
    let s = { params: [1], velocity: [0] };
    for (let i = 0; i < steps; i++) s = sgdStep(s.params, [a * s.params[0]], s.velocity, { lr, momentum });
    return Math.abs(s.params[0]);
  };

  it("converges on ½aθ² when η < 2/a and diverges when η > 2/a", () => {
    expect(quadratic(4, 0.4)).toBeLessThan(1e-6);
    expect(quadratic(4, 0.25, 0, 1)).toBeCloseTo(0, 12); // η = 1/a lands in one step
    expect(quadratic(4, 0.51)).toBeGreaterThan(1e3);
  });

  it("momentum still converges on a quadratic", () => {
    expect(quadratic(4, 0.05, 0.9, 600)).toBeLessThan(1e-6);
  });
});
