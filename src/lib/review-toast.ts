import type { StudentSubmission } from "@/lib/types";

export type SubmissionDecisionResponse = StudentSubmission & {
  companyInviteEmail?: {
    sent: boolean;
    error?: string;
    skippedReason?: string;
  };
  studentDecisionEmail?: {
    sent: boolean;
    error?: string;
    skippedReason?: string;
  };
};

function emailSkipLabel(reason?: string): string {
  switch (reason) {
    case "no_company_email":
      return "pas d’e-mail entreprise sur la fiche";
    case "no_student_email":
      return "pas d’e-mail école sur la fiche étudiant";
    case "invalid_email":
      return "adresse e-mail invalide";
    case "brevo_not_configured":
      return "Brevo non configuré";
    case "no_token":
      return "impossible de générer le lien étudiant";
    default:
      return reason ?? "envoi impossible";
  }
}

export function reviewDecisionToastMessage(s: SubmissionDecisionResponse): string {
  const base = `Décision enregistrée : ${s.status}`;
  const parts: string[] = [base];

  if (s.status === "approved" && s.companyInviteEmail) {
    const mail = s.companyInviteEmail;
    if (mail.sent) parts.push("e-mail entreprise envoyé");
    else if (mail.error) parts.push(`e-mail entreprise : ${mail.error}`);
    else parts.push(`e-mail entreprise : ${emailSkipLabel(mail.skippedReason)}`);
  }

  if (
    (s.status === "changes_requested" || s.status === "rejected") &&
    s.studentDecisionEmail
  ) {
    const mail = s.studentDecisionEmail;
    if (mail.sent) parts.push("e-mail étudiant envoyé");
    else if (mail.error) parts.push(`e-mail étudiant : ${mail.error}`);
    else parts.push(`e-mail étudiant : ${emailSkipLabel(mail.skippedReason)}`);
  }

  return parts.join(" — ");
}
