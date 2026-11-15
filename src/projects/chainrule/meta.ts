import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "chainrule",
  title: "Chain rule",
  tagline: "A tiny autograd engine written by hand. Type an expression and watch gradients fall through its graph, then train a network with it.",
  week: "Week 3",
  topic: "Autograd · backprop · gradient check",
  status: "live",
  cores: CORES,
};
