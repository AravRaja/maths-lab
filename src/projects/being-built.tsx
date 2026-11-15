import { Section, Sheet } from "@/kit/components/page-shell";
import { Ghost } from "@/kit/components/yours-to-write";
import { getProject } from "./registry";

/** Placeholder body for a project that hasn't been built yet. Builders replace it. */
export function BeingBuilt({ slug }: { slug: string }) {
  const p = getProject(slug);
  return (
    <Section index={0} kicker={p.topic} title="Being built">
      <Sheet className="flex flex-col gap-4">
        <p className="text-ink-soft">
          The scaffolding for this one is on its way. When it lands, the maths cores will show up here as stubs, each with a
          spec and tests, and the page will light up as they are written.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Ghost className="h-24" label="core" />
          <Ghost className="h-24" label="core" />
          <Ghost className="h-24" label="core" />
        </div>
      </Sheet>
    </Section>
  );
}
