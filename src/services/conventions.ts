import { apiFetch, apiJson } from "@/lib/api";

export type ConventionGenerateResponse = {
  ok: true;
  studentId: string;
  filename: string;
  path: string;
  message: string;
  replaced?: boolean;
};

export type ConventionExistsResponse = {
  exists: boolean;
  filename?: string;
};

export async function checkConventionExists(
  studentId: string,
): Promise<ConventionExistsResponse> {
  return apiJson<ConventionExistsResponse>(
    `/api/admin/conventions/exists/${encodeURIComponent(studentId)}`,
  );
}

export async function generateConvention(
  studentId: string,
  overwrite = false,
): Promise<ConventionGenerateResponse> {
  return apiJson<ConventionGenerateResponse>("/api/admin/conventions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, overwrite }),
  });
}

export type DocuSignStatusResponse = {
  configured: boolean;
  ready: boolean;
};

export type DocuSignSendResponse = {
  ok: true;
  studentId: string;
  envelopeId?: string;
  message: string;
};

export type ConventionApiErrorBody = {
  error?: string;
  code?: string;
};

export async function getDocuSignStatus(): Promise<DocuSignStatusResponse> {
  return apiJson<DocuSignStatusResponse>("/api/admin/conventions/docusign/status");
}

export async function sendConventionToDocuSign(
  studentId: string,
): Promise<DocuSignSendResponse> {
  const res = await apiFetch("/api/admin/conventions/docusign/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });
  const body = (await res.json().catch(() => ({}))) as DocuSignSendResponse &
    ConventionApiErrorBody;
  if (!res.ok) {
    const err = new Error(body.error || res.statusText) as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  return body as DocuSignSendResponse;
}
