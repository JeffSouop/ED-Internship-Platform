import { apiJson } from "@/lib/api";

export type ConventionGenerateResponse = {
  ok: true;
  studentId: string;
  filename: string;
  path: string;
  message: string;
};

export async function generateConvention(studentId: string): Promise<ConventionGenerateResponse> {
  return apiJson<ConventionGenerateResponse>("/api/admin/conventions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });
}
