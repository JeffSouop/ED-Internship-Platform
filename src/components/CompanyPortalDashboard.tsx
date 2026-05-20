import { useState, type ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Globe2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Shield,
  Users,
} from "lucide-react";

import { CompanyEditForm } from "@/components/CompanyEditForm";
import { CompanyPortalOffersPanel } from "@/components/CompanyPortalOffersPanel";
import { companyDisplayName } from "@/lib/company-display";
import type { Company } from "@/lib/types";
import type { CompanyPortalSession } from "@/services/company-portal-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  session: CompanyPortalSession;
  onLogout: () => void;
  onCompanyUpdated: (company: Company) => void;
};

export function CompanyPortalDashboard({ session, onLogout, onCompanyUpdated }: Props) {
  const [company, setCompany] = useState(session.company);
  const [editing, setEditing] = useState(false);
  const displayName = companyDisplayName(company);
  const hr = company.contacts[0];
  const tutor = company.contacts[1];

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <div className="border-b border-primary/20 bg-gradient-to-r from-primary via-[#1a5270] to-[#0f2d4a] text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
              Espace partenaire
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{displayName}</h1>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Connecté en tant que{" "}
              <span className="font-medium text-primary-foreground">
                {session.user.contactName || session.user.email}
              </span>
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 border-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
            onClick={() => void onLogout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Tabs defaultValue="fiche" className="space-y-8">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="fiche" className="gap-2 px-4 py-2">
              <Building2 className="h-4 w-4" />
              Fiche établissement
            </TabsTrigger>
            <TabsTrigger value="offres" className="gap-2 px-4 py-2">
              <Briefcase className="h-4 w-4" />
              Offres de stage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fiche" className="mt-0 space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Votre fiche établissement</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consultez et mettez à jour les informations visibles par l&apos;équipe carrière de
              l&apos;École Ducasse.
            </p>
          </div>
          {!editing && (
            <Button type="button" onClick={() => setEditing(true)} className="shrink-0">
              <Pencil className="mr-2 h-4 w-4" />
              Modifier la fiche
            </Button>
          )}
        </div>

        {editing ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <CompanyEditForm
              company={company}
              portalMode
              onCancel={() => setEditing(false)}
              onSaved={(c) => {
                setCompany(c);
                setEditing(false);
                onCompanyUpdated(c);
              }}
            />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                <Building2 className="h-4 w-4" />
                Identité légale
              </h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info label="Raison sociale" value={company.name} />
                <Info label="Nom commercial" value={company.tradeName} />
                <Info label="Pays" value={company.country} />
                <Info label="Secteur" value={company.sector} />
                <Info label="Effectif" value={company.size} />
                <Info label="SIRET" value={company.siret} />
              </dl>
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                <MapPin className="h-4 w-4" />
                Coordonnées
              </h3>
              <dl className="space-y-3">
                <Info label="Adresse" value={company.address} />
                <Info
                  label="Ville"
                  value={[company.postalCode, company.city].filter(Boolean).join(" ") || undefined}
                />
                <Info
                  label="Site web"
                  value={company.website}
                  icon={<Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                />
              </dl>
            </section>

            <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                <Shield className="h-4 w-4" />
                Assurance & contacts
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <dl className="space-y-3">
                  <Info label="Assureur" value={company.insuranceCompany} />
                  <Info label="N° de police" value={company.insurancePolicy} />
                </dl>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ContactCard
                    title="Référent RH"
                    name={hr?.name}
                    role={hr?.role}
                    email={hr?.email}
                    phone={hr?.phone}
                  />
                  <ContactCard
                    title="Tuteur / maître de stage"
                    name={tutor?.name}
                    role={tutor?.role}
                    email={tutor?.email}
                    phone={tutor?.phone}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
          </TabsContent>

          <TabsContent value="offres" className="mt-0">
            <CompanyPortalOffersPanel
              defaultContactEmail={hr?.email || session.user.email}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-start gap-1.5 text-sm font-medium text-foreground">
        {icon}
        <span>{value?.trim() ? value : "—"}</span>
      </dd>
    </div>
  );
}

function ContactCard({
  title,
  name,
  role,
  email,
  phone,
}: {
  title: string;
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <Users className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="mt-3 text-sm font-semibold text-foreground">{name?.trim() || "—"}</p>
      {role?.trim() ? <p className="text-xs text-muted-foreground">{role}</p> : null}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        {email?.trim() || "—"}
      </p>
      {phone?.trim() ? (
        <p className="mt-1 text-xs text-muted-foreground">{phone}</p>
      ) : null}
    </div>
  );
}
