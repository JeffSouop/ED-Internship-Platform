import fs from "node:fs";
import path from "node:path";

import { PROJECT_ROOT, resolveConventionOutputDir } from "./convention-data.js";

const INDEX_BASENAME = ".conventions-index.json";

export type ConventionIndexEntry = {
  filename: string;
  relativePath: string;
  generatedAt: string;
};

type ConventionIndex = Record<string, ConventionIndexEntry>;

function indexPath(): string {
  return path.join(resolveConventionOutputDir(), INDEX_BASENAME);
}

function readIndex(): ConventionIndex {
  const p = indexPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as ConventionIndex;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeIndex(index: ConventionIndex): void {
  const dir = resolveConventionOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf8");
}

export function getConventionForStudent(studentId: string): ConventionIndexEntry | undefined {
  const entry = readIndex()[studentId.trim()];
  if (!entry) return undefined;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (!fs.existsSync(abs)) {
    clearConventionForStudent(studentId);
    return undefined;
  }
  return entry;
}

export function setConventionForStudent(
  studentId: string,
  relativePath: string,
  filename: string,
): void {
  const index = readIndex();
  index[studentId.trim()] = {
    filename,
    relativePath: relativePath.split(path.sep).join("/"),
    generatedAt: new Date().toISOString(),
  };
  writeIndex(index);
}

export function clearConventionForStudent(studentId: string): void {
  const index = readIndex();
  delete index[studentId.trim()];
  writeIndex(index);
}

/** Supprime le fichier enregistré pour cet étudiant (si présent). */
export function deleteConventionFileForStudent(studentId: string): void {
  const entry = getConventionForStudent(studentId);
  if (!entry) return;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  clearConventionForStudent(studentId);
}

export function resolveConventionAbsolutePath(
  studentId: string,
): { absolutePath: string; entry: ConventionIndexEntry } | undefined {
  const entry = getConventionForStudent(studentId);
  if (!entry) return undefined;
  return { absolutePath: path.join(PROJECT_ROOT, entry.relativePath), entry };
}
