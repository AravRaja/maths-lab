import type { ProjectMeta } from "./types";
import { meta as rank } from "./rank/meta";
import { meta as chainrule } from "./chainrule/meta";
import { meta as posterior } from "./posterior/meta";
import { meta as bellman } from "./bellman/meta";
import { meta as ppoArena } from "./ppo-arena/meta";
import { meta as daydream } from "./daydream/meta";
import { meta as flowfield } from "./flowfield/meta";
import { meta as jacobian } from "./jacobian/meta";
import { meta as sayAndReach } from "./say-and-reach/meta";

export type { ProjectMeta } from "./types";

/** All nine projects, in syllabus order. */
export const PROJECTS: ProjectMeta[] = [rank, chainrule, posterior, bellman, ppoArena, daydream, flowfield, jacobian, sayAndReach];

export function projectIndex(slug: string): number {
  const i = PROJECTS.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error(`Unknown project "${slug}". Add it to src/projects/registry.ts.`);
  return i;
}

export function getProject(slug: string): ProjectMeta {
  return PROJECTS[projectIndex(slug)];
}
