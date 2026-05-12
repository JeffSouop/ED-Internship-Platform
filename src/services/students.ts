import type { Student, StudentSubmission, SubmissionStatus } from "@/lib/types";
import { apiJson, apiJsonOptional } from "@/lib/api";
import type { SubmitStudentInput } from "./students-types";

export type { SubmitStudentInput } from "./students-types";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function listStudents(): Promise<Student[]> {
  await delay();
  return apiJson<Student[]>("/api/students");
}

export async function getStudent(id: string): Promise<Student | undefined> {
  await delay();
  return apiJsonOptional<Student>(`/api/students/${encodeURIComponent(id)}`);
}

export async function listSubmissions(): Promise<StudentSubmission[]> {
  await delay();
  return apiJson<StudentSubmission[]>("/api/submissions");
}

export async function getSubmissionByStudent(
  studentId: string,
): Promise<StudentSubmission | undefined> {
  await delay();
  return apiJsonOptional<StudentSubmission>(
    `/api/submissions/by-student/${encodeURIComponent(studentId)}`,
  );
}

export async function getSubmission(id: string): Promise<StudentSubmission | undefined> {
  await delay();
  return apiJsonOptional<StudentSubmission>(`/api/submissions/${encodeURIComponent(id)}`);
}

export async function upsertStudentSubmission(input: SubmitStudentInput): Promise<StudentSubmission> {
  await delay();
  return apiJson<StudentSubmission>("/api/submissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reviewSubmission(
  id: string,
  decision: { status: Exclude<SubmissionStatus, "pending">; comment?: string },
): Promise<StudentSubmission> {
  await delay();
  return apiJson<StudentSubmission>(`/api/submissions/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify({ status: decision.status, comment: decision.comment }),
  });
}
