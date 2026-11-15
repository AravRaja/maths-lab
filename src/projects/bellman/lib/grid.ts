import { N_ACTIONS, type MDP, type Outcome } from "../core/types";

/*
 * The drawable gridworld and how it turns into an MDP. This is plumbing: the cores only ever see
 * the MDP, never the grid.
 */

export const TILE = { empty: 0, wall: 1, lava: 2, goal: 3, mud: 4 } as const;
export type Tile = (typeof TILE)[keyof typeof TILE];
export const TILE_NAMES = ["empty", "wall", "lava", "goal", "mud"] as const;

export interface World {
  w: number;
  h: number;
  /** Row-major, length w*h. State index s = y*w + x, y = 0 at the top. */
  tiles: Uint8Array;
  /** Where episodes start. */
  start: number;
}

export interface WorldParams {
  /** Probability the move goes sideways instead (split evenly left/right of the intended direction). */
  slip: number;
  /** Reward for a step into an empty cell. Usually ≤ 0 (a cost of living). */
  stepReward: number;
  /** Reward for a step into mud. */
  mudReward: number;
  goalReward: number;
  lavaReward: number;
}

export const DEFAULT_PARAMS: WorldParams = { slip: 0.1, stepReward: -0.02, mudReward: -0.3, goalReward: 1, lavaReward: -1 };

// up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export function isAbsorbing(t: number): boolean {
  return t === TILE.wall || t === TILE.lava || t === TILE.goal;
}

/** Where a move from s in direction d lands: off-grid or into a wall means you stay put. */
export function moveTarget(world: World, s: number, d: number): number {
  const x = s % world.w;
  const y = (s / world.w) | 0;
  const nx = x + DX[d];
  const ny = y + DY[d];
  if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) return s;
  const n = ny * world.w + nx;
  return world.tiles[n] === TILE.wall ? s : n;
}

/** Reward for arriving in s' (it depends only on what you step into). */
export function arrivalReward(world: World, s2: number, p: WorldParams): number {
  switch (world.tiles[s2]) {
    case TILE.goal: return p.goalReward;
    case TILE.lava: return p.lavaReward;
    case TILE.mud: return p.mudReward;
    default: return p.stepReward;
  }
}

/** Grid → sparse MDP. Intended direction with prob 1 − slip, each perpendicular with slip / 2. */
export function buildMdp(world: World, params: WorldParams = DEFAULT_PARAMS): MDP {
  const nS = world.w * world.h;
  const nA = N_ACTIONS;
  const outcomes: Outcome[][] = new Array(nS * nA);
  const terminal = new Uint8Array(nS);
  for (let s = 0; s < nS; s++) {
    const t = world.tiles[s];
    if (isAbsorbing(t)) {
      terminal[s] = 1;
      for (let a = 0; a < nA; a++) outcomes[s * nA + a] = [{ p: 1, next: s, reward: 0 }];
      continue;
    }
    for (let a = 0; a < nA; a++) {
      const branches: [number, number][] = [
        [a, 1 - params.slip],
        [(a + 1) % 4, params.slip / 2],
        [(a + 3) % 4, params.slip / 2],
      ];
      const merged = new Map<number, number>();
      for (const [d, p] of branches) {
        if (p <= 0) continue;
        const n = moveTarget(world, s, d);
        merged.set(n, (merged.get(n) ?? 0) + p);
      }
      outcomes[s * nA + a] = [...merged].map(([next, p]) => ({ p, next, reward: arrivalReward(world, next, params) }));
    }
  }
  return { nS, nA, outcomes, terminal };
}

export function emptyWorld(w: number, h: number): World {
  return { w, h, tiles: new Uint8Array(w * h), start: (h - 1) * w };
}

export function cloneWorld(world: World): World {
  return { w: world.w, h: world.h, tiles: world.tiles.slice(), start: world.start };
}

/** Parse an ASCII map: `.` empty, `#` wall, `~` lava, `G` goal, `m` mud, `S` start. */
export function parseWorld(rows: string[]): World {
  const h = rows.length;
  const w = rows[0].length;
  const world = emptyWorld(w, h);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const s = y * w + x;
      world.tiles[s] = c === "#" ? TILE.wall : c === "~" ? TILE.lava : c === "G" ? TILE.goal : c === "m" ? TILE.mud : TILE.empty;
      if (c === "S") world.start = s;
    }),
  );
  return world;
}

/** Ready-made worlds. 14×14 fits a 375px phone at ~24px a cell. */
export const PRESETS: { id: string; name: string; rows: string[] }[] = [
  {
    id: "rooms",
    name: "Four rooms",
    rows: [
      "......#.......",
      "......#.......",
      "..............",
      "......#.....G.",
      "......#.......",
      "......#.......",
      "##.####.......",
      "......####.###",
      "......#.......",
      "......#...~~..",
      "..............",
      "......#.......",
      "S.....#.......",
      "......#.......",
    ],
  },
  {
    id: "cliff",
    name: "Cliff walk",
    rows: [
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "S~~~~~~~~~~~~G",
    ],
  },
  {
    id: "lake",
    name: "Lava lake",
    rows: [
      "..............",
      ".....mmmm.....",
      "...~~~~~~~~...",
      "..~~~~~~~~~~..",
      "..~~~~..~~~~..",
      "..~~~.G..~~~..",
      "..~~~....~~~..",
      "..~~~~..~~~~..",
      "..~~~~..~~~~..",
      "...~~~..~~~...",
      "..............",
      ".....mmmm.....",
      "..............",
      "S.............",
    ],
  },
  {
    id: "maze",
    name: "Maze",
    rows: [
      "S.#......#...G",
      "..#.####.#.#..",
      "..#.#....#.#..",
      "....#.####.##.",
      "###.#......#..",
      "....######.#.#",
      ".##.#....#.#..",
      ".#..#.##.#.##.",
      ".#.##.#..#....",
      ".#....#.####.#",
      ".####.#....#..",
      ".#....####.##.",
      ".#.##.....m...",
      "...#..###.....",
    ],
  },
  { id: "blank", name: "Blank", rows: Array.from({ length: 14 }, (_, y) => (y === 0 ? ".............G" : y === 13 ? "S............." : "..............")) },
];

export function presetWorld(id: string): World {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return parseWorld(p.rows);
}

/**
 * Grid distance (BFS, 4-neighbour, through non-walls) from every cell to the nearest goal.
 * Used only for the ghost previews while the cores are stubs. Infinity where unreachable.
 */
export function goalDistance(world: World): Float64Array {
  const n = world.w * world.h;
  const d = new Float64Array(n).fill(Infinity);
  const q: number[] = [];
  for (let s = 0; s < n; s++) if (world.tiles[s] === TILE.goal) { d[s] = 0; q.push(s); }
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    for (let k = 0; k < 4; k++) {
      const m = moveTarget(world, s, k);
      if (m === s || d[m] !== Infinity || world.tiles[m] === TILE.lava) continue;
      d[m] = d[s] + 1;
      q.push(m);
    }
  }
  return d;
}

/** A pretend value field for ghost previews: 1 at goals falling linearly with distance. Not V*. */
export function ghostValues(world: World): Float64Array {
  const d = goalDistance(world);
  let max = 1;
  for (const v of d) if (isFinite(v)) max = Math.max(max, v);
  const V = new Float64Array(d.length);
  for (let s = 0; s < d.length; s++) {
    const t = world.tiles[s];
    V[s] = t === TILE.lava ? -0.4 : isFinite(d[s]) ? (1 - d[s] / (max + 1)) ** 2 : -0.2;
  }
  return V;
}
