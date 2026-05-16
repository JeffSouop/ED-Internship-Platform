import { createFileRoute, Outlet } from "@tanstack/react-router";

import { FormAccessGate } from "@/components/FormAccessGate";

export const Route = createFileRoute("/company")({
  component: CompanySectionLayout,
});

/** Layout pour `/company` et `/company/:token` (formulaire index + variantes jeton). */
function CompanySectionLayout() {
  return (
    <FormAccessGate
      title="Formulaire entreprise"
      description="Saisissez le mot de passe communiqué par l’École Ducasse pour accéder à la fiche entreprise d’accueil."
    >
      <Outlet />
    </FormAccessGate>
  );
}
