import type pg from "pg";

import {
  type ConventionDocuSignRecord,
  type ConventionDocuSignSigner,
  type ConventionSignatureStatus,
  listDocuSignRecords,
  updateDocuSignRecord,
  upsertDocuSignRecord,
} from "./convention-docusign-store.js";
import { listConventionIndexEntries } from "./convention-index.js";
import {
  createDocuSignApiClient,
  fetchEnvelopeSignatureState,
  type DocuSignSigner,
} from "./docusign-client.js";
import { loadDocuSignConfig } from "./docusign-config.js";

export type ConventionTrackingStatus = "not_sent" | ConventionSignatureStatus;

export type ConventionTrackingRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  filename: string;
  generatedAt: string;
  status: ConventionTrackingStatus;
  envelopeId?: string;
  sentAt?: string;
  statusUpdatedAt?: string;
  envelopeStatus?: string;
  signers?: ConventionDocuSignSigner[];
};

export type ConventionTrackingSummary = {
  total: number;
  notSent: number;
  pendingSignature: number;
  signed: number;
  declined: number;
};

export type ConventionTrackingResponse = {
  rows: ConventionTrackingRow[];
  summary: ConventionTrackingSummary;
  refreshedAt?: string;
  docusignConfigured: boolean;
};

function signerHasSigned(status: string): boolean {
  const s = status.toLowerCase();
  return s === "completed" || s === "signed";
}

function mapEnvelopeToSignatureStatus(
  envelopeStatus: string,
  signers: ConventionDocuSignSigner[],
): ConventionSignatureStatus {
  const normalized = envelopeStatus.toLowerCase();
  if (normalized === "completed") return "signed";
  if (normalized === "declined" || normalized === "voided") return "declined";

  const anyDeclined = signers.some((s) => s.status.toLowerCase() === "declined");
  if (anyDeclined) return "declined";

  if (signers.length > 0 && signers.every((s) => signerHasSigned(s.status))) {
    return "signed";
  }

  return "pending_signature";
}

async function loadStudentSummaries(
  pool: pg.Pool,
  studentIds: string[],
): Promise<Map<string, { studentName: string; companyName: string }>> {
  const map = new Map<string, { studentName: string; companyName: string }>();
  if (studentIds.length === 0) return map;

  const { rows } = await pool.query<{
    student_id: string;
    st_first_name: string | null;
    st_last_name: string | null;
    ss_company_name: string | null;
    co_name: string | null;
    company_legal_name: string | null;
  }>(
    `SELECT
       m.student_id,
       m.st_first_name,
       m.st_last_name,
       m.ss_company_name,
       m.co_name,
       di.company_legal_name
     FROM careers.merged_internship m
     LEFT JOIN careers.declared_intern di ON di.id = m.declared_intern_id
     WHERE m.student_id = ANY($1::text[])`,
    [studentIds],
  );

  for (const row of rows) {
    const studentName =
      `${row.st_first_name ?? ""} ${row.st_last_name ?? ""}`.trim() || row.student_id;
    const companyName =
      (row.company_legal_name ?? row.co_name ?? row.ss_company_name ?? "").trim() || "—";
    map.set(row.student_id, { studentName, companyName });
  }
  return map;
}

export function saveDocuSignSendRecord(
  studentId: string,
  envelopeId: string,
  emailSubject: string,
  student: DocuSignSigner,
  companySigner: DocuSignSigner,
  companyLegalName: string,
): void {
  upsertDocuSignRecord(studentId, {
    envelopeId,
    sentAt: new Date().toISOString(),
    emailSubject,
    studentName: student.name,
    studentEmail: student.email,
    companyLegalName: companyLegalName.trim() || "—",
    companySignerName: companySigner.name,
    companyEmail: companySigner.email,
    envelopeStatus: "sent",
    signatureStatus: "pending_signature",
    statusUpdatedAt: new Date().toISOString(),
  });
}

async function refreshDocuSignStatuses(): Promise<void> {
  const config = loadDocuSignConfig();
  if (!config) return;

  const records = listDocuSignRecords();
  if (records.length === 0) return;

  const apiClient = await createDocuSignApiClient(config);

  for (const { studentId, record } of records) {
    try {
      const state = await fetchEnvelopeSignatureState(
        apiClient,
        config.accountId,
        record.envelopeId,
        config.roleStudent,
        config.roleCompany,
      );
      const signatureStatus = mapEnvelopeToSignatureStatus(
        state.envelopeStatus,
        state.signers,
      );
      updateDocuSignRecord(studentId, {
        envelopeStatus: state.envelopeStatus,
        signatureStatus,
        signers: state.signers,
        statusUpdatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`DocuSign refresh failed for ${studentId}:`, e);
    }
  }
}

function buildSummary(rows: ConventionTrackingRow[]): ConventionTrackingSummary {
  return {
    total: rows.length,
    notSent: rows.filter((r) => r.status === "not_sent").length,
    pendingSignature: rows.filter((r) => r.status === "pending_signature").length,
    signed: rows.filter((r) => r.status === "signed").length,
    declined: rows.filter((r) => r.status === "declined").length,
  };
}

function resolveStoredCompanyName(
  docusign: ConventionDocuSignRecord,
  metaCompanyName: string | undefined,
): string {
  return (
    docusign.companyLegalName?.trim() ||
    metaCompanyName?.trim() ||
    docusign.companyName?.trim() ||
    "—"
  );
}

export async function listConventionTracking(
  pool: pg.Pool,
  options: { refresh?: boolean } = {},
): Promise<ConventionTrackingResponse> {
  const shouldRefresh =
    options.refresh !== false && loadDocuSignConfig() !== null;
  if (shouldRefresh) {
    try {
      await refreshDocuSignStatuses();
    } catch (e) {
      console.error(e);
    }
  }

  const conventions = listConventionIndexEntries();
  const docusignByStudent = new Map(
    listDocuSignRecords().map(({ studentId, record }) => [studentId, record]),
  );

  const studentIds = conventions.map((c) => c.studentId);
  const summaries = await loadStudentSummaries(pool, studentIds);

  const rows: ConventionTrackingRow[] = conventions.map(({ studentId, entry }) => {
    const meta = summaries.get(studentId);
    const docusign = docusignByStudent.get(studentId);

    if (!docusign) {
      return {
        studentId,
        studentName: meta?.studentName ?? studentId,
        companyName: meta?.companyName ?? "—",
        filename: entry.filename,
        generatedAt: entry.generatedAt,
        status: "not_sent",
      };
    }

    return {
      studentId,
      studentName: meta?.studentName || docusign.studentName || studentId,
      companyName: resolveStoredCompanyName(docusign, meta?.companyName),
      filename: entry.filename,
      generatedAt: entry.generatedAt,
      status: docusign.signatureStatus,
      envelopeId: docusign.envelopeId,
      sentAt: docusign.sentAt,
      statusUpdatedAt: docusign.statusUpdatedAt,
      envelopeStatus: docusign.envelopeStatus,
      signers: docusign.signers,
    };
  });

  rows.sort((a, b) => {
    const ta = a.sentAt ?? a.generatedAt;
    const tb = b.sentAt ?? b.generatedAt;
    return tb.localeCompare(ta);
  });

  return {
    rows,
    summary: buildSummary(rows),
    refreshedAt: shouldRefresh ? new Date().toISOString() : undefined,
    docusignConfigured: loadDocuSignConfig() !== null,
  };
}
