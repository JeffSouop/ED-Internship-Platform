import type { PoolClient } from "pg";

import type { DeclaredIntern } from "./contracts.js";

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function dateStr(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function bool(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (v === "yes" || v === "true") return true;
  if (v === "no" || v === "false") return false;
  return null;
}

export type PartnerSnapshotBuildInput = {
  declarationId: string;
  declaredInternId: string;
  companyId: string;
  intern: DeclaredIntern;
  /** État formulaire partenaire (camelCase), tel qu’au moment du clic « Envoyer ». */
  fullState: Record<string, unknown>;
  benefitLabels: string[];
};

/** Valeurs dans l’ordre des colonnes INSERT (sans id, submitted_at). */
export function partnerSnapshotInsertValues(a: PartnerSnapshotBuildInput): unknown[] {
  const f = a.fullState;
  const sid = (str(a.intern.studentId) ?? str(f.studentId) ?? "").replace(/\s+/g, "");
  const weekly = [str(f.weeklySchedule), f.weeklySchedule === "other" ? str(f.weeklyScheduleComment) : null]
    .filter(Boolean)
    .join(" — ");
  const benefitsText = a.benefitLabels.length ? a.benefitLabels.join("; ") : null;
  const raw: Record<string, unknown> = {
    ...f,
    _benefitLabels: a.benefitLabels,
    _declaredIntern: a.intern,
  };

  const firstName = str(f.firstName) ?? str(a.intern.firstName) ?? null;
  const lastName = str(f.lastName) ?? str(a.intern.lastName) ?? null;

  return [
    a.declarationId,
    a.declaredInternId,
    a.companyId,
    sid || "unknown",
    f.dataConsent === "yes" ? true : f.dataConsent === "no" ? false : bool(f.acceptedTerms),
    str(f.programmeClassLevel) ?? str(f.programme) ?? str(f.classLevel),
    firstName,
    lastName,
    dateStr(f.birthDate) ?? dateStr(f.dateOfBirth),
    str(f.studentCurrentAddress) ?? str(f.studentAddress),
    str(f.studentPostalCode),
    str(f.studentCity),
    str(f.studentMobilePhone) ?? str(f.phone),
    str(f.studentDucasseEmail) ?? str(f.schoolEmail) ?? str(f.ducasseEmail),
    str(f.studentPersonalEmail) ?? str(f.personalEmail),
    str(f.hostCompanyName) ?? str(f.hostEstablishmentName) ?? str(f.legalName),
    str(f.hostCompanyEmail),
    str(f.hostSupervisorChefName) ?? str(f.supervisorChefName),
    str(f.hostSupervisorChefEmail) ?? str(f.supervisorChefEmail),
    str(f.hostCompanyPhone) ?? str(f.companyPhone),
    str(f.hostCompanyCountry) ?? str(f.country),
    str(f.hostCompanyCity) ?? str(f.hostCity),
    dateStr(f.hostStageStartDate) ?? dateStr(f.startDate) ?? dateStr(a.intern.startDate),
    dateStr(f.hostStageEndDate) ?? dateStr(f.endDate) ?? dateStr(a.intern.endDate),
    str(f.headOfPedagogy) ?? str(f.careerHeadName),
    str(f.civilLiabilityInsurance) ?? str(f.civilLiabilityInsuranceRef),
    str(f.internFirstName) ?? firstName,
    str(f.internLastName) ?? lastName,
    str(f.internshipType) ?? str(a.intern.internshipType),
    dateStr(f.companySideStartDate) ?? dateStr(f.startDate) ?? dateStr(a.intern.startDate),
    dateStr(f.companySideEndDate) ?? dateStr(f.endDate) ?? dateStr(a.intern.endDate),
    str(f.legalName),
    str(f.tradeName),
    str(f.activity) ?? str(f.sector),
    str(f.siret),
    str(f.insuranceCompany),
    str(f.insurancePolicy),
    str(f.street) ?? str(f.address),
    str(f.postalCode),
    str(f.city),
    str(f.hrName),
    str(f.hrTitle),
    str(f.hrEmail),
    str(f.hrPhone),
    str(f.tutorName),
    str(f.tutorPosition),
    str(f.tutorEmail),
    str(f.tutorPhone),
    weekly || null,
    str(f.allowance) ?? str(f.compensation) ?? str(f.monthlyCompensation),
    benefitsText,
    str(f.tasksAssigned) ?? str(f.jobDescription) ?? str(f.missions),
    raw,
  ];
}

const INSERT_SNAPSHOT_SQL = `
INSERT INTO careers.partner_intake_submission_snapshot (
  declaration_id, declared_intern_id, company_id,
  student_id_normalized, accepted_terms, programme_class_level,
  first_name, last_name, birth_date, student_current_address, student_postal_code, student_city,
  student_mobile_phone, student_ducasse_email, student_personal_email,
  host_company_name, host_company_email, host_supervisor_chef_name, host_supervisor_chef_email,
  host_company_phone, host_company_country, host_company_city,
  host_stage_start_date, host_stage_end_date, head_of_pedagogy, civil_liability_insurance_ref,
  intern_first_name, intern_last_name, internship_type,
  company_side_start_date, company_side_end_date,
  company_legal_name, company_trade_name, company_business_activity, company_siret,
  insurance_company_name, insurance_policy_number,
  company_address, company_postal_code, company_city,
  hr_representative_name, hr_representative_title, hr_email, hr_phone,
  tutor_chef_name, tutor_chef_position, tutor_email, tutor_phone,
  weekly_schedule, compensation_monthly_or_hourly, benefits_offered, tasks_assigned, raw_payload
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::date,$24::date,$25,$26,$27,$28,$29,$30::date,$31::date,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53::jsonb
)`;

export async function insertPartnerIntakeSnapshot(
  client: PoolClient,
  args: PartnerSnapshotBuildInput,
): Promise<void> {
  await client.query(INSERT_SNAPSHOT_SQL, partnerSnapshotInsertValues(args));
}
