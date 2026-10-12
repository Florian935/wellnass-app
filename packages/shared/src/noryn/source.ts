/**
 * US NORYN-01 — la source : les lectures du **seul** propriétaire, avec la clé `service_role` (donc
 * sans RLS). C'est le point de sécurité principal : l'app a plusieurs utilisateurs.
 *
 * - Le propriétaire vient du secret, jamais de la requête (R5).
 * - Chaque lecture d'une table de l'utilisateur filtre sa colonne propriétaire (R6) ; le contenu lié
 *   (programmes, séances, exercices) est filtré « bibliothèque ou propriétaire » dans la requête même.
 * - **Double barrière** (R7) : une ligne d'utilisateur qui ne serait pas au propriétaire — le signe
 *   d'un filtre oublié — fait échouer toute la lecture ; rien n'est composé.
 * - Colonnes en **liste blanche** par table et par usage (R8) ; jamais `*`. Chaque synthèse ne lit
 *   que ce qu'elle sert.
 * - Un propriétaire **sans profil ni réglages** (UUID mal saisi dans le secret) est une erreur, pas
 *   un compte « jamais synchronisé » : sinon rien ne le distinguerait de l'état normal d'après déploiement.
 *
 * US NORYN-02 — **lecture en deux temps** (spec D9). D'abord ce qui décide (reçu, réglages, profil
 * minimal) ; ensuite seulement ce qui sert : les entrées des **cibles** si le téléphone a synchronisé et
 * que le pilier Nutrition est actif, celles du **verdict** si la date demandée est aujourd'hui ; les
 * pesées selon le mode (la dernière en `auto`, celle de la date et la plus ancienne en `activities`),
 * par lectures ciblées (PostgREST plafonne une lecture à 1 000 lignes, sans ordre garanti). Chaque
 * lecture reprend les filtres de la requête de l'app qu'elle remplace (R4).
 *
 * Le client est **structurel** : `supabase-js` le satisfait sans être importé ici (la coquille Deno
 * le crée), et les tests le remplacent par une fausse base qui applique vraiment les filtres.
 */

import { addDayKeys } from './paris-date';
import { activePillarsOf, bonusModeOf, type OwnerSnapshot, type ReadinessRows, type TargetRows } from './snapshot';

export interface NorynQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string | boolean): NorynQuery;
  in(column: string, values: readonly string[]): NorynQuery;
  gte(column: string, value: string): NorynQuery;
  lt(column: string, value: string): NorynQuery;
  lte(column: string, value: string): NorynQuery;
  is(column: string, value: null): NorynQuery;
  or(filters: string): NorynQuery;
  order(column: string, options: { ascending: boolean }): NorynQuery;
  limit(count: number): NorynQuery;
}

export interface NorynDbClient {
  from(table: string): { select(columns: string): NorynQuery };
}

/**
 * La liste blanche des colonnes lues par la journée et la semaine de NORYN-01, par table. Ce qui ne
 * bouge pas : **rien d'autre que le contrat ne sort** (R9, schéma strict).
 */
export const READ_COLUMNS = {
  sync_receipts: ['user_id', 'received_at'],
  user_settings: ['user_id', 'active_pillars', 'health_connect_enabled', 'wellbeing_pillar_enabled'],
  profiles: ['user_id', 'daily_step_goal'],
  nutrition_profiles: ['user_id', 'water_target_ml'],
  running_profiles: ['user_id', 'ref_5k_pace_s_per_km'],
  daily_steps: ['user_id', 'log_date', 'steps'],
  food_entries: ['user_id', 'log_date', 'kcal', 'protein_g'],
  water_entries: ['user_id', 'log_date', 'volume_ml'],
  daily_wellbeing: ['user_id', 'log_date', 'sleep_minutes', 'sleep_quality', 'energy', 'motivation', 'sick'],
  planned_sessions: ['owner_id', 'id', 'scheduled_date', 'scheduled_time', 'status', 'session_id', 'program_id'],
  sessions: ['owner_id', 'id', 'session_type', 'order_index', 'target_duration_seconds', 'target_distance_m'],
  programs: ['owner_id', 'id', 'pillar', 'status'],
  exercise_plans: ['owner_id', 'session_id', 'exercise_id', 'order_index', 'target_sets', 'rest_seconds'],
  exercises: ['owner_id', 'id', 'muscle_primary', 'status', 'deleted_at'],
  session_intervals: ['owner_id', 'session_id', 'order_index', 'reps', 'fast_distance_m', 'recovery_distance_m'],
  workouts: ['user_id', 'finished_at'],
  runs: ['user_id', 'finished_at'],
} as const;

/** La semaine ne lit du check-in que la durée de la nuit. */
export const WEEK_WELLBEING_COLUMNS = ['user_id', 'log_date', 'sleep_minutes'] as const;

