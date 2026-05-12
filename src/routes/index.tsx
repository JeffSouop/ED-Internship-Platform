import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Building2, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stages & Carrière — École Ducasse" },
      {
        name: "description",
        content:
          "Espace dédié aux étudiants, entreprises partenaires et équipe carrière de l'École Ducasse.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif text-lg">
              É
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">École Ducasse</p>
              <p className="text-xs text-muted-foreground">Stages &amp; Carrière</p>
            </div>
          </div>
          <Link
            to="/admin"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Espace équipe carrière →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">
            Plateforme interne
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Gérez vos conventions de stage en un seul endroit.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Les étudiants utilisent le même formulaire de convention de stage pour soumettre leur
            dossier ; l&apos;équipe carrière le traite dans Validations avant enregistrement définitif.
            Les entreprises utilisent un <strong>lien public unique</strong> ; le rattachement au dossier
            étudiant repose sur le <strong>numéro d&apos;étudiant</strong> indiqué dans la fiche partenaire.
          </p>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          <Card
            icon={<GraduationCap className="h-5 w-5" />}
            title="Étudiants"
            body="Formulaire unique pour toutes les conventions : renseignez votre numéro étudiant et votre stage. Après envoi, votre dossier apparaît dans la file de validation."
            cta={{ to: "/student/convention", label: "Convention de stage 2026-2027" }}
          />
          <Card
            icon={<Building2 className="h-5 w-5" />}
            title="Entreprises partenaires"
            body="Formulaire public pour déclarer vos stagiaires : même lien pour toutes les structures. Renseignez le numéro d&apos;étudiant communiqué par l&apos;École pour rattacher la déclaration au bon dossier."
            cta={{ to: "/company", label: "Fiche entreprise d'accueil (lien global)" }}
          />
          <Card
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Équipe carrière"
            body="Validez les soumissions, gérez les entreprises et exportez les données consolidées."
            cta={{ to: "/admin", label: "Accéder à l'administration" }}
          />
        </section>

        <section className="mt-16 rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-foreground">Liens de démonstration</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pour explorer l&apos;application sans backend, utilisez ces accès factices :
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Link
              to="/company"
              className="inline-flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-foreground transition-colors hover:border-primary hover:bg-primary/10"
            >
              <span>Entreprise — Lien global (production)</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <DemoLink to="/student/$token" params={{ token: "demo-student-camille" }}>
              Étudiant — Camille Dubois
            </DemoLink>
            <DemoLink to="/student/$token" params={{ token: "demo-student-james" }}>
              Étudiant — James Okafor (nouveau)
            </DemoLink>
            <DemoLink to="/company/$token" params={{ token: "demo-company-meurice" }}>
              Entreprise — Le Meurice (jeton démo, pré-rempli)
            </DemoLink>
            <DemoLink to="/company/$token" params={{ token: "demo-company-new" }}>
              Entreprise — Nouvelle inscription (jeton démo)
            </DemoLink>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Mot de passe admin : <code className="rounded bg-muted px-1.5 py-0.5">ducasse2026</code>
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-border px-6 py-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} École Ducasse — Département Stages &amp; Carrière
      </footer>
    </div>
  );
}

function Card({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
        {icon}
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function DemoLink({
  to,
  params,
  children,
}: {
  to: "/student/$token" | "/company/$token";
  params: { token: string };
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-foreground transition-colors hover:border-accent hover:bg-secondary"
    >
      <span>{children}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
