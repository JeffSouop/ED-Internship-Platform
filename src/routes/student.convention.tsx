import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { getToken } from "@/services/tokens";
import { StudentConventionForm } from "@/components/StudentConventionForm";

export const Route = createFileRoute("/student/convention")({
  validateSearch: (raw: Record<string, unknown>) => ({
    t: typeof raw.t === "string" ? raw.t : undefined,
  }),
  component: ConventionPage,
});

function ConventionPage() {
  const { t } = Route.useSearch();
  const tokenQuery = useQuery({
    queryKey: ["token", t],
    queryFn: () => getToken(t!),
    enabled: !!t,
  });

  if (t && tokenQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (t && (!tokenQuery.data || tokenQuery.data.kind !== "student")) {
    return <InvalidLegacyLink />;
  }

  const prefill =
    tokenQuery.data?.kind === "student" ? tokenQuery.data.refId : undefined;

  return <StudentConventionForm prefillStudentId={prefill ?? undefined} />;
}

function InvalidLegacyLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Lien invalide</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce lien d&apos;accès n&apos;est plus valide. Utilisez le formulaire unique convention de stage ou
          contactez le département Stages &amp; Carrière.
        </p>
        <Link
          to="/student/convention"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Accéder au formulaire convention
        </Link>
        <Link
          to="/"
          className="mt-3 flex justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
      </div>
    </div>
  );
}
