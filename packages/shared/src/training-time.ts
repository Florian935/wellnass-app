/**
 * MR-06 — temps d'entraînement (inter-piliers muscu + course). Logique pure.
 */

import { DEFICIT_ALERT_RATIO } from './bodyweight';

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

// ---------------------------------------------------------------------------
// Interférence concurrent training — divergence muscu/course (US MR-08, catalogue)
// ---------------------------------------------------------------------------

/** Sens de la divergence détectée (US MR-08, spec R2) — les deux sont mutuellement exclusifs. */
export type ConcurrentTrainingInterferenceDirection =
  | 'runningUpStrengthDown'
  | 'strengthUpRunningDown';

export type ConcurrentTrainingInterference = {
  show: boolean;
  direction: ConcurrentTrainingInterferenceDirection | null;
};

/** Ratio aigu(7j)/chronique(28j), `null` si la base chronique est nulle (même garde que `computeAcwr`). */
function acuteChronicRatio(acuteTotal: number, chronicTotal: number): number | null {
  if (chronicTotal <= 0) return null;
  const acuteAvg = acuteTotal / ACUTE_WINDOW_DAYS;
  const chronicAvg = chronicTotal / CHRONIC_WINDOW_DAYS;
  return acuteAvg / chronicAvg;
}

/**
 * Divergence muscu/course (US MR-08, spec R1/R2) : deux ratios aigu/chronique calculés
 * séparément par pilier, dans leur unité native (`volumeKg` muscu, `distanceM` course) — pas la
 * charge sRPE combinée de `computeAcwr` (ça, c'est déjà META-19). Réutilise les mêmes seuils
 * `ACWR_RISK_THRESHOLD`/`ACWR_LOW_THRESHOLD` et fenêtres 7j/28j (spec D1) : pas de nouveau chiffre.
 * `show: false` si l'un des deux piliers manque de base chronique (spec R3), ou si les deux
 * ratios évoluent dans le même sens / restent en zone saine (spec R2 — pas une divergence).
 */
export function computeConcurrentTrainingInterference(input: {
  acuteRunDistanceM: number;
  chronicRunDistanceM: number;
  acuteStrengthVolumeKg: number;
  chronicStrengthVolumeKg: number;
}): ConcurrentTrainingInterference {
  const runRatio = acuteChronicRatio(input.acuteRunDistanceM, input.chronicRunDistanceM);
  const strengthRatio = acuteChronicRatio(input.acuteStrengthVolumeKg, input.chronicStrengthVolumeKg);

  if (runRatio === null || strengthRatio === null) {
    return { show: false, direction: null };
  }
  if (runRatio > ACWR_RISK_THRESHOLD && strengthRatio < ACWR_LOW_THRESHOLD) {
    return { show: true, direction: 'runningUpStrengthDown' };
  }
  if (strengthRatio > ACWR_RISK_THRESHOLD && runRatio < ACWR_LOW_THRESHOLD) {
    return { show: true, direction: 'strengthUpRunningDown' };
  }
  return { show: false, direction: null };
}

// ---------------------------------------------------------------------------
// Garde-fou tri-pilier — charge sans repos + déficit persistant (US TRI-12, catalogue)
// ---------------------------------------------------------------------------

/** Seuil du streak « jours à charge sans repos » — aligné sur la fourchette catalogue de MR-14 (6-7 j). */
const OVERTRAINING_LOAD_STREAK_DAYS = 6;

/**
 * Nb minimum de jours (sur une fenêtre fixe de 7 j calendaires) en déficit pour un déficit
 * « persistant » (spec R3). ⚠️ Valeur numérique identique à `MIN_LOGGED_DAYS` (bodyweight.ts, MN-02)
 * mais sémantique différente (échantillon minimal pour une moyenne, pas un compte de jours en
 * déficit) — constantes volontairement séparées, ne pas les fusionner.
 */
const OVERTRAINING_DEFICIT_DAYS_REQUIRED = 4;

/**
 * Compte les jours en déficit ≥ `DEFICIT_ALERT_RATIO` parmi une liste de jours **déjà loggés**
 * (spec R3). Ne connaît aucune notion de date ou de fenêtre — l'appelant lui fournit une liste déjà
 * bornée aux 7 derniers jours calendaires, même discipline que `computeAcwr`. Renvoie un **compte
 * absolu**, jamais une proportion : un jour non loggé au milieu de la fenêtre ne compte simplement
 * pas, il n'est ni remplacé ni extrapolé.
 */
export function countDeficitDaysInWindow(
  loggedDays: ReadonlyArray<{ kcal: number }>,
  targetKcal: number,
): number {
  if (targetKcal <= 0) return 0;
  return loggedDays.filter((d) => (targetKcal - d.kcal) / targetKcal >= DEFICIT_ALERT_RATIO).length;
}

/**
 * Niveau de sévérité du garde-fou (US GARDE-01, spec R3) — deux paliers dans **une seule** carte,
 * au lieu des deux widgets concurrents de TRI-12 et MR-14.
 */
export type OvertrainingSeverity = 'streak' | 'streakAndDeficit';

/** Résultat du garde-fou unifié — `streakDays` sert le titre du niveau `streak` (spec §6). */
export type OvertrainingGuardResult = {
  show: boolean;
  severity: OvertrainingSeverity | null;
  streakDays: number;
};

/**
 * Garde-fou unifié charge & récupération (US GARDE-01, fusion de TRI-12 et MR-14).
 *
 * Reçoit les deux signaux **déjà calculés** par l'appelant (`computeStreak(...).current` pour le
 * streak, `countDeficitDaysInWindow(...)` pour le déficit) — n'agrège rien elle-même.
 *
 * ⚠️ **`show` ne dépend que du streak** (spec R2). C'est l'arbitrage de la contradiction relevée au
 * §0 de la spec : R4 de TRI-12 (« un seul des deux signaux ne suffit jamais ») est **remplacée** par
 * la position de MR-14 (le streak seul mérite une alerte). Le déficit ne décide plus de l'affichage,
 * seulement du **niveau** — ce qui rend `show` monotone et supprime le swap de carte entre les deux
 * anciens widgets.
 *
 * `deficitDaysCount` vaut 0 quand le pilier nutrition est inactif : le niveau `streakAndDeficit`
 * devient alors inatteignable **sans masquer le widget** (spec R4/D2, dégradation par composante —
 * même patron que `computeReadiness`/`useReadiness`, TRI-03 D2).
 */
export function computeOvertrainingGuard(input: {
  loadStreakDays: number;
  deficitDaysCount: number;
}): OvertrainingGuardResult {
  if (input.loadStreakDays < OVERTRAINING_LOAD_STREAK_DAYS) {
    return { show: false, severity: null, streakDays: input.loadStreakDays };
  }
  const hasPersistentDeficit = input.deficitDaysCount >= OVERTRAINING_DEFICIT_DAYS_REQUIRED;
  return {
    show: true,
    severity: hasPersistentDeficit ? 'streakAndDeficit' : 'streak',
    streakDays: input.loadStreakDays,
  };
}

// `computeLoadStreakAlert` / `LoadStreakAlert` (US MR-14) supprimées par GARDE-01 : le seuil de
// streak et le titre interpolé vivent désormais dans `computeOvertrainingGuard` (niveau `streak`),
// et la règle de masquage mutuel n'a plus d'objet — il n'y a plus qu'un widget.
