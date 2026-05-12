/**
 * API Express « backend unique » : seul point d’accès aux données Postgres pour le web.
 * Le navigateur utilise uniquement les routes HTTP /api (via l’UI / proxy), pas DATABASE_URL.
 */
import { config as loadEnv } from "dotenv";
loadEnv();
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import { randomUUID } from "crypto";

import type {
  Company,
  CompanyDeclaration,
  DeclaredIntern,
  Intake,
  LinkToken,
  MergedInternship,
  Student,
  StudentSubmission,
} from "./contracts.js";
import {
  campusLabelToCode,
  dbSeasonYearToIntake,
  intakeToSeasonYear,
  mapCompanyRow,
  mapDeclaredInternRow,
  mapStudentRow,
  mapSubmissionRow,
  programmeLabelToCode,
} from "./mappers.js";
import { mergeContractMissions } from "./contract-form-meta.js";

const { Pool } = pg;

const PORT = Number(process.env.PORT) || 4000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ducasse2026";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "dev-secret-change-me";
/** Origines autorisées pour CORS (navigateur → API sur un autre port). Séparez par des virgules. */
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGIN ??
  "http://localhost:5173,http://localhost:8080,http://127.0.0.1:8080"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const COOKIE_NAME = "admin_session";

if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant — copiez backend/.env.example vers backend/.env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

/** Pas de page HTML ici : le navigateur doit ouvrir le front (Vite ou conteneur ui). */
app.get("/", (_req, res) => {
  res.type("text/plain; charset=utf-8").send(
    [
      "API Plateforme Stages — routes sous /api/…",
      "",
      "Pour l’interface : à la racine du projet, « npm run dev » puis l’URL affichée par Vite.",
      "Avec Docker : http://localhost:8080",
    ].join("\n"),
  );
});

function signAdminJwt(): string {
  return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    jwt.verify(raw, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session invalide" });
  }
}

async function loadStudent(studentId: string): Promise<Student | undefined> {
  const { rows } = await pool.query(
    `SELECT s.student_id, s.first_name, s.last_name, s.email, s.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student s
       JOIN careers.promotion p ON p.id = s.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
      WHERE s.student_id = $1`,
    [studentId],
  );
  if (!rows[0]) return undefined;
  return mapStudentRow(rows[0]);
}

async function loadSubmission(id: string): Promise<StudentSubmission | undefined> {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.student_id, ss.company_name, ss.company_country, ss.company_city,
            ss.position, ss.missions, ss.start_date, ss.end_date,
            ss.tutor_name, ss.tutor_email, ss.status::text AS status,
            ss.reviewer_comment, ss.submitted_at, ss.reviewed_at,
            st.first_name, st.last_name, st.email, st.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student_submission ss
       JOIN careers.student st ON st.id = ss.student_uuid
       JOIN careers.promotion p ON p.id = ss.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
      WHERE ss.id = $1`,
    [id],
  );
  if (!rows[0]) return undefined;
  return mapSubmissionRow(rows[0]);
}

async function loadSubmissionByStudentId(studentId: string): Promise<StudentSubmission | undefined> {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.student_id, ss.company_name, ss.company_country, ss.company_city,
            ss.position, ss.missions, ss.start_date, ss.end_date,
            ss.tutor_name, ss.tutor_email, ss.status::text AS status,
            ss.reviewer_comment, ss.submitted_at, ss.reviewed_at,
            st.first_name, st.last_name, st.email, st.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student_submission ss
       JOIN careers.student st ON st.id = ss.student_uuid
       JOIN careers.promotion p ON p.id = ss.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
      WHERE ss.student_id = $1 AND ss.status <> 'rejected'
      ORDER BY ss.submitted_at DESC
      LIMIT 1`,
    [studentId],
  );
  if (!rows[0]) return undefined;
  return mapSubmissionRow(rows[0]);
}

