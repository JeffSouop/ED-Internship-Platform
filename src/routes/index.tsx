import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";

const HERO_IMAGE = "/hero-culinary.jpg";
const CARD_STUDENT_IMAGE = "/card-student.jpg";
const CARD_COMPANY_IMAGE = "/card-company.jpg";
const LOGO_COLOR = "/campus-paris-baseline-color.png";

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
      <SiteHeader>
        <Link
          to="/admin"
          className="rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/20"
        >
          Espace équipe carrière
        </Link>
      </SiteHeader>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-primary/10">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Cuisine professionnelle — formation en stage"
            className="h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/88 to-[#0f2d4a]/95" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div className="text-primary-foreground">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              Campus Paris — Stages &amp; Carrière
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Vos conventions de stage,{" "}
              <span className="text-primary-foreground/85">centralisées et sécurisées</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
              Étudiants, entreprises d&apos;accueil et équipe carrière : un même parcours pour
              déposer, valider et suivre chaque dossier de stage.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HeroCta to="/student/convention" primary>
                Formulaire étudiant
              </HeroCta>
              <HeroCta to="/company">Fiche entreprise</HeroCta>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-6 shadow-2xl backdrop-blur-sm">
              <img
                src={LOGO_COLOR}
                alt="École Ducasse — Campus Paris"
                className="mx-auto h-auto w-full max-w-[320px] brightness-0 invert opacity-95"
              />
              <ul className="mt-6 space-y-3 text-sm text-primary-foreground/90">
                <HeroBullet>Convention de stage en ligne</HeroBullet>
                <HeroBullet>Rattachement via le numéro étudiant</HeroBullet>
                <HeroBullet>Suivi par l&apos;équipe carrière</HeroBullet>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6">
        {/* Parcours */}
        <section className="py-14 sm:py-16">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">Comment ça marche</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Un flux simple en trois étapes
            </h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            <StepCard
              step={1}
              title="L'étudiant dépose sa convention"
              body="Formulaire unique : identité, stage, entreprise d'accueil et pièces attendues."
            />
            <StepCard
              step={2}
              title="L'entreprise complète sa fiche"
              body="Déclaration partenaire avec le numéro étudiant pour lier automatiquement les deux dossiers."
            />
            <StepCard
              step={3}
              title="L'équipe carrière valide"
              body="Contrôle, demandes de modification si besoin, puis enregistrement définitif du stage."
            />
          </ol>
        </section>

        {/* Cartes d'accès */}
        <section className="pb-16 sm:pb-20">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-primary">Accès rapide</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Choisissez votre espace
              </h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <AccessCard
              image={CARD_STUDENT_IMAGE}
              imageAlt="Étudiant en formation cuisine"
              imagePosition="object-cover object-center"
              icon={<GraduationCap className="h-5 w-5" />}
              title="Étudiants"
              body="Complétez et envoyez votre convention de stage. Votre dossier est transmis à l'équipe carrière pour validation."
              cta={{ to: "/student/convention", label: "Convention 2026-2027" }}
            />
            <AccessCard
              image={CARD_COMPANY_IMAGE}
              imageAlt="Salle de restaurant — entreprise d'accueil"
              imagePosition="object-cover object-center"
              icon={<Building2 className="h-5 w-5" />}
              title="Entreprises partenaires"
              body="Un lien public pour toutes les structures : renseignez le numéro d'étudiant fourni par l'École pour rattacher votre déclaration."
              cta={{ to: "/company", label: "Fiche entreprise d'accueil" }}
            />
            <AccessCard
              image={LOGO_COLOR}
              imageAlt="École Ducasse — Campus Paris"
              imagePosition="object-contain"
              imageClassName="bg-primary/5 p-8"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Équipe carrière"
              body="Tableau de bord, validations, conventions générées, attestations et suivi des signatures."
              cta={{ to: "/admin", label: "Administration" }}
              mutedImage
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-primary/15 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <img
            src="/campus-paris-baseline-blanc.png"
            alt="École Ducasse — Campus Paris"
            className="h-10 w-auto opacity-90"
          />
          <p className="text-center text-xs text-primary-foreground/75 sm:text-right">
            © {new Date().getFullYear()} École Ducasse — Département Stages &amp; Carrière
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeroCta({
  to,
  children,
  primary = false,
}: {
  to: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-semibold text-primary shadow-lg transition-transform hover:scale-[1.02] hover:bg-primary-foreground/95"
          : "inline-flex items-center gap-2 rounded-full border border-primary-foreground/35 bg-primary-foreground/10 px-5 py-2.5 text-sm font-medium text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/20"
      }
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function HeroBullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground/90" />
      <span>{children}</span>
    </li>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <li className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {step}
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

function AccessCard({
  image,
  imageAlt = "",
  imagePosition = "object-center",
  imageClassName = "",
  icon,
  title,
  body,
  cta,
  mutedImage = false,
}: {
  image: string;
  imageAlt?: string;
  imagePosition?: string;
  imageClassName?: string;
  icon: ReactNode;
  title: string;
  body: string;
  cta: { to: string; label: string };
  mutedImage?: boolean;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className={`relative h-40 overflow-hidden bg-muted ${imageClassName}`}>
        <img
          src={image}
          alt={imageAlt}
          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${imagePosition}`}
        />
        {!mutedImage && <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />}
        <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
          {icon}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Link
          to={cta.to}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors group-hover:gap-2"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
