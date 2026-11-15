"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, runCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Slider } from "@/components/ui/slider";
import { compile, type Ast } from "@/projects/chainrule/lib/engine/expr";
import type { Value } from "@/projects/chainrule/lib/engine/value";
import { fmtNum } from "@/projects/chainrule/lib/engine/graph-layout";
import { numericalGrad, relError } from "@/projects/chainrule/core/gradcheck";
import { cn } from "@/lib/utils";

const PASS = 1e-7;

/** Log-scale bar for a relative error between 1e-16 and 1. */
function ErrBar({ err }: { err: number }) {
  const f = err <= 0 ? 0 : Math.max(0, Math.min(1, (Math.log10(err) + 16) / 16));
  return (
    <div className="relative h-2 w-full rounded-full bg-rule" aria-hidden>
      <div className="absolute top-0 left-0 h-2 rounded-full bg-ink" style={{ width: `${Math.max(2, f * 100)}%` }} />
      <div className="absolute -top-1 h-4 w-px bg-ink-soft" style={{ left: `${((Math.log10(PASS) + 16) / 16) * 100}%` }} />
    </div>
  );
}

function GhostTable() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {["x", "y", "w"].map((v) => (
        <div key={v} className="flex items-center gap-3">
          <span className="w-8 font-mono">{v}</span>
          <div className="h-2 flex-1 rounded-full bg-hatch" />
          <span className="w-16 text-right font-mono text-ink-soft">1e-10</span>
        </div>
      ))}
    </div>
  );
}

export function GradCheck({
  ast,
  vars,
  env,
  leaves,
  hasBackward,
}: {
  ast: Ast;
  vars: string[];
  env: Record<string, number>;
  leaves: Record<string, Value>;
  hasBackward: boolean;
}) {
  const [logH, setLogH] = useState(-5);
  const f = useMemo(() => compile(ast, vars), [ast, vars]);
  const x = useMemo(() => vars.map((v) => env[v]), [vars, env]);
  const analytic = useMemo(() => vars.map((v) => leaves[v]?.grad ?? 0), [vars, leaves]);

  const numeric = useMemo(() => runCore(() => numericalGrad(f, x, 10 ** logH)), [f, x, logH]);
  const errs = useMemo(
    () => (numeric.status === "ok" ? runCore(() => analytic.map((a, i) => relError([a], [numeric.value[i]]))) : null),
    [numeric, analytic],
  );
  const total = useMemo(() => (numeric.status === "ok" ? runCore(() => relError(analytic, numeric.value)) : null), [numeric, analytic]);
  const curve = useMemo(() => {
    if (!hasBackward || numeric.status !== "ok") return null;
    return runCore(() => {
      const pts: [number, number][] = [];
      for (let e = -1; e >= -13; e -= 0.25) pts.push([e, Math.max(1e-17, relError(analytic, numericalGrad(f, x, 10 ** e)))]);
      return pts;
    });
  }, [hasBackward, numeric, analytic, f, x]);

  if (numeric.status === "missing") return <CorePanel error={numeric.missing} ghost={<GhostTable />} />;
  if (numeric.status === "error") return <CoreError error={numeric.error} />;
  if (errs?.status === "missing") return <CorePanel error={errs.missing} ghost={<GhostTable />} />;
  if (errs?.status === "error") return <CoreError error={errs.error} />;
  const perVar = errs?.status === "ok" ? errs.value : [];
  const worst = total?.status === "ok" ? total.value : NaN;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        Your backprop against your central differences, for the expression above. Below the tick (1e-7) means they agree.
      </p>
      <Sheet className="p-0 sm:p-0">
        <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-3 border-b border-rule px-4 py-2 type-narrow text-xs tracking-[0.15em] text-ink-soft uppercase">
          <span>var</span>
          <span>backprop</span>
          <span>numeric</span>
        </div>
        <ul className="divide-y divide-rule">
          {vars.map((v, i) => (
            <li key={v} className="px-4 py-3">
              <div className="grid grid-cols-[3rem_1fr_1fr] items-baseline gap-x-3 font-mono text-sm">
                <span className="type-semi">{v}</span>
                <span className={cn(!hasBackward && "text-ink-soft")}>{hasBackward ? fmtNum(analytic[i]) : "?"}</span>
                <span>{fmtNum(numeric.value[i])}</span>
              </div>
              {hasBackward && (
                <div className="mt-2 flex items-center gap-3">
                  <ErrBar err={perVar[i] ?? 1} />
                  <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-ink-soft">{(perVar[i] ?? 1).toExponential(0)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3">
          <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Worst relative error</span>
          <span className={cn("type-wide text-xl tabular-nums", hasBackward && worst < PASS ? "text-ink" : "text-ink-soft")}>
            {hasBackward ? `${worst.toExponential(1)} ${worst < PASS ? "· pass" : "· check"}` : "needs backprop"}
          </span>
        </div>
      </Sheet>

      <Sheet>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Step size h</p>
          <p className="font-mono text-sm tabular-nums">h = 1e{logH}</p>
        </div>
        <Slider min={-13} max={-1} step={1} value={[logH]} onValueChange={(v) => setLogH(Array.isArray(v) ? v[0] : v)} aria-label="log10 of h" />
        {curve?.status === "ok" ? (
          <>
            <LineChart
              className="mt-3"
              height={200}
              logY
              series={[{ label: "relative error vs h", data: curve.value }]}
              xLabel="log₁₀ h"
              yLabel="rel err"
            />
            <p className="mt-2 text-sm text-ink-soft">
              Too big and the O(h²) truncation term wins; too small and floating-point round-off (about ε/h) takes over.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">The error-versus-h curve appears once backprop is written.</p>
        )}
      </Sheet>
    </div>
  );
}
