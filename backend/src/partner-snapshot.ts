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

export type PartnerIntakeBuildInput = {
  declarationId: string;
  companyId: string;
  intern: DeclaredIntern;
  /** État formulaire partenaire (camelCase), tel qu’au moment du clic « Envoyer ». */
  fullState: Record<string, unknown>;
  benefitLabels: string[];
  partnerFormExtras: Record<string, unknown>;
};

/** 48 colonnes « grille partenaire » (hors ligne courte stagiaire + extras JSON). */
function intakeTail48(a: PartnerIntakeBuildInput): unknown[] {
  const f = a.fullState;
  const weekly = [str(f.weeklySchedule), f.weeklySchedule === "other" ? str(f.weeklyScheduleComment) : null]
    .filter(Boolean)
    .join(" — ");
  const benefitsText = a.benefitLabels.length ? a.benefitLabels.join("; ") : null;

  const gridFirst = str(f.firstName) ?? str(a.intern.firstName) ?? null;
  const gridLast = str(f.lastName) ?? str(a.intern.lastName) ?? null;

  return [
    f.dataConsent === "yes" ? true : f.dataConsent === "no" ? false : bool(f.acceptedTerms),
    str(f.programmeClassLevel) ?? str(f.programme) ?? str(f.classLevel),
    gridFirst,
    gridLast,
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
    str(f.internFirstName) ?? gridFirst,
    str(f.internLastName) ?? gridLast,
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
  ];
}

function intakeRawPayload(a: PartnerIntakeBuildInput): Record<string, unknown> {
  const f = a.fullState;
  return {
    ...f,
    _benefitLabels: a.benefitLabels,
    _declaredIntern: a.intern,
    _companyId: a.companyId,
  };
}

/** Une ligne `declared_intern` = fiche stagiaire + formulaire entreprise complet (plus de table snapshot). */
const INSERT_DECLARED_INTERN_FULL = `
INSERT INTO careers.declared_intern (
  declaration_id, student_id, first_name, last_name, internship_type,
  position, start_date, end_date, tutor_name, tutor_email, tutor_phone, notes,
  accepted_terms, programme_class_level,
  grid_first_name, grid_last_name,
  birth_date, student_current_address, student_postal_code, student_city,
  student_mobile_phone, student_ducasse_email, student_personal_email,
  host_company_name, host_company_email, host_supervisor_chef_name, host_supervisor_chef_email,
  host_company_phone, host_company_country, host_company_city,
  host_stage_start_date, host_stage_end_date, head_of_pedagogy, civil_liability_insurance_ref,
  intern_first_name, intern_last_name, intake_internship_type,
  company_side_start_date, company_side_end_date,
  company_legal_name, company_trade_name, company_business_activity, company_siret,
  insurance_company_name, insurance_policy_number,
  company_address, company_postal_code, company_city,
  hr_representative_name, hr_representative_title, hr_email, hr_phone,
  tutor_chef_name, tutor_chef_position, tutor_chef_email, tutor_chef_phone,
  weekly_schedule, compensation_monthly_or_hourly, benefits_offered, tasks_assigned,
  partner_form_extras, raw_payload
) VALUES (
  $1,$2,$3,$4,$5,$6,$7::date,$8::date,$9,$10,$11,$12,
  $13,$14,$15,$16,$17::date,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
  $31::date,$32::date,$33,$34,$35,$36,$37,$38::date,$39::date,$40,
  $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60,
  $61::jsonb,$62::jsonb
) RETURNING id`;

export async function insertDeclaredInternWithFullIntake(
  client: PoolClient,
  args: PartnerIntakeBuildInput,
): Promise<string> {
  const intern = args.intern;
  const tail = intakeTail48(args);
  if (tail.length !== 48) {
    throw new Error(`intakeTail48: attendu 48 valeurs, obtenu ${tail.length}`);
  }
  const partnerExtras = args.partnerFormExtras ?? {};
  const raw = intakeRawPayload(args);
  const params: unknown[] = [
    args.declarationId,
    intern.studentId,
    intern.firstName ?? null,
    intern.lastName ?? null,
    intern.internshipType ?? null,
    intern.position,
    intern.startDate,
    intern.endDate,
    intern.tutorName || null,
    intern.tutorEmail || null,
    intern.tutorPhone ?? null,
    null,
    ...tail,
    partnerExtras,
    raw,
  ];
  if (params.length !== 62) {
    throw new Error(`insertDeclaredInternWithFullIntake: attendu 62 paramètres, obtenu ${params.length}`);
  }
  const { rows } = await client.query(INSERT_DECLARED_INTERN_FULL, params);
  return rows[0]!.id as string;
}
