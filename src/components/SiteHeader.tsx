import type { ReactNode } from "react";

import { EcoleDucasseBrand } from "@/components/EcoleDucasseBrand";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  subtitle?: string;
  logoClassName?: string;
  className?: string;
  children?: ReactNode;
};

/** En-tête bleu institutionnel (#194766) commun aux pages publiques. */
export function SiteHeader({ subtitle, logoClassName, className, children }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-primary/30 bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <div className="mx-auto flex min-h-[5.5rem] max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:min-h-[6rem] sm:py-5">
        <EcoleDucasseBrand
          subtitle={subtitle}
          variant="inverse"
          logoClassName={cn("md:h-[5rem]", logoClassName)}
        />
        {children}
      </div>
    </header>
  );
}
