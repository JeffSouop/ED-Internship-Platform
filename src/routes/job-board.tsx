import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Briefcase, Building2, Loader2, Search } from "lucide-react";

import {
  InternshipOfferDetailDialog,
  InternshipOfferGridCard,
} from "@/components/InternshipOfferCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OFFER_TYPE_LABELS, offerTypeLabel } from "@/lib/internship-offer-labels";
import type { InternshipOfferPublic, InternshipOfferType } from "@/lib/types";
import { fetchPublicInternshipOffers } from "@/services/internship-offers";

export const Route = createFileRoute("/job-board")({
  head: () => ({
    meta: [
      { title: "Offres de stage — École Ducasse" },
      {
        name: "description",
        content:
          "Offres de stage et opportunités proposées par les établissements partenaires de l'École Ducasse Campus Paris.",
      },
    ],
  }),
  component: JobBoardPage,
});

function JobBoardPage() {
  const [offers, setOffers] = useState<InternshipOfferPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<InternshipOfferType | "all">("all");
  const [selectedOffer, setSelectedOffer] = useState<InternshipOfferPublic | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicInternshipOffers()
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les offres pour le moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter((o) => {
      if (typeFilter !== "all" && o.offerType !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        o.title,
        o.description,
        o.location,
        o.company.name,
        o.company.tradeName,
        o.company.city,
        o.company.sector,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [offers, query, typeFilter]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader subtitle="Offres de stage" />

      <section className="border-b border-primary/15 bg-gradient-to-br from-primary via-[#1a5270] to-[#0f2d4a] text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:py-14">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            Partenaires gastronomiques
          </p>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            <Briefcase className="h-9 w-9 shrink-0 opacity-90" />
            Offres de stage &amp; emploi
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-primary-foreground/85 sm:text-base">
            Découvrez les opportunités publiées par les établissements de l&apos;École Ducasse.
            Chaque offre est mise en ligne directement par l&apos;entreprise d&apos;accueil.
          </p>
          <p className="mt-6 text-sm text-primary-foreground/75">
            Vous êtes partenaire ?{" "}
            <Link to="/espace-entreprise" className="font-medium underline underline-offset-4">
              Publiez vos offres depuis l&apos;espace entreprise
            </Link>
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10" aria-label="Offres de stage">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher un poste, une ville, un établissement…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Rechercher une offre"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              Toutes
            </FilterChip>
            {(Object.keys(OFFER_TYPE_LABELS) as InternshipOfferType[]).map((t) => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              >
                {offerTypeLabel(t)}
              </FilterChip>
            ))}
          </div>
        </div>

        {!loading && !error && offers.length > 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            {filtered.length} offre{filtered.length !== 1 ? "s" : ""}
            {typeFilter !== "all" ? ` · ${offerTypeLabel(typeFilter)}` : ""}
            {query.trim() ? ` · recherche « ${query.trim()} »` : ""}
          </p>
        )}

        {loading ? (
          <p className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des offres…
          </p>
        ) : error ? (
          <p className="mt-16 text-center text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-base font-medium text-foreground">
              {offers.length === 0
                ? "Aucune offre publiée pour le moment"
                : "Aucune offre ne correspond à votre recherche"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {offers.length === 0
                ? "Les partenaires peuvent publier leurs opportunités depuis l'espace entreprise."
                : "Essayez d'autres mots-clés ou retirez les filtres."}
            </p>
            {offers.length === 0 && (
              <Button asChild className="mt-6" variant="outline">
                <Link to="/espace-entreprise">Espace entreprise</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((offer) => (
              <li key={offer.id} className="min-h-[320px]">
                <InternshipOfferGridCard offer={offer} onSelect={setSelectedOffer} />
              </li>
            ))}
          </ul>
        )}

        <InternshipOfferDetailDialog
          offer={selectedOffer}
          open={selectedOffer !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedOffer(null);
          }}
        />
      </main>

      <SiteFooter />
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
