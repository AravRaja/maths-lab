# Daydream: milestones

Five milestones, ten functions, all in `src/projects/daydream/core/`. Each one wakes up a part of `/daydream`. Work on paper first; the tests are there to catch you, not to teach you.

Run every check with `npx vitest run src/projects/daydream/core`, or one file at a time as shown below. The end-to-end test (`core/__tests__/training.test.ts`) trains a small VAE and dynamics model through your cores, so it passes only once milestones 1 to 4 are all done.

The setup: a ball in a box is rendered as a 20×20 grey frame `x`. An encoder maps `x` to a diagonal Gaussian `q(z | x) = N(μ, diag e^{logvar})` over a **2-dimensional** latent `z`. A decoder maps `z` to 400 logits. The prior is `p(z) = N(0, I)`. Later, a dynamics model predicts `z_{t+1}` from `(z_{t−1}, z_t, a_t)`.

---

<a id="m1-reparam"></a>
## M1 · The reparameterisation trick

**Write:** `reparameterise`, `reparameteriseBackward` in `core/reparam.ts`.

**On paper:**
1. Let `ε ~ N(0, 1)` and `z = μ + σε`. Show that `E[z] = μ` and `Var[z] = σ²`. Why does the encoder output `logvar = log σ²` instead of `σ`?
2. You want `∇_μ E_{z~N(μ,σ²)}[f(z)]`. Explain why "sample, then differentiate" fails if `z` is drawn directly, and why it works once `z` is written as a function of `(μ, σ, ε)`. Write the gradient as an expectation over `ε`.
3. Differentiate `z_i = μ_i + exp(½ logvar_i) ε_i` with respect to `μ_i` and `logvar_i`. Why is the Jacobian diagonal?
4. Take `f(z) = (z − t)²` in 1-D. Compute `E[f]` in closed form as a function of `μ` and `σ²`. Which way does its gradient push `σ²`?

**Check:** `npx vitest run src/projects/daydream/core/__tests__/reparam.test.ts`. The tests check that samples have the right mean and variance and run a finite-difference gradient check.

**Predict before you run it:** with β at 0 in section 02, the cloud gets dragged to the target. What happens to its width over time, and why? (Use your answer to 4.)

**Lights up:** section 02, *Gradients through a coin toss*. A live 2-D Gaussian chases the target you drag, using 32 reparameterised samples per frame and your backward pass.

---

<a id="m2-kl"></a>
## M2 · KL to the prior

**Write:** `gaussianKL`, `gaussianKLGrad` in `core/kl.ts`.

**On paper:**
1. For one dimension, write `log q(z) − log p(z)` with `q = N(μ, σ²)` and `p = N(0, 1)`. Take `E_q` of it, using `E_q[z] = μ` and `E_q[z²] = μ² + σ²`. You should end up with only `μ²`, `σ²` and `log σ²`.
2. Explain why the KL of a diagonal Gaussian is a sum over dimensions.
3. Differentiate with respect to `μ` and `logvar`. Where are both gradients zero? Show that point is a minimum.
4. Add the KL to M1's objective: `E[(z − t)²] + β·KL`. Find the optimal `μ` and `σ²` as functions of `t` and `β` (1-D is enough).

**Check:** `npx vitest run src/projects/daydream/core/__tests__/kl.test.ts`. The tests compare against numerical integration of `∫ q log(q/p)` and run a gradient check.

**Predict before you run it:** in section 02 with the target at `t = (1.6, −0.9)` and `β = 1`, where does the centre settle, and what σ does the cloud keep? Then slide β to 4 and check your formula.

**Lights up:** the β slider in section 02. The prior's pull now fights the target's.

---

<a id="m3-elbo"></a>
## M3 · The ELBO

**Write:** `bernoulliLogLik`, `bernoulliLogLikGrad`, `elbo` in `core/elbo.ts`.

