import { useClientMounted } from "@/hooks/use-client-mounted";
import type { ReactNode } from "react";

type ClientOnlyProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

/** N’affiche les enfants qu’après hydratation (évite SSR sans cookie de session). */
export function ClientOnly({
  children,
  fallback = (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Chargement…
    </div>
  ),
}: ClientOnlyProps) {
  const mounted = useClientMounted();
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
