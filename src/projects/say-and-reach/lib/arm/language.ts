import { hashString, makeRng, pick, type Rng } from "./rng";

/*
 * The "L" in this tiny VLA. Words become fixed sparse random vectors (the hashing trick: each
 * word lights up 3 of 128 slots with ±1/√3), and a command is the scaled sum of its words.
 * The policy has to learn what the words mean from demonstrations: nothing here tells it that
 * "box" and "cube" are the same thing. Sparse, nearly orthogonal codes keep words from
 * interfering, and make the network's first layer cheap.
 */

export const EMBED_DIM = 128;

export type ObjectKind = "cube" | "ball" | "wedge";
export const OBJECTS: ObjectKind[] = ["cube", "ball", "wedge"];
export type Direction = "left" | "right" | "up" | "down";
export const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];
export const DIR_VEC: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };

export type Task = { kind: "push"; object: ObjectKind; dir: Direction } | { kind: "touch"; object: ObjectKind };

export const OBJECT_WORDS: Record<ObjectKind, string[]> = {
  cube: ["cube", "box", "block", "square"],
  ball: ["ball", "sphere", "circle", "puck"],
  wedge: ["triangle", "wedge", "pyramid"],
};
export const DIR_WORDS: Record<Direction, string[]> = {
  left: ["left", "leftwards", "west"],
  right: ["right", "rightwards", "east"],
  up: ["up", "forward", "away", "north"],
  down: ["down", "back", "closer", "south"],
};
const PUSH_VERBS = ["push", "move", "slide", "nudge", "shove"];
const TOUCH_VERBS = ["touch", "tap", "poke", "reach"];

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
}

const cache = new Map<string, Float32Array>();
const NNZ = 3;
/** A fixed sparse unit vector per word, seeded by the word's hash. */
export function wordVector(word: string): Float32Array {
  let v = cache.get(word);
  if (!v) {
    const rng = makeRng(hashString(word) ^ 0x5eed);
    v = new Float32Array(EMBED_DIM);
    for (let k = 0; k < NNZ; k++) v[Math.floor(rng() * EMBED_DIM)] += (rng() < 0.5 ? -1 : 1) / Math.sqrt(NNZ);
    cache.set(word, v);
  }
  return v;
}

/** Bag of words: Σ word vectors / √n. Order is ignored, so "left the cube push" means the same. */
export function embedTokens(tokens: string[]): Float32Array {
  const out = new Float32Array(EMBED_DIM);
  if (!tokens.length) return out;
  for (const t of tokens) {
    const v = wordVector(t);
    for (let i = 0; i < EMBED_DIM; i++) out[i] += v[i];
  }
  const s = 1 / Math.sqrt(tokens.length);
  for (let i = 0; i < EMBED_DIM; i++) out[i] *= s;
  return out;
}

export const embed = (text: string) => embedTokens(tokenize(text));

/**
 * A keyword parser, used only by the scripted expert (and to say what the expert thinks you
 * meant). The learned policies never see this: they only get the embedding.
 */
export function parseCommand(text: string): Task | null {
  const toks = tokenize(text);
  const object = OBJECTS.find((o) => toks.some((t) => OBJECT_WORDS[o].includes(t)));
  if (!object) return null;
  const dir = DIRECTIONS.find((d) => toks.some((t) => DIR_WORDS[d].includes(t)));
  if (dir) return { kind: "push", object, dir };
  if (toks.some((t) => TOUCH_VERBS.includes(t) || t === "point")) return { kind: "touch", object };
  return null;
}

export function describeTask(t: Task): string {
  return t.kind === "touch" ? `touch the ${t.object}` : `push the ${t.object} ${t.dir}`;
}

/*
 * Train / held-out split. Some (object word, direction word) pairings never appear in training,
 * so the evaluation asks for combinations the policy has never heard together.
 */
function isHeldOut(objWord: string, dirWord: string): boolean {
  return (hashString(objWord + "|" + dirWord) % 5) === 0;
}

export function sampleCommand(rng: Rng, split: "train" | "heldout"): { text: string; task: Task } {
  for (let attempt = 0; attempt < 100; attempt++) {
    const object = pick(rng, OBJECTS);
    const ow = pick(rng, OBJECT_WORDS[object]);
    if (rng() < 0.2) {
      // touch commands: held-out pairs are verb × object word
      const v = pick(rng, TOUCH_VERBS);
      if (isHeldOut(ow, v) !== (split === "heldout")) continue;
      return { text: rng() < 0.5 ? `${v} the ${ow}` : `${v} ${ow}`, task: { kind: "touch", object } };
    }
    const dir = pick(rng, DIRECTIONS);
    const dw = pick(rng, DIR_WORDS[dir]);
    if (isHeldOut(ow, dw) !== (split === "heldout")) continue;
    const verb = pick(rng, PUSH_VERBS);
    const tmpl = pick(rng, [
      `${verb} the ${ow} ${dw}`,
      dir === "left" || dir === "right" ? `${verb} the ${ow} to the ${dw}` : `${verb} the ${ow} ${dw} a bit`,
      `${verb} ${ow} ${dw}`,
      `please ${verb} the ${ow} ${dw}`,
      `${dw} ${verb} the ${ow}`,
    ]);
    return { text: tmpl, task: { kind: "push", object, dir } };
  }
  return { text: "push the cube left", task: { kind: "push", object: "cube", dir: "left" } };
}

/** Suggestions shown as chips under the command box. */
export const SUGGESTIONS = [
  "push the cube left",
  "slide the ball up",
  "nudge the triangle right",
  "touch the box",
  "shove the sphere back",
  "poke the wedge",
];