**On paper:**
1. Derive the bound twice. First, apply Jensen's inequality to `log p(x) = log E_{q(z|x)}[p(x|z) p(z) / q(z|x)]`. Second, show that `log p(x) = ELBO + KL(q(z|x) ‖ p(z|x))`. What exactly is the gap, and when is it zero?
2. Split the ELBO into `E_q[log p(x|z)] − KL(q(z|x) ‖ p(z))`. Name the job each term does. Then think about β: what do you expect from β < 1, and from β > 1?
3. For a Bernoulli pixel with logit `ℓ`, write `log p(x|ℓ) = x log σ(ℓ) + (1 − x) log(1 − σ(ℓ))` using only `ℓ` and `softplus`. Which form stays finite at `ℓ = ±100`?
4. Differentiate with respect to `ℓ`. The answer is short; check the sign makes sense for a pixel that should be brighter.
5. Trace the whole gradient by hand: `x → encoder → (μ, logvar) → z → decoder → logits → ELBO`. Which of your M1 and M2 functions handles each arrow that involves probability? (`lib/vae.ts` wires them up in this order.)

**Check:** `npx vitest run src/projects/daydream/core/__tests__/elbo.test.ts`, then `npx vitest run src/projects/daydream/core/__tests__/training.test.ts`. The second one trains a small VAE through your cores.

**Predict before you run it:** train with β = 0.25, 1 and 4. Which run reaches the best reconstruction? Which run's latent cloud fills the dashed prior rings most evenly? Why can't one β win on both?

**Lights up:**
- Section 03, *Teach it to see*: training runs in a Web Worker, with a live ELBO chart, reconstructions and a latent cloud shaded by the ball's true position, which the encoder was never told.
- Section 04, *Walk around its mind*: a decoded atlas you can drag through.
- The hero's right-hand screen switches from static to the model's view.

---

<a id="m4-dynamics"></a>
## M4 · Latent dynamics

**Write:** `gaussianNLL`, `gaussianNLLGrad` in `core/dynamics.ts`.

**On paper:**
1. Write `−log N(z; m, e^{s})` for one dimension, including the constant.
2. Fix the error `e = z − m` and minimise over `s`. What variance does the model learn, and why is that the honest answer?
3. With `s` fixed, compare the loss to squared error. With `s` learned, look at the `m`-gradient: it is the squared-error gradient scaled by what? What does that do to transitions the model is unsure about, such as bounces?
4. One frame shows where the ball is, not where it is going. Why does the dynamics model read `z_{t−1}` as well as `z_t`?
5. The trainer (`lib/dynamics.ts`, `dynStepRollout`) feeds the model's own predicted means back in for up to 12 steps and scores every step with your NLL. Why would training only on one-step predictions from real latents give dreams that drift off faster?

**Check:** `npx vitest run src/projects/daydream/core/__tests__/dynamics.test.ts`. The end-to-end test also checks that the rollout loss falls.

**Predict before you run it:** close the model's eyes with the ball resting on the floor, then again mid-flight just before a bounce. Which dream stays right longer? Sketch the *drift while dreaming* curve you expect for each before you look.

**Lights up:** section 05, *Close its eyes*.
- Dynamics training with a held-out dream drawn against reality in latent space.
- Then the live theatre: hold the button and the right screen is pure imagination, while the arrows keep steering both.
- The dream-noise slider samples each step with your M1 `reparameterise`.
- The hero starts blinking on its own.

---

<a id="m5-surprise"></a>
## M5 · Surprise

**Write:** `diagGaussianKL` in `core/surprise.ts`.

**On paper:**
1. Redo M2's derivation with a general `p = N(μ_p, σ_p²)`. You will need `E_q[(z − μ_p)²]` in terms of `μ_q − μ_p` and `σ_q²`.
2. Check that it reduces to `gaussianKL` when `μ_p = 0` and `σ_p = 1`.
3. Show `KL(q‖p) ≠ KL(p‖q)` with a 1-D example. Here `q` is what the encoder sees and `p` is what the dynamics predicted. Which direction penalises "the world did something the model thought was nearly impossible"?
4. Why does surprise spike after a kick but not after a jump, even though both change the velocity suddenly?

**Check:** `npx vitest run src/projects/daydream/core/__tests__/surprise.test.ts`.

**Predict before you run it:** roughly how many nats will a hard kick register, compared with the baseline while the ball just rolls? Will the spike last one step or several? (Think about which inputs the dynamics model uses.)

**Lights up:** section 06, *Catch it off guard*. A live surprise trace that marks every kick and leaves a gap wherever the eyes were closed.
