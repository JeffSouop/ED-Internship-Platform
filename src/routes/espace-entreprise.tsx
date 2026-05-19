import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/espace-entreprise")({
  head: () => ({
    meta: [
      { title: "Espace entreprise — École Ducasse" },
      {
        name: "description",
        content: "Espace dédié aux entreprises partenaires — École Ducasse Campus Paris.",
      },
    ],
  }),
  component: EspaceEntreprisePage,
});

function EspaceEntreprisePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader subtitle="Espace entreprise" />
      <main className="flex-1" aria-label="Espace entreprise" />
      <SiteFooter />
    </div>
  );
}
