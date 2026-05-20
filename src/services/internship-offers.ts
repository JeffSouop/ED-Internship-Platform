import type { InternshipOffer, InternshipOfferPublic, InternshipOfferType } from "@/lib/types";
import { apiFetch, apiJson } from "@/lib/api";

export type CreateInternshipOfferInput = {
  title: string;
  description: string;
  offerType?: InternshipOfferType;
  location?: string;
  contractLabel?: string;
  duration?: string;
  startDate?: string;
  contactEmail?: string;
};

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    /* ignore */
  }
  return text || res.statusText;
}

export async function fetchPublicInternshipOffers(): Promise<InternshipOfferPublic[]> {
  return apiJson<InternshipOfferPublic[]>("/api/internship-offers");
}

export async function fetchCompanyInternshipOffers(): Promise<InternshipOffer[]> {
  return apiJson<InternshipOffer[]>("/api/company-portal/internship-offers");
}

export async function createCompanyInternshipOffer(
  input: CreateInternshipOfferInput,
): Promise<InternshipOffer> {
  const res = await apiFetch("/api/company-portal/internship-offers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json() as Promise<InternshipOffer>;
}

export async function deleteCompanyInternshipOffer(offerId: string): Promise<void> {
  const res = await apiFetch(`/api/company-portal/internship-offers/${offerId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseApiError(res));
}
