import type { Intake } from "./types";

export function currentIntake(now = new Date()): Intake {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  // Feb intake: Jan-Jun ; Sep intake: Jul-Dec
  if (m <= 6) return `Feb-${y}` as Intake;
  return `Sep-${y}` as Intake;
}
