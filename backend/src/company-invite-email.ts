import type { StudentSubmission } from "./contracts.js";
import { getPublicAppUrl } from "./app-url.js";
import { isBrevoConfigured, sendBrevoEmail } from "./brevo-mail.js";

export type CompanyInviteEmailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "no_company_email" | "brevo_not_configured" | "invalid_email" };

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

/** Lien du formulaire entreprise (plateforme ou URL externe type Microsoft Forms). */
export function getCompanyFormUrl(): string {
  const custom = process.env.COMPANY_FORM_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");
  return `${getPublicAppUrl()}/company`;
}

/** Mot de passe formulaire public entreprise (aligné sur VITE_FORM_ACCESS_PASSWORD côté front). */
export function getCompanyFormAccessPassword(): string {
  return process.env.FORM_ACCESS_PASSWORD?.trim() || "ducasse2026";
}

function formatDateIso(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function studentDisplayName(submission: StudentSubmission): string {
  return `${submission.student.firstName} ${submission.student.lastName}`.trim();
}

function programmeLabel(submission: StudentSubmission): string {
  return (
    submission.programmeInputLabel?.trim() ||
    submission.student.programme?.trim() ||
    "—"
  );
}

function campusLabel(submission: StudentSubmission): string {
  return (
    submission.campusInputLabel?.trim() ||
    submission.student.campus?.trim() ||
    "Ecole Ducasse Paris Campus"
  );
}

function enrollmentPhraseFr(submission: StudentSubmission): string {
  return `actuellement en ${programmeLabel(submission)} au sein de ${campusLabel(submission)}`;
}

function enrollmentPhraseEn(submission: StudentSubmission): string {
  return `currently enrolled in ${programmeLabel(submission)} at ${campusLabel(submission)}`;
}

function dateRangeIso(submission: StudentSubmission): string {
  const start = formatDateIso(submission.startDate);
  const end = formatDateIso(submission.endDate);
  if (start && end) return `entre ${start} et ${end}`;
  if (start) return `à partir du ${start}`;
  return "";
}

function dateRangeEn(submission: StudentSubmission): string {
  const start = formatDateIso(submission.startDate);
  const end = formatDateIso(submission.endDate);
  if (start && end) return `between ${start} and ${end}`;
  if (start) return `from ${start}`;
  return "";
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

export function buildCompanyFormInviteEmail(submission: StudentSubmission): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const studentName = studentDisplayName(submission);
  const companyName = submission.companyName.trim();
  const studentId = submission.studentId.trim();
  const formUrl = getCompanyFormUrl();
  const formPassword = getCompanyFormAccessPassword();
  const datesFr = dateRangeIso(submission);
  const datesEn = dateRangeEn(submission);
  const enrollFr = enrollmentPhraseFr(submission);
  const enrollEn = enrollmentPhraseEn(submission);

  const subject = `[ECOLE DUCASSE] Convention de stage - ${studentName}`;

  const frBody = `Bonjour Madame, Monsieur,

Nous avons été ravis d'apprendre que vous avez répondu favorablement à la demande de stage chez ${companyName} pour notre étudiant(e) ${studentName} (StudentID: ${studentId})${datesFr ? `, ${datesFr}` : ""} ${enrollFr}.

Afin d'éditer sa convention de stage, pourriez-vous remplir notre fiche de renseignement en cliquant sur le lien ci-dessous ?

${formUrl}

Mot de passe d'accès au formulaire : ${formPassword}

Nous vous remercions chaleureusement pour votre soutien et l'accompagnement de nos étudiants cette année.`;

  const enBody = `Dear Sir or Madam,

We are delighted to learn that you have accepted the internship at ${companyName} for our student ${studentName} (StudentID: ${studentId})${datesEn ? `, ${datesEn}` : ""} ${enrollEn}.

In order to issue the internship agreement, kindly complete our information form by clicking on the link below:

${formUrl}

Form access password: ${formPassword}

We would like to express our sincere gratitude for your support and guidance to our students this year.`;

  const textContent = [frBody, "", signatureBlockText(), "", "_".repeat(80), "", enBody, "", signatureBlockText()].join(
    "\n",
  );

  const htmlContent = `
<p>Bonjour Madame, Monsieur,</p>
<p>
  Nous avons été ravis d'apprendre que vous avez répondu favorablement à la demande de stage chez
  <strong>${escapeHtml(companyName)}</strong> pour notre étudiant(e)
  <strong>${escapeHtml(studentName)}</strong> (StudentID: ${escapeHtml(studentId)})${datesFr ? `, ${escapeHtml(datesFr)}` : ""}
  ${escapeHtml(enrollFr)}.
</p>
<p>
  Afin d'éditer sa convention de stage, pourriez-vous remplir notre fiche de renseignement en cliquant sur le lien ci-dessous ?
</p>
<p style="margin:16px 0">
  <a href="${escapeHtml(formUrl)}" style="color:#1e3a5f;font-weight:600">${escapeHtml(formUrl)}</a>
</p>
<p><strong>Mot de passe d'accès au formulaire :</strong> ${escapeHtml(formPassword)}</p>
<p>
  Nous vous remercions chaleureusement pour votre soutien et l'accompagnement de nos étudiants cette année.
</p>
${signatureBlockHtml()}
<hr style="margin:32px 0;border:none;border-top:1px solid #ccc" />
<p>Dear Sir or Madam,</p>
<p>
  We are delighted to learn that you have accepted the internship at
  <strong>${escapeHtml(companyName)}</strong> for our student
  <strong>${escapeHtml(studentName)}</strong> (StudentID: ${escapeHtml(studentId)})${datesEn ? `, ${escapeHtml(datesEn)}` : ""}
  ${escapeHtml(enrollEn)}.
</p>
<p>
  In order to issue the internship agreement, kindly complete our information form by clicking on the link below:
</p>
<p style="margin:16px 0">
  <a href="${escapeHtml(formUrl)}" style="color:#1e3a5f;font-weight:600">${escapeHtml(formUrl)}</a>
</p>
<p><strong>Form access password:</strong> ${escapeHtml(formPassword)}</p>
<p>
  We would like to express our sincere gratitude for your support and guidance to our students this year.
</p>
${signatureBlockHtml()}
`.trim();

  return { subject, htmlContent, textContent };
}

/** Envoie le lien formulaire entreprise à l’e-mail saisi par l’étudiant. */
export async function sendCompanyFormInviteOnApproval(
  submission: StudentSubmission,
): Promise<CompanyInviteEmailResult> {
  const email = submission.companyEmail?.trim().toLowerCase();
  if (!email) return { sent: false, reason: "no_company_email" };
  if (!isValidEmail(email)) return { sent: false, reason: "invalid_email" };
  if (!isBrevoConfigured()) return { sent: false, reason: "brevo_not_configured" };

  const { subject, htmlContent, textContent } = buildCompanyFormInviteEmail(submission);
  const result = await sendBrevoEmail({
    to: [{ email, name: submission.companyName.trim() || undefined }],
    subject,
    htmlContent,
    textContent,
  });

  return { sent: true, messageId: result.messageId };
}
