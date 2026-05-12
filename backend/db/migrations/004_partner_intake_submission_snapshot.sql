SET search_path TO careers, public;

-- Une ligne par stagiaire déclaré : copie « grille Excel » du formulaire partenaire au moment de l’envoi
-- (y compris après autocomplétion entreprise). Colonnes nulles si le formulaire ne les propose pas encore.
CREATE TABLE IF NOT EXISTS partner_intake_submission_snapshot (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    declaration_id              UUID NOT NULL REFERENCES company_declaration(id) ON DELETE CASCADE,
    declared_intern_id          UUID NOT NULL REFERENCES declared_intern(id) ON DELETE CASCADE,
    company_id                  UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    student_id_normalized       TEXT NOT NULL,
    accepted_terms              BOOLEAN,
    programme_class_level       TEXT,
    first_name                  TEXT,
    last_name                   TEXT,
    birth_date                  DATE,
    student_current_address     TEXT,
    student_postal_code         TEXT,
    student_city                TEXT,
    student_mobile_phone        TEXT,
    student_ducasse_email       TEXT,
    student_personal_email      TEXT,
    host_company_name           TEXT,
    host_company_email          TEXT,
    host_supervisor_chef_name   TEXT,
    host_supervisor_chef_email  TEXT,
    host_company_phone          TEXT,
    host_company_country        TEXT,
    host_company_city           TEXT,
    host_stage_start_date       DATE,
    host_stage_end_date         DATE,
    head_of_pedagogy            TEXT,
    civil_liability_insurance_ref TEXT,
    intern_first_name           TEXT,
    intern_last_name            TEXT,
    internship_type             TEXT,
    company_side_start_date     DATE,
    company_side_end_date       DATE,
    company_legal_name          TEXT,
    company_trade_name          TEXT,
    company_business_activity   TEXT,
    company_siret               TEXT,
    insurance_company_name      TEXT,
    insurance_policy_number     TEXT,
    company_address             TEXT,
    company_postal_code         TEXT,
    company_city                TEXT,
    hr_representative_name      TEXT,
    hr_representative_title     TEXT,
    hr_email                    TEXT,
    hr_phone                    TEXT,
    tutor_chef_name             TEXT,
    tutor_chef_position         TEXT,
    tutor_email                 TEXT,
    tutor_phone                 TEXT,
    weekly_schedule             TEXT,
    compensation_monthly_or_hourly TEXT,
    benefits_offered            TEXT,
    tasks_assigned              TEXT,

    raw_payload                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_partner_snapshot_declaration ON partner_intake_submission_snapshot(declaration_id);
CREATE INDEX IF NOT EXISTS idx_partner_snapshot_student ON partner_intake_submission_snapshot(student_id_normalized);
CREATE INDEX IF NOT EXISTS idx_partner_snapshot_company ON partner_intake_submission_snapshot(company_id);
