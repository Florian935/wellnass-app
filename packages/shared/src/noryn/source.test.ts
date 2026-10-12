import { describe, expect, it } from 'vitest';
import { buildNorynDay } from './day';
import { NOW, OTHER, OTHER_MARKERS, OWNER, fakeDb, twoUserTables, uid } from './noryn.testkit';
import {
  NorynSourceError,
  READINESS_COLUMNS,
  READ_COLUMNS,
  TARGET_COLUMNS,
  WEEK_WELLBEING_COLUMNS,
  createNorynSource,
} from './source';
import { buildNorynWeek } from './week';

const DAY_RANGE = { from: '2026-10-08', to: '2026-10-08', scope: 'day', today: '2026-10-08' } as const;
const WEEK_RANGE = { from: '2026-10-05', to: '2026-10-11', scope: 'week', today: '2026-10-08' } as const;

/**
 * Les colonnes que la spec (R8) exclut : aucune ne doit être demandée, quel que soit l'usage.
 * NORYN-02 permet `stress` (verdict), `weight_kg` (profil, pesées) et `distance_m` (courses,
 * activités) — **table par table**, figé dans `createNorynSource — NORYN-02, listes par usage` plus bas.
 */
const EXCLUDED_COLUMNS = [
  'mood',
  'alcohol_drinks',
  'late_caffeine',
  'nap_minutes',
  'cravings',
  'busy_day',
  'late_night',
  'travel',
  'sleep_start_at',
  'sleep_end_at',
  'name',
  'notes',
  'description',
  'instructions',
  'meal_type',
  'food_id',
  'micronutrients',
  'gps_track',
  'avg_pace_s_per_km',
  'set_type',
];

/** Les tables de l'utilisateur et leur colonne propriétaire. */
const USER_TABLES: Record<string, string> = {
  sync_receipts: 'user_id',
  user_settings: 'user_id',
  profiles: 'user_id',
  nutrition_profiles: 'user_id',
  running_profiles: 'user_id',
  daily_steps: 'user_id',
  food_entries: 'user_id',
  water_entries: 'user_id',
  daily_wellbeing: 'user_id',
  planned_sessions: 'owner_id',
  workouts: 'user_id',
  runs: 'user_id',
  real_life_periods: 'user_id',
  body_weight_entries: 'user_id',
  activities: 'user_id',
  workout_sets: 'user_id',
};
const CONTENT_TABLES = ['sessions', 'programs', 'exercise_plans', 'exercises', 'session_intervals'];

describe('createNorynSource — isolation au seul propriétaire', () => {
  it('la journée de Florian ne contient rien de l’autre compte', async () => {
    const { client } = fakeDb(twoUserTables());
    const snapshot = await createNorynSource(client).load(OWNER, DAY_RANGE);
    const day = buildNorynDay(snapshot, { date: '2026-10-08', now: NOW });

    const json = JSON.stringify(day);
    for (const marker of OTHER_MARKERS) expect(json).not.toContain(marker);
    expect(day.steps?.count).toBe(6_400);
    expect(day.nutrition?.energy_kcal).toBe(1_450);
    expect(day.hydration).toEqual({ volume_ml: 1_250, target_ml: 2_500 });
    expect(day.recovery?.sleep_minutes).toBe(425);
    expect(day.intensity_on_hold).toBe(false);
    expect(day.synced_at).toBe('2026-10-08T09:00:00.123Z');
    // La séance qui pointait vers le contenu privé de l'autre compte est écartée.
    expect(day.training.map((s) => s.id)).toEqual([uid(1)]);
    expect(day.training[0]?.tags).toEqual(['heavy_lower']);
    // Le plan supprimé (20 séries) ne compte pas : 9 × (40 + 120) − 120 = 1 320 s → 20 min.
    expect(day.training[0]?.estimated_minutes).toBe(20);
  });

  it('la semaine de Florian ne compte que ses séances faites', async () => {
    const { client } = fakeDb(twoUserTables());
    const snapshot = await createNorynSource(client).load(OWNER, WEEK_RANGE);
    const week = buildNorynWeek(snapshot, { start: '2026-10-05', now: NOW });

    const json = JSON.stringify(week);
    for (const marker of OTHER_MARKERS) expect(json).not.toContain(marker);
    // La séance du 06/10, et (jeu étendu par NORYN-02) celle du 08/10.
    expect(week.training.done).toEqual({ strength: 2, running: 1 });
    // Le total du 07/10 est supprimé : aucun pas ce jour-là.
    expect(week.steps?.days[2]).toEqual({ date: '2026-10-07', count: null });
  });

  it('chaque lecture écarte les lignes supprimées (R6), sauf le reçu et les exercices', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    await createNorynSource(client).load(OWNER, WEEK_RANGE);

    for (const q of log) {
      // Le reçu n'a pas de suppression ; les exercices archivés de la bibliothèque sont sur le téléphone.
      if (q.table === 'sync_receipts' || q.table === 'exercises') {
        expect(q.filters).not.toContain('is:deleted_at=null');
      } else {
        expect(q.filters).toContain('is:deleted_at=null');
      }
    }
  });

  it('chaque requête sur une table de l’utilisateur filtre son propriétaire', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    await createNorynSource(client).load(OWNER, WEEK_RANGE);

    const userQueries = log.filter((q) => q.table in USER_TABLES);
    expect(new Set(userQueries.map((q) => q.table))).toEqual(new Set(Object.keys(USER_TABLES)));
    for (const q of userQueries) expect(q.filters).toContain(`eq:${USER_TABLES[q.table]}=${OWNER}`);
  });

  it('le contenu lié est filtré dans la requête : bibliothèque ou propriétaire', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, DAY_RANGE);

    const contentQueries = log.filter((q) => CONTENT_TABLES.includes(q.table));
    expect(contentQueries.length).toBeGreaterThan(0);
    for (const q of contentQueries) expect(q.filters).toContain(`or:owner_id.is.null,owner_id.eq.${OWNER}`);
  });

  it('un filtre oublié fait échouer la lecture : rien n’est composé (double barrière, R7)', async () => {
    const { client } = fakeDb(twoUserTables(), { ignoreOwnerFilter: true });
    await expect(createNorynSource(client).load(OWNER, DAY_RANGE)).rejects.toMatchObject({ code: 'foreign_row' });
  });
});

