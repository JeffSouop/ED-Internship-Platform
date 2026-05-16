import fs from "node:fs";
import path from "node:path";

import { PROJECT_ROOT } from "./convention-data.js";
import { resolveAttestationOutputDir } from "./attestation-data.js";

const INDEX_BASENAME = ".attestations-index.json";

export type AttestationIndexEntry = {
  filename: string;
  relativePath: string;
  generatedAt: string;
};

type AttestationIndex = Record<string, AttestationIndexEntry>;

function indexPath(): string {
  return path.join(resolveAttestationOutputDir(), INDEX_BASENAME);
}

function readIndex(): AttestationIndex {
  const p = indexPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as AttestationIndex;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeIndex(index: AttestationIndex): void {
  const dir = resolveAttestationOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf8");
}

export function getAttestationForStudent(studentId: string): AttestationIndexEntry | undefined {
  const entry = readIndex()[studentId.trim()];
  if (!entry) return undefined;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (!fs.existsSync(abs)) {
    clearAttestationForStudent(studentId);
    return undefined;
  }
  return entry;
}

export function setAttestationForStudent(
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

export function clearAttestationForStudent(studentId: string): void {
  const index = readIndex();
  delete index[studentId.trim()];
  writeIndex(index);
}

export function deleteAttestationFileForStudent(studentId: string): void {
  const entry = getAttestationForStudent(studentId);
  if (!entry) return;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  clearAttestationForStudent(studentId);
}

export function resolveAttestationAbsolutePath(
  studentId: string,
): { absolutePath: string; entry: AttestationIndexEntry } | undefined {
  const entry = getAttestationForStudent(studentId);
  if (!entry) return undefined;
  return { absolutePath: path.join(PROJECT_ROOT, entry.relativePath), entry };
}

export function listAttestationIndexEntries(): Array<{
  studentId: string;
  entry: AttestationIndexEntry;
}> {
  const index = readIndex();
  return Object.entries(index)
    .map(([studentId, entry]) => {
      const abs = path.join(PROJECT_ROOT, entry.relativePath);
      if (!fs.existsSync(abs)) return null;
      return { studentId, entry };
    })
    .filter((row): row is { studentId: string; entry: AttestationIndexEntry } => row !== null);
}
