"use client";

import { useRef, useState } from "react";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { Ghost } from "@/kit/components/yours-to-write";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import type { TrainProgress } from "@/projects/say-and-reach/lib/arm/train";
import { setPolicies, usePolicies } from "@/projects/say-and-reach/lib/arm/store";
import { grey } from "@/kit/canvas";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers } from "@/projects/say-and-reach/workers/train.worker";
import { drawTable, toPx } from "./draw";
import { TableCanvas } from "./table-canvas";

/*
 * M3 + M4: record expert demos in a worker, then train either head there with the user's
 * loss core. Weight snapshots stream back every 250 steps, so the playground and hero start
 * using the policy while it is still learning.
 */

type Head = "gaussian" | "flow";

export function TeachSection() {
  const avail = useAvailability();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));
  const toast = useToast();
  const [episodes, setEpisodes] = useState(500);
  const [twoWay, setTwoWay] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demos, setDemos] = useState<{ n: number; episodes: number; traces: [number, number][][]; twoWay: boolean } | null>(null);
  const [busy, setBusy] = useState<Head | "demos" | null>(null);

  const record = async () => {
    setBusy("demos");
    setDemoProgress(0);
    try {
      const out = await worker.current!.call("demos", { episodes, seed: 7, twoWay }, (p) => setDemoProgress(Number(p)));
      setDemos({ ...out, twoWay });
      setDemoProgress(1);
      setPolicies({ twoWay });
      toast({ title: `${out.n.toLocaleString()} expert steps recorded`, description: `${out.episodes} episodes${twoWay ? ", two-way" : ""}`, status: "success" });
    } finally {
      setBusy(null);
    }
  };

  if (avail?.ik) return <CorePanel error={avail.ik} ghost={<Ghost label="expert demos" className="h-64" />} />;

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-4">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Expert episodes</span>
            <span className="type-wide text-2xl tabular-nums">{episodes}</span>
          </div>
          <Slider min={100} max={900} step={50} value={episodes} aria-label="Number of demo episodes" onValueChange={(v) => setEpisodes(Array.isArray(v) ? v[0] : v)} />
        </div>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-sm">Two-way expert</span>
            <span className="block text-xs text-ink-soft">Flip a coin each episode for which way round the object to walk.</span>
          </span>
          <AnimatedSwitch checked={twoWay} onCheckedChange={setTwoWay} label="Two-way expert" />
        </label>
        <MorphButton onAction={record} disabled={busy !== null} loadingLabel="Recording" successLabel="Recorded" size="lg" className="w-full">
          Record demos
        </MorphButton>
        <Progress value={demoProgress * 100} />
      </Sheet>

      {demos && (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <TableCanvas
            animate={false}
            label="Fingertip paths of the first demos"
            draw={({ ctx, v, buf, t }) => {
              ctx.fillStyle = grey(0);
              ctx.fillRect(0, 0, v.width, v.height);
              drawTable(ctx, v, buf, t);
              demos.traces.forEach((tr, k) => {
                ctx.strokeStyle = grey(1, 0.18 + 0.5 * ((k * 37) % 11) / 11);
                ctx.lineWidth = 1;
                ctx.beginPath();
                tr.forEach(([x, y], i) => {
                  const [px, py] = toPx(v, x, y);
                  if (i) ctx.lineTo(px, py);
                  else ctx.moveTo(px, py);
                });
                ctx.stroke();
              });
            }}
          />
          <div className="grid grid-cols-2 gap-3 sm:w-44 sm:grid-cols-1">
            <Stat label="Episodes" value={demos.episodes} />
            <Stat label="Samples" value={demos.n} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <HeadCard
          head="gaussian"
          title="Gaussian head"
          blurb="Behaviour cloning: maximise the likelihood of the expert's action. Your gaussianNll() is the loss."
          missing={avail?.gaussian ?? null}
          disabled={!demos || (busy !== null && busy !== "gaussian")}
          onBusy={(b) => setBusy(b ? "gaussian" : null)}
          worker={worker}
        />
        <HeadCard
          head="flow"
          title="Flow head"
          blurb="Flow matching: learn the velocity that carries noise to the expert's action. Your flowPair() makes the targets."
          missing={avail?.flowTrain ?? null}
          disabled={!demos || (busy !== null && busy !== "flow")}
          onBusy={(b) => setBusy(b ? "flow" : null)}
          worker={worker}
        />
      </div>
      {!demos && <p className="text-sm text-ink-soft">Record demos first: both heads learn from the same expert episodes.</p>}
    </div>
  );
}

