# Building a project in maths-lab

Seven builders work on this repo at once, one project each. These rules keep you out of each other's way. Read all of it before writing code.

## Your folder, and only your folder

You own exactly two places:

```
src/projects/<slug>/        everything for your project
src/app/<slug>/page.tsx     your page (and any other files under src/app/<slug>/)
training/<slug>/            only if you have offline training scripts (Python etc.)
```

Inside `src/projects/<slug>/`:

| Path | What |
| --- | --- |
| `meta.ts` | Already exists. Fill in `tagline`, `topic`, set `status: "live"` when the page is real, and list every core in `cores` (each `CoreSpec` with a tiny `probe`). Keep `slug` and `week`. |
| `core/*.ts` | The maths cores: stubs that throw `notYoursYet(...)`, with a JSDoc spec. The user writes the bodies. |
| `core/__tests__/*.test.ts` | Vitest tests that really check the maths. They fail on stubs. |
| `core/index.ts` | Optional: export `CORES` here and import it into `meta.ts` (as chainrule and say-and-reach do). |
| `components/` | Your React components (canvas, sections, hero). |
| `workers/` | Your Web Workers. |
| `lib/` | Plumbing that isn't a core (simulators, networks, data). Non-core tests go in `lib/**/__tests__/` and must pass. |
| `LEARNING.md` | Already exists as a placeholder. Replace with 3 to 6 milestones. |
| `README.md` | The portfolio write-up for the project. |
| assets | Images, JSON, weights: put them in your folder and `import` them, or under `public/<slug>/` if they must be served as files. |

**Do not edit** anything outside those places: not `src/kit/`, `src/components/`, `src/projects/registry.ts`, `src/projects/types.ts`, `src/projects/project-*.tsx`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, configs, or another project's folder. If you need a kit change or a new dependency, say so in your report; the integrator makes it. A plain `npx shadcn@latest add` writes into `src/components/` (and sometimes `package.json`); see the Components section below for adding one into your own folder.

Import from other projects never. Import shared code only from `@/kit`, `@/kit/components/*`, `@/components/*`, `@/lib/utils`, `@/lib/ease`, and `@/projects/project-page`, `@/projects/project-cores`.

## The page

`src/app/<slug>/page.tsx` already renders a "being built" placeholder. Replace its body, keep the shape:

```tsx
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { Section } from "@/kit/components/page-shell";
import { MyHero } from "@/projects/<slug>/components/my-hero";

export const metadata = projectMetadata("<slug>");

export default function Page() {
  return (
    <ProjectPage slug="<slug>" title={<>Two<br />lines</>} visual={<MyHero />}>
      <Section index={1} kicker="Progress" title="The cores">
        <ProjectCores slug="<slug>" />
      </Section>
      ...
    </ProjectPage>
  );
}
```

## Cores: the user writes the maths

- Every stub's `file` is its repo path, e.g. `"src/projects/<slug>/core/returns.ts"`, and `milestone` is an anchor in your `LEARNING.md` (`<a id="m1-returns"></a>`). The *Yours to write* links are built from those two, so get them exactly right.
- JSDoc on each stub: the maths, the signature and shapes, and what to derive on paper first. Never the solution, never pseudo-code that is the solution. `void` the params so lint passes.

```ts
import { notYoursYet } from "@/kit/not-yours-yet";
const FILE = "src/projects/bellman/core/returns.ts";

/**
 * Discounted returns.
 *
 * Maths:   G_t = Σ_{k≥0} γ^k r_{t+k}
 * Signature: discountedReturns(rewards: number[], gamma: number) => number[]   (same length)
 *
 * On paper first:
 *  - Write G_t in terms of G_{t+1}. Which direction should the loop run?
 *  - What is G_0 for constant reward r over an infinite horizon?
 */
export function discountedReturns(rewards: number[], gamma: number): number[] {
  void rewards; void gamma;
  throw notYoursYet({ file: FILE, fn: "discountedReturns", milestone: "m1-returns", summary: "Turns a reward trace into returns." });
}
```

