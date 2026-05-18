import { readFileSync } from "node:fs";
import type pg from "pg";
import * as XLSX from "xlsx";

import {
  cleanText,
  inferCompanyCountry,
  normalizeCompanyKey,
  normalizeSiret,
} from "./company-country.js";

export type ImportCompaniesResult = {
  inserted: number;
  updated: number;
  contacts: number;
  skippedContacts: number;
  totalInDb: number;
  uniqueRows: number;
  rawRows: number;
};

type ParsedRow = {
  name: string;
  tradeName?: string;
  sector?: string;
  siret?: string;
  insuranceCompany?: string;
  insurancePolicy?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country: string;
  hrName?: string;
  hrRole?: string;
  hrEmail?: string;
  hrPhone?: string;
  tutorName?: string;
  tutorRole?: string;
  tutorEmail?: string;
  tutorPhone?: string;
};

function cell(row: unknown[], index: number): string | undefined {
  return cleanText(row[index]);
}

function parseWorkbook(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const parsed: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const name = cell(row, 0);
    if (!name) continue;

    const city = cell(row, 8);
    const postalCode = cell(row, 7);
    const country = inferCompanyCountry(city, postalCode);

    parsed.push({
      name,
      tradeName: cell(row, 1),
      sector: cell(row, 2),
      siret: normalizeSiret(cell(row, 3)),
      insuranceCompany: cell(row, 4),
      insurancePolicy: cell(row, 5),
      address: cell(row, 6),
      postalCode,
      city,
      country,
      hrName: cell(row, 9),
      hrRole: cell(row, 10),
      hrEmail: cell(row, 11)?.toLowerCase(),
      hrPhone: cell(row, 12),
      tutorName: cell(row, 13),
      tutorRole: cell(row, 14),
      tutorEmail: cell(row, 15)?.toLowerCase(),
      tutorPhone: cell(row, 16),
    });
  }

  return parsed;
}

function scoreRow(row: ParsedRow): number {
  let n = 0;
  for (const v of Object.values(row)) {
    if (typeof v === "string" && v.trim()) n++;
  }
  return n;
}

function dedupeRows(rows: ParsedRow[]): ParsedRow[] {
  const byKey = new Map<string, ParsedRow>();
  for (const row of rows) {
    const key = normalizeCompanyKey(row.name, row.country);
    const existing = byKey.get(key);
    if (!existing || scoreRow(row) > scoreRow(existing)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function isValidEmail(email: string | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Importe les entreprises depuis COMPANY DATABASE.xlsx (upsert company + contacts). */
export async function importCompaniesFromXlsx(
  pool: pg.Pool,
  xlsxPath: string,
): Promise<ImportCompaniesResult> {
  const buffer = readFileSync(xlsxPath);
  const allRows = parseWorkbook(buffer);
  const rows = dedupeRows(allRows);

  let inserted = 0;
  let updated = 0;
  let contacts = 0;
  let skippedContacts = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const existing = await client.query(
        `SELECT id FROM careers.company WHERE name = $1 AND country = $2`,
        [row.name, row.country],
      );
      const isNew = existing.rowCount === 0;

      const ins = await client.query<{ id: string }>(
        `INSERT INTO careers.company (
           name, country, sector, trade_name, siret, insurance_company, insurance_policy,
           address, city, postal_code
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (name, country) DO UPDATE SET
           sector = COALESCE(EXCLUDED.sector, careers.company.sector),
           trade_name = COALESCE(EXCLUDED.trade_name, careers.company.trade_name),
           siret = COALESCE(EXCLUDED.siret, careers.company.siret),
           insurance_company = COALESCE(EXCLUDED.insurance_company, careers.company.insurance_company),
           insurance_policy = COALESCE(EXCLUDED.insurance_policy, careers.company.insurance_policy),
           address = COALESCE(EXCLUDED.address, careers.company.address),
           city = COALESCE(EXCLUDED.city, careers.company.city),
           postal_code = COALESCE(EXCLUDED.postal_code, careers.company.postal_code),
           updated_at = now()
         RETURNING id`,
        [
          row.name,
          row.country,
          row.sector ?? null,
          row.tradeName ?? null,
          row.siret ?? null,
          row.insuranceCompany ?? null,
          row.insurancePolicy ?? null,
          row.address ?? null,
          row.city ?? null,
          row.postalCode ?? null,
        ],
      );

      const companyId = ins.rows[0].id;
      if (isNew) inserted++;
      else updated++;

      const contactCandidates: Array<{
        fullName: string;
        email: string;
        role?: string;
        phone?: string;
        isPrimary: boolean;
      }> = [];

      if (isValidEmail(row.hrEmail) && row.hrName) {
        contactCandidates.push({
          fullName: row.hrName,
          email: row.hrEmail!,
          role: row.hrRole,
          phone: row.hrPhone,
          isPrimary: true,
        });
      }

      if (
        isValidEmail(row.tutorEmail) &&
        row.tutorName &&
        row.tutorEmail !== row.hrEmail
      ) {
        contactCandidates.push({
          fullName: row.tutorName,
          email: row.tutorEmail!,
          role: row.tutorRole ?? "Tuteur de stage",
          phone: row.tutorPhone,
          isPrimary: false,
        });
      }

      for (const ct of contactCandidates) {
        await client.query(
          `INSERT INTO careers.company_contact (company_id, full_name, email, role, phone, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, email) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             role = COALESCE(EXCLUDED.role, careers.company_contact.role),
             phone = COALESCE(EXCLUDED.phone, careers.company_contact.phone),
             is_primary = EXCLUDED.is_primary OR careers.company_contact.is_primary`,
          [companyId, ct.fullName, ct.email, ct.role ?? "", ct.phone ?? null, ct.isPrimary],
        );
        contacts++;
      }

      if (contactCandidates.length === 0) skippedContacts++;
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const { rows: countRows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM careers.company`,
  );

  return {
    inserted,
    updated,
    contacts,
    skippedContacts,
    totalInDb: Number(countRows[0]?.n ?? 0),
    uniqueRows: rows.length,
    rawRows: allRows.length,
  };
}
