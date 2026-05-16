-- =====================================================================
-- École Ducasse — Département Stage & Carrière
-- Architecture base de données PostgreSQL
-- Version : 1.0
-- =====================================================================
-- Convention :
--   - snake_case pour tables et colonnes
--   - clés primaires UUID (gen_random_uuid)
--   - timestamps en timestamptz (UTC)
--   - student_id = pivot métier (string lisible, ex: "STU-2026-0001")
--     que l'on retrouve aussi côté étudiant et côté entreprise
--   - jointure automatique student ⨝ company via student_id
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;         -- recherche floue nom entreprise
CREATE EXTENSION IF NOT EXISTS unaccent;        -- normalisation accents

-- ---------------------------------------------------------------------
-- Schéma dédié
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS careers;
SET search_path TO careers, public;

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

-- Deux rentrées par an : Février et Septembre
CREATE TYPE intake_season AS ENUM ('FEB', 'SEP');

-- Statut workflow de validation côté équipe carrière
CREATE TYPE submission_status AS ENUM (
    'pending',             -- soumis, en attente
    'changes_requested',   -- demande de modification renvoyée à l'étudiant
    'approved',            -- validé
    'rejected',            -- refusé
    'superseded'           -- remplacé par un nouvel envoi (historique conservé)
);

-- Type d'utilisateur pour la table tokens (lien magique)
CREATE TYPE token_kind AS ENUM ('student', 'company');

-- Rôles internes équipe carrière
CREATE TYPE staff_role AS ENUM ('admin', 'reviewer', 'viewer');

-- =====================================================================
-- 2. RÉFÉRENTIELS
-- =====================================================================

CREATE TABLE campus (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,        -- ex: 'PARIS', 'YSSINGEAUX'
    name        TEXT NOT NULL,
    country     TEXT NOT NULL DEFAULT 'France'
);

CREATE TABLE programme (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,        -- ex: 'BACHELOR-CULINARY'
    name        TEXT NOT NULL,
    duration_months INT
);

-- Une promotion = (campus, programme, saison, année)
-- ex: Paris / Bachelor Culinary / FEB / 2026
CREATE TABLE promotion (
    id           SERIAL PRIMARY KEY,
    campus_id    INT NOT NULL REFERENCES campus(id),
    programme_id INT NOT NULL REFERENCES programme(id),
    season       intake_season NOT NULL,
    year         INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    -- Pas de GENERATED (enum::text n’est pas IMMUTABLE en PostgreSQL) : rempli par trigger
    label        TEXT NOT NULL,
    UNIQUE (campus_id, programme_id, season, year)
);

CREATE OR REPLACE FUNCTION set_promotion_label()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.label := NEW.season::text || '-' || NEW.year::text;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_promotion_label
    BEFORE INSERT OR UPDATE OF season, year ON promotion
    FOR EACH ROW EXECUTE FUNCTION set_promotion_label();

CREATE INDEX idx_promotion_season_year ON promotion(season, year);

-- =====================================================================
-- 3. ÉTUDIANTS
-- =====================================================================
-- student_id (TEXT) = identifiant métier pivot, communiqué à l'entreprise.
-- id (UUID) = clé technique.

