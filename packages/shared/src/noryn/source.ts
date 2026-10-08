/**
 * US NORYN-01 — la source : les lectures du **seul** propriétaire, avec la clé `service_role` (donc
 * sans RLS). C'est le point de sécurité principal : l'app a plusieurs utilisateurs.
 *
 * - Le propriétaire vient du secret, jamais de la requête (R5).
 * - Chaque lecture d'une table de l'utilisateur filtre sa colonne propriétaire (R6) ; le contenu lié
 *   (programmes, séances, exercices) est filtré « bibliothèque ou propriétaire » dans la requête même.
 * - **Double barrière** (R7) : une ligne d'utilisateur qui ne serait pas au propriétaire — le signe
 *   d'un filtre oublié — fait échouer toute la lecture ; rien n'est composé.
 * - Colonnes en **liste blanche** par table (R8) ; jamais `*`. Et chaque synthèse ne lit que ce qu'elle
 *   sert : la semaine ne lit ni repas, ni eau, et du check-in la seule durée de la nuit.
 * - Un propriétaire **sans profil ni réglages** (UUID mal saisi dans le secret) est une erreur, pas
 *   un compte « jamais synchronisé » : sinon rien ne le distinguerait de l'état normal d'après déploiement.
 *
 * Le client est **structurel** : `supabase-js` le satisfait sans être importé ici (la coquille Deno
 * le crée), et les tests le remplacent par une fausse base qui applique vraiment les filtres.
 */

import { addDayKeys } from './paris-date';
import type { OwnerSnapshot } from './snapshot';

export interface NorynQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string | boolean): NorynQuery;
  in(column: string, values: readonly string[]): NorynQuery;
  gte(column: string, value: string): NorynQuery;
  lt(column: string, value: string): NorynQuery;
  lte(column: string, value: string): NorynQuery;
  is(column: string, value: null): NorynQuery;
  or(filters: string): NorynQuery;
}

export interface NorynDbClient {
  from(table: string): { select(columns: string): NorynQuery };
}

/**
 * La liste blanche des colonnes lues, par table. NORYN-02 l'élargira (le stress et le poids entrent
 * dans le verdict et les cibles) : ce qui ne bouge pas, c'est que **rien d'autre que le contrat ne
 * sort** (R9, schéma strict).
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

type Table = keyof typeof READ_COLUMNS;
type Row = Record<string, unknown>;

/**
 * Une lecture impossible (`db_error`), une ligne qui n'est pas au propriétaire (`foreign_row`), ou un
 * propriétaire qui n'existe pas (`unknown_owner`).
 */
export class NorynSourceError extends Error {
  constructor(public readonly code: 'db_error' | 'foreign_row' | 'unknown_owner') {
    super(`noryn: ${code}`);
    this.name = 'NorynSourceError';
  }
}

/** La plage de dates lue, et la synthèse qui la lit (chacune ne lit que ce qu'elle sert). */
export type NorynLoadRange = { from: string; to: string; scope: 'day' | 'week' };

export type NorynSource = { load(owner: string, range: NorynLoadRange): Promise<OwnerSnapshot> };

async function rowsOf(query: NorynQuery): Promise<Row[]> {
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new NorynSourceError('db_error');
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
      const pick = (table: Table, columns: readonly string[] = READ_COLUMNS[table]) =>
        client.from(table).select(columns.join(', '));
      const mine = (table: Table, column: 'user_id' | 'owner_id' = 'user_id') =>
        pick(table).eq(column, owner).is('deleted_at', null);
      const libraryOrMine = `owner_id.is.null,owner_id.eq.${owner}`;
      const byDate = (query: NorynQuery, column: string) => query.gte(column, range.from).lte(column, range.to);
      // Le jour à Paris se calcule ensuite : on lit un jour de plus de chaque côté, en UTC.
      const finished = (table: 'workouts' | 'runs') =>
        mine(table)
          .eq('status', 'completed')
          .gte('finished_at', `${addDayKeys(range.from, -1)}T00:00:00Z`)
          .lt('finished_at', `${addDayKeys(range.to, 2)}T00:00:00Z`);
      const userRows = async (query: NorynQuery, column: 'user_id' | 'owner_id' = 'user_id') =>
        owned(await rowsOf(query), column, owner);
      const none = Promise.resolve([] as Row[]);

      const [receipts, settings, profiles, nutritionProfiles, runningProfiles, steps, food, water, wellbeing, planned, workouts, runs] =
        await Promise.all([
          userRows(pick('sync_receipts').eq('user_id', owner)),
          userRows(mine('user_settings')),
          userRows(mine('profiles')),
          isWeek ? none : userRows(mine('nutrition_profiles')),
          userRows(mine('running_profiles')),
          userRows(byDate(mine('daily_steps'), 'log_date')),
          isWeek ? none : userRows(byDate(mine('food_entries'), 'log_date')),
          isWeek ? none : userRows(byDate(mine('water_entries'), 'log_date')),
          userRows(
            byDate(
              (isWeek ? pick('daily_wellbeing', WEEK_WELLBEING_COLUMNS) : pick('daily_wellbeing'))
                .eq('user_id', owner)
                .is('deleted_at', null),
              'log_date',
            ),
          ),
          userRows(byDate(mine('planned_sessions', 'owner_id'), 'scheduled_date'), 'owner_id'),
          isWeek ? userRows(finished('workouts')) : none,
          isWeek ? userRows(finished('runs')) : none,
        ]);
      // Un UUID mal saisi dans le secret n'a ni profil ni réglages : ce n'est pas « jamais synchronisé ».
      if (settings.length === 0 && profiles.length === 0) throw new NorynSourceError('unknown_owner');

      // Le contenu lié : jamais lu s'il n'y a rien à lier (pas de `in.()` vide).
      const sessionIds = ids(planned, 'session_id');
      const content = (table: Table, column: string, values: string[], withDeleted = false) => {
        if (values.length === 0) return Promise.resolve([] as Row[]);
        const query = pick(table).in(column, values).or(libraryOrMine);
        return rowsOf(withDeleted ? query : query.is('deleted_at', null));
      };
      const [sessions, programs, exercisePlans, intervals] = await Promise.all([
        content('sessions', 'id', sessionIds),
        content('programs', 'id', ids(planned, 'program_id')),
        content('exercise_plans', 'session_id', sessionIds),
        content('session_intervals', 'session_id', sessionIds),
      ]);
      // Les exercices archivés de la bibliothèque descendent sur le téléphone (ADMIN-01) : pas de
      // filtre `deleted_at` ici, c'est `sessionInputsFor` qui applique celui de chaque requête de l'app.
      const exercises = await content('exercises', 'id', ids(exercisePlans, 'exercise_id'), true);

      const first = <T>(rows: Row[]) => (rows[0] ?? null) as T | null;
      return {
        owner,
        receivedAt: (first<{ received_at: string }>(receipts)?.received_at ?? null) as string | null,
        settings: first(settings),
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
      } as unknown as OwnerSnapshot;
    },
  };
}
