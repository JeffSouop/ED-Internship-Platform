import { apiJson } from "@/lib/api";

/** Une ligne = un enregistrement `student_submission` (envoi formulaire étudiant). */
export interface FormResponseRow {
  id: string;
  studentId: string;
  submittedAt: string;
  status: string;
  record: {
    companyName: string;
    companyCountry?: string;
    companyCity?: string;
    position: string;
    missions: string;
    startDate: string;
    endDate: string;
    tutorName: string;
    tutorEmail: string;
    campusInputLabel?: string;
    programmeInputLabel?: string;
    careerHeadName?: string;
    acceptedTerms: boolean;
    personalEmail?: string;
    companyEmail?: string;
    companyPhone?: string;
    studentAddress?: string;
    studentPostalCode?: string;
    studentCity?: string;
    civilLiabilityInsuranceRef?: string;
  };
}

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));

export async function listFormResponses(limit = 150): Promise<FormResponseRow[]> {
  await delay();
  return apiJson<FormResponseRow[]>(
    `/api/admin/form-responses?limit=${encodeURIComponent(String(limit))}`,
  );
}
