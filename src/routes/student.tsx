import { createFileRoute, Outlet } from "@tanstack/react-router";

import { FormAccessGate } from "@/components/FormAccessGate";

export const Route = createFileRoute("/student")({
  component: StudentSectionLayout,
});

/** Layout pour `/student/convention`, `/student/merci` et anciens liens `/student/:token`. */
function StudentSectionLayout() {
  return (
    <FormAccessGate
      title="Formulaire étudiant"
      description="Saisissez le mot de passe communiqué par l’École Ducasse pour accéder au formulaire de convention de stage."
    >
      <Outlet />
    </FormAccessGate>
  );
}
