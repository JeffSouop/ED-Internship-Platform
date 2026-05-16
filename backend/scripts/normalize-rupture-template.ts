/**
 * Convertit un modèle Word MERGEFIELD en balises docxtemplater `{Nom_Etud}`, etc.
 * À lancer une fois sur le .docx d’origine (ex. copie .bak), pas à chaque génération.
 *
 * Usage : npx tsx scripts/normalize-rupture-template.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeRuptureTemplateFile } from "../src/rupture-template-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath =
  process.env.RUPTURE_TEMPLATE_PATH?.trim() ||
  path.resolve(__dirname, "../../templates/ModeleRupturedeconvention.docx");

console.log(`Normalisation du modèle : ${templatePath}`);
normalizeRuptureTemplateFile(templatePath);
console.log("Terminé. Le modèle utilise maintenant des balises {…} pour docxtemplater.");
