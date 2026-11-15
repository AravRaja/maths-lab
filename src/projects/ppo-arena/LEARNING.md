# PPO arena: milestones

Five milestones, six functions, all in `src/projects/ppo-arena/core/`. Each one switches on part of `/ppo-arena`. The order follows the data: rewards become returns, returns become advantages, logits become probabilities, and probabilities feed the clipped objective. The last milestone, the value loss, closes the loop so the agent can train.

What's already built for you: the game (cart-pole dynamics in `lib/env.ts`), the two 4-32-32 tanh networks, backprop and Adam (`lib/mlp.ts`), the rollout and minibatch loop (`lib/ppo.ts`), the worker and every view. The loop takes the gradient of your per-sample loss with respect to the network's three head outputs (two logits and one value) by central differences, then backpropagates it. So your functions only need to return the right numbers, and they can be plain scalar code.

Run every core test with `npx vitest run src/projects/ppo-arena/core`. Each test fails with `NotYoursYet` until you write the function.

Notation: a rollout has T steps; `rewards[t]` is r_t; `dones[t]` is true when the episode **ended at** step t; `values[t]` is V(s_t); `lastValue` is V(s_T), the state after the final step.

---

<a id="m1-returns"></a>
## M1 · Discounted returns

**Write:** `discountedReturns(rewards, dones, gamma, lastValue)` in `core/returns.ts`.

**On paper first**
1. Starting from G_t = Σ_k γ^k r_{t+k}, write G_t in terms of r_t and G_{t+1}. Which way does the loop have to run?
2. Put the episode boundary in: G_t = r_t + γ (1 − d_t) · (something). What is that something at t = T − 1?
3. Constant reward 1 for n steps, then the end. Find G_0 in closed form, and its limit as n → ∞.
4. Why is 1/(1 − γ) called the effective horizon? With γ = 0.99, about how many steps ahead does the agent care?

**Check**
- `npx vitest run src/projects/ppo-arena/core/__tests__/returns.test.ts`
- *Predict before you run it:* in the lab, with "+1 a step" and γ = 0.97, what is G_t at the first step of an episode that lasts 100 steps? Work it out, then scrub to that step and compare.

**What lights up:** section 03, *What a step is worth*. The rollout ribbon (brightness = G_t), the G_t and r_t chart, and the readouts. Try the γ slider and the bootstrap switch. In the arena, the "critic vs reality" chart uses your returns as the Monte Carlo truth.

---

<a id="m2-gae"></a>
## M2 · Generalised advantage estimation

**Write:** `gae(rewards, values, dones, gamma, lambda, lastValue)` in `core/gae.ts`.

**On paper first**
1. Define the TD residual δ_t = r_t + γ (1 − d_t) V(s_{t+1}) − V(s_t). Write Â_t = Σ_l (γλ)^l δ_{t+l} as a recursion in Â_{t+1}. Why does (1 − d_t) appear in both the δ and the recursion?
2. λ = 0 gives which estimator? λ = 1: show that Â_t + V(s_t) is exactly M1's return (with the same lastValue).
3. Bias and variance: which end of λ trusts the critic most? Where does the bias come from when the critic is wrong?
4. If V were the true value function of the current policy, what is E[δ_t | s_t]?

**Check**
- `npx vitest run src/projects/ppo-arena/core/__tests__/gae.test.ts`
- *Predict before you run it:* in the lab, set critic error to 0. What will the λ = 1 line look like, and why? (Hint: what is the critic in this lab when the error is 0?) Then turn the error up and predict which of the three lines moves most.