describe('createNorynSource — minimisation (R8)', () => {
  it('la liste blanche est figée ici : toute colonne de plus exige de relire ce test', () => {
    expect(READ_COLUMNS).toEqual({
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
    });
    expect(WEEK_WELLBEING_COLUMNS).toEqual(['user_id', 'log_date', 'sleep_minutes']);
  });

  it('chaque sélection est l’une des listes blanches de sa table, sans *', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    await createNorynSource(client).load(OWNER, WEEK_RANGE);

    const lists = (table: string): string[][] =>
      [
        READ_COLUMNS[table as keyof typeof READ_COLUMNS],
        TARGET_COLUMNS[table as keyof typeof TARGET_COLUMNS],
        READINESS_COLUMNS[table as keyof typeof READINESS_COLUMNS],
        table === 'daily_wellbeing' ? WEEK_WELLBEING_COLUMNS : undefined,
      ]
        .filter((l) => l !== undefined)
        .map((l) => [...(l as readonly string[])]);
    for (const q of log) {
      expect(q.columns).not.toContain('*');
      expect(lists(q.table)).toContainEqual(q.columns);
    }
  });

  it('la semaine ne lit que ce qu’elle sert : ni repas, ni eau, et du check-in la seule nuit', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, WEEK_RANGE);
    const tables = log.map((q) => q.table);
    expect(tables).not.toContain('food_entries');
    expect(tables).not.toContain('water_entries');
    expect(tables).not.toContain('nutrition_profiles');
    expect(log.find((q) => q.table === 'daily_wellbeing')?.columns).toEqual([...WEEK_WELLBEING_COLUMNS]);
  });

  it('aucune colonne exclue par la spec n’est lue', () => {
    for (const list of [READ_COLUMNS, TARGET_COLUMNS, READINESS_COLUMNS]) {
      for (const columns of Object.values(list)) {
        for (const excluded of EXCLUDED_COLUMNS) expect(columns).not.toContain(excluded);
      }
    }
  });

  it('la journée ne lit les séances faites que pour la cible et le verdict, jamais avec les colonnes de la semaine', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    for (const q of log.filter((x) => x.table === 'workouts' || x.table === 'runs')) {
      expect(q.columns).not.toEqual([...READ_COLUMNS.workouts]);
    }
  });

  it('la semaine lit les séances terminées avec un jour de marge de part et d’autre (jour à Paris)', async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, WEEK_RANGE);
    const workouts = log.find((q) => q.table === 'workouts');
    expect(workouts?.filters).toEqual(
      expect.arrayContaining([
        'eq:status=completed',
        'gte:finished_at=2026-10-04T00:00:00Z',
        'lt:finished_at=2026-10-13T00:00:00Z',
      ]),
    );
  });

  it('sans séance planifiée, aucune requête de contenu', async () => {
    const tables = { ...twoUserTables(), planned_sessions: [] };
    const { client, log } = fakeDb(tables);
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    expect(log.some((q) => CONTENT_TABLES.includes(q.table))).toBe(false);
  });

  it('sans plan d’exercice, aucune requête d’exercices', async () => {
    const tables = { ...twoUserTables(), exercise_plans: [] };
    const { client, log } = fakeDb(tables);
    await createNorynSource(client).load(OWNER, DAY_RANGE);
    expect(log.map((q) => q.table)).not.toContain('exercises');
  });
});

