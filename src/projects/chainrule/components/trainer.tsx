"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Gauge } from "lucide-react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, runCore } from "@/kit/components/core-guard";
import { LineChart, Heatmap } from "@/kit/components/charts";
import { Stat } from "@/kit/components/stat";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { Button } from "@/components/ui/button";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { Slider } from "@/components/ui/slider";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { makeDataset, DATASETS, type DatasetName } from "@/projects/chainrule/lib/engine/data";
import { initParams, lossGradMatmul, lossGradScalar, splitLayers } from "@/projects/chainrule/lib/engine/mlp";
import { sgdStep } from "@/projects/chainrule/core/sgd";
import { matmulBackward } from "@/projects/chainrule/core/matmul";
import { CORES } from "@/projects/chainrule/core";
import type { Engine, Frame, handlers } from "@/projects/chainrule/workers/train.worker";
import { cn } from "@/lib/utils";
import { BoundaryCanvas } from "./boundary-canvas";

const GRID = 44;
const SEED = 7;
const ALPHA = 1e-4;
const MAX_STEPS = 3000;

function Pills<T extends string | number>({ value, options, onChange, label, render }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; render?: (v: T) => string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "type-narrow min-h-11 min-w-11 rounded-xl border px-3 text-sm tracking-wide transition-colors",
            o === value ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:text-ink",
          )}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline justify-between gap-3">
        <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</span>
        {value && <span className="font-mono text-xs tabular-nums">{value}</span>}
      </p>
      {children}
    </div>
  );
}

