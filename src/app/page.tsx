import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PROJECTS } from "@/projects/registry";
import { CoreCount, TotalCoreCount } from "@/projects/project-cores";
import { LabHero } from "./_landing/lab-hero";

const pad = (n: number) => String(n).padStart(2, "0");

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-16 sm:px-6">
      <header className="relative pt-[max(env(safe-area-inset-top),1.5rem)]">
        <div className="relative -mx-4 aspect-[4/5] overflow-hidden border-b border-rule sm:mx-0 sm:aspect-[16/8] sm:rounded-2xl sm:border">
          <LabHero />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">Nine projects · twelve weeks</p>
            <h1 className="type-wide text-[clamp(3.2rem,17vw,9rem)] leading-[0.82] break-words uppercase">
              maths
              <br />
              -lab
            </h1>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <p className="max-w-xl text-lg leading-snug sm:text-xl">
            Nine maths demos, from the SVD to a tiny vision-language-action model.{" "}
            <span className="text-ink-soft">I write the maths. Claude Code builds the rest.</span>
          </p>
          <div className="flex gap-6 sm:justify-end">
            <HeroStat label="Projects" value={pad(PROJECTS.length)} />
            <HeroStat label="Cores written" value={<TotalCoreCount />} />
          </div>
        </div>
      </header>

      <main className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-rule pb-3">
          <h2 className="type-semi text-2xl leading-tight">The syllabus, in order</h2>
          <p className="type-narrow hidden text-xs tracking-[0.2em] text-ink-soft uppercase sm:block">
            Linear algebra → robots
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p, i) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="group relative flex h-full min-h-56 flex-col gap-4 overflow-hidden rounded-2xl border border-rule bg-sheet p-5 transition-colors duration-300 hover:border-ink focus-visible:border-ink"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-hatch opacity-0 transition-opacity duration-500 group-hover:opacity-40"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span
                    aria-hidden
                    className="type-wide text-5xl leading-none text-transparent transition-colors duration-300 [-webkit-text-stroke:1px_var(--ink-soft)] group-hover:[-webkit-text-stroke:1px_var(--ink)]"
                  >
                    {pad(i + 1)}
                  </span>
                  <div className="flex flex-col items-end gap-2">
                    <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{p.week}</span>
                    {p.status === "building" && (
                      <span className="type-narrow rounded-full border border-dashed border-ink-soft/60 px-2 py-0.5 text-[10px] tracking-[0.2em] text-ink-soft uppercase">
                        Being built
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative flex flex-1 flex-col gap-2">
                  <h3 className="type-wide flex items-center gap-2 text-2xl leading-none uppercase">
                    {p.title}
                    <ArrowUpRight
                      aria-hidden
                      className="size-5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </h3>
                  <p className="type-narrow text-xs tracking-[0.18em] text-ink-soft uppercase">{p.topic}</p>
                  <p className="text-sm leading-snug text-ink-soft">{p.tagline}</p>
                </div>
                <CoreCount slug={p.slug} className="relative" />
              </Link>
            </li>
          ))}
        </ol>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          <Rule n="01" title="Stubs first">
            Every maths function starts as a stub that throws. Its spec says what to derive on paper, never the answer.
          </Rule>
          <Rule n="02" title="Tests decide">
            Finite-difference gradient checks, closed forms and invariants say when a core is right.
          </Rule>
          <Rule n="03" title="The page lights up">
            Until then each demo shows what is missing and where. Write the core and the visual comes alive.
          </Rule>
        </section>
      </main>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6 type-narrow text-sm text-ink-soft">
        <span>Scaffolding by Claude Code. The maths is mine.</span>
        <a
          href="https://github.com/AravRaja/maths-lab"
          className="inline-flex min-h-11 items-center underline decoration-ink-soft underline-offset-4 hover:text-ink"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</span>
      <span className="type-wide text-4xl leading-none tabular-nums">{value}</span>
    </div>
  );
}

function Rule({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-rule p-5">
      <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">{n}</p>
      <h3 className="type-semi mb-2 text-lg leading-tight">{title}</h3>
      <p className="text-sm leading-snug text-ink-soft">{children}</p>
    </div>
  );
}
