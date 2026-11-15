"use client";

import { useMemo, useSyncExternalStore } from "react";
import { runCore } from "@/kit/components/core-guard";
import { forwardKinematics, jacobian } from "@/projects/say-and-reach/core/kinematics";
import { dlsStep } from "@/projects/say-and-reach/core/ik";
import { gaussianNll } from "@/projects/say-and-reach/core/policy-head";
import { eulerSample, flowPair } from "@/projects/say-and-reach/core/flow";
import { discountedReturn, shapedRewards } from "@/projects/say-and-reach/core/reward";
import type { NotYoursYet } from "@/kit/not-yours-yet";

/*
 * Which parts of the app can run, decided by probing the user's cores with tiny inputs.
 * Each entry is null when the cores it needs are written, or the first NotYoursYet thrown
 * (so the page can show the right "Yours to write" panel). Probed on the client only.
 */

export interface Availability {
  fk: NotYoursYet | null;
  ik: NotYoursYet | null;
  gaussian: NotYoursYet | null;
  /** flowPair: enough to train the flow head. */
  flowTrain: NotYoursYet | null;
  /** flowPair and eulerSample: enough to sample actions from it. */
  flow: NotYoursYet | null;
  reward: NotYoursYet | null;
}

function missing(fns: (() => unknown)[]): NotYoursYet | null {
  for (const f of fns) {
    const r = runCore(f);
    if (r.status === "missing") return r.missing;
  }
  return null;
}

function probe(): Availability {
  const fk = missing([() => forwardKinematics([0.2, 0.1, 0.1], [1, 1, 1])]);
  const ik = fk ?? missing([() => jacobian([0.2, 0.1, 0.1], [1, 1, 1]), () => dlsStep([[1, 0, 0], [0, 1, 0]], [0.1, 0], 0.1)]);
  return {
    fk,
    ik,
    gaussian: missing([() => gaussianNll([0], [0], [0.5])]),
    flowTrain: missing([() => flowPair([0], [1], 0.5)]),
    flow: missing([() => flowPair([0], [1], 0.5), () => eulerSample((x) => x, [1], 2)]),
    reward: missing([() => discountedReturn([1], 0.9), () => shapedRewards([0], [0, 1], 0.9)]),
  };
}

const noop = () => () => {};

/** null during SSR / first paint, then the probed availability. */
export function useAvailability(): Availability | null {
  const probed = useMemo(() => probe(), []);
  return useSyncExternalStore(noop, () => probed, () => null);
}