async function loadCompany(id: string) {
  const { rows } = await pool.query(
    `SELECT id, name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
            address, city, postal_code, website
       FROM careers.company WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return undefined;
  const { rows: contacts } = await pool.query(
    `SELECT full_name AS name, email, COALESCE(role, '') AS role, phone FROM careers.company_contact
      WHERE company_id = $1 ORDER BY is_primary DESC, email`,
    [id],
  );
  return mapCompanyRow(
    rows[0],
    contacts.map((c: { name: string; email: string; role: string; phone: string | null }) => ({
      name: c.name,
      email: c.email,
      role: c.role,
      phone: c.phone?.trim() ? c.phone : undefined,
    })),
  );
}

// ——— Auth ———
app.post("/api/auth/login", (req, res) => {
  const pwd = (req.body as { password?: string })?.password;
  if (pwd !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Mot de passe incorrect" });
    return;
  }
  const token = signAdminJwt();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ ok: true });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) {
    res.status(401).json({ ok: false });
    return;
  }
  try {
    jwt.verify(raw, JWT_SECRET);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ ok: false });
  }
});

// ——— Tokens ———
app.get("/api/tokens/:token", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.token, t.kind::text AS kind, t.label, t.created_at,
            s.student_id AS ref_student, t.company_id::text AS ref_company
       FROM careers.access_token t
       LEFT JOIN careers.student s ON s.id = t.student_uuid
      WHERE t.token = $1 AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now())`,
    [req.params.token],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Lien inconnu ou expiré" });
    return;
  }
  const r = rows[0] as {
    token: string;
    kind: string;
    label: string;
    created_at: Date;
    ref_student: string | null;
    ref_company: string | null;
  };
  const out: LinkToken = {
    token: r.token,
    kind: r.kind as "student" | "company",
    refId: r.kind === "student" ? (r.ref_student ?? undefined) : (r.ref_company ?? undefined),
    label: r.label,
    createdAt: r.created_at.toISOString(),
  };
  res.json(out);
});

app.get("/api/tokens", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.token, t.kind::text AS kind, t.label, t.created_at,
            s.student_id AS ref_student, t.company_id::text AS ref_company
       FROM careers.access_token t
       LEFT JOIN careers.student s ON s.id = t.student_uuid
      WHERE t.revoked_at IS NULL
      ORDER BY t.created_at DESC`,
  );
  const list: LinkToken[] = rows.map(
    (r: {
      token: string;
      kind: string;
      label: string;
      created_at: Date;
      ref_student: string | null;
      ref_company: string | null;
    }) => ({
      token: r.token,
      kind: r.kind as "student" | "company",
      refId: r.kind === "student" ? (r.ref_student ?? undefined) : (r.ref_company ?? undefined),
      label: r.label,
      createdAt: r.created_at.toISOString(),
    }),
  );
  res.json(list);
});

app.post("/api/tokens", requireAdmin, async (req, res) => {
  const body = req.body as { kind?: string; refId?: string; label?: string };
  if (!body.kind || !body.label) {
    res.status(400).json({ error: "kind et label requis" });
    return;
  }
  const token = randomUUID().replace(/-/g, "").slice(0, 32);
  let refOut: string | undefined = body.refId;
  if (body.kind === "student") {
    if (!body.refId) {
      res.status(400).json({ error: "refId (student_id) requis" });
      return;
    }
    const { rows } = await pool.query(`SELECT id FROM careers.student WHERE student_id = $1`, [body.refId]);
    if (!rows[0]) {
      res.status(400).json({ error: "Étudiant introuvable" });
      return;
    }
    await pool.query(
      `INSERT INTO careers.access_token (token, kind, student_uuid, company_id, label, created_at)
       VALUES ($1, 'student', $2, NULL, $3, now())`,
      [token, rows[0].id, body.label],
    );
    refOut = body.refId;
  } else if (body.kind === "company") {
    if (!body.refId?.trim()) {
      res.status(400).json({
        error:
          "Pour un accès entreprise sans entreprise déjà en base, utilisez le lien public /company (sans jeton). Pour pré-remplir une fiche connue, sélectionnez l’entreprise.",
      });
      return;
    }
    await pool.query(
      `INSERT INTO careers.access_token (token, kind, student_uuid, company_id, label, created_at)
       VALUES ($1, 'company', NULL, $2::uuid, $3, now())`,
      [token, body.refId.trim(), body.label],
    );
    refOut = body.refId.trim();
  } else {
    res.status(400).json({ error: "kind invalide" });
    return;
  }
  res.json({
    token,
    kind: body.kind,
    refId: refOut,
    label: body.label,
    createdAt: new Date().toISOString(),
  } as LinkToken);
});

// ——— Students & submissions ———
app.get("/api/students", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT s.student_id, s.first_name, s.last_name, s.email, s.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student s
       JOIN careers.promotion p ON p.id = s.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
       ORDER BY s.student_id`,
  );
  res.json(rows.map((r) => mapStudentRow(r)));
});

