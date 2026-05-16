import fs from "node:fs";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type pg from "pg";

import {
  buildConventionTemplateData,
  loadConventionSourceRow,
  resolveConventionTemplatePath,
} from "./convention-data.js";

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
): Promise<{ buffer: Buffer; filename: string }> {
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

  const safeId = studentId.replace(/[^\w.-]+/g, "_");
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `convention-stage-${safeId}-${datePart}.docx`;

  return { buffer, filename };
}
