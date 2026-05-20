import type { Company } from "@/lib/types";
import { apiJson } from "@/lib/api";

export async function updatePortalCompany(
  input: Omit<Company, "id"> & { id?: string },
): Promise<Company> {
  return apiJson<Company>("/api/company-portal/company", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
