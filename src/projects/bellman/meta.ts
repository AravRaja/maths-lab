import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "bellman",
  title: "Bellman",
  tagline:
    "Paint walls, lava and goals. Value floods the map wave by wave as dithered terrain, arrows snap to the optimal policy, then an agent with no map learns it by trial and error.",
  week: "Weeks 5–6",
  topic: "MDPs · Bellman backups · TD · Q-learning",
  status: "live",
  cores: CORES,
};
