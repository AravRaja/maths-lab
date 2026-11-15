# maths-lab

**Nine maths demos, from the SVD to a tiny vision-language-action model. I write the maths. Claude Code builds the rest.**

<!-- screenshot / GIF: drop docs/hero.gif here -->

One Next.js site, nine projects, one per block of a 12-week maths syllabus for RL, world models, VLAs and robotics. Each project is a page with a live, monochrome signature visual: dithered fields, computation graphs, training runs streaming in from Web Workers.

## The rule: I write the core

Every project's maths lives in `src/projects/<slug>/core/` and starts as a **stub that throws `NotYoursYet`**. Each stub has a spec: the maths, the signature and shapes, and what to derive on paper first. Never the answer.

- **The page still runs.** Wherever a core is missing, the UI shows a *Yours to write* panel (file, function, what it does, a link to the milestone in that project's `LEARNING.md`) over a ghosted preview of what will appear.
- **Tests decide.** `src/projects/<slug>/core/__tests__/` checks the maths properly: closed forms, invariants, finite-difference gradient checks, convergence. They fail until the core is written.
- **The landing page counts.** Each card probes its project's cores and shows how many are written.

Claude Code writes the UI, visualisation, workers, simulators and training loops. The cores are mine.

## The projects

| # | Project | Weeks | Maths |
| --- | --- | --- | --- |
| 01 | [Rank](src/projects/rank) · `/rank` | 1–2 | SVD, projections, low-rank approximation |
| 02 | [Chain rule](src/projects/chainrule) · `/chainrule` | 3 | Autograd, backprop, gradient checking |
| 03 | [Posterior](src/projects/posterior) · `/posterior` | 4 | Bayes' rule, Gaussian conditioning, Monte Carlo, KL |
| 04 | [Bellman](src/projects/bellman) · `/bellman` | 5–6 | MDPs, value and policy iteration, TD, Q-learning |
| 05 | [PPO arena](src/projects/ppo-arena) · `/ppo-arena` | 7 | Policy gradient, GAE, the clipped objective |
| 06 | [Daydream](src/projects/daydream) · `/daydream` | 8–9 | ELBO, reparameterisation, latent dynamics |
| 07 | [Flow field](src/projects/flowfield) · `/flowfield` | 9–10 | Conditional flow matching, ODE sampling |
| 08 | [Jacobian](src/projects/jacobian) · `/jacobian` | 10–11 | SE(3), Jacobians, damped least squares IK, LQR, Kalman |
| 09 | [Say and reach](src/projects/say-and-reach) · `/say-and-reach` | 12 | A tiny VLA: kinematics, IK, behaviour cloning, flow matching |

Each project folder has a `LEARNING.md`: the milestones, what to derive on paper, which cores to write, and how to check them.

## Run locally

```sh
npm ci
npm run dev                              # http://localhost:3000
npm run test:cores                       # every project's maths: fails until the cores are written
npx vitest run src/projects/<slug>/core  # one project's maths
npm run test:kit                         # everything except the cores: always passes
npm run check                            # lint + types + scaffolding tests + build
```

## Layout

```
src/app/page.tsx              landing page
src/app/<slug>/page.tsx       each project's page
src/projects/<slug>/          each project: core/, core/__tests__/, components/, workers/, lib/, meta.ts, LEARNING.md
src/projects/registry.ts      the nine meta.ts files, in syllabus order
src/kit/                      shared kit: NotYoursYet, core guards, CoreStatus, canvas, workers, dithering, charts
src/components/               shadcn + Spectrum UI components, themed black and white
training/<slug>/              offline training scripts, if a project needs them
```

Building a project? Read [`BUILDERS.md`](BUILDERS.md).

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Base UI + shadcn · Spectrum UI · motion · Canvas 2D and Web Workers · Vitest. Strictly black and white, Archivo, phone-first. No server: it deploys to Vercel free.
