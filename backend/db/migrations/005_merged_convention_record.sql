SET search_path TO careers, public;

-- Enrichissement merged : dossier complet pour génération des conventions de stage.
ALTER TABLE merged_internship
  ADD COLUMN IF NOT EXISTS partner_snapshot_id UUID REFERENCES partner_intake_submission_snapshot(id) ON DELETE SET NULL;

ALTER TABLE merged_internship
  ADD COLUMN IF NOT EXISTS convention_record JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION try_merge_internship(
    p_student_id TEXT,
    p_season     intake_season,
    p_year       INT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_sub      student_submission%ROWTYPE;
    v_intern   declared_intern%ROWTYPE;
    v_decl     company_declaration%ROWTYPE;
    v_company  company%ROWTYPE;
    v_student  student%ROWTYPE;
    v_bundle   JSONB;
    v_snap_id  UUID;
BEGIN
    SELECT s.* INTO v_sub
      FROM student_submission s
      JOIN promotion p ON p.id = s.promotion_id
     WHERE s.student_id = p_student_id
       AND s.status     = 'approved'
       AND p.season     = p_season
       AND p.year       = p_year
     ORDER BY s.reviewed_at DESC NULLS LAST
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT di.* INTO v_intern
      FROM declared_intern di
      JOIN company_declaration cd ON cd.id = di.declaration_id
     WHERE di.student_id = p_student_id
       AND cd.season     = p_season
       AND cd.year       = p_year
     LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO v_decl    FROM company_declaration WHERE id = v_intern.declaration_id;
    SELECT * INTO v_company FROM company             WHERE id = v_decl.company_id;
    SELECT * INTO v_student FROM student             WHERE id = v_sub.student_uuid;

    SELECT ps.id INTO v_snap_id
      FROM partner_intake_submission_snapshot ps
     WHERE ps.declared_intern_id = v_intern.id
     ORDER BY ps.submitted_at DESC NULLS LAST
     LIMIT 1;

    SELECT jsonb_build_object(
      'student',
      (SELECT to_jsonb(s) FROM student s WHERE s.id = v_student.id),
      'submission',
      (SELECT to_jsonb(sb) FROM student_submission sb WHERE sb.id = v_sub.id),
      'company',
      (
        SELECT to_jsonb(c) || jsonb_build_object(
          'contacts',
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(ct)) FROM company_contact ct WHERE ct.company_id = c.id),
            '[]'::jsonb
          )
        )
        FROM company c
        WHERE c.id = v_company.id
      ),
      'declaredIntern',
      (SELECT to_jsonb(d) FROM declared_intern d WHERE d.id = v_intern.id),
      'partnerSnapshot',
      (
        SELECT to_jsonb(ps)
        FROM partner_intake_submission_snapshot ps
        WHERE ps.declared_intern_id = v_intern.id
        ORDER BY ps.submitted_at DESC NULLS LAST
        LIMIT 1
      )
    ) INTO v_bundle;

    INSERT INTO merged_internship (
        student_id, student_uuid, submission_id, company_id, declared_intern_id,
        season, year,
        student_full_name, student_email,
        company_name, company_country,
        position, start_date, end_date, tutor_name, tutor_email,
        partner_snapshot_id, convention_record
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
        v_snap_id,
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
        partner_snapshot_id   = EXCLUDED.partner_snapshot_id,
        convention_record     = EXCLUDED.convention_record;
END $$;

-- Après insertion du snapshot (souvent après le trigger sur declared_intern), recalculer le merge.
CREATE OR REPLACE FUNCTION trg_partner_snapshot_merge()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  sid TEXT;
  se  intake_season;
  y   INT;
BEGIN
  SELECT di.student_id, cd.season, cd.year INTO sid, se, y
    FROM declared_intern di
    JOIN company_declaration cd ON cd.id = di.declaration_id
   WHERE di.id = NEW.declared_intern_id;
  IF sid IS NOT NULL THEN
    PERFORM try_merge_internship(sid, se, y);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_partner_snapshot_merge ON partner_intake_submission_snapshot;
CREATE TRIGGER trg_partner_snapshot_merge
AFTER INSERT ON partner_intake_submission_snapshot
FOR EACH ROW EXECUTE FUNCTION trg_partner_snapshot_merge();

CREATE OR REPLACE VIEW v_merged_overview AS
SELECT m.*, 'matched'::text AS match_status
  FROM merged_internship m
UNION ALL
SELECT NULL::uuid, ss.student_id, ss.student_uuid, ss.id, NULL::uuid, NULL::uuid,
       p.season, p.year,
       st.first_name || ' ' || st.last_name, st.email,
       ss.company_name, ss.company_country,
       ss.position, ss.start_date, ss.end_date,
       ss.tutor_name, ss.tutor_email, ss.submitted_at, ss.updated_at,
       NULL::uuid, '{}'::jsonb,
       'student_only'::text
  FROM student_submission ss
  JOIN student st ON st.id = ss.student_uuid
  JOIN promotion p ON p.id = ss.promotion_id
 WHERE ss.status = 'approved'
   AND NOT EXISTS (
        SELECT 1 FROM merged_internship m
         WHERE m.student_id = ss.student_id
           AND m.season = p.season AND m.year = p.year)
UNION ALL
SELECT NULL::uuid, di.student_id, NULL::uuid, NULL::uuid, c.id, di.id,
       cd.season, cd.year,
       NULL::text, NULL::text,
       c.name, c.country,
       di.position, di.start_date, di.end_date,
       di.tutor_name, di.tutor_email, cd.submitted_at, cd.updated_at,
       NULL::uuid, '{}'::jsonb,
       'company_only'::text
  FROM declared_intern di
  JOIN company_declaration cd ON cd.id = di.declaration_id
  JOIN company c ON c.id = cd.company_id
 WHERE NOT EXISTS (
        SELECT 1 FROM merged_internship m
         WHERE m.student_id = di.student_id
           AND m.season = cd.season AND m.year = cd.year);
