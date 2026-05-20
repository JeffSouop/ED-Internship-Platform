import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Pool } from "pg";

export type CompanyUser = {
  id: string;
  companyId: string;
  email: string;
  contactName: string;
};

export type CompanyJwtPayload = {
  sub: string;
  email: string;
  companyId: string;
  companyName: string;
  contactName: string;
};

const BCRYPT_ROUNDS = 10;

export async function hashCompanyPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyCompanyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findCompanyUserByEmail(
  pool: Pool,
  email: string,
): Promise<(CompanyUser & { passwordHash: string; companyName: string }) | undefined> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query<{
    id: string;
    company_id: string;
    email: string;
    contact_name: string;
    password_hash: string;
    company_name: string;
  }>(
    `SELECT cu.id, cu.company_id, cu.email, cu.contact_name, cu.password_hash,
            COALESCE(NULLIF(trim(c.trade_name), ''), c.name) AS company_name
       FROM careers.company_user cu
       JOIN careers.company c ON c.id = cu.company_id
      WHERE lower(cu.email) = $1 AND cu.is_active = TRUE`,
    [normalized],
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    companyId: row.company_id,
    email: row.email,
    contactName: row.contact_name?.trim() ?? "",
    passwordHash: row.password_hash,
    companyName: row.company_name,
  };
}

export async function touchCompanyUserLastLogin(pool: Pool, userId: string): Promise<void> {
  await pool.query(`UPDATE careers.company_user SET last_login_at = now() WHERE id = $1`, [userId]);
}

export function signCompanyJwt(user: CompanyUser & { companyName: string }, jwtSecret: string): string {
  const payload: CompanyJwtPayload = {
    sub: user.id,
    email: user.email,
    companyId: user.companyId,
    companyName: user.companyName,
    contactName: user.contactName,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "14d" });
}

export function verifyCompanyJwt(token: string, jwtSecret: string): CompanyJwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as CompanyJwtPayload;
    if (!decoded?.sub || !decoded.email || !decoded.companyId) return null;
    return {
      sub: decoded.sub,
      email: decoded.email,
      companyId: decoded.companyId,
      companyName: decoded.companyName ?? "",
      contactName: decoded.contactName ?? "",
    };
  } catch {
    return null;
  }
}

export function companyUserFromPayload(payload: CompanyJwtPayload): CompanyUser & { companyName: string } {
  return {
    id: payload.sub,
    companyId: payload.companyId,
    email: payload.email,
    contactName: payload.contactName,
    companyName: payload.companyName,
  };
}

export type CompanyHrContact = {
  companyId: string;
  email: string;
  contactName: string;
};

/** Contact RH prioritaire par entreprise (e-mail non vide). */
export async function listCompaniesWithHrEmail(pool: Pool): Promise<CompanyHrContact[]> {
  const { rows } = await pool.query<{
    company_id: string;
    email: string;
    full_name: string;
  }>(
    `SELECT DISTINCT ON (c.id)
            c.id::text AS company_id,
            lower(trim(cc.email)) AS email,
            COALESCE(NULLIF(trim(cc.full_name), ''), '') AS full_name
       FROM careers.company c
       JOIN careers.company_contact cc ON cc.company_id = c.id
      WHERE trim(cc.email) <> ''
        AND (
          cc.is_primary = TRUE
          OR cc.role ILIKE '%rh%'
          OR cc.role ILIKE '%ressources humaines%'
          OR cc.role ILIKE '%hr%'
        )
      ORDER BY c.id,
               cc.is_primary DESC,
               CASE
                 WHEN cc.role ILIKE '%rh%' OR cc.role ILIKE '%ressources humaines%' OR cc.role ILIKE '%hr%' THEN 0
                 ELSE 1
               END,
               cc.email`,
  );
  return rows.map((r) => ({
    companyId: r.company_id,
    email: r.email,
    contactName: r.full_name,
  }));
}

export async function provisionCompanyUsers(
  pool: Pool,
  password: string,
): Promise<{ created: number; updated: number; skipped: number; duplicateEmail: number }> {
  const contacts = await listCompaniesWithHrEmail(pool);
  const hash = await hashCompanyPassword(password);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let duplicateEmail = 0;

  for (const row of contacts) {
    if (!row.email || !row.email.includes("@")) {
      skipped += 1;
      continue;
    }

    const { rows: emailOwner } = await pool.query<{ company_id: string }>(
      `SELECT company_id::text FROM careers.company_user WHERE lower(email) = $1 LIMIT 1`,
      [row.email],
    );
    if (emailOwner[0] && emailOwner[0].company_id !== row.companyId) {
      duplicateEmail += 1;
      continue;
    }

    try {
      const ins = await pool.query<{ inserted: boolean }>(
        `INSERT INTO careers.company_user (company_id, email, contact_name, password_hash, is_active)
         VALUES ($1::uuid, $2, $3, $4, TRUE)
         ON CONFLICT (company_id) DO UPDATE SET
           email = EXCLUDED.email,
           contact_name = EXCLUDED.contact_name,
           password_hash = EXCLUDED.password_hash,
           is_active = TRUE
         RETURNING (xmax = 0) AS inserted`,
        [row.companyId, row.email, row.contactName, hash],
      );
      if (ins.rows[0]?.inserted) created += 1;
      else updated += 1;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        duplicateEmail += 1;
        continue;
      }
      throw e;
    }
  }

  return { created, updated, skipped, duplicateEmail };
}