- Tests: closed forms, invariants, finite-difference gradient checks (central, h about 1e-5), convergence on a toy problem, shapes. **Check your tests against a private reference implementation, then put the stub back. Never commit the reference.**
- Everything that is not a core (UI, plumbing, the optimiser loop round the user's gradient, rendering) is yours to build fully.

## LEARNING.md

3 to 6 milestones. Each: an anchor matching the stubs, what to derive on paper, which functions to write, the check (`npx vitest run src/projects/<slug>/core/__tests__/<file>` plus one "predict before you run it" question), and what lights up on the page. Accurate maths, no answers.

## Design (non-negotiable)

- **Black and white only.** Tokens `paper` #000, `sheet` #0d0d0d, `ink` #fff, `ink-soft` #8c8c8c, `rule` #262626 as Tailwind colours (`bg-sheet`, `text-ink-soft`, `border-rule`). In canvas code use `grey(level)` from `@/kit/canvas`. No hue anywhere, including Spectrum colour variants. Tell series apart by stroke style, grey, weight and motion.
- **Archivo's width axis:** `type-wide` (titles, numbers), `type-semi` (headings), `type-narrow` (labels; small caps with `tracking-[0.2em] uppercase`).
- **Phone first:** check at 375px. No horizontal scroll, 44px tap targets (`min-h-11`), `rounded-xl`/`rounded-2xl`, thin `border-rule` borders.
- **Flashy and unique:** a signature visual someone would screenshot (canvas, dithering, motion, live training). Monochrome.
- **Static only:** `output: "export"`. No API routes, no server actions, no secrets. Heavy compute in a Web Worker under `workers/`.

## Blocks

### Page

```tsx
<ProjectPage slug="ppo-arena" title={<>PPO<br />arena</>} visual={<MySignatureCanvas />}>
  <Section index={1} kicker="Train" title="Watch it learn">
    <Sheet>...</Sheet>
  </Section>
</ProjectPage>
```

`ProjectPage` (from `@/projects/project-page`) is the kit's `PageShell` plus the maths-lab breadcrumb and prev/next links; title, tagline and eyebrow default to `meta.ts`. The hero `visual` is the screenshot moment: make it live (training, particles, dithered fields). `<DitherField field={(u, v, t) => value01} />` dithers any function you hand it.

### Core missing? Show the panel

```tsx
// Synchronous, in render:
const r = useCore(() => discountedReturns(rewards, gamma), [rewards, gamma]);
if (r.status === "missing") return <CorePanel error={r.missing} ghost={<LineChart ghost series={[]} />} />;
if (r.status === "error") return <CoreError error={r.error} />;
return <LineChart series={[{ label: "G_t", data: r.value }]} />;

// Or wrap a component that calls cores while rendering:
<CoreBoundary ghost={<Heatmap ghost values={[]} rows={8} cols={8} />}><ValueMap /></CoreBoundary>
const Safe = withCore(ValueMap, <Ghost label="value map" className="h-64" />);

// Inside a canvas loop or event handler: try/catch with isNotYoursYet(e), store it in state, render <CorePanel>.
```

`<ProjectCores slug="<slug>" />` (from `@/projects/project-cores`) goes near the top of the page: it is `<CoreStatus>` driven by your `meta.ts`.

### Canvas

```tsx
const ref = useCanvas(({ ctx, width, height, t, dt, pointer }) => {
  ctx.clearRect(0, 0, width, height);   // CSS px; DPR is handled
  ctx.fillStyle = grey(1);
}, { fps: 30 });                        // { animate: false } for static redraws on resize/deps
return <canvas ref={ref} className="h-72 w-full rounded-2xl border border-rule" />;
```

Keep simulation state in refs, not React state, inside the loop. Reduced motion draws one frame.

### Workers

```ts
// src/projects/<slug>/workers/train.worker.ts
import { exposeWorker } from "@/kit/worker";
export const handlers = { train(args: { steps: number }, progress: (v: unknown) => void) { /* call cores */ return result; } };
exposeWorker(handlers);
```

```tsx
const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));
const out = await worker.current!.call("train", { steps: 500 }, (p) => setProgress(p as number));
```

Write the `new URL(...)` literally at the call site. `NotYoursYet` thrown in the worker is rebuilt on the page, so catch it with `isNotYoursYet`. Use `import type { handlers }` on the page side. For streaming frames, post progress objects (for example `{ step, loss, params }`) and draw them.

### Charts (monochrome)

- `<LineChart series={[{ label, data, stroke? }]} logY xLabel yLabel />`: data is `number[]` or `[x, y][]`.
- `<Histogram samples={xs} bins={40} density overlay={pdf} />` or `counts={...}`.
- `<Heatmap values={flat} rows cols dither onCell={...} aspect={rows / cols} />`.
- All take `ghost` for a placeholder shape.

### Components

- Kit: `Stat`, `useToast()` (`toast({ title, description, status: "success" | "neutral" | "error" | "loading" })`), `Ghost`, `Sheet`.
- Spectrum (`src/components/spectrumui`, `src/components/motion`): `NumberTicker`, `AnimatedToastStack`, `AnimatedSwitch`, `TextStates`, `SkeletonReveal`, `TiltCard`, `BeamCard` (mono only), `MorphButton`, `HoldToConfirmButton`, `KbdKey`, `OrbitalText`, `ThinkingDots`, `CodeBlock`, `InlineCode`, `ChartEmpty`.
- shadcn (`src/components/ui`, Base UI): `Button` (use `render={<a href=... />} nativeButton={false}` for links), `Card`, `Tabs`, `Slider` (`onValueChange` gives `number | number[]`), `Switch`, `ToggleGroup` (array values), `Badge`, `Separator`, `Tooltip`, `Progress`, `Skeleton`.

More Spectrum components: the catalogue is at https://ui.spectrumhq.in/r/registry.json. To add one while builders are working in parallel, run `npx shadcn@latest add @spectrumui/<name> --path src/projects/<slug>/components/spectrum` if it has no new npm dependencies (check the registry JSON), otherwise ask the integrator. Either way, grep the new files for hues (`emerald|rose|red|amber|sky|blue|green|violet|#hex`), swap them for tokens, and run `npm run lint`.

## Checks before you hand back

```sh
npm ci && npm run lint && npx tsc --noEmit && npm run build
npm run test:kit                          # must pass (everything except core tests)
npx vitest run src/projects/<slug>/core   # must fail only with NotYoursYet
```

## Git

Commit only files in your folders. `git pull --rebase` before pushing; because nobody else touches your files, rebases are clean. End every commit message with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
