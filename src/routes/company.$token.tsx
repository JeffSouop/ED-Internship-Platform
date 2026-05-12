import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { getToken } from "@/services/tokens";
import { getCompany, searchCompanies, upsertCompany } from "@/services/companies";
import { submitDeclaration } from "@/services/declarations";
import { currentIntake } from "@/lib/intake";
import { BENEFIT_OPTIONS, benefitLabel } from "@/lib/partner-form-benefits";
import { type Company, type LinkToken } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/company/$token")({
  component: CompanyPage,
});

const BUSINESS_ACTIVITIES = [
  "Hotel- Palace",
  "Bistronomic restaurant",
  "Gastronomic restaurant",
  "Michelin-star restaurant",
  "Pastry boutique - Boulangerie",
  "Autre",
] as const;

function CompanyPage() {
  const { token: tokenParam } = Route.useParams();
  const tokenQuery = useQuery({
    queryKey: ["token", tokenParam],
    queryFn: () => getToken(tokenParam),
  });
  if (tokenQuery.isLoading) return <Loading />;
  if (!tokenQuery.data || tokenQuery.data.kind !== "company") return <InvalidLink />;
  return <CompanyPageWithToken token={tokenQuery.data} />;
}

function CompanyPageWithToken({ token }: { token: LinkToken }) {
  const preselectQuery = useQuery({
    queryKey: ["company", token.refId],
    queryFn: () => (token.refId ? getCompany(token.refId) : Promise.resolve(undefined)),
    enabled: !!token.refId,
  });
  if (preselectQuery.isLoading && token.refId) return <Loading />;
  return <CompanyPartnerShell initialCompany={preselectQuery.data} />;
}

/** Formulaire partenaire : sans token (`/company`) ou avec jeton et pré-sélection éventuelle (`/company/:token`). */
export function CompanyPartnerShell({ initialCompany }: { initialCompany?: Company }) {
  const [phase, setPhase] = useState<"form" | "done">("form");
  const [savedCompany, setSavedCompany] = useState<Company | null>(null);

  return (
    <div className="min-h-screen bg-muted/40">
      <Header subtitle="Fiche entreprise d'accueil 26-27" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {phase === "form" && (
          <PartnerRegistrationForm
            initialCompany={initialCompany}
            onSuccess={(c) => {
              setSavedCompany(c);
              setPhase("done");
            }}
          />
        )}
        {phase === "done" && savedCompany && <Done company={savedCompany} />}
      </main>
    </div>
  );
}

type PartnerForm = {
  studentId: string;
  firstName: string;
  lastName: string;
  internshipType: "culinary" | "pastry" | "";
  startDate: string;
  endDate: string;
  legalName: string;
  country: string;
  tradeName: string;
  activity: string;
  siret: string;
  insuranceCompany: string;
  insurancePolicy: string;
  street: string;
  postalCode: string;
  city: string;
  website: string;
  hrName: string;
  hrTitle: string;
  hrEmail: string;
  hrPhone: string;
  tutorName: string;
  tutorPosition: string;
  tutorEmail: string;
  tutorPhone: string;
  weeklySchedule: "confirm" | "other" | "";
  weeklyScheduleComment: string;
  allowance: string;
  dataConsent: "yes" | "no" | "";
};

const emptyForm = (): PartnerForm => ({
  studentId: "",
  firstName: "",
  lastName: "",
  internshipType: "",
  startDate: "",
  endDate: "",
  legalName: "",
  country: "France",
  tradeName: "",
  activity: "",
  siret: "",
  insuranceCompany: "",
  insurancePolicy: "",
  street: "",
  postalCode: "",
  city: "",
  website: "",
  hrName: "",
  hrTitle: "",
  hrEmail: "",
  hrPhone: "",
  tutorName: "",
  tutorPosition: "",
  tutorEmail: "",
  tutorPhone: "",
  weeklySchedule: "",
  weeklyScheduleComment: "",
  allowance: "",
  dataConsent: "",
});

