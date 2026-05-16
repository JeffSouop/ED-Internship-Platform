import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { DashboardCompanyMapResponse } from "@/services/dashboard";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

const COLOR_ENSP = "#B8860B";
const COLOR_EDPC = "#1e3a5f";
const COLOR_MIXED = "#7c3aed";
const COLOR_OTHER = "#64748b";

const LEGEND_ITEMS = [
  { color: COLOR_ENSP, label: "Campus ENSP" },
  { color: COLOR_EDPC, label: "Campus EDPC" },
  { color: COLOR_ENSP, label: "Entreprise (ENSP)" },
  { color: COLOR_EDPC, label: "Entreprise (EDPC)" },
  { color: COLOR_MIXED, label: "Les deux campus" },
  { color: COLOR_OTHER, label: "Autre / non appariée" },
] as const;

const GROUP_LABELS: Record<DashboardCompanyMapResponse["companies"][0]["campusGroup"], string> = {
  ensp: "Liée au campus ENSP (Yssingeaux)",
  edpc: "Liée au campus EDPC (Meudon)",
  mixed: "Stages des deux campus",
  other: "Sans stage apparié campus",
};

type CompaniesMapProps = {
  data: DashboardCompanyMapResponse;
  className?: string;
};

export function CompaniesMap({ data, className }: CompaniesMapProps) {
  return (
    <div className={cn("relative h-full w-full min-h-0", className)}>
      <MapContainer
        center={[46.6, 2.2]}
        zoom={6}
        className="h-full w-full min-h-0 rounded-md"
        scrollWheelZoom
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {data.campuses.map((campus) => (
        <CircleMarker
          key={campus.code}
          center={[campus.lat, campus.lng]}
          radius={14}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: campus.color,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{campus.label}</p>
              <p className="mt-1 text-muted-foreground">{campus.address}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {data.companies.map((company) => (
        <CircleMarker
          key={company.id}
          center={[company.lat, company.lng]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            weight: 1.5,
            fillColor: company.color,
            fillOpacity: 0.92,
          }}
        >
          <Popup>
            <div className="min-w-[200px] text-sm">
              <p className="font-semibold">{company.name}</p>
              <p className="mt-1 text-muted-foreground">
                {[company.address, company.city, company.country].filter(Boolean).join(", ")}
              </p>
              <p className="mt-2 text-xs">{GROUP_LABELS[company.campusGroup]}</p>
              {company.internCount > 0 && (
                <p className="mt-1 text-xs">
                  {company.internCount} stage{company.internCount > 1 ? "s" : ""} apparié
                  {company.internCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      </MapContainer>

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-card/95 px-3 py-2.5 shadow-md backdrop-blur-sm"
        aria-label="Légende de la carte"
      >
        <ul className="space-y-1.5 text-xs text-foreground">
          {LEGEND_ITEMS.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
