import { Section } from "@/kit/components/page-shell";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { Button } from "@/components/ui/button";
import { RidgeHero } from "@/projects/posterior/components/ridge-hero";
import { CoinLab } from "@/projects/posterior/components/coin-lab";
import { GaussianSlice } from "@/projects/posterior/components/gaussian-slice";
import { DartsLab } from "@/projects/posterior/components/darts-lab";
import { ImportanceLab } from "@/projects/posterior/components/importance-lab";
import { KlLab } from "@/projects/posterior/components/kl-lab";

export const metadata = projectMetadata("posterior");

export default function Page() {
  return (
    <ProjectPage
      slug="posterior"
      visual={<RidgeHero />}
      actions={
        <>
          <Button render={<a href="#coin" />} nativeButton={false}>Flip a coin</Button>
          <Button variant="outline" render={<a href="#darts" />} nativeButton={false}>Throw darts</Button>
        </>
      }
      footer={
        <span>
          Hero: thirty posteriors over a hidden coin&apos;s bias, one per flip, newest in front (press and hold to flip faster).
          Scaffolding by Claude Code. The Bayes update, the Gaussian algebra, the estimators and the KL are mine.
        </span>
      }
    >
      <Section index={0} kicker="Progress" title="Ten functions, six milestones">
        <p className="mb-5 text-ink-soft">
          Every number on this page comes from one of these. Each starts as a stub; the sections light up as they are written.
        </p>
        <ProjectCores slug="posterior" />
      </Section>
      <CoinLab />
      <GaussianSlice />
      <DartsLab />
      <ImportanceLab />
      <KlLab />
    </ProjectPage>
  );
}