function HeadCard({
  head,
  title,
  blurb,
  missing: missingCore,
  disabled,
  onBusy,
  worker,
}: {
  head: Head;
  title: string;
  blurb: string;
  missing: NotYoursYet | null;
  disabled: boolean;
  onBusy: (b: boolean) => void;
  worker: ReturnType<typeof useWorker<typeof handlers>>;
}) {
  const toast = useToast();
  const policies = usePolicies();
  const [steps, setSteps] = useState(4000);
  const [losses, setLosses] = useState<[number, number][]>([]);
  const [progress, setProgress] = useState(0);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const t0 = useRef(0);

  const train = async () => {
    onBusy(true);
    setLosses([]);
    setProgress(0);
    setErr(null);
    t0.current = performance.now();
    try {
      const w = await worker.current!.call("train", { head, steps }, (p) => {
        const q = p as TrainProgress;
        setProgress(q.step / steps);
        setLosses((old) => (old.length && old[old.length - 1][0] === q.step ? old : [...old, [q.step, q.loss]]));
        if (q.weights) setPolicies({ [head]: q.weights, training: { [head]: true } });
      });
      setPolicies({ [head]: w, training: { [head]: false } });
      setMissing(null);
      toast({ title: `${title} trained`, description: `${steps.toLocaleString()} steps in ${((performance.now() - t0.current) / 1000).toFixed(0)} s. Try it in the playground.`, status: "success" });
    } catch (e) {
      if (isNotYoursYet(e)) {
        setMissing(e);
        toast({ title: `${e.fn}() is yours to write`, description: e.file, status: "neutral" });
        return;
      }
      setErr(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      onBusy(false);
    }
  };

  const blocked = missing ?? missingCore;
  const last = losses[losses.length - 1];
  return (
    <Sheet className="flex flex-col gap-4">
      <div>
        <p className="type-semi text-lg">{title}</p>
        <p className="text-sm text-ink-soft">{blurb}</p>
      </div>
      {blocked ? (
        <CorePanel error={blocked} ghost={<div className="p-3"><LineChart ghost series={[]} height={140} /></div>} />
      ) : (
        <>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Gradient steps</span>
              <span className="font-mono text-sm tabular-nums">{steps.toLocaleString()}</span>
            </div>
            <Slider min={500} max={8000} step={500} value={steps} aria-label={`${title} training steps`} onValueChange={(v) => setSteps(Array.isArray(v) ? v[0] : v)} />
          </div>
          <MorphButton onAction={train} disabled={disabled} loadingLabel="Training" successLabel="Trained" size="lg" className="w-full">
            Train {head === "gaussian" ? "Gaussian" : "flow"} head
          </MorphButton>
          <Progress value={progress * 100} />
          {losses.length > 1 ? (
            <LineChart series={[{ label: head === "gaussian" ? "NLL (EMA)" : "flow MSE (EMA)", data: losses }]} height={150} xLabel="step" />
          ) : (
            <LineChart ghost series={[]} height={150} />
          )}
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">{policies[head] ? (policies.training?.[head] ? "live snapshot in use" : "trained, in use") : "untrained"}</span>
            <span className="font-mono tabular-nums">{last ? last[1].toFixed(3) : "-"}</span>
          </div>
          {err && <CoreError error={err} />}
        </>
      )}
    </Sheet>
  );
}
