import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/student/merci")({
  component: MerciPage,
});

function MerciPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dossier envoyé pour validation
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Votre convention de stage a bien été transmise. L&apos;équipe carrière l&apos;examine dans
          l&apos;espace Validations : votre dossier y figure parmi les demandes en attente jusqu&apos;à
          décision (validation ou demande de modifications).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Toutes les données ont été enregistrées dans notre journal de réponses. Une fois le dossier
          approuvé, vos informations officielles sont conservées comme convention validée ; sinon elles
          restent dans le flux des dossiers non validés ou à corriger.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex text-sm font-medium text-primary underline underline-offset-4"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
