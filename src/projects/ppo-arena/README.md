# PPO arena

**Keep the torch up.** Eight agents learn to balance a flame on a cart with Proximal Policy Optimisation, live in the browser. The world is lit only by the flame, so the better the policy, the more of the stage you can see.

Live at `/ppo-arena`. Week 7 of my 90-day maths for RL run.

## What it is

- **Torchbearer**, the game: cart-pole (Barto, Sutton and Anderson, 1983) at 50 Hz, reskinned. +1 for every step the torch stays within 12° of upright and on the rail, up to 500. You can play it yourself first, at ¼, ½ or full speed.
- **The agent**: two 4-32-32 tanh networks (actor and critic), trained by PPO with GAE in a Web Worker: 8 envs × 128 steps per rollout, 4 epochs of 4 minibatches, Adam. New weights stream back to the page after every iteration, and every view switches to them as they arrive.
- **The signature visual**: a Bayer-dithered light field cast by the flame (inverse-square falloff, flicker, pebbled ground, the cart's shadow). A tipping torch dims, a fall goes dark, and an untrained arena is mostly black.

## The maths I wrote

| Core | What it does | Where it shows |
| --- | --- | --- |
| `discountedReturns` | Return-to-go with episode resets and bootstrapping | The return ribbon, and the critic-vs-reality chart |
| `gae` | Generalised advantage estimates | The credit-kernel lab, and every policy update |
| `logProb` | Stable log-softmax of the actor's logits | Every sampled action, the policy map |
| `entropy` | Policy entropy | The entropy bonus, the entropy map |
| `clippedSurrogate` | PPO's min(rÂ, clip(r)Â) | The clip lab with live ratio dust |
| `valueLoss` | Critic loss with optional value clipping | The critic, and the arena |

Claude Code built the scaffolding: the environment, networks, backprop, Adam, the rollout and minibatch loop, the worker, and all the rendering. The loop takes the gradient of my per-sample loss with respect to the three head outputs by central differences, so the cores are plain scalar maths. See [LEARNING.md](./LEARNING.md) for the milestones.

## Run

```sh
npm run dev                                   # then open /ppo-arena
npx vitest run src/projects/ppo-arena/core    # the maths tests
npx vitest run src/projects/ppo-arena/lib     # plumbing tests
```
