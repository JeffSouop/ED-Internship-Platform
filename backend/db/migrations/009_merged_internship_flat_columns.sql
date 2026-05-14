-- merged_internship : une ligne = toutes les colonnes étudiant (référentiel + soumission) + entreprise + contact principal + declared_intern, sans JSONB.
SET search_path TO careers, public;

DROP VIEW IF EXISTS careers.v_merged_overview CASCADE;

ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS merged_student;
ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS merged_student_submission;
ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS merged_company;
ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS merged_declared_intern;
ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS convention_record;

-- Référentiel étudiant (table student) + libellés promo au moment du merge
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_promotion_id INT REFERENCES careers.promotion(id);
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_first_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_last_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_nationality TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_birth_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_campus_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_programme_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_reg_created_at TIMESTAMPTZ;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS st_reg_updated_at TIMESTAMPTZ;

-- Soumission étudiant approuvée (student_submission)
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_promotion_id INT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_company_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_company_country TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_company_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_position TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_missions TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_start_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_end_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_weekly_hours NUMERIC(5,2);
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_gross_salary NUMERIC(10,2);
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_currency CHAR(3);
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_tutor_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_tutor_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_tutor_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_campus_input_label TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_programme_input_label TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_career_head_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_accepted_terms BOOLEAN;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_personal_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_company_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_company_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_student_address TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_student_postal_code TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_student_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_civil_liability_insurance_ref TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_status careers.submission_status;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_reviewer_comment TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_reviewed_by UUID;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_reviewed_at TIMESTAMPTZ;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_submitted_at TIMESTAMPTZ;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_created_at TIMESTAMPTZ;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS ss_updated_at TIMESTAMPTZ;

-- Entreprise référentielle (company)
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_country TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_sector TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_size_bucket TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_trade_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_siret TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_insurance_company TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_insurance_policy TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_address TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_postal_code TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_website TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_source_created_at TIMESTAMPTZ;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS co_source_updated_at TIMESTAMPTZ;

-- Contact entreprise principal (une ligne dénormalisée)
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS cct_full_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS cct_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS cct_role TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS cct_phone TEXT;

-- Formulaire entreprise / grille (declared_intern), hors JSON source → texte sérialisé
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_declaration_id UUID;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_first_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_last_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_internship_type TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_position TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_start_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_end_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_notes TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_accepted_terms BOOLEAN;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_programme_class_level TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_grid_first_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_grid_last_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_birth_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_current_address TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_postal_code TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_mobile_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_ducasse_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_student_personal_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_company_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_company_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_supervisor_chef_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_supervisor_chef_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_company_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_company_country TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_company_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_stage_start_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_host_stage_end_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_head_of_pedagogy TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_civil_liability_insurance_ref TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_intern_first_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_intern_last_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_intake_internship_type TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_side_start_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_side_end_date DATE;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_legal_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_trade_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_business_activity TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_siret TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_insurance_company_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_insurance_policy_number TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_address TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_postal_code TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_company_city TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_hr_representative_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_hr_representative_title TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_hr_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_hr_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_chef_name TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_chef_position TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_chef_email TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tutor_chef_phone TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_weekly_schedule TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_compensation_monthly_or_hourly TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_benefits_offered TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_tasks_assigned TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_partner_form_extras_text TEXT;
ALTER TABLE careers.merged_internship ADD COLUMN IF NOT EXISTS din_raw_payload_text TEXT;

