import type { CoreSpec } from "@/lib/kit/cores";
import { logSumExp, softmax } from "./softmax";

/**
 * Every maths core in the project, for <CoreStatus>. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: "src/core/softmax.ts", fn: "logSumExp", milestone: "m1-softmax", probe: () => logSumExp([0, 1]) },
  { file: "src/core/softmax.ts", fn: "softmax", milestone: "m1-softmax", probe: () => softmax([0, 1], 1) },
];
