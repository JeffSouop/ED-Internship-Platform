import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Logo baseline Campus Paris — charte graphique Ducasse */
const LOGO_BLANC = "/campus-paris-baseline-blanc.png";
const LOGO_COLOR = "/campus-paris-baseline-color.png";

type EcoleDucasseBrandProps = {
  /** Sous-titre (ex. « Stages & Carrière »). */
  subtitle?: string;
  className?: string;
  logoClassName?: string;
  asLink?: boolean;
  /** Sur fond bleu institutionnel : baseline blanc. */
  variant?: "default" | "inverse";
};

export function EcoleDucasseBrand({
  subtitle,
  className,
  logoClassName,
  asLink = true,
  variant = "default",
}: EcoleDucasseBrandProps) {
  const inverse = variant === "inverse";

  const logo = (
    <img
      src={inverse ? LOGO_BLANC : LOGO_COLOR}
      alt="École Ducasse — Campus Paris"
      className={cn(
        "h-14 w-auto max-w-full object-contain object-left sm:h-16 md:h-[4.5rem]",
        logoClassName,
      )}
      width={560}
      height={72}
      decoding="async"
    />
  );

  const subtitleEl = subtitle ? (
    <p
      className={cn(
        "font-sans text-xs font-medium leading-tight tracking-wide",
        inverse ? "text-primary-foreground/80" : "text-muted-foreground",
      )}
    >
      {subtitle}
    </p>
  ) : null;

  const body = (
    <>
      {logo}
      {subtitleEl}
    </>
  );

  if (!asLink) {
    return (
      <div
        className={cn(
          "flex flex-col justify-center gap-1 sm:flex-row sm:items-center sm:gap-4",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      to="/"
      className={cn("flex min-w-0 max-w-3xl flex-1 items-center py-1 sm:max-w-4xl", className)}
    >
      {body}
    </Link>
  );
}
