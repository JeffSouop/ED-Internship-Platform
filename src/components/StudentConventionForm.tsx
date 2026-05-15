import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";

import { getStudent, getSubmissionByStudent, upsertStudentSubmission } from "@/services/students";
import { INTAKES, type Intake } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudentConventionFormProps = {
  /** Préremplissage depuis un ancien lien magique (?t=…). */
  prefillStudentId?: string;
  /** Si true (défaut), redirection vers `/student/merci` après envoi réussi. */
  redirectAfterSubmit?: boolean;
};

/** Libellés alignés sur `backend/db/schema.sql` (programme.name) pour `programmeLabelToCode`. */
const PROGRAMMES = [
  "Bachelor in Culinary Arts",
  "Bachelor in French Pastry Arts",
  "MBA in Culinary Arts Management",
] as const;

/** « Paris » → PARIS ; libellé contenant « yss » → YSSI (voir campusLabelToCode côté API). */
const CAMPUSES = ["Paris", "Yssingeaux (ENSP)"] as const;

const STORED_MISSIONS_FENCE = "--- Données convention (formulaire étudiant) ---";

const REQUIRED_FIELD = "Ce champ est obligatoire.";

/** Retire le préfixe métadonnées ajouté par l’API pour rééditer sans dupliquer le bloc. */
function extractMissionNarrative(stored: string): string {
  if (!stored.includes(STORED_MISSIONS_FENCE)) return stored.trim();
  const tail = stored.split(STORED_MISSIONS_FENCE)[1] ?? "";
  const close = tail.indexOf("\n---\n");
  if (close === -1) return stored.trim();
  return tail.slice(close + 5).trim();
}

interface FormValues {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  campus: string;
  programme: string;
  promotion: Intake;
  careerHeadName: string;
  acceptedTerms: boolean;
  birthDate: string;
  personalEmail: string;
  studentAddress: string;
  studentPostalCode: string;
  studentCity: string;
  companyName: string;
  companyCountry: string;
  companyCity: string;
  companyEmail: string;
  companyPhone: string;
  startDate: string;
  endDate: string;
  position: string;
  missions: string;
  tutorName: string;
  tutorEmail: string;
  civilLiabilityInsurance: string;
}

/** Ordre d’affichage du formulaire — pour défiler vers la première erreur à la soumission. */
const CONVENTION_SCROLL_ORDER: (keyof FormValues)[] = [
  "tutorName",
  "careerHeadName",
  "acceptedTerms",
  "email",
  "studentId",
  "firstName",
  "lastName",
  "birthDate",
  "studentAddress",
  "studentPostalCode",
  "studentCity",
  "phone",
  "personalEmail",
  "companyName",
  "companyEmail",
  "companyPhone",
  "companyCity",
  "companyCountry",
  "tutorEmail",
  "startDate",
  "endDate",
  "civilLiabilityInsurance",
  "position",
  "missions",
];

function buildEmptyFormDefaults(prefillStudentId?: string): FormValues {
  return {
    studentId: prefillStudentId ?? "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    campus: "Paris",
    programme: PROGRAMMES[0],
    promotion: "Feb-2026",
    careerHeadName: "",
    acceptedTerms: false,
    birthDate: "",
    personalEmail: "",
    studentAddress: "",
    studentPostalCode: "",
    studentCity: "",
    companyName: "",
    companyCountry: "France",
    companyCity: "",
    companyEmail: "",
    companyPhone: "",
    startDate: "",
    endDate: "",
    position: "",
    missions: "",
    tutorName: "",
    tutorEmail: "",
    civilLiabilityInsurance: "",
  };
}

