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
 * **Simplification assumée pour la V1** (spec §8, hors périmètre) : « séance du jour » ne distingue
 * pas une séance déjà en cours (`useActiveWorkout`) ni les replis riches de `useTodaySession` (déjà
 * faite / prochaine à venir) — seulement « prévue aujourd'hui » ou « repos ».
 *
 * US CIBLE-01 (D8-A) — « kcal restantes » n'est plus une simplification : c'est la cible
 * **d'Aujourd'hui** (bonus du jour compris, socle selon le mode, poids du profil) moins le mangé, par les
 * mêmes compositions et **les mêmes requêtes** que les hooks. Elle était calculée ici à part, sur la base
 * `tdee` quel que soit le mode et au poids de la dernière pesée, sans bonus : elle sur-estimait le restant
 * en mode « Selon ce que tu fais », et le sous-estimait les jours de séance.
 */

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { toActivity, SELECT_ACTIVITIES, type ActivityDbRow } from '@/data/repositories/activity-repository';
import { getLatestWeightKg, SELECT_WEIGHT_ENTRIES } from '@/data/repositories/bodyweight-repository';
import { SELECT_PLANNED_DAYS_BETWEEN, SELECT_RUN_HISTORY } from '@/data/repositories/day-target-sql';
import { SELECT_RUNS, SELECT_WORKOUTS, type RunRow, type WorkoutRow } from '@/data/repositories/energy-repository';
import { SELECT_PERIODS, toPeriod, type PeriodRow } from '@/data/repositories/real-life-repository';
import {
  activeDayKeys,
  activityLevelSchema,
  composeCalorieTargetsForDays,
  computeStreakWithJokers,
  dayEnergyTotals,
  energyItemsByDay,
  goalSchema,
  isGoalReached,
  isPillarArray,
  localDateFromDayKey,
  localDayKey,
  localDayKeyOf,
  localMidnightDaysAgo,
  normalizeStepGoal,
  nutritionObjectiveSchema,
  parseJsonColumn,
  realLifeDayKeys,
  resolveActivePillars,
  sexSchema,
  sportFreeLevelSchema,
  trainingBonusModeSchema,
  type DayActivity,
  type Pillar,
} from '@wellness/shared';