export function Trainer() {
  const toast = useToast();
  const [dataset, setDataset] = useState<DatasetName>("moons");
  const [width, setWidth] = useState(8);
  const [depth, setDepth] = useState(2);
  const [lr, setLr] = useState(0.3);
  const [momentum, setMomentum] = useState(0.9);
  const [engine, setEngine] = useState<Engine>("scalar");
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [bench, setBench] = useState<{ scalarMs: number; matmulMs: number; relErr: number | null } | null>(null);
  const [benching, setBenching] = useState(false);
  const state = useRef<{ params?: number[]; velocity?: number[]; step: number; celebrated: boolean }>({ step: 0, celebrated: false });

  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));
  const sizes = useMemo(() => [2, ...Array<number>(depth).fill(width), 1], [width, depth]);
  const data = useMemo(() => makeDataset(dataset, 120, SEED), [dataset]);

  // Which cores does training need that are still stubs? Probe on a 4-point problem.
  const pre = useMemo(
    () =>
      runCore(() => {
        // Report the earliest milestone first: probe the cores this engine needs, in order.
        const need = engine === "matmul" ? ["m1-local-derivatives", "m4-sgd", "m5-matmul"] : ["m1-local-derivatives", "m2-backprop", "m4-sgd"];
        for (const c of CORES) if (need.includes(c.milestone ?? "")) c.probe();
        const d = makeDataset("xor", 4, 1);
        const p = initParams([2, 2, 1], 1);
        const lg = engine === "matmul" ? lossGradMatmul(p, [2, 2, 1], d, ALPHA) : lossGradScalar(p, [2, 2, 1], d, ALPHA);
        return sgdStep(p, lg.grads, p.map(() => 0), { lr: 0.1 });
      }),
    [engine],
  );
  const mm = useMemo(() => runCore(() => matmulBackward([[1]], [[1]], [[1]])), []);
  const blocked = pre.status === "missing" ? pre.missing : missing;

  const start = (over?: Partial<{ lr: number; momentum: number; engine: Engine; sizes: number[]; dataset: DatasetName }>) => {
    const w = worker.current;
    if (!w) return;
    w.restart();
    setRunning(true);
    setError(null);
    setMissing(null);
    const st = state.current;
    w.call(
      "train",
      {
        dataset: over?.dataset ?? dataset,
        seed: SEED,
        sizes: over?.sizes ?? sizes,
        lr: over?.lr ?? lr,
        momentum: over?.momentum ?? momentum,
        alpha: ALPHA,
        engine: over?.engine ?? engine,
        steps: Math.max(1, MAX_STEPS - st.step),
        grid: GRID,
        params: st.params,
        velocity: st.velocity,
        startStep: st.step,
      },
      (v) => {
        const f = v as Frame;
        st.params = f.params;
        st.velocity = f.velocity;
        st.step = f.step;
        setFrame(f);
        setHistory((h) => {
          const next = [...h, [f.step, Math.max(1e-6, f.loss)] as [number, number]];
          return next.length > 500 ? next.filter((_, i) => i % 2 === 0 || i === next.length - 1) : next;
        });
        if (!st.celebrated && f.acc === 1) {
          st.celebrated = true;
          toast({ title: "Separated", description: `100% of points classified at step ${f.step}.`, status: "success" });
        }
      },
    )
      .then(() => setRunning(false))
      .catch((e: unknown) => {
        if (isNotYoursYet(e)) {
          setMissing(e);
          setRunning(false);
        } else if (e instanceof Error && e.message === "Worker terminated") {
          /* paused or restarted */
        } else {
          setError(e instanceof Error ? e : new Error(String(e)));
          setRunning(false);
        }
      });
  };

  const pause = () => {
    worker.current?.restart();
    setRunning(false);
  };

  const reset = (keepRunning = false, over?: Parameters<typeof start>[0]) => {
    worker.current?.restart();
    state.current = { step: 0, celebrated: false };
    setFrame(null);
    setHistory([]);
    setBench(null);
    if (keepRunning) start(over);
    else setRunning(false);
  };

  // Changing a hyperparameter mid-run carries on from the same weights.
  const tweak = (over: Parameters<typeof start>[0]) => {
    if (running) start(over);
  };

  const runBench = () => {
    const w = worker.current;
    if (!w) return;
    setBenching(true);
    w.call("bench", { dataset, seed: SEED, sizes, alpha: ALPHA, params: state.current.params })
      .then((b) => setBench(b))
      .catch((e: unknown) => {
        if (isNotYoursYet(e)) setMissing(e);
        else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => setBenching(false));
    setRunning(false);
  };

  const layers = useMemo(() => (frame ? splitLayers(frame.grads, sizes) : null), [frame, sizes]);

  return (
    <>
      <Section id="train" index={4} kicker="Live training" title="Bend a boundary">
        <p className="mb-5 text-ink-soft">
          A {sizes.join("→")} tanh network learns to separate two classes. Every gradient comes from your engine and every
          update from your <code className="font-mono text-ink">sgdStep()</code>, in a Web Worker.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-rule">
            <BoundaryCanvas data={data} grid={frame?.grid ?? null} g={GRID} />
          </div>
          <Sheet className="flex flex-col gap-4">
            <Field label="Data">
              <Pills label="Dataset" value={dataset} options={DATASETS} onChange={(d) => { setDataset(d); reset(running, { dataset: d }); }} />
            </Field>
            <Field label="Hidden layers × width">
              <div className="flex flex-wrap gap-2">
                <Pills label="Depth" value={depth} options={[1, 2] as const} onChange={(d) => { setDepth(d); reset(running, { sizes: [2, ...Array<number>(d).fill(width), 1] }); }} render={(d) => `${d}×`} />
                <Pills label="Width" value={width} options={[4, 8, 16] as const} onChange={(w) => { setWidth(w); reset(running, { sizes: [2, ...Array<number>(depth).fill(w), 1] }); }} />
              </div>
            </Field>
            <Field label="Learning rate" value={`η = ${lr.toFixed(2)}`}>
              <Slider min={0.02} max={1.5} step={0.02} value={[lr]} onValueChange={(v) => setLr(Array.isArray(v) ? v[0] : v)} onValueCommitted={(v) => tweak({ lr: Array.isArray(v) ? v[0] : v })} aria-label="learning rate" />
            </Field>
            <Field label="Momentum" value={`μ = ${momentum.toFixed(2)}`}>
              <Slider min={0} max={0.98} step={0.01} value={[momentum]} onValueChange={(v) => setMomentum(Array.isArray(v) ? v[0] : v)} onValueCommitted={(v) => tweak({ momentum: Array.isArray(v) ? v[0] : v })} aria-label="momentum" />
            </Field>
            <Field label="Engine">
              <Pills label="Engine" value={engine} options={["scalar", "matmul"] as const} onChange={(e) => { setEngine(e); setMissing(null); tweak({ engine: e }); }} render={(e) => (e === "scalar" ? "scalar graph" : "matmul-lite")} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {running ? (
                <Button onClick={pause}><Pause /> Pause</Button>
              ) : (
                <Button onClick={() => start()} disabled={!!blocked || (frame?.step ?? 0) >= MAX_STEPS}><Play /> {frame ? "Resume" : "Train"}</Button>
              )}
              <Button variant="outline" onClick={() => reset(false)}><RotateCcw /> Reset</Button>
            </div>
          </Sheet>
        </div>

        {blocked && <CorePanel className="mt-4" error={blocked} ghost={<LineChart ghost height={160} series={[]} />} />}
        {pre.status === "error" && <div className="mt-4"><CoreError error={pre.error} /></div>}
        {error && <div className="mt-4"><CoreError error={error} /></div>}

        {!blocked && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Step" value={frame?.step ?? 0} />
            <Stat label="Loss" value={frame?.loss ?? 0} decimals={3} />
            <Stat label="Accuracy" value={(frame?.acc ?? 0) * 100} decimals={1} suffix="%" />
            <Stat label="Steps / s" value={Math.round(frame?.stepsPerSec ?? 0)} />
          </div>
        )}
        {!blocked && (
          <Sheet className="mt-4">
            {history.length > 1 ? (
              <LineChart height={180} logY series={[{ label: "hinge loss + L2", data: history }]} xLabel="step" />
            ) : (
              <LineChart ghost height={180} series={[]} />
            )}
          </Sheet>
        )}
      </Section>

      <Section id="matmul" index={5} kicker="Matmul-lite" title="Same gradients, whole layers at once">
        <p className="mb-5 text-ink-soft">
          The scalar graph builds a node for every multiply. Real networks do a layer in one matrix product, with one backward
          rule for the lot. The bias rides along as an extra row, fed by a column of ones.
        </p>
        {mm.status === "missing" ? (
          <CorePanel
            error={mm.missing}
            ghost={
              <div className="grid grid-cols-3 gap-2 p-4">
                {[0, 1, 2].map((i) => <Heatmap key={i} ghost dither values={[]} rows={8} cols={8} />)}
              </div>
            }
          />
        ) : mm.status === "error" ? (
          <CoreError error={mm.error} />
        ) : (
          <div className="flex flex-col gap-4">
            <Sheet>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Race the engines on one batch</p>
                <MorphButton size="lg" onClick={runBench} state={benching ? "loading" : "idle"} loadingLabel="Timing…" disabled={!!blocked}>
                  <Gauge className="size-4" /> Benchmark
                </MorphButton>
              </div>
              {bench && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Scalar ms" value={bench.scalarMs} decimals={1} />
                  <Stat label="Matmul ms" value={bench.matmulMs} decimals={2} />
                  <Stat label="Speed-up" value={bench.scalarMs / bench.matmulMs} decimals={1} suffix="×" />
                  <div className="rounded-2xl border border-rule bg-sheet p-4">
                    <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Grad rel err</p>
                    <p className="type-wide mt-1 text-2xl tabular-nums">{bench.relErr === null ? "m3" : bench.relErr.toExponential(0)}</p>
                  </div>
                </div>
              )}
            </Sheet>
            <Sheet>
              <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">|∂L/∂W| per layer, last step (bottom row = bias)</p>
              {layers ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] items-start gap-3">
                  {layers.map((L, i) => (
                    <figure key={i} className="min-w-0">
                      <Heatmap dither values={L.values.map(Math.abs)} rows={L.rows} cols={L.cols} aspect={Math.min(2.5, L.rows / L.cols)} />
                      <figcaption className="type-narrow mt-1 text-xs text-ink-soft">W{i + 1} · {L.rows}×{L.cols}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">Train for a step to see where the gradient lands.</p>
              )}
            </Sheet>
          </div>
        )}
      </Section>
    </>
  );
}
