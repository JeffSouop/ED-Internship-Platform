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

export async function submitDeclaration(input: {
  companyId: string;
  intake: Intake;
  interns: DeclaredIntern[];
  partnerFormExtras?: Record<string, unknown>;
}): Promise<CompanyDeclaration> {
  await delay();
  return apiJson<CompanyDeclaration>("/api/declarations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