/**
 * US NORYN-02 — les colonnes des **cibles** d'une date (pilier Nutrition actif). Ni `name`, ni `notes`,
 * ni charge, ni répétition : la cible n'en a pas besoin.
 */
export const TARGET_COLUMNS = {
  profiles: ['user_id', 'birth_date', 'sex', 'height_cm', 'weight_kg', 'main_goal'],
  nutrition_profiles: [
    'user_id',
    'objective',
    'activity_level',
    'manual_calories',
    'manual_protein_g',
    'manual_carbs_g',
    'manual_fat_g',
    'training_day_bonus',
    'training_bonus_mode',
    'sport_free_level',
  ],
  real_life_periods: ['user_id', 'started_on', 'ends_on'],
  body_weight_entries: ['user_id', 'log_date', 'weight_kg'],
  activities: ['user_id', 'id', 'activity_type', 'started_at', 'duration_seconds', 'intensity', 'rpe', 'distance_m', 'device_kcal'],
  workout_sets: ['user_id', 'workout_id'],
  workouts: ['user_id', 'id', 'started_at', 'finished_at', 'duration_seconds', 'rpe'],
  runs: ['user_id', 'id', 'status', 'finished_at', 'duration_seconds', 'distance_m', 'elevation_gain_m', 'rpe'],
} as const;

/** US NORYN-02 — les colonnes du **verdict** (aujourd'hui). Le stress n'est lu qu'ici. */
export const READINESS_COLUMNS = {
  workouts: ['user_id', 'finished_at', 'duration_seconds', 'rpe'],
  runs: ['user_id', 'finished_at', 'duration_seconds', 'rpe'],
  activities: ['user_id', 'started_at', 'duration_seconds', 'rpe'],
  food_entries: ['user_id', 'log_date', 'kcal'],
  daily_wellbeing: ['user_id', 'log_date', 'energy', 'stress', 'sleep_minutes', 'sleep_quality', 'sick'],
} as const;

/** Plafond de lignes d'une lecture PostgREST (`max_rows`, `supabase/config.toml`). */
export const POSTGREST_MAX_ROWS = 1000;

type Row = Record<string, unknown>;

/**
 * Une lecture impossible (`db_error`), coupée au plafond de PostgREST (`truncated`), une ligne qui
 * n'est pas au propriétaire (`foreign_row`), ou un propriétaire qui n'existe pas (`unknown_owner`).
 */
export class NorynSourceError extends Error {
  constructor(public readonly code: 'db_error' | 'truncated' | 'foreign_row' | 'unknown_owner') {
    super(`noryn: ${code}`);
    this.name = 'NorynSourceError';
  }
}

/**
 * La plage de dates lue, la synthèse qui la lit (chacune ne lit que ce qu'elle sert), et
 * « aujourd'hui » à Paris — le verdict n'est lu que pour aujourd'hui.
 */
export type NorynLoadRange = { from: string; to: string; scope: 'day' | 'week'; today: string };

export type NorynSource = { load(owner: string, range: NorynLoadRange): Promise<OwnerSnapshot> };

async function rowsOf(query: NorynQuery): Promise<Row[]> {
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new NorynSourceError('db_error');
  // Une liste au plafond est peut-être coupée : jamais de calcul sur une liste incomplète.
  if (data.length >= POSTGREST_MAX_ROWS) throw new NorynSourceError('truncated');
  return data as Row[];
}

/** R7 : chaque ligne d'une table de l'utilisateur est au propriétaire, sinon rien ne sort. */
function owned(rows: Row[], column: 'user_id' | 'owner_id', owner: string): Row[] {
  if (rows.some((row) => row[column] !== owner)) throw new NorynSourceError('foreign_row');
  return rows;
}

const ids = (rows: readonly Row[], column: string): string[] => [...new Set(rows.map((r) => r[column] as string))];

