/** Préfixe les missions utilisateur avec les champs du formulaire convention sans colonnes dédiées. */

export interface ContractFormExtras {
  careerHeadName?: string;
  acceptedTerms?: boolean;
  personalEmail?: string;
  studentAddress?: string;
  studentPostalCode?: string;
  studentCity?: string;
  companyEmail?: string;
  companyPhone?: string;
  civilLiabilityInsurance?: string;
}

export function mergeContractMissions(narrative: string, extras: ContractFormExtras): string {
  const meta: string[] = [];
  if (extras.careerHeadName?.trim()) {
    meta.push(
      `Directrice du Career Development / Head of Career Development: ${extras.careerHeadName.trim()}`,
    );
  }
  if (extras.acceptedTerms === true) {
    meta.push("Confirmation lecture et acceptation des conditions ci-dessus: oui / I confirm.");
  }
  if (extras.personalEmail?.trim()) {
    meta.push(`Email personnel de l'étudiant(e): ${extras.personalEmail.trim()}`);
  }
  if (extras.studentAddress?.trim()) {
    meta.push(`Adresse actuelle: ${extras.studentAddress.trim()}`);
  }
  if (extras.studentPostalCode?.trim()) {
    meta.push(`Code postal: ${extras.studentPostalCode.trim()}`);
  }
  if (extras.studentCity?.trim()) {
    meta.push(`Ville (étudiant): ${extras.studentCity.trim()}`);
  }
  if (extras.companyEmail?.trim()) {
    meta.push(`Email établissement d'accueil (administration / RH): ${extras.companyEmail.trim()}`);
  }
  if (extras.companyPhone?.trim()) {
    meta.push(`Téléphone établissement d'accueil: ${extras.companyPhone.trim()}`);
  }
  if (extras.civilLiabilityInsurance?.trim()) {
    meta.push(`Assurance responsabilité civile (nom + n° contrat): ${extras.civilLiabilityInsurance.trim()}`);
  }

  const lines: string[] = [];
  if (meta.length > 0) {
    lines.push("--- Données convention (formulaire étudiant) ---");
    lines.push(...meta);
    lines.push("---");
  }
  const story = narrative?.trim() ?? "";
  if (story) lines.push(story);
  return lines.join("\n").trim();
}