function PartnerRegistrationForm({
  initialCompany,
  onSuccess,
}: {
  initialCompany: Company | undefined;
  onSuccess: (c: Company) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PartnerForm>(() => emptyForm());
  const [benefits, setBenefits] = useState<string[]>([]);
  const [matched, setMatched] = useState<Company | null>(null);
  /** 1 = entreprise (autocomplétion), 2 = stagiaire, stage & conditions */
  const [formStep, setFormStep] = useState<1 | 2>(1);

  const hydratedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialCompany?.id || hydratedRef.current === initialCompany.id) return;
    hydratedRef.current = initialCompany.id;
    applyCompanyToForm(initialCompany);
    setMatched(initialCompany);
  }, [initialCompany]);

  function patch<K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyCompanyToForm(c: Company) {
    const hr = c.contacts[0];
    const tu = c.contacts[1];
    setForm((prev) => ({
      ...prev,
      legalName: c.name,
      country: c.country,
      tradeName: c.tradeName ?? "",
      activity: c.sector ?? "",
      siret: c.siret ?? "",
      insuranceCompany: c.insuranceCompany ?? "",
      insurancePolicy: c.insurancePolicy ?? "",
      street: c.address ?? "",
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
      website: c.website ?? "",
      hrName: hr?.name ?? "",
      hrTitle: hr?.role ?? "",
      hrEmail: hr?.email ?? "",
      hrPhone: hr?.phone ?? "",
      tutorName: tu?.name ?? "",
      tutorPosition: tu?.role ?? "",
      tutorEmail: tu?.email ?? "",
      tutorPhone: tu?.phone ?? "",
    }));
  }

  function applyMatch(c: Company) {
    setMatched(c);
    applyCompanyToForm(c);
  }

  function clearMatchAndEditName() {
    setMatched(null);
  }

  const searchName = form.legalName.trim();
  const suggestionsQuery = useQuery({
    queryKey: ["company-search", searchName, form.country.trim()],
    queryFn: () => searchCompanies(searchName, form.country.trim() || undefined),
    enabled: searchName.length >= 2 && !matched,
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });

  /** Pas de reconnaissance automatique par nom exact : ça appelait applyMatch et écrasait
   *  les champs déjà saisis avec les (souvent vides) données en base. La pré-saisie n’a lieu
   *  que si l’utilisateur clique une suggestion. */

  function toggleBenefit(id: string) {
    setBenefits((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const submitMut = useMutation({
    mutationFn: async () => {
      const position =
        form.internshipType === "pastry"
          ? "Pastry internship"
          : form.internshipType === "culinary"
            ? "Culinary internship"
            : "Internship";
      const companyPayload = {
        id: matched?.id,
        name: form.legalName.trim(),
        country: form.country.trim(),
        sector: form.activity,
        size: "",
        /** Toujours envoyer les clés (chaînes, éventuellement vides) : sinon JSON.stringify retire les
         *  `undefined` et le backend recevait une mise à jour partielle. */
        tradeName: form.tradeName.trim(),
        siret: form.siret.trim(),
        insuranceCompany: form.insuranceCompany.trim(),
        insurancePolicy: form.insurancePolicy.trim(),
        address: form.street.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        website: form.website.trim(),
        contacts: [
          {
            name: form.hrName,
            email: form.hrEmail,
            role: form.hrTitle,
            phone: form.hrPhone || undefined,
          },
          {
            name: form.tutorName,
            email: form.tutorEmail,
            role: form.tutorPosition,
            phone: form.tutorPhone || undefined,
          },
        ].filter((x) => x.email.trim()),
      };
      const company = await upsertCompany(companyPayload);
      await submitDeclaration({
        companyId: company.id,
        intake: currentIntake(),
        interns: [
          {
            studentId: form.studentId.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim().toUpperCase(),
            internshipType: form.internshipType || undefined,
            position,
            startDate: form.startDate,
            endDate: form.endDate,
            tutorName: form.tutorName,
            tutorEmail: form.tutorEmail,
            tutorPhone: form.tutorPhone || undefined,
          },
        ],
        partnerFormExtras: {
          weeklySchedule: form.weeklySchedule,
          weeklyScheduleComment:
            form.weeklySchedule === "other" ? form.weeklyScheduleComment : undefined,
          allowance: form.allowance,
          benefits,
          dataConsent: form.dataConsent,
        },
        partnerFormFullState: { ...form },
        partnerBenefitLabels: benefits.map(benefitLabel),
      });
      return company;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", c.id] });
      qc.invalidateQueries({ queryKey: ["declarations"] });
      qc.invalidateQueries({ queryKey: ["merged"] });
      toast.success("Fiche enregistrée. Merci !");
      onSuccess(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canProceedStep1 =
    form.legalName.trim() &&
    form.country.trim() &&
    form.tradeName.trim() &&
    form.activity &&
    form.siret.trim() &&
    form.insuranceCompany.trim() &&
    form.insurancePolicy.trim() &&
    form.street.trim() &&
    form.postalCode.trim() &&
    form.city.trim() &&
    form.hrName.trim() &&
    form.hrTitle.trim() &&
    form.hrEmail.trim() &&
    form.hrPhone.trim() &&
    form.tutorName.trim() &&
    form.tutorPosition.trim() &&
    form.tutorEmail.trim() &&
    form.tutorPhone.trim() &&
    form.hrEmail.trim().toLowerCase() !== form.tutorEmail.trim().toLowerCase();

  const canSubmit =
    canProceedStep1 &&
    form.studentId.trim() &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.internshipType &&
    form.startDate &&
    form.endDate &&
    form.weeklySchedule &&
    (form.weeklySchedule !== "other" || form.weeklyScheduleComment.trim()) &&
    form.allowance.trim() &&
    benefits.length > 0 &&
    form.dataConsent === "yes";

  return (
    <div className="space-y-10">
      <FormStepper step={formStep} />

      {formStep === 1 && (
        <>
      <header className="space-y-4 border-b border-border pb-8">
        <h1 className="text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
          ECOLE DUCASSE COMPANY INFORMATION
        </h1>
        <p className="text-lg font-medium text-foreground">
          FICHE DE RENSEIGNEMENTS POUR ENTREPRISES D&apos;ACCUEIL 26-27
        </p>
        <p className="text-sm italic text-muted-foreground">(English version below)</p>
        <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          <p>
            Cher partenaire,
            <br />
            Nous vous prions de bien vouloir remplir l&apos;ensemble des rubriques de ce formulaire, afin de
            nous permettre d&apos;éditer la convention de stage. Nous vous remercions pour votre
            collaboration.
          </p>
          <p className="font-medium">Département Carrière Développement de l&apos;Ecole Ducasse</p>
          <hr className="border-sky-200 dark:border-sky-800" />
          <p>
            Dear Partner,
            <br />
            Kindly complete all the fields on the Internship company form. It should take approximately ten
            minutes. Your responses will enable us to issue the internship agreement of the intern you will
            be hosting.
          </p>
          <p className="font-medium">
            Thank you in advance for your cooperation,
            <br />
            Ecole Ducasse&apos; Internship and Career Department
          </p>
        </div>
      </header>

      <section className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="border-b border-border pb-2 text-lg font-semibold">
          Entreprise — Section 3 · ABOUT THE COMPANY
        </h2>

        <Question n={7} required titleEn="Legal name of the company" titleFr="Nom légal de l'entreprise">
          <p className="mb-2 text-xs text-muted-foreground">
            Saisissez le nom légal puis sélectionnez une suggestion si votre entreprise est déjà en base.
          </p>
          <Input
            value={form.legalName}
            onChange={(e) => {
              patch("legalName", e.target.value);
              clearMatchAndEditName();
            }}
            autoComplete="organization"
          />
          {!matched && searchName.length >= 2 && (
            <div className="mt-3 rounded-md border border-stone-200/80 bg-[#FDF6F0] px-3 py-2.5 shadow-sm">
              <p className="text-xs font-medium text-stone-700">Suggestions :</p>
              {suggestionsQuery.isFetching && <p className="mt-2 text-xs text-stone-500">Recherche…</p>}
              {suggestionsQuery.data?.length === 0 && !suggestionsQuery.isFetching && (
                <p className="mt-2 text-xs text-stone-600">Aucune entreprise trouvée — complétez la fiche.</p>
              )}
              <ul className="mt-2 space-y-0.5">
                {(suggestionsQuery.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => applyMatch(c)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-stone-800 transition-colors hover:bg-stone-200/60"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="font-normal text-stone-700"> — {c.country}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {matched && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-medium">Entreprise reconnue — données préremplies. Vérifiez et complétez.</p>
              <p className="mt-2 text-xs font-normal leading-relaxed text-emerald-800/95">
                Seules les informations déjà stockées pour cette fiche sont reprises. Les champs encore vides
                n&apos;avaient pas été enregistrés (ou pas encore complétés) — remplissez-les avant la validation
                finale. Le RH et le tuteur doivent avoir des{" "}
                <strong>adresses e-mail différentes</strong>.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setMatched(null)}>
                Ce n&apos;est pas notre entreprise
              </Button>
            </div>
          )}
        </Question>

        <Question n={8} required titleEn="Trade name of the company" titleFr="Nom commercial de l'entreprise">
          <Input value={form.tradeName} onChange={(e) => patch("tradeName", e.target.value)} />
        </Question>

        <Question n={9} required titleEn="Your company's business activity" titleFr="Activité de l'entreprise">
          <Select value={form.activity} onValueChange={(v) => patch("activity", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_ACTIVITIES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Question>

        <Question
          n={10}
          required
          titleEn="Company’s legal registration number (e.g. French SIRET)"
          titleFr="Numéro de SIRET (ou équivalent)"
        >
          <Input value={form.siret} onChange={(e) => patch("siret", e.target.value)} />
        </Question>

        <Question n={11} required titleEn="Name of your insurance company" titleFr="Nom de la compagnie d'assurance">
          <Input value={form.insuranceCompany} onChange={(e) => patch("insuranceCompany", e.target.value)} />
        </Question>

        <Question n={12} required titleEn="Insurance policy number" titleFr="Numéro de police d'assurance">
          <Input value={form.insurancePolicy} onChange={(e) => patch("insurancePolicy", e.target.value)} />
        </Question>

        <Question n={13} required titleEn="Company address" titleFr="Adresse de l'entreprise">
          <Input value={form.street} onChange={(e) => patch("street", e.target.value)} />
        </Question>

        <Question n={14} required titleEn="Postal code" titleFr="Code postal">
          <Input value={form.postalCode} onChange={(e) => patch("postalCode", e.target.value)} />
        </Question>

        <Question n={15} required titleEn="City" titleFr="Ville">
          <Input value={form.city} onChange={(e) => patch("city", e.target.value)} />
        </Question>

        <div className="space-y-1.5">
          <Label className="text-sm">
            Pays / Country <span className="text-destructive">*</span>
          </Label>
          <Input value={form.country} onChange={(e) => patch("country", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Site web / Website</Label>
          <Input value={form.website} onChange={(e) => patch("website", e.target.value)} placeholder="https://…" />
        </div>
      </section>

      <section className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="border-b border-border pb-2 text-lg font-semibold">
          RH &amp; tuteur — Section 4 · COMPANY CONTACT DETAILS
        </h2>

        <Question
          n={16}
          required
          titleEn="Name of the HR representative (Ms./Mr., First Name SURNAME)"
          titleFr="Nom du représentant RH (Madame/Monsieur, Prénom NOM)"
        >
          <Input value={form.hrName} onChange={(e) => patch("hrName", e.target.value)} />
        </Question>

        <Question n={17} required titleEn="Title of the HR" titleFr="Titre du représentant RH">
          <Input value={form.hrTitle} onChange={(e) => patch("hrTitle", e.target.value)} />
        </Question>

        <Question n={18} required titleEn="HR email address" titleFr="Email du RH">
          <Input type="email" value={form.hrEmail} onChange={(e) => patch("hrEmail", e.target.value)} />
        </Question>

        <Question n={19} required titleEn="HR phone number" titleFr="Téléphone du RH">
          <Input type="tel" value={form.hrPhone} onChange={(e) => patch("hrPhone", e.target.value)} />
        </Question>

        <Question n={20} required titleEn="Name of the tutor chef" titleFr="Nom / prénom du chef ou cheffe tutrice">
          <Input value={form.tutorName} onChange={(e) => patch("tutorName", e.target.value)} />
        </Question>

        <Question n={21} required titleEn="Tutor chef's position" titleFr="Fonction du maître de stage">
          <Input value={form.tutorPosition} onChange={(e) => patch("tutorPosition", e.target.value)} />
        </Question>

        <Question n={22} required titleEn="Tutor chef's email" titleFr="Email du chef tutrice">
          <p className="mb-2 text-xs text-muted-foreground">
            Doit être différent de l&apos;e-mail RH (exigence technique de la base).
          </p>
          <Input type="email" value={form.tutorEmail} onChange={(e) => patch("tutorEmail", e.target.value)} />
        </Question>

        <Question n={23} required titleEn="Tutor chef's phone" titleFr="Téléphone du chef tutrice">
          <Input type="tel" value={form.tutorPhone} onChange={(e) => patch("tutorPhone", e.target.value)} />
        </Question>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:justify-end">
        <Button
          type="button"
          size="lg"
          disabled={!canProceedStep1}
          onClick={() => {
            setFormStep(2);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Continuer — stagiaire &amp; stage
        </Button>
      </div>
        </>
      )}

      {formStep === 2 && (
        <>
      <div className="rounded-xl border border-border bg-muted/40 p-5 shadow-sm">
        <p className="text-base font-semibold text-foreground">Étape 2 sur 2 — Stagiaire, stage et conditions</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez le stagiaire et les modalités d&apos;accueil, puis validez la fiche.
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-primary underline underline-offset-4"
          onClick={() => {
            setFormStep(1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ← Revenir à l&apos;entreprise, au RH et au tuteur
        </button>
      </div>

      <section className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="border-b border-border pb-2 text-lg font-semibold">
          Section 2 — A PROPOS DE L&apos;ETUDIANT · ABOUT THE STUDENT
        </h2>

        <Question n={1} required titleEn="Student ID (without blanks)" titleFr="Numéro d'identifiant (sans espaces)">
          <p className="mb-2 text-xs text-muted-foreground">
            Cet identifiant se trouve dans le mail que vous avez reçu ; il permet de rattacher votre déclaration
            au dossier de l&apos;étudiant (même numéro que sur la convention étudiant). — The student ID is
            specified in the email we sent you; it joins your declaration to the student record.
          </p>
          <Input value={form.studentId} onChange={(e) => patch("studentId", e.target.value)} placeholder="Entrez votre réponse" />
        </Question>

        <Question n={2} required titleEn="First name of the intern" titleFr="Prénom du stagiaire">
          <Input value={form.firstName} onChange={(e) => patch("firstName", e.target.value)} />
        </Question>

        <Question n={3} required titleEn="Last name of the intern (CAPITAL LETTERS)" titleFr="Nom de famille (lettres capitales)">
          <Input
            value={form.lastName}
            onChange={(e) => patch("lastName", e.target.value.toUpperCase())}
            className="uppercase"
          />
        </Question>

        <Question n={4} required titleEn="Type of internship" titleFr="Type de stage">
          <RadioGroup
            value={form.internshipType || undefined}
            onValueChange={(v) => patch("internshipType", v as PartnerForm["internshipType"])}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="culinary" id="it-cul-2" />
              <span>Culinary</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="pastry" id="it-pas-2" />
              <span>Pastry</span>
            </label>
          </RadioGroup>
        </Question>

        <Question n={5} required titleEn="Start date" titleFr="Date de début de stage">
          <p className="mb-2 text-xs text-amber-800 dark:text-amber-200">
            Make sure the start date is on Monday — la date de début doit être un lundi.
          </p>
          <Input type="date" value={form.startDate} onChange={(e) => patch("startDate", e.target.value)} />
        </Question>

        <Question n={6} required titleEn="End date" titleFr="Date de fin de stage">
          <div className="mb-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
            <p>Internship duration is 24 weeks for Bachelor, 13 weeks for any other program.</p>
            <p>End day is a Sunday — la date de fin de stage est un dimanche.</p>
          </div>
          <Input type="date" value={form.endDate} onChange={(e) => patch("endDate", e.target.value)} />
        </Question>
      </section>

      <section className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="border-b border-border pb-2 text-lg font-semibold">Section 5 — Conditions &amp; Benefits</h2>

        <Question n={24} required titleEn="Weekly schedule" titleFr="Planning hebdomadaire">
          <div className="mb-3 rounded-md border border-muted bg-muted/40 p-3 text-xs leading-relaxed">
            The weekly working hours are 39 hours per week, and the weekly schedule includes two consecutive
            days off.
            <br />
            Les heures de travail hebdomadaires sont de 39 heures par semaine et le planning inclut 2 jours
            consécutifs de repos.
          </div>
          <RadioGroup
            value={form.weeklySchedule}
            onValueChange={(v) => patch("weeklySchedule", v as PartnerForm["weeklySchedule"])}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="confirm" id="ws-y" />
              <span>I confirm — Je confirme</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="other" id="ws-o" />
              <span>Autre / Other</span>
            </label>
          </RadioGroup>
          {form.weeklySchedule === "other" && (
            <Textarea
              className="mt-2"
              placeholder="Commentaires / Comments"
              value={form.weeklyScheduleComment}
              onChange={(e) => patch("weeklyScheduleComment", e.target.value)}
              rows={3}
            />
          )}
        </Question>

        <Question n={25} required titleEn="Internship allowance (monthly or hourly)" titleFr="Gratification">
          <div className="mb-2 text-xs text-muted-foreground leading-relaxed">
            En France, la rémunération d&apos;un stagiaire est obligatoire au-delà de 8 semaines (minimum 4,50
            €/h). — In France, compensation is mandatory for internships lasting more than 8 weeks (min. €4.50/h).
          </div>
          <Input value={form.allowance} onChange={(e) => patch("allowance", e.target.value)} />
        </Question>

        <div className="space-y-3">
          <div className="text-sm leading-snug">
            <span className="font-medium text-foreground">26. </span>
            <span className="text-foreground">Benefits offered — Avantages offerts</span>
            <span className="text-destructive"> *</span>
          </div>
          <div className="max-w-xl space-y-2">
            {BENEFIT_OPTIONS.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                  checked={benefits.includes(b.id)}
                  onCheckedChange={() => toggleBenefit(b.id)}
                  className="mt-0.5"
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Question n={27} required titleEn="Consent to use your data for the internship agreement" titleFr="Consentement données">
          <RadioGroup
            value={form.dataConsent}
            onValueChange={(v) => patch("dataConsent", v as PartnerForm["dataConsent"])}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" id="dc-y" />
              <span>Yes — Oui</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" id="dc-n" />
              <span>No — Non</span>
            </label>
          </RadioGroup>
          <p className="mt-2 text-xs text-muted-foreground">
            La soumission n&apos;est possible qu&apos;avec « Oui » — submission requires consent (Yes).
          </p>
        </Question>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            setFormStep(1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Retour — entreprise &amp; contacts
        </Button>
        <Button size="lg" disabled={!canSubmit || submitMut.isPending} onClick={() => submitMut.mutate()}>
          {submitMut.isPending ? "Envoi…" : "Enregistrer la fiche"}
        </Button>
      </div>
        </>
      )}
    </div>
  );
}

function FormStepper({ step }: { step: 1 | 2 }) {
  return (
    <nav aria-label="Progression du formulaire" className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={`rounded-full px-3 py-1.5 font-medium ${
          step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        1 · Entreprise, RH &amp; tuteur
      </span>
      <span className="text-muted-foreground" aria-hidden>
        →
      </span>
      <span
        className={`rounded-full px-3 py-1.5 font-medium ${
          step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        2 · Stagiaire, stage &amp; conditions
      </span>
    </nav>
  );
}

function Question({
  n,
  titleEn,
  titleFr,
  required,
  children,
}: {
  n: number;
  titleEn: string;
  titleFr: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm leading-snug">
        <span className="font-medium text-foreground">{n}. </span>
        <span className="text-foreground">
          {titleEn} — {titleFr}
        </span>
        {required && <span className="text-destructive"> *</span>}
      </div>
      <div className="max-w-xl space-y-1.5">{children}</div>
    </div>
  );
}

function Done({ company }: { company: Company }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="mt-3 text-lg font-semibold text-emerald-900">Fiche enregistrée</h2>
      <p className="mt-2 text-sm text-emerald-800">
        Merci pour votre collaboration. L&apos;équipe Stages &amp; Carrière a bien reçu les informations pour{" "}
        <strong>{company.name}</strong>.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-serif text-primary-foreground">
            É
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">École Ducasse</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Chargement…
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Lien invalide</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ce lien d&apos;accès n&apos;est plus valide.</p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
