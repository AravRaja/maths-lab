import type { CoreSpec } from "@/kit/cores";
import { reparameterise, reparameteriseBackward } from "./reparam";
import { gaussianKL, gaussianKLGrad } from "./kl";
import { bernoulliLogLik, bernoulliLogLikGrad, elbo } from "./elbo";
import { gaussianNLL, gaussianNLLGrad } from "./dynamics";
import { diagGaussianKL } from "./surprise";

const F = {
  rp: "src/projects/daydream/core/reparam.ts",
  kl: "src/projects/daydream/core/kl.ts",
  el: "src/projects/daydream/core/elbo.ts",
  dy: "src/projects/daydream/core/dynamics.ts",
  su: "src/projects/daydream/core/surprise.ts",
};

/**
 * Every maths core in Daydream, in milestone order. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: F.rp, fn: "reparameterise", milestone: "m1-reparam", probe: () => reparameterise([0], [0], [1]) },
  { file: F.rp, fn: "reparameteriseBackward", milestone: "m1-reparam", probe: () => reparameteriseBackward([0], [1], [1]) },
  { file: F.kl, fn: "gaussianKL", milestone: "m2-kl", probe: () => gaussianKL([0], [0]) },
  { file: F.kl, fn: "gaussianKLGrad", milestone: "m2-kl", probe: () => gaussianKLGrad([0], [0]) },
  { file: F.el, fn: "bernoulliLogLik", milestone: "m3-elbo", probe: () => bernoulliLogLik([1], [0]) },
  { file: F.el, fn: "bernoulliLogLikGrad", milestone: "m3-elbo", probe: () => bernoulliLogLikGrad([1], [0]) },
  { file: F.el, fn: "elbo", milestone: "m3-elbo", probe: () => elbo([1], [0], [0], [0], 1) },
  { file: F.dy, fn: "gaussianNLL", milestone: "m4-dynamics", probe: () => gaussianNLL([0], [0], [0]) },
  { file: F.dy, fn: "gaussianNLLGrad", milestone: "m4-dynamics", probe: () => gaussianNLLGrad([0], [0], [0]) },
  { file: F.su, fn: "diagGaussianKL", milestone: "m5-surprise", probe: () => diagGaussianKL([0], [0], [0], [0]) },
];

export { reparameterise, reparameteriseBackward, gaussianKL, gaussianKLGrad, bernoulliLogLik, bernoulliLogLikGrad, elbo, gaussianNLL, gaussianNLLGrad, diagGaussianKL };
