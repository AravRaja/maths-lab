"use client";

import { useMemo, useState } from "react";
import { CoreError, CorePanel, useCore } from "@/kit/components/core-guard";
import { Heatmap } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Slider } from "@/components/ui/slider";
import { entropy, logProb } from "../core/policy";
import { createAgent, actorFrom, logitsOf } from "../lib/agent";
import { ENV, observe } from "../lib/env";
import { useArena } from "../lib/store";
import { Choice, Knob, num, Readout } from "./choice";

const N = 40;
const OMEGA = 2.5;
type MapKind = "prob" | "entropy";

/**
 * M3: logits → probabilities and entropy, through the user's logProb() and entropy().
 * Top: a two-logit playground. Bottom: the live policy's π(push right | θ, ω) over the whole
 * phase plane (cart centred, still), redrawn every time the trainer sends new weights.
 */
export function PolicyLens() {
  return (
    <div className="flex flex-col gap-4">
      <LogitPlayground />
      <PolicyMap />
    </div>
  );
}

function LogitPlayground() {
  const [zl, setZl] = useState(0.4);
  const [zr, setZr] = useState(-0.6);
  const r = useCore(() => ({ lpl: logProb([zl, zr], 0), lpr: logProb([zl, zr], 1), h: entropy([zl, zr]) }), [zl, zr]);
  if (r.status === "missing") return <CorePanel error={r.missing} ghost={<Bars pl={0.5} pr={0.5} h={Math.LN2} ghost />} />;
  if (r.status === "error") return <CoreError error={r.error} />;
  const { lpl, lpr, h } = r.value;
  return (
    <Sheet className="flex flex-col gap-5">
      <Bars pl={Math.exp(lpl)} pr={Math.exp(lpr)} h={h} />
      <div className="grid grid-cols-3 gap-3">
        <Readout label="log π(left)" value={lpl.toFixed(2)} />
        <Readout label="log π(right)" value={lpr.toFixed(2)} />
        <Readout label="H nats" value={h.toFixed(3)} />
      </div>
      <Knob label="Logit z_left" value={zl.toFixed(1)}>
        <Slider min={-8} max={8} step={0.1} value={zl} aria-label="Left logit" onValueChange={(v) => setZl(num(v))} />
      </Knob>
      <Knob label="Logit z_right" value={zr.toFixed(1)}>
        <Slider min={-8} max={8} step={0.1} value={zr} aria-label="Right logit" onValueChange={(v) => setZr(num(v))} />
      </Knob>
    </Sheet>
  );
}

/** Two probability columns and an entropy gauge against its ceiling log 2. */
function Bars({ pl, pr, h, ghost }: { pl: number; pr: number; h: number; ghost?: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-1">
      {[
        ["← left", pl],
        ["right →", pr],
      ].map(([label, p]) => (
        <div key={label as string} className="flex items-center gap-3">
          <span className="type-narrow w-16 shrink-0 text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</span>
          <div className="relative h-9 flex-1 overflow-hidden rounded-xl border border-rule">
            <div
              className={ghost ? "h-full bg-hatch" : "h-full bg-ink transition-[width] duration-200"}
              style={{ width: `${(p as number) * 100}%` }}
            />
          </div>
          <span className="type-wide w-14 shrink-0 text-right text-lg tabular-nums">{((p as number) * 100).toFixed(0)}%</span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="type-narrow w-16 shrink-0 text-xs tracking-[0.2em] text-ink-soft uppercase">H / log 2</span>
        <div className="relative h-2 flex-1 rounded-full bg-rule">
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink-soft" style={{ width: `${Math.min(1, h / Math.LN2) * 100}%` }} />
        </div>
        <span className="w-14 shrink-0 text-right text-sm tabular-nums text-ink-soft">{(h / Math.LN2).toFixed(2)}</span>
      </div>
    </div>
  );
}

function PolicyMap() {
  const arena = useArena();
  const [kind, setKind] = useState<MapKind>("prob");
  const [cell, setCell] = useState<{ row: number; col: number; value: number } | null>(null);
  const fallback = useMemo(() => createAgent(1).actor, []);
  const actor = arena.weights ? actorFrom(arena.weights.actor) : fallback;

  const r = useCore(() => {
    const vals = new Float32Array(N * N);
    for (let row = 0; row < N; row++) {
      const omega = OMEGA * (1 - (2 * row) / (N - 1));
      for (let col = 0; col < N; col++) {
        const theta = ENV.thetaLimit * ((2 * col) / (N - 1) - 1);
        const z = logitsOf(actor, observe({ x: 0, v: 0, theta, omega }));
        vals[row * N + col] = kind === "prob" ? Math.exp(logProb(z, 1)) : entropy(z) / Math.LN2;
      }
    }
    return vals;
  }, [actor, kind]);

  const ghost = <Heatmap ghost values={[]} rows={N} cols={N} dither aspect={0.8} />;
  if (r.status === "missing") return <CorePanel error={r.missing} ghost={ghost} />;
  if (r.status === "error") return <CoreError error={r.error} />;

  const theta = cell ? ((ENV.thetaLimit * ((2 * cell.col) / (N - 1) - 1) * 180) / Math.PI).toFixed(1) : null;
  const omega = cell ? (OMEGA * (1 - (2 * cell.row) / (N - 1))).toFixed(2) : null;
  return (
    <Sheet className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-semi text-lg">{kind === "prob" ? "π(push right | θ, ω)" : "Entropy H(θ, ω) / log 2"}</p>
          <p className="text-xs text-ink-soft">
            {arena.weights ? `Live policy, iteration ${arena.iter}` : "Untrained network (random init): train it below and watch this sharpen"}
          </p>
        </div>
        <Choice
          label="Map"
          value={kind}
          onChange={setKind}
          options={[
            { value: "prob", label: "π(right)" },
            { value: "entropy", label: "Entropy" },
          ]}
        />
      </div>
      <div className="relative">
        <Heatmap values={r.value} rows={N} cols={N} dither domain={[0, 1]} aspect={0.8} onCell={setCell} />
        <span className="type-narrow pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.2em] text-ink-soft uppercase">
          θ: −12° … +12°
        </span>
        <span className="type-narrow pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 -rotate-90 text-[10px] tracking-[0.2em] text-ink-soft uppercase">
          ω ↑
        </span>
      </div>
      <p className="min-h-5 text-sm text-ink-soft tabular-nums">
        {cell ? `θ = ${theta}°, ω = ${omega} rad/s → ${kind === "prob" ? `π(right) = ${(cell.value * 100).toFixed(1)}%` : `H/log 2 = ${cell.value.toFixed(3)}`}` : "Hover or drag over the map."}
      </p>
    </Sheet>
  );
}
