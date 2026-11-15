import { Section } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { DaydreamHero } from "@/projects/daydream/components/hero";
import { WorldSection } from "@/projects/daydream/components/world-section";
import { GaussianLab } from "@/projects/daydream/components/gaussian-lab";
import { VaeSection } from "@/projects/daydream/components/vae-section";
import { LatentWalk } from "@/projects/daydream/components/latent-walk";
import { DreamLab } from "@/projects/daydream/components/dream-lab";
import { ClientOnly } from "@/projects/daydream/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = projectMetadata("daydream");

export default function Page() {
  return (
    <ProjectPage
      slug="daydream"
      title={<>Day<br />dream</>}
      visual={<DaydreamHero />}
      actions={
        <>
          <Button render={<a href="#eyes" />} nativeButton={false}>Train its eyes</Button>
          <Button variant="outline" render={<a href="#dream" />} nativeButton={false}>Close its eyes</Button>
        </>
      }
      footer={
        <span>
          A world model in miniature, in the spirit of Ha &amp; Schmidhuber&apos;s World Models and Dreamer, small enough to train in a
          phone browser. Scaffolding by Claude Code. The sampling, the KL, the bound, the dynamics loss and the surprise are mine.
        </span>
      }
    >
      <Section index={0} kicker="Progress" title="Ten functions, five milestones">
        <p className="mb-5 text-ink-soft">
          Every probability on this page comes from one of these. Each starts as a stub, and the page wakes up section by section as they are written.
        </p>
        <ProjectCores slug="daydream" />
      </Section>

      <ClientOnly fallback={<Skeleton className="h-[1400px] rounded-2xl" />}>
        <Section id="world" index={1} kicker="The world" title="One ball, four actions, 400 pixels">
          <p className="mb-5 text-ink-soft">
            A heavy ball in a box with gravity and bouncy walls. Push it, make it jump, kick it. The model never gets the
            coordinates. It only ever sees the grey grid on the right.
          </p>
          <WorldSection />
        </Section>

        <Section id="sampling" index={2} kicker="Reparameterisation · KL" title="Gradients through a coin toss">
          <p className="mb-5 text-ink-soft">
            The encoder will output a Gaussian, not a point. To train it you need gradients through a random sample, and a cost for
            straying from the prior. Here both act on one 2-D Gaussian you can play with. Drag the target.
          </p>
          <GaussianLab />
        </Section>

        <Section id="eyes" index={3} kicker="The ELBO" title="Teach it to see">
          <p className="mb-5 text-ink-soft">
            A β-VAE squeezes each 400-pixel frame into a Gaussian over just two numbers and learns to draw the frame back. It climbs
            your ELBO, in a Web Worker, in about half a minute.
          </p>
          <VaeSection />
        </Section>

        <Section id="walk" index={4} kicker="Latent space" title="Walk around its mind">
          <p className="mb-5 text-ink-soft">
            Two numbers are a place you can stand. Every tile is the decoder&apos;s drawing of one spot; drag to go anywhere,
            including places it has never seen.
          </p>
          <LatentWalk />
        </Section>

        <DreamLab />
      </ClientOnly>
    </ProjectPage>
  );
}
