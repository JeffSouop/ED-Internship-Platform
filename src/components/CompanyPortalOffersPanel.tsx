import { useCallback, useEffect, useState } from "react";
import { Briefcase, Loader2, Plus, Trash2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFER_TYPE_LABELS, offerTypeLabel } from "@/lib/internship-offer-labels";
import type { InternshipOffer, InternshipOfferType } from "@/lib/types";
import {
  createCompanyInternshipOffer,
  deleteCompanyInternshipOffer,
  fetchCompanyInternshipOffers,
} from "@/services/internship-offers";

type Props = {
  defaultContactEmail?: string;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  offerType: "stage" as InternshipOfferType,
  location: "",
  contractLabel: "",
  duration: "",
  startDate: "",
  contactEmail: "",
};

export function CompanyPortalOffersPanel({ defaultContactEmail }: Props) {
  const [offers, setOffers] = useState<InternshipOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, contactEmail: defaultContactEmail ?? "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCompanyInternshipOffers();
      setOffers(data);
    } catch {
      setError("Impossible de charger vos offres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createCompanyInternshipOffer({
        title: form.title,
        description: form.description,
        offerType: form.offerType,
        location: form.location || undefined,
        contractLabel: form.contractLabel || undefined,
        duration: form.duration || undefined,
        startDate: form.startDate || undefined,
        contactEmail: form.contactEmail || undefined,
      });
      setOffers((prev) => [created, ...prev]);
      setForm({ ...EMPTY_FORM, contactEmail: defaultContactEmail ?? "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setError("");
    try {
      await deleteCompanyInternshipOffer(deleteId);
      setOffers((prev) => prev.filter((o) => o.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Briefcase className="h-5 w-5 text-primary" />
            Vos offres de stage
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publiez des opportunités visibles sur la rubrique publique « Offres de stage ». Vous
            pouvez les retirer à tout moment.
          </p>
        </div>
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle offre
          </Button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void handlePublish(e)}
          className="space-y-5 rounded-2xl border border-primary/20 bg-card p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            Publier une offre
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="offer-title">Intitulé du poste *</Label>
              <Input
                id="offer-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex. Commis de cuisine — stage 6 mois"
                required
                minLength={3}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="offer-type">Type</Label>
              <select
                id="offer-type"
                value={form.offerType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, offerType: e.target.value as InternshipOfferType }))
                }
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(OFFER_TYPE_LABELS) as InternshipOfferType[]).map((k) => (
                  <option key={k} value={k}>
                    {OFFER_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="offer-location">Lieu</Label>
              <Input
                id="offer-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Paris 16e, Monaco…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="offer-duration">Durée</Label>
              <Input
                id="offer-duration"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="6 mois, 3 à 6 mois…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="offer-contract">Contrat / convention</Label>
              <Input
                id="offer-contract"
                value={form.contractLabel}
                onChange={(e) => setForm((f) => ({ ...f, contractLabel: e.target.value }))}
                placeholder="Convention de stage, CDD…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="offer-start">Début souhaité</Label>
              <Input
                id="offer-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="offer-contact">E-mail de candidature</Label>
              <Input
                id="offer-contact"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="rh@votre-etablissement.fr"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="offer-desc">Description *</Label>
              <Textarea
                id="offer-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Missions, profil recherché, horaires, avantages…"
                required
                minLength={20}
                rows={6}
                className="mt-1.5 resize-y"
              />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 20 caractères.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publier l&apos;offre
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                setForm({ ...EMPTY_FORM, contactEmail: defaultContactEmail ?? "" });
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de vos offres…
        </p>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-foreground">Aucune offre publiée</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos opportunités apparaîtront ici et sur la page publique des offres de stage.
          </p>
          {!showForm && (
            <Button type="button" className="mt-6" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer votre première offre
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {offerTypeLabel(offer.offerType)}
                    {offer.location ? ` · ${offer.location}` : ""}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-foreground">{offer.title}</h4>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {offer.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Publiée le{" "}
                    {new Date(offer.publishedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteId(offer.id)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette offre ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;offre disparaîtra immédiatement de la rubrique publique. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
