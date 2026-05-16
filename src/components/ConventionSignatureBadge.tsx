import type { ConventionTrackingStatus } from "@/services/convention-tracking";
import { cn } from "@/lib/utils";

const labels: Record<ConventionTrackingStatus, string> = {
  not_sent: "Non envoyée",
  pending_signature: "En attente de signature",
  signed: "Signée",
  declined: "Refusée / annulée",
};

const styles: Record<ConventionTrackingStatus, string> = {
  not_sent: "bg-muted text-muted-foreground border-border",
  pending_signature: "bg-accent/20 text-accent-foreground border-accent/40",
  signed: "bg-success-muted text-success-muted-foreground border-success/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
};

export function ConventionSignatureBadge({
  status,
  className,
}: {
  status: ConventionTrackingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
