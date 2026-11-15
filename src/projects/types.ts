import type { CoreSpec } from "@/kit/cores";

/**
 * What every project tells the rest of the site about itself.
 * Lives in src/projects/<slug>/meta.ts; collected in src/projects/registry.ts.
 */
export interface ProjectMeta {
  /** URL and folder name: /<slug>, src/projects/<slug>/. */
  slug: string;
  /** Display title, e.g. "Chain rule". */
  title: string;
  /** One sentence for the landing card and the page hero. */
  tagline: string;
  /** Where it sits in the syllabus, e.g. "Week 3" or "Weeks 5–6". */
  week: string;
  /** Short maths label, e.g. "Autograd · backprop". */
  topic: string;
  /** "building" shows the placeholder badge on the landing page. */
  status: "building" | "live";
  /**
   * Every maths core, each with a tiny `probe` input. Drives <CoreStatus> and the
   * "cores written x/y" count on the landing page. Empty until the project has stubs.
   */
  cores: CoreSpec[];
}