CREATE OR REPLACE FUNCTION careers.try_merge_internship(
    p_student_id TEXT,
    p_season     careers.intake_season,
    p_year       INT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_sub      careers.student_submission%ROWTYPE;
    v_intern   careers.declared_intern%ROWTYPE;
    v_decl     careers.company_declaration%ROWTYPE;
    v_company  careers.company%ROWTYPE;
    v_student  careers.student%ROWTYPE;
    v_campus   TEXT;
    v_programme TEXT;
    v_ct_full  TEXT;
    v_ct_email TEXT;
    v_ct_role  TEXT;
    v_ct_phone TEXT;
BEGIN
    SELECT s.* INTO v_sub
      FROM careers.student_submission s
      JOIN careers.promotion p ON p.id = s.promotion_id
     WHERE s.student_id = p_student_id
       AND s.status     = 'approved'
       AND p.season     = p_season
       AND p.year       = p_year
     ORDER BY s.reviewed_at DESC NULLS LAST
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT di.* INTO v_intern
      FROM careers.declared_intern di
      JOIN careers.company_declaration cd ON cd.id = di.declaration_id
     WHERE di.student_id = p_student_id
       AND cd.season     = p_season
       AND cd.year       = p_year
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO v_decl    FROM careers.company_declaration WHERE id = v_intern.declaration_id;
    SELECT * INTO v_company FROM careers.company             WHERE id = v_decl.company_id;
    SELECT * INTO v_student FROM careers.student             WHERE id = v_sub.student_uuid;

    SELECT c.name, pr.name INTO v_campus, v_programme
      FROM careers.student s
      JOIN careers.promotion p2 ON p2.id = s.promotion_id
      JOIN careers.campus c ON c.id = p2.campus_id
      JOIN careers.programme pr ON pr.id = p2.programme_id
     WHERE s.id = v_sub.student_uuid;

    SELECT cc.full_name, cc.email, cc.role, cc.phone
      INTO v_ct_full, v_ct_email, v_ct_role, v_ct_phone
      FROM careers.company_contact cc
     WHERE cc.company_id = v_company.id
     ORDER BY cc.is_primary DESC, cc.id
     LIMIT 1;

    INSERT INTO careers.merged_internship (
        student_id, student_uuid, submission_id, company_id, declared_intern_id,
        season, year,
        student_full_name, student_email, company_name, company_country,
        position, start_date, end_date, tutor_name, tutor_email,
        merged_at, updated_at,
        st_promotion_id, st_first_name, st_last_name, st_email, st_phone, st_nationality, st_birth_date,
        st_campus_name, st_programme_name, st_reg_created_at, st_reg_updated_at,
        ss_promotion_id, ss_company_name, ss_company_country, ss_company_city, ss_position, ss_missions,
        ss_start_date, ss_end_date, ss_weekly_hours, ss_gross_salary, ss_currency,
        ss_tutor_name, ss_tutor_email, ss_tutor_phone,
        ss_campus_input_label, ss_programme_input_label, ss_career_head_name, ss_accepted_terms,
        ss_personal_email, ss_company_email, ss_company_phone, ss_student_address, ss_student_postal_code, ss_student_city,
        ss_civil_liability_insurance_ref, ss_status, ss_reviewer_comment, ss_reviewed_by, ss_reviewed_at,
        ss_submitted_at, ss_created_at, ss_updated_at,
        co_name, co_country, co_sector, co_size_bucket, co_trade_name, co_siret,
        co_insurance_company, co_insurance_policy, co_address, co_city, co_postal_code, co_website,
        co_source_created_at, co_source_updated_at,
        cct_full_name, cct_email, cct_role, cct_phone,
        din_declaration_id, din_first_name, din_last_name, din_internship_type, din_position, din_start_date, din_end_date,
        din_tutor_name, din_tutor_email, din_tutor_phone, din_notes, din_accepted_terms, din_programme_class_level,
        din_grid_first_name, din_grid_last_name, din_birth_date, din_student_current_address, din_student_postal_code, din_student_city,
        din_student_mobile_phone, din_student_ducasse_email, din_student_personal_email,
        din_host_company_name, din_host_company_email, din_host_supervisor_chef_name, din_host_supervisor_chef_email,
        din_host_company_phone, din_host_company_country, din_host_company_city, din_host_stage_start_date, din_host_stage_end_date,
        din_head_of_pedagogy, din_civil_liability_insurance_ref, din_intern_first_name, din_intern_last_name, din_intake_internship_type,
        din_company_side_start_date, din_company_side_end_date, din_company_legal_name, din_company_trade_name, din_company_business_activity,
        din_company_siret, din_insurance_company_name, din_insurance_policy_number, din_company_address, din_company_postal_code, din_company_city,
        din_hr_representative_name, din_hr_representative_title, din_hr_email, din_hr_phone,
        din_tutor_chef_name, din_tutor_chef_position, din_tutor_chef_email, din_tutor_chef_phone,
        din_weekly_schedule, din_compensation_monthly_or_hourly, din_benefits_offered, din_tasks_assigned,
        din_partner_form_extras_text, din_raw_payload_text
    ) VALUES (
        p_student_id, v_student.id, v_sub.id, v_company.id, v_intern.id,
        p_season, p_year,
        v_student.first_name || ' ' || v_student.last_name, v_student.email, v_company.name, v_company.country,
        COALESCE(v_intern.position, v_sub.position),
        COALESCE(v_intern.start_date, v_sub.start_date),
        COALESCE(v_intern.end_date,   v_sub.end_date),
        COALESCE(v_intern.tutor_name, v_sub.tutor_name),
        COALESCE(v_intern.tutor_email, v_sub.tutor_email),
        now(), now(),
        v_student.promotion_id, v_student.first_name, v_student.last_name, v_student.email, v_student.phone, v_student.nationality, v_student.birth_date,
        v_campus, v_programme, v_student.created_at, v_student.updated_at,
        v_sub.promotion_id, v_sub.company_name, v_sub.company_country, v_sub.company_city, v_sub.position, v_sub.missions,
        v_sub.start_date, v_sub.end_date, v_sub.weekly_hours, v_sub.gross_salary, v_sub.currency,
        v_sub.tutor_name, v_sub.tutor_email, v_sub.tutor_phone,
        v_sub.campus_input_label, v_sub.programme_input_label, v_sub.career_head_name, v_sub.accepted_terms,
        v_sub.personal_email, v_sub.company_email, v_sub.company_phone, v_sub.student_address, v_sub.student_postal_code, v_sub.student_city,
        v_sub.civil_liability_insurance_ref, v_sub.status, v_sub.reviewer_comment, v_sub.reviewed_by, v_sub.reviewed_at,
        v_sub.submitted_at, v_sub.created_at, v_sub.updated_at,
        v_company.name, v_company.country, v_company.sector, v_company.size_bucket, v_company.trade_name, v_company.siret,
        v_company.insurance_company, v_company.insurance_policy, v_company.address, v_company.city, v_company.postal_code, v_company.website,
        v_company.created_at, v_company.updated_at,
        v_ct_full, v_ct_email, v_ct_role, v_ct_phone,
        v_intern.declaration_id, v_intern.first_name, v_intern.last_name, v_intern.internship_type, v_intern.position, v_intern.start_date, v_intern.end_date,
        v_intern.tutor_name, v_intern.tutor_email, v_intern.tutor_phone, v_intern.notes, v_intern.accepted_terms, v_intern.programme_class_level,
        v_intern.grid_first_name, v_intern.grid_last_name, v_intern.birth_date, v_intern.student_current_address, v_intern.student_postal_code, v_intern.student_city,
        v_intern.student_mobile_phone, v_intern.student_ducasse_email, v_intern.student_personal_email,
        v_intern.host_company_name, v_intern.host_company_email, v_intern.host_supervisor_chef_name, v_intern.host_supervisor_chef_email,
        v_intern.host_company_phone, v_intern.host_company_country, v_intern.host_company_city, v_intern.host_stage_start_date, v_intern.host_stage_end_date,
        v_intern.head_of_pedagogy, v_intern.civil_liability_insurance_ref, v_intern.intern_first_name, v_intern.intern_last_name, v_intern.intake_internship_type,
        v_intern.company_side_start_date, v_intern.company_side_end_date, v_intern.company_legal_name, v_intern.company_trade_name, v_intern.company_business_activity,
        v_intern.company_siret, v_intern.insurance_company_name, v_intern.insurance_policy_number, v_intern.company_address, v_intern.company_postal_code, v_intern.company_city,
        v_intern.hr_representative_name, v_intern.hr_representative_title, v_intern.hr_email, v_intern.hr_phone,
        v_intern.tutor_chef_name, v_intern.tutor_chef_position, v_intern.tutor_chef_email, v_intern.tutor_chef_phone,
        v_intern.weekly_schedule, v_intern.compensation_monthly_or_hourly, v_intern.benefits_offered, v_intern.tasks_assigned,
        v_intern.partner_form_extras::text, v_intern.raw_payload::text
    )
    ON CONFLICT (student_id, season, year) DO UPDATE SET
        student_uuid          = EXCLUDED.student_uuid,
        submission_id         = EXCLUDED.submission_id,
        company_id            = EXCLUDED.company_id,
        declared_intern_id    = EXCLUDED.declared_intern_id,
        student_full_name     = EXCLUDED.student_full_name,
        student_email         = EXCLUDED.student_email,
        company_name          = EXCLUDED.company_name,
        company_country       = EXCLUDED.company_country,
        position              = EXCLUDED.position,
        start_date            = EXCLUDED.start_date,
        end_date              = EXCLUDED.end_date,
        tutor_name            = EXCLUDED.tutor_name,
        tutor_email           = EXCLUDED.tutor_email,
        merged_at             = now(),
        updated_at            = now(),
        st_promotion_id = EXCLUDED.st_promotion_id, st_first_name = EXCLUDED.st_first_name, st_last_name = EXCLUDED.st_last_name,
        st_email = EXCLUDED.st_email, st_phone = EXCLUDED.st_phone, st_nationality = EXCLUDED.st_nationality, st_birth_date = EXCLUDED.st_birth_date,
        st_campus_name = EXCLUDED.st_campus_name, st_programme_name = EXCLUDED.st_programme_name,
        st_reg_created_at = EXCLUDED.st_reg_created_at, st_reg_updated_at = EXCLUDED.st_reg_updated_at,
        ss_promotion_id = EXCLUDED.ss_promotion_id, ss_company_name = EXCLUDED.ss_company_name, ss_company_country = EXCLUDED.ss_company_country,
        ss_company_city = EXCLUDED.ss_company_city, ss_position = EXCLUDED.ss_position, ss_missions = EXCLUDED.ss_missions,
        ss_start_date = EXCLUDED.ss_start_date, ss_end_date = EXCLUDED.ss_end_date, ss_weekly_hours = EXCLUDED.ss_weekly_hours,
        ss_gross_salary = EXCLUDED.ss_gross_salary, ss_currency = EXCLUDED.ss_currency,
        ss_tutor_name = EXCLUDED.ss_tutor_name, ss_tutor_email = EXCLUDED.ss_tutor_email, ss_tutor_phone = EXCLUDED.ss_tutor_phone,
        ss_campus_input_label = EXCLUDED.ss_campus_input_label, ss_programme_input_label = EXCLUDED.ss_programme_input_label,
        ss_career_head_name = EXCLUDED.ss_career_head_name, ss_accepted_terms = EXCLUDED.ss_accepted_terms,
        ss_personal_email = EXCLUDED.ss_personal_email, ss_company_email = EXCLUDED.ss_company_email, ss_company_phone = EXCLUDED.ss_company_phone,
        ss_student_address = EXCLUDED.ss_student_address, ss_student_postal_code = EXCLUDED.ss_student_postal_code, ss_student_city = EXCLUDED.ss_student_city,
        ss_civil_liability_insurance_ref = EXCLUDED.ss_civil_liability_insurance_ref, ss_status = EXCLUDED.ss_status,
        ss_reviewer_comment = EXCLUDED.ss_reviewer_comment, ss_reviewed_by = EXCLUDED.ss_reviewed_by, ss_reviewed_at = EXCLUDED.ss_reviewed_at,
        ss_submitted_at = EXCLUDED.ss_submitted_at, ss_created_at = EXCLUDED.ss_created_at, ss_updated_at = EXCLUDED.ss_updated_at,
        co_name = EXCLUDED.co_name, co_country = EXCLUDED.co_country, co_sector = EXCLUDED.co_sector, co_size_bucket = EXCLUDED.co_size_bucket,
        co_trade_name = EXCLUDED.co_trade_name, co_siret = EXCLUDED.co_siret, co_insurance_company = EXCLUDED.co_insurance_company,
        co_insurance_policy = EXCLUDED.co_insurance_policy, co_address = EXCLUDED.co_address, co_city = EXCLUDED.co_city, co_postal_code = EXCLUDED.co_postal_code,
        co_website = EXCLUDED.co_website, co_source_created_at = EXCLUDED.co_source_created_at, co_source_updated_at = EXCLUDED.co_source_updated_at,
        cct_full_name = EXCLUDED.cct_full_name, cct_email = EXCLUDED.cct_email, cct_role = EXCLUDED.cct_role, cct_phone = EXCLUDED.cct_phone,
        din_declaration_id = EXCLUDED.din_declaration_id, din_first_name = EXCLUDED.din_first_name, din_last_name = EXCLUDED.din_last_name,
        din_internship_type = EXCLUDED.din_internship_type, din_position = EXCLUDED.din_position, din_start_date = EXCLUDED.din_start_date, din_end_date = EXCLUDED.din_end_date,
        din_tutor_name = EXCLUDED.din_tutor_name, din_tutor_email = EXCLUDED.din_tutor_email, din_tutor_phone = EXCLUDED.din_tutor_phone, din_notes = EXCLUDED.din_notes,
        din_accepted_terms = EXCLUDED.din_accepted_terms, din_programme_class_level = EXCLUDED.din_programme_class_level,
        din_grid_first_name = EXCLUDED.din_grid_first_name, din_grid_last_name = EXCLUDED.din_grid_last_name, din_birth_date = EXCLUDED.din_birth_date,
        din_student_current_address = EXCLUDED.din_student_current_address, din_student_postal_code = EXCLUDED.din_student_postal_code, din_student_city = EXCLUDED.din_student_city,
        din_student_mobile_phone = EXCLUDED.din_student_mobile_phone, din_student_ducasse_email = EXCLUDED.din_student_ducasse_email, din_student_personal_email = EXCLUDED.din_student_personal_email,
        din_host_company_name = EXCLUDED.din_host_company_name, din_host_company_email = EXCLUDED.din_host_company_email,
        din_host_supervisor_chef_name = EXCLUDED.din_host_supervisor_chef_name, din_host_supervisor_chef_email = EXCLUDED.din_host_supervisor_chef_email,
        din_host_company_phone = EXCLUDED.din_host_company_phone, din_host_company_country = EXCLUDED.din_host_company_country, din_host_company_city = EXCLUDED.din_host_company_city,
        din_host_stage_start_date = EXCLUDED.din_host_stage_start_date, din_host_stage_end_date = EXCLUDED.din_host_stage_end_date,
        din_head_of_pedagogy = EXCLUDED.din_head_of_pedagogy, din_civil_liability_insurance_ref = EXCLUDED.din_civil_liability_insurance_ref,
        din_intern_first_name = EXCLUDED.din_intern_first_name, din_intern_last_name = EXCLUDED.din_intern_last_name, din_intake_internship_type = EXCLUDED.din_intake_internship_type,
        din_company_side_start_date = EXCLUDED.din_company_side_start_date, din_company_side_end_date = EXCLUDED.din_company_side_end_date,
        din_company_legal_name = EXCLUDED.din_company_legal_name, din_company_trade_name = EXCLUDED.din_company_trade_name, din_company_business_activity = EXCLUDED.din_company_business_activity,
        din_company_siret = EXCLUDED.din_company_siret, din_insurance_company_name = EXCLUDED.din_insurance_company_name, din_insurance_policy_number = EXCLUDED.din_insurance_policy_number,
        din_company_address = EXCLUDED.din_company_address, din_company_postal_code = EXCLUDED.din_company_postal_code, din_company_city = EXCLUDED.din_company_city,
        din_hr_representative_name = EXCLUDED.din_hr_representative_name, din_hr_representative_title = EXCLUDED.din_hr_representative_title,
        din_hr_email = EXCLUDED.din_hr_email, din_hr_phone = EXCLUDED.din_hr_phone,
        din_tutor_chef_name = EXCLUDED.din_tutor_chef_name, din_tutor_chef_position = EXCLUDED.din_tutor_chef_position, din_tutor_chef_email = EXCLUDED.din_tutor_chef_email, din_tutor_chef_phone = EXCLUDED.din_tutor_chef_phone,
        din_weekly_schedule = EXCLUDED.din_weekly_schedule, din_compensation_monthly_or_hourly = EXCLUDED.din_compensation_monthly_or_hourly,
        din_benefits_offered = EXCLUDED.din_benefits_offered, din_tasks_assigned = EXCLUDED.din_tasks_assigned,
        din_partner_form_extras_text = EXCLUDED.din_partner_form_extras_text, din_raw_payload_text = EXCLUDED.din_raw_payload_text;
END $$;

-- Vue : uniquement les lignes matérialisées (appariées). Les cas « étudiant seul » / « entreprise seule »
-- sont assemblés dans l’API pour éviter un UNION de 140+ colonnes alignées à la main.
CREATE VIEW careers.v_merged_overview AS
SELECT m.*, 'matched'::text AS match_status
  FROM careers.merged_internship m;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT student_id, season, year FROM careers.merged_internship
  LOOP
    PERFORM careers.try_merge_internship(r.student_id, r.season, r.year);
  END LOOP;
END $$;
