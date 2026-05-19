/**
 * Import entreprises (image Docker API, sans code source sur le serveur).
 * Fichier par défaut : COMPANY DATABASE.xlsx à la racine du dépôt
 *   (monté sur /workspace/COMPANY DATABASE.xlsx dans docker-compose.yml).
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

import { importCompaniesFromXlsx } from "./import-companies-xlsx.js";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const argPath = process.argv.slice(2).join(" ").trim();

const ROOT_XLSX = "/workspace/COMPANY DATABASE.xlsx";

const candidates = [
  argPath || undefined,
  process.env.COMPANIES_XLSX_PATH?.trim(),
  ROOT_XLSX,
  "/app/data/companies.xlsx",
  "/data/companies.xlsx",
  resolve(process.cwd(), "COMPANY DATABASE.xlsx"),
  resolve(process.cwd(), "../COMPANY DATABASE.xlsx"),
].filter((p): p is string => Boolean(p));

const xlsxPath = candidates.find((p) => existsSync(p));
if (!xlsxPath) {
  console.error(
    "Fichier Excel introuvable.\n" +
      "  • Placez COMPANY DATABASE.xlsx à la racine du projet, puis : docker compose up -d api\n" +
      "  • Import : npm run import:companies   (ou docker compose exec api node dist/import-companies-cli.js)",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  console.log(`Lecture : ${xlsxPath}`);
  const result = await importCompaniesFromXlsx(pool, xlsxPath);
  console.log(`Lignes Excel : ${result.rawRows} → ${result.uniqueRows} entreprises uniques (nom + pays)`);
  console.log("");
  console.log("Import terminé.");
  console.log(`  Nouvelles fiches : ${result.inserted}`);
  console.log(`  Fiches mises à jour : ${result.updated}`);
  console.log(`  Contacts RH / tuteur : ${result.contacts}`);
  console.log(`  Entreprises sans contact valide : ${result.skippedContacts}`);
  console.log(`  Total en base : ${result.totalInDb}`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
