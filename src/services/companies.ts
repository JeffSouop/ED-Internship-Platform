import type { Company } from "@/lib/types";
import { apiFetch, apiJson, apiJsonOptional } from "@/lib/api";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function listCompanies(): Promise<Company[]> {
  await delay();
  return apiJson<Company[]>("/api/companies");
}

export async function getCompany(id: string): Promise<Company | undefined> {
  await delay();
  return apiJsonOptional<Company>(`/api/companies/${encodeURIComponent(id)}`);
}

export async function searchCompanies(query: string, country?: string): Promise<Company[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({ q });
  const c = country?.trim();
  if (c) params.set("country", c);
  let list = await apiJson<Company[]>(`/api/companies/search?${params.toString()}`);
  /** Si rien avec le pays saisi (faute ou variante), retenter sans filtre pays pour garder des suggestions utiles. */
  if (list.length === 0 && c) {
    const fallback = new URLSearchParams({ q });
    list = await apiJson<Company[]>(`/api/companies/search?${fallback.toString()}`);
  }
  return list;
}

export async function findCompanyByExactName(
  name: string,
  country: string,
): Promise<Company | undefined> {
  const params = new URLSearchParams({ name, country });
  return apiJsonOptional<Company>(`/api/companies/exact?${params.toString()}`);
}

export async function upsertCompany(input: Omit<Company, "id"> & { id?: string }): Promise<Company> {
  await delay();
  return apiJson<Company>("/api/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteCompany(id: string): Promise<void> {
  const res = await apiFetch(`/api/companies/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}
