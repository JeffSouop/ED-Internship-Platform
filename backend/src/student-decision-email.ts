import type pg from "pg";

import type { StudentSubmission } from "./contracts.js";
import { getPublicAppUrl } from "./app-url.js";
import { isBrevoConfigured, sendBrevoEmail } from "./brevo-mail.js";
import { getOrCreateStudentAccessToken } from "./student-access-token.js";

export type StudentDecisionEmailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "no_student_email" | "brevo_not_configured" | "invalid_email" | "no_token" };

const CAREER_SIGNATURE = {
  department: "Career Development & Partnership",
  school: "Ecole Ducasse, Paris Campus",
  address: "16 Avenue du Maréchal Juin, 92360 MEUDON",
  email: process.env.CAREER_CONTACT_EMAIL?.trim() || "edpc.career@ecoleducasse.com",
  phone: process.env.CAREER_CONTACT_PHONE?.trim() || "+ 33 (0)1 34 34 19 08",
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Toujours l’e-mail École Ducasse (compte étudiant), jamais l’e-mail personnel. */
function studentRecipientEmail(submission: StudentSubmission): string | null {
  return submission.student.email?.trim() || null;
}

function studentDisplayName(submission: StudentSubmission): string {
  return `${submission.student.firstName} ${submission.student.lastName}`.trim();
}

function signatureBlockText(): string {
  return [
    CAREER_SIGNATURE.department,
    CAREER_SIGNATURE.school,
    CAREER_SIGNATURE.address,
    CAREER_SIGNATURE.email,
    `T: ${CAREER_SIGNATURE.phone}`,
  ].join("\n");
}

function signatureBlockHtml(): string {
  return `
<p style="margin-top:24px">
  ${escapeHtml(CAREER_SIGNATURE.department)}<br/>
  ${escapeHtml(CAREER_SIGNATURE.school)}<br/>
  ${escapeHtml(CAREER_SIGNATURE.address)}<br/>
  <a href="mailto:${escapeHtml(CAREER_SIGNATURE.email)}">${escapeHtml(CAREER_SIGNATURE.email)}</a><br/>
  T: ${escapeHtml(CAREER_SIGNATURE.phone)}
</p>`.trim();
}

function commentBlockHtml(comment: string): string {
  return `
<div style="margin:16px 0;padding:14px 16px;background:#f4f6f8;border-left:4px solid #1e3a5f;border-radius:4px">
  <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;color:#555">Commentaire de l'équipe carrière / Career team comment</p>
  <p style="margin:0;white-space:pre-wrap">${escapeHtml(comment.trim())}</p>
</div>`.trim();
}

export function buildStudentChangesRequestedEmail(
  submission: StudentSubmission,
  reviewerComment: string,
  formUrl: string,
): { subject: string; htmlContent: string; textContent: string } {
  const studentName = studentDisplayName(submission);
  const subject = `[ECOLE DUCASSE] Demande de modification — stage — ${studentName}`;

  const frBody = `Bonjour ${studentName},

Votre demande de stage a été examinée par notre équipe carrière. Des modifications sont nécessaires avant validation.

Commentaire de l'équipe carrière :
${reviewerComment.trim()}

Merci de mettre à jour votre formulaire de stage en cliquant sur le lien ci-dessous :
${formUrl}

Cordialement,`;

  const enBody = `Dear ${studentName},

Your internship request has been reviewed by our career team. Changes are required before we can validate your application.

Career team comment:
${reviewerComment.trim()}

Please update your internship form using the link below:
${formUrl}

Best regards,`;

  const textContent = [frBody, "", signatureBlockText(), "", "_".repeat(80), "", enBody, "", signatureBlockText()].join(
    "\n",
  );

  const htmlContent = `
<p>Bonjour ${escapeHtml(studentName)},</p>
<p>Votre demande de stage a été examinée par notre équipe carrière. <strong>Des modifications sont nécessaires</strong> avant validation.</p>
${commentBlockHtml(reviewerComment)}
<p>Merci de mettre à jour votre formulaire de stage en cliquant sur le lien ci-dessous :</p>
<p><a href="${escapeHtml(formUrl)}" style="color:#1e3a5f;font-weight:600">${escapeHtml(formUrl)}</a></p>
${signatureBlockHtml()}
<hr style="margin:32px 0;border:none;border-top:1px solid #ccc" />
<p>Dear ${escapeHtml(studentName)},</p>
<p>Your internship request has been reviewed by our career team. <strong>Changes are required</strong> before we can validate your application.</p>
${commentBlockHtml(reviewerComment)}
<p>Please update your internship form using the link below:</p>
<p><a href="${escapeHtml(formUrl)}" style="color:#1e3a5f;font-weight:600">${escapeHtml(formUrl)}</a></p>
${signatureBlockHtml()}
`.trim();

  return { subject, htmlContent, textContent };
}

export function buildStudentRejectedEmail(
  submission: StudentSubmission,
  reviewerComment: string,
): { subject: string; htmlContent: string; textContent: string } {
  const studentName = studentDisplayName(submission);
  const subject = `[ECOLE DUCASSE] Demande de stage — refusée — ${studentName}`;

  const frBody = `Bonjour ${studentName},

Après examen de votre dossier, notre équipe carrière ne peut pas valider votre demande de stage en l'état.

Commentaire de l'équipe carrière :
${reviewerComment.trim()}

Pour toute question, vous pouvez nous contacter à ${CAREER_SIGNATURE.email}.

Cordialement,`;

  const enBody = `Dear ${studentName},

After reviewing your file, our career team is unable to approve your internship request at this time.

Career team comment:
${reviewerComment.trim()}

If you have any questions, please contact us at ${CAREER_SIGNATURE.email}.

Best regards,`;

  const textContent = [frBody, "", signatureBlockText(), "", "_".repeat(80), "", enBody, "", signatureBlockText()].join(
    "\n",
  );

  const htmlContent = `
<p>Bonjour ${escapeHtml(studentName)},</p>
<p>Après examen de votre dossier, notre équipe carrière <strong>ne peut pas valider</strong> votre demande de stage en l'état.</p>
${commentBlockHtml(reviewerComment)}
<p>Pour toute question, vous pouvez nous contacter à <a href="mailto:${escapeHtml(CAREER_SIGNATURE.email)}">${escapeHtml(CAREER_SIGNATURE.email)}</a>.</p>
${signatureBlockHtml()}
<hr style="margin:32px 0;border:none;border-top:1px solid #ccc" />
<p>Dear ${escapeHtml(studentName)},</p>
<p>After reviewing your file, our career team is <strong>unable to approve</strong> your internship request at this time.</p>
${commentBlockHtml(reviewerComment)}
<p>If you have any questions, please contact us at <a href="mailto:${escapeHtml(CAREER_SIGNATURE.email)}">${escapeHtml(CAREER_SIGNATURE.email)}</a>.</p>
${signatureBlockHtml()}
`.trim();

  return { subject, htmlContent, textContent };
}

export function decisionEmailSubject(
  submission: StudentSubmission,
  decision: "changes_requested" | "rejected",
): string {
  const studentName = studentDisplayName(submission);
  return decision === "changes_requested"
    ? `[ECOLE DUCASSE] Demande de modification — stage — ${studentName}`
    : `[ECOLE DUCASSE] Demande de stage — refusée — ${studentName}`;
}

/** Convertit le corps saisi (texte brut) en HTML lisible dans Outlook / Gmail. */
function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const paragraphs = normalized.split(/\n{2,}/);
  const blocks: string[] = [];

  for (const raw of paragraphs) {
    const para = raw.trim();
    if (!para) continue;

    if (/^_+$/.test(para)) {
      blocks.push('<hr style="margin:28px 0;border:none;border-top:1px solid #d0d5dd" />');
      continue;
    }

    const lines = para.split("\n").map((line) => {
      const escaped = escapeHtml(line);
      return escaped.replace(
        /(https?:\/\/[^\s<&]+)/gi,
        '<a href="$1" style="color:#1e3a5f;font-weight:600">$1</a>',
      );
    });

    blocks.push(
      `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222222">${lines.join("<br />")}</p>`,
    );
  }

  return `<div style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif">${blocks.join("")}</div>`;
}

