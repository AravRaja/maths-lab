"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CoreStatus } from "@/kit/components/core-status";
import { probeCores } from "@/kit/cores";
import { PROJECTS, getProject } from "./registry";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * The project's <CoreStatus> strip, driven by its meta.ts. Client-only because cores are functions.
 *   <ProjectCores slug="rank" />
 */
export function ProjectCores({ slug, className }: { slug: string; className?: string }) {
  const { cores } = getProject(slug);
  return <CoreStatus cores={cores} className={className} />;
}

/** Probe a project's cores on the client. null during SSR / before hydration. */
export function useCoreCount(slug: string): { done: number; total: number } | null {
  const { cores } = getProject(slug);
  const counted = useMemo(() => {
    const r = probeCores(cores);
    return { done: r.filter((x) => x.state === "done").length, total: cores.length };
  }, [cores]);
  return useSyncExternalStore(noopSubscribe, () => counted, () => null);
}

/** "x/y cores written" with a segmented bar. Used on the landing cards. */
export function CoreCount({ slug, className }: { slug: string; className?: string }) {
  const { cores } = getProject(slug);
  const count = useCoreCount(slug);
  if (cores.length === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="h-1 rounded-full border border-dashed border-rule" aria-hidden />
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Cores being planned</p>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-1 gap-0.5" aria-hidden>
        {cores.map((c, i) => (
          <span
            key={c.fn}
            className={cn("flex-1 rounded-full transition-colors duration-700", count && i < count.done ? "bg-ink" : "bg-rule")}
          />
        ))}
      </div>
      <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase tabular-nums">
        Cores written <span className="text-ink">{count ? count.done : "-"}</span>/{cores.length}
      </p>
    </div>
  );
}

/** Total across every project, for the landing hero. */
export function TotalCoreCount() {
  const counted = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const p of PROJECTS) {
      done += probeCores(p.cores).filter((x) => x.state === "done").length;
      total += p.cores.length;
    }
    return { done, total };
  }, []);
  const c = useSyncExternalStore(noopSubscribe, () => counted, () => null);
  return (
    <span className="tabular-nums">
      {c ? c.done : "-"}
      <span className="text-ink-soft">/{c ? c.total : "-"}</span>
    </span>
  );
}
