import type { ReactNode } from "react";

import type { Company, CompanyDeclaration } from "@/lib/types";
import { benefitLabel } from "@/lib/partner-form-benefits";

function dash(v: string | undefined | null): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? v! : "—";
}

function WeeklyScheduleBlock({ extras }: { extras: Record<string, unknown> }) {
  const ws = extras.weeklySchedule;
  const raw = typeof ws === "string" ? ws : "";
  let label = "—";
  if (raw === "confirm") label = "Conforme aux horaires indiqués par l’école / As per school schedule";
  else if (raw === "other") label = "Autre / Other";
  else if (raw) label = raw;
  const comment =
    typeof extras.weeklyScheduleComment === "string" ? extras.weeklyScheduleComment.trim() : "";

  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
        <span className="text-xs font-medium text-muted-foreground sm:w-52 sm:shrink-0">
          Emploi du temps hebdomadaire / Weekly schedule
        </span>
        <span className="text-foreground">{label}</span>
      </div>
      {raw === "other" && comment && (
        <p className="mt-1 whitespace-pre-wrap pl-2 text-xs text-muted-foreground sm:ml-52">{comment}</p>
      )}
    </div>
  );
}

function PartnerFormExtrasSection({ extras }: { extras: Record<string, unknown> | undefined }) {
  if (!extras || Object.keys(extras).length === 0) return null;

  const allowance = typeof extras.allowance === "string" ? extras.allowance.trim() : "";
  const dataConsent = typeof extras.dataConsent === "string" ? extras.dataConsent : "";
  const benefitsRaw = extras.benefits;
  const benefitIds = Array.isArray(benefitsRaw)
    ? benefitsRaw.filter((x): x is string => typeof x === "string")
    : [];

  const hasSchedule =
    extras.weeklySchedule !== undefined &&
    extras.weeklySchedule !== null &&
    `${extras.weeklySchedule}`.trim() !== "";
  const hasAllowance = !!allowance;
  const hasBenefits = benefitIds.length > 0;
  const hasConsent = dataConsent === "yes" || dataConsent === "no";

  if (!hasSchedule && !hasAllowance && !hasBenefits && !hasConsent) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Modalités &amp; conditions (formulaire partenaire)
      </p>
      {hasSchedule && <WeeklyScheduleBlock extras={extras} />}
      {hasAllowance && (
        <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2">
          <span className="text-xs font-medium text-muted-foreground sm:w-52 sm:shrink-0">
            Indemnité / Allowance
          </span>
          <span className="whitespace-pre-wrap text-foreground">{allowance}</span>
        </div>
      )}
      {hasBenefits && (
        <div className="text-sm">
          <p className="text-xs font-medium text-muted-foreground">Avantages cochés / Selected benefits</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-foreground">
            {benefitIds.map((id) => (
              <li key={id}>{benefitLabel(id)}</li>
            ))}
          </ul>
        </div>
      )}
      {hasConsent && (
        <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2">
          <span className="text-xs font-medium text-muted-foreground sm:w-52 sm:shrink-0">
            Consentement données personnelles / Data consent
          </span>
          <span className="text-foreground">
            {dataConsent === "yes" ? "Oui / Yes" : dataConsent === "no" ? "Non / No" : dataConsent}
          </span>
        </div>
      )}
    </div>
  );
}

