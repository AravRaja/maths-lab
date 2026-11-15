"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PARAMS, TILE, buildMdp, cloneWorld, presetWorld, type Tile, type World, type WorldParams } from "../lib/grid";

/*
 * The one world every section on the page shares. Paint it in the studio and the evaluation,
 * the race and the learners all see the same map.
 */

export interface LabState {
  world: World;
  params: WorldParams;
  gamma: number;
  preset: string;
  /** Bumped on every change, handy as a React key or effect dep. */
  version: number;
}

let state: LabState = { world: presetWorld("rooms"), params: DEFAULT_PARAMS, gamma: 0.95, preset: "rooms", version: 0 };
const subs = new Set<() => void>();
const emit = (next: Partial<LabState>) => {
  state = { ...state, ...next, version: state.version + 1 };
  subs.forEach((f) => f());
};

export const lab = {
  get: () => state,
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  paint(s: number, tile: Tile | "start") {
    const w = state.world;
    if (tile === "start") {
      if (w.start === s || w.tiles[s] !== TILE.empty) return;
      emit({ world: { ...w, start: s }, preset: "custom" });
      return;
    }
    if (w.tiles[s] === tile || s === w.start) return;
    const next = cloneWorld(w);
    next.tiles[s] = tile;
    emit({ world: next, preset: "custom" });
  },
  load(id: string) {
    emit({ world: presetWorld(id), preset: id });
  },
  setParams(p: Partial<WorldParams>) {
    emit({ params: { ...state.params, ...p } });
  },
  setGamma(gamma: number) {
    emit({ gamma });
  },
};

export function useLab(): LabState {
  return useSyncExternalStore(lab.subscribe, lab.get, lab.get);
}

export function useMdp() {
  const { world, params } = useLab();
  return useMemo(() => buildMdp(world, params), [world, params]);
}
