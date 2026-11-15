import { collect, type Value } from "./value";

export interface LaidNode {
  v: Value;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  small: boolean;
}
export interface LaidEdge {
  /** The child (consumer), drawn above. */
  child: LaidNode;
  /** The parent (input), drawn below. */
  parent: LaidNode;
  /** Index into child.parents (x·x has two edges from the same parent). */
  index: number;
}

export const LAYER_GAP = 90;
export const NODE_H = 44;
const PAD_Y = 30;

/**
 * Layered layout for drawing: output at the top, inputs fanning out below.
 * A node's layer is its longest distance from the root, so shared inputs sit below all their users.
 */
export function layoutGraph(root: Value, width: number): { nodes: LaidNode[]; edges: LaidEdge[]; height: number } {
  const all = collect(root);
  const children = new Map<Value, Value[]>();
  for (const v of all) for (const p of v.parents) {
    const list = children.get(p) ?? [];
    if (!list.includes(v)) list.push(v);
    children.set(p, list);
  }
  const depth = new Map<Value, number>();
  const d = (v: Value): number => {
    if (v === root) return 0;
    const cached = depth.get(v);
    if (cached !== undefined) return cached;
    const val = 1 + Math.max(...(children.get(v) ?? [root]).map(d));
    depth.set(v, val);
    return val;
  };
  depth.set(root, 0);
  for (const v of all) d(v);

  // Initial order within each layer: first-seen DFS order from the root (argument order).
  const order = new Map<Value, number>();
  let k = 0;
  const seen = new Set<Value>();
  const dfs = (v: Value) => {
    if (seen.has(v)) return;
    seen.add(v);
    order.set(v, k++);
    v.parents.forEach(dfs);
  };
  dfs(root);

  const nLayers = Math.max(...all.map((v) => depth.get(v)!)) + 1;
  const layers: Value[][] = Array.from({ length: nLayers }, () => []);
  for (const v of all) layers[depth.get(v)!].push(v);
  layers.forEach((L) => L.sort((a, b) => order.get(a)! - order.get(b)!));

  // Barycentre sweeps: place each node under the mean position of its users.
  const pos = new Map<Value, number>();
  const assign = (L: Value[]) => L.forEach((v, i) => pos.set(v, (i + 0.5) / L.length));
  layers.forEach(assign);
  for (let sweep = 0; sweep < 3; sweep++) {
    for (let l = 1; l < nLayers; l++) {
      const L = layers[l];
      const bary = new Map(L.map((v) => {
        const cs = children.get(v) ?? [];
        return [v, cs.length ? cs.reduce((s, c) => s + pos.get(c)!, 0) / cs.length : pos.get(v)!];
      }));
      L.sort((a, b) => bary.get(a)! - bary.get(b)! || order.get(a)! - order.get(b)!);
      assign(L);
    }
  }

  const nodes = new Map<Value, LaidNode>();
  layers.forEach((L, l) => {
    const slot = width / L.length;
    L.forEach((v, i) => {
      const small = v.op === "const";
      const w = small ? Math.min(40, slot - 6) : Math.min(76, slot - 8);
      nodes.set(v, { v, layer: l, x: slot * (i + 0.5), y: PAD_Y + NODE_H / 2 + l * LAYER_GAP, w: Math.max(26, w), h: small ? 26 : NODE_H, small });
    });
  });
  const edges: LaidEdge[] = [];
  for (const v of all) v.parents.forEach((p, index) => edges.push({ child: nodes.get(v)!, parent: nodes.get(p)!, index }));
  return { nodes: [...nodes.values()], edges, height: PAD_Y * 2 + NODE_H + (nLayers - 1) * LAYER_GAP + 18 };
}

/** Compact number for node labels. */
export function fmtNum(v: number): string {
  if (!isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "NaN";
  const a = Math.abs(v);
  let s: string;
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) s = v.toExponential(1);
  else s = (+v.toPrecision(3)).toString();
  return s.replace("-", "−");
}
