/**
 * US LAUNCHER-01 — orchestration des données du widget d'écran d'accueil, hors contexte React.
 *
 * ⚠️ Ce module ne réutilise AUCUN hook (`useTodaySession`, `useStreakData`,
 * `useNutritionSummary`...) : la tâche de fond `react-native-android-widget` (D2/D3 de la spec)
 * peut s'exécuter sans qu'aucun arbre React ne soit monté (widget ajouté au home screen, alarme
 * périodique, tap sur le widget) — même contrainte déjà documentée pour la tâche de fond GPS, voir
 * `@/running/tracker-task`. Les requêtes SQL sont donc réécrites ici, mais la logique métier
 * (streak, calcul calorique) reste déléguée aux **mêmes fonctions pures** de `@wellness/shared`
 * que les hooks — jamais dupliquée avec un risque de divergence.
 *
 * **Simplifications assumées pour la V1** (spec §8, hors périmètre) :
 *  - « séance du jour » ne distingue pas une séance déjà en cours (`useActiveWorkout`) ni les
 *    replis riches de `useTodaySession` (déjà faite / prochaine à venir) — seulement « prévue
 *    aujourd'hui » ou « repos ».
 *  - « kcal restantes » utilise l'objectif de **base** (TDEE + objectif), sans le bonus jour
 *    d'entraînement de `useDayCalorieTarget` — un sous-estimé les jours de séance, jamais un
 *    sur-estimé.
 */

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getLatestWeightKg } from '@/data/repositories/bodyweight-repository';
import {
  activeDayKeys,
  activityLevelSchema,
  computeAge,
  computeStreakWithJokers,
  goalSchema,
  isGoalReached,
  localDayKey,
  localMidnightDaysAgo,
  normalizeStepGoal,
  nutritionObjectiveSchema,
  objectiveFromGoal,
  parseJsonColumn,
  PILLARS,
  resolveActivePillars,
  sexSchema,
  targetCalories,
  tdee,
  type DayActivity,
  type Pillar,
} from '@wellness/shared';

const STREAK_WINDOW_DAYS = 30;

const isPillarArray = (value: unknown): value is Pillar[] =>
  Array.isArray(value) && value.every((p) => (PILLARS as readonly string[]).includes(p as string));

export type TodaySessionSummary =
  | { kind: 'session'; pillar: 'strength' | 'running'; name: string }
  | { kind: 'rest' };

export type HomeWidgetSnapshot = {
  authState: 'ready' | 'no-session';
  /** Nombre de jours actifs consécutifs (0 si `authState === 'no-session'`). */
  streak: number;
  /** `null` = ni musculation ni course actives (D6) — jamais affiché, pas juste masqué à vide. */
  todaySession: TodaySessionSummary | null;
  /** `null` = nutrition inactive (D6) ou profil incomplet (poids/taille/âge manquants). */
  kcalRemaining: number | null;
};

const NO_SESSION_SNAPSHOT: HomeWidgetSnapshot = {
  authState: 'no-session',
  streak: 0,
  todaySession: null,
  kcalRemaining: null,
};

/**
 * Calcule l'instantané affiché par le widget. Ne lève jamais : une session absente ou un profil
 * incomplet produisent un champ `null`/un état de repli, jamais une exception (D10).
 */
export async function computeHomeWidgetSnapshot(): Promise<HomeWidgetSnapshot> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) return NO_SESSION_SNAPSHOT;

  const todayKey = localDayKey(new Date());

  const settingsRow = await powerSync.getOptional<{ active_pillars: string | null }>(
    `SELECT active_pillars FROM user_settings WHERE deleted_at IS NULL LIMIT 1`,
  );
  const activePillars = resolveActivePillars(
    parseJsonColumn<Pillar[] | null>(settingsRow?.active_pillars ?? null, null, isPillarArray),
  );

  const [streak, todaySession, kcalRemaining] = await Promise.all([
    computeStreakMetric(todayKey),
    computeTodaySessionMetric(activePillars, todayKey),
    computeKcalRemainingMetric(activePillars, todayKey),
  ]);

  return { authState: 'ready', streak, todaySession, kcalRemaining };
}

// ---------------------------------------------------------------------------
// Streak — mêmes fonctions pures que useStreakData (dashboard-repository.ts)
// ---------------------------------------------------------------------------

