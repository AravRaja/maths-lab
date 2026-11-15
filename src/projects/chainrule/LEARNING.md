# Learning path

Five milestones. Each one is a few functions in `src/projects/chainrule/core/`, a page of paper first, and a part of the app that lights up when the tests go green. Run `npx vitest run src/projects/chainrule/core` (or `npx vitest src/projects/chainrule/core/__tests__/ops.test.ts` for one file) as you go, and keep `npm run dev` (this project is at `/chainrule`) open next to it.

The rule: work it out on paper before you type. The stubs' JSDoc has the spec and some questions, never the answer.

<a id="m1-local-derivatives"></a>
## M1: Local derivatives

Every op only has to know its own derivative. Backprop strings them together later.

**Derive on paper**
- For `out = a + b` and `out = a · b`, write ∂out/∂a and ∂out/∂b. Then multiply by the upstream gradient g = ∂L/∂out to get ∂L/∂a and ∂L/∂b (that is the chain rule, once).
- The power rule for `out = aᵏ` with constant k. Check k = 2, 1, 0 and −1. Division in this engine is a·b⁻¹, so k = −1 matters.
- d/da eᵃ, d/da ln a, and d/da max(0, a) (take 0 at a = 0, like PyTorch).
- tanh: start from (eᵃ − e⁻ᵃ)/(eᵃ + e⁻ᵃ) and use the quotient rule. Then rewrite the answer in terms of `out = tanh a` only. Where is it largest, and how small is it at a = 3?
- Why does subtraction need no rule of its own? (a − b = a + (−1)·b.)

**Write**: `addBackward`, `mulBackward`, `powBackward`, `expBackward`, `logBackward`, `tanhBackward`, `reluBackward` in `src/projects/chainrule/core/ops.ts`.

**Check**
- `npx vitest src/projects/chainrule/core/__tests__/ops.test.ts`: every rule against central differences of the forward function, linearity in g, tanh saturation and the relu convention.
- Predict before you run it: in the *neuron* preset, tanh(w1·x1 + w2·x2 + b) has input n ≈ 0.881 and output ≈ 0.707. What number will appear on the edge from the + node into tanh?

**Unlocks**: local-derivative labels on every edge of the graph, your dashed f′(x) in the *Seven rules* gallery, and the a·b / a+b cards.

<a id="m2-backprop"></a>
## M2: Backprop

**Derive on paper**
- Multivariable chain rule: if x feeds u₁ … uₘ, then ∂L/∂x = Σⱼ (∂L/∂uⱼ)(∂uⱼ/∂x). What does that sum mean for code that writes to `x.grad` more than once?
- Draw the graph of L = (x·y + x)·x and list its nodes so that every node comes after its inputs. That is a topological order. Depth-first search gives you one if you add a node at the right moment: before visiting its parents, or after?
- A node may only pass its gradient on once that gradient is complete, meaning every node that uses it has already been handled. Which direction through your topological list guarantees that?
- Do L = x·x by hand. It is one `mul` node whose parents are [x, x]. You want 2x. Which part of your code makes that happen: `mulBackward` or `backprop`?

**Write**: `topoSort` and `backprop` in `src/projects/chainrule/core/backprop.ts`. They only see the `GradNode` interface in `src/projects/chainrule/core/types.ts`, so the tests check them with a separate mini-engine, independently of your op rules.

**Check**
- `npx vitest src/projects/chainrule/core/__tests__/backprop.test.ts`: topological invariants, x·x, shared subgraphs, a 3000-node chain, finite differences on a random DAG. Then `engine.test.ts` runs your M1 and M2 code together through the real engine.
- Predict before you run it: pick the *x·x* preset (x·x + x at x = 1.5). What is ∂f/∂x, and how many separate contributions add up into x's gradient?

**Unlocks**: the graph comes alive. Nodes invert one by one as gradients fall from the output to the inputs, and edge thickness shows how much gradient each edge carries. The hero's particles stop wandering and slide downhill on ∇f, computed by your engine for every particle on every frame.

<a id="m3-gradcheck"></a>
## M3: Gradient check

Every autograd engine is checked the same way: compare it with the slow, obviously correct answer.