describe('createNorynSource — pannes', () => {
  it('une erreur de la base lève db_error', async () => {
    const { client } = fakeDb(twoUserTables(), { failOn: 'food_entries' });
    await expect(createNorynSource(client).load(OWNER, DAY_RANGE)).rejects.toMatchObject({ code: 'db_error' });
  });

  it('une réponse qui n’est pas une liste lève db_error', async () => {
    const { client } = fakeDb(twoUserTables(), { nonArrayOn: 'profiles' });
    await expect(createNorynSource(client).load(OWNER, DAY_RANGE)).rejects.toMatchObject({ code: 'db_error' });
  });

  it('sans client (URL ou clé absentes) : db_error', async () => {
    await expect(createNorynSource(null).load(OWNER, DAY_RANGE)).rejects.toBeInstanceOf(NorynSourceError);
  });

  it('réglages ou reçu absents : null, sans erreur', async () => {
    const tables = { ...twoUserTables(), user_settings: [], sync_receipts: [], nutrition_profiles: [], running_profiles: [] };
    const { client } = fakeDb(tables);
    const snapshot = await createNorynSource(client).load(OTHER, DAY_RANGE);
    expect(snapshot.settings).toBeNull();
    expect(snapshot.nutritionProfile).toBeNull();
    expect(snapshot.runningProfile).toBeNull();
    expect(snapshot.receivedAt).toBeNull();
  });

  it('un propriétaire sans profil ni réglages (UUID mal saisi) : unknown_owner, pas « jamais synchronisé »', async () => {
    const { client } = fakeDb(twoUserTables());
    await expect(
      createNorynSource(client).load('33333333-3333-4333-8333-333333333333', DAY_RANGE),
    ).rejects.toMatchObject({ code: 'unknown_owner' });
  });
});

describe('createNorynSource — NORYN-02, listes par usage', () => {
  it('les listes des cibles et du verdict sont figées ici : toute colonne de plus exige de relire ce test', () => {
    expect(TARGET_COLUMNS).toEqual({
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
    });
    expect(READINESS_COLUMNS).toEqual({
      workouts: ['user_id', 'finished_at', 'duration_seconds', 'rpe'],
      runs: ['user_id', 'finished_at', 'duration_seconds', 'rpe'],
      activities: ['user_id', 'started_at', 'duration_seconds', 'rpe'],
      food_entries: ['user_id', 'log_date', 'kcal'],
      daily_wellbeing: ['user_id', 'log_date', 'energy', 'stress', 'sleep_minutes', 'sleep_quality', 'sick'],
    });
  });

  it('`stress`, `weight_kg`, `distance_m` : chacun dans ses seules tables et son seul usage', () => {
    const where = (column: string) =>
      Object.entries({ READ: READ_COLUMNS, TARGET: TARGET_COLUMNS, READINESS: READINESS_COLUMNS })
        .flatMap(([usage, lists]) =>
          Object.entries(lists)
            .filter(([, columns]) => (columns as readonly string[]).includes(column))
            .map(([table]) => `${usage}.${table}`),
        )
        .sort();
    expect(where('stress')).toEqual(['READINESS.daily_wellbeing']);
    expect(where('weight_kg')).toEqual(['TARGET.body_weight_entries', 'TARGET.profiles']);
    expect(where('distance_m')).toEqual(['TARGET.activities', 'TARGET.runs']);
    expect(where('mood')).toEqual([]);
    expect(where('reps')).toEqual(['READ.session_intervals']); // les répétitions PRÉVUES d'un bloc, jamais celles d'une série
  });
});
