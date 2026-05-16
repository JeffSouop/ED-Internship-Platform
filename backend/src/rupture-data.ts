import path from "node:path";

import {
  PROJECT_ROOT,
  buildConventionTemplateData,
  loadConventionSourceRow,
  sanitizeFilenamePart,
} from "./convention-data.js";

export const DEFAULT_RUPTURE_TEMPLATE = path.resolve(
  PROJECT_ROOT,
  "templates/ModeleRupturedeconvention.docx",
);

export const DEFAULT_RUPTURE_OUTPUT_DIR = path.join(PROJECT_ROOT, "rupture");

export function resolveRuptureTemplatePath(): string {
  const fromEnv = process.env.RUPTURE_TEMPLATE_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : DEFAULT_RUPTURE_TEMPLATE;
}

export function resolveRuptureOutputDir(): string {
  const fromEnv = process.env.RUPTURE_OUTPUT_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : DEFAULT_RUPTURE_OUTPUT_DIR;
}

/** Ex. DupontMarie-RuptureDeStage-RestaurantLeGourmet.docx */
export function buildRuptureFilename(
  lastName: string,
  firstName: string,
  companyName: string,
): string {
  const nom = sanitizeFilenamePart(lastName) || "Etudiant";
  const prenom = sanitizeFilenamePart(firstName);
  const entreprise = sanitizeFilenamePart(companyName) || "Entreprise";
  return `${nom}${prenom}-RuptureDeStage-${entreprise}.docx`;
}

export async function loadRuptureSourceRow(
  pool: Parameters<typeof loadConventionSourceRow>[0],
  studentId: string,
): Promise<Record<string, unknown> | undefined> {
  return loadConventionSourceRow(pool, studentId);
}

export function buildRuptureTemplateData(row: Record<string, unknown>): Record<string, string> {
  const base = buildConventionTemplateData(row);

  return {
    Nom_entreprise: base.Nom_entreprise,
    Representee_par: base.Representee_par,
    En_qualite_de: base.En_qualite_de,
    Adresse_entreprise: base.Adresse_entreprise,
    Ville_entreprise: base.Ville_entreprise,
    Code_Postal_entreprise: base.Code_Postal_entreprise,
    Pays_entreprise: base.Pays_entreprise,
    Telephone_Mail_entreprise: base.Telephone_Mail_entreprise,
    Numero_dimmatruculation_entreprise_SIRET: base.Numero_dimmatruculation_entreprise_SIRET,
    Nom_tuteur: base.Nom_tuteur,
    Fonction_tuteur: base.Fonction_tuteur,
    Numero_tuteur: base.Numero_tuteur,
    Mail_tuteur: base.Mail_tuteur,
    Nom_Etud: base.Nom_Etud,
    Prenoom_Etud: base.Prenoom_Etud,
    Date_de_naissance_etudiant: base.Date_de_naissance_etudiant,
    Adresse_etudiant: base.Adresse_etudiant,
    Code_Postal_etudiant: base.Code_Postal_etudiant,
    Ville_Pays_etudiant: base.Ville_Pays_etudiant,
    Programme_etudiant: base.Programme_etudiant,
    Telephone_etudiant: base.Telephone_etudiant,
    Mail_etudiant: base.Mail_etudiant,
    Date_debut_stage: base.Date_debut_stage,
    Date_fin_stage: base.Date_fin_stage,
  };
}
