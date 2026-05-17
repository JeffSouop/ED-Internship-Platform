/**
 * API Express « backend unique » : seul point d’accès aux données Postgres pour le web.
 * Le navigateur utilise uniquement les routes HTTP /api (via l’UI / proxy), pas DATABASE_URL.
 */
import { config as loadEnv } from "dotenv";
loadEnv();
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
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
  mergedMatchedPgRowToMergedInternship,
  programmeLabelToCode,
} from "./mappers.js";
import { insertDeclaredInternWithFullIntake } from "./partner-snapshot.js";
import {
  ConventionGenerateError,
  conventionExistsForStudent,
  generateConventionDocx,
} from "./convention-generate.js";
import { resolveConventionAbsolutePath } from "./convention-index.js";
import {
  DocuSignError,
  getDocuSignConfigStatus,
  sendConventionToDocuSign,
} from "./docusign.js";
import { listConventionTracking } from "./convention-tracking.js";
import { listConventionGenerationStatus } from "./convention-generation-status.js";
import {
  AttestationGenerateError,
  attestationExistsForStudent,
  generateAttestationDocx,
} from "./attestation-generate.js";
import { listAttestations } from "./attestation-list.js";
import { resolveAttestationAbsolutePath } from "./attestation-index.js";
import {
  RuptureGenerateError,
  generateRuptureDocx,
  ruptureExistsForStudent,
} from "./rupture-generate.js";
import { listRuptures } from "./rupture-list.js";
import { resolveRuptureAbsolutePath } from "./rupture-index.js";
import { buildDashboardCompanyMap } from "./dashboard-company-map.js";
import { sendCompanyFormInviteOnApproval } from "./company-invite-email.js";
import {
  getStudentDecisionEmailDraft,
  sendStudentDecisionEmailWithBody,
} from "./student-decision-email.js";
import {
  createStaffUser,
  findStaffByEmail,
  listStaffUsers,
  signStaffJwt,
  toPublicStaffUser,
  touchStaffLastLogin,
  verifyStaffJwt,
  verifyStaffPassword,
} from "./staff-auth.js";
import type { AdminJwtPayload } from "./staff-auth.js";
import path from "node:path";

const { Pool } = pg;

const PORT = Number(process.env.PORT) || 4000;
const DATABASE_URL = process.env.DATABASE_URL;
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

function readStaffSession(req: express.Request): AdminJwtPayload | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  return verifyStaffJwt(raw, JWT_SECRET);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const payload = readStaffSession(req);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  (req as express.Request & { staff?: AdminJwtPayload }).staff = payload;
  next();
}

function requireStaffAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const payload = readStaffSession(req);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  if (payload.role !== "admin") {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }
  (req as express.Request & { staff?: AdminJwtPayload }).staff = payload;
  next();
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
            ss.campus_input_label, ss.programme_input_label, ss.career_head_name, ss.accepted_terms,
            ss.personal_email, ss.company_email, ss.company_phone,
            ss.student_address, ss.student_postal_code, ss.student_city, ss.civil_liability_insurance_ref,
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
            ss.campus_input_label, ss.programme_input_label, ss.career_head_name, ss.accepted_terms,
            ss.personal_email, ss.company_email, ss.company_phone,
            ss.student_address, ss.student_postal_code, ss.student_city, ss.civil_liability_insurance_ref,
            st.first_name, st.last_name, st.email, st.phone,
            c.code AS campus_code, c.name AS campus_name, pr.name AS programme_name, p.season, p.year
       FROM careers.student_submission ss
       JOIN careers.student st ON st.id = ss.student_uuid
       JOIN careers.promotion p ON p.id = ss.promotion_id
       JOIN careers.campus c ON c.id = p.campus_id
       JOIN careers.programme pr ON pr.id = p.programme_id
      WHERE ss.student_id = $1 AND ss.status NOT IN ('rejected', 'superseded')
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ——— Auth ———
app.post("/api/auth/login", async (req, res) => {
  const body = req.body as { email?: string; password?: string };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe requis" });
    return;
  }

  try {
    const staff = await findStaffByEmail(pool, email);
    if (!staff || !(await verifyStaffPassword(password, staff.passwordHash))) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    await touchStaffLastLogin(pool, staff.id);
    const token = signStaffJwt(staff, JWT_SECRET);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({
      ok: true,
      user: toPublicStaffUser(staff),
    });
  } catch (e) {
    console.error("POST /api/auth/login", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const payload = readStaffSession(req);
  if (!payload) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({
    ok: true,
    user: {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: payload.fullName,
      role: payload.role,
    },
  });
});

app.get("/api/admin/staff-users", requireStaffAdmin, async (_req, res) => {
  try {
    const users = await listStaffUsers(pool);
    res.json(users);
  } catch (e) {
    console.error("GET /api/admin/staff-users", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/staff-users", requireStaffAdmin, async (req, res) => {
  const body = req.body as {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  };
  const email = body.email?.trim() ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !firstName || !lastName || !password) {
    res.status(400).json({ error: "Prénom, nom, email et mot de passe sont requis" });
    return;
  }
  try {
    const user = await createStaffUser(pool, { email, firstName, lastName, password, role: "reviewer" });
    res.status(201).json(toPublicStaffUser(user));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMAIL_EXISTS") {
      res.status(409).json({ error: "Un compte existe déjà avec cette adresse email" });
      return;
    }
    if (msg === "WEAK_PASSWORD") {
      res.status(400).json({ error: "Le mot de passe doit contenir au moins 4 caractères" });
      return;
    }
    console.error("POST /api/admin/staff-users", e);
    res.status(500).json({ error: "Erreur serveur" });
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
            ss.campus_input_label, ss.programme_input_label, ss.career_head_name, ss.accepted_terms,
            ss.personal_email, ss.company_email, ss.company_phone,
            ss.student_address, ss.student_postal_code, ss.student_city, ss.civil_liability_insurance_ref,
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

app.get("/api/submissions/:id/email-draft", requireAdmin, async (req, res) => {
  const decision = req.query.decision as string;
  if (decision !== "changes_requested" && decision !== "rejected") {
    res.status(400).json({ error: "decision doit être changes_requested ou rejected" });
    return;
  }
  const sub = await loadSubmission(req.params.id);
  if (!sub) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  try {
    const draft = await getStudentDecisionEmailDraft(pool, sub, decision);
    res.json(draft);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de générer le modèle d’e-mail" });
  }
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
  const studentIdPivot = String(body.student.id).trim();
  const emailStore = String(body.student.email ?? "").trim();
  if (!studentIdPivot || !emailStore) {
    res.status(400).json({ error: "Numéro étudiant et email requis" });
    return;
  }
  const emailLower = emailStore.toLowerCase();

  const { season, year } = intakeToSeasonYear(body.student.promotion);
  const campusCode = campusLabelToCode(body.student.campus);
  const progCode = programmeLabelToCode(body.student.programme);

  const missionsNarrative = (body.missions ?? "").trim();

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

    const { rows: emailTaken } = await client.query(
      `SELECT student_id FROM careers.student
        WHERE lower(trim(email)) = $1 AND lower(trim(student_id)) <> lower(trim($2))`,
      [emailLower, studentIdPivot],
    );
    if (emailTaken[0]) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `Cet email est déjà enregistré pour le numéro étudiant « ${emailTaken[0].student_id} ». Utilisez exactement ce numéro étudiant sur le formulaire, ou contactez le service stages.`,
      });
      return;
    }

    const upSt = await client.query(
      `UPDATE careers.student
          SET promotion_id = $1, first_name = $2, last_name = $3, email = $4, phone = $5,
              birth_date = COALESCE($6::date, birth_date),
              updated_at = now()
        WHERE lower(trim(student_id)) = lower(trim($7))`,
      [
        promotionId,
        body.student.firstName,
        body.student.lastName,
        emailStore,
        body.student.phone ?? null,
        birthDateParam,
        studentIdPivot,
      ],
    );
    if (upSt.rowCount === 0) {
      await client.query(
        `INSERT INTO careers.student (student_id, promotion_id, first_name, last_name, email, phone, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          studentIdPivot,
          promotionId,
          body.student.firstName,
          body.student.lastName,
          emailStore,
          body.student.phone ?? null,
          birthDateParam,
        ],
      );
    }

    const { rows: stu } = await client.query(
      `SELECT id FROM careers.student WHERE lower(trim(student_id)) = lower(trim($1))`,
      [studentIdPivot],
    );
    if (!stu[0]) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Étudiant introuvable après mise à jour" });
      return;
    }
    const studentUuid = stu[0].id as string;

    await client.query(
      `UPDATE careers.student_submission
          SET status = 'superseded'::careers.submission_status, updated_at = now()
        WHERE student_uuid = $1 AND promotion_id = $2
          AND status IN ('pending'::careers.submission_status, 'changes_requested'::careers.submission_status)`,
      [studentUuid, promotionId],
    );

    const ins = await client.query(
      `INSERT INTO careers.student_submission (
           student_uuid, student_id, promotion_id,
           company_name, company_country, company_city,
           position, missions, start_date, end_date,
           tutor_name, tutor_email, status, submitted_at,
           campus_input_label, programme_input_label, career_head_name, accepted_terms,
           personal_email, company_email, company_phone,
           student_address, student_postal_code, student_city,
           civil_liability_insurance_ref
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12,
           'pending'::careers.submission_status, now(),
           $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
         ) RETURNING id`,
      [
        studentUuid,
        studentIdPivot,
        promotionId,
        body.companyName,
        body.companyCountry,
        body.companyCity ?? null,
        body.position,
        missionsNarrative,
        body.startDate,
        body.endDate,
        body.tutorName,
        body.tutorEmail,
        body.student.campus,
        body.student.programme,
        body.careerHeadName ?? null,
        body.acceptedTerms === true,
        body.personalEmail ?? null,
        body.companyEmail ?? null,
        body.companyPhone ?? null,
        body.studentAddress ?? null,
        body.studentPostalCode ?? null,
        body.studentCity ?? null,
        body.civilLiabilityInsurance ?? null,
      ],
    );
    const submissionId = ins.rows[0]!.id as string;

    await client.query("COMMIT");
    const out = await loadSubmission(submissionId);
    res.json(out);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === "23505" && String(pg.constraint ?? "").includes("student_email")) {
      res.status(409).json({
        error:
          "Cet email est déjà associé à un autre dossier étudiant. Vérifiez votre numéro étudiant (Symplicity) et l’email école, ou contactez le service stages.",
      });
      return;
    }
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    client.release();
  }
});

/** Chaque ligne = un enregistrement complet `student_submission` (historique des envois). */
app.get("/api/admin/form-responses", requireAdmin, async (req, res) => {
  const raw = Number(req.query.limit);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 500) : 100;
  const { rows } = await pool.query(
    `SELECT ss.id, ss.student_id, ss.submitted_at, ss.status::text AS status,
            ss.company_name, ss.company_country, ss.company_city, ss.position, ss.missions,
            ss.start_date, ss.end_date, ss.tutor_name, ss.tutor_email,
            ss.campus_input_label, ss.programme_input_label, ss.career_head_name, ss.accepted_terms,
            ss.personal_email, ss.company_email, ss.company_phone,
            ss.student_address, ss.student_postal_code, ss.student_city, ss.civil_liability_insurance_ref
       FROM careers.student_submission ss
      ORDER BY ss.submitted_at DESC
      LIMIT $1`,
    [limit],
  );
  const iso = (d: Date | string) =>
    typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
  res.json(
    rows.map(
      (r: {
        id: string;
        student_id: string;
        submitted_at: Date;
        status: string;
        company_name: string;
        company_country: string;
        company_city: string | null;
        position: string;
        missions: string | null;
        start_date: Date | string;
        end_date: Date | string;
        tutor_name: string | null;
        tutor_email: string | null;
        campus_input_label: string | null;
        programme_input_label: string | null;
        career_head_name: string | null;
        accepted_terms: boolean | null;
        personal_email: string | null;
        company_email: string | null;
        company_phone: string | null;
        student_address: string | null;
        student_postal_code: string | null;
        student_city: string | null;
        civil_liability_insurance_ref: string | null;
      }) => ({
        id: r.id,
        studentId: r.student_id,
        submittedAt: iso(r.submitted_at),
        status: r.status,
        record: {
          companyName: r.company_name,
          companyCountry: r.company_country,
          companyCity: r.company_city ?? undefined,
          position: r.position,
          missions: r.missions ?? "",
          startDate: typeof r.start_date === "string" ? r.start_date.slice(0, 10) : r.start_date.toISOString().slice(0, 10),
          endDate: typeof r.end_date === "string" ? r.end_date.slice(0, 10) : r.end_date.toISOString().slice(0, 10),
          tutorName: r.tutor_name ?? "",
          tutorEmail: r.tutor_email ?? "",
          campusInputLabel: r.campus_input_label ?? undefined,
          programmeInputLabel: r.programme_input_label ?? undefined,
          careerHeadName: r.career_head_name ?? undefined,
          acceptedTerms: r.accepted_terms === true,
          personalEmail: r.personal_email ?? undefined,
          companyEmail: r.company_email ?? undefined,
          companyPhone: r.company_phone ?? undefined,
          studentAddress: r.student_address ?? undefined,
          studentPostalCode: r.student_postal_code ?? undefined,
          studentCity: r.student_city ?? undefined,
          civilLiabilityInsuranceRef: r.civil_liability_insurance_ref ?? undefined,
        },
      }),
    ),
  );
});

app.post("/api/submissions/:id/decision", requireAdmin, async (req, res) => {
  const { status, comment } = req.body as { status?: string; comment?: string };
  if (!status || !["changes_requested", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status invalide" });
    return;
  }
  const emailBody = (req.body as { emailBody?: string }).emailBody?.trim() ?? "";
  const commentText = comment?.trim() ?? emailBody;
  if ((status === "changes_requested" || status === "rejected") && !emailBody) {
    res.status(400).json({
      error: "Le corps du message e-mail est obligatoire pour cette décision.",
    });
    return;
  }

  const { rows: beforeRows } = await pool.query<{ status: string }>(
    `SELECT status::text AS status FROM careers.student_submission WHERE id = $1::uuid`,
    [req.params.id],
  );
  if (!beforeRows[0]) {
    res.status(404).json({ error: "Soumission introuvable" });
    return;
  }
  const previousStatus = beforeRows[0].status;

  await pool.query(
    `UPDATE careers.student_submission SET
       status = $1::careers.submission_status,
       reviewer_comment = $2,
       reviewed_at = now(),
       updated_at = now()
     WHERE id = $3::uuid`,
    [status, emailBody || commentText || null, req.params.id],
  );
  const sub = await loadSubmission(req.params.id);
  if (!sub) {
    res.status(404).json({ error: "Soumission introuvable" });
    return;
  }

  type EmailOutcome = { sent: boolean; error?: string; skippedReason?: string };
  let companyInviteEmail: EmailOutcome | undefined;
  let studentDecisionEmail: EmailOutcome | undefined;

  if (status === "approved" && previousStatus !== "approved") {
    try {
      const invite = await sendCompanyFormInviteOnApproval(sub);
      if (invite.sent) {
        companyInviteEmail = { sent: true };
      } else {
        companyInviteEmail = { sent: false, skippedReason: invite.reason };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[company-invite-email]", message);
      companyInviteEmail = { sent: false, error: message };
    }
  }

  if (
    (status === "changes_requested" || status === "rejected") &&
    previousStatus !== status
  ) {
    try {
      const mail = await sendStudentDecisionEmailWithBody(pool, sub, status, emailBody);
      if (mail.sent) {
        studentDecisionEmail = { sent: true };
      } else {
        studentDecisionEmail = { sent: false, skippedReason: mail.reason };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[student-decision-email]", message);
      studentDecisionEmail = { sent: false, error: message };
    }
  }

  res.json({ ...sub, companyInviteEmail, studentDecisionEmail });
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
              address, city, postal_code, website, latitude, longitude
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
    const addressChanged =
      address !== ex.address || city !== ex.city || postal_code !== ex.postal_code;

    await pool.query(
      `UPDATE careers.company SET name = $1, country = $2, sector = $3, size_bucket = $4,
           trade_name = $5, siret = $6, insurance_company = $7, insurance_policy = $8,
           address = $9, city = $10, postal_code = $11, website = $12,
           latitude = CASE WHEN $14 THEN NULL ELSE latitude END,
           longitude = CASE WHEN $14 THEN NULL ELSE longitude END,
           updated_at = now()
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
        addressChanged,
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
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (name, country) DO UPDATE SET
       sector = EXCLUDED.sector,
       size_bucket = EXCLUDED.size_bucket,
       trade_name = EXCLUDED.trade_name,
       siret = EXCLUDED.siret,
       insurance_company = EXCLUDED.insurance_company,
       insurance_policy = EXCLUDED.insurance_policy,
       address = EXCLUDED.address,
       city = EXCLUDED.city,
       postal_code = EXCLUDED.postal_code,
       website = EXCLUDED.website,
       updated_at = now()
     RETURNING id`,
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
    `SELECT cd.id, cd.company_id::text, cd.season::text AS season, cd.year, cd.submitted_at
       FROM careers.company_declaration cd WHERE cd.id = $1`,
    [declId],
  );
  if (!rows[0]) return undefined;
  const { rows: extrasRow } = await pool.query(
    `SELECT partner_form_extras FROM careers.declared_intern WHERE declaration_id = $1 LIMIT 1`,
    [declId],
  );
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
  };
  const rawExtras = extrasRow[0]?.partner_form_extras;
  return {
    id: r.id,
    companyId: r.company_id,
    intake: dbSeasonYearToIntake(r.season, r.year),
    interns: interns.map((i) => mapDeclaredInternRow(i)),
    submittedAt: r.submitted_at.toISOString(),
    partnerFormExtras:
      rawExtras && typeof rawExtras === "object" && rawExtras !== null && Object.keys(rawExtras).length > 0
        ? (rawExtras as Record<string, unknown>)
        : undefined,
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
    /** État complet du formulaire partenaire au moment de l’envoi (persisté en colonnes + raw_payload). */
    partnerFormFullState?: Record<string, unknown>;
    partnerBenefitLabels?: string[];
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
      `INSERT INTO careers.company_declaration (company_id, season, year, submitted_at, updated_at)
       VALUES ($1::uuid, $2::careers.intake_season, $3, now(), now())
       ON CONFLICT (company_id, season, year)
       DO UPDATE SET submitted_at = now(), updated_at = now()
       RETURNING id`,
      [body.companyId, season, year],
    );
    const declId = decl[0].id as string;
    await client.query(`DELETE FROM careers.declared_intern WHERE declaration_id = $1::uuid`, [declId]);
    const fullState = (body.partnerFormFullState ?? {}) as Record<string, unknown>;
    const benefitLabels = Array.isArray(body.partnerBenefitLabels)
      ? (body.partnerBenefitLabels as string[]).filter((x) => typeof x === "string")
      : [];
    const partnerFormExtras = (body.partnerFormExtras ?? {}) as Record<string, unknown>;
    for (const intern of body.interns) {
      await insertDeclaredInternWithFullIntake(client, {
        declarationId: declId,
        companyId: body.companyId,
        intern,
        fullState,
        benefitLabels,
        partnerFormExtras,
      });
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
  const { rows: matchedRows } = await pool.query(`SELECT * FROM careers.v_merged_overview`);
  const { rows: studentOnlyRows } = await pool.query(
    `SELECT ss.student_id, ss.student_uuid, ss.id AS submission_id,
            p.season::text AS season, p.year
       FROM careers.student_submission ss
       JOIN careers.promotion p ON p.id = ss.promotion_id
      WHERE ss.status = 'approved'
        AND NOT EXISTS (
              SELECT 1 FROM careers.merged_internship m2
               WHERE m2.student_id = ss.student_id)`,
  );
  const { rows: companyOnlyRows } = await pool.query(
    `SELECT di.student_id, c.id AS company_id, di.id AS declared_intern_id,
            cd.season::text AS season, cd.year
       FROM careers.declared_intern di
       JOIN careers.company_declaration cd ON cd.id = di.declaration_id
       JOIN careers.company c ON c.id = cd.company_id
      WHERE NOT EXISTS (
              SELECT 1 FROM careers.merged_internship m2
               WHERE m2.student_id = di.student_id)`,
  );

  const merged: MergedInternship[] = [];

  for (const r of matchedRows) {
    const row = r as Record<string, unknown>;
    const intake = dbSeasonYearToIntake(row.season as string, Number(row.year));
    merged.push(mergedMatchedPgRowToMergedInternship(row, intake));
  }

  for (const r of studentOnlyRows) {
    const intake = dbSeasonYearToIntake(r.season as string, Number(r.year));
    const student = r.student_id ? await loadStudent(r.student_id as string) : undefined;
    let submission: StudentSubmission | undefined;
    if (r.submission_id) {
      submission = await loadSubmission(r.submission_id as string);
    }
    merged.push({
      studentId: r.student_id as string,
      student,
      studentSubmission: submission,
      company: undefined,
      declaredIntern: undefined,
      intake,
      status: "student_only",
    });
  }

  for (const r of companyOnlyRows) {
    const intake = dbSeasonYearToIntake(r.season as string, Number(r.year));
    const student = r.student_id ? await loadStudent(r.student_id as string) : undefined;
    let company = undefined;
    if (r.company_id) {
      company = await loadCompany(r.company_id as string);
    }
    let declaredIntern: DeclaredIntern | undefined;
    if (r.declared_intern_id) {
      const { rows: di } = await pool.query(
        `SELECT student_id, first_name, last_name, internship_type, position, start_date, end_date,
                tutor_name, tutor_email, tutor_phone
           FROM careers.declared_intern WHERE id = $1`,
        [r.declared_intern_id],
      );
      if (di[0]) declaredIntern = mapDeclaredInternRow(di[0]);
    }
    merged.push({
      studentId: r.student_id as string,
      student,
      studentSubmission: undefined,
      company,
      declaredIntern,
      intake,
      status: "company_only",
    });
  }

  res.json(merged);
});

// ——— Convention de stage (Word) ———
app.get("/api/admin/conventions/preview/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  const resolved = resolveConventionAbsolutePath(studentId);
  if (!resolved) {
    res.status(404).json({ error: "Aucune convention enregistrée pour cet étudiant." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(resolved.entry.filename)}"`,
  );
  res.sendFile(resolved.absolutePath);
});

app.get("/api/admin/conventions/docusign/status", requireAdmin, (_req, res) => {
  res.json(getDocuSignConfigStatus());
});

app.get("/api/admin/dashboard/company-map", requireAdmin, async (req, res) => {
  try {
    const geocodeMissing = req.query.warm === "1" || req.query.geocode === "1";
    const data = await buildDashboardCompanyMap(pool, { geocodeMissing });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de charger la carte des entreprises" });
  }
});

app.get("/api/admin/conventions/tracking", requireAdmin, async (req, res) => {
  const skipRefresh =
    req.query.refresh === "false" || req.query.skipRefresh === "1";
  try {
    const data = await listConventionTracking(pool, {
      refresh: skipRefresh ? false : undefined,
    });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de charger le suivi des conventions" });
  }
});

app.get("/api/admin/conventions/generation-status", requireAdmin, async (_req, res) => {
  try {
    const data = await listConventionGenerationStatus(pool);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "Impossible de charger le suivi de génération des conventions",
    });
  }
});

