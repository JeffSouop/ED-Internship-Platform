import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { apiUrl } from "@/lib/api";

type Status = "checking" | "ok" | "offline" | "unauthorized";

export function AdminApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const me = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
        if (cancelled) return;
        if (me.ok) {
          setStatus("ok");
          return;
        }
        if (me.status === 401) {
          setStatus("unauthorized");
          return;
        }
        setStatus("offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking" || status === "ok" || status === "unauthorized") {
    return null;
  }

  return (
    <div
      role="alert"
      className="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Connexion à l&apos;API impossible</p>
        <p className="mt-1 text-destructive/90">
          Le tableau de bord a besoin du backend. À la racine du projet :{" "}
          <code className="rounded bg-destructive/10 px-1">npm run api:dev</code> (port 4000) puis{" "}
          <code className="rounded bg-destructive/10 px-1">npm run dev</code> (port 5173), ou{" "}
          <code className="rounded bg-destructive/10 px-1">docker compose up</code> (port 8080).
          Ne définissez pas <code className="rounded bg-destructive/10 px-1">VITE_API_URL</code> en
          local.
        </p>
      </div>
    </div>
  );
}
