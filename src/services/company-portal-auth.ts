import type { Company } from "@/lib/types";
import { apiFetch, apiUrl } from "@/lib/api";

export type CompanyPortalUser = {
  email: string;
  contactName: string;
  companyId: string;
  companyName: string;
};

export type CompanyPortalSession = {
  user: CompanyPortalUser;
  company: Company;
};

export async function getCompanyPortalSession(): Promise<CompanyPortalSession | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(apiUrl("/api/company-auth/me"), {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      user?: CompanyPortalUser;
      company?: Company;
    };
    if (data.ok !== true || !data.user || !data.company) return null;
    return { user: data.user, company: data.company };
  } catch {
    return null;
  }
}

export type CompanyLoginResult =
  | { ok: true; session: CompanyPortalSession }
  | { ok: false; reason: "invalid_credentials" | "server" | "network" };

export async function tryCompanyLogin(
  email: string,
  password: string,
): Promise<CompanyLoginResult> {
  try {
    const res = await fetch(apiUrl("/api/company-auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (res.ok) {
      const session = await getCompanyPortalSession();
      if (session) return { ok: true, session };
      return { ok: false, reason: "server" };
    }
    if (res.status === 401) return { ok: false, reason: "invalid_credentials" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function companyPortalLogout(): Promise<void> {
  await apiFetch("/api/company-auth/logout", { method: "POST" });
}
