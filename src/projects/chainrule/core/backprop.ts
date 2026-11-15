import { notYoursYet } from "@/kit/not-yours-yet";
import type { GradNode } from "./types";

const FILE = "src/projects/chainrule/core/backprop.ts";
const M = "m2-backprop";

/**
 * Topological order of every node the root depends on.
 *
 * Signature: topoSort(root: GradNode) => GradNode[]
 *   - contains each reachable node exactly once (compare by identity: the same object can be
 *     reached by many paths, and can even appear twice in one `parents` list),
 *   - every node comes AFTER all of its parents (leaves early, root last).
 *
 * On paper first:
 *  - Draw the graph for L = (x·y + x)·x. List its nodes so every node follows its inputs.
 *    How many valid orders are there? Does backprop care which one you pick?
 *  - Depth-first search gives you this for free if you append a node at the right moment.
 *    Before visiting its parents, or after? Why?
 *  - Graphs here can be a few thousand nodes deep. Recursion is fine; an explicit stack is sturdier.
 */
export function topoSort(root: GradNode): GradNode[] {
  void root;
  throw notYoursYet({ file: FILE, fn: "topoSort", milestone: M, summary: "Orders the graph so every node comes after its inputs." });
}

/**
 * Reverse-mode autodiff: fill in ∂root/∂node for every node.
 *
 * Signature: backprop(root: GradNode) => GradNode[]    (returns the topological order you used)
 *   - Assume every grad starts at 0 (the caller zeroes them).
 *   - Afterwards root.grad = 1 and node.grad = ∂root/∂node for every node.
 *   - Use node.localGrads(g) to turn a node's gradient into its parents' contributions.
 *
 * On paper first:
 *  - Multivariable chain rule: if x feeds several nodes u₁…u_m, then ∂L/∂x = Σⱼ (∂L/∂uⱼ)(∂uⱼ/∂x).
 *    What does that mean for code that touches x.grad more than once?
 *  - Why must a node's grad be complete before you pass it on to its parents?
 *    Which order over topoSort's list guarantees that?
 *  - Do L = x·x by hand: one mul node with parents [x, x]. You want 2x.
 */
export function backprop(root: GradNode): GradNode[] {
  void root;
  throw notYoursYet({ file: FILE, fn: "backprop", milestone: M, summary: "Reverse-mode autodiff: walks the graph backwards accumulating ∂L/∂node." });
}