CREATE TABLE student (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    TEXT NOT NULL UNIQUE,                 -- pivot, ex 'STU-2026-0001'
    promotion_id  INT  NOT NULL REFERENCES promotion(id),
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,
    nationality   TEXT,
    birth_date    DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_promotion ON student(promotion_id);
CREATE INDEX idx_student_name_trgm  ON student USING gin ((last_name || ' ' || first_name) gin_trgm_ops);

-- =====================================================================
-- 4. SOUMISSION ÉTUDIANT (formulaire stage)
-- =====================================================================
-- Un étudiant peut faire plusieurs soumissions dans le temps,
-- mais une seule "active" par promotion (contrainte applicative).

CREATE TABLE student_submission (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_uuid       UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    student_id         TEXT NOT NULL,                       -- copie du pivot pour jointure rapide
    promotion_id       INT  NOT NULL REFERENCES promotion(id),

    -- Entreprise déclarée par l'étudiant (free text au moment de la soumission)
    company_name       TEXT NOT NULL,
    company_country    TEXT NOT NULL,
    company_city       TEXT,

    -- Stage
    position           TEXT NOT NULL,
    missions           TEXT,
    start_date         DATE NOT NULL,
    end_date           DATE NOT NULL,
    weekly_hours       NUMERIC(5,2),
    gross_salary       NUMERIC(10,2),
    currency           CHAR(3) DEFAULT 'EUR',

    -- Tuteur entreprise déclaré par l'étudiant
    tutor_name         TEXT,
    tutor_email        TEXT,
    tutor_phone        TEXT,

    -- Formulaire convention (une ligne = un envoi complet, champs structurés)
    campus_input_label            TEXT,
    programme_input_label         TEXT,
    career_head_name              TEXT,
    accepted_terms                BOOLEAN,
    personal_email                 TEXT,
    company_email                  TEXT,
    company_phone                  TEXT,
    student_address                TEXT,
    student_postal_code            TEXT,
    student_city                   TEXT,
    civil_liability_insurance_ref  TEXT,

    -- Workflow
    status             submission_status NOT NULL DEFAULT 'pending',
    reviewer_comment   TEXT,
    reviewed_by        UUID,                                -- staff_user.id
    reviewed_at        TIMESTAMPTZ,

    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (end_date >= start_date)
);

CREATE INDEX idx_sub_student_id      ON student_submission(student_id);
CREATE INDEX idx_sub_status          ON student_submission(status);
CREATE INDEX idx_sub_promotion       ON student_submission(promotion_id);
CREATE INDEX idx_sub_company_name_tg ON student_submission USING gin (company_name gin_trgm_ops);

-- Historique des décisions (audit)
CREATE TABLE submission_review_history (
    id            BIGSERIAL PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES student_submission(id) ON DELETE CASCADE,
    from_status   submission_status,
    to_status     submission_status NOT NULL,
    comment       TEXT,
    actor_id      UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_hist_sub ON submission_review_history(submission_id);

-- Vues métier : le dossier officiel reste `student` + `student_submission`.
-- Validé = approuvé par l'équipe carrière ; « non validé » = tout autre statut.
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

-- =====================================================================
-- 5. ENTREPRISES
-- =====================================================================
-- Pivot métier : (name + country). Recherche floue via pg_trgm.

CREATE TABLE company (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,                 -- nom légal
    country      TEXT NOT NULL,
    sector       TEXT,
    size_bucket  TEXT,                          -- '1-10', '11-50', ...
    trade_name   TEXT,                          -- nom commercial
    siret        TEXT,                          -- n° d’immatriculation (SIRET ou équivalent)
    insurance_company TEXT,
    insurance_policy    TEXT,
    address      TEXT,
    city         TEXT,
    postal_code  TEXT,
    website      TEXT,
    latitude     DOUBLE PRECISION,
    longitude    DOUBLE PRECISION,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, country)
);

CREATE INDEX idx_company_name_trgm ON company USING gin (name gin_trgm_ops);
CREATE INDEX idx_company_country   ON company(country);

CREATE TABLE company_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT,
    phone       TEXT,
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (company_id, email)
);

CREATE INDEX idx_contact_company ON company_contact(company_id);

-- =====================================================================
-- 6. DÉCLARATION ENTREPRISE
-- =====================================================================
-- Une entreprise déclare la liste des étudiants qu'elle accueille
-- pour une rentrée donnée (intake = saison + année).

CREATE TABLE company_declaration (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    season        intake_season NOT NULL,
    year          INT NOT NULL,
    submitted_by  TEXT,                          -- email du contact qui a rempli
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, season, year)
);

CREATE INDEX idx_decl_intake ON company_declaration(season, year);