const STREAK_WINDOW_DAYS = 30;

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

  const [workouts, runs, foodTotals, stepRows, profileRow, jokerRows, periodRows] = await Promise.all([
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
    // US VIE-01 : les périodes « vie réelle ». Lues en SQL direct comme tout le reste de ce fichier —
    // le widget tourne en Headless JS, donc aucun hook n'est disponible ici.
    powerSync.getAll<{ id: string; started_on: string; ends_on: string }>(
      `SELECT id, started_on, ends_on FROM real_life_periods WHERE deleted_at IS NULL`,
    ),
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
  // US VIE-01 (R5) : mêmes jours en pause que l'app. Sans ça, le widget du launcher afficherait une
  // série à 0 pendant que l'écran d'accueil en affiche 12 — deux surfaces qui se contredisent.
  const pausedDays = realLifeDayKeys(
    periodRows.map((r) => ({ id: r.id, startedOn: r.started_on, endsOn: r.ends_on })),
  );
  return computeStreakWithJokers(activeDays, jokerDays, todayKey, pausedDays).current;
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
// Kcal restantes — la cible d'Aujourd'hui moins le mangé (US CIBLE-01, D8-A)
// ---------------------------------------------------------------------------

/** Une ligne de `SELECT_RUN_HISTORY` : ce que la cible en lit. */
type CompletedRunRow = { finished_at: string | null; distance_m: number | null; duration_seconds: number | null };

/**
 * Le « Restant » : la cible effective d'aujourd'hui — **celle d'Aujourd'hui et de Noryn** — moins le
 * mangé du jour. Les lectures sont celles des hooks (`useCalorieTargetsForDays`, `useEnergyItemsByDay`),
 * par leurs constantes SQL et leurs lecteurs de lignes, importés : séances terminées, courses terminées,
 * autres activités, séance planifiée du jour, dernière pesée, périodes « vie réelle » ; en mode « Selon ce
 * que tu fais », aussi toutes les courses finies et les pesées, pour la dépense du jour. Puis la même
 * composition (`composeCalorieTargetsForDays`, pour un jour). Seuls le profil, le profil nutritionnel et
 * les repas du jour restent des lectures propres au widget (avec son décodage des énumérations).
 */
async function computeKcalRemainingMetric(
  activePillars: Pillar[],
  todayKey: string,
): Promise<number | null> {
  if (!activePillars.includes('nutrition')) return null; // D6

  const userId = useAuthStore.getState().session?.user.id ?? '';
  const [profileRow, nutritionRow, latestWeight, todayTotal, periodRows, workoutRows, runRows, activityRows, plannedRows] =
    await Promise.all([
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
        training_day_bonus: number | null;
        training_bonus_mode: string | null;
        sport_free_level: string | null;
      }>(
        `SELECT objective, activity_level, manual_calories, training_day_bonus, training_bonus_mode, sport_free_level
         FROM nutrition_profiles WHERE deleted_at IS NULL LIMIT 1`,
      ),
      getLatestWeightKg(),
      powerSync.getOptional<{ kcal: number }>(
        `SELECT SUM(kcal) AS kcal FROM food_entries WHERE deleted_at IS NULL AND log_date = ?`,
        [todayKey],
      ),
      // Les mêmes requêtes que les hooks de la cible : jamais réécrites ici (spec CIBLE-01 R6).
      powerSync.getAll<PeriodRow>(SELECT_PERIODS),
      powerSync.getAll<WorkoutRow>(SELECT_WORKOUTS),
      powerSync.getAll<CompletedRunRow>(SELECT_RUN_HISTORY),
      powerSync.getAll<ActivityDbRow>(SELECT_ACTIVITIES),
      powerSync.getAll<{ scheduled_date: string }>(SELECT_PLANNED_DAYS_BETWEEN, [userId, todayKey, todayKey]),
    ]);

  const profile = {
    sex: sexSchema.catch('unspecified').parse(profileRow?.sex),
    weightKg: profileRow?.weight_kg ?? null,
    heightCm: profileRow?.height_cm ?? null,
    birthDate: profileRow?.birth_date ?? null,
    mainGoal: goalSchema.nullable().catch(null).parse(profileRow?.main_goal ?? null),
  };
  const nutritionProfile = nutritionRow
    ? {
        objective: nutritionObjectiveSchema.nullable().catch(null).parse(nutritionRow.objective),
        activityLevel: activityLevelSchema.nullable().catch(null).parse(nutritionRow.activity_level),
        manualCalories: nutritionRow.manual_calories,
        trainingDayBonus: nutritionRow.training_day_bonus,
        trainingBonusMode: trainingBonusModeSchema.nullable().catch(null).parse(nutritionRow.training_bonus_mode),
        sportFreeLevel: sportFreeLevelSchema.nullable().catch(null).parse(nutritionRow.sport_free_level),
      }
    : null;
  const activities = activityRows.map(toActivity);
  const at = localDateFromDayKey(todayKey);

  // La dépense du jour (bas des fourchettes) : seulement en mode « Selon ce que tu fais », le seul qui la
  // retienne (`dayCalorieBonus` l'ignore ailleurs) — ses lectures ne se font que dans ce mode.
  let energyKcalToday = 0;
  if (nutritionProfile?.trainingBonusMode === 'activities') {
    const [finishedRuns, weightRows] = await Promise.all([
      powerSync.getAll<RunRow>(SELECT_RUNS),
      powerSync.getAll<{ log_date: string; weight_kg: number }>(SELECT_WEIGHT_ENTRIES),
    ]);
    const items = energyItemsByDay({
      profile,
      weightEntries: weightRows.map((w) => ({ logDate: w.log_date, weightKg: w.weight_kg })),
      workouts: workoutRows.map((w) => ({
        id: w.id,
        startedAt: w.started_at,
        finishedAt: w.finished_at,
        durationSeconds: w.duration_seconds,
        rpe: w.rpe,
        totalSets: w.total_sets,
      })),
      finishedRuns: finishedRuns.map((r) => ({
        id: r.id,
        finishedAt: r.finished_at,
        distanceM: r.distance_m,
        durationSeconds: r.duration_seconds,
        elevationGainM: r.elevation_gain_m,
        rpe: r.rpe,
      })),
      activities,
      dayKeyOf: localDayKeyOf,
      at,
    }).get(todayKey);
    energyKcalToday = dayEnergyTotals(items ?? []).targetKcal;
  }

  const today = composeCalorieTargetsForDays({
    dayKeys: [todayKey],
    todayKey,
    profile,
    nutritionProfile,
    latestWeightKg: latestWeight,
    activePillars,
    realLifePeriods: periodRows.map(toPeriod),
    workouts: workoutRows.map((w) => ({ finishedAt: w.finished_at })),
    completedRuns: runRows.map((r) => ({
      finishedAt: r.finished_at,
      distanceM: r.distance_m,
      durationSeconds: r.duration_seconds,
    })),
    activities,
    plannedDayKeys: new Set(plannedRows.map((r) => r.scheduled_date)),
    energyKcalByDay: new Map([[todayKey, energyKcalToday]]),
    dayKeyOf: localDayKeyOf,
    at,
  }).get(todayKey);

  if (today?.effectiveTarget == null) return null;
  const consumed = todayTotal?.kcal ?? 0;
  return today.effectiveTarget - consumed;
}
