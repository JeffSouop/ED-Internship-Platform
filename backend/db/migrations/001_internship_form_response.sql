-- À appliquer sur une base déjà initialisée (volume Docker existant).
SET search_path TO careers, public;

CREATE TABLE IF NOT EXISTS internship_form_response (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id_text  TEXT NOT NULL,
    payload          JSONB NOT NULL,
    submission_id    UUID REFERENCES student_submission(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_response_student ON internship_form_response(student_id_text);
CREATE INDEX IF NOT EXISTS idx_form_response_created ON internship_form_response(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_response_sub ON internship_form_response(submission_id);

CREATE OR REPLACE VIEW v_submissions_validated AS
SELECT ss.*
  FROM student_submission ss
 WHERE ss.status = 'approved';

CREATE OR REPLACE VIEW v_submissions_pending_review AS
SELECT ss.*
  FROM student_submission ss
 WHERE ss.status IN ('pending', 'changes_requested');

CREATE OR REPLACE VIEW v_submissions_not_validated AS
SELECT ss.*
  FROM student_submission ss
 WHERE ss.status <> 'approved';
