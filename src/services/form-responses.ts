import { apiJson } from "@/lib/api";

export interface FormResponseRow {
  id: string;
  studentIdText: string;
  submissionId?: string;
  createdAt: string;
  payload: unknown;
}

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));

export async function listFormResponses(limit = 150): Promise<FormResponseRow[]> {
  await delay();
  return apiJson<FormResponseRow[]>(
    `/api/admin/form-responses?limit=${encodeURIComponent(String(limit))}`,
  );
}
