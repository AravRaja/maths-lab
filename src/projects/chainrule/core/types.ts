/**
 * The one interface backprop needs. The engine's `Value` (src/projects/chainrule/lib/engine/value.ts) implements it,
 * and the tests use a tiny hand-made node, so your backprop never depends on the engine.
 */
export interface GradNode {
  /** ∂L/∂(this node). Starts at 0; backprop fills it in. */
  grad: number;
  /**
   * The nodes this one was computed from, in argument order. The same node can appear twice
   * (x * x has parents [x, x]). Leaves have no parents.
   */
  readonly parents: readonly GradNode[];
  /**
   * Given g = ∂L/∂(this), return the contribution to ∂L/∂parents[i] for each parent,
   * in the same order: g · ∂(this)/∂(parents[i]). The engine builds this from your op rules in ops.ts.
   */
  localGrads(g: number): number[];
}
