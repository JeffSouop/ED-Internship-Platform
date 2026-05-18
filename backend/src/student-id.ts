/** Numéro étudiant École Ducasse : 7 chiffres, sans lettres ni caractères spéciaux. */
export const STUDENT_ID_REGEX = /^\d{7}$/;

export function normalizeStudentId(raw: string): string {
  return String(raw ?? "").trim();
}

export function validateStudentId(raw: string): string | null {
  const id = normalizeStudentId(raw);
  if (!id) return "Numéro étudiant requis.";
  if (STUDENT_ID_REGEX.test(id)) return null;
  return "Le numéro étudiant doit comporter exactement 7 chiffres (chiffres uniquement, sans lettres ni caractères spéciaux).";
}