export function StudentConventionForm({
  prefillStudentId,
  redirectAfterSubmit = true,
}: StudentConventionFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    defaultValues: buildEmptyFormDefaults(prefillStudentId),
    shouldFocusError: true,
  });
  const watchedStudentId = form.watch("studentId");
  const effectiveStudentKey =
    (watchedStudentId || "").trim() || (prefillStudentId || "").trim() || "";

  const studentQuery = useQuery({
    queryKey: ["student", effectiveStudentKey],
    queryFn: () => getStudent(effectiveStudentKey),
    enabled: !!effectiveStudentKey,
  });

  const submissionQuery = useQuery({
    queryKey: ["submission", effectiveStudentKey],
    queryFn: () => getSubmissionByStudent(effectiveStudentKey),
    enabled: !!effectiveStudentKey,
  });

  const submission = submissionQuery.data;
  const student = studentQuery.data;

  const initial = useMemo<FormValues>(
    () => ({
      studentId: student?.id ?? prefillStudentId ?? "",
      firstName: student?.firstName ?? "",
      lastName: student?.lastName ?? "",
      email: student?.email ?? "",
      phone: student?.phone ?? "",
      campus: student?.campus === "Yssingeaux" ? "Yssingeaux (ENSP)" : "Paris",
      programme: student?.programme ?? PROGRAMMES[0],
      promotion: student?.promotion ?? "Feb-2026",
      careerHeadName: submission?.careerHeadName ?? "",
      acceptedTerms: submission?.acceptedTerms === true,
      birthDate: "",
      personalEmail: submission?.personalEmail ?? "",
      studentAddress: submission?.studentAddress ?? "",
      studentPostalCode: submission?.studentPostalCode ?? "",
      studentCity: submission?.studentCity ?? "",
      companyName: submission?.companyName ?? "",
      companyCountry: submission?.companyCountry ?? "France",
      companyCity: submission?.companyCity ?? "",
      companyEmail: submission?.companyEmail ?? "",
      companyPhone: submission?.companyPhone ?? "",
      startDate: submission?.startDate ?? "",
      endDate: submission?.endDate ?? "",
      position: submission?.position ?? "",
      missions: submission?.missions ? extractMissionNarrative(submission.missions) : "",
      tutorName: submission?.tutorName ?? "",
      tutorEmail: submission?.tutorEmail ?? "",
      civilLiabilityInsurance: submission?.civilLiabilityInsuranceRef ?? "",
    }),
    [student, submission, prefillStudentId],
  );

  const { register, handleSubmit, reset, control } = form;

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const editable =
    !submission ||
    submission.status === "changes_requested" ||
    submission.status === "rejected";

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      upsertStudentSubmission({
        student: {
          id: values.studentId,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone || undefined,
          campus: values.campus,
          programme: values.programme,
          promotion: values.promotion,
        },
        companyName: values.companyName,
        companyCountry: values.companyCountry,
        companyCity: values.companyCity || undefined,
        companyEmail: values.companyEmail || undefined,
        companyPhone: values.companyPhone || undefined,
        startDate: values.startDate,
        endDate: values.endDate,
        position: values.position.trim() || "Stagiaire",
        missions: values.missions,
        tutorName: values.tutorName,
        tutorEmail: values.tutorEmail,
        birthDate: values.birthDate || undefined,
        personalEmail: values.personalEmail || undefined,
        careerHeadName: values.careerHeadName || undefined,
        acceptedTerms: values.acceptedTerms === true,
        civilLiabilityInsurance: values.civilLiabilityInsurance || undefined,
        studentAddress: values.studentAddress || undefined,
        studentPostalCode: values.studentPostalCode || undefined,
        studentCity: values.studentCity || undefined,
      }),
    onSuccess: (_, values) => {
      toast.success("Soumission enregistrée. Elle sera examinée dans la page Validations.");
      qc.invalidateQueries({ queryKey: ["submission", values.studentId] });
      qc.invalidateQueries({ queryKey: ["student", values.studentId] });
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["form-responses"] });
      if (redirectAfterSubmit) {
        navigate({ to: "/student/merci" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabledCls = !editable ? "opacity-70 pointer-events-none" : "";

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {submission && (
          <div className="mb-6 space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div>
              <p className="text-sm text-muted-foreground">Statut de votre dossier</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={submission.status} />
                <span className="text-sm text-foreground">
                  {submission.companyName} — {submission.position}
                </span>
              </div>
            </div>
            {submission.reviewerComment && (
              <div className="rounded-md bg-muted p-3 text-sm text-foreground">
                <p className="font-medium">Commentaire de l&apos;équipe carrière :</p>
                <p className="mt-1 text-muted-foreground">{submission.reviewerComment}</p>
              </div>
            )}
          </div>
        )}

        {submission?.status === "approved" && (
          <div className="mb-6 rounded-lg border border-success/30 bg-success-muted p-4 text-sm text-success-muted-foreground">
            Votre stage a été validé. Plus rien à faire de votre côté.
          </div>
        )}

        <div className="mb-8 space-y-2 border-b border-border pb-6">
          <h1 className="text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
            Student Internship Contract 2026-2027
          </h1>
          <p className="text-base text-muted-foreground">
            (Convention de stage 2026-2027)
          </p>
          <p className="text-sm text-muted-foreground">
            Lien pour calculer la durée en semaines entre deux dates :{" "}
            <a
              href="https://fr.planetcalc.com/7741/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              planetcalc.com
            </a>
          </p>
        </div>

        <form
          onSubmit={handleSubmit(
            (v) => mutation.mutate(v),
            (errors: FieldErrors<FormValues>) => {
              const first = CONVENTION_SCROLL_ORDER.find((k) => errors[k]);
              if (!first) return;
              const err = errors[first];
              const msg =
                typeof err?.message === "string"
                  ? err.message
                  : err?.message != null
                    ? String(err.message)
                    : REQUIRED_FIELD;
              toast.error(msg);
              document
                .getElementById(`cf-${String(first)}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          )}
          className={`space-y-10 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 ${disabledCls}`}
        >
          <ImportantNotice />

          <SectionTitle title="Section 1 — Informations étudiant" />

          <div className="space-y-8">
            <Question
              anchor="tutorName"
              n={1}
              title={
                <>
                  Name and Surname of the chef who will supervise your work during internship — Nom et
                  prénom de votre chef référent en entreprise
                </>
              }
              required
            >
              <Input placeholder="Entrez votre réponse" {...register("tutorName", { required: REQUIRED_FIELD })} />
            </Question>

            <Question
              anchor="careerHeadName"
              n={2}
              title={
                <>
                  Head of Career Development at School — Directrice du Career Development office de
                  l&apos;école (merci d&apos;indiquer « Charlotte Pedersen » dans le champ ci-dessous)
                </>
              }
              required
            >
              <Input
                placeholder="Charlotte Pedersen"
                {...register("careerHeadName", { required: REQUIRED_FIELD })}
              />
            </Question>

            <Question
              anchor="acceptedTerms"
              n={3}
              title={
                <>
                  Please confirm you have read and accepted the above terms — Veuillez confirmer avoir lu
                  et accepté les conditions décrites ci-dessus
                </>
              }
              required
            >
              <Controller
                name="acceptedTerms"
                control={control}
                rules={{
                  validate: (v) =>
                    v === true ||
                    "Vous devez confirmer avoir lu et accepté les conditions.",
                }}
                render={({ field, fieldState }) => (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                        disabled={!editable}
                      />
                      <span>I confirm — Je confirme</span>
                    </label>
                    {fieldState.error && (
                      <p className="text-xs text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </Question>

            <Question anchor="email" n={4} title={<>Your Ecole Ducasse email — Votre adresse email École Ducasse</>} required>
              <Input
                type="email"
                placeholder="prenom.nom@ecoleducasse.com"
                {...register("email", { required: REQUIRED_FIELD })}
              />
            </Question>

            <Question
              n={5}
              title={<>Please select your class level — Sélectionnez votre programme</>}
              required
            >
              <Select
                value={form.watch("programme")}
                onValueChange={(v) => form.setValue("programme", v)}
                disabled={!editable}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre réponse" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMMES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Question>

            <Question
              anchor="studentId"
              n={6}
              title={
                <>
                  Student ID (without blanks) — Numéro étudiant (sans espaces). Sur Symplicity : [Mon
                  compte] → [Informations personnelles].
                </>
              }
              required
            >
              <Input {...register("studentId", { required: REQUIRED_FIELD })} disabled={!editable} />
            </Question>

            <Question anchor="firstName" n={7} title={<>First Name — Prénom</>} required>
              <Input {...register("firstName", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="lastName" n={8} title={<>Last Name — Nom</>} required>
              <Input {...register("lastName", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="birthDate" n={9} title={<>Date of birth — Date de naissance</>} required>
              <Input type="date" {...register("birthDate", { required: REQUIRED_FIELD })} />
              <p className="text-xs text-muted-foreground">
                Saisie au format calendrier ; affichage habituel jj/MM/aaaa selon votre navigateur.
              </p>
            </Question>

            <Question anchor="studentAddress" n={10} title={<>Student Current Address — Adresse actuelle de l&apos;étudiant(e)</>} required>
              <Input {...register("studentAddress", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="studentPostalCode" n={11} title={<>Student Postal Code — Code postal</>} required>
              <Input {...register("studentPostalCode", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="studentCity" n={12} title={<>Student City — Ville</>} required>
              <Input {...register("studentCity", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="phone" n={13} title={<>Student Mobile Phone Number — Numéro de portable</>} required>
              <Input type="tel" {...register("phone", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="personalEmail" n={14} title={<>Student personal email — Email personnel</>} required>
              <Input type="email" {...register("personalEmail", { required: REQUIRED_FIELD })} />
            </Question>

            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contexte académique (obligatoire pour enregistrer votre dossier)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Campus *">
                  <Select
                    value={form.watch("campus")}
                    onValueChange={(v) => form.setValue("campus", v)}
                    disabled={!editable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPUSES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Promotion (rentrée) *">
                  <Select
                    value={form.watch("promotion")}
                    onValueChange={(v) => form.setValue("promotion", v as Intake)}
                    disabled={!editable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTAKES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          <SectionTitle title="Section 2 — HOST COMPANY" />

          <div className="space-y-8">
            <Question anchor="companyName" n={15} title={<>Host company name — Nom de l&apos;établissement d&apos;accueil</>} required>
              <Input {...register("companyName", { required: REQUIRED_FIELD })} />
            </Question>

            <Question
              anchor="companyEmail"
              n={16}
              title={
                <>
                  Host company email (Administrative or HR Service) — Email de l&apos;établissement
                  d&apos;accueil (Administration ou RH)
                </>
              }
              required
            >
              <Input type="email" {...register("companyEmail", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="companyPhone" n={17} title={<>Company Phone Number — Téléphone de l&apos;établissement</>} required>
              <Input type="tel" {...register("companyPhone", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="companyCity" n={18} title={<>Host company city — Ville de l&apos;établissement</>} required>
              <Input {...register("companyCity", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="companyCountry" n={19} title={<>Host company country — Pays</>} required>
              <Input {...register("companyCountry", { required: REQUIRED_FIELD })} />
            </Question>
          </div>

          <SectionTitle title="Section 3 — Human Resources & Mentor Chef" />

          <div className="space-y-8">
            <Question
              anchor="tutorEmail"
              n={20}
              title={
                <>
                  Email of the HR or chef who will supervise your work — Email de votre RH ou de votre
                  chef référent en entreprise
                </>
              }
              required
            >
              <Input type="email" {...register("tutorEmail", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="startDate" n={21} title={<>Start date — Date de début de stage</>} required>
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <strong>IMPORTANT :</strong> les stages débutent un <strong>lundi</strong>, même si
                l&apos;établissement est fermé ce jour-là. Durée indicative : 24 semaines pour le Bachelor,
                13 semaines pour les autres programmes.
              </div>
              <Input type="date" {...register("startDate", { required: REQUIRED_FIELD })} />
            </Question>

            <Question anchor="endDate" n={22} title={<>End date — Date de fin de stage</>} required>
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <strong>IMPORTANT :</strong> indiquez une date de fin qui tombe un{" "}
                <strong>dimanche</strong>, même si votre dernier jour effectif est un autre jour.
              </div>
              <Input type="date" {...register("endDate", { required: REQUIRED_FIELD })} />
            </Question>

            <Question
              anchor="civilLiabilityInsurance"
              n={23}
              title={
                <>
                  Civil Liability Insurance — Assurance responsabilité civile (nom de l&apos;organisme + n°
                  de contrat)
                </>
              }
              required
            >
              <Input {...register("civilLiabilityInsurance", { required: REQUIRED_FIELD })} />
            </Question>
          </div>

          <SectionTitle title="Complément — Poste et missions (plateforme)" />

          <div className="space-y-6">
            <Question
              anchor="position"
              n={24}
              title={<>Position / fonction pendant le stage — utilisée aussi dans votre dossier interne</>}
              required
            >
              <Input
                placeholder="Ex. Commis de cuisine, Assistant pâtissier…"
                {...register("position", { required: REQUIRED_FIELD })}
              />
            </Question>

            <Question anchor="missions" n={25} title={<>Description des missions</>} required>
              <Textarea rows={5} placeholder="Décrivez vos missions principales." {...register("missions", { required: REQUIRED_FIELD })} />
            </Question>
          </div>

          {editable && (
            <div className="flex flex-col items-stretch gap-3 border-t border-border pt-8 sm:flex-row sm:justify-end">
              <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full sm:w-auto">
                {mutation.isPending
                  ? "Envoi…"
                  : submission
                    ? "Renvoyer pour validation"
                    : "Soumettre"}
              </Button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

function ImportantNotice() {
  return (
    <section
      aria-labelledby="notice-heading"
      className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950 shadow-sm dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
    >
      <h2 id="notice-heading" className="mb-2 font-semibold">
        Important notice — Message important
      </h2>
      <div className="space-y-3">
        <p>
          Make sure all information you enter are accurate and all instructions in the form are followed.
          Contact your host organization if you have any doubts. All spelling and grammar that you use will
          be transcribed into your contract.
        </p>
        <p className="border-l-2 border-sky-300 pl-3 dark:border-sky-700">
          Toutes les informations que vous saisirez doivent être précises et correctes, et les consignes
          doivent être suivies à la lettre. Toutes les données saisies par vous seront transcrites fidèlement
          dans le contrat. Contactez votre établissement d&apos;accueil en cas de doute.
        </p>
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="border-b border-border pb-2 text-lg font-semibold tracking-tight text-foreground">
      {title}
    </h2>
  );
}

function Question({
  n,
  title,
  children,
  required,
  anchor,
}: {
  n: number;
  title: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
  anchor?: keyof FormValues;
}) {
  return (
    <div className={anchor ? "scroll-mt-28 space-y-3" : "space-y-3"} id={anchor ? `cf-${String(anchor)}` : undefined}>
      <div className="text-sm leading-snug">
        <span className="font-medium text-foreground">{n}. </span>
        <span className="text-foreground">{title}</span>
        {required && <span className="text-destructive"> *</span>}
      </div>
      <div className="max-w-xl space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Header() {
  return <SiteHeader />;
}

