# Learning path

Six milestones, nine functions. Each one is a page of paper first, a few functions in `src/projects/bellman/core/`, and a part of `/bellman` that lights up when the tests go green. Run `npx vitest run src/projects/bellman/core` (or one file, e.g. `npx vitest src/projects/bellman/core/__tests__/lookahead.test.ts`) as you go, and keep `npm run dev` open next to it.

The rule: work it out on paper before you type. The stubs' JSDoc has the spec and some questions, never the answer.

**The setting.** A finite MDP: states s, actions a, transition probabilities P(s′ | s, a), rewards r(s, a, s′), discount γ ∈ [0, 1). In this project the MDP comes from a painted grid (`src/projects/bellman/lib/grid.ts`): four actions (0 up, 1 right, 2 down, 3 left), a move goes the intended way with probability 1 − slip and sideways otherwise, and the reward is paid for the tile you arrive on (goal +1, lava −1, mud and plain steps cost a little). Goals, lava and walls are absorbing: they loop to themselves with reward 0, so their value is 0 and no backup needs a special case. Read `src/projects/bellman/core/types.ts` first: `MDP.outcomes[s * nA + a]` is the list of `{ p, next, reward }`.

<a id="m1-lookahead"></a>
## M1: One step ahead

Everything in this project is built from one move: look one step ahead and trust V for the rest.

**Derive on paper**
- Write the action value Q(s, a) as an expectation over s′ of "reward now plus discounted value later". Then write it as a finite sum over `outcomes`.
- A cell just left of a goal, slip 0.1, γ = 0.95, step reward −0.02, V = 0 everywhere. Moving right: which three places can you land, with what probabilities and rewards? Work out Q for "right" and for "up" (assume up bumps the top edge).
- Why does the greedy policy need a tie-break rule at all? What goes wrong in policy iteration (M4) if ties are broken at random?
- Show that if V = V*, acting greedily on lookahead(V) is optimal. (Use the optimality equation from M3, or come back to this one.)

**Write**: `lookahead` and `greedyPolicy` in `src/projects/bellman/core/lookahead.ts`.

**Check**
- `npx vitest src/projects/bellman/core/__tests__/lookahead.test.ts`: a hand-computed two-state MDP, γ = 0 giving the immediate reward, the corridor next to a goal, the lowest-index tie-break.
- Predict before you run it: load *Blank*, press **V = 0**, pick **Inspect** and tap the cell left of the goal. What will the compass show for right and for up? (Your paper answer from above.)

**Unlocks**: the compass (tap any cell with **Inspect**: four action values, best one outlined) and arrows on every map, even over the ghost field.

<a id="m2-evaluation"></a>
## M2: What is a policy worth?

**Derive on paper**
- The Bellman expectation equation: V^π(s) = Σₐ π(a|s) Σₛ′ P(s′|s,a) [r + γV^π(s′)]. Write it in matrix form V = r_π + γP_πV. What are the entries of the vector r_π and the matrix P_π?
- Solve it: V^π = (I − γP_π)⁻¹ r_π. Why is I − γP_π invertible when γ < 1? (Hint: rows of P_π sum to 1.)
- Show T^π is a γ-contraction in the sup norm: ‖T^πV − T^πW‖∞ ≤ γ‖V − W‖∞. By Banach, iterating it from anywhere converges to V^π.
- Do the two-state MDP in `src/projects/bellman/core/__tests__/fixtures.ts` by hand with the uniform policy and γ = 0.9: build r_π and P_π, solve the 2×2 system. (The test knows the fractions.)

**Write**: `bellmanExpectationBackup` in `src/projects/bellman/core/backups.ts`. Synchronous: every new value reads the old V.

**Check**
- `npx vitest src/projects/bellman/core/__tests__/backups.test.ts -t Expectation`: one sweep by hand, the closed-form fixed point, contraction on random vectors, absorbing states staying at 0.
- Predict before you run it: on *Cliff walk* with every arrow random (✳), which cells will end up darkest, and why are they not the lava cells themselves?

**Unlocks**: section 02. Draw a policy by tapping cells and watch its value settle sweep by sweep, warm-starting after each edit. With M1 done too, **Improve** acts greedily on those values: policy iteration by hand. The TD section gets its DP answer to compare against.

<a id="m3-value-iteration"></a>
## M3: Value iteration

**Derive on paper**
- The Bellman optimality equation: V*(s) = maxₐ Σₛ′ P(s′|s,a) [r + γV*(s′)]. Where does the max come from, compared with M2?
- Prove |maxₐ f(a) − maxₐ g(a)| ≤ maxₐ |f(a) − g(a)|. Use it to show T* is a γ-contraction.
- So ‖V_k − V*‖∞ ≤ γᵏ‖V_0 − V*‖∞. How many sweeps to shrink the error by 10⁻⁶ at γ = 0.9? At γ = 0.99?
- A stopping rule: if ‖V_{k+1} − V_k‖∞ < ε, show ‖V_{k+1} − V*‖∞ ≤ γε / (1 − γ).
- On a deterministic corridor with only a goal reward, which cells are non-zero after k sweeps from V = 0? Write V* in closed form there.

**Write**: `bellmanOptimalityBackup` in `src/projects/bellman/core/backups.ts`, then `valueIteration` in `src/projects/bellman/core/value-iteration.ts` (keep every iterate: the page replays them).

