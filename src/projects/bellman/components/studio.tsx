"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, MousePointer2, Play, RotateCcw, StepForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { useWorker } from "@/kit/components/use-worker";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { lookahead, greedyPolicy } from "../core/lookahead";
import { bellmanOptimalityBackup } from "../core/backups";
import { ACTIONS } from "../core/types";
import { PRESETS, TILE, type Tile } from "../lib/grid";
import { ghostSweeps } from "../lib/dp-helpers";
import type { handlers as DpHandlers } from "../workers/dp.worker";
import { lab, useLab, useMdp } from "./world-store";
import { GridView, Badge } from "./grid-view";
import { Chip, Knob, Readout, Unlocks, fmt, lc } from "./bits";

type Tool = Tile | "start" | "inspect";
const TOOLS: { id: Tool; label: string }[] = [
  { id: TILE.wall, label: "Wall" },
  { id: TILE.lava, label: "Lava" },
  { id: TILE.goal, label: "Goal" },
  { id: TILE.mud, label: "Mud" },
  { id: "start", label: "Start" },
  { id: TILE.empty, label: "Erase" },
  { id: "inspect", label: "Inspect" },
];

type Run = { sweeps: Float64Array[]; deltas: number[] } | null;

/**
 * Section 1: paint a world, watch value iteration flood it. Every repaint re-solves in the worker
 * and replays the sweeps; "One sweep" applies the user's optimality backup by hand.
 */
export function Studio() {
  const { world, params, gamma, preset, version } = useLab();
  const mdp = useMdp();
  const [tool, setTool] = useState<Tool>(TILE.wall);
  const [selected, setSelected] = useState<number | null>(null);
  const [run, setRun] = useState<Run>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [frame, setFrame] = useState(0);
  const [manual, setManual] = useState<{ V: Float64Array; n: number } | null>(null);
  const [manualMissing, setManualMissing] = useState<NotYoursYet | null>(null);
  const worker = useWorker<typeof DpHandlers>(() => new Worker(new URL("../workers/dp.worker.ts", import.meta.url)));
  const playing = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = (n: number) => {
    if (playing.current) clearInterval(playing.current);
    setFrame(0);
    let f = 0;
    playing.current = setInterval(() => {
      f++;
      setFrame(f);
      if (f >= n - 1 && playing.current) clearInterval(playing.current);
    }, 70);
  };
  useEffect(() => () => { if (playing.current) clearInterval(playing.current); }, []);

  // Re-solve whenever the world, the rewards or γ change (debounced while painting).
  useEffect(() => {
    const id = setTimeout(async () => {
      const w = worker.current;
      if (!w) return;
      try {
        const r = await w.call("vi", { world, params, gamma });
        setRun({ sweeps: r.sweeps, deltas: r.deltas });
        setMissing(null);
        setError(null);
        setManual(null);
        play(r.sweeps.length);
      } catch (e) {
        if (isNotYoursYet(e)) {
          setMissing(e);
          setManual(null);
          const g = ghostSweeps(world);
          setRun({ sweeps: g, deltas: [] });
          play(g.length);
        } else if (e instanceof Error && e.message !== "Worker terminated") setError(e);
      }
    }, 140);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const sweeps = run?.sweeps ?? null;
  const shownFrame = sweeps ? Math.min(frame, sweeps.length - 1) : 0;
  const V = manual?.V ?? sweeps?.[shownFrame] ?? null;
  const live = !missing && !!run;

  // Arrows and the compass come from the user's lookahead + greedyPolicy on whatever V is showing.
  const Q = useCore(() => (V ? lookahead(mdp, V, gamma) : null), [mdp, V, gamma]);
  const pi = useCore(() => (Q.value ? greedyPolicy(Q.value, mdp.nA) : null), [Q, mdp]);

  const oneSweep = () => {
    const base = manual?.V ?? (missing || !V ? new Float64Array(mdp.nS) : V);
    try {
      const next = bellmanOptimalityBackup(mdp, base, gamma);
      setManual({ V: next, n: manual ? manual.n + 1 : missing ? 1 : shownFrame + 1 });
      setManualMissing(null);
    } catch (e) {
      if (isNotYoursYet(e)) setManualMissing(e);
      else setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const onCell = (s: number) => {
    if (tool === "inspect") { setSelected(s); return; }
    setSelected(null);
    lab.paint(s, tool);
  };

  const start = world.start;
  const badge = manual ? (
    <Badge solid>manual · sweep {manual.n}</Badge>
  ) : (
    <Badge solid={live}>{live ? "live" : "ghost"} · sweep {shownFrame}{sweeps ? `/${sweeps.length - 1}` : ""}</Badge>
  );

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Paint tool">
          {TOOLS.map((t) => (
            <Chip key={String(t.id)} active={tool === t.id} onClick={() => setTool(t.id)} className="flex-1 basis-[22%] px-2">
              {t.id === TILE.empty ? <Eraser className="size-3.5" aria-hidden /> : t.id === "inspect" ? <MousePointer2 className="size-3.5" aria-hidden /> : <TileSwatch t={t.id} />}
              {t.label}
            </Chip>
          ))}
        </div>
        <GridView
          world={world}
          values={V}
          actions={pi.value}
          selected={selected}
          onCell={onCell}
          paint={tool !== "inspect"}
          className="aspect-square w-full"
          badge={badge}
          label="Paintable gridworld. Drag to paint the selected tile."
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip key={p.id} active={preset === p.id} onClick={() => lab.load(p.id)} className="flex-1 basis-[30%]">
              {p.name}
            </Chip>
          ))}
        </div>
      </Sheet>

      <div className="grid grid-cols-3 gap-2">
        <Readout label="Sweeps" value={live && run ? run.deltas.length : "–"} />
        <Readout label="Last Δ" value={live && run ? fmt(run.deltas[run.deltas.length - 1]) : "–"} />
        <Readout label="V(start)" value={live && V ? fmt(V[start]) : "–"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 flex-1" onClick={() => { setManual(null); if (sweeps) play(sweeps.length); }}>
          <Play className="size-4" aria-hidden /> Replay the flood
        </Button>
        <Button variant="outline" className="min-h-11 flex-1" onClick={oneSweep}>
          <StepForward className="size-4" aria-hidden /> One sweep of T*
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => setManual({ V: new Float64Array(mdp.nS), n: 0 })} aria-label="Reset values to zero">
          <RotateCcw className="size-4" aria-hidden /> V = 0
        </Button>
      </div>

      <Sheet className="grid gap-4 sm:grid-cols-3">
        <Knob label="γ discount" value={gamma} min={0.5} max={0.99} step={0.01} onChange={(v) => lab.setGamma(v)} />
        <Knob label="Slip" value={params.slip} min={0} max={0.6} step={0.02} onChange={(v) => lab.setParams({ slip: v })} />
        <Knob label="Step reward" value={params.stepReward} min={-0.2} max={0} step={0.01} onChange={(v) => lab.setParams({ stepReward: v })} />
      </Sheet>

      {selected != null && (
        <Compass s={selected} Q={Q.value} missing={Q.missing} onClose={() => setSelected(null)} />
      )}

      {error && <CoreError error={error} />}
      {manualMissing && <CorePanel error={manualMissing} />}
      {missing ? (
        <CorePanel error={missing} ghost={<div className="p-4"><LineChart ghost series={[]} height={160} /></div>} />
      ) : run && run.deltas.length > 1 ? (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">{lc("‖V_k+1 − V_k‖∞ per sweep · dotted: γ^k")}</p>
          <LineChart
            height={180}
            logY
            xLabel="sweep k"
            series={[
              { label: "Δ_k", data: run.deltas },
              { label: "γ^k", data: run.deltas.map((_, k) => run.deltas[0] * gamma ** k), stroke: "dotted" },
            ]}
          />
        </Sheet>
      ) : null}

      <Unlocks
        items={[
          { fn: "lookahead", what: "Inspect a cell: the compass of four action values." },
          { fn: "greedyPolicy", what: "Arrows that snap to the best action, even on the ghost." },
          { fn: "bellmanOptimalityBackup", what: "“One sweep of T*”: push the wave by hand." },
          { fn: "valueIteration", what: "The live flood, the sweep counter and the Δ chart." },
        ]}
      />
    </div>
  );
}

