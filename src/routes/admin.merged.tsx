import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { listMerged } from "@/services/merged";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTAKES, type Intake, type MergedInternship } from "@/lib/types";

export const Route = createFileRoute("/admin/merged")({
  component: MergedPage,
});

function MergedPage() {
  const q = useQuery({ queryKey: ["merged"], queryFn: listMerged });
  const [intake, setIntake] = useState<Intake | "all">("all");
  const [status, setStatus] = useState<"all" | MergedInternship["status"]>("all");

  const rows = useMemo(() => {
    return (q.data ?? []).filter(
      (m) =>
        (intake === "all" || m.intake === intake) &&
        (status === "all" || m.status === status),
    );
  }, [q.data, intake, status]);

  const labels: Record<MergedInternship["status"], string> = {
    matched: "Apparié",
    student_only: "Étudiant seul",
    company_only: "Entreprise seule",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stages fusionnés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jointure entre soumissions étudiants approuvées et déclarations entreprises (clé :
            studentId).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Select value={intake} onValueChange={(v) => setIntake(v as Intake | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Rentrée" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les rentrées</SelectItem>
                {INTAKES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as MergedInternship["status"] | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="matched">Apparié</SelectItem>
                <SelectItem value="student_only">Étudiant seul</SelectItem>
                <SelectItem value="company_only">Entreprise seule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => exportCsv(rows)}>
            Exporter CSV
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Étudiant</th>
              <th className="px-4 py-3 text-left">Entreprise</th>
              <th className="px-4 py-3 text-left">Période</th>
              <th className="px-4 py-3 text-left">Rentrée</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => (
              <tr key={`${m.studentId}-${m.intake}`} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {m.student
                      ? `${m.student.firstName} ${m.student.lastName}`
                      : "Étudiant inconnu"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{m.studentId}</p>
                </td>
                <td className="px-4 py-3">
                  {m.company ? (
                    <>
                      <p>{m.company.name}</p>
                      <p className="text-xs text-muted-foreground">{m.company.country}</p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.studentSubmission
                    ? `${m.studentSubmission.startDate} → ${m.studentSubmission.endDate}`
                    : m.declaredIntern
                      ? `${m.declaredIntern.startDate} → ${m.declaredIntern.endDate}`
                      : "—"}
                </td>
                <td className="px-4 py-3">{m.intake}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "matched"
                        ? "bg-success-muted text-success-muted-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {labels[m.status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun résultat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function exportCsv(rows: MergedInternship[]) {
  const header = [
    "studentId",
    "studentName",
    "companyName",
    "companyCountry",
    "intake",
    "status",
    "startDate",
    "endDate",
    "position",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) => {
      const period = r.studentSubmission ?? r.declaredIntern;
      return [
        r.studentId,
        r.student ? `${r.student.firstName} ${r.student.lastName}` : "",
        r.company?.name ?? "",
        r.company?.country ?? "",
        r.intake,
        r.status,
        period?.startDate ?? "",
        period?.endDate ?? "",
        period && "position" in period ? period.position : "",
      ]
        .map((v) => JSON.stringify(v ?? ""))
        .join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stages-fusionnes.csv";
  a.click();
  URL.revokeObjectURL(url);
}
