import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  listConventionGenerationStatus,
  type ConventionGenerationRow,
} from "@/services/convention-generation-status";

export const Route = createFileRoute("/admin/feuille-suivi")({
  component: FeuilleSuiviPage,
});

type FilterKey = "all" | "generated" | "not_generated";

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesSearch(row: ConventionGenerationRow, query: string): boolean {
  const parts = [
    row.studentName,
    row.studentId,
    row.companyName,
    row.campus ?? "",
    row.programme ?? "",
    row.generated ? "générée" : "non générée",
  ];
  return parts.some((p) => p.toLowerCase().includes(query));
}

function FeuilleSuiviPage() {
  const [filter, setFilter] = useState<FilterKey>("not_generated");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["feuille-suivi"],
    queryFn: listConventionGenerationStatus,
  });

  const rows = q.data?.rows ?? [];
  const summary = q.data?.summary;

  const filtered = useMemo(() => {
    const byStatus = rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "generated") return r.generated;
      return !r.generated;
    });
    const qSearch = search.trim().toLowerCase();
    if (!qSearch) return byStatus;
    return byStatus.filter((r) => matchesSearch(r, qSearch));
  }, [rows, filter, search]);

  const tabs: Array<{ key: FilterKey; label: string; count?: number }> = [
    { key: "not_generated", label: "Non générées", count: summary?.notGenerated },
    { key: "generated", label: "Générées", count: summary?.generated },
    { key: "all", label: "Toutes", count: summary?.total },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Feuille de suivi</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Étudiants avec stage fusionné : convention générée ou encore à produire depuis
          l&apos;onglet Convention de stage.
        </p>
      </header>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Stages fusionnés" value={summary.total} />
          <SummaryCard label="Conventions générées" value={summary.generated} accent />
          <SummaryCard label="À générer" value={summary.notGenerated} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (étudiant, n° étudiant, entreprise, campus…)"
          className="max-w-md"
          aria-label="Rechercher"
        />
        {search.trim() && (
          <p className="text-sm text-muted-foreground sm:shrink-0">
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              filter === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Étudiant</th>
              <th className="px-4 py-3 text-left">Entreprise</th>
              <th className="px-4 py-3 text-left">Campus</th>
              <th className="px-4 py-3 text-left">Programme</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Générée le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {search.trim()
                    ? "Aucun résultat pour cette recherche."
                    : "Aucun étudiant dans cette catégorie."}
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.studentId} className="align-top hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{row.studentName}</p>
                  <p className="text-xs text-muted-foreground">{row.studentId}</p>
                </td>
                <td className="px-4 py-3 text-foreground">{row.companyName}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.campus ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.programme ?? "—"}</td>
                <td className="px-4 py-3">
                  <GenerationBadge generated={row.generated} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.generated ? formatDateTime(row.generatedAt) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/convention"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {row.generated ? "Voir" : "Générer"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenerationBadge({ generated }: { generated: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        generated
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
      }`}
    >
      {generated ? "Générée" : "Non générée"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        accent ? "border-accent/50 bg-accent/10" : "border-border bg-card"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
