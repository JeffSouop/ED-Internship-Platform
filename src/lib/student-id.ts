/** Numéro étudiant École Ducasse : 7 chiffres, sans lettres ni caractères spéciaux. */
export const STUDENT_ID_REGEX = /^\d{7}$/;

export function normalizeStudentId(raw: string): string {
  return raw.trim();
}

export function getStudentIdValidationError(raw: string): string | undefined {
  const id = normalizeStudentId(raw);
  if (!id) return undefined;
  if (STUDENT_ID_REGEX.test(id)) return undefined;
  return "Le numéro étudiant doit comporter exactement 7 chiffres (chiffres uniquement, sans lettres ni caractères spéciaux). / The student ID must be exactly 7 digits (numbers only, no letters or special characters).";
}

export function isValidStudentId(raw: string): boolean {
  return STUDENT_ID_REGEX.test(normalizeStudentId(raw));
}
