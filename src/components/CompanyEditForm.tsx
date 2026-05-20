import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { Company } from "@/lib/types";
import { upsertCompany } from "@/services/companies";
import { updatePortalCompany } from "@/services/company-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  company: Company;
  onCancel: () => void;
  onSaved: (c: Company) => void;
  /** Enregistrement via l’API espace entreprise (session RH). */
  portalMode?: boolean;
};

export function CompanyEditForm({ company, onCancel, onSaved, portalMode = false }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(company.name);
  const [tradeName, setTradeName] = useState(company.tradeName ?? "");
  const [country, setCountry] = useState(company.country);
  const [sector, setSector] = useState(company.sector ?? "");
  const [size, setSize] = useState(company.size ?? "");
  const [siret, setSiret] = useState(company.siret ?? "");
  const [insuranceCompany, setInsuranceCompany] = useState(company.insuranceCompany ?? "");
  const [insurancePolicy, setInsurancePolicy] = useState(company.insurancePolicy ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [postalCode, setPostalCode] = useState(company.postalCode ?? "");
  const [city, setCity] = useState(company.city ?? "");
  const [website, setWebsite] = useState(company.website ?? "");

  const hr = company.contacts[0];
  const tu = company.contacts[1];
  const [hrName, setHrName] = useState(hr?.name ?? "");
  const [hrTitle, setHrTitle] = useState(hr?.role ?? "");
  const [hrEmail, setHrEmail] = useState(hr?.email ?? "");
  const [hrPhone, setHrPhone] = useState(hr?.phone ?? "");
  const [tutorName, setTutorName] = useState(tu?.name ?? "");
  const [tutorPosition, setTutorPosition] = useState(tu?.role ?? "");
  const [tutorEmail, setTutorEmail] = useState(tu?.email ?? "");
  const [tutorPhone, setTutorPhone] = useState(tu?.phone ?? "");

  useEffect(() => {
    const h = company.contacts[0];
    const t = company.contacts[1];
    setName(company.name);
    setTradeName(company.tradeName ?? "");
    setCountry(company.country);
    setSector(company.sector ?? "");
    setSize(company.size ?? "");
    setSiret(company.siret ?? "");
    setInsuranceCompany(company.insuranceCompany ?? "");
    setInsurancePolicy(company.insurancePolicy ?? "");
    setAddress(company.address ?? "");
    setPostalCode(company.postalCode ?? "");
    setCity(company.city ?? "");
    setWebsite(company.website ?? "");
    setHrName(h?.name ?? "");
    setHrTitle(h?.role ?? "");
    setHrEmail(h?.email ?? "");
    setHrPhone(h?.phone ?? "");
    setTutorName(t?.name ?? "");
    setTutorPosition(t?.role ?? "");
    setTutorEmail(t?.email ?? "");
    setTutorPhone(t?.phone ?? "");
  }, [company]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !country.trim()) {
        throw new Error("Nom légal et pays sont obligatoires.");
      }
      const he = hrEmail.trim().toLowerCase();
      const te = tutorEmail.trim().toLowerCase();
      if (he && te && he === te) {
        throw new Error("Les e-mails RH et tuteur doivent être différents.");
      }
      const contacts = [
        {
          name: hrName.trim(),
          email: hrEmail.trim(),
          role: hrTitle.trim(),
          phone: hrPhone.trim() || undefined,
        },
        {
          name: tutorName.trim(),
          email: tutorEmail.trim(),
          role: tutorPosition.trim(),
          phone: tutorPhone.trim() || undefined,
        },
      ].filter((x) => x.email.length > 0);

      const payload = {
        id: company.id,
        name: name.trim(),
        country: country.trim(),
        sector: sector.trim(),
        size: size.trim(),
        tradeName: tradeName.trim(),
        siret: siret.trim(),
        insuranceCompany: insuranceCompany.trim(),
        insurancePolicy: insurancePolicy.trim(),
        address: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        website: website.trim(),
        contacts,
      };

      return portalMode ? updatePortalCompany(payload) : upsertCompany(payload);
    },
    onSuccess: (c) => {
      if (!portalMode) {
        qc.invalidateQueries({ queryKey: ["companies"] });
        qc.invalidateQueries({ queryKey: ["company", company.id] });
        qc.invalidateQueries({ queryKey: ["declarations"] });
        qc.invalidateQueries({ queryKey: ["merged"] });
      } else {
        qc.invalidateQueries({ queryKey: ["company-portal"] });
      }
      toast.success("Fiche entreprise mise à jour.");
      onSaved(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldClass = "grid gap-4 sm:grid-cols-2";

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        Modifiez les champs puis enregistrez. Les changements remplacent les données en base pour cette
        entreprise.
      </p>

      <div className={fieldClass}>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="co-name">Nom légal</Label>
          <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-trade">Nom commercial</Label>
          <Input id="co-trade" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-country">Pays</Label>
          <Input id="co-country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-sector">Activité / secteur</Label>
          <Input id="co-sector" value={sector} onChange={(e) => setSector(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-size">Effectif</Label>
          <Input id="co-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="ex. 11-50" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-siret">SIRET / identifiant</Label>
          <Input id="co-siret" value={siret} onChange={(e) => setSiret(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-ins">Assurance (organisme)</Label>
          <Input id="co-ins" value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-pol">N° contrat / police</Label>
          <Input id="co-pol" value={insurancePolicy} onChange={(e) => setInsurancePolicy(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="co-addr">Adresse (voie)</Label>
          <Input id="co-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-postal">Code postal</Label>
          <Input id="co-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-city">Ville</Label>
          <Input id="co-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="co-web">Site web</Label>
          <Input id="co-web" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</p>
        <div className={fieldClass}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hr-name">RH — nom</Label>
            <Input id="hr-name" value={hrName} onChange={(e) => setHrName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr-title">RH — fonction</Label>
            <Input id="hr-title" value={hrTitle} onChange={(e) => setHrTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr-email">RH — e-mail</Label>
            <Input id="hr-email" type="email" value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hr-phone">RH — téléphone</Label>
            <Input id="hr-phone" type="tel" value={hrPhone} onChange={(e) => setHrPhone(e.target.value)} />
          </div>
        </div>
        <div className={fieldClass}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tu-name">Tuteur — nom</Label>
            <Input id="tu-name" value={tutorName} onChange={(e) => setTutorName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tu-role">Tuteur — fonction</Label>
            <Input id="tu-role" value={tutorPosition} onChange={(e) => setTutorPosition(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tu-email">Tuteur — e-mail</Label>
            <Input id="tu-email" type="email" value={tutorEmail} onChange={(e) => setTutorEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tu-phone">Tuteur — téléphone</Label>
            <Input id="tu-phone" type="tel" value={tutorPhone} onChange={(e) => setTutorPhone(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Si les deux e-mails sont renseignés, ils doivent être distincts (contrainte base de données).
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
