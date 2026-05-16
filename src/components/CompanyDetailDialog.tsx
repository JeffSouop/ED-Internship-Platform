import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteCompany, getCompany } from "@/services/companies";
import { listDeclarationsForCompany } from "@/services/declarations";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  companyId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function CompanyDetailDialog({ companyId, onOpenChange }: Props) {
  const open = companyId !== null;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [companyId]);

  const c = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId!),
    enabled: open && !!companyId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const decls = useQuery({
    queryKey: ["declarations", companyId],
    queryFn: () => listDeclarationsForCompany(companyId!),
    enabled: open && !!companyId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCompany(companyId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["declarations"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      qc.invalidateQueries({ queryKey: ["tokens"] });
      qc.removeQueries({ queryKey: ["company", companyId] });
      toast.success("Entreprise supprimée.");
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      {open && companyId ? (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,880px)] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="overflow-y-auto px-6 pb-4 pt-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>Détail entreprise</DialogTitle>
              <DialogDescription>
                Informations enregistrées dans la base — vous restez sur la liste.
              </DialogDescription>
            </DialogHeader>

            {c.isLoading && (
              <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
            )}
            {c.isError && (
              <p className="mt-6 text-sm text-destructive">Impossible de charger cette entreprise.</p>
            )}
            {c.data && (
              <div className="mt-4 space-y-4">
                {!editing && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
                      Modifier la fiche
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Supprimer l&apos;entreprise
                    </Button>
                  </div>
                )}
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
                    compact
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive : la fiche, les contacts liés et les déclarations de stagiaires
              associées seront supprimés (conformément aux règles de la base). Les jetons d&apos;accès
              entreprise pointant vers cette fiche seront aussi retirés.
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
    </>
  );
}
