import { normalTail, type Mixture } from "./special";

/** Targets for the importance-sampling section. p is a Gaussian mixture, f is what we average. */
export const IS_TARGETS = {
  tail: {
    label: "Rare tail",
    blurb: "P(X > 3) for X ~ N(0, 1). One sample in 741 lands there, so plain Monte Carlo mostly sees nothing.",
    p: { weights: [1], means: [0], variances: [1] } as Mixture,
    f: (x: number) => (x > 3 ? 1 : 0),
    truth: normalTail(3),
    threshold: 3 as number | null,
    /** p is a normalised density here, so the page uses ordinary IS: (1/n) Σ (p/q) f. */
    normalised: true as boolean,
    q0: { mu: 0, sd: 1 },
    range: [-4, 6] as [number, number],
  },
  bimodal: {
    label: "Two humps",
    blurb: "E[X] under a lopsided two-bump mixture. A narrow proposal parked on one hump never hears about the other.",
    p: { weights: [0.35, 0.65], means: [-2, 1.8], variances: [0.35, 0.6] } as Mixture,
    f: (x: number) => x,
    truth: 0.35 * -2 + 0.65 * 1.8,
    threshold: null as number | null,
    /** Treated as known only up to a constant, like a posterior: self-normalised IS, Σ w̃ f. */
    normalised: false as boolean,
    q0: { mu: -2, sd: 0.6 },
    range: [-5, 5] as [number, number],
  },
} as const;

export type IsTargetName = keyof typeof IS_TARGETS;

/** p for the mode-seeking demo: two well-separated bumps. */
export const KL_MIXTURE: Mixture = { weights: [0.45, 0.55], means: [-2.2, 1.9], variances: [0.3, 0.45] };
