import { apiFetch, apiJson } from "@/lib/api";

export type StaffUserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type CreateStaffUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export async function listStaffUsers(): Promise<StaffUserRecord[]> {
  return apiJson<StaffUserRecord[]>("/api/admin/staff-users");
}

export async function createStaffUser(input: CreateStaffUserInput): Promise<StaffUserRecord> {
  const res = await apiFetch("/api/admin/staff-users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    throw new Error("Un compte existe déjà avec cette adresse email");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? res.statusText);
  }
  return res.json() as Promise<StaffUserRecord>;
}
