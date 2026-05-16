import { apiFetch, apiJson } from "@/lib/api";

export type RuptureGenerateResponse = {
  ok: true;
  studentId: string;
  filename: string;
  path: string;
  message: string;
  replaced?: boolean;
};

export type RuptureExistsResponse = {
  exists: boolean;
  filename?: string;
};

export type RuptureListRow = {
  studentId: string;
  studentName: string;
  companyName: string;
  generatedAt: string;
};

export type RuptureListResponse = {
  rows: RuptureListRow[];
};

export async function listRuptures(): Promise<RuptureListResponse> {
  return apiJson<RuptureListResponse>("/api/admin/ruptures");
}

export async function checkRuptureExists(studentId: string): Promise<RuptureExistsResponse> {
  return apiJson<RuptureExistsResponse>(
    `/api/admin/ruptures/exists/${encodeURIComponent(studentId)}`,
  );
}

export async function generateRupture(
  studentId: string,
  overwrite = false,
): Promise<RuptureGenerateResponse> {
  return apiJson<RuptureGenerateResponse>("/api/admin/ruptures/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, overwrite }),
  });
}

export function rupturePreviewUrl(studentId: string): string {
  return `/api/admin/ruptures/preview/${encodeURIComponent(studentId)}`;
}

export async function downloadRupture(studentId: string, filename?: string): Promise<void> {
  const res = await apiFetch(
    `/api/admin/ruptures/download/${encodeURIComponent(studentId)}`,
  );
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `rupture-${studentId}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
