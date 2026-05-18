/**
 * Géocode les entreprises (carte admin).
 *   node dist/geocode-companies-cli.js
 *   node dist/geocode-companies-cli.js --all
 */
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

import {
  buildGeocodeAttempts,
  coordsFromDbRow,
  geocodeCompanyRemote,
  getCoordsFromCache,
  persistCompanyGeocode,
  readGeocodeCache,
  writeGeocodeCache,
  type CompanyGeocodeParts,
} from "./company-geocode.js";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const onlyMissing = !process.argv.includes("--all");

try {
  const cache = readGeocodeCache();

  const { rows } = await pool.query<{
    id: string;
    name: string;
    country: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
  }>(
    `
    SELECT id, name, country, address, city, postal_code, latitude, longitude
    FROM careers.company
    ${onlyMissing ? "WHERE latitude IS NULL OR longitude IS NULL" : ""}
    ORDER BY name
  `,
  );

  let syncedFromCache = 0;
  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (coordsFromDbRow(row.latitude, row.longitude)) {
      skipped += 1;
      continue;
    }

    const parts: CompanyGeocodeParts = {
      address: row.address,
      postalCode: row.postal_code,
      city: row.city,
      country: row.country,
      name: row.name,
    };
    if (buildGeocodeAttempts(parts).length === 0) {
      skipped += 1;
      continue;
    }

    const cached = getCoordsFromCache(cache, row.id);
    if (cached) {
      await persistCompanyGeocode(pool, row.id, cached.lat, cached.lng);
      syncedFromCache += 1;
      continue;
    }

    const coords = await geocodeCompanyRemote(row.id, parts, cache);
    if (!coords) {
      failed += 1;
      console.warn(`  ✗ ${row.name} — géocodage impossible`);
      continue;
    }

    await persistCompanyGeocode(pool, row.id, coords.lat, coords.lng);
    geocoded += 1;
    console.log(`  ✓ ${row.name}`);
  }

  writeGeocodeCache(cache);

  console.log(
    `\nTerminé : ${geocoded} géocodées, ${syncedFromCache} reprises du cache fichier, ${skipped} déjà OK / sans adresse, ${failed} échecs.`,
  );
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await pool.end();
}
