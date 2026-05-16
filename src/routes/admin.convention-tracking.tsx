import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { ConventionSignatureBadge } from "@/components/ConventionSignatureBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listConventionTracking,
  type ConventionTrackingRow,
  type ConventionTrackingStatus,
} from "@/services/convention-tracking";

export const Route = createFileRoute("/admin/convention-tracking")({
  component: ConventionTrackingPage,
});

type FilterKey = "all" | ConventionTrackingStatus;

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

function signerStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "signed") return "Signé";
  if (s === "declined") return "Refusé";
  if (s === "delivered") return "Lu";
  if (s === "sent") return "Envoyé";
  return status;
}

const STATUS_SEARCH_LABELS: Record<ConventionTrackingStatus, string> = {
  not_sent: "non envoyée",
  pending_signature: "en attente signature",
  signed: "signée",
  declined: "refusée annulée",
};

function matchesSearch(row: ConventionTrackingRow, query: string): boolean {
  const parts = [
    row.studentName,
    row.studentId,
    row.companyName,
    row.filename,
    row.envelopeId ?? "",
    STATUS_SEARCH_LABELS[row.status],
    ...(row.signers?.flatMap((s) => [s.roleName, s.name, s.email]) ?? []),
  ];
  return parts.some((p) => p.toLowerCase().includes(query));
}

function ConventionTrackingPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["convention-tracking"],
    queryFn: () => listConventionTracking(),
  });

  async function handleRefreshStatuses() {
    setRefreshing(true);
    try {
      const data = await listConventionTracking();
      queryClient.setQueryData(["convention-tracking"], data);
    } finally {
      setRefreshing(false);
    }
  }

  const rows = q.data?.rows ?? [];
  const summary = q.data?.summary;

  const filtered = useMemo(() => {
    const byStatus = rows.filter((r) => filter === "all" || r.status === filter);
    const qSearch = search.trim().toLowerCase();
    if (!qSearch) return byStatus;
    return byStatus.filter((r) => matchesSearch(r, qSearch));
  }, [rows, filter, search]);

  const tabs: Array<{ key: FilterKey; label: string; count?: number }> = [
    { key: "all", label: "Toutes", count: summary?.total },
    { key: "not_sent", label: "Non envoyées", count: summary?.notSent },
    { key: "pending_signature", label: "En attente de signature", count: summary?.pendingSignature },
    { key: "signed", label: "Signées", count: summary?.signed },
    { key: "declined", label: "Refusées", count: summary?.declined },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suivi des conventions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conventions Word générées sur la plateforme et leur statut DocuSign : non envoyées,
            en attente de signature des signataires, ou entièrement signées.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing || q.isLoading}
          onClick={() => void handleRefreshStatuses()}
          className="shrink-0"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser les statuts DocuSign
        </Button>
      </header>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Conventions générées" value={summary.total} />
          <SummaryCard label="Non envoyées" value={summary.notSent} />
          <SummaryCard label="En attente de signature" value={summary.pendingSignature} />
          <SummaryCard label="Signées" value={summary.signed} />
        </div>
      )}

      {!q.data?.docusignConfigured && (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          DocuSign n’est pas configuré : seules les conventions générées localement sont listées.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (étudiant, n° étudiant, entreprise, fichier…)"
          className="max-w-md"
          aria-label="Rechercher une convention"
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
              <th className="px-4 py-3 text-left">Générée le</th>
              <th className="px-4 py-3 text-left">Envoyée le</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Signataires</th>
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
                    : "Aucune convention dans cette catégorie."}
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
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(row.generatedAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(row.sentAt)}
                </td>
                <td className="px-4 py-3">
                  <ConventionSignatureBadge status={row.status} />
                </td>
                <td className="px-4 py-3">
                  {row.signers && row.signers.length > 0 ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {row.signers.map((s) => (
                        <li key={`${s.roleName}-${s.email}`}>
                          <span className="text-foreground">{s.roleName}</span>
                          {" — "}
                          {signerStatusLabel(s.status)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/convention"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Ouvrir
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
