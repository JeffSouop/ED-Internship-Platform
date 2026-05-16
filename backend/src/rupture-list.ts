import type pg from "pg";

import { listRuptureIndexEntries } from "./rupture-index.js";

export type RuptureListRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  generatedAt: string;
};

export async function listRuptures(pool: pg.Pool): Promise<RuptureListRow[]> {
  const entries = listRuptureIndexEntries();
  if (entries.length === 0) return [];

  const studentIds = entries.map((e) => e.studentId);
  const summaries = await loadStudentSummaries(pool, studentIds);

  const rows: RuptureListRow[] = entries.map(({ studentId, entry }) => {
    const meta = summaries.get(studentId);
    return {
      studentId,
      studentName: meta?.studentName ?? studentId,
      companyName: meta?.companyName ?? "—",
      generatedAt: entry.generatedAt,
    };
  });

  rows.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  return rows;
}

async function loadStudentSummaries(
  pool: pg.Pool,
  studentIds: string[],
): Promise<Map<string, { studentName: string; companyName: string }>> {
  const map = new Map<string, { studentName: string; companyName: string }>();
  if (studentIds.length === 0) return map;

  const { rows } = await pool.query<{
    student_id: string;
    st_first_name: string | null;
    st_last_name: string | null;
    ss_company_name: string | null;
    co_name: string | null;
    company_legal_name: string | null;
  }>(
    `SELECT
       m.student_id,
       m.st_first_name,
       m.st_last_name,
       m.ss_company_name,
       m.co_name,
       di.company_legal_name
     FROM careers.merged_internship m
     LEFT JOIN careers.declared_intern di ON di.id = m.declared_intern_id
     WHERE m.student_id = ANY($1::text[])`,
    [studentIds],
  );

  for (const row of rows) {
    const studentName =
      `${row.st_first_name ?? ""} ${row.st_last_name ?? ""}`.trim() || row.student_id;
    const companyName =
      (row.company_legal_name ?? row.co_name ?? row.ss_company_name ?? "").trim() || "—";
    map.set(row.student_id, { studentName, companyName });
  }

  for (const id of studentIds) {
    if (map.has(id)) continue;
    const { rows: stRows } = await pool.query<{
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT first_name, last_name FROM careers.student WHERE student_id = $1 LIMIT 1`,
      [id],
    );
    const st = stRows[0];
    map.set(id, {
      studentName: st
        ? `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim() || id
        : id,
      companyName: "—",
    });
  }

  return map;
}
