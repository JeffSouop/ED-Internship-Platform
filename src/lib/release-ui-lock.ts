/**
 * Débloque la page si un overlay modal (Radix) ou le scroll-lock reste actif par erreur.
 * Utile après navigation rapide ou hydratation SSR.
 */
export function releaseUiLocks(): void {
  if (typeof document === "undefined") return;

  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
  document.documentElement.style.pointerEvents = "";
  document.documentElement.style.overflow = "";
  document.documentElement.removeAttribute("data-scroll-locked");

  const overlays = document.querySelectorAll<HTMLElement>(
    [
      "[data-radix-dialog-overlay]",
      "[data-radix-alert-dialog-overlay]",
      '[role="dialog"][data-state="closed"]',
      ".fixed.inset-0.z-50[data-state='closed']",
    ].join(","),
  );

  overlays.forEach((el) => {
    el.style.pointerEvents = "none";
    el.style.display = "none";
  });
}
