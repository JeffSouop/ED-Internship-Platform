import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { CompanyDetailBody } from "@/components/CompanyDetailBody";
import { CompanyEditForm } from "@/components/CompanyEditForm";
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
import { deleteCompany, getCompany } from "@/services/companies";
import { listDeclarationsForCompany } from "@/services/declarations";

export const Route = createFileRoute("/admin/companies/$id")({
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const c = useQuery({ queryKey: ["company", id], queryFn: () => getCompany(id) });
  const decls = useQuery({
    queryKey: ["declarations", id],
    queryFn: () => listDeclarationsForCompany(id),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["declarations"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      qc.invalidateQueries({ queryKey: ["tokens"] });
      toast.success("Entreprise supprimée.");
      setConfirmDelete(false);
      navigate({ to: "/admin/companies" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (c.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!c.data) return <p className="text-sm text-muted-foreground">Entreprise introuvable.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/admin/companies"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Modifier la fiche
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <CompanyEditForm
          company={c.data}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await c.refetch();
          }}
        />
      ) : (
        <CompanyDetailBody
          company={c.data}
          declarations={decls.data}
          declarationsLoading={decls.isLoading}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              Action définitive : fiche, contacts, déclarations de stagiaires et jetons liés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
