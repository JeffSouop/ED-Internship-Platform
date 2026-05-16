-- Coordonnées carte tableau de bord (évite le géocodage en ligne à chaque chargement).
ALTER TABLE careers.company
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_company_geocode
  ON careers.company (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