**What lights up:** section 04, *Borrowing from the future* (its critic is built from M1's returns, so this lab needs `discountedReturns` too). The credit kernel (γλ)^l over the ribbon, three advantage lines (λ = 0, your λ, λ = 1) and the readouts. In the arena, your advantages drive every policy update, and Â + V_old becomes the critic's target.

---

<a id="m3-policy"></a>
## M3 · Log-probabilities and entropy

**Write:** `logProb(logits, action)` and `entropy(logits)` in `core/policy.ts`.

**On paper first**
1. Show softmax(z + c) = softmax(z) for any constant c. Which c makes exp never overflow? (Log-sum-exp.)
2. Two actions: write π(right) as a function of z_right − z_left only. Which function is it?
3. Derive ∂ log π(a) / ∂ z_b for b = a and for b ≠ a, and write both cases as one expression. You won't code it, but it is the policy-gradient signal the network receives.
4. Entropy: which policy maximises H, and what is the maximum for K actions? For a near one-hot policy, 0 · log 0 appears. How does writing H through log-probs avoid the NaN?

**Check**
- `npx vitest run src/projects/ppo-arena/core/__tests__/policy.test.ts`
- *Predict before you run it:* set the logits to (2, 0). What are π(left) and H in nats? Check on the playground.

**What lights up:** section 05, *How sure is it?*. The logit playground and the dithered policy map π(right | θ, ω). Until you train, the map shows an untrained network (almost uniform, ≈ 50% everywhere). Every agent on the page also samples its actions through your `logProb`.

---

<a id="m4-clip"></a>
## M4 · The clipped surrogate

**Write:** `clippedSurrogate(ratio, advantage, epsilon)` in `core/surrogate.ts`.

**On paper first**
1. Sketch L(r) = min(rÂ, clip(r, 1 − ε, 1 + ε)Â) against r for Â = +1, then for Â = −1. Mark 1 ± ε.
2. Shade where ∂L/∂r = 0. Say in one sentence each why an update stops there.
3. Find a case where the clipped term alone would be wrong and the min fixes it. (Look at Â < 0 with r > 1 + ε.)
4. At r = 1, show L and its gradient match the vanilla policy-gradient objective r·Â. So why does PPO need more than one epoch to differ from it?

**Check**
- `npx vitest run src/projects/ppo-arena/core/__tests__/surrogate.test.ts`
- *Predict before you run it:* when the arena trains, the dust (each sample's ratio after the update) collects on these curves. In the Â > 0 panel, which side of 1 should the dust drift to, and where should it stop? Check the clip fraction too.

**What lights up:** section 06, *A fence round each update*. Both curves are drawn by your function. The flat stretches are found numerically from your output and dithered, the handle shows L and ∂L/∂r at any r, and the dust from live training lands on the curves.

---

<a id="m5-train"></a>
## M5 · Value loss, and the whole loop

**Write:** `valueLoss(value, target, oldValue, clip)` in `core/value-loss.ts`.

**On paper first**
1. Unclipped: ∂/∂V of ½(V − R)². Why the ½?
2. Clipped: V_c = V_old + clip(V − V_old, −c, c), and the loss is ½ max((V − R)², (V_c − R)²). Sketch it against V with R > V_old + c. Where is the gradient zero?
3. The policy term used min (and is maximised); this one uses max (and is minimised). Explain why both are the pessimistic choice.
4. Write out the full per-sample loss the arena minimises: −L^CLIP + c_V·L^V − c_H·H. Why is the entropy term subtracted?

**Check**
- `npx vitest run src/projects/ppo-arena/core/__tests__/value-loss.test.ts`, then the full suite `npx vitest run src/projects/ppo-arena/core`.
- *Predict before you run it:* entropy starts at log 2 ≈ 0.693. Sketch the entropy curve over training before you press Train. Then predict what happens to learning if you set the entropy bonus to 0.1, and what happens with ε = 0.02.

**What lights up:** section 07, *The arena*. All eight torches, the live charts (return, entropy, clip fraction and KL, critic vs reality, value loss), and every other view: the hero switches from the hand-tuned controller to your agent, the policy map sharpens and the clip dust appears. A well-built agent passes a mean return of 475 within a few hundred thousand steps; at full speed that takes under a minute.

**Stretch:** the time limit (500 steps) is treated as terminal here, which is not quite correct: the state at step 500 isn't actually bad. How would you change `dones` (or add a `truncated` flag) so the return bootstraps from V(s_500) instead? What would that do to the critic's targets?
