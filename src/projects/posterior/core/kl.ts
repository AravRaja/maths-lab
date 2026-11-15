import { notYoursYet } from "@/kit/not-yours-yet";
import type { Normal } from "./types";

const FILE = "src/projects/posterior/core/kl.ts";

/**
 * KL divergence between two 1D Gaussians, in closed form.
 *
 * Maths:   KL(p ‖ q) = E_{x~p}[ log p(x) − log q(x) ]
 *          p = N(μ_p, σ_p²),  q = N(μ_q, σ_q²)
 *
 * Signature: klNormal(p: Normal, q: Normal) => number    // nats, ≥ 0
 *   Normal is { mean, variance } (variance, not standard deviation).
 *
 * On paper first:
 *  - Write log p(x) − log q(x) for two Gaussians. It is a quadratic in x.
 *  - Take its expectation under p: you only need E_p[x − μ_p] and E_p[(x − μ_q)²]. What are they?
 *  - Check: KL(p ‖ p) = 0. Swap p and q; is the answer the same? When is it?
 *  - This exact term appears in every VAE loss (with q = N(0, 1)). Write that special case.
 */
export function klNormal(p: Normal, q: Normal): number {
  void p; void q;
  throw notYoursYet({ file: FILE, fn: "klNormal", milestone: "m6-kl", summary: "How many nats you lose coding p with q. Lights up the KL readouts and landscape." });
}
