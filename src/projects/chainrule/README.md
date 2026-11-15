# chainrule

**A tiny autograd engine I wrote by hand. You can watch gradients fall through the graph.**

<!-- screenshot / GIF: drop docs/hero.gif here (the swarm hero, then a backward pass on the graph) -->

Type any expression, like `tanh(w1*x1 + w2*x2 + b)` or `log(1 + exp(a*b))`, and chainrule builds its computation graph. Values climb up the graph, then gradients fall back down it one node at a time, in the order backprop visits them. The same engine then trains a small neural net live in your browser and bends a dithered decision boundary around two classes of points.

Everything is strictly black and white, it works on a phone, and it has no server.

## Why it's fun

- **The chain rule as an animation.** Each node lights up once its gradient is complete. Pulses carry g · ∂child/∂parent down each edge, and edge thickness shows how much gradient each path carries. Shared inputs collect from every path, so the multivariable chain rule happens on screen.
- **A swarm that uses the engine.** The hero is a loss landscape, Bayer-dithered with crawling contour bands. Hundreds of particles slide downhill on ∇f, and every particle's gradient on every frame comes from a fresh graph and a full backward pass.
- **It checks itself.** Analytic gradients are compared with central finite differences. The error-versus-h plot shows the textbook U: truncation error on one side and floating-point round-off on the other.
- **Scalar against matrix.** The same network trains through a scalar graph (tens of thousands of nodes per step) or through whole-layer matrix ops. A benchmark races the two engines and confirms their gradients agree to about 1e-15.

## How it works

A `Value` holds a number, the op that made it and its parents. The forward pass builds the graph as it computes.

**Backward rules** (`src/projects/chainrule/core/ops.ts`). Each of the seven ops (add, mul, pow, exp, log, tanh, relu) maps the upstream gradient g = ∂L/∂out to ∂L/∂inputs. Subtraction, division, sigmoid and squaring are rewritten in terms of these seven, so no other rules are needed.

**Backprop** (`src/projects/chainrule/core/backprop.ts`). A topological sort, then one sweep in reverse order. Each node passes g · ∂node/∂parent to its parents, and those contributions are summed: ∂L/∂x = Σⱼ ∂L/∂uⱼ · ∂uⱼ/∂x.

**Gradient check** (`src/projects/chainrule/core/gradcheck.ts`). Central differences (f(x+h) − f(x−h))/2h, which have O(h²) error, and a scale-free relative error between the two gradients.

**Training** (`src/projects/chainrule/core/sgd.ts`). A tanh MLP with the hinge loss (1/N) Σ max(0, 1 − yₙsₙ) + α‖θ‖², optimised by SGD with heavy-ball momentum.

**Matmul-lite** (`src/projects/chainrule/core/matmul.ts`). One backward rule for C = AB covers a whole layer. The bias rides along as an extra row of the weight matrix, fed by a column of ones.

### What I wrote, and what Claude Code wrote

The maths is mine: every backward rule, the topological sort and backprop, the finite-difference checker, the optimiser step and the matmul backward. That is 13 functions across five milestones; see [`LEARNING.md`](LEARNING.md). Claude Code wrote the scaffolding: the expression parser, the graph layout and canvas animation, the training worker, the charts and the UI. Until a function is written, the app shows a *Yours to write* panel in its place, and the vitest suite in `src/projects/chainrule/core/__tests__/` (closed forms, invariants, finite-difference checks, convergence) says when it's right.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Canvas 2D · Web Workers · Base UI + shadcn · Spectrum UI · Vitest. No server, no ML library: just numbers.

## Run locally

```sh
npm ci
npm run dev                                 # http://localhost:3000/chainrule
npx vitest run src/projects/chainrule/core   # this project's maths: fails until the cores are written
npm run check                               # lint + types + scaffolding tests + build
```

## Layout

```
src/projects/chainrule/core/         the maths cores (mine) and their tests
src/projects/chainrule/lib/engine/   Value graph, expression parser, MLP, datasets, graph layout
src/projects/chainrule/workers/      training loop and engine benchmark (Web Worker)
src/projects/chainrule/components/   hero swarm, graph canvas, ops gallery, gradient check, trainer
src/app/chainrule/page.tsx           the page at /chainrule
src/kit/                             lab kit: CorePanel, charts, dithering, canvas and worker hooks
```