app.get("/api/students/:studentId", async (req, res) => {
  const st = await loadStudent(req.params.studentId);
  if (!st) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(st);
});

app.get("/api/submissions", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.student_id, ss.company_name, ss.company_country, ss.company_city,
            ss.position, ss.missions, ss.start_date, ss.end_date,
            ss.tutor_name, ss.tutor_email, ss.status::text AS status,
            ss.reviewer_comment, ss.submitted_at, ss.reviewed_at,
            st.first_name, st.last_name, st.email, st.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student_submission ss
       JOIN careers.student st ON st.id = ss.student_uuid
       JOIN careers.promotion p ON p.id = ss.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
       ORDER BY ss.submitted_at DESC`,
  );
  res.json(rows.map((r) => mapSubmissionRow(r)));
});

app.get("/api/submissions/by-student/:studentId", async (req, res) => {
  const sub = await loadSubmissionByStudentId(req.params.studentId);
  if (!sub) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(sub);
});

app.get("/api/submissions/:id", requireAdmin, async (req, res) => {
  const sub = await loadSubmission(req.params.id);
  if (!sub) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(sub);
});

app.post("/api/submissions", async (req, res) => {
  const body = req.body as {
    student: Student;
    companyName: string;
    companyCountry: string;
    companyCity?: string;
    companyEmail?: string;
    companyPhone?: string;
    startDate: string;
    endDate: string;
    position: string;
    missions: string;
    tutorName: string;
    tutorEmail: string;
    birthDate?: string;
    personalEmail?: string;
    careerHeadName?: string;
    acceptedTerms?: boolean;
    civilLiabilityInsurance?: string;
    studentAddress?: string;
    studentPostalCode?: string;
    studentCity?: string;
  };
  if (!body.student?.id) {
    res.status(400).json({ error: "student.id requis" });
    return;
  }
  const { season, year } = intakeToSeasonYear(body.student.promotion);
  const campusCode = campusLabelToCode(body.student.campus);
  const progCode = programmeLabelToCode(body.student.programme);

  const missionsMerged = mergeContractMissions(body.missions, {
    careerHeadName: body.careerHeadName,
    acceptedTerms: body.acceptedTerms === true,
    personalEmail: body.personalEmail,
    studentAddress: body.studentAddress,
    studentPostalCode: body.studentPostalCode,
    studentCity: body.studentCity,
    companyEmail: body.companyEmail,
    companyPhone: body.companyPhone,
    civilLiabilityInsurance: body.civilLiabilityInsurance,
  });

  const birthDateParam =
    body.birthDate && String(body.birthDate).trim() !== "" ? body.birthDate : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: promos } = await client.query(
      `SELECT p.id FROM careers.promotion p
         JOIN careers.campus c ON c.id = p.campus_id
         JOIN careers.programme pr ON pr.id = p.programme_id
        WHERE c.code = $1 AND pr.code = $2 AND p.season = $3::careers.intake_season AND p.year = $4`,
      [campusCode, progCode, season, year],
    );
    if (!promos[0]) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Promotion introuvable pour ce campus / programme / rentrée" });
      return;
    }
    const promotionId = promos[0].id as number;

    const upSt = await client.query(
      `UPDATE careers.student
          SET promotion_id = $1, first_name = $2, last_name = $3, email = $4, phone = $5,
              birth_date = COALESCE($6::date, birth_date),
              updated_at = now()
        WHERE student_id = $7`,
      [
        promotionId,
        body.student.firstName,
        body.student.lastName,
        body.student.email,
        body.student.phone ?? null,
        birthDateParam,
        body.student.id,
      ],
    );
    if (upSt.rowCount === 0) {
      await client.query(
        `INSERT INTO careers.student (student_id, promotion_id, first_name, last_name, email, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          body.student.id,
          promotionId,
          body.student.firstName,
          body.student.lastName,
          body.student.email,
          body.student.phone ?? null,
          birthDateParam,
        ],
      );
    }

    const { rows: stu } = await client.query(`SELECT id FROM careers.student WHERE student_id = $1`, [
      body.student.id,
    ]);
    if (!stu[0]) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Étudiant introuvable après mise à jour" });
      return;
    }
    const studentUuid = stu[0].id as string;

    const { rows: existing } = await client.query(
      `SELECT id FROM careers.student_submission
        WHERE student_uuid = $1 AND promotion_id = $2 AND status <> 'rejected'`,
      [studentUuid, promotionId],
    );

    let submissionId: string;
    if (existing[0]) {
      submissionId = existing[0].id as string;
      await client.query(
        `UPDATE careers.student_submission SET
           student_id = $1, company_name = $2, company_country = $3, company_city = $4,
           position = $5, missions = $6, start_date = $7, end_date = $8,
           tutor_name = $9, tutor_email = $10,
           status = 'pending'::careers.submission_status,
           reviewer_comment = NULL, reviewed_at = NULL, reviewed_by = NULL,
           submitted_at = now(), updated_at = now()
         WHERE id = $11`,
        [
          body.student.id,
          body.companyName,
          body.companyCountry,
          body.companyCity ?? null,
          body.position,
          missionsMerged,
          body.startDate,
          body.endDate,
          body.tutorName,
          body.tutorEmail,
          submissionId,
        ],
      );
    } else {
      const ins = await client.query(
        `INSERT INTO careers.student_submission (
           student_uuid, student_id, promotion_id,
           company_name, company_country, company_city,
           position, missions, start_date, end_date,
           tutor_name, tutor_email, status, submitted_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending'::careers.submission_status, now())
         RETURNING id`,
        [
          studentUuid,
          body.student.id,
          promotionId,
          body.companyName,
          body.companyCountry,
          body.companyCity ?? null,
          body.position,
          missionsMerged,
          body.startDate,
          body.endDate,
          body.tutorName,
          body.tutorEmail,
        ],
      );
      submissionId = ins.rows[0].id as string;
    }

    await client.query(
      `INSERT INTO careers.internship_form_response (student_id_text, payload, submission_id)
       VALUES ($1, $2::jsonb, $3)`,
      [body.student.id, JSON.stringify(req.body), submissionId],
    );

    await client.query("COMMIT");
    const out = await loadSubmission(submissionId);
    res.json(out);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

