-- Prénom / nom distincts pour les comptes équipe
SET search_path TO careers, public;

ALTER TABLE staff_user
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE staff_user
SET
  first_name = COALESCE(
    NULLIF(trim(first_name), ''),
    split_part(trim(full_name), ' ', 1)
  ),
  last_name = COALESCE(
    NULLIF(trim(last_name), ''),
    CASE
      WHEN position(' ' IN trim(full_name)) > 0 THEN
        trim(substring(trim(full_name) FROM position(' ' IN trim(full_name)) + 1))
      ELSE ''
    END
  )
WHERE first_name IS NULL
   OR last_name IS NULL
   OR trim(COALESCE(first_name, '')) = '';

ALTER TABLE staff_user
  ALTER COLUMN first_name SET DEFAULT '',
  ALTER COLUMN last_name SET DEFAULT '';

UPDATE staff_user
SET
  first_name = COALESCE(first_name, ''),
  last_name = COALESCE(last_name, ''),
  full_name = trim(concat_ws(' ', NULLIF(trim(first_name), ''), NULLIF(trim(last_name), '')))
WHERE trim(COALESCE(full_name, '')) = ''
   OR full_name IS NULL;
