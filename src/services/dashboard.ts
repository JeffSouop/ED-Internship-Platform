import { apiJson } from "@/lib/api";

export type DashboardCampusMarker = {
  code: "ENSP" | "EDPC";
  label: string;
  shortLabel: string;
  address: string;
  lat: number;
  lng: number;
  color: string;
};

export type CompanyCampusGroup = "ensp" | "edpc" | "mixed" | "other";

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

export async function getDashboardCompanyMap(): Promise<DashboardCompanyMapResponse> {
  return apiJson<DashboardCompanyMapResponse>("/api/admin/dashboard/company-map");
}
