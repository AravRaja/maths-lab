import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "ppo-arena",
  title: "PPO arena",
  tagline: "Keep the torch up. Eight agents learn to balance a flame on a cart with PPO, live in your browser, lighting the dark only as well as they have learnt.",
  week: "Week 7",
  topic: "Policy gradient · GAE · PPO",
  status: "live",
  cores: CORES,
};
