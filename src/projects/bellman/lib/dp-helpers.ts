import { TILE, goalDistance, ghostValues, moveTarget, type World } from "./grid";

/*
 * Ghost previews for when the cores are still stubs. They are deliberately NOT Bellman: a BFS
 * distance wave and steepest descent on it. They show the shape of what is coming, labelled ghost.
 */

/** Frames of a pretend wave: cells light up in order of grid distance to a goal. */
export function ghostSweeps(world: World, frames?: number): Float64Array[] {
  const d = goalDistance(world);
  const g = ghostValues(world);
  let max = 0;
  for (const v of d) if (isFinite(v)) max = Math.max(max, v);
  const K = frames ?? max + 1;
  const out: Float64Array[] = [];
  for (let k = 0; k <= K; k++) {
    const V = new Float64Array(g.length);
    for (let s = 0; s < g.length; s++) V[s] = d[s] <= k ? g[s] : world.tiles[s] === TILE.lava ? -0.4 : -0.2;
    out.push(V);
  }
  return out;
}

/** Arrows that walk down the BFS distance (ghost only). */
export function ghostArrows(world: World): Int32Array {
  const d = goalDistance(world);
  const out = new Int32Array(d.length);
  for (let s = 0; s < d.length; s++) {
    let best = 0, bd = Infinity;
    for (let a = 0; a < 4; a++) {
      const n = moveTarget(world, s, a);
      if (d[n] < bd) { bd = d[n]; best = a; }
    }
    out[s] = best;
  }
  return out;
}

/** Follow a deterministic action map from `start` until an absorbing tile or `max` steps. */
export function followArrows(world: World, actions: ArrayLike<number>, start = world.start, max = 120): number[] {
  const path = [start];
  let s = start;
  const seen = new Set([s]);
  for (let i = 0; i < max; i++) {
    const t = world.tiles[s];
    if (t === TILE.goal || t === TILE.lava) break;
    const a = actions[s];
    if (a < 0) break;
    const n = moveTarget(world, s, a);
    if (n === s || seen.has(n)) break;
    seen.add(n);
    path.push(n);
    s = n;
  }
  return path;
}
