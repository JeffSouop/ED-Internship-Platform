SET search_path TO careers, public;

ALTER TABLE company ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS insurance_company TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS insurance_policy TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS postal_code TEXT;

ALTER TABLE company_declaration ADD COLUMN IF NOT EXISTS partner_form_extras JSONB;

ALTER TABLE declared_intern ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE declared_intern ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE declared_intern ADD COLUMN IF NOT EXISTS internship_type TEXT;
