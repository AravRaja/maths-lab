# Template guide (for builder agents)

You are building a lab project from this kit. Claude Code builds everything except the maths cores. The user writes those. Read this before writing code.

## Non-negotiables

- **Black and white only.** Use the tokens `paper` (#000), `sheet` (#0d0d0d), `ink` (#fff), `ink-soft` (#8c8c8c), `rule` (#262626) as Tailwind colours (`bg-sheet`, `text-ink-soft`, `border-rule`). In canvas code, use `grey(level)` from `@/lib/kit/canvas`. Never use a hue: no `red-500`, no `#3b82f6`, no Spectrum colour variants. Tell series apart with stroke style (solid, dashed, dotted), grey level, weight and motion.
- **Archivo's width axis is the type system:** `type-wide` (titles, numbers), `type-semi` (headings), `type-narrow` (labels, small caps with `tracking-[0.2em] uppercase`).
- **Phone first:** check at 375px. No horizontal scroll, 44px tap targets (`min-h-11`; kit buttons are `h-11` by default), `rounded-xl`/`rounded-2xl`, thin `border-rule` borders.
- **Static only:** `output: "export"`. No API routes, no server actions, no secrets. Heavy compute goes in a Web Worker.
- **Never write a maths core's body.** Write the stub, the spec and the tests.

## Steps for a new project

1. `gh repo create AravRaja/<name> --public --template AravRaja/lab-kit --clone`, then `npm ci`.
2. Rename in `package.json`, `src/app/layout.tsx` (metadata) and the README title.
3. **Delete the example:** `src/core/softmax.ts`, its test, `src/workers/example.worker.ts`, `src/app/_demo/`. Keep `LEARNING.md`'s format and replace its content.
4. **Plan the cores** (usually 3 to 8 pure functions): the maths that makes the project interesting, written by the user. Everything else (plumbing, UI, optimiser loops around their gradient, rendering) is yours.
5. **Write each stub** in `src/core/<topic>.ts`:

   ```ts
   import { notYoursYet } from "@/lib/kit/not-yours-yet";
   const FILE = "src/core/returns.ts";

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

   Give the spec, shapes and a paper hint, never the solution or pseudo-code that is the solution. `void` the params so lint passes.
6. **Register cores** in `src/core/index.ts` (`CORES: CoreSpec[]`), each with a tiny `probe` input.
7. **Write the tests** in `src/core/__tests__/*.test.ts`. Test the maths, not one implementation: closed forms, invariants (sum to one, symmetry, shift invariance), finite-difference gradient checks (central differences, h about 1e-5, tolerance about 1e-6), convergence on a toy problem, shapes. **Check your tests against a private reference implementation, then put the stub back.** Never commit the reference.
8. **Build the UI** with the kit blocks (below). Each place a core is used must show `<CorePanel>` with a `ghost` preview when the core is missing.
9. **LEARNING.md:** 3 to 6 milestones, each with an anchor `<a id="m1-..."></a>` matching the stubs' `milestone`. Each has: what to derive on paper, which functions to write, the check (tests plus one "predict before you run it" question), and what becomes visible in the app.
10. **README.md:** tagline, what it is, how it works (short maths, crediting the cores as the user's), stack, run locally, a screenshot placeholder.
11. **Pass:** `npm ci && npm run lint && npx tsc --noEmit && npm run build`. `npm test` may fail only in `src/core/__tests__`. `npm run test:kit` must pass.

## Blocks

### Page

```tsx
<PageShell eyebrow="Lab 03" title={<>Policy<br />gradient</>} tagline="..." visual={<MySignatureCanvas />}>
  <Section index={1} kicker="Train" title="Watch it learn">
    <Sheet>...</Sheet>
  </Section>
</PageShell>
```

The hero `visual` is the screenshot moment: make it live (training, particles, dithered fields). `<DitherField field={(u, v, t) => value01} />` dithers any function you hand it.

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

`<CoreStatus cores={CORES} />` goes near the top of the page.

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
// src/workers/train.worker.ts
import { exposeWorker } from "@/lib/kit/worker";
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

Adding more Spectrum components: `npx shadcn@latest add @spectrumui/<name>`, then grep the new files for hues (`emerald|rose|red|amber|sky|blue|green|violet|#hex`) and swap them for neutrals or tokens, and fix any lint errors (`npm run lint`) before committing. The full catalogue is at https://ui.spectrumhq.in/r/registry.json.

## Commits

Commit in sensible chunks. End each message with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
