# lab-kit

**Monochrome maths demos. Claude Code builds the scaffolding, I write the maths.**

<!-- screenshot / GIF: drop docs/hero.gif here -->

The template every project in my lab is created from. It is a Next.js app with my tracker's look (black and white only, Archivo, phone-first), a dithered canvas hero, monochrome charts, Spectrum UI and shadcn components, and one rule:

## The rule: you write the core

Every maths function lives in `src/core/` and starts as a **stub that throws `NotYoursYet`**. Each stub has a JSDoc spec: the maths, the signature and shapes, and what to derive on paper first. It never includes the answer.

- **The app still runs.** Wherever a core is missing, the UI catches `NotYoursYet` and shows a *Yours to write* panel (file, function, what it does, link to the milestone in `LEARNING.md`) over a ghosted preview of what will appear.
- **Tests say when it's right.** `src/core/__tests__/` checks the maths properly: closed forms, invariants, finite-difference gradient checks, convergence. They fail until the core is written.
- **`<CoreStatus>`** probes every core with a tiny input and shows which are written.

Claude Code writes the UI, visualisation, workers and training loops. The cores are mine.

## What's in the kit

| Block | Where | What |
| --- | --- | --- |
| `NotYoursYet`, `isNotYoursYet`, `notYoursYet()` | `src/lib/kit/not-yours-yet.ts` | The stub error. Survives a Web Worker round trip. |
| `useCore`, `<CoreBoundary>`, `withCore`, `<CorePanel>` | `src/components/kit/core-guard.tsx` | Render the panel when a core throws. |
| `<YoursToWrite>`, `<Ghost>` | `src/components/kit/yours-to-write.tsx` | The panel and hatched placeholders. |
| `<CoreStatus cores={CORES}>` | `src/components/kit/core-status.tsx` | Which cores are written. Registry in `src/core/index.ts`. |
| `<PageShell>`, `<Hero>`, `<Section>`, `<Sheet>` | `src/components/kit/page-shell.tsx` | Wide-title hero, numbered sections. |
| `<DitherField>` | `src/components/kit/dither-field.tsx` | Bayer-dithered animated noise. Pass `field` to dither your own function. |
| `<LineChart>`, `<Histogram>`, `<Heatmap>` | `src/components/kit/charts.tsx` | No colour: stroke styles and greys. All take `ghost`. |
| `useCanvas` | `src/components/kit/use-canvas.ts` | DPR-aware canvas, resize, pointer, rAF loop with fps cap. |
| `exposeWorker`, `createWorkerClient`, `useWorker` | `src/lib/kit/worker.ts` | Typed worker calls with progress. |
| `<Stat>`, `useToast()` | `src/components/kit/` | Rolling number tile, Spectrum toast stack. |

Spectrum UI (`@spectrumui` registry): number-ticker, toast-stack, animated-switch, text-states, skeleton-reveal, tilt-card, beam-card (mono), morph-button, hold-to-confirm, kbd-key, orbital-letters, thinking-dots, code-block, inline-code, chart-empty.
shadcn (base-nova, themed): button, card, tabs, slider, switch, toggle-group, badge, separator, tooltip, progress, skeleton.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Base UI + shadcn · Spectrum UI · motion · Vitest. No server: it deploys to Vercel free.

## Run locally

```sh
npm ci
npm run dev          # http://localhost:3000
npm run test:cores   # the maths: fails until the cores are written
npm run test:kit     # the kit itself: always passes
npm run check        # lint + types + kit tests + build
```

Set `NEXT_PUBLIC_REPO_URL=https://github.com/<you>/<repo>` to make milestone links point at `LEARNING.md` on GitHub.

## New project from the kit

```sh
gh repo create AravRaja/<name> --public --template AravRaja/lab-kit --clone
```

Then follow [`TEMPLATE_GUIDE.md`](TEMPLATE_GUIDE.md).
