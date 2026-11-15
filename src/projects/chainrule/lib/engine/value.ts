import type { GradNode } from "@/projects/chainrule/core/types";
import { addBackward, expBackward, logBackward, mulBackward, powBackward, reluBackward, tanhBackward } from "@/projects/chainrule/core/ops";
import { backprop } from "@/projects/chainrule/core/backprop";

/*
 * The engine: a scalar autograd Value in the style of micrograd.
 * The forward pass is scaffolding (plain arithmetic). Every backward rule is the user's
 * (src/projects/chainrule/core/ops.ts) and so is the graph walk (src/projects/chainrule/core/backprop.ts).
 */

export type Op = "leaf" | "const" | "add" | "mul" | "pow" | "exp" | "log" | "tanh" | "relu";

let nextId = 0;

export class Value implements GradNode {
  readonly id = nextId++;
  grad = 0;
  constructor(
    public data: number,
    public readonly op: Op = "leaf",
    public readonly parents: Value[] = [],
    /** Exponent for pow. */
    public readonly k = 0,
    public label?: string,
  ) {}

  static leaf(data: number, label?: string) {
    return new Value(data, "leaf", [], 0, label);
  }
  static const(data: number) {
    return new Value(data, "const");
  }
  static of(v: Value | number): Value {
    return v instanceof Value ? v : Value.const(v);
  }

  add(o: Value | number) {
    const b = Value.of(o);
    return new Value(this.data + b.data, "add", [this, b]);
  }
  mul(o: Value | number) {
    const b = Value.of(o);
    return new Value(this.data * b.data, "mul", [this, b]);
  }
  pow(k: number) {
    return new Value(Math.pow(this.data, k), "pow", [this], k);
  }
  exp() {
    return new Value(Math.exp(this.data), "exp", [this]);
  }
  log() {
    return new Value(Math.log(this.data), "log", [this]);
  }
  tanh() {
    return new Value(Math.tanh(this.data), "tanh", [this]);
  }
  relu() {
    return new Value(Math.max(0, this.data), "relu", [this]);
  }
  neg() {
    return this.mul(-1);
  }
  sub(o: Value | number) {
    return this.add(Value.of(o).neg());
  }
  div(o: Value | number) {
    return this.mul(Value.of(o).pow(-1));
  }

  /** Contributions to each parent's grad, from the user's op rules. */
  localGrads(g: number): number[] {
    const [a, b] = this.parents;
    switch (this.op) {
      case "add":
        return addBackward(a.data, b.data, g);
      case "mul":
        return mulBackward(a.data, b.data, g);
      case "pow":
        return [powBackward(a.data, this.k, g)];
      case "exp":
        return [expBackward(a.data, this.data, g)];
      case "log":
        return [logBackward(a.data, g)];
      case "tanh":
        return [tanhBackward(a.data, this.data, g)];
      case "relu":
        return [reluBackward(a.data, g)];
      default:
        return [];
    }
  }
}

/** Every node reachable from root (any order). Scaffolding for drawing and zeroing; not a topo sort. */
export function collect(root: Value): Value[] {
  const seen = new Set<Value>();
  const stack = [root];
  while (stack.length) {
    const v = stack.pop()!;
    if (seen.has(v)) continue;
    seen.add(v);
    for (const p of v.parents) stack.push(p);
  }
  return [...seen];
}

/** Zero every grad, then run the user's backprop. Returns their topological order. */
export function runBackward(root: Value): Value[] {
  for (const v of collect(root)) v.grad = 0;
  return backprop(root) as Value[];
}

/** Sum a list as a balanced tree so graphs stay shallow. */
export function sumValues(vs: Value[]): Value {
  if (vs.length === 0) return Value.const(0);
  let layer = vs;
  while (layer.length > 1) {
    const next: Value[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(i + 1 < layer.length ? layer[i].add(layer[i + 1]) : layer[i]);
    layer = next;
  }
  return layer[0];
}

export const OP_SYMBOL: Record<Op, string> = {
  leaf: "",
  const: "",
  add: "+",
  mul: "×",
  pow: "^",
  exp: "exp",
  log: "log",
  tanh: "tanh",
  relu: "relu",
};
