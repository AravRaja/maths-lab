import { describe, expect, it } from "vitest";
import { buildGraph, compile, parse, variables, PRESETS } from "@/projects/chainrule/lib/engine/expr";
import { runBackward } from "@/projects/chainrule/lib/engine/value";
import { initParams, lossGradMatmul, lossGradScalar } from "@/projects/chainrule/lib/engine/mlp";
import { makeDataset } from "@/projects/chainrule/lib/engine/data";

/*
 * Integration: your op rules + your backprop driving the real engine, checked against
 * finite differences computed here. These go green once milestones 1 and 2 are done
 * (and the last one needs milestone 5's matmulBackward).
 */

const h = 1e-6;
function fdGrad(src: string, env: Record<string, number>) {
  const ast = parse(src);
  const vars = variables(ast);
  const f = compile(ast, vars);
  const x = vars.map((v) => env[v]);
  return vars.map((_, i) => {
    const up = x.slice(); up[i] += h;
    const dn = x.slice(); dn[i] -= h;
    return (f(up) - f(dn)) / (2 * h);
  });
}

describe("engine with your cores", () => {
  it("the classic neuron: tanh(w1·x1 + w2·x2 + b)", () => {
    const p = PRESETS[0];
    const { root, leaves } = buildGraph(parse(p.src), p.env);
    runBackward(root);
    expect(root.data).toBeCloseTo(0.7071, 4);
    expect(leaves.x1.grad).toBeCloseTo(-1.5, 4);
    expect(leaves.w1.grad).toBeCloseTo(1.0, 4);
    expect(leaves.w2.grad).toBeCloseTo(0, 10);
    expect(leaves.b.grad).toBeCloseTo(0.5, 4);
  });

  it.each(PRESETS.map((p) => [p.name, p] as const))("preset %s matches finite differences", (_, p) => {
    const ast = parse(p.src);
    const { root, leaves } = buildGraph(ast, p.env);
    runBackward(root);
    const num = fdGrad(p.src, p.env);
    variables(ast).forEach((v, i) => expect(Math.abs(leaves[v].grad - num[i])).toBeLessThan(1e-6 * Math.max(1, Math.abs(num[i]))));
  });

  it("division and subtraction come for free", () => {
    const env = { a: 1.3, b: -0.6 };
    const src = "(a - b) / (a*a + 1) - b^3";
    const { root, leaves } = buildGraph(parse(src), env);
    runBackward(root);
    const num = fdGrad(src, env);
    expect(leaves.a.grad).toBeCloseTo(num[0], 6);
    expect(leaves.b.grad).toBeCloseTo(num[1], 6);
  });

  it("MLP gradient through the scalar graph matches finite differences of the loss", () => {
    const sizes = [2, 4, 1];
    const data = makeDataset("moons", 12, 3);
    const p = initParams(sizes, 2);
    const { grads } = lossGradScalar(p, sizes, data, 1e-3);
    for (const i of [0, 3, 7, 11, p.length - 1]) {
      const up = p.slice(); up[i] += h;
      const dn = p.slice(); dn[i] -= h;
      const num = (lossGradScalar(up, sizes, data, 1e-3).loss - lossGradScalar(dn, sizes, data, 1e-3).loss) / (2 * h);
      expect(grads[i]).toBeCloseTo(num, 6);
    }
  });

  it("matmul-lite gives the same gradient as the scalar graph", () => {
    const sizes = [2, 5, 3, 1];
    const data = makeDataset("circles", 16, 4);
    const p = initParams(sizes, 9);
    const a = lossGradScalar(p, sizes, data, 1e-3);
    const b = lossGradMatmul(p, sizes, data, 1e-3);
    expect(b.loss).toBeCloseTo(a.loss, 10);
    a.grads.forEach((g, i) => expect(b.grads[i]).toBeCloseTo(g, 10));
  });
});
