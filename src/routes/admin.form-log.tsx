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
        <h1 className="text-2xl font-semibold tracking-tight">Journal des formulaires</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Copie brute de chaque envoi du formulaire convention (validé ou non). Les dossiers officiels
          sont toujours pilotés via « Validations » et les statuts dans la table des soumissions ; cette
          liste sert à l&apos;audit et à la traçabilité complète des réponses reçues.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Date (UTC)</th>
              <th className="px-4 py-3 text-left">Numéro étudiant</th>
              <th className="px-4 py-3 text-left">Soumission liée</th>
              <th className="px-4 py-3 text-left">Id journal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {q.isError && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-destructive">
                  Impossible de charger le journal (vérifiez la connexion à l&apos;API et que la migration
                  SQL a été appliquée).
                </td>
              </tr>
            )}
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune entrée pour l&apos;instant.
                </td>
              </tr>
            )}
            {(q.data ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.createdAt}</td>
                <td className="px-4 py-3 font-medium">{row.studentIdText}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {row.submissionId ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
