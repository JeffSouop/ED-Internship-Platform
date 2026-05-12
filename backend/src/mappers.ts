import type {
  Company,
  CompanyContact,
  DeclaredIntern,
  Intake,
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
