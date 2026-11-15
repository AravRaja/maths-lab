"use client";

import { useSyncExternalStore } from "react";
import type { AgentWeights } from "./agent";

/*
 * The latest trained agent, shared by every view on the page: the hero, the eight arenas,
 * the policy lens and the clip lab all read from here while the worker streams updates in.
 */

export interface ArenaSnapshot {
  weights: AgentWeights | null;
  iter: number;
  envSteps: number;
  recentReturn: number | null;
  best: number | null;
  /** Flattened (ratio, normalised advantage) pairs from the last update. */
  ratios: number[];
  clip: number;
  clipFrac: number | null;
  training: boolean;
}

const INITIAL: ArenaSnapshot = {
  weights: null,
  iter: 0,
  envSteps: 0,
  recentReturn: null,
  best: null,
  ratios: [],
  clip: 0.2,
  clipFrac: null,
  training: false,
};

let state = INITIAL;
const subs = new Set<() => void>();

export function setArena(patch: Partial<ArenaSnapshot>) {
  state = { ...state, ...patch };
  for (const s of subs) s();
}

export function resetArena() {
  state = { ...INITIAL, clip: state.clip };
  for (const s of subs) s();
}

export function getArena() {
  return state;
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useArena(): ArenaSnapshot {
  return useSyncExternalStore(subscribe, getArena, () => INITIAL);
}
