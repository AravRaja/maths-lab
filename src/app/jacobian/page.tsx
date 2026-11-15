import { Section } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { ProjectPage, projectMetadata } from "@/projects/project-page";
import { ProjectCores } from "@/projects/project-cores";
import { Hero } from "@/projects/jacobian/components/hero";
import { FramesSection } from "@/projects/jacobian/components/frames-section";
import { PuppetSection } from "@/projects/jacobian/components/puppet-section";
import { JacobianSection } from "@/projects/jacobian/components/jacobian-section";
import { ReachSection } from "@/projects/jacobian/components/reach-section";
import { BalanceSection } from "@/projects/jacobian/components/balance-section";
import { CatchSection } from "@/projects/jacobian/components/catch-section";

export const metadata = projectMetadata("jacobian");

export default function Page() {
  return (
    <ProjectPage
      slug="jacobian"
      title="Jacobian"
      visual={<Hero />}
      actions={
        <>
          <Button render={<a href="#reach" />} nativeButton={false}>Make it reach</Button>
          <Button variant="outline" render={<a href="#cores" />} nativeButton={false}>The maths</Button>
        </>
      }
      footer="Scaffolding and the renderer by Claude Code. The rotations, kinematics, Jacobian, IK, LQR and Kalman maths are mine."
    >
      <Section id="cores" index={1} kicker="Convention" title="Eleven cores, all mine">
        <p className="mb-5 text-ink-soft">
          Every piece of maths on this page lives in <code className="font-mono text-ink">src/projects/jacobian/core/</code>.
          No three.js, no robotics library: the arm is plain 4 × 4 matrices drawn by a tiny software renderer. Each core lights
          up part of the page when it is written.
        </p>
        <ProjectCores slug="jacobian" />
      </Section>

      <Section id="frames" index={2} kicker="M1 · SO(3) and SE(3)" title="Spin a frame">
        <p className="mb-5 text-ink-soft">
          A rotation is an axis and an angle. The shaded wedge is what a vector perpendicular to the axis sweeps through. Drag
          to orbit.
        </p>
        <FramesSection />
      </Section>

      <Section id="puppet" index={3} kicker="M2 · forward kinematics" title="Pull the strings">
        <p className="mb-5 text-ink-soft">Six joint angles in, seven rigid transforms out. Each triad is one joint&apos;s frame.</p>
        <PuppetSection />
      </Section>

      <Section id="jacobian" index={4} kicker="M3 · the Jacobian" title="Which way can it move?">
        <p className="mb-5 text-ink-soft">
          Each column of J is one joint&apos;s contribution: the line it spins about, and the velocity that gives the tool. The
          ellipsoid shows every tool velocity a unit joint speed can buy.
        </p>
        <JacobianSection />
      </Section>

      <Section id="reach" index={5} kicker="M4 · damped least squares" title="Reach through a singularity">
        <p className="mb-5 text-ink-soft">
          One damped-least-squares step per frame. Drag in the scene to move the target, or fly it over the top, where the arm
          is fully stretched and J loses rank.
        </p>
        <ReachSection />
      </Section>

      <Section id="balance" index={6} kicker="M5 · discrete LQR" title="Balance a pole">
        <p className="mb-5 text-ink-soft">
          Linearise the cart-pole about upright, then let the Riccati recursion find the gain K that trades angle error against
          motor effort. The physics it then fights is the full nonlinear one.
        </p>
        <BalanceSection />
      </Section>

      <Section id="catch" index={7} kicker="M6 · Kalman filter" title="Catch a firefly">
        <p className="mb-5 text-ink-soft">
          The camera only gives noisy positions. A constant-velocity Kalman filter turns them into a position, a velocity and
          an honest error bar, and the arm reaches for where the firefly is about to be.
        </p>
        <CatchSection />
      </Section>
    </ProjectPage>
  );
}
