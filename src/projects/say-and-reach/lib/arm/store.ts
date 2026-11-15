"use client";

import { useSyncExternalStore } from "react";
import type { PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";

/*
 * Trained policies live here, in memory, so every part of the page (hero, playground, flow
 * view, scoreboard) sees the latest weights, including live snapshots while training runs.
 */

export interface PolicyState {
  gaussian?: PolicyNet;
  flow?: PolicyNet;
  /** True while that head is mid-training (weights are a live snapshot). */
  training?: { gaussian?: boolean; flow?: boolean };
  /** Demos were recorded with the two-way expert. */
  twoWay?: boolean;
  version: number;
}

let state: PolicyState = { version: 0 };
const listeners = new Set<() => void>();

export function setPolicies(patch: Partial<Omit<PolicyState, "version">>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

export function getPolicies(): PolicyState {
  return state;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePolicies(): PolicyState {
  return useSyncExternalStore(subscribe, getPolicies, getPolicies);
}
