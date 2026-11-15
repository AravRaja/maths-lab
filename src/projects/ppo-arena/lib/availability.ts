"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { CORES } from "../core";

export type CoreName = "discountedReturns" | "gae" | "logProb" | "entropy" | "clippedSurrogate" | "valueLoss";
export type Availability = Record<CoreName, NotYoursYet | null>;

const noop = () => () => {};

/** Which cores are still stubs (NotYoursYet), on the client. null before hydration. */
export function useAvailability(): Availability | null {
  const probed = useMemo(() => {
    const out = {} as Availability;
    for (const c of CORES) {
      try {
        c.probe();
        out[c.fn as CoreName] = null;
      } catch (e) {
        out[c.fn as CoreName] = isNotYoursYet(e) ? e : null;
      }
    }
    return out;
  }, []);
  return useSyncExternalStore(noop, () => probed, () => null);
}

/** The first missing core from a list, in order. */
export function firstMissing(a: Availability | null, names: CoreName[]): NotYoursYet | null {
  if (!a) return null;
  for (const n of names) if (a[n]) return a[n];
  return null;
}
