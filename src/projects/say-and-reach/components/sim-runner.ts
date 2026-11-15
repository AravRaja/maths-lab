import { EPISODE_STEPS, DT } from "@/projects/say-and-reach/lib/arm/config";
import { expertController, flowController, gaussianController, type Controller, type Mode, type StepInfo } from "@/projects/say-and-reach/lib/arm/controllers";
import { embed, parseCommand, type Task } from "@/projects/say-and-reach/lib/arm/language";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { goalOf, succeeded } from "@/projects/say-and-reach/lib/arm/score";
import { cloneScene, objectOf, step, type Scene } from "@/projects/say-and-reach/lib/arm/world";
import type { PolicyState } from "@/projects/say-and-reach/lib/arm/store";

/*
 * Runs one episode at a fixed 20 Hz no matter the frame rate. Shared by the hero and the
 * playground. Plain object, kept in a ref: the canvas loop reads it every frame.
 */

export class SimRunner {
  scene: Scene;
  start: Scene;
  text = "";
  task: Task | null = null;
  mode: Mode = "expert";
  ctrl: Controller | null = null;
  info: StepInfo | null = null;
  steps = 0;
  running = false;
  success = false;
  hitAt = -1;
  error: unknown = null;
  private acc = 0;
  /** Fingertip trail for drawing. */
  trail: [number, number][] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.start = cloneScene(scene);
  }

  setScene(scene: Scene) {
    this.scene = scene;
    this.start = cloneScene(scene);
    this.stop();
    this.trail = [];
    this.info = null;
  }

  /**
   * Start an episode. The expert needs a parsable command; the learned heads take any text.
   * Returns false (and does nothing) when the chosen mode can't run.
   */
  run(text: string, mode: Mode, policies: PolicyState, opts: { particles?: number; seed?: number; restart?: boolean } = {}): boolean {
    const task = parseCommand(text);
    let ctrl: Controller | null = null;
    if (mode === "expert") ctrl = task ? expertController(task, 1) : null;
    else if (mode === "gaussian" && policies.gaussian) ctrl = gaussianController(policies.gaussian, embed(text));
    else if (mode === "flow" && policies.flow) ctrl = flowController(policies.flow, embed(text), makeRng(opts.seed ?? Date.now() & 0xffff), opts.particles ?? 24);
    if (!ctrl) return false;
    if (opts.restart !== false) this.scene = cloneScene(this.start);
    else this.start = cloneScene(this.scene);
    this.text = text;
    this.task = task;
    this.mode = mode;
    this.ctrl = ctrl;
    this.steps = 0;
    this.running = true;
    this.success = false;
    this.hitAt = -1;
    this.error = null;
    this.trail = [[this.scene.tip[0], this.scene.tip[1]]];
    this.info = null;
    return true;
  }

  stop() {
    this.running = false;
  }

  /** Swap in new weights mid-episode (live training snapshots). */
  refresh(policies: PolicyState) {
    if (!this.running || this.mode === "expert") return;
    const w = this.mode === "gaussian" ? policies.gaussian : policies.flow;
    if (!w) return;
    this.ctrl = this.mode === "gaussian" ? gaussianController(w, embed(this.text)) : flowController(w, embed(this.text), makeRng(7), 24);
  }

  get goal(): [number, number] | null {
    return this.task ? goalOf(this.start, this.task) : null;
  }

  get from(): [number, number] | null {
    if (!this.task) return null;
    const o = objectOf(this.start, this.task.object);
    return [o.x, o.y];
  }

  /** Advance by dt seconds of wall time. */
  tick(dt: number) {
    if (!this.running || !this.ctrl) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= DT && this.running) {
      this.acc -= DT;
      try {
        this.info = this.ctrl.act(this.scene);
        step(this.scene, this.info.action);
      } catch (e) {
        this.error = e;
        this.running = false;
        return;
      }
      this.steps++;
      this.trail.push([this.scene.tip[0], this.scene.tip[1]]);
      if (this.trail.length > 160) this.trail.shift();
      if (this.task && !this.success && succeeded(this.start, this.scene, this.task)) {
        this.success = true;
        this.hitAt = this.steps;
      }
      if (this.steps >= EPISODE_STEPS) this.running = false;
    }
  }
}
