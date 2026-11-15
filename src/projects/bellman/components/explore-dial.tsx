"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, useCore } from "@/kit/components/core-guard";
import { epsilonGreedy } from "../core/explore";
import { ACTIONS } from "../core/types";
import { mulberry32 } from "../lib/rng";
import { Knob, lc } from "./bits";

const QROW = [0.3, 0.9, 0.1, 0.9];
const N = 4000;

/** ε-greedy as a histogram: 4000 picks from one Q row (two actions tied), live, against the theory. */
export function ExploreDial() {
  const [eps, setEps] = useState(0.2);
  const [seed, setSeed] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSeed((s) => s + 1), 900);
    return () => clearInterval(id);
  }, []);
  const r = useCore(() => {
    const rand = mulberry32(seed * 7919);
    const c = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) c[epsilonGreedy(QROW, eps, rand)]++;
    return c.map((x) => x / N);
  }, [eps, seed]);
  const theory = useMemo(() => {
    const max = Math.max(...QROW);
    const ties = QROW.filter((q) => q === max).length;
    return QROW.map((q) => eps / 4 + (q === max ? (1 - eps) / ties : 0));
  }, [eps]);

  const bars = (f: number[], ghost = false) => (
    <div className="flex h-40 items-end gap-3" role="img" aria-label="Action frequencies">
      {f.map((p, a) => (
        <div key={a} className="flex flex-1 flex-col items-center gap-1">
          <span className="type-wide text-xs tabular-nums">{ghost ? "" : (p * 100).toFixed(0) + "%"}</span>
          <div className="relative w-full flex-1">
            <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-ink transition-[height] duration-300" style={{ height: `${p * 100}%` }} />
            <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-soft" style={{ bottom: `${theory[a] * 100}%` }} />
          </div>
          <span className="type-narrow text-[10px] tracking-[0.2em] text-ink-soft uppercase">{ACTIONS[a]}</span>
          <span className="font-mono text-[10px] text-ink-soft">Q={QROW[a]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Sheet className="flex flex-col gap-4">
      <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{lc(`${N} picks of epsilonGreedy() · dashed: theory, 1 − ε + ε/nA shared by the ties`)}</p>
      {r.status === "missing" ? (
        <CorePanel error={r.missing} ghost={bars([0.1, 0.4, 0.1, 0.4], true)} />
      ) : r.status === "error" ? (
        <CoreError error={r.error} />
      ) : (
        bars(r.value)
      )}
      <Knob label="ε explore" value={eps} min={0} max={1} step={0.01} onChange={setEps} />
    </Sheet>
  );
}
