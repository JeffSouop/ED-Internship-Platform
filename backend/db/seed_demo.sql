-- Données de démonstration — à charger après schema.sql (voir scripts/setup-database.sh)
SET search_path TO careers, public;

-- Entreprises (UUID fixes pour les liens magiques de démo)
INSERT INTO company (id, name, country, sector, size_bucket, address, city, postal_code, website) VALUES
  ('11111111-1111-4111-8111-111111111101'::uuid, 'Le Meurice', 'France', 'Hôtellerie de luxe', '250-500',
   '228 Rue de Rivoli, 75001 Paris', 'Paris', '75001', 'https://www.dorchestercollection.com/le-meurice'),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'Pierre Hermé Paris', 'France', 'Pâtisserie', '100-250',
   '72 Rue Bonaparte, 75006 Paris', 'Paris', '75006', 'https://www.pierreherme.com'),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'The Connaught', 'United Kingdom', 'Hôtellerie de luxe', '250-500',
   'Carlos Place, Mayfair, London W1K 2AL', 'London', NULL, 'https://www.the-connaught.co.uk'),
  ('11111111-1111-4111-8111-111111111104'::uuid, 'Nouvelle entreprise (démo)', 'France', NULL, NULL,
   NULL, NULL, NULL, NULL)
ON CONFLICT (name, country) DO NOTHING;

INSERT INTO company_contact (company_id, full_name, email, role, is_primary) VALUES
  ('11111111-1111-4111-8111-111111111101'::uuid, 'Marie Lambert', 'rh@lemeurice.fr', 'RH Stages', TRUE),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'Antoine Garnier', 'stages@pierreherme.com', 'Chef de production', TRUE),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'Olivia Brown', 'careers@the-connaught.co.uk', 'HR Manager', TRUE)
ON CONFLICT (company_id, email) DO NOTHING;

-- Étudiants (liaison promotion via campus / programme / saison)
INSERT INTO student (student_id, promotion_id, first_name, last_name, email, phone)
SELECT 'STU-2026-001', p.id, 'Camille', 'Dubois', 'camille.dubois@ecoleducasse.com', '+33 6 12 34 56 78'
FROM promotion p
JOIN campus c ON c.id = p.campus_id
JOIN programme pr ON pr.id = p.programme_id
WHERE c.code = 'PARIS' AND pr.code = 'BACH-CUL' AND p.season = 'FEB'::intake_season AND p.year = 2026
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student (student_id, promotion_id, first_name, last_name, email, phone)
SELECT 'STU-2026-002', p.id, 'Lucas', 'Martin', 'lucas.martin@ecoleducasse.com', NULL
FROM promotion p
JOIN campus c ON c.id = p.campus_id
JOIN programme pr ON pr.id = p.programme_id
WHERE c.code = 'YSSI' AND pr.code = 'BACH-PAS' AND p.season = 'FEB'::intake_season AND p.year = 2026
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student (student_id, promotion_id, first_name, last_name, email, phone)
SELECT 'STU-2026-003', p.id, 'Sofia', 'Rossi', 'sofia.rossi@ecoleducasse.com', NULL
FROM promotion p
JOIN campus c ON c.id = p.campus_id
JOIN programme pr ON pr.id = p.programme_id
WHERE c.code = 'PARIS' AND pr.code = 'MBA-CUL' AND p.season = 'SEP'::intake_season AND p.year = 2026
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student (student_id, promotion_id, first_name, last_name, email, phone)
SELECT 'STU-2026-004', p.id, 'James', 'Okafor', 'james.okafor@ecoleducasse.com', NULL
FROM promotion p
JOIN campus c ON c.id = p.campus_id
JOIN programme pr ON pr.id = p.programme_id
WHERE c.code = 'PARIS' AND pr.code = 'BACH-CUL' AND p.season = 'SEP'::intake_season AND p.year = 2026
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student (student_id, promotion_id, first_name, last_name, email, phone)
SELECT 'STU-2026-005', p.id, 'Emma', 'Lefevre', 'emma.lefevre@ecoleducasse.com', NULL
FROM promotion p
JOIN campus c ON c.id = p.campus_id
JOIN programme pr ON pr.id = p.programme_id
WHERE c.code = 'YSSI' AND pr.code = 'BACH-PAS' AND p.season = 'FEB'::intake_season AND p.year = 2026
ON CONFLICT (student_id) DO NOTHING;

