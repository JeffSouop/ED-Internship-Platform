import type pg from "pg";

import { getConventionForStudent, listConventionIndexEntries } from "./convention-index.js";

export type ConventionGenerationRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  campus: string | null;
  programme: string | null;
  generated: boolean;
  filename?: string;
  generatedAt?: string;
};

export type ConventionGenerationSummary = {
  total: number;
  generated: number;
  notGenerated: number;
};

export type ConventionGenerationResponse = {
  rows: ConventionGenerationRow[];
  summary: ConventionGenerationSummary;
};

function buildStudentName(firstName: string | null, lastName: string | null, studentId: string): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name || studentId;
}

function buildCompanyName(
  companyLegalName: string | null,
  coName: string | null,
  ssCompanyName: string | null,
): string {
  return (companyLegalName ?? coName ?? ssCompanyName ?? "").trim() || "—";
}

export async function listConventionGenerationStatus(
  pool: pg.Pool,
): Promise<ConventionGenerationResponse> {
  const { rows } = await pool.query<{
    student_id: string;
    st_first_name: string | null;
    st_last_name: string | null;
    st_campus_name: string | null;
    st_programme_name: string | null;
    ss_company_name: string | null;
    co_name: string | null;
    company_legal_name: string | null;
  }>(
    `SELECT
       m.student_id,
       m.st_first_name,
       m.st_last_name,
       m.st_campus_name,
       m.st_programme_name,
       m.ss_company_name,
       m.co_name,
       di.company_legal_name
     FROM careers.merged_internship m
     LEFT JOIN careers.declared_intern di ON di.id = m.declared_intern_id
     ORDER BY m.st_last_name NULLS LAST, m.st_first_name NULLS LAST, m.student_id`,
  );

  const seen = new Set<string>();
  const resultRows: ConventionGenerationRow[] = [];

  for (const row of rows) {
    const studentId = row.student_id.trim();
    if (!studentId || seen.has(studentId)) continue;
    seen.add(studentId);

    const convention = getConventionForStudent(studentId);
    resultRows.push({
      studentId,
      studentName: buildStudentName(row.st_first_name, row.st_last_name, studentId),
      companyName: buildCompanyName(
        row.company_legal_name,
        row.co_name,
        row.ss_company_name,
      ),
      campus: row.st_campus_name?.trim() || null,
      programme: row.st_programme_name?.trim() || null,
      generated: !!convention,
      filename: convention?.filename,
      generatedAt: convention?.generatedAt,
    });
  }

  for (const { studentId, entry } of listConventionIndexEntries()) {
    if (seen.has(studentId)) continue;
    seen.add(studentId);

    const meta = await loadOrphanMeta(pool, studentId);
    resultRows.push({
      studentId,
      studentName: meta.studentName,
      companyName: meta.companyName,
      campus: meta.campus,
      programme: meta.programme,
      generated: true,
      filename: entry.filename,
      generatedAt: entry.generatedAt,
    });
  }

  resultRows.sort((a, b) => {
    const byName = a.studentName.localeCompare(b.studentName, "fr");
    if (byName !== 0) return byName;
    return a.studentId.localeCompare(b.studentId, "fr");
  });

  const generated = resultRows.filter((r) => r.generated).length;

  return {
    rows: resultRows,
    summary: {
      total: resultRows.length,
      generated,
      notGenerated: resultRows.length - generated,
    },
  };
}

async function loadOrphanMeta(
  pool: pg.Pool,
  studentId: string,
): Promise<{
  studentName: string;
  companyName: string;
  campus: string | null;
  programme: string | null;
}> {
  const { rows } = await pool.query<{
    st_first_name: string | null;
    st_last_name: string | null;
    st_campus_name: string | null;
    st_programme_name: string | null;
    ss_company_name: string | null;
    co_name: string | null;
    company_legal_name: string | null;
  }>(
    `SELECT
       m.st_first_name,
       m.st_last_name,
       m.st_campus_name,
       m.st_programme_name,
       m.ss_company_name,
       m.co_name,
       di.company_legal_name
     FROM careers.merged_internship m
     LEFT JOIN careers.declared_intern di ON di.id = m.declared_intern_id
     WHERE m.student_id = $1
     LIMIT 1`,
    [studentId],
  );

  const row = rows[0];
  if (row) {
    return {
      studentName: buildStudentName(row.st_first_name, row.st_last_name, studentId),
      companyName: buildCompanyName(
        row.company_legal_name,
        row.co_name,
        row.ss_company_name,
      ),
      campus: row.st_campus_name?.trim() || null,
      programme: row.st_programme_name?.trim() || null,
    };
  }

  const { rows: stRows } = await pool.query<{
    first_name: string | null;
    last_name: string | null;
    campus_name: string | null;
    programme_name: string | null;
  }>(
    `SELECT st.first_name, st.last_name, c.name AS campus_name, pr.name AS programme_name
     FROM careers.student st
     JOIN careers.promotion p ON p.id = st.promotion_id
     JOIN careers.campus c ON c.id = p.campus_id
     JOIN careers.programme pr ON pr.id = p.programme_id
     WHERE st.student_id = $1
     LIMIT 1`,
    [studentId],
  );

  const st = stRows[0];
  return {
    studentName: st
      ? buildStudentName(st.first_name, st.last_name, studentId)
      : studentId,
    companyName: "—",
    campus: st?.campus_name?.trim() || null,
    programme: st?.programme_name?.trim() || null,
  };
}
