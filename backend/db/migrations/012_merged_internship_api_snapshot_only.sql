-- merged_internship : ne garder que les colonnes alimentant GET /api/merged (mapper mergedMatchedPgRowToMergedInternship).
-- Salaire, horaires, champs grille partenaire, raw_payload, etc. restent dans student_submission / declared_intern.
SET search_path TO careers, public;

DROP VIEW IF EXISTS careers.v_merged_overview CASCADE;

ALTER TABLE careers.merged_internship
  DROP COLUMN IF EXISTS st_promotion_id,
  DROP COLUMN IF EXISTS st_nationality,
  DROP COLUMN IF EXISTS st_birth_date,
  DROP COLUMN IF EXISTS st_reg_created_at,
  DROP COLUMN IF EXISTS st_reg_updated_at,
  DROP COLUMN IF EXISTS ss_promotion_id,
  DROP COLUMN IF EXISTS ss_weekly_hours,
  DROP COLUMN IF EXISTS ss_gross_salary,
  DROP COLUMN IF EXISTS ss_currency,
  DROP COLUMN IF EXISTS ss_tutor_phone,
  DROP COLUMN IF EXISTS ss_reviewed_by,
  DROP COLUMN IF EXISTS ss_created_at,
  DROP COLUMN IF EXISTS ss_updated_at,
  DROP COLUMN IF EXISTS co_source_created_at,
  DROP COLUMN IF EXISTS co_source_updated_at,
  DROP COLUMN IF EXISTS din_declaration_id,
  DROP COLUMN IF EXISTS din_notes,
  DROP COLUMN IF EXISTS din_accepted_terms,
  DROP COLUMN IF EXISTS din_programme_class_level,
  DROP COLUMN IF EXISTS din_grid_first_name,
  DROP COLUMN IF EXISTS din_grid_last_name,
  DROP COLUMN IF EXISTS din_birth_date,
  DROP COLUMN IF EXISTS din_student_current_address,
  DROP COLUMN IF EXISTS din_student_postal_code,
  DROP COLUMN IF EXISTS din_student_city,
  DROP COLUMN IF EXISTS din_student_mobile_phone,
  DROP COLUMN IF EXISTS din_student_ducasse_email,
  DROP COLUMN IF EXISTS din_student_personal_email,
  DROP COLUMN IF EXISTS din_host_company_name,
  DROP COLUMN IF EXISTS din_host_company_email,
  DROP COLUMN IF EXISTS din_host_supervisor_chef_name,
  DROP COLUMN IF EXISTS din_host_supervisor_chef_email,
  DROP COLUMN IF EXISTS din_host_company_phone,
  DROP COLUMN IF EXISTS din_host_company_country,
  DROP COLUMN IF EXISTS din_host_company_city,
  DROP COLUMN IF EXISTS din_host_stage_start_date,
  DROP COLUMN IF EXISTS din_host_stage_end_date,
  DROP COLUMN IF EXISTS din_head_of_pedagogy,
  DROP COLUMN IF EXISTS din_civil_liability_insurance_ref,
  DROP COLUMN IF EXISTS din_intern_first_name,
  DROP COLUMN IF EXISTS din_intern_last_name,
  DROP COLUMN IF EXISTS din_intake_internship_type,
  DROP COLUMN IF EXISTS din_company_side_start_date,
  DROP COLUMN IF EXISTS din_company_side_end_date,
  DROP COLUMN IF EXISTS din_company_legal_name,
  DROP COLUMN IF EXISTS din_company_trade_name,
  DROP COLUMN IF EXISTS din_company_business_activity,
  DROP COLUMN IF EXISTS din_company_siret,
  DROP COLUMN IF EXISTS din_insurance_company_name,
  DROP COLUMN IF EXISTS din_insurance_policy_number,
  DROP COLUMN IF EXISTS din_company_address,
  DROP COLUMN IF EXISTS din_company_postal_code,
  DROP COLUMN IF EXISTS din_company_city,
  DROP COLUMN IF EXISTS din_hr_representative_name,
  DROP COLUMN IF EXISTS din_hr_representative_title,
  DROP COLUMN IF EXISTS din_hr_email,
  DROP COLUMN IF EXISTS din_hr_phone,
  DROP COLUMN IF EXISTS din_tutor_chef_name,
  DROP COLUMN IF EXISTS din_tutor_chef_position,
  DROP COLUMN IF EXISTS din_tutor_chef_email,
  DROP COLUMN IF EXISTS din_tutor_chef_phone,
  DROP COLUMN IF EXISTS din_weekly_schedule,
  DROP COLUMN IF EXISTS din_compensation_monthly_or_hourly,
  DROP COLUMN IF EXISTS din_benefits_offered,
  DROP COLUMN IF EXISTS din_tasks_assigned,
  DROP COLUMN IF EXISTS din_partner_form_extras_text,
  DROP COLUMN IF EXISTS din_raw_payload_text;

