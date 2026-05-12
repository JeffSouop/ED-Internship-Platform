SET search_path TO careers, public;

-- La table avait un trigger set_updated_at() sans colonne updated_at (erreur au DELETE company → SET company_id NULL).
ALTER TABLE merged_internship
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE merged_internship SET updated_at = merged_at;
