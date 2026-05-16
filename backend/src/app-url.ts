/** URL publique de l’interface (liens dans les e-mails). */
export function getPublicAppUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const origins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:8080")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const preferred =
    origins.find((o) => o.includes("8080")) ??
    origins.find((o) => !o.includes("5173")) ??
    origins[0];
  return (preferred ?? "http://localhost:8080").replace(/\/$/, "");
}
