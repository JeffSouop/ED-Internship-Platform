-- Enregistrements formulaires structurés : une ligne = un envoi (étudiant / entreprise).
-- Supprime internship_form_response, partner_intake_submission_snapshot ; fusionne la grille partenaire dans declared_intern.

SET search_path TO careers, public;

-- 1. Statut « remplacé par un nouvel envoi »
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'careers' AND t.typname = 'submission_status' AND e.enumlabel = 'superseded'
  ) THEN
    ALTER TYPE careers.submission_status ADD VALUE 'superseded';
  END IF;
END $$;

-- 2. Soumission étudiant : champs formulaire + suppression contrainte « une seule active »
ALTER TABLE careers.student_submission
  ADD COLUMN IF NOT EXISTS campus_input_label TEXT,
  ADD COLUMN IF NOT EXISTS programme_input_label TEXT,
  ADD COLUMN IF NOT EXISTS career_head_name TEXT,
  ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN,
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS student_address TEXT,
  ADD COLUMN IF NOT EXISTS student_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS student_city TEXT,
  ADD COLUMN IF NOT EXISTS civil_liability_insurance_ref TEXT;

DROP INDEX IF EXISTS careers.uniq_active_sub_per_student;

-- 3. Déclaration entreprise : retirer JSON redondant (déplacé sur declared_intern)
ALTER TABLE careers.company_declaration DROP COLUMN IF EXISTS partner_form_extras;

