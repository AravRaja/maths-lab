import { PageShell, Section } from "@/components/kit/page-shell";
import { DitherField } from "@/components/kit/dither-field";
import { Button } from "@/components/ui/button";
import { CoreStatusDemo, YoursToWriteDemo, WorkerDemo } from "./_demo/core-demos";
import { ChartsDemo } from "./_demo/charts-demo";
import { ComponentsDemo } from "./_demo/components-demo";

export default function Home() {
  return (
    <PageShell
      eyebrow="Lab kit · template"
      title={<>Lab<br />kit</>}
      tagline="The starter every lab project grows from. Claude Code builds the scaffolding. The maths core is mine to write."
      visual={<DitherField />}
      actions={
        <>
          <Button render={<a href="#cores" />} nativeButton={false}>See the convention</Button>
          <Button variant="outline" render={<a href="#charts" />} nativeButton={false}>Charts</Button>
        </>
      }
    >
      <Section id="cores" index={1} kicker="Convention" title="You write the core">
        <p className="mb-5 text-ink-soft">
          Every maths function in <code className="font-mono text-ink">src/core/</code> starts as a stub that throws{" "}
          <code className="font-mono text-ink">NotYoursYet</code>. The app catches it and shows what to write instead of
          crashing. The strip probes each core with a tiny input.
        </p>
        <CoreStatusDemo />
      </Section>

      <Section index={2} kicker="Stub in action" title="Yours to write">
        <YoursToWriteDemo />
      </Section>

      <Section index={3} kicker="Web Worker" title="Heavy compute off the main thread">
        <WorkerDemo />
      </Section>

      <Section id="charts" index={4} kicker="Monochrome" title="Charts with no colour">
        <ChartsDemo />
      </Section>

      <Section index={5} kicker="Spectrum UI + shadcn" title="Components on theme">
        <ComponentsDemo />
      </Section>
    </PageShell>
  );
}
