import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { getSubmission, reviewSubmission } from "@/services/students";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/validations/$id")({
  component: ValidationDetail,
});

function ValidationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["submission-id", id], queryFn: () => getSubmission(id) });
  const [comment, setComment] = useState("");

  const review = useMutation({
    mutationFn: (status: "approved" | "changes_requested" | "rejected") =>
      reviewSubmission(id, { status, comment: comment.trim() || undefined }),
    onSuccess: (s) => {
      toast.success(`Décision enregistrée : ${s.status}`);
      qc.invalidateQueries({ queryKey: ["submission-id", id] });
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      navigate({ to: "/admin/validations" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Soumission introuvable.</p>;

  const s = q.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/admin/validations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {s.student.firstName} {s.student.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {s.studentId} · {s.student.programme} · Promotion {s.student.promotion}
          </p>
        </div>
        <StatusBadge status={s.status} />
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stage déclaré
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row label="Entreprise" value={`${s.companyName} (${s.companyCountry})`} />
          <Row
            label="Ville"
            value={s.companyCity?.trim() ? s.companyCity : "—"}
          />
          <Row label="Poste" value={s.position} />
          <Row label="Début" value={s.startDate} />
          <Row label="Fin" value={s.endDate} />
          <Row label="Tuteur" value={`${s.tutorName} — ${s.tutorEmail}`} />
          <Row label="Soumis le" value={new Date(s.submittedAt).toLocaleString("fr-FR")} />
        </dl>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Missions</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{s.missions}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Décision
        </h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Commentaire (obligatoire pour Modifications / Refus)
            </Label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex : merci de préciser les missions confiées."
            />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button
              onClick={() => review.mutate("approved")}
              disabled={review.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Approuver
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
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
