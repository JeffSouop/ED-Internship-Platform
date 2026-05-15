import type { SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const labels: Record<SubmissionStatus, string> = {
  pending: "En attente",
  changes_requested: "Modifications demandées",
  approved: "Approuvé",
  rejected: "Refusé",
  superseded: "Remplacé (historique)",
};

const styles: Record<SubmissionStatus, string> = {
  pending: "bg-secondary text-secondary-foreground border-border",
  changes_requested: "bg-accent/20 text-accent-foreground border-accent/40",
  approved: "bg-success-muted text-success-muted-foreground border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  superseded: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
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