function TileSwatch({ t }: { t: Tile | "start" }) {
  const cls =
    t === TILE.wall ? "bg-hatch border-ink-soft" : t === TILE.lava ? "bg-paper border-ink-soft [background-image:radial-gradient(var(--ink-soft)_1px,transparent_1.5px)] [background-size:4px_4px]" : t === TILE.goal ? "bg-ink border-ink" : t === TILE.mud ? "bg-ink-soft/40 border-ink-soft" : "rotate-45 border-current bg-transparent";
  return <span aria-hidden className={`inline-block size-3 rounded-[3px] border ${cls}`} />;
}

/** The four one-step lookahead values of one cell, arranged as a compass. */
function Compass({ s, Q, missing, onClose }: { s: number; Q: Float64Array | null | undefined; missing: NotYoursYet | null; onClose: () => void }) {
  const { world } = useLab();
  const x = s % world.w, y = (s / world.w) | 0;
  const row = useMemo(() => (Q ? Array.from(Q.subarray(s * 4, s * 4 + 4)) : null), [Q, s]);
  if (missing) return <CorePanel error={missing} ghost={<CompassFace row={[0.4, 0.9, 0.2, 0.5]} />} />;
  if (!row) return null;
  return (
    <Sheet className="relative">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">
          Cell ({x}, {y}) · Q(s, a) = Σ P · [r + γV(s′)]
        </p>
        <button type="button" onClick={onClose} className="type-narrow min-h-11 px-2 text-xs tracking-[0.2em] text-ink-soft uppercase underline underline-offset-4">
          close
        </button>
      </div>
      <CompassFace row={row} />
    </Sheet>
  );
}

function CompassFace({ row }: { row: number[] }) {
  const max = Math.max(...row);
  const lo = Math.min(...row);
  const cell = (a: number) => {
    const best = row[a] === max;
    const w = max - lo > 1e-9 ? (row[a] - lo) / (max - lo) : 1;
    return (
      <div className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${best ? "border-ink" : "border-rule"}`}>
        <span className="type-narrow text-[10px] tracking-[0.2em] text-ink-soft uppercase">{ACTIONS[a]}</span>
        <span className={`type-wide text-base tabular-nums ${best ? "" : "text-ink-soft"}`}>{fmt(row[a])}</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-rule">
          <span className="block h-full bg-ink" style={{ width: `${Math.round(w * 100)}%` }} />
        </span>
      </div>
    );
  };
  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
      <span />
      {cell(0)}
      <span />
      {cell(3)}
      <div className="flex items-center justify-center">
        <span className="type-wide text-2xl" aria-hidden>{["↑", "→", "↓", "←"][row.indexOf(max)]}</span>
      </div>
      {cell(1)}
      <span />
      {cell(2)}
      <span />
    </div>
  );
}
