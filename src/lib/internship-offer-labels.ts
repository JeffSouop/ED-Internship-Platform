import type { InternshipOfferType } from "@/lib/types";

export const OFFER_TYPE_LABELS: Record<InternshipOfferType, string> = {
  stage: "Stage",
  alternance: "Alternance",
  emploi: "Emploi",
  vie: "VIE",
};

export function offerTypeLabel(type: InternshipOfferType): string {
  return OFFER_TYPE_LABELS[type] ?? type;
}

export function companyOfferDisplayName(company: {
  name: string;
  tradeName?: string;
}): string {
  return company.tradeName?.trim() || company.name;
}
