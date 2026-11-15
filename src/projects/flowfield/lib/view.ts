import { WORLD } from "./config";

/** Map the world square [-world, world]² onto a canvas, keeping it square and centred. y is up. */
export interface View {
  s: number;
  cx: number;
  cy: number;
  x: (wx: number) => number;
  y: (wy: number) => number;
  toWorld: (px: number, py: number) => [number, number];
}

export function makeView(width: number, height: number, world = WORLD, pad = 0): View {
  const s = (Math.min(width, height) / 2 - pad) / world;
  const cx = width / 2;
  const cy = height / 2;
  return {
    s,
    cx,
    cy,
    x: (wx) => cx + wx * s,
    y: (wy) => cy - wy * s,
    toWorld: (px, py) => [(px - cx) / s, (cy - py) / s],
  };
}
