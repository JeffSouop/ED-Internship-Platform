import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { listSubmissions } from "@/services/students";
import { listCompanies } from "@/services/companies";
import { listMerged } from "@/services/merged";
import { listDeclarations } from "@/services/declarations";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const subs = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions });
  const companies = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const merged = useQuery({ queryKey: ["merged"], queryFn: listMerged });
  const decls = useQuery({ queryKey: ["declarations"], queryFn: listDeclarations });

  const data = subs.data ?? [];
  const pending = data.filter((s) => s.status === "pending").length;
  const approved = data.filter((s) => s.status === "approved").length;
  const changes = data.filter((s) => s.status === "changes_requested").length;
  const matchedCount = (merged.data ?? []).filter((m) => m.status === "matched").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble des soumissions, entreprises partenaires et appariements.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Soumissions étudiants" value={data.length} hint={`${pending} en attente`} />
        <Kpi label="Stages approuvés" value={approved} accent />
        <Kpi label="Modifications demandées" value={changes} />
        <Kpi label="Entreprises partenaires" value={companies.data?.length ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Stages consolidés</p>
          <p className="mt-2 text-3xl font-semibold">{matchedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Étudiants approuvés et déclarés par leur entreprise
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Déclarations entreprises</p>
          <p className="mt-2 text-3xl font-semibold">{decls.data?.length ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pour les rentrées de Février et Septembre
          </p>
        </div>
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
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        accent ? "border-accent/50 bg-accent/10" : "border-border bg-card"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
