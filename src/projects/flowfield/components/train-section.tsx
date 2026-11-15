"use client";

import { useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart } from "@/kit/components/charts";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useWorker } from "@/kit/components/use-worker";
import { Ghost } from "@/kit/components/yours-to-write";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers } from "../workers/flow.worker";
import { useShape } from "../lib/shape-store";
import { Kicker } from "./chip";
import { SampleCanvas } from "./sample-canvas";
import { emaSeries, useTrainLoop } from "./use-train-loop";
import { needs, useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";

const BURST = 30;
const BATCH = 128;
const SAMPLE_N = 700;
const SAMPLE_STEPS = 24;

/*
 * M4: train v_θ(x, t) on your shape, live, in a Web Worker. Each step draws (x₀, x₁, t), builds the
 * pair with your M1 cores, scores it with your cfmLoss and backprops your cfmLossGrad. Every second
 * or so the current net is sampled with your Euler step and the particles replay noise → shape.
 */
export function TrainSection() {
  const cores = useFlowCores();
  const shape = useShape();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/flow.worker.ts", import.meta.url)));
  const [losses, setLosses] = useState<[number, number][]>([]);
  const [step, setStep] = useState(0);
  const [rate, setRate] = useState(0);
  const [trainedKey, setTrainedKey] = useState<string | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const paths = useRef<{ flat: Float32Array; P: number; S: number; id: number } | null>(null);
  const inited = useRef<string | null>(null);
  const lastSample = useRef(0);
  const seed = useRef(1);

  const trainMissing = cores ? needs(cores, "path", "loss") : null;
  const sampleMissing = cores ? cores.euler : null;

  const sample = async () => {
    const w = worker.current;
    if (!w || sampleMissing) return;
    const flat = await w.call("sample2d", { n: SAMPLE_N, steps: SAMPLE_STEPS, seed: 99 });
    paths.current = { flat, P: SAMPLE_N, S: SAMPLE_STEPS, id: seed.current++ };
  };

  const loop = useTrainLoop(
    async () => {
      const w = worker.current;
      if (!w) throw new Error("worker not ready");
      if (inited.current !== shape.id + shape.points.length) {
        await w.call("init2d", { points: shape.points, seed: 3 });
        inited.current = shape.id + shape.points.length;
        setTrainedKey(shape.id + shape.points.length);
        setLosses([]);
        setStep(0);
        paths.current = null;
      }
      const r = await w.call("train2d", { steps: BURST, batch: BATCH });
      setStep(r.step);
      setRate(Math.round((BURST / r.ms) * 1000));
      setLosses((prev) => emaSeries(prev, r.losses, r.step - BURST + 1));
      const now = performance.now();
      if (now - lastSample.current > 1400 || r.step <= BURST) {
        lastSample.current = now;
        await sample();
      }
    },
    (e) => {
      if (isNotYoursYet(e)) setMissing(e as NotYoursYet);
      else setError(e instanceof Error ? e : new Error(String(e)));
    },
  );

  const reset = () => {
    loop.stop();
    inited.current = null;
    paths.current = null;
    setLosses([]);
    setStep(0);
    setTrainedKey(null);
  };

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (trainMissing || missing) {
    return <CorePanel error={(trainMissing ?? missing)!} ghost={<div className="flex flex-col gap-3 p-4"><GhostCanvas kind="cloud" /><LineChart ghost series={[]} height={140} /></div>} />;
  }
  if (error) return <CoreError error={error} />;

  const stale = trainedKey !== null && trainedKey !== shape.id + shape.points.length;
  const last = losses.length ? losses[losses.length - 1][1] : 0;

  return (
    <Sheet className="flex flex-col gap-4">
      {sampleMissing ? (
        <CorePanel error={sampleMissing} ghost={<GhostCanvas kind="cloud" />} />
      ) : (
        <SampleCanvas
          source={() => paths.current}
          data={shape.points}
          className="aspect-square"
          caption={() => (paths.current ? `v_θ(x, t) · ${SAMPLE_STEPS} Euler steps` : loop.running ? "first samples soon" : "press train")}
        />
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          onClick={() => {
            if (loop.running) loop.stop();
            else {
              if (stale) reset();
              void loop.start();
            }
          }}
        >
          {loop.running ? <Pause aria-hidden /> : <Play aria-hidden />}
          {loop.running ? "Pause" : step ? "Keep training" : "Train"}
        </Button>
        <Button variant="outline" size="icon" aria-label="Reset network" onClick={reset}>
          <RotateCcw aria-hidden />
        </Button>
      </div>
      {stale && <Kicker>Dataset changed. Training starts over on {shape.label}.</Kicker>}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Step" value={step} />
        <Stat label="Loss" value={last} decimals={2} />
        <Stat label="Steps/s" value={rate} />
      </div>
      {losses.length > 1 ? (
        <LineChart series={[{ label: "CFM loss (EMA)", data: losses }]} height={170} xLabel="step" />
      ) : (
        <LineChart ghost series={[]} height={170} />
      )}
      <Kicker>The loss flattens well above zero. Milestone 4 asks you why.</Kicker>
    </Sheet>
  );
}
