import { DitherField } from "@/kit/components/dither-field";
import { BeingBuilt } from "@/projects/being-built";
import { ProjectPage, projectMetadata } from "@/projects/project-page";

export const metadata = projectMetadata("flowfield");

// Placeholder. The builder for this project replaces this file and works inside src/projects/flowfield/.
export default function Page() {
  return (
    <ProjectPage slug="flowfield" visual={<DitherField />}>
      <BeingBuilt slug="flowfield" />
    </ProjectPage>
  );
}
