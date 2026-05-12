import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import { createToken, listTokens } from "@/services/tokens";
import { listStudents } from "@/services/students";
import { listCompanies } from "@/services/companies";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/links")({
  component: LinksPage,
});

function LinksPage() {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ["tokens"], queryFn: listTokens });
  const students = useQuery({ queryKey: ["students"], queryFn: listStudents });
  const companies = useQuery({ queryKey: ["companies"], queryFn: listCompanies });

  const [kind, setKind] = useState<"student" | "company">("student");
  const [refId, setRefId] = useState<string>("");
  const [label, setLabel] = useState("");

  const mutation = useMutation({
    mutationFn: () => createToken({ kind, refId: refId || undefined, label: label || "Sans étiquette" }),
    onSuccess: () => {
      toast.success("Lien créé.");
      qc.invalidateQueries({ queryKey: ["tokens"] });
      setLabel("");
      setRefId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Liens d&apos;accès</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les <strong>liens publics permanents</strong> ci-dessous sont identiques pour tout le monde (aucun
          jeton). Les liens personnalisés plus bas servent à rattacher un dossier déjà connu. Pour les
          entreprises, la mise en relation avec le dossier étudiant repose sur le{" "}
          <strong>numéro d&apos;étudiant</strong> indiqué dans la fiche partenaire.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-sm font-semibold text-foreground">Lien global — formulaire entreprise</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            À diffuser à tous les partenaires : même URL pour tout le monde. Pas besoin de créer un jeton.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs sm:text-sm">
              {baseUrl}/company
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(`${baseUrl}/company`);
                toast.success("Lien entreprise copié");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copier
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-sm font-semibold text-foreground">Lien global — convention de stage (étudiants)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            À diffuser à tous les étudiants : même URL pour tout le monde. Identification via le numéro
            d&apos;étudiant sur le formulaire — pas besoin de créer un jeton.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs sm:text-sm">
              {baseUrl}/student/convention
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(`${baseUrl}/student/convention`);
                toast.success("Lien étudiant copié");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copier
            </Button>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Nouveau lien personnalisé</h2>
        <p className="text-xs text-muted-foreground">
          Étudiant : lien avec rattachement au dossier — sinon utilisez le lien global{" "}
          <code className="rounded bg-muted px-1">/student/convention</code>. Entreprise : uniquement pour
          pré-remplir une fiche déjà en base — sinon utilisez{" "}
          <code className="rounded bg-muted px-1">/company</code>.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as "student" | "company"); setRefId(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Étudiant</SelectItem>
                <SelectItem value="company">Entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {kind === "student" ? "Étudiant (optionnel)" : "Entreprise (obligatoire)"}
            </Label>
            <Select
              value={kind === "student" ? refId || "none" : refId || ""}
              onValueChange={(v) => setRefId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={kind === "company" ? "Choisir…" : "Aucun"} />
              </SelectTrigger>
              <SelectContent>
                {kind === "student" && <SelectItem value="none">— Aucun (nouveau)</SelectItem>}
                {kind === "student"
                  ? (students.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.id})
                      </SelectItem>
                    ))
                  : (companies.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Étiquette</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Camille Dubois — Feb 2026"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (kind === "company" && !refId)}
          >
            Générer le lien
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Étiquette</th>
              <th className="px-4 py-3 text-left">URL</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(tokens.data ?? []).map((t) => {
              const url = `${baseUrl}/${t.kind}/${t.token}`;
              return (
                <tr key={t.token} className="hover:bg-secondary/50">
                  <td className="px-4 py-3 capitalize">{t.kind}</td>
                  <td className="px-4 py-3">{t.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{url}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Lien copié");
                      }}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
