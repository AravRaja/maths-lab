"use client";

import { useEffect, useRef } from "react";
import { createWorkerClient, type Handlers, type WorkerClient } from "@/lib/kit/worker";

/**
 * A worker client tied to the component's lifetime.
 *
 *   const worker = useWorker<typeof import("@/workers/example.worker").handlers>(
 *     () => new Worker(new URL("../../workers/example.worker.ts", import.meta.url)),
 *   );
 *   await worker.current?.call("method", args, onProgress);
 *
 * Note: the `new URL(..., import.meta.url)` must be written literally at the call site so the bundler finds the worker.
 */
export function useWorker<H extends Handlers>(make: () => Worker) {
  const client = useRef<WorkerClient<H> | null>(null);
  const makeRef = useRef(make);
  useEffect(() => {
    const c = createWorkerClient<H>(() => makeRef.current());
    client.current = c;
    return () => {
      c.terminate();
      client.current = null;
    };
  }, []);
  return client;
}
