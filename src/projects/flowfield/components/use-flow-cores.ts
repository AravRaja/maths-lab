"use client";

import { useMemo, useSyncExternalStore } from "react";
import { runCore } from "@/kit/components/core-guard";
import type { NotYoursYet } from "@/kit/not-yours-yet";
import { conditionalPath, conditionalVelocity } from "../core/path";
import { marginalVelocity } from "../core/marginal";
import { eulerStep, sampleODE } from "../core/euler";
import { cfmLoss, cfmLossGrad } from "../core/loss";
import { dropLabel, guidedVelocity } from "../core/guidance";
import { temporalEnsemble } from "../core/chunks";

/*
 * Which parts of the page can run. Each entry is null when its cores are written, otherwise the
 * first NotYoursYet thrown, so the section can show the right "Yours to write" panel.
 */
export interface FlowCores {
  path: NotYoursYet | null;
  marginal: NotYoursYet | null;
  euler: NotYoursYet | null;
  loss: NotYoursYet | null;
  guidance: NotYoursYet | null;
  chunks: NotYoursYet | null;
}

function first(fns: (() => unknown)[]): NotYoursYet | null {
  for (const f of fns) {
    const r = runCore(f);
    if (r.status === "missing") return r.missing;
  }
  return null;
}

function probe(): FlowCores {
  return {
    path: first([() => conditionalPath([0, 0], [1, 1], 0.5, 0.02), () => conditionalVelocity([0, 0], [1, 1], 0.02)]),
    marginal: first([() => marginalVelocity([0, 0], 0.5, [[1, 1]], 0.02)]),
    euler: first([() => eulerStep((x) => x, [1], 0, 0.1), () => sampleODE((x) => x, [1], 2)]),
    loss: first([() => cfmLoss([[1]], [[0]]), () => cfmLossGrad([[1]], [[0]])]),
    guidance: first([() => guidedVelocity([1], [0], 2), () => dropLabel(1, 0.1, 0.5)]),
    chunks: first([() => temporalEnsemble([{ start: 0, actions: [[1]] }], 0, 0.1)]),
  };
}

const noop = () => () => {};

/** null during SSR and the first paint, then the probed availability. */
export function useFlowCores(): FlowCores | null {
  const probed = useMemo(() => probe(), []);
  return useSyncExternalStore(noop, () => probed, () => null);
}

/** First missing core among the groups a feature needs. */
export function needs(c: FlowCores, ...keys: (keyof FlowCores)[]): NotYoursYet | null {
  for (const k of keys) if (c[k]) return c[k];
  return null;
}
