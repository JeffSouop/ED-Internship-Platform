import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Conteneur pour `/admin/companies` et l’enfant `/admin/companies/$id` — la liste vit dans `admin.companies.index.tsx`. */
export const Route = createFileRoute("/admin/companies")({
  component: CompaniesLayout,
});

function CompaniesLayout() {
  return <Outlet />;
}
