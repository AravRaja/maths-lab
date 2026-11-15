"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { CorePanel } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { HoldToConfirmButton } from "@/components/spectrumui/hold-to-confirm";
import { TextStates } from "@/components/spectrumui/text-states";
import { cn } from "@/lib/utils";
import type { handlers } from "../workers/train.worker";
import type { IterStats } from "../lib/ppo";
import { DEFAULT_CONFIG } from "../lib/ppo";
import { ENV } from "../lib/env";
import { resetArena, setArena, useArena } from "../lib/store";
import { firstMissing, useAvailability, type CoreName } from "../lib/availability";
import { ArenaGrid } from "./arena-grid";
import { Choice, Knob, num } from "./choice";

const NEEDS: CoreName[] = ["discountedReturns", "gae", "logProb", "entropy", "clippedSurrogate", "valueLoss"];
const LRS = ["0.0005", "0.001", "0.002", "0.004"] as const;
type Lr = (typeof LRS)[number];

/**
 * M5: the whole PPO loop in a Web Worker, built from all six cores. The page asks for one
 * iteration at a time (three at full speed), draws the stats, and hands the fresh weights to every view on the page.
 */
export function Arena() {
  const avail = useAvailability();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));
  const toast = useToast();
  const arena = useArena();
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const inited = useRef(false);
  const solved = useRef(false);
  const [hist, setHist] = useState<IterStats[]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lr, setLr] = useState<Lr>("0.002");
  const [clip, setClip] = useState(DEFAULT_CONFIG.clip);
  const [ent, setEnt] = useState(DEFAULT_CONFIG.entCoef);
  const [vclip, setVclip] = useState(false);
  const [greedy, setGreedy] = useState(false);
  const [pace, setPace] = useState<"watch" | "fast">("watch");
  const paceRef = useRef<"watch" | "fast">("watch");
  useEffect(() => {
    paceRef.current = pace;
  }, [pace]);
  const knobs = useRef({ lr: 0.002, clip: DEFAULT_CONFIG.clip, entCoef: DEFAULT_CONFIG.entCoef, valueClip: null as number | null });

  useEffect(() => {
    knobs.current = { lr: Number(lr), clip, entCoef: ent, valueClip: vclip ? 0.2 : null };
    if (inited.current) void worker.current?.call("tune", knobs.current);
    setArena({ clip });
  }, [lr, clip, ent, vclip, worker]);

  useEffect(() => () => void (runningRef.current = false), []);

  const loop = async () => {
    const w = worker.current;
    if (!w) return;
    try {
      if (!inited.current) {
        const weights = await w.call("init", { config: { ...knobs.current } });
        inited.current = true;
        setArena({ weights, iter: 0, envSteps: 0 });
      }
      while (runningRef.current) {
        const fast = paceRef.current === "fast";
        const out = await w.call("iterate", { n: fast ? 3 : 1 });
        // Watch pace: about four updates a second, so each new policy gets a moment on stage.
        if (!fast) await new Promise((r) => setTimeout(r, 220));
        if (!runningRef.current && out.stats.length === 0) break;
        const last = out.stats[out.stats.length - 1];
        setHist((h) => [...h, ...out.stats].slice(-400));
        setArena({
          weights: out.weights,
          iter: last.iter,
          envSteps: last.envSteps,
          recentReturn: last.recentReturn,
          best: Math.max(...out.stats.map((s) => s.meanReturn ?? 0), 0),
          ratios: last.ratios,
          clipFrac: last.clipFrac,
          training: true,
        });
        if (!solved.current && (last.recentReturn ?? 0) >= 475) {
          solved.current = true;
          toast({ title: "Solved", description: `Mean return ${last.recentReturn!.toFixed(0)} after ${last.envSteps.toLocaleString()} steps. The torches stay lit.`, status: "success" });
        }
      }
    } catch (e) {
      runningRef.current = false;
      if (isNotYoursYet(e)) {
        setMissing(e);
        toast({ title: `${e.fn}() is yours to write`, description: e.file, status: "neutral" });
      } else if (!(e instanceof Error && e.message === "Worker terminated")) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setRunning(runningRef.current);
      setArena({ training: runningRef.current });
    }
  };

  const toggle = () => {
    if (runningRef.current) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    setError(null);
    runningRef.current = true;
    setRunning(true);
    void loop();
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    worker.current?.restart();
    inited.current = false;
    solved.current = false;
    setHist([]);
    resetArena();
    toast({ title: "Fresh agent", description: "New random weights. Uniform policy, maximum entropy.", status: "neutral" });
  };

  const blocked = missing ?? firstMissing(avail, NEEDS);
  if (blocked) {
    return (
      <div className="flex flex-col gap-4">
        <CoreChecklist avail={avail} />
        <CorePanel error={blocked} ghost={<ArenaGrid ghost />} />
      </div>
    );
  }

  const x = (s: IterStats) => s.envSteps / 1000;
  const returns = hist.filter((s) => s.recentReturn !== null).map((s) => [x(s), s.recentReturn!] as [number, number]);
  const status = running ? (arena.iter === 0 ? "Starting the worker" : "Training") : arena.iter ? "Paused" : "Ready";
  return (
    <div className="flex flex-col gap-4">
      <ArenaGrid greedy={greedy} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Iteration" value={arena.iter} />
        <Stat label="Env steps" value={Math.round(arena.envSteps / 1000)} suffix="k" />
        <Stat label="Mean return" value={Math.round(arena.recentReturn ?? 0)} suffix={`/${ENV.maxSteps}`} />
        <Stat label="Best batch" value={Math.round(arena.best ?? 0)} />
      </div>
      <Sheet className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">
            <TextStates text={status} />
          </p>
          <span className={cn("size-2 rounded-full", running ? "animate-pulse bg-ink" : "bg-rule")} aria-hidden />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Button size="lg" className="min-h-12 text-base" onClick={toggle}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? "Pause" : arena.iter ? "Keep training" : "Train the agent"}
          </Button>
          <HoldToConfirmButton onConfirm={reset} label="Reset" confirmedLabel="Reset" size="lg" disabled={!arena.iter && !running} />
        </div>
        <Choice
          label="Pace"
          value={pace}
          onChange={setPace}
          options={[
            { value: "watch", label: "Watch it learn" },
            { value: "fast", label: "Full speed" },
          ]}
        />
        {error && <p role="alert" className="font-mono text-sm break-words">{error}</p>}
      </Sheet>

      <Sheet>
        <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Mean return, last 20 episodes</p>
        {returns.length > 1 ? (
          <LineChart height={220} xLabel="env steps (k)" yDomain={[0, ENV.maxSteps]} series={[{ label: "return", data: returns }, { label: "max", data: [[returns[0][0], ENV.maxSteps], [returns[returns.length - 1][0], ENV.maxSteps]], stroke: "dotted" }]} />
        ) : (
          <LineChart ghost series={[]} height={220} />
        )}
      </Sheet>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniChart title="Entropy (nats)" hist={hist} pick={(s) => s.entropy} note="Starts at log 2 ≈ 0.69." />
        <MiniChart title="Clip fraction" hist={hist} pick={(s) => s.clipFrac} second={{ label: "approx KL ×10", pick: (s) => s.approxKl * 10 }} note="Share of ratios outside 1 ± ε." />
        <MiniChart title="Critic vs reality" hist={hist} pick={(s) => s.vMean} second={{ label: "Monte Carlo G", pick: (s) => s.mcMean }} note="Mean V(s) against mean G_t from discountedReturns()." />
        <MiniChart title="Value loss" hist={hist} pick={(s) => s.valueLoss} note="From valueLoss(), last epoch." />
      </div>

      <Sheet className="flex flex-col gap-5">
        <p className="type-semi text-lg">Knobs</p>
        <div>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Learning rate</p>
          <Choice label="Learning rate" value={lr} onChange={setLr} options={LRS.map((v) => ({ value: v, label: v.replace("0.", ".") }))} />
        </div>
        <Knob label="Clip ε" value={clip.toFixed(2)}>
          <Slider min={0.02} max={0.6} step={0.01} value={clip} aria-label="Clip epsilon" onValueChange={(v) => setClip(num(v))} />
        </Knob>
        <Knob label="Entropy bonus c_H" value={ent.toFixed(3)}>
          <Slider min={0} max={0.1} step={0.002} value={ent} aria-label="Entropy coefficient" onValueChange={(v) => setEnt(num(v))} />
        </Knob>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-sm">Clip the value loss too</span>
            <span className="block text-xs text-ink-soft">Passes clip = 0.2 to valueLoss() instead of null.</span>
          </span>
          <AnimatedSwitch checked={vclip} onCheckedChange={setVclip} label="Value clipping" />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-sm">Greedy display</span>
            <span className="block text-xs text-ink-soft">The eight torches take the likeliest action instead of sampling. Training always samples.</span>
          </span>
          <AnimatedSwitch checked={greedy} onCheckedChange={setGreedy} label="Greedy display" />
        </label>
        <p className="text-xs text-ink-soft">
          Fixed: {DEFAULT_CONFIG.nEnvs} envs × {DEFAULT_CONFIG.nSteps} steps a rollout, {DEFAULT_CONFIG.epochs} epochs of {DEFAULT_CONFIG.minibatches} minibatches,
          γ = {DEFAULT_CONFIG.gamma}, λ = {DEFAULT_CONFIG.lambda}, c_V = {DEFAULT_CONFIG.vfCoef}, Adam, grad-norm clip {DEFAULT_CONFIG.maxGradNorm}. Two 4-32-32 tanh networks.
        </p>
      </Sheet>
    </div>
  );
}

