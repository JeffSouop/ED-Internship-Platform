import fs from "node:fs";
import path from "node:path";

import { resolveConventionOutputDir } from "./convention-data.js";

const TRACKING_BASENAME = ".convention-docusign.json";

export type ConventionSignatureStatus = "pending_signature" | "signed" | "declined";

export type ConventionDocuSignSigner = {
  roleName: string;
  name: string;
  email: string;
  status: string;
};

export type ConventionDocuSignRecord = {
  envelopeId: string;
  sentAt: string;
  emailSubject: string;
  studentName: string;
  studentEmail: string;
  /** Nom de l’entreprise (raison sociale), pas le signataire. */
  companyLegalName: string;
  /** Nom du signataire côté entreprise (représentant / tuteur). */
  companySignerName: string;
  companyEmail: string;
  /** @deprecated Utiliser companyLegalName — conservé pour anciens enregistrements. */
  companyName?: string;
  envelopeStatus?: string;
  signatureStatus: ConventionSignatureStatus;
  statusUpdatedAt?: string;
  signers?: ConventionDocuSignSigner[];
};

type ConventionDocuSignStore = Record<string, ConventionDocuSignRecord>;

function storePath(): string {
  return path.join(resolveConventionOutputDir(), TRACKING_BASENAME);
}

function readStore(): ConventionDocuSignStore {
  const p = storePath();
  if (!fs.existsSync(p)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as ConventionDocuSignStore;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeStore(store: ConventionDocuSignStore): void {
  const dir = resolveConventionOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export function getDocuSignRecord(studentId: string): ConventionDocuSignRecord | undefined {
  return readStore()[studentId.trim()];
}

export function listDocuSignRecords(): Array<{
  studentId: string;
  record: ConventionDocuSignRecord;
}> {
  return Object.entries(readStore()).map(([studentId, record]) => ({
    studentId,
    record,
  }));
}

export function upsertDocuSignRecord(
  studentId: string,
  record: ConventionDocuSignRecord,
): void {
  const store = readStore();
  store[studentId.trim()] = record;
  writeStore(store);
}

export function updateDocuSignRecord(
  studentId: string,
  patch: Partial<ConventionDocuSignRecord>,
): ConventionDocuSignRecord | undefined {
  const id = studentId.trim();
  const store = readStore();
  const existing = store[id];
  if (!existing) return undefined;
  store[id] = { ...existing, ...patch };
  writeStore(store);
  return store[id];
}
