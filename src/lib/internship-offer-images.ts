import type { InternshipOfferPublic, InternshipOfferType } from "@/lib/types";

const COVER_BY_TYPE: Record<InternshipOfferType, string[]> = {
  stage: ["/card-student.jpg", "/hero-culinary.jpg", "/card-company.jpg"],
  alternance: ["/hero-culinary.jpg", "/card-company.jpg", "/card-student.jpg"],
  emploi: ["/card-company.jpg", "/hero-culinary.jpg"],
  vie: ["/card-company.jpg", "/card-student.jpg"],
};

/** Image de couverture locale (assets publics) — varie selon le type et l’id de l’offre. */
export function getOfferCoverImage(
  offer: Pick<InternshipOfferPublic, "id" | "offerType">,
): string {
  const pool = COVER_BY_TYPE[offer.offerType] ?? COVER_BY_TYPE.stage;
  let hash = 0;
  for (let i = 0; i < offer.id.length; i++) {
    hash = (hash + offer.id.charCodeAt(i)) % pool.length;
  }
  return pool[hash]!;
}
