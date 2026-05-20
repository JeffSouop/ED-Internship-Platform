import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Lock } from "lucide-react";

import { CompanyPortalDashboard } from "@/components/CompanyPortalDashboard";
import { EcoleDucasseBrand } from "@/components/EcoleDucasseBrand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { releaseUiLocks } from "@/lib/release-ui-lock";
import {
  companyPortalLogout,
  getCompanyPortalSession,
  tryCompanyLogin,
  type CompanyPortalSession,
} from "@/services/company-portal-auth";

export const Route = createFileRoute("/espace-entreprise")({
  head: () => ({
    meta: [
      { title: "Espace entreprise — École Ducasse" },
      {
        name: "description",
        content: "Espace partenaire pour la mise à jour de votre fiche entreprise.",
      },
    ],
  }),
  component: EspaceEntreprisePage,
});

function EspaceEntreprisePage() {
  const [session, setSession] = useState<CompanyPortalSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    releaseUiLocks();
    let cancelled = false;
    getCompanyPortalSession().then((s) => {
      if (!cancelled) {
        setSession(s);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!session) {
    return <CompanyLoginGate onSuccess={setSession} />;
  }

  return (
    <CompanyPortalDashboard
      session={session}
      onLogout={async () => {
        await companyPortalLogout();
        setSession(null);
      }}
      onCompanyUpdated={(company) => {
        setSession((prev) => (prev ? { ...prev, company } : prev));
      }}
    />
  );
}

function CompanyLoginGate({ onSuccess }: { onSuccess: (s: CompanyPortalSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader subtitle="Espace entreprise" />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError("");
            try {
              const result = await tryCompanyLogin(email, password);
              if (result.ok) onSuccess(result.session);
              else if (result.reason === "invalid_credentials") {
                setError("E-mail RH ou mot de passe incorrect.");
              } else if (result.reason === "network") {
                setError("Connexion à l’API impossible. Vérifiez que la stack Docker est démarrée.");
              } else {
                setError("Erreur serveur. Réessayez plus tard.");
              }
            } finally {
              setLoading(false);
            }
          }}
          className="relative w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>

          <EcoleDucasseBrand
            asLink={false}
            variant="inverse"
            className="max-w-none flex-col items-center rounded-md bg-primary p-4 sm:flex-col"
            logoClassName="mx-auto h-auto w-full max-h-20 object-contain"
          />

          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Espace entreprise</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous avec l&apos;adresse e-mail RH enregistrée pour votre établissement.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="company-email">E-mail RH</Label>
              <Input
                id="company-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rh@votre-etablissement.fr"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-password">Mot de passe</Label>
              <Input
                id="company-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            <Lock className="mr-2 h-4 w-4" />
            {loading ? "Connexion…" : "Accéder à mon espace"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </form>
      </div>

      <SiteFooter />
    </div>
  );
}
