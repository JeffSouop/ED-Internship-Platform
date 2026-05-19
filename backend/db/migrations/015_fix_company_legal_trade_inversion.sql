-- OBSOLÈTE : supprimait les deux lignes d’une paire. Utiliser 016 (restauration) + 017 (v2).
-- Conservé pour historique des migrations déjà appliquées.

BEGIN;

CREATE TEMP TABLE company_inverted_dup ON COMMIT DROP AS
SELECT NULL::uuid AS keep_id, NULL::uuid AS remove_id
WHERE false;

-- Références métier
UPDATE careers.merged_internship m
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE m.company_id = d.remove_id;

UPDATE careers.access_token t
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE t.company_id = d.remove_id;

-- Déclarations : rattacher si pas de conflit (company_id, season, year)
UPDATE careers.company_declaration cd
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE cd.company_id = d.remove_id
   AND NOT EXISTS (
     SELECT 1
       FROM careers.company_declaration cd2
      WHERE cd2.company_id = d.keep_id
        AND cd2.season = cd.season
        AND cd2.year = cd.year
   );

DELETE FROM careers.company_declaration cd
 USING company_inverted_dup d
 WHERE cd.company_id = d.remove_id;

-- Contacts : fusionner les e-mails non déjà présents sur la fiche conservée
UPDATE careers.company_contact cc
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE cc.company_id = d.remove_id
   AND NOT EXISTS (
     SELECT 1
       FROM careers.company_contact cc2
      WHERE cc2.company_id = d.keep_id
        AND lower(cc2.email) = lower(cc.email)
   );

DELETE FROM careers.company_contact cc
 USING company_inverted_dup d
 WHERE cc.company_id = d.remove_id;

DELETE FROM careers.company c
 USING company_inverted_dup d
 WHERE c.id = d.remove_id;

COMMIT;
