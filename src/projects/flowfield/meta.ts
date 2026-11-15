import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "flowfield",
  title: "Flow field",
  tagline:
    "Flow matching from scratch. Draw a shape and watch a cloud of noise stream into it along a field trained live in your browser, then point the same maths at a robot arm's next eight moves.",
  week: "Weeks 9–10",
  topic: "Flow matching · ODE sampling · guidance",
  status: "live",
  cores: CORES,
};
