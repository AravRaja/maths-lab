"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { useWorker } from "@/kit/components/use-worker";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { ghostSweeps } from "../lib/dp-helpers";
import { td0Update } from "../core/td";
import type { handlers as LearnHandlers, TdFrame } from "../workers/learn.worker";
import { useLab } from "./world-store";
import { GridView, Badge } from "./grid-view";
import { Knob, Readout, fmt, lc } from "./bits";

/**
 * Section 4b: TD(0) watching a random walker. No model, just samples: V(s) ← V(s) + α(r + γV(s′) − V(s)).
 * Side by side with the DP answer from the user's expectation backup, plus the RMS gap over episodes.
 */
export function TdLab() {
  const { world, params, gamma, version } = useLab();
  const worker = useWorker<typeof LearnHandlers>(() => new Worker(new URL("../workers/learn.worker.ts", import.meta.url)));
  const [alpha, setAlpha] = useState(0.1);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<TdFrame | null>(null);
  const [truth, setTruth] = useState<Float64Array | null>(null);
  const [curve, setCurve] = useState<[number, number][]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const resume = useRef<TdFrame | null>(null);
  const seeds = useRef(1);
  const probe = useCore(() => td0Update(new Float64Array(2), 0, 0, 1, true, 0.1, 0.9), []);

  const stop = () => {
    worker.current?.restart();
    setRunning(false);
  };
  const reset = () => {
    stop();
    resume.current = null;
    setFrame(null);
    setTruth(null);
    setCurve([]);
  };
  // A new world invalidates what was learned.
  useEffect(() => {
    worker.current?.restart();
    resume.current = null;
    const id = setTimeout(() => { setRunning(false); setFrame(null); setTruth(null); setCurve([]); }, 0);
    return () => clearTimeout(id);
  }, [version, worker]);

  const run = async () => {
    const w = worker.current;
    if (!w) return;
    setRunning(true);
    try {
      await w.call(
        "td0",
        { world, params, gamma, alpha, episodes: 20000, perFrame: 25, maxSteps: 300, seed: ++seeds.current, V: resume.current?.V, episode0: resume.current?.episode },
        (p) => {
          const f = p as TdFrame;
          resume.current = f;
          setFrame(f);
          if (f.truth) setTruth(f.truth);
          const rms = f.rms;
          // Keep the whole run (so the early fall stays visible): halve the resolution when it gets long.
          if (rms != null)
            setCurve((c) => {
              const next: [number, number][] = [...c, [f.episode, rms]];
              return next.length > 400 ? next.filter((_, i) => i % 2 === 0 || i === next.length - 1) : next;
            });
        },
      );
      setMissing(null);
      setRunning(false);
    } catch (e) {
      setRunning(false);
      if (isNotYoursYet(e)) setMissing(e);
      else if (e instanceof Error && e.message !== "Worker terminated") setError(e);
    }
  };

  const ghost = ghostSweeps(world, 5)[5];
  const gap = missing ?? probe.missing;
  if (gap)
    return (
      <CorePanel
        error={gap}
        ghost={<div className="grid grid-cols-2 gap-2 p-2"><GridView world={world} values={ghost} contours={false} className="aspect-square" /><GridView world={world} values={ghost} contours={false} className="aspect-square" /></div>}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <GridView world={world} values={frame?.V ?? null} trail={running ? frame?.trail ?? null : null} agentSpeed={40} loopTrail={false} contours={false} className="aspect-square" badge={<Badge solid>TD(0) · ep {frame?.episode ?? 0}</Badge>} />
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Learned from samples</p>
        </div>
        <div className="flex flex-col gap-2">
          <GridView world={world} values={truth} contours={false} className="aspect-square" badge={<Badge>{truth ? "DP · V^π" : "needs T^π"}</Badge>} />
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">DP answer (random policy)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Episodes" value={frame?.episode ?? 0} />
        <Readout label="RMS gap" value={fmt(frame?.rms)} />
      </div>
      <Sheet className="flex flex-col gap-4">
        <Knob label="α step size" value={alpha} min={0.01} max={0.5} step={0.01} onChange={setAlpha} />
        <div className="flex gap-2">
          {running ? (
            <Button className="min-h-11 flex-1" onClick={stop}><Pause className="size-4" aria-hidden /> Pause</Button>
          ) : (
            <Button className="min-h-11 flex-1" onClick={run}><Play className="size-4" aria-hidden /> Run TD(0)</Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={reset}><RotateCcw className="size-4" aria-hidden /> Reset</Button>
        </div>
      </Sheet>
      {error && <CoreError error={error} />}
      {curve.length > 2 && (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">{lc("RMS(V_TD − V^π) over episodes")}</p>
          <LineChart height={170} logY xLabel="episode" series={[{ label: "RMS", data: curve }]} />
        </Sheet>
      )}
    </div>
  );
}
