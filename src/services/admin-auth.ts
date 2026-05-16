import { apiFetch, apiUrl } from "@/lib/api";

export type AdminUser = {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
};

export async function isAdminAuthed(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; user?: AdminUser };
    if (data.ok !== true || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export type AdminLoginResult =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: "invalid_credentials" | "server" | "network" };

export async function tryAdminLogin(email: string, password: string): Promise<AdminLoginResult> {
  try {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (res.ok) {
      const data = (await res.json()) as { user?: AdminUser };
      if (data.user) return { ok: true, user: data.user };
      const session = await getAdminSession();
      if (session) return { ok: true, user: session };
      return { ok: false, reason: "server" };
    }
    if (res.status === 401) return { ok: false, reason: "invalid_credentials" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function adminLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export function isStaffAdmin(user: AdminUser): boolean {
  return user.role === "admin";
}
