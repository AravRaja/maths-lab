import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("ppo-arena");

// Placeholder. The builder for this project replaces this file and works inside src/projects/ppo-arena/.
export default function Page() {
  return (
    <ProjectPage slug="ppo-arena" visual={<DitherField />}>
      <BeingBuilt slug="ppo-arena" />
    </ProjectPage>
  );
}
