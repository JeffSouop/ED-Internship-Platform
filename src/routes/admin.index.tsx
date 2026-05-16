import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { listSubmissions } from "@/services/students";
import { listCompanies } from "@/services/companies";
import { getDashboardCompanyMap } from "@/services/dashboard";
import { listConventionTracking } from "@/services/convention-tracking";

const CompaniesMap = lazy(() =>
  import("@/components/CompaniesMap").then((m) => ({ default: m.CompaniesMap })),
);

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const subs = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions });
  const companies = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const tracking = useQuery({
    queryKey: ["convention-tracking"],
    queryFn: () => listConventionTracking({ skipRefresh: true }),
  });
  const companyMap = useQuery({
    queryKey: ["dashboard-company-map"],
    queryFn: getDashboardCompanyMap,
    staleTime: 1000 * 60 * 30,
  });

  const data = subs.data ?? [];
  const pending = data.filter((s) => s.status === "pending").length;
  const approved = data.filter((s) => s.status === "approved").length;
  const changes = data.filter((s) => s.status === "changes_requested").length;
  const trackSummary = tracking.data?.summary;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble des soumissions, entreprises et conventions.
        </p>
      </header>

      <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Soumissions étudiants" value={data.length} hint={`${pending} en attente`} />
        <Kpi label="Stages approuvés" value={approved} accent />
        <Kpi label="Modifications demandées" value={changes} />
        <Kpi label="Entreprises partenaires" value={companies.data?.length ?? 0} />
      </div>

      {trackSummary && (
        <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Conventions générées"
            value={trackSummary.total}
            hint={
              <Link to="/admin/convention-tracking" className="underline hover:text-foreground">
                Voir le suivi
              </Link>
            }
          />
          <Kpi label="Non envoyées (DocuSign)" value={trackSummary.notSent} />
          <Kpi label="En attente de signature" value={trackSummary.pendingSignature} />
          <Kpi label="Conventions signées" value={trackSummary.signed} accent />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card p-2">
          {companyMap.isLoading && (
            <div className="flex h-full min-h-0 items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              Chargement de la carte…
            </div>
          )}
          {companyMap.isError && (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm text-destructive">
              Impossible de charger la carte.
            </div>
          )}
          {companyMap.data && (
            <Suspense
              fallback={
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <CompaniesMap data={companyMap.data} className="min-h-0 flex-1" />
              </div>
            </Suspense>
          )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        accent ? "border-accent/50 bg-accent/10" : "border-border bg-card"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}
