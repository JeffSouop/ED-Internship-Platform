import { randomUUID } from "crypto";
import type pg from "pg";

/** Jeton magic link étudiant existant ou nouveau (pour lien dans les e-mails). */
export async function getOrCreateStudentAccessToken(
  pool: pg.Pool,
  studentId: string,
): Promise<string | null> {
  const { rows: students } = await pool.query<{ id: string }>(
    `SELECT id FROM careers.student WHERE student_id = $1`,
    [studentId.trim()],
  );
  if (!students[0]) return null;

  const studentUuid = students[0].id;
  const { rows: existing } = await pool.query<{ token: string }>(
    `SELECT token FROM careers.access_token
      WHERE kind = 'student' AND student_uuid = $1::uuid
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1`,
    [studentUuid],
  );
  if (existing[0]?.token) return existing[0].token;

  const token = randomUUID().replace(/-/g, "").slice(0, 32);
  await pool.query(
    `INSERT INTO careers.access_token (token, kind, student_uuid, company_id, label, created_at)
     VALUES ($1, 'student', $2::uuid, NULL, $3, now())`,
    [token, studentUuid, "Lien formulaire — notification décision"],
  );
  return token;
}
