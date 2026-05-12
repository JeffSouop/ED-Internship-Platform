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
    'rejected'             -- refusé
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

-- Une seule soumission active (non rejetée) par étudiant et promotion
CREATE UNIQUE INDEX uniq_active_sub_per_student
    ON student_submission(student_uuid, promotion_id)
    WHERE status <> 'rejected';

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

-- =====================================================================
-- 5. ENTREPRISES
-- =====================================================================
-- Pivot métier : (name + country). Recherche floue via pg_trgm.

CREATE TABLE company (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    country      TEXT NOT NULL,
    sector       TEXT,
    size_bucket  TEXT,                          -- '1-10', '11-50', ...
    address      TEXT,
    city         TEXT,
    postal_code  TEXT,
    website      TEXT,
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

-- Un stagiaire déclaré par l'entreprise (clé : student_id pivot)
CREATE TABLE declared_intern (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    declaration_id  UUID NOT NULL REFERENCES company_declaration(id) ON DELETE CASCADE,
    student_id      TEXT NOT NULL,             -- pivot
    position        TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    tutor_name      TEXT,
    tutor_email     TEXT,
    tutor_phone     TEXT,
    notes           TEXT,
    CHECK (end_date >= start_date),
    UNIQUE (declaration_id, student_id)
);

CREATE INDEX idx_declared_intern_student ON declared_intern(student_id);

CREATE TABLE partner_intake_submission_snapshot (
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

CREATE INDEX idx_partner_snapshot_declaration ON partner_intake_submission_snapshot(declaration_id);
CREATE INDEX idx_partner_snapshot_student ON partner_intake_submission_snapshot(student_id_normalized);
CREATE INDEX idx_partner_snapshot_company ON partner_intake_submission_snapshot(company_id);

-- =====================================================================
-- 7. JOINTURE AUTOMATIQUE (table matérialisée alimentée par trigger)
-- =====================================================================
-- Dès qu'une soumission étudiant passe à 'approved' ET qu'il existe une
-- declared_intern avec le même student_id, on insère/maj une ligne ici.
-- C'est la "deuxième base" évoquée : la vue consolidée.

CREATE TABLE merged_internship (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id               TEXT NOT NULL,
    student_uuid             UUID REFERENCES student(id)              ON DELETE SET NULL,
    submission_id            UUID REFERENCES student_submission(id)   ON DELETE SET NULL,
    company_id               UUID REFERENCES company(id)              ON DELETE SET NULL,
    declared_intern_id       UUID REFERENCES declared_intern(id)      ON DELETE SET NULL,

    season                   intake_season NOT NULL,
    year                     INT NOT NULL,

    -- Dénormalisation utile pour le reporting
    student_full_name        TEXT,
    student_email            TEXT,
    company_name             TEXT,
    company_country          TEXT,
    position                 TEXT,
    start_date               DATE,
    end_date                 DATE,
    tutor_name               TEXT,
    tutor_email              TEXT,

    merged_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    partner_snapshot_id      UUID REFERENCES partner_intake_submission_snapshot(id) ON DELETE SET NULL,
    convention_record        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (student_id, season, year)
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
-- Tente de fusionner pour un student_id + intake donné.
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

-- Trigger : approbation soumission étudiant
CREATE OR REPLACE FUNCTION trg_submission_after_review()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_season intake_season;
    v_year   INT;
BEGIN
    IF NEW.status = 'approved'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT season, year INTO v_season, v_year
          FROM promotion WHERE id = NEW.promotion_id;
        PERFORM try_merge_internship(NEW.student_id, v_season, v_year);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_student_submission_merge
AFTER INSERT OR UPDATE OF status ON student_submission
FOR EACH ROW EXECUTE FUNCTION trg_submission_after_review();

-- Trigger : déclaration entreprise (insert/maj d'un stagiaire)
CREATE OR REPLACE FUNCTION trg_declared_intern_after_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_season intake_season;
    v_year   INT;
BEGIN
    SELECT season, year INTO v_season, v_year
      FROM company_declaration WHERE id = NEW.declaration_id;
    PERFORM try_merge_internship(NEW.student_id, v_season, v_year);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_declared_intern_merge
AFTER INSERT OR UPDATE ON declared_intern
FOR EACH ROW EXECUTE FUNCTION trg_declared_intern_after_change();

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

CREATE TRIGGER trg_partner_snapshot_merge
AFTER INSERT ON partner_intake_submission_snapshot
FOR EACH ROW EXECUTE FUNCTION trg_partner_snapshot_merge();

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
         ORDER BY ss.submitted_at DESC LIMIT 1
  ) sub ON TRUE;

-- Vue 3 statuts (matched / student_only / company_only)
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
