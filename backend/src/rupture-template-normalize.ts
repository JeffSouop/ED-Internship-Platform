import fs from "node:fs";
import PizZip from "pizzip";

/**
 * Conversion one-shot MERGEFIELD Word → balises docxtemplater `{tag}`.
 * Exécuter via `npx tsx scripts/normalize-rupture-template.ts` sur le modèle d’origine (.bak).
 */
const MERGEFIELD_TO_TAG: Record<string, string> = {
  Nom_entreprise: "Nom_entreprise",
  "Représentée_par": "Representee_par",
  "En_qualité_de": "En_qualite_de",
  Adresse_entreprise: "Adresse_entreprise",
  Ville_entreprise: "Ville_entreprise",
  Pays_entreprise: "Pays_entreprise",
  Code_Postal_entreprise: "Code_Postal_entreprise",
  "Téléphone_Mail_entreprise": "Telephone_Mail_entreprise",
  Numéro_dimmatruculation_entreprise_SIR: "Numero_dimmatruculation_entreprise_SIRET",
  Nom_tuteur: "Nom_tuteur",
  Fonction_tuteur: "Fonction_tuteur",
  Numéro_tuteur: "Numero_tuteur",
  Mail_tuteur: "Mail_tuteur",
  Nom_stagiaire: "Nom_Etud",
  "Prénom_stagaire": "Prenoom_Etud",
  Date_de_naissance_stagiaire: "Date_de_naissance_etudiant",
  Adresse_stagiaire: "Adresse_etudiant",
  Code_Postal_stagiaire: "Code_Postal_etudiant",
  Ville_Pays_stagiaire: "Ville_Pays_etudiant",
  Programme_stagiaire: "Programme_etudiant",
  "Téléphone_Mail_stagiaire": "Telephone_etudiant",
  "Date_début_stage": "Date_debut_stage",
  Date_fin_stage: "Date_fin_stage",
};

const BEGIN_RE = /<w:fldChar\b[^>]*w:fldCharType="begin"[^>]*\/>/gi;
const END_RE = /<w:fldChar\b[^>]*w:fldCharType="end"[^>]*\/>/i;
const INSTR_RE = /<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/gi;
const ORPHAN_OPEN_RE =
  /<w:r\b[^>]*>(?:<w:rPr\b[\s\S]*?<\/w:rPr>)?<w:t>\{<\/w:t><\/w:r>\s*$/i;
const ORPHAN_CLOSE_RE =
  /^\s*<w:r\b[^>]*>(?:<w:rPr\b[\s\S]*?<\/w:rPr>)?<w:t>\}<\/w:t><\/w:r>/i;
const RPR_FRAGMENT = /<w:rPr\b(?:[^<]|<(?!\/w:rPr>))*<\/w:rPr>/;
/** `{` ou `}` seuls dans un run Word (sans xml:space), pas les balises docxtemplater. */
const ORPHAN_OPEN_RUN_RE = new RegExp(
  `<w:r\\b[^>]*>(?:${RPR_FRAGMENT.source})?<w:t>\\{</w:t></w:r>`,
  "gi",
);
const ORPHAN_CLOSE_RUN_RE = new RegExp(
  `<w:r\\b[^>]*>(?:${RPR_FRAGMENT.source})?<w:t>\\}</w:t></w:r>`,
  "gi",
);
const NESTED_TAG_RUN_RE = new RegExp(
  `(<w:r\\b[^>]*>(?:${RPR_FRAGMENT.source})?)<w:r><w:t xml:space="preserve">(\\{[A-Za-z_0-9]+\\})</w:t></w:r></w:r>`,
  "gi",
);

function mergeInstrToTag(instr: string): string | undefined {
  for (const [mergeKey, tag] of Object.entries(MERGEFIELD_TO_TAG)) {
    if (instr.includes(mergeKey)) return tag;
  }
  return undefined;
}

function lastMatchIndex(re: RegExp, text: string, before: number): number {
  const slice = text.slice(0, before);
  let last = -1;
  let m: RegExpExecArray | null;
  const local = new RegExp(re.source, re.flags);
  while ((m = local.exec(slice)) !== null) {
    last = m.index;
  }
  return last;
}

/** Remplace chaque MERGEFIELD par `{tag}` sans casser la structure XML (tableaux, SDT). */
export function normalizeRuptureDocumentXml(xml: string): string {
  const replacements: { begin: number; end: number; tag: string }[] = [];

  for (const im of xml.matchAll(INSTR_RE)) {
    const instr = im[1] ?? "";
    if (!/MERGEFIELD/i.test(instr)) continue;
    const tag = mergeInstrToTag(instr);
    if (!tag) continue;

    const instrStart = im.index ?? 0;
    const instrEnd = instrStart + im[0].length;
    const begin = lastMatchIndex(BEGIN_RE, xml, instrStart);
    if (begin < 0) continue;

    const endM = END_RE.exec(xml.slice(instrEnd));
    if (!endM || endM.index === undefined) continue;
    let end = instrEnd + endM.index + endM[0].length;

    const chunkBefore = xml.slice(Math.max(0, begin - 800), begin);
    const openM = chunkBefore.match(ORPHAN_OPEN_RE);
    if (openM && openM.index !== undefined) {
      begin = begin - chunkBefore.length + openM.index;
    }

    const chunkAfter = xml.slice(end, end + 800);
    const closeM = chunkAfter.match(ORPHAN_CLOSE_RE);
    if (closeM) {
      end += closeM[0].length;
    }

    replacements.push({ begin, end, tag });
  }

  let out = xml;
  for (const { begin, end, tag } of replacements.sort((a, b) => b.begin - a.begin)) {
    const repl = `<w:r><w:t xml:space="preserve">{${tag}}</w:t></w:r>`;
    out = out.slice(0, begin) + repl + out.slice(end);
  }
  return cleanupRuptureDocumentXml(out);
}

function cleanupRuptureDocumentXml(xml: string): string {
  return xml
    .replace(ORPHAN_OPEN_RUN_RE, "")
    .replace(ORPHAN_CLOSE_RUN_RE, "")
    .replace(NESTED_TAG_RUN_RE, '$1<w:t xml:space="preserve">$2</w:t></w:r>');
}

export function normalizeRuptureDocxBuffer(input: Buffer): Buffer {
  const zip = new PizZip(input);
  const doc = zip.file("word/document.xml");
  if (doc) {
    zip.file("word/document.xml", normalizeRuptureDocumentXml(doc.asText()));
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export function normalizeRuptureTemplateFile(templatePath: string): void {
  const normalized = normalizeRuptureDocxBuffer(fs.readFileSync(templatePath));
  fs.writeFileSync(templatePath, normalized);
}
