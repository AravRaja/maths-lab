# bellman

**Paint a gridworld and watch value flood it. Then watch an agent with no map learn the same answer by trial and error.**

<!-- screenshot / GIF: drop docs/hero.gif here (the hero flooding, then the Q-learner's footprints) -->

Drag walls, lava, goals and mud onto a grid. Value iteration solves it in a Web Worker and replays every sweep: news of the goals spreads one cell per sweep across a Bayer-dithered value terrain, the surface shimmers wherever a value just changed, contour lines tighten round the goals and arrows snap to the optimal policy. Then the same map goes to a Q-learning agent that knows nothing about it, and the terrain grows back out of its experience.

Strictly black and white, works on a phone, no server.

## What's on the page

- **Hero.** Value iteration flooding an 18×13 world, frame by frame. Tap anywhere to drop a new goal and the flood restarts from it.
- **Paint a world.** A paintable 14×14 grid with presets (four rooms, cliff walk, lava lake, maze). Sliders for γ, slip and step cost re-solve live. Inspect any cell to see its four one-step lookahead values as a compass. Step the optimality backup by hand, or replay the whole flood. A Δ-per-sweep chart against γᵏ shows the contraction.
- **Draw a policy.** Tap cells to turn their arrows (or make them random) and watch the expectation backup price that policy. **Improve** acts greedily on the result: policy iteration by hand.
- **Two roads to V\*.** Value iteration and policy iteration race on one clock counted in backups, with ‖V − V\*‖∞ for both.
- **Learning from samples.** A live ε-greedy histogram against its formula, then TD(0) learning a random walker's values next to the dynamic-programming answer.
- **Trial and error.** Q-learning in a worker at watch, fast or turbo speed: footprints, greedy arrows from the Q-table, the agent replaying each episode, and a return curve heading for V\*(start).

## How it works

The grid becomes a sparse tabular MDP (`lib/grid.ts`): four actions, slip sideways with probability `slip`, reward paid for the tile you arrive on, and goals, lava and walls absorbing. The maths lives in `core/`:

| | |
| --- | --- |
| `lookahead`, `greedyPolicy` | Q(s,a) = Σ P(s′\|s,a)[r + γV(s′)] and its argmax |
| `bellmanExpectationBackup` | one sweep of T^π |
| `bellmanOptimalityBackup`, `valueIteration` | one sweep of T\*, iterated to its fixed point |
| `policyIteration` | evaluate, improve, repeat until stable |
| `epsilonGreedy`, `td0Update` | exploration and model-free policy evaluation |
| `qLearningUpdate` | the sampled optimality backup on Q |

Everything else (renderer, workers, environment sampling, the training loops, charts) is scaffolding that calls those functions.

The renderer (`lib/render.ts`) bilinearly interpolates V between cell centres, applies a contrast curve, adds a noisy shimmer weighted by how much each cell's value just moved, and Bayer-8 dithers the result to five greys. Contours come from marching squares on the same lattice; arrows ease toward their new angle the short way round.

The tests (`core/__tests__/`) check closed forms (the corridor's γ^(d−1), a two-state MDP solved by hand), the contraction and monotonicity of both operators on random vectors, the policy improvement theorem round by round, Russell & Norvig's 4×3 utilities and policy, Sutton & Barto's random walk, and Q-learning recovering Q\* from purely random behaviour.

## Run it

```sh
npm ci && npm run dev                       # then open /bellman
npx vitest run src/projects/bellman/core    # the maths tests
```

Milestones: [LEARNING.md](./LEARNING.md).
