-- Corrige les doublons inversés : ne supprime que la fiche où le nom légal est en trade_name.
-- (Évite la suppression des deux lignes d’une même paire.)

BEGIN;

CREATE OR REPLACE FUNCTION careers.is_legal_company_name(n TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(n, '') ~* '^(SARL |SAS |SNC |SASIH |SATAP|SEDH |SEH |SELECT SERVICE|SH MANAGEMENT|SMITHFIELD|SOGERA|SOCIETE |Sas |sarl )'
      OR COALESCE(n, '') ~* '( SARL|SAS|SNC)$';
$$;

CREATE TEMP TABLE company_inverted_dup ON COMMIT DROP AS
SELECT
  c_legal.id AS keep_id,
  c_trade.id AS remove_id
FROM careers.company c_legal
JOIN careers.company c_trade
  ON c_legal.country = c_trade.country
 AND c_legal.id <> c_trade.id
 AND c_legal.name = c_trade.trade_name
 AND COALESCE(c_legal.trade_name, '') = c_trade.name
WHERE c_legal.country = 'France'
  AND careers.is_legal_company_name(c_legal.name)
  AND NOT careers.is_legal_company_name(c_trade.name);

UPDATE careers.merged_internship m
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE m.company_id = d.remove_id;

UPDATE careers.access_token t
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE t.company_id = d.remove_id;

UPDATE careers.company_declaration cd
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE cd.company_id = d.remove_id
   AND NOT EXISTS (
     SELECT 1 FROM careers.company_declaration cd2
      WHERE cd2.company_id = d.keep_id
        AND cd2.season = cd.season AND cd2.year = cd.year
   );

DELETE FROM careers.company_declaration cd
 USING company_inverted_dup d
 WHERE cd.company_id = d.remove_id;

UPDATE careers.company_contact cc
   SET company_id = d.keep_id
  FROM company_inverted_dup d
 WHERE cc.company_id = d.remove_id
   AND NOT EXISTS (
     SELECT 1 FROM careers.company_contact cc2
      WHERE cc2.company_id = d.keep_id AND lower(cc2.email) = lower(cc.email)
   );

DELETE FROM careers.company_contact cc
 USING company_inverted_dup d
 WHERE cc.company_id = d.remove_id;

DELETE FROM careers.company c
 USING company_inverted_dup d
 WHERE c.id = d.remove_id;

COMMIT;
