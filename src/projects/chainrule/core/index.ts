import type { CoreSpec } from "@/kit/cores";
import type { GradNode } from "./types";
import { addBackward, expBackward, logBackward, mulBackward, powBackward, reluBackward, tanhBackward } from "./ops";
import { backprop, topoSort } from "./backprop";
import { numericalGrad, relError } from "./gradcheck";
import { sgdStep } from "./sgd";
import { matmulBackward } from "./matmul";

/** Two-node probe graph (leaf -> sum) that doesn't touch the op rules. */
function probeGraph(): GradNode {
  const leaf: GradNode = { grad: 0, parents: [], localGrads: () => [] };
  return { grad: 0, parents: [leaf], localGrads: (g) => [g] };
}

const F = { ops: "src/projects/chainrule/core/ops.ts", bp: "src/projects/chainrule/core/backprop.ts", gc: "src/projects/chainrule/core/gradcheck.ts", sgd: "src/projects/chainrule/core/sgd.ts", mm: "src/projects/chainrule/core/matmul.ts" };

/**
 * Every maths core in the project, for <CoreStatus>. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: F.ops, fn: "addBackward", milestone: "m1-local-derivatives", probe: () => addBackward(1, 2, 1) },
  { file: F.ops, fn: "mulBackward", milestone: "m1-local-derivatives", probe: () => mulBackward(1, 2, 1) },
  { file: F.ops, fn: "powBackward", milestone: "m1-local-derivatives", probe: () => powBackward(2, 3, 1) },
  { file: F.ops, fn: "expBackward", milestone: "m1-local-derivatives", probe: () => expBackward(0, 1, 1) },
  { file: F.ops, fn: "logBackward", milestone: "m1-local-derivatives", probe: () => logBackward(1, 1) },
  { file: F.ops, fn: "tanhBackward", milestone: "m1-local-derivatives", probe: () => tanhBackward(0, 0, 1) },
  { file: F.ops, fn: "reluBackward", milestone: "m1-local-derivatives", probe: () => reluBackward(1, 1) },
  { file: F.bp, fn: "topoSort", milestone: "m2-backprop", probe: () => topoSort(probeGraph()) },
  { file: F.bp, fn: "backprop", milestone: "m2-backprop", probe: () => backprop(probeGraph()) },
  { file: F.gc, fn: "numericalGrad", milestone: "m3-gradcheck", probe: () => numericalGrad((x) => x[0], [1]) },
  { file: F.gc, fn: "relError", milestone: "m3-gradcheck", probe: () => relError([1], [1]) },
  { file: F.sgd, fn: "sgdStep", milestone: "m4-sgd", probe: () => sgdStep([1], [1], [0], { lr: 0.1 }) },
  { file: F.mm, fn: "matmulBackward", milestone: "m5-matmul", probe: () => matmulBackward([[1]], [[1]], [[1]]) },
];
