import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("posterior");

// Placeholder. The builder for this project replaces this file and works inside src/projects/posterior/.
export default function Page() {
  return (
    <ProjectPage slug="posterior" visual={<DitherField />}>
      <BeingBuilt slug="posterior" />
    </ProjectPage>
  );
}
