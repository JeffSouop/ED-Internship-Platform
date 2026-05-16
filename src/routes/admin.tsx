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
  FileCheck,
  ScrollText,
  ClipboardList,
} from "lucide-react";

import { EcoleDucasseBrand } from "@/components/EcoleDucasseBrand";
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

  return <AdminShell onLogout={() => setAuthed(false)} />;
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const isDashboard =
    location.pathname === "/admin" || location.pathname === "/admin/";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        onLogout={async () => {
          await adminLogout();
          onLogout();
        }}
      />
      <main
        className={`flex min-h-0 flex-1 flex-col px-8 py-8 ${
          isDashboard ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        <Outlet />
      </main>
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
        <EcoleDucasseBrand
          asLink={false}
          variant="inverse"
          className="mb-4 max-w-none rounded-md bg-primary p-4"
          logoClassName="h-auto w-full max-h-28"
        />
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
    { to: "/admin/convention", label: "Convention de stage", icon: ScrollText },
    { to: "/admin/feuille-suivi", label: "Feuille de suivi", icon: FileCheck },
    { to: "/admin/convention-tracking", label: "Suivi conventions", icon: ClipboardList },
    { to: "/admin/form-log", label: "Journal formulaires", icon: FileText },
    { to: "/admin/students", label: "Étudiants", icon: GraduationCap },
    { to: "/admin/companies", label: "Entreprises", icon: Building2 },
    { to: "/admin/merged", label: "Stages fusionnés", icon: GitMerge },
    { to: "/admin/links", label: "Liens d'accès", icon: LinkIcon },
  ];

  const location = useLocation();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-5">
        <EcoleDucasseBrand
          variant="inverse"
          logoClassName="h-auto w-full max-h-28"
          className="w-full max-w-none flex-none"
        />
      </div>
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
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
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
        className="m-3 flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </aside>
  );
}
