import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  Building2,
  GitMerge,
  LinkIcon,
  LogOut,
  FileText,
} from "lucide-react";

import { adminLogout, isAdminAuthed, tryAdminLogin } from "@/services/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAdminAuthed().then((ok) => {
      if (!cancelled) {
        setAuthed(ok);
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
  if (!authed) return <LoginGate onSuccess={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar
          onLogout={async () => {
            await adminLogout();
            setAuthed(false);
          }}
        />
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError("");
          try {
            const result = await tryAdminLogin(pwd);
            if (result.ok) {
              onSuccess();
            } else if (result.reason === "wrong_password") {
              setError("Mot de passe incorrect");
            } else if (result.reason === "network") {
              setError(
                "Connexion à l’API impossible. Lancez le backend : dans le dossier « backend », « npm run dev » (port 4000), puis réessayez.",
              );
            } else {
              setError("Erreur serveur. Vérifiez les logs du backend.");
            }
          } finally {
            setLoading(false);
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div>
          <h1 className="text-lg font-semibold">Espace équipe carrière</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisissez le mot de passe administrateur.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Mot de passe</Label>
          <Input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Démo : <code className="rounded bg-muted px-1.5 py-0.5">ducasse2026</code>
        </p>
      </form>
    </div>
  );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const items: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
    { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { to: "/admin/validations", label: "Validations", icon: ClipboardCheck },
    { to: "/admin/form-log", label: "Journal formulaires", icon: FileText },
    { to: "/admin/students", label: "Étudiants", icon: GraduationCap },
    { to: "/admin/companies", label: "Entreprises", icon: Building2 },
    { to: "/admin/merged", label: "Stages fusionnés", icon: GitMerge },
    { to: "/admin/links", label: "Liens d'accès", icon: LinkIcon },
  ];

  const location = useLocation();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <Link to="/" className="flex items-center gap-3 border-b border-border p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-serif text-primary-foreground">
          É
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">École Ducasse</p>
          <p className="text-xs text-muted-foreground">Stages &amp; Carrière</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={onLogout}
        className="m-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </aside>
  );
}
