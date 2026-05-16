import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type pg from "pg";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(MODULE_DIR, "..");
const CACHE_PATH = path.join(BACKEND_ROOT, "data", "company-geocode-cache.json");
/** Ancien emplacement (racine du dépôt) — reprise lors du script de préchauffage. */
const LEGACY_CACHE_PATH = path.resolve(BACKEND_ROOT, "..", "data", "company-geocode-cache.json");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ED-Internship-Platform/1.0 (ecole-ducasse-internships)";
const NOMINATIM_MIN_INTERVAL_MS = 1100;

export type GeocodeCache = Record<string, { lat: number; lng: number; query: string; at: string }>;

export type CompanyGeocodeParts = {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  name?: string | null;
};

type GeocodeAttempt =
  | { kind: "structured"; street: string; city: string; postalcode?: string; country: string }
  | { kind: "freeform"; q: string };

let lastNominatimAt = 0;

function readCacheFile(filePath: string): GeocodeCache {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as GeocodeCache;
  } catch {
    return {};
  }
}

/** Charge le cache fichier (backend/data + ancien data/ à la racine si présent). */
export function readGeocodeCache(): GeocodeCache {
  const primary = readCacheFile(CACHE_PATH);
  const legacy = readCacheFile(LEGACY_CACHE_PATH);
  return { ...legacy, ...primary };
}

export function writeGeocodeCache(cache: GeocodeCache): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

export function getCoordsFromCache(
  cache: GeocodeCache,
  companyId: string,
): { lat: number; lng: number } | null {
  const hit = cache[companyId];
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng };
}

function cleanText(v: string | null | undefined): string {
  return (v ?? "").trim().replace(/\*+/g, "").replace(/\s+/g, " ");
}

function cleanPostal(v: string | null | undefined): string {
  const s = cleanText(v).replace(/\s+/g, "");
  const m = s.match(/\b(\d{4,6})\b/);
  return m ? m[1] : s;
}

function cleanCity(v: string | null | undefined): string {
  let s = cleanText(v);
  s = s.replace(/\(BE\)/gi, "").replace(/\(BE [^)]+\)/gi, "").trim();
  s = s.replace(/\s+cedex\s*\d*/i, "").trim();
  return s;
}

const COUNTRY_ALIASES: Record<string, string> = {
  france: "France",
  fr: "France",
  denmark: "Denmark",
  danemark: "Denmark",
  dk: "Denmark",
  belgium: "Belgium",
  belgique: "Belgium",
  be: "Belgium",
  spain: "Spain",
  espagne: "Spain",
  es: "Spain",
  italy: "Italy",
  italie: "Italy",
  it: "Italy",
  germany: "Germany",
  allemagne: "Germany",
  de: "Germany",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  "royaume-uni": "United Kingdom",
  monaco: "Monaco",
  switzerland: "Switzerland",
  suisse: "Switzerland",
  china: "China",
  chine: "China",
  japan: "Japan",
  japon: "Japan",
  singapore: "Singapore",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  usa: "United States",
  "united states": "United States",
  "états-unis": "United States",
};

export function normalizeCountryForGeocode(country: string | null | undefined): string {
  const s = cleanText(country);
  if (!s) return "";
  const key = s.toLowerCase();
  return COUNTRY_ALIASES[key] ?? s;
}

