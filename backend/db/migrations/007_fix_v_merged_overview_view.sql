-- Correctif : UNION de v_merged_overview — liste explicite des colonnes (évite décalage avec m.*).
-- Certaines bases n’ont jamais eu la migration 003 (updated_at) ou 005 (convention_record) : on complète avant la vue.
SET search_path TO careers, public;

ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE careers.merged_internship SET updated_at = merged_at;

ALTER TABLE careers.merged_internship
  ADD COLUMN IF NOT EXISTS convention_record JSONB NOT NULL DEFAULT '{}'::jsonb;

-- DROP obligatoire : le nombre/ordre des colonnes change par rapport à l’ancienne vue (CREATE OR REPLACE refuse).
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
