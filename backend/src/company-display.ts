/** Même logique que src/lib/company-display.ts (enseigne vs raison sociale). */

export function looksLikeLegalCompanyName(value: string | undefined | null): boolean {
  const n = (value ?? "").trim();
  if (!n) return false;
  return /^(SARL |SAS |SNC |SASIH |SATAP|SEDH |SEH |SELECT SERVICE|SH MANAGEMENT|SMITHFIELD|SOGERA|SOCIETE |Sas |sarl )/i.test(
    n,
  );
}

export function resolveCompanyLegalAndTrade(
  name: string | undefined | null,
  tradeName: string | undefined | null,
): { legal: string; trade: string } {
  const n = (name ?? "").trim();
  const t = (tradeName ?? "").trim();
  if (looksLikeLegalCompanyName(n)) return { legal: n, trade: t };
  if (looksLikeLegalCompanyName(t)) return { legal: t, trade: n };
  return { legal: n, trade: t };
}
