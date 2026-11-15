import { Section } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { HeroFlow } from "@/projects/flowfield/components/hero-flow";
import { ShapePicker } from "@/projects/flowfield/components/shape-picker";
import { PairSection } from "@/projects/flowfield/components/pair-section";
import { FieldSection } from "@/projects/flowfield/components/field-section";
import { IntegrateSection } from "@/projects/flowfield/components/integrate-section";
import { TrainSection } from "@/projects/flowfield/components/train-section";
import { GuidanceSection } from "@/projects/flowfield/components/guidance-section";
import { ReacherSection } from "@/projects/flowfield/components/reacher-section";

export const metadata = projectMetadata("flowfield");

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 max-w-xl leading-relaxed text-ink-soft">{children}</p>;
}

export default function Page() {
  return (
    <ProjectPage
      slug="flowfield"
      title={<>Flow<br />field</>}
      visual={<HeroFlow />}
      actions={
        <>
          <Button render={<a href="#data" />} nativeButton={false}>Draw a shape</Button>
          <Button variant="outline" render={<a href="#robot" />} nativeButton={false}>Skip to the robot</Button>
        </>
      }
      footer={
        <span>
          Hero: particles integrated through the exact marginal field of each glyph, forwards then backwards. Scaffolding, networks
          and training loops by Claude Code. The paths, the field, the sampler, the loss, guidance and chunk blending are mine.
        </span>
      }
    >
      <Section index={0} kicker="Progress" title="Ten functions, six milestones">
        <P>
          Everything that moves on this page goes through these. Each starts as a stub, and the page lights up section by section
          as they get written.
        </P>
        <ProjectCores slug="flowfield" />
      </Section>

      <Section id="data" index={1} kicker="Data" title="Pick a glyph, or draw one">
        <P>
          A dataset here is just a cloud of points p<sub>data</sub>. The goal: a velocity field that carries a cloud of Gaussian
          noise onto it.
        </P>
        <ShapePicker />
      </Section>

      <Section index={2} kicker="M1 · Conditional paths" title="One pair, one straight line">
        <P>
          Pair a noise sample x₀ with a data point x₁ and join them with a line. Training only ever sees points on these lines and
          their velocities. Notice how much they cross.
        </P>
        <PairSection />
      </Section>

      <Section index={3} kicker="M2 · Marginal field" title="The field nobody trained">
        <P>
          Average the line velocities through each point, weighted by how likely each data point is to have sent a line there. For a
          finite dataset that has a closed form, and it is exactly what a perfect network would learn.
        </P>
        <FieldSection />
      </Section>

      <Section index={4} kicker="M3 · Euler" title="Integrate it">
        <P>Sampling is solving an ODE from t = 0 to t = 1. Fewer steps are cheaper, and you pay for it in accuracy.</P>
        <IntegrateSection />
      </Section>

      <Section index={5} kicker="M4 · CFM loss" title="Now learn it">
        <P>
          A 3×96 MLP, trained live in a Web Worker, regresses the line velocities. It never sees the closed form, only one random
          line per sample. It learns the average anyway.
        </P>
        <TrainSection />
      </Section>

      <Section index={6} kicker="M5 · Guidance" title="One net, four glyphs">
        <P>
          Give the network a context (which glyph), hide it 15% of the time, and you can steer at sampling time: classifier-free
          guidance, the same knob text-to-image models use.
        </P>
        <GuidanceSection />
      </Section>

      <Section id="robot" index={7} kicker="M6 · Action chunks" title="Same maths, robot actions">
        <P>
          π0-style policies generate actions with a flow. Here the &quot;point&quot; is 16 numbers, the arm&apos;s next 8 joint moves,
          and the context is where the arm is and where it should go. Half the demonstrations take the fingertip round the post on
          the inside, half on the outside.
        </P>
        <ReacherSection />
      </Section>
    </ProjectPage>
  );
}
