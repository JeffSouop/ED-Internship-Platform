import fs from "node:fs";
import path from "node:path";

import { PROJECT_ROOT } from "./convention-data.js";
import { resolveRuptureOutputDir } from "./rupture-data.js";

const INDEX_BASENAME = ".ruptures-index.json";

export type RuptureIndexEntry = {
  filename: string;
  relativePath: string;
  generatedAt: string;
};

type RuptureIndex = Record<string, RuptureIndexEntry>;

function indexPath(): string {
  return path.join(resolveRuptureOutputDir(), INDEX_BASENAME);
}

function readIndex(): RuptureIndex {
  const p = indexPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as RuptureIndex;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeIndex(index: RuptureIndex): void {
  const dir = resolveRuptureOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf8");
}

export function getRuptureForStudent(studentId: string): RuptureIndexEntry | undefined {
  const entry = readIndex()[studentId.trim()];
  if (!entry) return undefined;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (!fs.existsSync(abs)) {
    clearRuptureForStudent(studentId);
    return undefined;
  }
  return entry;
}

export function setRuptureForStudent(
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

export function clearRuptureForStudent(studentId: string): void {
  const index = readIndex();
  delete index[studentId.trim()];
  writeIndex(index);
}

export function deleteRuptureFileForStudent(studentId: string): void {
  const entry = getRuptureForStudent(studentId);
  if (!entry) return;
  const abs = path.join(PROJECT_ROOT, entry.relativePath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  clearRuptureForStudent(studentId);
}

export function resolveRuptureAbsolutePath(
  studentId: string,
): { absolutePath: string; entry: RuptureIndexEntry } | undefined {
  const entry = getRuptureForStudent(studentId);
  if (!entry) return undefined;
  return { absolutePath: path.join(PROJECT_ROOT, entry.relativePath), entry };
}

export function listRuptureIndexEntries(): Array<{
  studentId: string;
  entry: RuptureIndexEntry;
}> {
  const index = readIndex();
  return Object.entries(index)
    .map(([studentId, entry]) => {
      const abs = path.join(PROJECT_ROOT, entry.relativePath);
      if (!fs.existsSync(abs)) return null;
      return { studentId, entry };
    })
    .filter((row): row is { studentId: string; entry: RuptureIndexEntry } => row !== null);
}
