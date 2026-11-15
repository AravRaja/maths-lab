import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "posterior",
  title: "Posterior",
  tagline:
    "Belief sharpening flip by flip, a 2D Gaussian sliced by an observation, darts closing in on π with honest error bars, and two KLs that disagree about the same pair of distributions.",
  week: "Week 4",
  topic: "Bayes · Monte Carlo · KL",
  status: "live",
  cores: CORES,
};
