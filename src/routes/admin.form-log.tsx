import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { listFormResponses } from "@/services/form-responses";

export const Route = createFileRoute("/admin/form-log")({
  component: FormLogPage,
});

function FormLogPage() {
  const q = useQuery({
    queryKey: ["form-responses"],
    queryFn: () => listFormResponses(200),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Journal des formulaires étudiants</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Chaque ligne correspond à un envoi du formulaire convention : les champs sont stockés en colonnes
          dans <span className="font-mono">student_submission</span>. Les dossiers en cours restent visibles
          dans « Validations ».
        </p>
      </header>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">Date (UTC)</th>
              <th className="px-3 py-3 text-left">Étudiant</th>
              <th className="px-3 py-3 text-left">Statut</th>
              <th className="px-3 py-3 text-left">Entreprise (saisie)</th>
              <th className="px-3 py-3 text-left">Poste</th>
              <th className="px-3 py-3 text-left">Id</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {q.isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  Impossible de charger le journal (API ou migration SQL 006).
                </td>
              </tr>
            )}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune entrée pour l&apos;instant.
                </td>
              </tr>
            )}
            {(q.data ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-secondary/50">
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.submittedAt}</td>
                <td className="px-3 py-3 font-medium">{row.studentId}</td>
                <td className="px-3 py-3">{row.status}</td>
                <td className="px-3 py-3">
                  {row.record.companyName}
                  {row.record.companyCity ? ` — ${row.record.companyCity}` : ""}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{row.record.position}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
