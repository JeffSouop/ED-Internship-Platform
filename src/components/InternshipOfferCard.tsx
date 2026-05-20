import type { ReactNode } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Globe2,
  Mail,
  MapPin,
  Maximize2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { companyOfferDisplayName, offerTypeLabel } from "@/lib/internship-offer-labels";
import { getOfferCoverImage } from "@/lib/internship-offer-images";
import type { InternshipOfferPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

type GridCardProps = {
  offer: InternshipOfferPublic;
  onSelect: (offer: InternshipOfferPublic) => void;
};

export function InternshipOfferGridCard({ offer, onSelect }: GridCardProps) {
  const companyName = companyOfferDisplayName(offer.company);
  const cover = getOfferCoverImage(offer);
  const location = offer.location || offer.company.city;

  return (
    <button
      type="button"
      onClick={() => onSelect(offer)}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <img
          src={cover}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge className="border-0 bg-primary/90 text-primary-foreground shadow-sm">
            {offerTypeLabel(offer.offerType)}
          </Badge>
        </div>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3 w-3" />
          Voir le détail
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{companyName}</span>
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug text-foreground">
          {offer.title}
        </h3>
        {location ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        ) : null}
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
          {offer.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {offer.duration ? (
            <MetaPill icon={<Clock className="h-3 w-3" />} label={offer.duration} />
          ) : null}
          {offer.contractLabel ? <MetaPill label={offer.contractLabel} /> : null}
        </div>
      </div>
    </button>
  );
}

type DetailDialogProps = {
  offer: InternshipOfferPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InternshipOfferDetailDialog({ offer, open, onOpenChange }: DetailDialogProps) {
  if (!offer) return null;

  const companyName = companyOfferDisplayName(offer.company);
  const cover = getOfferCoverImage(offer);
  const published = new Date(offer.publishedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-56">
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-12">
            <Badge className="mb-2 border-0 bg-primary text-primary-foreground">
              {offerTypeLabel(offer.offerType)}
            </Badge>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl font-semibold text-white sm:text-2xl">
                {offer.title}
              </DialogTitle>
              <p className="flex items-center gap-2 text-sm text-white/90">
                <Building2 className="h-4 w-4" />
                {companyName}
              </p>
            </DialogHeader>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-xs text-muted-foreground">Publiée le {published}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {offer.location || offer.company.city ? (
              <MetaPill
                icon={<MapPin className="h-3.5 w-3.5" />}
                label={offer.location || offer.company.city!}
              />
            ) : null}
            {offer.duration ? (
              <MetaPill icon={<Clock className="h-3.5 w-3.5" />} label={offer.duration} />
            ) : null}
            {offer.startDate ? (
              <MetaPill
                icon={<Calendar className="h-3.5 w-3.5" />}
                label={`Début ${formatDateFr(offer.startDate)}`}
              />
            ) : null}
            {offer.contractLabel ? <MetaPill label={offer.contractLabel} /> : null}
            {offer.company.sector ? <MetaPill label={offer.company.sector} /> : null}
          </div>

          <section className="mt-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Description du poste
            </h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {offer.description}
            </p>
          </section>

          <footer className="mt-8 flex flex-wrap gap-3 border-t border-border pt-5">
            {offer.contactEmail ? (
              <Button asChild>
                <a href={`mailto:${offer.contactEmail}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Postuler
                </a>
              </Button>
            ) : null}
            {offer.company.website ? (
              <Button variant="outline" asChild>
                <a
                  href={normalizeUrl(offer.company.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe2 className="mr-2 h-4 w-4" />
                  Site de l&apos;établissement
                </a>
              </Button>
            ) : null}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaPill({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function normalizeUrl(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
