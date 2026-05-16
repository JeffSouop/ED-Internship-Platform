import type { StudentSubmission } from "@/lib/types";

export type SubmissionDecisionResponse = StudentSubmission & {
  companyInviteEmail?: {
    sent: boolean;
    error?: string;
    skippedReason?: string;
  };
};

export function reviewDecisionToastMessage(s: SubmissionDecisionResponse): string {
  const base = `Décision enregistrée : ${s.status}`;
  if (s.status !== "approved" || !s.companyInviteEmail) return base;

  const mail = s.companyInviteEmail;
  if (mail.sent) return `${base} — e-mail envoyé à l’entreprise.`;
  if (mail.error) return `${base} — e-mail entreprise non envoyé (${mail.error}).`;
  if (mail.skippedReason === "no_company_email") {
    return `${base} — pas d’e-mail entreprise sur la fiche étudiant.`;
  }
  if (mail.skippedReason === "invalid_email") {
    return `${base} — e-mail entreprise invalide.`;
  }
  if (mail.skippedReason === "brevo_not_configured") {
    return `${base} — Brevo non configuré (BREVO_API_KEY / BREVO_SENDER_EMAIL).`;
  }
  return `${base} — e-mail entreprise non envoyé.`;
}
