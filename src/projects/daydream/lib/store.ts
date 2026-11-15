"use client";

import { useSyncExternalStore } from "react";
import type { VaeWeights } from "./vae";
import type { DynWeights } from "./dynamics";

/*
 * The trained model, shared by every section of the page (and the hero). Kept in memory and,
 * best effort, in this browser's localStorage so a trained mind survives a reload.
 * Nothing here is shared with anyone else.
 */

export interface Mind {
  vae: VaeWeights | null;
  dyn: DynWeights | null;
  /** Encoded cloud of dataset frames (for plots) and their true positions. */
  cloud: Float32Array | null;
  cloudPos: Float32Array | null;
  /** Where the weights came from: trained just now, or restored from this browser. */
  source: "none" | "session" | "restored";
}

const EMPTY: Mind = { vae: null, dyn: null, cloud: null, cloudPos: null, source: "none" };
const KEY = "daydream:mind:v1";

let mind: Mind = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function b64(a: Float32Array): string {
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(s: string): Float32Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Float32Array(u.buffer);
}

function save() {
  try {
    if (!mind.vae) {
      localStorage.removeItem(KEY);
      return;
    }
    const v = mind.vae;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        vae: { shape: v.shape, enc: b64(v.enc), dec: b64(v.dec) },
        dyn: mind.dyn ? { latent: mind.dyn.latent, hidden: mind.dyn.hidden, p: b64(mind.dyn.p) } : null,
        cloud: mind.cloud ? b64(mind.cloud) : null,
        cloudPos: mind.cloudPos ? b64(mind.cloudPos) : null,
      }),
    );
  } catch {
    /* storage full or blocked: the model just won't survive a reload */
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    mind = {
      vae: { shape: o.vae.shape, enc: unb64(o.vae.enc), dec: unb64(o.vae.dec) },
      dyn: o.dyn ? { latent: o.dyn.latent, hidden: o.dyn.hidden, p: unb64(o.dyn.p) } : null,
      cloud: o.cloud ? unb64(o.cloud) : null,
      cloudPos: o.cloudPos ? unb64(o.cloudPos) : null,
      source: "restored",
    };
  } catch {
    mind = EMPTY;
  }
}

export function getMind(): Mind {
  load();
  return mind;
}

export function setMind(patch: Partial<Mind>, persist = true) {
  load();
  mind = { ...mind, ...patch };
  if (persist) save();
  subs.forEach((f) => f());
}

export function forgetMind() {
  mind = EMPTY;
  save();
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

/** The shared mind. EMPTY during SSR so hydration matches. */
export function useMind(): Mind {
  return useSyncExternalStore(subscribe, getMind, () => EMPTY);
}
