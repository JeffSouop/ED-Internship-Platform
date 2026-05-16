/** Balises Word du tableau avantages (convention FPAD). */
export const CONVENTION_BENEFIT_TAGS = [
  "srslnr",
  "snrslnr",
  "sralu",
  "snralu",
  "sraru",
  "snraru",
  "sraler",
  "snraler",
  "fdtpr",
] as const;

export type ConventionBenefitTag = (typeof CONVENTION_BENEFIT_TAGS)[number];

/** IDs formulaire entreprise → balise docx. */
export const BENEFIT_ID_TO_CONVENTION_TAG: Record<string, ConventionBenefitTag> = {
  paid_none: "srslnr",
  unpaid_none: "snrslnr",
  paid_housing: "sralu",
  unpaid_housing: "snralu",
  paid_meals: "sraru",
  unpaid_meals: "snraru",
  paid_both: "sraler",
  unpaid_both: "snraler",
  transport: "fdtpr",
};

const CHECKED = "OK";

export function conventionBenefitPlaceholders(benefitIds: string[]): Record<ConventionBenefitTag, string> {
  const out = Object.fromEntries(
    CONVENTION_BENEFIT_TAGS.map((t) => [t, ""]),
  ) as Record<ConventionBenefitTag, string>;
  for (const id of benefitIds) {
    const tag = BENEFIT_ID_TO_CONVENTION_TAG[id];
    if (tag) out[tag] = CHECKED;
  }
  return out;
}

export function extractBenefitIds(
  partnerFormExtras: unknown,
  rawPayload: unknown,
): string[] {
  const fromExtras = readBenefitsArray(partnerFormExtras);
  if (fromExtras.length) return fromExtras;
  return readBenefitsArray(rawPayload);
}

function readBenefitsArray(source: unknown): string[] {
  if (!source || typeof source !== "object") return [];
  const o = source as Record<string, unknown>;
  const raw = o.benefits;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}
