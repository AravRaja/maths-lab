import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { CORES } from "../core";

/**
 * First stub (in milestone order) among the cores a feature needs, or null when they're all written.
 * Pass milestone anchors, e.g. needs("m1-reparam", "m2-kl").
 */
export function firstMissing(...milestones: string[]): NotYoursYet | null {
  for (const c of CORES) {
    if (!milestones.includes(c.milestone ?? "")) continue;
    try {
      c.probe();
    } catch (e) {
      if (isNotYoursYet(e)) return e;
    }
  }
  return null;
}
