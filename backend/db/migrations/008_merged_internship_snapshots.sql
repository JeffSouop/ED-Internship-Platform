-- Snapshots JSON explicites sur merged_internship (étudiant, soumission, entreprise+contacts, declared_intern).
-- Rétro-remplissage depuis convention_record ; vue v_merged_overview alignée (y compris branches student_only / company_only).
SET search_path TO careers, public;

ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS merged_student JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS merged_student_submission JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS merged_company JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS merged_declared_intern JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE careers.merged_internship mi
   SET merged_student = COALESCE(NULLIF(mi.convention_record #> '{student}', 'null'::jsonb), '{}'::jsonb),
       merged_student_submission = COALESCE(NULLIF(mi.convention_record #> '{submission}', 'null'::jsonb), '{}'::jsonb),
       merged_company = COALESCE(NULLIF(mi.convention_record #> '{company}', 'null'::jsonb), '{}'::jsonb),
       merged_declared_intern = COALESCE(NULLIF(mi.convention_record #> '{declaredIntern}', 'null'::jsonb), '{}'::jsonb)
 WHERE mi.convention_record IS NOT NULL
   AND mi.convention_record <> '{}'::jsonb;

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
    v_student_js JSONB;
    v_sub_js     JSONB;
    v_company_js JSONB;
    v_intern_js  JSONB;
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

    SELECT to_jsonb(s) INTO v_student_js FROM careers.student s WHERE s.id = v_student.id;
    SELECT to_jsonb(sb) INTO v_sub_js FROM careers.student_submission sb WHERE sb.id = v_sub.id;
    SELECT to_jsonb(c) || jsonb_build_object(
          'contacts',
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(ct)) FROM careers.company_contact ct WHERE ct.company_id = c.id),
            '[]'::jsonb
          )
        ) INTO v_company_js
      FROM careers.company c
     WHERE c.id = v_company.id;
    SELECT to_jsonb(d) INTO v_intern_js FROM careers.declared_intern d WHERE d.id = v_intern.id;

    v_bundle := jsonb_build_object(
      'student',        COALESCE(v_student_js, '{}'::jsonb),
      'submission',     COALESCE(v_sub_js, '{}'::jsonb),
      'company',        COALESCE(v_company_js, '{}'::jsonb),
      'declaredIntern', COALESCE(v_intern_js, '{}'::jsonb)
    );

    INSERT INTO careers.merged_internship (
        student_id, student_uuid, submission_id, company_id, declared_intern_id,
        season, year,
        student_full_name, student_email,
        company_name, company_country,
        position, start_date, end_date, tutor_name, tutor_email,
        merged_student, merged_student_submission, merged_company, merged_declared_intern,
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
        COALESCE(v_student_js, '{}'::jsonb),
        COALESCE(v_sub_js, '{}'::jsonb),
        COALESCE(v_company_js, '{}'::jsonb),
        COALESCE(v_intern_js, '{}'::jsonb),
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
        merged_student              = EXCLUDED.merged_student,
        merged_student_submission   = EXCLUDED.merged_student_submission,
        merged_company              = EXCLUDED.merged_company,
        merged_declared_intern      = EXCLUDED.merged_declared_intern,
        merged_at             = now(),
        updated_at            = now(),
        convention_record     = EXCLUDED.convention_record;
END $$;

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
       m.merged_student, m.merged_student_submission, m.merged_company, m.merged_declared_intern,
       'matched'::text AS match_status
  FROM careers.merged_internship m
UNION ALL
SELECT NULL::uuid, ss.student_id, ss.student_uuid, ss.id, NULL::uuid, NULL::uuid,
       p.season, p.year,
       st.first_name || ' ' || st.last_name, st.email,
       ss.company_name, ss.company_country,
       ss.position, ss.start_date, ss.end_date,
       ss.tutor_name, ss.tutor_email, ss.submitted_at, ss.updated_at,
       jsonb_build_object(
         'student',    (SELECT to_jsonb(s) FROM careers.student s WHERE s.id = ss.student_uuid),
         'submission', (SELECT to_jsonb(su) FROM careers.student_submission su WHERE su.id = ss.id)
       ),
       (SELECT to_jsonb(s) FROM careers.student s WHERE s.id = ss.student_uuid),
       (SELECT to_jsonb(su) FROM careers.student_submission su WHERE su.id = ss.id),
       '{}'::jsonb,
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
       jsonb_build_object(
         'company',        (SELECT to_jsonb(co) || jsonb_build_object(
                              'contacts',
                              COALESCE(
                                (SELECT jsonb_agg(to_jsonb(ct)) FROM careers.company_contact ct WHERE ct.company_id = co.id),
                                '[]'::jsonb
                              )
                            ) FROM careers.company co WHERE co.id = c.id),
         'declaredIntern', (SELECT to_jsonb(d) FROM careers.declared_intern d WHERE d.id = di.id)
       ),
       '{}'::jsonb,
       '{}'::jsonb,
       (SELECT to_jsonb(co) || jsonb_build_object(
          'contacts',
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(ct)) FROM careers.company_contact ct WHERE ct.company_id = co.id),
            '[]'::jsonb
          )
        ) FROM careers.company co WHERE co.id = c.id),
       (SELECT to_jsonb(d) FROM careers.declared_intern d WHERE d.id = di.id),
       'company_only'::text
  FROM careers.declared_intern di
  JOIN careers.company_declaration cd ON cd.id = di.declaration_id
  JOIN careers.company c ON c.id = cd.company_id
 WHERE NOT EXISTS (
        SELECT 1 FROM careers.merged_internship m2
         WHERE m2.student_id = di.student_id
           AND m2.season = cd.season AND m2.year = cd.year);
