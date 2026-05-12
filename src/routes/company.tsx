import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/company")({
  component: CompanySectionLayout,
});

/** Layout pour `/company` et `/company/:token` (formulaire index + variantes jeton). */
function CompanySectionLayout() {
  return <Outlet />;
}
