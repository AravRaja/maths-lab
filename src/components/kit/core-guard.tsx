"use client";

import { Component, useMemo, type ComponentType, type ReactNode } from "react";
import { isNotYoursYet, type NotYoursYet } from "@/lib/kit/not-yours-yet";
import { YoursToWrite } from "./yours-to-write";

export type CoreResult<T> =
  | { status: "ok"; value: T; missing: null; error: null }
  | { status: "missing"; value: undefined; missing: NotYoursYet; error: null }
  | { status: "error"; value: undefined; missing: null; error: Error };

/** Run a core synchronously and classify the outcome. Pure; usable outside React. */
export function runCore<T>(fn: () => T): CoreResult<T> {
  try {
    return { status: "ok", value: fn(), missing: null, error: null };
  } catch (e) {
    if (isNotYoursYet(e)) return { status: "missing", value: undefined, missing: e, error: null };
    return { status: "error", value: undefined, missing: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Memoised core call for render code.
 *
 *   const r = useCore(() => softmax(logits, temperature), [logits, temperature]);
 *   if (r.missing) return <CorePanel error={r.missing} ghost={<Ghost ... />} />;
 */
export function useCore<T>(fn: () => T, deps: unknown[]): CoreResult<T> {
  // Deps are the caller's, like useMemo. The compiler lint can't see through that, so it's opted out here only.
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
  return useMemo(() => runCore(fn), deps);
}

/** YoursToWrite panel built from a caught NotYoursYet. */
export function CorePanel({ error, ghost, className }: { error: NotYoursYet; ghost?: ReactNode; className?: string }) {
  return (
    <YoursToWrite file={error.file} fn={error.fn} milestone={error.milestone} summary={error.summary} className={className}>
      {ghost}
    </YoursToWrite>
  );
}

/** Shown when a core is written but throws something else. */
export function CoreError({ error }: { error: Error }) {
  return (
    <div role="alert" className="rounded-2xl border border-ink p-5">
      <p className="type-narrow text-xs tracking-[0.2em] uppercase">Core threw</p>
      <p className="mt-2 font-mono text-sm break-words">{error.message}</p>
    </div>
  );
}

/**
 * Error boundary: any NotYoursYet thrown while rendering children becomes the panel.
 * Other errors render <CoreError>. Change `resetKey` to retry (e.g. after hot reload).
 */
export class CoreBoundary extends Component<
  { children: ReactNode; ghost?: ReactNode; resetKey?: unknown },
  { error: unknown; key: unknown }
> {
  state = { error: null as unknown, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey?: unknown }, state: { error: unknown; key: unknown }) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (isNotYoursYet(error)) return <CorePanel error={error} ghost={this.props.ghost} />;
      return <CoreError error={error instanceof Error ? error : new Error(String(error))} />;
    }
    return this.props.children;
  }
}

/** HOC form of CoreBoundary. */
export function withCore<P extends object>(Inner: ComponentType<P>, ghost?: ReactNode) {
  function WithCore(props: P) {
    return (
      <CoreBoundary ghost={ghost}>
        <Inner {...props} />
      </CoreBoundary>
    );
  }
  WithCore.displayName = `withCore(${Inner.displayName ?? Inner.name ?? "Component"})`;
  return WithCore;
}
