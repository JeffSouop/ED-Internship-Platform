import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

import { provisionCompanyUsers } from "../src/company-auth.js";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const password = process.env.COMPANY_USER_DEFAULT_PASSWORD?.trim() || "ducasse2026";
const pool = new Pool({ connectionString: DATABASE_URL });

try {
  const result = await provisionCompanyUsers(pool, password);
  console.log("Comptes entreprise :", result);
  console.log("Mot de passe :", password);
} finally {
  await pool.end();
}
