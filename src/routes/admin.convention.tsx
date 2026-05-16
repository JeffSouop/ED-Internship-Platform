import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Loader2, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

import { downloadConvention } from "@/services/conventions";
import { listStudents, getSubmissionByStudent } from "@/services/students";
import { internshipWeeksBetween } from "@/lib/internship-weeks";
import { StudentPickerCombobox } from "@/components/StudentPickerCombobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/convention")({
  component: ConventionStagePage,
});

function ConventionStagePage() {
  const [studentId, setStudentId] = useState<string>("");

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

  const generateM = useMutation({
    mutationFn: () => downloadConvention(studentId),
    onSuccess: () => {
      toast.success("Convention téléchargée.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Échec de la génération.");
    },
  });

  return (
    <div className="space-y-8">
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
            disabled={!studentId || generateM.isPending}
            onClick={() => generateM.mutate()}
          >
            {generateM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Générer la convention
          </Button>
          <p className="text-xs text-muted-foreground">
            Modèle Modele2025ConventiondestageFPADv0.11.docx — téléchargement .docx.
          </p>
        </div>
      </section>
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
