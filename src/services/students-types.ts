import type { Student } from "@/lib/types";

export interface SubmitStudentInput {
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
  /** yyyy-mm-dd */
  birthDate?: string;
  personalEmail?: string;
  careerHeadName?: string;
  acceptedTerms?: boolean;
  civilLiabilityInsurance?: string;
  studentAddress?: string;
  studentPostalCode?: string;
  studentCity?: string;
}