-- 4. Stagiaire déclaré : colonnes formulaire entreprise (ex-snapshot)
ALTER TABLE careers.declared_intern
  ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN,
  ADD COLUMN IF NOT EXISTS programme_class_level TEXT,
  ADD COLUMN IF NOT EXISTS grid_first_name TEXT,
  ADD COLUMN IF NOT EXISTS grid_last_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS student_current_address TEXT,
  ADD COLUMN IF NOT EXISTS student_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS student_city TEXT,
  ADD COLUMN IF NOT EXISTS student_mobile_phone TEXT,
  ADD COLUMN IF NOT EXISTS student_ducasse_email TEXT,
  ADD COLUMN IF NOT EXISTS student_personal_email TEXT,
  ADD COLUMN IF NOT EXISTS host_company_name TEXT,
  ADD COLUMN IF NOT EXISTS host_company_email TEXT,
  ADD COLUMN IF NOT EXISTS host_supervisor_chef_name TEXT,
  ADD COLUMN IF NOT EXISTS host_supervisor_chef_email TEXT,
  ADD COLUMN IF NOT EXISTS host_company_phone TEXT,
  ADD COLUMN IF NOT EXISTS host_company_country TEXT,
  ADD COLUMN IF NOT EXISTS host_company_city TEXT,
  ADD COLUMN IF NOT EXISTS host_stage_start_date DATE,
  ADD COLUMN IF NOT EXISTS host_stage_end_date DATE,
  ADD COLUMN IF NOT EXISTS head_of_pedagogy TEXT,
  ADD COLUMN IF NOT EXISTS civil_liability_insurance_ref TEXT,
  ADD COLUMN IF NOT EXISTS intern_first_name TEXT,
  ADD COLUMN IF NOT EXISTS intern_last_name TEXT,
  ADD COLUMN IF NOT EXISTS intake_internship_type TEXT,
  ADD COLUMN IF NOT EXISTS company_side_start_date DATE,
  ADD COLUMN IF NOT EXISTS company_side_end_date DATE,
  ADD COLUMN IF NOT EXISTS company_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS company_trade_name TEXT,
  ADD COLUMN IF NOT EXISTS company_business_activity TEXT,
  ADD COLUMN IF NOT EXISTS company_siret TEXT,
  ADD COLUMN IF NOT EXISTS insurance_company_name TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS company_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS company_city TEXT,
  ADD COLUMN IF NOT EXISTS hr_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_representative_title TEXT,
  ADD COLUMN IF NOT EXISTS hr_email TEXT,
  ADD COLUMN IF NOT EXISTS hr_phone TEXT,
  ADD COLUMN IF NOT EXISTS tutor_chef_name TEXT,
  ADD COLUMN IF NOT EXISTS tutor_chef_position TEXT,
  ADD COLUMN IF NOT EXISTS tutor_chef_email TEXT,
  ADD COLUMN IF NOT EXISTS tutor_chef_phone TEXT,
  ADD COLUMN IF NOT EXISTS weekly_schedule TEXT,
  ADD COLUMN IF NOT EXISTS compensation_monthly_or_hourly TEXT,
  ADD COLUMN IF NOT EXISTS benefits_offered TEXT,
  ADD COLUMN IF NOT EXISTS tasks_assigned TEXT,
  ADD COLUMN IF NOT EXISTS partner_form_extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 5. Copier les snapshots existants vers declared_intern (si la table snapshot existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'careers' AND table_name = 'partner_intake_submission_snapshot'
  ) THEN
    UPDATE careers.declared_intern di SET
      accepted_terms = ps.accepted_terms,
      programme_class_level = ps.programme_class_level,
      grid_first_name = ps.first_name,
      grid_last_name = ps.last_name,
      birth_date = ps.birth_date,
      student_current_address = ps.student_current_address,
      student_postal_code = ps.student_postal_code,
      student_city = ps.student_city,
      student_mobile_phone = ps.student_mobile_phone,
      student_ducasse_email = ps.student_ducasse_email,
      student_personal_email = ps.student_personal_email,
      host_company_name = ps.host_company_name,
      host_company_email = ps.host_company_email,
      host_supervisor_chef_name = ps.host_supervisor_chef_name,
      host_supervisor_chef_email = ps.host_supervisor_chef_email,
      host_company_phone = ps.host_company_phone,
      host_company_country = ps.host_company_country,
      host_company_city = ps.host_company_city,
      host_stage_start_date = ps.host_stage_start_date,
      host_stage_end_date = ps.host_stage_end_date,
      head_of_pedagogy = ps.head_of_pedagogy,
      civil_liability_insurance_ref = ps.civil_liability_insurance_ref,
      intern_first_name = ps.intern_first_name,
      intern_last_name = ps.intern_last_name,
      intake_internship_type = ps.internship_type,
      company_side_start_date = ps.company_side_start_date,
      company_side_end_date = ps.company_side_end_date,
      company_legal_name = ps.company_legal_name,
      company_trade_name = ps.company_trade_name,
      company_business_activity = ps.company_business_activity,
      company_siret = ps.company_siret,
      insurance_company_name = ps.insurance_company_name,
      insurance_policy_number = ps.insurance_policy_number,
      company_address = ps.company_address,
      company_postal_code = ps.company_postal_code,
      company_city = ps.company_city,
      hr_representative_name = ps.hr_representative_name,
      hr_representative_title = ps.hr_representative_title,
      hr_email = ps.hr_email,
      hr_phone = ps.hr_phone,
      tutor_chef_name = ps.tutor_chef_name,
      tutor_chef_position = ps.tutor_chef_position,
      tutor_chef_email = ps.tutor_email,
      tutor_chef_phone = ps.tutor_phone,
      weekly_schedule = ps.weekly_schedule,
      compensation_monthly_or_hourly = ps.compensation_monthly_or_hourly,
      benefits_offered = ps.benefits_offered,
      tasks_assigned = ps.tasks_assigned,
      raw_payload = ps.raw_payload
    FROM careers.partner_intake_submission_snapshot ps
    WHERE ps.declared_intern_id = di.id;
  END IF;
END $$;

-- 6. merged_internship : retirer la FK snapshot
ALTER TABLE careers.merged_internship DROP COLUMN IF EXISTS partner_snapshot_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'careers' AND table_name = 'partner_intake_submission_snapshot'
  ) THEN
    DROP TRIGGER IF EXISTS trg_partner_snapshot_merge ON careers.partner_intake_submission_snapshot;
  END IF;
END $$;

DROP FUNCTION IF EXISTS careers.trg_partner_snapshot_merge();

DROP TABLE IF EXISTS careers.partner_intake_submission_snapshot;

-- 7. Journal formulaire étudiant → données dans student_submission
DROP TABLE IF EXISTS careers.internship_form_response;

