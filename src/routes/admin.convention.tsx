import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Eye, FilePenLine, FileText, Loader2, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import {
  checkConventionExists,
  generateConvention,
  getDocuSignStatus,
  sendConventionToDocuSign,
} from "@/services/conventions";
import { listStudents, getSubmissionByStudent } from "@/services/students";
import { internshipWeeksBetween } from "@/lib/internship-weeks";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/convention")({
  component: ConventionStagePage,
});

function ConventionStagePage() {
  const [studentId, setStudentId] = useState<string>("");
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [checkingExists, setCheckingExists] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const conventionExistsQ = useQuery({
    queryKey: ["convention-exists", studentId],
    queryFn: () => checkConventionExists(studentId),
    enabled: !!studentId,
  });

  const docusignStatusQ = useQuery({
    queryKey: ["docusign-status"],
    queryFn: getDocuSignStatus,
  });

  useEffect(() => {
    setOverwriteDialogOpen(false);
    setPreviewOpen(false);
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

  const openPreview = () => {
    setPreviewOpen(true);
    setPreviewKey((k) => k + 1);
  };

  const generateM = useMutation({
    mutationFn: (overwrite: boolean) => generateConvention(studentId, overwrite),
    onSuccess: async () => {
      setOverwriteDialogOpen(false);
      await conventionExistsQ.refetch();
      openPreview();
      toast.success("La convention a été générée avec succès.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Échec de la génération.");
    },
  });

  async function handleGenerateClick() {
    if (!studentId) return;
    setCheckingExists(true);
    try {
      const { exists } = await checkConventionExists(studentId);
      if (exists) {
        setOverwriteDialogOpen(true);
        return;
      }
      generateM.mutate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de vérifier l’existant.");
    } finally {
      setCheckingExists(false);
    }
  }

  const docusignM = useMutation({
    mutationFn: () => sendConventionToDocuSign(studentId),
    onSuccess: (data) => {
      toast.success(data.message || "Demande d’envoi DocuSign enregistrée.");
    },
    onError: (err: Error & { code?: string; consentUrl?: string }) => {
      if (err.code === "DOCUSIGN_NOT_CONFIGURED") {
        toast.info(
          "DocuSign n’est pas configuré. Vérifiez backend/.env et le fichier private.key à la racine du projet.",
        );
        return;
      }
      if (err.code === "DOCUSIGN_CONSENT_REQUIRED" && err.consentUrl) {
        toast.error(err.message, {
          description: "Ouvrez le lien de consentement DocuSign (première connexion).",
          action: {
            label: "Autoriser DocuSign",
            onClick: () => window.open(err.consentUrl, "_blank", "noopener,noreferrer"),
          },
        });
        return;
      }
      toast.error(err.message || "Échec de l’envoi DocuSign.");
    },
  });

  const generateBusy = checkingExists || generateM.isPending;
  const showPreview = previewOpen && !!studentId;
  const hasConvention = Boolean(conventionExistsQ.data?.exists);

  return (
    <div
      className={cn(
        "flex flex-col gap-6 lg:gap-8",
        showPreview && "xl:flex-row xl:items-start",
      )}
    >
      <div className="min-w-0 flex-1 space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Convention de stage
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Choisissez un étudiant pour préparer et générer sa convention. Les informations de référence
          (programme, durée, identifiant) s&apos;affichent dès la sélection.
        </p>
      </header>

      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm sm:p-8",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary",
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1 space-y-3">
            <Label htmlFor="convention-student" className="text-sm font-medium text-foreground">
              Étudiant
            </Label>
            <StudentPickerCombobox
              id="convention-student"
              students={students}
              value={studentId}
              onValueChange={setStudentId}
              disabled={studentsQ.isLoading}
            />
            {studentsQ.isError && (
              <p className="text-sm text-destructive">Impossible de charger la liste des étudiants.</p>
            )}
          </div>

          <div
            className={cn(
              "flex min-w-[min(100%,20rem)] flex-col justify-center rounded-xl border border-primary/15 bg-secondary/60 p-5 lg:w-80",
              !studentId && "opacity-60",
            )}
            aria-live="polite"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
              Fiche de référence
            </p>
            {studentId ? (
              <dl className="space-y-4">
                <InfoChip label="N° étudiant (Student ID)" value={studentId} mono />
                <InfoChip label="Class level / Programme" value={classLevel} />
                <InfoChip
                  label="Nombre de semaines de stage"
                  value={submissionQ.isLoading ? "Chargement…" : weeksDisplay}
                  highlight
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sélectionnez un étudiant pour afficher son identifiant, son programme et la durée de
                stage déclarée.
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
            <h2 className="text-lg font-semibold text-foreground">Génération de la convention</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedStudent
                ? `Prêt pour ${selectedStudent.firstName} ${selectedStudent.lastName} — fusion du modèle Word avec les données plateforme.`
                : "Choisissez d’abord un étudiant."}
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
            Générer la convention
          </Button>

          <AlertDialog open={overwriteDialogOpen} onOpenChange={setOverwriteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Convention déjà générée</AlertDialogTitle>
                <AlertDialogDescription>
                  Une convention a déjà été générée pour cet étudiant. Si vous continuez, la version
                  précédente sera remplacée par la nouvelle. Souhaitez-vous continuer ?
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
          {conventionExistsQ.data?.exists && !previewOpen && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openPreview}
            >
              <Eye className="h-4 w-4" />
              Voir la convention
            </Button>
          )}
          {hasConvention && (
            <DocuSignSendButton
              hasConvention={hasConvention}
              configured={docusignStatusQ.data?.configured}
              pending={docusignM.isPending}
              onSend={() => docusignM.mutate()}
              compact
            />
          )}
        </div>
      </section>
      </div>

      {showPreview && (
        <aside
          className={cn(
            "flex w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-primary/25 bg-card shadow-lg",
            "max-h-[min(85vh,52rem)] xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:max-h-[calc(100vh-3rem)]",
            "xl:w-[min(100%,28rem)] 2xl:w-[32rem]",
          )}
          aria-label="Aperçu de la convention"
        >
          <div className="flex items-start justify-between gap-3 border-b border-primary/15 bg-primary/5 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Aperçu</p>
              <h2 className="text-base font-semibold text-foreground">Convention de stage</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {selectedStudent
                  ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
                  : studentId}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              aria-label="Fermer l'aperçu"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DocuSignSendButton
            hasConvention={hasConvention}
            configured={docusignStatusQ.data?.configured}
            pending={docusignM.isPending}
            onSend={() => docusignM.mutate()}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <ConventionDocxPreview
              studentId={studentId}
              refreshKey={previewKey}
              layout="sidebar"
            />
          </div>
        </aside>
      )}
    </div>
  );
}

function DocuSignSendButton({
  hasConvention,
  configured,
  pending,
  onSend,
  compact = false,
}: {
  hasConvention: boolean;
  configured?: boolean;
  pending: boolean;
  onSend: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(!compact && "border-b border-border px-3 py-2.5 sm:px-4")}>
      <Button
        type="button"
        variant={compact ? "outline" : "secondary"}
        className={cn("gap-2", compact ? "w-full" : "w-full")}
        size={compact ? "default" : "default"}
        disabled={!hasConvention || pending}
        onClick={onSend}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FilePenLine className="h-4 w-4" />
        )}
        Envoyer pour signature (DocuSign)
      </Button>
      {!configured && (
        <p
          className={cn(
            "text-muted-foreground",
            compact ? "mt-2 text-center text-xs" : "mt-1.5 text-center text-[11px]",
          )}
        >
          Connexion DocuSign à configurer sur le serveur
        </p>
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
