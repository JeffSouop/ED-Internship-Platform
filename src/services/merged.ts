import type { MergedInternship } from "@/lib/types";
import { apiJson } from "@/lib/api";

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

export async function listMerged(): Promise<MergedInternship[]> {
  await delay();
  return apiJson<MergedInternship[]>("/api/merged");
}
