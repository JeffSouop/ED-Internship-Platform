-- Inversion nom légal ↔ nom commercial pour les entreprises signalées (liste admin mai 2026).
-- Après correction : name = enseigne (ex. Bacav), trade_name = raison sociale (ex. SARL …).

BEGIN;

-- Doublon sans raison sociale distincte (bloque le swap SARL RPG - Arpège → Arpège)
DELETE FROM careers.company
 WHERE country = 'France'
   AND name = 'Arpège'
   AND COALESCE(trade_name, '') = 'Arpège';

CREATE TEMP TABLE company_swap_batch ON COMMIT DROP AS
SELECT id, name AS old_name, trade_name AS old_trade, country
  FROM careers.company
 WHERE country = 'France'
   AND name IN (
     'SARL 3B bacav boulogne', 'SARL AUTANA', 'SARL Albufera', 'SARL CFCG', 'SARL Grain de Vanille',
     'SARL H REI', 'SARL JAMMI', 'SARL L AUBERGE DU PARC', 'SARL NIWA', 'SARL RPG - Arpège',
     'SARL Roberto', 'SARL h-Rei', 'SARL robertp', 'SAS ACACIA', 'SAS ALEXIO', 'SAS BRAS', 'SAS CLAIRE',
     'SAS HOTEL LA VILLA', 'SAS HOTEL POWERS', 'SAS Hôtel Le Bristol', 'SAS LA RÉSERVE DE BEAULIEU',
     'SAS LES MINIMES', 'SAS MC LAB 2', 'SAS NECTAR', 'SAS Notre Dame des Anges', 'SAS ORIGINES',
     'SAS PARBRAS', 'SAS PDG REALTY', 'SAS Pierre Sang Experiences', 'SAS RICHEUX', 'SAS ROZO',
     'SASIH PARK HYATT PARIS-VENDÔME', 'SATAP', 'SEDH VISTA - The Maybourne Riviera', 'SEH Cheval Blanc Paris',
     'SELECT SERVICE PARTNER', 'SH MANAGEMENT SAS', 'SMITHFIELD', 'SNC ANNE', 'SNC BACHAUMONT FB',
     'SOCIETE D''EXPLOITATION DU PAVILLON DUFOUR',
     'SOCIETE FRANCAISE D''EXPLOITATION DE RESTAURANT - MUSIAM PARIS',
     'SOGERA', 'Sas avoise', 'Septime Pierres Chaudes', 'Serge 1 USA LLC', 'Shangri La Hotels Paris',
     'Société Boris Lumé', 'Société d''Exploitation du Café Camondo'
   )
   AND NULLIF(TRIM(trade_name), '') IS NOT NULL;

-- Éviter le conflit UNIQUE (name, country) pendant l’échange
UPDATE careers.company c
   SET name = 'ZZZ-SWAP-' || c.id::text
  FROM company_swap_batch b
 WHERE c.id = b.id;

UPDATE careers.company c
   SET name = b.old_trade,
       trade_name = b.old_name,
       updated_at = now()
  FROM company_swap_batch b
 WHERE c.id = b.id;

UPDATE careers.merged_internship m
   SET co_name = c.name,
       co_trade_name = c.trade_name
  FROM careers.company c
 WHERE m.company_id = c.id;

COMMIT;
