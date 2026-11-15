import { isNotYoursYet } from "@/kit/not-yours-yet";
import { diagGaussianKL } from "../core/surprise";
import { decode, encode, type VaeWeights } from "./vae";
import { dreamStep, predict, type DynWeights } from "./dynamics";
import { rng } from "./rng";

/**
 * The model's running picture of the world. With eyes open it encodes each real frame; with eyes
 * closed it rolls its own latent forward with the dynamics model and decodes what it imagines.
 */
export class Dreamer {
  z: number[] | null = null;
  zPrev: number[] | null = null;
  eyes: "open" | "closed" = "open";
  /** Steps since the eyes closed (0 while open). */
  dreaming = 0;
  frame: Float32Array;
  /** Last surprise in nats (eyes open only), or null when diagGaussianKL is still a stub. */
  surprise: number | null = null;
  surpriseMissing = false;
  /** Temperature on the dream's noise: 0 = follow the predicted mean. */
  noise = 0;
  /** Latent trail, newest last. */
  trail: { z: number[]; dreamt: boolean }[] = [];
  private r = rng(3);

  constructor(public vae: VaeWeights, public dyn: DynWeights | null) {
    this.frame = new Float32Array(vae.shape.pixels);
  }

  /** Start (or re-sync) from a real frame. */
  see(frame: ArrayLike<number>) {
    const { mu } = encode(this.vae, frame);
    this.zPrev = mu;
    this.z = mu;
    decode(this.vae, mu, this.frame);
  }

  close() {
    if (this.dyn) this.eyes = "closed";
  }

  open() {
    this.eyes = "open";
    this.dreaming = 0;
  }

  /** Advance after the real world took `action` and now shows `frame`. */
  advance(frame: ArrayLike<number>, action: number) {
    if (!this.z || !this.zPrev) return this.see(frame);
    let next: number[];
    if (this.eyes === "open" || !this.dyn) {
      const q = encode(this.vae, frame);
      next = q.mu;
      this.surprise = null;
      if (this.dyn) {
        const p = predict(this.dyn, this.zPrev, this.z, action);
        try {
          this.surprise = diagGaussianKL(q.mu, q.logvar, p.mean, p.logvar);
          this.surpriseMissing = false;
        } catch (e) {
          if (!isNotYoursYet(e)) throw e;
          this.surpriseMissing = true;
        }
      }
    } else {
      next = dreamStep(this.dyn, this.zPrev, this.z, action, this.noise, this.r).z;
      this.dreaming++;
    }
    // Keep a runaway dream on the screen.
    next = next.map((v) => (Number.isFinite(v) ? Math.max(-6, Math.min(6, v)) : 0));
    this.zPrev = this.z;
    this.z = next;
    decode(this.vae, next, this.frame);
    this.trail.push({ z: next, dreamt: this.eyes === "closed" });
    if (this.trail.length > 90) this.trail.shift();
  }
}
