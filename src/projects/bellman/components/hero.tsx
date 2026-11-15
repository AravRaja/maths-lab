"use client";

import { useEffect, useMemo, useState } from "react";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { lookahead, greedyPolicy } from "../core/lookahead";
import { valueIteration } from "../core/value-iteration";
import { TILE, buildMdp, cloneWorld, parseWorld, DEFAULT_PARAMS, type World } from "../lib/grid";
import { HERO_ROWS } from "../lib/hero-world";
import { followArrows, ghostArrows, ghostSweeps } from "../lib/dp-helpers";
import { GridView, Badge } from "./grid-view";

const GAMMA = 0.96;
const BASE = parseWorld(HERO_ROWS);

type Run = { sweeps: Float64Array[]; live: boolean; arrowsLive: boolean };

function solve(world: World): Run {
  const mdp = buildMdp(world, DEFAULT_PARAMS);
  try {
    const r = valueIteration(mdp, GAMMA, { tol: 1e-5, maxSweeps: 400 });
    let arrowsLive = true;
    try { greedyPolicy(lookahead(mdp, r.V, GAMMA), mdp.nA); } catch { arrowsLive = false; }
    return { sweeps: r.sweeps, live: true, arrowsLive };
  } catch (e) {
    if (!isNotYoursYet(e)) console.warn(e);
    return { sweeps: ghostSweeps(world), live: false, arrowsLive: false };
  }
}

/**
 * The signature visual: value iteration flooding a gridworld, wave by wave. Each sweep of the
 * user's valueIteration is a frame; the dithered terrain shimmers where values changed, contour
 * lines tighten round the goals, arrows snap to the greedy policy and a bead walks it home.
 * With the cores still stubs it plays a labelled ghost (a BFS wave). Tap to drop a new goal.
 */
export function HeroTide() {
  const [world, setWorld] = useState<World>(BASE);
  const [added, setAdded] = useState<number[]>([]);
  const run = useMemo(() => solve(world), [world]);
  const [k, setK] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setK((x) => x + 1), 110);
    return () => clearInterval(id);
  }, []);

  const n = run.sweeps.length;
  const cycle = n + 60; // play the sweeps, then hold while the bead walks home
  const frame = Math.min(n - 1, k % cycle);
  const V = run.sweeps[frame];
  const mdp = useMemo(() => buildMdp(world, DEFAULT_PARAMS), [world]);
  const actions = useMemo(() => {
    if (!run.arrowsLive) return frame > n * 0.25 ? ghostArrows(world) : null;
    try { return greedyPolicy(lookahead(mdp, V, GAMMA), mdp.nA); } catch { return null; }
  }, [run, frame, n, world, mdp, V]);
  const done = frame === n - 1;
  const trail = useMemo(() => (done && actions ? followArrows(world, actions) : null), [done, actions, world]);

  const onCell = (s: number) => {
    if (world.tiles[s] !== TILE.empty || s === world.start) return;
    const next = cloneWorld(world);
    const keep = [...added, s];
    if (keep.length > 3) next.tiles[keep.shift()!] = TILE.empty;
    next.tiles[s] = TILE.goal;
    setAdded(keep);
    setWorld(next);
    setK(0);
  };

  return (
    <div className="absolute inset-0">
      <GridView
        world={world}
        values={V}
        actions={actions}
        arrowAlpha={run.arrowsLive ? 0.75 : 0.4}
        trail={trail}
        agentSpeed={10}
        loopTrail={false}
        fit="cover"
        ease={0.35}
        onCell={onCell}
        className="h-full w-full rounded-none border-0"
        label="Value iteration flooding a gridworld. Tap to drop a goal."
        badge={
          <Badge solid={run.live}>
            {run.live ? "live" : "ghost"} · sweep {String(frame).padStart(3, "0")}
          </Badge>
        }
      />
      <div className="pointer-events-none absolute right-2 bottom-2">
        <Badge>{run.live ? "your valueIteration()" : "tap to drop a goal"}</Badge>
      </div>
    </div>
  );
}
