import { Section } from "@/kit/components/page-shell";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { Button } from "@/components/ui/button";
import { CoreStatusStrip } from "@/projects/say-and-reach/components/core-status-strip";
import { HeroScene } from "@/projects/say-and-reach/components/hero-scene";
import { PoseSection } from "@/projects/say-and-reach/components/pose-section";
import { ReachSection } from "@/projects/say-and-reach/components/reach-section";
import { Playground } from "@/projects/say-and-reach/components/playground";
import { TeachSection } from "@/projects/say-and-reach/components/teach-section";
import { FlowSection } from "@/projects/say-and-reach/components/flow-section";
import { ScoreSection } from "@/projects/say-and-reach/components/score-section";

export const metadata = projectMetadata("say-and-reach");

export default function Page() {
  return (
    <ProjectPage
      slug="say-and-reach"
      title={<>Say and<br />reach</>}
      visual={<HeroScene />}
      actions={
        <>
          <Button render={<a href="#say" />} nativeButton={false}>Give it a command</Button>
          <Button variant="outline" render={<a href="#teach" />} nativeButton={false}>Train it</Button>
        </>
      }
      footer="Scaffolding by Claude Code. The kinematics, IK, losses, flow and reward maths are mine."
    >
      <Section id="cores" index={1} kicker="Convention" title="Eight cores, all mine">
        <p className="mb-5 text-ink-soft">
          Every bit of maths that makes this work lives in <code className="font-mono text-ink">src/projects/say-and-reach/core/</code>. Each one lights
          up a part of this page when it is written.
        </p>
        <CoreStatusStrip />
      </Section>

      <Section id="pose" index={2} kicker="M1 · forward kinematics" title="Where is the hand?">
        <p className="mb-5 text-ink-soft">Three joint angles in, three link ends out. Drag the sliders.</p>
        <PoseSection />
      </Section>

      <Section id="reach" index={3} kicker="M2 · Jacobian + damped least squares" title="Reach for it">
        <p className="mb-5 text-ink-soft">
          Tap the table. Each frame takes one damped-least-squares step toward the target. The ellipse is J Jᵀ: how easily the
          fingertip can move in each direction right now.
        </p>
        <ReachSection />
      </Section>

      <Section id="say" index={4} kicker="The playground" title="Say it">
        <p className="mb-5 text-ink-soft">
          The expert follows keywords. The learned heads only ever see a bag of hashed word vectors, and have to work out from
          demonstrations what &ldquo;box&rdquo; or &ldquo;away&rdquo; mean.
        </p>
        <Playground />
      </Section>

      <Section id="teach" index={5} kicker="M3 · behaviour cloning, M4 · flow matching" title="Teach it">
        <p className="mb-5 text-ink-soft">
          Record the expert, then train a policy on it in a Web Worker. Snapshots stream back while it learns, so the arm above
          gets better as you watch.
        </p>
        <TeachSection />
      </Section>

      <Section id="flow" index={6} kicker="M4 · flow matching" title="Noise into motion">
        <p className="mb-5 text-ink-soft">
          The flow head doesn&apos;t output an action. It outputs a velocity field, and an action is wherever a noise sample
          ends up after you integrate it.
        </p>
        <FlowSection />
      </Section>

      <Section id="score" index={7} kicker="M5 · reward shaping" title="Score it">
        <ScoreSection />
      </Section>
    </ProjectPage>
  );
}