function MiniChart({
  title,
  hist,
  pick,
  second,
  note,
}: {
  title: string;
  hist: IterStats[];
  pick: (s: IterStats) => number;
  second?: { label: string; pick: (s: IterStats) => number };
  note: string;
}) {
  const data = hist.map((s) => [s.envSteps / 1000, pick(s)] as [number, number]);
  return (
    <Sheet>
      <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{title}</p>
      <p className="mb-2 text-xs text-ink-soft">{note}</p>
      {data.length > 1 ? (
        <LineChart
          height={150}
          series={[{ label: title, data }, ...(second ? [{ label: second.label, data: hist.map((s) => [s.envSteps / 1000, second.pick(s)] as [number, number]), stroke: "dashed" as const }] : [])]}
        />
      ) : (
        <LineChart ghost series={[]} height={150} />
      )}
    </Sheet>
  );
}

function CoreChecklist({ avail }: { avail: ReturnType<typeof useAvailability> }) {
  return (
    <Sheet>
      <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">The arena runs on all six cores</p>
      <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
        {NEEDS.map((n) => {
          const done = avail ? !avail[n] : false;
          return (
            <li key={n} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3", done ? "border-ink" : "border-dashed border-rule text-ink-soft")}>
              <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]", done ? "border-ink bg-ink text-paper" : "border-ink-soft")}>{done ? "✓" : ""}</span>
              <code className="truncate font-mono text-xs">{n}()</code>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
