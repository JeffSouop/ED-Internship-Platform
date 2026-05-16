import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { getAdminSession, isStaffAdmin, type AdminUser } from "@/services/admin-auth";
import { createStaffUser, listStaffUsers } from "@/services/staff-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/account")({
  component: AccountPage,
});

function AccountPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminSession().then((session) => {
      if (!cancelled) {
        setUser(session);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        Session introuvable.{" "}
        <Link to="/admin" className="underline">
          Retour
        </Link>
      </p>
    );
  }

  if (!isStaffAdmin(user)) {
    return <ReviewerAccountView user={user} />;
  }

  return <AdminAccountView user={user} />;
}

function ReviewerAccountView({ user }: { user: AdminUser }) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informations de votre accès au tableau de bord.
        </p>
      </header>
      <section className="rounded-lg border border-border bg-card p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <AccountField label="Prénom" value={user.firstName} />
          <AccountField label="Nom" value={user.lastName} />
          <AccountField label="Email" value={user.email} className="sm:col-span-2" />
          <AccountField label="Rôle" value={roleLabel(user.role)} className="sm:col-span-2" />
        </dl>
      </section>
    </div>
  );
}

function AdminAccountView({ user }: { user: AdminUser }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["staff-users"], queryFn: listStaffUsers });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      }),
    onSuccess: () => {
      toast.success("Compte créé — l’utilisateur peut se connecter au tableau de bord.");
      qc.invalidateQueries({ queryKey: ["staff-users"] });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Comptes utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez des accès pour les membres de l’équipe carrière. Chaque personne se connecte avec son
          email et le mot de passe que vous définissez.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Mon compte administrateur</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <AccountField label="Prénom" value={user.firstName} />
          <AccountField label="Nom" value={user.lastName} />
          <AccountField label="Email" value={user.email} className="sm:col-span-2" />
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Nouvel utilisateur</h2>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="staff-first-name">Prénom</Label>
            <Input
              id="staff-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-last-name">Nom</Label>
            <Input
              id="staff-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="staff-email">Adresse email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@ecoleducasse.com"
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="staff-password">Mot de passe</Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Communiquez ce mot de passe à l’utilisateur ; il pourra se connecter sur la page
              d’accueil du tableau de bord.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Création…" : "Créer le compte"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Utilisateurs enregistrés</h2>
        </div>
        {users.isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Chargement…</p>
        )}
        {users.isError && (
          <p className="px-6 py-8 text-sm text-destructive">
            Impossible de charger la liste. Vérifiez que la migration SQL 014 est appliquée.
          </p>
        )}
        {users.data && users.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        )}
        {users.data && users.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Dernière connexion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{roleLabel(row.role)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.lastLoginAt
                      ? new Date(row.lastLoginAt).toLocaleString("fr-FR")
                      : "Jamais"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function AccountField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function roleLabel(role: string): string {
  if (role === "admin") return "Administrateur";
  if (role === "reviewer") return "Équipe carrière";
  if (role === "viewer") return "Lecture seule";
  return role;
}
