import type {
  Company,
  CompanyDeclaration,
  LinkToken,
  Student,
  StudentSubmission,
} from "@/lib/types";

export const seedStudents: Student[] = [
  {
    id: "STU-2026-001",
    firstName: "Camille",
    lastName: "Dubois",
    email: "camille.dubois@ecoleducasse.com",
    phone: "+33 6 12 34 56 78",
    campus: "Paris",
    programme: "Bachelor in Culinary Arts",
    promotion: "Feb-2026",
  },
  {
    id: "STU-2026-002",
    firstName: "Lucas",
    lastName: "Martin",
    email: "lucas.martin@ecoleducasse.com",
    campus: "Yssingeaux",
    programme: "Bachelor in Pastry Arts",
    promotion: "Feb-2026",
  },
  {
    id: "STU-2026-003",
    firstName: "Sofia",
    lastName: "Rossi",
    email: "sofia.rossi@ecoleducasse.com",
    campus: "Paris",
    programme: "MBA in Hospitality Management",
    promotion: "Sep-2026",
  },
  {
    id: "STU-2026-004",
    firstName: "James",
    lastName: "Okafor",
    email: "james.okafor@ecoleducasse.com",
    campus: "Paris",
    programme: "Bachelor in Culinary Arts",
    promotion: "Sep-2026",
  },
  {
    id: "STU-2026-005",
    firstName: "Emma",
    lastName: "Lefevre",
    email: "emma.lefevre@ecoleducasse.com",
    campus: "Yssingeaux",
    programme: "Bachelor in Pastry Arts",
    promotion: "Feb-2026",
  },
];

export const seedCompanies: Company[] = [
  {
    id: "CMP-001",
    name: "Le Meurice",
    country: "France",
    sector: "Hôtellerie de luxe",
    size: "250-500",
    address: "228 Rue de Rivoli, 75001 Paris",
    website: "https://www.dorchestercollection.com/le-meurice",
    contacts: [
      { name: "Marie Lambert", email: "rh@lemeurice.fr", role: "RH Stages" },
    ],
  },
  {
    id: "CMP-002",
    name: "Pierre Hermé Paris",
    country: "France",
    sector: "Pâtisserie",
    size: "100-250",
    address: "72 Rue Bonaparte, 75006 Paris",
    website: "https://www.pierreherme.com",
    contacts: [
      { name: "Antoine Garnier", email: "stages@pierreherme.com", role: "Chef de production" },
    ],
  },
  {
    id: "CMP-003",
    name: "The Connaught",
    country: "United Kingdom",
    sector: "Hôtellerie de luxe",
    size: "250-500",
    address: "Carlos Place, Mayfair, London W1K 2AL",
    website: "https://www.the-connaught.co.uk",
    contacts: [
      { name: "Olivia Brown", email: "careers@the-connaught.co.uk", role: "HR Manager" },
    ],
  },
];

export const seedSubmissions: StudentSubmission[] = [
  {
    id: "SUB-001",
    studentId: "STU-2026-001",
    student: seedStudents[0],
    companyName: "Le Meurice",
    companyCountry: "France",
    startDate: "2026-02-15",
    endDate: "2026-08-15",
    position: "Commis de cuisine",
    missions:
      "Participation au service du restaurant gastronomique, mise en place, dressage des assiettes.",
    tutorName: "Chef Alain Roux",
    tutorEmail: "a.roux@lemeurice.fr",
    status: "pending",
    submittedAt: "2026-01-10T09:30:00.000Z",
  },
  {
    id: "SUB-002",
    studentId: "STU-2026-002",
    student: seedStudents[1],
    companyName: "Pierre Hermé Paris",
    companyCountry: "France",
    startDate: "2026-02-01",
    endDate: "2026-07-31",
    position: "Apprenti pâtissier",
    missions: "Production des macarons, tartes saisonnières, gestion des matières premières.",
    tutorName: "Antoine Garnier",
    tutorEmail: "stages@pierreherme.com",
    status: "approved",
    reviewedAt: "2026-01-12T14:20:00.000Z",
    submittedAt: "2026-01-08T16:45:00.000Z",
  },
];

export const seedDeclarations: CompanyDeclaration[] = [
  {
    id: "DEC-001",
    companyId: "CMP-002",
    intake: "Feb-2026",
    interns: [
      {
        studentId: "STU-2026-002",
        position: "Apprenti pâtissier",
        startDate: "2026-02-01",
        endDate: "2026-07-31",
        tutorName: "Antoine Garnier",
        tutorEmail: "stages@pierreherme.com",
      },
    ],
    submittedAt: "2026-01-09T10:00:00.000Z",
  },
];

export const seedTokens: LinkToken[] = [
  {
    token: "demo-student-camille",
    kind: "student",
    refId: "STU-2026-001",
    label: "Camille Dubois (démo)",
    createdAt: new Date().toISOString(),
  },
  {
    token: "demo-student-james",
    kind: "student",
    refId: "STU-2026-004",
    label: "James Okafor (démo)",
    createdAt: new Date().toISOString(),
  },
  {
    token: "demo-company-meurice",
    kind: "company",
    refId: "CMP-001",
    label: "Le Meurice (démo)",
    createdAt: new Date().toISOString(),
  },
  {
    token: "demo-company-new",
    kind: "company",
    label: "Nouvelle entreprise (démo)",
    createdAt: new Date().toISOString(),
  },
];
