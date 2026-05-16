import path from "node:path";
import { fileURLToPath } from "node:url";

import type pg from "pg";

import { conventionBenefitPlaceholders, extractBenefitIds } from "./convention-benefits.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONVENTION_TEMPLATE = path.resolve(
  __dirname,
  "../../templates/Modele2025ConventiondestageFPADv0.11.docx",
);

export function resolveConventionTemplatePath(): string {
  const fromEnv = process.env.CONVENTION_TEMPLATE_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : DEFAULT_CONVENTION_TEMPLATE;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

export function formatDateFr(v: unknown): string {
  const iso = isoDate(v);
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function internshipWeeksBetween(startIso: string, endIso: string): number | null {
  const a = new Date(`${startIso}T12:00:00`);
  const b = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return null;
  return Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

type DeclaredInternRow = Record<string, unknown>;
type MergedRow = Record<string, unknown>;

const CONVENTION_QUERY = `
  SELECT
    m.student_id,
    m.st_first_name,
    m.st_last_name,
    m.st_email,
    m.st_phone,
    m.st_programme_name,
    m.ss_company_name,
    m.ss_company_country,
    m.ss_company_city,
    m.ss_start_date,
    m.ss_end_date,
    m.ss_tutor_name,
    m.ss_tutor_email,
    m.ss_programme_input_label,
    m.ss_student_address,
    m.ss_student_postal_code,
    m.ss_student_city,
    m.ss_civil_liability_insurance_ref,
    m.ss_personal_email,
    m.co_name,
    m.co_trade_name,
    m.co_country,
    m.co_sector,
    m.co_siret,
    m.co_address,
    m.co_city,
    m.co_postal_code,
    m.cct_full_name,
    m.cct_email,
    m.cct_role,
    m.cct_phone,
    di.id AS di_id,
    di.birth_date AS di_birth_date,
    di.programme_class_level,
    di.grid_first_name,
    di.grid_last_name,
    di.student_current_address,
    di.student_postal_code,
    di.student_city,
    di.student_mobile_phone,
    di.student_ducasse_email,
    di.student_personal_email,
    di.civil_liability_insurance_ref AS di_civil_liability,
    di.company_legal_name,
    di.company_trade_name,
    di.company_business_activity,
    di.company_siret,
    di.company_address,
    di.company_postal_code,
    di.company_city,
    di.host_company_country,
    di.hr_representative_name,
    di.hr_representative_title,
    di.hr_email,
    di.hr_phone,
    di.host_company_phone,
    di.tutor_chef_name,
    di.tutor_chef_position,
    di.tutor_chef_email,
    di.tutor_chef_phone,
    di.tutor_name AS di_tutor_name,
    di.tutor_email AS di_tutor_email,
    di.tutor_phone AS di_tutor_phone,
    di.company_side_start_date,
    di.company_side_end_date,
    di.host_stage_start_date,
    di.host_stage_end_date,
    di.start_date AS di_start_date,
    di.end_date AS di_end_date,
    di.compensation_monthly_or_hourly,
    di.benefits_offered,
    di.partner_form_extras,
    di.raw_payload,
    s.birth_date AS st_birth_date
  FROM careers.merged_internship m
  LEFT JOIN careers.declared_intern di ON di.id = m.declared_intern_id
  LEFT JOIN careers.student s ON s.student_id = m.student_id
  WHERE m.student_id = $1
  LIMIT 1
`;

const FALLBACK_QUERY = `
  SELECT
    st.student_id,
    st.first_name AS st_first_name,
    st.last_name AS st_last_name,
    st.email AS st_email,
    st.phone AS st_phone,
    pr.name AS st_programme_name,
    st.birth_date AS st_birth_date,
    ss.company_name AS ss_company_name,
    ss.company_country AS ss_company_country,
    ss.company_city AS ss_company_city,
    ss.start_date AS ss_start_date,
    ss.end_date AS ss_end_date,
    ss.tutor_name AS ss_tutor_name,
    ss.tutor_email AS ss_tutor_email,
    ss.programme_input_label AS ss_programme_input_label,
    ss.student_address AS ss_student_address,
    ss.student_postal_code AS ss_student_postal_code,
    ss.student_city AS ss_student_city,
    ss.civil_liability_insurance_ref AS ss_civil_liability_insurance_ref,
    ss.personal_email AS ss_personal_email,
    di.id AS di_id,
    di.birth_date AS di_birth_date,
    di.programme_class_level,
    di.grid_first_name,
    di.grid_last_name,
    di.student_current_address,
    di.student_postal_code,
    di.student_city,
    di.student_mobile_phone,
    di.student_ducasse_email,
    di.student_personal_email,
    di.civil_liability_insurance_ref AS di_civil_liability,
    di.company_legal_name,
    di.company_trade_name,
    di.company_business_activity,
    di.company_siret,
    di.company_address,
    di.company_postal_code,
    di.company_city,
    di.host_company_country,
    di.hr_representative_name,
    di.hr_representative_title,
    di.hr_email,
    di.hr_phone,
    di.host_company_phone,
    di.tutor_chef_name,
    di.tutor_chef_position,
    di.tutor_chef_email,
    di.tutor_chef_phone,
    di.tutor_name AS di_tutor_name,
    di.tutor_email AS di_tutor_email,
    di.tutor_phone AS di_tutor_phone,
    di.company_side_start_date,
    di.company_side_end_date,
    di.host_stage_start_date,
    di.host_stage_end_date,
    di.start_date AS di_start_date,
    di.end_date AS di_end_date,
    di.compensation_monthly_or_hourly,
    di.benefits_offered,
    di.partner_form_extras,
    di.raw_payload
  FROM careers.student st
  JOIN careers.promotion p ON p.id = st.promotion_id
  JOIN careers.programme pr ON pr.id = p.programme_id
  LEFT JOIN LATERAL (
    SELECT * FROM careers.student_submission ss
     WHERE ss.student_id = st.student_id
     ORDER BY ss.submitted_at DESC
     LIMIT 1
  ) ss ON true
  LEFT JOIN LATERAL (
    SELECT * FROM careers.declared_intern di
     WHERE di.student_id = st.student_id
     ORDER BY di.id DESC
     LIMIT 1
  ) di ON true
  WHERE st.student_id = $1
`;

export async function loadConventionSourceRow(
  pool: pg.Pool,
  studentId: string,
): Promise<Record<string, unknown> | undefined> {
  const { rows } = await pool.query(CONVENTION_QUERY, [studentId]);
  if (rows[0]) return rows[0] as Record<string, unknown>;
  const fb = await pool.query(FALLBACK_QUERY, [studentId]);
  return fb.rows[0] as Record<string, unknown> | undefined;
}

export function buildConventionTemplateData(row: Record<string, unknown>): Record<string, string> {
  const r = row as MergedRow & DeclaredInternRow;

  const firstName =
    str(r.grid_first_name) ||
    str(r.st_first_name) ||
    "";
  const lastName =
    str(r.grid_last_name) ||
    str(r.st_last_name) ||
    "";

  const startIso =
    isoDate(r.company_side_start_date) ||
    isoDate(r.host_stage_start_date) ||
    isoDate(r.di_start_date) ||
    isoDate(r.ss_start_date) ||
    "";
  const endIso =
    isoDate(r.company_side_end_date) ||
    isoDate(r.host_stage_end_date) ||
    isoDate(r.di_end_date) ||
    isoDate(r.ss_end_date) ||
    "";

  const weeks =
    startIso && endIso ? internshipWeeksBetween(startIso, endIso) : null;

  const studentCity = str(r.student_city) || str(r.ss_student_city);
  const studentCountry = str(r.host_company_country) || str(r.ss_company_country) || "";
  const villePays = [studentCity, studentCountry].filter(Boolean).join(", ");

  const companyPhone = str(r.hr_phone) || str(r.host_company_phone) || str(r.cct_phone);
  const companyEmail = str(r.hr_email) || str(r.cct_email);
  const phoneMail =
    [companyPhone, companyEmail].filter(Boolean).join(" — ") || companyEmail || companyPhone;

  const tutorName =
    str(r.tutor_chef_name) || str(r.di_tutor_name) || str(r.ss_tutor_name) || str(r.cct_full_name);
  const tutorEmail =
    str(r.tutor_chef_email) || str(r.di_tutor_email) || str(r.ss_tutor_email) || str(r.cct_email);
  const tutorPhone = str(r.tutor_chef_phone) || str(r.di_tutor_phone) || str(r.cct_phone);

  const benefitIds = extractBenefitIds(r.partner_form_extras, r.raw_payload);
  const benefitFields = conventionBenefitPlaceholders(benefitIds);

  const birth =
    r.di_birth_date ?? r.st_birth_date ?? null;

  const civil =
    str(r.di_civil_liability) ||
    str(r.ss_civil_liability_insurance_ref) ||
    "";

  const programme =
    str(r.programme_class_level) ||
    str(r.ss_programme_input_label) ||
    str(r.st_programme_name) ||
    "";

  const mailEtud =
    str(r.student_personal_email) ||
    str(r.student_ducasse_email) ||
    str(r.ss_personal_email) ||
    str(r.st_email) ||
    "";

  return {
    Nom_entreprise:
      str(r.company_legal_name) || str(r.co_name) || str(r.ss_company_name) || "",
    Nom_commercial: str(r.company_trade_name) || str(r.co_trade_name) || "",
    Nature_de_lactivite: str(r.company_business_activity) || str(r.co_sector) || "",
    Representee_par: str(r.hr_representative_name) || str(r.cct_full_name) || "",
    En_qualite_de: str(r.hr_representative_title) || str(r.cct_role) || "",
    Adresse_entreprise: str(r.company_address) || str(r.co_address) || "",
    Ville_entreprise: str(r.company_city) || str(r.co_city) || str(r.ss_company_city) || "",
    Code_Postal_entreprise: str(r.company_postal_code) || str(r.co_postal_code) || "",
    Pays_entreprise:
      str(r.host_company_country) || str(r.co_country) || str(r.ss_company_country) || "",
    Courriel_entreprise: companyEmail,
    Telephone_Mail_entreprise: phoneMail,
    Numero_dimmatruculation_entreprise_SIRET:
      str(r.company_siret) || str(r.co_siret) || "",

    Nom_tuteur: tutorName,
    Fonction_tuteur: str(r.tutor_chef_position) || "",
    Numero_tuteur: tutorPhone,
    Mail_tuteur: tutorEmail,

    Nom_Etud: lastName.toUpperCase(),
    Prenoom_Etud: firstName,
    Programme_etudiant: programme,
    StudentID: str(r.student_id) || "",
    Date_de_naissance_etudiant: formatDateFr(birth),
    Civil_liability: civil,
    Adresse_etudiant:
      str(r.student_current_address) || str(r.ss_student_address) || "",
    Code_Postal_etudiant:
      str(r.student_postal_code) || str(r.ss_student_postal_code) || "",
    Ville_Pays_etudiant: villePays,
    Telephone_etudiant: str(r.student_mobile_phone) || str(r.st_phone) || "",
    Mail_etudiant: mailEtud,

    Date_debut_stage: formatDateFr(startIso),
    Date_fin_stage: formatDateFr(endIso),
    Nombre_de_semaines: weeks !== null ? String(weeks) : "",
    Gratification_intern: str(r.compensation_monthly_or_hourly) || "",
    date_du_jour: formatDateFr(new Date()),

    ...benefitFields,
  };
}
