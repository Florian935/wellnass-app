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

// ---------------------------------------------------------------------------
// Garde-fou surentraînement — ACWR combiné (US META-19, catalogue)
// ---------------------------------------------------------------------------

/** Fenêtres de l'ACWR (jours calendaires fixes, spec R3 — pas des jours d'activité). */
const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;

/** Seuil de la zone de risque (spec R4) — standard sport-science (méthode de Foster). */
const ACWR_RISK_THRESHOLD = 1.3;

/**
 * Charge d'une séance (méthode session-RPE, Foster) : RPE × durée en minutes. Une séance sans
 * `rpe` ou sans `durationSeconds` contribue **zéro** (spec R1) — jamais ignorée du calcul, jamais
 * une valeur inventée qui fausserait le résultat.
 */
export function sessionLoad(session: {
  rpe: number | null;
  durationSeconds: number | null;
}): number {
  if (session.rpe == null || session.durationSeconds == null) return 0;
  return session.rpe * (session.durationSeconds / 60);
}

/** Zone qualitative du ratio ACWR (US RUN-18) — bornes inclusives côté zone saine. */
export type AcwrZone = 'low' | 'safe' | 'risk';

/** Borne basse de la zone saine (spec R5 de META-19 / R3 de RUN-18) — sous ce seuil, sous-entraînement. */
const ACWR_LOW_THRESHOLD = 0.8;

/** Résultat de l'ACWR combiné — `null` si aucune charge chronique (spec R6). */
export type AcwrResult = { ratio: number; zone: AcwrZone; showAlert: boolean };

/**
 * ACWR combiné (muscu + course) : charge aiguë (7 j) ÷ charge chronique (28 j). Les deux listes
 * de séances sont déjà filtrées par fenêtre par l'appelant (cette fonction ne connaît aucune
 * notion de date, comme `computeTrainingTime`). `null` si la charge chronique totale est nulle
 * (spec R6 — pas de division par une base vide, pas de `NaN`/`Infinity`).
 *
 * `showAlert` est `true` **uniquement** au-dessus du seuil de risque (spec R4) — jamais pour un
 * ratio bas (spec R5) : une charge basse signale un sous-entraînement, pas un risque de surcharge,
 * et ce garde-fou ne suggère un repos que dans un seul sens. `zone` (US RUN-18) qualifie le ratio
 * dans les trois cas, bornes inclusives côté zone saine (0,8 et 1,3 comptent comme « saine »).
 */
export function computeAcwr(input: {
  acuteSessions: ReadonlyArray<{ rpe: number | null; durationSeconds: number | null }>;
  chronicSessions: ReadonlyArray<{ rpe: number | null; durationSeconds: number | null }>;
}): AcwrResult | null {
  const chronicTotal = input.chronicSessions.reduce((sum, s) => sum + sessionLoad(s), 0);
  if (chronicTotal <= 0) return null;

  const acuteTotal = input.acuteSessions.reduce((sum, s) => sum + sessionLoad(s), 0);
  const acuteAvg = acuteTotal / ACUTE_WINDOW_DAYS;
  const chronicAvg = chronicTotal / CHRONIC_WINDOW_DAYS;
  const ratio = acuteAvg / chronicAvg;

  const zone: AcwrZone =
    ratio < ACWR_LOW_THRESHOLD ? 'low' : ratio > ACWR_RISK_THRESHOLD ? 'risk' : 'safe';

  return { ratio, zone, showAlert: ratio > ACWR_RISK_THRESHOLD };
}