-- Déclaration entreprise + stagiaire (avant les soumissions « approved » pour le merge trigger)
INSERT INTO company_declaration (id, company_id, season, year, submitted_by, submitted_at)
VALUES (
  '22222222-2222-4222-8222-222222222202'::uuid,
  '11111111-1111-4111-8111-111111111102'::uuid,
  'FEB'::intake_season,
  2026,
  'stages@pierreherme.com',
  '2026-01-09T10:00:00Z'::timestamptz
)
ON CONFLICT (company_id, season, year) DO NOTHING;

INSERT INTO declared_intern (
  declaration_id, student_id, position, start_date, end_date,
  tutor_name, tutor_email, tutor_phone
)
VALUES (
  '22222222-2222-4222-8222-222222222202'::uuid,
  'STU-2026-002',
  'Apprenti pâtissier',
  '2026-02-01',
  '2026-07-31',
  'Antoine Garnier',
  'stages@pierreherme.com',
  NULL
)
ON CONFLICT (declaration_id, student_id) DO NOTHING;

-- Soumissions étudiant
INSERT INTO student_submission (
  student_uuid, student_id, promotion_id,
  company_name, company_country, company_city,
  position, missions, start_date, end_date,
  weekly_hours, gross_salary, currency,
  tutor_name, tutor_email,
  status, reviewer_comment, reviewed_by, reviewed_at,
  submitted_at
)
SELECT s.id, s.student_id, s.promotion_id,
  'Le Meurice', 'France', 'Paris',
  'Commis de cuisine',
  'Participation au service du restaurant gastronomique, mise en place, dressage des assiettes.',
  '2026-02-15', '2026-08-15',
  NULL, NULL, 'EUR',
  'Chef Alain Roux', 'a.roux@lemeurice.fr',
  'pending'::submission_status, NULL, NULL, NULL,
  '2026-01-10T09:30:00Z'::timestamptz
FROM student s
WHERE s.student_id = 'STU-2026-001'
  AND NOT EXISTS (
    SELECT 1 FROM student_submission ss
    WHERE ss.student_uuid = s.id AND ss.promotion_id = s.promotion_id AND ss.status <> 'rejected'
  );

INSERT INTO student_submission (
  student_uuid, student_id, promotion_id,
  company_name, company_country, company_city,
  position, missions, start_date, end_date,
  tutor_name, tutor_email,
  status, reviewed_at,
  submitted_at
)
SELECT s.id, s.student_id, s.promotion_id,
  'Pierre Hermé Paris', 'France', 'Paris',
  'Apprenti pâtissier',
  'Production des macarons, tartes saisonnières, gestion des matières premières.',
  '2026-02-01', '2026-07-31',
  'Antoine Garnier', 'stages@pierreherme.com',
  'approved'::submission_status,
  '2026-01-12T14:20:00Z'::timestamptz,
  '2026-01-08T16:45:00Z'::timestamptz
FROM student s
WHERE s.student_id = 'STU-2026-002'
  AND NOT EXISTS (
    SELECT 1 FROM student_submission ss
    WHERE ss.student_uuid = s.id AND ss.promotion_id = s.promotion_id AND ss.status <> 'rejected'
  );

-- Magic links (kind cohérent avec CHECK access_token)
INSERT INTO access_token (token, kind, student_uuid, company_id, label, created_at)
SELECT 'demo-student-camille', 'student'::token_kind, s.id, NULL, 'Camille Dubois (démo)', now()
FROM student s WHERE s.student_id = 'STU-2026-001'
ON CONFLICT (token) DO NOTHING;

INSERT INTO access_token (token, kind, student_uuid, company_id, label, created_at)
SELECT 'demo-student-james', 'student'::token_kind, s.id, NULL, 'James Okafor (démo)', now()
FROM student s WHERE s.student_id = 'STU-2026-004'
ON CONFLICT (token) DO NOTHING;

INSERT INTO access_token (token, kind, student_uuid, company_id, label, created_at)
SELECT 'demo-company-meurice', 'company'::token_kind, NULL, '11111111-1111-4111-8111-111111111101'::uuid, 'Le Meurice (démo)', now()
ON CONFLICT (token) DO NOTHING;

INSERT INTO access_token (token, kind, student_uuid, company_id, label, created_at)
SELECT 'demo-company-new', 'company'::token_kind, NULL, '11111111-1111-4111-8111-111111111104'::uuid, 'Nouvelle entreprise (démo)', now()
ON CONFLICT (token) DO NOTHING;
