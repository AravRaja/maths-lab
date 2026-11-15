# Posterior

A Bayes and Monte Carlo playground, live at `/posterior`. Everything runs in the browser; the heavy sampling runs in a Web Worker.

**The hero** is an *Unknown Pleasures* stack of posteriors: thirty Beta curves over a hidden coin's bias, one per flip, newest in front, sharpening as evidence arrives. Every few seconds a new coin comes out of the drawer and the old beliefs scroll away behind the new ones. Press and hold to flip faster.

## What's on the page

1. **Is this coin rigged?** Half the coins are fair, half lean one way. Flip (or auto-flip) and watch a dithered Beta posterior sharpen, with a trail of earlier beliefs and a ±2σ band. A Bayes-factor meter compares "θ unknown" against "exactly fair" and gives a verdict; hold to reveal the truth and see whether the evidence called it. A log-log chart shows the posterior sd shrinking like 1/√n.
2. **Observe one, learn the other.** A draggable 2D Gaussian drawn as a dithered density with a sample cloud. Drag the slice: the conditional density bulges off the line, the marginals cast dashed shadows on the edges, and the regression line traces the conditional means. A readout shows how much of the variance the observation removed.
3. **Throw darts at π.** Ten independent Monte Carlo runs race in a worker. The ±1.96 SE band tightens and the chart zooms in with it; switch to the lower-variance estimator (average 4/(1+x²)) and compare. A log-log chart confirms the 1/√n law.
4. **Sample the wrong thing, on purpose.** Importance sampling with a draggable proposal. Each sample is a tick whose height is its weight (a "weight comb"), with the effective sample size and 160 repeated trials comparing plain Monte Carlo with importance sampling: a rare-tail probability (where IS wins by an order of magnitude) and a two-hump target (where a narrow proposal is confidently wrong).
5. **A distance that isn't one.** Two Gaussians, the KL integrand drawn as a signed area, both directions of KL, a dithered KL landscape over every q (tap to move q), and a Monte Carlo check against the closed form. Then *mode-seeking vs mass-covering*: fitting one Gaussian to two bumps by brute-force forward and reverse KL, every cell a Monte Carlo estimate.

## What I wrote

Ten functions in `core/`, in six milestones (see `LEARNING.md`):

| Milestone | Functions |
| --- | --- |
| M1 the coin | `betaUpdate`, `betaMoments` |
| M2 evidence | `logEvidence` |
| M3 Gaussians | `cholesky2`, `marginal`, `condition` |
| M4 Monte Carlo | `mcEstimate` |
| M5 importance sampling | `importanceWeights`, `effectiveSampleSize` |
| M6 KL | `klNormal` |

Each is checked by tests in `core/__tests__/` against quadrature, sampling, invariants and edge cases. Claude Code built the scaffolding: the canvases, the dithering, the worker, the samplers and the UI.

## Layout

```
core/         the maths (stubs until written) and their tests
components/   hero, the five sections, charts and controls
workers/      sampling.worker.ts: darts, importance sampling, KL landscape
lib/          seeded RNG, special functions and densities, IS targets
```
