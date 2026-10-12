/**
 * US NORYN-01 — outillage de test (exclu de la couverture : `*.testkit.ts`). Jamais importé par le
 * code de production ni par le bundle.
 */

import type { NorynDbClient, NorynQuery } from './source';
import type { OwnerSnapshot } from './snapshot';

type Row = Record<string, unknown>;

/** Une requête telle que la fausse base l'a reçue. */
export type LoggedQuery = { table: string; columns: string[]; filters: string[] };

/**
 * Une fausse base PostgREST en mémoire : elle applique **vraiment** les filtres reçus (`eq`, `in`,
 * `gte`, `lt`, `lte`, `is`, le seul `or` « bibliothèque ou propriétaire », et — NORYN-02 — `order`
 * puis `limit`), projette les colonnes
 * demandées et **lève** sur une colonne inconnue (une faute de frappe ne passe pas en silence).
 * Elle note chaque requête, pour les tests-gardes.
 *
 * `ignoreOwnerFilter` simule un oubli de filtre : la base renvoie alors les lignes de tout le monde.
 */
export function fakeDb(
  tables: Record<string, Row[]>,
  options: { ignoreOwnerFilter?: boolean; ignoreOwnerFilterOn?: string[]; failOn?: string; nonArrayOn?: string } = {},
): { client: NorynDbClient; log: LoggedQuery[] } {
  const log: LoggedQuery[] = [];
  const isOwnerColumn = (column: string) => column === 'user_id' || column === 'owner_id';

  const client: NorynDbClient = {
    from(table) {
      return {
        select(columnList) {
          const entry: LoggedQuery = { table, columns: columnList.split(',').map((c) => c.trim()), filters: [] };
          log.push(entry);
          const predicates: ((row: Row) => boolean)[] = [];
          const sorts: { column: string; ascending: boolean }[] = [];
          let max: number | null = null;
          const ignoreOwner = options.ignoreOwnerFilter === true || (options.ignoreOwnerFilterOn ?? []).includes(table);
          /** Une colonne absente de la ligne est une faute de frappe : elle lève, comme la projection. */
          const read = (row: Row, column: string) => {
            if (!(column in row)) throw new Error(`fakeDb : colonne inconnue ${table}.${column} (filtre ou tri)`);
            return row[column];
          };
          /**
           * Comme Postgres : `NULL` ne passe aucune comparaison ; deux instants se comparent comme des
           * instants (`…T00:00:00Z` égale `…T00:00:00.000+00:00`), le reste comme du texte.
           */
          const compare = (value: unknown, bound: string): number | null => {
            if (value === null || value === undefined) return null;
            const text = String(value);
            const instant = /T\d{2}:\d{2}/;
            if (instant.test(text) && instant.test(bound)) return Date.parse(text) - Date.parse(bound);
            return text < bound ? -1 : text > bound ? 1 : 0;
          };
          const add = (filter: string, predicate: (row: Row) => boolean, ownerFilter = false) => {
            entry.filters.push(filter);
            if (!(ownerFilter && ignoreOwner)) predicates.push(predicate);
            return query;
          };
          const query: NorynQuery = {
            eq: (column, value) => add(`eq:${column}=${String(value)}`, (r) => read(r, column) === value, isOwnerColumn(column)),
            in: (column, values) => add(`in:${column}`, (r) => values.includes(read(r, column) as string)),
            gte: (column, value) => add(`gte:${column}=${value}`, (r) => (compare(read(r, column), value) ?? -1) >= 0),
            lt: (column, value) => add(`lt:${column}=${value}`, (r) => (compare(read(r, column), value) ?? 0) < 0 && read(r, column) != null),
            lte: (column, value) => add(`lte:${column}=${value}`, (r) => (compare(read(r, column), value) ?? 1) <= 0),
            is: (column) => add(`is:${column}=null`, (r) => read(r, column) === null),
            or: (filters) => {
              const match = /^owner_id\.is\.null,owner_id\.eq\.(.+)$/.exec(filters);
              if (match === null) throw new Error(`fakeDb : filtre or non pris en charge : ${filters}`);
              return add(`or:${filters}`, (r) => r.owner_id === null || r.owner_id === match[1], true);
            },
            order: (column, { ascending }) => {
              entry.filters.push(`order:${column}=${ascending ? 'asc' : 'desc'}`);
              sorts.push({ column, ascending });
              return query;
            },
            limit: (count) => {
              entry.filters.push(`limit:${count}`);
              max = count;
              return query;
            },
            then(resolve, reject) {
              const run = () => {
                if (options.failOn === table) return { data: null, error: { message: 'panne simulée' } };
                if (options.nonArrayOn === table) return { data: { oups: true }, error: null };
                const rows = (tables[table] ?? []).filter((row) => predicates.every((p) => p(row)));
                for (const { column, ascending } of [...sorts].reverse()) {
                  rows.sort((a, b) => {
                    const x = String(read(a, column));
                    const y = String(read(b, column));
                    return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
                  });
                }
                if (max !== null) rows.splice(max);
                const data = rows.map((row) =>
                  Object.fromEntries(
                    entry.columns.map((column) => {
                      if (!(column in row)) throw new Error(`fakeDb : colonne inconnue ${table}.${column}`);
                      return [column, row[column]];
                    }),
                  ),
                );
                return { data, error: null };
              };
              return Promise.resolve().then(run).then(resolve, reject);
            },
          };
          return query;
        },
      };
    },
  };
  return { client, log };
}