export function createNorynSource(client: NorynDbClient | null): NorynSource {
  return {
    async load(owner, range) {
      if (client === null) throw new NorynSourceError('db_error');
      const isWeek = range.scope === 'week';
      const pick = (table: string, columns: readonly string[]) => client.from(table).select(columns.join(', '));
      const mine = (table: string, columns: readonly string[], column: 'user_id' | 'owner_id' = 'user_id') =>
        pick(table, columns).eq(column, owner).is('deleted_at', null);
      const libraryOrMine = `owner_id.is.null,owner_id.eq.${owner}`;
      const byDate = (query: NorynQuery, column: string) => query.gte(column, range.from).lte(column, range.to);
      // Le jour à Paris se calcule ensuite : on lit un jour de plus de chaque côté, en UTC.
      const aroundRange = (query: NorynQuery, column: string) =>
        query.gte(column, `${addDayKeys(range.from, -1)}T00:00:00Z`).lt(column, `${addDayKeys(range.to, 2)}T00:00:00Z`);
      const finished = (table: 'workouts' | 'runs') =>
        aroundRange(mine(table, READ_COLUMNS[table]).eq('status', 'completed'), 'finished_at');
      const userRows = async (query: NorynQuery, column: 'user_id' | 'owner_id' = 'user_id') =>
        owned(await rowsOf(query), column, owner);
      const firstRow = async (query: NorynQuery) => (await userRows(query.limit(1)))[0] ?? null;
      const none = Promise.resolve([] as Row[]);

      // ── 1er temps : ce qui décide (le reçu, les réglages, l'existence du propriétaire) ──────────
      const [receipts, settings, profiles] = await Promise.all([
        userRows(pick('sync_receipts', READ_COLUMNS.sync_receipts).eq('user_id', owner)),
        userRows(mine('user_settings', READ_COLUMNS.user_settings)),
        userRows(mine('profiles', READ_COLUMNS.profiles)),
      ]);
      // Un UUID mal saisi dans le secret n'a ni profil ni réglages : ce n'est pas « jamais synchronisé ».
      if (settings.length === 0 && profiles.length === 0) throw new NorynSourceError('unknown_owner');

      const settingsRow = (settings[0] ?? null) as OwnerSnapshot['settings'];
      const synced = receipts.length > 0;
      const nutritionOn = activePillarsOf(settingsRow).includes('nutrition');
      const readTargets = !isWeek && synced && nutritionOn;
      const readReadiness = !isWeek && synced && range.from === range.today;

      // ── 2e temps : la journée ou la semaine de NORYN-01, et les entrées des cibles et du verdict ──
      const [
        nutritionProfiles,
        runningProfiles,
        steps,
        food,
        water,
        wellbeing,
        planned,
        workouts,
        runs,
        targetProfiles,
        targetNutrition,
        periods,
        targetWorkouts,
        targetRuns,
        targetActivities,
        loadWorkouts,
        loadRuns,
        loadActivities,
        readinessFood,
        readinessWellbeing,
      ] = await Promise.all([
        // Pilier Nutrition éteint : ni repas, ni eau, ni profil nutritionnel (sans effet sur la réponse).
        isWeek || !nutritionOn ? none : userRows(mine('nutrition_profiles', READ_COLUMNS.nutrition_profiles)),
        userRows(mine('running_profiles', READ_COLUMNS.running_profiles)),
        userRows(byDate(mine('daily_steps', READ_COLUMNS.daily_steps), 'log_date')),
        isWeek || !nutritionOn ? none : userRows(byDate(mine('food_entries', READ_COLUMNS.food_entries), 'log_date')),
        isWeek || !nutritionOn ? none : userRows(byDate(mine('water_entries', READ_COLUMNS.water_entries), 'log_date')),
        userRows(
          byDate(mine('daily_wellbeing', isWeek ? WEEK_WELLBEING_COLUMNS : READ_COLUMNS.daily_wellbeing), 'log_date'),
        ),
        userRows(byDate(mine('planned_sessions', READ_COLUMNS.planned_sessions, 'owner_id'), 'scheduled_date'), 'owner_id'),
        isWeek ? userRows(finished('workouts')) : none,
        isWeek ? userRows(finished('runs')) : none,
        // Les cibles de la date (spec R2, R4).
        readTargets ? userRows(mine('profiles', TARGET_COLUMNS.profiles)) : none,
        readTargets ? userRows(mine('nutrition_profiles', TARGET_COLUMNS.nutrition_profiles)) : none,
        readTargets
          ? userRows(mine('real_life_periods', TARGET_COLUMNS.real_life_periods).lte('started_on', range.from).gte('ends_on', range.from))
          : none,
        readTargets
          ? userRows(aroundRange(mine('workouts', TARGET_COLUMNS.workouts).eq('status', 'completed'), 'finished_at'))
          : none,
        // `SELECT_RUNS` : finies, tout statut — le statut sépare ensuite les terminées.
        readTargets ? userRows(aroundRange(mine('runs', TARGET_COLUMNS.runs), 'finished_at')) : none,
        readTargets ? userRows(aroundRange(mine('activities', TARGET_COLUMNS.activities), 'started_at')) : none,
        // Le verdict d'aujourd'hui (spec R3) : fenêtres de l'app, sans borne haute.
        readReadiness
          ? userRows(
              mine('workouts', READINESS_COLUMNS.workouts)
                .eq('status', 'completed')
                .gte('finished_at', `${addDayKeys(range.today, -28)}T00:00:00Z`),
            )
          : none,
        readReadiness
          ? userRows(
              mine('runs', READINESS_COLUMNS.runs)
                .eq('status', 'completed')
                .gte('finished_at', `${addDayKeys(range.today, -28)}T00:00:00Z`),
            )
          : none,
        readReadiness
          ? userRows(mine('activities', READINESS_COLUMNS.activities).gte('started_at', `${addDayKeys(range.today, -29)}T00:00:00Z`))
          : none,
        readReadiness && nutritionOn
          ? userRows(mine('food_entries', READINESS_COLUMNS.food_entries).gte('log_date', addDayKeys(range.today, -6)))
          : none,
        readReadiness
          ? userRows(mine('daily_wellbeing', READINESS_COLUMNS.daily_wellbeing).gte('log_date', addDayKeys(range.today, -2)))
          : none,
      ]);

      // ── 3e temps : le contenu lié, et ce qui dépend du mode de la cible ─────────────────────────
      const mode = bonusModeOf((targetNutrition[0] ?? null) as { training_bonus_mode: string | null } | null);
      // La dernière pesée ne sert qu'à la course du mode `auto` ; la pesée à la date et les séries, qu'à
      // la dépense du mode `activities`. Le mode `fixed` ne lit aucun poids (le socle prend le profil).
      const readLatest = readTargets && mode === 'auto';
      const readEnergy = readTargets && mode === 'activities';
      const weights = (query: NorynQuery) => query.order('log_date', { ascending: false }).order('id', { ascending: true });

      // Le contenu lié : jamais lu s'il n'y a rien à lier (pas de `in.()` vide).
      const sessionIds = ids(planned, 'session_id');
      const workoutIds = ids(targetWorkouts, 'id');
      const content = (table: keyof typeof READ_COLUMNS, column: string, values: string[], withDeleted = false) => {
        if (values.length === 0) return Promise.resolve([] as Row[]);
        const query = pick(table, READ_COLUMNS[table]).in(column, values).or(libraryOrMine);
        return rowsOf(withDeleted ? query : query.is('deleted_at', null));
      };
      const [sessions, programs, exercisePlans, intervals, latestWeight, weightAtDate, oldestWeight, workoutSets] =
        await Promise.all([
          content('sessions', 'id', sessionIds),
          content('programs', 'id', ids(planned, 'program_id')),
          content('exercise_plans', 'session_id', sessionIds),
          content('session_intervals', 'session_id', sessionIds),
          // La dernière pesée (`SELECT_LATEST_WEIGHT`), sans borne de date ; égalité de date départagée par `id` (DD9).
          readLatest ? firstRow(weights(mine('body_weight_entries', TARGET_COLUMNS.body_weight_entries))) : null,
          // `weightAtDate` : la plus récente au plus tard le jour dit, sinon la plus ancienne.
          readEnergy
            ? firstRow(weights(mine('body_weight_entries', TARGET_COLUMNS.body_weight_entries).lte('log_date', range.from)))
            : null,
          readEnergy
            ? firstRow(
                mine('body_weight_entries', TARGET_COLUMNS.body_weight_entries)
                  .order('log_date', { ascending: true })
                  .order('id', { ascending: true }),
              )
            : null,
          // Séries validées, non supprimées, échauffements compris (`SELECT_WORKOUTS`).
          readEnergy && workoutIds.length > 0
            ? userRows(mine('workout_sets', TARGET_COLUMNS.workout_sets).eq('done', true).in('workout_id', workoutIds))
            : none,
        ]);
      // Les exercices archivés de la bibliothèque descendent sur le téléphone (ADMIN-01) : pas de
      // filtre `deleted_at` ici, c'est `sessionInputsFor` qui applique celui de chaque requête de l'app.
      const exercises = await content('exercises', 'id', ids(exercisePlans, 'exercise_id'), true);

      const first = <T>(rows: Row[]) => (rows[0] ?? null) as T | null;
      const targets: TargetRows | null = readTargets
        ? ({
            date: range.from,
            profile: first(targetProfiles),
            nutritionProfile: first(targetNutrition),
            periods,
            latestWeight,
            weightAtDate,
            oldestWeight,
            workouts: targetWorkouts,
            workoutSets,
            runs: targetRuns,
            activities: targetActivities,
          } as unknown as TargetRows)
        : null;
      const readiness: ReadinessRows | null = readReadiness
        ? ({
            workouts: loadWorkouts,
            runs: loadRuns,
            activities: loadActivities,
            food: readinessFood,
            wellbeing: readinessWellbeing,
          } as unknown as ReadinessRows)
        : null;

      return {
        owner,
        receivedAt: (first<{ received_at: string }>(receipts)?.received_at ?? null) as string | null,
        settings: settingsRow,
        profile: first(profiles),
        nutritionProfile: first(nutritionProfiles),
        runningProfile: first(runningProfiles),
        steps,
        food,
        water,
        wellbeing,
        planned,
        sessions,
        programs,
        exercisePlans,
        exercises,
        intervals,
        workouts,
        runs,
        targets,
        readiness,
      } as unknown as OwnerSnapshot;
    },
  };
}
