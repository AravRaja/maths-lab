import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "jacobian",
  title: "Jacobian",
  tagline:
    "A six-joint arm built from bare matrices: it chases your finger through singularities, balances a pole with LQR and catches a firefly it can only see through noise.",
  week: "Weeks 10–11",
  topic: "SE(3) · Jacobians · LQR · Kalman",
  status: "live",
  cores: CORES,
};
