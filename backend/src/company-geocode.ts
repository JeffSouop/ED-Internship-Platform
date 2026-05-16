import fs from "node:fs";
import path from "node:path";

import { PROJECT_ROOT } from "./convention-data.js";

const CACHE_PATH = path.join(PROJECT_ROOT, "data", "company-geocode-cache.json");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ED-Internship-Platform/1.0 (ecole-ducasse-internships)";

type GeocodeCache = Record<string, { lat: number; lng: number; query: string; at: string }>;

function readCache(): GeocodeCache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as GeocodeCache;
  } catch {
    return {};
  }
}

function writeCache(cache: GeocodeCache): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

export function buildCompanyAddressQuery(parts: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  name?: string | null;
}): string | null {
  const line = [parts.address, parts.postalCode, parts.city, parts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (line.length >= 8) return line;
  const fallback = [parts.name, parts.city, parts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return fallback.length >= 5 ? fallback : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const hit = data[0];
  if (!hit?.lat || !hit?.lon) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export async function geocodeCompany(
  companyId: string,
  query: string,
  options: { refresh?: boolean } = {},
): Promise<{ lat: number; lng: number } | null> {
  const cache = readCache();
  if (!options.refresh && cache[companyId]) {
    return { lat: cache[companyId].lat, lng: cache[companyId].lng };
  }

  await sleep(1100);
  const coords = await geocodeQuery(query);
  if (!coords) return null;

  cache[companyId] = {
    ...coords,
    query,
    at: new Date().toISOString(),
  };
  writeCache(cache);
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
