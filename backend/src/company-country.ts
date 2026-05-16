/** Infère le pays à partir de la ville et du code postal (fichier historique sans colonne pays). */

const CITY_COUNTRY: Array<{ match: string; country: string }> = [
  { match: "hong kong", country: "Hong Kong" },
  { match: "dubai", country: "United Arab Emirates" },
  { match: "abu dhabi", country: "United Arab Emirates" },
  { match: "singapore", country: "Singapore" },
  { match: "tokyo", country: "Japan" },
  { match: "vancouver", country: "Canada" },
  { match: "guilin", country: "China" },
  { match: "copenhagen", country: "Denmark" },
  { match: "københavn", country: "Denmark" },
  { match: "gentofte", country: "Denmark" },
  { match: "vienna", country: "Austria" },
  { match: "wien", country: "Austria" },
  { match: "bruxelles", country: "Belgium" },
  { match: "brussel", country: "Belgium" },
  { match: "brussels", country: "Belgium" },
  { match: "jette", country: "Belgium" },
  { match: "roma", country: "Italy" },
  { match: "milano", country: "Italy" },
  { match: "barcelona", country: "Spain" },
  { match: "madrid", country: "Spain" },
  { match: "london", country: "United Kingdom" },
  { match: "sydney", country: "Australia" },
  { match: "melbourne", country: "Australia" },
  { match: "cremorne", country: "Australia" },
  { match: "new york", country: "United States" },
  { match: "miami", country: "United States" },
  { match: "zurich", country: "Switzerland" },
  { match: "genève", country: "Switzerland" },
  { match: "geneva", country: "Switzerland" },
  { match: "monaco", country: "Monaco" },
  { match: "luxembourg", country: "Luxembourg" },
];

function cleanPostalCode(raw: string | undefined): string {
  if (!raw) return "";
  const s = String(raw).replace(/\u00a0/g, " ").trim();
  if (/^(n\/?a|—|-|\.|\*)$/i.test(s) || /no postal/i.test(s)) return "";
  const digits = s.replace(/\s/g, "");
  if (/^\d{5}$/.test(digits)) return digits;
  return s;
}

function isFrenchPostalCode(pc: string): boolean {
  const digits = pc.replace(/\s/g, "");
  if (!/^\d{5}$/.test(digits)) return false;
  const dept = digits.slice(0, 2);
  if (dept === "97" || dept === "98") return true;
  const n = Number.parseInt(dept, 10);
  return n >= 1 && n <= 95;
}

export function inferCompanyCountry(cityRaw: string | undefined, postalRaw: string | undefined): string {
  const city = String(cityRaw ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase();
  const postal = cleanPostalCode(postalRaw);

  if (postal && isFrenchPostalCode(postal)) return "France";

  for (const { match, country } of CITY_COUNTRY) {
    if (city.includes(match)) return country;
  }

  if (
    city &&
    (city.includes("paris") ||
      city.includes("nice") ||
      city.includes("lyon") ||
      city.includes("marseille") ||
      city.includes("bordeaux") ||
      city.includes("lille") ||
      city.includes("toulouse") ||
      city.includes("cannes") ||
      city.includes("eze") ||
      city.includes("versailles") ||
      city.includes("boulogne") ||
      city.includes("clichy") ||
      city.includes("montrouge") ||
      city.includes("jouy"))
  ) {
    return "France";
  }

  return "France";
}

export function normalizeSiret(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).replace(/\u00a0/g, " ").replace(/\s/g, "").trim();
  if (!s || /^(n\/?a|—|-)$/i.test(s)) return undefined;
  return s;
}

export function cleanText(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return s || undefined;
}

export function normalizeCompanyKey(name: string, country: string): string {
  return `${name.trim().toUpperCase()}|${country.trim().toUpperCase()}`;
}