/** Journal brut : chaque envoi du formulaire convention (audit). */
app.get("/api/admin/form-responses", requireAdmin, async (req, res) => {
  const raw = Number(req.query.limit);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 500) : 100;
  const { rows } = await pool.query(
    `SELECT id, student_id_text, submission_id, created_at, payload
       FROM careers.internship_form_response
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  res.json(
    rows.map((r: { id: string; student_id_text: string; submission_id: string | null; created_at: Date; payload: unknown }) => ({
      id: r.id,
      studentIdText: r.student_id_text,
      submissionId: r.submission_id ?? undefined,
      createdAt: new Date(r.created_at).toISOString(),
      payload: r.payload,
    })),
  );
});

app.post("/api/submissions/:id/decision", requireAdmin, async (req, res) => {
  const { status, comment } = req.body as { status?: string; comment?: string };
  if (!status || !["changes_requested", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status invalide" });
    return;
  }
  await pool.query(
    `UPDATE careers.student_submission SET
       status = $1::careers.submission_status,
       reviewer_comment = $2,
       reviewed_at = now(),
       updated_at = now()
     WHERE id = $3::uuid`,
    [status, comment ?? null, req.params.id],
  );
  const sub = await loadSubmission(req.params.id);
  res.json(sub);
});

// ——— Companies ———
app.get("/api/companies", requireAdmin, async (_req, res) => {
  const { rows: companies } = await pool.query(
    `SELECT id, name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
            address, city, postal_code, website FROM careers.company ORDER BY name`,
  );
  const out = [];
  for (const c of companies) {
    out.push(await loadCompany(c.id as string));
  }
  res.json(out);
});

app.get("/api/companies/search", async (req, res) => {
  const q = (req.query.q as string)?.trim() ?? "";
  const country = (req.query.country as string)?.trim();
  if (!q) {
    res.json([]);
    return;
  }
  const { rows } = country
    ? await pool.query(
        `SELECT id, name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
                address, city, postal_code, website FROM careers.company
          WHERE name ILIKE $1 AND lower(country) = lower($2) ORDER BY name LIMIT 50`,
        [`%${q}%`, country],
      )
    : await pool.query(
        `SELECT id, name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
                address, city, postal_code, website FROM careers.company
          WHERE name ILIKE $1 ORDER BY name LIMIT 50`,
        [`%${q}%`],
      );
  const list = [];
  for (const c of rows) {
    list.push(await loadCompany(c.id as string));
  }
  res.json(list);
});

/** Doit être déclaré avant `/api/companies/:id`, sinon `exact` est pris pour un UUID. */
app.get("/api/companies/exact", async (req, res) => {
  const name = (req.query.name as string)?.trim();
  const country = (req.query.country as string)?.trim();
  if (!name || !country) {
    res.status(400).json({ error: "name et country requis" });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id FROM careers.company WHERE lower(trim(name)) = lower(trim($1)) AND lower(trim(country)) = lower(trim($2))`,
    [name, country],
  );
  if (!rows[0]) {
    res.status(404).json(null);
    return;
  }
  const c = await loadCompany(rows[0].id as string);
  res.json(c);
});

