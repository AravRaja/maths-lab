import type { ProjectMeta } from "../types";
import { CORES } from "./core";

export const meta: ProjectMeta = {
  slug: "daydream",
  title: "Daydream",
  tagline: "A tiny VAE learns to see a bouncing ball in two numbers, then a dynamics model keeps it bouncing in its head after you close its eyes.",
  week: "Weeks 8–9",
  topic: "ELBO · reparameterisation · latent dynamics",
  status: "live",
  cores: CORES,
};
