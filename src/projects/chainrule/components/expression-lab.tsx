"use client";

import { useMemo, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CorePanel, runCore } from "@/kit/components/core-guard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { parse, variables, buildGraph, PRESETS, type Ast } from "@/projects/chainrule/lib/engine/expr";
import { collect, runBackward, type Value } from "@/projects/chainrule/lib/engine/value";
import { layoutGraph, fmtNum } from "@/projects/chainrule/lib/engine/graph-layout";
import type { NotYoursYet } from "@/kit/not-yours-yet";
import { cn } from "@/lib/utils";
import { GraphCanvas, nodeTitle, type GraphScene } from "./graph-canvas";
import { GradCheck } from "./grad-check";

const MAX_NODES = 48;

type Built =
  | { ok: false; error: string }
  | { ok: true; scene: GraphScene; leaves: Record<string, Value>; height: number; missing: NotYoursYet | null; otherError: Error | null };

function build(ast: Ast, env: Record<string, number>, key: string): Built {
  const { root, leaves } = buildGraph(ast, env);
  const all = collect(root);
  if (all.length > MAX_NODES) return { ok: false, error: `That graph has ${all.length} nodes. Keep it under ${MAX_NODES} so it fits on a phone.` };

  let missing: NotYoursYet | null = null;
  let otherError: Error | null = null;
  let local: Map<Value, number[]> | null = new Map();
  for (const v of all) {
    if (!v.parents.length) continue;
    const r = runCore(() => v.localGrads(1));
    if (r.status === "ok") local?.set(v, r.value);
    else {
      local = null;
      if (r.status === "missing") missing ??= r.missing;
      else otherError ??= r.error;
      break;
    }
  }

  let backward: GraphScene["backward"] = null;
  if (local) {
    const r = runCore(() => runBackward(root));
    if (r.status === "missing") missing = r.missing;
    else if (r.status === "error") otherError = r.error;
    else {
      const order = r.value;
      const fire = order.filter((v) => v.parents.length).reverse();
      const contrib = new Map<Value, number[]>();
      const grads = new Map<Value, number>();
      for (const v of order) grads.set(v, v.grad);
      for (const v of fire) {
        const c = runCore(() => v.localGrads(v.grad));
        if (c.status === "ok") contrib.set(v, c.value);
      }
      backward = { fire, contrib, grads };
    }
  }
  const height = layoutGraph(root, 360).height;
  return { ok: true, scene: { key, root, local, backward }, leaves, height, missing, otherError };
}

