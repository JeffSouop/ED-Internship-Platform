-- Comptes équipe carrière (connexion admin par email + mot de passe)
SET search_path TO careers, public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE staff_role AS ENUM ('admin', 'reviewer', 'viewer');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_user (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          staff_role NOT NULL DEFAULT 'reviewer',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_user_email_active
  ON staff_user (lower(email))
  WHERE is_active = TRUE;
