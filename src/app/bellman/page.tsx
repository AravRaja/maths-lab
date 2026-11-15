import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("bellman");

// Placeholder. The builder for this project replaces this file and works inside src/projects/bellman/.
export default function Page() {
  return (
    <ProjectPage slug="bellman" visual={<DitherField />}>
      <BeingBuilt slug="bellman" />
    </ProjectPage>
  );
}
