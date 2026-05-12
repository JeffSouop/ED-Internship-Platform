import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getSubmission, reviewSubmission } from "@/services/students";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function internshipWeeksLabel(startIso: string, endIso: string): string {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
  const ms = b.getTime() - a.getTime();
  const weeks = Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  return `${weeks} semaine${weeks > 1 ? "s" : ""}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

type Props = {
  submissionId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function SubmissionReviewDialog({ submissionId, onOpenChange }: Props) {
  const open = submissionId !== null;
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["submission-id", submissionId],
    queryFn: () => getSubmission(submissionId!),
    enabled: open && !!submissionId,
  });

  useEffect(() => {
    if (!open) setComment("");
  }, [open, submissionId]);

  const review = useMutation({
    mutationFn: (status: "approved" | "changes_requested" | "rejected") =>
      reviewSubmission(submissionId!, { status, comment: comment.trim() || undefined }),
    onSuccess: (s) => {
      toast.success(`Décision enregistrée : ${s.status}`);
      qc.invalidateQueries({ queryKey: ["submission-id", submissionId] });
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = q.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="overflow-y-auto px-6 pb-4 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <DialogTitle className="text-xl">Validation de stage</DialogTitle>
                <DialogDescription className="mt-1">
                  Détails de la demande — vous restez sur la liste des validations.
                </DialogDescription>
              </div>
              {s && <StatusBadge status={s.status} />}
            </div>
            {s && (
              <p className="text-sm font-medium text-foreground">
                {s.student.firstName} {s.student.lastName} — {s.student.programme} ·{" "}
                {s.student.promotion}
              </p>
            )}
          </DialogHeader>

          {q.isLoading && (
            <p className="py-8 text-sm text-muted-foreground">Chargement des informations…</p>
          )}
          {q.isError && (
            <p className="py-8 text-sm text-destructive">Impossible de charger cette soumission.</p>
          )}
          {s && (
            <div className="mt-4 space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Étudiant & stage
                </h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                  <DetailRow
                    label="Nom de l'étudiant"
                    value={`${s.student.firstName} ${s.student.lastName}`}
                  />
                  <DetailRow label="Identifiant étudiant" value={s.studentId} />
                  <DetailRow
                    label="Formation / promotion"
                    value={`${s.student.programme} · ${s.student.promotion}`}
                  />
                  <DetailRow label="Campus" value={s.student.campus} />
                  <DetailRow
                    label="Email étudiant"
                    value={
                      <a className="text-primary underline" href={`mailto:${s.student.email}`}>
                        {s.student.email}
                      </a>
                    }
                  />
                  <DetailRow
                    label="Téléphone"
                    value={s.student.phone?.trim() ? s.student.phone : "—"}
                  />
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Entreprise d'accueil
                </h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                  <DetailRow label="Raison sociale" value={s.companyName} />
                  <DetailRow label="Pays" value={s.companyCountry} />
                  <DetailRow
                    label="Ville (déclaration)"
                    value={s.companyCity?.trim() ? s.companyCity : "—"}
                  />
                  <DetailRow
                    label="Email du tuteur / contact"
                    value={
                      <a className="text-primary underline" href={`mailto:${s.tutorEmail}`}>
                        {s.tutorEmail}
                      </a>
                    }
                  />
                  <DetailRow label="Tuteur en entreprise" value={s.tutorName} />
                  <DetailRow label="Intitulé du poste" value={s.position} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Période
                </h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                  <DetailRow label="Date de début" value={s.startDate} />
                  <DetailRow label="Date de fin" value={s.endDate} />
                  <DetailRow
                    label="Durée estimée"
                    value={internshipWeeksLabel(s.startDate, s.endDate)}
                  />
                  <DetailRow
                    label="Soumis le"
                    value={new Date(s.submittedAt).toLocaleString("fr-FR")}
                  />
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Missions
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{s.missions}</p>
              </section>

              {s.reviewerComment && (
                <section className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Dernier commentaire</p>
                  <p className="mt-1 text-sm">{s.reviewerComment}</p>
                </section>
              )}

              <section className="space-y-2 border-t border-border pt-4">
                <Label className="text-xs font-medium text-muted-foreground">
                  Commentaire (obligatoire pour « Modifications » ou « Refus »)
                </Label>
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ex. : merci de préciser les missions confiées."
                />
              </section>
            </div>
          )}
        </div>

        {s && (
          <DialogFooter className="flex-shrink-0 flex-col gap-3 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (!comment.trim()) {
                    toast.error("Un commentaire est requis pour refuser.");
                    return;
                  }
                  review.mutate("rejected");
                }}
                disabled={review.isPending}
              >
                Refuser
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!comment.trim()) {
                    toast.error("Un commentaire est requis pour demander des modifications.");
                    return;
                  }
                  review.mutate("changes_requested");
                }}
                disabled={review.isPending}
              >
                Demander des modifications
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => review.mutate("approved")}
                disabled={review.isPending}
              >
                Approuver
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
