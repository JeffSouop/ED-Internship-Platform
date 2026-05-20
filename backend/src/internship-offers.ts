import type { Pool } from "pg";

export type InternshipOfferType = "stage" | "alternance" | "emploi" | "vie";

export type InternshipOfferCompanySummary = {
  id: string;
  name: string;
  tradeName?: string;
  city?: string;
  sector?: string;
  website?: string;
};

export type InternshipOffer = {
  id: string;
  companyId: string;
  title: string;
  description: string;
  offerType: InternshipOfferType;
  location?: string;
  contractLabel?: string;
  duration?: string;
  startDate?: string;
  contactEmail?: string;
  publishedAt: string;
  updatedAt: string;
  createdByEmail?: string;
};

export type InternshipOfferPublic = InternshipOffer & {
  company: InternshipOfferCompanySummary;
};

type OfferRow = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  offer_type: string;
  location: string | null;
  contract_label: string | null;
  duration: string | null;
  start_date: string | Date | null;
  contact_email: string | null;
  published_at: Date;
  updated_at: Date;
  created_by_email: string | null;
};

type PublicRow = OfferRow & {
  company_name: string;
  company_trade_name: string | null;
  company_city: string | null;
  company_sector: string | null;
  company_website: string | null;
};

function mapOffer(row: OfferRow): InternshipOffer {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    offerType: row.offer_type as InternshipOfferType,
    location: row.location?.trim() || undefined,
    contractLabel: row.contract_label?.trim() || undefined,
    duration: row.duration?.trim() || undefined,
    startDate: row.start_date
      ? typeof row.start_date === "string"
        ? row.start_date.slice(0, 10)
        : row.start_date.toISOString().slice(0, 10)
      : undefined,
    contactEmail: row.contact_email?.trim() || undefined,
    publishedAt: row.published_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    createdByEmail: row.created_by_email?.trim() || undefined,
  };
}

function mapPublic(row: PublicRow): InternshipOfferPublic {
  return {
    ...mapOffer(row),
    company: {
      id: row.company_id,
      name: row.company_name,
      tradeName: row.company_trade_name?.trim() || undefined,
      city: row.company_city?.trim() || undefined,
      sector: row.company_sector?.trim() || undefined,
      website: row.company_website?.trim() || undefined,
    },
  };
}

const OFFER_COLUMNS = `o.id, o.company_id, o.title, o.description, o.offer_type,
  o.location, o.contract_label, o.duration, o.start_date, o.contact_email,
  o.published_at, o.updated_at, o.created_by_email`;

const OFFER_RETURNING = `id, company_id, title, description, offer_type,
  location, contract_label, duration, start_date, contact_email,
  published_at, updated_at, created_by_email`;

const PUBLIC_JOIN = `
  FROM careers.internship_offer o
  JOIN careers.company c ON c.id = o.company_id`;

export async function listPublicInternshipOffers(pool: Pool): Promise<InternshipOfferPublic[]> {
  const { rows } = await pool.query<PublicRow>(
    `SELECT ${OFFER_COLUMNS},
            c.name AS company_name,
            c.trade_name AS company_trade_name,
            c.city AS company_city,
            c.sector AS company_sector,
            c.website AS company_website
       ${PUBLIC_JOIN}
      ORDER BY o.published_at DESC`,
  );
  return rows.map(mapPublic);
}

export async function listCompanyInternshipOffers(
  pool: Pool,
  companyId: string,
): Promise<InternshipOffer[]> {
  const { rows } = await pool.query<OfferRow>(
    `SELECT ${OFFER_COLUMNS}
       FROM careers.internship_offer o
      WHERE o.company_id = $1
      ORDER BY o.published_at DESC`,
    [companyId],
  );
  return rows.map(mapOffer);
}

export type CreateInternshipOfferInput = {
  title: string;
  description: string;
  offerType?: InternshipOfferType;
  location?: string;
  contractLabel?: string;
  duration?: string;
  startDate?: string;
  contactEmail?: string;
  createdByEmail?: string;
};

const VALID_OFFER_TYPES = new Set<InternshipOfferType>(["stage", "alternance", "emploi", "vie"]);

export function normalizeOfferType(raw: unknown): InternshipOfferType | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase() as InternshipOfferType;
  return VALID_OFFER_TYPES.has(t) ? t : undefined;
}

export async function createInternshipOffer(
  pool: Pool,
  companyId: string,
  input: CreateInternshipOfferInput,
): Promise<InternshipOffer> {
  const title = input.title.trim();
  const description = input.description.trim();
  const offerType = input.offerType ?? "stage";
  const { rows } = await pool.query<OfferRow>(
    `INSERT INTO careers.internship_offer (
       company_id, title, description, offer_type, location,
       contract_label, duration, start_date, contact_email, created_by_email
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10)
     RETURNING ${OFFER_RETURNING}`,
    [
      companyId,
      title,
      description,
      offerType,
      input.location?.trim() || null,
      input.contractLabel?.trim() || null,
      input.duration?.trim() || null,
      input.startDate?.trim() || null,
      input.contactEmail?.trim() || null,
      input.createdByEmail?.trim() || null,
    ],
  );
  return mapOffer(rows[0]!);
}

export async function deleteInternshipOffer(
  pool: Pool,
  companyId: string,
  offerId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM careers.internship_offer
      WHERE id = $1 AND company_id = $2`,
    [offerId, companyId],
  );
  return (rowCount ?? 0) > 0;
}
