import type { CompanyDeclaration, DeclaredIntern, Intake } from "@/lib/types";
import { apiJson } from "@/lib/api";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function listDeclarations(): Promise<CompanyDeclaration[]> {
  await delay();
  return apiJson<CompanyDeclaration[]>("/api/declarations");
}

export async function listDeclarationsForCompany(companyId: string) {
  await delay();
  const params = new URLSearchParams({ companyId });
  return apiJson<CompanyDeclaration[]>(`/api/declarations?${params.toString()}`);
}

export type SubmitDeclarationPayload = {
  companyId: string;
  intake: Intake;
  interns: DeclaredIntern[];
  partnerFormExtras?: Record<string, unknown>;
  /** Copie du formulaire au clic (camelCase) — alimente la table partner_intake_submission_snapshot. */
  partnerFormFullState?: Record<string, unknown>;
  partnerBenefitLabels?: string[];
};

export async function submitDeclaration(input: SubmitDeclarationPayload): Promise<CompanyDeclaration> {
  await delay();
  return apiJson<CompanyDeclaration>("/api/declarations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
