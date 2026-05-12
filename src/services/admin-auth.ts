import { apiFetch, apiUrl } from "@/lib/api";

export async function isAdminAuthed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export type AdminLoginResult =
  | { ok: true }
  | { ok: false; reason: "wrong_password" | "server" | "network" };

/** Connexion admin — distingue mot de passe faux / erreur HTTP / API injoignable (ex. pas de serveur sur :4000). */
export async function tryAdminLogin(pwd: string): Promise<AdminLoginResult> {
  try {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, reason: "wrong_password" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function adminLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
