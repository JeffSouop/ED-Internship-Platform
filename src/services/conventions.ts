import { apiJson } from "@/lib/api";

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
