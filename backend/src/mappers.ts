import type {
  Company,
  CompanyContact,
  DeclaredIntern,
  Intake,
  MergedInternship,
  Student,
  StudentSubmission,
  SubmissionStatus,
} from "./contracts.js";

/** DB enum FEB|SEP + année → libellé front (Feb-2026, Sep-2026, …) */
export function dbSeasonYearToIntake(season: string, year: number): Intake {
  const head = season.toUpperCase() === "FEB" ? "Feb" : "Sep";
  const key = `${head}-${year}` as Intake;
  return key;
}

export function intakeToSeasonYear(intake: Intake): { season: "FEB" | "SEP"; year: number } {
  const year = Number(intake.slice(-4));
  const mon = intake.slice(0, 3).toLowerCase();
  const season = mon === "feb" ? "FEB" : "SEP";
  return { season, year };
}

export function campusLabelToCode(label: string): string {
  return label.toLowerCase().includes("yss") ? "YSSI" : "PARIS";
}

export function programmeLabelToCode(label: string): string {
  const u = label.trim().toUpperCase();
  if (u.startsWith("BFPA")) return "BACH-PAS";
  if (u.startsWith("BCA")) return "BACH-CUL";
  if (u.startsWith("DC-") || u.startsWith("CAD-")) return "BACH-CUL";

  const l = label.toLowerCase();
  if (l.includes("pastry") || l.includes("pâtisserie")) return "BACH-PAS";
  if (l.includes("mba")) return "MBA-CUL";
  return "BACH-CUL";
}

export function mapStudentRow(r: {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  campus_code?: string;
  campus_name: string;
  programme_name: string;
  season: string;
  year: number;
}): Student {
  const campusShort =
    r.campus_code === "YSSI" || r.campus_name.includes("Yss") ? "Yssingeaux" : "Paris";
  return {
    id: r.student_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone ?? undefined,
    campus: campusShort,
    programme: r.programme_name,
    promotion: dbSeasonYearToIntake(r.season, r.year),
  };
}

export function mapSubmissionRow(
  r: {
    id: string;
    student_id: string;
    company_name: string;
    company_country: string;
    company_city?: string | null;
    position: string;
    missions: string | null;
    start_date: Date | string;
    end_date: Date | string;
    tutor_name: string | null;
    tutor_email: string | null;
    status: string;
    reviewer_comment: string | null;
    submitted_at: Date | string;
    reviewed_at: Date | string | null;
    campus_input_label?: string | null;
    programme_input_label?: string | null;
    career_head_name?: string | null;
    accepted_terms?: boolean | null;
    personal_email?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
    student_address?: string | null;
    student_postal_code?: string | null;
    student_city?: string | null;
    civil_liability_insurance_ref?: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    campus_code?: string;
    campus_name: string;
    programme_name: string;
    season: string;
    year: number;
  },
): StudentSubmission {
  const st = mapStudentRow({
    student_id: r.student_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    campus_code: r.campus_code,
    campus_name: r.campus_name,
    programme_name: r.programme_name,
    season: r.season,
    year: r.year,
  });
  const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));
  const isoTz = (d: Date | string) =>
    typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
  return {
    id: r.id,
    studentId: r.student_id,
    student: st,
    companyName: r.company_name,
    companyCountry: r.company_country,
    companyCity: r.company_city ?? undefined,
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    position: r.position,
    missions: r.missions ?? "",
    tutorName: r.tutor_name ?? "",
    tutorEmail: r.tutor_email ?? "",
    status: r.status as SubmissionStatus,
    reviewerComment: r.reviewer_comment ?? undefined,
    submittedAt: isoTz(r.submitted_at),
    reviewedAt: r.reviewed_at ? isoTz(r.reviewed_at) : undefined,
    campusInputLabel: r.campus_input_label ?? undefined,
    programmeInputLabel: r.programme_input_label ?? undefined,
    careerHeadName: r.career_head_name ?? undefined,
    acceptedTerms: r.accepted_terms === true ? true : r.accepted_terms === false ? false : undefined,
    personalEmail: r.personal_email ?? undefined,
    companyEmail: r.company_email ?? undefined,
    companyPhone: r.company_phone ?? undefined,
    studentAddress: r.student_address ?? undefined,
    studentPostalCode: r.student_postal_code ?? undefined,
    studentCity: r.student_city ?? undefined,
    civilLiabilityInsuranceRef: r.civil_liability_insurance_ref ?? undefined,
  };
}

export function mapCompanyRow(
  base: {
    id: string;
    name: string;
    country: string;
    sector: string | null;
    size_bucket: string | null;
    address: string | null;
    city: string | null;
    postal_code?: string | null;
    website: string | null;
    trade_name?: string | null;
    siret?: string | null;
    insurance_company?: string | null;
    insurance_policy?: string | null;
  },
  contacts: CompanyContact[],
): Company {
  return {
    id: base.id,
    name: base.name,
    country: base.country,
    sector: base.sector ?? "",
    size: base.size_bucket ?? "",
    address: base.address ?? "",
    city: base.city ?? "",
    postalCode: base.postal_code ?? "",
    website: base.website ?? "",
    /** Toujours des chaînes (éventuellement vides) pour un JSON prévisible côté formulaire. */
    tradeName: base.trade_name ?? "",
    siret: base.siret ?? "",
    insuranceCompany: base.insurance_company ?? "",
    insurancePolicy: base.insurance_policy ?? "",
    contacts,
  };
}