/** Modèle texte complet prérempli (modifiable par l’admin avant envoi). */
export async function getStudentDecisionEmailDraft(
  pool: pg.Pool,
  submission: StudentSubmission,
  decision: "changes_requested" | "rejected",
): Promise<{ subject: string; body: string }> {
  if (decision === "changes_requested") {
    const token = await getOrCreateStudentAccessToken(pool, submission.studentId);
    const formUrl = token
      ? `${getPublicAppUrl()}/student/${token}`
      : `${getPublicAppUrl()}/student/`;
    const { subject, textContent } = buildStudentChangesRequestedEmail(submission, "", formUrl);
    return { subject, body: textContent };
  }

  const { subject, textContent } = buildStudentRejectedEmail(submission, "");
  return { subject, body: textContent };
}

/** Envoie le corps exact saisi dans l’interface admin. */
export async function sendStudentDecisionEmailWithBody(
  pool: pg.Pool,
  submission: StudentSubmission,
  decision: "changes_requested" | "rejected",
  emailBody: string,
): Promise<StudentDecisionEmailResult> {
  const email = studentRecipientEmail(submission)?.toLowerCase();
  if (!email) return { sent: false, reason: "no_student_email" };
  if (!isValidEmail(email)) return { sent: false, reason: "invalid_email" };
  if (!isBrevoConfigured()) return { sent: false, reason: "brevo_not_configured" };

  const body = emailBody.trim();
  const subject = decisionEmailSubject(submission, decision);

  const result = await sendBrevoEmail({
    to: [{ email, name: studentDisplayName(submission) }],
    subject,
    htmlContent: plainTextToHtml(body),
    textContent: body,
  });

  return { sent: true, messageId: result.messageId };
}
