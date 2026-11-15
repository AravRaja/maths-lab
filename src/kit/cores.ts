import { isNotYoursYet, type NotYoursYetInfo } from "./not-yours-yet";

/**
 * A project's registry of maths cores. `probe` calls the core with a tiny input;
 * if it throws NotYoursYet the core is a stub, if it returns it is implemented,
 * if it throws anything else it is "broken" (written but erroring).
 */
export interface CoreSpec extends NotYoursYetInfo {
  probe: () => unknown;
}

export type CoreState = "todo" | "done" | "broken";

export interface CoreProbeResult {
  spec: CoreSpec;
  state: CoreState;
  error?: string;
}

export function probeCore(spec: CoreSpec): CoreProbeResult {
  try {
    const out = spec.probe();
    if (out instanceof Promise) {
      // Async cores: treat as done; their own UI reports failures.
      out.catch(() => {});
    }
    return { spec, state: "done" };
  } catch (e) {
    if (isNotYoursYet(e)) return { spec, state: "todo" };
    return { spec, state: "broken", error: e instanceof Error ? e.message : String(e) };
  }
}

export function probeCores(specs: CoreSpec[]): CoreProbeResult[] {
  return specs.map(probeCore);
}

const DEFAULT_REPO = "https://github.com/AravRaja/maths-lab";

/** The LEARNING.md that owns a core file: src/projects/<slug>/... -> src/projects/<slug>/LEARNING.md. */
export function learningPath(file?: string): string {
  const m = file?.match(/^src\/projects\/([^/]+)\//);
  return m ? `src/projects/${m[1]}/LEARNING.md` : "README.md";
}

/**
 * Link to a milestone in the project's LEARNING.md on GitHub.
 * Pass the core's `file` so the link lands in the right project.
 */
export function milestoneHref(milestone?: string, file?: string): string | undefined {
  if (!milestone) return undefined;
  const repo = (process.env.NEXT_PUBLIC_REPO_URL || DEFAULT_REPO).replace(/\/$/, "");
  return `${repo}/blob/main/${learningPath(file)}#${milestone}`;
}