**Check**
- `npx vitest src/projects/bellman/core/__tests__/backups.test.ts src/projects/bellman/core/__tests__/value-iteration.test.ts`: the corridor closed form, the contraction of successive Δs, monotonicity, and Russell & Norvig's 4×3 world, whose utilities your values must reproduce to three decimals.
- Predict before you run it: load *Blank*, set slip 0 and step reward 0, press **V = 0**, then tap **One sweep of T\*** repeatedly. At which sweep does V(start) first leave 0? And in the Δ chart, will your curve sit above or below the dotted γᵏ line?

**Unlocks**: the live flood. Every repaint re-solves in a worker and replays the sweeps as a ripple across the dithered terrain, with contour lines and a sweep counter. The hero switches from ghost to your values, and the Δ-per-sweep chart appears. **One sweep of T\*** works as soon as the backup does.

<a id="m4-policy-iteration"></a>
## M4: Policy iteration

**Derive on paper**
- Policy improvement theorem: if π′(s) = argmaxₐ Q^π(s, a) then V^{π′} ≥ V^π everywhere. Prove it by starting from Q^π(s, π′(s)) ≥ V^π(s) and unrolling.
- If the greedy policy doesn't change, show V^π satisfies the optimality equation, so π is optimal.
- Why must it stop after finitely many rounds? Bound the number of rounds by counting deterministic policies on nS states.
- Compare the cost: one VI sweep is one backup; one PI round is a whole evaluation (many backups) plus one lookahead. When would you rather pay for PI?

**Write**: `policyIteration` in `src/projects/bellman/core/policy-iteration.ts`, from your own `bellmanExpectationBackup`, `lookahead` and `greedyPolicy` (`oneHot` in `src/projects/bellman/lib/policy.ts` turns actions into a policy table). Start from "always up".

**Check**
- `npx vitest src/projects/bellman/core/__tests__/policy-iteration.test.ts`: values never decrease from round to round, the 4×3 world's optimal policy and utilities, stability of the answer.
- Predict before you run it: on the *Maze*, how many PI rounds against how many VI sweeps? And on the race chart's clock (backups spent), who reaches 10⁻⁶ first?

**Unlocks**: section 03, the race. VI and PI side by side on one clock, PI's arrows snapping round by round, and the error-against-backups chart.

<a id="m5-td"></a>
## M5: Learning from samples

Throw away P. The agent only sees (s, a, r, s′), one step at a time.

**Derive on paper**
- ε-greedy: with probability ε pick uniformly from all nA actions, otherwise pick a best action (ties at random). Derive P(a specific best action) when k actions tie for best.
- TD(0): V(s) ← V(s) + α[r + γV(s′) − V(s)]. Which sum in the expectation backup has been replaced by one sample? Why is the target r (no bootstrap) when s′ is terminal?
- Fix V(s′) and feed the same transition forever: V(s) converges to what, and at what rate in α? What does that say about a constant α with noisy targets?
- Sutton & Barto's random walk (states A–E, exit right pays 1, γ = 1): show the true values are 1/6, 2/6, …, 5/6.

**Write**: `epsilonGreedy` in `src/projects/bellman/core/explore.ts`, `td0Update` in `src/projects/bellman/core/td.ts`.

**Check**
- `npx vitest src/projects/bellman/core/__tests__/explore.test.ts src/projects/bellman/core/__tests__/td.test.ts -t "epsilon|td0"`: action frequencies against 1 − ε + ε/nA, random tie-breaking, the single-step update, and the random walk learned to within 0.05 RMS.
- Predict before you run it: with ε = 0.2 and two tied best actions, what share does each get on the dial? Then in TD(0), does a bigger α make the RMS curve fall faster, end lower, or both?

**Unlocks**: section 04. The ε dial (4000 live picks against the dashed theory) and TD(0) learning a random walker's values next to the DP answer from M2, with the RMS gap falling over episodes.

<a id="m6-q-learning"></a>
## M6: Q-learning

**Derive on paper**
- The optimality equation for Q*: Q*(s, a) = Σₛ′ P(s′|s,a) [r + γ maxₐ′ Q*(s′, a′)]. Q-learning replaces the sum with one sample. Write the update.
- Why is it off-policy? The agent behaves ε-greedily, but the target uses max. What target would SARSA use instead?
- Optimistic initialisation: Q starts at 0 and every step costs a little. Why does that make an agent explore even with ε = 0?
- Why does Q-learning converge to Q* even under a uniformly random behaviour policy, as long as every (s, a) keeps being tried?

**Write**: `qLearningUpdate` in `src/projects/bellman/core/td.ts`.

**Check**
- `npx vitest src/projects/bellman/core/__tests__/td.test.ts -t qLearning`: the single update, termination, touching only Q(s, a), and Q* learned on a corridor from purely random behaviour.
- Predict before you run it: *Cliff walk*, slip 0, ε = 0.2 with decay off. The arrows will learn the path along the cliff edge. Will the return curve reach the dashed V*(start)? Why not?

**Unlocks**: section 05. The agent learns live in a worker: value terrain growing from max Q, footprints where it has been, arrows from its Q-table, the bead replaying each episode, and the return curve climbing toward V*(start).