app.get("/api/companies/:id", async (req, res) => {
  const c = await loadCompany(req.params.id);
  if (!c) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(c);
});

app.delete("/api/companies/:id", requireAdmin, async (req, res) => {
  const r = await pool.query(`DELETE FROM careers.company WHERE id = $1::uuid RETURNING id`, [
    req.params.id,
  ]);
  if (!r.rowCount) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.status(204).send();
});

app.post("/api/companies", async (req, res) => {
  const body = req.body as Partial<Company> & { id?: string };
  if (!body.name || !body.country) {
    res.status(400).json({ error: "name et country requis" });
    return;
  }

  /** Chaîne optionnelle : vide → NULL en base. */
  function optText(v: unknown): string | null {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  /** Remplace les contacts dans une transaction : si une insertion échoue (ex. doublon email),
   *  rien n’est appliqué — évite une entreprise avec uniquement le RH et sans tuteur. */
  async function replaceContacts(companyId: string, contacts: Company["contacts"] | undefined) {
    if (contacts === undefined) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM careers.company_contact WHERE company_id = $1::uuid`, [companyId]);
      if (contacts.length === 0) {
        await client.query("COMMIT");
        return;
      }
      const seen = new Set<string>();
      let isFirst = true;
      for (const ct of contacts) {
        const email = ct.email?.trim();
        if (!email) continue;
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const phone = ct.phone?.trim() ? ct.phone.trim() : null;
        await client.query(
          `INSERT INTO careers.company_contact (company_id, full_name, email, role, phone, is_primary)
           VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
          [companyId, ct.name, email, ct.role ?? "", phone, isFirst],
        );
        isFirst = false;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  if (body.id) {
    const { rows: exRows } = await pool.query(
      `SELECT sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
              address, city, postal_code, website
         FROM careers.company WHERE id = $1::uuid`,
      [body.id],
    );
    if (!exRows[0]) {
      res.status(404).json({ error: "Entreprise introuvable" });
      return;
    }
    const ex = exRows[0] as {
      sector: string | null;
      size_bucket: string | null;
      trade_name: string | null;
      siret: string | null;
      insurance_company: string | null;
      insurance_policy: string | null;
      address: string | null;
      city: string | null;
      postal_code: string | null;
      website: string | null;
    };
    /**
     * JSON.stringify côté client omet les clés `undefined` : sans fusion, on réécrivait NULL partout
     * et on effaçait trade_name, siret, ville, etc. même si l’utilisateur les avait remplis avant.
     */
    const sector = "sector" in body ? optText(body.sector) : ex.sector;
    const size_bucket = "size" in body ? optText(body.size) : ex.size_bucket;
    const trade_name = "tradeName" in body ? optText(body.tradeName) : ex.trade_name;
    const siret = "siret" in body ? optText(body.siret) : ex.siret;
    const insurance_company =
      "insuranceCompany" in body ? optText(body.insuranceCompany) : ex.insurance_company;
    const insurance_policy =
      "insurancePolicy" in body ? optText(body.insurancePolicy) : ex.insurance_policy;
    const address = "address" in body ? optText(body.address) : ex.address;
    const city = "city" in body ? optText(body.city) : ex.city;
    const postal_code = "postalCode" in body ? optText(body.postalCode) : ex.postal_code;
    const website = "website" in body ? optText(body.website) : ex.website;

    await pool.query(
      `UPDATE careers.company SET name = $1, country = $2, sector = $3, size_bucket = $4,
           trade_name = $5, siret = $6, insurance_company = $7, insurance_policy = $8,
           address = $9, city = $10, postal_code = $11, website = $12, updated_at = now()
        WHERE id = $13::uuid`,
      [
        body.name,
        body.country,
        sector,
        size_bucket,
        trade_name,
        siret,
        insurance_company,
        insurance_policy,
        address,
        city,
        postal_code,
        website,
        body.id,
      ],
    );
    await replaceContacts(body.id, body.contacts);
    const c = await loadCompany(body.id);
    res.json(c);
    return;
  }

  const sector = optText(body.sector);
  const size_bucket = optText(body.size);
  const trade_name = optText(body.tradeName);
  const siret = optText(body.siret);
  const insurance_company = optText(body.insuranceCompany);
  const insurance_policy = optText(body.insurancePolicy);
  const address = optText(body.address);
  const city = optText(body.city);
  const postal_code = optText(body.postalCode);
  const website = optText(body.website);

  const ins = await pool.query(
    `INSERT INTO careers.company (
       name, country, sector, size_bucket, trade_name, siret, insurance_company, insurance_policy,
       address, city, postal_code, website
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      body.name,
      body.country,
      sector,
      size_bucket,
      trade_name,
      siret,
      insurance_company,
      insurance_policy,
      address,
      city,
      postal_code,
      website,
    ],
  );
  const id = ins.rows[0].id as string;
  await replaceContacts(id, body.contacts);
  const c = await loadCompany(id);
  res.json(c);
});

// ——— Declarations ———
async function loadDeclarationRow(declId: string): Promise<CompanyDeclaration | undefined> {
  const { rows } = await pool.query(
    `SELECT cd.id, cd.company_id::text, cd.season::text AS season, cd.year, cd.submitted_at, cd.partner_form_extras
       FROM careers.company_declaration cd WHERE cd.id = $1`,
    [declId],
  );
  if (!rows[0]) return undefined;
  const { rows: interns } = await pool.query(
    `SELECT student_id, first_name, last_name, internship_type, position, start_date, end_date,
            tutor_name, tutor_email, tutor_phone
       FROM careers.declared_intern WHERE declaration_id = $1`,
    [declId],
  );
  const r = rows[0] as {
    id: string;
    company_id: string;
    season: string;
    year: number;
    submitted_at: Date;
    partner_form_extras: unknown;
  };
  return {
    id: r.id,
    companyId: r.company_id,
    intake: dbSeasonYearToIntake(r.season, r.year),
    interns: interns.map((i) => mapDeclaredInternRow(i)),
    submittedAt: r.submitted_at.toISOString(),
    partnerFormExtras: (r.partner_form_extras as Record<string, unknown>) ?? undefined,
  };
}

app.get("/api/declarations", requireAdmin, async (req, res) => {
  const companyId = req.query.companyId as string | undefined;
  let declIds: string[];
  if (companyId) {
    const { rows } = await pool.query(
      `SELECT id::text FROM careers.company_declaration WHERE company_id = $1::uuid ORDER BY submitted_at DESC`,
      [companyId],
    );
    declIds = rows.map((x) => x.id as string);
  } else {
    const { rows } = await pool.query(`SELECT id::text FROM careers.company_declaration ORDER BY submitted_at DESC`);
    declIds = rows.map((x) => x.id as string);
  }
  const list: CompanyDeclaration[] = [];
  for (const id of declIds) {
    const d = await loadDeclarationRow(id);
    if (d) list.push(d);
  }
  res.json(list);
});

app.post("/api/declarations", async (req, res) => {
  const body = req.body as {
    companyId: string;
    intake: Intake;
    interns: DeclaredIntern[];
    partnerFormExtras?: Record<string, unknown>;
  };
  if (!body.companyId || !body.intake || !body.interns) {
    res.status(400).json({ error: "companyId, intake et interns requis" });
    return;
  }
  const { season, year } = intakeToSeasonYear(body.intake);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: decl } = await client.query(
      `INSERT INTO careers.company_declaration (company_id, season, year, partner_form_extras, submitted_at, updated_at)
       VALUES ($1::uuid, $2::careers.intake_season, $3, $4::jsonb, now(), now())
       ON CONFLICT (company_id, season, year)
       DO UPDATE SET submitted_at = now(), updated_at = now(),
             partner_form_extras = EXCLUDED.partner_form_extras
       RETURNING id`,
      [body.companyId, season, year, JSON.stringify(body.partnerFormExtras ?? {})],
    );
    const declId = decl[0].id as string;
    await client.query(`DELETE FROM careers.declared_intern WHERE declaration_id = $1::uuid`, [declId]);
    for (const intern of body.interns) {
      await client.query(
        `INSERT INTO careers.declared_intern (
           declaration_id, student_id, first_name, last_name, internship_type,
           position, start_date, end_date, tutor_name, tutor_email, tutor_phone
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          declId,
          intern.studentId,
          intern.firstName ?? null,
          intern.lastName ?? null,
          intern.internshipType ?? null,
          intern.position,
          intern.startDate,
          intern.endDate,
          intern.tutorName || null,
          intern.tutorEmail || null,
          intern.tutorPhone ?? null,
        ],
      );
    }
    await client.query("COMMIT");
    const out = await loadDeclarationRow(declId);
    res.json(out);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ——— Merged ———
app.get("/api/merged", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT match_status, student_id, student_uuid, submission_id, company_id, declared_intern_id,
            season::text AS season, year,
            student_full_name, student_email, company_name, company_country,
            position, start_date, end_date, tutor_name, tutor_email
       FROM careers.v_merged_overview`,
  );

  const merged: MergedInternship[] = [];
  for (const r of rows) {
    const intake = dbSeasonYearToIntake(r.season as string, Number(r.year));
    const student = r.student_id ? await loadStudent(r.student_id as string) : undefined;

    let submission: StudentSubmission | undefined;
    if (r.submission_id) {
      submission = await loadSubmission(r.submission_id as string);
    }

    let company = undefined;
    if (r.company_id) {
      company = await loadCompany(r.company_id as string);
    }

    let declaredIntern: DeclaredIntern | undefined;
    if (r.declared_intern_id) {
      const { rows: di } = await pool.query(
        `SELECT student_id, position, start_date, end_date, tutor_name, tutor_email
           FROM careers.declared_intern WHERE id = $1`,
        [r.declared_intern_id],
      );
      if (di[0]) declaredIntern = mapDeclaredInternRow(di[0]);
    } else if (r.position && r.student_id) {
      declaredIntern = {
        studentId: r.student_id as string,
        position: r.position as string,
        startDate:
          typeof r.start_date === "string"
            ? (r.start_date as string).slice(0, 10)
            : (r.start_date as Date).toISOString().slice(0, 10),
        endDate:
          typeof r.end_date === "string"
            ? (r.end_date as string).slice(0, 10)
            : (r.end_date as Date).toISOString().slice(0, 10),
        tutorName: (r.tutor_name as string) ?? "",
        tutorEmail: (r.tutor_email as string) ?? "",
      };
    }

    merged.push({
      studentId: r.student_id as string,
      student,
      studentSubmission: submission,
      company,
      declaredIntern,
      intake,
      status: r.match_status as "matched" | "student_only" | "company_only",
    });
  }

  res.json(merged);
});

app.listen(PORT, () => {
  console.log(`API Ducasse Carrières sur http://localhost:${PORT}`);
});
