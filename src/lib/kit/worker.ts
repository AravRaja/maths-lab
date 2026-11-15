import { reviveError, isNotYoursYet, serializeNotYoursYet, NotYoursYet } from "./not-yours-yet";

/**
 * Typed request/response over a Web Worker.
 *
 * Worker side (src/workers/foo.worker.ts):
 *   import { exposeWorker } from "@/lib/kit/worker";
 *   exposeWorker({ train: (args: { steps: number }, progress) => { ...; progress(i / steps); return result; } });
 *
 * Main side:
 *   const w = createWorkerClient<typeof handlers>(() => new Worker(new URL("../workers/foo.worker.ts", import.meta.url)));
 *   const out = await w.call("train", { steps: 100 }, (p) => setProgress(p));
 *
 * A NotYoursYet thrown inside the worker is rebuilt on the main side, so the UI can show the panel.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (args: any, progress: (value: unknown) => void) => unknown;
export type Handlers = Record<string, Handler>;

type Req = { id: number; method: string; args: unknown };
type Res =
  | { id: number; kind: "progress"; value: unknown }
  | { id: number; kind: "ok"; value: unknown }
  | { id: number; kind: "err"; error: unknown };

/** Call once at the top level of a worker module. */
export function exposeWorker(handlers: Handlers): void {
  const scope = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage: (m: Res, t?: Transferable[]) => void };
  scope.onmessage = async (e) => {
    const { id, method, args } = e.data;
    const send = (m: Res) => scope.postMessage(m);
    try {
      const h = handlers[method];
      if (!h) throw new Error(`No worker method "${method}"`);
      const value = await h(args, (v) => send({ id, kind: "progress", value: v }));
      send({ id, kind: "ok", value });
    } catch (err) {
      const error = isNotYoursYet(err) && err instanceof NotYoursYet
        ? serializeNotYoursYet(err)
        : { message: err instanceof Error ? err.message : String(err) };
      send({ id, kind: "err", error });
    }
  };
}

export interface WorkerClient<H extends Handlers> {
  call<K extends keyof H & string>(
    method: K,
    args: Parameters<H[K]>[0],
    onProgress?: (value: unknown) => void,
  ): Promise<Awaited<ReturnType<H[K]>>>;
  /** Kill the worker (cancels in-flight calls) and start a fresh one on the next call. */
  restart(): void;
  terminate(): void;
}

export function createWorkerClient<H extends Handlers>(make: () => Worker): WorkerClient<H> {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (v: unknown) => void }>();

  const ensure = () => {
    if (worker) return worker;
    worker = make();
    worker.onmessage = (e: MessageEvent<Res>) => {
      const m = e.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.kind === "progress") p.onProgress?.(m.value);
      else {
        pending.delete(m.id);
        if (m.kind === "ok") p.resolve(m.value);
        else p.reject(reviveError(m.error));
      }
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "Worker error"));
      pending.clear();
    };
    return worker;
  };

  const terminate = () => {
    worker?.terminate();
    worker = null;
    for (const p of pending.values()) p.reject(new Error("Worker terminated"));
    pending.clear();
  };

  return {
    call(method, args, onProgress) {
      const id = nextId++;
      const w = ensure();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
        w.postMessage({ id, method, args } satisfies Req);
      });
    },
    restart: terminate,
    terminate,
  };
}
