# rank

**An image compressor and eigenfaces explorer built on the SVD. Drag the rank down and watch a picture dissolve into its strongest directions.**

<!-- screenshot / GIF: the hero (a portrait rebuilt from k = 1 to 128 layers), then the face-space map -->

Any picture is a matrix, and any matrix is a sum of rank-one layers σᵢuᵢvᵢᵀ, strongest first. rank keeps the top k, shows you what is lost, and proves on screen that nothing does better. Then it builds the SVD again from scratch with power iteration, and turns the same idea on a crowd of faces to find the eigenfaces.

Everything is strictly black and white and Bayer-dithered. It works on a phone, has no server, and photos you drop in never leave the browser.

## What's on the page

- **The hero.** A portrait rebuilt rank by rank, k = 1, 2, 3 … 128, each new rank wiping down the frame while a singular-value "equaliser" lights up the layers in use. Drag across it to scrub.
- **Cast a shadow.** A tilted spiral galaxy of 320 points in 3D. Two skewed vectors span a plane, Gram–Schmidt straightens them, and every point drops onto the plane with its residual drawn. One button fits the best plane with PCA.
- **Squeeze a picture.** Drop a photo or pick a test image (portrait, plaid, checkerboard, triangle, rings, noise), then scrub the rank. A wipe compares original and rank-k, an error view shows what was thrown away, and a strip shows the first rank-one layers adding up.
- **The spectrum is the error.** Singular values on a log scale; drag across the bars to set k. The measured error ‖A − A_k‖_F lands exactly on the curve predicted from the σ's alone (Eckart–Young).
- **Try to beat the SVD.** Three rank-k approximations, each projecting the picture's columns onto a k-dimensional subspace: random directions, the picture's own columns, and the top singular vectors. A floor line shows none can cross Eckart–Young.
- **Find σ₁ by hand.** Power iteration on a matrix whose σ₂/σ₁ gap you choose. A random vector morphs into the top singular vector while a log plot shows the error falling by (σ₂/σ₁)² per step. Then power iteration and deflation race the library SVD.
- **Eigenfaces.** 200 procedurally drawn faces (no real people). PCA gives a mean face and eigenfaces for lighting, hair, glasses and smile. A face-space map places every face at its first two coordinates, and dragging a crosshair paints faces that were never drawn.

## How it works

**Projections** (`core/projection.ts`): Gram–Schmidt (the modified, stable version) and orthogonal projection QQᵀx.

**Low rank** (`core/lowrank.ts`): A_k = Σ_{i≤k} σᵢuᵢvᵢᵀ from the library SVD, and the cost of storing the factors.

**Eckart–Young** (`core/error.ts`): ‖A − A_k‖_F² = Σ_{i>k} σᵢ², and the share of ‖A‖_F² kept.

**Power iteration** (`core/power.ts`): v ← AᵀAv/‖·‖ without forming AᵀA, with deflation A − σuvᵀ for a top-k SVD.

**PCA** (`core/pca.ts`): centring, then the SVD of the centred data. Components are V's columns, variances are σ²/(n − 1). Encode and decode move between faces and coefficients.

The library SVD (`lib/svd.ts`, one-sided Jacobi) runs in a Web Worker, along with power iteration, the race and PCA on the face crowd.

### What I wrote, and what Claude Code wrote

The maths is mine: 13 functions across five milestones (see [`LEARNING.md`](LEARNING.md)). Claude Code wrote the scaffolding: the Jacobi SVD standing in for a library, the face generator, the worker, the canvases, dithering and UI. Until a function is written, the page shows a *Yours to write* panel in its place, and the vitest suite in `core/__tests__/` (closed forms, invariants, a Läuchli stress test, the convergence rate, covariance eigen-equations) says when it is right.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Canvas 2D · Web Workers · Base UI + shadcn · Spectrum UI · Vitest. No server and no maths library.

## Run

```sh
npm ci
npm run dev                                  # http://localhost:3000/rank
npx vitest src/projects/rank/core            # the maths tests, in watch mode
```
