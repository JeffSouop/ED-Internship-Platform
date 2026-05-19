import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/job-board")({
  head: () => ({
    meta: [
      { title: "Offre de stage — École Ducasse" },
      {
        name: "description",
        content: "Offres de stage et opportunités — École Ducasse Campus Paris.",
      },
    ],
  }),
  component: JobBoardPage,
});

function JobBoardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader subtitle="Offre de stage" />
      <main className="flex-1" aria-label="Offre de stage" />
      <SiteFooter />
    </div>
  );
}