/** Corrige pays incohérent (ex. pays = France, ville = Berlin). */
function inferCountryFromContext(
  country: string,
  city: string,
  postal: string,
  address: string,
): string {
  const blob = `${city} ${postal} ${address}`.toLowerCase();
  if (/\bberlin\b|\b10117\b|\bmunich\b|\bhamburg\b/.test(blob)) return "Germany";
  if (/\blicata\b|\b92027\b|\broma\b|\bmilano\b|\bcapri\b/.test(blob)) return "Italy";
  if (/\bbarcelona\b|\bmadrid\b|\batxondo\b|\b48291\b|\bakelarre\b/.test(blob)) return "Spain";
  if (/\bkøbenhavn\b|\bcopenhagen\b|\b1432\b/.test(blob)) return "Denmark";
  if (/\bbruxelles\b|\bwoluwe\b|\b1150\b/.test(blob)) return "Belgium";
  if (/\bmeerkerk\b|\b4231\s?cb\b|\bnederland\b|\bnetherlands\b/.test(blob)) return "Netherlands";
  if (/\bcartmel\b|\bla11\s?\d[a-z]{2}\b|\benclume\b/.test(blob)) return "United Kingdom";
  if (/\bpuerto vallarta\b|\bjalisco\b|\b48380\b/.test(blob)) return "Mexico";
  if (/\bhyderabad\b|\btelangana\b|\bjubilee hills\b|\b500033\b/.test(blob)) return "India";
  if (/\babidjan\b|\bcôte d'ivoire\b/.test(blob)) return "Ivory Coast";
  if (/\bhainan\b|\bshenzhen\b|\bchina\b/.test(blob)) return "China";
  if (/\bmonaco\b/.test(blob)) return "Monaco";
  if (/\bsingapore\b/.test(blob)) return "Singapore";
  if (/\btokyo\b|\bjapan\b/.test(blob)) return "Japan";
  if (/\bdubai\b|\buae\b/.test(blob)) return "United Arab Emirates";
  return country;
}

function stripEmbeddedPostal(address: string, postal: string): string {
  let s = address;
  if (postal) {
    s = s.replace(new RegExp(`\\b${postal}\\b`, "g"), " ");
  }
  s = s.replace(/\b\d{5}\b/g, " ");
  return cleanText(s);
}

/** Rue exploitable pour Nominatim (évite « Banque pop », libellés trop courts). */
function normalizeStreetLine(address: string, name: string): string | null {
  let s = stripEmbeddedPostal(address, "");
  s = s.replace(/^(casta\s+baggioni[^-]*-\s*)/i, "");
  s = s.replace(/^(restaurant\s+[^,]+?\s+hotel\s+\w+\s*)/i, "");
  if (s.length < 6) return null;
  if (/^banque\b/i.test(s)) return null;
  if (!/\d/.test(s) && s.length < 20) return null;
  return s;
}

function attemptKey(a: GeocodeAttempt): string {
  if (a.kind === "structured") {
    return `s:${a.street}|${a.city}|${a.postalcode ?? ""}|${a.country}`;
  }
  return `q:${a.q}`;
}

/** Variantes de requête, de la plus précise à la plus large. */
export function buildGeocodeAttempts(parts: CompanyGeocodeParts): GeocodeAttempt[] {
  const rawCountry = normalizeCountryForGeocode(parts.country);
  const city = cleanCity(parts.city);
  const postal = cleanPostal(parts.postalCode);
  const address = cleanText(parts.address);
  const country = inferCountryFromContext(
    rawCountry,
    city,
    postal,
    address,
  );
  const street = address ? normalizeStreetLine(address, cleanText(parts.name)) : null;

  const attempts: GeocodeAttempt[] = [];
  const push = (a: GeocodeAttempt) => {
    const key = attemptKey(a);
    if (attempts.some((x) => attemptKey(x) === key)) return;
    attempts.push(a);
  };

  if (street && city && country) {
    push({ kind: "structured", street, city, postalcode: postal || undefined, country });
    push({ kind: "freeform", q: postal ? `${street}, ${postal} ${city}, ${country}` : `${street}, ${city}, ${country}` });
  }

  if (address && city && country && address !== street) {
    push({
      kind: "freeform",
      q: postal ? `${address}, ${postal} ${city}, ${country}` : `${address}, ${city}, ${country}`,
    });
  }

  if (postal && city && country) {
    push({ kind: "freeform", q: `${postal} ${city}, ${country}` });
  }

  if (city && country) {
    push({ kind: "freeform", q: `${city}, ${country}` });
  }

  if (country === "Denmark" && /københavn/i.test(city)) {
    const cphStreet = street ?? address;
    if (cphStreet) {
      push({
        kind: "freeform",
        q: postal ? `${cphStreet}, ${postal} Copenhagen, Denmark` : `${cphStreet}, Copenhagen, Denmark`,
      });
    }
  }

  const name = cleanText(parts.name);
  if (name && city && country && attempts.length < 6) {
    push({ kind: "freeform", q: `${name}, ${city}, ${country}` });
  }

  return attempts;
}

export function buildCompanyAddressQuery(parts: CompanyGeocodeParts): string | null {
  const attempts = buildGeocodeAttempts(parts);
  if (attempts.length === 0) return null;
  const first = attempts[0];
  if (first.kind === "freeform") return first.q;
  const { street, city, postalcode, country } = first;
  return postalcode ? `${street}, ${postalcode} ${city}, ${country}` : `${street}, ${city}, ${country}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleNominatim(): Promise<void> {
  const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimAt);
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();
}

function parseNominatimResults(data: unknown): { lat: number; lng: number } | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0] as { lat?: string; lon?: string };
  if (!hit?.lat || !hit?.lon) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

async function nominatimFetch(url: URL, retries = 2): Promise<{ lat: number; lng: number } | null> {
  for (let i = 0; i <= retries; i++) {
    await throttleNominatim();
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 429 && i < retries) {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (!res.ok) return null;
    return parseNominatimResults(await res.json());
  }
  return null;
}

async function geocodeAttempt(attempt: GeocodeAttempt): Promise<{ lat: number; lng: number } | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  if (attempt.kind === "structured") {
    url.searchParams.set("street", attempt.street);
    url.searchParams.set("city", attempt.city);
    if (attempt.postalcode) url.searchParams.set("postalcode", attempt.postalcode);
    url.searchParams.set("country", attempt.country);
  } else {
    url.searchParams.set("q", attempt.q);
  }

  return nominatimFetch(url);
}

function attemptLabel(attempt: GeocodeAttempt): string {
  return attempt.kind === "structured"
    ? `structured:${attempt.street}, ${attempt.postalcode ?? ""} ${attempt.city}, ${attempt.country}`
    : attempt.q;
}

/** Géocodage avec repli (plusieurs formats) — pour script de préchauffage. */
export async function geocodeCompanyRemote(
  companyId: string,
  parts: CompanyGeocodeParts,
  cache: GeocodeCache,
): Promise<{ lat: number; lng: number; query: string } | null> {
  const cached = getCoordsFromCache(cache, companyId);
  if (cached) return { ...cached, query: cache[companyId].query };

  const attempts = buildGeocodeAttempts(parts);
  for (const attempt of attempts) {
    const coords = await geocodeAttempt(attempt);
    if (!coords) continue;
    const query = attemptLabel(attempt);
    cache[companyId] = { ...coords, query, at: new Date().toISOString() };
    return { ...coords, query };
  }
  return null;
}

export async function persistCompanyGeocode(
  pool: pg.Pool | pg.PoolClient,
  companyId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await pool.query(
    `UPDATE careers.company SET latitude = $1, longitude = $2, updated_at = now() WHERE id = $3::uuid`,
    [lat, lng, companyId],
  );
}

export async function clearCompanyGeocode(
  pool: pg.Pool | pg.PoolClient,
  companyId: string,
): Promise<void> {
  await pool.query(
    `UPDATE careers.company SET latitude = NULL, longitude = NULL, updated_at = now() WHERE id = $1::uuid`,
    [companyId],
  );
}

/** @deprecated Utiliser geocodeCompanyRemote(parts). */
export async function geocodeCompany(
  companyId: string,
  query: string,
  options: { refresh?: boolean } = {},
): Promise<{ lat: number; lng: number } | null> {
  const cache = readGeocodeCache();
  if (!options.refresh) {
    const cached = getCoordsFromCache(cache, companyId);
    if (cached) return cached;
  }
  const coords = await geocodeCompanyRemote(companyId, { address: query }, cache);
  if (coords) writeGeocodeCache(cache);
  return coords;
}

/** Campus fixes (adresses fournies par l’équipe). */
export const CAMPUS_MAP_LOCATIONS = {
  ENSP: {
    code: "ENSP" as const,
    label: "ENSP — École Nationale Supérieure de Pâtisserie",
    shortLabel: "ENSP",
    address: "125 allée de Montbarnier, 43200 Yssingeaux, France",
    lat: 45.1429,
    lng: 4.1236,
    color: "#B8860B",
  },
  EDPC: {
    code: "EDPC" as const,
    label: "EDPC — École Ducasse Paris Campus",
    shortLabel: "EDPC",
    address: "16 avenue du Maréchal Juin, 92360 Meudon, France",
    lat: 48.8134,
    lng: 2.2402,
    color: "#1e3a5f",
  },
} as const;

export type CompanyCampusGroup = "ensp" | "edpc" | "mixed" | "other";

export function campusCodesToGroup(codes: string[]): CompanyCampusGroup {
  const normalized = new Set(
    codes.map((c) => c.toUpperCase()).filter((c) => c === "YSSI" || c === "PARIS"),
  );
  const hasYssi = normalized.has("YSSI");
  const hasParis = normalized.has("PARIS");
  if (hasYssi && hasParis) return "mixed";
  if (hasYssi) return "ensp";
  if (hasParis) return "edpc";
  return "other";
}

export function groupMarkerColor(group: CompanyCampusGroup): string {
  switch (group) {
    case "ensp":
      return CAMPUS_MAP_LOCATIONS.ENSP.color;
    case "edpc":
      return CAMPUS_MAP_LOCATIONS.EDPC.color;
    case "mixed":
      return "#7c3aed";
    default:
      return "#64748b";
  }
}

export function coordsFromDbRow(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): { lat: number; lng: number } | null {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}
