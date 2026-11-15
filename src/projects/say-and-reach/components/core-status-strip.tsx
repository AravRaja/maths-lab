"use client";

import { CoreStatus } from "@/kit/components/core-status";
import { CORES } from "@/projects/say-and-reach/core";

export function CoreStatusStrip() {
  return <CoreStatus cores={CORES} />;
}
