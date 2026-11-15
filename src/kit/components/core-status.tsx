"use client";

import { useMemo, useSyncExternalStore } from "react";
import { probeCores, milestoneHref, type CoreProbeResult, type CoreSpec } from "@/kit/cores";
import { cn } from "@/lib/utils";

/**
 * Strip listing the project's cores and whether each is written.
 * Probes on the client; the static HTML shows "checking" so hydration always matches.
 */
const noopSubscribe = () => () => {};

export function CoreStatus({ cores, className }: { cores: CoreSpec[]; className?: string }) {
  const probed = useMemo(() => probeCores(cores), [cores]);
  const results: CoreProbeResult[] | null = useSyncExternalStore(noopSubscribe, () => probed, () => null);

  const done = results?.filter((r) => r.state === "done").length ?? 0;
  return (
    <div className={cn("rounded-2xl border border-rule bg-sheet p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Maths cores</p>
        <p className="type-wide text-lg tabular-nums">
          {results ? done : "-"}
          <span className="text-ink-soft">/{cores.length}</span>
        </p>
      </div>
      <div className="mb-3 flex h-1.5 gap-1" aria-hidden>
        {cores.map((c, i) => (
          <span
            key={c.fn}
            className={cn(
              "flex-1 rounded-full transition-colors duration-500",
              results?.[i]?.state === "done" ? "bg-ink" : results?.[i]?.state === "broken" ? "bg-ink-soft" : "bg-rule",
            )}
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-rule">
        {cores.map((c, i) => {
          const r = results?.[i];
          const href = milestoneHref(c.milestone, c.file);
          return (
            <li key={c.fn} className="flex min-h-11 items-center gap-3 py-2">
              <StateMark state={r?.state} />
              <div className="min-w-0 flex-1">
                <code className="font-mono text-sm break-all">{c.fn}()</code>
                <p className="truncate text-xs text-ink-soft">{r?.state === "broken" ? r.error : c.file}</p>
              </div>
              {href && (
                <a href={href} className="type-narrow inline-flex min-h-11 shrink-0 items-center text-xs text-ink-soft underline underline-offset-4">
                  {c.milestone}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StateMark({ state }: { state?: CoreProbeResult["state"] }) {
  const label = state === "done" ? "written" : state === "broken" ? "throws" : state === "todo" ? "yours to write" : "checking";
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
        state === "done" && "border-ink bg-ink text-paper",
        state === "broken" && "border-ink text-ink",
        (state === "todo" || !state) && "border-dashed border-ink-soft text-transparent",
      )}
    >
      {state === "done" ? "✓" : state === "broken" ? "!" : ""}
    </span>
  );
}
