import { apiJson } from "@/lib/api";

export type ConventionTrackingStatus = "not_sent" | "pending_signature" | "signed" | "declined";

export type ConventionTrackingSigner = {
  roleName: string;
  name: string;
  email: string;
  status: string;
};

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
  signers?: ConventionTrackingSigner[];
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

export async function listConventionTracking(
  options: { skipRefresh?: boolean } = {},
): Promise<ConventionTrackingResponse> {
  const q = options.skipRefresh ? "?refresh=false" : "";
  return apiJson<ConventionTrackingResponse>(`/api/admin/conventions/tracking${q}`);
}