/** Florian, le seul compte que lit la fonction. */
export const OWNER = '11111111-1111-4111-8111-111111111111';
/** Un autre compte de l'app, dont rien ne doit jamais sortir. */
export const OTHER = '22222222-2222-4222-8222-222222222222';
/** « Maintenant » : jeudi 08/10/2026, 14 h à Paris. */
export const NOW = new Date('2026-10-08T12:00:00Z');

/** Un UUID canonique reconnaissable. */
export const uid = (n: number): string => `5b0c2f9e-8d1a-4c3e-9f6b-${String(n).padStart(12, '0')}`;

/**
 * Les valeurs **reconnaissables** du second compte : aucune ne doit jamais apparaître dans une
 * réponse faite pour Florian.
 */
export const OTHER_MARKERS = ['99999', '7777', '7700', '33333', '777', OTHER, uid(99), uid(98)];

/**
 * Deux comptes, aux mêmes dates, dans toutes les tables lues — avec, en plus, des colonnes que la
 * fonction ne doit jamais demander (humeur, noms, notes, charges…) ou seulement pour un usage (le stress,
 * pour le verdict d'aujourd'hui).
 */
export function twoUserTables(): Record<string, Row[]> {
  const settings = (user_id: string) => ({
    user_id,
    active_pillars: ['strength', 'running', 'nutrition'],
    health_connect_enabled: true,
    wellbeing_pillar_enabled: true,
    language: 'fr',
    deleted_at: null,
  });
  const wellbeing = (user_id: string, sleep: number, sick: boolean) => ({
    user_id,
    log_date: '2026-10-08',
    sleep_minutes: sleep,
    sleep_quality: 4,
    energy: 3,
    motivation: 4,
    sick,
    mood: 1,
    stress: 5,
    alcohol_drinks: 3,
    sleep_start_at: '2026-10-07T21:00:00Z',
    deleted_at: null,
  });
  const done = (user_id: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      user_id,
      id: `${user_id}-done-${i}`,
      status: 'completed',
      started_at: '2026-10-06T16:00:00Z',
      finished_at: '2026-10-06T17:00:00Z',
      duration_seconds: 3600,
      rpe: 6,
      distance_m: 8000,
      elevation_gain_m: null,
      notes: 'note privée',
      deleted_at: null,
    }));
  // US NORYN-02 — une séance de muscu ce jeudi 08/10 (à Paris), ses séries, et des lignes que la cible
  // ne doit jamais lire (charge, répétitions).
  const today = (user_id: string, n: number) => ({
    user_id,
    id: `${user_id}-today-${n}`,
    status: 'completed',
    started_at: '2026-10-08T06:00:00Z',
    finished_at: '2026-10-08T07:00:00Z',
    duration_seconds: 3600,
    rpe: 7,
    distance_m: 10_000,
    elevation_gain_m: 40,
    notes: 'note privée',
    deleted_at: null,
  });
  const sets = (user_id: string, workout_id: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      user_id,
      id: `${workout_id}-set-${i}`,
      workout_id,
      done: true,
      set_type: 'normal',
      reps: 10,
      weight_kg: 77.7,
      deleted_at: null,
    }));
  const targetProfile = (weight_kg: number, height_cm: number) => ({
    birth_date: '1996-01-15',
    sex: 'male',
    height_cm,
    weight_kg,
    main_goal: 'muscle',
  });
  const targetNutrition = {
    objective: 'cut',
    activity_level: 'moderate',
    manual_calories: null,
    manual_protein_g: null,
    manual_carbs_g: null,
    manual_fat_g: null,
    training_day_bonus: 300,
    training_bonus_mode: 'activities',
    sport_free_level: null,
  };
  const planned = (owner_id: string, id: string, session_id: string, program_id: string) => ({
    owner_id,
    id,
    scheduled_date: '2026-10-08',
    scheduled_time: '18:30:00',
    status: 'planned',
    session_id,
    program_id,
    deleted_at: null,
  });
  return {
    sync_receipts: [
      { user_id: OWNER, received_at: '2026-10-08T09:00:00.123456+00:00' },
      { user_id: OTHER, received_at: '2026-10-08T11:59:00+00:00' },
    ],
    user_settings: [settings(OWNER), settings(OTHER)],
    profiles: [
      { user_id: OWNER, daily_step_goal: 10_000, first_name: 'Florian', ...targetProfile(80, 180), deleted_at: null },
      { user_id: OTHER, daily_step_goal: 33_333, first_name: 'Autre', ...targetProfile(60, 160), deleted_at: null },
    ],
    nutrition_profiles: [
      { user_id: OWNER, water_target_ml: 2_500, ...targetNutrition, deleted_at: null },
      { user_id: OTHER, water_target_ml: 7_777, ...targetNutrition, manual_calories: 7_777, deleted_at: null },
    ],
    real_life_periods: [
      { user_id: OWNER, started_on: '2026-10-20', ends_on: '2026-10-21', deleted_at: null },
      { user_id: OTHER, started_on: '2026-10-01', ends_on: '2026-10-31', deleted_at: null },
    ],
    body_weight_entries: [
      { user_id: OWNER, id: 'b-1', log_date: '2026-09-01', weight_kg: 81, deleted_at: null },
      { user_id: OWNER, id: 'b-2', log_date: '2026-10-05', weight_kg: 79.5, deleted_at: null },
      { user_id: OWNER, id: 'b-3', log_date: '2026-10-07', weight_kg: 70, deleted_at: '2026-10-07T20:00:00Z' },
      { user_id: OTHER, id: 'b-other', log_date: '2026-10-08', weight_kg: 177.7, deleted_at: null },
    ],
    activities: [
      { user_id: OWNER, id: 'a-owner', activity_type: 'bike', started_at: '2026-10-08T15:00:00Z', duration_seconds: 3600, intensity: 'moderate', rpe: 6, distance_m: 25_000, device_kcal: null, notes: 'privé', deleted_at: null },
      { user_id: OTHER, id: 'a-other', activity_type: 'bike', started_at: '2026-10-08T15:00:00Z', duration_seconds: 9_999, intensity: 'vigorous', rpe: 10, distance_m: 99_999, device_kcal: 7_777, notes: 'privé', deleted_at: null },
    ],
    workout_sets: [
      ...sets(OWNER, `${OWNER}-today-0`, 12),
      ...sets(OTHER, `${OTHER}-today-0`, 30),
      // Une série de l'autre compte rattachée à la séance de Florian : seul le filtre propriétaire l'écarte.
      { ...sets(OTHER, `${OWNER}-today-0`, 1)[0]!, id: 'set-etrangere' },
    ],
    running_profiles: [
      { user_id: OWNER, ref_5k_pace_s_per_km: 300, deleted_at: null },
      { user_id: OTHER, ref_5k_pace_s_per_km: 999, deleted_at: null },
    ],
    daily_steps: [
      { user_id: OWNER, log_date: '2026-10-08', steps: 6_400, deleted_at: null },
      { user_id: OTHER, log_date: '2026-10-08', steps: 99_999, deleted_at: null },
      { user_id: OWNER, log_date: '2026-10-07', steps: 5_000, deleted_at: '2026-10-07T20:00:00Z' },
    ],
    food_entries: [
      { user_id: OWNER, log_date: '2026-10-08', kcal: 1_450, protein_g: 92, name: 'riz', meal_type: 'lunch', deleted_at: null },
      // Supprimée : ne doit jamais compter.
      { user_id: OWNER, log_date: '2026-10-08', kcal: 5_555, protein_g: 55, name: 'effacé', meal_type: 'lunch', deleted_at: '2026-10-08T10:00:00Z' },
      { user_id: OTHER, log_date: '2026-10-08', kcal: 7_777, protein_g: 777, name: 'secret', meal_type: 'lunch', deleted_at: null },
    ],
    water_entries: [
      { user_id: OWNER, log_date: '2026-10-08', volume_ml: 1_250, deleted_at: null },
      { user_id: OWNER, log_date: '2026-10-08', volume_ml: 5_000, deleted_at: '2026-10-08T10:00:00Z' },
      { user_id: OTHER, log_date: '2026-10-08', volume_ml: 7_700, deleted_at: null },
    ],
    daily_wellbeing: [wellbeing(OWNER, 425, false), wellbeing(OTHER, 777, true)],
    planned_sessions: [
      planned(OWNER, uid(1), 's-lib', 'p-lib'),
      // Une séance de Florian qui pointe vers la séance privée de l'autre compte : écartée.
      planned(OWNER, uid(2), 's-other', 'p-other'),
      // Supprimée : ne doit jamais sortir.
      { ...planned(OWNER, uid(3), 's-lib', 'p-lib'), deleted_at: '2026-10-08T10:00:00Z' },
      planned(OTHER, uid(99), 's-other', 'p-other'),
      planned(OTHER, uid(98), 's-lib', 'p-lib'),
    ],
    sessions: [
      { owner_id: null, id: 's-lib', session_type: null, order_index: 0, target_duration_seconds: null, target_distance_m: null, name: 'Jambes', deleted_at: null },
      { owner_id: OTHER, id: 's-other', session_type: 'sortie_longue', order_index: 0, target_duration_seconds: 7777, target_distance_m: null, name: 'Privée', deleted_at: null },
    ],
    programs: [
      { owner_id: null, id: 'p-lib', pillar: 'strength', status: 'published', deleted_at: null },
      { owner_id: OTHER, id: 'p-other', pillar: 'running', status: 'draft', deleted_at: null },
    ],
    exercise_plans: [
      { owner_id: null, session_id: 's-lib', exercise_id: 'e-lib', order_index: 0, target_sets: 9, rest_seconds: 120, deleted_at: null },
      // Supprimé : ne compte ni pour la durée ni pour heavy_lower.
      { owner_id: null, session_id: 's-lib', exercise_id: 'e-lib', order_index: 1, target_sets: 20, rest_seconds: 120, deleted_at: '2026-09-01T00:00:00Z' },
    ],
    exercises: [{ owner_id: null, id: 'e-lib', muscle_primary: 'legs', status: 'published', deleted_at: null }],
    session_intervals: [
      { owner_id: null, session_id: 's-lib', order_index: 0, reps: 3, fast_distance_m: 400, recovery_distance_m: 200, deleted_at: '2026-09-01T00:00:00Z' },
    ],
    workouts: [...done(OWNER, 1), ...done(OTHER, 7), today(OWNER, 0), today(OTHER, 0)],
    runs: [...done(OWNER, 1), ...done(OTHER, 7)],
  };
}

/** Un instantané vide, synchronisé ce matin, tous les domaines suivis. */
export function emptySnapshot(over: Partial<OwnerSnapshot> = {}): OwnerSnapshot {
  return {
    owner: OWNER,
    receivedAt: '2026-10-08T09:00:00.123456+00:00',
    settings: {
      user_id: OWNER,
      active_pillars: ['strength', 'running', 'nutrition'],
      health_connect_enabled: true,
      wellbeing_pillar_enabled: true,
    },
    profile: { user_id: OWNER, daily_step_goal: 10_000 },
    nutritionProfile: { user_id: OWNER, water_target_ml: 2_500 },
    runningProfile: { user_id: OWNER, ref_5k_pace_s_per_km: 300 },
    steps: [],
    food: [],
    water: [],
    wellbeing: [],
    planned: [],
    sessions: [],
    programs: [],
    exercisePlans: [],
    exercises: [],
    intervals: [],
    workouts: [],
    runs: [],
    ...over,
  };
}
