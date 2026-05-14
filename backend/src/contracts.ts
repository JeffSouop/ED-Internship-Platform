/** Aligné sur src/lib/types.ts — réponses JSON API */

export type Intake = "Feb-2026" | "Sep-2026" | "Feb-2027" | "Sep-2027";

export type SubmissionStatus =
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "superseded";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  campus: string;
  programme: string;
  promotion: Intake;
}

export interface StudentSubmission {
  id: string;
  studentId: string;
  student: Student;
  companyName: string;
  companyCountry: string;
  companyCity?: string;
  startDate: string;
  endDate: string;
  position: string;
  missions: string;
  tutorName: string;
  tutorEmail: string;
  status: SubmissionStatus;
  reviewerComment?: string;
  submittedAt: string;
  reviewedAt?: string;
  /** Libellés campus / programme tels que saisis à l’envoi (historique). */
  campusInputLabel?: string;
  programmeInputLabel?: string;
  careerHeadName?: string;
  acceptedTerms?: boolean;
  personalEmail?: string;
  companyEmail?: string;
  companyPhone?: string;
  studentAddress?: string;
  studentPostalCode?: string;
  studentCity?: string;
  civilLiabilityInsuranceRef?: string;
}

export interface CompanyContact {
  name: string;
  email: string;
  role: string;
  phone?: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  sector: string;
  size: string;
  address: string;
  city?: string;
  postalCode?: string;
  website: string;
  tradeName?: string;
  siret?: string;
  insuranceCompany?: string;
  insurancePolicy?: string;
  contacts: CompanyContact[];
}

export interface DeclaredIntern {
  studentId: string;
  position: string;
  startDate: string;
  endDate: string;
  tutorName: string;
  tutorEmail: string;
  tutorPhone?: string;
  firstName?: string;
  lastName?: string;
  internshipType?: string;
}

export interface CompanyDeclaration {
  id: string;
  companyId: string;
  intake: Intake;
  interns: DeclaredIntern[];
  submittedAt: string;
  partnerFormExtras?: Record<string, unknown>;
}

export interface MergedInternship {
  studentId: string;
  student?: Student;
  studentSubmission?: StudentSubmission;
  company?: Company;
  declaredIntern?: DeclaredIntern;
  intake: Intake;
  status: "matched" | "student_only" | "company_only";
}

export type LinkToken = {
  token: string;
  kind: "student" | "company";
  refId?: string;
  label: string;
  createdAt: string;
};
