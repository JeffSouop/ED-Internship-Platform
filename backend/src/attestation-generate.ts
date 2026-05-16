import fs from "node:fs";
import path from "node:path";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type pg from "pg";

import { PROJECT_ROOT } from "./convention-data.js";
import {
  buildAttestationFilename,
  buildAttestationTemplateData,
  loadAttestationSourceRow,
  resolveAttestationOutputDir,
  resolveAttestationTemplatePath,
} from "./attestation-data.js";
import {
  deleteAttestationFileForStudent,
  getAttestationForStudent,
  setAttestationForStudent,
} from "./attestation-index.js";

export type AttestationGenerateResult = {
  filename: string;
  absolutePath: string;
  relativePath: string;
};

export const ATTESTATION_ALREADY_EXISTS_CODE = "ATTESTATION_ALREADY_EXISTS";

export class AttestationGenerateError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
    readonly existingFilename?: string,
  ) {
    super(message);
    this.name = "AttestationGenerateError";
  }
}

export function attestationExistsForStudent(studentId: string): {
  exists: boolean;
  filename?: string;
} {
  const entry = getAttestationForStudent(studentId.trim());
  if (!entry) return { exists: false };
  return { exists: true, filename: entry.filename };
}

export type GenerateAttestationOptions = {
  overwrite?: boolean;
};

export async function generateAttestationDocx(
  pool: pg.Pool,
  studentId: string,
  options: GenerateAttestationOptions = {},
): Promise<AttestationGenerateResult> {
  const id = studentId.trim();
  const existing = getAttestationForStudent(id);
  if (existing && !options.overwrite) {
    throw new AttestationGenerateError(
      "Une attestation a déjà été générée pour cet étudiant.",
      409,
      ATTESTATION_ALREADY_EXISTS_CODE,
      existing.filename,
    );
  }

  const templatePath = resolveAttestationTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new AttestationGenerateError(
      `Modèle introuvable : ${templatePath}. Placez le fichier .docx ou définissez ATTESTATION_TEMPLATE_PATH.`,
      503,
    );
  }

  const row = await loadAttestationSourceRow(pool, id);
  if (!row) {
    throw new AttestationGenerateError("Étudiant introuvable.", 404);
  }

  const data = buildAttestationTemplateData(row);
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AttestationGenerateError(`Modèle Word invalide : ${msg}`, 500);
  }

  try {
    doc.render(data);
  } catch (e) {
    const err = e as Error & {
      properties?: { errors?: { message: string }[] };
    };
    const details = err.properties?.errors?.map((x) => x.message).join("; ");
    throw new AttestationGenerateError(
      details ? `Erreur de fusion : ${details}` : `Erreur de fusion : ${err.message}`,
      422,
    );
  }

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  const filename = buildAttestationFilename(
    data.Nom_Etud,
    data.Prenoom_Etud,
    data.Nom_entreprise,
  );

  if (existing && options.overwrite) {
    deleteAttestationFileForStudent(id);
  }

  const outputDir = resolveAttestationOutputDir();
  fs.mkdirSync(outputDir, { recursive: true });

  const absolutePath = path.join(outputDir, filename);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
  setAttestationForStudent(id, relativePath, filename);

  return {
    filename,
    absolutePath,
    relativePath,
  };
}
