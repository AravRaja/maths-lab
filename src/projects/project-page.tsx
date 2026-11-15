import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageShell } from "@/kit/components/page-shell";
import { PROJECTS, getProject, projectIndex } from "./registry";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** Page metadata from meta.ts:  export const metadata = projectMetadata("rank"); */
export function projectMetadata(slug: string): Metadata {
  const p = getProject(slug);
  return { title: `${p.title} · maths-lab`, description: p.tagline };
}

/**
 * The shared layout every project page uses: maths-lab breadcrumb on top, the kit's PageShell hero,
 * and prev/next project links at the bottom. Title, tagline and eyebrow default to meta.ts.
 *
 *   <ProjectPage slug="rank" visual={<MyHero />} title={<>Ra<br />nk</>}>
 *     <Section index={1} ...>...</Section>
 *   </ProjectPage>
 */
export function ProjectPage({
  slug,
  title,
  tagline,
  eyebrow,
  visual,
  actions,
  footer,
  children,
}: {
  slug: string;
  title?: ReactNode;
  tagline?: ReactNode;
  eyebrow?: ReactNode;
  visual?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const p = getProject(slug);
  const i = projectIndex(slug);
  return (
    <PageShell
      nav={<LabNav index={i} />}
      eyebrow={eyebrow ?? `${pad(i + 1)} · ${p.week} · ${p.topic}`}
      title={title ?? p.title}
      tagline={tagline ?? p.tagline}
      visual={visual}
      actions={actions}
      footer={
        <div className="flex flex-col gap-6">
          <Pager index={i} />
          <span>{footer ?? "Scaffolding by Claude Code. The maths is mine."}</span>
        </div>
      }
    >
      {children}
    </PageShell>
  );
}

function LabNav({ index }: { index: number }) {
  return (
    <nav className="flex items-center justify-between gap-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
      <Link
        href="/"
        className="type-wide -ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm tracking-tight uppercase hover:bg-sheet"
      >
        <ArrowLeft className="size-4" aria-hidden />
        maths-lab
      </Link>
      <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase tabular-nums">
        {pad(index + 1)} / {pad(PROJECTS.length)}
      </span>
    </nav>
  );
}

function Pager({ index }: { index: number }) {
  const prev = PROJECTS[index - 1];
  const next = PROJECTS[index + 1];
  return (
    <div className="grid grid-cols-2 gap-3">
      {prev ? <PagerLink p={prev} n={index} dir="prev" /> : <span />}
      {next ? <PagerLink p={next} n={index + 2} dir="next" /> : <span />}
    </div>
  );
}

function PagerLink({ p, n, dir }: { p: (typeof PROJECTS)[number]; n: number; dir: "prev" | "next" }) {
  return (
    <Link
      href={`/${p.slug}`}
      className={cn(
        "group flex min-h-11 flex-col gap-1 rounded-2xl border border-rule bg-sheet p-4 text-ink transition-colors hover:border-ink-soft",
        dir === "next" && "items-end text-right",
      )}
    >
      <span className="type-narrow inline-flex items-center gap-1 text-xs tracking-[0.2em] text-ink-soft uppercase">
        {dir === "prev" && <ArrowLeft className="size-3" aria-hidden />}
        {pad(n)}
        {dir === "next" && <ArrowRight className="size-3" aria-hidden />}
      </span>
      <span className="type-semi text-base leading-tight">{p.title}</span>
    </Link>
  );
}
