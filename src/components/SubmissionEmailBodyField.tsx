import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSubmissionEmailDraft } from "@/services/students";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Decision = "changes_requested" | "rejected";

type Props = {
  submissionId: string;
  value: string;
  onChange: (body: string) => void;
  enabled: boolean;
};

export function SubmissionEmailBodyField({ submissionId, value, onChange, enabled }: Props) {
  const [decision, setDecision] = useState<Decision>("changes_requested");

  const draft = useQuery({
    queryKey: ["submission-email-draft", submissionId, decision],
    queryFn: () => getSubmissionEmailDraft(submissionId, decision),
    enabled: enabled && !!submissionId,
  });

  useEffect(() => {
    if (!enabled) return;
    setDecision("changes_requested");
  }, [submissionId, enabled]);

  useEffect(() => {
    if (draft.data?.body && enabled) {
      onChange(draft.data.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange stable; apply when draft loads
  }, [draft.data?.body, enabled]);

  function loadTemplate(next: Decision) {
    setDecision(next);
  }

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label className="text-xs font-medium text-muted-foreground">
            Corps du message e-mail (envoyé tel quel à l’e-mail école de l’étudiant)
          </Label>
          {draft.data?.subject && (
            <p className="mt-1 text-xs text-muted-foreground">
              Objet : <span className="font-medium text-foreground">{draft.data.subject}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.isFetching}
            onClick={() => loadTemplate("changes_requested")}
          >
            Modèle modifications
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.isFetching}
            onClick={() => loadTemplate("rejected")}
          >
            Modèle refus
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={22}
        className="min-h-[420px] resize-y font-mono text-xs leading-relaxed"
        placeholder={draft.isLoading ? "Chargement du modèle…" : "Corps du message…"}
        disabled={draft.isLoading}
      />
      <p className="text-xs text-muted-foreground">
        Obligatoire pour « Demander des modifications » et « Refuser ». Vous pouvez modifier librement
        tout le texte (français, anglais, signature).
      </p>
    </section>
  );
}