**Derive on paper**
- Taylor-expand f(x ± h) to third order. Show that the central difference (f(x+h) − f(x−h))/2h has error (h²/6)·f‴(x) + O(h⁴), while the one-sided (f(x+h) − f(x))/h has error O(h).
- Floating point: f(x ± h) each carry about ε|f| of round-off (ε ≈ 2.2e-16). Show the round-off in the quotient is about ε|f|/h. Minimise ε|f|/h + h²|f‴|/6 over h. Roughly what h is that for f, f‴ of order 1?
- Why compare with a relative error |a − b| / (|a| + |b|) rather than |a − b|? What do you do when both are 0?

**Write**: `numericalGrad` and `relError` in `src/projects/chainrule/core/gradcheck.ts`.

**Check**
- `npx vitest src/projects/chainrule/core/__tests__/gradcheck.test.ts`: exactness on quadratics, the x³ test that tells central from one-sided differences, O(h²) convergence, and the properties of `relError`.
- Predict before you run it: on the *Gradient check* plot of error against log₁₀ h, where will the bottom of the U be, and what slopes will the two sides have on these log–log axes?

**Unlocks**: the gradient-check table (your backprop against your finite differences, per variable), the U-shaped error-versus-h curve, and the dotted finite-difference line in the ops gallery.

<a id="m4-sgd"></a>
## M4: SGD

**Derive on paper**
- Plain SGD on f(θ) = ½aθ²: show θₜ₊₁ = (1 − ηa)θₜ. For which η does it converge? What happens at exactly η = 1/a, and just above 2/a?
- Momentum (v ← μv + g, θ ← θ − ηv): with a constant gradient g, what value does v settle at? So what is the effective learning rate?
- Show that weight decay λθ is the gradient of (λ/2)‖θ‖².

**Write**: `sgdStep` in `src/projects/chainrule/core/sgd.ts`.

**Check**
- `npx vitest src/projects/chainrule/core/__tests__/sgd.test.ts`: the update by hand, no mutation, the momentum steady state, convergence for η < 2/a and divergence for η > 2/a.
- Predict before you run it: with μ = 0.9, how many times bigger is the effective step than η? On *spiral*, what do you expect at η = 1.5 with μ = 0.9, compared with η = 0.3?

**Unlocks**: *Bend a boundary*. A tanh network (2 → 8 → 8 → 1 by default) trains in a Web Worker on moons, circles, spiral or xor, with the hinge loss (1/N) Σ max(0, 1 − yₙsₙ) + α‖θ‖². You watch the dithered decision boundary bend, along with the loss curve and live accuracy.

<a id="m5-matmul"></a>
## M5: Matmul-lite

The scalar engine builds a node for every multiply, tens of thousands of nodes per training step. Real frameworks treat a whole layer as one op.

**Derive on paper**
- For C = AB (A is m×k, B is k×n), write ∂L/∂Aᵢₚ = Σᵢ′ⱼ Gᵢ′ⱼ ∂Cᵢ′ⱼ/∂Aᵢₚ with G = ∂L/∂C. Which terms survive? Recognise the result as a matrix product. Do the same for B.
- Shape check: dA must be m×k. Which product of G (m×n), A and B, with which transposes, has that shape?
- The bias trick: append a column of ones to a layer's input and a bias row to its weights. Show XW + 1bᵀ = [X 1][W; bᵀ], so one matmul backward gives both ∂L/∂W and ∂L/∂b.

**Write**: `matmulBackward` in `src/projects/chainrule/core/matmul.ts`.

**Check**
- `npx vitest src/projects/chainrule/core/__tests__/matmul.test.ts`: shapes, finite differences in every entry, the dot and outer product cases. The last test in `engine.test.ts` then checks that a whole MLP's gradient from matmul-lite matches the scalar graph to 1e-10.
- Predict before you run it: how much faster will matmul-lite be than the scalar graph on a 2→8→8→1 net with 120 points? And why do the two gradients agree to about 1e-15 rather than exactly?

**Unlocks**: the *matmul-lite* engine switch in the training lab, the engine race (ms per step, speed-up, and the relative error between the two engines' gradients using your `relError`), and dithered heatmaps of |∂L/∂W| for every layer.
