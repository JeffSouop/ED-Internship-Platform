import type { Pool } from "pg";

import type { Company } from "./contracts.js";
import { mapCompanyRow } from "./mappers.js";

function optText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export async function loadCompanyWithContacts(pool: Pool, id: string): Promise<Company | undefined> {
  const { rows } = await pool.query(
    `SELECT id, name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
            address, city, postal_code, website
       FROM careers.company WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return undefined;
  const { rows: contacts } = await pool.query(
    `SELECT full_name AS name, email, COALESCE(role, '') AS role, phone
       FROM careers.company_contact
      WHERE company_id = $1
      ORDER BY is_primary DESC, email`,
    [id],
  );
  return mapCompanyRow(
    rows[0],
    contacts.map((c: { name: string; email: string; role: string; phone: string | null }) => ({
      name: c.name,
      email: c.email,
      role: c.role,
      phone: c.phone?.trim() ? c.phone : undefined,
    })),
  );
}

export async function replaceCompanyContacts(
  pool: Pool,
  companyId: string,
  contacts: Company["contacts"] | undefined,
): Promise<void> {
  if (contacts === undefined) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM careers.company_contact WHERE company_id = $1::uuid`, [companyId]);
    if (contacts.length === 0) {
      await client.query("COMMIT");
      return;
    }
    const seen = new Set<string>();
    let isFirst = true;
    for (const ct of contacts) {
      const email = ct.email?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const phone = ct.phone?.trim() ? ct.phone.trim() : null;
      await client.query(
        `INSERT INTO careers.company_contact (company_id, full_name, email, role, phone, is_primary)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
        [companyId, ct.name, email, ct.role ?? "", phone, isFirst],
      );
      isFirst = false;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateCompanyRecord(
  pool: Pool,
  companyId: string,
  body: Partial<Company> & { name?: string; country?: string },
): Promise<Company | undefined> {
  if (!body.name || !body.country) {
    throw new Error("NAME_COUNTRY_REQUIRED");
  }

  const { rows: exRows } = await pool.query(
    `SELECT sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
            address, city, postal_code, website
       FROM careers.company WHERE id = $1::uuid`,
    [companyId],
  );
  if (!exRows[0]) return undefined;

  const ex = exRows[0] as {
    sector: string | null;
    size_bucket: string | null;
    trade_name: string | null;
    siret: string | null;
    insurance_company: string | null;
    insurance_policy: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    website: string | null;
  };

  const sector = "sector" in body ? optText(body.sector) : ex.sector;
  const size_bucket = "size" in body ? optText(body.size) : ex.size_bucket;
  const trade_name = "tradeName" in body ? optText(body.tradeName) : ex.trade_name;
  const siret = "siret" in body ? optText(body.siret) : ex.siret;
  const insurance_company =
    "insuranceCompany" in body ? optText(body.insuranceCompany) : ex.insurance_company;
  const insurance_policy =
    "insurancePolicy" in body ? optText(body.insurancePolicy) : ex.insurance_policy;
  const address = "address" in body ? optText(body.address) : ex.address;
  const city = "city" in body ? optText(body.city) : ex.city;
  const postal_code = "postalCode" in body ? optText(body.postalCode) : ex.postal_code;
  const website = "website" in body ? optText(body.website) : ex.website;
  const addressChanged =
    address !== ex.address || city !== ex.city || postal_code !== ex.postal_code;

  await pool.query(
    `UPDATE careers.company SET name = $1, country = $2, sector = $3, size_bucket = $4,
         trade_name = $5, siret = $6, insurance_company = $7, insurance_policy = $8,
         address = $9, city = $10, postal_code = $11, website = $12,
         latitude = CASE WHEN $14 THEN NULL ELSE latitude END,
         longitude = CASE WHEN $14 THEN NULL ELSE longitude END,
         updated_at = now()
      WHERE id = $13::uuid`,
    [
      body.name,
      body.country,
      sector,
      size_bucket,
      trade_name,
      siret,
      insurance_company,
      insurance_policy,
      address,
      city,
      postal_code,
      website,
      companyId,
      addressChanged,
    ],
  );

  await replaceCompanyContacts(pool, companyId, body.contacts);
  return loadCompanyWithContacts(pool, companyId);
}
