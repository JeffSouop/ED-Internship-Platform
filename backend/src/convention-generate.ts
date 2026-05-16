import fs from "node:fs";
import path from "node:path";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type pg from "pg";

import {
  PROJECT_ROOT,
  buildConventionFilename,
  buildConventionTemplateData,
  loadConventionSourceRow,
  resolveConventionOutputDir,
  resolveConventionTemplatePath,
} from "./convention-data.js";

export type ConventionGenerateResult = {
  filename: string;
  /** Chemin absolu sur le serveur */
  absolutePath: string;
  /** Chemin relatif depuis la racine du projet (ex. convention/…) */
  relativePath: string;
};

export class ConventionGenerateError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ConventionGenerateError";
  }
}

export async function generateConventionDocx(
  pool: pg.Pool,
  studentId: string,
): Promise<ConventionGenerateResult> {
  const templatePath = resolveConventionTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new ConventionGenerateError(
      `Modèle introuvable : ${templatePath}. Placez le fichier .docx ou définissez CONVENTION_TEMPLATE_PATH.`,
      503,
    );
  }

  const row = await loadConventionSourceRow(pool, studentId.trim());
  if (!row) {
    throw new ConventionGenerateError("Étudiant introuvable.", 404);
  }

  const data = buildConventionTemplateData(row);
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
    throw new ConventionGenerateError(`Modèle Word invalide : ${msg}`, 500);
  }

  try {
    doc.render(data);
  } catch (e) {
    const err = e as Error & {
      properties?: { errors?: { message: string }[] };
    };
    const details = err.properties?.errors?.map((x) => x.message).join("; ");
    throw new ConventionGenerateError(
      details ? `Erreur de fusion : ${details}` : `Erreur de fusion : ${err.message}`,
      422,
    );
  }

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  let filename = buildConventionFilename(
    data.Nom_Etud,
    data.Prenoom_Etud,
    data.Nom_entreprise,
  );

  const outputDir = resolveConventionOutputDir();
  fs.mkdirSync(outputDir, { recursive: true });

  let absolutePath = path.join(outputDir, filename);
  if (fs.existsSync(absolutePath)) {
    const stem = filename.replace(/\.docx$/i, "");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    filename = `${stem}-${stamp}.docx`;
    absolutePath = path.join(outputDir, filename);
  }

  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.relative(PROJECT_ROOT, absolutePath);

  return {
    filename,
    absolutePath,
    relativePath: relativePath.split(path.sep).join("/"),
  };
}
