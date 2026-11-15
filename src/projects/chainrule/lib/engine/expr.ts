import { Value } from "./value";

/*
 * A tiny expression language: numbers, variables, + − × / ^, unary minus and the functions
 * exp, log, tanh, relu, sigmoid, sq. It compiles to a fast numeric function (for fields)
 * or to a graph of Values (for autograd). Exponents must be constant.
 */

export type Ast =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; a: Ast }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Ast; b: Ast }
  | { t: "call"; fn: Fn; a: Ast };

export const FUNCTIONS = ["exp", "log", "tanh", "relu", "sigmoid", "sq"] as const;
export type Fn = (typeof FUNCTIONS)[number];

type Tok = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Bad number at ${i + 1}`);
      out.push({ k: "num", v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z_]/i.test(c)) {
      const m = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i))!;
      out.push({ k: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === "*" && src[i + 1] === "*") { out.push({ k: "op", v: "^" }); i += 2; continue; }
    if ("+-*/^()·×−".includes(c)) {
      out.push({ k: "op", v: c === "·" || c === "×" ? "*" : c === "−" ? "-" : c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

export function parse(src: string): Ast {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.k === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected "${v}"`);
    p++;
  };

  // expr := term (('+'|'-') term)*
  const expr = (): Ast => {
    let a = term();
    while (isOp("+") || isOp("-")) {
      const op = toks[p++].v as "+" | "-";
      a = { t: "bin", op, a, b: term() };
    }
    return a;
  };
  // term := unary (('*'|'/') unary | implicit-mul)*
  const term = (): Ast => {
    let a = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = toks[p++].v as "*" | "/";
        a = { t: "bin", op, a, b: unary() };
      } else if (peek() && (peek()!.k === "id" || isOp("("))) {
        a = { t: "bin", op: "*", a, b: unary() }; // 2x, 3(x+1)
      } else return a;
    }
  };
  const unary = (): Ast => {
    if (isOp("-")) { p++; return { t: "neg", a: unary() }; }
    if (isOp("+")) { p++; return unary(); }
    return power();
  };
  // power := atom ('^' unary)?   (right assoc)
  const power = (): Ast => {
    const a = atom();
    if (isOp("^")) { p++; return { t: "bin", op: "^", a, b: unary() }; }
    return a;
  };
  const atom = (): Ast => {
    const tk = peek();
    if (!tk) throw new Error("Unexpected end");
    if (tk.k === "num") { p++; return { t: "num", v: tk.v }; }
    if (tk.k === "id") {
      p++;
      if ((FUNCTIONS as readonly string[]).includes(tk.v)) {
        expect("(");
        const a = expr();
        expect(")");
        return { t: "call", fn: tk.v as Fn, a };
      }
      if (isOp("(")) throw new Error(`Unknown function "${tk.v}"`);
      return { t: "var", name: tk.v };
    }
    if (isOp("(")) { p++; const a = expr(); expect(")"); return a; }
    throw new Error(`Unexpected "${tk.v}"`);
  };

  const ast = expr();
  if (p < toks.length) throw new Error(`Unexpected "${String(toks[p].v)}"`);
  return ast;
}

/** Variables in order of first appearance. */
export function variables(ast: Ast): string[] {
  const out: string[] = [];
  const walk = (n: Ast) => {
    if (n.t === "var") { if (!out.includes(n.name)) out.push(n.name); }
    else if (n.t === "neg" || n.t === "call") walk(n.a);
    else if (n.t === "bin") { walk(n.a); walk(n.b); }
  };
  walk(ast);
  return out;
}

/** Constant-fold an exponent (must not contain variables). */
function constValue(n: Ast): number {
  if (variables(n).length) throw new Error("Exponents must be numbers (x^2, not x^y)");
  return compile(n, [])([]);
}

/** Fast numeric evaluation, for drawing fields. */
export function compile(ast: Ast, vars: string[]): (x: ArrayLike<number>) => number {
  const go = (n: Ast): ((x: ArrayLike<number>) => number) => {
    switch (n.t) {
      case "num": { const v = n.v; return () => v; }
      case "var": { const i = vars.indexOf(n.name); if (i < 0) throw new Error(`Unknown variable ${n.name}`); return (x) => x[i]; }
      case "neg": { const a = go(n.a); return (x) => -a(x); }
      case "call": {
        const a = go(n.a);
        switch (n.fn) {
          case "exp": return (x) => Math.exp(a(x));
          case "log": return (x) => Math.log(a(x));
          case "tanh": return (x) => Math.tanh(a(x));
          case "relu": return (x) => Math.max(0, a(x));
          case "sigmoid": return (x) => 1 / (1 + Math.exp(-a(x)));
          case "sq": return (x) => { const v = a(x); return v * v; };
        }
        break;
      }
      case "bin": {
        const a = go(n.a);
        if (n.op === "^") { const k = constValue(n.b); return (x) => Math.pow(a(x), k); }
        const b = go(n.b);
        switch (n.op) {
          case "+": return (x) => a(x) + b(x);
          case "-": return (x) => a(x) - b(x);
          case "*": return (x) => a(x) * b(x);
          case "/": return (x) => a(x) / b(x);
        }
      }
    }
    throw new Error("unreachable");
  };
  return go(ast);
}

/**
 * Build an autograd graph. Each variable becomes one shared leaf; desugars − / sigmoid sq
 * into add, mul, pow and exp so only the user's seven op rules are needed.
 */
export function buildGraph(ast: Ast, env: Record<string, number>): { root: Value; leaves: Record<string, Value> } {
  const leaves: Record<string, Value> = {};
  const go = (n: Ast): Value => {
    switch (n.t) {
      case "num": return Value.const(n.v);
      case "var": {
        if (!(n.name in leaves)) leaves[n.name] = Value.leaf(env[n.name] ?? 0, n.name);
        return leaves[n.name];
      }
      case "neg": return go(n.a).neg();
      case "call": {
        const a = go(n.a);
        switch (n.fn) {
          case "exp": return a.exp();
          case "log": return a.log();
          case "tanh": return a.tanh();
          case "relu": return a.relu();
          case "sigmoid": return a.neg().exp().add(1).pow(-1);
          case "sq": return a.pow(2);
        }
        break;
      }
      case "bin": {
        if (n.op === "^") return go(n.a).pow(constValue(n.b));
        const a = go(n.a), b = go(n.b);
        if (n.op === "+") return a.add(b);
        if (n.op === "-") return a.sub(b);
        if (n.op === "*") return a.mul(b);
        return a.div(b);
      }
    }
    throw new Error("unreachable");
  };
  const root = go(ast);
  return { root, leaves };
}

export interface Preset {
  name: string;
  src: string;
  env: Record<string, number>;
}

export const PRESETS: Preset[] = [
  { name: "neuron", src: "tanh(w1*x1 + w2*x2 + b)", env: { w1: -3, x1: 2, w2: 1, x2: 0, b: 6.8813735870195432 } },
  { name: "x·x", src: "x*x + x", env: { x: 1.5 } },
  { name: "softplus", src: "log(1 + exp(a*b))", env: { a: 0.8, b: -1.2 } },
  { name: "gate", src: "relu(x - y) * tanh(y) + x/y", env: { x: 1.2, y: 0.7 } },
  { name: "sigmoid", src: "sigmoid(3x - 1)", env: { x: 0.4 } },
];
