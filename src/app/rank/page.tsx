import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("rank");

// Placeholder. The builder for this project replaces this file and works inside src/projects/rank/.
export default function Page() {
  return (
    <ProjectPage slug="rank" visual={<DitherField />}>
      <BeingBuilt slug="rank" />
    </ProjectPage>
  );
}