export function mapDeclaredInternRow(r: {
  student_id: string;
  first_name?: string | null;
  last_name?: string | null;
  internship_type?: string | null;
  position: string;
  start_date: Date | string;
  end_date: Date | string;
  tutor_name: string | null;
  tutor_email: string | null;
  tutor_phone?: string | null;
}): DeclaredIntern {
  const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));
  return {
    studentId: r.student_id,
    position: r.position,
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    tutorName: r.tutor_name ?? "",
    tutorEmail: r.tutor_email ?? "",
    tutorPhone: r.tutor_phone ?? undefined,
    firstName: r.first_name ?? undefined,
    lastName: r.last_name ?? undefined,
    internshipType: r.internship_type ?? undefined,
  };
}

function isoDatePg(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v).slice(0, 10);
}

function isoTzPg(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return undefined;
}

/** Construit l’objet API à partir d’une ligne careers.merged_internship (cols st_/ss_/co_/cct_/din_). */
export function mergedMatchedPgRowToMergedInternship(
  row: Record<string, unknown>,
  intake: Intake,
): MergedInternship {
  const studentId = row.student_id as string;
  const campusShort =
    typeof row.st_campus_name === "string" && row.st_campus_name.toLowerCase().includes("yss")
      ? "Yssingeaux"
      : "Paris";
  const student: Student = {
    id: studentId,
    firstName: (row.st_first_name as string) ?? "",
    lastName: (row.st_last_name as string) ?? "",
    email: (row.st_email as string) ?? "",
    phone: (row.st_phone as string) || undefined,
    campus: campusShort,
    programme: (row.st_programme_name as string) ?? "",
    promotion: intake,
  };
  const submission: StudentSubmission = {
    id: row.submission_id as string,
    studentId,
    student,
    companyName: (row.ss_company_name as string) ?? "",
    companyCountry: (row.ss_company_country as string) ?? "",
    companyCity: (row.ss_company_city as string) || undefined,
    startDate: isoDatePg(row.ss_start_date),
    endDate: isoDatePg(row.ss_end_date),
    position: (row.ss_position as string) ?? "",
    missions: (row.ss_missions as string) ?? "",
    tutorName: (row.ss_tutor_name as string) ?? "",
    tutorEmail: (row.ss_tutor_email as string) ?? "",
    status: ((row.ss_status as string) ?? "approved") as SubmissionStatus,
    reviewerComment: (row.ss_reviewer_comment as string) || undefined,
    submittedAt: isoTzPg(row.ss_submitted_at) ?? "",
    reviewedAt: isoTzPg(row.ss_reviewed_at),
    campusInputLabel: (row.ss_campus_input_label as string) || undefined,
    programmeInputLabel: (row.ss_programme_input_label as string) || undefined,
    careerHeadName: (row.ss_career_head_name as string) || undefined,
    acceptedTerms:
      row.ss_accepted_terms === true ? true : row.ss_accepted_terms === false ? false : undefined,
    personalEmail: (row.ss_personal_email as string) || undefined,
    companyEmail: (row.ss_company_email as string) || undefined,
    companyPhone: (row.ss_company_phone as string) || undefined,
    studentAddress: (row.ss_student_address as string) || undefined,
    studentPostalCode: (row.ss_student_postal_code as string) || undefined,
    studentCity: (row.ss_student_city as string) || undefined,
    civilLiabilityInsuranceRef: (row.ss_civil_liability_insurance_ref as string) || undefined,
  };
  const company = mapCompanyRow(
    {
      id: row.company_id as string,
      name: (row.co_name as string) ?? "",
      country: (row.co_country as string) ?? "",
      sector: row.co_sector as string | null,
      size_bucket: row.co_size_bucket as string | null,
      address: row.co_address as string | null,
      city: row.co_city as string | null,
      postal_code: row.co_postal_code as string | null,
      website: row.co_website as string | null,
      trade_name: row.co_trade_name as string | null,
      siret: row.co_siret as string | null,
      insurance_company: row.co_insurance_company as string | null,
      insurance_policy: row.co_insurance_policy as string | null,
    },
    row.cct_email
      ? ([
          {
            name: (row.cct_full_name as string) ?? "",
            email: (row.cct_email as string) ?? "",
            role: (row.cct_role as string) ?? "",
            phone: (row.cct_phone as string) || undefined,
          },
        ] satisfies CompanyContact[])
      : [],
  );
  const declaredIntern = mapDeclaredInternRow({
    student_id: studentId,
    first_name: row.din_first_name as string | null,
    last_name: row.din_last_name as string | null,
    internship_type: row.din_internship_type as string | null,
    position: (row.din_position as string) ?? "",
    start_date: row.din_start_date as Date | string,
    end_date: row.din_end_date as Date | string,
    tutor_name: row.din_tutor_name as string | null,
    tutor_email: row.din_tutor_email as string | null,
    tutor_phone: row.din_tutor_phone as string | null,
  });
  return {
    studentId,
    student,
    studentSubmission: submission,
    company,
    declaredIntern,
    intake,
    status: "matched",
  };
}
