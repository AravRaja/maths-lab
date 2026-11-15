"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/kit/components/page-shell";
import { CorePanel, CoreError, runCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Slider } from "@/components/ui/slider";
import { addBackward, expBackward, logBackward, mulBackward, powBackward, reluBackward, tanhBackward } from "@/projects/chainrule/core/ops";
import { numericalGrad, relError } from "@/projects/chainrule/core/gradcheck";
import { fmtNum } from "@/projects/chainrule/lib/engine/graph-layout";
import { cn } from "@/lib/utils";

type Unary = "tanh" | "relu" | "exp" | "log" | "pow";
type OpKey = Unary | "mul" | "add";
const OPS: OpKey[] = ["tanh", "relu", "exp", "log", "pow", "mul", "add"];

const UNARY: Record<Unary, { f: (x: number, k: number) => number; d: (x: number, out: number, k: number) => number; range: [number, number]; tex: string }> = {
  tanh: { f: (x) => Math.tanh(x), d: (x, o) => tanhBackward(x, o, 1), range: [-3, 3], tex: "tanh x" },
  relu: { f: (x) => Math.max(0, x), d: (x) => reluBackward(x, 1), range: [-2, 2], tex: "max(0, x)" },
  exp: { f: (x) => Math.exp(x), d: (x, o) => expBackward(x, o, 1), range: [-2, 1.6], tex: "eˣ" },
  log: { f: (x) => Math.log(x), d: (x) => logBackward(x, 1), range: [0.08, 3], tex: "ln x" },
  pow: { f: (x, k) => Math.pow(x, k), d: (x, _o, k) => powBackward(x, k, 1), range: [0.1, 2], tex: "xᵏ" },
};

export function OpsGallery() {
  const [op, setOp] = useState<OpKey>("tanh");
  const [k, setK] = useState(2);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        Every op knows one thing: its own derivative. Solid is the function, dashed is your backward rule with g = 1, dotted is
        your finite difference (once milestone 3 is in). If dashed and dotted disagree, the rule is wrong.
      </p>
      <div role="tablist" aria-label="Op" className="flex flex-wrap gap-2">
        {OPS.map((o) => (
          <button
            key={o}
            role="tab"
            aria-selected={op === o}
            type="button"
            onClick={() => setOp(o)}
            className={cn(
              "type-semi min-h-11 min-w-11 rounded-xl border px-3 font-mono text-sm transition-colors",
              op === o ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:text-ink",
            )}
          >
            {o === "mul" ? "×" : o === "add" ? "+" : o}
          </button>
        ))}
      </div>
      {op === "mul" || op === "add" ? <BinaryCard op={op} /> : <UnaryCard op={op} k={k} setK={setK} />}
    </div>
  );
}

function UnaryCard({ op, k, setK }: { op: Unary; k: number; setK: (k: number) => void }) {
  const spec = UNARY[op];
  const xs = useMemo(() => Array.from({ length: 121 }, (_, i) => spec.range[0] + ((spec.range[1] - spec.range[0]) * i) / 120), [spec]);
  const fx = useMemo(() => xs.map((x) => [x, spec.f(x, k)] as [number, number]), [xs, spec, k]);
  const dx = useMemo(() => runCore(() => xs.map((x) => [x, spec.d(x, spec.f(x, k), k)] as [number, number])), [xs, spec, k]);
  const num = useMemo(() => runCore(() => xs.map((x) => [x, numericalGrad((v) => spec.f(v[0], k), [x])[0]] as [number, number])), [xs, spec, k]);
  const agree = useMemo(() => {
    if (dx.status !== "ok" || num.status !== "ok") return null;
    // Skip relu's kink at exactly 0.
    const keep = xs.map((x) => !(op === "relu" && Math.abs(x) < 0.05));
    return runCore(() => relError(dx.value.filter((_, i) => keep[i]).map((p) => p[1]), num.value.filter((_, i) => keep[i]).map((p) => p[1])));
  }, [dx, num, xs, op]);

  const header = (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <p className="type-wide text-2xl">{spec.tex}</p>
      {agree?.status === "ok" && (
        <p className="font-mono text-xs text-ink-soft">
          rel err {agree.value.toExponential(1)} {agree.value < 1e-6 ? "· agrees" : "· disagrees"}
        </p>
      )}
    </div>
  );
  const powSlider = op === "pow" && (
    <div className="mb-2 flex items-center gap-3">
      <span className="type-semi w-6 font-mono text-sm">k</span>
      <Slider min={-2} max={3} step={0.5} value={[k]} onValueChange={(v) => setK(Array.isArray(v) ? v[0] : v)} aria-label="exponent k" />
      <span className="w-10 text-right font-mono text-xs tabular-nums">{k}</span>
    </div>
  );

  if (dx.status === "missing")
    return (
      <Sheet>
        {header}
        {powSlider}
        <LineChart height={220} series={[{ label: "f(x)", data: fx }]} />
        <CorePanel className="mt-4" error={dx.missing} ghost={<LineChart ghost height={140} series={[]} />} />
      </Sheet>
    );
  if (dx.status === "error") return <CoreError error={dx.error} />;
  const series = [
    { label: "f(x)", data: fx, stroke: "solid" as const },
    { label: "your f′(x)", data: dx.value, stroke: "dashed" as const },
    ...(num.status === "ok" ? [{ label: "finite difference", data: num.value, stroke: "dotted" as const }] : []),
  ];
  return (
    <Sheet>
      {header}
      {powSlider}
      <LineChart height={240} series={series} />
    </Sheet>
  );
}

function BinaryCard({ op }: { op: "mul" | "add" }) {
  const [a, setA] = useState(1.5);
  const [b, setB] = useState(-0.8);
  const [g, setG] = useState(1);
  const r = useMemo(() => runCore(() => (op === "mul" ? mulBackward(a, b, g) : addBackward(a, b, g))), [op, a, b, g]);
  const out = op === "mul" ? a * b : a + b;
  const row = (name: string, v: number, set: (v: number) => void, min = -3, max = 3) => (
    <div className="flex items-center gap-3">
      <span className="type-semi w-6 shrink-0 font-mono text-sm">{name}</span>
      <Slider min={min} max={max} step={0.05} value={[v]} onValueChange={(x) => set(Array.isArray(x) ? x[0] : x)} aria-label={name} />
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">{v.toFixed(2)}</span>
    </div>
  );
  return (
    <Sheet>
      <p className="type-wide mb-3 text-2xl">{op === "mul" ? "out = a · b" : "out = a + b"}</p>
      {row("a", a, setA)}
      {row("b", b, setB)}
      {row("g", g, setG, -2, 2)}
      <p className="mt-2 text-sm text-ink-soft">g is the gradient arriving from above, ∂L/∂out.</p>
      {r.status === "missing" ? (
        <CorePanel className="mt-4" error={r.missing} />
      ) : r.status === "error" ? (
        <CoreError error={r.error} />
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["out", out],
            ["∂L/∂a", r.value[0]],
            ["∂L/∂b", r.value[1]],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border border-rule p-3">
              <p className="type-narrow text-xs text-ink-soft">{k}</p>
              <p className="type-wide mt-1 text-xl tabular-nums">{fmtNum(v as number)}</p>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
