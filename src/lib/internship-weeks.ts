/** Nombre de semaines entre deux dates ISO (arrondi). */
export function internshipWeeksBetween(startIso: string, endIso: string): number | null {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return null;
  return Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

export function internshipWeeksLabel(startIso: string, endIso: string): string {
  const n = internshipWeeksBetween(startIso, endIso);
  if (n === null) return "—";
  return `${n} semaine${n > 1 ? "s" : ""}`;
}
