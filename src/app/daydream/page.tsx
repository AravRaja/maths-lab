import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("daydream");

// Placeholder. The builder for this project replaces this file and works inside src/projects/daydream/.
export default function Page() {
  return (
    <ProjectPage slug="daydream" visual={<DitherField />}>
      <BeingBuilt slug="daydream" />
    </ProjectPage>
  );
}
