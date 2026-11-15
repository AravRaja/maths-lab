import { describe, expect, it } from "vitest";
import { backprop, topoSort } from "../backprop";
import type { GradNode } from "../types";

/*
 * A throwaway mini-engine with hard-coded derivatives, so these tests only exercise YOUR graph
 * walk, not your op rules (those are tested in ops.test.ts).
 */
class N implements GradNode {
  grad = 0;
  constructor(public value: number, public parents: N[] = [], private lg: (g: number) => number[] = () => [], public name = "") {}
  localGrads(g: number) { return this.lg(g); }
}
const leaf = (v: number, name = "") => new N(v, [], () => [], name);
const add = (a: N, b: N) => new N(a.value + b.value, [a, b], (g) => [g, g]);
const mul = (a: N, b: N) => new N(a.value * b.value, [a, b], (g) => [g * b.value, g * a.value]);
const tanh = (a: N) => { const o = Math.tanh(a.value); return new N(o, [a], (g) => [g * (1 - o * o)]); };
const sq = (a: N) => new N(a.value ** 2, [a], (g) => [2 * a.value * g]);

function reachable(root: N): Set<N> {
  const s = new Set<N>();
  const go = (n: N) => { if (s.has(n)) return; s.add(n); n.parents.forEach(go); };
  go(root);
  return s;
}

function expectTopological(order: GradNode[], root: N) {
  const all = reachable(root);
  expect(order.length).toBe(all.size);
  expect(new Set(order).size).toBe(order.length);
  for (const n of order) expect(all.has(n as N)).toBe(true);
  const pos = new Map(order.map((n, i) => [n, i]));
  for (const n of all) for (const p of n.parents) expect(pos.get(p)!).toBeLessThan(pos.get(n)!);
  expect(order[order.length - 1]).toBe(root);
}

describe("topoSort", () => {
  it("orders a single leaf", () => {
    const x = leaf(1);
    expect(topoSort(x)).toEqual([x]);
  });

  it("puts parents before children in a diamond", () => {
    const x = leaf(2);
    const a = sq(x), b = tanh(x);
    const root = add(a, b);
    expectTopological(topoSort(root), root);
  });

  it("lists a node once even when it is both parents of one node (x·x)", () => {
    const x = leaf(3);
    const root = mul(x, x);
    const order = topoSort(root);
    expect(order).toEqual([x, root]);
  });

  it("handles heavy sharing: (x·y + x)·x", () => {
    const x = leaf(1.5), y = leaf(-2);
    const root = mul(add(mul(x, y), x), x);
    expectTopological(topoSort(root), root);
  });

  it("copes with a deep chain (3000 nodes)", () => {
    let v: N = leaf(0.1);
    for (let i = 0; i < 3000; i++) v = add(v, leaf(0));
    expectTopological(topoSort(v), v);
  });

  it("copes with a wide random DAG", () => {
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const nodes: N[] = Array.from({ length: 6 }, (_, i) => leaf(r(), `x${i}`));
    for (let i = 0; i < 200; i++) {
      const a = nodes[Math.floor(r() * nodes.length)], b = nodes[Math.floor(r() * nodes.length)];
      nodes.push(r() < 0.5 ? add(a, b) : mul(a, b));
    }
    const root = nodes[nodes.length - 1];
    expectTopological(topoSort(root), root);
  });
});

describe("backprop", () => {
  it("seeds the root with 1", () => {
    const x = leaf(2);
    const root = sq(x);
    backprop(root);
    expect(root.grad).toBe(1);
    expect(x.grad).toBeCloseTo(4, 12);
  });

  it("accumulates when a node is used twice by the same op: d(x·x)/dx = 2x", () => {
    const x = leaf(3);
    backprop(mul(x, x));
    expect(x.grad).toBeCloseTo(6, 12);
  });

  it("sums over every path: d/dx [(x·y + x)·x] = 2xy + 2x", () => {
    const x = leaf(1.5), y = leaf(-2);
    const root = mul(add(mul(x, y), x), x);
    backprop(root);
    expect(x.grad).toBeCloseTo(2 * 1.5 * -2 + 2 * 1.5, 12);
    expect(y.grad).toBeCloseTo(1.5 * 1.5, 12);
  });

  it("only passes on a node's gradient once it is complete (diamond into tanh)", () => {
    // u = x², L = tanh(u + u·u): u feeds two places, then x sees u's total.
    const x = leaf(0.6);
    const u = sq(x);
    const root = tanh(add(u, mul(u, u)));
    backprop(root);
    const uv = 0.36, inner = uv + uv * uv;
    const want = (1 - Math.tanh(inner) ** 2) * (1 + 2 * uv) * 2 * 0.6;
    expect(x.grad).toBeCloseTo(want, 12);
  });

  it("returns the topological order it used", () => {
    const x = leaf(1), y = leaf(2);
    const root = add(mul(x, y), x);
    expectTopological(backprop(root), root);
  });

  it("matches finite differences on a random DAG", () => {
    // Rebuild the same random graph from leaf values so we can perturb them.
    const build = (vals: number[]) => {
      let seed = 11;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const leaves = vals.map((v) => leaf(v));
      const nodes: N[] = [...leaves];
      for (let i = 0; i < 60; i++) {
        const a = nodes[Math.floor(r() * nodes.length)], b = nodes[Math.floor(r() * nodes.length)];
        const k = r();
        nodes.push(k < 0.4 ? add(a, b) : k < 0.8 ? mul(a, b) : tanh(a));
      }
      return { leaves, root: tanh(nodes[nodes.length - 1]) };
    };
    const x0 = [0.3, -0.4, 0.5, 0.2];
    const { leaves, root } = build(x0);
    backprop(root);
    const h = 1e-6;
    x0.forEach((_, i) => {
      const up = x0.slice(); up[i] += h;
      const dn = x0.slice(); dn[i] -= h;
      const num = (build(up).root.value - build(dn).root.value) / (2 * h);
      expect(Math.abs(leaves[i].grad - num)).toBeLessThan(1e-6 * Math.max(1, Math.abs(num)));
    });
  });

  it("handles a deep chain: d/dx of x·1·1·…·1 + 0 is 1", () => {
    const x = leaf(0.7);
    let v: N = x;
    for (let i = 0; i < 3000; i++) v = mul(v, leaf(1));
    backprop(v);
    expect(x.grad).toBeCloseTo(1, 12);
  });
});
