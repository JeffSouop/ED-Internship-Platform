import fs from "node:fs";
import path from "node:path";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type pg from "pg";

import { PROJECT_ROOT } from "./convention-data.js";
import {
  buildRuptureFilename,
  buildRuptureTemplateData,
  loadRuptureSourceRow,
  resolveRuptureOutputDir,
  resolveRuptureTemplatePath,
} from "./rupture-data.js";
import {
  deleteRuptureFileForStudent,
  getRuptureForStudent,
  setRuptureForStudent,
} from "./rupture-index.js";

export type RuptureGenerateResult = {
  filename: string;
  absolutePath: string;
  relativePath: string;
};

export const RUPTURE_ALREADY_EXISTS_CODE = "RUPTURE_ALREADY_EXISTS";

export class RuptureGenerateError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
    readonly existingFilename?: string,
  ) {
    super(message);
    this.name = "RuptureGenerateError";
  }
}

export function ruptureExistsForStudent(studentId: string): {
  exists: boolean;
  filename?: string;
} {
  const entry = getRuptureForStudent(studentId.trim());
  if (!entry) return { exists: false };
  return { exists: true, filename: entry.filename };
}

export type GenerateRuptureOptions = {
  overwrite?: boolean;
};

export async function generateRuptureDocx(
  pool: pg.Pool,
  studentId: string,
  options: GenerateRuptureOptions = {},
): Promise<RuptureGenerateResult> {
  const id = studentId.trim();
  const existing = getRuptureForStudent(id);
  if (existing && !options.overwrite) {
    throw new RuptureGenerateError(
      "Une rupture de stage a déjà été générée pour cet étudiant.",
      409,
      RUPTURE_ALREADY_EXISTS_CODE,
      existing.filename,
    );
  }

  const templatePath = resolveRuptureTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new RuptureGenerateError(
      `Modèle introuvable : ${templatePath}. Placez le fichier .docx ou définissez RUPTURE_TEMPLATE_PATH.`,
      503,
    );
  }

  const row = await loadRuptureSourceRow(pool, id);
  if (!row) {
    throw new RuptureGenerateError("Étudiant introuvable.", 404);
  }

  const data = buildRuptureTemplateData(row);
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
    const err = e as Error & {
      properties?: { errors?: { message: string; properties?: { explanation?: string } }[] };
    };
    const details = err.properties?.errors
      ?.map((x) => x.properties?.explanation ?? x.message)
      .filter(Boolean)
      .join("; ");
    const msg = details || (e instanceof Error ? e.message : String(e));
    throw new RuptureGenerateError(`Modèle Word invalide : ${msg}`, 500);
  }

  try {
    doc.render(data);
  } catch (e) {
    const err = e as Error & {
      properties?: { errors?: { message: string }[] };
    };
    const details = err.properties?.errors?.map((x) => x.message).join("; ");
    throw new RuptureGenerateError(
      details ? `Erreur de fusion : ${details}` : `Erreur de fusion : ${err.message}`,
      422,
    );
  }

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  const filename = buildRuptureFilename(data.Nom_Etud, data.Prenoom_Etud, data.Nom_entreprise);

  if (existing && options.overwrite) {
    deleteRuptureFileForStudent(id);
  }

  const outputDir = resolveRuptureOutputDir();
  fs.mkdirSync(outputDir, { recursive: true });

  const absolutePath = path.join(outputDir, filename);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
  setRuptureForStudent(id, relativePath, filename);

  return {
    filename,
    absolutePath,
    relativePath,
  };
}