function internshipTypeLabel(t?: string): string {
  if (!t?.trim()) return "—";
  if (t === "culinary") return "Cuisine / Culinary";
  if (t === "pastry") return "Pâtisserie / Pastry";
  return t;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="text-xs font-medium text-muted-foreground sm:w-52 sm:shrink-0">{label}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

type Props = {
  company: Company;
  declarations?: CompanyDeclaration[];
  declarationsLoading?: boolean;
  /** cadre visuel type dialogue admin */
  compact?: boolean;
};

export function CompanyDetailBody({
  company: c,
  declarations,
  declarationsLoading,
  compact = false,
}: Props) {
  const sectionClass = compact
    ? "rounded-lg border border-border bg-muted/30 p-4"
    : "rounded-lg border border-border bg-card p-6";

  const web = c.website?.trim();
  const href =
    web && (web.startsWith("http://") || web.startsWith("https://")) ? web : web ? `https://${web}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{c.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Identifiant : {c.id}</p>
      </div>

      <section className={sectionClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Identité &amp; activité
        </h3>
        <div className="mt-3 space-y-2">
          <DetailRow label="Nom commercial / Trade name">{dash(c.tradeName)}</DetailRow>
          <DetailRow label="Pays / Country">{dash(c.country)}</DetailRow>
          <DetailRow label="Activité / Sector">{dash(c.sector)}</DetailRow>
          <DetailRow label="Effectif / Headcount">{dash(c.size)}</DetailRow>
          <DetailRow label="SIRET / ID">{dash(c.siret)}</DetailRow>
          <DetailRow label="Assurance (organisme)">{dash(c.insuranceCompany)}</DetailRow>
          <DetailRow label="N° contrat / police">{dash(c.insurancePolicy)}</DetailRow>
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Adresse &amp; site web
        </h3>
        <div className="mt-3 space-y-2">
          <DetailRow label="Adresse (voie)">{dash(c.address)}</DetailRow>
          <DetailRow label="Code postal">{dash(c.postalCode)}</DetailRow>
          <DetailRow label="Ville">{dash(c.city)}</DetailRow>
          <DetailRow label="Site web">
            {web ? (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                {c.website}
              </a>
            ) : (
              "—"
            )}
          </DetailRow>
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {c.contacts.map((co, i) => (
            <li
              key={`${co.email}-${i}`}
              className="border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <p className="font-medium text-foreground">
                {co.name}
                {co.role ? ` — ${co.role}` : ""}
              </p>
              <p>
                <a href={`mailto:${co.email}`} className="text-primary hover:underline">
                  {co.email}
                </a>
              </p>
              {co.phone && <p className="text-xs text-muted-foreground">Tél. {co.phone}</p>}
            </li>
          ))}
          {c.contacts.length === 0 && <li className="text-muted-foreground">Aucun contact renseigné.</li>}
        </ul>
      </section>

      {declarations !== undefined && (
        <section className={sectionClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Déclarations de stagiaires
          </h3>
          {declarationsLoading && (
            <p className="mt-3 text-sm text-muted-foreground">Chargement des déclarations…</p>
          )}
          {!declarationsLoading && declarations.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">Aucune déclaration enregistrée.</p>
          )}
          {!declarationsLoading && declarations.length > 0 && (
            <div className="mt-3 space-y-4">
              {declarations.map((d) => (
                <div key={d.id} className="rounded-md border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">Rentrée {d.intake}</p>
                  <p className="text-xs text-muted-foreground">
                    Soumise le {new Date(d.submittedAt).toLocaleString("fr-FR")}
                  </p>

                  <PartnerFormExtrasSection extras={d.partnerFormExtras} />

                  <ul className="mt-3 space-y-3 text-sm">
                    {d.interns.map((intern) => (
                      <li key={intern.studentId} className="rounded border border-border/80 bg-muted/20 p-2">
                        <p className="font-mono text-xs text-muted-foreground">{intern.studentId}</p>
                        <p className="font-medium text-foreground">
                          {[intern.firstName, intern.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Parcours / Track : {internshipTypeLabel(intern.internshipType)}
                        </p>
                        <p className="mt-1">
                          <span className="text-muted-foreground">Poste / Position :</span> {intern.position}
                        </p>
                        <p className="text-muted-foreground">
                          {intern.startDate} → {intern.endDate}
                        </p>
                        <div className="mt-2 border-t border-border pt-2 text-xs">
                          <p className="font-medium text-foreground">Tuteur en entreprise</p>
                          <p>{dash(intern.tutorName)}</p>
                          {intern.tutorEmail ? (
                            <a href={`mailto:${intern.tutorEmail}`} className="text-primary hover:underline">
                              {intern.tutorEmail}
                            </a>
                          ) : (
                            <p className="text-muted-foreground">—</p>
                          )}
                          {intern.tutorPhone && <p className="text-muted-foreground">Tél. {intern.tutorPhone}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
