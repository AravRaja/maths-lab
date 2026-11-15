"use client";

import { useSyncExternalStore } from "react";
import { SHAPE_POINTS } from "./config";
import { GLYPHS, glyphPoints } from "./glyphs";
import { moons, rings, spiral, type Shape } from "./shapes";

/*
 * The dataset every 2D section uses: a glyph, a parametric shape, or the user's own drawing.
 * A tiny external store so the picker and the sections share it without prop drilling.
 */

export const PRESETS = [...GLYPHS, "spiral", "rings", "moons"] as const;
export type Preset = (typeof PRESETS)[number];

export function presetShape(id: Preset): Shape {
  if (id === "spiral") return { id, label: "spiral", points: spiral(SHAPE_POINTS) };
  if (id === "rings") return { id, label: "rings", points: rings(SHAPE_POINTS) };
  if (id === "moons") return { id, label: "moons", points: moons(SHAPE_POINTS) };
  return { id, label: id, points: glyphPoints(id, SHAPE_POINTS) };
}

const SERVER: Shape = { id: "spiral", label: "spiral", points: spiral(SHAPE_POINTS) };
let current: Shape | null = null;
const listeners = new Set<() => void>();

function snapshot(): Shape {
  if (!current) current = presetShape("π");
  return current;
}

export function setShape(s: Shape): void {
  current = s;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useShape(): Shape {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}