async function computeStreakMetric(todayKey: string): Promise<number> {
  const sinceUtc = localMidnightDaysAgo(STREAK_WINDOW_DAYS, new Date()).toISOString();
  const sinceKey = localDayKey(localMidnightDaysAgo(STREAK_WINDOW_DAYS, new Date()));

  const [workouts, runs, foodTotals, stepRows, profileRow, jokerRows] = await Promise.all([
    powerSync.getAll<{ finished_at: string | null }>(
      `SELECT finished_at FROM workouts WHERE status = 'completed' AND deleted_at IS NULL AND finished_at >= ?`,
      [sinceUtc],
    ),
    powerSync.getAll<{ finished_at: string | null }>(
      `SELECT finished_at FROM runs WHERE status = 'completed' AND deleted_at IS NULL AND finished_at >= ?`,
      [sinceUtc],
    ),
    powerSync.getAll<{ log_date: string; kcal: number }>(
      `SELECT log_date, SUM(kcal) AS kcal FROM food_entries WHERE deleted_at IS NULL AND log_date >= ? GROUP BY log_date`,
      [sinceKey],
    ),
    powerSync.getAll<{ log_date: string; steps: number }>(
      `SELECT log_date, steps FROM daily_steps WHERE deleted_at IS NULL AND log_date >= ?`,
      [sinceKey],
    ),
    powerSync.getOptional<{ daily_step_goal: number | null }>(
      `SELECT daily_step_goal FROM profiles WHERE deleted_at IS NULL LIMIT 1`,
    ),
    powerSync.getAll<{ log_date: string }>(`SELECT log_date FROM streak_jokers WHERE deleted_at IS NULL`),
  ]);

  const stepGoal = normalizeStepGoal(profileRow?.daily_step_goal ?? null);
  const activities = new Map<string, DayActivity>();
  const touch = (day: string): DayActivity => {
    let entry = activities.get(day);
    if (!entry) {
      entry = { day, strength: false, running: false, nutrition: false };
      activities.set(day, entry);
    }
    return entry;
  };

  for (const w of workouts) {
    if (w.finished_at) touch(localDayKey(new Date(w.finished_at))).strength = true;
  }
  for (const r of runs) {
    if (r.finished_at) touch(localDayKey(new Date(r.finished_at))).running = true;
  }
  for (const t of foodTotals) {
    if (t.kcal > 0) touch(t.log_date).nutrition = true;
  }
  for (const row of stepRows) {
    if (isGoalReached(row.steps, stepGoal)) touch(row.log_date).steps = true;
  }

  const activeDays = activeDayKeys([...activities.values()]);
  const jokerDays = new Set(jokerRows.map((r) => r.log_date));
  return computeStreakWithJokers(activeDays, jokerDays, todayKey).current;
}

// ---------------------------------------------------------------------------
// Séance du jour — priorité musculation > running (spec §3, même ordre que CLAUDE.md/ACTIV-01)
// ---------------------------------------------------------------------------

const TODAY_SESSION_QUERY = `
  SELECT s.name AS session_name
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = ? AND ps.scheduled_date = ?
        AND ps.status = 'planned'
  ORDER BY s.order_index
  LIMIT 1
`;

async function computeTodaySessionMetric(
  activePillars: Pillar[],
  todayKey: string,
): Promise<TodaySessionSummary | null> {
  const userId = useAuthStore.getState().session?.user.id ?? '';
  const candidatePillars: ('strength' | 'running')[] = (['strength', 'running'] as const).filter(
    (p) => activePillars.includes(p),
  );
  if (candidatePillars.length === 0) return null; // D6 : ni musculation ni course actives

  for (const pillar of candidatePillars) {
    const row = await powerSync.getOptional<{ session_name: string | null }>(TODAY_SESSION_QUERY, [
      userId,
      pillar,
      todayKey,
    ]);
    if (row) return { kind: 'session', pillar, name: row.session_name ?? '' };
  }
  return { kind: 'rest' };
}

// ---------------------------------------------------------------------------
// Kcal restantes — objectif de base (TDEE + objectif), sans le bonus jour d'entraînement (§8)
// ---------------------------------------------------------------------------

async function computeKcalRemainingMetric(
  activePillars: Pillar[],
  todayKey: string,
): Promise<number | null> {
  if (!activePillars.includes('nutrition')) return null; // D6

  const [profileRow, nutritionRow, latestWeight, todayTotal] = await Promise.all([
    powerSync.getOptional<{
      sex: string | null;
      height_cm: number | null;
      weight_kg: number | null;
      birth_date: string | null;
      main_goal: string | null;
    }>(`SELECT sex, height_cm, weight_kg, birth_date, main_goal FROM profiles WHERE deleted_at IS NULL LIMIT 1`),
    powerSync.getOptional<{
      objective: string | null;
      activity_level: string | null;
      manual_calories: number | null;
    }>(
      `SELECT objective, activity_level, manual_calories FROM nutrition_profiles WHERE deleted_at IS NULL LIMIT 1`,
    ),
    getLatestWeightKg(),
    powerSync.getOptional<{ kcal: number }>(
      `SELECT SUM(kcal) AS kcal FROM food_entries WHERE deleted_at IS NULL AND log_date = ?`,
      [todayKey],
    ),
  ]);

  const weightKg = latestWeight ?? profileRow?.weight_kg ?? undefined;
  const age = profileRow?.birth_date ? computeAge(new Date(profileRow.birth_date)) : undefined;
  const sex = sexSchema.catch('unspecified').parse(profileRow?.sex);
  const activityLevel = activityLevelSchema.catch('moderate').parse(nutritionRow?.activity_level);
  const tdeeValue = tdee({
    sex,
    weightKg: weightKg ?? undefined,
    heightCm: profileRow?.height_cm ?? undefined,
    age,
    activityLevel,
  });

  const mainGoal = goalSchema.nullable().catch(null).parse(profileRow?.main_goal ?? null);
  const objective = nutritionObjectiveSchema.nullable().catch(null).parse(nutritionRow?.objective)
    ?? objectiveFromGoal(mainGoal);
  if (tdeeValue == null) return null;

  const target = targetCalories(tdeeValue, objective, nutritionRow?.manual_calories ?? null);
  const consumed = todayTotal?.kcal ?? 0;
  return target - consumed;
}
