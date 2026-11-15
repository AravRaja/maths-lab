/**
 * The "you write the core" convention.
 *
 * Every maths core in `src/projects/<slug>/core/` starts life as a stub that throws `NotYoursYet`.
 * The UI catches it (see `useCore`, `withCore`, `<CoreBoundary>`) and shows the
 * "Yours to write" panel instead of crashing. Tests in `src/projects/<slug>/core/__tests__/` fail
 * until the real maths is written.
 */

export interface NotYoursYetInfo {
  /** Path of the file the stub lives in, e.g. "src/projects/rank/core/svd.ts". */
  file: string;
  /** Exported function name, e.g. "powerIteration". */
  fn: string;
  /** Milestone anchor in the project's LEARNING.md, e.g. "m1-power". Optional. */
  milestone?: string;
  /** One line on what the function does. Shown in the panel. */
  summary?: string;
}

export class NotYoursYet extends Error {
  readonly file: string;
  readonly fn: string;
  readonly milestone?: string;
  readonly summary?: string;
  /** Stable brand so the check survives bundling, workers and structured clone. */
  readonly notYoursYet = true as const;

  constructor(info: NotYoursYetInfo) {
    super(`${info.fn} in ${info.file} is yours to write${info.milestone ? ` (LEARNING.md#${info.milestone})` : ""}.`);
    this.name = "NotYoursYet";
    this.file = info.file;
    this.fn = info.fn;
    this.milestone = info.milestone;
    this.summary = info.summary;
  }
}

/** True for a NotYoursYet error, including one rebuilt from a worker message. */
export function isNotYoursYet(e: unknown): e is NotYoursYet {
  return (
    e instanceof NotYoursYet ||
    (typeof e === "object" && e !== null && (e as { notYoursYet?: unknown }).notYoursYet === true) ||
    (e instanceof Error && e.name === "NotYoursYet")
  );
}

/** Plain-object form for postMessage (Error subclasses don't survive structured clone). */
export function serializeNotYoursYet(e: NotYoursYet): NotYoursYetInfo & { notYoursYet: true; message: string } {
  return { notYoursYet: true, message: e.message, file: e.file, fn: e.fn, milestone: e.milestone, summary: e.summary };
}

/** Rebuild an error that came back from a worker. */
export function reviveError(e: unknown): Error {
  if (isNotYoursYet(e) && !(e instanceof NotYoursYet)) {
    const o = e as unknown as NotYoursYetInfo;
    return new NotYoursYet({ file: o.file, fn: o.fn, milestone: o.milestone, summary: o.summary });
  }
  if (e instanceof Error) return e;
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return new Error(msg);
}

/**
 * Use inside a stub:  `throw notYoursYet({ file: "src/projects/rank/core/svd.ts", fn: "powerIteration", milestone: "m1-power" })`
 */
export function notYoursYet(info: NotYoursYetInfo): NotYoursYet {
  return new NotYoursYet(info);
}
