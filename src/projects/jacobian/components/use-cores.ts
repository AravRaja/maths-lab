"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { CORES } from "../core";

export type CoreName =
  | "rodrigues"
  | "invertSE3"
  | "forwardKinematics"
  | "geometricJacobian"
  | "manipulability"
  | "so3Log"
  | "dlsStep"
  | "riccatiStep"
  | "dlqr"
  | "kalmanPredict"
  | "kalmanUpdate";

/** For each core: null when written, the NotYoursYet when still a stub. `undefined` record during SSR. */
export type Availability = Record<CoreName, NotYoursYet | null>;

const noop = () => () => {};

function probeAll(): Availability {
  const out = {} as Availability;
  for (const c of CORES) {
    try {
      c.probe();
      out[c.fn as CoreName] = null;
    } catch (e) {
      // A written-but-broken core counts as written here; the section that calls it shows the error.
      out[c.fn as CoreName] = isNotYoursYet(e) ? e : null;
    }
  }
  return out;
}

/** Which cores are written. null before hydration (render a neutral placeholder then). */
export function useCores(): Availability | null {
  const probed = useMemo(() => probeAll(), []);
  return useSyncExternalStore(noop, () => probed, () => null);
}

/** The first missing core among `names`, or null if all are written. */
export function firstMissing(a: Availability, ...names: CoreName[]): NotYoursYet | null {
  for (const n of names) if (a[n]) return a[n];
  return null;
}