CREATE VIEW careers.v_merged_overview AS
SELECT m.*, 'matched'::text AS match_status
  FROM careers.merged_internship m;

CREATE OR REPLACE FUNCTION careers.try_merge_internship(p_student_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_sub      student_submission%ROWTYPE;
    v_intern   declared_intern%ROWTYPE;
    v_decl     company_declaration%ROWTYPE;
    v_company  company%ROWTYPE;
    v_student  student%ROWTYPE;
    v_ss_season intake_season;
    v_ss_year   INT;
    v_campus   TEXT;
    v_programme TEXT;
    v_ct_full  TEXT;
    v_ct_email TEXT;
    v_ct_role  TEXT;
    v_ct_phone TEXT;
BEGIN
    SELECT s.* INTO v_sub
      FROM student_submission s
     WHERE s.student_id = p_student_id
       AND s.status     = 'approved'
     ORDER BY s.reviewed_at DESC NULLS LAST, s.submitted_at DESC
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT p.season, p.year INTO v_ss_season, v_ss_year
      FROM promotion p
     WHERE p.id = v_sub.promotion_id;

    SELECT di.* INTO v_intern
      FROM declared_intern di
      JOIN company_declaration cd ON cd.id = di.declaration_id
     WHERE di.student_id = p_student_id
     ORDER BY cd.updated_at DESC NULLS LAST, cd.submitted_at DESC, di.id DESC
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO v_decl    FROM company_declaration WHERE id = v_intern.declaration_id;
    SELECT * INTO v_company FROM company             WHERE id = v_decl.company_id;
    SELECT * INTO v_student FROM student             WHERE id = v_sub.student_uuid;

    SELECT c.name, pr.name INTO v_campus, v_programme
      FROM student s
      JOIN promotion p2 ON p2.id = s.promotion_id
      JOIN campus c ON c.id = p2.campus_id
      JOIN programme pr ON pr.id = p2.programme_id
     WHERE s.id = v_sub.student_uuid;

    SELECT cc.full_name, cc.email, cc.role, cc.phone
      INTO v_ct_full, v_ct_email, v_ct_role, v_ct_phone
      FROM company_contact cc
     WHERE cc.company_id = v_company.id
     ORDER BY cc.is_primary DESC, cc.id
     LIMIT 1;

    INSERT INTO merged_internship (
        student_id, student_uuid, submission_id, company_id, declared_intern_id,
        season, year,
        merged_at, updated_at,
        st_first_name, st_last_name, st_email, st_phone,
        st_campus_name, st_programme_name,
        ss_company_name, ss_company_country, ss_company_city, ss_position, ss_missions,
        ss_start_date, ss_end_date,
        ss_tutor_name, ss_tutor_email,
        ss_campus_input_label, ss_programme_input_label, ss_career_head_name, ss_accepted_terms,
        ss_personal_email, ss_company_email, ss_company_phone, ss_student_address, ss_student_postal_code, ss_student_city,
        ss_civil_liability_insurance_ref, ss_status, ss_reviewer_comment, ss_reviewed_at,
        ss_submitted_at,
        co_name, co_country, co_sector, co_size_bucket, co_trade_name, co_siret,
        co_insurance_company, co_insurance_policy, co_address, co_city, co_postal_code, co_website,
        cct_full_name, cct_email, cct_role, cct_phone,
        din_first_name, din_last_name, din_internship_type, din_position, din_start_date, din_end_date,
        din_tutor_name, din_tutor_email, din_tutor_phone
    ) VALUES (
        p_student_id, v_student.id, v_sub.id, v_company.id, v_intern.id,
        v_ss_season, v_ss_year,
        now(), now(),
        v_student.first_name, v_student.last_name, v_student.email, v_student.phone,
        v_campus, v_programme,
        v_sub.company_name, v_sub.company_country, v_sub.company_city, v_sub.position, v_sub.missions,
        v_sub.start_date, v_sub.end_date,
        v_sub.tutor_name, v_sub.tutor_email,
        v_sub.campus_input_label, v_sub.programme_input_label, v_sub.career_head_name, v_sub.accepted_terms,
        v_sub.personal_email, v_sub.company_email, v_sub.company_phone, v_sub.student_address, v_sub.student_postal_code, v_sub.student_city,
        v_sub.civil_liability_insurance_ref, v_sub.status, v_sub.reviewer_comment, v_sub.reviewed_at,
        v_sub.submitted_at,
        v_company.name, v_company.country, v_company.sector, v_company.size_bucket, v_company.trade_name, v_company.siret,
        v_company.insurance_company, v_company.insurance_policy, v_company.address, v_company.city, v_company.postal_code, v_company.website,
        v_ct_full, v_ct_email, v_ct_role, v_ct_phone,
        v_intern.first_name, v_intern.last_name, v_intern.internship_type, v_intern.position, v_intern.start_date, v_intern.end_date,
        v_intern.tutor_name, v_intern.tutor_email, v_intern.tutor_phone
    )
    ON CONFLICT (student_id) DO UPDATE SET
        student_uuid          = EXCLUDED.student_uuid,
        submission_id         = EXCLUDED.submission_id,
        company_id            = EXCLUDED.company_id,
        declared_intern_id    = EXCLUDED.declared_intern_id,
        season                  = EXCLUDED.season,
        year                    = EXCLUDED.year,
        merged_at             = now(),
        updated_at            = now(),
        st_first_name = EXCLUDED.st_first_name, st_last_name = EXCLUDED.st_last_name,
        st_email = EXCLUDED.st_email, st_phone = EXCLUDED.st_phone,
        st_campus_name = EXCLUDED.st_campus_name, st_programme_name = EXCLUDED.st_programme_name,
        ss_company_name = EXCLUDED.ss_company_name, ss_company_country = EXCLUDED.ss_company_country,
        ss_company_city = EXCLUDED.ss_company_city, ss_position = EXCLUDED.ss_position, ss_missions = EXCLUDED.ss_missions,
        ss_start_date = EXCLUDED.ss_start_date, ss_end_date = EXCLUDED.ss_end_date,
        ss_tutor_name = EXCLUDED.ss_tutor_name, ss_tutor_email = EXCLUDED.ss_tutor_email,
        ss_campus_input_label = EXCLUDED.ss_campus_input_label, ss_programme_input_label = EXCLUDED.ss_programme_input_label,
        ss_career_head_name = EXCLUDED.ss_career_head_name, ss_accepted_terms = EXCLUDED.ss_accepted_terms,
        ss_personal_email = EXCLUDED.ss_personal_email, ss_company_email = EXCLUDED.ss_company_email, ss_company_phone = EXCLUDED.ss_company_phone,
        ss_student_address = EXCLUDED.ss_student_address, ss_student_postal_code = EXCLUDED.ss_student_postal_code, ss_student_city = EXCLUDED.ss_student_city,
        ss_civil_liability_insurance_ref = EXCLUDED.ss_civil_liability_insurance_ref, ss_status = EXCLUDED.ss_status,
        ss_reviewer_comment = EXCLUDED.ss_reviewer_comment, ss_reviewed_at = EXCLUDED.ss_reviewed_at,
        ss_submitted_at = EXCLUDED.ss_submitted_at,
        co_name = EXCLUDED.co_name, co_country = EXCLUDED.co_country, co_sector = EXCLUDED.co_sector, co_size_bucket = EXCLUDED.co_size_bucket,
        co_trade_name = EXCLUDED.co_trade_name, co_siret = EXCLUDED.co_siret, co_insurance_company = EXCLUDED.co_insurance_company,
        co_insurance_policy = EXCLUDED.co_insurance_policy, co_address = EXCLUDED.co_address, co_city = EXCLUDED.co_city, co_postal_code = EXCLUDED.co_postal_code,
        co_website = EXCLUDED.co_website,
        cct_full_name = EXCLUDED.cct_full_name, cct_email = EXCLUDED.cct_email, cct_role = EXCLUDED.cct_role, cct_phone = EXCLUDED.cct_phone,
        din_first_name = EXCLUDED.din_first_name, din_last_name = EXCLUDED.din_last_name,
        din_internship_type = EXCLUDED.din_internship_type, din_position = EXCLUDED.din_position, din_start_date = EXCLUDED.din_start_date, din_end_date = EXCLUDED.din_end_date,
        din_tutor_name = EXCLUDED.din_tutor_name, din_tutor_email = EXCLUDED.din_tutor_email, din_tutor_phone = EXCLUDED.din_tutor_phone;
END $$;
