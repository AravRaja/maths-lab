# Flow field

**Flow matching from scratch, in the browser.** Pick a glyph or draw a shape, and a cloud of Gaussian noise streams into it along a velocity field. The page goes from the closed-form field of a finite dataset to a network trained live in a Web Worker, then to a class-conditional model with classifier-free guidance, and ends with a flow policy that generates 8-step action chunks for a 2-link arm, π0-style.

Live at `/flowfield` in maths-lab.

## What's on the page

| Section | What you see |
| --- | --- |
| Hero | 850 particles integrated through the exact marginal field of a maths glyph (∇, π, ∂, ∞, λ), forwards into the glyph, then backwards into noise. Tap to stir. |
| 1 · Data | Glyphs, toy shapes, or a drawing pad. Strokes are resampled by arc length into a 320-point dataset. |
| 2 · Straight lines | Conditional OT paths between noise and data, with a draggable pair and its target velocity. |
| 3 · The field nobody trained | The closed-form marginal velocity field as a quiver over a dithered density, scrubbable in t. Tap to drop a probe and trace it to t = 1. |
| 4 · Integrate | Euler trajectories through the exact field for 1 to 48 steps, with miss distance and path straightness. |
| 5 · Now learn it | A 3×96 SiLU MLP trained live with the CFM loss in a Web Worker, sampled every second. |
| 6 · One net, four glyphs | A label-conditioned net trained with context dropout, sampled with a guidance-weight slider. |
| 7 · Same maths, robot actions | Bimodal demonstrations round a post. A flow policy on 16-D action chunks against an L2 regressor trained on the same data with the same loss. Watch a chunk denoise, roll out, and score both. Optional temporal ensembling. |

## What I wrote, and what I didn't

Ten functions in `core/` are mine: the conditional path and its velocity, the exact marginal field, the Euler step and sampler, the CFM loss and its gradient, guidance and context dropout, and temporal ensembling. Each was derived on paper first, and each has tests in `core/__tests__/` that check the maths itself: finite-difference derivatives, the continuity equation, convergence order, closed-form limits.

Claude Code built the scaffolding: the page, canvases and dithering, the MLP with hand-written backprop and Adam, the worker training loops, the reacher simulator and expert, and the rollout loop. See [LEARNING.md](./LEARNING.md) for the path through the maths.

## How it works

- `core/`: the maths (mine).
- `lib/`: the MLP (`mlp.ts`), the network and CFM training step (`model.ts`), datasets and glyph sampling, the reacher kinematics and expert (`reacher.ts`), and the policies and rollout (`policy.ts`).
- `workers/flow.worker.ts`: every training run and sampler, called in short bursts so the page can pause, resume and draw.
- `components/`: one file per section, plus the hero.

Everything is static and client-side: no server and no ML library, only TypeScript and canvas.

## References

Lipman et al. 2023 (flow matching); Liu et al. 2022 (rectified flow); Ho and Salimans 2022 (classifier-free guidance); Zhao et al. 2023 (ACT, action chunking and temporal ensembling); Black et al. 2024 (π0).
