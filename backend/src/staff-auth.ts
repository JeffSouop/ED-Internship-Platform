import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Pool } from "pg";

export type StaffRole = "admin" | "reviewer" | "viewer";

export type StaffUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: StaffRole;
};

export type StaffUserPublic = StaffUser & {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminJwtPayload = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: StaffRole;
};

const BCRYPT_ROUNDS = 10;

function buildFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function mapStaffRow(row: {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: StaffRole;
}): StaffUser {
  const firstName = row.first_name?.trim() ?? "";
  const lastName = row.last_name?.trim() ?? "";
  const fullName = row.full_name?.trim() || buildFullName(firstName, lastName);
  return {
    id: row.id,
    email: row.email,
    firstName,
    lastName,
    fullName,
    role: row.role,
  };
}

export async function hashStaffPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyStaffPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findStaffByEmail(
  pool: Pool,
  email: string,
): Promise<(StaffUser & { passwordHash: string }) | undefined> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: StaffRole;
    password_hash: string;
  }>(
    `SELECT id, email, first_name, last_name, full_name, role::text AS role, password_hash
       FROM careers.staff_user
      WHERE lower(email) = $1 AND is_active = TRUE`,
    [normalized],
  );
  const row = rows[0];
  if (!row) return undefined;
  return { ...mapStaffRow(row), passwordHash: row.password_hash };
}

export async function touchStaffLastLogin(pool: Pool, userId: string): Promise<void> {
  await pool.query(`UPDATE careers.staff_user SET last_login_at = now() WHERE id = $1`, [userId]);
}

export function signStaffJwt(user: StaffUser, jwtSecret: string): string {
  const payload: AdminJwtPayload = {
    sub: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: user.role,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function verifyStaffJwt(token: string, jwtSecret: string): AdminJwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as AdminJwtPayload & { fullName?: string };
    if (!decoded?.sub || !decoded.email) return null;
    const firstName = decoded.firstName ?? decoded.fullName?.split(" ")[0] ?? "";
    const lastName =
      decoded.lastName ??
      (decoded.fullName?.includes(" ")
        ? decoded.fullName.slice(decoded.fullName.indexOf(" ") + 1)
        : "");
    const fullName = decoded.fullName ?? buildFullName(firstName, lastName);
    return {
      sub: decoded.sub,
      email: decoded.email,
      firstName,
      lastName,
      fullName,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function staffUserFromPayload(payload: AdminJwtPayload): StaffUser {
  return {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    fullName: payload.fullName,
    role: payload.role,
  };
}

export async function listStaffUsers(pool: Pool): Promise<StaffUserPublic[]> {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: StaffRole;
    is_active: boolean;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    `SELECT id, email, first_name, last_name, full_name, role::text AS role,
            is_active, created_at, last_login_at
       FROM careers.staff_user
      ORDER BY created_at DESC`,
  );
  return rows.map((row) => ({
    ...mapStaffRow(row),
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  }));
}

export async function createStaffUser(
  pool: Pool,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: StaffRole;
  },
): Promise<StaffUser> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = buildFullName(firstName, lastName);
  if (!email || !firstName || !lastName) {
    throw new Error("INVALID_INPUT");
  }
  if (!input.password || input.password.length < 4) {
    throw new Error("WEAK_PASSWORD");
  }

  const existing = await pool.query(`SELECT 1 FROM careers.staff_user WHERE lower(email) = $1`, [
    email,
  ]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hashStaffPassword(input.password);
  const role = input.role ?? "reviewer";
  const { rows } = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: StaffRole;
  }>(
    `INSERT INTO careers.staff_user (email, first_name, last_name, full_name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::staff_role, TRUE)
     RETURNING id, email, first_name, last_name, full_name, role::text AS role`,
    [email, firstName, lastName, fullName, passwordHash, role],
  );
  return mapStaffRow(rows[0]);
}

export async function upsertStaffUser(
  pool: Pool,
  input: {
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    password: string;
    role?: StaffRole;
  },
): Promise<StaffUser> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName?.trim() ?? input.fullName?.split(" ")[0]?.trim() ?? "Admin";
  const lastName =
    input.lastName?.trim() ??
    (input.fullName?.includes(" ")
      ? input.fullName.slice(input.fullName.indexOf(" ") + 1).trim()
      : "");
  const fullName = buildFullName(firstName, lastName) || input.fullName?.trim() || "Administrateur";
  const passwordHash = await hashStaffPassword(input.password);
  const role = input.role ?? "admin";
  const { rows } = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: StaffRole;
  }>(
    `INSERT INTO careers.staff_user (email, first_name, last_name, full_name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::staff_role, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       is_active = TRUE
     RETURNING id, email, first_name, last_name, full_name, role::text AS role`,
    [email, firstName, lastName, fullName, passwordHash, role],
  );
  return mapStaffRow(rows[0]);
}

export function toPublicStaffUser(user: StaffUser): {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: StaffRole;
} {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: user.role,
  };
}
