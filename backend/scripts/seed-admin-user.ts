/**
 * Crée ou met à jour le compte admin par défaut.
 * Usage : npx tsx scripts/seed-admin-user.ts
 */
import "dotenv/config";
import { Pool } from "pg";

import { upsertStaffUser } from "../src/staff-auth.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant (backend/.env)");
  process.exit(1);
}

const EMAIL = (process.env.ADMIN_SEED_EMAIL ?? "admin@ecoleducasse.com").trim().toLowerCase();
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "admin";
const FIRST_NAME = process.env.ADMIN_SEED_FIRST_NAME ?? "Admin";
const LAST_NAME = process.env.ADMIN_SEED_LAST_NAME ?? "École Ducasse";

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  const user = await upsertStaffUser(pool, {
    email: EMAIL,
    firstName: FIRST_NAME,
    lastName: LAST_NAME,
    password: PASSWORD,
    role: "admin",
  });
  console.log(`Compte admin prêt : ${user.email} (${user.fullName}, rôle ${user.role})`);
} finally {
  await pool.end();
}
