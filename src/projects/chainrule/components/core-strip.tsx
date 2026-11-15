"use client";

import { BeamCard } from "@/components/spectrumui/beam-card";
import { CoreStatus } from "@/kit/components/core-status";
import { CORES } from "@/projects/chainrule/core";

/**
 * CORES holds probe functions, so the registry has to be read on the client side.
 * A mono Spectrum border beam keeps travelling round the list.
 */
export function CoreStrip() {
  return (
    <BeamCard size="md" colorVariant="mono" theme="dark" strength={0.7} className="rounded-2xl border-0 bg-transparent p-0 dark:bg-transparent [&>div]:mt-0">
      <CoreStatus cores={CORES} />
    </BeamCard>
  );
}
