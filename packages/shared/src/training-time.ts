/**
 * MR-06 — temps d'entraînement (inter-piliers muscu + course). Logique pure.
 */

/** Normalise une durée en secondes ≥ 0 (NaN / négatif / ∞ → 0). */
function safeSeconds(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Agrège les durées muscu + course en total + ventilation (toutes ≥ 0). */
export function computeTrainingTime(input: {
  strengthSeconds: number;
  runningSeconds: number;
}): { totalSeconds: number; strengthSeconds: number; runningSeconds: number } {
  const strengthSeconds = safeSeconds(input.strengthSeconds);
  const runningSeconds = safeSeconds(input.runningSeconds);
  return { totalSeconds: strengthSeconds + runningSeconds, strengthSeconds, runningSeconds };
}

/** Formate des secondes en « Xh YY » (minutes plancher, zéro-paddées sur 2 chiffres). */
export function formatHoursMinutes(totalSeconds: number): string {
  const s = safeSeconds(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}`;
}
