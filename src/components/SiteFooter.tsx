import { Facebook, Instagram, Linkedin } from "lucide-react";

import { cn } from "@/lib/utils";

const SOCIAL_LINKS = [
  {
    label: "Facebook — École Ducasse",
    href: "https://www.facebook.com/EcoleDucasse",
    icon: Facebook,
  },
  {
    label: "Instagram — École Ducasse",
    href: "https://www.instagram.com/ecole_ducasse/",
    icon: Instagram,
  },
  {
    label: "LinkedIn — École Ducasse",
    href: "https://www.linkedin.com/school/ecole-ducasse/posts/?feedView=all",
    icon: Linkedin,
  },
] as const;

type SiteFooterProps = {
  /** Plein pied de page (accueil) ou version compacte (formulaires, connexion). */
  variant?: "full" | "compact";
  className?: string;
};

export function SiteFooter({ variant = "full", className }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const isFull = variant === "full";

  const iconLinkClass = isFull
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-foreground/25 text-primary-foreground transition-colors hover:bg-primary-foreground/15"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  const footerContent = (
    <>
      <p>© {year} École Ducasse — Département Stages &amp; Carrière</p>
      <nav
        className="mt-3 flex items-center justify-center gap-2 sm:justify-end"
        aria-label="Réseaux sociaux École Ducasse"
      >
        {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={iconLinkClass}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </nav>
    </>
  );

  if (!isFull) {
    return (
      <footer className={cn("px-6 py-6 text-center text-xs text-muted-foreground", className)}>
        {footerContent}
      </footer>
    );
  }

  return (
    <footer
      className={cn("border-t border-primary/15 bg-primary text-primary-foreground", className)}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <img
          src="/campus-paris-baseline-blanc.png"
          alt="École Ducasse — Campus Paris"
          className="h-10 w-auto opacity-90"
        />
        <div className="text-center text-xs text-primary-foreground/75 sm:text-right">
          {footerContent}
        </div>
      </div>
    </footer>
  );
}
