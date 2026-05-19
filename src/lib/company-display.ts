import type { Company } from "@/lib/types";

/** Raison sociale type SARL, SAS, SOCIETE, etc. */
export function looksLikeLegalCompanyName(value: string | undefined | null): boolean {
  const n = (value ?? "").trim();
  if (!n) return false;
  return /^(SARL |SAS |SNC |SASIH |SATAP|SEDH |SEH |SELECT SERVICE|SH MANAGEMENT|SMITHFIELD|SOGERA|SOCIETE |Sas |sarl )/i.test(
    n,
  );
}

/** Enseigne affichée : nom commercial (colonne name après correction import, sinon trade_name). */
export function companyDisplayName(company: Pick<Company, "name" | "tradeName">): string {
  const legal = company.name?.trim() ?? "";
  const trade = company.tradeName?.trim() ?? "";

  if (looksLikeLegalCompanyName(legal) && trade) return trade;
  if (looksLikeLegalCompanyName(trade) && legal) return legal;
  return trade || legal || "—";
}

/** Raison sociale pour la fiche détail / conventions. */
export function companyLegalName(company: Pick<Company, "name" | "tradeName">): string {
  const legal = company.name?.trim() ?? "";
  const trade = company.tradeName?.trim() ?? "";

  if (looksLikeLegalCompanyName(legal)) return legal;
  if (looksLikeLegalCompanyName(trade)) return trade;
  return legal || trade || "—";
}

export function companyHasDistinctTradeName(company: Pick<Company, "name" | "tradeName">): boolean {
  const display = companyDisplayName(company);
  const legal = companyLegalName(company);
  return Boolean(display && legal && display !== legal);
}
