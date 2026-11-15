"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { useWorker } from "@/kit/components/use-worker";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { greedyPolicy } from "../core/lookahead";
import { epsilonGreedy } from "../core/explore";
import { qLearningUpdate } from "../core/td";
import { valueIteration } from "../core/value-iteration";
import { maxPerState } from "../lib/policy";
import { ghostSweeps } from "../lib/dp-helpers";
import type { handlers as LearnHandlers, QFrame } from "../workers/learn.worker";
import { useLab, useMdp } from "./world-store";
import { GridView, Badge } from "./grid-view";
import { Chip, Knob, Readout, Unlocks, fmt, lc } from "./bits";

const SPEEDS = [
  { id: "watch", label: "Watch", perFrame: 1, frameDelay: 60, stepDelay: 45, agent: 22 },
  { id: "fast", label: "Fast", perFrame: 12, frameDelay: 30, stepDelay: 0, agent: 60 },
  { id: "turbo", label: "Turbo", perFrame: 250, frameDelay: 0, stepDelay: 0, agent: 200 },
] as const;

/**
 * Section 5: Q-learning in a worker. The agent knows nothing about the map; it acts ε-greedily,
 * updates Q from each step, and the value terrain, arrows and footprints grow from its experience.
 */
export function QLearner() {
  const { world, params, gamma, version } = useLab();
  const mdp = useMdp();
  const worker = useWorker<typeof LearnHandlers>(() => new Worker(new URL("../workers/learn.worker.ts", import.meta.url)));
  const [alpha, setAlpha] = useState(0.3);
  const [eps, setEps] = useState(0.2);
  const [decay, setDecay] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("watch");
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<QFrame | null>(null);
  const [returns, setReturns] = useState<number[]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const resume = useRef<QFrame | null>(null);
  // Probe the two cores the loop needs, so the panel shows before anyone presses play.
  const probe = useCore(() => {
    epsilonGreedy([0, 1], 0.1, () => 0.5);
    qLearningUpdate(new Float64Array(2), 2, 0, 0, 0, 1, true, 0.1, 0.9);
    return true;
  }, []);
  const seeds = useRef(1);

  const stop = () => {
    worker.current?.restart();
    setRunning(false);
  };
  const reset = () => {
    stop();
    resume.current = null;
    setFrame(null);
    setReturns([]);
  };
  useEffect(() => {
    worker.current?.restart();
    resume.current = null;
    const id = setTimeout(() => { setRunning(false); setFrame(null); setReturns([]); }, 0);
    return () => clearTimeout(id);
  }, [version, worker]);

  const train = async (sp: (typeof SPEEDS)[number]["id"]) => {
    const w = worker.current;
    if (!w) return;
    const cfg = SPEEDS.find((s) => s.id === sp)!;
    setRunning(true);
    try {
      await w.call(
        "qlearn",
        {
          world, params, gamma, alpha,
          epsilon: resume.current?.epsilon ?? eps,
          decay: decay ? 0.997 : 1,
          episodes: 200000,
          perFrame: cfg.perFrame, frameDelay: cfg.frameDelay, stepDelay: cfg.stepDelay,
          maxSteps: 400,
          seed: ++seeds.current,
          Q: resume.current?.Q, visits: resume.current?.visits, episode0: resume.current?.episode,
        },
        (p) => {
          const f = p as QFrame;
          resume.current = f;
          setFrame(f);
          setReturns((r) => (r.length > 20000 ? [...r.slice(-10000), ...f.returns] : [...r, ...f.returns]));
        },
      );
      setRunning(false);
      setMissing(null);
    } catch (e) {
      setRunning(false);
      if (isNotYoursYet(e)) setMissing(e);
      else if (e instanceof Error && e.message !== "Worker terminated") setError(e);
    }
  };

  const changeSpeed = (sp: (typeof SPEEDS)[number]["id"]) => {
    setSpeed(sp);
    if (running) {
      worker.current?.restart();
      void train(sp);
    }
  };

  // Unvisited cells show as the darkest seen value and get no arrow: the agent knows nothing there yet.
  const V = useMemo(() => {
    if (!frame) return null;
    const v = maxPerState(frame.Q, 4);
    let lo = Infinity;
    for (let s = 0; s < v.length; s++) if (frame.visits[s] > 0) lo = Math.min(lo, v[s]);
    if (isFinite(lo)) for (let s = 0; s < v.length; s++) if (!frame.visits[s] && s !== world.start) v[s] = lo;
    return v;
  }, [frame, world.start]);
  const arrows = useMemo(() => {
    if (!frame) return null;
    try {
      const a = greedyPolicy(frame.Q, 4);
      for (let s = 0; s < a.length; s++) if (!frame.visits[s] && s !== world.start) a[s] = -2;
      return a;
    } catch { return null; }
  }, [frame, world.start]);
  const vStar = useMemo(() => {
    try { return valueIteration(mdp, gamma, { tol: 1e-6, maxSweeps: 600 }).V[world.start]; } catch { return null; }
  }, [mdp, gamma, world.start]);

  const curve = useMemo(() => {
    if (returns.length < 2) return null;
    const win = Math.max(5, Math.round(returns.length / 60));
    const out: [number, number][] = [];
    let acc = 0;
    const step = Math.max(1, Math.floor(returns.length / 300));
    for (let i = 0; i < returns.length; i++) {
      acc += returns[i];
      if (i >= win) acc -= returns[i - win];
      if (i >= win - 1 && i % step === 0) out.push([i + 1, acc / win]);
    }
    return out.length >= 2 ? out : null;
  }, [returns]);

  const cfg = SPEEDS.find((s) => s.id === speed)!;
  const ghost = useMemo(() => ghostSweeps(world, 7)[7], [world]);

  return (
    <div className="flex flex-col gap-4">
      {missing || probe.missing ? (
        <CorePanel error={(missing ?? probe.missing)!} ghost={<GridView world={world} values={ghost} visits={ghost.map((v) => Math.max(0, v) * 30)} className="aspect-square w-full" />} />
      ) : (
        <GridView
          world={world}
          values={V}
          actions={arrows}
          visits={frame?.visits ?? null}
          trail={frame?.trail ?? null}
          agentSpeed={speed === "watch" ? Math.max(cfg.agent, (frame?.trail.length ?? 0) / 2.2) : cfg.agent}
          loopTrail={!running}
          ease={0.3}
          className="aspect-square w-full"
          label="Q-learning agent"
          badge={<Badge solid={running}>Q · episode {frame?.episode ?? 0}</Badge>}
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <Readout label="Episodes" value={frame?.episode ?? 0} />
        <Readout label="ε now" value={fmt(frame?.epsilon ?? eps, 2)} />
        <Readout label="V*(start)" value={fmt(vStar)} />
      </div>

      <Sheet className="flex flex-col gap-4">
        <div className="flex gap-2" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <Chip key={s.id} active={speed === s.id} onClick={() => changeSpeed(s.id)} className="flex-1">{s.label}</Chip>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Knob label="α step size" value={alpha} min={0.02} max={1} step={0.01} onChange={setAlpha} />
          <Knob label="ε explore (start)" value={eps} min={0} max={1} step={0.01} onChange={setEps} />
        </div>
        <Chip active={decay} onClick={() => setDecay((d) => !d)}><span>{lc(`ε decays ×0.997 per episode (floor 0.02): ${decay ? "on" : "off"}`)}</span></Chip>
        <div className="flex gap-2">
          {running ? (
            <Button className="min-h-11 flex-1" onClick={stop}><Pause className="size-4" aria-hidden /> Pause</Button>
          ) : (
            <Button className="min-h-11 flex-1" onClick={() => train(speed)}><Play className="size-4" aria-hidden /> {frame ? "Resume" : "Let it learn"}</Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={reset}><RotateCcw className="size-4" aria-hidden /> Forget</Button>
        </div>
      </Sheet>
      {error && <CoreError error={error} />}

      {curve && (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Discounted return per episode (moving mean) · dashed: V*(start)</p>
          <LineChart
            height={180}
            xLabel="episode"
            series={[
              { label: "return", data: curve },
              ...(vStar != null ? [{ label: "V*(start)", data: [[curve[0][0], vStar], [curve[curve.length - 1][0], vStar]] as [number, number][], stroke: "dashed" as const }] : []),
            ]}
          />
        </Sheet>
      )}

      <Unlocks
        items={[
          { fn: "epsilonGreedy", what: "How the agent picks moves: mostly greedy, sometimes curious." },
          { fn: "qLearningUpdate", what: "The learning itself: terrain, footprints and the return curve." },
          { fn: "greedyPolicy", what: "Arrows read off the learned Q-table." },
          { fn: "valueIteration", what: "The dashed V*(start) line to aim for." },
        ]}
      />
    </div>
  );
}