export function ExpressionLab({ between }: { between?: ReactNode }) {
  const [src, setSrc] = useState(PRESETS[0].src);
  const [env, setEnv] = useState<Record<string, number>>(PRESETS[0].env);
  const [selected, setSelected] = useState<Value | null>(null);
  const [replay, setReplay] = useState(0);

  const parsed = useMemo(() => {
    try {
      const ast = parse(src);
      return { ok: true as const, ast, vars: variables(ast) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [src]);

  const fullEnv = useMemo(() => {
    if (!parsed.ok) return env;
    const out: Record<string, number> = {};
    for (const v of parsed.vars) out[v] = env[v] ?? 1;
    return out;
  }, [parsed, env]);

  const built = useMemo<Built>(() => {
    if (!parsed.ok) return { ok: false, error: parsed.error };
    try {
      return build(parsed.ast, fullEnv, `${src}|${JSON.stringify(fullEnv)}`);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [parsed, fullEnv, src]);

  // The graph is rebuilt on every change, so keep the selection by position (same id offset) only if it still exists.
  const sel = built.ok && selected && collect(built.scene.root).includes(selected) ? selected : built.ok ? built.scene.root : null;

  return (
    <>
      <Section id="graph" index={1} kicker="Computation graph" title="Watch the chain rule run">
        <p className="mb-5 text-ink-soft">
          Type any expression. Values climb up the graph; then gradients fall back down it, one node at a time, in the
          order your <code className="font-mono text-ink">backprop()</code> picks. Tap a node to see its local derivatives.
        </p>
        <Sheet className="p-0 sm:p-0">
          <div className="border-b border-rule p-4">
            <label htmlFor="expr" className="type-narrow mb-2 block text-xs tracking-[0.2em] text-ink-soft uppercase">
              f =
            </label>
            <input
              id="expr"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="type-semi h-12 w-full rounded-xl border border-rule bg-paper px-3 font-mono text-base outline-none focus:border-ink"
            />
            <div className="-mx-1 mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSrc(p.src);
                    setEnv(p.env);
                    setSelected(null);
                  }}
                  className={cn(
                    "type-narrow min-h-11 rounded-xl border px-3 text-sm tracking-wide transition-colors",
                    src === p.src ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:border-ink-soft hover:text-ink",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {!built.ok && <p role="alert" className="mt-3 text-sm text-ink">{built.error}</p>}
          </div>

          {parsed.ok && parsed.vars.length > 0 && (
            <div className="grid grid-cols-1 gap-x-6 border-b border-rule px-4 py-2 sm:grid-cols-2">
              {parsed.vars.map((v) => (
                <div key={v} className="flex items-center gap-3">
                  <span className="type-semi w-10 shrink-0 font-mono text-sm">{v}</span>
                  <Slider
                    min={-Math.max(3, Math.ceil(Math.abs(fullEnv[v])))}
                    max={Math.max(3, Math.ceil(Math.abs(fullEnv[v])))}
                    step={0.01}
                    value={[fullEnv[v]]}
                    onValueChange={(val) => setEnv((e) => ({ ...e, [v]: Array.isArray(val) ? val[0] : val }))}
                    aria-label={`value of ${v}`}
                  />
                  <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-ink-soft">{fullEnv[v].toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {built.ok && (
            <div className="relative bg-grain">
              <GraphCanvas scene={built.scene} height={built.height} selected={sel} onSelect={setSelected} replay={replay} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Replay the backward pass"
                className="absolute top-2 right-2 bg-paper"
                onClick={() => setReplay((r) => r + 1)}
                disabled={!built.scene.backward}
              >
                <RotateCcw />
              </Button>
            </div>
          )}

          {built.ok && sel && <Inspector node={sel} scene={built.scene} />}
        </Sheet>

        {built.ok && built.missing && (
          <CorePanel className="mt-4" error={built.missing} />
        )}
        {built.ok && built.otherError && (
          <p role="alert" className="mt-4 rounded-2xl border border-ink p-4 font-mono text-sm">{built.otherError.message}</p>
        )}
      </Section>

      {between}

      <Section id="gradcheck" index={3} kicker="Trust, but verify" title="Gradient check">
        {parsed.ok && built.ok ? (
          <GradCheck ast={parsed.ast} vars={parsed.vars} env={fullEnv} leaves={built.leaves} hasBackward={!!built.scene.backward} />
        ) : (
          <p className="text-ink-soft">Fix the expression above to check its gradient.</p>
        )}
      </Section>
    </>
  );
}

function label(v: Value) {
  return v.op === "leaf" ? v.label ?? "x" : v.op === "const" ? fmtNum(v.data) : `${nodeTitle(v)} node`;
}

function Inspector({ node, scene }: { node: Value; scene: GraphScene }) {
  const g = scene.backward?.grads.get(node);
  const local = scene.local?.get(node);
  const contrib = scene.backward?.contrib.get(node);
  return (
    <div className="border-t border-rule p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="type-wide text-2xl">{nodeTitle(node) || "·"}</p>
        <p className="font-mono text-sm text-ink-soft">value {fmtNum(node.data)}</p>
        <p className="font-mono text-sm">
          {node === scene.root ? "∂f/∂f = 1" : g !== undefined ? `∂f/∂(this) = ${fmtNum(g)}` : <span className="text-ink-soft">∂f/∂(this) = ?</span>}
        </p>
      </div>
      {node.parents.length > 0 ? (
        <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
          {node.parents.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
              <span className="type-narrow text-ink-soft">into {label(p)}</span>
              <span className="font-mono">
                local {local ? fmtNum(local[i]) : "?"}
                <span className="text-ink-soft"> · passes </span>
                {contrib ? fmtNum(contrib[i]) : "?"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">
          {node.op === "leaf" ? "An input. Everything above it adds up here." : "A constant. It gets a gradient too, but nobody uses it."}
        </p>
      )}
    </div>
  );
}
