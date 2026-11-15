"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { bellmanExpectationBackup } from "../core/backups";
import { greedyPolicy, lookahead } from "../core/lookahead";
import { TILE } from "../lib/grid";
import { oneHot, supDist } from "../lib/policy";
import { ghostSweeps } from "../lib/dp-helpers";
import { useLab, useMdp } from "./world-store";
import { GridView, Badge } from "./grid-view";
import { Readout, Unlocks, fmt, lc } from "./bits";

/**
 * Section 2: draw a policy (tap a cell to turn its arrow; the star means "uniformly random") and
 * watch the user's expectation backup evaluate it, sweep by sweep, warm-starting after each edit.
 * "Improve" applies greedy(lookahead(V^π)): policy iteration by hand.
 */
export function Evaluate() {
  const { world, gamma, version } = useLab();
  const mdp = useMdp();
  const n = world.w * world.h;
  const [acts, setActs] = useState<Int32Array>(() => new Int32Array(n).fill(-1));
  const [V, setV] = useState<Float64Array | null>(null);
  const [deltas, setDeltas] = useState<number[]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [improveMissing, setImproveMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [round, setRound] = useState(0);
  const Vref = useRef<Float64Array | null>(null);

  const policy = useMemo(() => (acts.length === n ? acts : new Int32Array(n).fill(-1)), [acts, n]);
  const ghost = useMemo(() => ghostSweeps(world, 6)[6], [world]);

  // Sweep T^π until it settles; restart (warm) whenever the policy, world or γ changes.
  useEffect(() => {
    const pi = oneHot(policy, 4);
    let cur = Vref.current && Vref.current.length === n ? Vref.current : new Float64Array(n);
    const ds: number[] = [];
    let k = 0;
    const id = setInterval(() => {
      try {
        const next = bellmanExpectationBackup(mdp, cur, pi, gamma);
        const d = supDist(next, cur);
        cur = next;
        Vref.current = next;
        ds.push(d);
        k++;
        setV(next);
        setDeltas([...ds]);
        setMissing(null);
        if (d < 1e-5 || k > 400) clearInterval(id);
      } catch (e) {
        clearInterval(id);
        if (isNotYoursYet(e)) setMissing(e);
        else setError(e instanceof Error ? e : new Error(String(e)));
      }
    }, 45);
    return () => clearInterval(id);
  }, [policy, mdp, gamma, n, version]);

  const turn = (s: number) => {
    const t = world.tiles[s];
    if (t === TILE.wall || t === TILE.goal || t === TILE.lava) return;
    const next = policy.slice();
    next[s] = next[s] >= 3 ? -1 : next[s] + 1;
    setActs(next);
  };

  const improve = () => {
    if (!V) return;
    try {
      const g = greedyPolicy(lookahead(mdp, V, gamma), mdp.nA);
      setActs(g);
      setRound((r) => r + 1);
      setImproveMissing(null);
    } catch (e) {
      if (isNotYoursYet(e)) setImproveMissing(e);
      else setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const reset = (fill: number) => {
    Vref.current = null;
    setRound(0);
    setActs(new Int32Array(n).fill(fill));
  };

  const live = !missing && V;
  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-3 p-3 sm:p-4">
        {missing ? (
          <CorePanel
            error={missing}
            ghost={<GridView world={world} values={ghost} actions={policy} contours={false} className="aspect-square w-full" />}
          />
        ) : (
          <GridView
            world={world}
            values={V}
            actions={policy}
            onCell={turn}
            ease={0.5}
            className="aspect-square w-full"
            label="Tap a cell to turn its arrow"
            badge={<Badge solid>V^π · sweep {deltas.length}{round ? ` · round ${round}` : ""}</Badge>}
          />
        )}
        <p className="text-sm text-ink-soft">Tap a cell to turn its arrow: ↑ → ↓ ← then ✳ (uniformly random). Values re-settle after every edit.</p>
      </Sheet>

      <div className="grid grid-cols-3 gap-2">
        <Readout label="Sweeps" value={live ? deltas.length : "–"} />
        <Readout label="Δ" value={live ? fmt(deltas[deltas.length - 1]) : "–"} />
        <Readout label="V^π(start)" value={live && V ? fmt(V[world.start]) : "–"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 flex-1" onClick={improve} disabled={!live}>
          <Sparkles className="size-4" aria-hidden /> Improve: act greedily
        </Button>
        <Button variant="outline" className="min-h-11 flex-1" onClick={() => reset(-1)}>
          <Shuffle className="size-4" aria-hidden /> All random
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => reset(1)} aria-label="Every arrow points right">
          <RotateCcw className="size-4" aria-hidden /> All →
        </Button>
      </div>

      {improveMissing && <CorePanel error={improveMissing} />}
      {error && <CoreError error={error} />}

      {live && deltas.length > 2 && (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">{lc("‖T^π V − V‖∞ per sweep")}</p>
          <LineChart height={160} logY xLabel="sweep" series={[{ label: "Δ", data: deltas }]} />
        </Sheet>
      )}

      <Unlocks
        items={[
          { fn: "bellmanExpectationBackup", what: "Your drawn policy gets values, sweep by sweep." },
          { fn: "greedyPolicy", what: "“Improve”: one round of policy iteration by hand (with lookahead)." },
        ]}
      />
    </div>
  );
}
