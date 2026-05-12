import { createFileRoute } from "@tanstack/react-router";

import { CompanyPartnerShell } from "./company.$token";

export const Route = createFileRoute("/company/")({
  component: CompanyPublicPage,
});

/** Lien global : aucun jeton ; jointure dossier étudiant via le numéro d’étudiant sur la fiche. */
function CompanyPublicPage() {
  return <CompanyPartnerShell />;
}