-- 8. Fonction merge + vue admin
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
    v_bundle   JSONB;
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

    SELECT jsonb_build_object(
      'student',
      (SELECT to_jsonb(s) FROM careers.student s WHERE s.id = v_student.id),
      'submission',
      (SELECT to_jsonb(sb) FROM careers.student_submission sb WHERE sb.id = v_sub.id),
      'company',
      (
        SELECT to_jsonb(c) || jsonb_build_object(
          'contacts',
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(ct)) FROM careers.company_contact ct WHERE ct.company_id = c.id),
            '[]'::jsonb
          )
        )
        FROM careers.company c
        WHERE c.id = v_company.id
      ),
      'declaredIntern',
      (SELECT to_jsonb(d) FROM careers.declared_intern d WHERE d.id = v_intern.id)
    ) INTO v_bundle;

    INSERT INTO careers.merged_internship (
        student_id, student_uuid, submission_id, company_id, declared_intern_id,
        season, year,
        student_full_name, student_email,
        company_name, company_country,
        position, start_date, end_date, tutor_name, tutor_email,
        convention_record
    ) VALUES (
        p_student_id, v_student.id, v_sub.id, v_company.id, v_intern.id,
        p_season, p_year,
        v_student.first_name || ' ' || v_student.last_name, v_student.email,
        v_company.name, v_company.country,
        COALESCE(v_intern.position, v_sub.position),
        COALESCE(v_intern.start_date, v_sub.start_date),
        COALESCE(v_intern.end_date,   v_sub.end_date),
        COALESCE(v_intern.tutor_name, v_sub.tutor_name),
        COALESCE(v_intern.tutor_email, v_sub.tutor_email),
        COALESCE(v_bundle, '{}'::jsonb)
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
        convention_record     = EXCLUDED.convention_record;
END $$;

-- Alignement schéma merged (si migrations 003 / 005 partielles)
ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE careers.merged_internship SET updated_at = merged_at;
ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS convention_record JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP VIEW IF EXISTS careers.v_merged_overview CASCADE;

CREATE VIEW careers.v_merged_overview AS
SELECT m.id, m.student_id, m.student_uuid, m.submission_id, m.company_id, m.declared_intern_id,
       m.season, m.year,
       m.student_full_name, m.student_email,
       m.company_name, m.company_country,
       m.position, m.start_date, m.end_date,
       m.tutor_name, m.tutor_email,
       m.merged_at, m.updated_at,
       m.convention_record,
       'matched'::text AS match_status
  FROM careers.merged_internship m
UNION ALL
SELECT NULL::uuid, ss.student_id, ss.student_uuid, ss.id, NULL::uuid, NULL::uuid,
       p.season, p.year,
       st.first_name || ' ' || st.last_name, st.email,
       ss.company_name, ss.company_country,
       ss.position, ss.start_date, ss.end_date,
       ss.tutor_name, ss.tutor_email, ss.submitted_at, ss.updated_at,
       '{}'::jsonb,
       'student_only'::text
  FROM careers.student_submission ss
  JOIN careers.student st ON st.id = ss.student_uuid
  JOIN careers.promotion p ON p.id = ss.promotion_id
 WHERE ss.status = 'approved'
   AND NOT EXISTS (
        SELECT 1 FROM careers.merged_internship m2
         WHERE m2.student_id = ss.student_id
           AND m2.season = p.season AND m2.year = p.year)
UNION ALL
SELECT NULL::uuid, di.student_id, NULL::uuid, NULL::uuid, c.id, di.id,
       cd.season, cd.year,
       NULL::text, NULL::text,
       c.name, c.country,
       di.position, di.start_date, di.end_date,
       di.tutor_name, di.tutor_email, cd.submitted_at, cd.updated_at,
       '{}'::jsonb,
       'company_only'::text
  FROM careers.declared_intern di
  JOIN careers.company_declaration cd ON cd.id = di.declaration_id
  JOIN careers.company c ON c.id = cd.company_id
 WHERE NOT EXISTS (
        SELECT 1 FROM careers.merged_internship m2
         WHERE m2.student_id = di.student_id
           AND m2.season = cd.season AND m2.year = cd.year);

CREATE OR REPLACE VIEW careers.v_submission_dashboard AS
SELECT s.student_id,
       s.first_name || ' ' || s.last_name AS student_name,
       s.email,
       p.label AS intake_label,
       sub.status,
       sub.company_name,
       sub.company_country,
       sub.start_date,
       sub.end_date,
       sub.submitted_at,
       sub.reviewed_at
  FROM careers.student s
  JOIN careers.promotion p ON p.id = s.promotion_id
  LEFT JOIN LATERAL (
        SELECT * FROM careers.student_submission ss
         WHERE ss.student_uuid = s.id
           AND ss.status NOT IN ('rejected'::careers.submission_status, 'superseded'::careers.submission_status)
         ORDER BY ss.submitted_at DESC LIMIT 1
  ) sub ON TRUE;
