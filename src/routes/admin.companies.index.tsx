import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { CompanyDetailDialog } from "@/components/CompanyDetailDialog";
import { deleteCompany, listCompanies } from "@/services/companies";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/companies/")({
  component: CompaniesPage,
});

function CompaniesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["companies"], queryFn: listCompanies });
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const values = new Set((q.data ?? []).map((c) => c.country).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }, [q.data]);

  const sectorOptions = useMemo(() => {
    const values = new Set((q.data ?? []).map((c) => c.sector).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }, [q.data]);

  const rows = useMemo(() => {
    let list = q.data ?? [];
    if (country !== "all") {
      list = list.filter((c) => c.country === country);
    }
    if (sector !== "all") {
      list = list.filter((c) => c.sector === sector);
    }
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const trade = (c.tradeName ?? "").toLowerCase();
      return name.includes(s) || trade.includes(s);
    });
  }, [q.data, search, country, sector]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["declarations"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      qc.invalidateQueries({ queryKey: ["tokens"] });
      qc.removeQueries({ queryKey: ["company", id] });
      toast.success("Entreprise supprimée.");
      setPendingDeleteId(null);
      if (detailCompanyId === id) setDetailCompanyId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingDeleteName = pendingDeleteId
    ? (q.data ?? []).find((x) => x.id === pendingDeleteId)?.name
    : undefined;

  return (
    <div className="space-y-6">
      <CompanyDetailDialog
        companyId={detailCompanyId}
        onOpenChange={(open) => {
          if (!open) setDetailCompanyId(null);
        }}
      />

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteName ? (
                <>
                  <span className="font-medium text-foreground">{pendingDeleteName}</span> sera définitivement
                  retirée de la base (contacts, déclarations et jetons associés inclus).
                </>
              ) : (
                "Cette entreprise sera définitivement retirée de la base."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => pendingDeleteId && deleteMut.mutate(pendingDeleteId)}
            >
              {deleteMut.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entreprises partenaires</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toutes les entreprises présentes dans votre base. Ouvrez une fiche pour modifier ou supprimer.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger aria-label="Filtrer par pays">
                <SelectValue placeholder="Pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pays</SelectItem>
                {countryOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[12rem] max-w-xs flex-1 sm:max-w-[16rem]">
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger aria-label="Filtrer par secteur">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les secteurs</SelectItem>
                {sectorOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom…"
            className="w-64"
          />
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Pays</th>
              <th className="px-4 py-3 text-left">Secteur</th>
              <th className="px-4 py-3 text-left">Effectif</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to="/admin/companies/$id"
                    params={{ id: c.id }}
                    className="text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.country}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.sector}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.size}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.contacts[0]?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-primary"
                      onClick={() => setDetailCompanyId(c.id)}
                    >
                      Détail
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Supprimer"
                      onClick={() => setPendingDeleteId(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune entreprise.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