app.post("/api/admin/conventions/docusign/send", requireAdmin, async (req, res) => {
  const studentId =
    typeof req.body?.studentId === "string" ? req.body.studentId.trim() : "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  try {
    const result = await sendConventionToDocuSign(pool, studentId);
    res.json(result);
  } catch (e) {
    if (e instanceof DocuSignError) {
      res.status(e.status).json({
        error: e.message,
        code: e.code,
        consentUrl: e.consentUrl,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de l’envoi DocuSign" });
  }
});

app.get("/api/admin/conventions/exists/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  res.json(conventionExistsForStudent(studentId));
});

// ——— Attestation de stage (Word) ———
app.get("/api/admin/attestations", requireAdmin, async (_req, res) => {
  try {
    const rows = await listAttestations(pool);
    res.json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de charger la liste des attestations" });
  }
});

app.get("/api/admin/attestations/preview/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  const resolved = resolveAttestationAbsolutePath(studentId);
  if (!resolved) {
    res.status(404).json({ error: "Aucune attestation enregistrée pour cet étudiant." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(resolved.entry.filename)}"`,
  );
  res.sendFile(resolved.absolutePath);
});

app.get("/api/admin/attestations/download/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  const resolved = resolveAttestationAbsolutePath(studentId);
  if (!resolved) {
    res.status(404).json({ error: "Aucune attestation enregistrée pour cet étudiant." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(resolved.entry.filename)}"`,
  );
  res.sendFile(resolved.absolutePath);
});

app.get("/api/admin/attestations/exists/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  res.json(attestationExistsForStudent(studentId));
});

