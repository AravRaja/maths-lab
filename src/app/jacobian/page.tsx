import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("jacobian");

// Placeholder. The builder for this project replaces this file and works inside src/projects/jacobian/.
export default function Page() {
  return (
    <ProjectPage slug="jacobian" visual={<DitherField />}>
      <BeingBuilt slug="jacobian" />
    </ProjectPage>
  );
}
