import { Section } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { TorchHero } from "@/projects/ppo-arena/components/hero";
import { PlaySection } from "@/projects/ppo-arena/components/play";
import { ReturnsLab } from "@/projects/ppo-arena/components/returns-lab";
import { GaeLab } from "@/projects/ppo-arena/components/gae-lab";
import { PolicyLens } from "@/projects/ppo-arena/components/policy-lens";
import { ClipLab } from "@/projects/ppo-arena/components/clip-lab";
import { Arena } from "@/projects/ppo-arena/components/arena";

export const metadata = projectMetadata("ppo-arena");

export default function Page() {
  return (
    <ProjectPage
      slug="ppo-arena"
      title={<>PPO<br />arena</>}
      visual={<TorchHero />}
      actions={
        <>
          <Button size="lg" className="min-h-11" render={<a href="#arena" />} nativeButton={false}>Train the agent</Button>
          <Button size="lg" variant="outline" className="min-h-11" render={<a href="#play" />} nativeButton={false}>Try it yourself</Button>
        </>
      }
      footer="Scaffolding by Claude Code. The returns, GAE, policy, surrogate and value-loss maths are mine."
    >
      <Section id="cores" index={1} kicker="Convention" title="Six cores, all mine">
        <p className="mb-5 text-ink-soft">
          Everything PPO actually computes lives in <code className="font-mono text-ink">src/projects/ppo-arena/core/</code>. The game,
          networks, backprop, Adam and drawing are scaffolding. Each core switches on part of this page.
        </p>
        <ProjectCores slug="ppo-arena" />
      </Section>

      <Section id="play" index={2} kicker="The game" title="Keep the torch up">
        <p className="mb-5 text-ink-soft">
          A cart on a rail carries a torch on a hinge. Push left or right; +1 for every fiftieth of a second it stays within 12° of
          upright and on the rail, up to 500. That is the whole reward. It is cart-pole, lit by its own flame.
        </p>
        <PlaySection />
      </Section>

      <Section id="returns" index={3} kicker="M1 · discounted returns" title="What a step is worth">
        <p className="mb-5 text-ink-soft">
          A wobbly controller plays a few episodes back to back. Return-to-go G_t adds up everything still to come, discounted by γ,
          and stops at each episode end. Scrub the ribbon; drag γ and watch the horizon stretch.
        </p>
        <ReturnsLab />
      </Section>

      <Section id="gae" index={4} kicker="M2 · generalised advantage" title="Borrowing from the future">
        <p className="mb-5 text-ink-soft">
          The advantage asks: was this action better than the critic expected? λ sets how far each step looks ahead before it trusts
          the critic instead. Pick a step and its credit kernel (γλ)^l lights the future it sums.
        </p>
        <GaeLab />
      </Section>

      <Section id="policy" index={5} kicker="M3 · log-probs and entropy" title="How sure is it?">
        <p className="mb-5 text-ink-soft">
          The actor outputs two logits. Your logProb() turns them into a distribution, and every action on this page is sampled through
          it. The map is the live policy over every lean θ and spin ω.
        </p>
        <PolicyLens />
      </Section>

      <Section id="clip" index={6} kicker="M4 · the clipped surrogate" title="A fence round each update">
        <p className="mb-5 text-ink-soft">
          PPO lets the new policy move the probability of an action by a ratio r, then stops paying once r leaves 1 ± ε. The dithered
          stretches are where your objective has no gradient.
        </p>
        <ClipLab />
      </Section>

      <Section id="arena" index={7} kicker="M5 · value loss and the full loop" title="The arena">
        <p className="mb-5 text-ink-soft">
          Eight copies of the game, one Web Worker, the whole PPO loop built from your six functions. New weights stream back after every
          iteration: the torches below, the hero up top, the policy map and the clip dust all switch to them as they arrive.
        </p>
        <Arena />
      </Section>
    </ProjectPage>
  );
}
