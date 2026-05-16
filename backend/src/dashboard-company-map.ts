import type pg from "pg";

import {
  buildCompanyAddressQuery,
  campusCodesToGroup,
  CAMPUS_MAP_LOCATIONS,
  geocodeCompany,
  groupMarkerColor,
  type CompanyCampusGroup,
} from "./company-geocode.js";

export type DashboardCampusMarker = {
  code: "ENSP" | "EDPC";
  label: string;
  shortLabel: string;
  address: string;
  lat: number;
  lng: number;
  color: string;
};

export type DashboardCompanyMapPoint = {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  campusGroup: CompanyCampusGroup;
  color: string;
  internCount: number;
};

export type DashboardCompanyMapResponse = {
  campuses: DashboardCampusMarker[];
  companies: DashboardCompanyMapPoint[];
  stats: {
    totalCompanies: number;
    onMap: number;
    notGeocoded: number;
    byGroup: Record<CompanyCampusGroup, number>;
  };
};

function inferCampusCodeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("yss") || n.includes("ensp") || n.includes("pâtisserie") || n.includes("patisserie")) {
    return "YSSI";
  }
  if (n.includes("paris") || n.includes("edpc") || n.includes("meudon")) {
    return "PARIS";
  }
  return null;
}

export async function buildDashboardCompanyMap(
  pool: pg.Pool,
): Promise<DashboardCompanyMapResponse> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    country: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    campus_codes: string[] | null;
    campus_names: string[] | null;
    intern_count: string;
  }>(`
    SELECT
      c.id,
      c.name,
      c.country,
      c.address,
      c.city,
      c.postal_code,
      COALESCE(
        array_agg(DISTINCT camp.code) FILTER (WHERE camp.code IS NOT NULL),
        '{}'
      ) AS campus_codes,
      COALESCE(
        array_agg(DISTINCT m.st_campus_name) FILTER (WHERE m.st_campus_name IS NOT NULL),
        '{}'
      ) AS campus_names,
      COUNT(m.student_id)::text AS intern_count
    FROM careers.company c
    LEFT JOIN careers.merged_internship m ON m.company_id = c.id
    LEFT JOIN careers.student s ON s.student_id = m.student_id
    LEFT JOIN careers.promotion p ON p.id = s.promotion_id
    LEFT JOIN careers.campus camp ON camp.id = p.campus_id
    GROUP BY c.id, c.name, c.country, c.address, c.city, c.postal_code
    ORDER BY c.name
  `);

  const campuses: DashboardCampusMarker[] = [
    CAMPUS_MAP_LOCATIONS.ENSP,
    CAMPUS_MAP_LOCATIONS.EDPC,
  ];

  const companies: DashboardCompanyMapPoint[] = [];
  let notGeocoded = 0;
  const byGroup: Record<CompanyCampusGroup, number> = {
    ensp: 0,
    edpc: 0,
    mixed: 0,
    other: 0,
  };

  for (const row of rows) {
    const codes = [...(row.campus_codes ?? [])];
    for (const label of row.campus_names ?? []) {
      const inferred = inferCampusCodeFromName(label);
      if (inferred) codes.push(inferred);
    }
    const campusGroup = campusCodesToGroup(codes);
    byGroup[campusGroup] += 1;

    const query = buildCompanyAddressQuery({
      address: row.address,
      postalCode: row.postal_code,
      city: row.city,
      country: row.country,
      name: row.name,
    });
    if (!query) {
      notGeocoded += 1;
      continue;
    }

    const coords = await geocodeCompany(row.id, query);
    if (!coords) {
      notGeocoded += 1;
      continue;
    }

    companies.push({
      id: row.id,
      name: row.name,
      country: row.country,
      city: row.city ?? "",
      address: row.address ?? "",
      lat: coords.lat,
      lng: coords.lng,
      campusGroup,
      color: groupMarkerColor(campusGroup),
      internCount: Number(row.intern_count) || 0,
    });
  }

  return {
    campuses,
    companies,
    stats: {
      totalCompanies: rows.length,
      onMap: companies.length,
      notGeocoded,
      byGroup,
    },
  };
}
