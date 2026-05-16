import type pg from "pg";

import {
  buildGeocodeAttempts,
  campusCodesToGroup,
  CAMPUS_MAP_LOCATIONS,
  coordsFromDbRow,
  geocodeCompanyRemote,
  getCoordsFromCache,
  groupMarkerColor,
  persistCompanyGeocode,
  readGeocodeCache,
  writeGeocodeCache as flushGeocodeCache,
  type CompanyCampusGroup,
  type CompanyGeocodeParts,
  type GeocodeCache,
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

export type BuildDashboardCompanyMapOptions = {
  /** Si true, appelle Nominatim pour les entreprises sans coordonnées (lent, ~1 req/s). */
  geocodeMissing?: boolean;
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

function resolveCoords(
  row: {
    id: string;
    latitude: number | string | null;
    longitude: number | string | null;
  },
  parts: CompanyGeocodeParts,
  cache: GeocodeCache,
  geocodeMissing: boolean,
): Promise<{ lat: number; lng: number } | null> {
  const fromDb = coordsFromDbRow(row.latitude, row.longitude);
  if (fromDb) return Promise.resolve(fromDb);

  const fromCache = getCoordsFromCache(cache, row.id);
  if (fromCache) return Promise.resolve(fromCache);

  if (!geocodeMissing || buildGeocodeAttempts(parts).length === 0) return Promise.resolve(null);
  return geocodeCompanyRemote(row.id, parts, cache);
}

export async function buildDashboardCompanyMap(
  pool: pg.Pool,
  options: BuildDashboardCompanyMapOptions = {},
): Promise<DashboardCompanyMapResponse> {
  const geocodeMissing = options.geocodeMissing === true;
  const cache = readGeocodeCache();
  let cacheDirty = false;

  const { rows } = await pool.query<{
    id: string;
    name: string;
    country: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
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
      c.latitude,
      c.longitude,
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
    GROUP BY c.id, c.name, c.country, c.address, c.city, c.postal_code, c.latitude, c.longitude
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

    const parts: CompanyGeocodeParts = {
      address: row.address,
      postalCode: row.postal_code,
      city: row.city,
      country: row.country,
      name: row.name,
    };
    if (buildGeocodeAttempts(parts).length === 0) {
      notGeocoded += 1;
      continue;
    }

    const coords = await resolveCoords(row, parts, cache, geocodeMissing);
    if (!coords) {
      notGeocoded += 1;
      continue;
    }

    if (geocodeMissing && coordsFromDbRow(row.latitude, row.longitude) === null) {
      await persistCompanyGeocode(pool, row.id, coords.lat, coords.lng);
      cacheDirty = true;
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

  if (cacheDirty) flushGeocodeCache(cache);

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
