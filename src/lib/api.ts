/**
 * Client HTTP applicatif (modèle TaTi) : le navigateur ne parle qu’à cette origine.
 * Par défaut : chemins relatifs `/api` (même origine ; en Docker, nginx « ui » proxifie vers `api`).
 * `VITE_API_URL` : optionnel si le backend n’est pas sur la même origine (cookies / CORS).
 *
 * Base API : `VITE_API_URL` ou chaîne vide → préfixes relatifs `/api`.
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null || String(raw).trim() === "") return "";
  return String(raw).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiBase();
  return base ? `${base}${p}` : p;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** GET JSON ou undefined si 404 */
export async function apiJsonOptional<T>(path: string): Promise<T | undefined> {
  const res = await apiFetch(path);
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