-- Un stagiaire déclaré + enregistrement complet du formulaire entreprise (une ligne par envoi / par stagiaire).
CREATE TABLE declared_intern (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    declaration_id  UUID NOT NULL REFERENCES company_declaration(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL,             -- pivot
    first_name      TEXT,
    last_name       TEXT,
    internship_type TEXT,                      -- ex. culinary | pastry (saisie courte liste)
    position        TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    tutor_name      TEXT,
    tutor_email     TEXT,
    tutor_phone     TEXT,
    notes           TEXT,

    accepted_terms              BOOLEAN,
    programme_class_level       TEXT,
    grid_first_name             TEXT,
    grid_last_name              TEXT,
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
    intake_internship_type      TEXT,
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
    tutor_chef_email            TEXT,
    tutor_chef_phone            TEXT,
    weekly_schedule             TEXT,
    compensation_monthly_or_hourly TEXT,
    benefits_offered            TEXT,
    tasks_assigned              TEXT,

    partner_form_extras         JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_payload                   JSONB NOT NULL DEFAULT '{}'::jsonb,

    CHECK (end_date >= start_date),
    UNIQUE (declaration_id, student_id)
);

CREATE INDEX idx_declared_intern_student ON declared_intern(student_id);

-- =====================================================================
-- 7. JOINTURE AUTOMATIQUE (table matérialisée alimentée par trigger)
-- =====================================================================
-- Dès qu'une soumission étudiant est 'approved' ET qu'il existe une
-- declared_intern avec le même student_id (peu importe la rentrée déclarée côté entreprise),
-- on insère/maj une ligne ici (une ligne par student_id).

-- Snapshot minimal pour l’API (liste fusionnée). Le détail salaire, RH, grille Excel, JSON, etc.
-- reste dans student_submission / declared_intern / company.
CREATE TABLE merged_internship (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id               TEXT NOT NULL,
    student_uuid             UUID REFERENCES student(id)              ON DELETE SET NULL,
    submission_id            UUID REFERENCES student_submission(id)   ON DELETE SET NULL,
    company_id               UUID REFERENCES company(id)              ON DELETE SET NULL,
    declared_intern_id       UUID REFERENCES declared_intern(id)      ON DELETE SET NULL,

    season                   intake_season NOT NULL,
    year                     INT NOT NULL,

    merged_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    st_first_name            TEXT,
    st_last_name             TEXT,
    st_email                 TEXT,
    st_phone                 TEXT,
    st_campus_name           TEXT,
    st_programme_name        TEXT,

    ss_company_name          TEXT,
    ss_company_country       TEXT,
    ss_company_city          TEXT,
    ss_position              TEXT,
    ss_missions              TEXT,
    ss_start_date            DATE,
    ss_end_date              DATE,
    ss_tutor_name            TEXT,
    ss_tutor_email           TEXT,
    ss_campus_input_label    TEXT,
    ss_programme_input_label TEXT,
    ss_career_head_name      TEXT,
    ss_accepted_terms        BOOLEAN,
    ss_personal_email        TEXT,
    ss_company_email         TEXT,
    ss_company_phone         TEXT,
    ss_student_address       TEXT,
    ss_student_postal_code   TEXT,
    ss_student_city          TEXT,
    ss_civil_liability_insurance_ref TEXT,
    ss_status                submission_status,
    ss_reviewer_comment      TEXT,
    ss_reviewed_at           TIMESTAMPTZ,
    ss_submitted_at          TIMESTAMPTZ,

    co_name                  TEXT,
    co_country               TEXT,
    co_sector                TEXT,
    co_size_bucket           TEXT,
    co_trade_name            TEXT,
    co_siret                 TEXT,
    co_insurance_company     TEXT,
    co_insurance_policy      TEXT,
    co_address               TEXT,
    co_city                  TEXT,
    co_postal_code           TEXT,
    co_website               TEXT,

    cct_full_name            TEXT,
    cct_email                TEXT,
    cct_role                 TEXT,
    cct_phone                TEXT,

    din_first_name           TEXT,
    din_last_name            TEXT,
    din_internship_type      TEXT,
    din_position             TEXT,
    din_start_date           DATE,
    din_end_date             DATE,
    din_tutor_name           TEXT,
    din_tutor_email          TEXT,
    din_tutor_phone          TEXT,

    UNIQUE (student_id)
);

CREATE INDEX idx_merged_company  ON merged_internship(company_id);
CREATE INDEX idx_merged_intake   ON merged_internship(season, year);

-- =====================================================================
-- 8. UTILISATEURS
-- =====================================================================

-- Équipe carrière (interface admin)
CREATE TABLE staff_user (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,                -- bcrypt/argon2
    role          staff_role NOT NULL DEFAULT 'reviewer',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Lien magique / token unique par formulaire
-- (auth choisie : pas de compte côté étudiant/entreprise)
CREATE TABLE access_token (
    token        TEXT PRIMARY KEY,             -- string opaque (uuid/nanoid)
    kind         token_kind NOT NULL,
    student_uuid UUID REFERENCES student(id)   ON DELETE CASCADE,
    company_id   UUID REFERENCES company(id)   ON DELETE CASCADE,
    label        TEXT,
    created_by   UUID REFERENCES staff_user(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ,
    used_at      TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,

    -- Cohérence : un token student doit pointer vers un étudiant, etc.
    CHECK (
        (kind = 'student' AND student_uuid IS NOT NULL AND company_id IS NULL)
     OR (kind = 'company' AND company_id  IS NOT NULL AND student_uuid IS NULL)
    )
);

CREATE INDEX idx_token_student ON access_token(student_uuid);
CREATE INDEX idx_token_company ON access_token(company_id);

-- =====================================================================
-- 9. TRIGGERS — updated_at + jointure automatique
-- =====================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'student','student_submission','company',
        'company_declaration','merged_internship'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END $$;

-- ---------- Jointure auto vers merged_internship ----------------------
-- Merge si même student_id : dernière soumission approuvée + dernière ligne declared_intern (peu importe la rentrée entreprise / étudiant).
CREATE OR REPLACE FUNCTION try_merge_internship(p_student_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
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

-- Trigger : approbation soumission étudiant
CREATE OR REPLACE FUNCTION trg_submission_after_review()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        PERFORM try_merge_internship(NEW.student_id);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_student_submission_merge
AFTER INSERT OR UPDATE OF status ON student_submission
FOR EACH ROW EXECUTE FUNCTION trg_submission_after_review();

-- Trigger : déclaration entreprise (insert/maj d'un stagiaire)
CREATE OR REPLACE FUNCTION trg_declared_intern_after_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM try_merge_internship(NEW.student_id);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_declared_intern_merge
AFTER INSERT OR UPDATE ON declared_intern
FOR EACH ROW EXECUTE FUNCTION trg_declared_intern_after_change();

-- Historiser les changements de statut de soumission
CREATE OR REPLACE FUNCTION trg_submission_status_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO submission_review_history(
            submission_id, from_status, to_status, comment, actor_id
        ) VALUES (NEW.id, OLD.status, NEW.status, NEW.reviewer_comment, NEW.reviewed_by);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_submission_status_history
AFTER UPDATE ON student_submission
FOR EACH ROW EXECUTE FUNCTION trg_submission_status_history();

-- =====================================================================
-- 10. VUES PRATIQUES POUR L'INTERFACE ADMIN
-- =====================================================================

CREATE OR REPLACE VIEW v_student_full AS
SELECT s.*,
       p.season, p.year, p.label AS intake_label,
       c.name AS campus_name,
       pr.name AS programme_name
  FROM student s
  JOIN promotion p ON p.id = s.promotion_id
  JOIN campus c    ON c.id = p.campus_id
  JOIN programme pr ON pr.id = p.programme_id;

-- État courant de chaque étudiant pour une promotion
CREATE OR REPLACE VIEW v_submission_dashboard AS
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
  FROM student s
  JOIN promotion p ON p.id = s.promotion_id
  LEFT JOIN LATERAL (
        SELECT * FROM student_submission ss
         WHERE ss.student_uuid = s.id
           AND ss.status NOT IN ('rejected'::careers.submission_status, 'superseded'::careers.submission_status)
         ORDER BY ss.submitted_at DESC LIMIT 1
  ) sub ON TRUE;

-- Vue admin : lignes appariées (détail complet dans merged_internship). Les cas partiels sont listés via l’API (requêtes séparées).
DROP VIEW IF EXISTS v_merged_overview CASCADE;

CREATE VIEW v_merged_overview AS
SELECT m.*, 'matched'::text AS match_status
  FROM merged_internship m;

-- =====================================================================
-- 11. SEED MINIMAL (à supprimer en prod)
-- =====================================================================
INSERT INTO campus(code, name, country) VALUES
  ('PARIS','École Ducasse - Paris Campus','France'),
  ('YSSI', 'École Ducasse - École Nationale Supérieure de Pâtisserie','France')
ON CONFLICT (code) DO NOTHING;

INSERT INTO programme(code, name, duration_months) VALUES
  ('BACH-CUL','Bachelor in Culinary Arts',36),
  ('BACH-PAS','Bachelor in French Pastry Arts',36),
  ('MBA-CUL', 'MBA in Culinary Arts Management',12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO promotion(campus_id, programme_id, season, year)
SELECT c.id, p.id, s.season, s.year
  FROM campus c
  CROSS JOIN programme p
  CROSS JOIN (VALUES ('FEB'::intake_season,2026),('SEP'::intake_season,2026)) AS s(season,year)
ON CONFLICT (campus_id, programme_id, season, year) DO NOTHING;

-- Connexions applicatives : tables dans le schéma careers
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO careers, public',
    current_database()
  );
END $$;

-- =====================================================================
-- FIN
-- =====================================================================
