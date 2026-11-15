"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { LineChart } from "@/kit/components/charts";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useWorker } from "@/kit/components/use-worker";
import { Ghost } from "@/kit/components/yours-to-write";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers } from "../workers/flow.worker";
import { SHAPE_POINTS } from "../lib/config";
import { GLYPHS, glyphPoints } from "../lib/glyphs";
import { Chip, Kicker } from "./chip";
import { SampleCanvas } from "./sample-canvas";
import { emaSeries, useTrainLoop } from "./use-train-loop";
import { needs, useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";

const CLASSES = GLYPHS.slice(0, 4);
const N_BIG = 700;
const N_THUMB = 220;
const STEPS = 20;

type Paths = { flat: Float32Array; P: number; S: number; id: number } | null;

/*
 * M5: one network, four glyphs. The label is a one-hot context (all zeros = no context), dropped
 * with your dropLabel during training. At sampling time your guidedVelocity blends the conditional
 * and unconditional predictions with weight w.
 */
export function GuidanceSection() {
  const cores = useFlowCores();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/flow.worker.ts", import.meta.url)));
  const [label, setLabel] = useState(0);
  const [w, setW] = useState(1.5);
  const [losses, setLosses] = useState<[number, number][]>([]);
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const big = useRef<Paths>(null);
  const thumbs = useRef<Paths[]>([null, null, null, null]);
  const inited = useRef(false);
  const lastSample = useRef(0);
  const ctl = useRef({ label: 0, w: 1.5 });

  const sets = useMemo(() => CLASSES.map((g, i) => glyphPoints(g, SHAPE_POINTS, 31 + i)), []);
  const trainMissing = cores ? needs(cores, "path", "loss", "guidance") : null;
  const sampleMissing = cores ? cores.euler : null;

  const onErr = (e: unknown) => {
    if (isNotYoursYet(e)) setMissing(e as NotYoursYet);
    else setError(e instanceof Error ? e : new Error(String(e)));
  };

  const sample = async (all: boolean) => {
    const wk = worker.current;
    if (!wk || sampleMissing || !inited.current) return;
    const { label: l, w: ww } = ctl.current;
    const flat = await wk.call("sampleCond", { label: l, w: ww, n: N_BIG, steps: STEPS, seed: 5 });
    big.current = { flat, P: N_BIG, S: STEPS, id: Date.now() };
    if (all)
      for (let i = 0; i < CLASSES.length; i++) {
        const f = await wk.call("sampleCond", { label: i, w: ww, n: N_THUMB, steps: STEPS, seed: 8 });
        thumbs.current[i] = { flat: f, P: N_THUMB, S: STEPS, id: Date.now() };
      }
  };

  const loop = useTrainLoop(async () => {
    const wk = worker.current;
    if (!wk) throw new Error("worker not ready");
    if (!inited.current) {
      await wk.call("initCond", { sets, seed: 4, pDrop: 0.15 });
      inited.current = true;
    }
    const r = await wk.call("trainCond", { steps: 25, batch: 128 });
    setStep(r.step);
    setLosses((prev) => emaSeries(prev, r.losses, r.step - 24));
    if (performance.now() - lastSample.current > 2000) {
      lastSample.current = performance.now();
      await sample(true);
    }
  }, onErr);

  const update = (l: number, ww: number) => {
    ctl.current = { label: l, w: ww };
    setLabel(l);
    setW(ww);
    if (!loop.running) sample(true).catch(onErr);
  };

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (trainMissing || missing) return <CorePanel error={(trainMissing ?? missing)!} ghost={<GhostCanvas kind="cloud" />} />;
  if (error) return <CoreError error={error} />;

  const lastLoss = losses.length ? losses[losses.length - 1][1] : 0;

  return (
    <Sheet className="flex flex-col gap-4">
      {sampleMissing ? (
        <CorePanel error={sampleMissing} ghost={<GhostCanvas kind="cloud" />} />
      ) : (
        <SampleCanvas
          source={() => big.current}
          className="aspect-square"
          caption={() => (big.current ? `${label < 0 ? "no context" : CLASSES[label]} · w = ${w.toFixed(2)}` : step ? "sampling…" : "press train")}
        />
      )}
      {!sampleMissing && (
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => update(i, w)}
              aria-label={`Show ${g}`}
              className="relative min-h-11 overflow-hidden rounded-xl"
            >
              <SampleCanvas source={() => thumbs.current[i]} small className={label === i ? "aspect-square border-ink" : "aspect-square"} period={2.4} />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Context">
        {CLASSES.map((g, i) => (
          <Chip key={g} active={label === i} onClick={() => update(i, w)} className="font-serif text-lg">
            {g}
          </Chip>
        ))}
        <Chip active={label === -1} onClick={() => update(-1, w)} className="type-narrow text-xs tracking-[0.15em] uppercase">
          ∅ none
        </Chip>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Kicker>Guidance weight w</Kicker>
          <span className="type-wide tabular-nums">{w.toFixed(2)}</span>
        </div>
        <Slider
          aria-label="Guidance weight"
          min={0}
          max={4}
          step={0.25}
          value={[w]}
          disabled={label < 0}
          onValueChange={(x) => update(label, Array.isArray(x) ? x[0] : x)}
        />
      </div>
      <Button onClick={() => (loop.running ? loop.stop() : void loop.start())}>
        {loop.running ? <Pause aria-hidden /> : <Play aria-hidden />}
        {loop.running ? "Pause" : step ? "Keep training" : "Train the conditional net"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Step" value={step} />
        <Stat label="Loss" value={lastLoss} decimals={2} />
      </div>
      {losses.length > 1 && <LineChart series={[{ label: "conditional CFM loss", data: losses }]} height={150} xLabel="step" />}
      <Kicker>Needs about 1500 steps before the glyphs separate. Then push w past 1 and watch what happens to the spread.</Kicker>
    </Sheet>
  );
}
