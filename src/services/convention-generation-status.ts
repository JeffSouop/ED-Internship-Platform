import { apiJson } from "@/lib/api";

export type ConventionGenerationRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  campus: string | null;
  programme: string | null;
  generated: boolean;
  filename?: string;
  generatedAt?: string;
};

export type ConventionGenerationSummary = {
  total: number;
  generated: number;
  notGenerated: number;
};

export type ConventionGenerationResponse = {
  rows: ConventionGenerationRow[];
  summary: ConventionGenerationSummary;
};

export async function listConventionGenerationStatus(): Promise<ConventionGenerationResponse> {
  return apiJson<ConventionGenerationResponse>("/api/admin/conventions/generation-status");
}
