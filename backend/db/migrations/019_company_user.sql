-- Comptes entreprise (login e-mail RH + mot de passe)
CREATE TABLE IF NOT EXISTS careers.company_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES careers.company(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT company_user_email_unique UNIQUE (email),
  CONSTRAINT company_user_company_unique UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_user_company_id ON careers.company_user(company_id);
CREATE INDEX IF NOT EXISTS idx_company_user_email_lower ON careers.company_user(lower(email));
