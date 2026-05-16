const STORAGE_KEY = "ed-form-access-granted";

/** Mot de passe d’accès aux formulaires publics (étudiant / entreprise). */
export const FORM_ACCESS_PASSWORD =
  import.meta.env.VITE_FORM_ACCESS_PASSWORD?.trim() || "ducasse2026";

export function isFormAccessGranted(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function grantFormAccess(): void {
  window.sessionStorage.setItem(STORAGE_KEY, "1");
}

export function checkFormAccessPassword(password: string): boolean {
  return password.trim() === FORM_ACCESS_PASSWORD;
}
