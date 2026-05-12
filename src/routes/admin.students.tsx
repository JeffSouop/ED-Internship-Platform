import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { listStudents } from "@/services/students";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";

export const Route = createFileRoute("/admin/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const q = useQuery({ queryKey: ["students"], queryFn: listStudents });
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (st) =>
        st.firstName.toLowerCase().includes(s) ||
        st.lastName.toLowerCase().includes(s) ||
        st.id.toLowerCase().includes(s) ||
        st.email.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Étudiants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Liste consolidée des étudiants enregistrés sur la plateforme.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-64"
          />
          <Button variant="outline" onClick={() => exportCsv(rows)}>
            Exporter CSV
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Programme</th>
              <th className="px-4 py-3 text-left">Promotion</th>
              <th className="px-4 py-3 text-left">Campus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-3">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3">{s.programme}</td>
                <td className="px-4 py-3">{s.promotion}</td>
                <td className="px-4 py-3">{s.campus}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun étudiant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function exportCsv(rows: Student[]) {
  const header = ["id", "firstName", "lastName", "email", "phone", "campus", "programme", "promotion"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      header.map((h) => JSON.stringify((r as unknown as Record<string, unknown>)[h] ?? "")).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "etudiants.csv";
  a.click();
  URL.revokeObjectURL(url);
}
