import { Section } from "@/kit/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { HeroTide } from "@/projects/bellman/components/hero";
import { Studio } from "@/projects/bellman/components/studio";
import { Evaluate } from "@/projects/bellman/components/evaluate";
import { Race } from "@/projects/bellman/components/race";
import { ExploreDial } from "@/projects/bellman/components/explore-dial";
import { TdLab } from "@/projects/bellman/components/td-lab";
import { QLearner } from "@/projects/bellman/components/q-learner";
import { ClientOnly } from "@/projects/bellman/components/bits";

export const metadata = projectMetadata("bellman");

function Eq({ children }: { children: React.ReactNode }) {
  return <p className="my-4 rounded-xl border border-rule bg-sheet px-4 py-3 font-mono text-sm leading-relaxed break-words">{children}</p>;
}

const fallback = <Skeleton className="aspect-square w-full rounded-2xl" />;

export default function Page() {
  return (
    <ProjectPage
      slug="bellman"
      title={<>Bell<br />man</>}
      visual={<HeroTide />}
      actions={
        <>
          <Button render={<a href="#paint" />} nativeButton={false} className="min-h-11">Paint a world</Button>
          <Button variant="outline" render={<a href="#learn" />} nativeButton={false} className="min-h-11">Watch it learn</Button>
        </>
      }
      footer="Scaffolding by Claude Code: the grid, the renderer, the workers and the loops. The backups, both iterations, ε-greedy, TD(0) and Q-learning are mine."
    >
      <Section index={0} kicker="Progress" title="Nine functions, six milestones">
        <p className="mb-5 text-ink-soft">
          Every number on this page comes from one of these. Each starts as a stub; the page fills in as they are written. Until
          then the visuals play a labelled ghost (a plain BFS wave, not Bellman).
        </p>
        <ProjectCores slug="bellman" />
      </Section>

      <Section id="paint" index={1} kicker="Value iteration" title="Paint a world, watch it flood">
        <p className="text-ink-soft">
          Drag to paint walls, lava (−1, game over), goals (+1) and mud (expensive). Each repaint re-runs value iteration in a
          worker and replays it: every sweep pushes news of the goals one cell further, and the terrain shimmers where values
          just changed.
        </p>
        <Eq>V_k+1(s) = max_a Σ_s′ P(s′|s,a) · [ r + γ · V_k(s′) ]</Eq>
        <ClientOnly fallback={fallback}><Studio /></ClientOnly>
      </Section>

      <Section id="evaluate" index={2} kicker="Policy evaluation" title="Draw a policy, see what it's worth">
        <p className="text-ink-soft">
          Same world, your arrows. The expectation backup averages over what the policy does instead of maximising, so the values
          describe <em>this</em> policy. Then press Improve and act greedily on them: that is one round of policy iteration, by hand.
        </p>
        <Eq>V^π(s) = Σ_a π(a|s) Σ_s′ P(s′|s,a) · [ r + γ · V^π(s′) ]</Eq>
        <ClientOnly fallback={fallback}><Evaluate /></ClientOnly>
      </Section>

      <Section id="race" index={3} kicker="VI vs PI" title="Two roads to V*">
        <p className="mb-4 text-ink-soft">
          Both converge to the same fixed point. Value iteration spends one cheap sweep per step; policy iteration evaluates fully,
          then jumps. On one clock, counted in backups, which arrives first?
        </p>
        <ClientOnly fallback={fallback}><Race /></ClientOnly>
      </Section>

      <Section id="td" index={4} kicker="No model" title="Learning from samples">
        <p className="text-ink-soft">
          Now throw away P. An agent only sees (s, a, r, s′) one step at a time. First, how it chooses: ε-greedy. Then TD(0), which
          replaces the expectation with the one sample it just saw.
        </p>
        <Eq>V(s) ← V(s) + α · [ r + γ · V(s′) − V(s) ]</Eq>
        <div className="flex flex-col gap-4">
          <ClientOnly fallback={<Skeleton className="h-64 rounded-2xl" />}><ExploreDial /></ClientOnly>
          <ClientOnly fallback={fallback}><TdLab /></ClientOnly>
        </div>
      </Section>

      <Section id="learn" index={5} kicker="Q-learning" title="Trial and error">
        <p className="text-ink-soft">
          The agent starts knowing nothing. It acts ε-greedily, bumps into lava, and every step nudges one Q value toward a sampled
          optimality backup. The terrain is max_a Q, the dots are where it has been, and the arrows are what it believes.
        </p>
        <Eq>Q(s,a) ← Q(s,a) + α · [ r + γ · max_a′ Q(s′,a′) − Q(s,a) ]</Eq>
        <ClientOnly fallback={fallback}><QLearner /></ClientOnly>
      </Section>
    </ProjectPage>
  );
}
