/**
 * Crée ou met à jour les comptes entreprise (e-mail RH + mot de passe commun).
 * Usage : docker compose exec api node dist/seed-company-users-cli.js
 */
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

import { provisionCompanyUsers } from "./company-auth.js";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const password = process.env.COMPANY_USER_DEFAULT_PASSWORD?.trim() || "ducasse2026";

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  console.log("Provisionnement des comptes entreprise (e-mail RH)…");
  const result = await provisionCompanyUsers(pool, password);
  console.log(`  Créés : ${result.created}`);
  console.log(`  Mis à jour : ${result.updated}`);
  console.log(`  Ignorés (e-mail invalide) : ${result.skipped}`);
  console.log(
    `  Ignorés (e-mail RH déjà utilisé par une autre entreprise) : ${result.duplicateEmail}`,
  );
  console.log(`  Mot de passe initial : ${password}`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
