"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { useWorker } from "@/kit/components/use-worker";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { greedyPolicy, lookahead } from "../core/lookahead";
import type { PolicyIterationRound } from "../core/policy-iteration";
import { supDist } from "../lib/policy";
import { ghostArrows, ghostSweeps } from "../lib/dp-helpers";
import type { handlers as DpHandlers } from "../workers/dp.worker";
import { useLab, useMdp } from "./world-store";
import { GridView, Badge } from "./grid-view";
import { Readout, Unlocks } from "./bits";

type Result = { vi: Float64Array[]; pi: PolicyIterationRound[]; star: Float64Array };

/**
 * Section 3: value iteration vs policy iteration on the same world, on one clock measured in
 * backups. VI makes many cheap sweeps; PI makes a few rounds, each a full evaluation.
 */
export function Race() {
  const { world, params, gamma, version } = useLab();
  const mdp = useMdp();
  const worker = useWorker<typeof DpHandlers>(() => new Worker(new URL("../workers/dp.worker.ts", import.meta.url)));
  const [res, setRes] = useState<Result | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [t, setT] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = res ? Math.max(res.vi.length - 1, res.pi.reduce((a, r) => a + r.evalSweeps, 0)) : 0;

  const start = (r: Result) => {
    if (timer.current) clearInterval(timer.current);
    const T = Math.max(r.vi.length - 1, r.pi.reduce((a, x) => a + x.evalSweeps, 0));
    let x = 0;
    setT(0);
    timer.current = setInterval(() => {
      x = Math.min(T, x + Math.max(1, T / 150));
      setT(x);
      if (x >= T && timer.current) clearInterval(timer.current);
    }, 50);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const race = async () => {
    const w = worker.current;
    if (!w) return;
    try {
      const [vi, pi] = await Promise.all([w.call("vi", { world, params, gamma }), w.call("pi", { world, params, gamma })]);
      const r = { vi: vi.sweeps, pi: pi.rounds, star: pi.V };
      setRes(r);
      setMissing(null);
      setError(null);
      start(r);
    } catch (e) {
      if (isNotYoursYet(e)) setMissing(e);
      else if (e instanceof Error && e.message !== "Worker terminated") setError(e);
    }
  };

  useEffect(() => {
    const id = setTimeout(race, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Where each racer is at time t.
  const viK = res ? Math.min(res.vi.length - 1, Math.floor(t)) : 0;
  const piR = useMemo(() => {
    if (!res) return 0;
    let cum = 0;
    for (let r = 0; r < res.pi.length; r++) {
      cum += res.pi[r].evalSweeps;
      if (cum > t) return Math.max(0, r - 1);
    }
    return res.pi.length - 1;
  }, [res, t]);
  const viV = res?.vi[viK] ?? null;
  const viArrows = useMemo(() => {
    if (!viV) return null;
    try { return greedyPolicy(lookahead(mdp, viV, gamma), mdp.nA); } catch { return null; }
  }, [viV, mdp, gamma]);

  const chart = useMemo(() => {
    if (!res) return null;
    const vi = res.vi.map((V, k) => [k, Math.max(1e-8, supDist(V, res.star))] as [number, number]);
    let cum = 0;
    const pi = res.pi.map((r) => {
      cum += r.evalSweeps;
      return [cum, Math.max(1e-8, supDist(r.V, res.star))] as [number, number];
    });
    return { vi, pi };
  }, [res]);

  const ghost = useMemo(() => ghostSweeps(world), [world]);
  if (missing) {
    return (
      <div className="flex flex-col gap-4">
        <CorePanel
          error={missing}
          ghost={
            <div className="grid grid-cols-2 gap-2 p-2">
              <GridView world={world} values={ghost[Math.floor(ghost.length / 2)]} contours={false} className="aspect-square" />
              <GridView world={world} values={ghost[ghost.length - 1]} actions={ghostArrows(world)} contours={false} className="aspect-square" />
            </div>
          }
        />
        <RaceUnlocks />
      </div>
    );
  }

  const piRound = res?.pi[piR];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <GridView world={world} values={viV} actions={viArrows} arrowAlpha={0.7} contours={false} pixel={2} className="aspect-square" badge={<Badge solid>VI · {viK}</Badge>} label="Value iteration" />
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Value iteration</p>
        </div>
        <div className="flex flex-col gap-2">
          <GridView world={world} values={piRound?.V ?? null} actions={piRound?.policy ?? null} arrowAlpha={0.7} contours={false} pixel={2} ease={0.12} className="aspect-square" badge={<Badge solid>PI · round {piR}</Badge>} label="Policy iteration" />
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Policy iteration</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Readout label="Clock" value={`${Math.floor(t)}/${total}`} />
        <Readout label="VI sweeps" value={res ? res.vi.length - 1 : "–"} />
        <Readout label="PI rounds" value={res ? res.pi.length : "–"} />
      </div>

      <Button className="min-h-11" onClick={race}>
        <Flag className="size-4" aria-hidden /> Race again
      </Button>
      {error && <CoreError error={error} />}

      {chart && (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">‖V − V*‖∞ against backups spent · solid VI · dashed PI</p>
          <LineChart
            height={190}
            logY
            xLabel="backups (sweeps)"
            series={[
              { label: "value iteration", data: chart.vi },
              { label: "policy iteration", data: chart.pi, stroke: "dashed" },
            ]}
          />
        </Sheet>
      )}
      <RaceUnlocks />
    </div>
  );
}

function RaceUnlocks() {
  return (
    <Unlocks
      items={[
        { fn: "valueIteration", what: "The left racer: many cheap sweeps of T*." },
        { fn: "policyIteration", what: "The right racer: few rounds, each a full evaluation." },
      ]}
    />
  );
}
