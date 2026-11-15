"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/** Renders children only in the browser (the labs print floats and use OffscreenCanvas). */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? children : fallback ?? null;
}
