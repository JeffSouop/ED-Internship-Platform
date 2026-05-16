import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Loader2, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { ConventionDocxPreview } from "@/components/ConventionDocxPreview";
import { StudentPickerCombobox } from "@/components/StudentPickerCombobox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  rupturePreviewUrl,
  checkRuptureExists,
  downloadRupture,
  generateRupture,
  listRuptures,
} from "@/services/ruptures";
import { listStudents, getSubmissionByStudent } from "@/services/students";
import { internshipWeeksBetween } from "@/lib/internship-weeks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/rupture")({
  component: RuptureStagePage,
});

function formatDateTime(iso: string): string {
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

function RuptureStagePage() {
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [checkingExists, setCheckingExists] = useState(false);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const ruptureExistsQ = useQuery({
    queryKey: ["rupture-exists", studentId],
    queryFn: () => checkRuptureExists(studentId),
    enabled: !!studentId,
  });

  const rupturesListQ = useQuery({
    queryKey: ["ruptures-list"],
    queryFn: listRuptures,
  });

  useEffect(() => {
    setOverwriteDialogOpen(false);
    if (!studentId) setPreviewStudentId(null);
  }, [studentId]);

  const studentsQ = useQuery({ queryKey: ["students"], queryFn: listStudents });
  const submissionQ = useQuery({
    queryKey: ["submission-by-student", studentId],
    queryFn: () => getSubmissionByStudent(studentId),
    enabled: !!studentId,
  });

  const students = useMemo(() => {
    const list = studentsQ.data ?? [];
    return [...list].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"),
    );
  }, [studentsQ.data]);

  const selectedStudent = students.find((s) => s.id === studentId);
  const previewRow = rupturesListQ.data?.rows.find((r) => r.studentId === previewStudentId);
  const previewStudent =
    students.find((s) => s.id === previewStudentId) ??
    (previewRow
      ? {
          id: previewRow.studentId,
          firstName: previewRow.studentName.split(" ")[0] ?? "",
          lastName: previewRow.studentName.split(" ").slice(1).join(" ") ?? previewRow.studentName,
        }
      : null);

  const submission = submissionQ.data;
  const classLevel =
    submission?.programmeInputLabel?.trim() ||
    submission?.student.programme ||
    selectedStudent?.programme ||
    "—";
  const weeksCount =
    submission?.startDate && submission?.endDate
      ? internshipWeeksBetween(submission.startDate, submission.endDate)
      : null;
  const weeksDisplay =
    weeksCount !== null ? `${weeksCount} semaine${weeksCount > 1 ? "s" : ""}` : "—";

  const openPreview = (id: string) => {
    setPreviewStudentId(id);
    setPreviewKey((k) => k + 1);
  };

  const generateM = useMutation({
    mutationFn: (overwrite: boolean) => generateRupture(studentId, overwrite),
    onSuccess: async () => {
      setOverwriteDialogOpen(false);
      await ruptureExistsQ.refetch();
      void queryClient.invalidateQueries({ queryKey: ["ruptures-list"] });
      openPreview(studentId);
      toast.success("La rupture de stage a été générée avec succès.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Échec de la génération.");
    },
  });

  async function handleGenerateClick() {
    if (!studentId) return;
    setCheckingExists(true);
    try {
      const { exists } = await checkRuptureExists(studentId);
      if (exists) {
        setOverwriteDialogOpen(true);
        return;
      }
      generateM.mutate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de vérifier l'existant.");
    } finally {
      setCheckingExists(false);
    }
  }

  async function handleDownload(id: string) {
    setDownloadingId(id);
    try {
      await downloadRupture(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setDownloadingId(null);
    }
  }

  const generateBusy = checkingExists || generateM.isPending;
  const showPreview = !!previewStudentId;
  const hasRupture = Boolean(ruptureExistsQ.data?.exists);
  const listRows = rupturesListQ.data?.rows ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-8 lg:gap-10",
        showPreview && "xl:flex-row xl:items-start",
      )}
    >
      <div className="min-w-0 flex-1 space-y-10">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Rupture de stage
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sélectionnez un étudiant pour générer sa rupture de stage Word. Les fichiers sont enregistrés
            dans le dossier <code className="rounded bg-muted px-1">rupture/</code> à la racine du
            projet.
          </p>
        </header>

        <section
          className={cn(
            "relative overflow-visible rounded-2xl border border-primary/20 bg-card p-6 shadow-sm sm:p-8",
            "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary",
          )}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1 space-y-3">
              <Label htmlFor="rupture-student" className="text-sm font-medium text-foreground">
                Étudiant
              </Label>
              <StudentPickerCombobox
                id="rupture-student"
                students={students}
                value={studentId}
                onValueChange={setStudentId}
                disabled={studentsQ.isLoading}
              />
            </div>
            <div
              className={cn(
                "flex min-w-[min(100%,20rem)] flex-col justify-center rounded-xl border border-primary/15 bg-secondary/60 p-5 lg:w-80",
                !studentId && "opacity-60",
              )}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                Fiche de référence
              </p>
              {studentId ? (
                <dl className="space-y-4">
                  <InfoChip label="N° étudiant" value={studentId} mono />
                  <InfoChip label="Programme" value={classLevel} />
                  <InfoChip
                    label="Durée du stage"
                    value={submissionQ.isLoading ? "Chargement…" : weeksDisplay}
                    highlight
                  />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un étudiant pour afficher ses informations de référence.
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          className={cn(
            "rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center transition-opacity",
            studentId ? "opacity-100" : "pointer-events-none opacity-40",
          )}
        >
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Génération de la rupture de stage</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedStudent
                  ? `Prêt pour ${selectedStudent.firstName} ${selectedStudent.lastName}.`
                  : "Choisissez d'abord un étudiant."}
              </p>
            </div>
            <Button
              type="button"
              className="gap-2"
              size="lg"
              disabled={!studentId || generateBusy}
              onClick={() => void handleGenerateClick()}
            >
              {generateBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Générer l&apos;rupture
            </Button>
            <AlertDialog open={overwriteDialogOpen} onOpenChange={setOverwriteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rupture de stage déjà générée</AlertDialogTitle>
                  <AlertDialogDescription>
                    Une rupture de stage existe déjà pour cet étudiant. La version précédente sera
                    remplacée si vous continuez.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={generateM.isPending}>Annuler</AlertDialogCancel>
                  <Button
                    type="button"
                    disabled={generateM.isPending}
                    onClick={() => generateM.mutate(true)}
                  >
                    {generateM.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continuer et remplacer
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {hasRupture && previewStudentId !== studentId && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => openPreview(studentId)}
              >
                <Eye className="h-4 w-4" />
                Voir la rupture de stage
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Ruptures de stage générées</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {listRows.length} document{listRows.length !== 1 ? "s" : ""} enregistré
              {listRows.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Étudiant</th>
                  <th className="px-4 py-3 text-left">Entreprise</th>
                  <th className="px-4 py-3 text-left">Générée le</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rupturesListQ.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!rupturesListQ.isLoading && listRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Aucune rupture de stage générée pour le moment.
                    </td>
                  </tr>
                )}
                {listRows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.studentName}</p>
                      <p className="text-xs text-muted-foreground">{row.studentId}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.companyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(row.generatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openPreview(row.studentId)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Voir
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-1.5"
                          disabled={downloadingId === row.studentId}
                          onClick={() => void handleDownload(row.studentId)}
                        >
                          {downloadingId === row.studentId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Télécharger
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showPreview && previewStudentId && (
        <aside
          className={cn(
            "flex w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-primary/25 bg-card shadow-lg",
            "max-h-[min(85vh,52rem)] xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:max-h-[calc(100vh-3rem)]",
            "xl:w-[min(100%,28rem)] 2xl:w-[32rem]",
          )}
          aria-label="Aperçu de la rupture de stage"
        >
          <div className="flex items-start justify-between gap-3 border-b border-primary/15 bg-primary/5 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Aperçu</p>
              <h2 className="text-base font-semibold text-foreground">Rupture de stage</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {previewStudent
                  ? `${previewStudent.firstName} ${previewStudent.lastName}`.trim() ||
                    previewStudentId
                  : previewStudentId}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              aria-label="Fermer l'aperçu"
              onClick={() => setPreviewStudentId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="border-b border-border px-3 py-2 sm:px-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={downloadingId === previewStudentId}
              onClick={() => void handleDownload(previewStudentId)}
            >
              {downloadingId === previewStudentId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Télécharger
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <ConventionDocxPreview
              studentId={previewStudentId}
              refreshKey={previewKey}
              layout="sidebar"
              previewPath={rupturePreviewUrl}
              loadingLabel="Chargement de la rupture de stage…"
              errorFallback="Impossible d'afficher la rupture de stage."
            />
          </div>
        </aside>
      )}
    </div>
  );
}

function InfoChip({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <UserRound className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 text-sm font-semibold text-foreground",
            mono && "font-mono text-xs tracking-wide",
            highlight && "text-primary",
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
