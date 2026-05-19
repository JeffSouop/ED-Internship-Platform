-- Restaure les fiches entreprises supprimées par erreur (015 supprimait les deux lignes d’une paire).
-- Données : export base avant correction (name = raison sociale, trade_name = enseigne).

BEGIN;

INSERT INTO careers.company (name, country, sector, trade_name)
VALUES
  ('SARL 3B bacav boulogne', 'France', 'Bistronomic restaurant', 'Bacav'),
  ('SARL AUTANA', 'France', 'Bistronomic restaurant', 'AUTANA'),
  ('SARL Albufera', 'France', 'Bistronomic restaurant', 'Albufera La Table de José Dantas'),
  ('SARL CFCG', 'France', 'Michelin-star restaurant', 'RESTAURANT PIERRE GAGNAIRE'),
  ('SARL Grain de Vanille', 'France', 'Pastry boutique - Boulangerie', 'Grain de Vanille'),
  ('SARL H REI', 'France', 'Gastronomic restaurant', 'NEIGE D''ETE'),
  ('SARL JAMMI', 'France', 'Bistronomic restaurant', 'Restaurant Bonnotte'),
  ('SARL L AUBERGE DU PARC', 'France', 'Michelin-star restaurant', 'LA MARE AUX OISEAUX'),
  ('SARL NIWA', 'France', 'Pastry boutique - Boulangerie', 'wani'),
  ('SARL Roberto', 'France', 'Gastronomic restaurant', 'Eme restaurant'),
  ('SARL h-Rei', 'France', 'Gastronomic restaurant', 'Restaurant Neige d''été'),
  ('SARL robertp', 'France', 'Gastronomic restaurant', 'eme restaurant'),
  ('SAS ACACIA', 'France', 'Bistronomic restaurant', 'DANDELION'),
  ('SAS ALEXIO', 'France', 'Gastronomic restaurant', 'L''Auberge du Bassin'),
  ('SAS BRAS', 'France', 'Gastronomic restaurant', 'MAISON BRAS'),
  ('SAS CLAIRE', 'France', 'Pastry boutique - Boulangerie', 'CLAIRE HEITZLER & PRODUCTEURS'),
  ('SAS HOTEL LA VILLA', 'France', 'HOTEL RESTAURANT', 'HOTEL LA VILLA*****'),
  ('SAS HOTEL POWERS', 'France', 'Hotel- Palace', 'HOTEL GRAND POWERS'),
  ('SAS Hôtel Le Bristol', 'France', 'Hotel- Palace', 'Le Bristol Paris'),
  ('SAS LA RÉSERVE DE BEAULIEU', 'France', 'Hotel- Palace', 'LA RÉSERVE DE BEAULIEU'),
  ('SAS LES MINIMES', 'France', 'Hotel- Palace', 'Le Couvent des Minimes, Un Hôtel & Spa L''Occitane en Provence'),
  ('SAS MC LAB 2', 'France', 'Pastry boutique - Boulangerie', 'Union boulangerie'),
  ('SAS NECTAR', 'France', 'Michelin-star restaurant', 'Mirazur'),
  ('SAS Notre Dame des Anges', 'France', 'Bistronomic & Michelin star restaurant', 'Bastide Bruno Oger'),
  ('SAS ORIGINES', 'France', 'Gastronomic restaurant', 'RESTAURANT ORIGINES JULIEN BOSCUS'),
  ('SAS PARBRAS', 'France', 'Gastronomic restaurant', 'LA HALLE AUX GRAINS'),
  ('SAS PDG REALTY', 'France', 'Hotel- Palace', 'Prince de Galles, a Luxury Collection Hotel'),
  ('SAS Pierre Sang Experiences', 'France', 'Bistronomic restaurant', 'Pierre Sang in Oberkampf'),
  ('SAS RICHEUX', 'France', 'Michelin-star restaurant', 'Les Maisons de Bricourt'),
  ('SAS ROZO', 'France', 'Gastronomic restaurant', 'Restaurant ROZÓ'),
  ('SASIH PARK HYATT PARIS-VENDÔME', 'France', 'Hotel- Palace', 'Park Hyatt Paris-Vendôme'),
  ('SATAP', 'France', 'Gastronomic restaurant', 'La table de Maïna'),
  ('SEDH VISTA - The Maybourne Riviera', 'France', 'Hotel- Palace', 'The Maybourne Riviera'),
  ('SEH Cheval Blanc Paris', 'France', 'Hotel- Palace', 'Cheval Blanc Paris'),
  ('SELECT SERVICE PARTNER', 'France', '6920Z', 'SSP PARIS'),
  ('SH MANAGEMENT SAS', 'France', 'Hotel- Palace', 'MANDARIN ORIENTAL PARIS'),
  ('SMITHFIELD', 'France', 'Gastronomic restaurant', 'De Vie'),
  ('SOCIETE D''EXPLOITATION DU PAVILLON DUFOUR', 'France', 'Bistronomic restaurant', 'ore - Ducasse au Château de Versailles'),
  ('SOCIETE FRANCAISE D''EXPLOITATION DE RESTAURANT - MUSIAM PARIS', 'France', 'Gastronomic restaurant', 'MUSEE DU QUAI BRANLY'),
  ('SOGERA', 'France', 'Bistronomic restaurant', 'OKTOBRE')
ON CONFLICT (name, country) DO UPDATE SET
  sector = EXCLUDED.sector,
  trade_name = EXCLUDED.trade_name,
  updated_at = now();

-- Doublon sans raison sociale distincte
DELETE FROM careers.company
 WHERE country = 'France'
   AND name = 'Arpège'
   AND trade_name = 'Arpège';

COMMIT;
