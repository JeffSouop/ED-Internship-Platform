/**
 * Import entreprises (image Docker API, sans code source sur le serveur).
 *   node dist/import-companies-cli.js /data/companies.xlsx
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

const candidates = [
  process.argv[2]?.trim(),
  process.env.COMPANIES_XLSX_PATH?.trim(),
  "/data/companies.xlsx",
  resolve(process.cwd(), "COMPANY DATABASE.xlsx"),
].filter((p): p is string => Boolean(p));

const xlsxPath = candidates.find((p) => existsSync(p));
if (!xlsxPath) {
  console.error("Fichier Excel introuvable. Montez-le sur /data/companies.xlsx");
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
