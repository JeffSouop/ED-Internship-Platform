import type { LinkToken } from "@/lib/types";
import { apiJson, apiJsonOptional } from "@/lib/api";

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));

export async function listTokens(): Promise<LinkToken[]> {
  await delay();
  return apiJson<LinkToken[]>("/api/tokens");
}

export async function getToken(token: string): Promise<LinkToken | undefined> {
  await delay();
  return apiJsonOptional<LinkToken>(`/api/tokens/${encodeURIComponent(token)}`);
}

export async function createToken(input: {
  kind: "student" | "company";
  refId?: string;
  label: string;
}): Promise<LinkToken> {
  await delay();
  return apiJson<LinkToken>("/api/tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
