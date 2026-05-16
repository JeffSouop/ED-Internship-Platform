import path from "node:path";

import {
  PROJECT_ROOT,
  buildConventionTemplateData,
  loadConventionSourceRow,
  sanitizeFilenamePart,
} from "./convention-data.js";

export const DEFAULT_ATTESTATION_TEMPLATE = path.resolve(
  PROJECT_ROOT,
  "templates/Modele2024Attestationdestage.docx",
);

export const DEFAULT_ATTESTATION_OUTPUT_DIR = path.join(PROJECT_ROOT, "attestation");

export function resolveAttestationTemplatePath(): string {
  const fromEnv = process.env.ATTESTATION_TEMPLATE_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : DEFAULT_ATTESTATION_TEMPLATE;
}

export function resolveAttestationOutputDir(): string {
  const fromEnv = process.env.ATTESTATION_OUTPUT_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : DEFAULT_ATTESTATION_OUTPUT_DIR;
}

/** Ex. DupontMarie-AttestationDeStage-RestaurantLeGourmet.docx */
export function buildAttestationFilename(
  lastName: string,
  firstName: string,
  companyName: string,
): string {
  const nom = sanitizeFilenamePart(lastName) || "Etudiant";
  const prenom = sanitizeFilenamePart(firstName);
  const entreprise = sanitizeFilenamePart(companyName) || "Entreprise";
  return `${nom}${prenom}-AttestationDeStage-${entreprise}.docx`;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

export async function loadAttestationSourceRow(
  pool: Parameters<typeof loadConventionSourceRow>[0],
  studentId: string,
): Promise<Record<string, unknown> | undefined> {
  return loadConventionSourceRow(pool, studentId);
}

export function buildAttestationTemplateData(row: Record<string, unknown>): Record<string, string> {
  const base = buildConventionTemplateData(row);

  const internshipType =
    str(row.din_internship_type) ||
    str(row.din_position) ||
    str(row.ss_position) ||
    "";

  return {
    Nom_entreprise: base.Nom_entreprise,
    Representee_par: base.Representee_par,
    En_qualite_de: base.En_qualite_de,
    Adresse_entreprise: base.Adresse_entreprise,
    Ville_entreprise: base.Ville_entreprise,
    Code_Postal_entreprise: base.Code_Postal_entreprise,
    Pays_entreprise: base.Pays_entreprise,
    Telephone_Mail_entreprise: base.Telephone_Mail_entreprise,
    Courriel_entreprise: base.Courriel_entreprise,
    Numero_dimmatruculation_entreprise_SIRET: base.Numero_dimmatruculation_entreprise_SIRET,
    Nom_Etud: base.Nom_Etud,
    Prenoom_Etud: base.Prenoom_Etud,
    Date_de_naissance_etudiant: base.Date_de_naissance_etudiant,
    Type_of_internship: internshipType,
    Programme_etudiant: base.Programme_etudiant,
    Nombre_de_semaines: base.Nombre_de_semaines,
    Date_debut_stage: base.Date_debut_stage,
    Date_fin_stage: base.Date_fin_stage,
    Gratification_intern: base.Gratification_intern,
  };
}
