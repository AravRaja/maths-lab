import { babble, randomState, render, step, PIXELS, SIDE, type Action, type BallState } from "./world";
import { rng } from "./rng";

/**
 * A live world for the page: the ball, an autopilot that babbles, manual overrides and kicks.
 * Kicks are impulses that never show up as actions, so the model can't see them coming.
 */
export class LiveWorld {
  s: BallState;
  frame = new Float32Array(PIXELS);
  /** Action the next step will use. */
  action: Action = 0;
  /** Manual action held by the user, or null for autopilot. */
  manual: Action | null = null;
  private auto: () => Action;
  private r: () => number;
  private pendingKick: { vx: number; vy: number } | null = null;
  t = 0;

  constructor(seed = 42) {
    this.r = rng(seed);
    this.auto = babble(seed + 1);
    this.s = randomState(this.r);
    render(this.s, SIDE, this.frame);
  }

  kick(strength = 0.06) {
    const a = this.r() * Math.PI * 2;
    this.pendingKick = { vx: Math.cos(a) * strength, vy: Math.sin(a) * strength - 0.02 };
  }

  /** Advance one step. Returns the action that was taken (needed by the dynamics model). */
  tick(): { action: Action; kicked: boolean } {
    const a = this.manual ?? this.auto();
    const kicked = !!this.pendingKick;
    this.s = step(this.s, a, this.pendingKick ?? undefined);
    this.pendingKick = null;
    this.action = a;
    this.t++;
    render(this.s, SIDE, this.frame);
    return { action: a, kicked };
  }
}
