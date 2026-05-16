import { apiFetch, apiJson } from "@/lib/api";

export type AttestationGenerateResponse = {
  ok: true;
  studentId: string;
  filename: string;
  path: string;
  message: string;
  replaced?: boolean;
};

export type AttestationExistsResponse = {
  exists: boolean;
  filename?: string;
};

export type AttestationListRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  generatedAt: string;
};

export type AttestationListResponse = {
  rows: AttestationListRow[];
};

export async function listAttestations(): Promise<AttestationListResponse> {
  return apiJson<AttestationListResponse>("/api/admin/attestations");
}

export async function checkAttestationExists(
  studentId: string,
): Promise<AttestationExistsResponse> {
  return apiJson<AttestationExistsResponse>(
    `/api/admin/attestations/exists/${encodeURIComponent(studentId)}`,
  );
}

export async function generateAttestation(
  studentId: string,
  overwrite = false,
): Promise<AttestationGenerateResponse> {
  return apiJson<AttestationGenerateResponse>("/api/admin/attestations/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, overwrite }),
  });
}

export function attestationPreviewUrl(studentId: string): string {
  return `/api/admin/attestations/preview/${encodeURIComponent(studentId)}`;
}

export function attestationDownloadUrl(studentId: string): string {
  return `/api/admin/attestations/download/${encodeURIComponent(studentId)}`;
}

export async function downloadAttestation(studentId: string, filename?: string): Promise<void> {
  const res = await apiFetch(attestationDownloadUrl(studentId));
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `attestation-${studentId}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
