/** Options du formulaire entreprise (section modalités / avantages) — source unique pour l’UI et l’affichage admin. */
export const BENEFIT_OPTIONS: { id: string; label: string }[] = [
  { id: "paid_none", label: "Stage rémunéré sans logement ni repas. / Paid internship without accommodation and meals" },
  { id: "paid_housing", label: "Stage rémunéré avec logement uniquement. / Paid internship with accommodation only" },
  { id: "paid_meals", label: "Stage rémunéré avec repas uniquement. / Paid internship with meals only" },
  { id: "paid_both", label: "Stage rémunéré avec logement et repas. / Paid internship with accommodation and meals" },
  { id: "unpaid_none", label: "Stage non rémunéré sans logement ni repas. / Unpaid internship without accommodation and meals" },
  { id: "unpaid_housing", label: "Stage non rémunéré avec logement uniquement. / Unpaid internship with accommodation only" },
  { id: "unpaid_meals", label: "Stage non rémunéré avec repas uniquement. / Unpaid internship with meals only" },
  { id: "unpaid_both", label: "Stage non rémunéré avec logement et repas. / Unpaid internship with accommodation and meals" },
  { id: "transport", label: "Frais de Transport partiellement remboursés / Transportation expenses partially covered" },
];

export function benefitLabel(id: string): string {
  return BENEFIT_OPTIONS.find((b) => b.id === id)?.label ?? id;
}
