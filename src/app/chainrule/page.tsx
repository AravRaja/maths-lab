import { Section } from "@/kit/components/page-shell";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { Button } from "@/components/ui/button";
import { CoreStrip } from "@/projects/chainrule/components/core-strip";
import { HeroSwarm, HERO_EXPR } from "@/projects/chainrule/components/hero-swarm";
import { ExpressionLab } from "@/projects/chainrule/components/expression-lab";
import { OpsGallery } from "@/projects/chainrule/components/ops-gallery";
import { Trainer } from "@/projects/chainrule/components/trainer";
import { ClientOnly } from "@/projects/chainrule/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = projectMetadata("chainrule");

export default function Page() {
  return (
    <ProjectPage
      slug="chainrule"
      title={<>Chain<br />rule</>}
      visual={<HeroSwarm />}
      actions={
        <>
          <Button render={<a href="#graph" />} nativeButton={false}>Open the graph</Button>
          <Button variant="outline" render={<a href="#train" />} nativeButton={false}>Train a net</Button>
        </>
      }
      footer={
        <span>
          Hero landscape: <code className="font-mono text-xs break-all">f = {HERO_EXPR}</code>. Scaffolding by Claude Code. The
          derivatives, the graph walk, the gradient check and the optimiser are mine.
        </span>
      }
    >
      <Section index={0} kicker="Progress" title="Thirteen functions, five milestones">
        <p className="mb-5 text-ink-soft">
          Every derivative in this page comes from one of these. Each starts as a stub; the page lights up as they are written.
        </p>
        <CoreStrip />
      </Section>

      <ClientOnly fallback={<Skeleton className="h-[900px] rounded-2xl" />}>
        <ExpressionLab
          between={
            <Section id="ops" index={2} kicker="Local derivatives" title="Seven rules, that's all">
              <OpsGallery />
            </Section>
          }
        />
      </ClientOnly>

      <Trainer />
    </ProjectPage>
  );
}
