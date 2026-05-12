import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Anciens liens `/student/:token` → formulaire unique avec préremplissage éventuel. */
export const Route = createFileRoute("/student/$token")({
  component: LegacyStudentRedirect,
});

function LegacyStudentRedirect() {
  const { token } = Route.useParams();
  return <Navigate to="/student/convention" search={{ t: token }} replace />;
}
