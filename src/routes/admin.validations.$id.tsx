import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { getSubmission, reviewSubmission } from "@/services/students";
import { reviewDecisionToastMessage } from "@/lib/review-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { SubmissionEmailBodyField } from "@/components/SubmissionEmailBodyField";

export const Route = createFileRoute("/admin/validations/$id")({
  component: ValidationDetail,
});

function ValidationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["submission-id", id], queryFn: () => getSubmission(id) });
  const [emailBody, setEmailBody] = useState("");

  const review = useMutation({
    mutationFn: (status: "approved" | "changes_requested" | "rejected") =>
      reviewSubmission(id, {
        status,
        emailBody: status === "approved" ? undefined : emailBody.trim(),
      }),
    onSuccess: (s) => {
      toast.success(reviewDecisionToastMessage(s));
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
    <div className="mx-auto max-w-4xl space-y-6">
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
          <SubmissionEmailBodyField
            submissionId={id}
            value={emailBody}
            onChange={setEmailBody}
            enabled
          />
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button
              onClick={() => review.mutate("approved")}
              disabled={review.isPending}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              Approuver
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!emailBody.trim()) {
                  toast.error("Le corps du message e-mail est obligatoire.");
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
                if (!emailBody.trim()) {
                  toast.error("Le corps du message e-mail est obligatoire.");
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
