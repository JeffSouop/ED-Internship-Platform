import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SubmissionReviewDialog } from "@/components/SubmissionReviewDialog";
import { listSubmissions } from "@/services/students";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import type { SubmissionStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/validations")({
  component: Validations,
});

function Validations() {
  const [filter, setFilter] = useState<"all" | SubmissionStatus>("pending");
  const [examinerSubmissionId, setExaminerSubmissionId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions });

  const filtered = (q.data ?? []).filter((s) => filter === "all" || s.status === filter);

  const tabs: Array<{ key: typeof filter; label: string }> = [
    { key: "pending", label: "En attente" },
    { key: "changes_requested", label: "Modifications" },
    { key: "approved", label: "Approuvés" },
    { key: "rejected", label: "Refusés" },
    { key: "all", label: "Tous" },
  ];

  return (
    <div className="space-y-6">
      <SubmissionReviewDialog
        submissionId={examinerSubmissionId}
        onOpenChange={(open) => {
          if (!open) setExaminerSubmissionId(null);
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Validations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les dossiers proviennent du formulaire convention unique ; chaque envoi est aussi journalisé
          (menu « Journal formulaires »). Statuez ici : une fois approuvé, le dossier figure parmi les
          conventions validées ; sinon il reste dans les flux « en attente », « modifications » ou « refus ».
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              filter === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Étudiant</th>
              <th className="px-4 py-3 text-left">Entreprise</th>
              <th className="px-4 py-3 text-left">Période</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune soumission.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {s.student.firstName} {s.student.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.studentId}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{s.companyName}</p>
                  <p className="text-xs text-muted-foreground">{s.companyCountry}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.startDate} → {s.endDate}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-primary"
                    onClick={() => setExaminerSubmissionId(s.id)}
                  >
                    Examiner
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
