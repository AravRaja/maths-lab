"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/**
 * Renders children only in the browser. The labs print floating-point results (gradients down to
 * 1e-11) whose last digits can differ between Node and the browser, which would break hydration.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? children : fallback ?? null;
}