app.post("/api/admin/attestations/generate", requireAdmin, async (req, res) => {
  const studentId =
    typeof req.body?.studentId === "string"
      ? req.body.studentId.trim()
      : typeof req.query.studentId === "string"
        ? req.query.studentId.trim()
        : "";
  const overwrite = req.body?.overwrite === true;
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  try {
    const result = await generateAttestationDocx(pool, studentId, { overwrite });
    res.json({
      ok: true,
      studentId,
      filename: result.filename,
      path: result.relativePath,
      message: "L'attestation a été générée.",
      replaced: overwrite,
    });
  } catch (e) {
    if (e instanceof AttestationGenerateError) {
      res.status(e.status).json({
        error: e.message,
        code: e.code,
        existingFilename: e.existingFilename,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération de l'attestation" });
  }
});

// ——— Rupture de stage (Word) ———
app.get("/api/admin/ruptures", requireAdmin, async (_req, res) => {
  try {
    const rows = await listRuptures(pool);
    res.json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de charger la liste des ruptures de stage" });
  }
});

app.get("/api/admin/ruptures/preview/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  const resolved = resolveRuptureAbsolutePath(studentId);
  if (!resolved) {
    res.status(404).json({ error: "Aucune rupture de stage enregistrée pour cet étudiant." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(resolved.entry.filename)}"`,
  );
  res.sendFile(resolved.absolutePath);
});

app.get("/api/admin/ruptures/download/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  const resolved = resolveRuptureAbsolutePath(studentId);
  if (!resolved) {
    res.status(404).json({ error: "Aucune rupture de stage enregistrée pour cet étudiant." });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(resolved.entry.filename)}"`,
  );
  res.sendFile(resolved.absolutePath);
});

app.get("/api/admin/ruptures/exists/:studentId", requireAdmin, (req, res) => {
  const studentId = req.params.studentId?.trim() ?? "";
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  res.json(ruptureExistsForStudent(studentId));
});

app.post("/api/admin/ruptures/generate", requireAdmin, async (req, res) => {
  const studentId =
    typeof req.body?.studentId === "string"
      ? req.body.studentId.trim()
      : typeof req.query.studentId === "string"
        ? req.query.studentId.trim()
        : "";
  const overwrite = req.body?.overwrite === true;
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  try {
    const result = await generateRuptureDocx(pool, studentId, { overwrite });
    res.json({
      ok: true,
      studentId,
      filename: result.filename,
      path: result.relativePath,
      message: "La rupture de stage a été générée.",
      replaced: overwrite,
    });
  } catch (e) {
    if (e instanceof RuptureGenerateError) {
      res.status(e.status).json({
        error: e.message,
        code: e.code,
        existingFilename: e.existingFilename,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération de la rupture de stage" });
  }
});

app.post("/api/admin/conventions/generate", requireAdmin, async (req, res) => {
  const studentId =
    typeof req.body?.studentId === "string"
      ? req.body.studentId.trim()
      : typeof req.query.studentId === "string"
        ? req.query.studentId.trim()
        : "";
  const overwrite = req.body?.overwrite === true;
  if (!studentId) {
    res.status(400).json({ error: "studentId requis" });
    return;
  }
  try {
    const result = await generateConventionDocx(pool, studentId, { overwrite });
    res.json({
      ok: true,
      studentId,
      filename: result.filename,
      path: result.relativePath,
      message: "La convention a été générée.",
      replaced: overwrite,
    });
  } catch (e) {
    if (e instanceof ConventionGenerateError) {
      res.status(e.status).json({
        error: e.message,
        code: e.code,
        existingFilename: e.existingFilename,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération de la convention" });
  }
});

app.listen(PORT, () => {
  console.log(`API Ducasse Carrières sur http://localhost:${PORT}`);
});
